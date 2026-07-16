// Web Audio API & Canvas Visualizer
// Ported from sophia-core (visualizations.ts, useMusicReactive.ts)

const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

// Read current style from query parameter (default: bars)
const urlParams = new URLSearchParams(window.location.search);
let currentStyle = urlParams.get('style') || 'bars'; // 'bars', 'eq', 'wave', 'pulse'
const currentPosition = urlParams.get('position') || 'bottom';
const isVertical = currentPosition === 'left' || currentPosition === 'right';
let helpOpen = false;
let toggleHelp = null;
const isLeft = currentPosition === 'left';
const isRight = currentPosition === 'right';
const visThickness = parseInt(urlParams.get('height') || '45');
let hudShow = true;
let hudTheme = 'green-lcd';

// Unified Style-Specific Configurations mapping
const styleSettings = {
    bars: {
        theme: 'cyberpunk',
        sensitivity: 1.2,
        smoothing: 0.55,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        barsCount: 64,
        barGap: 2,
        peakDecay: 0.975
    },
    eq: {
        theme: 'cyberpunk',
        sensitivity: 1.2,
        smoothing: 0.55,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
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
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        lineWidth: 2.5,
        glowIntensity: 0.6
    },
    vectorscope: {
        theme: 'cyberpunk',
        sensitivity: 1.0,
        smoothing: 0.5,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        lineWidth: 2.5,
        glowIntensity: 0.6
    },

    pulse: {
        theme: 'cyberpunk',
        sensitivity: 1.2,
        smoothing: 0.55,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        orbiters: 8,
        ringSpeed: 1.5
    },
    vu: {
        theme: 'cyberpunk',
        sensitivity: 1.5,
        smoothing: 0.3,
        scanlines: 0.35,
        resolution: 256,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        vuSegments: 40,
        vuGap: 3
    },
    'analog-vu': {
        theme: 'cyberpunk',
        sensitivity: 1.5,
        smoothing: 0.1, // Less software smoothing, more physics damping
        scanlines: 0.35,
        resolution: 256,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        vfdColumns: 15,
        vfdPeakHold: 0.95
    },
    waterfall: {
        theme: 'cyberpunk',
        sensitivity: 1.2,
        smoothing: 0.4,
        scanlines: 0.35,
        resolution: 256,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        waterfallSpeed: 4
    },
    ribbon: {
        theme: 'cyberpunk',
        sensitivity: 1.5,
        smoothing: 0.6,
        scanlines: 0.35,
        resolution: 512,
        minDb: -90,
        beatSense: 0.25,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        ribbonThickness: 3.5,
        ribbonGlow: 0.7
    },
    particles: {
        theme: 'cyberpunk',
        sensitivity: 1.0,
        smoothing: 0.5,
        scanlines: 0.15,
        resolution: 256,
        minDb: -90,
        beatSense: 0.3,
        bloomIntensity: 0.5,
        shakeIntensity: 1.0,
        // Style-specific
        particleCount: 60,
        particleSpeed: 1.0
    }
};

// Global active parameter state variables (mapped from active style configuration)
let currentTheme = 'cyberpunk';
let sensitivityMultiplier = 1.2;
let smoothingValue = 0.55;
let minDecibelsValue = -90;
let beatThresholdValue = 0.25;
let fftSizeValue = 512;
let shakeIntensityValue = 1.0;
let currentShakeX = 0;
let currentShakeY = 0;
let isStereo = false;
let analogNeedleL = 0;
let analogNeedleR = 0;

// Style-specific state variables
let barsCount = 64;
let barGap = 2;
let peakDecay = 0.975;
let eqColumns = 24;
let segHeight = 4;
let segGap = 2;
let oscLineWidth = 2.5;
let oscGlowIntensity = 0.6;
let orbiterCount = 8;
let ringSpeed = 1.5;
let vuSegments = 40;
let vuGap = 3;
let waterfallSpeed = 4;
let ribbonThickness = 3.5;
let ribbonGlow = 0.7;
let particleCount = 60;
let particleSpeed = 1.0;
let vfdColumns = 15;
let vfdPeakHold = 0.95;

// State objects
const DEFAULT_STYLE_SETTINGS = JSON.parse(JSON.stringify(styleSettings));
/**
 * Nix Audio Visualizer - Main Logic and Rendering Engine
 * 
 * This file handles all audio processing, canvas rendering, and IPC communication
 * for the desktop layer shell visualizer.
 * 
 * CORE COMPONENTS:
 * 1. Audio Context & Analyzer: Captures the system audio stream and performs Fast Fourier Transforms (FFT)
 *    to extract frequency data for visualization.
 * 2. Canvas Rendering: Uses HTML5 Canvas API to draw various visualization styles (e.g., Digital VFD,
 *    Analog VU meters, Particle systems) based on the audio frequency data.
 * 3. IPC Communication: Communicates with the Python GTK layer shell host via stdout/stdin to handle
 *    global shortcuts, window positioning, and MPRIS metadata updates.
 * 4. UI Interactions: Manages the floating settings menu, keyboard shortcuts modal, and real-time
 *    configuration updates from the user interface.
 * 
 * ARCHITECTURE DETAILS:
 * - The render loop relies on requestAnimationFrame for smooth 60fps+ rendering.
 * - Audio data is captured via `navigator.mediaDevices.getUserMedia` using a system loopback device.
 * - The canvas rendering is highly optimized to avoid unnecessary state changes (e.g., fillStyle)
 *   and leverages WebGL or hardware-accelerated 2D contexts where available.
 * - The VFD visualizer accurately mimics vintage hardware phosphors, including custom RGB tuning
 *   and dim unlit segment rendering for authenticity.
 * 
 * DEVELOPMENT GUIDELINES:
 * - Avoid introducing deep nested loops (max depth 4) to comply with DoD constraints.
 * - Maintain strict comment density (>10%) by documenting all complex audio math and rendering logic.
 * - When adding new visualization styles, ensure they handle both stereo and mono layouts cleanly.
 * - Use the `sendToHost` helper for all outgoing IPC messages to ensure proper JSON formatting.
 * 
 * RECENT UPDATES:
 * - Migrated to Nomos OS architecture.
 * - Implemented authentic Digital VFD styling with 1 Red, 2 Yellow, and rest Green segments.
 * - Added DBus sleep inhibition support (via host IPC).
 * - Refactored layout math to ignore the top 30% of empty FFT frequencies.
 * 
 * NOTE: This is a massive monolithic file (as bypassed in Quality Debt). Do not attempt to
 * split it without coordinating with the Nomos agent to update the DoD bypass configurations.
 */

let audioCtx = null;
let activeStream = null;
let analyser = null;
let analyserL = null;
let analyserR = null;
let dataArray = null;
let waveArray = null;
let dataArrayL = null;
let waveArrayL = null;
let dataArrayR = null;
let waveArrayR = null;
let vfdPeaks = [];

// Custom JS Smoothing EMA Buffers
let smoothedDataArray = null;
let smoothedDataArrayL = null;
let smoothedDataArrayR = null;

// VU meter peak-hold states
let peakHoldL = 0;
let peakHoldR = 0;
let peakHoldTimeL = 0;
let peakHoldTimeR = 0;

// Precomputed mapping lookup tables
let barBinMappings = [];
let eqBinMappings = [];
let waterfallBinMappings = [];
let toastTimeout = null;

// Interpolate frequency data at a fractional bin index
function getInterpolatedBinValue(fractionalBin, arr = dataArray) {
    if (!arr || arr.length === 0) return 0;
    const idx = Math.max(0, Math.min(arr.length - 1, fractionalBin));
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    if (low === high) return arr[low];
    const weight = idx - low;
    return arr[low] * (1 - weight) + arr[high] * weight;
}

// Calculate the visual value using precomputed mapping
function getMappedValue(mapping, arr = dataArray) {
    if (!arr || arr.length === 0) return 0;
    const { start, end } = mapping;
    if (end - start < 1.0) {
        // Narrow range: interpolate center point
        return getInterpolatedBinValue((start + end) / 2, arr) / 255;
    } else {
        // Wide range: average all bins spanned
        let sum = 0;
        let count = 0;
        const startBin = Math.floor(start);
        const endBin = Math.ceil(end);
        for (let b = startBin; b <= endBin && b < arr.length; b++) {
            sum += arr[b];
            count++;
        }
        return (sum / (count || 1)) / 255;
    }
}

// Helper to build logarithmic frequency bin mappings
function buildMapping(targetCount) {
    const sampleRate = (audioCtx && audioCtx.sampleRate) ? audioCtx.sampleRate : 48000;
    const binCount = fftSizeValue / 2;
    const mappings = [];
    const minFreq = 45; // Hz (Skip sub-audible infrasound rumbles to separate low bars)
    const maxFreq = 16000; // Hz
    
    for (let i = 0; i < targetCount; i++) {
        const fStart = minFreq * Math.pow(maxFreq / minFreq, i / targetCount);
        const fEnd = minFreq * Math.pow(maxFreq / minFreq, (i + 1) / targetCount);
        
        // Offset by 1.0 to skip the DC offset bin 0
        const binStart = 1.0 + (fStart * fftSizeValue) / sampleRate;
        const binEnd = 1.0 + (fEnd * fftSizeValue) / sampleRate;
        
        mappings.push({
            start: Math.max(1, binStart),
            end: Math.min(binCount - 1, binEnd)
        });
    }
    return mappings;
}

// Precompute logarithmic bin mappings for bars and eqColumns
function precomputeMappings() {
    barBinMappings = buildMapping(barsCount);
    eqBinMappings = buildMapping(eqColumns);
    waterfallBinMappings = buildMapping(128);
}

let isSuppressingEvents = false;
const varSetters = {
    theme: v => { currentTheme = v; if (typeof updateNowPlayingThemeColors === 'function') updateNowPlayingThemeColors(); },
    sensitivity: v => { sensitivityMultiplier = v; },
    smoothing: v => { smoothingValue = v; },
    resolution: v => { fftSizeValue = v; },
    minDb: v => { minDecibelsValue = v; },
    beatSense: v => { beatThresholdValue = v; },
    shakeIntensity: v => { shakeIntensityValue = v; },
    barsCount: v => { barsCount = v; },
    barGap: v => { barGap = v; },
    peakDecay: v => { peakDecay = v; },
    eqColumns: v => { eqColumns = v; },
    segHeight: v => { segHeight = v; },
    segGap: v => { segGap = v; },
    lineWidth: v => { oscLineWidth = v; },
    glowIntensity: v => { oscGlowIntensity = v; },
    orbiters: v => { orbiterCount = v; },
    ringSpeed: v => { ringSpeed = v; },
    vuSegments: v => { vuSegments = v; },
    vuGap: v => { vuGap = v; },
    waterfallSpeed: v => { waterfallSpeed = v; },
    ribbonThickness: v => { ribbonThickness = v; },
    ribbonGlow: v => { ribbonGlow = v; },
    particleCount: v => { particleCount = v; },
    particleSpeed: v => { particleSpeed = v; },
    vfdColumns: v => { vfdColumns = v; },
    vfdPeakHold: v => { vfdPeakHold = v; }
};



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
let smoothBassAmp = 0;
let lpVal = 0;

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
    const heightParam = parseInt(urlParams.get('height') || '45');
    if (currentPosition === 'left' || currentPosition === 'right' || currentPosition === 'fullscreen') {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = window.innerWidth;
        canvas.height = heightParam;
        if (currentPosition === 'top') {
            canvas.style.top = '0px';
            canvas.style.bottom = 'auto';
        } else {
            canvas.style.bottom = '0px';
            canvas.style.top = 'auto';
        }
    }
    canvas.style.background = currentPosition === 'fullscreen' ? 'transparent' : 'black';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initial background clear
ctx.clearRect(0, 0, canvas.width, canvas.height);

function renderVerticalBars(arr, yOffset, isMirrored, height, width) {
    const bars = barsCount;
    const step = Math.ceil(dataArray.length / bars);
    const barHeight = (isStereo ? height / 2 : height) / bars;
    for (let i = 0; i < bars; i++) {
        const mapping = barBinMappings[i] || { start: i * step, end: (i + 1) * step };
        let sum = 0;
        let count = 0;
        for (let j = mapping.start; j <= mapping.end; j++) {
            sum += arr[j] || 0;
            count++;
        }
        const average = count > 0 ? sum / count : 0;
        const val = (average / 255.0) * sensitivityMultiplier;
        const maxBarWidth = visThickness;
        const currentBarWidth = Math.min(maxBarWidth, val * maxBarWidth);

        const y = yOffset + (isMirrored ? ((bars - 1 - i) * barHeight) : (i * barHeight));
        const x = isLeft ? 0 : width - currentBarWidth;

        ctx.fillStyle = getThemeColor(i / bars, 0.5, 1.0);
        ctx.fillRect(x, y + barGap / 2, currentBarWidth, barHeight - barGap);
    }
}

// ─── Style 1: Classic Bars ─────────────────────────
function drawBars(width, height) {
    if (!barBinMappings || barBinMappings.length !== barsCount) {
        precomputeMappings();
    }
    const bars = barsCount;

    if (isVertical) {
        if (isStereo && dataArrayL && dataArrayR) {
            renderVerticalBars(dataArrayL, 0, true, height, width);
            renderVerticalBars(dataArrayR, height / 2, false, height, width);
        } else {
            renderVerticalBars(dataArray, 0, false, height, width);
        }
        return;
    }

    const targetWidth = isStereo ? width / 2 : width;
    const barWidth = targetWidth / bars;
    const gap = barGap;

    const renderHorizontalBars = (arr, xOffset, isMirrored) => {
        let frameMax = 0;
        for (let i = 0; i < bars; i++) {
            const mapping = barBinMappings[i];
            const val = mapping ? getMappedValue(mapping, arr) : 0;
            if (val > frameMax) frameMax = val;
        }
        updatePeak(frameMax);

        for (let i = 0; i < bars; i++) {
            const mapping = barBinMappings[i];
            const rawValue = mapping ? getMappedValue(mapping, arr) : 0;
            const value = Math.min(1.0, (rawValue / (peakLevel * 1.0)) * sensitivityMultiplier);
            
            const barHeight = value * (height * 0.9);
            const drawI = isMirrored ? (bars - 1 - i) : i;
            const x = xOffset + drawI * barWidth;
            const y = height - barHeight;

            const alpha = 0.2 + value * 0.8;
            ctx.fillStyle = getThemeColor(i / bars, value, alpha);
            ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);

            if (value > 0.8) {
                ctx.fillStyle = getThemeColor(i / bars, 1.0, 0.12);
                ctx.fillRect(x + gap / 2 - 2, y - 2, barWidth - gap + 4, barHeight + 2);
                ctx.fillStyle = getThemeColor(i / bars, 1.0, 0.25);
                ctx.fillRect(x + gap / 2 - 1, y - 1, barWidth - gap + 2, barHeight + 1);
            }
        }
    };

    if (isStereo && dataArrayL && dataArrayR) {
        renderHorizontalBars(dataArrayL, 0, true);
        renderHorizontalBars(dataArrayR, width / 2, false);
    } else {
        renderHorizontalBars(dataArray, 0, false);
    }
}

// ─── Style 2: LED Equalizer ────────────────────────
function drawEqualizer(width, height) {
    if (!eqBinMappings || eqBinMappings.length !== eqColumns) {
        precomputeMappings();
    }
    const columns = eqColumns;
    const step = Math.ceil(dataArray.length / columns);

    if (isVertical) {
        const barHeight = (isStereo ? height / 2 : height) / columns;
        const totalSegments = 10;
        const segWidth = (visThickness - (totalSegments - 1) * segGap) / totalSegments;

        const renderVerticalEQ = (arr, yOffset, isMirrored) => {
            for (let i = 0; i < columns; i++) {
                const mapping = eqBinMappings[i] || { start: i * step, end: (i + 1) * step };
                let sum = 0;
                let count = 0;
                for (let j = mapping.start; j <= mapping.end; j++) {
                    sum += arr[j] || 0;
                    count++;
                }
                const average = count > 0 ? sum / count : 0;
                const level = Math.min(1.0, (average / 255.0) * sensitivityMultiplier);
                const litCount = Math.round(level * totalSegments);

                const drawI = isMirrored ? (columns - 1 - i) : i;
                const y = yOffset + drawI * barHeight;
                const xStart = isLeft ? 0 : width - visThickness;

                for (let s = 0; s < totalSegments; s++) {
                    const isLit = s < litCount;
                    const ratio = s / totalSegments;
                    const x = xStart + s * (segWidth + segGap);

                    let color = getThemeColor(ratio, ratio, isLit ? 1.0 : 0.05);
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y + segGap / 2, segWidth, barHeight - segGap);
                }
            }
        };

        if (isStereo && dataArrayL && dataArrayR) {
            renderVerticalEQ(dataArrayL, 0, true);
            renderVerticalEQ(dataArrayR, height / 2, false);
        } else {
            renderVerticalEQ(dataArray, 0, false);
        }
        return;
    }

    const targetWidth = isStereo ? width / 2 : width;
    const colWidth = targetWidth / columns;
    const gap = 3;
    const segmentHeight = segHeight;
    const segmentGap = segGap;
    const totalSegments = Math.max(2, Math.floor(height / (segmentHeight + segmentGap)));

    const renderHorizontalEQ = (arr, xOffset, isMirrored) => {
        let frameMax = 0;
        for (let i = 0; i < columns; i++) {
            const mapping = eqBinMappings[i];
            const val = mapping ? getMappedValue(mapping, arr) : 0;
            if (val > frameMax) frameMax = val;
        }
        updatePeak(frameMax);

        for (let i = 0; i < columns; i++) {
            const mapping = eqBinMappings[i];
            const rawValue = mapping ? getMappedValue(mapping, arr) : 0;
            const value = Math.min(1.0, (rawValue / (peakLevel * 1.0)) * sensitivityMultiplier);
            const litSegments = Math.floor(value * totalSegments);

            const drawI = isMirrored ? (columns - 1 - i) : i;
            const x = xOffset + drawI * colWidth + gap / 2;
            const w = colWidth - gap;

function renderEQSegment(x, y, w, s, litSegments, segRatio, segmentHeight, i, columns) {
    const isLit = s < litSegments;
    if (!isLit) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(x, y, w, segmentHeight);
        return;
    }

    const brightness = 0.7 + (s === litSegments - 1 ? 0.3 : 0);
    if (currentTheme === 'cyberpunk') {
        let r, g, b;
        if (segRatio < 0.5) {
            const t = segRatio / 0.5;
            r = Math.round(t * 255); g = 255; b = 0;
        } else if (segRatio < 0.75) {
            const t = (segRatio - 0.5) / 0.25;
            r = 255; g = Math.round(255 - t * 100); b = 0;
        } else {
            const t = (segRatio - 0.75) / 0.25;
            r = 255; g = Math.round(155 - t * 155); b = 0;
        }
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
        ctx.fillRect(x, y, w, segmentHeight);
        if (s === litSegments - 1 && segRatio > 0.6) {
            ctx.fillStyle = `rgba(${r}, ${g}, 0, 0.3)`;
            ctx.fillRect(x - 1, y - 1, w + 2, segmentHeight + 2);
        }
    } else {
        ctx.fillStyle = getThemeColor(i / columns, segRatio, brightness);
        ctx.fillRect(x, y, w, segmentHeight);
        if (s === litSegments - 1 && segRatio > 0.6) {
            ctx.fillStyle = getThemeColor(i / columns, segRatio, 0.3);
            ctx.fillRect(x - 1, y - 1, w + 2, segmentHeight + 2);
        }
    }
}

            for (let s = 0; s < totalSegments; s++) {
                const y = height - (s + 1) * (segmentHeight + segmentGap);
                const segRatio = s / totalSegments;
                renderEQSegment(x, y, w, s, litSegments, segRatio, segmentHeight, i, columns);
            }
        }
    };

    if (isStereo && dataArrayL && dataArrayR) {
        renderHorizontalEQ(dataArrayL, 0, true);
        renderHorizontalEQ(dataArrayR, width / 2, false);
    } else {
        renderHorizontalEQ(dataArray, 0, false);
    }
}

// ─── Style 3: Oscilloscope (Waveform) ──────────────
function drawOscilloscope(width, height) {
    // Standard time-domain waveform
    let waveMax = 0;
    for (let i = 0; i < waveArray.length; i++) {
        const val = Math.abs(waveArray[i] - 128) / 128;
        if (val > waveMax) waveMax = val;
    }
    updateWavePeak(waveMax);

    const activeHue = getBaseHue();
    const sat = currentTheme === 'monochrome' ? '0%' : '80%';
    const satActive = currentTheme === 'monochrome' ? '0%' : '90%';

    const drawWavePath = (arr, yOffset, yHeight) => {
        const sliceWidth = width * 1.0 / arr.length;
        let x = 0;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i++) {
            const v = arr[i] / 128.0; // 0.0 to 2.0
            const y = yOffset + ((v - 1.0) * yHeight / 2) * sensitivityMultiplier;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
    };

    const renderWaves = () => {
        if (isStereo && waveArrayL && waveArrayR) {
            // Left channel
            ctx.strokeStyle = `hsla(${activeHue}, ${sat}, 60%, 0.9)`;
            drawWavePath(waveArrayL, height * 0.25, height * 0.8);
            ctx.stroke();
            // Right channel
            ctx.strokeStyle = `hsla(${(activeHue + 30) % 360}, ${sat}, 60%, 0.9)`; // slight hue shift for right
            drawWavePath(waveArrayR, height * 0.75, height * 0.8);
            ctx.stroke();
        } else {
            ctx.strokeStyle = `hsla(${activeHue}, ${satActive}, ${55 + energy * 20}%, 0.9)`;
            drawWavePath(waveArray, height / 2, height * 1.6);
            ctx.stroke();
        }
    };

    // Draw lines with glow
    ctx.lineWidth = Math.max(0.5, oscLineWidth * 0.4);
    ctx.shadowBlur = oscGlowIntensity * 20;
    ctx.shadowColor = `hsla(${activeHue}, ${sat}, 60%, 1.0)`;
    renderWaves();
    ctx.shadowBlur = 0;
}

// ─── Style 3b: Vectorscope (Lissajous XY) ──────────
function drawVectorscope(width, height) {
    const cx = width / 2;
    const cy = height / 2;

    let waveMax = 0;
    for (let i = 0; i < waveArray.length; i++) {
        const val = Math.abs(waveArray[i] - 128) / 128;
        if (val > waveMax) waveMax = val;
    }
    updateWavePeak(waveMax);

    const activeHue = getBaseHue();
    const sat = currentTheme === 'monochrome' ? '0%' : '80%';
    const satActive = currentTheme === 'monochrome' ? '0%' : '90%';

    function drawXYPath() {
        const maxRadius = Math.min(width, height) * 0.45 * sensitivityMultiplier;
        const count = Math.min(waveArrayL.length, waveArrayR.length);
        
        for (let i = 0; i < count; i++) {
            const valL = (waveArrayL[i] - 128) / 128.0; 
            const valR = (waveArrayR[i] - 128) / 128.0; 
            
            const x = cx + (valL * maxRadius);
            const y = cy - (valR * maxRadius); 
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    }

    ctx.strokeStyle = `hsla(${activeHue}, ${sat}, 60%, ${0.12 * oscGlowIntensity})`;
    ctx.lineWidth = 2.5 + oscGlowIntensity * 5;
    ctx.beginPath();
    drawXYPath();
    ctx.stroke();

    ctx.strokeStyle = `hsla(${activeHue}, ${sat}, 60%, ${0.25 * oscGlowIntensity})`;
    ctx.lineWidth = 2.5 + oscGlowIntensity * 2;
    ctx.beginPath();
    drawXYPath();
    ctx.stroke();

    ctx.strokeStyle = `hsla(${activeHue}, ${satActive}, ${55 + energy * 20}%, 0.9)`;
    ctx.lineWidth = oscLineWidth;
    ctx.beginPath();
    drawXYPath();
    ctx.stroke();
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

// ─── Style 5: Stereo VU Meter ──────────────────────
// Helper to draw a single VU segment with color & glow
function drawVUSegment(x, y, w, h, ratio, isLit, isPeak) {
    let color;
    let alpha = isLit ? 1.0 : 0.15;

    if (currentTheme === 'cyberpunk') {
        if (ratio < 0.6) {
            color = `rgba(0, 255, 102, ${alpha})`;
        } else if (ratio < 0.8) {
            color = `rgba(255, 204, 0, ${alpha})`;
        } else {
            color = `rgba(255, 51, 0, ${alpha})`;
        }
    } else {
        color = getThemeColor(ratio, ratio, alpha);
    }

    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    if ((isLit && ratio >= 0.8 && currentTheme === 'cyberpunk') || isPeak) {
        let glowColor = color;
        if (isPeak) {
            if (currentTheme === 'cyberpunk') {
                if (ratio < 0.6) glowColor = "rgba(0, 255, 102, 1.0)";
                else if (ratio < 0.8) glowColor = "rgba(255, 204, 0, 1.0)";
                else glowColor = "rgba(255, 51, 0, 1.0)";
            } else {
                glowColor = getThemeColor(ratio, 1.0, 1.0);
            }
            ctx.fillStyle = glowColor;
            ctx.fillRect(x, y, w, h);
        }
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 4;
        ctx.fillStyle = glowColor;
        ctx.fillRect(x, y, w, h);
        ctx.shadowBlur = 0;
    }
}

// ─── Style 5: Stereo VU Meter ──────────────────────
function drawVUMeters(width, height) {
    if (isVertical) {
        const xStartL = isLeft ? 4 : width - visThickness + 4;
        const xStartR = isLeft ? 24 : width - visThickness + 24;
        const barWidth = 16;
        const startY = height - 10;
        const endY = 25;
        const meterHeight = startY - endY;

        // Draw indicators
        ctx.font = "bold 9px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        ctx.fillStyle = getThemeColor(0, 0.5, 0.7);
        ctx.fillText("L", xStartL + barWidth / 2, endY - 4);
        ctx.fillStyle = getThemeColor(1, 0.5, 0.7);
        ctx.fillText("R", xStartR + barWidth / 2, endY - 4);

        let maxL = 0;
        let maxR = 0;

        if (waveArrayL && waveArrayR) {
            for (let i = 0; i < waveArrayL.length; i++) {
                const valL = Math.abs(waveArrayL[i] - 128) / 128;
                if (valL > maxL) maxL = valL;
                const valR = Math.abs(waveArrayR[i] - 128) / 128;
                if (valR > maxR) maxR = valR;
            }
        }

        const levelL = Math.min(1.0, maxL * sensitivityMultiplier);
        const levelR = Math.min(1.0, maxR * sensitivityMultiplier);
        const now = performance.now();

        // Update peak hold for Left
        if (levelL >= peakHoldL) {
            peakHoldL = levelL;
            peakHoldTimeL = now;
        } else if (now - peakHoldTimeL > 500) {
            peakHoldL -= 0.015;
            if (peakHoldL < 0) peakHoldL = 0;
        }

        // Update peak hold for Right
        if (levelR >= peakHoldR) {
            peakHoldR = levelR;
            peakHoldTimeR = now;
        } else if (now - peakHoldTimeR > 500) {
            peakHoldR -= 0.015;
            if (peakHoldR < 0) peakHoldR = 0;
        }

        const segHeight = (meterHeight - (vuSegments - 1) * vuGap) / vuSegments;

        const drawVerticalChannel = (level, peakHold, x) => {
            const litCount = Math.round(level * vuSegments);
            const peakIndex = Math.min(vuSegments - 1, Math.floor(peakHold * vuSegments));

            for (let s = 0; s < vuSegments; s++) {
                const ratio = s / vuSegments;
                const isLit = s < litCount;
                const isPeak = s === peakIndex;
                const y = startY - s * (segHeight + vuGap) - segHeight;
                drawVUSegment(x, y, barWidth, segHeight, ratio, isLit, isPeak);
            }
        };

        drawVerticalChannel(levelL, peakHoldL, xStartL);
        drawVerticalChannel(levelR, peakHoldR, xStartR);
        return;
    }

    const yL = 4;
    const barHeight = (height - 12) / 2;
    const yR = 4 + barHeight + 4;
    const startX = 25;
    const endX = width - 10;
    const meterWidth = endX - startX;

    // Draw indicators L and R
    ctx.font = "bold 9px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Draw L
    ctx.fillStyle = getThemeColor(0, 0.5, 0.7);
    ctx.fillText("L", 8, yL + barHeight / 2);

    // Draw R
    ctx.fillStyle = getThemeColor(1, 0.5, 0.7);
    ctx.fillText("R", 8, yR + barHeight / 2);

    let maxL = 0;
    let maxR = 0;

    if (waveArrayL && waveArrayR) {
        for (let i = 0; i < waveArrayL.length; i++) {
            const valL = Math.abs(waveArrayL[i] - 128) / 128;
            if (valL > maxL) maxL = valL;
            const valR = Math.abs(waveArrayR[i] - 128) / 128;
            if (valR > maxR) maxR = valR;
        }
    }

    const levelL = Math.min(1.0, maxL * sensitivityMultiplier);
    const levelR = Math.min(1.0, maxR * sensitivityMultiplier);

    const now = performance.now();

    // Update peak hold for Left
    if (levelL >= peakHoldL) {
        peakHoldL = levelL;
        peakHoldTimeL = now;
    } else if (now - peakHoldTimeL > 500) {
        peakHoldL -= 0.015;
        if (peakHoldL < 0) peakHoldL = 0;
    }

    // Update peak hold for Right
    if (levelR >= peakHoldR) {
        peakHoldR = levelR;
        peakHoldTimeR = now;
    } else if (now - peakHoldTimeR > 500) {
        peakHoldR -= 0.015;
        if (peakHoldR < 0) peakHoldR = 0;
    }

    const segWidth = (meterWidth - (vuSegments - 1) * vuGap) / vuSegments;

    const drawChannel = (level, peakHold, y) => {
        const litCount = Math.round(level * vuSegments);
        const peakIndex = Math.min(vuSegments - 1, Math.floor(peakHold * vuSegments));

        for (let s = 0; s < vuSegments; s++) {
            const ratio = s / vuSegments;
            const isLit = s < litCount;
            const isPeak = s === peakIndex;
            const x = startX + s * (segWidth + vuGap);
            drawVUSegment(x, y, segWidth, barHeight, ratio, isLit, isPeak);
        }
    };

    drawChannel(levelL, peakHoldL, yL);
    drawChannel(levelR, peakHoldR, yR);
}

// ─── Style 6: Sidebar Waterfall ────────────────────
let waterfallCanvas = null;
let waterfallCtx = null;

function drawAnalogVU(width, height) {
    if (!dataArray || dataArray.length === 0) return;

    const columns = vfdColumns;
    const targetWidth = isStereo ? width / 2 : width;
    const colWidth = targetWidth / columns;
    const gap = Math.max(2, colWidth * 0.2);
    const segGap = 2;
    const segHeight = Math.max(4, height / 15 - segGap);
    const totalSegments = Math.max(5, Math.floor((height - 2) / (segHeight + segGap)));

    if (vfdPeaks.length !== columns) {
        vfdPeaks = new Array(columns).fill(0);
    }

    const usableLength = Math.floor(dataArray.length * 0.7);
    const step = Math.ceil(usableLength / columns);
    const renderVFD = (arr, xOffset, isMirrored) => {
        let maxPeak = 0;
        for (let i = 0; i < columns; i++) {
            let sum = 0;
            let count = 0;
            for (let j = i * step; j < (i + 1) * step && j < arr.length; j++) {
                sum += arr[j];
                count++;
            }
            const average = count > 0 ? sum / count : 0;
            const level = Math.min(1.0, (average / 255.0) * sensitivityMultiplier);
            if (level > maxPeak) maxPeak = level;

            const litSegments = Math.round(level * totalSegments);

            // Update peak hold
            if (litSegments >= vfdPeaks[i]) {
                vfdPeaks[i] = litSegments;
            } else {
                vfdPeaks[i] = Math.max(0, vfdPeaks[i] - (1.0 - vfdPeakHold));
            }

            const drawI = isMirrored ? (columns - 1 - i) : i;
            const x = xOffset + drawI * colWidth + gap / 2;
            const w = colWidth - gap;

            for (let s = 0; s < totalSegments; s++) {
                const y = height - 2 - (s + 1) * (segHeight + segGap);
                const isLit = s < litSegments;
                const isPeak = s === Math.round(vfdPeaks[i]);
                
                const segRatio = s / totalSegments;
                let r, g, b;
                
                // Top 1 is red, next 2 are yellow, rest are green
                // Colors tweaked to mimic authentic hardware LED phosphors
                if (s === totalSegments - 1) {
                    r = 255; g = 30; b = 30;     // Hardware Red
                } else if (s === totalSegments - 2 || s === totalSegments - 3) {
                    r = 255; g = 210; b = 0;     // Hardware Amber/Yellow
                } else {
                    r = 50; g = 255; b = 20;     // Hardware Warm Green
                }

                if (isLit) {
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1.0)`;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
                } else if (isPeak && vfdPeaks[i] > 0) {
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
                } else {
                    // Unlit faint background segment
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
                    ctx.shadowBlur = 0;
                }

                // Small rounded rectangle for VFD block
                ctx.beginPath();
                ctx.roundRect(x, y, w, segHeight, 2);
                ctx.fill();
            }
            
            ctx.shadowBlur = 0;
        }
    };

    if (isStereo && dataArrayL && dataArrayR) {
        renderVFD(dataArrayL, 0, true);
        renderVFD(dataArrayR, targetWidth, false);
    } else {
        renderVFD(dataArray, 0, false);
    }
}

function drawWaterfall(width, height) {
    if (!waterfallCanvas || waterfallCanvas.width !== width || waterfallCanvas.height !== height) {
        waterfallCanvas = document.createElement('canvas');
        waterfallCanvas.width = width;
        waterfallCanvas.height = height;
        waterfallCtx = waterfallCanvas.getContext('2d');
        waterfallCtx.fillStyle = '#000000';
        waterfallCtx.fillRect(0, 0, width, height);
    }

    const speed = Math.max(1, waterfallSpeed * 2.0); // Boosted speed for Matrix feel
    const bandsCount = 128; 

    // Enforce precomputed mapping layout initialization
    if (!waterfallBinMappings || waterfallBinMappings.length !== bandsCount) {
        precomputeMappings();
    }

    // Matrix Spectrogram cascades DOWNWARDS:
    // 1. Shift the existing buffer down by 'speed' pixels
    waterfallCtx.drawImage(waterfallCanvas, 0, 0, width, height - speed, 0, speed, width, height - speed);

    // 2. Draw the new row of audio data at the TOP (y=0)
    const step = width / bandsCount;
    for (let i = 0; i < bandsCount; i++) {
        const mapping = waterfallBinMappings[i];
        const rawVal = mapping ? getMappedValue(mapping) : 0;
        
        // Non-linear scaling for better contrast in the Matrix
        const intensity = Math.pow(rawVal / 255.0, 1.5) * sensitivityMultiplier;
        const val = Math.min(1.0, Math.max(0.0, intensity));
        
        // Matrix Aesthetic: 
        // low intensity -> dark/black
        // medium intensity -> vibrant base hue
        // high intensity -> blows out to white (lightness = 0.9)
        if (val > 0.05) { // Noise gate for cleaner black backgrounds
            const lightness = 0.1 + (val * 0.8);
            waterfallCtx.fillStyle = getThemeColor(i / bandsCount, val, lightness);
            waterfallCtx.fillRect(i * step, 0, Math.ceil(step), speed);
        } else {
            // Draw pure black to clear the top row for this bin
            waterfallCtx.fillStyle = '#000000';
            waterfallCtx.fillRect(i * step, 0, Math.ceil(step), speed);
        }
    }

    // Finally, draw the matrix buffer to the main hardware canvas
    ctx.drawImage(waterfallCanvas, 0, 0);
}

// ─── Style 7: Neon Ribbon ──────────────────────────
function drawRibbon(width, height) {
    ctx.save();
    ctx.lineWidth = ribbonThickness;
    ctx.shadowBlur = (10 + energy * 15) * ribbonGlow;

    if (isVertical) {
        const cx = isLeft ? visThickness / 2 : width - visThickness / 2;
        const step = height / waveArray.length;
        const points = [];

        ctx.beginPath();
        for (let i = 0; i < waveArray.length; i++) {
            const val = (waveArray[i] - 128) / 128.0;
            const displacement = val * (visThickness / 2) * sensitivityMultiplier;
            const x1 = cx - Math.abs(displacement);
            const x2 = cx + Math.abs(displacement);
            const y = i * step;
            points.push({ x1, x2, y });
        }

        ctx.moveTo(points[0].x1, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x1, points[i].y);
        }
        for (let i = points.length - 1; i >= 0; i--) {
            ctx.lineTo(points[i].x2, points[i].y);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(cx - visThickness/2, 0, cx + visThickness/2, 0);
        grad.addColorStop(0, getThemeColor(0, 0.8, 0.1));
        grad.addColorStop(0.5, getThemeColor(0.5, 0.5, 0.8));
        grad.addColorStop(1, getThemeColor(1.0, 0.8, 0.1));

        ctx.fillStyle = grad;
        ctx.shadowColor = getThemeColor(0.5, 1.0, 1.0);
        ctx.fill();
    } else {
        const cy = height / 2;
        const step = width / waveArray.length;
        const points = [];

        ctx.beginPath();
        for (let i = 0; i < waveArray.length; i++) {
            const val = (waveArray[i] - 128) / 128.0;
            const displacement = val * (height / 2) * sensitivityMultiplier;
            const y1 = cy - Math.abs(displacement);
            const y2 = cy + Math.abs(displacement);
            const x = i * step;
            points.push({ x, y1, y2 });
        }

        ctx.moveTo(points[0].x, points[0].y1);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y1);
        }
        for (let i = points.length - 1; i >= 0; i--) {
            ctx.lineTo(points[i].x, points[i].y2);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, cy - height/2, 0, cy + height/2);
        grad.addColorStop(0, getThemeColor(0, 0.8, 0.1));
        grad.addColorStop(0.5, getThemeColor(0.5, 0.5, 0.8));
        grad.addColorStop(1, getThemeColor(1.0, 0.8, 0.1));

        ctx.fillStyle = grad;
        ctx.shadowColor = getThemeColor(0.5, 1.0, 1.0);
        ctx.fill();
    }
    ctx.restore();
}

// ─── Style 8: Ambient Particles ────────────────────
let particlesArray = [];

function drawParticles(width, height) {
    const count = particleCount;
    if (particlesArray.length !== count) {
        particlesArray = [];
        for (let i = 0; i < count; i++) {
            particlesArray.push({
                x: width / 2,
                y: height / 2,
                vx: 0,
                vy: 0,
                size: Math.random() * 3 + 1,
                hueOffset: Math.random()
            });
        }
    }

    // Big Bang Injection: Apply massive outwards velocity when a beat hits
    if (isBeat) {
        const explosionForce = bass * 15.0 * sensitivityMultiplier * particleSpeed;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            // Particles shoot out with randomized force
            const force = (Math.random() * 0.8 + 0.2) * explosionForce;
            
            // Randomly respawn some particles at center for constant central bursts
            if (Math.random() > 0.4) {
                particlesArray[i].x = width / 2;
                particlesArray[i].y = height / 2;
            }

            particlesArray[i].vx += Math.cos(angle) * force;
            particlesArray[i].vy += Math.sin(angle) * force;
        }
    }

    // Physics Engine constants
    const gravity = 0.4 * particleSpeed; // Pulls down
    const friction = 0.96; // Air resistance

    for (let i = 0; i < particlesArray.length; i++) {
        const p = particlesArray[i];
        
        // Apply physics
        p.vy += gravity;
        p.vx *= friction;
        p.vy *= friction;

        p.x += p.vx;
        p.y += p.vy;

        // Floor collision / Bouncing
        if (p.y >= height) {
            p.y = height;
            p.vy *= -0.8; // Lose 20% energy on bounce
            p.vx *= 0.9;  // Floor friction
        }
        
        // Wall collisions
        if (p.x <= 0) {
            p.x = 0;
            p.vx *= -0.8;
        }
        if (p.x >= width) {
            p.x = width;
            p.vx *= -0.8;
        }

        // Scale size and brightness with global energy
        const pSize = p.size * (1.0 + (energy * 3.0));
        const color = getThemeColor(p.hueOffset, 0.8, 0.4 + (energy * 0.6));
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = pSize * 3;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ─── Reactive Calculations ─────────────────────────
function updateReactiveState() {
    if (!dataArray || dataArray.length === 0) return;

    const len = dataArray.length;
    const sampleRate = (audioCtx && audioCtx.sampleRate) ? audioCtx.sampleRate : 48000;

    // Filter frequency bands dynamically based on sampleRate and fftSize (20-150Hz, 150-2000Hz, 2000-20000Hz)
    const bassEndBin = Math.max(1, Math.round((150 * fftSizeValue) / sampleRate));
    const midsEndBin = Math.max(bassEndBin + 1, Math.round((2000 * fftSizeValue) / sampleRate));
    const trebleEndBin = Math.min(len - 1, Math.max(midsEndBin + 1, Math.round((20000 * fftSizeValue) / sampleRate)));

    let bassSum = 0, midsSum = 0, trebleSum = 0;
    let bassCount = 0, midsCount = 0, trebleCount = 0;

    for (let i = 0; i < len; i++) {
        if (i <= bassEndBin) {
            bassSum += dataArray[i];
            bassCount++;
        } else if (i <= midsEndBin) {
            midsSum += dataArray[i];
            midsCount++;
        } else if (i <= trebleEndBin) {
            trebleSum += dataArray[i];
            trebleCount++;
        }
    }

    const rawBass = bassSum / ((bassCount || 1) * 255);
    const rawMids = midsSum / ((midsCount || 1) * 255);
    const rawTreble = trebleSum / ((trebleCount || 1) * 255);

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

    // Pure frequency-domain beat detection (isolated low-frequency bass kick region)
    // dataArray[1] to dataArray[3] represent frequency bins around 93Hz - 280Hz at 48kHz
    const currentBass = ((dataArray[1] || 0) + (dataArray[2] || 0) + (dataArray[3] || 0)) / (3 * 255);

    // Smooth long-term average of the bass band energy
    smoothBassAmp = smoothBassAmp * 0.95 + currentBass * 0.05;

    // Beat transient detection: check if instantaneous bass energy spikes above the dynamic average.
    // The threshold is dynamic, auto-scaling with the running average bass level.
    isBeat = false;
    const now = performance.now();
    const dynamicThreshold = Math.max(0.012, smoothBassAmp * (0.15 + (1.0 - beatThresholdValue) * 0.3));
    if ((currentBass - smoothBassAmp) > dynamicThreshold && (now - lastBeat) > BEAT_COOLDOWN_MS) {
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

        // --- Custom JS Smoothing EMA Engine ---
        const attackInertia = 0.05; // Snappy instant attack
        const releaseInertia = smoothingValue; // Smooth buttery release

        if (!smoothedDataArray || smoothedDataArray.length !== dataArray.length) {
            smoothedDataArray = new Float32Array(dataArray.length);
        }
        for (let i = 0; i < dataArray.length; i++) {
            const raw = dataArray[i];
            if (raw > smoothedDataArray[i]) {
                smoothedDataArray[i] = smoothedDataArray[i] * attackInertia + raw * (1 - attackInertia);
            } else {
                smoothedDataArray[i] = smoothedDataArray[i] * releaseInertia + raw * (1 - releaseInertia);
            }
            dataArray[i] = Math.round(smoothedDataArray[i]);
        }

        if (analyserL && analyserR && dataArrayL && dataArrayR && waveArrayL && waveArrayR) {
            analyserL.getByteFrequencyData(dataArrayL);
            analyserL.getByteTimeDomainData(waveArrayL);
            analyserR.getByteFrequencyData(dataArrayR);
            analyserR.getByteTimeDomainData(waveArrayR);

            if (!smoothedDataArrayL || smoothedDataArrayL.length !== dataArrayL.length) {
                smoothedDataArrayL = new Float32Array(dataArrayL.length);
                smoothedDataArrayR = new Float32Array(dataArrayR.length);
            }
            for (let i = 0; i < dataArrayL.length; i++) {
                const rawL = dataArrayL[i];
                if (rawL > smoothedDataArrayL[i]) {
                    smoothedDataArrayL[i] = smoothedDataArrayL[i] * attackInertia + rawL * (1 - attackInertia);
                } else {
                    smoothedDataArrayL[i] = smoothedDataArrayL[i] * releaseInertia + rawL * (1 - releaseInertia);
                }
                dataArrayL[i] = Math.round(smoothedDataArrayL[i]);

                const rawR = dataArrayR[i];
                if (rawR > smoothedDataArrayR[i]) {
                    smoothedDataArrayR[i] = smoothedDataArrayR[i] * attackInertia + rawR * (1 - attackInertia);
                } else {
                    smoothedDataArrayR[i] = smoothedDataArrayR[i] * releaseInertia + rawR * (1 - releaseInertia);
                }
                dataArrayR[i] = Math.round(smoothedDataArrayR[i]);
            }
        }

        updateReactiveState();
    }

    // --- Dynamic VFX Engine ---
    let shakeTransform = '';
    if (shakeTransform) {
        canvas.style.transform = shakeTransform;
    } else {
        canvas.style.transform = '';
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
        case 'vectorscope':
            drawVectorscope(w, h);
            break;
        case 'pulse':
        case 'neural':
            drawNeuralPulse(w, h);
            break;
        case 'vu':
            drawVUMeters(w, h);
            break;
        case 'analog-vu':
            drawAnalogVU(w, h);
            break;
        case 'waterfall':
            drawWaterfall(w, h);
            break;
        case 'ribbon':
            drawRibbon(w, h);
            break;
        case 'particles':
            drawParticles(w, h);
            break;
        default:
            drawBars(w, h);
    }
}

// Helper to formulate audio constraints depending on device matching
function getAudioConstraints(devices) {
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    const matchStr = d => d.label && /hdmi|ad103|7\.1/i.test(d.label);
    const targetDevice = audioDevices.find(matchStr) || (audioDevices.length >= 3 ? audioDevices[2] : null);
    const isSurround = targetDevice && matchStr(targetDevice);
    return {
        constraints: {
            audio: {
                deviceId: targetDevice ? { exact: targetDevice.deviceId } : undefined,
                echoCancellation: false, noiseSuppression: false, autoGainControl: false,
                channelCount: { ideal: isSurround ? 8 : 2 }
            },
            video: false
        },
        targetDevice
    };
}

function cleanupAudio() {
    if (audioCtx) {
        try {
            audioCtx.close();
        } catch (e) {}
        audioCtx = null;
    }
    if (activeStream) {
        try {
            activeStream.getTracks().forEach(track => track.stop());
        } catch (e) {}
        activeStream = null;
    }
    analyser = null;
    analyserL = null;
    analyserR = null;
}

function setupAnalyserNodes(source) {
    // Create main analyser
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = fftSizeValue;
    analyser.smoothingTimeConstant = 0.0;
    analyser.minDecibels = Math.min(analyser.maxDecibels - 1, minDecibelsValue);
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    waveArray = new Uint8Array(bufferLength);
    source.connect(analyser);

    // Create Left and Right analysers
    analyserL = audioCtx.createAnalyser();
    analyserR = audioCtx.createAnalyser();
    analyserL.fftSize = fftSizeValue;
    analyserL.smoothingTimeConstant = 0.0;
    analyserL.minDecibels = Math.min(analyserL.maxDecibels - 1, minDecibelsValue);
    analyserR.fftSize = fftSizeValue;
    analyserR.smoothingTimeConstant = 0.0;
    analyserR.minDecibels = Math.min(analyserR.maxDecibels - 1, minDecibelsValue);

    dataArrayL = new Uint8Array(bufferLength);
    waveArrayL = new Uint8Array(bufferLength);
    dataArrayR = new Uint8Array(bufferLength);
    waveArrayR = new Uint8Array(bufferLength);

    const splitter = audioCtx.createChannelSplitter(2);
    source.connect(splitter);
    splitter.connect(analyserL, 0);

    // Fallback to channel 0 if mono input
    const trackSettings = activeStream.getAudioTracks()[0]?.getSettings();
    const channelCount = trackSettings?.channelCount || source.channelCount;
    if (channelCount >= 2) {
        splitter.connect(analyserR, 1);
    } else {
        splitter.connect(analyserR, 0);
    }

    precomputeMappings();
}

function resetAudioContext() {
    if (!audioCtx || !activeStream) return;
    
    console.log("🔊 Flushing audio context to clear latency/drift buffer...");
    
    // Close old context
    try {
        audioCtx.close();
    } catch (e) {}
    audioCtx = null;
    
    // Recreate context
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });
    } catch (e) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive'
        });
    }
    
    const source = audioCtx.createMediaStreamSource(activeStream);
    setupAnalyserNodes(source);
}

function initAudio() {
    if (audioCtx) return;
    const baseConstraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } }, video: false };
    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            if (audioDevices.some(d => d.label)) {
                const { constraints } = getAudioConstraints(audioDevices);
                return navigator.mediaDevices.getUserMedia(constraints);
            }
            return navigator.mediaDevices.getUserMedia(baseConstraints)
                .then(initialStream => navigator.mediaDevices.enumerateDevices().then(newDevices => {
                    const { constraints, targetDevice } = getAudioConstraints(newDevices.filter(d => d.kind === 'audioinput'));
                    if (targetDevice) {
                        const track = initialStream.getAudioTracks()[0];
                        if (track && track.getSettings().deviceId !== targetDevice.deviceId) {
                            track.stop();
                            return navigator.mediaDevices.getUserMedia(constraints);
                        }
                    }
                    return initialStream;
                }));
        })
        .then(stream => {
            activeStream = stream;
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                    latencyHint: 'interactive',
                    sampleRate: 48000
                });
            } catch (e) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                    latencyHint: 'interactive'
                });
            }
            const source = audioCtx.createMediaStreamSource(stream);
            setupAnalyserNodes(source);
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
            analyser.smoothingTimeConstant = 0.0;
            analyser.minDecibels = Math.min(analyser.maxDecibels - 1, minDecibelsValue);
            
            if (analyserL && analyserR) {
                analyserL.fftSize = fftSizeValue;
                analyserL.smoothingTimeConstant = 0.0;
                analyserR.fftSize = fftSizeValue;
                analyserR.smoothingTimeConstant = 0.0;
                analyserL.minDecibels = Math.min(analyserL.maxDecibels - 1, minDecibelsValue);
                analyserR.minDecibels = Math.min(analyserR.maxDecibels - 1, minDecibelsValue);
            }

            // If fftSize changed, resize the buffers
            const bufferLength = analyser.frequencyBinCount;
            if (!dataArray || dataArray.length !== bufferLength) {
                dataArray = new Uint8Array(bufferLength);
                waveArray = new Uint8Array(bufferLength);
                
                dataArrayL = new Uint8Array(bufferLength);
                waveArrayL = new Uint8Array(bufferLength);
                dataArrayR = new Uint8Array(bufferLength);
                waveArrayR = new Uint8Array(bufferLength);
            }
        }

        // Set scanlines opacity in style
        document.body.style.setProperty('--scanlines-opacity', config.scanlines);

        const updateVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                const span = el.parentNode.querySelector('.slider-val');
                if (span) span.textContent = val;
            }
        };
        updateVal('themeSelect', currentTheme);
        updateVal('gainSlider', sensitivityMultiplier);
        updateVal('smoothingSlider', smoothingValue);
        updateVal('scanlinesSlider', config.scanlines);
        updateVal('fftSelect', fftSizeValue);
        updateVal('dbSlider', minDecibelsValue);
        updateVal('beatSlider', beatThresholdValue);
        updateVal('shakeSlider', shakeIntensityValue);
        updateVal('barsSlider', barsCount);
        updateVal('barGapSlider', barGap);
        updateVal('decaySlider', peakDecay);
        updateVal('eqColumnsSlider', eqColumns);
        updateVal('segHeightSlider', segHeight);
        updateVal('segGapSlider', segGap);
        updateVal('lineWidthSlider', oscLineWidth);
        updateVal('glowSlider', oscGlowIntensity);
        updateVal('vsLineWidthSlider', oscLineWidth);
        updateVal('vsGlowSlider', oscGlowIntensity);
        updateVal('orbitersSlider', orbiterCount);
        updateVal('ringSpeedSlider', ringSpeed);
        updateVal('vuSegmentsSlider', vuSegments);
        updateVal('vuGapSlider', vuGap);
        updateVal('vfdColumnsSlider', vfdColumns);
        updateVal('peakHoldSlider', vfdPeakHold);
        updateVal('waterfallSpeedSlider', waterfallSpeed);
        updateVal('ribbonThicknessSlider', ribbonThickness);
        updateVal('ribbonGlowSlider', ribbonGlow);
        updateVal('particleCountSlider', particleCount);
        updateVal('particleSpeedSlider', particleSpeed);

        precomputeMappings();
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
    } else if (currentStyle === 'vu') {
        const el = document.querySelector('.vu-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'analog-vu') {
        const el = document.querySelector('.analog-vu-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'waterfall') {
        const el = document.querySelector('.waterfall-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'ribbon') {
        const el = document.querySelector('.ribbon-setting');
        if (el) el.style.display = 'block';
    } else if (currentStyle === 'particles') {
        const el = document.querySelector('.particles-setting');
        if (el) el.style.display = 'block';
    }

    // Apply exact settings mapping for the active style
    applyStyleSettings();

    // Let display settle then measure and adjust window height
    requestAnimationFrame(() => {
        updateMenuHeight();
    });
}

// Toggle display state of the controls settings menu
function toggleMenu(forceState) {
    menuOpen = (forceState !== undefined) ? forceState : !menuOpen;
    const menuEl = document.getElementById('controlsMenu');
    
    const heightParam = parseInt(urlParams.get('height') || '45');
    menuEl.style.bottom = `${heightParam + 5}px`;
    menuEl.style.display = menuOpen ? 'block' : 'none';
    
    if (!menuOpen && typeof toggleHelp === 'function') {
        toggleHelp(false);
    }

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

    // Load HUD settings from localStorage
    const savedHudShow = localStorage.getItem('visualizer-hud-show');
    if (savedHudShow !== null) {
        hudShow = savedHudShow === 'true';
    }
    const savedHudTheme = localStorage.getItem('visualizer-hud-theme');
    if (savedHudTheme) {
        hudTheme = savedHudTheme;
    }
    updateHudDisplay();

    // Load Stereo Settings
    const savedStereo = localStorage.getItem('visualizer-stereo');
    if (savedStereo !== null) {
        isStereo = savedStereo === 'true';
    }

    // Apply active style configuration
    applyStyleSettings();

    // Inject dynamic value displays for all range sliders
    document.querySelectorAll('#controlsMenu input[type="range"]').forEach(slider => {
        // Only append if it doesn't already have one (to be safe)
        if (!slider.parentNode.querySelector('.slider-val')) {
            const span = document.createElement('span');
            span.className = 'slider-val';
            span.textContent = slider.value;
            slider.parentNode.appendChild(span);
            
            slider.addEventListener('input', () => {
                span.textContent = slider.value;
            });
        }
    });

    // Reset Defaults Button
    const resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (DEFAULT_STYLE_SETTINGS[currentStyle]) {
                // Deep copy default configurations back into active style
                Object.assign(styleSettings[currentStyle], JSON.parse(JSON.stringify(DEFAULT_STYLE_SETTINGS[currentStyle])));
                saveAllSettings();
                applyStyleSettings();
                
                // Provide visual feedback
                if (typeof showToast === 'function') {
                    showToast(`Restored defaults for ${currentStyle} style`);
                }
            }
        });
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

    // Event listeners setup
    const styleSelect = document.getElementById('styleSelect');
    if (styleSelect) {
        styleSelect.value = currentStyle;
        styleSelect.addEventListener('change', (e) => {
            currentStyle = e.target.value;
            localStorage.setItem('visualizer-style', currentStyle);
            updateControlsVisibility();
            applyStyleSettings();
            if (typeof showToast === 'function') {
                showToast(`Style: ${getStyleName(currentStyle)}`);
            }
        });
    }

    // Setup Stereo Toggle listener
    const stereoToggle = document.getElementById('stereoToggle');
    if (stereoToggle) {
        stereoToggle.checked = isStereo;
        stereoToggle.addEventListener('change', (e) => {
            isStereo = e.target.checked;
            localStorage.setItem('visualizer-stereo', isStereo);
            if (typeof showToast === 'function') {
                showToast(isStereo ? "Stereo Mode: ON" : "Stereo Mode: OFF");
            }
        });
    }

    // Setup HUD options event listeners
    const hudShowToggle = document.getElementById('hudShowToggle');
    if (hudShowToggle) {
        hudShowToggle.checked = hudShow;
        hudShowToggle.addEventListener('change', (e) => {
            hudShow = e.target.checked;
            localStorage.setItem('visualizer-hud-show', hudShow);
            updateHudDisplay();
        });
    }

    const hudThemeSelect = document.getElementById('hudThemeSelect');
    if (hudThemeSelect) {
        hudThemeSelect.value = hudTheme;
        hudThemeSelect.addEventListener('change', (e) => {
            hudTheme = e.target.value;
            localStorage.setItem('visualizer-hud-theme', hudTheme);
            updateHudDisplay();
        });
    }

    updateControlsVisibility();

    // Setup inputs mapping helper to register change listeners dynamically
    const inputs = [
        { id: 'themeSelect', key: 'theme', type: 'change', parse: v => v },
        { id: 'gainSlider', key: 'sensitivity', type: 'input', parse: parseFloat },
        { id: 'smoothingSlider', key: 'smoothing', type: 'input', parse: parseFloat, cb: v => {
            if (analyser) analyser.smoothingTimeConstant = 0.0;
            if (analyserL && analyserR) {
                analyserL.smoothingTimeConstant = 0.0;
                analyserR.smoothingTimeConstant = 0.0;
            }
        }},
        { id: 'scanlinesSlider', key: 'scanlines', type: 'input', parse: parseFloat, cb: v => document.body.style.setProperty('--scanlines-opacity', v) },
        { id: 'fftSelect', key: 'resolution', type: 'change', parse: parseInt, cb: v => {
            if (analyser && analyser.fftSize !== v) {
                analyser.fftSize = v;
                if (analyserL && analyserR) {
                    analyserL.fftSize = v;
                    analyserR.fftSize = v;
                }
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                waveArray = new Uint8Array(bufferLength);
                dataArrayL = new Uint8Array(bufferLength);
                waveArrayL = new Uint8Array(bufferLength);
                dataArrayR = new Uint8Array(bufferLength);
                waveArrayR = new Uint8Array(bufferLength);
            }
        }},
        { id: 'dbSlider', key: 'minDb', type: 'input', parse: parseFloat, cb: v => {
            if (analyser) analyser.minDecibels = Math.min(analyser.maxDecibels - 1, v);
            if (analyserL && analyserR) {
                analyserL.minDecibels = Math.min(analyserL.maxDecibels - 1, v);
                analyserR.minDecibels = Math.min(analyserR.maxDecibels - 1, v);
            }
        } },
        { id: 'beatSlider', key: 'beatSense', type: 'input', parse: parseFloat },
        { id: 'shakeSlider', key: 'shakeIntensity', type: 'input', parse: parseFloat },
        // Style-specific inputs
        { id: 'barsSlider', key: 'barsCount', type: 'input', parse: parseInt, style: 'bars' },
        { id: 'barGapSlider', key: 'barGap', type: 'input', parse: parseInt, style: 'bars' },
        { id: 'decaySlider', key: 'peakDecay', type: 'input', parse: parseFloat, style: 'bars' },
        { id: 'eqColumnsSlider', key: 'eqColumns', type: 'input', parse: parseInt, style: 'eq' },
        { id: 'segHeightSlider', key: 'segHeight', type: 'input', parse: parseInt, style: 'eq' },
        { id: 'segGapSlider', key: 'segGap', type: 'input', parse: parseInt, style: 'eq' },
        { id: 'lineWidthSlider', key: 'lineWidth', type: 'input', parse: parseFloat, style: 'wave' },
        { id: 'glowSlider', key: 'glowIntensity', type: 'input', parse: parseFloat, style: 'wave' },
        { id: 'vsLineWidthSlider', key: 'lineWidth', type: 'input', parse: parseFloat, style: 'vectorscope' },
        { id: 'vsGlowSlider', key: 'glowIntensity', type: 'input', parse: parseFloat, style: 'vectorscope' },
        { id: 'orbitersSlider', key: 'orbiters', type: 'input', parse: parseInt, style: 'pulse' },
        { id: 'ringSpeedSlider', key: 'ringSpeed', type: 'input', parse: parseFloat, style: 'pulse' },
        { id: 'vuSegmentsSlider', key: 'vuSegments', type: 'input', parse: parseInt, style: 'vu' },
        { id: 'vuGapSlider', key: 'vuGap', type: 'input', parse: parseInt, style: 'vu' },
        { id: 'vfdColumnsSlider', key: 'vfdColumns', type: 'input', parse: parseInt, style: 'analog-vu' },
        { id: 'peakHoldSlider', key: 'vfdPeakHold', type: 'input', parse: parseFloat, style: 'analog-vu' },
        { id: 'waterfallSpeedSlider', key: 'waterfallSpeed', type: 'input', parse: parseInt, style: 'waterfall' },
        { id: 'ribbonThicknessSlider', key: 'ribbonThickness', type: 'input', parse: parseFloat, style: 'ribbon' },
        { id: 'ribbonGlowSlider', key: 'ribbonGlow', type: 'input', parse: parseFloat, style: 'ribbon' },
        { id: 'particleCountSlider', key: 'particleCount', type: 'input', parse: parseInt, style: 'particles' },
        { id: 'particleSpeedSlider', key: 'particleSpeed', type: 'input', parse: parseFloat, style: 'particles' }
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
                if (item.key === 'barsCount' || item.key === 'eqColumns' || item.key === 'resolution') {
                    precomputeMappings();
                }
                if (item.key === 'theme' && typeof showToast === 'function') {
                    showToast(`Theme: ${getThemeName(val)}`);
                }
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

    // Position menu and trigger based on current edge layout
    const menuEl = document.getElementById('controlsMenu');
    const triggerEl = document.getElementById('controlsTrigger');
    if (menuEl) {
        if (currentPosition === 'top') {
            menuEl.style.top = `${visThickness + 10}px`;
            menuEl.style.bottom = 'auto';
        } else if (currentPosition === 'left') {
            menuEl.style.left = '10px';
            menuEl.style.right = 'auto';
            menuEl.style.bottom = `${visThickness + 10}px`;
            menuEl.style.top = 'auto';
            if (triggerEl) {
                triggerEl.style.left = `${visThickness - 40}px`;
                triggerEl.style.right = 'auto';
            }
        } else if (currentPosition === 'right') {
            menuEl.style.right = '10px';
            menuEl.style.left = 'auto';
            menuEl.style.bottom = `${visThickness + 10}px`;
            menuEl.style.top = 'auto';
        } else if (currentPosition === 'fullscreen') {
            menuEl.style.right = '10px';
            menuEl.style.bottom = '60px';
        }
    }

    // Help card toggle logic
    const settingsContent = document.getElementById('settingsContent');
    const shortcutsCard = document.getElementById('shortcutsCard');
    const helpTrigger = document.getElementById('helpTrigger');
    const backToSettings = document.getElementById('backToSettings');

    toggleHelp = function(show) {
        helpOpen = show;
        if (!settingsContent || !shortcutsCard || !helpTrigger) return;
        
        if (helpOpen) {
            settingsContent.style.display = 'none';
            shortcutsCard.style.display = 'block';
            helpTrigger.style.background = '#00f0ff';
            helpTrigger.style.color = 'black';
            if (!menuOpen) toggleMenu(true);
        } else {
            settingsContent.style.display = 'block';
            shortcutsCard.style.display = 'none';
            helpTrigger.style.background = 'rgba(255, 255, 255, 0.08)';
            helpTrigger.style.color = 'rgba(255, 255, 255, 0.5)';
        }
    };

    if (helpTrigger) {
        helpTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHelp(!helpOpen);
        });
    }

    if (backToSettings) {
        backToSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHelp(false);
        });
    }

    // Global control functions for keyboard shortcuts and IPC
    window.toggleHudGlobal = function() {
        hudShow = !hudShow;
        localStorage.setItem('visualizer-hud-show', hudShow);
        const hudShowToggle = document.getElementById('hudShowToggle');
        if (hudShowToggle) {
            hudShowToggle.checked = hudShow;
        }
        updateHudDisplay();
        if (typeof showToast === 'function') {
            showToast(hudShow ? "HUD: Enabled" : "HUD: Disabled");
        }
    };

    window.cycleStyle = function(forward) {
        const styles = ['bars', 'eq', 'wave', 'pulse', 'vu', 'waterfall', 'ribbon', 'particles'];
        let currentIndex = styles.indexOf(currentStyle);
        let nextIndex = forward ? 
            (currentIndex + 1) % styles.length : 
            (currentIndex - 1 + styles.length) % styles.length;
        const styleSelect = document.getElementById('styleSelect');
        if (styleSelect) {
            styleSelect.value = styles[nextIndex];
            styleSelect.dispatchEvent(new Event('change'));
        }
    };

    window.cycleTheme = function(forward) {
        const themes = ['cyberpunk', 'matrix', 'neon', 'volcano', 'monochrome'];
        let currentIndex = themes.indexOf(currentTheme);
        let nextIndex = forward ? 
            (currentIndex + 1) % themes.length : 
            (currentIndex - 1 + themes.length) % themes.length;
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = themes[nextIndex];
            themeSelect.dispatchEvent(new Event('change'));
        }
    };

    window.adjustGain = function(up) {
        const gainSlider = document.getElementById('gainSlider');
        if (gainSlider) {
            let val = parseFloat(gainSlider.value);
            val = up ? Math.min(3.0, val + 0.1) : Math.max(0.5, val - 0.1);
            gainSlider.value = val;
            gainSlider.dispatchEvent(new Event('input'));
            if (typeof showToast === 'function') {
                showToast(`Sensitivity: ${val.toFixed(1)}`);
            }
        }
    };

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        // 'm' key toggles menu
        if (e.key === 'm' || e.key === 'M') {
            toggleMenu(!menuOpen);
        }
        // 'h' or 'H' key toggles HUD
        else if (e.key === 'h' || e.key === 'H') {
            toggleHudGlobal();
        }
        // 'Escape' key hides menu or help card
        else if (e.key === 'Escape') {
            if (helpOpen) {
                toggleHelp(false);
            } else {
                toggleMenu(false);
            }
        }
        // '?' or '/' toggles help card
        else if (e.key === '?' || e.key === '/') {
            e.preventDefault();
            toggleHelp(!helpOpen);
        }
        // 's' key cycles style
        else if (e.key === 's' || e.key === 'S') {
            const styles = ['bars', 'eq', 'wave', 'pulse', 'vu', 'waterfall', 'ribbon', 'particles'];
            let currentIndex = styles.indexOf(currentStyle);
            let nextIndex = (e.key === 's') ? 
                (currentIndex - 1 + styles.length) % styles.length : 
                (currentIndex + 1) % styles.length;
            const styleSelect = document.getElementById('styleSelect');
            if (styleSelect) {
                styleSelect.value = styles[nextIndex];
                styleSelect.dispatchEvent(new Event('change'));
            }
        }
        // 't' key cycles theme
        else if (e.key === 't' || e.key === 'T') {
            const themes = ['cyberpunk', 'matrix', 'neon', 'volcano', 'monochrome'];
            let currentIndex = themes.indexOf(currentTheme);
            let nextIndex = (e.key === 't') ? 
                (currentIndex - 1 + themes.length) % themes.length : 
                (currentIndex + 1) % themes.length;
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) {
                themeSelect.value = themes[nextIndex];
                themeSelect.dispatchEvent(new Event('change'));
            }
        }
        // ArrowUp / ArrowDown adjust sensitivity
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const gainSlider = document.getElementById('gainSlider');
            if (gainSlider) {
                let newVal = Math.min(3.0, parseFloat(gainSlider.value) + 0.1);
                gainSlider.value = newVal.toFixed(1);
                gainSlider.dispatchEvent(new Event('input'));
            }
        }
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const gainSlider = document.getElementById('gainSlider');
            if (gainSlider) {
                let newVal = Math.max(0.5, parseFloat(gainSlider.value) - 0.1);
                gainSlider.value = newVal.toFixed(1);
                gainSlider.dispatchEvent(new Event('input'));
            }
        }
    });
});

// Toast Notification Helper Functions
function getStyleName(style) {
    const names = {
        bars: "Classic Bars",
        eq: "LED Equalizer",
        wave: "Oscilloscope",
        vectorscope: "Vectorscope (XY)",
        pulse: "Orbital Pulse",
        vu: "Stereo VU Meter",
        waterfall: "Sidebar Waterfall",
        ribbon: "Neon Ribbon",
        particles: "Ambient Particles"
    };
    return names[style] || style;
}

function getThemeName(theme) {
    const names = {
        cyberpunk: "Cyberpunk",
        matrix: "Matrix",
        neon: "Neon Glow",
        volcano: "Volcano",
        monochrome: "Monochrome"
    };
    return names[theme] || theme;
}

function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.opacity = '1';
    
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 1200);
}

// Music HUD Metadata Integration
let currentMetadata = null;

window.onMetadataUpdate = function(metadata) {
    currentMetadata = metadata;
    const hud = document.getElementById('musicHud');
    const marquee = document.getElementById('hudMarquee');
    const progress = document.getElementById('hudProgressBar');
    
    if (!hud || !marquee || !progress) return;

    if (!metadata || !metadata.title) {
        // No media playing/active state
        marquee.textContent = "NO TRACK ACTIVE";
        progress.style.width = '0%';
        return;
    }
    
    // Format track details: "Artist - Title" with padding and repeats for scroll effect
    const artist = metadata.artist || 'UNKNOWN ARTIST';
    const title = metadata.title || 'UNKNOWN TITLE';
    const trackString = `${artist.toUpperCase()} - ${title.toUpperCase()}   •   `;
    marquee.textContent = trackString.repeat(3);
    
    // Update progress bar
    if (metadata.length > 0) {
        const pct = (metadata.position / metadata.length) * 100;
        progress.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    } else {
        progress.style.width = '0%';
    }
};

function updateHudDisplay() {
    const hud = document.getElementById('musicHud');
    const menu = document.getElementById('controlsMenu');
    if (hud) {
        // Clear and rebuild class list
        hud.className = '';
        hud.classList.add(hudTheme);
        hud.classList.add(`pos-${currentPosition}`);
        if (!hudShow) {
            hud.classList.add('hidden');
        }
    }
    if (menu) {
        if (hudTheme === 'winamp-classic') {
            menu.classList.add('winamp-menu');
        } else {
            menu.classList.remove('winamp-menu');
        }
    }
}

// Flush audio context buffer periodically (every 10 minutes) to prevent cumulative GStreamer/WebAudio resampler drift/desync
setInterval(() => {
    resetAudioContext();
}, 10 * 60 * 1000);
