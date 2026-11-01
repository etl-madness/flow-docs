@echo off
setlocal

set "COMPOSE_FILE=docker-compose.yml"

where docker >nul 2>nul
if errorlevel 1 (
    echo Docker is required but was not found in PATH.
    exit /b 1
)

docker compose build --pull
if errorlevel 1 exit /b %errorlevel%

docker compose up --detach
if errorlevel 1 exit /b %errorlevel%

echo.
echo Flow Docs is available at http://127.0.0.1:8085
exit /b 0
