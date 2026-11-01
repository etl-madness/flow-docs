# FlowUI Docker & Docker Compose Guide

This guide explains how to build, configure, and run **FlowUI** in Docker using either **Linux containers** (default) or **Windows containers**, across all supported deployment topologies.

> **Architecture Note:** `FlowUI` communicates **strictly via `go-flowAPI`** (`FlowApiClient`) to load, save, upload, delete, and execute pipelines, configs, and options. `FlowUI` has **no direct database connection** and **no internal database**.

---

## 1. Overview of Docker Files

All FlowUI Docker, Docker Compose, environment, and SQL initialization files are stored with a unique `flowui.*` prefix under `docs/guides/docker/flowui/` so they remain completely distinct from the `go-flowAPI` container files (`docs/guides/docker/api/api.*` in the [API Docker Deployment Guide](API_DOCKER_DEPLOYMENT_GUIDE.md)).

| Repository File (`flowUI/`) | Unique Reference File in `flow-docs` | Target OS | Services Included | Description |
| :--- | :--- | :--- | :--- | :--- |
| `Dockerfile` | [`flowui.Dockerfile`](docker/flowui/flowui.Dockerfile) | **Linux** (Default) | `FlowUI` | Multi-stage build using `mcr.microsoft.com/dotnet/sdk:10.0` and `mcr.microsoft.com/dotnet/aspnet:10.0` (runs as non-root `$APP_UID`). |
| `Dockerfile.windows` | [`flowui.Dockerfile.windows`](docker/flowui/flowui.Dockerfile.windows) | **Windows** (`ltsc2022`) | `FlowUI` | Multi-stage build using `windowsservercore-ltsc2022` for Windows Integrated Authentication (`FLOW_UI_AUTH_MODE=Windows`). |
| `docker-compose.yml` | [`flowui.docker-compose.yml`](docker/flowui/flowui.docker-compose.yml) | Linux (or Windows via env) | `FlowUI` | **Combination 1 (Default)**: Runs `FlowUI` only; connects to an existing external `go-flowAPI`. |
| `docker-compose.api.yml` | [`flowui.docker-compose.api.yml`](docker/flowui/flowui.docker-compose.api.yml) | Linux | `FlowUI` + `go-flow-api` | **Combination 2**: Builds and runs both `FlowUI` and `../go-flowAPI` (with `../go-flow` build context); `go-flow-api` connects to an external SQL Server. |
| `docker-compose.full.yml` | [`flowui.docker-compose.full.yml`](docker/flowui/flowui.docker-compose.full.yml) | Linux | `FlowUI` + `go-flow-api` + `sqlserver` + `sqlserver-init` | **Combination 3 (Full Stack)**: Self-contained stack with SQL Server 2022, automatic `EXAMPLE_DB` database & table initialization for `go-flowAPI`, `go-flowAPI`, and `FlowUI`. |
| `docker-compose.windows.yml` | [`flowui.docker-compose.windows.yml`](docker/flowui/flowui.docker-compose.windows.yml) | Windows | `FlowUI` | **Windows Container Mode**: Builds `Dockerfile.windows` with `FLOW_UI_AUTH_MODE=Windows`. |
| `docker/init/sqlserver-init.sql` | [`flowui.sqlserver-init.sql`](docker/flowui/flowui.sqlserver-init.sql) | SQL Server | `sqlserver-init` | Idempotent SQL script that creates the `EXAMPLE_DB` database and core `flow_*` / `pipeline_*` tables for `go-flowAPI` on startup. |
| `.env.example` | [`flowui.env.example`](docker/flowui/flowui.env.example) | Both | All | Template environment variables file for Docker Compose. |

---

## 2. Environment Variables Reference

Copy `.env.example` ([`flowui.env.example`](docker/flowui/flowui.env.example)) to `.env` in the `flowUI` repository root before running `docker compose` to customize ports and API settings:

```powershell
Copy-Item .env.example .env
```

### Example `.env.example` ([`flowui.env.example`](docker/flowui/flowui.env.example))

```ini
# =============================================================================
# FlowUI Docker Compose Environment Configuration (.env)
# Copy this file to .env and adjust values for your environment:
#   cp .env.example .env
# =============================================================================

# --- Container OS Override (Dockerfile or Dockerfile.windows) ---
FLOW_UI_DOCKERFILE=Dockerfile
ASPNETCORE_ENVIRONMENT=Production

# --- Ports ---
FLOW_UI_PORT=5185
FLOW_API_PORT=8080
MSSQL_HOST_PORT=1433

# --- FlowUI Authentication ---
# Options: ApiBasic, Windows
FLOW_UI_AUTH_MODE=ApiBasic

# --- go-flowAPI Connection ---
FLOW_API_HOST=http://host.docker.internal
FLOW_API_PORT=8080

# --- go-flowAPI Bootstrap User & SQL Server Settings (used only in api/full compose files) ---
FLOW_UI_ADMIN_USER=admin
FLOW_UI_ADMIN_PASSWORD=Admin123!
FLOW_DB_SERVER=dbserver.example.com
FLOW_DB_NAME=EXAMPLE_DB
FLOW_DB_USER=sa
FLOW_DB_PASSWORD=YourStrong!Passw0rd
```

### `FlowUI` Environment Variables

| Variable | Default in Compose | Description |
| :--- | :--- | :--- |
| `FLOW_UI_PORT` | `5185` | Host and container HTTP port for `FlowUI`. |
| `FLOW_API_HOST` | `http://host.docker.internal` | Base scheme + hostname for `go-flowAPI` (`http://go-flow-api` in `api`/`full` compose files). |
| `FLOW_API_PORT` | `8080` (`5180` in default compose) | Port for `go-flowAPI`. |
| `FLOW_API_URL` | *(optional)* | Full URL override for `go-flowAPI` (overrides `FLOW_API_HOST` + `FLOW_API_PORT` if set). |
| `FLOW_UI_AUTH_MODE` | `ApiBasic` | Default authentication provider (`ApiBasic` or `Windows`). In `ApiBasic` mode, API requests use the credentials entered by the user at login. |

### `go-flowAPI` & `sqlserver` Variables (Used in `docker-compose.api.yml` & `docker-compose.full.yml`)

| Variable           | Default in Compose     | Description                                                                |
| :----------------- | :--------------------- | :------------------------------------------------------------------------- |
| `FLOW_DB_SERVER`   | `host.docker.internal` | SQL Server hostname for `go-flowAPI` DSN in `docker-compose.api.yml`.      |
| `FLOW_DB_NAME`     | `EXAMPLE_DB`           | Target SQL Server database name for `go-flowAPI`.                          |
| `FLOW_DB_PASSWORD` | `YourStrong!Passw0rd`  | SQL Server password used by `go-flowAPI` and `sqlserver` container.        |
| `MSSQL_HOST_PORT`  | `1433`                 | Host port mapped to the SQL Server container in `docker-compose.full.yml`. |

---

## 3. Usage & Examples by Deployment Scenario

### Scenario 1: `FlowUI` Only (Default — External `go-flowAPI`)

Use `docker-compose.yml` ([`flowui.docker-compose.yml`](docker/flowui/flowui.docker-compose.yml)) when `go-flowAPI` is already running on your host machine or another server on your network.

#### `docker-compose.yml` ([`flowui.docker-compose.yml`](docker/flowui/flowui.docker-compose.yml))

```yaml
# =============================================================================
# Combination 1 (Default): FlowUI Only (Linux Container)
# Connects strictly to an existing external go-flowAPI (no direct DB connection).
#
# Usage:
#   docker compose up -d --build
# =============================================================================

services:
  FlowUI:
    build:
      context: .
      dockerfile: ${FLOW_UI_DOCKERFILE:-Dockerfile}
    image: FlowUI:latest
    container_name: FlowUI
    restart: unless-stopped
    ports:
      - "${FLOW_UI_PORT:-5185}:5185"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      ASPNETCORE_ENVIRONMENT: "${ASPNETCORE_ENVIRONMENT:-Production}"
      ASPNETCORE_URLS: "http://+:5185"
      FLOW_UI_PORT: "5185"
      FLOW_API_HOST: "${FLOW_API_HOST:-http://host.docker.internal}"
      FLOW_API_PORT: "${FLOW_API_PORT:-5180}"
      FLOW_UI_AUTH_MODE: "${FLOW_UI_AUTH_MODE:-ApiBasic}"
      FLOW_WINDOWS_USER: "${FLOW_WINDOWS_USER:-}"
      FLOW_WINDOWS_GROUPS: "${FLOW_WINDOWS_GROUPS:-}"
      HOST_USERDOMAIN: "${USERDOMAIN:-DOMAINNAME}"
      HOST_USERNAME: "${USERNAME:-USERNAME}"
```

#### Example: Connect to `go-flowAPI` on port `8085` on the host machine

```powershell
# PowerShell
$env:FLOW_API_HOST = "http://host.docker.internal"
$env:FLOW_API_PORT = "8085"
$env:FLOW_UI_AUTH_MODE = "ApiBasic"

docker compose up -d --build
```

Open **`http://localhost:5185`** in your browser.

---

### Scenario 2: `FlowUI` + `go-flowAPI` (External SQL Server)

Use `docker-compose.api.yml` ([`flowui.docker-compose.api.yml`](docker/flowui/flowui.docker-compose.api.yml)) to containerize both the Blazor UI (`FlowUI`) and the Go backend (`go-flow-api`) while `go-flow-api` connects to an existing SQL Server instance.

> **Note:** Expects the sibling repositories `../go-flowAPI` and `../go-flow` to exist alongside `FlowUI` (`etl-madness/go-flowAPI` and `etl-madness/go-flow`).

#### `docker-compose.api.yml` ([`flowui.docker-compose.api.yml`](docker/flowui/flowui.docker-compose.api.yml))

```yaml
# =============================================================================
# Combination 2: FlowUI + go-flowAPI (Linux Containers)
# FlowUI connects only to go-flowAPI; go-flowAPI connects to an external DB.
#
# Usage:
#   docker compose -f docker-compose.api.yml up -d --build
# =============================================================================

services:
  go-flow-api:
    build:
      context: ../go-flowAPI
      dockerfile: Dockerfile
      additional_contexts:
        go-flow: ../go-flow
    image: go-flow-api:latest
    container_name: go-flow-api
    restart: unless-stopped
    ports:
      - "${FLOW_API_PORT:-8080}:8080"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      FLOW_API_ADDR: ":8080"
      FLOW_API_DSN: "${FLOW_API_DSN:-sqlserver://sa:${FLOW_DB_PASSWORD:-YourStrong!Passw0rd}@${FLOW_DB_SERVER:-host.docker.internal}:1433?database=${FLOW_DB_NAME:-EXAMPLE_DB}&trustServerCertificate=true}"
      FLOW_API_BOOTSTRAP_USER: "${FLOW_UI_ADMIN_USER:-admin}"
      FLOW_API_BOOTSTRAP_PASS: "${FLOW_UI_ADMIN_PASSWORD:-Admin123!}"
      FLOW_API_BOOTSTRAP_PERM: "all"
      FLOW_SECURE_KEY: "${FLOW_SECURE_KEY:-}"
      FLOW_API_DEBUG: "${FLOW_API_DEBUG:-false}"

  FlowUI:
    build:
      context: .
      dockerfile: ${FLOW_UI_DOCKERFILE:-Dockerfile}
    image: FlowUI:latest
    container_name: FlowUI
    restart: unless-stopped
    depends_on:
      - go-flow-api
    ports:
      - "${FLOW_UI_PORT:-5185}:5185"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      ASPNETCORE_ENVIRONMENT: "${ASPNETCORE_ENVIRONMENT:-Production}"
      ASPNETCORE_URLS: "http://+:5185"
      FLOW_UI_PORT: "5185"
      FLOW_API_HOST: "http://go-flow-api"
      FLOW_API_PORT: "8080"
      FLOW_UI_AUTH_MODE: "${FLOW_UI_AUTH_MODE:-ApiBasic}"
```

#### Example: Run UI + API against external SQL Server

```powershell
# PowerShell
$env:FLOW_DB_SERVER = "dbserver.example.com"
$env:FLOW_DB_NAME = "EXAMPLE_DB"
$env:FLOW_DB_PASSWORD = "YourStrong!Passw0rd"
$env:FLOW_UI_ADMIN_USER = "admin"
$env:FLOW_UI_ADMIN_PASSWORD = "Admin123!"

docker compose -f docker-compose.api.yml up -d --build
```

- **FlowUI Studio:** `http://localhost:5185`
- **go-flowAPI Endpoint:** `http://localhost:8080/api/v1/health`

---

### Scenario 3: Full Stack (`FlowUI` + `go-flowAPI` + SQL Server 2022)

Use `docker-compose.full.yml` ([`flowui.docker-compose.full.yml`](docker/flowui/flowui.docker-compose.full.yml)) to spin up a complete, self-contained environment from scratch:

1. **`sqlserver`** starts Microsoft SQL Server 2022 Developer Edition and waits until healthy.
2. **`sqlserver-init`** executes `docker/init/sqlserver-init.sql` ([`flowui.sqlserver-init.sql`](docker/flowui/flowui.sqlserver-init.sql)) to create the `EXAMPLE_DB` database and all `flow_*` / `pipeline_*` tables for `go-flowAPI`.
3. **`go-flow-api`** starts on port `8080` connected to `sqlserver` and bootstraps the admin API user.
4. **`FlowUI`** starts on port `5185` and connects exclusively to `go-flow-api`.

#### `docker-compose.full.yml` ([`flowui.docker-compose.full.yml`](docker/flowui/flowui.docker-compose.full.yml))

```yaml
# =============================================================================
# Combination 3: Full Stack (FlowUI + go-flowAPI + SQL Server 2022)
# Automatically provisions SQL Server 2022, initializes the EXAMPLE_DB database
# schema for go-flowAPI, starts go-flowAPI, and launches FlowUI connected
# exclusively to go-flowAPI.
#
# Usage:
#   docker compose -f docker-compose.full.yml up -d --build
# =============================================================================

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
    build:
      context: ../go-flowAPI
      dockerfile: Dockerfile
      additional_contexts:
        go-flow: ../go-flow
    image: go-flow-api:latest
    container_name: go-flow-api
    restart: unless-stopped
    depends_on:
      sqlserver-init:
        condition: service_completed_successfully
    ports:
      - "${FLOW_API_PORT:-8080}:8080"
    environment:
      FLOW_API_ADDR: ":8080"
      FLOW_API_DSN: "sqlserver://sa:${FLOW_DB_PASSWORD:-YourStrong!Passw0rd}@sqlserver:1433?database=${FLOW_DB_NAME:-EXAMPLE_DB}&trustServerCertificate=true"
      FLOW_API_BOOTSTRAP_USER: "${FLOW_UI_ADMIN_USER:-admin}"
      FLOW_API_BOOTSTRAP_PASS: "${FLOW_UI_ADMIN_PASSWORD:-Admin123!}"
      FLOW_API_BOOTSTRAP_PERM: "all"
      FLOW_SECURE_KEY: "${FLOW_SECURE_KEY:-}"
      FLOW_API_DEBUG: "${FLOW_API_DEBUG:-false}"

  FlowUI:
    build:
      context: .
      dockerfile: ${FLOW_UI_DOCKERFILE:-Dockerfile}
    image: FlowUI:latest
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
      FLOW_API_PORT: "8080"
      FLOW_UI_AUTH_MODE: "${FLOW_UI_AUTH_MODE:-ApiBasic}"

volumes:
  flow_sqlserver_data:
```

#### Example: Launch the full stack

```powershell
# PowerShell
docker compose -f docker-compose.full.yml up -d --build
```

Check container status and initialization logs:

```powershell
docker compose -f docker-compose.full.yml ps
docker compose -f docker-compose.full.yml logs -f FlowUI go-flow-api
```

Access the stack:
- **FlowUI Web UI:** `http://localhost:5185` (Login via `ApiBasic` with `admin` / `Admin123!`)
- **go-flowAPI Health:** `http://localhost:8080/api/v1/health`

---

### Scenario 4: Windows Containers (`Dockerfile.windows` & Windows Integrated Auth)

Use `Dockerfile.windows` ([`flowui.Dockerfile.windows`](docker/flowui/flowui.Dockerfile.windows)) and `docker-compose.windows.yml` ([`flowui.docker-compose.windows.yml`](docker/flowui/flowui.docker-compose.windows.yml)) when running on Windows Server or Docker Desktop in **Windows containers** mode with `FLOW_UI_AUTH_MODE=Windows`.

#### `docker-compose.windows.yml` ([`flowui.docker-compose.windows.yml`](docker/flowui/flowui.docker-compose.windows.yml))

```yaml
# =============================================================================
# Combination 4: FlowUI Windows Container (Windows Integrated Authentication)
# Requires Docker Desktop in Windows containers mode or Windows Server host.
#
# Usage:
#   docker compose -f docker-compose.windows.yml up -d --build
# =============================================================================

services:
  FlowUI:
    build:
      context: .
      dockerfile: Dockerfile.windows
    image: FlowUI:windows
    container_name: FlowUI-Windows
    restart: unless-stopped
    ports:
      - "${FLOW_UI_PORT:-5185}:5185"
    environment:
      ASPNETCORE_ENVIRONMENT: "${ASPNETCORE_ENVIRONMENT:-Production}"
      ASPNETCORE_URLS: "http://+:5185"
      FLOW_UI_PORT: "5185"
      FLOW_API_HOST: "${FLOW_API_HOST:-http://host.docker.internal}"
      FLOW_API_PORT: "${FLOW_API_PORT:-5180}"
      FLOW_UI_AUTH_MODE: "Windows"
      FLOW_API_BASIC_AUTH: "${FLOW_API_BASIC_AUTH:-}"
      HOST_USERDOMAIN: "${USERDOMAIN:-DOMAINNAME}"
      HOST_USERNAME: "${USERNAME:-USERNAME}"
```

#### Example: Build and run with Windows Compose

```powershell
# Ensure Docker Desktop is switched to Windows containers mode
docker compose -f docker-compose.windows.yml up -d --build
```

---

## 4. Dockerfiles & SQL Initialization Script Reference

### Linux `Dockerfile` ([`flowui.Dockerfile`](docker/flowui/flowui.Dockerfile))

```dockerfile
# syntax=docker/dockerfile:1
# =============================================================================
# FlowUI - Linux Container Dockerfile (Default)
# Target Framework: .NET 10.0 (ASP.NET Core Interactive Server Blazor)
# Build from repository root:
#   docker build -t FlowUI:latest -f Dockerfile .
# =============================================================================

ARG DOTNET_VERSION=10.0

# Stage 1: Restore & Publish
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

COPY ["FlowUI/FlowUI.csproj", "FlowUI/"]
RUN dotnet restore "FlowUI/FlowUI.csproj"

COPY ["FlowUI/", "FlowUI/"]
WORKDIR "/src/FlowUI"
RUN dotnet publish "FlowUI.csproj" \
    -c ${BUILD_CONFIGURATION} \
    -o /app/publish \
    /p:UseAppHost=false

# Stage 2: Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS final
WORKDIR /app

# Default UI port and API connection settings inside container
ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    FLOW_UI_PORT=5185 \
    ASPNETCORE_URLS=http://+:5185 \
    FLOW_API_HOST=http://host.docker.internal \
    FLOW_API_PORT=8080 \
    FLOW_UI_AUTH_MODE=ApiBasic

EXPOSE 5185

COPY --from=build /app/publish .

USER $APP_UID
ENTRYPOINT ["dotnet", "FlowUI.dll"]
```

### Windows `Dockerfile.windows` ([`flowui.Dockerfile.windows`](docker/flowui/flowui.Dockerfile.windows))

```dockerfile
# escape=`
# =============================================================================
# FlowUI - Windows Container Dockerfile
# Supports Windows Integrated Authentication (SSPI / Active Directory / gMSA)
# and Trusted_Connection=True against SQL Server.
# Build from repository root (requires Docker Desktop in Windows containers mode):
#   docker build -t FlowUI:windows -f Dockerfile.windows .
# =============================================================================

ARG SDK_IMAGE=mcr.microsoft.com/dotnet/sdk:10.0-windowsservercore-ltsc2022
ARG RUNTIME_IMAGE=mcr.microsoft.com/dotnet/aspnet:10.0-windowsservercore-ltsc2022

# Stage 1: Restore & Publish
FROM ${SDK_IMAGE} AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR C:\src

COPY ["FlowUI/FlowUI.csproj", "FlowUI/"]
RUN dotnet restore "FlowUI/FlowUI.csproj"

COPY ["FlowUI/", "FlowUI/"]
WORKDIR C:\src\FlowUI
RUN dotnet publish "FlowUI.csproj" `
    -c %BUILD_CONFIGURATION% `
    -o C:\app\publish `
    /p:UseAppHost=false

# Stage 2: Windows Server Core Runtime (includes SSPI/Kerberos for Windows Auth)
FROM ${RUNTIME_IMAGE} AS final
WORKDIR C:\app

ENV ASPNETCORE_ENVIRONMENT=Production `
    DOTNET_RUNNING_IN_CONTAINER=true `
    FLOW_UI_PORT=5185 `
    ASPNETCORE_URLS=http://+:5185 `
    FLOW_UI_AUTH_MODE=Windows

EXPOSE 5185

COPY --from=build C:\app\publish .

ENTRYPOINT ["dotnet", "FlowUI.dll"]
```

### SQL Server Schema Initialization ([`flowui.sqlserver-init.sql`](docker/flowui/flowui.sqlserver-init.sql))

Used by the `sqlserver-init` service in `docker-compose.full.yml` ([`flowui.docker-compose.full.yml`](docker/flowui/flowui.docker-compose.full.yml)) to create the `EXAMPLE_DB` database and all 7 `dbo.*` tables (`dbo.flow_pipeline_content`, `dbo.flow_options_content`, `dbo.flow_config_content`, `dbo.pipeline_runs`, `dbo.pipeline_events`, `dbo.flow_api_events`, and `dbo.flow_api_users`).

---

## 5. Standalone `docker build` & `docker run` Examples

If you prefer running `docker` directly without Docker Compose:

### Build & Run Linux Container

```powershell
# 1. Build the image
docker build -t FlowUI:latest -f Dockerfile .

# 2. Run the container connected to go-flowAPI
docker run -d --name FlowUI `
  -p 5185:5185 `
  --add-host=host.docker.internal:host-gateway `
  -e FLOW_API_HOST="http://host.docker.internal" `
  -e FLOW_API_PORT="8080" `
  -e FLOW_UI_AUTH_MODE="ApiBasic" `
  FlowUI:latest
```

### Build & Run Linux Container with Explicit `FLOW_API_URL`

```bash
docker run -d --name FlowUI \
  -p 5185:5185 \
  -e FLOW_API_URL="http://10.0.0.25:8080" \
  -e FLOW_UI_AUTH_MODE="ApiBasic" \
  FlowUI:latest
```

---

## 6. Common Operations

### View Live Logs

```powershell
# Default compose
docker compose logs -f FlowUI

# Full stack
docker compose -f docker-compose.full.yml logs -f
```

### Stop & Clean Up Containers

```powershell
# Stop containers (preserves SQL Server data volume)
docker compose -f docker-compose.full.yml down

# Stop containers AND delete the SQL Server persistent volume (full reset)
docker compose -f docker-compose.full.yml down -v
```

---

## Related Documentation

- [**FlowUI Compilation & Build Guide**](FLOW_UI_COMPILATION_AND_BUILD_GUIDE.md)
- [**go-flowAPI Docker & Container Deployment Guide**](API_DOCKER_DEPLOYMENT_GUIDE.md)
- [**go-flowAPI Cross-Platform Compilation & Build Guide**](API_COMPILATION_AND_BUILD_GUIDE.md)
- [**Complete API Endpoints & RBAC Reference**](API_ENDPOINTS_REFERENCE.md)
