# Hostinger / static deployment

QueueFlight's browser app requires three files from dist:

- index.html
- style.css
- app.js

The ready-built dist directory is included in the repository. Upload these three files directly into your domain's public_html directory or a dedicated subdirectory. Keep them together. No npm command or Node hosting plan is needed on the host. Do not upload web/index.html alone: web is source; dist contains the compiled app.

Serve over HTTPS (or localhost when developing). SHA-256 uses the standard Web Crypto API; clipboard access also requires a secure context in modern browsers. If import does not initialize, check the browser console and confirm that app.js returns JavaScript rather than an HTML error page. Replace all three files together after a build and clear the browser/hosting cache if the old version persists.

The app has no upload backend. Imported capture contents remain in the visitor's browser memory. Your web host will still serve and log normal page/asset requests according to its own configuration. Downloads and clipboard copies are user-triggered local actions.

A suggested hosting CSP is:

```text
default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

This is already emitted by the included local server. Configure equivalent HTTP headers in your hosting control panel if desired. Do not apply the browser CSP to the Tauri desktop build; it has its own IPC requirements.
