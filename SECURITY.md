# Security and privacy

QueueFlight 0.1.0 is not independently audited. It is a local inspection tool; analysis output is not a security verdict, root-cause diagnosis, or authorization to redrive messages.

## Boundaries

The browser and CLI do not call AWS or inspect credentials. Browser processing has no network client, telemetry, persistence, or content upload. Imported text is displayed through DOM text nodes rather than HTML. The local server binds only to 127.0.0.1, rejects unexpected Hosts and write methods, and serves a fixed allowlist. Its CSP blocks browser connections. Rust uses native pickers rather than frontend-supplied filesystem paths.

Reports, copied payloads, and exported fixtures retain original message bodies, attributes, and potentially identifiers. They are plaintext, not encrypted or redacted. Original receipt handles are replaced in fixtures; that does not remove all sensitive data. Review exports before sharing.

Clearing the session releases application references and fields. JavaScript cannot prove secure memory erasure. Clearing does not erase downloads, clipboard managers, process dumps, browser recovery data, backups, or files on disk. A compromised browser/extension/OS can see imported content.

## Resource limits

Capture input: 5 MiB. Maximum 500 observations. Unwrapping: six steps. Structural diff: 10,000 visited nodes, 300 reported changes, depth 48; output identifies truncation. Payload preview: 200,000 characters, with full body preserved for export. Retry lab: at most ten selected records. Large JSON parsing and rendering run synchronously and may briefly block the UI. Extremely nested values may not be printable; this is reported rather than executed.

Shape validation is deliberate but does not validate AWS authenticity, every attribute type, all queue constraints, or all Lambda event schema rules. Duplicate grouping hashes exact body bytes and is not a semantic event identifier. SHA-256 here is for comparison, not authentication or encryption.

The desktop source and native dialogs were not compiled or validated in the creation environment. Review desktop dependencies and generate lockfiles on a successful platform build before distributing executables. Build/install tools have their own software supply-chain risks.

## Reporting

Use GitHub private vulnerability reporting if the repository maintainer enables it. Otherwise ask for a private contact channel without posting real messages, credentials, or sensitive attack details publicly. There is no response-time guarantee.
