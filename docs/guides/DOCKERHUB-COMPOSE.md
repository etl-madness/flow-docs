# Run FlowUI and go-flowAPI from Docker Hub with Docker Compose

This guide uses the published images instead of building either application from source:

- FlowUI: `etlmadness/flowui:latest`
- API: `etlmadness/go-flow-api:latest`
- Optional if you need SQL Server: `mcr.microsoft.com/mssql/server:2022-latest`

Once you have the necessary images pulled from Docker Hub, you can use Docker Compose to start the services.
Access to the FlowUI will be on local port 5185 of your host machine by default. Access to the go-flowAPI will be on local port 5180  by default.

## Docker Compose Example with FlowUI, go-flowAPI, and Optional SQL Server

**Docker Compose Full Example** This example contains a full Docker Compose configuration(s) for running FlowUI, go-flowAPI, and an optional SQL Server instance, along with the necessary SQL Server initialization script.

### Step 1: Choose a Password and Hash Format for the FlowUI Administrative Account
Supports the following password hash formats: bcrypt, sha256 and plaintext

1. **SHA-256 Hex Digest (`sha256:<hex>`)**
   Prefix a lowercase 64-character SHA-256 hex digest with `sha256:`:
   - **Bash / Linux / macOS**:
     ```bash
     printf "sha256:%s\n" "$(printf '%s' 'ChangeMe!StrongAdminPass2026' | sha256sum | awk '{print $1}')"
     ```
   - **PowerShell**:
     ```powershell
     $bytes = [System.Text.Encoding]::UTF8.GetBytes("ChangeMe!StrongAdminPass2026")
     $hash  = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace("-","").ToLower()
     "sha256:$hash"
     ```
2. **Plaintext (Quick Dev/Test Bootstrap Only)**
   If `password_hash` does not start with `$2a$`/`$2b$`/`$2y$` or `sha256:`, `go-flowAPI` compares it using a constant-time SHA-256 digest comparison. You can insert a plaintext password initially and immediately rotate it to bcrypt by calling `POST /api/v1/users`.

### Step 2: Prepare or run SQL Server Initialization Script

**SQL Server Initialization Script** should be run directly on an existing SQL Server instance, or alternatively saved as a separate file to be included directly in your SQL Server setup process.

Note: if you are directly running this script on an existing SQL Server instance, ensure that you have the necessary permissions to create databases and tables. If you plan on chaning the database name, make sure to change it in the below docker-compose configuration as well.

There is an option to change the schema but that will require downloading and recompiling the applications with the updated schema settings. See source code for specific details on how to modify the schema.

Save the following content as `./docker/init/sqlserver-init.sql` in your project directory:

```sql
-- =============================================================================
-- SQL Server Initialization Script for FlowUI + go-flowAPI (Database: EXAMPLE_DB)
-- =============================================================================
IF DB_ID('EXAMPLE_DB') IS NULL
BEGIN
    CREATE DATABASE [EXAMPLE_DB];
END
GO

USE [EXAMPLE_DB];
GO

-- 1. Pipeline Content Table
IF OBJECT_ID('dbo.flow_pipeline_content', 'U') IS NULL
CREATE TABLE dbo.flow_pipeline_content (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(255) NOT NULL UNIQUE,
    Description NVARCHAR(MAX) NULL,
    PipelineXML NVARCHAR(MAX) NULL,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 2. Options Content Table
IF OBJECT_ID('dbo.flow_options_content', 'U') IS NULL
CREATE TABLE dbo.flow_options_content (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(255) NOT NULL UNIQUE,
    Description NVARCHAR(MAX) NULL,
    OptionsXML  NVARCHAR(MAX) NULL,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 3. Config Content Table
IF OBJECT_ID('dbo.flow_config_content', 'U') IS NULL
CREATE TABLE dbo.flow_config_content (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(255) NOT NULL UNIQUE,
    Description NVARCHAR(MAX) NULL,
    ConfigXML   NVARCHAR(MAX) NULL,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- 4. Pipeline Runs Summary Table
IF OBJECT_ID('dbo.pipeline_runs', 'U') IS NULL
CREATE TABLE dbo.pipeline_runs (
    run_id           NVARCHAR(64)  NOT NULL PRIMARY KEY,
    file_path        NVARCHAR(512) NULL,
    config_path      NVARCHAR(512) NULL,
    status           NVARCHAR(32)  NOT NULL,
    started_at       DATETIME2     NOT NULL,
    finished_at      DATETIME2     NOT NULL,
    duration_ms      BIGINT        NOT NULL,
    task_count       INT           NOT NULL,
    user_name        NVARCHAR(255) NULL,
    os_user_name     NVARCHAR(255) NULL,
    db_user_name     NVARCHAR(255) NULL,
    spid             BIGINT        NULL,
    application_name NVARCHAR(255) NULL,
    hostname         NVARCHAR(255) NULL,
    options_path     NVARCHAR(512) NULL,
    error_class      NVARCHAR(128) NULL,
    error_message    NVARCHAR(MAX) NULL
);
GO

-- 5. Pipeline Events Telemetry Table
IF OBJECT_ID('dbo.pipeline_events', 'U') IS NULL
CREATE TABLE dbo.pipeline_events (
    id               BIGINT IDENTITY(1,1) PRIMARY KEY,
    run_id           NVARCHAR(64)  NOT NULL,
    execution_id     NVARCHAR(64)  NULL,
    sequence_num     BIGINT        NOT NULL,
    occurred_at      DATETIME2     NOT NULL,
    event_type       NVARCHAR(64)  NOT NULL,
    node_kind        NVARCHAR(64)  NULL,
    node_id          NVARCHAR(255) NULL,
    status           NVARCHAR(64)  NULL,
    user_name        NVARCHAR(255) NULL,
    os_user_name     NVARCHAR(255) NULL,
    db_user_name     NVARCHAR(255) NULL,
    spid             NVARCHAR(64)  NULL,
    application_name NVARCHAR(255) NULL,
    hostname         NVARCHAR(255) NULL,
    options_path     NVARCHAR(512) NULL,
    error_message    NVARCHAR(MAX) NULL,
    rows_read        BIGINT        NULL,
    rows_written     BIGINT        NULL,
    rows_affected    BIGINT        NULL,
    node_output      NVARCHAR(MAX) NULL
);
GO

-- 6. API Audit Events Table
IF OBJECT_ID('dbo.flow_api_events', 'U') IS NULL
CREATE TABLE dbo.flow_api_events (
    event_id      NVARCHAR(64)  NOT NULL PRIMARY KEY,
    occurred_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    event_type    NVARCHAR(128) NOT NULL,
    http_method   NVARCHAR(16)  NOT NULL,
    path          NVARCHAR(512) NOT NULL,
    artifact_type NVARCHAR(64)  NULL,
    artifact_name NVARCHAR(255) NULL,
    run_id        NVARCHAR(64)  NULL,
    auth_user     NVARCHAR(255) NULL,
    remote_addr   NVARCHAR(128) NULL,
    status_code   INT           NOT NULL,
    status        NVARCHAR(32)  NOT NULL,
    duration_ms   BIGINT        NOT NULL,
    error_message NVARCHAR(MAX) NULL,
    details_json  NVARCHAR(MAX) NULL
);
GO

-- 7. API BasicAuth Users & Permissions Table
IF OBJECT_ID('dbo.flow_api_users', 'U') IS NULL
CREATE TABLE dbo.flow_api_users (
    username      NVARCHAR(255) NOT NULL PRIMARY KEY,
    password_hash NVARCHAR(512) NOT NULL,
    permission    NVARCHAR(128) NOT NULL,
    is_active     BIT           NOT NULL DEFAULT 1,
    description   NVARCHAR(512) NULL,
    created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

```

### Step 3: Bootstrap FlowUI Administrative Account

Use the password hash format you chose in Step 1 when setting `<PASSWORD_OR_HASH>` in the SQL statement.

```sql
MERGE INTO dbo.flow_api_users AS target
USING (SELECT N'admin' AS username) AS source
ON (target.username = source.username)
WHEN MATCHED THEN
    UPDATE SET
        password_hash = N'<PASSWORD_OR_HASH>',
        permission    = N'all',
        is_active     = 1,
        description   = N'Initial administrator account with all permissions',
        updated_at    = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (username, password_hash, permission, is_active, description)
    VALUES (N'admin', N'<PASSWORD_OR_HASH>', N'all', 1, N'Initial administrator account with all permissions');
```

### Step 4 (Option 1): Docker Compose for FlowUI, go-flowAPI, and SQL Server

Save the following content as `docker-compose.yml` in your project root directory.
Set `FLOW_DB_PASSWORD` in your `.env` file to the SQL Server SA password. Compose passes that same value to SQL Server as `MSSQL_SA_PASSWORD` and uses it in the API's connection string. The initialization script creates `EXAMPLE_DB`, so the API DSN targets that database. 

```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: flow-sqlserver
    restart: unless-stopped
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "${FLOW_DB_PASSWORD:-YourStrong!Passw0rd}"
      MSSQL_PID: "Developer"
    ports:
      - "${MSSQL_HOST_PORT:-1433}:1433"
    volumes:
      - flow_sqlserver_data:/var/opt/mssql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$$MSSQL_SA_PASSWORD" -C -Q "SELECT 1" || /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$$MSSQL_SA_PASSWORD" -Q "SELECT 1"',
        ]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 15s

  sqlserver-init:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: flow-sqlserver-init
    depends_on:
      sqlserver:
        condition: service_healthy
    environment:
      MSSQL_SA_PASSWORD: "${FLOW_DB_PASSWORD:-YourStrong!Passw0rd}"
    volumes:
      - ./docker/init/sqlserver-init.sql:/init/sqlserver-init.sql:ro
    entrypoint:
      - /bin/bash
      - -c
      - |
        echo "[sqlserver-init] Provisioning EXAMPLE_DB database and Flow tables..."
        if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
          /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "$$MSSQL_SA_PASSWORD" -C -i /init/sqlserver-init.sql
        else
          /opt/mssql-tools/bin/sqlcmd -S sqlserver -U sa -P "$$MSSQL_SA_PASSWORD" -i /init/sqlserver-init.sql
        fi
        echo "[sqlserver-init] Schema initialization complete."
    restart: "no"

  go-flow-api:
    image: etlmadness/go-flow-api:latest
    container_name: go-flow-api
    restart: unless-stopped
    depends_on:
      sqlserver-init:
        condition: service_completed_successfully
    ports:
      - "${FLOW_API_HOST_PORT:-5180}:5180"
    environment:
      FLOW_API_ADDR: ":5180"
      FLOW_API_DSN: "sqlserver://sa:${FLOW_DB_PASSWORD:-YourStrong!Passw0rd}@sqlserver:1433?database=EXAMPLE_DB&trustServerCertificate=true&App+Name=go-flow-api"
      

  FlowUI:
    image: etlmadness/flowui:latest
    container_name: FlowUI
    restart: unless-stopped
    depends_on:
      go-flow-api:
        condition: service_started
    ports:
      - "${FLOW_UI_PORT:-5185}:5185"
    environment:
      ASPNETCORE_ENVIRONMENT: "${ASPNETCORE_ENVIRONMENT:-Production}"
      ASPNETCORE_URLS: "http://+:5185"
      FLOW_UI_PORT: "5185"
      FLOW_API_HOST: "http://go-flow-api"
      FLOW_API_PORT: "5180"


volumes:
  flow_sqlserver_data:
```

### Step 4 (Option 2): Docker Compose for FlowUI, go-flowAPI, with existing SQL Server

Save the following content as `docker-compose.yml` in your project root directory.
Set `FLOW_DB_PASSWORD` in your `.env` file to the SQL Server SA password. Compose passes that same value to SQL Server as `MSSQL_SA_PASSWORD` and uses it in the API's connection string. The initialization script creates `EXAMPLE_DB`, so the API DSN targets that database. 

```yaml
services:
  go-flow-api:
    image: etlmadness/go-flow-api:latest
    container_name: go-flow-api
    restart: unless-stopped
    depends_on:
      sqlserver-init:
        condition: service_completed_successfully
    ports:
      - "${FLOW_API_HOST_PORT:-5180}:5180"
    environment:
      FLOW_API_ADDR: ":5180"
      FLOW_API_DSN: "sqlserver://sa:${FLOW_DB_PASSWORD:-YourStrong!Passw0rd}@sqlserver:1433?database=EXAMPLE_DB&trustServerCertificate=true&App+Name=go-flow-api"

  FlowUI:
    image: etlmadness/flowui:latest
    container_name: FlowUI
    restart: unless-stopped
    depends_on:
      go-flow-api:
        condition: service_started
    ports:
      - "${FLOW_UI_PORT:-5185}:5185"
    environment:
      ASPNETCORE_ENVIRONMENT: "${ASPNETCORE_ENVIRONMENT:-Production}"
      ASPNETCORE_URLS: "http://+:5185"
      FLOW_UI_PORT: "5185"
      FLOW_API_HOST: "http://go-flow-api"
      FLOW_API_PORT: "5180"


```

Pull the published application images, then start the services:

```powershell
docker compose pull
docker compose up -d
```