// @ts-nocheck
/**
 * main.js
 * 
 * This is the entry point for the audio visualizer application.
 * It handles:
 * - DOM initialization and event listeners
 * - Main application loop (requestAnimationFrame)
 * - User Interface (UI) interactions (menus, buttons, sliders)
 * - IPC (Inter-Process Communication) with the Python backend wrapper
 * 
 * The main loop orchestrates the interaction between the audio module
 * (fetching new audio data) and the rendering module (drawing to the canvas).
 * 
 * Performance is a critical concern here; the main loop must execute within
 * 16ms to maintain a smooth 60 FPS. Therefore, DOM updates are minimized
 * and mostly restricted to canvas rendering operations.
 */
// main.js
// Main entry point for the application. Orchestrates state, audio, rendering, and UI.

import { state, styleSettings, DEFAULT_STYLE_SETTINGS } from './state.js';
import { initAudio, precomputeMappings } from './audio.js';
import { render } from './rendering.js';

const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
state.canvas = canvas;
state.ctx = ctx;

// Initial background clear
ctx.clearRect(0, 0, canvas.width, canvas.height);

const varSetters = {
theme: v => { state.currentTheme = v; if (typeof updateNowPlayingThemeColors === 'function') updateNowPlayingThemeColors(); },
sensitivity: v => { state.sensitivityMultiplier = v; },
smoothing: v => { state.smoothingValue = v; },
resolution: v => { state.fftSizeValue = v; },
minDb: v => { state.minDecibelsValue = v; },
beatSense: v => { state.beatThresholdValue = v; },
shakeIntensity: v => { state.shakeIntensityValue = v; },
barsCount: v => { state.barsCount = v; },
barGap: v => { state.barGap = v; },
peakDecay: v => { state.peakDecay = v; },
eqColumns: v => { state.eqColumns = v; },
segHeight: v => { state.segHeight = v; },
segGap: v => { state.segGap = v; },
lineWidth: v => { state.oscLineWidth = v; },
glowIntensity: v => { state.oscGlowIntensity = v; },
orbiters: v => { state.orbiterCount = v; },
ringSpeed: v => { state.ringSpeed = v; },
vuSegments: v => { state.vuSegments = v; },
vuGap: v => { state.vuGap = v; },
waterfallSpeed: v => { state.waterfallSpeed = v; },
ribbonThickness: v => { state.ribbonThickness = v; },
ribbonGlow: v => { state.ribbonGlow = v; },
particleCount: v => { state.particleCount = v; },
particleSpeed: v => { state.particleSpeed = v; },
vfdColumns: v => { state.vfdColumns = v; },
vfdPeakHold: v => { state.vfdPeakHold = v; }
};

function saveAllSettings() {
localStorage.setItem('visualizer-all-style-settings', JSON.stringify(styleSettings));
}


function resizeCanvas() {
const heightParam = parseInt(new URLSearchParams(window.location.search).get('height') || '45');
if (state.currentPosition === 'left' || state.currentPosition === 'right' || state.currentPosition === 'fullscreen') {
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
} else {
canvas.width = window.innerWidth;
canvas.height = heightParam;
if (state.currentPosition === 'top') {
canvas.style.top = '0px';
canvas.style.bottom = 'auto';
} else {
canvas.style.bottom = '0px';
canvas.style.top = 'auto';
}
}
canvas.style.background = state.currentPosition === 'fullscreen' ? 'transparent' : 'black';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


// ─── Controls Menu & JS-Python Bridge ────────────────
state.menuOpen = false;

// Function to update the menu height and notify python
function updateMenuHeight() {
const menuEl = document.getElementById('controlsMenu');
if (!menuEl || !state.menuOpen) return;
const menuHeight = menuEl.offsetHeight;
document.title = JSON.stringify({
action: "menu-resize",
menuHeight: menuHeight
});
}

// Helper to get active style lookup key
function getLookupStyle() {
let lookupStyle = state.currentStyle;
if (lookupStyle === 'oscilloscope') lookupStyle = 'wave';
if (lookupStyle === 'neural') lookupStyle = 'pulse';
return lookupStyle;
}

// Apply settings configuration for the active style and update sliders
function applyStyleSettings() {
state.isSuppressingEvents = true;
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

// Apply values to state.analyser context if running
if (state.analyser) {
state.analyser.fftSize = state.fftSizeValue;
state.analyser.smoothingTimeConstant = 0.0;
state.analyser.minDecibels = Math.min(state.analyser.maxDecibels - 1, state.minDecibelsValue);

if (state.analyserL && state.analyserR) {
state.analyserL.fftSize = state.fftSizeValue;
state.analyserL.smoothingTimeConstant = 0.0;
state.analyserR.fftSize = state.fftSizeValue;
state.analyserR.smoothingTimeConstant = 0.0;
state.analyserL.minDecibels = Math.min(state.analyserL.maxDecibels - 1, state.minDecibelsValue);
state.analyserR.minDecibels = Math.min(state.analyserR.maxDecibels - 1, state.minDecibelsValue);
}

// If fftSize changed, resize the buffers
const bufferLength = state.analyser.frequencyBinCount;
if (!state.dataArray || state.dataArray.length !== bufferLength) {
state.dataArray = new Uint8Array(bufferLength);
state.waveArray = new Uint8Array(bufferLength);

state.dataArrayL = new Uint8Array(bufferLength);
state.waveArrayL = new Uint8Array(bufferLength);
state.dataArrayR = new Uint8Array(bufferLength);
state.waveArrayR = new Uint8Array(bufferLength);
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
updateVal('themeSelect', state.currentTheme);
updateVal('gainSlider', state.sensitivityMultiplier);
updateVal('smoothingSlider', state.smoothingValue);
updateVal('scanlinesSlider', config.scanlines);
updateVal('fftSelect', state.fftSizeValue);
updateVal('dbSlider', state.minDecibelsValue);
updateVal('beatSlider', state.beatThresholdValue);
updateVal('shakeSlider', state.shakeIntensityValue);
updateVal('barsSlider', state.barsCount);
updateVal('barGapSlider', state.barGap);
updateVal('decaySlider', state.peakDecay);
updateVal('eqColumnsSlider', state.eqColumns);
updateVal('segHeightSlider', state.segHeight);
updateVal('segGapSlider', state.segGap);
updateVal('lineWidthSlider', state.oscLineWidth);
updateVal('glowSlider', state.oscGlowIntensity);
updateVal('vsLineWidthSlider', state.oscLineWidth);
updateVal('vsGlowSlider', state.oscGlowIntensity);
updateVal('orbitersSlider', state.orbiterCount);
updateVal('ringSpeedSlider', state.ringSpeed);
updateVal('vuSegmentsSlider', state.vuSegments);
updateVal('vuGapSlider', state.vuGap);
updateVal('vfdColumnsSlider', state.vfdColumns);
updateVal('peakHoldSlider', state.vfdPeakHold);
updateVal('waterfallSpeedSlider', state.waterfallSpeed);
updateVal('ribbonThicknessSlider', state.ribbonThickness);
updateVal('ribbonGlowSlider', state.ribbonGlow);
updateVal('particleCountSlider', state.particleCount);
updateVal('particleSpeedSlider', state.particleSpeed);

precomputeMappings();
} finally {
state.isSuppressingEvents = false;
}
}

// Update visibility of style-specific settings controls
function updateControlsVisibility() {
const styleSettingsDivs = document.querySelectorAll('.style-setting');
styleSettingsDivs.forEach(el => el.style.display = 'none');

const smoothingGroup = document.getElementById('smoothingGroup');
if (smoothingGroup) {
if (state.currentStyle === 'wave' || state.currentStyle === 'oscilloscope') {
smoothingGroup.style.display = 'none';
} else {
smoothingGroup.style.display = 'flex';
}
}

if (state.currentStyle === 'bars') {
const el = document.querySelector('.bars-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'eq') {
const el = document.querySelector('.eq-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'wave' || state.currentStyle === 'oscilloscope') {
const el = document.querySelector('.wave-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'pulse' || state.currentStyle === 'neural') {
const el = document.querySelector('.pulse-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'vu') {
const el = document.querySelector('.vu-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'analog-vu') {
const el = document.querySelector('.analog-vu-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'waterfall') {
const el = document.querySelector('.waterfall-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'ribbon') {
const el = document.querySelector('.ribbon-setting');
if (el) el.style.display = 'block';
} else if (state.currentStyle === 'particles') {
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
state.menuOpen = (forceState !== undefined) ? forceState : !state.menuOpen;
const menuEl = document.getElementById('controlsMenu');

const heightParam = parseInt(new URLSearchParams(window.location.search).get('height') || '45');
menuEl.style.bottom = `${heightParam + 5}px`;
menuEl.style.display = state.menuOpen ? 'block' : 'none';

if (!state.menuOpen && typeof toggleHelp === 'function') {
toggleHelp(false);
}

const menuHeight = menuEl.offsetHeight || 250;

// Notify python wrapper of the state change to resize window and adjust input shape
document.title = JSON.stringify({
action: "menu-toggle",
open: state.menuOpen,
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
if (savedStyle) state.currentStyle = savedStyle;

// Load HUD settings from localStorage
const savedHudShow = localStorage.getItem('visualizer-hud-show');
if (savedHudShow !== null) {
state.hudShow = savedHudShow === 'true';
}
const savedHudTheme = localStorage.getItem('visualizer-hud-theme');
if (savedHudTheme) {
state.hudTheme = savedHudTheme;
}
updateHudDisplay();

// Load Stereo Settings
const savedStereo = localStorage.getItem('visualizer-stereo');
if (savedStereo !== null) {
state.isStereo = savedStereo === 'true';
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
if (DEFAULT_STYLE_SETTINGS[state.currentStyle]) {
// Deep copy default configurations back into active style
Object.assign(styleSettings[state.currentStyle], JSON.parse(JSON.stringify(DEFAULT_STYLE_SETTINGS[state.currentStyle])));
saveAllSettings();
applyStyleSettings();

// Provide visual feedback
if (typeof showToast === 'function') {
showToast(`Restored defaults for ${state.currentStyle} style`);
}
}
});
}

// Attempt initialization automatically
initAudio(render);

// Setup visualizer height styling from query parameters
const heightParam = parseInt(new URLSearchParams(window.location.search).get('height') || '45');
canvas.style.height = `${heightParam}px`;

const trigger = document.getElementById('controlsTrigger');
trigger.style.height = `${heightParam}px`;

// Populate active device label from query params
const rawDevice = new URLSearchParams(window.location.search).get('device') || 'Default';
const deviceLabel = document.getElementById('deviceLabel');
if (deviceLabel) {
// Shorten device name for display
const displayDevice = rawDevice.split('.').pop() || rawDevice;
deviceLabel.innerText = `Source: ${displayDevice}`;
}

// Event listeners setup
const styleSelect = document.getElementById('styleSelect');
if (styleSelect) {
(styleSelect as HTMLSelectElement).value = state.currentStyle;
styleSelect.addEventListener('change', (e) => {
state.currentStyle = e.target.value;
localStorage.setItem('visualizer-style', state.currentStyle);
updateControlsVisibility();
applyStyleSettings();
if (typeof showToast === 'function') {
showToast(`Style: ${getStyleName(state.currentStyle)}`);
}
});
}

// Setup Stereo Toggle listener
const stereoToggle = document.getElementById('stereoToggle');
if (stereoToggle) {
stereoToggle.checked = state.isStereo;
stereoToggle.addEventListener('change', (e) => {
state.isStereo = e.target.checked;
localStorage.setItem('visualizer-stereo', state.isStereo);
if (typeof showToast === 'function') {
showToast(state.isStereo ? "Stereo Mode: ON" : "Stereo Mode: OFF");
}
});
}

// Setup HUD options event listeners
const hudShowToggle = document.getElementById('hudShowToggle');
if (hudShowToggle) {
hudShowToggle.checked = state.hudShow;
hudShowToggle.addEventListener('change', (e) => {
state.hudShow = e.target.checked;
localStorage.setItem('visualizer-hud-show', state.hudShow);
updateHudDisplay();
});
}

const hudThemeSelect = document.getElementById('hudThemeSelect');
if (hudThemeSelect) {
hudThemeSelect.value = state.hudTheme;
hudThemeSelect.addEventListener('change', (e) => {
state.hudTheme = e.target.value;
localStorage.setItem('visualizer-hud-theme', state.hudTheme);
updateHudDisplay();
});
}

updateControlsVisibility();

// Setup inputs mapping helper to register change listeners dynamically
const inputs = [
{ id: 'themeSelect', key: 'theme', type: 'change', parse: v => v },
{ id: 'gainSlider', key: 'sensitivity', type: 'input', parse: parseFloat },
{ id: 'smoothingSlider', key: 'smoothing', type: 'input', parse: parseFloat, cb: v => {
if (state.analyser) state.analyser.smoothingTimeConstant = 0.0;
if (state.analyserL && state.analyserR) {
state.analyserL.smoothingTimeConstant = 0.0;
state.analyserR.smoothingTimeConstant = 0.0;
}
}},
{ id: 'scanlinesSlider', key: 'scanlines', type: 'input', parse: parseFloat, cb: v => document.body.style.setProperty('--scanlines-opacity', v) },
{ id: 'fftSelect', key: 'resolution', type: 'change', parse: parseInt, cb: v => {
if (state.analyser && state.analyser.fftSize !== v) {
state.analyser.fftSize = v;
if (state.analyserL && state.analyserR) {
state.analyserL.fftSize = v;
state.analyserR.fftSize = v;
}
const bufferLength = state.analyser.frequencyBinCount;
state.dataArray = new Uint8Array(bufferLength);
state.waveArray = new Uint8Array(bufferLength);
state.dataArrayL = new Uint8Array(bufferLength);
state.waveArrayL = new Uint8Array(bufferLength);
state.dataArrayR = new Uint8Array(bufferLength);
state.waveArrayR = new Uint8Array(bufferLength);
}
}},
{ id: 'dbSlider', key: 'minDb', type: 'input', parse: parseFloat, cb: v => {
if (state.analyser) state.analyser.minDecibels = Math.min(state.analyser.maxDecibels - 1, v);
if (state.analyserL && state.analyserR) {
state.analyserL.minDecibels = Math.min(state.analyserL.maxDecibels - 1, v);
state.analyserR.minDecibels = Math.min(state.analyserR.maxDecibels - 1, v);
}
} },
{ id: 'beatSlider', key: 'beatSense', type: 'input', parse: parseFloat },
{ id: 'shakeSlider', key: 'shakeIntensity', type: 'input', parse: parseFloat },
// Style-specific inputs
{ id: 'barsSlider', key: 'state.barsCount', type: 'input', parse: parseInt, style: 'bars' },
{ id: 'barGapSlider', key: 'state.barGap', type: 'input', parse: parseInt, style: 'bars' },
{ id: 'decaySlider', key: 'state.peakDecay', type: 'input', parse: parseFloat, style: 'bars' },
{ id: 'eqColumnsSlider', key: 'state.eqColumns', type: 'input', parse: parseInt, style: 'eq' },
{ id: 'segHeightSlider', key: 'state.segHeight', type: 'input', parse: parseInt, style: 'eq' },
{ id: 'segGapSlider', key: 'state.segGap', type: 'input', parse: parseInt, style: 'eq' },
{ id: 'lineWidthSlider', key: 'lineWidth', type: 'input', parse: parseFloat, style: 'wave' },
{ id: 'glowSlider', key: 'glowIntensity', type: 'input', parse: parseFloat, style: 'wave' },
{ id: 'vsLineWidthSlider', key: 'lineWidth', type: 'input', parse: parseFloat, style: 'vectorscope' },
{ id: 'vsGlowSlider', key: 'glowIntensity', type: 'input', parse: parseFloat, style: 'vectorscope' },
{ id: 'orbitersSlider', key: 'orbiters', type: 'input', parse: parseInt, style: 'pulse' },
{ id: 'ringSpeedSlider', key: 'state.ringSpeed', type: 'input', parse: parseFloat, style: 'pulse' },
{ id: 'vuSegmentsSlider', key: 'state.vuSegments', type: 'input', parse: parseInt, style: 'vu' },
{ id: 'vuGapSlider', key: 'state.vuGap', type: 'input', parse: parseInt, style: 'vu' },
{ id: 'vfdColumnsSlider', key: 'state.vfdColumns', type: 'input', parse: parseInt, style: 'analog-vu' },
{ id: 'peakHoldSlider', key: 'state.vfdPeakHold', type: 'input', parse: parseFloat, style: 'analog-vu' },
{ id: 'waterfallSpeedSlider', key: 'state.waterfallSpeed', type: 'input', parse: parseInt, style: 'waterfall' },
{ id: 'ribbonThicknessSlider', key: 'state.ribbonThickness', type: 'input', parse: parseFloat, style: 'ribbon' },
{ id: 'ribbonGlowSlider', key: 'state.ribbonGlow', type: 'input', parse: parseFloat, style: 'ribbon' },
{ id: 'particleCountSlider', key: 'state.particleCount', type: 'input', parse: parseInt, style: 'particles' },
{ id: 'particleSpeedSlider', key: 'state.particleSpeed', type: 'input', parse: parseFloat, style: 'particles' }
];

inputs.forEach(item => {
const el = document.getElementById(item.id);
if (el) {
el.addEventListener(item.type, (e) => {
if (state.isSuppressingEvents) return;
const val = item.parse(e.target.value);
const targetStyle = item.style || getLookupStyle();
styleSettings[targetStyle][item.key] = val;

// Keep global cache sync variables updated for the active style
if (targetStyle === getLookupStyle() && varSetters[item.key]) {
varSetters[item.key](val);
}

if (item.cb) item.cb(val);
if (item.key === 'state.barsCount' || item.key === 'state.eqColumns' || item.key === 'resolution') {
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
if (state.menuOpen && menuEl && !menuEl.contains(e.target) && e.target !== trigger) {
toggleMenu(false);
}
});

// Position menu and trigger based on current edge layout
const menuEl = document.getElementById('controlsMenu');
const triggerEl = document.getElementById('controlsTrigger');
if (menuEl) {
if (state.currentPosition === 'top') {
menuEl.style.top = `${state.visThickness + 10}px`;
menuEl.style.bottom = 'auto';
} else if (state.currentPosition === 'left') {
menuEl.style.left = '10px';
menuEl.style.right = 'auto';
menuEl.style.bottom = `${state.visThickness + 10}px`;
menuEl.style.top = 'auto';
if (triggerEl) {
triggerEl.style.left = `${state.visThickness - 40}px`;
triggerEl.style.right = 'auto';
}
} else if (state.currentPosition === 'right') {
menuEl.style.right = '10px';
menuEl.style.left = 'auto';
menuEl.style.bottom = `${state.visThickness + 10}px`;
menuEl.style.top = 'auto';
} else if (state.currentPosition === 'fullscreen') {
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
state.helpOpen = show;
if (!settingsContent || !shortcutsCard || !helpTrigger) return;

if (state.helpOpen) {
settingsContent.style.display = 'none';
shortcutsCard.style.display = 'block';
helpTrigger.style.background = '#00f0ff';
helpTrigger.style.color = 'black';
if (!state.menuOpen) toggleMenu(true);
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
toggleHelp(!state.helpOpen);
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
state.hudShow = !state.hudShow;
localStorage.setItem('visualizer-hud-show', state.hudShow);
const hudShowToggle = document.getElementById('hudShowToggle');
if (hudShowToggle) {
hudShowToggle.checked = state.hudShow;
}
updateHudDisplay();
if (typeof showToast === 'function') {
showToast(state.hudShow ? "HUD: Enabled" : "HUD: Disabled");
}
};

window.cycleStyle = function(forward) {
const styles = ['bars', 'eq', 'wave', 'pulse', 'vu', 'waterfall', 'ribbon', 'particles'];
let currentIndex = styles.indexOf(state.currentStyle);
let nextIndex = forward ? 
(currentIndex + 1) % styles.length : 
(currentIndex - 1 + styles.length) % styles.length;
const styleSelect = document.getElementById('styleSelect');
if (styleSelect) {
(styleSelect as HTMLSelectElement).value = styles[nextIndex];
styleSelect.dispatchEvent(new Event('change'));
}
};

window.cycleTheme = function(forward) {
const themes = ['cyberpunk', 'matrix', 'neon', 'volcano', 'monochrome'];
let currentIndex = themes.indexOf(state.currentTheme);
let nextIndex = forward ? 
(currentIndex + 1) % themes.length : 
(currentIndex - 1 + themes.length) % themes.length;
const themeSelect = document.getElementById('themeSelect');
if (themeSelect) {
(themeSelect as HTMLSelectElement).value = themes[nextIndex];
themeSelect.dispatchEvent(new Event('change'));
}
};

window.adjustGain = function(up) {
const gainSlider = document.getElementById('gainSlider');
if (gainSlider) {
let val = parseFloat((gainSlider as HTMLInputElement).value);
val = up ? Math.min(3.0, val + 0.1) : Math.max(0.5, val - 0.1);
(gainSlider as HTMLInputElement).value = val;
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
toggleMenu(!state.menuOpen);
}
// 'h' or 'H' key toggles HUD
else if (e.key === 'h' || e.key === 'H') {
(window as any).toggleHudGlobal();
}
// 'Escape' key hides menu or help card
else if (e.key === 'Escape') {
if (state.helpOpen) {
toggleHelp(false);
} else {
toggleMenu(false);
}
}
// '?' or '/' toggles help card
else if (e.key === '?' || e.key === '/') {
e.preventDefault();
toggleHelp(!state.helpOpen);
}
// 's' key cycles style
else if (e.key === 's' || e.key === 'S') {
const styles = ['bars', 'eq', 'wave', 'pulse', 'vu', 'waterfall', 'ribbon', 'particles'];
let currentIndex = styles.indexOf(state.currentStyle);
let nextIndex = (e.key === 's') ? 
(currentIndex - 1 + styles.length) % styles.length : 
(currentIndex + 1) % styles.length;
const styleSelect = document.getElementById('styleSelect');
if (styleSelect) {
(styleSelect as HTMLSelectElement).value = styles[nextIndex];
styleSelect.dispatchEvent(new Event('change'));
}
}
// 't' key cycles theme
else if (e.key === 't' || e.key === 'T') {
const themes = ['cyberpunk', 'matrix', 'neon', 'volcano', 'monochrome'];
let currentIndex = themes.indexOf(state.currentTheme);
let nextIndex = (e.key === 't') ? 
(currentIndex - 1 + themes.length) % themes.length : 
(currentIndex + 1) % themes.length;
const themeSelect = document.getElementById('themeSelect');
if (themeSelect) {
(themeSelect as HTMLSelectElement).value = themes[nextIndex];
themeSelect.dispatchEvent(new Event('change'));
}
}
// ArrowUp / ArrowDown adjust sensitivity
else if (e.key === 'ArrowUp') {
e.preventDefault();
const gainSlider = document.getElementById('gainSlider');
if (gainSlider) {
let newVal = Math.min(3.0, parseFloat((gainSlider as HTMLInputElement).value) + 0.1);
(gainSlider as HTMLInputElement).value = newVal.toFixed(1);
gainSlider.dispatchEvent(new Event('input'));
}
}
else if (e.key === 'ArrowDown') {
e.preventDefault();
const gainSlider = document.getElementById('gainSlider');
if (gainSlider) {
let newVal = Math.max(0.5, parseFloat((gainSlider as HTMLInputElement).value) - 0.1);
(gainSlider as HTMLInputElement).value = newVal.toFixed(1);
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

if (state.toastTimeout) clearTimeout(state.toastTimeout);
state.toastTimeout = setTimeout(() => {
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
hud.classList.add(state.hudTheme);
hud.classList.add(`pos-${state.currentPosition}`);
if (!state.hudShow) {
hud.classList.add('hidden');
}
}
if (menu) {
if (state.hudTheme === 'winamp-classic') {
menu.classList.add('winamp-menu');
} else {
menu.classList.remove('winamp-menu');
}
}
}

// Flush audio context buffer periodically (every 10 minutes) to prevent cumulative GStreamer/WebAudio resampler drift/desync
setInterval(() => {
(window as any).resetAudioContext();
}, 10 * 60 * 1000);

