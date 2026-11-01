# `db_importer` (`db_import`) — Database XML Importer & Exporter Reference

`db_importer` (`db_importer.exe` on Windows, `./db_importer` on Linux/macOS/FreeBSD, built from `./db_importer/mssql_importer.go`) is the standalone database artifact management utility in the `go-flow` ecosystem. It imports and exports **Pipelines** (`PipelineXML`), **CLI Options Profiles** (`OptionsXML`), and **Environment Configurations** (`ConfigXML`) between the local filesystem (or `stdin`/`stdout`) and SQL Server repository tables (`dbo.flow_*_content`), with built-in UTF-8/UTF-16 BOM transcoding and optional AES-256-GCM encryption at rest.

---

## 1. Where `db_importer` Fits in the Flow Ecosystem

Instead of distributing XML files across every execution server, enterprise deployments can store centralized, versioned, and optionally encrypted pipeline artifacts inside a database repository. `db_importer` populates and extracts those database records so [`flow`](flow_executable.md) and `go-flowAPI` can execute them directly via `sql://` or `db:` URIs:

```mermaid
flowchart LR
    subgraph Local["1. Local / CI Artifact Sources"]
        P["Pipeline XML<br/>(pipeline.xml)"]
        O["Options XML<br/>(options.xml)"]
        C["Config XML<br/>(config.xml)"]
    end

    subgraph Importer["2. db_importer CLI Utility"]
        DEC["UTF-8 / UTF-16LE / UTF-16BE<br/>BOM Auto-Decoder"]
        CRYPTO["Optional AES-256-GCM<br/>Encrypt / Decrypt<br/>(FLOWENC:v1:)"]
        MERGE["Atomic SQL Server<br/>MERGE INTO Upsert /<br/>SELECT Export"]
    end

    subgraph SQLServer["3. SQL Server Repository Tables"]
        T1[("dbo.flow_pipeline_content<br/>(Name, Description, PipelineXML)")]
        T2[("dbo.flow_options_content<br/>(Name, Description, OptionsXML)")]
        T3[("dbo.flow_config_content<br/>(Name, Description, ConfigXML)")]
    end

    subgraph Runtime["4. Runtime Consumers"]
        FLOW["flow / flow.exe<br/>(-file sql://... -options sql://...)"]
        API["go-flowAPI & flowUI<br/>(/api/v1/pipelines, /options, /configs)"]
    end

    P & O & C --> DEC --> CRYPTO --> MERGE
    MERGE <--> T1 & T2 & T3
    T1 & T2 & T3 --> FLOW & API
```

### Building `db_importer`

From the root of the `go-flow` repository:

```powershell
# Windows (PowerShell)
$env:CGO_ENABLED = "0"
go build -trimpath -ldflags="-s -w" -o db_importer.exe ./db_importer
```

```bash
# Linux / macOS / FreeBSD (Bash)
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o db_importer ./db_importer
```

See the [CLI Compilation and Build Guide](guides/COMPILATION_AND_BUILD_GUIDE.md) for full cross-compilation details.

---

## 2. Target Database Schemas & `-table` Mappings

`db_importer` maps the `-table` flag to one of three canonical SQL Server tables:

| `-table` Flag Value | Target SQL Server Table | Target XML Column | Key Column | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`pipeline`** *(Default)* | `dbo.flow_pipeline_content` | `PipelineXML` (`NVARCHAR(MAX)`) | `Name` (`VARCHAR(120)`) | Stores complete `<pipeline>` workflow definitions. |
| **`options`** | `dbo.flow_options_content` | `OptionsXML` (`NVARCHAR(MAX)`) | `Name` (`VARCHAR(120)`) | Stores `<flow_cli_options>` execution profiles (`-options`). |
| **`config`** | `dbo.flow_config_content` | `ConfigXML` (`NVARCHAR(MAX)`) | `Name` (`VARCHAR(120)`) | Stores environment-specific `<pipeline>` overrides (`-config` `<variables>` and `<databases>`). |

### Prerequisite DDL Creation Script

Run the following SQL script on your target SQL Server database before using `db_importer`:

```sql
CREATE TABLE dbo.flow_pipeline_content
(
    [Id]           BIGINT IDENTITY(1,1) PRIMARY KEY,
    [Name]         VARCHAR(120)  NOT NULL,
    [Tag]          VARCHAR(4000) NULL, -- ';' separated tags
    [Description]  VARCHAR(256)  NULL,
    [CreatedOnUTC] DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    [Enabled]      BIT           DEFAULT 1, -- 0 = False, 1 = True
    [PipelineXML]  NVARCHAR(MAX) NOT NULL
);

CREATE TABLE dbo.flow_options_content
(
    [Id]           BIGINT IDENTITY(1,1) PRIMARY KEY,
    [Name]         VARCHAR(120)  NOT NULL,
    [Tag]          VARCHAR(4000) NULL,
    [Description]  VARCHAR(256)  NULL,
    [CreatedOnUTC] DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    [Enabled]      BIT           DEFAULT 1,
    [OptionsXML]   NVARCHAR(MAX) NOT NULL
);

CREATE TABLE dbo.flow_config_content
(
    [Id]           BIGINT IDENTITY(1,1) PRIMARY KEY,
    [Name]         VARCHAR(120)  NOT NULL,
    [Tag]          VARCHAR(4000) NULL,
    [Description]  VARCHAR(256)  NULL,
    [CreatedOnUTC] DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    [Enabled]      BIT           DEFAULT 1,
    [ConfigXML]    NVARCHAR(MAX) NOT NULL
);
```

---

## 3. Complete CLI Flag Reference

```bash
db_importer [flags]
```

| Flag | Type | Default | Description |
| :--- | :---: | :--- | :--- |
| `-action` | `string` | `import` | Operation to execute: `import` (upserts XML into the target table) or `export` (queries XML from the target table). |
| `-export` | `bool` | `false` | Shortcut boolean flag for `-action export`. |
| `-dsn` | `string` | `sqlserver://sa:Password123!@localhost:1433?database=master&trustServerCertificate=true` | SQL Server connection string (`sqlserver://...` URL or ADO.NET `server=...;user id=...` format). See [Connection Strings Reference](database_connection_strings.md) for URL-encoding special characters in passwords. |
| `-table` | `string` | `pipeline` | Target artifact repository: `pipeline`, `options`, or `config`. |
| `-name` | `string` | `github_ai_credit_usage` | Unique logical identifier (`Name` column) used to match the record during `MERGE INTO` import or `SELECT` export. |
| `-file` | `string` | `github_ai_credit_usage.xml` | Input file path (for `import`) or output destination path (for `export`). Pass `"-"` or `""` to read from `stdin` or write to `stdout`. |
| `-desc` | `string` | `"Imported via Go importer"` | Human-readable summary written to the `Description` column during `import`. |
| `-encrypted` | `bool` | `false` | **On `import`:** Encrypts the XML payload into an AES-256-GCM `FLOWENC:v1:` envelope prior to database insertion.<br/>**On `export`:** Decrypts an encrypted database payload before writing it to `-file` or `stdout`. |
| `-key-file` | `string` | `""` | **Recommended.** Path to a file containing the symmetric AES-256-GCM key/passphrase. Avoids exposing secrets in OS process listings. |
| `-secure-key` | `string` | `""` | Symmetric passphrase/key supplied on the command line (emits a process-listing warning to `stderr`). Falls back to `FLOW_SECURE_KEY` or `SECURE_KEY`. |

### Key Resolution Precedence

When `-encrypted` is enabled (or when exporting a record whose payload begins with `FLOWENC:v1:`), `db_importer` resolves the symmetric key in the following order:

1. **`-secure-key`** CLI flag *(emits process-listing exposure warning to `stderr`)*
2. **`-key-file <path>`** *(reads key from file)*
3. **`FLOW_SECURE_KEY`** environment variable
4. **`SECURE_KEY`** environment variable

---

## 4. Key Architecture & Safety Features

### 4.1 Idempotent `MERGE INTO` Upserts

During an `import` operation, `db_importer` executes a parameterized SQL Server `MERGE INTO` statement with a 30-second context timeout:

```sql
MERGE INTO dbo.flow_pipeline_content AS target
USING (SELECT @p1 AS Name) AS source
ON (target.Name = source.Name)
WHEN MATCHED THEN
    UPDATE SET Description = @p2, PipelineXML = @p3
WHEN NOT MATCHED THEN
    INSERT (Name, Description, PipelineXML) VALUES (@p1, @p2, @p3);
```

- If a row with `Name = @p1` already exists, its `Description` and XML column (`PipelineXML`, `OptionsXML`, or `ConfigXML`) are updated in place.
- If no matching row exists, a new row is inserted.
- Re-running `db_importer` in CI/CD deployment scripts is completely idempotent.

### 4.2 Automatic UTF-8 & UTF-16 BOM Transcoding

Files saved by Windows PowerShell (`Out-File` / `>` defaults in Windows PowerShell 5.1) or SQL Server Management Studio (SSMS) are often encoded in `UTF-16LE` with a Byte Order Mark (`0xFF 0xFE`), which can cause encoding errors if inserted directly without normalization. `db_importer` automatically inspects the leading bytes of every imported file:

- **UTF-8 BOM (`0xEF 0xBB 0xBF`):** Strips the 3-byte BOM prefix and preserves UTF-8 text.
- **UTF-16 Little-Endian BOM (`0xFF 0xFE`):** Decodes 16-bit little-endian code units into standard UTF-8 string content.
- **UTF-16 Big-Endian BOM (`0xFE 0xFF`):** Decodes 16-bit big-endian code units into standard UTF-8 string content.
- **Plain UTF-8 / ASCII:** Passed through unchanged.

### 4.3 Double-Encryption Prevention & `0600` Export Hardening

- **Idempotent Encryption on Import:** If `-encrypted` is specified on `import` and the input file is *already* an armored `FLOWENC:v1:` payload (for example, pre-encrypted offline by [`crypto_tool`](crypto_tool.md)), `db_importer` detects the `FLOWENC:v1:` header and stores it directly without double-encrypting.
- **Auto-Detection on Export:** When exporting a record from the database, if the stored column begins with `FLOWENC:v1:`, `db_importer` automatically triggers decryption using your configured key even if `-encrypted` was omitted on the command line.
- **Strict `0600` File Permissions:** Whenever `db_importer` exports a record to a local file, it writes the file with `0600` permissions (owner read/write only) so decrypted credentials or connection strings are not world-readable.

---

## 5. Practical Usage Examples

### 5.1 Importing a Pipeline, Options Profile, and Config

```powershell
$DSN = "sqlserver://sa:Password123!@localhost:1433?database=ETL_Metadata&trustServerCertificate=true"

# 1. Import the main Pipeline XML into dbo.flow_pipeline_content
.\db_importer.exe `
  -dsn $DSN `
  -table pipeline `
  -name "github_ai_credit_usage" `
  -file ".\pipelines\github_ai_credit_usage.xml" `
  -desc "GitHub Copilot Billing Usage Pipeline"

# 2. Import the CLI Options XML into dbo.flow_options_content
.\db_importer.exe `
  -dsn $DSN `
  -table options `
  -name "OPTIONS_GITHUB_AI_CREDIT_USAGE" `
  -file ".\options\OPTIONS_GITHUB_AI_CREDIT_USAGE.xml" `
  -desc "GitHub Copilot Billing Usage Options"

# 3. Import the Environment Config XML into dbo.flow_config_content
.\db_importer.exe `
  -dsn $DSN `
  -table config `
  -name "CONFIG_GITHUB_AI_CREDIT_USAGE_PROD" `
  -file ".\configs\CONFIG_GITHUB_AI_CREDIT_USAGE.xml" `
  -desc "Production DB & Variable Overrides"
```

### 5.2 Importing & Exporting Encrypted Artifacts (`FLOWENC:v1:`)

```bash
export DSN="sqlserver://sa:Password123!@localhost:1433?database=ETL_Metadata&trustServerCertificate=true"

# Import and encrypt at rest using a key file (Recommended)
./db_importer \
  -dsn "$DSN" \
  -table config \
  -name "CONFIG_PROD_SECRETS" \
  -file "./configs/prod_secrets.xml" \
  -desc "Encrypted Production Database Credentials" \
  -encrypted \
  -key-file "/etc/flow/secrets/master.key"

# Export from database and decrypt to a local file (saved with 0600 permissions)
./db_importer \
  -action export \
  -dsn "$DSN" \
  -table config \
  -name "CONFIG_PROD_SECRETS" \
  -file "./configs/prod_secrets_decrypted.xml" \
  -encrypted \
  -key-file "/etc/flow/secrets/master.key"
```

### 5.3 Streaming via `stdin` / `stdout` (`-file -`)

```bash
# Export a pipeline directly to stdout and pipe into grep/xmllint
./db_importer \
  -export \
  -dsn "$DSN" \
  -table pipeline \
  -name "github_ai_credit_usage" \
  -file - | xmllint --format -
```

### 5.4 Executing Imported Artifacts with `flow`

Once imported via `db_importer`, `flow` (`flow.exe`) can load `-options`, `-file`, and `-config` directly from SQL Server using the `sql://sqlserver@<DSN>#<SELECT query>` URI syntax:

```powershell
# Run an entire pipeline configuration from SQL Server via its imported OptionsXML record
.\flow.exe `
  -encrypted `
  -key-file "C:\etc\flow\secrets\master.key" `
  -options "sql://sqlserver@sqlserver://sa:Password123!@localhost:1433?database=ETL_Metadata&trustServerCertificate=true#SELECT OptionsXML FROM dbo.flow_options_content WHERE Name = 'OPTIONS_GITHUB_AI_CREDIT_USAGE'"
```

Or specify `-file` and `-config` queries directly:

```powershell
.\flow.exe `
  -encrypted `
  -key-file "C:\etc\flow\secrets\master.key" `
  -file "sql://sqlserver@sqlserver://sa:Password123!@localhost:1433?database=ETL_Metadata&trustServerCertificate=true#SELECT PipelineXML FROM dbo.flow_pipeline_content WHERE Name = 'github_ai_credit_usage'" `
  -config "sql://sqlserver@sqlserver://sa:Password123!@localhost:1433?database=ETL_Metadata&trustServerCertificate=true#SELECT ConfigXML FROM dbo.flow_config_content WHERE Name = 'CONFIG_PROD_SECRETS'"
```

---

## 6. Related Documentation

- [**`crypto_tool` — Standalone Cryptographic & Digital Signature CLI Reference**](crypto_tool.md)
- [**Database-Backed XML Storage Guide**](guides/README_DATABASE_XML.md)
- [**Remote File, HTTP & SQL DSN Sources**](guides/FLOW_WITH_REMOTE_FILE_SOURCE.md)
- [**Database Connection Strings & Driver Reference**](database_connection_strings.md)
- [**UTF-8 & UTF-16 Encoding Guide**](guides/README_UTF.md)
- [**Complete CLI Options & Arguments**](guides/COMPLETE_CLI_OPTIONS_AND_ARGUMENTS.md)
