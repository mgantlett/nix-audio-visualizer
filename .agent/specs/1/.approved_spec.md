# Visualizer Setup and Refinement Plan

Design and build a transparent desktop background audio visualizer for KDE Plasma (NixOS) targeting HDMI 7.1 output, including tube TV scanlines and performance updates.

## Proposed Changes

### nix-audio-visualizer

#### [MODIFY] [shell.nix](file:///home/markg/Projects/nix-audio-visualizer/shell.nix)
- Updated shellHook to print execution command with `__NV_DISABLE_EXPLICIT_SYNC=1` environment variable.

#### [MODIFY] [desktop-visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/desktop-visualizer.py)
- Halved default height to 45px to fit slim Plasma toolbars.
- Changed default web view background color to opaque black via `Gdk.RGBA`.
- **Declared Imports**: `os`, `sys`, `gi`, `cairo`, `Gtk`, `Gdk`, `GtkLayerShell`, `WebKit2`, `argparse`
- **Declared Exports**: `main`, `on_permission_decision`, `make_click_through`

#### [MODIFY] [visualizer/main.js](file:///home/markg/Projects/nix-audio-visualizer/visualizer/main.js)
- Implemented target audio input device auto-detection targeting the HDMI 7.1 output monitor.
- Optimized audio capture initialization to use a single `getUserMedia` request when device labels are cached/exposed, preventing duplicate streams from spawning under the PulseAudio/PipeWire Recording tab.
- **Declared Exports**: `initAudio`, `render`, `updateReactiveState`, `drawBars`, `drawEqualizer`, `drawOscilloscope`, `drawNeuralPulse`

#### [MODIFY] [visualizer/style.css](file:///home/markg/Projects/nix-audio-visualizer/visualizer/style.css)
- Changed canvas background color to solid black.
- Implemented CRT tube TV repeating scanlines overlay effect using a pointer-events-disabled body pseudo-element.

#### [MODIFY] [.agent-plugins/test.sh](file:///home/markg/Projects/nix-audio-visualizer/.agent-plugins/test.sh)
- Overrode test executor wrapper to invoke our custom Python test suite.

#### [NEW] [test_visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/test_visualizer.py)
- Created automated integration/smoke test checking python wrapper arguments.
- **Declared Imports**: `subprocess`, `sys`
- **Declared Exports**: `test_arg_parsing`

#### [MODIFY] [.ado-core](file:///home/markg/Projects/nix-audio-visualizer/.ado-core)
- Updated submodule pointer to track latest OS tools.

## Verification Plan

### Automated Tests
- Run `bin/agent test` to run argument validation:
  ```bash
  nix-shell --run "bin/agent test"
  ```

### Manual Verification
1. Run `nix-shell` and execute:
   ```bash
   __NV_DISABLE_EXPLICIT_SYNC=1 python3 desktop-visualizer.py
   ```
2. Verify visualizer background is solid black and 45px in height.
3. Verify that only a single WebKitWebProcess stream is created in PulseAudio/PipeWire.
4. Verify the CRT TV scanline overlay rendering.
