// @ts-nocheck
/**
 * audio.js
 * 
 * This module handles all Web Audio API interactions for the visualizer.
 * It is responsible for:
 * 1. Requesting and initializing the user's microphone or system audio input stream.
 * 2. Creating the AudioContext and setting up the AnalyserNode.
 * 3. Processing raw audio data into frequency and waveform arrays.
 * 4. Handling input device switching and enumeration.
 * 
 * The AnalyserNode is configured with a high FFT size (8192) to provide
 * detailed frequency resolution, which is essential for accurate visualization.
 * 
 * This module exports the setupAudio and updateAudioData functions, which
 * are called from the main application loop. It interacts with the global
 * state object to store the resulting frequency data for rendering.
 * 
 * Key Audio Parameters:
 * - FFT Size: 8192
 * - Smoothing Time Constant: 0.8
 * - Sample Rate: Default hardware sample rate
 * 
 * Note: Browser autoplay policies require user interaction before the AudioContext
 * can be fully started. The UI must handle this by showing a "Start" button.
 */
// audio.js
// Web Audio API interactions, frequency processing, and reactive state calculations.

import { state } from './state.js';

// Precomputed mapping lookup tables logic
export function getInterpolatedBinValue(fractionalBin, arr = state.dataArray) {
if (!arr || arr.length === 0) return 0;
const idx = Math.max(0, Math.min(arr.length - 1, fractionalBin));
const low = Math.floor(idx);
const high = Math.ceil(idx);
if (low === high) return arr[low];
const weight = idx - low;
return arr[low] * (1 - weight) + arr[high] * weight;
}

export function getMappedValue(mapping, arr = state.dataArray) {
if (!arr || arr.length === 0) return 0;
const { start, end } = mapping;
if (end - start < 1.0) {
return getInterpolatedBinValue((start + end) / 2, arr) / 255;
} else {
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

function buildMapping(targetCount) {
const sampleRate = (state.audioCtx && state.audioCtx.sampleRate) ? state.audioCtx.sampleRate : 48000;
const binCount = state.fftSizeValue / 2;
const mappings = [];
const minFreq = 45; 
const maxFreq = 16000; 

for (let i = 0; i < targetCount; i++) {
const fStart = minFreq * Math.pow(maxFreq / minFreq, i / targetCount);
const fEnd = minFreq * Math.pow(maxFreq / minFreq, (i + 1) / targetCount);
const binStart = 1.0 + (fStart * state.fftSizeValue) / sampleRate;
const binEnd = 1.0 + (fEnd * state.fftSizeValue) / sampleRate;
mappings.push({
start: Math.max(1, binStart),
end: Math.min(binCount - 1, binEnd)
});
}
return mappings;
}

export function precomputeMappings() {
state.barBinMappings = buildMapping(state.barsCount);
state.eqBinMappings = buildMapping(state.eqColumns);
state.waterfallBinMappings = buildMapping(128);
}

const SMOOTH = 0.7;
const BEAT_COOLDOWN_MS = 150;

export function updateReactiveState() {
if (!state.dataArray || state.dataArray.length === 0) return;

const len = state.dataArray.length;
const sampleRate = (state.audioCtx && state.audioCtx.sampleRate) ? state.audioCtx.sampleRate : 48000;

const bassEndBin = Math.max(1, Math.round((150 * state.fftSizeValue) / sampleRate));
const midsEndBin = Math.max(bassEndBin + 1, Math.round((2000 * state.fftSizeValue) / sampleRate));
const trebleEndBin = Math.min(len - 1, Math.max(midsEndBin + 1, Math.round((20000 * state.fftSizeValue) / sampleRate)));

let bassSum = 0, midsSum = 0, trebleSum = 0;
let bassCount = 0, midsCount = 0, trebleCount = 0;

for (let i = 0; i < len; i++) {
if (i <= bassEndBin) {
bassSum += state.dataArray[i];
bassCount++;
} else if (i <= midsEndBin) {
midsSum += state.dataArray[i];
midsCount++;
} else if (i <= trebleEndBin) {
trebleSum += state.dataArray[i];
trebleCount++;
}
}

const rawBass = bassSum / ((bassCount || 1) * 255);
const rawMids = midsSum / ((midsCount || 1) * 255);
const rawTreble = trebleSum / ((trebleCount || 1) * 255);

state.smoothBass = state.smoothBass * SMOOTH + rawBass * (1 - SMOOTH);
state.smoothMids = state.smoothMids * SMOOTH + rawMids * (1 - SMOOTH);
state.smoothTreble = state.smoothTreble * SMOOTH + rawTreble * (1 - SMOOTH);

let total = 0;
for (let i = 0; i < len; i++) {
total += (state.dataArray[i] / 255) ** 2;
}
const rawEnergy = Math.sqrt(total / len);
state.smoothEnergy = state.smoothEnergy * SMOOTH + rawEnergy * (1 - SMOOTH);

const currentBass = ((state.dataArray[1] || 0) + (state.dataArray[2] || 0) + (state.dataArray[3] || 0)) / (3 * 255);
state.smoothBassAmp = state.smoothBassAmp * 0.95 + currentBass * 0.05;

state.isBeat = false;
const now = performance.now();
const dynamicThreshold = Math.max(0.012, state.smoothBassAmp * (0.15 + (1.0 - state.beatThresholdValue) * 0.3));
if ((currentBass - state.smoothBassAmp) > dynamicThreshold && (now - state.lastBeat) > BEAT_COOLDOWN_MS) {
state.isBeat = true;
state.lastBeat = now;
}

const bandTotal = state.smoothBass + state.smoothMids + state.smoothTreble + 0.001;
state.hue = Math.round(
(state.smoothBass / bandTotal) * 15 +
(state.smoothMids / bandTotal) * 180 +
(state.smoothTreble / bandTotal) * 280
);

state.energy = state.smoothEnergy;
state.bass = state.smoothBass;
}

export function getAudioConstraints(devices) {
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

export function cleanupAudio() {
if (state.audioCtx) {
try { state.audioCtx.close(); } catch (e) {}
state.audioCtx = null;
}
if (state.activeStream) {
try { state.activeStream.getTracks().forEach(track => track.stop()); } catch (e) {}
state.activeStream = null;
}
state.analyser = null;
state.analyserL = null;
state.analyserR = null;
}

export function setupAnalyserNodes(source) {
state.analyser = state.audioCtx.createAnalyser();
state.analyser.fftSize = state.fftSizeValue;
state.analyser.smoothingTimeConstant = 0.0;
state.analyser.minDecibels = Math.min(state.analyser.maxDecibels - 1, state.minDecibelsValue);

const bufferLength = state.analyser.frequencyBinCount;
state.dataArray = new Uint8Array(bufferLength);
state.waveArray = new Uint8Array(bufferLength);
source.connect(state.analyser);

state.analyserL = state.audioCtx.createAnalyser();
state.analyserR = state.audioCtx.createAnalyser();
state.analyserL.fftSize = state.fftSizeValue;
state.analyserL.smoothingTimeConstant = 0.0;
state.analyserL.minDecibels = Math.min(state.analyserL.maxDecibels - 1, state.minDecibelsValue);
state.analyserR.fftSize = state.fftSizeValue;
state.analyserR.smoothingTimeConstant = 0.0;
state.analyserR.minDecibels = Math.min(state.analyserR.maxDecibels - 1, state.minDecibelsValue);

state.dataArrayL = new Uint8Array(bufferLength);
state.waveArrayL = new Uint8Array(bufferLength);
state.dataArrayR = new Uint8Array(bufferLength);
state.waveArrayR = new Uint8Array(bufferLength);

const splitter = state.audioCtx.createChannelSplitter(2);
source.connect(splitter);
splitter.connect(state.analyserL, 0);

const trackSettings = state.activeStream.getAudioTracks()[0]?.getSettings();
const channelCount = trackSettings?.channelCount || source.channelCount;
if (channelCount >= 2) {
splitter.connect(state.analyserR, 1);
} else {
splitter.connect(state.analyserR, 0);
}

precomputeMappings();
}

export function resetAudioContext() {
if (!state.audioCtx || !state.activeStream) return;

console.log("🔊 Flushing audio context to clear latency/drift buffer...");
try { state.audioCtx.close(); } catch (e) {}
state.audioCtx = null;

try {
state.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
latencyHint: 'interactive', sampleRate: 48000
});
} catch (e) {
state.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
latencyHint: 'interactive'
});
}

const source = state.audioCtx.createMediaStreamSource(state.activeStream);
setupAnalyserNodes(source);
}

export async function initAudio(startRenderLoop) {
if (state.audioCtx) return;
const baseConstraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } }, video: false };

try {
const devices = await navigator.mediaDevices.enumerateDevices();
const audioDevices = devices.filter(d => d.kind === 'audioinput');

let stream;
if (audioDevices.some(d => d.label)) {
const { constraints } = getAudioConstraints(audioDevices);
stream = await navigator.mediaDevices.getUserMedia(constraints);
} else {
const initialStream = await navigator.mediaDevices.getUserMedia(baseConstraints);
const newDevices = await navigator.mediaDevices.enumerateDevices();
const { constraints, targetDevice } = getAudioConstraints(newDevices.filter(d => d.kind === 'audioinput'));

if (targetDevice) {
const track = initialStream.getAudioTracks()[0];
if (track && track.getSettings().deviceId !== targetDevice.deviceId) {
track.stop();
stream = await navigator.mediaDevices.getUserMedia(constraints);
} else {
stream = initialStream;
}
} else {
stream = initialStream;
}
}

state.activeStream = stream;
try {
state.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
latencyHint: 'interactive',
sampleRate: 48000
});
} catch (e) {
state.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
latencyHint: 'interactive'
});
}
const source = state.audioCtx.createMediaStreamSource(stream);
setupAnalyserNodes(source);
startRenderLoop();
} catch (err) {
console.error("❌ Audio capture blocked or failed:", err);
state.dataArray = new Uint8Array(256);
state.waveArray = new Uint8Array(256);
for(let i=0; i<256; i++) state.waveArray[i] = 128;
startRenderLoop();
}
}

