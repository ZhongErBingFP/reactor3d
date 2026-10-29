/* ============================================================
   Audio engine: local files, microphone input, built-in demo synth
   ============================================================ */

const audioEngine = {
  ctx: null,
  analyser: null,
  master: null,
  demoBus: null,
  demoDelay: null,
  desktopBus: null,
  desktopActive: false,
  desktopChunkUnsub: null,
  desktopNextTime: 0,
  desktopNodes: [],
  fileSource: null,
  builtinUrl: null,
  systemStream: null,
  systemSource: null,
  micStream: null,
  micSource: null,
  freqData: null,
  timeData: null,
  objectUrl: null,
  noiseBuffer: null,
  suppressAudioEvents: false,
  history: [],
  lastBeatAt: 0,
  lastBeatLevel: 0,
  demo: {
    active: false,
    playing: false,
    timer: null,
    step: 0,
    nextTime: 0,
    startTime: 0,
    loop: 0,
    stepDur: 0,
    bpm: 112,
    pausedProgress: 0
  }
};

function audioNow() {
  return audioEngine.ctx ? audioEngine.ctx.currentTime : performance.now() / 1000;
}

function initAudioContext() {
  if (audioEngine.ctx) return audioEngine.ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    showToast(t('toastNoWebAudio'), true);
    return null;
  }

  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.76;
  analyser.minDecibels = -92;
  analyser.maxDecibels = -8;

  const master = ctx.createGain();
  master.gain.value = appState.muted ? 0 : appState.volume * 0.9;
  master.connect(ctx.destination);

  const demoBus = ctx.createGain();
  demoBus.gain.value = 0;
  demoBus.connect(master);
  demoBus.connect(analyser);

  const desktopBus = ctx.createGain();
  desktopBus.gain.value = 1;
  desktopBus.connect(analyser);

  // Keep the analyser branch alive even though it is not an audible output.
  const silentSink = ctx.createGain();
  silentSink.gain.value = 0;
  analyser.connect(silentSink);
  silentSink.connect(ctx.destination);

  const demoDelay = ctx.createDelay(1.2);
  demoDelay.delayTime.value = 0.245;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.24;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 2200;
  demoDelay.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(demoDelay);
  demoDelay.connect(demoBus);

  audioEngine.ctx = ctx;
  audioEngine.analyser = analyser;
  audioEngine.master = master;
  audioEngine.demoBus = demoBus;
  audioEngine.demoDelay = demoDelay;
  audioEngine.desktopBus = desktopBus;
  audioEngine.freqData = new Uint8Array(analyser.frequencyBinCount);
  audioEngine.timeData = new Uint8Array(analyser.fftSize);

  try {
    const source = ctx.createMediaElementSource(dom.audio);
    source.connect(master);
    source.connect(analyser);
    audioEngine.fileSource = source;
    dom.audio.volume = 1;
  } catch (err) {
    // The element can only be connected to one graph. This is a non-fatal edge case.
    console.warn('MediaElementSource unavailable:', err);
  }

  // A soft noise bed gives the demo a little air and feeds the high band.
  const len = Math.floor(ctx.sampleRate * 0.7);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) channel[i] = Math.random() * 2 - 1;
  audioEngine.noiseBuffer = buffer;

  return ctx;
}

async function ensureAudio() {
  const ctx = initAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (err) {
      console.warn('AudioContext resume failed:', err);
    }
  }
  return ctx;
}

function setMasterVolume() {
  if (!audioEngine.master || !audioEngine.ctx) return;
  const v = appState.muted ? 0 : appState.volume * 0.9;
  audioEngine.master.gain.cancelScheduledValues(audioEngine.ctx.currentTime);
  audioEngine.master.gain.setTargetAtTime(v, audioEngine.ctx.currentTime, 0.025);
}

function setVolume(value) {
  appState.volume = clamp(Number(value) || 0, 0, 1);
  if (appState.volume > 0 && appState.muted) appState.muted = false;
  setMasterVolume();
  syncVolumeUI();
}

function toggleMute() {
  appState.muted = !appState.muted;
  setMasterVolume();
  syncVolumeUI();
  showToast(appState.muted ? t('toastMuted') : t('toastUnmuted'));
}

function coolDownMix() {
  audioMix.bass *= 0.22;
  audioMix.low *= 0.22;
  audioMix.mid *= 0.22;
  audioMix.high *= 0.22;
  audioMix.level *= 0.22;
  audioMix.beat = 0;
  audioEngine.history.length = 0;
  audioEngine.lastBeatLevel = 0;
}

function setFileSourceUI(name, format) {
  appState.trackName = name;
  appState.fileFormat = format;
}

function warnIfAudioSuspended() {
  if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
    showToast(t('toastAudioSuspended'), true);
  }
}

async function loadLocalFile(file) {
  if (!isAudioFile(file)) {
    showToast(t('toastAudioUnsupported'), true);
    return;
  }
  if (file.size > 150 * 1024 * 1024) {
    showToast(t('toastFileLarge'), true);
  }

  // Do not await resume() here: some browsers defer it until a later gesture,
  // which would leave the audio source unloaded. Load and start the element
  // first; the global gesture unlock will resume the graph when needed.
  const ctx = initAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  stopDemo(false);
  stopMicrophone(false);
  stopSystemAudio(false);
  audioEngine.suppressAudioEvents = true;
  try { dom.audio.pause(); } catch (err) { /* noop */ }
  audioEngine.suppressAudioEvents = false;

  if (audioEngine.objectUrl) {
    URL.revokeObjectURL(audioEngine.objectUrl);
    audioEngine.objectUrl = null;
  }

  const url = URL.createObjectURL(file);
  audioEngine.objectUrl = url;
  dom.audio.src = url;
  dom.audio.load();

  appState.active = 'file';
  appState.playing = false;
  appState.fileIsBuiltin = false;
  const ext = (String(file.name).split('.').pop() || 'AUDIO').toUpperCase();
  setFileSourceUI(cleanTrackName(file.name), ext);
  appState.sourceLabel = 'LOCAL FILE';

  dom.seekFill.style.width = '0%';
  dom.seekHead.style.left = '0%';
  dom.timeLabel.textContent = '00:00';
  dom.durationLabel.textContent = '--:--';
  hideIgniteHint();
  syncAllUI();

  try {
    await dom.audio.play();
    appState.playing = true;
    appState.active = 'file';
    syncAllUI();
    warnIfAudioSuspended();
  } catch (err) {
    appState.playing = false;
    syncAllUI();
    showToast(t('toastAutoplayBlocked'), true);
  }
}

function buildBuiltinUrl() {
  if (audioEngine.builtinUrl) return audioEngine.builtinUrl;
  const builtin = window.__BUILTIN_TRACK__;
  if (!builtin || !builtin.data) return null;

  const binary = atob(builtin.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: builtin.mime || 'audio/mp4' });
  audioEngine.builtinUrl = URL.createObjectURL(blob);
  return audioEngine.builtinUrl;
}

async function playBuiltInTrack() {
  const builtin = window.__BUILTIN_TRACK__;
  if (!builtin || !builtin.data) {
    showToast(t('toastBuiltinMissing'), true);
    return;
  }

  const ctx = initAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  let url;
  try {
    url = buildBuiltinUrl();
  } catch (err) {
    console.warn('Built-in decode failed:', err);
    showToast(t('toastBuiltinFailed'), true);
    return;
  }
  if (!url) {
    showToast(t('toastBuiltinMissing'), true);
    return;
  }

  stopDemo(false);
  stopMicrophone(false);
  stopSystemAudio(false);
  audioEngine.suppressAudioEvents = true;
  try { dom.audio.pause(); } catch (err) { /* noop */ }
  audioEngine.suppressAudioEvents = false;

  dom.audio.src = url;
  dom.audio.load();

  appState.active = 'file';
  appState.playing = false;
  appState.fileIsBuiltin = true;
  appState.trackName = builtin.name || '朋友的酒 DJ';
  appState.fileFormat = 'M4A';
  dom.seekFill.style.width = '0%';
  dom.seekHead.style.left = '0%';
  dom.timeLabel.textContent = '00:00';
  dom.durationLabel.textContent = '--:--';
  hideIgniteHint();
  syncAllUI();
  showToast(t('toastBuiltinLoading'));

  try {
    await dom.audio.play();
    appState.playing = true;
    syncAllUI();
  } catch (err) {
    appState.playing = false;
    syncAllUI();
    showToast(t('toastBuiltinFailed'), true);
  }
}

async function playFile() {
  const ctx = await ensureAudio();
  if (!ctx) return;
  if (!dom.audio.src) {
    dom.fileInput.click();
    return;
  }
  appState.active = 'file';
  appState.playing = true;
  stopDemo(false);
  stopMicrophone(false);
  stopSystemAudio(false);
  syncAllUI();
  try {
    await dom.audio.play();
    warnIfAudioSuspended();
  } catch (err) {
    appState.playing = false;
    syncAllUI();
    showToast(t('toastCantPlay'), true);
  }
}

function pauseFile() {
  try { dom.audio.pause(); } catch (err) { /* noop */ }
  appState.playing = false;
  coolDownMix();
  syncAllUI();
}

function togglePlayback() {
  if (!appState.active) {
    dom.fileInput.click();
    return;
  }

  if (appState.active === 'file') {
    if (dom.audio.paused) {
      playFile();
    } else {
      pauseFile();
      ensureAudio();
    }
    return;
  }

  if (appState.active === 'demo') {
    if (appState.playing) pauseDemo();
    else resumeDemo();
    return;
  }

  if (appState.active === 'mic' || appState.active === 'system') {
    appState.playing = !appState.playing;
    if (!appState.playing) coolDownMix();
    syncAllUI();
  }
}

/* ---------------------------------------------------------------- demo synth */

function demoStepSeconds() {
  return 60 / audioEngine.demo.bpm / 4;
}

function startDemo() {
  const ctx = initAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  stopMicrophone(false);
  stopSystemAudio(false);
  audioEngine.suppressAudioEvents = true;
  try { dom.audio.pause(); } catch (err) { /* noop */ }
  audioEngine.suppressAudioEvents = false;

  const demo = audioEngine.demo;
  demo.active = true;
  demo.playing = true;
  demo.bpm = 112;
  demo.stepDur = demoStepSeconds();
  demo.loop = demo.stepDur * 64;
  demo.startTime = ctx.currentTime + 0.08;
  demo.nextTime = demo.startTime;
  demo.step = 0;
  demo.pausedProgress = 0;

  appState.active = 'demo';
  appState.playing = true;
  appState.trackName = t('trackDemo');
  appState.trackSpec = '112 BPM · A MINOR · 4/4';
  appState.sourceLabel = 'GENERATED SIGNAL';

  const now = ctx.currentTime;
  const gain = audioEngine.demoBus.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(0.0001, now);
  gain.exponentialRampToValueAtTime(0.6, now + 0.18);

  clearInterval(demo.timer);
  demo.timer = setInterval(scheduleDemo, 24);
  scheduleDemo();
  hideIgniteHint();
  syncAllUI();
  showToast(t('toastDemoStarted'));
}

function pauseDemo() {
  const demo = audioEngine.demo;
  if (!demo.active) return;
  const progress = getDemoProgress();
  demo.playing = false;
  clearInterval(demo.timer);
  demo.timer = null;
  const ctx = audioEngine.ctx;
  if (ctx && audioEngine.demoBus) {
    const g = audioEngine.demoBus.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.exponentialRampToValueAtTime(0.0001, now + 0.12);
  }
  demo.pausedProgress = progress;
  appState.playing = false;
  coolDownMix();
  syncAllUI();
}

function resumeDemo() {
  const demo = audioEngine.demo;
  if (!demo.active) {
    startDemo();
    return;
  }
  const ctx = initAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  demo.playing = true;
  demo.stepDur = demoStepSeconds();
  demo.loop = demo.stepDur * 64;
  demo.startTime = ctx.currentTime - demo.pausedProgress * demo.loop;
  demo.step = Math.floor(demo.pausedProgress * 64) % 64;
  demo.nextTime = ctx.currentTime + 0.06;

  const now = ctx.currentTime;
  const g = audioEngine.demoBus.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(0.0001, now);
  g.exponentialRampToValueAtTime(0.6, now + 0.12);

  clearInterval(demo.timer);
  demo.timer = setInterval(scheduleDemo, 24);
  scheduleDemo();
  appState.active = 'demo';
  appState.playing = true;
  syncAllUI();
}

function stopDemo(updateUI) {
  const demo = audioEngine.demo;
  clearInterval(demo.timer);
  demo.timer = null;
  demo.playing = false;
  demo.active = false;
  if (audioEngine.ctx && audioEngine.demoBus) {
    const g = audioEngine.demoBus.gain;
    const now = audioEngine.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.exponentialRampToValueAtTime(0.0001, now + 0.08);
  }
  if (updateUI !== false && appState.active === 'demo') {
    appState.active = null;
    appState.playing = false;
    syncAllUI();
  }
}

function getDemoProgress() {
  const demo = audioEngine.demo;
  if (!demo.active || !audioEngine.ctx || !demo.loop) return demo.pausedProgress || 0;
  if (!demo.playing) return demo.pausedProgress || 0;
  let elapsed = audioEngine.ctx.currentTime - demo.startTime;
  elapsed = ((elapsed % demo.loop) + demo.loop) % demo.loop;
  return elapsed / demo.loop;
}

function scheduleDemo() {
  const demo = audioEngine.demo;
  const ctx = audioEngine.ctx;
  if (!demo.active || !demo.playing || !ctx) return;
  const horizon = ctx.currentTime + 0.14;
  let guard = 0;
  while (demo.nextTime < horizon && guard < 24) {
    scheduleDemoStep(demo.step, demo.nextTime);
    demo.nextTime += demo.stepDur;
    demo.step = (demo.step + 1) % 64;
    guard++;
  }
}

const DEMO_BASS = [55, 55, 65.41, 49, 55, 82.41, 65.41, 49];
const DEMO_CHORDS = [
  [110, 130.81, 164.81],
  [87.31, 110, 130.81],
  [130.81, 164.81, 196],
  [98, 123.47, 146.83]
];

function scheduleDemoStep(step, t) {
  const bar = Math.floor(step / 16);
  const inBar = step % 16;

  if (inBar === 0 || inBar === 7 || inBar === 10) synthKick(t, inBar === 0 ? 0.95 : 0.68);
  if (inBar === 4 || inBar === 12) synthSnare(t, 0.34);
  if (inBar % 2 === 0) synthHat(t + 0.005, inBar === 14 ? 0.1 : 0.05, inBar === 14);
  if (inBar === 3 || inBar === 9 || inBar === 15) synthHat(t + 0.002, 0.026, false);

  if (inBar % 2 === 0) {
    const note = DEMO_BASS[(step / 2) % 8 | 0];
    synthBass(t, note, 0.25, inBar % 4 === 0 ? 0.36 : 0.24);
  }

  if (inBar === 0) synthPad(t, DEMO_CHORDS[bar % 4], 3.35);
  if (inBar === 0 || inBar === 6 || inBar === 11) {
    const chord = DEMO_CHORDS[bar % 4];
    const mel = chord[(step * 7 + bar) % chord.length] * 2;
    synthPluck(t, mel, 0.11);
  }
  if (inBar === 14 && bar === 3) synthPluck(t, 659.25, 0.08);
}

function synthKick(t, volume) {
  const ctx = audioEngine.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.tanh(x * 1.5);
  }
  shaper.curve = curve;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(132, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
  osc.connect(gain);
  gain.connect(shaper);
  shaper.connect(audioEngine.demoBus);
  osc.start(t);
  osc.stop(t + 0.52);
}

function synthSnare(t, volume) {
  const ctx = audioEngine.ctx;
  if (!ctx || !audioEngine.noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = audioEngine.noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1100;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2100;
  bp.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(gain);
  gain.connect(audioEngine.demoBus);
  src.start(t);
  src.stop(t + 0.24);
}

function synthHat(t, volume, open) {
  const ctx = audioEngine.ctx;
  if (!ctx || !audioEngine.noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = audioEngine.noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7200;
  const gain = ctx.createGain();
  const life = open ? 0.3 : 0.06;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + life);
  src.connect(hp);
  hp.connect(gain);
  gain.connect(audioEngine.demoBus);
  src.start(t);
  src.stop(t + life + 0.02);
}

function synthBass(t, freq, volume, duration) {
  const ctx = audioEngine.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, t);
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq / 2, t);
  filter.type = 'lowpass';
  filter.Q.value = 3.2;
  filter.frequency.setValueAtTime(320, t);
  filter.frequency.exponentialRampToValueAtTime(120, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain);
  gain.connect(audioEngine.demoBus);
  osc.start(t);
  sub.start(t);
  osc.stop(t + duration + 0.03);
  sub.stop(t + duration + 0.03);
}

function synthPad(t, notes, duration) {
  const ctx = audioEngine.ctx;
  if (!ctx) return;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 540;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.045, t + 0.55);
  gain.gain.linearRampToValueAtTime(0.028, t + duration - 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? 'triangle' : 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = (i - 1) * 6;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  });
  filter.connect(gain);
  gain.connect(audioEngine.demoBus);
}

function synthPluck(t, freq, volume) {
  const ctx = audioEngine.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3600, t);
  filter.frequency.exponentialRampToValueAtTime(900, t + 0.35);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioEngine.demoBus);
  gain.connect(audioEngine.demoDelay);
  osc.start(t);
  osc.stop(t + 0.6);
}

/* ------------------------------------------------------------ desktop audio */

function setupDesktopBridge() {
  if (!desktopBridge || !desktopBridge.onAudioChunk || audioEngine.desktopChunkUnsub) return;
  audioEngine.desktopChunkUnsub = desktopBridge.onAudioChunk((chunk) => {
    handleDesktopAudioChunk(chunk);
  });
}

function resetDesktopScheduler() {
  audioEngine.desktopNextTime = 0;
  audioEngine.desktopNodes.forEach((node) => {
    try { node.stop(); } catch (err) { /* noop */ }
    try { node.disconnect(); } catch (err) { /* noop */ }
  });
  audioEngine.desktopNodes.length = 0;
}

function handleDesktopAudioChunk(chunk) {
  if (!audioEngine.desktopActive || appState.active !== 'system' || !appState.playing) return;
  const ctx = audioEngine.ctx;
  if (!ctx || !chunk) return;

  let bytes;
  if (chunk instanceof ArrayBuffer) bytes = new Uint8Array(chunk);
  else if (ArrayBuffer.isView(chunk)) bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  else return;
  if (bytes.byteLength < 4) return;
  if (bytes.byteOffset % 2 !== 0) bytes = bytes.slice();
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const frames = Math.floor(samples.length / 2);
  if (!frames) return;

  const buffer = ctx.createBuffer(2, frames, 48000);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let i = 0; i < frames; i++) {
    left[i] = samples[i * 2] / 32768;
    right[i] = samples[i * 2 + 1] / 32768;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(audioEngine.desktopBus);

  const now = ctx.currentTime;
  if (audioEngine.desktopNextTime < now + 0.015 || audioEngine.desktopNextTime > now + 0.5) {
    audioEngine.desktopNextTime = now + 0.055;
  }
  src.start(audioEngine.desktopNextTime);
  audioEngine.desktopNextTime += frames / 48000;
  audioEngine.desktopNodes.push(src);
  src.onended = () => {
    const idx = audioEngine.desktopNodes.indexOf(src);
    if (idx >= 0) audioEngine.desktopNodes.splice(idx, 1);
    try { src.disconnect(); } catch (err) { /* noop */ }
  };
}

function stopWebSystemAudio() {
  if (audioEngine.systemStream) {
    audioEngine.systemStream.getTracks().forEach((track) => track.stop());
    audioEngine.systemStream = null;
  }
  if (audioEngine.systemSource) {
    try { audioEngine.systemSource.disconnect(); } catch (err) { /* noop */ }
    audioEngine.systemSource = null;
  }
}

async function startDesktopAudio(options) {
  if (!desktopBridge || !desktopBridge.startAudio) return false;
  const ctx = initAudioContext();
  if (!ctx) return false;
  setupDesktopBridge();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  let result;
  try {
    result = await desktopBridge.startAudio({
      mode: options.mode === 'process' ? 'process' : 'system',
      pid: options.pid || null
    });
  } catch (err) {
    showToast(t('sourceConnectFailed', { error: err && err.message ? err.message : 'unknown' }), true);
    return false;
  }

  if (!result || result.ok === false) {
    showToast(t('sourceConnectFailed', { error: result && result.error ? result.error : 'unknown' }), true);
    return false;
  }

  stopDemo(false);
  stopMicrophone(false);
  stopWebSystemAudio();
  resetDesktopScheduler();
  audioEngine.desktopActive = true;
  audioEngine.suppressAudioEvents = true;
  try { dom.audio.pause(); } catch (err) { /* noop */ }
  audioEngine.suppressAudioEvents = false;

  appState.active = 'system';
  appState.playing = true;
  appState.systemKind = options.mode === 'process' ? 'process' : 'system';
  appState.systemName = options.name || '';
  appState.trackName = appState.systemKind === 'process'
    ? t('trackApp', { name: appState.systemName || t('sourceAppFallback') })
    : t('trackSystem');
  dom.timeLabel.textContent = 'LIVE';
  dom.durationLabel.textContent = 'LIVE';
  dom.seekFill.style.width = '0%';
  dom.seekHead.style.left = '0%';
  hideIgniteHint();
  syncAllUI();
  showToast(t('toastSystemConnected'));
  return true;
}

async function enableSystemAudio() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast(t('toastSystemUnsupported'), true);
    return;
  }

  // Keep the activation chain short: getDisplayMedia must be requested from
  // the original click, so the AudioContext is only initialised synchronously.
  const ctx = initAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  showToast(t('toastSystemSelect'));
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { max: 640 },
        height: { max: 360 },
        frameRate: { max: 5 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000
      },
      systemAudio: 'include',
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'exclude',
      preferCurrentTab: false
    });
  } catch (err) {
    console.warn('System audio capture error:', err);
    if (err && err.name === 'NotAllowedError') {
      showToast(t('toastSystemCancelled'));
    } else if (err && (err.name === 'NotSupportedError' || err.name === 'TypeError')) {
      showToast(t('toastSystemUnsupported'), true);
    } else {
      showToast(t('toastSystemFailed'), true);
    }
    return;
  }

  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    stream.getTracks().forEach((track) => track.stop());
    showToast(t('toastNoAudioTrack'), true);
    return;
  }

  stopDemo(false);
  stopMicrophone(false);
  stopSystemAudio(false);
  audioEngine.suppressAudioEvents = true;
  try { dom.audio.pause(); } catch (err) { /* noop */ }
  audioEngine.suppressAudioEvents = false;

  const src = ctx.createMediaStreamSource(new MediaStream(audioTracks));
  src.connect(audioEngine.analyser);
  audioEngine.systemStream = stream;
  audioEngine.systemSource = src;

  const endCapture = () => {
    if (appState.active === 'system') {
      stopSystemAudio(true);
      showToast(t('toastSystemShareStopped'));
    }
  };
  audioTracks.forEach((track) => track.addEventListener('ended', endCapture));
  stream.getVideoTracks().forEach((track) => track.addEventListener('ended', endCapture));

  appState.active = 'system';
  appState.playing = true;
  appState.systemKind = 'system';
  appState.systemName = '';
  appState.trackName = t('trackSystem');
  dom.timeLabel.textContent = 'LIVE';
  dom.durationLabel.textContent = 'LIVE';
  dom.seekFill.style.width = '0%';
  dom.seekHead.style.left = '0%';
  hideIgniteHint();
  syncAllUI();
  showToast(t('toastSystemConnected'));
}

function stopSystemAudio(updateUI) {
  stopWebSystemAudio();
  resetDesktopScheduler();
  if (audioEngine.desktopActive) {
    audioEngine.desktopActive = false;
    if (desktopBridge && desktopBridge.stopAudio) desktopBridge.stopAudio().catch(() => {});
  }
  if (updateUI !== false && appState.active === 'system') {
    appState.active = null;
    appState.playing = false;
    appState.systemKind = null;
    appState.systemName = '';
    coolDownMix();
    syncAllUI();
  }
}

function toggleSystemAudio() {
  if (appState.active === 'system') {
    stopSystemAudio(true);
    showToast(t('toastSystemStopped'));
    return;
  }
  if (desktopBridge) {
    openAudioPicker();
    return;
  }
  enableSystemAudio();
}

/* -------------------------------------------------------------------- mic */

async function enableMicrophone() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast(t('toastMicUnsupported'), true);
    return;
  }
  showToast(t('toastMicRequest'));
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }
    });

    stopDemo(false);
    stopSystemAudio(false);
    audioEngine.suppressAudioEvents = true;
    try { dom.audio.pause(); } catch (err) { /* noop */ }
    audioEngine.suppressAudioEvents = false;

    stopMicrophone(false);
    const src = ctx.createMediaStreamSource(stream);
    src.connect(audioEngine.analyser);

    audioEngine.micStream = stream;
    audioEngine.micSource = src;
    appState.active = 'mic';
    appState.playing = true;
    appState.trackName = t('trackMic');
    appState.systemKind = null;
    dom.timeLabel.textContent = 'LIVE';
    dom.durationLabel.textContent = 'LIVE';
    dom.seekFill.style.width = '0%';
    dom.seekHead.style.left = '0%';
    hideIgniteHint();
    syncAllUI();
    showToast(t('toastMicConnected'));
  } catch (err) {
    console.warn('Microphone error:', err);
    let msg = t('toastMicFailed');
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      msg = t('toastMicDenied');
    } else if (err && err.name === 'NotFoundError') {
      msg = t('toastMicNotFound');
    }
    showToast(msg, true);
    syncAllUI();
  }
}

function stopMicrophone(updateUI) {
  if (audioEngine.micStream) {
    audioEngine.micStream.getTracks().forEach((track) => track.stop());
    audioEngine.micStream = null;
  }
  if (audioEngine.micSource) {
    try { audioEngine.micSource.disconnect(); } catch (err) { /* noop */ }
    audioEngine.micSource = null;
  }
  if (updateUI !== false && appState.active === 'mic') {
    appState.active = null;
    appState.playing = false;
    coolDownMix();
    syncAllUI();
  }
}

function toggleMicrophone() {
  if (appState.active === 'mic') {
    stopMicrophone(true);
    showToast(t('toastMicClosed'));
  } else {
    enableMicrophone();
  }
}

/* --------------------------------------------------------------- analyser */

function sampleBand(freqData, loHz, hiHz) {
  const ctx = audioEngine.ctx;
  if (!ctx || !freqData.length) return 0;
  const binHz = (ctx.sampleRate / 2) / freqData.length;
  let start = Math.max(1, Math.floor(loHz / binHz));
  let end = Math.min(freqData.length - 1, Math.ceil(hiHz / binHz));
  if (end <= start) end = start + 1;
  let sum = 0;
  let weight = 0;
  for (let i = start; i <= end; i++) {
    const v = freqData[i] / 255;
    const w = 1 + Math.log10(1 + i - start) * 0.18;
    sum += v * v * w;
    weight += w;
  }
  return Math.sqrt(sum / Math.max(weight, 0.0001));
}

function analyseAudio(dt) {
  const analyser = audioEngine.analyser;
  const active = !!appState.active && appState.playing;
  let tb = 0;
  let tl = 0;
  let tm = 0;
  let th = 0;

  if (analyser && active) {
    analyser.getByteFrequencyData(audioEngine.freqData);
    analyser.getByteTimeDomainData(audioEngine.timeData);
    const bass = sampleBand(audioEngine.freqData, 30, 145);
    const low = sampleBand(audioEngine.freqData, 145, 460);
    const mid = sampleBand(audioEngine.freqData, 460, 2300);
    const high = sampleBand(audioEngine.freqData, 2300, 10500);

    tb = clamp(Math.pow(Math.max(0, bass - 0.018) * 2.15, 0.92), 0, 1);
    tl = clamp(Math.pow(Math.max(0, low - 0.016) * 2.0, 0.88), 0, 1);
    tm = clamp(Math.pow(Math.max(0, mid - 0.012) * 2.25, 0.86), 0, 1);
    th = clamp(Math.pow(Math.max(0, high - 0.009) * 2.8, 0.82), 0, 1);

    audioMix.rawBass = bass;
  } else {
    audioMix.rawBass = 0;
  }

  const attack = { bass: 30, low: 23, mid: 20, high: 25 };
  const release = { bass: 5.6, low: 4.8, mid: 4.2, high: 5.2 };
  audioMix.bass = damp(audioMix.bass, tb, tb > audioMix.bass ? attack.bass : release.bass, dt);
  audioMix.low = damp(audioMix.low, tl, tl > audioMix.low ? attack.low : release.low, dt);
  audioMix.mid = damp(audioMix.mid, tm, tm > audioMix.mid ? attack.mid : release.mid, dt);
  audioMix.high = damp(audioMix.high, th, th > audioMix.high ? attack.high : release.high, dt);

  // transient detection on raw bass
  const now = audioNow();
  if (active && audioMix.rawBass > 0.045) {
    const history = audioEngine.history;
    history.push(audioMix.rawBass);
    if (history.length > 52) history.shift();
    let avg = 0;
    for (let i = 0; i < history.length; i++) avg += history[i];
    avg /= history.length;
    if (
      audioMix.rawBass > avg * 1.28 + 0.022 &&
      audioMix.rawBass > audioEngine.lastBeatLevel * 1.06 &&
      now - audioEngine.lastBeatAt > 0.17
    ) {
      audioMix.beat = 1;
      audioMix.bpm = audioEngine.lastBeatAt > 0
        ? Math.round(clamp(60 / (now - audioEngine.lastBeatAt), 55, 190))
        : 0;
      audioEngine.lastBeatAt = now;
      audioEngine.lastBeatLevel = audioMix.rawBass;
      appState.lastBeatAt = now;
      appState.beatCount++;
    }
  } else if (!active) {
    audioEngine.history.length = 0;
    audioEngine.lastBeatLevel = 0;
  }

  audioMix.beat = Math.max(0, audioMix.beat - dt * 2.15);
  audioMix.level = clamp(
    audioMix.bass * 0.48 + audioMix.low * 0.27 + audioMix.mid * 0.17 + audioMix.high * 0.08,
    0,
    1
  );
}

function currentPlaybackTime() {
  if (appState.active === 'demo') return getDemoProgress() * (audioEngine.demo.loop || 0);
  if (appState.active === 'file') return dom.audio.currentTime || 0;
  return 0;
}

function currentPlaybackDuration() {
  if (appState.active === 'demo') return audioEngine.demo.loop || 0;
  if (appState.active === 'file') return dom.audio.duration || 0;
  return 0;
}

function seekToFraction(fraction) {
  const f = clamp(fraction, 0, 1);
  if (appState.active === 'file' && isFinitePositive(dom.audio.duration)) {
    dom.audio.currentTime = f * dom.audio.duration;
    return;
  }
  if (appState.active === 'demo' && audioEngine.ctx) {
    const demo = audioEngine.demo;
    demo.pausedProgress = f;
    demo.step = Math.floor(f * 64) % 64;
    demo.startTime = audioEngine.ctx.currentTime - f * demo.loop;
    demo.nextTime = audioEngine.ctx.currentTime + 0.05;
    if (!demo.playing) {
      demo.startTime = audioEngine.ctx.currentTime;
    }
  }
}

/* ------------------------------------------------------------- DOM events */

dom.audio.addEventListener('loadedmetadata', () => {
  if (appState.active === 'file') {
    dom.durationLabel.textContent = formatTime(dom.audio.duration);
    dom.seek.setAttribute('aria-valuemax', '100');
    syncAllUI();
  }
});

dom.audio.addEventListener('durationchange', () => {
  if (appState.active === 'file') {
    dom.durationLabel.textContent = formatTime(dom.audio.duration);
  }
});

dom.audio.addEventListener('timeupdate', () => {
  if (appState.active === 'file' && !appState.seekDragging) {
    const d = dom.audio.duration || 0;
    const t = dom.audio.currentTime || 0;
    const pct = d > 0 ? clamp((t / d) * 100, 0, 100) : 0;
    dom.seekFill.style.width = pct + '%';
    dom.seekHead.style.left = pct + '%';
    dom.seek.setAttribute('aria-valuenow', String(Math.round(pct)));
    dom.timeLabel.textContent = formatTime(t);
  }
});

dom.audio.addEventListener('play', () => {
  if (audioEngine.suppressAudioEvents) return;
  if (appState.active === 'file') {
    appState.playing = true;
    syncAllUI();
  }
});

dom.audio.addEventListener('pause', () => {
  if (audioEngine.suppressAudioEvents) return;
  if (appState.active === 'file') {
    appState.playing = false;
    syncAllUI();
  }
});

dom.audio.addEventListener('ended', () => {
  if (appState.active === 'file') {
    appState.playing = false;
    syncAllUI();
    showToast(t('toastPlaybackEnded'));
  }
});

dom.audio.addEventListener('error', () => {
  if (appState.active !== 'file') return;
  appState.playing = false;
  syncAllUI();
  showToast(appState.fileIsBuiltin ? t('toastBuiltinFailed') : t('toastDecodeFailed'), true);
});

window.addEventListener('pagehide', () => {
  if (audioEngine.objectUrl) URL.revokeObjectURL(audioEngine.objectUrl);
  stopSystemAudio(false);
});
