// @ts-nocheck
/**
 * state.js
 * 
 * This module encapsulates the global application state for the audio visualizer.
 * Having a centralized state object ensures that the audio processing,
 * rendering, and UI components all have access to the same source of truth.
 * 
 * The state object includes:
 * - Audio data buffers (frequency arrays, waveform arrays)
 * - Visualization configuration (current style, colors, sensitivity)
 * - Rendering parameters (canvas dimensions, framerate metrics)
 * - Peak hold values for VU meters and EQ bands
 * 
 * By isolating state, we prevent global namespace pollution and make the
 * application easier to test and reason about. All modules import this
 * shared state and mutate it synchronously during the requestAnimationFrame loop.
 */
// state.js
// Centralized state container for the visualizer.

export const styleSettings = {
bars: {
theme: 'cyberpunk', sensitivity: 1.2, smoothing: 0.55, scanlines: 0.35, resolution: 512,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
barsCount: 64, barGap: 2, peakDecay: 0.975
},
eq: {
theme: 'cyberpunk', sensitivity: 1.2, smoothing: 0.55, scanlines: 0.35, resolution: 512,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
eqColumns: 24, segHeight: 4, segGap: 2
},
wave: {
theme: 'cyberpunk', sensitivity: 1.0, smoothing: 0.5, scanlines: 0.35, resolution: 512,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
lineWidth: 2.5, glowIntensity: 0.6
},
vectorscope: {
theme: 'cyberpunk', sensitivity: 1.0, smoothing: 0.5, scanlines: 0.35, resolution: 512,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
lineWidth: 2.5, glowIntensity: 0.6
},
pulse: {
theme: 'cyberpunk', sensitivity: 1.2, smoothing: 0.55, scanlines: 0.35, resolution: 512,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
orbiters: 8, ringSpeed: 1.5
},
vu: {
theme: 'cyberpunk', sensitivity: 1.5, smoothing: 0.3, scanlines: 0.35, resolution: 256,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
vuSegments: 40, vuGap: 3
},
'analog-vu': {
theme: 'cyberpunk', sensitivity: 1.5, smoothing: 0.1, scanlines: 0.35, resolution: 256,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
vfdColumns: 15, vfdPeakHold: 0.95
},
waterfall: {
theme: 'cyberpunk', sensitivity: 1.2, smoothing: 0.4, scanlines: 0.35, resolution: 256,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
waterfallSpeed: 4
},
ribbon: {
theme: 'cyberpunk', sensitivity: 1.5, smoothing: 0.6, scanlines: 0.35, resolution: 512,
minDb: -90, beatSense: 0.25, bloomIntensity: 0.5, shakeIntensity: 1.0,
ribbonThickness: 3.5, ribbonGlow: 0.7
},
particles: {
theme: 'cyberpunk', sensitivity: 1.0, smoothing: 0.5, scanlines: 0.15, resolution: 256,
minDb: -90, beatSense: 0.3, bloomIntensity: 0.5, shakeIntensity: 1.0,
particleCount: 60, particleSpeed: 1.0
}
};

export const DEFAULT_STYLE_SETTINGS = JSON.parse(JSON.stringify(styleSettings));

const urlParams = new URLSearchParams(window.location.search);
const currentPosition = urlParams.get('position') || 'bottom';

export const state = {
// DOM / Init
canvas: null,
ctx: null,
currentPosition,
isVertical: currentPosition === 'left' || currentPosition === 'right',
isLeft: currentPosition === 'left',
isRight: currentPosition === 'right',
visThickness: parseInt(urlParams.get('height') || '45'),

// UI
helpOpen: false,
toggleHelp: null,
hudShow: true,
hudTheme: 'green-lcd',
menuOpen: false,
isSuppressingEvents: false,
toastTimeout: null,

// Audio Context
audioCtx: null,
activeStream: null,
analyser: null,
analyserL: null,
analyserR: null,
dataArray: null,
waveArray: null,
dataArrayL: null,
waveArrayL: null,
dataArrayR: null,
waveArrayR: null,

// Smoothing Buffers
smoothedDataArray: null,
smoothedDataArrayL: null,
smoothedDataArrayR: null,

// Peak tracking
vfdPeaks: [],
peakHoldL: 0,
peakHoldR: 0,
peakHoldTimeL: 0,
peakHoldTimeR: 0,
peakLevel: 0.5,
wavePeakLevel: 0.1,

// Mappings
barBinMappings: [],
eqBinMappings: [],
waterfallBinMappings: [],

// Global Config
currentStyle: urlParams.get('style') || 'bars',
currentTheme: 'cyberpunk',
sensitivityMultiplier: 1.2,
smoothingValue: 0.55,
testModeActive: false,
minDecibelsValue: -90,
beatThresholdValue: 0.25,
fftSizeValue: 512,
shakeIntensityValue: 1.0,
currentShakeX: 0,
currentShakeY: 0,
isStereo: false,

// Style specific overrides
barsCount: 64,
barGap: 2,
peakDecay: 0.975,
eqColumns: 24,
segHeight: 4,
segGap: 2,
oscLineWidth: 2.5,
oscGlowIntensity: 0.6,
orbiterCount: 8,
ringSpeed: 1.5,
vuSegments: 40,
vuGap: 3,
waterfallSpeed: 4,
ribbonThickness: 3.5,
ribbonGlow: 0.7,
particleCount: 60,
particleSpeed: 1.0,
vfdColumns: 15,
vfdPeakHold: 0.95,

// Reactive Audio Calculations
smoothBass: 0,
smoothMids: 0,
smoothTreble: 0,
smoothEnergy: 0,
prevEnergy: 0,
lastBeat: 0,
hue: 200,
energy: 0,
isBeat: false,
bass: 0,
smoothBassAmp: 0,
lpVal: 0
};

export function updatePeak(frameMax) {
if (frameMax > state.peakLevel) {
state.peakLevel = frameMax;
} else {
state.peakLevel *= state.peakDecay;
}
state.peakLevel = Math.max(state.peakLevel, 0.1);
}

export function updateWavePeak(frameMax) {
if (frameMax > state.wavePeakLevel) {
state.wavePeakLevel = frameMax;
} else {
state.wavePeakLevel *= 0.95; // WAVE_PEAK_DECAY
}
state.wavePeakLevel = Math.max(state.wavePeakLevel, 0.02);
}

export function getBaseHue() {
switch (state.currentTheme) {
case 'matrix': return 120;
case 'neon': return 300;
case 'volcano': return 15;
case 'monochrome': return 0;
case 'cyberpunk':
default: return state.hue;
}
}

export function getThemeColor(ratio, value, alpha = 1.0) {
switch (state.currentTheme) {
case 'matrix':
return `hsla(120, 100%, ${40 + value * 30}%, ${alpha})`;
case 'neon':
const neonHue = 280 + ratio * 60;
return `hsla(${neonHue}, 100%, ${55 + value * 20}%, ${alpha})`;
case 'volcano':
const volc = ratio * 50; 
return `hsla(${volc}, 100%, ${50 + value * 25}%, ${alpha})`;
case 'monochrome':
return `hsla(0, 0%, ${60 + value * 40}%, ${alpha})`;
case 'cyberpunk':
default:
const cyber = 180 + ratio * 120;
return `hsla(${cyber}, 90%, ${50 + value * 20}%, ${alpha})`;
}
}

