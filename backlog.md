# Nix Audio Visualizer - Future Backlog

## Epic 1: New Visualizer Modes
- **Oscilloscope Waveform:** Implement a pure time-domain glowing line that traces the actual audio waveform in real-time (vintage oscilloscope style).
- **Matrix / Spectrogram View:** Build a 2D grid/waterfall where time cascades downwards and colors represent frequency intensity.
- **Particle System:** Render glowing particles emitted from the bass kicks that bounce across the screen using simple physics.

## Epic 2: Album Art & Rich Metadata
- **Album Art Extraction:** Extend the Python MPRIS bridge to intercept the `mpris:artUrl` property.
- **HUD Integration:** Pass the album art into the WebKit view and render it (e.g., as a blurred vinyl record or a crisp square cover) next to the LCD screen in the HUD.

## Epic 3: Dynamic Visual Effects (VFX)
- **Reactive Bloom & Glow:** Add dynamic CSS/Canvas bloom (`shadowBlur`) that increases exponentially during loud bass kicks or high-energy choruses.
- **Camera Shake:** Introduce a subtle CSS `transform` shake on the entire visualizer canvas during massive beat detection transients.

## Epic 4: Custom JS Smoothing Engine
- **Decoupled Smoothing:** Disable native WebAudio `smoothingTimeConstant` (set to `0.0`).
- **Custom EMA:** Build a custom exponential moving average (EMA) in JavaScript to allow independent smoothing attack and release speeds (e.g., instant attack on the beat, but a slow buttery fade-out).
