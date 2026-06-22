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

// Auto-Gain Control (AGC) state
let peakLevel = 0.5;
const PEAK_DECAY = 0.99;

function updatePeak(frameMax) {
    if (frameMax > peakLevel) {
        peakLevel = frameMax;
    } else {
        peakLevel *= PEAK_DECAY;
    }
    peakLevel = Math.max(peakLevel, 0.1); // Floor to avoid division by zero
}

// Fit canvas to window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
        const value = Math.min(1.0, rawValue / (peakLevel * 1.0));
        
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
        const value = Math.min(1.0, rawValue / (peakLevel * 1.0));
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

function drawWavePath(width, mid, height) {
    const step = width / waveArray.length;
    ctx.moveTo(0, mid);
    for (let i = 0; i < waveArray.length; i++) {
        const sample = (waveArray[i] - 128) / 128;
        const y = mid + sample * (height * 0.45);
        if (i === 0) {
            ctx.moveTo(0, y);
        } else {
            const prevX = (i - 1) * step;
            const x = i * step;
            const cpX = prevX + (x - prevX) / 2;
            const prevSample = (waveArray[i - 1] - 128) / 128;
            const prevY = mid + prevSample * (height * 0.45);
            ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
    }
}

// ─── Style 4: Neural Pulse (Circular Ripples) ──────
const rings = [];
let lastRingTime = 0;

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
        const value = (dataArray[idx] ?? 0) / 255;
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

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.5;
            
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

// Initialize on page load
window.addEventListener('load', () => {
    // Attempt initialization automatically
    // (WebKitGTK does not require user gestures if audio permissions are granted programmatically)
    initAudio();
});

// Fallback: Click to trigger in standard browsers due to autoplay restrictions
document.body.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    } else {
        initAudio();
    }
});
