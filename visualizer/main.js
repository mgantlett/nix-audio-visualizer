// Web Audio API & Canvas Visualizer
// Ported from sophia-core (visualizations.ts, useMusicReactive.ts)

const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

// Read current style from query parameter (default: bars)
const urlParams = new URLSearchParams(window.location.search);
let currentStyle = urlParams.get('style') || 'bars'; // 'bars', 'eq', 'wave', 'pulse'

// Unified Style-Specific Configurations mapping
const styleSettings = {
    bars: {
        theme: 'cyberpunk',
        sensitivity: 1.0,
        smoothing: 0.5,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.45,
        // Style-specific
        barsCount: 64,
        barGap: 2,
        peakDecay: 0.99
    },
    eq: {
        theme: 'cyberpunk',
        sensitivity: 1.0,
        smoothing: 0.5,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.45,
        // Style-specific
        eqColumns: 24,
        segHeight: 4,
        segGap: 2
    },
    wave: {
        theme: 'cyberpunk',
        sensitivity: 1.0,
        smoothing: 0.5,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.45,
        // Style-specific
        lineWidth: 2.5,
        glowIntensity: 0.6
    },
    pulse: {
        theme: 'cyberpunk',
        sensitivity: 1.0,
        smoothing: 0.5,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.45,
        // Style-specific
        orbiters: 8,
        ringSpeed: 1.5
    }
};

// Global active parameter state variables (mapped from active style configuration)
let currentTheme = 'cyberpunk';
let sensitivityMultiplier = 1.0;
let smoothingValue = 0.5;
let minDecibelsValue = -90;
let beatThresholdValue = 0.45;
let fftSizeValue = 512;

// Style-specific state variables
let barsCount = 64;
let barGap = 2;
let peakDecay = 0.99;
let eqColumns = 24;
let segHeight = 4;
let segGap = 2;
let oscLineWidth = 2.5;
let oscGlowIntensity = 0.6;
let orbiterCount = 8;
let ringSpeed = 1.5;

let isSuppressingEvents = false;
const varSetters = {
    theme: v => { currentTheme = v; },
    sensitivity: v => { sensitivityMultiplier = v; },
    smoothing: v => { smoothingValue = v; },
    resolution: v => { fftSizeValue = v; },
    minDb: v => { minDecibelsValue = v; },
    beatSense: v => { beatThresholdValue = v; },
    barsCount: v => { barsCount = v; },
    barGap: v => { barGap = v; },
    peakDecay: v => { peakDecay = v; },
    eqColumns: v => { eqColumns = v; },
    segHeight: v => { segHeight = v; },
    segGap: v => { segGap = v; },
    lineWidth: v => { oscLineWidth = v; },
    glowIntensity: v => { oscGlowIntensity = v; },
    orbiters: v => { orbiterCount = v; },
    ringSpeed: v => { ringSpeed = v; }
};

// State objects
let audioCtx = null;
let analyser = null;
let dataArray = null;
let waveArray = null;

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
const BEAT_COOLDOWN_MS = 150;

// Auto-Gain Control (AGC) state for bars/eq
let peakLevel = 0.5;

// Save current settings dictionary to localStorage
function saveAllSettings() {
    localStorage.setItem('visualizer-all-style-settings', JSON.stringify(styleSettings));
}

// Update peak level for Auto-Gain Control (AGC) with dynamic decay
function updatePeak(frameMax) {
    if (frameMax > peakLevel) {
        peakLevel = frameMax;
    } else {
        peakLevel *= peakDecay;
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

// Returns HSLA color string based on current theme, ratio, value, and alpha
function getThemeColor(ratio, value, alpha = 1.0) {
    switch (currentTheme) {
        case 'matrix':
            return `hsla(120, 100%, ${40 + value * 30}%, ${alpha})`;
        case 'neon':
            const neonHue = 280 + ratio * 60;
            return `hsla(${neonHue}, 100%, ${55 + value * 20}%, ${alpha})`;
        case 'volcano':
            const volc = ratio * 50; // Red to Orange-Yellow
            return `hsla(${volc}, 100%, ${50 + value * 25}%, ${alpha})`;
        case 'monochrome':
            return `hsla(0, 0%, ${60 + value * 40}%, ${alpha})`;
        case 'cyberpunk':
        default:
            const cyber = 180 + ratio * 120; // Cyan to Magenta
            return `hsla(${cyber}, 90%, ${50 + value * 20}%, ${alpha})`;
    }
}

// Returns the static base theme hue or dynamic audio reactive hue
function getBaseHue() {
    switch (currentTheme) {
        case 'matrix': return 120;
        case 'neon': return 300;
        case 'volcano': return 15;
        case 'monochrome': return 0;
        case 'cyberpunk':
        default:
            return hue; // use audio reactive hue
    }
}

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
    const bars = Math.min(dataArray.length, barsCount);
    const barWidth = width / bars;
    const gap = barGap;

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

        const alpha = 0.2 + value * 0.8;
        ctx.fillStyle = getThemeColor(i / bars, value, alpha);
        ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);

        // Fast layered glow highlight (replaces shadowBlur)
        if (value > 0.8) {
            ctx.fillStyle = getThemeColor(i / bars, 1.0, 0.12);
            ctx.fillRect(x + gap / 2 - 2, y - 2, barWidth - gap + 4, barHeight + 2);
            ctx.fillStyle = getThemeColor(i / bars, 1.0, 0.25);
            ctx.fillRect(x + gap / 2 - 1, y - 1, barWidth - gap + 2, barHeight + 1);
        }
    }
}

// ─── Style 2: LED Equalizer ────────────────────────
function drawEqualizer(width, height) {
    const bars = eqColumns;
    const barWidth = width / bars;
    const gap = 3;
    const segmentHeight = segHeight;
    const segmentGap = segGap;
    const totalSegments = Math.max(2, Math.floor(height / (segmentHeight + segmentGap)));

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
                const brightness = 0.7 + (s === litSegments - 1 ? 0.3 : 0);
                
                // If it is the default Cyberpunk theme, we can optionally use the custom green/yellow/red gradient
                if (currentTheme === 'cyberpunk') {
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
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
                    ctx.fillRect(x, y, w, segmentHeight);
                    
                    // Top segment highlight glow
                    if (s === litSegments - 1 && segRatio > 0.6) {
                        ctx.fillStyle = `rgba(${r}, ${g}, 0, 0.3)`;
                        ctx.fillRect(x - 1, y - 1, w + 2, segmentHeight + 2);
                    }
                } else {
                    ctx.fillStyle = getThemeColor(i / bars, segRatio, brightness);
                    ctx.fillRect(x, y, w, segmentHeight);
                    if (s === litSegments - 1 && segRatio > 0.6) {
                        ctx.fillStyle = getThemeColor(i / bars, segRatio, 0.3);
                        ctx.fillRect(x - 1, y - 1, w + 2, segmentHeight + 2);
                    }
                }
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.fillRect(x, y, w, segmentHeight);
            }
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

    const activeHue = getBaseHue();
    const sat = currentTheme === 'monochrome' ? '0%' : '80%';
    const satActive = currentTheme === 'monochrome' ? '0%' : '90%';
    const satGlow = currentTheme === 'monochrome' ? '0%' : '100%';

    // Thick glow background line (replaces shadowBlur)
    ctx.strokeStyle = `hsla(${activeHue}, ${sat}, 60%, ${0.12 * oscGlowIntensity})`;
    ctx.lineWidth = 2.5 + oscGlowIntensity * 5;
    ctx.beginPath();
    drawWavePath(width, mid, height);
    ctx.stroke();

    // Medium glow line
    ctx.strokeStyle = `hsla(${activeHue}, ${sat}, 60%, ${0.25 * oscGlowIntensity})`;
    ctx.lineWidth = 2.5 + oscGlowIntensity * 2;
    ctx.beginPath();
    drawWavePath(width, mid, height);
    ctx.stroke();

    // Foreground sharp line
    ctx.strokeStyle = `hsla(${activeHue}, ${satActive}, ${55 + energy * 20}%, 0.9)`;
    ctx.lineWidth = oscLineWidth;
    ctx.beginPath();
    drawWavePath(width, mid, height);
    ctx.stroke();

    // Zero-crossing dots
    if (isBeat) {
        ctx.fillStyle = `hsla(${activeHue}, ${satGlow}, 80%, 0.8)`;
        for (let i = 1; i < waveArray.length; i += 2) {
            const prev = (waveArray[i - 1] - 128) / 128;
            const curr = (waveArray[i] - 128) / 128;
            if ((prev <= 0 && curr > 0) || (prev >= 0 && curr < 0)) {
                const x = (i / waveArray.length) * width;
                ctx.beginPath();
                ctx.arc(x, mid, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Draw the actual curved wave path based on audio buffer samples
function drawWavePath(width, mid, height) {
    // Search for zero-crossing to stabilize wave horizontally (optimized step size of 2)
    let triggerIndex = 0;
    for (let i = 0; i < waveArray.length / 2; i += 2) {
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

    const activeHue = getBaseHue();
    const sat = currentTheme === 'monochrome' ? '0%' : '80%';
    const satCenter = currentTheme === 'monochrome' ? '0%' : '100%';

    if (isBeat && (now - lastRingTime) > 150) {
        rings.push({
            radius: 2,
            maxRadius: maxR,
            hue: activeHue + (Math.random() - 0.5) * 30,
            alpha: 0.8 + energy * 0.2,
            birth: now,
        });
        lastRingTime = now;
        while (rings.length > 12) rings.shift();
    }

    for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        const age = (now - ring.birth) / 1000;
        const progress = Math.min(age * ringSpeed, 1);
        ring.radius = 2 + progress * ring.maxRadius;
        ring.alpha = (1 - progress) * 0.7;

        if (ring.alpha <= 0.02) {
            rings.splice(i, 1);
            continue;
        }

        ctx.strokeStyle = `hsla(${ring.hue}, ${sat}, 65%, ${ring.alpha})`;
        ctx.lineWidth = 1.5 + (1 - progress) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Centered pulsing glow
    const dotR = 5 + bass * 8;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotR + 10);
    gradient.addColorStop(0, `hsla(${activeHue}, ${satCenter}, 80%, ${0.6 + energy * 0.4})`);
    gradient.addColorStop(1, `hsla(${activeHue}, ${satCenter}, 60%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR + 10, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting satellites
    const numDots = orbiterCount;
    for (let i = 0; i < numDots; i++) {
        const idx = Math.floor((i / numDots) * dataArray.length);
        const value = ((dataArray[idx] ?? 0) / 255) * sensitivityMultiplier;
        const angle = (i / numDots) * Math.PI * 2 + now * 0.001;
        const orbitR = 10 + value * (maxR * 0.4);
        const dx = cx + Math.cos(angle) * orbitR;
        const dy = cy + Math.sin(angle) * orbitR;
        const dotHue = activeHue + (i / numDots) * 60;

        const satDot = currentTheme === 'monochrome' ? '0%' : '90%';
        ctx.fillStyle = `hsla(${dotHue}, ${satDot}, 70%, ${0.3 + value * 0.5})`;
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
    if (energyDelta > beatThresholdValue && (now - lastBeat) > BEAT_COOLDOWN_MS) {
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

// Helper to formulate audio constraints depending on device matching
function getAudioConstraints(devices) {
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    const targetDevice = audioDevices.find(d => 
        d.label && (
            d.label.toLowerCase().includes('hdmi') || 
            d.label.toLowerCase().includes('ad103') || 
            d.label.toLowerCase().includes('7.1')
        )
    ) || (audioDevices.length >= 3 ? audioDevices[2] : null);

    const isSurround = targetDevice && targetDevice.label && (
        targetDevice.label.toLowerCase().includes('hdmi') || 
        targetDevice.label.toLowerCase().includes('ad103') || 
        targetDevice.label.toLowerCase().includes('7.1')
    );

    const constraints = targetDevice 
        ? { 
            audio: { 
                deviceId: { exact: targetDevice.deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: { ideal: isSurround ? 8 : 2 }
            }, 
            video: false 
          }
        : { 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: { ideal: 2 }
            }, 
            video: false 
          };

    return { constraints, targetDevice };
}

// ─── Audio Input Initialization ────────────────────
function initAudio() {
    if (audioCtx) return; // Prevent double init

    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            const hasLabels = audioDevices.some(d => d.label && d.label.length > 0);

            if (hasLabels) {
                console.log("Audio device labels available directly. Discovered devices:", audioDevices.map(d => `${d.label} (${d.deviceId})`));
                const { constraints, targetDevice } = getAudioConstraints(audioDevices);

                if (targetDevice) {
                    console.log("Selecting target device:", targetDevice.label, "ID:", targetDevice.deviceId);
                } else {
                    console.log("No target device matched directly. Using default stream constraints.");
                }
                return navigator.mediaDevices.getUserMedia(constraints);
            } else {
                console.log("Audio device labels empty. Requesting permission stream first...");
                return navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        channelCount: { ideal: 2 }
                    }, 
                    video: false 
                })
                    .then(initialStream => {
                        return navigator.mediaDevices.enumerateDevices()
                            .then(newDevices => {
                                console.log("Discovered devices post-permission:", newDevices.map(d => `${d.kind}: ${d.label} (${d.deviceId})`));
                                const newAudioDevices = newDevices.filter(d => d.kind === 'audioinput');
                                const { constraints, targetDevice } = getAudioConstraints(newAudioDevices);

                                if (targetDevice) {
                                    console.log("Found target device:", targetDevice.label, "ID:", targetDevice.deviceId);
                                    const activeTrack = initialStream.getAudioTracks()[0];
                                    const activeSettings = activeTrack ? activeTrack.getSettings() : {};
                                    
                                    if (activeSettings.deviceId !== targetDevice.deviceId) {
                                        console.log("Switching input to target device:", targetDevice.label);
                                        if (activeTrack) activeTrack.stop();
                                        return navigator.mediaDevices.getUserMedia(constraints);
                                    }
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
            
            // Set initial state from variables/loads
            analyser.fftSize = fftSizeValue;
            analyser.smoothingTimeConstant = smoothingValue;
            analyser.minDecibels = minDecibelsValue;
            
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            waveArray = new Uint8Array(bufferLength);
            
            source.connect(analyser);
            
            console.log("🔊 Desktop Audio Analyser started successfully!");
            render();
        })
        .catch(err => {
            console.error("❌ Audio capture blocked or failed:", err);
            dataArray = new Uint8Array(256);
            waveArray = new Uint8Array(256);
            for(let i=0; i<256; i++) waveArray[i] = 128;
            render();
        });
}

// ─── Controls Menu & JS-Python Bridge ────────────────
let menuOpen = false;

// Function to update the menu height and notify python
function updateMenuHeight() {
    const menuEl = document.getElementById('controlsMenu');
    if (!menuEl || !menuOpen) return;
    const menuHeight = menuEl.offsetHeight;
    document.title = JSON.stringify({
        action: "menu-resize",
        menuHeight: menuHeight
    });
}

// Helper to get active style lookup key
function getLookupStyle() {
    let lookupStyle = currentStyle;
    if (lookupStyle === 'oscilloscope') lookupStyle = 'wave';
    if (lookupStyle === 'neural') lookupStyle = 'pulse';
    return lookupStyle;
}

// Apply settings configuration for the active style and update sliders
function applyStyleSettings() {
    isSuppressingEvents = true;
    try {
        const lookupStyle = getLookupStyle();
        const config = styleSettings[lookupStyle];
        if (!config) return;

        // Apply config values to global state variables dynamically
        for (const key in config) {
            if (varSetters[key]) {
                varSetters[key](config[key]);
            }
        }

        // Apply values to analyser context if running
        if (analyser) {
            analyser.fftSize = fftSizeValue;
            analyser.smoothingTimeConstant = smoothingValue;
            analyser.minDecibels = minDecibelsValue;
            // If fftSize changed, resize the buffers
            const bufferLength = analyser.frequencyBinCount;
            if (!dataArray || dataArray.length !== bufferLength) {
                dataArray = new Uint8Array(bufferLength);
                waveArray = new Uint8Array(bufferLength);
            }
        }

        // Set scanlines opacity in style
        document.body.style.setProperty('--scanlines-opacity', config.scanlines);

        // Update UI controls to match
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = currentTheme;

        const gainSlider = document.getElementById('gainSlider');
        if (gainSlider) gainSlider.value = sensitivityMultiplier;

        const smoothingSlider = document.getElementById('smoothingSlider');
        if (smoothingSlider) smoothingSlider.value = smoothingValue;

        const scanlinesSlider = document.getElementById('scanlinesSlider');
        if (scanlinesSlider) scanlinesSlider.value = config.scanlines;

        const fftSelect = document.getElementById('fftSelect');
        if (fftSelect) fftSelect.value = fftSizeValue;

        const dbSlider = document.getElementById('dbSlider');
        if (dbSlider) dbSlider.value = minDecibelsValue;

        const beatSlider = document.getElementById('beatSlider');
        if (beatSlider) beatSlider.value = beatThresholdValue;

        // Style-specific UI controls
        const barsSlider = document.getElementById('barsSlider');
        if (barsSlider) barsSlider.value = barsCount;

        const barGapSlider = document.getElementById('barGapSlider');
        if (barGapSlider) barGapSlider.value = barGap;

        const decaySlider = document.getElementById('decaySlider');
        if (decaySlider) decaySlider.value = peakDecay;

        const eqColumnsSlider = document.getElementById('eqColumnsSlider');
        if (eqColumnsSlider) eqColumnsSlider.value = eqColumns;

        const segHeightSlider = document.getElementById('segHeightSlider');
        if (segHeightSlider) segHeightSlider.value = segHeight;

        const segGapSlider = document.getElementById('segGapSlider');
        if (segGapSlider) segGapSlider.value = segGap;

        const lineWidthSlider = document.getElementById('lineWidthSlider');
        if (lineWidthSlider) lineWidthSlider.value = oscLineWidth;

        const glowSlider = document.getElementById('glowSlider');
        if (glowSlider) glowSlider.value = oscGlowIntensity;

        const orbitersSlider = document.getElementById('orbitersSlider');
        if (orbitersSlider) orbitersSlider.value = orbiterCount;

        const ringSpeedSlider = document.getElementById('ringSpeedSlider');
        if (ringSpeedSlider) ringSpeedSlider.value = ringSpeed;
    } finally {
        isSuppressingEvents = false;
    }
}

// Update visibility of style-specific settings controls
function updateControlsVisibility() {
    const styleSettingsDivs = document.querySelectorAll('.style-setting');
    styleSettingsDivs.forEach(el => el.style.display = 'none');

    const smoothingGroup = document.getElementById('smoothingGroup');
    if (smoothingGroup) {
        if (currentStyle === 'wave' || currentStyle === 'oscilloscope') {
            smoothingGroup.style.display = 'none';
        } else {
            smoothingGroup.style.display = 'flex';
        }
    }

    if (currentStyle === 'bars') {
        const el = document.querySelector('.bars-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'eq') {
        const el = document.querySelector('.eq-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'wave' || currentStyle === 'oscilloscope') {
        const el = document.querySelector('.wave-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'pulse' || currentStyle === 'neural') {
        const el = document.querySelector('.pulse-setting');
        if (el) el.style.display = 'block';
    }

    // Apply exact settings mapping for the active style
    applyStyleSettings();

    // Let display settle then measure and adjust window height
    setTimeout(() => {
        updateMenuHeight();
    }, 50);
}

// Toggle display state of the controls settings menu
function toggleMenu(forceState) {
    menuOpen = (forceState !== undefined) ? forceState : !menuOpen;
    const menuEl = document.getElementById('controlsMenu');
    
    const heightParam = parseInt(urlParams.get('height') || '45');
    menuEl.style.bottom = `${heightParam + 5}px`;
    menuEl.style.display = menuOpen ? 'block' : 'none';
    
    const menuHeight = menuEl.offsetHeight || 250;
    
    // Notify python wrapper of the state change to resize window and adjust input shape
    document.title = JSON.stringify({
        action: "menu-toggle",
        open: menuOpen,
        menuHeight: menuHeight
    });
}

// Initialize controls on load
window.addEventListener('load', () => {
    // Load persisted configurations map from localStorage
    const savedAll = localStorage.getItem('visualizer-all-style-settings');
    if (savedAll) {
        try {
            const parsed = JSON.parse(savedAll);
            for (let style in parsed) {
                if (styleSettings[style]) {
                    Object.assign(styleSettings[style], parsed[style]);
                }
            }
        } catch (e) {
            console.error("Failed to parse visualizer configurations:", e);
        }
    }

    // Load active style state from localStorage
    const savedStyle = localStorage.getItem('visualizer-style');
    if (savedStyle) currentStyle = savedStyle;

    // Apply active style configuration
    applyStyleSettings();

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

    // Event listeners setup
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

    // Setup inputs mapping helper to register change listeners dynamically
    const inputs = [
        { id: 'themeSelect', key: 'theme', type: 'change', parse: v => v },
        { id: 'gainSlider', key: 'sensitivity', type: 'input', parse: parseFloat },
        { id: 'smoothingSlider', key: 'smoothing', type: 'input', parse: parseFloat, cb: v => { if (analyser) analyser.smoothingTimeConstant = v; } },
        { id: 'scanlinesSlider', key: 'scanlines', type: 'input', parse: parseFloat, cb: v => document.body.style.setProperty('--scanlines-opacity', v) },
        { id: 'fftSelect', key: 'resolution', type: 'change', parse: parseInt, cb: v => {
            if (analyser && analyser.fftSize !== v) {
                analyser.fftSize = v;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                waveArray = new Uint8Array(bufferLength);
            }
        }},
        { id: 'dbSlider', key: 'minDb', type: 'input', parse: parseFloat, cb: v => { if (analyser) analyser.minDecibels = v; } },
        { id: 'beatSlider', key: 'beatSense', type: 'input', parse: parseFloat },
        // Style-specific inputs
        { id: 'barsSlider', key: 'barsCount', type: 'input', parse: parseInt, style: 'bars' },
        { id: 'barGapSlider', key: 'barGap', type: 'input', parse: parseInt, style: 'bars' },
        { id: 'decaySlider', key: 'peakDecay', type: 'input', parse: parseFloat, style: 'bars' },
        { id: 'eqColumnsSlider', key: 'eqColumns', type: 'input', parse: parseInt, style: 'eq' },
        { id: 'segHeightSlider', key: 'segHeight', type: 'input', parse: parseInt, style: 'eq' },
        { id: 'segGapSlider', key: 'segGap', type: 'input', parse: parseInt, style: 'eq' },
        { id: 'lineWidthSlider', key: 'lineWidth', type: 'input', parse: parseFloat, style: 'wave' },
        { id: 'glowSlider', key: 'glowIntensity', type: 'input', parse: parseFloat, style: 'wave' },
        { id: 'orbitersSlider', key: 'orbiters', type: 'input', parse: parseInt, style: 'pulse' },
        { id: 'ringSpeedSlider', key: 'ringSpeed', type: 'input', parse: parseFloat, style: 'pulse' }
    ];

    inputs.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.addEventListener(item.type, (e) => {
                if (isSuppressingEvents) return;
                const val = item.parse(e.target.value);
                const targetStyle = item.style || getLookupStyle();
                styleSettings[targetStyle][item.key] = val;
                
                // Keep global cache sync variables updated for the active style
                if (targetStyle === getLookupStyle() && varSetters[item.key]) {
                    varSetters[item.key](val);
                }
                
                if (item.cb) item.cb(val);
                saveAllSettings();
            });
        }
    });

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
