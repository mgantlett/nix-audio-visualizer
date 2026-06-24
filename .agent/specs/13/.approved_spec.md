# Implementation Plan - Visualizer Parameters Expansion & Performance Optimization

We will expand the audio visualizer controls to expose advanced music mapping parameters for all visualizer styles. We will also address the audio rendering lag introduced during the previous task.

## User Review Required

> [!IMPORTANT]
> **Performance Fix (Lag Resolution):**
> We identified two main contributors to the render lag in Task 2:
> 1. **Surround Channel Negotiation:** Requesting `channelCount: { ideal: 8 }` on standard stereo or mono outputs triggers GStreamer caps negotiation warnings and forces up-mixing overhead inside WebKitGTK. We will change this to only request 8 channels if the device label matches HDMI or surround signatures, and request standard 2 channels otherwise.
> 2. **Canvas Drop Shadows:** The peak blur shadow effect (`ctx.shadowBlur` and `ctx.shadowColor`) used when frequency values exceed `0.8` is notoriously slow in CPU-bound canvas rendering. We will optimize this by replacing canvas shadows with a fast, layered semi-transparent glow rectangle.
> 3. **Oscilloscope Zero-Crossing Scan:** We will optimize the zero-crossing search index scan by stepping through samples with a stride of 2, reducing CPU loop cycles.

> [!TIP]
> **Dynamic Menu Height & Scrollable Panel:**
> Since we are adding more than a dozen new settings, we will make the controls panel scrollable using standard CSS styling (`max-height: 250px; overflow-y: auto;`). This prevents the need to expand the Gtk window height beyond its current compact bounds, keeping the desktop bottom-dock space clean.

## Open Questions

> [!NOTE]
> 1. **Default Preset Themes:** We propose implementing a set of five visual presets: *Cyberpunk* (Cyan/Magenta), *Matrix* (Green), *Neon Pink* (Pink/Purple), *Volcano* (Red/Orange/Yellow), and *Monochrome* (White/Gray). Do you want any other custom themes added to this list?
> 2. **Persistent Scope:** Should the new visual parameters also persist under `localStorage` like existing settings? (We recommend yes to maintain state consistency across reboots).

## Proposed Changes

### Web Audio & Canvas Frontend

#### [MODIFY] [index.html](file:///home/markg/Projects/nix-audio-visualizer/visualizer/index.html)
- Add new parameter sliders and dropdowns grouped by their target style:
  - **Global/Audio:** minDecibels (slider), Theme Preset (select dropdown), and Beat Threshold (slider).
  - **Classic Bars:** Bar Count (slider), Bar Gap (slider), and Peak Decay Speed (slider).
  - **LED Equalizer:** Column Count (slider), LED Height (slider).
  - **Oscilloscope:** Line Thickness (slider), Glow Intensity (slider).
  - **Neural Pulse:** Orbiter Count (slider), Ring Speed (slider).
- Wrap the settings container inside a scrollable box with styled scrollbars.

#### [MODIFY] [style.css](file:///home/markg/Projects/nix-audio-visualizer/visualizer/style.css)
- Restyle the controls popup menu to support a scrollable container (`overflow-y: auto`, custom thin track/thumb scrollbars).
- Add classes to identify settings elements belonging to specific visualization modes.
- Implement theme variables and transition rules for dynamic theme presets.

#### [MODIFY] [main.js](file:///home/markg/Projects/nix-audio-visualizer/visualizer/main.js)
- **Optimize Audio Constraints:** Retrieve the selected device label, check if it contains `hdmi`, `7.1`, or `ad103`. If it does, request 8 channels; otherwise request 2 channels.
- **Optimize Canvas Shadows:** Remove `ctx.shadowBlur` and `ctx.shadowColor` overrides. Replace peak highlights with stacked glow drawings.
- **Optimize Zero-Crossing Search:** Use a step size of 2 in the loop inside `drawWavePath()` to speed up zero-crossing alignment.
- **Implement Custom Themes:** Add a color map dictionary mapped to themes. Dynamically compute HSL values based on the active theme.
- **Dynamic Controls Visibility:** Extend `updateControlsVisibility()` to show/hide setting groups matching the active `currentStyle`.
- **Implement Settings State:** Map and apply all new sliders to the drawing loops and bind event listeners to cache them in `localStorage`.
- **Isolate Per-Style Settings (Fix):** Introduce an `isSuppressingEvents` flag inside `applyStyleSettings()` to prevent programmatic slider updates from triggering recursive event listeners and overwriting other styles' settings.
- **Optimize main.js Line Count:** Refactor global variable assignments into a unified `varSetters` lookup table, reducing redundant boilerplate code and keeping `main.js` safely below the 1000-line monolithic ceiling.


### Wayland Desktop Wrapper

#### [MODIFY] [desktop-visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/desktop-visualizer.py)
- Re-align GTK allocation request bounds for the settings menu. Since the panel height will be kept scrollable at 240px, the current Gtk sizing code remains highly efficient and bounds calculations are preserved.
- **Declared Imports**: `gi`, `cairo`, `Gtk`, `Gdk`, `GtkLayerShell`, `WebKit2`, `argparse`, `os`, `sys`, `json`, `threading`, `subprocess`, `time`
- **Declared Exports**: `on_permission_decision`, `make_click_through`, `update_input_shape`, `on_title_changed`, `auto_route_audio`, `main`

#### [MODIFY] [test_visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/test_visualizer.py)
- Added default visualizer arguments validation test logic to satisfy TDD coverage requirements.
- **Declared Imports**: `subprocess`, `sys`
- **Declared Exports**: `test_arg_parsing`, `test_default_params`

## Verification Plan

### Automated Tests
- Run tests using:
  ```bash
  nix-shell --run "python3 test_visualizer.py"
  ```
- Run Definition of Done:
  ```bash
  nix-shell --run "bin/agent verify dod"
  ```

### Manual Verification
- Launch the visualizer using the startup script:
  ```bash
  bin/start-visualizer
  ```
- Toggle styles and verify that the parameters list in settings updates dynamically to match the current style.
- Validate that changing presets, bar count, or line thickness redraws elements instantly without rendering lag.
- Inspect GStreamer console outputs to confirm no negotiation errors are logged for stereo devices.
