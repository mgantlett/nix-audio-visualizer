# Changelog

## [1.0.1](../../compare/v1.0.0...v1.0.1) (2026-06-23)

### Features

- feat(#1): configure transparent black background, halved height, crt scanlines, and HDMI 7.1 input
- feat: implement NixOS desktop background audio visualizer with 4 visual styles
- feat: bootstrap repository with ado-core submodule and installation guide

### Bug Fixes

- fix: resolve UserMediaPermissionRequest class error in permission decision
- fix: resolve Wayland -1 dimensions and add GStreamer plugins to shell.nix
- fix: use Gdk.RGBA instead of WebKit2.Color for transparent background
- fix: resolve set_enable_media_stream method name typo in WebKit settings
- fix: resolve cairo import issue and locale warnings in shell.nix

### Infrastructure & Maintenance

- style: change default visualizer height parameter to 90px
- chore: update .ado-core submodule reference after bin/agent update
- chore: add ADO-Core dependencies to shell.nix
- chore: bootstrap ADO-Core installer setup files and configurations

### 📈 Stats

- **0 files changed**, +0 / -0 lines
- **0
0 contract tests** (all passing)
- **8% agent-authored** commits

