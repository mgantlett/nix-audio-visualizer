# Implementation Plan - Refining Target Device Selection & Controls Menu

Refine target audio device selection using an auto-routing Gtk/PulseAudio background thread, fix click-through window focusing using GtkLayerShell BOTTOM layer anchoring, and implement interactive settings controls.

## Proposed Changes

### [Nix Development Environment]

#### [MODIFY] [shell.nix](file:///home/markg/Projects/nix-audio-visualizer/shell.nix)
Update default shell startup command instruction.

### [Visualizer Shell Wrapper]

#### [MODIFY] [desktop-visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/desktop-visualizer.py)
Update layer placement to Layer.BOTTOM, add auto-routing daemon thread, dynamic cairo clipping calculations, and connect Gwebview title changed and window size-allocate signals.
- Added export `make_click_through`
- Added export `update_input_shape`
- Added export `on_title_changed`
- Added export `auto_route_audio`
- Added export `main`
- Imported package `json`
- Imported package `subprocess`
- Imported package `time`
- Imported package `threading`

### [Visualizer Web Application]

#### [MODIFY] [index.html](file:///home/markg/Projects/nix-audio-visualizer/visualizer/index.html)
Add interactive Sensitivity range slider, Smoothing slider, Scanlines opacity slider, and Resolution dropdown menu controls. Add an ID to the smoothing control group to support dynamic visibility.

#### [MODIFY] [style.css](file:///home/markg/Projects/nix-audio-visualizer/visualizer/style.css)
Adjust menu height sizing and formatting styles. Style select elements with `appearance: none` and dark background dropdown options to resolve white-on-white contrast issues. Style custom range inputs.

#### [MODIFY] [main.js](file:///home/markg/Projects/nix-audio-visualizer/visualizer/main.js)
Implement manual sensitivity multiplier, waveform AGC, and bind event handlers to gainSlider, fftSelect, smoothingSlider, and scanlinesSlider inputs.
- Load and persist all user control choices to `localStorage` across visualizer restarts.
- Dynamically hide the "Smoothing" parameter control when in "Oscilloscope" style.
- Resolve canvas height scaling issue and add zero-crossing trigger for oscilloscope stabilization.

### [Verification Suite]

#### [MODIFY] [test_visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/test_visualizer.py)
Add verification assertions for the --device CLI option.
- Added export `test_arg_parsing`

### [Agile Infrastructure]

#### [MODIFY] [.ado-core](file:///home/markg/Projects/nix-audio-visualizer/.ado-core)
Update submodule reference to align tooling.

#### [NEW] [CHANGELOG.md](file:///home/markg/Projects/nix-audio-visualizer/CHANGELOG.md)
Create project changelog file.

## Verification Plan

### Automated Tests
- Run `nix-shell --run "bin/agent verify dod"` to verify all lints, code style alignments, and unit tests pass.
- Run `nix-shell --run "bin/agent test"` to run CLI verification tests.
