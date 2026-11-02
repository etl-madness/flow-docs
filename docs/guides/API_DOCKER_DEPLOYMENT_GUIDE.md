---
title: go-flowAPI Docker & Container Deployment Guide
description: Detailed Docker, BuildKit, and Docker Compose deployment instructions for go-flowAPI across SQLite, PostgreSQL, SQL Server, and External Databases
---

# `go-flowAPI` — Detailed Docker & Container Deployment Guide

> **Production & Quickstart Container Guide for `go-flowAPI`**  
> **Container Image:** `go-flow-api:latest` (Multi-stage `golang:1.26-alpine` → `alpine:3.21`)  
> **Default Container Port:** `5180` | **Volume Mount:** `/data`

This guide covers building and deploying **`go-flowAPI`** in Docker using **Docker Compose** (four ready-to-run stacks) or standalone **`docker build` / `docker run`** commands, including multi-architecture builds (`linux/amd64` and `linux/arm64`), automated schema initialization, and host database connectivity.

---

## Table of Contents

- [`go-flowAPI` — Detailed Docker \& Container Deployment Guide](#go-flowapi-detailed-docker-container-deployment-guide)
  - [Table of Contents](#table-of-contents)
  - [1. Multi-Stage Docker Build Architecture](#1-multi-stage-docker-build-architecture)
  - [2. Included Docker \& Initialization Files](#2-included-docker--initialization-files)
    - [`Dockerfile` (`api.Dockerfile`)](#dockerfile-apidockerfile)
    - [Entrypoint Script (`api.docker-entrypoint.sh`)](#entrypoint-script-apidocker-entrypointsh)
  - [3. Overview of the 4 Docker Compose Stacks](#3-overview-of-the-4-docker-compose-stacks)
  - [4. Stack 1: SQLite with Persistent Volume (`docker-compose.sqlite.yml`)](#4-stack-1-sqlite-with-persistent-volume-docker-composesqliteyml)
    - [`docker-compose.sqlite.yml` (`api.docker-compose.sqlite.yml`)](#docker-composesqliteyml-apidocker-composesqliteyml)
    - [Usage](#usage)
  - [5. Stack 2: PostgreSQL 16 Container (`docker-compose.postgres.yml`)](#5-stack-2-postgresql-16-container-docker-composepostgresyml)
    - [`docker-compose.postgres.yml` (`api.docker-compose.postgres.yml`)](#docker-composepostgresyml-apidocker-composepostgresyml)
    - [Usage](#usage_1)
  - [6. Stack 3: SQL Server 2022 Container (`docker-compose.sqlserver.yml`)](#6-stack-3-sql-server-2022-container-docker-composesqlserveryml)
    - [`docker-compose.sqlserver.yml` (`api.docker-compose.sqlserver.yml`)](#docker-composesqlserveryml-apidocker-composesqlserveryml)
    - [Usage](#usage_2)
  - [7. Stack 4: Existing or Host Database (`docker-compose.yml`)](#7-stack-4-existing-or-host-database-docker-composeyml)
    - [`docker-compose.yml` (`api.docker-compose.yml`)](#docker-composeyml-apidocker-composeyml)
    - [PowerShell (Windows)](#powershell-windows)
    - [Bash / Zsh (Linux / macOS / FreeBSD)](#bash-zsh-linux-macos-freebsd)
  - [8. Connecting from a Linux Container to a Windows Host SQL Server](#8-connecting-from-a-linux-container-to-a-windows-host-sql-server)
    - [Checklist for Windows Host SQL Server Connectivity:](#checklist-for-windows-host-sql-server-connectivity)
  - [9. Standalone `docker build`, `docker buildx` \& `docker run`](#9-standalone-docker-build-docker-buildx--docker-run)
    - [9.1 Build a Single-Architecture Image](#91-build-a-single-architecture-image)
    - [9.2 Build a Multi-Architecture Image (`linux/amd64` + `linux/arm64`)](#92-build-a-multi-architecture-image-linuxamd64-linuxarm64)
    - [9.3 Run the Container with `docker run`](#93-run-the-container-with-docker-run)
      - [A. Against an External / Host SQL Server](#a-against-an-external-host-sql-server)
      - [B. Self-Contained SQLite Mode with Persistent Volume](#b-self-contained-sqlite-mode-with-persistent-volume)
  - [10. Environment Variables \& `.env` Reference](#10-environment-variables--env-reference)
  - [11. Verifying \& Troubleshooting Your Container Deployment](#11-verifying--troubleshooting-your-container-deployment)
    - [1. Public Health Check (No BasicAuth Required)](#1-public-health-check-no-basicauth-required)
    - [2. Authenticated Health Check (Confirms User \& Permission Scope)](#2-authenticated-health-check-confirms-user-permission-scope)
    - [3. Interactive Swagger UI](#3-interactive-swagger-ui)
    - [4. Inspect Container Logs \& Health](#4-inspect-container-logs-health)
  - [Related Documentation](#related-documentation)

---

<a id="1-multi-stage-docker-build-architecture"></a>

## 1. Multi-Stage Docker Build Architecture

Because `go.mod` in `go-flowAPI` references `../go-flow` via a `replace` directive, the Dockerfile uses **Docker BuildKit Named Build Contexts** (`FROM scratch AS go-flow`) so the `builder` stage can compile a 100% static Linux binary (`CGO_ENABLED=0`) without copying anything outside the allowed contexts. Once compiled, the final `alpine:3.21` runtime image is completely self-contained.

```mermaid
flowchart LR
    subgraph Contexts["Build-Time Contexts (Docker BuildKit)"]
        CTX_MAIN["Primary Context (.)<br/>go-flowAPI/ source &amp;<br/> docker/ scripts"]
        CTX_GFLOW["Named Context (go-flow)<br/>../go-flow source <br/>(additional_contexts)"]
    end

    subgraph Stage1["Stage 1: Builder (golang:1.26-alpine)"]
        MOD["COPY go.mod &amp; ../go-flow<br/>go mod download"]
        BUILD["CGO_ENABLED=0 <br/>GOOS=linux<br/>go build <br/>-trimpath -ldflags='-s -w'<br/>/out/go-flowAPI"]
        MOD --> BUILD
    end

    subgraph Stage2["Stage 2: Runtime (alpine:3.21)"]
        BIN["/app/go-flowAPI<br/>(Static Executable)"]
        INIT["/app/docker/init/*.sql<br/>(SQLite, Postgres,<br/> SQL Server DDLs)"]
        ENTRY["/usr/local/bin/docker-entrypoint.sh<br/>(Auto-init SQLite +<br/> exec go-flowAPI)"]
        VOL[("Volume: /data<br/>Port: 5180")]
    end

    CTX_MAIN & CTX_GFLOW --> MOD
    BUILD --> BIN
    CTX_MAIN --> INIT & ENTRY
    ENTRY --> BIN
    BIN --> VOL
```

---

<a id="2-included-docker--initialization-files"></a>

## 2. Included Docker & Initialization Files

All `go-flowAPI` Docker, Docker Compose, entrypoint, and SQL initialization files are stored with a unique `api.*` prefix under `docs/guides/docker/api/` so they remain completely distinct from the `FlowUI` container files (`docs/guides/docker/flowui/flowui.*` in the [FlowUI Docker & Docker Compose Guide](FLOW_UI_DOCKER_DEPLOYMENT_GUIDE.md)).

| Repository File (`go-flowAPI/`) | Unique Reference File in `flow-docs` | Role & Description |
| :--- | :--- | :--- |
| `Dockerfile` | [`api.Dockerfile`](docker/api/api.Dockerfile) | Multi-stage Alpine build (`golang:1.26-alpine` → `alpine:3.21`) exposing port `5180` and `/data` volume. |
| `docker-compose.yml` | [`api.docker-compose.yml`](docker/api/api.docker-compose.yml) | Connects `go-flowAPI` to an external or host database via `FLOW_API_DSN` (`host.docker.internal`). |
| `docker-compose.sqlite.yml` | [`api.docker-compose.sqlite.yml`](docker/api/api.docker-compose.sqlite.yml) | Single-container deployment with a persistent SQLite volume (`/data/flow_api.db`) and auto-schema provisioning. |
| `docker-compose.postgres.yml` | [`api.docker-compose.postgres.yml`](docker/api/api.docker-compose.postgres.yml) | Multi-container stack: `postgres:16-alpine` + automated `dbo.*` schema init + `go-flowAPI`. |
| `docker-compose.sqlserver.yml` | [`api.docker-compose.sqlserver.yml`](docker/api/api.docker-compose.sqlserver.yml) | Multi-container stack: `mssql/server:2022-latest` + one-shot `sqlserver-init` schema runner + `go-flowAPI`. |
| `docker/docker-entrypoint.sh` | [`api.docker-entrypoint.sh`](docker/api/api.docker-entrypoint.sh) | Entrypoint script that normalizes SQLite DSN paths, automatically creates tables via `sqlite3`, and starts `go-flowAPI`. |
| `docker/init/sqlite-init.sql` | [`api.sqlite-init.sql`](docker/api/api.sqlite-init.sql) | Idempotent SQLite DDL script for all 7 `go-flowAPI` tables (`CREATE TABLE IF NOT EXISTS`). |
| `docker/init/postgres-init.sql` | [`api.postgres-init.sql`](docker/api/api.postgres-init.sql) | PostgreSQL initialization script creating the `dbo` schema and all 7 metadata/telemetry tables. |
| `docker/init/sqlserver-init.sql` | [`api.sqlserver-init.sql`](docker/api/api.sqlserver-init.sql) | SQL Server initialization script creating the target database and all 7 `dbo.*` tables. |

### `Dockerfile` ([`api.Dockerfile`](docker/api/api.Dockerfile))

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Build go-flowAPI binary
FROM golang:1.26-alpine AS builder

ENV GOTOOLCHAIN=auto
RUN apk add --no-cache git ca-certificates

WORKDIR /src/go-flowAPI
COPY go.mod go.sum ./
RUN go mod download

# Copy go-flowAPI source and compile static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/go-flowAPI .

# Stage 2: Minimal runtime image
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata sqlite wget \
    && mkdir -p /app /data

WORKDIR /app

COPY --from=builder /out/go-flowAPI /app/go-flowAPI
COPY docker/init/ /app/docker/init/
COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Normalize line endings in case of Windows CRLF checkout and make executable
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh /app/go-flowAPI

ENV PORT=5180 \
    FLOW_API_ADDR=:5180

EXPOSE 5180
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
```

### Entrypoint Script ([`api.docker-entrypoint.sh`](docker/api/api.docker-entrypoint.sh))

```sh
#!/bin/sh
set -e

# Automatically provision SQLite schema if FLOW_API_DSN targets a SQLite database
if [ -n "$FLOW_API_DSN" ] && [ -f "/app/docker/init/sqlite-init.sql" ]; then
    DB_PATH=""
    case "$FLOW_API_DSN" in
        sqlite://*)
            DB_PATH="${FLOW_API_DSN#sqlite://}"
            ;;
        sqlite3://*)
            DB_PATH="${FLOW_API_DSN#sqlite3://}"
            ;;
        sql://sqlite@*)
            DB_PATH="${FLOW_API_DSN#sql://sqlite@}"
            ;;
        db://sqlite@*)
            DB_PATH="${FLOW_API_DSN#db://sqlite@}"
            ;;
        *.db|*.sqlite|*.sqlite3)
            DB_PATH="$FLOW_API_DSN"
            ;;
    esac

    if [ -n "$DB_PATH" ] && [ "$DB_PATH" != ":memory:" ]; then
        mkdir -p "$(dirname "$DB_PATH")"
        echo "[entrypoint] Ensuring SQLite schema is initialized in $DB_PATH..."
        sqlite3 "$DB_PATH" < /app/docker/init/sqlite-init.sql
    fi
fi

exec /app/go-flowAPI "$@"
```

---

## 3. Overview of the 4 Docker Compose Stacks

```mermaid
flowchart TD
    subgraph Stack1["Option 1: docker-compose.sqlite.yml"]
        S1_API["go-flow-api-sqlite (:5180)"] --> S1_VOL[("Docker Volume: <br/>sqlite_data<br/>/data/flow_api.db")]
    end

    subgraph Stack2["Option 2: docker-compose.postgres.yml"]
        S2_API["go-flow-api-postgres (:5180)<br/>"] -->|"postgres://flow:flowpass@postgres:5432<br/>/flowdb<br/>"| S2_PG["go-flow-postgres (:5432)<br/>postgres:16-alpine<br/>"]
        S2_PG --> S2_VOL[("Docker Volume: <br/>postgres_data")]
    end

    subgraph Stack3["Option 3: docker-compose.sqlserver.yml"]
        S3_INIT["go-flow-sqlserver-init<br/>(Runs sqlserver-init.sql)<br/>"] -->|"sqlcmd DDL init <br/>"| S3_MS["go-flow-sqlserver (:1433)<br/>mssql/server:2022-latest"]
        S3_API["go-flow-api-sqlserver (:5180)"] -->|"Depends on sqlserver-init"| S3_MS
        S3_MS --> S3_VOL[("Docker Volume: sqlserver_data")]
    end

    subgraph Stack4["Option 4: docker-compose.yml (External / Host DB)"]
        S4_API["go-flow-api (:5180)"] -->|"FLOW_API_DSN<br/>(host.docker.internal)"| S4_EXT[("Existing Host or Network DB<br/>SQL Server <br/>/ Postgres / MySQL / Oracle")]
    end
```

---

## 4. Stack 1: SQLite with Persistent Volume (`docker-compose.sqlite.yml`)

Ideal for rapid local evaluation, edge deployments, or single-node runners with zero external database dependencies. On container startup, `docker-entrypoint.sh` ([`api.docker-entrypoint.sh`](docker/api/api.docker-entrypoint.sh)) detects the `sqlite://` DSN, executes `/app/docker/init/sqlite-init.sql` ([`api.sqlite-init.sql`](docker/api/api.sqlite-init.sql)) against `/data/flow_api.db`, and seeds the bootstrap admin account.

### `docker-compose.sqlite.yml` ([`api.docker-compose.sqlite.yml`](docker/api/api.docker-compose.sqlite.yml))

```yaml
# Docker Compose with SQLite persistent volume + automated schema provisioning
# Usage:
#   docker compose -f docker-compose.sqlite.yml up -d --build

services:
  go-flow-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: go-flow-api:latest
    container_name: go-flow-api-sqlite
    restart: unless-stopped
    ports:
      - "${FLOW_API_HOST_PORT:-5180}:5180"
    environment:
      FLOW_API_ADDR: ":5180"
      FLOW_API_DSN: "${FLOW_API_DSN:-sqlite:///data/flow_api.db}"
      FLOW_API_BOOTSTRAP_USER: "${FLOW_API_BOOTSTRAP_USER:-admin}"
      FLOW_API_BOOTSTRAP_PASS: "${FLOW_API_BOOTSTRAP_PASS:-Admin123!}"
      FLOW_API_BOOTSTRAP_PERM: "${FLOW_API_BOOTSTRAP_PERM:-all}"
      FLOW_SECURE_KEY: "${FLOW_SECURE_KEY:-}"
      FLOW_API_DEBUG: "${FLOW_API_DEBUG:-false}"
    volumes:
      - sqlite_data:/data

volumes:
  sqlite_data:
```

### Usage

```bash
# Build and launch in detached mode
docker compose -f docker-compose.sqlite.yml up -d --build

# View startup logs
docker compose -f docker-compose.sqlite.yml logs -f

# Stop container (preserve SQLite data volume)
docker compose -f docker-compose.sqlite.yml down

# Stop container and wipe SQLite volume
docker compose -f docker-compose.sqlite.yml down -v
```

- **API Endpoint**: `http://localhost:5180`
- **Swagger UI**: `http://localhost:5180/swagger/`
- **Default Credentials**: `admin` / `Admin123!` (`permission = "all"`)

---

## 5. Stack 2: PostgreSQL 16 Container (`docker-compose.postgres.yml`)

Provisions a dedicated `postgres:16-alpine` instance, mounts `docker/init/postgres-init.sql` ([`api.postgres-init.sql`](docker/api/api.postgres-init.sql)) into `/docker-entrypoint-initdb.d/`, waits for the `pg_isready` healthcheck to pass, and starts `go-flowAPI`.

### `docker-compose.postgres.yml` ([`api.docker-compose.postgres.yml`](docker/api/api.docker-compose.postgres.yml))

```yaml
# Docker Compose with PostgreSQL 16 + automated schema provisioning
# Usage:
#   docker compose -f docker-compose.postgres.yml up -d --build

services:
  postgres:
    image: postgres:16-alpine
    container_name: go-flow-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: "${POSTGRES_USER:-flow}"
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-flowpass}"
      POSTGRES_DB: "${POSTGRES_DB:-flowdb}"
    ports:
      - "${POSTGRES_HOST_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init/postgres-init.sql:/docker-entrypoint-initdb.d/01-postgres-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-flow} -d $${POSTGRES_DB:-flowdb}"]
      interval: 5s
      timeout: 5s
      retries: 15

  go-flow-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: go-flow-api:latest
    container_name: go-flow-api-postgres
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "${FLOW_API_HOST_PORT:-5180}:5180"
    environment:
      FLOW_API_ADDR: ":5180"
      FLOW_API_DSN: "postgres://${POSTGRES_USER:-flow}:${POSTGRES_PASSWORD:-flowpass}@postgres:5432/${POSTGRES_DB:-flowdb}?sslmode=disable"
      FLOW_API_BOOTSTRAP_USER: "${FLOW_API_BOOTSTRAP_USER:-admin}"
      FLOW_API_BOOTSTRAP_PASS: "${FLOW_API_BOOTSTRAP_PASS:-Admin123!}"
      FLOW_API_BOOTSTRAP_PERM: "${FLOW_API_BOOTSTRAP_PERM:-all}"
      FLOW_SECURE_KEY: "${FLOW_SECURE_KEY:-}"
      FLOW_API_DEBUG: "${FLOW_API_DEBUG:-false}"

volumes:
  postgres_data:
```

### Usage

```bash
# Start PostgreSQL 16 + go-flowAPI
docker compose -f docker-compose.postgres.yml up -d --build

# Follow go-flowAPI container logs
docker compose -f docker-compose.postgres.yml logs -f go-flow-api

# Stop stack (add -v to remove postgres_data volume)
docker compose -f docker-compose.postgres.yml down
```

- **API Endpoint**: `http://localhost:5180`
- **PostgreSQL Host Port**: `localhost:5432` (`user=flow`, `password=flowpass`, `dbname=flowdb`)
- **Default Credentials**: `admin` / `Admin123!`

---

## 6. Stack 3: SQL Server 2022 Container (`docker-compose.sqlserver.yml`)

Starts Microsoft SQL Server 2022 (`mcr.microsoft.com/mssql/server:2022-latest`), waits for the `sqlcmd` healthcheck to succeed, executes a one-shot `sqlserver-init` container with `docker/init/sqlserver-init.sql` ([`api.sqlserver-init.sql`](docker/api/api.sqlserver-init.sql)) to create the database and all 7 `dbo.*` tables, and then launches `go-flowAPI`.

### `docker-compose.sqlserver.yml` ([`api.docker-compose.sqlserver.yml`](docker/api/api.docker-compose.sqlserver.yml))

```yaml
# Docker Compose with Microsoft SQL Server 2022 + automated schema provisioning
# Usage:
#   docker compose -f docker-compose.sqlserver.yml up -d --build

services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: go-flow-sqlserver
    restart: unless-stopped
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "${MSSQL_SA_PASSWORD:-YourStrong!Passw0rd}"
      MSSQL_PID: "Developer"
    ports:
      - "${MSSQL_HOST_PORT:-1433}:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"$$MSSQL_SA_PASSWORD\" -C -Q \"SELECT 1\" || /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P \"$$MSSQL_SA_PASSWORD\" -Q \"SELECT 1\""
        ]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 15s

  sqlserver-init:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: go-flow-sqlserver-init
    depends_on:
      sqlserver:
        condition: service_healthy
    environment:
      MSSQL_SA_PASSWORD: "${MSSQL_SA_PASSWORD:-YourStrong!Passw0rd}"
    volumes:
      - ./docker/init/sqlserver-init.sql:/init/sqlserver-init.sql:ro
    entrypoint:
      - /bin/bash
      - -c
      - |
        echo "[sqlserver-init] Provisioning EXAMPLE_DB database and go-flowAPI tables..."
        if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
          /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "$$MSSQL_SA_PASSWORD" -C -i /init/sqlserver-init.sql
        else
          /opt/mssql-tools/bin/sqlcmd -S sqlserver -U sa -P "$$MSSQL_SA_PASSWORD" -i /init/sqlserver-init.sql
        fi
        echo "[sqlserver-init] Schema initialization complete."
    restart: "no"

  go-flow-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: go-flow-api:latest
    container_name: go-flow-api-sqlserver
    restart: unless-stopped
    depends_on:
      sqlserver-init:
        condition: service_completed_successfully
    ports:
      - "${FLOW_API_HOST_PORT:-5180}:5180"
    environment:
      FLOW_API_ADDR: ":5180"
      FLOW_API_DSN: "sqlserver://sa:${MSSQL_SA_PASSWORD:-YourStrong!Passw0rd}@sqlserver:1433?database=EXAMPLE_DB&trustServerCertificate=true"
      FLOW_API_BOOTSTRAP_USER: "${FLOW_API_BOOTSTRAP_USER:-admin}"
      FLOW_API_BOOTSTRAP_PASS: "${FLOW_API_BOOTSTRAP_PASS:-Admin123!}"
      FLOW_API_BOOTSTRAP_PERM: "${FLOW_API_BOOTSTRAP_PERM:-all}"
      FLOW_SECURE_KEY: "${FLOW_SECURE_KEY:-}"
      FLOW_API_DEBUG: "${FLOW_API_DEBUG:-false}"

volumes:
  sqlserver_data:
```

### Usage

```bash
# Start SQL Server 2022 + schema initializer + go-flowAPI
docker compose -f docker-compose.sqlserver.yml up -d --build

# Follow logs across all 3 services
docker compose -f docker-compose.sqlserver.yml logs -f

# Stop stack (add -v to remove sqlserver_data volume)
docker compose -f docker-compose.sqlserver.yml down
```

- **API Endpoint**: `http://localhost:5180`
- **SQL Server Host Port**: `localhost:1433` (`user=sa`, `password=YourStrong!Passw0rd`)
- **Default Credentials**: `admin` / `Admin123!`

---

## 7. Stack 4: Existing or Host Database (`docker-compose.yml`)

Use the repository's `docker-compose.yml` ([`api.docker-compose.yml`](docker/api/api.docker-compose.yml)) file when connecting to an existing enterprise database (SQL Server, Azure SQL, PostgreSQL, MySQL/MariaDB, or Oracle) where the schema has already been created.

### `docker-compose.yml` ([`api.docker-compose.yml`](docker/api/api.docker-compose.yml))

```yaml
# Default Docker Compose: connects go-flowAPI to an existing/host database via FLOW_API_DSN
# Usage:
#   docker compose up -d --build
#   FLOW_API_DSN="sqlserver://sa:Pass@dbserver.example.com:1433?database=EXAMPLE_DB&trustServerCertificate=true" docker compose up -d --build

services:
  go-flow-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: go-flow-api:latest
    container_name: go-flow-api
    restart: unless-stopped
    ports:
      - "${FLOW_API_HOST_PORT:-5180}:5180"
    environment:
      FLOW_API_ADDR: ":5180"
      FLOW_API_DSN: "${FLOW_API_DSN:-sqlserver://sa:YourStrong!Passw0rd@dbserver.example.com:1433?database=EXAMPLE_DB&trustServerCertificate=true}"
      HOST_USERDOMAIN: "${USERDOMAIN:-}"
      HOST_USERNAME: "${USERNAME:-}"
      # Optional: leave empty when dbo.flow_api_users is already provisioned
      #FLOW_API_BOOTSTRAP_USER: "${FLOW_API_BOOTSTRAP_USER:-}"
      #FLOW_API_BOOTSTRAP_PASS: "${FLOW_API_BOOTSTRAP_PASS:-}"
      #FLOW_API_BOOTSTRAP_PERM: "${FLOW_API_BOOTSTRAP_PERM:-}"
      #FLOW_SECURE_KEY: "${FLOW_SECURE_KEY:-}"
      #FLOW_API_DEBUG: "${FLOW_API_DEBUG:-false}"
    extra_hosts:
      - "host.docker.internal:host-gateway"
      - "dbserver.example.com:host-gateway"
      - "DBSERVER.EXAMPLE.COM:host-gateway"
    volumes:
      - flow_api_data:/data

volumes:
  flow_api_data:
```

### PowerShell (Windows)
```powershell
$env:FLOW_API_DSN = "sqlserver://flow_api:YourStrong!Passw0rd@host.docker.internal:1433?database=PROTO&trustServerCertificate=true&app+name=goflow-api-connector"

docker compose up -d --build
```

### Bash / Zsh (Linux / macOS / FreeBSD)
```bash
FLOW_API_DSN="sqlserver://flow_api:YourStrong!Passw0rd@host.docker.internal:1433?database=PROTO&trustServerCertificate=true&app+name=goflow-api-connector" \
docker compose up -d --build
```

> [!NOTE]
> When `dbo.flow_api_users` is already populated in your database, `FLOW_API_BOOTSTRAP_USER`, `FLOW_API_BOOTSTRAP_PASS`, and `FLOW_API_BOOTSTRAP_PERM` are optional and can be omitted.

---

## 8. Connecting from a Linux Container to a Windows Host SQL Server

When running `go-flowAPI.exe` natively on Windows, a connection string without credentials (e.g., `sqlserver://T15P:1433?database=PROTO&trustServerCertificate=true`) uses **Windows Integrated Authentication (SSPI)**. Inside a Linux Docker container, connections cross the container network boundary to the Windows host:

```mermaid
flowchart LR
    subgraph Container["Linux Docker Container (go-flow-api)"]
        APP["/app/go-flowAPI<br/>Pure-Go go-mssqldb driver"]
    end

    subgraph Bridge["Docker Host Gateway"]
        DNS["host.docker.internal<br/>(extra_hosts -> host-gateway)"]
    end

    subgraph WinHost["Windows Host Machine"]
        FW["Windows Firewall<br/>Inbound TCP Port 1433"]
        MSSQL["SQL Server Instance<br/>Mixed Mode Auth + TCP/IP Enabled"]
    end

    APP -->|"sqlserver://flow_api:Pass@host.docker.internal:1433"| DNS
    DNS --> FW --> MSSQL
```

### Checklist for Windows Host SQL Server Connectivity:
1. **Use SQL Server Authentication (`username:password@`)**:
   Ensure SQL Server is configured for **SQL Server and Windows Authentication mode (Mixed Mode)** and supply explicit credentials in `FLOW_API_DSN`:
   ```sql
   USE [master];
   CREATE LOGIN [flow_api] WITH PASSWORD = N'YourStrong!Passw0rd', CHECK_POLICY = OFF;
   GO
   USE [PROTO];
   CREATE USER [flow_api] FOR LOGIN [flow_api];
   ALTER ROLE [db_datareader] ADD MEMBER [flow_api];
   ALTER ROLE [db_datawriter] ADD MEMBER [flow_api];
   GO
   ```
2. **Use `host.docker.internal` (or `extra_hosts`)**:
   Inside the container, `localhost` refers to the container itself. Use `host.docker.internal` to reach the host machine. If your pipelines stored in the database reference your Windows host's machine name (e.g., `T15P`), map that hostname under `extra_hosts` in `docker-compose.yml`:
   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
     - "T15P:host-gateway"
   ```
3. **Enable TCP/IP on Port `1433`**:
   In **SQL Server Configuration Manager** → **SQL Server Network Configuration** → **Protocols for MSSQLSERVER**, ensure **TCP/IP** is **Enabled** on port `1433`.

---

<a id="9-standalone-docker-build-docker-buildx--docker-run"></a>

## 9. Standalone `docker build`, `docker buildx` & `docker run`

If you prefer using the `docker` CLI directly without Docker Compose, pass `--build-context go-flow=../go-flow` so Docker BuildKit resolves the sibling `../go-flow` module during compilation.

### 9.1 Build a Single-Architecture Image
```bash
docker build \
  --build-context go-flow=../go-flow \
  -t go-flow-api:latest .
```

### 9.2 Build a Multi-Architecture Image (`linux/amd64` + `linux/arm64`)
```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-context go-flow=../go-flow \
  -t myregistry.example.com/etl-madness/go-flow-api:latest \
  --push .
```

### 9.3 Run the Container with `docker run`

#### A. Against an External / Host SQL Server
```bash
docker run -d \
  --name go-flow-api \
  --restart unless-stopped \
  -p 5180:5180 \
  --add-host=host.docker.internal:host-gateway \
  -e FLOW_API_DSN="sqlserver://flow_api:YourStrong!Passw0rd@host.docker.internal:1433?database=PROTO&trustServerCertificate=true" \
  go-flow-api:latest
```

#### B. Self-Contained SQLite Mode with Persistent Volume
```bash
docker run -d \
  --name go-flow-api-sqlite \
  --restart unless-stopped \
  -p 5180:5180 \
  -e FLOW_API_DSN="sqlite:///data/flow_api.db" \
  -e FLOW_API_BOOTSTRAP_USER="admin" \
  -e FLOW_API_BOOTSTRAP_PASS="Admin123!" \
  -e FLOW_API_BOOTSTRAP_PERM="all" \
  -v flow_api_sqlite:/data \
  go-flow-api:latest
```

---

<a id="10-environment-variables--env-reference"></a>

## 10. Environment Variables & `.env` Reference

All Docker and Docker Compose deployments can be configured via environment variables or a `.env` file in the `go-flowAPI` directory:

| Environment Variable | CLI Flag Equivalent | Default in Container | Description |
| :--- | :--- | :--- | :--- |
| `FLOW_API_DSN` | `-dsn` | `StartupConnectionString` | Primary database connection string (`sqlserver://`, `postgres://`, `mysql://`, `sqlite://`, `oracle://`). |
| `FLOW_API_ADDR` | `-addr` | `:5180` | HTTP listen address inside the container. |
| `PORT` | `-addr` | `5180` | Fallback port if `FLOW_API_ADDR` is not set. |
| `FLOW_API_HOST_PORT` | *(Docker Compose)* | `5180` | Host port mapped to container port `5180`. |
| `FLOW_API_BOOTSTRAP_USER` | `-bootstrap-user` | `""` (`admin` in quickstarts) | Optional initial BasicAuth username to seed/upsert at startup. |
| `FLOW_API_BOOTSTRAP_PASS` | `-bootstrap-pass` | `""` (`Admin123!` in quickstarts) | Password for `FLOW_API_BOOTSTRAP_USER` (automatically bcrypt-hashed). |
| `FLOW_API_BOOTSTRAP_PERM` | `-bootstrap-perm` | `all` | Permission scope for bootstrap user (`all`, `execution-only`, `read-only`, `write`, `upload`). |
| `FLOW_SECURE_KEY` | `-secure-key` | `""` | Default AES-256-GCM passphrase for encrypting/decrypting artifacts (`FLOWENC:v1:`). |
| `FLOW_API_DEBUG` | `-debug` | `false` | Enables verbose debug logging (`true` or `1`). |
| `HOST_USERDOMAIN` | — | `""` | Optional Windows domain passed from host for Windows group/user identity fallback. |
| `HOST_USERNAME` | — | `""` | Optional Windows username passed from host. |

---

<a id="11-verifying--troubleshooting-your-container-deployment"></a>

## 11. Verifying & Troubleshooting Your Container Deployment

### 1. Public Health Check (No BasicAuth Required)
```bash
curl http://localhost:5180/api/v1/health
```

### 2. Authenticated Health Check (Confirms User & Permission Scope)
```bash
curl -u admin:Admin123! http://localhost:5180/api/v1/health
```

### 3. Interactive Swagger UI
Open **`http://localhost:5180/swagger/`** (or `http://localhost:5180/docs`) in your browser and click **Authorize** to test any endpoint interactively.

### 4. Inspect Container Logs & Health
```bash
docker ps --filter "name=go-flow"
docker logs --tail 100 -f go-flow-api
```

---

## Related Documentation

- [**`go-flowAPI` Documentation Hub**](../index.md)
- [**Cross-Platform Compilation & Build Guide**](API_COMPILATION_AND_BUILD_GUIDE.md)
- [**Complete API Endpoints & RBAC Reference**](API_ENDPOINTS_REFERENCE.md)
- [**FlowUI Docker & Docker Compose Guide**](FLOW_UI_DOCKER_DEPLOYMENT_GUIDE.md)
- [**FlowUI Compilation & Build Guide**](FLOW_UI_COMPILATION_AND_BUILD_GUIDE.md)
