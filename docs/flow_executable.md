---
title: Flow (flow) Documentation Hub
description: Single-Binary, Zero-Dependency ETL & Workflow Orchestration Engine in Go with an Embedded HTMX Visual Studio
---

# Flow (`flow`) Documentation Hub

> **Slashing ETL Madness with Go, HTMX, and Declarative Pipelines**  
> **Current Version:** `1.1.24` | **Runtime:** Single-Binary Go (`flow.exe` / `flow`) | **Visual Studio:** `flow -builder`

**Flow** (`flow`) is an enterprise-grade, single-binary ETL and workflow orchestration engine written in Go. It combines declarative, Git-friendly XML pipeline definitions with an embedded HTMX visual web builder (`-builder`), multi-engine relational and Key-Value database connectors, $O(1)$-memory bulk streaming replication, in-process Go (via Yaegi) and Lua (via Gopher-Lua) scripting, cross-platform AES-256-GCM encryption, and multi-standard digital signatures.

**Flow Ecosystem**  (FLOW_ECOSYSTEM.md) | Is an overview of how flow core package, CLI, web builder, and API ecosystem components interact with each other.

---
 
## 1. Executive Overview & Why Flow?

Traditional enterprise data orchestration forces teams to choose between heavyweight distributed clusters (Apache Airflow, Dagster, Prefect) that require dedicated Kubernetes/Celery infrastructure, or legacy proprietary GUI monoliths (SSIS, Informatica) that produce opaque, un-diffable binary files.

**Flow** eliminates both extremes by compiling the entire orchestration runtime, database drivers, scripting interpreter, cryptographic verifier, and visual web studio into a **single zero-dependency binary**.

| Capability | Traditional Python / Cluster (Airflow, Prefect) | Legacy Enterprise GUI (SSIS, Informatica) | **Flow (`flow`)** |
| :--- | :--- | :--- | :--- |
| **Deployment Footprint** | Multi-container cluster, Redis/Celery, Python venvs | Heavy Windows server licenses & proprietary agents | **Single static binary (~30 MB), zero runtime dependencies** |
| **Authoring Experience** | Imperative Python code only | Desktop-only drag-and-drop | **Bidirectional: Embedded Web UI (`-builder`) + Git-friendly XML** |
| **High-Volume Bulk ETL** | Memory-heavy DataFrames (`pandas`) | Fast, but locked to specific vendor ecosystems | **$O(1)$ constant-memory streaming (`<sql_bulk>`, `<kv_bulk>`)** |
| **In-Process Scripting** | Native Python (dependency conflicts common) | C# / VB (requires compilation/GAC) | **Embedded Go (Yaegi) & Lua (Gopher-Lua) + PowerShell, Bash, Cmd, Zsh, CSX** |
| **Cryptographic Security** | External vaults / custom plugins | OS-bound DPAPI encryption | **Cross-platform AES-256-GCM + OpenSSL/PKCS#7/OpenPGP signatures** |
| **Audit & Observability** | Requires external Postgres + log forwarders | Proprietary logging tables | **Plug-and-play `log_db` sink, JSONL, & real-time stream events** |

---

## 2. Architecture & Execution Lifecycle

Every pipeline run follows a deterministic, security-first execution pipeline: **Verify → Decrypt → Resolve Configuration Hierarchy → Validate Schema/AST → Execute Preflight → Execute Flow → Emit Audit Telemetry**.

```mermaid
flowchart TD
    subgraph Sources["1. Uniform Resource Loader"]
        S1["Local Filesystem<br/>(scripts.xml / UTF-8 / UTF-16)"]
        S2["HTTP / HTTPS Endpoints<br/>(https://...)"]
        S3["Database Repositories<br/>(sql:// or db:// DSN Query)"]
    end

    subgraph Security["2. Decoupled Cryptographic Gate"]
        V["Digital Signature Verification<br/>(OpenSSL X.509 / PKCS#7 .p7s / OpenPGP .asc / FLOWSIGNED:v1)"]
        D["AES-256-GCM Decryption<br/>(PBKDF2-HMAC-SHA256 /<br/> FLOWENC:v1)"]
    end

    subgraph Config["3. Configuration & Validation"]
        H["Hierarchy Merge<br/>Base (--file) <br/>&lt; Options (--options) <br/>&lt; Config (--config) <br/>&lt; CLI (--vars)"]
        X["XSD &amp; Semantic AST Validation<br/>(--validate / pipeline.xsd)"]
    end

    subgraph Runtime["4. Execution Engine"]
        PRE["Preflight Quality Gates<br/>(&lt;preflight&gt; / --preflight)"]
        FLOW["Main Workflow Execution<br/>(&lt;flow&gt;"]
    end

    subgraph Telemetry["5. Observability &amp; Output"]
        OUT["Console Renderer<br/>(csv, text, json, jsonpretty,<br/> markdown, stream)"]
        LOG["Database Audit Sink (log_db)<br/>(pipeline_runs &amp;<br/> pipeline_events)"]
        DOC["Auto-Documentation<br/>(Mermaid.js Flowchart +<br/> XSLT 3.0)"]
    end

    S1 & S2 & S3 --> V
    V --> D
    D --> H
    H --> X
    X --> PRE
    PRE --> FLOW
    FLOW --> OUT & LOG & DOC
```

---

## 3. Complete Documentation Directory

All documentation in the `docs/` repository is organized below by topic.

### 3.1 Executive Summaries & Visual Tour

| Document | Description |
| :--- | :--- |
| [**Business & Executive Summary**](BUSINESS_SUMMARY.md) | Architectural value proposition, TCO reduction, security posture, and enterprise comparison matrix. |
| [**Automation & ETL Architecture Summary**](guides/AUTOMATION_ETL_SUMMARY.md) | Condensed technical overview of CLI flags, AST primitives, SQL dialect parameter binding, and telemetry schemas. |
| [**Visual Builder Slideshow (Markdown)**](BUILDER_SLIDESHOW.md) | Step-by-step visual walkthrough of the 3-panel HTMX studio, modals, themes, and runner dashboard. |
| [**Interactive Builder Slideshow (HTML)**](builder_slideshow.html) | Standalone interactive browser presentation showcasing the Flow Builder UI. |

---

### 3.2 CLI, Configuration Hierarchy & Remote Sources

| Document | Description |
| :--- | :--- |
| [**Complete CLI Reference (`flow`, `crypto_tool`, `db_importer`)**](guides/COMPLETE_CLI_OPTIONS_AND_ARGUMENTS.md) | Exhaustive flag reference, secret precedence rules, exit codes, and enterprise recipes across all three binaries. |
| [**`db_importer` (`db_import`) CLI Reference**](db_import.md) | Dedicated reference for importing and exporting `PipelineXML`, `OptionsXML`, and `ConfigXML` into SQL Server with UTF-8/UTF-16 transcoding and at-rest encryption. |
| [**`crypto_tool` CLI Reference**](crypto_tool.md) | Dedicated reference for offline key generation (`-gen-key`, `gen-keypair`), AES-256-GCM encryption/decryption, and OpenSSL/PKCS#7/OpenPGP signing & verification. |
| [**Summary of Available Pipeline XML Options**](guides/SUMMARY_OF_AVAILABLE_OPTIONS.md) | Complete XML element and attribute specification for `<pipeline>`, `<databases>`, `<variables>`, `<preflight>`, and `<flow>`. |
| [**Configuration & Execution Hierarchy**](guides/CONFIG_HIERARCHY.md) | How Flow merges `--file`, `--options`, `--config`, and `--vars` across Dev, Staging, and Production environments. |
| [**Variables Container (`<variables>`)**](variables.md) | Declaring typed variable collections (`string`, `int`, `float`, `bool`, `date`, `datetime`) and recursive `{{var}}` expansion. |
| [**Variable Element (`<variable>`)**](variable.md) | Detailed reference for individual `<variable>` definitions, type parsing, and runtime overrides. |
| [**Remote File, HTTP & SQL DSN Sources**](guides/FLOW_WITH_REMOTE_FILE_SOURCE.md) | Loading pipelines, options, and configs from local paths, HTTP/HTTPS (with Basic Auth), and `sql://` or `db://` queries. |
| [**Database-Backed XML Storage**](guides/README_DATABASE_XML.md) | Storing and executing `PipelineXML`, `OptionsXML`, and `ConfigXML` inside SQL Server (`dbo.flow_*_content`) via `db_importer`. |
| [**UTF-8 & UTF-16 Encoding Guide**](guides/README_UTF.md) | Automatic BOM detection and transcoding for Windows PowerShell UTF-16LE files and SQL Server `NVARCHAR(MAX)` columns. |
| [**Using Pipeline & Node Descriptions**](guides/USING_DESCRIPTIONS.md) | Best practices for self-documenting pipelines using `description` attributes rendered in logs and Mermaid flowcharts. |

---

### 3.3 Security: Encryption & Digital Signatures

| Document | Description |
| :--- | :--- |
| [**Security Order of Operations & Options**](guides/SECURITY_ORDER_AND_OPTIONS.md) | Deep dive into **Encrypt-then-Sign** vs. **Sign-then-Encrypt** vs. **Detached Signatures**, key precedence, and security flags. |
| [**Single-File Cryptography (Combined Encryption & Signatures)**](guides/COMBINED_ENCRYPTION_AND_SIGNATURES.md) | End-to-end Windows (PowerShell/Cert Store) and Linux/macOS (OpenSSL/Bash) walkthroughs for unified `.sec` packages (`-wrap`). |
| [**Cross-Platform Encryption Guide (`FLOWENC:v1:`)**](guides/ENCRYPTION.md) | AES-256-GCM architecture, PBKDF2-HMAC-SHA256 key derivation, memory zeroization, and at-rest database encryption. |
| [**Cross-Platform Digital Signatures Guide (`FLOWSIG:v1:`)**](guides/SIGNATURES.md) | Pure-Go verification and signing with OpenSSL (RSA/ECDSA/Ed25519), PKCS#7/CMS (`.p7s`), and OpenPGP/GPG (`.asc`). |

---

### 3.4 Databases, Bulk ETL, Key-Value & Transactions

| Document | Description |
| :--- | :--- |
| [**Databases Container & Lifecycle (`<databases>`)**](databases.md) | Top-level container for relational SQL pools and KV handles, initialization ordering after `<variables>`, `log_db` telemetry, and `-config` overrides. |
| [**Database Connections & Pooling (`<database>`)**](database.md) | Configuring relational and KV drivers, connection pool tuning (`max_open_conns`, `max_idle_conns`, `workload`), and dialect rules. |
| [**Database Connection Strings Reference**](database_connection_strings.md) | Copy-paste connection string templates for SQL Server (including Azure Entra ID `fedauth`), PostgreSQL, MySQL, Oracle, SQLite, and KV stores. |
| [**SQL Execution (`<sql>`)**](sql.md) | Executing DDL, DML, and `SELECT` queries with intelligent statement classification (`isDMLQuery`), parameter binding, and `output_var`. |
| [**High-Speed Bulk ETL (`<sql_bulk>`)**](sql_bulk.md) | $O(1)$ constant-memory cross-database streaming replication, native SQL Server TDS `CopyIn` (`tablock`), and batch tuning. |
| [**Comparing `<sql>` and `<sql_bulk>`**](sql_and_sql_bulk.md) | Architectural comparison and decision guide for choosing between standard `<sql>` execution and `<sql_bulk>` streaming. |
| [**Database Transactions & Savepoints**](guides/DATABASE_TRANSACTIONS.md) | Atomic `<group transaction="true">` blocks, dialect-aware nested savepoints, parallel transaction isolation, and bulk copy caveats. |
| [**Key-Value Store Operations (`<kv>` & `<kv_bulk>`)**](kv.md) | Unified NoSQL interface for **bbolt**, **BadgerDB**, **Redis/Valkey**, and **etcd**, plus SQL-to-KV bulk streaming (`<kv_bulk>`). |
| [**DB Select, Template & Stdio Pattern**](db_select_template_stdio.md) | End-to-end guide for querying relational data, formatting rows via `<template>`, and streaming to standard output. |

---

### 3.5 Control Flow, Loops, Concurrency & Quality Gates

| Document | Description |
| :--- | :--- |
| [**Preflight Validation Gates (`<preflight>`)**](preflight.md) | Pre-execution environment checks, connectivity verification, and schema readiness assertions before `<flow>` begins. |
| [**Main Execution Container (`<flow>`)**](flow.md) | Primary container for sequential, conditional, iterative, transactional, and concurrent ETL steps, and how it differs from `<preflight>`. |
| [**Sequential & Transactional Grouping (`<group>`)**](group.md) | Organizing steps into logical units with optional conditional execution (`if_var`/`if_equals`) and atomic transactions. |
| [**Conditional Branching (`<if>`, `<then>`, `<else>`)**](if_then_else.md) | Dynamic branching using variable equality (`var`/`equals`) or expression evaluation (`condition`). |
| [**Dataset Iteration (`<foreach>` / `<loop>`)**](foreach.md) | Row-by-row SQL cursor iteration in $O(1)$ streaming mode (`stream="true"`) or in-memory buffered mode with automatic column binding. |
| [**Conditional Loops (`<while>`)**](while.md) | State-driven polling and pagination loops with `WHILE_INDEX` tracking and `max_iterations` safety guards. |
| [**Concurrent Worker Pools (`<parallel>`)**](parallel.md) | Multi-threaded execution (`max_threads`) with isolated variable cloning, cooperative cancellation, and collision namespacing. |
| [**Declarative Assertions (`<assert>`)**](assert.md) | Data quality gates with `halt` vs. `warn` policies, failure flag variables (`fail_var`), and nested `<on_failure>` recovery blocks. |

---

### 3.6 Scripting, Templates, HTTP & Data Formats

| Document | Description |
| :--- | :--- |
| [**Polyglot Scripting (`<script>`)**](script.md) | In-process pure-Go **Yaegi** (`host/vars`, `host/db`) and **Gopher-Lua** (`vars`) interpreters plus external shells (`pwsh`, `powershell`, `bash`, `sh`, `cmd`, `zsh`, `csx`). |
| [**Embedded Go Scripting (`<script language="go">`)**](golang.md) | Zero-dependency Go interpreter (`Yaegi`), `"host/vars"` & `"host/db"` bridges (`*sql.DB` pool access & `StreamETL`), and Go standard library usage. |
| [**Embedded Lua Scripting (`<script language="lua">`)**](lua.md) | Zero-dependency Lua 5.1 VM (`Gopher-Lua`), global `vars` registry bridge, bidirectional Go↔Lua table marshaling, and `.lua` file execution. |
| [**C# Scripting (`<script language="csx">`)**](csx.md) | Cross-platform Roslyn C# scripting (`dotnet-script`), inline `#r "nuget: ..."` package references, LINQ/JSON transformations, and `async`/`await`. |
| [**PowerShell Scripting (`<script language="pwsh" \| "powershell">`)**](powershell.md) | Cross-platform PowerShell 7+ (`pwsh`) & Windows PowerShell 5.1 (`powershell`), `$env:VarName` process bridge, and `ConvertTo-Json` examples. |
| [**Bash & POSIX Shell Scripting (`<script language="bash" \| "git-bash" \| "sh">`)**](bash.md) | Linux/macOS/FreeBSD Bash, Git Bash on Windows (`git-bash`), POSIX `sh`, `"${VarName}"` process bridge, and CLI stream pipelines. |
| [**Text Templates (`<template>`)**](template.md) | Dynamic SQL, JSON, and report generation using Go's `text/template` engine and helper functions. |
| [**HTML Templates (`<template_html>`)**](template_html.md) | Context-aware XSS-safe HTML email and dashboard rendering using Go's `html/template` engine. |
| [**Comparing `<template>` and `<template_html>`**](template_and_template_html.md) | Side-by-side comparison of raw text interpolation vs. automatic HTML contextual escaping. |
| [**HTTP / REST Client (`<http_client>`)**](http_client.md) | Full-featured REST integration with custom headers, TLS/mTLS tuning, proxies, cookie jars, redirects, and status capture. |
| [**JSONPath Extraction (`<json_path>`)**](json_path.md) | Extracting scalars, objects, and arrays from API responses or files using JSONPath expressions. |
| [**JSONPath Syntax & Examples Guide**](json_path_guide.md) | Comprehensive tutorial on JSONPath operators, recursive descent, array slicing, and filter expressions in Flow. |
| [**XPath Extraction (`<xml_xpath>`)**](xml_path.md) | Querying XML documents and SOAP payloads with XPath expressions in `text`, `xml`, or `json_array` output modes. |
| [**YAML Path Extraction (`<yaml_path>`)**](yaml_path.md) | Extracting configuration values and structured nodes from YAML files or variables. |
| [**Excel Workbook Reader (`<excel_read>`)**](excel_read.md) | Reading `.xlsx` worksheets into structured JSON arrays for downstream iteration and transformation. |
| [**Excel Workbook Writer (`<excel_write>`)**](excel_write.md) | Exporting SQL query results directly into multi-tab `.xlsx` spreadsheets with automatic header generation. |
| [**File Reader (`<file_read>`)**](file_read.md) | Loading local text, JSON, XML, or SQL files into pipeline variables. |
| [**File Writer (`<file_save>`)**](file_save.md) | Writing or appending pipeline variables and inline templates to disk with automatic directory creation. |

---

### 3.7 Observability, Telemetry, Failure Handling & Debugging

| Document | Description |
| :--- | :--- |
| [**Database Logging Configuration (`log_db`)**](guides/DATABASE_LOGGING_CONFIGURATION.md) | DDL schemas for PostgreSQL, SQL Server, MySQL, Oracle, and SQLite (`pipeline_runs` & `pipeline_events`), session auditing (`spid`, `db_user_name`), and `-node-output`. |
| [**Failure Response & Error Propagation**](guides/FAILURE_RESPONSE.md) | Fail-fast semantics, cooperative `<parallel>` cancellation, cursor cleanup, transaction rollbacks, and `<assert>` recovery paths. |
| [**Comprehensive Pipeline Debugging Guide**](guides/DEBUGGING_GUIDE.md) | 5 production debugging patterns (variable dumps, interactive operator prompts, loop tracing, `<while>` state mutation, and `<assert>` post-mortems) in Go and C# CSX. |
| [**Observability & Event Sinks Usage Guide**](guides/development_observability_usage.md) | Programmatic guide to `ExecuteRun`, `JSONLineSink`, multi-sink fanout (`SetEventSinks`), row count metrics, and custom OpenTelemetry bridges. |

---

### 3.8 Developer & Extension Guides

| Document | Description |
| :--- | :--- |
| [**Executing Flow Pipelines (`Execute` vs `ExecuteRun`)**](guides/development_execution_guide.md) | Go SDK guide comparing flat `[]ScriptResult` execution with structured `RunResult` observability trees. |
| [**Builder Modal Tooltips & Documentation Popups**](guides/development_builder_modal_tooltips_guide.md) | Step-by-step developer guide for adding interactive markdown documentation modals and `⚡ Use Example` autofill buttons to the Builder UI. |
| [**Builder Theme Customization Guide**](guides/development_themes_guide.md) | Architecture of the 15 built-in UI themes (`slate`, `vscode-dark-plus`, `visual-studio-light`, `soft-white`, etc.) and how to add new themes. |

---

## 4. Visual Pipeline Builder Studio (`-builder`)

Launching `flow -builder` starts an embedded HTMX web studio backed by a local SQLite project store (`flow_builder.db`).

```bash
# Launch the visual builder on an ephemeral port (or specify -builder-port 8080)
./flow -builder -builder-port 8080
```

### Unified 3-Panel Studio (Default Slate Theme)
The interface provides a **Component Palette** (left), **Interactive 4-Phase Canvas** (center: *Variables*, *Databases*, *Preflight*, *Main Flow*), and **Live Bidirectional XML Preview** (right):

![Flow Builder Default Slate Theme](screenshots/Builder_Default_Theme.png)

### Live Pipeline Runner & Real-Time Telemetry
Switch to the **Runner** tab to execute preflight checks or full pipelines with live streaming event logs, execution duration tracking, and optional database output capture (`-node-output`):

![Flow Builder Live Runner](screenshots/Builder_VS_Dark_Execute_Options_File_Runner.png)

### Built-In IDE Themes (15 Themes Included)
Customize the workspace appearance with 15 built-in themes persisted in `localStorage`, including **Visual Studio Light**, **Visual Studio Dark**, **VS Code Dark+**, **Nord Frost**, and **Soft White**:

| Visual Studio Light Theme | Visual Studio Dark Theme |
| :---: | :---: |
| ![Visual Studio Light Theme](screenshots/Builder_VS_Light_Theme.png) | ![Visual Studio Dark Theme](screenshots/Builder_VS_Dark_Theme.png) |

>Explore the full visual tour in the [**Builder Slideshow Guide**](BUILDER_SLIDESHOW.md) or open the [**Interactive HTML Slideshow**](builder_slideshow.html).

---

## 5. Quick Start & Sample Pipeline

### 1. Build or Run Flow
```bash
# Build the core engine
go build -o flow.exe .

# Build the companion cryptographic utility (optional)
go build -o crypto_tool.exe ./crypto_tool
```

### 2. Author a Declarative Pipeline (`pipeline.xml`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<pipeline description="Customer Analytics Sync &amp; Executive Report"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/go-flow/main/xsd/pipeline.xsd">

    <variables>
        <variable name="MinSpend" type="float" value="5000.00" description="Minimum customer spend filter" />
        <variable name="ReportPath" type="string" value="./reports/vip_customers.xlsx" />
    </variables>

    <databases>
        <database name="source_pg" driver="postgres"
                  connection_string="postgres://app:{{PG_PASS}}@localhost:5432/commerce?sslmode=disable" />
        <database name="warehouse_mssql" driver="sqlserver"
                  connection_string="sqlserver://sa:{{MSSQL_PASS}}@localhost:1433?database=AnalyticsDW&amp;trustServerCertificate=true" />
        <database name="log_db" driver="sqlite"
                  connection_string="file:./telemetry_audit.db?_pragma=journal_mode(WAL)" />
    </databases>

    <preflight>
        <sql id="ping_source" db="source_pg" output_var="SourceReady">SELECT 'OK';</sql>
        <assert id="verify_source" var="SourceReady" equals="OK" message="Source PostgreSQL database is unreachable!" />
    </preflight>

    <flow>
        <!-- O(1) Memory Bulk Streaming Replication from PostgreSQL to SQL Server -->
        <sql_bulk id="stream_vip_orders"
                  db="source_pg"
                  target_db="warehouse_mssql"
                  target_table="dbo.StagingVIPOrders"
                  batch_size="10000"
                  tablock="true"
                  output_var="RowsCopied">
            SELECT order_id, customer_id, order_date, total_amount
            FROM orders
            WHERE total_amount >= {{MinSpend}};
        </sql_bulk>

        <!-- Atomic Transaction Group in Warehouse -->
        <group id="merge_warehouse_txn" transaction="true" db="warehouse_mssql">
            <sql id="upsert_vip_summary" db="warehouse_mssql">
                MERGE INTO dbo.FactVIPOrders AS target
                USING dbo.StagingVIPOrders AS src ON target.order_id = src.order_id
                WHEN MATCHED THEN UPDATE SET total_amount = src.total_amount
                WHEN NOT MATCHED THEN INSERT (order_id, customer_id, order_date, total_amount)
                VALUES (src.order_id, src.customer_id, src.order_date, src.total_amount);
            </sql>
            <sql id="truncate_staging" db="warehouse_mssql">
                TRUNCATE TABLE dbo.StagingVIPOrders;
            </sql>
        </group>

        <!-- Export Summary directly to Excel Workbook -->
        <excel_write id="export_vip_excel" file="{{ReportPath}}" sheet="VIP Orders" db="warehouse_mssql">
            SELECT customer_id, COUNT(order_id) AS order_count, SUM(total_amount) AS total_spent
            FROM dbo.FactVIPOrders
            GROUP BY customer_id
            ORDER BY total_spent DESC;
        </excel_write>
    </flow>
</pipeline>
```

### 3. Validate, Preflight, and Execute
```bash
# 1. Validate XML Schema and Semantic AST without executing
./flow -file pipeline.xml -xsd ./xsd/pipeline.xsd -validate

# 2. Run Preflight Checks only
./flow -file pipeline.xml -preflight

# 3. Execute Pipeline with Runtime Variable Overrides and Live Stream Output
./flow -file pipeline.xml -vars "MinSpend=10000.00" -format stream
```

---

## 6. Complete AST Component Matrix

| Category | XML Element | Primary Purpose | Detailed Guide |
| :--- | :--- | :--- | :--- |
| **Setup & Config** | `<variables>` / `<variable>` | Typed variable definitions (`string`, `int`, `float`, `bool`, `date`, `datetime`) | [variables.md](variables.md) / [variable.md](variable.md) |
| **Setup & Config** | `<databases>` / `<database>` | Relational & Key-Value connection pools with dynamic `{{var}}` DSNs | [databases.md](databases.md) / [database.md](database.md) |
| **Quality Gate** | `<preflight>` | Pre-execution validation and environment readiness checks | [preflight.md](preflight.md) |
| **Control Flow** | `<flow>` | Main execution container for sequential, conditional, iterative, and concurrent pipeline steps | [flow.md](flow.md) |
| **Control Flow** | `<group>` | Sequential container with optional conditional check and atomic `transaction="true"` | [group.md](group.md) |
| **Control Flow** | `<if>` / `<then>` / `<else>` | Dynamic conditional branching on variables or expressions | [if_then_else.md](if_then_else.md) |
| **Control Flow** | `<foreach>` / `<loop>` | SQL dataset cursor iteration ($O(1)$ streaming or buffered) | [foreach.md](foreach.md) |
| **Control Flow** | `<while>` | Conditional polling / pagination loop with `max_iterations` guard | [while.md](while.md) |
| **Control Flow** | `<parallel>` | Concurrent worker pool (`max_threads`) with thread-isolated variables | [parallel.md](parallel.md) |
| **Quality Gate** | `<assert>` | State invariant check (`halt` or `warn`) with `<on_failure>` fallback block | [assert.md](assert.md) |
| **Database & KV** | `<sql>` | Single or multi-statement SQL query/DML execution | [sql.md](sql.md) |
| **Database & KV** | `<sql_bulk>` | High-speed $O(1)$ cross-database streaming bulk copy | [sql_bulk.md](sql_bulk.md) |
| **Database & KV** | `<kv>` / `<kv_bulk>` | NoSQL Key-Value operations & SQL-to-KV bulk streaming (`bbolt`, `badger`, `redis`, `etcd`) | [kv.md](kv.md) |
| **Code & Templates** | `<script>` | Embedded Go (`Yaegi`) & Lua (`Gopher-Lua`), plus shell & C# scripts (`pwsh`, `bash`, `cmd`, `zsh`, `csx`) | [script.md](script.md) / [golang.md](golang.md) / [lua.md](lua.md) / [csx.md](csx.md) / [powershell.md](powershell.md) / [bash.md](bash.md) |
| **Code & Templates** | `<template>` | Go `text/template` dynamic text/SQL/JSON rendering | [template.md](template.md) |
| **Code & Templates** | `<template_html>` | Go `html/template` XSS-safe HTML rendering | [template_html.md](template_html.md) |
| **Web & Extraction** | `<http_client>` | REST/HTTP client with TLS, proxy, timeout, and header controls | [http_client.md](http_client.md) |
| **Web & Extraction** | `<json_path>` | JSONPath query extraction (`value`, `json`, `json_array`) | [json_path.md](json_path.md) |
| **Web & Extraction** | `<xml_xpath>` | XPath query extraction (`text`, `xml`, `json_array`) | [xml_path.md](xml_path.md) |
| **Web & Extraction** | `<yaml_path>` | YAML path query extraction (`value`, `json`, `json_array`, `yaml`) | [yaml_path.md](yaml_path.md) |
| **Files & Excel** | `<excel_read>` | `.xlsx` worksheet reader to JSON array | [excel_read.md](excel_read.md) |
| **Files & Excel** | `<excel_write>` | SQL query exporter to multi-sheet `.xlsx` workbooks | [excel_write.md](excel_write.md) |
| **Files & Excel** | `<file_read>` | Local file reader into pipeline variable | [file_read.md](file_read.md) |
| **Files & Excel** | `<file_save>` | Local file writer / appender from variable or inline content | [file_save.md](file_save.md) |

---

## 7. Ecosystem CLI Reference (`flow`, `crypto_tool`, `db_importer`)

For full command-line documentation, see [**Complete CLI Options and Arguments**](guides/COMPLETE_CLI_OPTIONS_AND_ARGUMENTS.md).

### Core Engine Flags (`flow.exe` / `flow`)

| Flag | Default | Description |
| :--- | :--- | :--- |
| `-file <path\|uri>` | `scripts.xml` | Pipeline XML path, HTTP(S) URL, or `sql://` / `db://` database query URI. |
| `-options <path\|uri>` | `""` | XML options profile defining default CLI flags (`<flow_cli_options>`). |
| `-config <path\|uri>` | `""` | Environment override XML (`CONFIG.xml`) for variables and databases. |
| `-vars "K=V,..."` | `""` | Runtime variable overrides (highest precedence; recursive expansion up to 3 levels). |
| `-format <fmt>` | `csv` | Output renderer: `csv`, `text`, `json`, `jsonpretty`, `markdown`, or `stream`. |
| `-validate` | `false` | Validates XML schema (`-xsd`) and AST semantics without executing nodes. |
| `-preflight` | `false` | Executes `<preflight>` nodes only and exits. |
| `-builder` | `false` | Launches the interactive HTMX visual pipeline studio web server. |
| `-builder-port <int>` | `0` | Port for the visual builder web server (`0` selects an ephemeral port). |
| `-encrypted` | `false` | Decrypts AES-256-GCM input resources (auto-detected for `FLOWENC:v1:` payloads). |
| `-key-file <path>` | `""` | Path to symmetric key/passphrase file (recommended over `-secure-key`). |
| `-verify-signature` | `false` | Enforces digital signature verification before decryption or execution. |
| `-public-key` / `-cert` | `""` | Public key (`.pem`) or X.509 certificate (`.pem`/`.cer`) for signature verification. |
| `-node-output` | `false` | Persists redacted node outputs into `pipeline_events.node_output` when `log_db` is active. |
| `-xslt <path>` / `-out` | `""` | Transforms pipeline XML via XSLT 3.0 with an injected Mermaid.js diagram. |
| `-debug` | `false` | Enables verbose diagnostic logging. |

### Companion Utility 1: `db_importer` (`db_import`)

Built from `./db_importer/mssql_importer.go`, [`db_importer`](db_import.md) manages database-backed XML artifacts (`dbo.flow_pipeline_content`, `dbo.flow_options_content`, and `dbo.flow_config_content`) with idempotent `MERGE INTO` upserts, UTF-8/UTF-16 BOM auto-decoding, and optional AES-256-GCM encryption (`FLOWENC:v1:`):

| Flag | Default | Description |
| :--- | :--- | :--- |
| `-action <import\|export>` | `import` | Upserts an XML file into SQL Server (`import`) or extracts a stored record (`export` / `-export`). |
| `-dsn <conn_string>` | `sqlserver://...` | Target SQL Server connection string. |
| `-table <type>` | `pipeline` | Target table mapping: `pipeline` (`dbo.flow_pipeline_content`), `options` (`dbo.flow_options_content`), or `config` (`dbo.flow_config_content`). |
| `-name <key>` | `github_ai_credit_usage` | Logical key stored in the `Name` column (`VARCHAR(120)`). |
| `-file <path\|->` | `github_ai_credit_usage.xml` | Input or output file path (or `"-"` for `stdin`/`stdout`; exported files use `0600` permissions). |
| `-desc <text>` | `"Imported via Go importer"` | Description stored in the `Description` column during `import`. |
| `-encrypted` | `false` | Encrypts content (`FLOWENC:v1:`) before importing, or decrypts content on export. |
| `-key-file <path>` | `""` | Path to symmetric key file (fallback: `-secure-key`, `FLOW_SECURE_KEY`, `SECURE_KEY`). |

👉 **Full Guide:** [**`db_importer` (`db_import`) — Database XML Importer & Exporter Reference**](db_import.md)

### Companion Utility 2: `crypto_tool`

Built from `./crypto_tool/main.go`, [`crypto_tool`](crypto_tool.md) provides zero-dependency offline key generation, AES-256-GCM encryption/decryption, and digital signature creation/verification across OpenSSL (`rsa`, `ecdsa`, `ed25519`), PKCS#7/CMS (`.p7s`), and OpenPGP/GPG (`.asc`):

| Flag | Default | Description |
| :--- | :--- | :--- |
| `-action <op>` | `encrypt` | Action to run: `encrypt`, `decrypt`, `gen-key` (or `-gen-key`), `gen-keypair`, `sign`, or `verify`. |
| `-in <path\|->` / `-out <path\|->` | `""` (`stdin`/`stdout`) | Input and output file paths (secret key outputs automatically use `0600` permissions). |
| `-key-file <path>` | `""` | Symmetric key/passphrase file for `encrypt` and `decrypt` (fallback: `-secure-key`/`-key`, `FLOW_SECURE_KEY`, `SECURE_KEY`). |
| `-keypair-type <alg>` | `rsa` | Asymmetric algorithm for `gen-keypair`: `rsa` (`-bits 2048\|4096`), `ecdsa` (P-256), `ed25519`, or `pgp`. |
| `-out-priv` / `-out-pub` / `-out-cert` | `private_key.pem` / `public_key.pem` | Output paths for generated private key (`0600`), public key (`0644`), and optional self-signed X.509 certificate (`-cn`). |
| `-sig-type <fmt>` | `openssl` | Signature format for `sign`: `openssl`, `pkcs7`, or `pgp`. |
| `-private-key` (`-priv`) | `""` | Signer private key path (optional `-passphrase` for encrypted keys). |
| `-wrap` | `false` | Bundles signature and payload into a single `FLOWSIGNED:v1:` envelope. |
| `-public-key` (`-pub`) / `-cert` / `-ca-cert` / `-keyring` | `""` | Trust anchor for `-action verify` (with `-signature`/`-sig` or auto-detected `.sig`/`.asc`/`.p7s`). |

👉 **Full Guide:** [**`crypto_tool` — Standalone Cryptographic & Digital Signature CLI Reference**](crypto_tool.md)
