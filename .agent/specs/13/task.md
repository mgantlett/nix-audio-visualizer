# Task List - Optimize performance and add dynamic visualizer parameters

- [x] Performance optimizations (lag fix)
  - [x] Conditionally request 8 channels only for HDMI/surround source labels (2 channels default)
  - [x] Replace canvas drop shadows (shadowBlur, shadowColor) with stacked alpha-glow rectangles
  - [x] Step zero-crossing search by stride of 2 in drawWavePath()
- [x] UI/UX Layout Enhancements
  - [x] Restyle controls menu to support scrollable container (overflow-y: auto)
- [x] Add style-specific settings controls in HTML/CSS/JS
  - [x] Preset Theme selector dropdown (Cyberpunk, Matrix, Neon Pink, Volcano, Monochrome)
  - [x] Global: minDecibels, Beat Threshold sliders
  - [x] Classic Bars: Bar Count, Bar Gap, Peak Decay Speed
  - [x] LED Equalizer: Bar Count (Columns), LED Height/Gap
  - [x] Oscilloscope: Line Thickness, Glow Intensity
  - [x] Neural Pulse: Orbiter Count, Ring Growth Speed
- [x] Dynamic settings row visibility (show/hide parameters matching selected style)
- [x] Persist settings using localStorage and reload on start
- [x] Verify changes (python test_visualizer.py and verify dod)
