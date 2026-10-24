# Tauri / Rust desktop source

The desktop source is included for developers. **It has not been compiled or run in the creation environment.** Use the tested browser/CLI engine while validating native behavior on your platform.

## Prerequisites

Follow [Tauri's platform prerequisites](https://v2.tauri.app/start/prerequisites/) for Rust and system dependencies. Windows development needs the Microsoft C++ build tools and WebView2. macOS uses Xcode command-line tools. Linux needs the platform libraries documented by Tauri. Node.js 24 is required for this repository's build step.

Then, from the repository root:

```sh
npm install
npm run desktop:dev
```

To compile an executable without an installer:

```sh
npm run desktop:build
```

The executable is produced under src-tauri/target/release. Builds are unsigned and are not a signed distributable installer. Dependency ranges are declared for the initial desktop source; generate and review npm/Cargo lockfiles after a successful native build, then commit them for reproducibility. Do not treat this as a reproducibly locked desktop release yet.

## Architecture

The TypeScript engine runs in the webview and is also used by the CLI. Rust exposes only two custom commands:

- import_capture: opens a native file chooser, reads at most 5 MiB plus a sentinel byte, validates UTF-8, and returns the chosen text.
- export_json: accepts bounded text and a whitelisted fixture filename, opens a native save chooser, and creates a new file. It refuses to overwrite an existing destination.

The frontend cannot supply an arbitrary filesystem path. There is no shell execution, AWS credential lookup, updater, remote API client, or general filesystem plugin. The webview uses a restrictive CSP with the Tauri IPC origin allowed. See [Tauri capabilities](https://v2.tauri.app/security/capabilities/) for custom-command exposure rules.

## Manual Windows workflow

After uploading the full repository, open Actions → Desktop build (Windows) → Run workflow. This workflow installs the desktop dependencies and attempts a Windows executable build, then uploads the unsigned executable as an Actions artifact. It does not publish a GitHub Release. Its existence is not evidence that the build has already passed.
