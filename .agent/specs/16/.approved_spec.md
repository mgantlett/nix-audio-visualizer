# Implementation Plan - MPRIS Music Controls & Retro Marquee HUD (Task 16)

Implement Linux MPRIS media metadata integration, direct music playback controls (Prev/Play-Pause/Next), and a visual, themed retro LCD scrolling marquee HUD.

## Proposed Changes

### Workspace Configuration

#### [MODIFY] [shell.nix](file:///home/markg/Projects/nix-audio-visualizer/shell.nix)
- Add `playerctl` package to the build/shell dependencies.

### Python CLI Wrapper & MPRIS Bridge

#### [MODIFY] [desktop-visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/desktop-visualizer.py)
- **Imports:** `json`, `subprocess`, `socket`, `threading`, `warnings`
- **Exports:** `get_mpris_metadata()`, `update_mpris_metadata()`, `main`, `run_js()`, `get_socket_path()`, `handle_ipc_command()`, `listen_ipc()`
- **MPRIS Metadata Retrieval:**
  - Expose a helper `# Retrieve active player metadata via playerctl MPRIS API` `get_mpris_metadata()`:
    - Attempt to use Python gi Playerctl bindings to locate Chrome or Chromium media players.
    - Fallback to running subprocess calls to the `playerctl` CLI if Python gi bindings are missing or fail.
    - Expose fields: `title`, `artist`, `album`, `artUrl`, `status`, `length`, and `position`.
- **MPRIS Metadata Injector:**
  - Expose a helper `# Push current MPRIS metadata updates to visualizer web frame` `update_mpris_metadata(webview)`:
    - Periodically run inside GTK timeout (every 1 second).
    - Inject current metadata into the WebKit DOM frame via the JS callback `window.onMetadataUpdate`.
- **Title Bridge Controls:**
  - Expand `on_title_changed` to capture a new `"media-control"` action:
    - Read the `command` field (e.g. `"play-pause"`, `"next"`, `"previous"`).
    - Execute corresponding media player action using playerctl bindings or fallback shell commands.

### HTML User Interface

#### [MODIFY] [index.html](file:///home/markg/Projects/nix-audio-visualizer/visualizer/index.html)
- **Music HUD Container:**
  - Insert `#musicHud` container containing a control panel button group (Prev/Play-Pause/Next) and a `.hud-screen` wrapper holding a scrolling `#hudMarquee` text line.
- **HUD Settings Menu Controls:**
  - Insert a new `Music HUD Settings` group under visualizer settings:
    - `#hudShowToggle`: Checkbox/switch to toggle HUD visibility.
    - `#hudThemeSelect`: Dropdown to change LCD visual themes.

#### [MODIFY] [style.css](file:///home/markg/Projects/nix-audio-visualizer/visualizer/style.css)
- **HUD Positioning & Layout:**
  - Align `#musicHud` nicely near the visualizer canvas edge.
  - Set styling rules for `.hud-screen` mimicking retro electronic hardware LCD displays with pixel grid overlays, scanline gradients, and inset box shadows.
- **Marquee Keyframe Animations:**
  - Define a smooth `@keyframes marquee` CSS transform animation to slide the track title text continuously.
- **LCD Color Themes:**
  - Define custom glowing colors, borders, and text shadows for:
    - `green-lcd` (Classic retro stereo)
    - `amber-lcd` (Fallout vintage monitor style)
    - `cyan-neon` (Cyberpunk glow)
    - `red-led` (Retro alarm clock glow)

### Web Audio & Visualizer Logic

#### [MODIFY] [main.js](file:///home/markg/Projects/nix-audio-visualizer/visualizer/main.js)
- **HUD Settings Bindings:**
  - Save HUD options to `localStorage` (syncing visibility and theme settings).
  - Add `#hudShowToggle` and `#hudThemeSelect` change event listeners.
- **MPRIS Callback:**
  - Implement `window.onMetadataUpdate(metadata)`:
    - Extract title, artist, and playback status.
    - Update scrolling marquee text to display `"Artist - Title"` or `"No Track Playing"` during inactivity.
    - Toggle active/paused styling states.
- **Interfacing Actions:**
  - Connect click listeners on HUD controls (Prev, Play-Pause, Next) to trigger `document.title = JSON.stringify({ action: "media-control", command: "..." })`.

### Tests

#### [MODIFY] [test_visualizer.py](file:///home/markg/Projects/nix-audio-visualizer/test_visualizer.py)
- **Imports:** `importlib`
- Add `test_mpris_metadata()` to verify MPRIS interface and robust subprocess execution.

---

## Verification Plan

### Automated Tests
- Run full Definition of Done check:
  ```bash
  nix-shell --run "bin/agent verify dod"
  ```

### Manual Verification
1. Open the visualizer, open Chrome playing a YouTube Music track.
2. Toggle "Show Music HUD" in settings. Verify that the HUD overlay appears with a glowing LCD display.
3. Choose different HUD themes and verify that the screen color, borders, and glow update dynamically.
4. Verify that the track artist and title scroll continuously across the LCD screen.
5. Click the play/pause, next, and previous buttons on the HUD and verify that playback in Chrome is controlled correctly.
