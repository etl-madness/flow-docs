# `<flow>` — Main Pipeline Execution Container

The `<flow>` element is the primary execution container of a Flow XML pipeline (`<pipeline>`). It encapsulates the sequential, conditional, iterative, transactional, and concurrent AST steps that perform the core ETL/ELT data movement, transformations, and automation work.

> [!IMPORTANT]
> **Separation from `<preflight>`**: During XML parsing (`flow.ParseXMLConfig`), `<preflight>` and `<flow>` are compiled into two distinct AST slices (`cfg.PreflightNodes` and `cfg.FlowNodes`). Running `flow` normally (`flow -file pipeline.xml`) executes **only** `<flow>` and skips `<preflight>`, whereas passing `-preflight` executes **only** `<preflight>` and never enters `<flow>`.

---

## 1. Position in the `<pipeline>` Document Lifecycle

In the Flow XML Schema (`pipeline.xsd`), `<flow>` is the fourth and final top-level section inside `<pipeline>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pipeline name="DailyCustomerSync"
          description="End-to-end customer synchronization and reporting"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd">

    <!-- 1. Pipeline Variables (Initialized first into the Registry) -->
    <variables>
        <variable name="BatchStatus" type="string" value="READY" />
    </variables>

    <!-- 2. Database Connection Pools (Opened and registered by name) -->
    <databases>
        <database name="warehouse_db" driver="postgres" connection_string="{{WAREHOUSE_DSN}}" />
    </databases>

    <!-- 3. Preflight Readiness Gates (Executed ONLY when -preflight is passed) -->
    <preflight>
        <sql id="ping_warehouse" db="warehouse_db">SELECT 1;</sql>
    </preflight>

    <!-- 4. Main Execution Flow (Executed by default in standard pipeline runs) -->
    <flow>
        <sql id="sync_customers" db="warehouse_db">
            INSERT INTO customers_archive SELECT * FROM customers_staging WHERE status = {{BatchStatus}};
        </sql>
    </flow>

</pipeline>
```

```mermaid
flowchart LR
    XML["pipeline.xml + config.xml"] --> PARSE["ParseXMLConfig &amp; ValidateAST"]
    PARSE --> REG["Initialize Registry<br/>(&lt;variables&gt; + -vars + &lt;databases&gt;)"]
    REG --> MODE{"Execution Mode?"}
    MODE -->|"Default CLI Run<br/>(flow -file pipeline.xml)"| FLOW["Execute &lt;flow&gt; Nodes Only<br/>(cfg.FlowNodes)"]
    MODE -->|"Preflight CLI Flag<br/>(flow -file pipeline.xml -preflight)"| PRE["Execute &lt;preflight&gt; Nodes Only<br/>(cfg.PreflightNodes)"]
    MODE -->|"Validation Flag<br/>(flow -file pipeline.xml -validate)"| VAL["Validate Both &lt;preflight&gt; &amp; &lt;flow&gt;<br/>(No Nodes Executed)"]
```

---

## 2. How `<flow>` Differs from `<preflight>`

Although both `<flow>` and `<preflight>` share the exact same XSD schema type (`PipelineNodesType`)—meaning every AST node (`<sql>`, `<sql_bulk>`, `<script>`, `<group>`, `<parallel>`, `<assert>`, etc.) is syntactically valid in either block—they serve fundamentally different roles in the pipeline lifecycle:

| Dimension | `<flow>` (Main Execution Block) | `<preflight>` (Readiness & Quality Gate Block) |
| :--- | :--- | :--- |
| **Primary Purpose** | Executes the core production workload: bulk data streaming, SQL DML/DDL migrations, file/Excel generation, API mutations, and business logic. | Validates that the target environment, credentials, endpoints, disk space, and upstream dependencies are healthy **before** committing to heavy ETL work. |
| **Default CLI Behavior (`flow -file ...`)** | **Executed** from top to bottom. | **Skipped** completely (zero runtime overhead during normal execution). |
| **Preflight CLI Behavior (`flow -preflight ...`)** | **Skipped** completely (guarantees zero production data mutations during a dry-run readiness check). | **Executed** from top to bottom. |
| **Schema & AST Validation (`flow -validate`)** | **Validated** (XSD + `flow.ValidateAST` semantic checks such as database handle references). | **Validated** alongside `<flow>` in the same semantic pass. |
| **Parsed AST Field (`PipelineConfig`)** | `cfg.FlowNodes` (`[]flow.PipelineNode`) | `cfg.PreflightNodes` (`[]flow.PipelineNode`) |
| **Visual Builder (`flow -builder`)** | Edited in the **Main Flow** canvas tab; executed via **Run Pipeline**. | Edited in the **Preflight** canvas tab; executed independently via **Run Preflight**. |
| **REST API (`go-flowAPI`)** | Triggered when `preflight_only: false` (default) on `/api/v1/execute` or `/api/v1/execute/stream`. | Triggered when `preflight_only: true` on `/api/v1/execute` or `/api/v1/execute/stream`. |
| **Typical Side-Effect Profile** | **Stateful / Mutating**: Writes tables (`<sql_bulk>`), updates KV keys (`<kv_bulk>`), writes reports (`<excel_write>`), and sends webhooks (`<http_client>`). | **Read-Only / Idempotent**: Runs `SELECT 1`, checks HTTP `HEAD /health`, verifies free disk space, or creates local working folders (`mkdir -p`). |

### Why Are `<preflight>` and `<flow>` Executed Separately?

1. **Zero-Risk Environment Dry Runs**: DevOps pipelines, CI/CD deployment jobs, and orchestrators can run `flow -file pipeline.xml -config prod.xml -preflight` during a deployment window to verify that production secrets decrypt, databases accept connections, and remote APIs respond—with a hard guarantee that no `<flow>` data loads or deletes will be triggered.
2. **Zero Overhead in High-Frequency Production Runs**: Once an environment is verified, scheduled jobs that run `<flow>` every minute or hour do not waste time or API rate-limit quotas repeating expensive preflight diagnostics unless explicitly requested.
3. **Two-Phase Orchestration**: In shell scripts, CI/CD pipelines, or embedded Go applications, you can gate `<flow>` behind `<preflight>` explicitly:

```bash
# Phase 1: Verify environment readiness; abort immediately if preflight fails
./flow -file etl_pipeline.xml -config prod_config.xml -preflight && \
# Phase 2: Execute the main <flow> workload
./flow -file etl_pipeline.xml -config prod_config.xml -format stream
```

---

## 3. Execution Semantics Inside `<flow>`

### 3.1 Sequential Document-Order Execution
By default, child nodes inside `<flow>` execute **sequentially in top-to-bottom XML document order**. Each step completes before the next step starts:
- Every completed node updates the pipeline `Registry` (such as `LAST_OUTPUT` and any node-specific `output_var`, `status_var`, or `fail_var`).
- Downstream nodes in `<flow>` can immediately reference variables mutated by earlier nodes via `{{VariableName}}`, `"host/vars"` (Go), `vars` (Lua), or `$env:VariableName` / `"${VariableName}"` (shells).

### 3.2 Control Flow, Concurrency & Transaction Boundaries
You can alter linear execution inside `<flow>` using structural container nodes:
- **[`<group>`](group.md)**: Wraps a subset of `<flow>` nodes into a logical block with optional conditional execution (`if_var` / `if_equals`) and atomic database transactions (`transaction="true"` with nested savepoint support).
- **[`<if>` / `<then>` / `<else>`](if_then_else.md)**: Branches execution based on variable equality or boolean expressions.
- **[`<foreach>` / `<loop>`](foreach.md)**: Streams or buffers rows from a SQL query and executes nested child nodes for each record (setting `LOOP_INDEX` and column variables).
- **[`<while>`](while.md)**: Repeats nested child steps while a condition remains true (up to `max_iterations`).
- **[`<parallel>`](parallel.md)**: Fans out child steps across a bounded worker pool (`max_threads`) with isolated per-goroutine variable scopes and cooperative cancellation.

### 3.3 Error Propagation & Halting Behavior
If any node inside `<flow>` returns an unrecovered error:
1. If the node specifies `on_error="retry"` (e.g., on `<script>` or `<http_client>`), Flow retries the node according to `retry_count` and `retry_interval`.
2. If the node specifies `on_error="continue"` or `on_failure="warn"` (on `<assert>`), Flow records the warning and advances to the next node in `<flow>`.
3. Otherwise (`on_error="stop"` / `on_failure="halt"`, the default), `<flow>` halts immediately, rolls back any active `<group transaction="true">` transaction, records the failure in `log_db` (if configured), and exits with return code `1`.

---

## 4. Allowed Child Elements Inside `<flow>`

`<flow>` accepts any combination of the following executable AST elements (zero or more, in any order):

| Category | XML Elements | Description |
| :--- | :--- | :--- |
| **Control Flow & Concurrency** | [`<group>`](group.md), [`<if>`](if_then_else.md), [`<foreach>` / `<loop>`](foreach.md), [`<while>`](while.md), [`<parallel>`](parallel.md) | Sequential/transactional grouping, conditional branching, SQL cursor iteration, conditional loops, and multi-threaded worker pools. |
| **Quality & Validation** | [`<assert>`](assert.md) | Runtime invariant checks with `halt` vs. `warn` policies and `<on_failure>` recovery blocks. |
| **Polyglot Scripting** | [`<script>`](script.md) ([`go`](golang.md), [`lua`](lua.md), [`csx`](csx.md), [`pwsh` / `powershell`](powershell.md), [`bash` / `sh`](bash.md)) | In-process Go (`Yaegi`) and Lua (`Gopher-Lua`) VMs plus external C#, PowerShell, and POSIX shell scripts. |
| **Database & SQL** | [`<sql>`](sql.md), [`<sql_bulk>`](sql_bulk.md) | Single/multi-statement SQL queries and $O(1)$ constant-memory cross-database bulk streaming. |
| **Key-Value & Cache** | [`<kv>` / `<kv_bulk>`](kv.md) | Atomic operations and SQL-to-KV bulk streaming across `bbolt`, `badger`, `redis`/`valkey`, and `etcd`. |
| **Templates** | [`<template>`](template.md), [`<template_html>`](template_html.md) | Dynamic text/SQL/JSON generation (`text/template`) and XSS-safe HTML rendering (`html/template`). |
| **HTTP & Structured Data** | [`<http_client>`](http_client.md), [`<json_path>`](json_path.md), [`<xml_xpath>`](xml_path.md), [`<yaml_path>`](yaml_path.md) | REST API requests and structured data extraction using JSONPath, XPath, and YAML paths. |
| **Files & Excel** | [`<file_read>`](file_read.md), [`<file_save>`](file_save.md), [`<excel_read>`](excel_read.md), [`<excel_write>`](excel_write.md) | Local file I/O and multi-sheet `.xlsx` workbook reading/writing. |

---

## 5. Multi-File Merging with `-config`

When you split a pipeline into a base workflow (`-file pipeline.xml`) and an environment overlay (`-config prod_config.xml`), Flow merges both files deterministically:
1. `<variables>` and `<databases>` from `-config` are appended (overriding base entries with matching names).
2. `<preflight>` nodes from `-config` are appended after the base `<preflight>` nodes.
3. `<flow>` nodes from `-config` are appended after the base `<flow>` nodes.

This allows an environment configuration file to append environment-specific post-execution hooks (such as sending a production Slack/Teams notification or archiving audit logs) to the end of the main `<flow>` without modifying the core `pipeline.xml`.

---

## 6. Complete Example: Coordinated `<preflight>` and `<flow>`

The following pipeline illustrates best-practice separation between `<preflight>` (non-destructive readiness checks) and `<flow>` (transactional staging, bulk replication, post-load reconciliation, and reporting):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pipeline name="OrderWarehouseReplication"
          description="Validates source/target readiness in preflight and replicates orders in flow"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd">

    <variables>
        <variable name="BatchDate" type="string" value="2026-11-01" />
        <variable name="MinSourceOrders" type="int" value="1" />
        <variable name="SourceCount" type="int" value="0" />
        <variable name="TargetCount" type="int" value="0" />
        <variable name="ExportDir" type="string" value="./exports" />
    </variables>

    <databases>
        <database name="oltp_pg" driver="postgres"
                  connection_string="postgres://reader:{{PG_PASS}}@localhost:5432/commerce?sslmode=disable" />
        <database name="dw_mssql" driver="sqlserver"
                  connection_string="sqlserver://sa:{{MSSQL_PASS}}@localhost:1433?database=WarehouseDW&amp;trustServerCertificate=true" />
    </databases>

    <!-- =================================================================== -->
    <!-- PREFLIGHT: Non-destructive checks (Run with: flow -preflight)       -->
    <!-- =================================================================== -->
    <preflight>
        <!-- 1. Verify source and destination database connectivity -->
        <sql id="check_source_pg" db="oltp_pg">SELECT 1;</sql>
        <sql id="check_target_dw" db="dw_mssql">SELECT 1;</sql>

        <!-- 2. Verify source partition has rows ready for BatchDate -->
        <sql id="count_ready_orders" db="oltp_pg" output_var="SourceCount" format="text">
            SELECT COUNT(*) FROM orders WHERE order_date = {{BatchDate}};
        </sql>

        <assert id="assert_source_not_empty"
                condition="{{SourceCount}} >= {{MinSourceOrders}}"
                message="Preflight failed: No orders found in oltp_pg for {{BatchDate}}"
                on_failure="halt" />
    </preflight>

    <!-- =================================================================== -->
    <!-- MAIN FLOW: Production ETL Workload (Run by default)                 -->
    <!-- =================================================================== -->
    <flow>
        <!-- Step 1: Prepare target staging table inside a transaction -->
        <group id="prepare_staging" transaction="true" db="dw_mssql">
            <sql id="clear_staging_partition" db="dw_mssql">
                DELETE FROM dbo.Orders_Staging WHERE order_date = {{BatchDate}};
            </sql>
        </group>

        <!-- Step 2: Stream rows in O(1) memory from PostgreSQL to SQL Server -->
        <sql_bulk id="stream_orders_to_dw"
                  source_db="oltp_pg"
                  target_db="dw_mssql"
                  target_table="dbo.Orders_Staging"
                  batch_size="5000">
            SELECT order_id, customer_id, order_date, total_amount, status
            FROM orders
            WHERE order_date = {{BatchDate}};
        </sql_bulk>

        <!-- Step 3: Verify loaded row count in the warehouse -->
        <sql id="verify_target_count" db="dw_mssql" output_var="TargetCount" format="text">
            SELECT COUNT(*) FROM dbo.Orders_Staging WHERE order_date = {{BatchDate}};
        </sql>

        <assert id="reconcile_counts"
                condition="{{TargetCount}} > 0"
                message="Replication error: dbo.Orders_Staging has 0 rows for {{BatchDate}}"
                on_failure="halt" />

        <!-- Step 4: Export daily reconciliation workbook -->
        <excel_write id="export_daily_summary"
                     db="dw_mssql"
                     file="{{ExportDir}}/orders_{{BatchDate}}.xlsx"
                     sheet="DailyOrders">
            SELECT order_id, customer_id, total_amount, status
            FROM dbo.Orders_Staging
            WHERE order_date = {{BatchDate}}
            ORDER BY order_id;
        </excel_write>
    </flow>

</pipeline>
```

---

## 7. Programmatic Execution in Go (`flow` Package)

When embedding `github.com/etl-madness/flow` as a Go library, `ParseXMLConfig` populates `cfg.PreflightNodes` and `cfg.FlowNodes` separately on `*flow.PipelineConfig`:

```go
package main

import (
	"context"
	"log"
	"os"

	"github.com/etl-madness/flow"
)

func main() {
	xmlBytes, err := os.ReadFile("pipeline.xml")
	if err != nil {
		log.Fatal(err)
	}

	cfg, err := flow.ParseXMLConfig(xmlBytes)
	if err != nil {
		log.Fatal(err)
	}

	// Validate both <preflight> and <flow> AST slices against configured <databases>
	if err := flow.ValidateAST(cfg.PreflightNodes, cfg.FlowNodes, cfg.Databases); err != nil {
		log.Fatalf("AST validation error: %v", err)
	}

	registry := flow.NewRegistry()
	_ = registry.InitVariables(cfg.Variables)
	_ = registry.InitDatabases(cfg.Databases)
	defer registry.CloseDatabases()

	executor := flow.NewExecutor(registry)
	ctx := context.Background()

	// Optional Phase 1: Run <preflight> checks first
	if len(cfg.PreflightNodes) > 0 {
		if _, err := executor.Execute(ctx, cfg.PreflightNodes); err != nil {
			log.Fatalf("Preflight checks failed; aborting <flow>: %v", err)
		}
	}

	// Phase 2: Execute the main <flow> pipeline nodes
	results, err := executor.Execute(ctx, cfg.FlowNodes)
	if err != nil {
		log.Fatalf("Main <flow> execution failed: %v", err)
	}
	log.Printf("Completed %d top-level <flow> steps successfully.", len(results))
}
```

---

## 8. Related Documentation

- **[Databases Container (`<databases>`)](databases.md)**: How relational SQL pools and Key-Value handles are initialized before `<preflight>` and `<flow>` and torn down on exit.
- **[Preflight Validation Gates (`<preflight>`)](preflight.md)**: Deep dive into authoring pre-execution readiness checks and assertions.
- **[Sequential & Transactional Grouping (`<group>`)](group.md)**: Wrapping steps inside `<flow>` into conditional or transactional units.
- **[Configuration & Execution Hierarchy](guides/CONFIG_HIERARCHY.md)**: How `-file`, `-options`, `-config`, and `-vars` merge `<preflight>` and `<flow>` across environments.
- **[Summary of Available Pipeline XML Options](guides/SUMMARY_OF_AVAILABLE_OPTIONS.md)**: Schema reference for `<pipeline>`, `<variables>`, `<databases>`, `<preflight>`, and `<flow>`.
