# Contributing

Useful contributions include synthetic capture fixtures, parsing regressions, accessibility improvements, and platform desktop validation.

1. Describe the concrete behavior using entirely fictional message data.
2. Preserve original message bodies and maintain documented evidence boundaries.
3. For engine changes, add a regression case that demonstrates a real edge condition.
4. Run npm run build and npm test.
5. For interface changes, run the optional real-browser check on your platform.
6. For Rust changes, run a native build and describe which platform was used.

Do not add live queue mutation, credential storage, automatic message publishing, telemetry, or secret inference without a separate design review and explicit user controls. Do not commit captured production messages, node_modules, native target directories, or private export files.

Contributions are licensed under MIT. Copyright notices must be preserved.
