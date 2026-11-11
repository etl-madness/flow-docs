---
title: go-flowAPI Active Directory Kerberos Sidecar Guide
description: Run go-flowAPI in Docker with a shared Kerberos ticket cache and Active Directory identity.
---

# `go-flowAPI` — Active Directory Kerberos Sidecar Guide

This guide covers running `go-flowAPI` in a Linux Docker container with an Active Directory Kerberos ticket supplied by a companion `krb5-sidecar`. The API and sidecar share a temporary credential-cache volume; the sidecar can also resolve nested AD groups for API authorization.

> **Run the commands from the root of a `go-flowAPI` checkout.** The Compose file builds the API from that repository and its relative mounts expect its `docker/` directory. The files linked below are reference copies in this handbook, not a standalone API source tree.

## Architecture and requirements

- The sidecar obtains a ticket with `kinit` from a mounted keytab or `AD_PASSWORD`, writes identity and group files, and attempts ticket renewal every four hours.
- The API starts only after the sidecar health check confirms both the identity file and a valid ticket.
- Both containers use `/krb5cache/krb5cc_1000`; the named volume is configured as a 16 MB `tmpfs`, not persistent storage.
- The API's SQL Server connection and pipeline SQL Server connections can use Kerberos when their DSNs explicitly select the `krb5` authenticator.
- The sidecar can query nested AD memberships over LDAP/GSSAPI. Set `AD_GROUPS` as a static group list when LDAP lookup is unavailable.

The containers need network access to the configured KDC on Kerberos port 88. LDAP group lookup additionally needs the domain controller on port 389. SQL Server must be reachable using a hostname with a registered `MSSQLSvc` SPN; use an FQDN rather than an IP address where possible. A Windows host's existing logon ticket is not automatically available inside Linux containers.

## Configure the realm and database

Edit `docker/krb5.conf` in the API checkout for your environment. Replace the example realm, domain, and domain-controller values in `[libdefaults]`, `[realms]`, and `[domain_realm]`. The KDC entry in this file controls Kerberos; setting `AD_DC_HOST` below only changes the LDAP lookup host.

Use the FQDN of the SQL Server registered for the service principal in `FLOW_API_DSN`. For example:

```text
sqlserver://sql01.example.com:1433?database=EXAMPLE_DB&integrated+security=true&authenticator=krb5&trustServerCertificate=true
```

Keep literal `&` query separators in the DSN. If the DSN is overridden in the host environment, it replaces the Compose default, so include `integrated+security=true` and `authenticator=krb5` there too. For SQL aliases, configure the matching `MSSQLSvc` SPN or specify the driver's `ServerSPN` option.

## Start the stack

The source repo's `docker-compose.ad-sidecar.yml` is the runnable Compose file. Supply your domain values and either a password or keytab.

### Password-based quickstart (PowerShell)

```powershell
$env:AD_DOMAIN = "EXAMPLE"
$env:AD_REALM = "EXAMPLE.COM"
$env:AD_USER = "svc_goflow"
$env:AD_PASSWORD = "use-a-secret-from-your-environment"
$env:AD_DC_HOST = "dc.example.com"
$env:AD_LDAP_BASE_DN = "DC=example,DC=com"
$env:FLOW_API_DSN = "sqlserver://sql01.example.com:1433?database=EXAMPLE_DB&integrated+security=true&authenticator=krb5&trustServerCertificate=true"

docker compose -f docker-compose.ad-sidecar.yml up -d --build
```

Do not commit passwords or a populated `.env` file. Environment variables are convenient for a local test, but Docker exposes container environment values to users with Docker access. For unattended deployments, use a protected keytab mount or your platform's secrets facility.

### Keytab authentication

For service accounts, use a keytab provisioned by your AD/Kerberos administrator:

1. Place the protected keytab at `docker/example.keytab` in the API checkout, and ensure it is excluded from source control.
2. Uncomment the keytab bind mount in `docker-compose.ad-sidecar.yml`:

   ```yaml
   - ./docker/example.keytab:/etc/krb5.keytab:ro
   ```

3. Set `AD_USER` to the account name and start the same Compose stack without `AD_PASSWORD`:

   ```powershell
   $env:AD_USER = "svc_goflow"
   docker compose -f docker-compose.ad-sidecar.yml up -d --build
   ```

The principal used by the sidecar is `${AD_USER}@${AD_REALM}`. Ensure the keytab contains that principal and is readable by the sidecar.

## Verify the ticket, identity, and database connection

Check service health and the sidecar logs:

```powershell
docker compose -f docker-compose.ad-sidecar.yml ps
docker compose -f docker-compose.ad-sidecar.yml logs --tail 50 krb5-sidecar
docker exec -it go-flow-krb5-sidecar klist -f
docker exec -it go-flow-api klist -f
```

The ticket cache should show the expected default principal. Inspect the identity and group files shared with the API:

```powershell
docker exec go-flow-api cat /krb5cache/ad-identity.env
docker exec go-flow-api cat /krb5cache/ad-groups.txt
```

Check the API and SQL identity:

```powershell
Invoke-RestMethod http://localhost:5180/api/v1/health |
  Select-Object status, db_user, application_name
```

`status: ok` alone does not confirm database connectivity. Confirm that `db_user` is the expected SQL login; use the authenticated `/api/v1/db/test` endpoint when troubleshooting connection failures.

The sidecar identity (`FLOW_WINDOWS_USER`) and groups (`FLOW_WINDOWS_GROUPS_FILE`) determine the Windows/AD identity used for API authorization; they do not themselves authenticate SQL Server. To authorize an AD user or group, register its `DOMAIN\name` in `dbo.flow_api_users` with an active permission row and `password_hash` set to `__WINDOWS_INTEGRATED__`. API clients can then use the Windows-integrated auth flow documented in the [API endpoints reference](API_ENDPOINTS_REFERENCE.md).

## Troubleshooting

| Symptom | Check |
| :--- | :--- |
| Sidecar is unhealthy and API does not start | Review sidecar logs; verify the user/realm, keytab or password, KDC DNS, `krb5.conf`, and TCP/UDP port 88. An identity file or group list is not a substitute for a valid ticket. |
| Ticket exists but no AD groups appear | Check `AD_DC_HOST`, `AD_LDAP_BASE_DN`, LDAP reachability on port 389, and GSSAPI lookup logs. If LDAP is unavailable, supply a comma-separated `AD_GROUPS` list. |
| SQL login is empty or API database check fails | Verify the effective `FLOW_API_DSN`, literal `&` separators, `authenticator=krb5`, SQL Server reachability, and the server's `MSSQLSvc` SPN. Check errors from `/api/v1/db/test`. |
| KDC connection times out | Check container DNS and the KDC configured in `krb5.conf`. `AD_DC_HOST` is only for LDAP; it does not configure the KDC. |

Stop the stack with `docker compose -f docker-compose.ad-sidecar.yml down`. The credential cache is in-memory and is removed with the containers/volume; the separate `flow_api_data` volume is retained unless explicitly removed.

## Reference files

These are source-aligned copies from the API repository:

- [API Docker deployment guide](API_DOCKER_DEPLOYMENT_GUIDE.md)
- [Sidecar Compose file](docker/api/api.docker-compose.ad-sidecar.yml)
- [Kerberos config template](docker/api/api.krb5.conf)
- [Sidecar entrypoint script](docker/api/api.krb5-sidecar-entrypoint.sh)
