# `crypto_tool` — Standalone Cryptographic & Digital Signature CLI Reference

`crypto_tool` (`crypto_tool.exe` on Windows, `./crypto_tool` on Linux/macOS/FreeBSD) is the standalone companion cryptographic utility in the `go-flow` ecosystem. Built entirely in pure Go (`pkg/flowcrypto`) with **zero external runtime or C/OS dependencies**, it provides symmetric key generation, asymmetric keypair and X.509 certificate generation, AES-256-GCM authenticated encryption/decryption, and multi-standard digital signing and verification (OpenSSL/PEM, PKCS#7/CMS, and OpenPGP/GPG).

---

## 1. Where `crypto_tool` Fits in the Flow Ecosystem

`crypto_tool` prepares and verifies cryptographic artifacts offline or in CI/CD pipelines before they are stored in SQL databases (via [`db_importer`](db_import.md)) or executed by the [`flow`](flow_executable.md) engine:

```mermaid
flowchart LR
    subgraph Authoring["1. Authoring & Key Provisioning"]
        XML["Plaintext XML<br/>(pipeline.xml, options.xml, config.xml)"]
        KEYGEN["<b>crypto_tool</b><br/>-gen-key / -action gen-keypair<br/>(AES-256, RSA, ECDSA, Ed25519, PGP, X.509)"]
    end

    subgraph Crypto["2. Offline Signing & Encryption (crypto_tool)"]
        SIGN["<b>crypto_tool -action sign</b><br/>OpenSSL (.sig), PKCS#7 (.p7s),<br/>OpenPGP (.asc), or Unified (-wrap)"]
        ENC["<b>crypto_tool -action encrypt</b><br/>AES-256-GCM + PBKDF2-HMAC-SHA256<br/>(FLOWENC:v1: Armored Envelope)"]
        VER["<b>crypto_tool -action verify / decrypt</b><br/>Offline CI/CD & Audit Inspection"]
    end

    subgraph Storage["3. Storage & Runtime Execution"]
        DBI["<b>db_importer</b><br/>Upserts into dbo.flow_*_content"]
        FLOW["<b>flow / go-flowAPI</b><br/>Stage 1: Verify Signature<br/>Stage 2: Decrypt AES-256-GCM<br/>Stage 3: Parse & Execute"]
    end

    XML --> SIGN
    KEYGEN --> SIGN & ENC
    SIGN --> ENC
    ENC --> DBI & FLOW & VER
```

### Building `crypto_tool`

From the root of the `go-flow` repository:

```powershell
# Windows (PowerShell)
$env:CGO_ENABLED = "0"
go build -trimpath -ldflags="-s -w" -o crypto_tool.exe ./crypto_tool
```

```bash
# Linux / macOS / FreeBSD (Bash)
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o crypto_tool ./crypto_tool
```

See the [CLI Compilation and Build Guide](guides/COMPILATION_AND_BUILD_GUIDE.md) for cross-compilation and vendor build options.

---

## 2. Complete CLI Flag Reference

```bash
crypto_tool [flags]
```

### 2.1 Operation & I/O Flags

| Flag | Alias | Type | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `-action` | — | `string` | `encrypt` | Operation to execute: `encrypt`, `decrypt`, `gen-key`, `gen-keypair`, `sign`, or `verify`. |
| `-gen-key` | — | `bool` | `false` | Shortcut flag for `-action gen-key`. Generates a 256-bit (32-byte) cryptographically secure symmetric key. |
| `-in` | — | `string` | `""` | Input file path. Omit or pass `"-"` to read from standard input (`stdin`). |
| `-out` | — | `string` | `""` | Output file path. Omit or pass `"-"` to write to standard output (`stdout`). Secret key files are automatically written with `0600` permissions. |
| `-binary` | — | `bool` | `false` | Reads/writes raw binary ciphertext or raw signature bytes instead of text-safe armored envelopes (`FLOWENC:v1:` or `FLOWSIG:v1:`). |

### 2.2 Symmetric Encryption & Decryption Flags (`encrypt`, `decrypt`)

| Flag | Alias | Type | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `-key-file` | — | `string` | `""` | **Recommended.** Path to a file containing the symmetric encryption/decryption passphrase or key. Avoids exposing secrets in OS process listings (`ps`, Task Manager). |
| `-secure-key` | `-key` | `string` | `""` | Symmetric passphrase or key supplied on the command line. Emits a warning to `stderr` recommending `-key-file` or `FLOW_SECURE_KEY`. |

#### Symmetric Key Resolution Precedence

When `encrypt` or `decrypt` is invoked, `crypto_tool` resolves the key in the following strict order:

1. **`-secure-key` / `-key`** CLI flag *(highest priority; prints a process-listing exposure warning to `stderr`)*
2. **`-key-file <path>`** *(reads and trims key text from the specified file)*
3. **`FLOW_SECURE_KEY`** environment variable
4. **`SECURE_KEY`** environment variable

### 2.3 Asymmetric Keypair & X.509 Certificate Generation Flags (`gen-keypair`)

| Flag | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `-keypair-type` | `string` | `rsa` | Asymmetric algorithm: `rsa`, `ecdsa` (NIST P-256), `ed25519`, or `pgp` (aliases: `gpg`, `openpgp`). |
| `-bits` | `int` | `2048` | RSA modulus bit length when `-keypair-type rsa` is selected (e.g., `2048`, `3072`, `4096`). |
| `-out-priv` | `string` | `private_key.pem` | Destination file path for the generated private key (saved with `0600` permissions). |
| `-out-pub` | `string` | `public_key.pem` | Destination file path for the generated public key (saved with `0644` permissions). |
| `-out-cert` | `string` | `""` | Optional destination file path to generate a self-signed X.509 certificate (valid for 365 days) alongside PEM keypairs. |
| `-cn` | `string` | `"Flow Code Signer"` | Common Name (`CN`) embedded in the self-signed X.509 certificate or OpenPGP user identity (`<CN> (Flow Operator) <signer@flow.local>`). |

### 2.4 Digital Signing & Verification Flags (`sign`, `verify`)

| Flag | Alias | Type | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `-sig-type` | — | `string` | `openssl` | Signature standard for `-action sign`: `openssl` (RSA/ECDSA/Ed25519), `pkcs7` (CMS / PKCS#7 SignedData), or `pgp` (OpenPGP). |
| `-private-key` | `-priv` | `string` | `""` | Path to the signer's private key file (PEM or OpenPGP armored private key). Required for `-action sign`. |
| `-passphrase` | — | `string` | `""` | Passphrase to unlock an encrypted private key file during `-action sign`. |
| `-wrap` | — | `bool` | `false` | Bundles both the digital signature and the payload into a single self-contained `FLOWSIGNED:v1:<FORMAT>:<base64-sig>:<base64-payload>` file. |
| `-signature` | `-sig` | `string` | `""` | Path to a detached signature file for `-action verify`. If omitted, `crypto_tool` automatically checks `<in>.sig`, `<in>.asc`, and `<in>.p7s`. |
| `-public-key` | `-pub` | `string` | `""` | Path to a PEM or OpenPGP public key file for `-action verify`. |
| `-cert` | — | `string` | `""` | Path to an X.509 certificate (`.pem`, `.crt`, `.cer`, PEM or DER). Required when signing with `-sig-type pkcs7`, and used as a trust anchor during verification. |
| `-ca-cert` | — | `string` | `""` | Path to a Root or Intermediate CA X.509 certificate for certificate chain validation during `-action verify`. |
| `-keyring` | — | `string` | `""` | Path to an OpenPGP armored public keyring file for `-action verify`. |

---

## 3. Detailed Guide by Action

### 3.1 Action 1: Generate a Symmetric Key (`-gen-key` / `-action gen-key`)

Generates 32 cryptographically random bytes (256 bits) via Go's `crypto/rand` and encodes them as a base64 string. When `-out` points to a file, `crypto_tool` enforces `0600` file permissions (owner read/write only) before writing the key.

```bash
# Save a new 256-bit symmetric key to disk with 0600 permissions
crypto_tool -gen-key -out /etc/flow/secrets/master.key

# Print a generated key to stdout (e.g., to pipe into a secret manager or environment variable)
crypto_tool -gen-key
```

---

### 3.2 Action 2: Generate Asymmetric Keypairs & Certificates (`-action gen-keypair`)

Generates signing keypairs across four industry-standard algorithms without requiring `openssl` or `gpg` to be installed on the machine:

#### A. RSA Keypair + Self-Signed X.509 Certificate (2048-bit or 4096-bit)

```bash
crypto_tool -action gen-keypair \
  -keypair-type rsa \
  -bits 4096 \
  -out-priv signer_rsa_priv.pem \
  -out-pub signer_rsa_pub.pem \
  -out-cert signer_rsa_cert.pem \
  -cn "ETL Production Release Signer"
```

#### B. ECDSA (NIST P-256) Keypair + Self-Signed X.509 Certificate

```bash
crypto_tool -action gen-keypair \
  -keypair-type ecdsa \
  -out-priv signer_ecdsa_priv.pem \
  -out-pub signer_ecdsa_pub.pem \
  -out-cert signer_ecdsa_cert.pem \
  -cn "ETL ECDSA Signer"
```

#### C. Ed25519 Keypair + Self-Signed X.509 Certificate

```bash
crypto_tool -action gen-keypair \
  -keypair-type ed25519 \
  -out-priv signer_ed25519_priv.pem \
  -out-pub signer_ed25519_pub.pem \
  -out-cert signer_ed25519_cert.pem \
  -cn "ETL Ed25519 Signer"
```

#### D. OpenPGP / GPG Armored Keypair (`.asc`)

```bash
crypto_tool -action gen-keypair \
  -keypair-type pgp \
  -out-priv signer_pgp_priv.asc \
  -out-pub signer_pgp_pub.asc \
  -cn "ETL OpenPGP Release Authority"
```

---

### 3.3 Action 3: Symmetric AES-256-GCM Encryption (`-action encrypt`)

Encrypts any XML pipeline, options file, config file, or arbitrary payload using **AES-256-GCM** with a unique 16-byte random salt (`PBKDF2-HMAC-SHA256`, 100,000 iterations), a 12-byte random GCM nonce, and a 16-byte authentication tag.

By default, `crypto_tool` outputs a text-safe armored envelope (`FLOWENC:v1:<base64>`) that can be safely stored in SQL `NVARCHAR(MAX)` / `TEXT` columns or Git repositories without binary encoding issues.

```bash
# Encrypt using a key file (Recommended)
crypto_tool -action encrypt \
  -in pipelines/daily_settlement.xml \
  -out pipelines/daily_settlement.xml.enc \
  -key-file /etc/flow/secrets/master.key

# Encrypt using the FLOW_SECURE_KEY environment variable
export FLOW_SECURE_KEY="MyProductionPassphrase2026!"
crypto_tool -action encrypt \
  -in configs/prod_config.xml \
  -out configs/prod_config.xml.enc

# Encrypt to raw binary bytes instead of FLOWENC:v1: text armor
crypto_tool -action encrypt \
  -in payload.xml \
  -out payload.bin \
  -binary \
  -key-file /etc/flow/secrets/master.key
```

---

### 3.4 Action 4: Symmetric AES-256-GCM Decryption (`-action decrypt`)

Decrypts and authenticates an encrypted file. If any byte of the ciphertext, salt, nonce, or GCM tag has been tampered with, authentication fails immediately before outputting any data.

```bash
# Decrypt an armored FLOWENC:v1: file back to plaintext XML
crypto_tool -action decrypt \
  -in pipelines/daily_settlement.xml.enc \
  -out pipelines/daily_settlement.xml \
  -key-file /etc/flow/secrets/master.key

# Decrypt to stdout for quick inspection without writing plaintext to disk
crypto_tool -action decrypt \
  -in pipelines/daily_settlement.xml.enc \
  -out - \
  -key-file /etc/flow/secrets/master.key
```

---

### 3.5 Action 5: Digital Signing (`-action sign`)

`crypto_tool` supports three signature standards (`-sig-type openssl`, `pkcs7`, and `pgp`) and two packaging modes:
- **Detached Signatures (default):** Writes the signature to a companion file (`.sig`, `.p7s`, or `.asc`) while leaving the input file untouched.
- **Unified Wrapped Envelope (`-wrap`):** Embeds both the signature and the input payload into a single `FLOWSIGNED:v1:<FORMAT>:<base64-sig>:<base64-content>` text file.

```bash
# 1. OpenSSL / PEM Detached Signature (RSA, ECDSA, or Ed25519)
crypto_tool -action sign \
  -sig-type openssl \
  -in pipeline.xml \
  -out pipeline.xml.sig \
  -priv signer_rsa_priv.pem

# 2. PKCS#7 / CMS Detached Signature (.p7s — requires -priv and -cert)
crypto_tool -action sign \
  -sig-type pkcs7 \
  -in pipeline.xml \
  -out pipeline.xml.p7s \
  -priv signer_rsa_priv.pem \
  -cert signer_rsa_cert.pem

# 3. OpenPGP / GPG Armored Detached Signature (.asc)
crypto_tool -action sign \
  -sig-type pgp \
  -in pipeline.xml \
  -out pipeline.xml.asc \
  -priv signer_pgp_priv.asc

# 4. Unified Self-Contained Signed Package (-wrap -> FLOWSIGNED:v1:...)
crypto_tool -action sign \
  -sig-type openssl \
  -wrap \
  -in pipeline.xml \
  -out pipeline.xml.signed \
  -priv signer_rsa_priv.pem
```

---

### 3.6 Action 6: Digital Signature Verification (`-action verify`)

Verifies either a unified `FLOWSIGNED:v1:` package or a detached signature file against a trusted public key (`-pub`), X.509 certificate (`-cert`), Root CA certificate (`-ca-cert`), or OpenPGP keyring (`-keyring`).

```bash
# 1. Verify a detached signature (auto-discovers pipeline.xml.sig / .asc / .p7s if -sig is omitted)
crypto_tool -action verify \
  -in pipeline.xml \
  -pub signer_rsa_pub.pem

# 2. Verify a detached PKCS#7 signature against a trusted X.509 certificate or Root CA
crypto_tool -action verify \
  -in pipeline.xml \
  -sig pipeline.xml.p7s \
  -cert signer_rsa_cert.pem

# 3. Verify an OpenPGP detached signature against a public keyring
crypto_tool -action verify \
  -in pipeline.xml \
  -sig pipeline.xml.asc \
  -keyring signer_pgp_pub.asc

# 4. Verify a unified FLOWSIGNED:v1: package and extract verified content to a file
crypto_tool -action verify \
  -in pipeline.xml.signed \
  -pub signer_rsa_pub.pem \
  -out verified_pipeline.xml
```

*Sample verification output:*

```text
Signature VALID (OPENSSL via RSA-SHA256, Signer: PublicKey-SHA256:9f86d081884c7d65...)
```

---

## 4. Envelope Format Reference

| Envelope Prefix | Generated By | Structure & Purpose |
| :--- | :--- | :--- |
| `FLOWENC:v1:` | `-action encrypt` (without `-binary`) | `FLOWENC:v1:<base64(16B_salt \|\| 12B_nonce \|\| ciphertext \|\| 16B_gcm_tag)>` — Text-safe AES-256-GCM ciphertext suitable for XML files and SQL `NVARCHAR(MAX)` columns. |
| `FLOWSIG:v1:` | `-action sign` (OpenSSL detached without `-binary`) | `FLOWSIG:v1:<FORMAT>:<base64-signature>` — Text-safe detached signature header identifying algorithm (e.g., `OPENSSL-RSA-SHA256`, `OPENSSL-ECDSA-SHA256`, `OPENSSL-ED25519`). |
| `FLOWSIGNED:v1:` | `-action sign -wrap` | `FLOWSIGNED:v1:<FORMAT>:<base64-signature>:<base64-payload>` — Self-contained signed package combining signature and payload into a single file or database column value. |

---

## 5. Combining `crypto_tool` with `db_importer` & `flow` via Standard I/O

Because `crypto_tool` reads from `stdin` when `-in` is omitted (or `"-"`) and writes to `stdout` when `-out` is omitted (or `"-"`), you can chain **Encrypt-then-Sign** workflows directly into [`db_importer`](db_import.md) without writing intermediate files to disk:

```bash
# Encrypt pipeline.xml -> wrap with an OpenSSL RSA signature -> import directly into SQL Server
crypto_tool -action encrypt -in pipeline.xml -out - -key-file master.key \
  | crypto_tool -action sign -sig-type openssl -wrap -priv signer_rsa_priv.pem -in - -out - \
  | db_importer -dsn "sqlserver://sa:Password123!@localhost:1433?database=ETL" \
      -table pipeline \
      -name "secure_nightly_etl" \
      -desc "Signed and encrypted via stdin pipeline" \
      -file -
```

Then execute the signed and encrypted database artifact with `flow`:

```bash
flow -verify-signature \
     -public-key signer_rsa_pub.pem \
     -encrypted \
     -key-file master.key \
     -file "sql://sqlserver@sqlserver://sa:Password123!@localhost:1433?database=ETL#SELECT PipelineXML FROM dbo.flow_pipeline_content WHERE Name = 'secure_nightly_etl'"
```

---

## 6. Related Documentation

- [**`db_importer` — Database XML Importer & Exporter Reference**](db_import.md)
- [**AES-256-GCM Encryption Guide**](guides/ENCRYPTION.md)
- [**Cross-Platform Digital Signatures Guide**](guides/SIGNATURES.md)
- [**Combined Encryption & Signatures**](guides/COMBINED_ENCRYPTION_AND_SIGNATURES.md)
- [**Security Order of Operations & Options**](guides/SECURITY_ORDER_AND_OPTIONS.md)
- [**Complete CLI Options & Arguments**](guides/COMPLETE_CLI_OPTIONS_AND_ARGUMENTS.md)
