# `<databases>` — Database Connection Container & Pipeline Lifecycle

The `<databases>` element is the top-level container in a Flow XML pipeline (`<pipeline>`) that declares all relational SQL connection pools and Key-Value (KV) store handles used by the pipeline. Every child [`<database>`](database.md) defined inside `<databases>` is registered by its unique `name` in Flow's thread-safe `Registry` and shared across `<preflight>` and `<flow>` steps.

---

## 1. Where `<databases>` Fits in the Overall `<pipeline>`

In the Flow XML Schema (`pipeline.xsd`), `<databases>` is the **second** top-level section inside `<pipeline>`, positioned strictly **after `<variables>`** and **before `<preflight>` and `<flow>`**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pipeline name="MultiStoreOrderPipeline"
          description="Demonstrates where <databases> fits in the 4-stage pipeline structure"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd">

    <!-- STAGE 1: <variables> — Initialized first so placeholders can be used in <databases> -->
    <variables description="Connection parameters and batch settings">
        <variable name="PG_HOST" type="string" value="localhost" />
        <variable name="PG_PORT" type="int" value="5432" />
        <variable name="CACHE_DIR" type="string" value="./data/cache" />
    </variables>

    <!-- STAGE 2: <databases> — Interpolates variables and registers named connection pools -->
    <databases description="Relational SQL pools, KV stores, and observability sink">
        <database name="source_pg"
                  driver="postgres"
                  connection_string="postgres://etl_user:{{PG_PASS}}@{{PG_HOST}}:{{PG_PORT}}/orders?sslmode=disable"
                  max_open_conns="30"
                  max_idle_conns="10"
                  workload="oltp" />

        <database name="warehouse_mssql"
                  driver="sqlserver"
                  connection_string="sqlserver://sa:{{MSSQL_PASS}}@localhost:1433?database=AnalyticsDW&amp;trustServerCertificate=true"
                  max_open_conns="50"
                  workload="bulk" />

        <database name="local_kv"
                  driver="bbolt"
                  connection_string="{{CACHE_DIR}}/state.db" />
    </databases>

    <!-- STAGE 3: <preflight> — Verifies database connectivity before running heavy workloads -->
    <preflight>
        <sql id="ping_source" db="source_pg">SELECT 1;</sql>
        <sql id="ping_warehouse" db="warehouse_mssql">SELECT 1;</sql>
    </preflight>

    <!-- STAGE 4: <flow> — Executes SQL, Bulk ETL, Transactions, and KV steps using registered names -->
    <flow>
        <sql_bulk id="replicate_orders"
                  source_db="source_pg"
                  target_db="warehouse_mssql"
                  target_table="dbo.Orders_Staging"
                  batch_size="5000">
            SELECT order_id, customer_id, order_total, created_at FROM orders;
        </sql_bulk>

        <kv id="save_watermark" db="local_kv" op="put" bucket="etl_state" key="last_sync">
            COMPLETED
        </kv>
    </flow>

</pipeline>
```

### Why `<databases>` Is Ordered Between `<variables>` and `<preflight>` / `<flow>`

```mermaid
flowchart TD
    subgraph Phase1["1. Parse &amp; Static Validation"]
        XML["ParseXMLConfig(pipeline.xml, config.xml)"] --> AST["ValidateAST(preflightNodes, flowNodes, dbConfigs)<br/>• Verifies every db / source_db / target_db handle exists in &lt;databases&gt;"]
    end

    subgraph Phase2["2. Registry Initialization"]
        VARS["registry.InitVariables(varConfigs) + applyVariableOverrides(-vars)<br/>• Populates all {{VarName}} values first"]
        DBS["registry.InitDatabasesWithContext(ctx, dbConfigs)<br/>• Expands {{VarName}} inside connection_string<br/>• Opens SQL pools (*sql.DB) &amp; KV clients (bbolt, badger, redis, etcd)<br/>• Rolls back all opened handles if any single connection fails"]
        LOGDB["Attach DatabaseSink (if name='log_db' is present)"]
        VARS --> DBS --> LOGDB
    end

    subgraph Phase3["3. Execution &amp; Teardown"]
        EXEC["Execute &lt;preflight&gt; OR &lt;flow&gt; Nodes<br/>• Nodes look up handles by name in O(1) via Registry<br/>• &lt;parallel&gt; workers share connection pools safely"]
        CLOSE["defer registry.CloseDatabases()<br/>• Closes all SQL pools &amp; flushes embedded KV stores on exit or Ctrl+C"]
        EXEC --> CLOSE
    end

    Phase1 --> Phase2 --> Phase3
```

1. **Variables Are Resolved First**: Because `<variables>`, `-config` variable overrides, and CLI `-vars` are initialized before `<databases>`, every `<database connection_string="...">` can safely interpolate dynamic hostnames, ports, database names, file paths, and injected secrets (`{{DB_PASSWORD}}`).
2. **Compile-Time Handle Integrity (`ValidateAST`)**: Before executing any node, Flow's semantic AST validator checks every `db`, `database`, `source_db`, and `target_db` attribute in both `<preflight>` and `<flow>` against the `<databases>` declarations. Typos in database names fail immediately during validation (`-validate`) before the pipeline starts.
3. **Centralized Pool Lifecycle**: Connection strings and pool limits (`max_open_conns`, `max_idle_conns`, `conn_max_lifetime_seconds`) are defined once inside `<databases>` rather than duplicated across individual `<sql>` or `<kv>` steps.

---

## 2. `<databases>` Schema & Attribute Reference

### `<databases>` Container Attributes

| Attribute / Child | Mandatory | Description |
| :--- | :---: | :--- |
| `description` | No | Optional human-readable summary of the database collection (rendered in Visual Builder tooltips and generated documentation). |
| [`<database>`](database.md) | No (`0..*`) | Zero or more individual relational SQL or Key-Value connection definitions. |

> [!NOTE]
> `<databases>` may appear at most once (`minOccurs="0"`, `maxOccurs="1"`) inside a `<pipeline>` document. If a pipeline only performs local file, HTTP, template, or script operations without database access, `<databases>` can be omitted entirely.

### Summary of `<database>` Child Attributes

For comprehensive pool-tuning guidelines and driver specifics, see **[`<database>` — Database Operations in Flow Pipelines](database.md)** and **[Connection Strings & Driver Reference](database_connection_strings.md)**.

| Attribute | Mandatory | Default | Description |
| :--- | :---: | :---: | :--- |
| `name` | **Yes** | — | Unique logical handle referenced by pipeline steps (`db="name"`, `source_db="name"`, `target_db="name"`). |
| `driver` *(or `type`)* | No | `sqlserver` | Storage engine driver: relational SQL (`sqlserver`/`mssql`, `postgres`/`postgresql`, `mysql`, `sqlite`/`sqlite3`, `oracle`) or Key-Value (`bbolt`/`bolt`, `badger`/`badgerdb`, `redis`/`valkey`, `etcd`/`etcdv3`). |
| `connection_string` | **Yes** | — | Driver DSN, URI, or local file/directory path. Supports `{{VarName}}` interpolation (including nested variables up to 3 levels deep). |
| `max_open_conns` | No | `25` | Maximum concurrent open connections in the `*sql.DB` pool. |
| `max_idle_conns` | No | `10` | Maximum idle connections retained in the `*sql.DB` pool (clamped to `max_open_conns`). |
| `conn_max_lifetime_seconds` | No | `300` (`5m`) | Maximum lifetime of a pooled SQL connection before recycling (accepts integer seconds or duration strings like `5m`). |
| `workload` | No | `""` | Operational profile hint (`oltp`, `bulk`, `analytics`, `batch`). |
| `id` | No | `""` | Optional element identifier. |
| `description` | No | `""` | Human-readable description of the database target. |

---

## 3. How Pipeline Components Consume `<databases>`

Once initialized inside the `Registry`, named handles from `<databases>` are consumed across the pipeline by the following elements and runtime bridges:

| Pipeline Component | Attribute / API | Supported Engine Types | How It Uses the Registered Handle |
| :--- | :--- | :--- | :--- |
| **[`<sql>`](sql.md)** | `db="name"` *(or `database="name"`)* | Relational SQL | Executes DDL, DML, or `SELECT` statements using the named `*sql.DB` pool (or active transaction if nested inside `<group transaction="true">`). |
| **[`<sql_bulk>`](sql_bulk.md)** | `source_db="src"` (`db="src"`), `target_db="dst"` | Relational SQL | Streams rows in $O(1)$ memory from `source_db` into `target_db` (using native TDS `CopyIn` for SQL Server or batched multi-row inserts). |
| **[`<foreach>` / `<loop>`](foreach.md)** | `db="name"` *(or `database="name"`)* | Relational SQL | Executes the driver `SELECT` query against `db` and iterates over the result cursor in streaming or buffered mode. |
| **[`<group transaction="true">`](group.md)** | `db="name"` | Relational SQL | Begins an atomic SQL transaction (`*sql.Tx`) or nested savepoint on `db` for all child SQL steps inside the group. |
| **[`<excel_write>`](excel_write.md)** | `db="name"` | Relational SQL | Streams query results from `db` directly into a formatted `.xlsx` worksheet. |
| **[`<kv>`](kv.md)** | `db="name"` | Key-Value (`bbolt`, `badger`, `redis`, `etcd`) | Performs atomic `get`, `put`, `delete`, `exists`, or `scan` operations against the named KV store handle. |
| **[`<kv_bulk>`](kv.md)** | `source_db="sql_db"`, `target_db="kv_db"` | Relational SQL → Key-Value | Streams rows from a relational `source_db` query directly into a target Key-Value store (`target_db`) in batches. |
| **[`<script language="go">`](golang.md)** | `db.Get("name")`, `db.StreamETL(...)` | Relational SQL (`"host/db"`) | Provides direct `*sql.DB` pool access and programmatic bulk streaming inside embedded Yaegi Go scripts. |
| **Observability Sink** | `<database name="log_db" ... />` | Relational SQL | Reserved handle name: when `name="log_db"` is present in `<databases>`, Flow automatically logs run summaries (`pipeline_runs`) and step events (`pipeline_events`) to that database. |

---

## 4. Runtime Behavior: Concurrency, Transactions & Failure Rollback

### 4.1 All-or-Nothing Initialization Rollback
When `registry.InitDatabasesWithContext` processes the `<databases>` block:
- Embedded file/directory stores (`bbolt` and `badger`) automatically create parent directories (`os.MkdirAll`) and open local file locks immediately.
- Network KV stores (`redis`/`valkey` and `etcd`) establish clients and verify connectivity (e.g., a 3-second `PING` check on Redis).
- Relational SQL engines initialize `*sql.DB` pools and apply `max_open_conns`, `max_idle_conns`, and `conn_max_lifetime_seconds`.
- **Atomic Cleanup on Partial Error**: If the third `<database>` in `<databases>` fails to initialize, Flow automatically closes and removes the first two handles before aborting, preventing leaked file locks or dangling sockets.

### 4.2 Behavior Inside `<parallel>` Worker Pools
When a `<flow>` enters a [`<parallel>`](parallel.md) block:
- Each worker goroutine receives an **isolated clone of pipeline variables** (`CloneForWorker`), preventing variable race conditions.
- All workers **share the underlying `<databases>` connection pools**. Because Go's `*sql.DB` and the registered KV clients (`bbolt`, `BadgerDB`, `go-redis`, `etcd/clientv3`) are thread-safe, concurrent workers borrow connections from the shared pool up to the configured `max_open_conns` limit.

### 4.3 Reserved `log_db` Handle for Pipeline Telemetry
If `<databases>` includes a `<database>` with `name="log_db"`, Flow automatically wires a `DatabaseSink` into the execution engine:

```xml
<databases>
    <!-- Primary application database -->
    <database name="app_db" driver="postgres" connection_string="{{APP_DSN}}" />

    <!-- Reserved telemetry handle: automatically records pipeline_runs & pipeline_events -->
    <database name="log_db" driver="sqlserver" connection_string="{{TELEMETRY_DSN}}" />
</databases>
```

> [!TIP]
> See the [Database Logging Configuration Guide](guides/DATABASE_LOGGING_CONFIGURATION.md) for the `pipeline_runs` and `pipeline_events` DDL schemas and `-node-output` diagnostics.

---

## 5. Multi-Environment Override Pattern (`-config`)

In enterprise deployments, you rarely hardcode environment-specific endpoints inside the main `pipeline.xml`. Instead, you can either:
1. Reference `{{VariableName}}` placeholders inside `<databases>` in `pipeline.xml` and supply values via `-config` or `-vars`, **or**
2. Define logical `<database name="...">` handles directly inside an environment-specific `-config` file (`config.dev.xml`, `config.prod.xml`).

When `-config` is passed on the CLI (`flow -file pipeline.xml -config config.prod.xml`), Flow merges the `<databases>` blocks so that any `<database name="...">` in `-config` overrides or extends the base definitions while keeping `<preflight>` and `<flow>` 100% environment-agnostic:

=== "pipeline.xml (Environment-Agnostic Logic)"

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <pipeline name="CustomerMetricsETL"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
              xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd">

        <!-- Default local development database (can be overridden by -config) -->
        <databases>
            <database name="crm_db" driver="sqlite" connection_string="./dev_crm.sqlite" />
        </databases>

        <preflight>
            <sql id="verify_crm" db="crm_db">SELECT 1;</sql>
        </preflight>

        <flow>
            <sql id="aggregate_active_customers" db="crm_db" output_var="ActiveCustomerCount">
                SELECT COUNT(*) FROM customers WHERE active = 1;
            </sql>
        </flow>
    </pipeline>
    ```

=== "config.prod.xml (Production Database Override)"

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <pipeline xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
              xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd">

        <!-- Overrides 'crm_db' with Production SQL Server and adds 'log_db' telemetry -->
        <databases>
            <database name="crm_db"
                      driver="sqlserver"
                      connection_string="sqlserver:// prod-sql.internal:1433?database=CRM_Prod&amp;fedauth=ActiveDirectoryDefault"
                      max_open_conns="50"
                      workload="analytics" />

            <database name="log_db"
                      driver="sqlserver"
                      connection_string="sqlserver://prod-sql.internal:1433?database=FlowAudit&amp;fedauth=ActiveDirectoryDefault" />
        </databases>
    </pipeline>
    ```

---

## 6. Related Documentation

- **[`<database>` — Database Connections & Pool Tuning](database.md)**: Detailed guide to `<database>` attributes, workload profiles (`oltp`, `bulk`, `analytics`, `batch`), and SQL/KV operations.
- **[Connection Strings & Driver Reference (`database_connection_strings.md`)](database_connection_strings.md)**: Copy-paste DSN templates, URL/XML escaping rules for passwords, and TLS/Entra ID options for all 9 drivers.
- **[`<variables>` & `<variable>` Guide](variable.md)**: How pipeline variables are initialized prior to `<databases>` DSN interpolation.
- **[`<preflight>` Validation Gates](preflight.md)** & **[`<flow>` Main Execution Container](flow.md)**: How registered database handles are validated in `<preflight>` and consumed in `<flow>`.
- **[Database Transactions & Savepoints](guides/DATABASE_TRANSACTIONS.md)**: Using `<group transaction="true" db="...">` with registered `<databases>` handles.
