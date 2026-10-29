/* ============================================================
   Interface: transport, drag & drop, telemetry, shortcuts
   ============================================================ */

const artCells = [];
let dragDepth = 0;
let lastVolumeHoverClose = 0;
let helpReturnFocus = null;

function showToast(message, isError) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.toggle('error', !!isError);
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, isError ? 4200 : 2600);
}

function hideIgniteHint() {
  if (dom.igniteHint) dom.igniteHint.classList.add('is-gone');
}

function showIgniteHint() {
  if (dom.igniteHint) dom.igniteHint.classList.remove('is-gone');
}

function setTrackTitle(text, idle) {
  dom.trackTitle.classList.toggle('idle', !!idle);
  if (idle) {
    dom.trackTitle.textContent = text;
  } else {
    dom.trackTitle.textContent = text;
  }
}

function setSystemStatus(mode, main, sub) {
  if (!dom.status) return;
  dom.status.dataset.state = mode;
  dom.statusText.textContent = main;
  dom.statusSub.textContent = sub;
}

function syncAllUI() {
  const active = appState.active;
  const playing = appState.playing;

  dom.dock.classList.toggle('is-active', !!active);
  dom.dock.classList.toggle('is-playing', !!active && playing);
  dom.playBtn.setAttribute('aria-label', playing ? t('pauseLabel') : t('playLabel'));
  dom.systemBtn.classList.toggle('is-on', active === 'system');
  dom.micBtn.classList.toggle('is-on', active === 'mic');
  dom.demoBtn.classList.toggle('is-on', active === 'demo');
  dom.fileBtn.classList.toggle('is-on', active === 'file');

  dom.fileBtn.title = t('actionImportTitle');
  dom.systemBtn.title = t('actionSystemTitle');
  dom.micBtn.title = t('actionMicTitle');
  dom.demoBtn.title = t('actionDemoTitle');
  dom.helpBtn.title = t('helpTitleAttr');
  dom.helpBtn.setAttribute('aria-label', t('helpTitleAttr'));
  dom.fullBtn.title = t('fullTitle');
  dom.fullBtn.setAttribute('aria-label', t('fullTitle'));
  dom.helpClose.setAttribute('aria-label', t('close'));
  dom.sourceClose.setAttribute('aria-label', t('close'));

  const systemLabel = dom.systemBtn.querySelector('span');
  if (systemLabel) systemLabel.textContent = active === 'system' ? t('actionStopSystem') : t('actionSystem');
  const micLabel = dom.micBtn.querySelector('span');
  if (micLabel) micLabel.textContent = active === 'mic' ? t('actionStopMic') : t('actionMic');
  const fileLabel = dom.fileBtn.querySelector('span');
  if (fileLabel) fileLabel.textContent = t('actionImport');
  const demoLabel = dom.demoBtn.querySelector('span');
  if (demoLabel) demoLabel.textContent = active === 'demo'
    ? (playing ? t('actionPauseDemo') : t('actionResumeDemo'))
    : t('actionDemo');

  if (!active) {
    setSystemStatus('idle', t('statusOnline'), t('statusStandby'));
    setTrackTitle(t('trackIdle'), true);
    dom.sourceLabel.textContent = 'NO SIGNAL';
    dom.trackSpec.textContent = t('defaultSpec');
    dom.playState.textContent = t('playStateIdle');
    dom.seekTip.textContent = t('seekTipIdle');
    dom.sourceState.textContent = t('sourceStateIdle');
    dom.durationLabel.textContent = '--:--';
    dom.timeLabel.textContent = '00:00';
    dom.seekFill.style.width = '0%';
    dom.seekHead.style.left = '0%';
    dom.seek.setAttribute('aria-valuenow', '0');
    showIgniteHint();
  } else if (active === 'file') {
    setSystemStatus(playing ? 'playing' : 'idle', playing ? t('statusAudioLocked') : t('statusTrackArmed'), playing ? t('statusReactive') : t('statusPaused'));
    setTrackTitle(appState.trackName || t('trackIdle'), false);
    dom.sourceLabel.textContent = appState.fileIsBuiltin ? t('sourceBuiltinLabel') : t('sourceLocalLabel');
    dom.trackSpec.textContent = (appState.fileFormat ? appState.fileFormat + ' · ' : '') + (appState.fileIsBuiltin ? t('builtinPlayback') : t('localPlayback'));
    dom.playState.textContent = playing ? t('playStateFilePlaying') : t('playStateFilePaused');
    dom.seekTip.textContent = playing ? t('seekTipFilePlaying') : t('seekTipFilePaused');
    dom.sourceState.textContent = appState.fileIsBuiltin
      ? t('sourceStateBuiltin')
      : (playing ? t('sourceStateFilePlaying') : t('sourceStateFilePaused'));
    dom.durationLabel.textContent = formatTime(dom.audio.duration);
    hideIgniteHint();
  } else if (active === 'demo') {
    setSystemStatus(playing ? 'demo' : 'idle', playing ? t('statusDemoSignal') : t('statusDemoPaused'), playing ? '112 BPM' : t('statusPaused'));
    setTrackTitle(t('trackDemo'), false);
    dom.sourceLabel.textContent = t('sourceGeneratedLabel');
    dom.trackSpec.textContent = t('specDemo');
    dom.playState.textContent = playing ? t('playStateDemoPlaying') : t('playStateDemoPaused');
    dom.seekTip.textContent = playing ? t('seekTipDemoPlaying') : t('seekTipDemoPaused');
    dom.sourceState.textContent = playing ? t('sourceStateDemoPlaying') : t('sourceStateDemoPaused');
    hideIgniteHint();
  } else if (active === 'system') {
    const isApp = appState.systemKind === 'process';
    const appName = appState.systemName || t('sourceAppFallback');
    setSystemStatus('system', isApp ? t('statusAppAudio') : t('statusSystemAudio'), playing ? t('statusLive') : t('statusPaused'));
    setTrackTitle(isApp ? t('trackApp', { name: appName }) : t('trackSystem'), false);
    dom.sourceLabel.textContent = isApp ? t('sourceAppLabel') : t('sourceSystemLabel');
    dom.trackSpec.textContent = isApp ? t('specApp') : t('specSystem');
    dom.playState.textContent = playing ? t('playStateSystemPlaying') : t('playStateSystemPaused');
    dom.seekTip.textContent = t('seekTipSystem');
    dom.sourceState.textContent = playing
      ? (isApp ? t('sourceStateApp', { name: appName }) : t('sourceStateSystem'))
      : (isApp ? t('sourceStateAppPaused', { name: appName }) : t('sourceStateSystemPaused'));
    dom.durationLabel.textContent = 'LIVE';
    dom.timeLabel.textContent = 'LIVE';
    dom.seekFill.style.width = '0%';
    dom.seekHead.style.left = '0%';
    hideIgniteHint();
  } else if (active === 'mic') {
    setSystemStatus('mic', playing ? t('statusMicInput') : t('statusMicPaused'), playing ? t('statusLive') : t('statusPaused'));
    setTrackTitle(t('trackMic'), false);
    dom.sourceLabel.textContent = t('sourceLiveLabel');
    dom.trackSpec.textContent = t('specMic');
    dom.playState.textContent = playing ? t('playStateMicPlaying') : t('playStateMicPaused');
    dom.seekTip.textContent = t('seekTipMic');
    dom.sourceState.textContent = playing ? t('sourceStateMicPlaying') : t('sourceStateMicPaused');
    dom.durationLabel.textContent = 'LIVE';
    dom.timeLabel.textContent = 'LIVE';
    dom.seekFill.style.width = '0%';
    dom.seekHead.style.left = '0%';
    hideIgniteHint();
  }

  syncVolumeUI();
  syncSensitivityUI();
}

function syncVolumeUI() {
  dom.volumeSliders.forEach((slider) => {
    slider.value = String(appState.volume);
    slider.setAttribute('aria-label', t('playbackVolume'));
  });
  dom.volumeReadouts.forEach((node) => {
    node.textContent = String(Math.round(appState.volume * 100));
  });
  if (dom.volumeText) dom.volumeText.textContent = String(Math.round(appState.volume * 100));
  document.body.classList.toggle('is-muted', appState.muted);
  if (dom.muteBtn) {
    dom.muteBtn.setAttribute('aria-label', appState.muted ? t('unmute') : t('mute'));
    dom.muteBtn.title = appState.muted ? t('unmute') : t('mute');
  }
}

function syncSensitivityUI() {
  const value = clamp(Number(appState.sensitivity) || 1, 0.3, 2.5);
  dom.sensitivitySliders.forEach((slider) => {
    if (Number(slider.value) !== Number(value.toFixed(2))) slider.value = String(value);
    slider.setAttribute('aria-valuenow', String(value.toFixed(2)));
    slider.setAttribute('aria-label', t('sensitivity'));
    const wrap = slider.closest('.sens-inline');
    if (wrap) wrap.title = t('sensitivity');
  });
  dom.sensReadouts.forEach((node) => {
    const decimals = node.classList.contains('sens-readout') ? 2 : 1;
    node.textContent = value.toFixed(decimals) + '×';
  });
  appState.sensitivity = value;
}

function setSensitivity(value) {
  appState.sensitivity = clamp(Number(value) || 1, 0.3, 2.5);
  try { localStorage.setItem('core07.sensitivity', String(appState.sensitivity)); } catch (err) { /* noop */ }
  syncSensitivityUI();
}

function buildHelpGrid() {
  const items = [
    ['01', t('help1Title'), t('help1Body')],
    ['02', t('help2Title'), desktopBridge ? t('help2BodyDesktop') : t('help2BodyWeb')],
    ['03', t('help3Title'), t('help3Body')],
    ['04', t('help4Title'), t('help4Body')],
    ['05', t('help5Title'), t('help5Body')],
    ['06', t('help6Title'), t('help6Body')]
  ];
  return items.map(([no, title, body]) =>
    '<div class="help-item"><span class="help-no">' + no + '</span><div><b>' + title + '</b><p>' + body + '</p></div></div>'
  ).join('');
}

let lastSourceList = null;
let sourceListLoading = false;

function applyLanguage() {
  document.documentElement.lang = appState.lang === 'en' ? 'en' : 'zh-CN';
  document.body.classList.toggle('lang-en', appState.lang === 'en');
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml);
  });

  const igniteTitle = dom.igniteBtn.querySelector('.ignite-copy b');
  const igniteSub = dom.igniteBtn.querySelector('.ignite-copy small');
  if (igniteTitle) igniteTitle.textContent = t(desktopBridge ? 'igniteTitleDesktop' : 'igniteTitle');
  if (igniteSub) igniteSub.textContent = t(desktopBridge ? 'igniteSubDesktop' : 'igniteSub');

  document.title = t('title');
  dom.canvas.setAttribute('aria-label', appState.lang === 'en'
    ? '3D nuclear reactor control rod array reacting to music'
    : '3D 核反应堆控制棒阵列，会随音乐跳动');

  dom.langBtnText.textContent = t('langButton');
  dom.langBtn.title = t('langTitle');
  dom.langBtn.setAttribute('aria-label', t('langTitle'));

  dom.helpTitle.textContent = t('helpTitle');
  dom.helpGrid.innerHTML = buildHelpGrid();
  dom.helpFootText.textContent = t('helpFoot');
  dom.helpDemo.textContent = t('helpDemo');

  const volumeLabel = dom.volumePop.querySelector('span');
  if (volumeLabel) volumeLabel.textContent = t('volumeLabel');
  dom.volumeSliders.forEach((slider) => slider.setAttribute('aria-label', t('playbackVolume')));
  document.querySelectorAll('.vol-inline').forEach((node) => {
    node.title = t('playbackVolume');
  });

  dom.sourceTitle.textContent = t('sourceTitle');
  dom.sourceIntro.textContent = t('sourceIntro');
  dom.sourceSystemTitle.textContent = t('sourceSystemTitle');
  dom.sourceSystemSub.textContent = t('sourceSystemSub');
  dom.sourceBuiltinTitle.textContent = t('sourceBuiltinTitle');
  dom.sourceBuiltinSub.textContent = t('sourceBuiltinSub');
  dom.sourceLocalTitle.textContent = t('sourceLocalTitle');
  dom.sourceLocalSub.textContent = t('sourceLocalSub');
  dom.sourceAppsLabel.textContent = t('sourceAppsLabel');
  dom.sourceRefreshText.textContent = t('sourceRefresh');
  dom.sourceNote.textContent = t('sourceNote');
  dom.sourceWebNote.textContent = t('sourceWebNote');
  dom.sourceRefresh.title = t('sourceRefresh');

  syncAllUI();
  if (appState.sourcePickerOpen && desktopBridge) renderSourceList(lastSourceList, sourceListLoading);
}

function toggleLanguage() {
  if (appState.langAnimating) return;
  appState.langAnimating = true;
  document.body.classList.add('lang-switching');
  dom.langBtn.classList.add('is-switching');

  if (dom.langWipe && typeof dom.langWipe.animate === 'function' && !reduceMotion) {
    dom.langWipe.animate([
      { transform: 'translateX(-115%)', opacity: 0 },
      { opacity: .85, offset: .22 },
      { opacity: .55, offset: .55 },
      { transform: 'translateX(115%)', opacity: 0 }
    ], { duration: 720, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }

  const next = appState.lang === 'zh' ? 'en' : 'zh';
  setTimeout(() => {
    appState.lang = next;
    try { localStorage.setItem('core07.lang', next); } catch (err) { /* noop */ }
    applyLanguage();
    document.body.classList.remove('lang-switching');
    setTimeout(() => {
      dom.langBtn.classList.remove('is-switching');
      appState.langAnimating = false;
    }, 480);
  }, 175);
}

function setupLanguage() {
  dom.langBtn.addEventListener('click', toggleLanguage);
}

function setupSensitivity() {
  dom.sensitivitySliders.forEach((slider) => {
    slider.addEventListener('input', () => setSensitivity(slider.value));
    slider.addEventListener('dblclick', () => setSensitivity(1));
  });
  syncSensitivityUI();
}

function renderSourceList(items, loading) {
  lastSourceList = items || [];
  sourceListLoading = !!loading;
  if (!dom.sourceList) return;
  if (loading) {
    dom.sourceList.innerHTML = '<div class="source-loading"><i></i><span>' + t('sourceLoading') + '</span></div>';
    return;
  }
  if (!lastSourceList.length) {
    dom.sourceList.innerHTML = '<div class="source-empty">' + t('sourceNoPrograms') + '</div>';
    return;
  }

  dom.sourceList.innerHTML = '';
  lastSourceList.forEach((source) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'source-app';
    button.dataset.pid = String(source.pid);
    button.dataset.name = source.name || source.processName || '';

    const avatar = document.createElement('span');
    avatar.className = 'source-app-avatar';
    avatar.textContent = (source.name || source.processName || '?').trim().charAt(0).toUpperCase() || '?';

    const copy = document.createElement('span');
    copy.className = 'source-app-copy';
    const title = document.createElement('b');
    title.textContent = source.title || source.name || source.processName || t('sourceAppFallback');
    const meta = document.createElement('small');
    meta.textContent = (source.processName || 'application') + (source.title && source.name !== source.title ? ' · ' + source.name : '');
    copy.appendChild(title);
    copy.appendChild(meta);

    const pid = document.createElement('span');
    pid.className = 'source-app-pid';
    pid.textContent = 'PID ' + source.pid;

    button.appendChild(avatar);
    button.appendChild(copy);
    button.appendChild(pid);
    dom.sourceList.appendChild(button);
  });
}

async function refreshAudioSources() {
  if (!desktopBridge) return;
  renderSourceList([], true);
  try {
    const sources = await desktopBridge.listAudioSources();
    renderSourceList(Array.isArray(sources) ? sources : [], false);
  } catch (err) {
    console.warn('Listing audio sources failed:', err);
    renderSourceList([], false);
    dom.sourceList.innerHTML = '<div class="source-empty">' + t('sourceError') + '</div>';
  }
}

function openAudioPicker() {
  if (appState.helpOpen) closeHelp();
  appState.sourcePickerOpen = true;
  dom.sourceLayer.classList.add('open');
  dom.sourceLayer.classList.toggle('web-mode', !desktopBridge);
  dom.sourceLayer.setAttribute('aria-hidden', 'false');
  dom.sourceSystemTitle.textContent = t('sourceSystemTitle');
  dom.sourceSystemSub.textContent = t('sourceSystemSub');
  dom.sourceBuiltinTitle.textContent = t('sourceBuiltinTitle');
  dom.sourceBuiltinSub.textContent = t('sourceBuiltinSub');
  dom.sourceLocalTitle.textContent = t('sourceLocalTitle');
  dom.sourceLocalSub.textContent = t('sourceLocalSub');
  dom.sourceNote.textContent = t('sourceNote');
  dom.sourceWebNote.textContent = t('sourceWebNote');
  dom.sourceWebNote.hidden = !!desktopBridge;

  if (desktopBridge) {
    renderSourceList([], true);
    refreshAudioSources();
  } else {
    lastSourceList = [];
    dom.sourceList.innerHTML = '';
  }
  setTimeout(() => dom.sourceClose.focus(), 60);
}

function closeAudioPicker() {
  appState.sourcePickerOpen = false;
  dom.sourceLayer.classList.remove('open');
  dom.sourceLayer.setAttribute('aria-hidden', 'true');
}

function setupAudioPicker() {
  dom.sourceClose.addEventListener('click', closeAudioPicker);
  dom.sourceRefresh.addEventListener('click', refreshAudioSources);
  dom.sourceLayer.addEventListener('click', (e) => {
    if (e.target === dom.sourceLayer) closeAudioPicker();
  });
  dom.sourceSystemBtn.addEventListener('click', async () => {
    closeAudioPicker();
    if (desktopBridge) await startDesktopAudio({ mode: 'system' });
    else await enableSystemAudio();
  });
  dom.sourceBuiltinBtn.addEventListener('click', async () => {
    closeAudioPicker();
    await playBuiltInTrack();
  });
  dom.sourceLocalBtn.addEventListener('click', () => {
    closeAudioPicker();
    dom.fileInput.click();
  });
  dom.sourceList.addEventListener('click', async (e) => {
    const button = e.target.closest('.source-app');
    if (!button) return;
    const pid = Number(button.dataset.pid);
    if (!Number.isFinite(pid) || pid <= 0) return;
    const name = button.dataset.name || '';
    closeAudioPicker();
    await startDesktopAudio({ mode: 'process', pid, name });
  });
}

function initArtGrid() {
  if (!dom.artGrid) return;
  for (let i = 0; i < 36; i++) {
    const cell = document.createElement('i');
    const pal = PALETTE[Math.floor(hash11(i * 2.77 + 4.2) * PALETTE.length)];
    cell.style.background = '#' + pal.cap.toString(16).padStart(6, '0');
    cell.style.opacity = (0.18 + hash11(i * 6.1) * 0.4).toFixed(2);
    if (hash11(i * 1.9 + 6.5) > 0.56) cell.classList.add('hot');
    dom.artGrid.appendChild(cell);
    artCells.push(cell);
  }
}

function updateArtGrid() {
  const active = !!appState.active && appState.playing;
  const energy = active ? audioMix.level : 0.02;
  for (let i = 0; i < artCells.length; i++) {
    const cell = artCells[i];
    const wave = Math.sin(globalTime * (1.2 + (i % 7) * 0.21) + i * 1.7) * 0.5 + 0.5;
    const lit = active
      ? wave + energy * 0.96 > 0.74
      : wave > 0.82;
    cell.classList.toggle('hot', lit);
    cell.style.opacity = (0.16 + (lit ? 0.7 : 0.13) + energy * 0.12).toFixed(2);
  }
}

const scopeCtx = dom.scope ? dom.scope.getContext('2d') : null;
let scopeGradient = null;

function drawScope() {
  if (!scopeCtx) return;
  const w = dom.scope.width;
  const h = dom.scope.height;
  scopeCtx.clearRect(0, 0, w, h);

  scopeCtx.strokeStyle = 'rgba(214,219,200,.055)';
  scopeCtx.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 8) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(x + 0.5, 0);
    scopeCtx.lineTo(x + 0.5, h);
    scopeCtx.stroke();
  }
  for (let y = 0; y <= h; y += h / 4) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, y + 0.5);
    scopeCtx.lineTo(w, y + 0.5);
    scopeCtx.stroke();
  }

  if (!scopeGradient) {
    scopeGradient = scopeCtx.createLinearGradient(0, 0, w, 0);
    scopeGradient.addColorStop(0, 'rgba(190,180,141,.16)');
    scopeGradient.addColorStop(0.48, 'rgba(226,219,188,.86)');
    scopeGradient.addColorStop(1, 'rgba(144,181,157,.36)');
  }

  const active = !!appState.active && appState.playing;
  const data = audioEngine.timeData;
  const amp = active ? (0.55 + audioMix.level * 1.75) : 0.12;
  const points = 160;

  scopeCtx.beginPath();
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * w;
    let v;
    if (active && data && data.length) {
      const idx = Math.min(data.length - 1, Math.floor((i / points) * data.length));
      v = (data[idx] - 128) / 128;
    } else {
      v = Math.sin((i / points) * TAU * 2.4 + globalTime * 0.8) * 0.09
        + Math.sin((i / points) * TAU * 7.1 - globalTime * 0.35) * 0.035;
    }
    const y = h / 2 + v * (h * 0.43) * amp;
    if (i === 0) scopeCtx.moveTo(x, y);
    else scopeCtx.lineTo(x, y);
  }
  scopeCtx.lineWidth = 1.5;
  scopeCtx.strokeStyle = scopeGradient;
  scopeCtx.shadowColor = 'rgba(226,219,188,.35)';
  scopeCtx.shadowBlur = active ? 5 : 2;
  scopeCtx.stroke();
  scopeCtx.shadowBlur = 0;

  // tiny leading marker, giving the trace an instrument-like feel
  const markerX = ((globalTime * 0.12) % 1) * w;
  scopeCtx.fillStyle = 'rgba(229,222,191,.42)';
  scopeCtx.fillRect(markerX, 0, 1, h);
}

function updateReadouts(now) {
  if (now - appState.lastUIUpdate < 0.075) return;
  appState.lastUIUpdate = now;

  const energy = clamp(audioMix.level * 100, 0, 100);
  const excite = Math.round(energy);
  dom.exciteValue.textContent = excite < 10 ? '0' + excite : String(excite);
  const gaugePct = clamp(audioMix.level, 0, 1);
  dom.gaugeFill.style.strokeDashoffset = String(194.78 * (1 - gaugePct));
  dom.gaugeText.textContent = String(Math.round(gaugePct * 100)).padStart(2, '0');

  dom.bandBars.forEach((row) => {
    const key = row.dataset.band;
    const v = audioMix[key] || 0;
    const bar = row.querySelector('.bar i');
    const number = row.querySelector('b');
    if (bar) bar.style.width = (clamp(v, 0, 1) * 100).toFixed(1) + '%';
    if (number) number.textContent = String(Math.round(clamp(v, 0, 1) * 99)).padStart(2, '0');
  });

  const lift = (world.avgLift || 0);
  dom.liftValue.textContent = lift.toFixed(2);

  if (now - artTimer > 0.12) {
    artTimer = now;
    updateArtGrid();
  }
}

function updateTransportTimeline() {
  const active = appState.active;
  if (active === 'mic' || active === 'system') {
    dom.timeLabel.textContent = 'LIVE';
    dom.durationLabel.textContent = 'LIVE';
    return;
  }

  if (active === 'demo') {
    const pct = getDemoProgress() * 100;
    if (!appState.seekDragging) {
      dom.seekFill.style.width = pct + '%';
      dom.seekHead.style.left = pct + '%';
      dom.seek.setAttribute('aria-valuenow', String(Math.round(pct)));
      const duration = audioEngine.demo.loop || 0;
      dom.timeLabel.textContent = formatTime((pct / 100) * duration);
      dom.durationLabel.textContent = formatTime(duration);
    }
    return;
  }

  if (active === 'file') {
    const duration = dom.audio.duration;
    if (!appState.seekDragging) {
      const pct = isFinitePositive(duration) ? clamp(dom.audio.currentTime / duration, 0, 1) * 100 : 0;
      dom.seekFill.style.width = pct + '%';
      dom.seekHead.style.left = pct + '%';
      dom.seek.setAttribute('aria-valuenow', String(Math.round(pct)));
      dom.timeLabel.textContent = formatTime(dom.audio.currentTime);
      dom.durationLabel.textContent = formatTime(duration);
    }
    return;
  }

  dom.seekFill.style.width = '0%';
  dom.seekHead.style.left = '0%';
  dom.timeLabel.textContent = '00:00';
  dom.durationLabel.textContent = '--:--';
}

function seekFractionFromPointer(event) {
  const rect = dom.seek.getBoundingClientRect();
  return clamp((event.clientX - rect.left) / rect.width, 0, 1);
}

function previewSeek(fraction) {
  const pct = fraction * 100;
  dom.seekFill.style.width = pct + '%';
  dom.seekHead.style.left = pct + '%';
  dom.seek.setAttribute('aria-valuenow', String(Math.round(pct)));
  const duration = currentPlaybackDuration();
  if (duration > 0) dom.timeLabel.textContent = formatTime(duration * fraction);
}

function setupSeek() {
  dom.seek.addEventListener('pointerdown', (event) => {
    if (!appState.active) return;
    if (event.button !== 0) return;
    event.preventDefault();
    appState.seekDragging = true;
    dom.seek.classList.add('active');
    dom.seek.setPointerCapture(event.pointerId);
    previewSeek(seekFractionFromPointer(event));
  });

  dom.seek.addEventListener('pointermove', (event) => {
    if (!appState.seekDragging) return;
    previewSeek(seekFractionFromPointer(event));
  });

  const finish = (event) => {
    if (!appState.seekDragging) return;
    appState.seekDragging = false;
    dom.seek.classList.remove('active');
    const f = seekFractionFromPointer(event);
    seekToFraction(f);
    previewSeek(f);
    updateTransportTimeline();
  };

  dom.seek.addEventListener('pointerup', finish);
  dom.seek.addEventListener('pointercancel', finish);

  dom.seek.addEventListener('keydown', (event) => {
    if (!appState.active) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const duration = currentPlaybackDuration();
    if (!duration) return;
    let pct = currentPlaybackTime() / duration;
    pct += event.key === 'ArrowRight' ? 0.03 : -0.03;
    seekToFraction(clamp(pct, 0, 1));
    updateTransportTimeline();
  });
}

async function handleFile(file) {
  if (!file) return;
  await loadLocalFile(file);
}

function setupDock() {
  dom.fileBtn.addEventListener('click', () => dom.fileInput.click());
  dom.igniteBtn.addEventListener('click', () => {
    openAudioPicker();
  });
  dom.fileInput.addEventListener('change', () => {
    const file = dom.fileInput.files && dom.fileInput.files[0];
    if (file) handleFile(file);
    dom.fileInput.value = '';
  });

  dom.playBtn.addEventListener('click', togglePlayback);
  dom.systemBtn.addEventListener('click', toggleSystemAudio);
  dom.micBtn.addEventListener('click', toggleMicrophone);
  dom.demoBtn.addEventListener('click', () => {
    if (appState.active === 'demo') {
      if (appState.playing) pauseDemo();
      else resumeDemo();
    } else {
      startDemo();
    }
  });

  dom.muteBtn.addEventListener('click', () => {
    toggleMute();
    showVolumePop();
  });
  dom.volumeSliders.forEach((slider) => {
    slider.addEventListener('input', () => setVolume(slider.value));
    slider.addEventListener('change', () => setVolume(slider.value));
  });

  dom.muteBtn.addEventListener('pointerenter', showVolumePop);
  dom.muteBtn.addEventListener('focus', showVolumePop);
  dom.muteBtn.addEventListener('pointerleave', scheduleVolumeHide);
  dom.volumePop.addEventListener('pointerenter', showVolumePop);
  dom.volumePop.addEventListener('pointerleave', scheduleVolumeHide);
  dom.volumePop.addEventListener('pointerdown', (e) => e.stopPropagation());
}

function showVolumePop() {
  clearTimeout(lastVolumeHoverClose);
  dom.volumePop.classList.add('open');
}

function scheduleVolumeHide() {
  clearTimeout(lastVolumeHoverClose);
  lastVolumeHoverClose = setTimeout(() => {
    dom.volumePop.classList.remove('open');
  }, 350);
}

function setupDragDrop() {
  const hasFiles = (e) => {
    if (!e.dataTransfer) return false;
    if (e.dataTransfer.types) {
      for (let i = 0; i < e.dataTransfer.types.length; i++) {
        if (e.dataTransfer.types[i] === 'Files') return true;
      }
    }
    return false;
  };

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    dom.dropLayer.classList.add('visible');
  });

  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dom.dropLayer.classList.add('visible');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dom.dropLayer.classList.remove('visible');
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    dom.dropLayer.classList.remove('visible');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    const file = files[0];
    if (!isAudioFile(file)) {
      showToast(t('toastDropAudio'), true);
      return;
    }
    handleFile(file);
  });
}

function openHelp() {
  if (appState.helpOpen) return;
  helpReturnFocus = document.activeElement;
  appState.helpOpen = true;
  dom.helpLayer.classList.add('open');
  dom.helpLayer.setAttribute('aria-hidden', 'false');
  setTimeout(() => dom.helpClose.focus(), 50);
}

function closeHelp() {
  if (!appState.helpOpen) return;
  appState.helpOpen = false;
  dom.helpLayer.classList.remove('open');
  dom.helpLayer.setAttribute('aria-hidden', 'true');
  if (helpReturnFocus && typeof helpReturnFocus.focus === 'function') helpReturnFocus.focus();
}

function setupHelp() {
  dom.helpBtn.addEventListener('click', openHelp);
  dom.helpClose.addEventListener('click', closeHelp);
  dom.helpLayer.addEventListener('click', (e) => {
    if (e.target === dom.helpLayer) closeHelp();
  });
  dom.helpDemo.addEventListener('click', () => {
    closeHelp();
    startDemo();
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => showToast(t('toastFullscreenDenied'), true));
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function toggleUI() {
  document.body.classList.toggle('ui-hidden');
  if (document.body.classList.contains('ui-hidden')) {
    closeHelp();
    dom.volumePop.classList.remove('open');
  }
}

function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const onButton = tag === 'BUTTON';

    if (e.key === 'Escape') {
      if (appState.helpOpen) {
        closeHelp();
        return;
      }
      if (appState.sourcePickerOpen) {
        closeAudioPicker();
        return;
      }
      dom.volumePop.classList.remove('open');
      return;
    }

    if (typing) return;
    if (e.code === 'Space') {
      if (onButton && e.target && /play|demo|mic|file|system|lang/i.test(e.target.id || '')) return;
      e.preventDefault();
      if (!appState.helpOpen && !appState.sourcePickerOpen) togglePlayback();
      return;
    }
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === 'h') {
      e.preventDefault();
      toggleUI();
    } else if (key === 'r') {
      e.preventDefault();
      resetView();
    } else if (key === 'm') {
      e.preventDefault();
      if (!appState.helpOpen) toggleMicrophone();
    } else if (key === 's') {
      e.preventDefault();
      if (!appState.helpOpen) toggleSystemAudio();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!appState.active || appState.helpOpen) return;
      e.preventDefault();
      const duration = currentPlaybackDuration();
      if (!duration) return;
      let pct = currentPlaybackTime() / duration;
      pct += e.key === 'ArrowRight' ? 0.03 : -0.03;
      seekToFraction(clamp(pct, 0, 1));
      updateTransportTimeline();
    }
  });
}

function setupMiscUI() {
  dom.fullBtn.addEventListener('click', toggleFullscreen);
  initArtGrid();
  setupLanguage();
  setupSensitivity();
  setupAudioPicker();
  syncVolumeUI();
  applyLanguage();

  // Create and resume the audio graph on the very first gesture, before a
  // click handler starts a source. This avoids a suspended-context race where
  // a demo or file begins on the timeline but no analyser data arrives until
  // the next click.
  const unlock = () => {
    if (!audioEngine.ctx) {
      const ctx = initAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    if (audioEngine.ctx.state === 'suspended') {
      audioEngine.ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

function setupUI() {
  setupDock();
  setupSeek();
  setupDragDrop();
  setupHelp();
  setupShortcuts();
  setupMiscUI();
  requestAnimationFrame(() => {
    updateTransportTimeline();
  });
}
