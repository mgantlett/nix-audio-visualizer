// Web Audio API & Canvas Visualizer
// Ported from sophia-core (visualizations.ts, useMusicReactive.ts)

const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

// Read current style from query parameter (default: bars)
const urlParams = new URLSearchParams(window.location.search);
let currentStyle = urlParams.get('style') || 'bars'; // 'bars', 'eq', 'wave', 'pulse'

// Core theme variables
const CYBER = {
    cyan: 'rgba(0, 240, 255, 1)',
    magenta: 'rgba(255, 0, 128, 1)',
    bg: 'rgba(0, 0, 0, 0)',
    surface: 'rgba(10, 10, 16, 0.4)',
    glow: (opacity) => `rgba(0, 240, 255, ${opacity})`,
    magentaGlow: (opacity) => `rgba(255, 0, 128, ${opacity})`,
};

// State objects
let audioCtx = null;
let analyser = null;
let dataArray = null;
let waveArray = null;
let sensitivityMultiplier = 1.0;

// Reactive state variables
let smoothBass = 0;
let smoothMids = 0;
let smoothTreble = 0;
let smoothEnergy = 0;
let prevEnergy = 0;
let lastBeat = 0;
let hue = 200;
let energy = 0;
let isBeat = false;
let bass = 0;

// Constants for reactiveness
const SMOOTH = 0.7;
const BEAT_THRESHOLD = 0.45;
const BEAT_COOLDOWN_MS = 150;

// Auto-Gain Control (AGC) state for bars/eq
let peakLevel = 0.5;
const PEAK_DECAY = 0.99;

// Update peak level for Auto-Gain Control (AGC) with standard decay
function updatePeak(frameMax) {
    if (frameMax > peakLevel) {
        peakLevel = frameMax;
    } else {
        peakLevel *= PEAK_DECAY;
    }
    peakLevel = Math.max(peakLevel, 0.1); // Floor to avoid division by zero
}

// Auto-Gain Control (AGC) state for oscilloscope
let wavePeakLevel = 0.1;
const WAVE_PEAK_DECAY = 0.95;

// Update peak level for oscilloscope with a faster decay rate
function updateWavePeak(frameMax) {
    if (frameMax > wavePeakLevel) {
        wavePeakLevel = frameMax;
    } else {
        wavePeakLevel *= WAVE_PEAK_DECAY;
    }
    wavePeakLevel = Math.max(wavePeakLevel, 0.02); // Floor to avoid division by zero
}

// Fit canvas to window size
// Fit canvas to window size using fixed height param to avoid vertical squashing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    const heightParam = parseInt(urlParams.get('height') || '45');
    canvas.height = heightParam;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initial background clear
ctx.clearRect(0, 0, canvas.width, canvas.height);

// ─── Style 1: Classic Bars ─────────────────────────
function drawBars(width, height) {
    const bars = Math.min(dataArray.length, 64);
    const barWidth = width / bars;
    const gap = 2;

    // AGC Peak Search
    let frameMax = 0;
    for (let i = 0; i < bars; i++) {
        const val = (dataArray[i] ?? 0) / 255;
        if (val > frameMax) frameMax = val;
    }
    updatePeak(frameMax);

    for (let i = 0; i < bars; i++) {
        const rawValue = (dataArray[i] ?? 0) / 255;
        const value = Math.min(1.0, (rawValue / (peakLevel * 1.0)) * sensitivityMultiplier);
        
        const barHeight = value * (height * 0.9);
        const x = i * barWidth;
        const y = height - barHeight;

        const currentHue = 180 + (i / bars) * 120; // Cyan (180) to Magenta (300)
        const lightness = 50 + value * 20;
        const alpha = 0.2 + value * 0.8;

        ctx.fillStyle = `hsla(${currentHue}, 90%, ${lightness}%, ${alpha})`;
        ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);

        // Optional peak glowing highlight
        if (value > 0.8) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsla(${currentHue}, 100%, 70%, 0.6)`;
            ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);
            ctx.shadowBlur = 0;
        }
    }
}

// ─── Style 2: LED Equalizer ────────────────────────
function drawEqualizer(width, height) {
    const bars = 24;
    const barWidth = width / bars;
    const gap = 3;
    const segmentHeight = 4;
    const segmentGap = 2;
    const totalSegments = Math.floor(height / (segmentHeight + segmentGap));

    let frameMax = 0;
    for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * Math.min(dataArray.length, 64));
        const val = (dataArray[idx] ?? 0) / 255;
        if (val > frameMax) frameMax = val;
    }
    updatePeak(frameMax);

    for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * Math.min(dataArray.length, 64));
        const rawValue = (dataArray[idx] ?? 0) / 255;
        const value = Math.min(1.0, (rawValue / (peakLevel * 1.0)) * sensitivityMultiplier);
        const litSegments = Math.floor(value * totalSegments);

        const x = i * barWidth + gap / 2;
        const w = barWidth - gap;

        for (let s = 0; s < totalSegments; s++) {
            const y = height - (s + 1) * (segmentHeight + segmentGap);
            const isLit = s < litSegments;
            const segRatio = s / totalSegments;

            if (isLit) {
                let r, g, b;
                if (segRatio < 0.5) {
                    const t = segRatio / 0.5;
                    r = Math.round(t * 255);
                    g = 255;
                    b = 0;
                } else if (segRatio < 0.75) {
                    const t = (segRatio - 0.5) / 0.25;
                    r = 255;
                    g = Math.round(255 - t * 100);
                    b = 0;
                } else {
                    const t = (segRatio - 0.75) / 0.25;
                    r = 255;
                    g = Math.round(155 - t * 155);
                    b = 0;
                }
                const brightness = 0.7 + (s === litSegments - 1 ? 0.3 : 0);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;

                if (s === litSegments - 1 && segRatio > 0.6) {
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = `rgba(${r}, ${g}, 0, 0.6)`;
                }
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            }
            ctx.fillRect(x, y, w, segmentHeight);
            ctx.shadowBlur = 0;
        }
    }
}

// ─── Style 3: Oscilloscope (Waveform) ──────────────
function drawOscilloscope(width, height) {
    const mid = height / 2;

    // AGC Peak Search for Waveform
    let waveMax = 0;
    for (let i = 0; i < waveArray.length; i++) {
        const val = Math.abs(waveArray[i] - 128) / 128;
        if (val > waveMax) waveMax = val;
    }
    updateWavePeak(waveMax);

    // Glowing background line
    ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.15)`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    drawWavePath(width, mid, height);
    ctx.stroke();

    // Foreground sharp line
    ctx.strokeStyle = `hsla(${hue}, 90%, ${55 + energy * 20}%, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.6)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    drawWavePath(width, mid, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Zero-crossing dots
    if (isBeat) {
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, 0.8)`;
        for (let i = 1; i < waveArray.length; i += 2) {
            const prev = (waveArray[i - 1] - 128) / 128;
            const curr = (waveArray[i] - 128) / 128;
            if ((prev <= 0 && curr > 0) || (prev >= 0 && curr < 0)) {
                const x = (i / waveArray.length) * width;
                ctx.beginPath();
                ctx.arc(x, mid, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Draw the actual curved wave path based on audio buffer samples
function drawWavePath(width, mid, height) {
    // Search for zero-crossing to stabilize wave horizontally
    let triggerIndex = 0;
    for (let i = 0; i < waveArray.length / 2; i++) {
        if (waveArray[i] < 128 && waveArray[i+1] >= 128) {
            triggerIndex = i;
            break;
        }
    }

    const remainingLength = waveArray.length - triggerIndex;
    const step = width / remainingLength;

    // Scale amplitude by wavePeakLevel AGC and user sensitivity multiplier
    const gain = (1.0 / Math.max(wavePeakLevel, 0.02)) * sensitivityMultiplier;

    ctx.beginPath();
    for (let i = 0; i < remainingLength; i++) {
        const sample = ((waveArray[triggerIndex + i] - 128) / 128) * gain;
        const y = mid + Math.max(-1.0, Math.min(1.0, sample)) * (height * 0.45);
        const x = i * step;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
}

// ─── Style 4: Neural Pulse (Circular Ripples) ──────
const rings = [];
let lastRingTime = 0;

// Draw the circular neural pulsing rings and satellites
function drawNeuralPulse(width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.max(width, height) * 0.6;
    const now = performance.now();

    if (isBeat && (now - lastRingTime) > 150) {
        rings.push({
            radius: 2,
            maxRadius: maxR,
            hue: hue + (Math.random() - 0.5) * 30,
            alpha: 0.8 + energy * 0.2,
            birth: now,
        });
        lastRingTime = now;
        while (rings.length > 12) rings.shift();
    }

    for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        const age = (now - ring.birth) / 1000;
        const progress = Math.min(age * 1.5, 1);
        ring.radius = 2 + progress * ring.maxRadius;
        ring.alpha = (1 - progress) * 0.7;

        if (ring.alpha <= 0.02) {
            rings.splice(i, 1);
            continue;
        }

        ctx.strokeStyle = `hsla(${ring.hue}, 80%, 65%, ${ring.alpha})`;
        ctx.lineWidth = 1.5 + (1 - progress) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Centered pulsing glow
    const dotR = 5 + bass * 8;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotR + 10);
    gradient.addColorStop(0, `hsla(${hue}, 100%, 80%, ${0.6 + energy * 0.4})`);
    gradient.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR + 10, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting satellites
    const numDots = 8;
    for (let i = 0; i < numDots; i++) {
        const idx = Math.floor((i / numDots) * dataArray.length);
        const value = ((dataArray[idx] ?? 0) / 255) * sensitivityMultiplier;
        const angle = (i / numDots) * Math.PI * 2 + now * 0.001;
        const orbitR = 10 + value * (maxR * 0.4);
        const dx = cx + Math.cos(angle) * orbitR;
        const dy = cy + Math.sin(angle) * orbitR;
        const dotHue = hue + (i / numDots) * 60;

        ctx.fillStyle = `hsla(${dotHue}, 90%, 70%, ${0.3 + value * 0.5})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 2 + value * 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ─── Reactive Calculations ─────────────────────────
function updateReactiveState() {
    if (!dataArray || dataArray.length === 0) return;

    const len = dataArray.length;

    // Filter frequency bands
    let bassSum = 0, midsSum = 0, trebleSum = 0;
    for (let i = 0; i < Math.min(8, len); i++) bassSum += dataArray[i];
    for (let i = 8; i < Math.min(32, len); i++) midsSum += dataArray[i];
    for (let i = 32; i < len; i++) trebleSum += dataArray[i];

    const rawBass = bassSum / (8 * 255);
    const rawMids = midsSum / (24 * 255);
    const rawTreble = trebleSum / ((len - 32) * 255);

    smoothBass = smoothBass * SMOOTH + rawBass * (1 - SMOOTH);
    smoothMids = smoothMids * SMOOTH + rawMids * (1 - SMOOTH);
    smoothTreble = smoothTreble * SMOOTH + rawTreble * (1 - SMOOTH);

    // Calculate energy root-mean-square
    let total = 0;
    for (let i = 0; i < len; i++) {
        total += (dataArray[i] / 255) ** 2;
    }
    const rawEnergy = Math.sqrt(total / len);
    smoothEnergy = smoothEnergy * SMOOTH + rawEnergy * (1 - SMOOTH);

    // Beat detection
    const now = performance.now();
    const energyDelta = rawBass - prevEnergy;
    prevEnergy = rawBass;

    isBeat = false;
    if (energyDelta > BEAT_THRESHOLD && (now - lastBeat) > BEAT_COOLDOWN_MS) {
        isBeat = true;
        lastBeat = now;
    }

    // Color/Hue transition
    const bandTotal = smoothBass + smoothMids + smoothTreble + 0.001;
    hue = Math.round(
        (smoothBass / bandTotal) * 15 +
        (smoothMids / bandTotal) * 180 +
        (smoothTreble / bandTotal) * 280
    );

    energy = smoothEnergy;
    bass = smoothBass;
}

// ─── Core Render Loop ──────────────────────────────
function render() {
    requestAnimationFrame(render);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(waveArray);
        updateReactiveState();
    }

    switch (currentStyle) {
        case 'bars':
            drawBars(w, h);
            break;
        case 'eq':
            drawEqualizer(w, h);
            break;
        case 'wave':
        case 'oscilloscope':
            drawOscilloscope(w, h);
            break;
        case 'pulse':
        case 'neural':
            drawNeuralPulse(w, h);
            break;
        default:
            drawBars(w, h);
    }
}

// ─── Audio Input Initialization ────────────────────
function initAudio() {
    if (audioCtx) return; // Prevent double init

    // Try to list devices first to see if permissions are already granted and labels are visible
    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            const hasLabels = audioDevices.some(d => d.label && d.label.length > 0);

            if (hasLabels) {
                console.log("Audio device labels available directly. Discovered devices:", audioDevices.map(d => `${d.label} (${d.deviceId})`));
                const targetDevice = audioDevices.find(d => 
                    d.label && (
                        d.label.toLowerCase().includes('hdmi') || 
                        d.label.toLowerCase().includes('ad103') || 
                        d.label.toLowerCase().includes('7.1')
                    )
                ) || (audioDevices.length >= 3 ? audioDevices[2] : null);

                const constraints = targetDevice 
                    ? { 
                        audio: { 
                            deviceId: { exact: targetDevice.deviceId },
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false,
                            channelCount: { ideal: 8 }
                        }, 
                        video: false 
                      }
                    : { 
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false,
                            channelCount: { ideal: 8 }
                        }, 
                        video: false 
                      };

                if (targetDevice) {
                    console.log("Selecting HDMI 7.1 target device directly:", targetDevice.label, "ID:", targetDevice.deviceId);
                } else {
                    console.log("No target device matched directly. Using default stream constraints.");
                }
                return navigator.mediaDevices.getUserMedia(constraints);
            } else {
                // Request initial stream to grant/trigger permission, then select device
                console.log("Audio device labels empty. Requesting permission stream first...");
                return navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        channelCount: { ideal: 8 }
                    }, 
                    video: false 
                })
                    .then(initialStream => {
                        return navigator.mediaDevices.enumerateDevices()
                            .then(newDevices => {
                                console.log("Discovered devices post-permission:", newDevices.map(d => `${d.kind}: ${d.label} (${d.deviceId})`));
                                const newAudioDevices = newDevices.filter(d => d.kind === 'audioinput');
                                console.log("Audio input devices found:", newAudioDevices.map(d => `${d.label} (${d.deviceId})`));
                                const targetDevice = newAudioDevices.find(d => 
                                    d.label && (
                                        d.label.toLowerCase().includes('hdmi') || 
                                        d.label.toLowerCase().includes('ad103') || 
                                        d.label.toLowerCase().includes('7.1')
                                    )
                                ) || (newAudioDevices.length >= 3 ? newAudioDevices[2] : null);

                                if (targetDevice) {
                                    console.log("Found target device:", targetDevice.label, "ID:", targetDevice.deviceId);
                                    const activeTrack = initialStream.getAudioTracks()[0];
                                    const activeSettings = activeTrack ? activeTrack.getSettings() : {};
                                    
                                    if (activeSettings.deviceId !== targetDevice.deviceId) {
                                        console.log("Switching input to target device:", targetDevice.label);
                                        if (activeTrack) activeTrack.stop();
                                        
                                        return navigator.mediaDevices.getUserMedia({
                                            audio: { 
                                                deviceId: { exact: targetDevice.deviceId },
                                                echoCancellation: false,
                                                noiseSuppression: false,
                                                autoGainControl: false,
                                                channelCount: { ideal: 8 }
                                            },
                                            video: false
                                        });
                                    }
                                } else {
                                    console.log("No target device matched (no HDMI/AD103/7.1 or < 3 devices). Using default stream.");
                                }
                                return initialStream;
                            });
                    });
            }
        })
        .then(stream => {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            
            // Set FFT size from select or saved resolution
            const fftSelect = document.getElementById('fftSelect');
            const savedResolution = localStorage.getItem('visualizer-resolution');
            analyser.fftSize = savedResolution ? parseInt(savedResolution) : (fftSelect ? parseInt(fftSelect.value) : 512);
            
            // Set smoothing from slider or saved smoothing
            const smoothingSlider = document.getElementById('smoothingSlider');
            const savedSmoothing = localStorage.getItem('visualizer-smoothing');
            analyser.smoothingTimeConstant = savedSmoothing ? parseFloat(savedSmoothing) : (smoothingSlider ? parseFloat(smoothingSlider.value) : 0.5);
            
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            waveArray = new Uint8Array(bufferLength);
            
            source.connect(analyser);
            
            console.log("🔊 Desktop Audio Analyser started successfully!");
            render();
        })
        .catch(err => {
            console.error("❌ Audio capture blocked or failed:", err);
            // Render basic offline wave
            dataArray = new Uint8Array(256);
            waveArray = new Uint8Array(256);
            for(let i=0; i<256; i++) waveArray[i] = 128;
            render();
        });
}

// ─── Controls Menu & JS-Python Bridge ────────────────
let menuOpen = false;

// Update visibility of style-specific settings controls
function updateControlsVisibility() {
    const smoothingGroup = document.getElementById('smoothingGroup');
    if (smoothingGroup) {
        if (currentStyle === 'wave' || currentStyle === 'oscilloscope') {
            smoothingGroup.style.display = 'none';
        } else {
            smoothingGroup.style.display = 'flex';
        }
    }
}

// Toggle display state of the controls settings menu
function toggleMenu(forceState) {
    menuOpen = (forceState !== undefined) ? forceState : !menuOpen;
    const menuEl = document.getElementById('controlsMenu');
    
    const heightParam = parseInt(urlParams.get('height') || '45');
    menuEl.style.bottom = `${heightParam + 5}px`;
    menuEl.style.display = menuOpen ? 'block' : 'none';
    
    // Notify python wrapper of the state change to resize window and adjust input shape
    document.title = JSON.stringify({
        action: "menu-toggle",
        open: menuOpen
    });
}

// Initialize controls on load
window.addEventListener('load', () => {
    // Load persisted settings from localStorage
    const savedStyle = localStorage.getItem('visualizer-style');
    if (savedStyle) {
        currentStyle = savedStyle;
    }
    const savedSensitivity = localStorage.getItem('visualizer-sensitivity');
    if (savedSensitivity) {
        sensitivityMultiplier = parseFloat(savedSensitivity);
    }
    const savedScanlines = localStorage.getItem('visualizer-scanlines');
    if (savedScanlines) {
        document.body.style.setProperty('--scanlines-opacity', savedScanlines);
    }

    // Attempt initialization automatically
    initAudio();

    // Setup visualizer height styling from query parameters
    const heightParam = parseInt(urlParams.get('height') || '45');
    canvas.style.height = `${heightParam}px`;
    
    const trigger = document.getElementById('controlsTrigger');
    trigger.style.height = `${heightParam}px`;

    // Populate active device label from query params
    const rawDevice = urlParams.get('device') || 'Default';
    const deviceLabel = document.getElementById('deviceLabel');
    if (deviceLabel) {
        // Shorten device name for display
        const displayDevice = rawDevice.split('.').pop() || rawDevice;
        deviceLabel.innerText = `Source: ${displayDevice}`;
    }

    // Pre-select current style in dropdown and update visibility
    const styleSelect = document.getElementById('styleSelect');
    if (styleSelect) {
        styleSelect.value = currentStyle;
        styleSelect.addEventListener('change', (e) => {
            currentStyle = e.target.value;
            localStorage.setItem('visualizer-style', currentStyle);
            updateControlsVisibility();
        });
    }
    updateControlsVisibility();

    // Sensitivity / Gain slider listener
    const gainSlider = document.getElementById('gainSlider');
    if (gainSlider) {
        gainSlider.value = sensitivityMultiplier;
        gainSlider.addEventListener('input', (e) => {
            sensitivityMultiplier = parseFloat(e.target.value);
            localStorage.setItem('visualizer-sensitivity', e.target.value);
        });
    }

    // Smoothing slider listener
    const smoothingSlider = document.getElementById('smoothingSlider');
    if (smoothingSlider) {
        const savedSmoothing = localStorage.getItem('visualizer-smoothing');
        if (savedSmoothing) smoothingSlider.value = savedSmoothing;
        smoothingSlider.addEventListener('input', (e) => {
            if (analyser) {
                analyser.smoothingTimeConstant = parseFloat(e.target.value);
            }
            localStorage.setItem('visualizer-smoothing', e.target.value);
        });
    }

    // Scanlines opacity slider listener
    const scanlinesSlider = document.getElementById('scanlinesSlider');
    if (scanlinesSlider) {
        const savedScanlines = localStorage.getItem('visualizer-scanlines');
        if (savedScanlines) scanlinesSlider.value = savedScanlines;
        scanlinesSlider.addEventListener('input', (e) => {
            document.body.style.setProperty('--scanlines-opacity', parseFloat(e.target.value));
            localStorage.setItem('visualizer-scanlines', e.target.value);
        });
    }

    // Resolution / FFT size dropdown listener
    const fftSelect = document.getElementById('fftSelect');
    if (fftSelect) {
        const savedResolution = localStorage.getItem('visualizer-resolution');
        if (savedResolution) fftSelect.value = savedResolution;
        fftSelect.addEventListener('change', (e) => {
            const newFftSize = parseInt(e.target.value);
            if (analyser && analyser.fftSize !== newFftSize) {
                analyser.fftSize = newFftSize;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                waveArray = new Uint8Array(bufferLength);
            }
            localStorage.setItem('visualizer-resolution', e.target.value);
        });
    }

    // Toggle menu click listener
    if (trigger) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    // Close button click listener
    const closeBtn = document.getElementById('closeButton');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.title = JSON.stringify({ action: "close" });
        });
    }

    // Close menu when clicking outside of it
    document.addEventListener('click', (e) => {
        const menuEl = document.getElementById('controlsMenu');
        if (menuOpen && menuEl && !menuEl.contains(e.target) && e.target !== trigger) {
            toggleMenu(false);
        }
    });
});

