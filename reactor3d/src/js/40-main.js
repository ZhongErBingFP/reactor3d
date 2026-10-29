/* ============================================================
   Camera, rod animation, lighting response and the render loop
   ============================================================ */

function computeFitDistance(pitch) {
  const aspect = Math.max(0.35, window.innerWidth / Math.max(1, window.innerHeight));
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const tan = Math.tan(fovRad / 2);
  const outerRadius = 10.0;
  const narrow = window.innerWidth < 760;
  const widthFill = narrow ? 0.98 : 0.89;
  const heightFill = narrow ? 0.66 : 0.92;
  const dWidth = outerRadius / (widthFill * tan * aspect);
  const dHeight = (outerRadius * Math.sin(pitch)) / (heightFill * tan);
  return clamp(Math.max(dWidth, dHeight), 18, 120);
}

function resetView() {
  view.userYaw = 0;
  view.userPitch = 0;
  view.zoom = 1;
  showToast(t('toastViewReset'));
}

function setupCameraInteraction() {
  dom.canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    view.dragging = true;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    dom.canvas.classList.add('dragging');
    if (dom.canvas.setPointerCapture) {
      try { dom.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (view.dragging) {
      const dx = e.clientX - view.lastX;
      const dy = e.clientY - view.lastY;
      view.lastX = e.clientX;
      view.lastY = e.clientY;
      view.userYaw -= dx * 0.0043;
      view.userPitch = clamp(view.userPitch - dy * 0.003, -0.28, 0.42);
      view.pointerX = 0;
    } else if (e.pointerType === 'mouse') {
      view.pointerX = clamp((e.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      view.pointerY = clamp((e.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    }
  });

  const stopDrag = () => {
    if (!view.dragging) return;
    view.dragging = false;
    dom.canvas.classList.remove('dragging');
  };
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
  window.addEventListener('blur', stopDrag);

  dom.canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.zoom = clamp(view.zoom * (1 + e.deltaY * 0.00075), 0.76, 1.32);
  }, { passive: false });

  dom.canvas.addEventListener('dblclick', resetView);
}

function updateCamera(dt) {
  view.intro = damp(view.intro, 0, 1.05, dt);
  const autoSway = reduceMotion ? 0 : Math.sin(globalTime * 0.085) * 0.025;
  const pointerYaw = reduceMotion ? 0 : view.pointerX * 0.036;
  const pointerPitch = reduceMotion ? 0 : view.pointerY * 0.012;

  const basePitch = view.pitch + view.userPitch + pointerPitch + view.intro * 0.11;
  const pitch = clamp(basePitch, 0.32, 1.12);
  const yaw = view.userYaw + autoSway + pointerYaw - view.intro * 0.2;
  const fit = computeFitDistance(pitch);
  view.fitDist = damp(view.fitDist, fit, 3.2, dt);
  const zoom = view.zoom * (1 + view.intro * 0.13);
  const dist = view.fitDist * zoom;
  view.dist = damp(view.dist, dist, 4.5, dt);

  const horizontal = Math.cos(pitch) * view.dist;
  const cx = Math.sin(yaw) * horizontal;
  const cz = Math.cos(yaw) * horizontal;
  const cy = Math.sin(pitch) * view.dist + 0.25;

  camera.position.set(cx, cy, cz);

  const shaking = appState.mockEnergy !== null || (!!appState.active && appState.playing);
  if (shaking) {
    const shake = clamp(audioMix.level * 0.6 + audioMix.beat * 0.85, 0, 1.45)
      * clamp(appState.sensitivity * 0.62, 0.25, 1.55);
    camera.position.x += Math.sin(globalTime * 79) * 0.03 * shake;
    camera.position.y += Math.cos(globalTime * 67) * 0.018 * shake;
    camera.position.z += Math.sin(globalTime * 53) * 0.012 * shake;
  }

  camera.lookAt(0, 0.52, 0);
  view.cameraY = cy;
}

function applyMockAudio() {
  if (appState.mockEnergy === null) return;
  const m = clamp(appState.mockEnergy, 0, 1);
  const t = globalTime;
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.72 + 0.4)), 11);
  audioMix.bass = clamp(m * (0.76 + 0.24 * Math.sin(t * 2.9)), 0, 1);
  audioMix.low = clamp(m * (0.55 + 0.45 * Math.sin(t * 3.7 + 1.2)), 0, 1);
  audioMix.mid = clamp(m * (0.42 + 0.32 * Math.sin(t * 5.2 + 2.6)), 0, 1);
  audioMix.high = clamp(m * (0.3 + 0.26 * Math.sin(t * 7.1 + 3.4)), 0, 1);
  audioMix.beat = beat;
  audioMix.level = clamp(
    audioMix.bass * 0.48 + audioMix.low * 0.27 + audioMix.mid * 0.17 + audioMix.high * 0.08,
    0,
    1
  );
}

function smoothstep(edge0, edge1, x) {
  const v = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return v * v * (3 - 2 * v);
}

function updateRods(dt) {
  const active = appState.mockEnergy !== null || (!!appState.active && appState.playing);
  const t = globalTime;
  const mid = audioMix.mid;
  const high = audioMix.high;
  const beat = audioMix.beat;
  const rods = world.rods;
  const fft = audioEngine.freqData;
  const fftCount = fft && fft.length ? fft.length : 0;
  const nyquist = audioEngine.ctx ? audioEngine.ctx.sampleRate * 0.5 : 24000;
  const sensitivity = clamp(appState.sensitivity, 0.3, 2.5);
  const tremorBase = active
    ? clamp((0.35 + high * 0.65 + mid * 0.22 + beat * 0.6) * sensitivity, 0, 2.8)
    : 0;
  let total = 0;

  for (let i = 0; i < rods.length; i++) {
    const rod = rods[i];
    // Map the real rods radially: bass at the core centre, rising
    // logarithmically to high frequencies at the outer edge.
    const outward = clamp(rod.radial, 0, 1);
    const frequency = 28 * Math.pow(390, outward);
    const bin = fftCount
      ? clamp(Math.round((frequency / nyquist) * fftCount), 1, fftCount - 2)
      : 0;
    const magnitude = fftCount
      ? (fft[bin - 1] * 0.25 + fft[bin] * 0.5 + fft[bin + 1] * 0.25) / 255
      : 0;
    const radial = rod.radial;
    const outerMask = smoothstep(0.45, 1, radial);
    let target;

    if (active) {
      // Lift itself is the spectrum: FFT amplitude controls rod height,
      // with a clear beat push on bass columns and no overlay visualization.
      const signal = Math.pow(clamp((magnitude - 0.035) / 0.72, 0, 1), 0.82);
      const bassWeight = 1 - smoothstep(0.04, 0.38, outward);
      const rowRipple = 0.92 + 0.08 * (0.5 + 0.5 * Math.sin(rod.z * 0.42 + t * 2.2 + rod.phase));
      target = (0.035 + signal * 2.65 + beat * bassWeight * 0.62)
        * (0.65 + sensitivity * 0.35) * rowRipple;
    } else {
      target = 0.004 + (0.5 + 0.5 * Math.sin(t * 0.42 + rod.phase)) * 0.008;
    }

    rod.target = target;
    const attack = active ? 20 : 4;
    const release = active ? 6.5 : 3.2;
    rod.elev = damp(rod.elev, target, target > rod.elev ? attack : release, dt);
    if (rod.elev < 0.0004) rod.elev = 0;

    let renderElev = rod.elev;
    let jitterX = 0;
    let jitterZ = 0;
    if (active) {
      // The tiny vertical tremor is visual texture only; base height stays
      // a direct function of the frequency magnitude.
      const radialTremor = 0.12 + outerMask * 0.9;
      const fastA = Math.sin(t * (37 + rod.drive * 21) + rod.phase * 13);
      const fastB = Math.sin(t * (61 + rod.drive * 13) - rod.phase * 7.3);
      const tremor = (fastA * 0.68 + fastB * 0.32) * 0.06 * tremorBase * radialTremor;
      jitterX = Math.sin(t * (29 + rod.drive * 17) + rod.phase * 9.1) * 0.011 * tremorBase * radialTremor
        + Math.sin(t * 83 + rod.phase * 11) * 0.0025 * radialTremor;
      jitterZ = Math.cos(t * (33 + rod.drive * 13) - rod.phase * 8.3) * 0.011 * tremorBase * radialTremor;
      renderElev = Math.max(0, rod.elev + tremor);
    }
    rod.renderElev = renderElev;
    rod.jitterX = jitterX;
    rod.jitterZ = jitterZ;
    total += renderElev;
  }

  for (let g = 0; g < world.rodGroups.length; g++) {
    const group = world.rodGroups[g];
    const bodyArr = group.bodyArr;
    const capArr = group.capArr;
    const groupRods = group.rods;
    for (let i = 0; i < groupRods.length; i++) {
      const rod = groupRods[i];
      const y = rod.rest + rod.renderElev;
      const x = rod.x + rod.jitterX;
      const z = rod.z + rod.jitterZ;
      // Stretch the body downward as it rises so a rod has no visible top
      // limit but never floats above its socket.
      const bodyScaleY = 1 + rod.renderElev / 3.15;
      bodyArr[i * 16 + 5] = bodyScaleY;
      bodyArr[i * 16 + 12] = x;
      bodyArr[i * 16 + 13] = y;
      bodyArr[i * 16 + 14] = z;
      capArr[i * 16 + 5] = 1;
      capArr[i * 16 + 12] = x;
      capArr[i * 16 + 13] = y;
      capArr[i * 16 + 14] = z;
    }
    group.body.instanceMatrix.needsUpdate = true;
    group.cap.instanceMatrix.needsUpdate = true;
  }

  function updateDotSet(set) {
    if (!set) return;
    const arr = set.arr;
    for (let i = 0; i < set.rods.length; i++) {
      const rod = set.rods[i];
      arr[i * 16 + 12] = rod.x + rod.jitterX;
      arr[i * 16 + 13] = rod.rest + rod.renderElev;
      arr[i * 16 + 14] = rod.z + rod.jitterZ;
    }
    set.mesh.instanceMatrix.needsUpdate = true;
  }
  updateDotSet(world.dotMesh);
  updateDotSet(world.accentDots);

  world.avgLift = total / Math.max(1, rods.length);
}

function updateAtmosphere(dt) {
  const level = audioMix.level;
  const beat = audioMix.beat;
  const active = !!appState.active && appState.playing;

  if (world.dust) {
    world.dust.rotation.y += dt * 0.006;
    world.dust.material.opacity = 0.2 + level * 0.17;
  }

  if (world.embers) {
    const pos = world.embers.geometry.attributes.position;
    const data = world.emberData;
    const array = pos.array;
    const speedBoost = active ? 2.4 : 0.28;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      d.y += dt * d.speed * (0.32 + level * 1.8) * speedBoost;
      if (d.y > 3.4 || (!active && d.y > 1.5 && Math.random() < 0.002)) {
        d.y = 0.28 + Math.random() * 0.42;
        const a = Math.random() * TAU;
        const r = Math.sqrt(Math.random()) * 6.65;
        d.x = Math.cos(a) * r;
        d.z = Math.sin(a) * r;
      }
      array[i * 3] = d.x + Math.sin(globalTime * 0.31 + d.phase) * 0.08;
      array[i * 3 + 1] = d.y;
      array[i * 3 + 2] = d.z + Math.cos(globalTime * 0.27 + d.phase) * 0.08;
    }
    pos.needsUpdate = true;
    world.embers.material.opacity = active ? 0.15 + level * 0.72 + beat * 0.12 : 0.08;
  }

  if (world.coreGlow) {
    world.coreGlow.material.opacity = 0.13 + level * 0.53 + beat * 0.16;
  }
  if (world.coreHalo) {
    const s = 17.5 + level * 2.5 + beat * 1.2;
    world.coreHalo.scale.set(s, s, s);
    world.coreHalo.material.opacity = 0.045 + level * 0.14 + beat * 0.05;
  }
  if (world.ringLineMat) {
    world.ringLineMat.opacity = 0.09 + level * 0.2 + beat * 0.17;
  }
  if (world.dotMat) {
    world.dotMat.emissiveIntensity = 0.06 + level * 0.18 + beat * 0.15;
  }
  if (world.accentDotMat) {
    world.accentDotMat.emissiveIntensity = 0.28 + level * 0.5 + beat * 0.6;
  }

  for (let i = 0; i < world.glowMats.length; i++) {
    const chase = 0.5 + 0.5 * Math.sin(globalTime * 2.4 - i * 0.72);
    world.glowMats[i].opacity = 0.13 + level * 0.34 + beat * 0.21 * (0.4 + chase);
  }

  if (world.amberBulbs) {
    const c = 0.72 + level * 0.22 + beat * 0.22;
    world.amberBulbs.material.color.setRGB(0.78 * c, 0.7 * c, 0.47 * c);
  }

  if (worldRefs.centerLight) {
    worldRefs.centerLight.intensity = 0.7 + level * 1.8 + beat * 1.3;
    worldRefs.centerLight.color.setRGB(1, 0.63 + level * 0.16, 0.37 + level * 0.1);
  }
  if (worldRefs.keyLight) {
    worldRefs.keyLight.intensity = 1.08 + beat * 0.1;
  }
}

function onResize() {
  if (!renderer) return;
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(canvasWidth, canvasHeight, false);
  camera.aspect = canvasWidth / Math.max(1, canvasHeight);
  camera.updateProjectionMatrix();
  view.fitDist = computeFitDistance(view.pitch + view.userPitch);
}

function updateBootProgress(progress) {
  const p = clamp(progress, 0, 100);
  if (dom.bootFill) dom.bootFill.style.width = p + '%';
  if (dom.bootPct) dom.bootPct.textContent = String(Math.round(p)).padStart(2, '0');
}

let bootHidden = false;
function finishBoot() {
  if (bootHidden) return;
  bootHidden = true;
  updateBootProgress(100);
  setTimeout(() => {
    if (dom.boot) dom.boot.classList.add('done');
  }, 260);
}

let lastFrame = performance.now();
function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;

  const dt = Math.min(0.05, Math.max(0.0001, clock.getDelta()));
  globalTime += dt;
  frameCount++;

  analyseAudio(dt);
  applyMockAudio();
  updateCamera(dt);
  updateRods(dt);
  updateAtmosphere(dt);
  updateTransportTimeline();
  drawScope();
  updateReadouts(globalTime);

  renderer.render(scene, camera);

  if (!appState.ready) {
    appState.ready = true;
    window.__CORE_READY__ = true;
    updateBootProgress(100);
    setTimeout(finishBoot, 420);
    if (dom.rodCount) dom.rodCount.textContent = String(world.rodCount);
  }

  const now = performance.now();
  const frameMs = now - lastFrame;
  lastFrame = now;
  if (frameMs > 0) appState.fps = damp(appState.fps, 1000 / frameMs, 2, dt);
}

function initReactor() {
  if (!renderer) {
    const err = appState.fatal || new Error('WebGL unavailable');
    console.error('Reactor init failed:', err);
    showFatal(appState.lang === 'en'
      ? 'Could not create the WebGL scene. Enable hardware acceleration or try another browser.'
      : '无法创建 WebGL 场景 · 请开启硬件加速或更换浏览器');
    window.__CORE_READY__ = false;
    window.__CORE_ERROR__ = String(err && err.message ? err.message : err);
    return;
  }

  onResize();
  buildWorld();
  buildCameraInitial();
  setupCameraInteraction();
  setupUI();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

  dom.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showToast(t('toastWebglLost'), true);
  });

  // boot progress gives the interface a short, deliberate ignition
  let bootProgress = 9;
  updateBootProgress(bootProgress);
  const bootTimer = setInterval(() => {
    bootProgress = Math.min(94, bootProgress + 4 + Math.random() * 8);
    updateBootProgress(bootProgress);
    if (bootProgress >= 94) clearInterval(bootTimer);
  }, 85);

  animate();

  window.__CORE__ = {
    getState: () => ({
      ready: appState.ready,
      active: appState.active,
      playing: appState.playing,
      rodCount: world.rodCount,
      level: audioMix.level,
      bass: audioMix.bass,
      lift: world.avgLift || 0,
      muted: appState.muted,
      volume: appState.volume,
      sensitivity: appState.sensitivity,
      fileIsBuiltin: appState.fileIsBuiltin,
      lang: appState.lang,
      systemKind: appState.systemKind,
      systemName: appState.systemName,
      fps: appState.fps
    }),
    setMockEnergy: (value) => {
      appState.mockEnergy = value === null || value === undefined ? null : clamp(Number(value), 0, 1);
      return appState.mockEnergy;
    },
    triggerBeat: () => {
      audioMix.beat = 1;
      audioEngine.lastBeatAt = audioNow();
      appState.beatCount++;
    },
    startDemo,
    pauseDemo,
    resumeDemo,
    togglePlayback,
    resetCamera: resetView,
    setVolume,
    getRendererInfo: () => renderer ? {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures
    } : null,
    getRingStats: () => {
      const rings = { center: [], middle: [], outer: [] };
      world.rods.forEach((rod) => {
        const value = rod.renderElev === undefined ? rod.elev : rod.renderElev;
        if (rod.radial < 0.38) rings.center.push(value);
        else if (rod.radial < 0.7) rings.middle.push(value);
        else rings.outer.push(value);
      });
      const average = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      return {
        center: average(rings.center),
        middle: average(rings.middle),
        outer: average(rings.outer),
        counts: { center: rings.center.length, middle: rings.middle.length, outer: rings.outer.length }
      };
    },
    getRodStats: () => {
      const values = world.rods.map((rod) => (rod.renderElev === undefined ? rod.elev : rod.renderElev));
      const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(1, values.length);
      const maxLift = 999;
      return {
        count: values.length,
        mean,
        stddev: Math.sqrt(variance),
        min: Math.min.apply(null, values),
        max: Math.max.apply(null, values),
        targetMean: world.rods.reduce((sum, rod) => sum + (rod.target || 0), 0) / Math.max(1, world.rods.length),
        targetMax: Math.max.apply(null, world.rods.map((rod) => rod.target || 0)),
        atCeiling: values.filter((value) => value > maxLift * 0.97).length,
        atRest: values.filter((value) => value < 0.01).length
      };
    },
    getAudioInfo: () => ({
      ctxState: audioEngine.ctx ? audioEngine.ctx.state : 'none',
      paused: dom.audio.paused,
      currentTime: dom.audio.currentTime,
      duration: dom.audio.duration,
      demoActive: audioEngine.demo.active,
      demoPlaying: audioEngine.demo.playing,
      analyserBins: audioEngine.freqData ? audioEngine.freqData.length : 0
    })
  };
}

function buildCameraInitial() {
  view.pitch = THREE.MathUtils.degToRad(35.5);
  view.fitDist = computeFitDistance(view.pitch);
  view.dist = view.fitDist * 1.16;
  view.intro = 1;
  camera.position.set(-4, 22, 24);
  camera.lookAt(0, 0.4, 0);
}

initReactor();
