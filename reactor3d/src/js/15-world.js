/* ============================================================
   World building: reactor hall, vessel, rod matrix, atmosphere
   ============================================================ */

const PALETTE = [
  { key: 'cream', body: 0x62604e, cap: 0x9e9879, dot: 0xe7dfc0 },
  { key: 'rust', body: 0x4d2922, cap: 0x874335, dot: 0xe1d3b4 },
  { key: 'sage', body: 0x303a2f, cap: 0x58664f, dot: 0xd9dfc2 },
  { key: 'beige', body: 0x504b38, cap: 0x807455, dot: 0xe0d4b5 },
  { key: 'dark', body: 0x20251f, cap: 0x353c32, dot: 0xbdbda3 }
];

const worldRefs = {
  floor: null,
  stage: null,
  shell: null,
  backdrop: null,
  keyLight: null,
  centerLight: null,
  glowLight: null,
  ambient: null
};

const textureCache = {};

function makeCanvasTexture(canvas, srgb) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = srgb === false ? THREE.LinearEncoding : THREE.sRGBEncoding;
  tex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  tex.needsUpdate = true;
  return tex;
}

function makeGlowTexture(size, inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner || 'rgba(255,255,255,1)');
  g.addColorStop(0.18, inner || 'rgba(255,255,255,.92)');
  g.addColorStop(0.48, 'rgba(255,255,255,.26)');
  g.addColorStop(1, outer || 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeSoftDiscTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(0.3, 'rgba(255,255,255,.5)');
  g.addColorStop(0.7, 'rgba(255,255,255,.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function buildEnvironment() {
  if (!renderer || !pmrem) return;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#080b09');
  bg.addColorStop(0.42, '#252c26');
  bg.addColorStop(0.62, '#111612');
  bg.addColorStop(1, '#030504');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 512);

  // long overhead light bars -> broad metallic reflections on the rim
  for (let i = 0; i < 5; i++) {
    const x = 74 + i * 224;
    const lg = ctx.createLinearGradient(0, 36, 0, 112);
    lg.addColorStop(0, 'rgba(255,244,215,0)');
    lg.addColorStop(0.36, 'rgba(255,245,218,.95)');
    lg.addColorStop(0.64, 'rgba(255,238,203,.55)');
    lg.addColorStop(1, 'rgba(255,238,203,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, 32, 108, 84);
    ctx.fillStyle = 'rgba(255,246,221,.9)';
    ctx.fillRect(x + 20, 47, 68, 8);
  }

  // faint amber service lights low in the room
  for (let i = 0; i < 4; i++) {
    const x = 120 + i * 260;
    const rg = ctx.createRadialGradient(x, 330, 0, x, 330, 120);
    rg.addColorStop(0, 'rgba(205,159,89,.36)');
    rg.addColorStop(0.32, 'rgba(161,107,55,.13)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 150, 190, 300, 280);
  }

  // subtle vertical structure
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#aeb9aa';
  for (let i = 0; i < 16; i++) {
    const x = 16 + i * 64;
    ctx.fillRect(x, 160, 2, 310);
  }
  ctx.globalAlpha = 1;

  const tex = makeCanvasTexture(c, false);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  envRT = pmrem.fromEquirectangular(tex);
  scene.environment = envRT.texture;
  tex.dispose();
}

function buildFloorTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = hash21(x * 0.71 + 2, y * 0.83 + 9);
      const n2 = hash21(x * 0.13, y * 0.17);
      const v = 15 + n * 12 + n2 * 7;
      img.data[i] = v * 0.86;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 0.9;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = '#9ea999';
  ctx.lineWidth = 1;
  for (let i = 0; i < 38; i++) {
    const x = hash11(i * 4.3) * size;
    const y = hash11(i * 7.9 + 4) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16 + hash11(i) * 90, y + (hash11(i + 1) - 0.5) * 5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = makeCanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  return tex;
}

function buildDeckMarkings() {
  const size = 2048;
  const span = 36;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const p = size / span;
  const cx = size / 2;
  const cy = size / 2;

  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(196,190,159,.34)';
  ctx.fillStyle = 'rgba(196,190,159,.32)';
  ctx.lineWidth = 2;

  [12.8, 15.4, 19.2, 22.2].forEach((r, idx) => {
    ctx.globalAlpha = idx === 0 ? 0.62 : 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, r * p, 0, TAU);
    ctx.stroke();
  });

  ctx.globalAlpha = 0.46;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const r1 = 16.1 * p;
    const r2 = (i % 6 === 0 ? 17.4 : 16.7) * p;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 12.9 * p, Math.sin(a) * 12.9 * p);
    ctx.lineTo(Math.cos(a) * 19.1 * p, Math.sin(a) * 19.1 * p);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.38;
  ctx.font = '17px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const r = 18.15 * p;
    ctx.save();
    ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(i < 10 ? '0' + i : String(i), 0, 0);
    ctx.restore();
  }

  ctx.globalAlpha = 0.45;
  ctx.font = '600 24px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.save();
  ctx.rotate(-0.32);
  ctx.fillText('CORE ISOLATION DECK', -7.4 * p, 13.3 * p);
  ctx.restore();
  ctx.save();
  ctx.rotate(0.32);
  ctx.fillText('UNIT 07 / NO STEP', -7.2 * p, -13.7 * p);
  ctx.restore();

  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(193,174,116,.7)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 20.5 * p, (i / 6) * TAU + 0.055, (i / 6) * TAU + 0.32);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = makeCanvasTexture(c);
  return tex;
}

function buildRingMarkingTexture() {
  const size = 2048;
  const span = 23.2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const p = size / span;
  const cx = size / 2;

  ctx.translate(cx, cx);
  ctx.strokeStyle = 'rgba(220,213,184,.5)';
  ctx.fillStyle = 'rgba(220,213,184,.55)';
  ctx.lineWidth = 1.6;

  [8.12, 8.45, 9.08, 9.58].forEach((r, idx) => {
    ctx.globalAlpha = idx === 0 ? 0.42 : 0.32;
    ctx.beginPath();
    ctx.arc(0, 0, r * p, 0, TAU);
    ctx.stroke();
  });

  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU;
    const major = i % 10 === 0;
    const mid = i % 5 === 0;
    const r1 = 9.02 * p;
    const r2 = (major ? 9.61 : mid ? 9.35 : 9.19) * p;
    ctx.globalAlpha = major ? 0.55 : mid ? 0.36 : 0.22;
    ctx.lineWidth = major ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.font = '16px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const r = 8.66 * p;
    ctx.save();
    ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.globalAlpha = 0.4;
    ctx.fillText(String(i * 30).padStart(3, '0'), 0, 0);
    ctx.restore();
  }

  ctx.globalAlpha = 0.28;
  ctx.font = '600 17px Consolas, monospace';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    ctx.save();
    ctx.translate(Math.cos(a) * 8.72 * p, Math.sin(a) * 8.72 * p);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText('CONTROL ROD DRIVE', 0, 0);
    ctx.restore();
  }

  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  ctx.arc(0, 0, 9.67 * p, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  return makeCanvasTexture(c);
}

function buildPlaqueTexture(lines, small) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 192;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 768, 192);

  ctx.fillStyle = 'rgba(23,28,23,.92)';
  ctx.fillRect(10, 10, 748, 172);
  ctx.strokeStyle = 'rgba(205,196,158,.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 748, 172);

  ctx.fillStyle = 'rgba(226,220,195,.78)';
  ctx.font = '600 44px Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(lines[0], 40, 82);
  ctx.fillStyle = 'rgba(202,195,166,.44)';
  ctx.font = '19px Consolas, monospace';
  ctx.fillText(lines[1], 42, 124);

  ctx.fillStyle = 'rgba(205,179,106,.7)';
  ctx.fillRect(612, 48, 96, 4);
  ctx.fillRect(664, 64, 44, 4);
  ctx.beginPath();
  ctx.arc(706, 106, 19, 0, TAU);
  ctx.strokeStyle = 'rgba(205,179,106,.55)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(205,179,106,.62)';
  ctx.font = '16px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('07', 706, 112);

  return makeCanvasTexture(c);
}

function makeAnnulusGeometry(inner, outer, depth, bevel) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, TAU, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 128,
    steps: 1
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xd9e2cd, 0x080b08, 0.26));

  const key = new THREE.DirectionalLight(0xfff2d5, 1.12);
  key.position.set(-9, 21, 11);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.028;
  key.shadow.radius = 2.5;
  scene.add(key);
  scene.add(key.target);
  worldRefs.keyLight = key;

  const fill = new THREE.DirectionalLight(0x8eae9e, 0.28);
  fill.position.set(14, 9, -13);
  scene.add(fill);

  const lowWarm = new THREE.PointLight(0xff7445, 0.38, 20, 2);
  lowWarm.position.set(-5.5, 0.7, 4.6);
  scene.add(lowWarm);

  const lowCool = new THREE.PointLight(0x7e9b86, 0.24, 18, 2);
  lowCool.position.set(6.5, 1.2, -4.2);
  scene.add(lowCool);

  const center = new THREE.PointLight(0xffc47b, 0.45, 17, 2);
  center.position.set(0, 2.2, 0);
  scene.add(center);
  worldRefs.centerLight = center;

  const rim = new THREE.PointLight(0xe4ce94, 0.28, 18, 2);
  rim.position.set(0, 1.5, -8.6);
  scene.add(rim);

  const overhead = new THREE.PointLight(0xfff1d5, 0.3, 28, 2);
  overhead.position.set(0, 10, 2);
  scene.add(overhead);
}

function buildStage() {
  const floorTex = buildFloorTexture();
  textureCache.floor = floorTex;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex,
    roughness: 0.82,
    metalness: 0.25,
    envMapIntensity: 0.22
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.7;
  floor.receiveShadow = true;
  scene.add(floor);
  worldRefs.floor = floor;

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x111611,
    roughness: 0.54,
    metalness: 0.62,
    envMapIntensity: 0.32
  });
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(18.2, 18.5, 0.32, 128), deckMat);
  stage.position.y = -1.53;
  stage.receiveShadow = true;
  stage.castShadow = true;
  scene.add(stage);
  worldRefs.stage = stage;

  const markings = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshBasicMaterial({
      map: buildDeckMarkings(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
      color: 0xd4cba7,
      blending: THREE.AdditiveBlending
    })
  );
  markings.rotation.x = -Math.PI / 2;
  markings.position.y = -1.35;
  markings.renderOrder = 1;
  scene.add(markings);

  // outer deck segments and service rail
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x171d18,
    roughness: 0.42,
    metalness: 0.8,
    envMapIntensity: 0.5
  });
  const rail = new THREE.Mesh(new THREE.TorusGeometry(12.8, 0.045, 6, 160), railMat);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = -1.29;
  scene.add(rail);

  const rail2 = new THREE.Mesh(new THREE.TorusGeometry(15.25, 0.03, 5, 160), railMat);
  rail2.rotation.x = Math.PI / 2;
  rail2.position.y = -1.29;
  scene.add(rail2);

  // distant reactor hall wall, deliberately swallowed by fog
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0b100c,
    roughness: 0.8,
    metalness: 0.35,
    side: THREE.BackSide,
    envMapIntensity: 0.2
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(29, 29, 20, 96, 1, true), wallMat);
  wall.position.y = 6;
  scene.add(wall);
  worldRefs.backdrop = wall;

  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x151b16,
    roughness: 0.55,
    metalness: 0.65
  });
  const ribGeo = new THREE.BoxGeometry(0.42, 16, 0.9);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const r = 28.6;
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(Math.cos(a) * r, 4.2, Math.sin(a) * r);
    rib.rotation.y = -a;
    scene.add(rib);
  }

  const farLampMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(96, 'rgba(255,240,204,1)', 'rgba(255,240,204,0)'),
    color: 0xd7c28f,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.16;
    const lamp = new THREE.Sprite(farLampMat.clone());
    lamp.material.opacity = 0.2 + (i % 3) * 0.06;
    lamp.position.set(Math.cos(a) * 28.3, 2.4 + (i % 4) * 0.7, Math.sin(a) * 28.3);
    lamp.scale.set(1.5, 1.5, 1.5);
    scene.add(lamp);
  }
}

function buildVessel() {
  const core = new THREE.Group();
  core.position.y = 0;
  scene.add(core);
  world.coreGroup = core;

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x131713,
    roughness: 0.5,
    metalness: 0.76,
    envMapIntensity: 0.16
  });
  const darker = new THREE.MeshStandardMaterial({
    color: 0x080b08,
    roughness: 0.54,
    metalness: 0.68,
    envMapIntensity: 0.12
  });
  const blackMetal = new THREE.MeshStandardMaterial({
    color: 0x050705,
    roughness: 0.66,
    metalness: 0.56,
    envMapIntensity: 0.08
  });
  const innerMetal = new THREE.MeshStandardMaterial({
    color: 0x1b201a,
    roughness: 0.58,
    metalness: 0.66,
    envMapIntensity: 0.14
  });

  // massive lower body
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(9.88, 10.16, 1.42, 128), darker);
  lower.position.y = -0.7;
  lower.castShadow = true;
  lower.receiveShadow = true;
  core.add(lower);

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(10.16, 10.33, 0.34, 128), blackMetal);
  skirt.position.y = -1.38;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  core.add(skirt);

  // wide machined rim
  const rim = new THREE.Mesh(makeAnnulusGeometry(7.66, 9.82, 0.58, 0.04), darkMetal);
  rim.position.y = 0.16;
  rim.castShadow = true;
  rim.receiveShadow = true;
  core.add(rim);

  const rimTop = new THREE.Mesh(makeAnnulusGeometry(7.87, 9.73, 0.055, 0.012), innerMetal);
  rimTop.position.y = 0.735;
  rimTop.receiveShadow = true;
  core.add(rimTop);

  // inner well
  const wellWall = new THREE.Mesh(new THREE.CylinderGeometry(7.7, 7.92, 0.72, 128, 1, true), blackMetal);
  wellWall.position.y = 0.18;
  wellWall.receiveShadow = true;
  core.add(wellWall);

  const wellFloor = new THREE.Mesh(new THREE.CylinderGeometry(7.98, 7.88, 0.38, 128), darker);
  wellFloor.position.y = 0.01;
  wellFloor.receiveShadow = true;
  core.add(wellFloor);

  const arrayBed = new THREE.Mesh(new THREE.CylinderGeometry(7.54, 7.78, 0.26, 128), blackMetal);
  arrayBed.position.y = 0.12;
  arrayBed.receiveShadow = true;
  core.add(arrayBed);

  const ledge = new THREE.Mesh(makeAnnulusGeometry(7.54, 7.75, 0.055, 0.01), innerMetal);
  ledge.position.y = 0.225;
  ledge.receiveShadow = true;
  core.add(ledge);

  // concentric machining grooves
  const grooveMat = new THREE.MeshStandardMaterial({
    color: 0x111611,
    roughness: 0.66,
    metalness: 0.55
  });
  [
    [8.06, 0.032],
    [8.46, 0.022],
    [9.02, 0.028],
    [9.46, 0.022]
  ].forEach(([r, tube]) => {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 5, 180), grooveMat);
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.756;
    core.add(groove);
  });

  const lipMat = new THREE.MeshStandardMaterial({
    color: 0x565b4e,
    roughness: 0.3,
    metalness: 0.9,
    envMapIntensity: 0.75
  });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(9.79, 0.058, 8, 200), lipMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.73;
  lip.castShadow = true;
  core.add(lip);

  const innerLip = new THREE.Mesh(new THREE.TorusGeometry(7.72, 0.055, 8, 160), lipMat);
  innerLip.rotation.x = Math.PI / 2;
  innerLip.position.y = 0.7;
  core.add(innerLip);

  // top engraved calibration ring
  const ringMarks = new THREE.Mesh(
    new THREE.PlaneGeometry(23.2, 23.2),
    new THREE.MeshBasicMaterial({
      map: buildRingMarkingTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
      color: 0xd8d0b3,
      blending: THREE.AdditiveBlending
    })
  );
  ringMarks.rotation.x = -Math.PI / 2;
  ringMarks.position.y = 0.747;
  ringMarks.renderOrder = 2;
  core.add(ringMarks);

  // plaques
  const plaqueMat = new THREE.MeshBasicMaterial({
    map: buildPlaqueTexture(['CORE // 07', 'CONTROL ROD ARRAY · UNIT 04']),
    transparent: true,
    depthWrite: false,
    opacity: 0.92
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 0.71), plaqueMat);
  plaque.rotation.x = -Math.PI / 2;
  plaque.position.set(0, 0.754, 8.78);
  plaque.renderOrder = 3;
  core.add(plaque);

  // bolts around the pressure ring
  const boltCount = 64;
  const boltGeo = new THREE.CylinderGeometry(0.078, 0.084, 0.075, 6);
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0xa79d7f,
    roughness: 0.42,
    metalness: 0.72,
    emissive: 0x2b2412,
    emissiveIntensity: 0.12
  });
  const bolts = new THREE.InstancedMesh(boltGeo, boltMat, boltCount);
  bolts.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < boltCount; i++) {
    const a = (i / boltCount) * TAU + 0.02;
    const r = 9.12;
    pos.set(Math.cos(a) * r, 0.785, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash11(i) * TAU);
    m.compose(pos, q, scl);
    bolts.setMatrixAt(i, m);
  }
  bolts.instanceMatrix.needsUpdate = true;
  core.add(bolts);

  const amberCount = 16;
  const amberGeo = new THREE.BoxGeometry(0.082, 0.022, 0.082);
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xd8ca8f });
  const amberBulbs = new THREE.InstancedMesh(amberGeo, amberMat, amberCount);
  for (let i = 0; i < amberCount; i++) {
    const a = (i / amberCount) * TAU + 0.09;
    const r = 8.91;
    pos.set(Math.cos(a) * r, 0.766, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    m.compose(pos, q, scl);
    amberBulbs.setMatrixAt(i, m);
  }
  amberBulbs.instanceMatrix.needsUpdate = true;
  core.add(amberBulbs);
  world.amberBulbs = amberBulbs;

  // glowing warning lamps and their halo sprites
  const glowTex = makeGlowTexture(128, 'rgba(255,236,177,1)', 'rgba(255,210,110,0)');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.09;
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xf0d28a,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(Math.cos(a) * 8.91, 0.86, Math.sin(a) * 8.91);
    sprite.scale.set(0.86, 0.86, 0.86);
    core.add(sprite);
    world.glowMats.push(mat);
  }

  // 8 heavy clamps, evenly distributed around the rim
  const clampMat = new THREE.MeshStandardMaterial({
    color: 0x1c211c,
    roughness: 0.4,
    metalness: 0.8,
    envMapIntensity: 0.35
  });
  const clampTopMat = new THREE.MeshStandardMaterial({
    color: 0x454b40,
    roughness: 0.32,
    metalness: 0.86,
    envMapIntensity: 0.55
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * 9.44, 0.83, Math.sin(a) * 9.44);
    g.rotation.y = -a;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.18, 0.82), clampMat);
    base.castShadow = true;
    g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.62), clampTopMat);
    top.position.y = 0.13;
    top.castShadow = true;
    g.add(top);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x9d8d5c, transparent: true, opacity: 0.55 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.14), stripeMat);
    stripe.position.set(-0.18, 0.178, 0.18);
    g.add(stripe);
    core.add(g);
  }

  // radial service arms on the deck
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const arm = new THREE.Group();
    arm.position.set(Math.cos(a) * 11.9, -1.23, Math.sin(a) * 11.9);
    arm.rotation.y = -a;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.12, 1.35),
      new THREE.MeshStandardMaterial({ color: 0x1a201a, roughness: 0.5, metalness: 0.67 })
    );
    plate.receiveShadow = true;
    plate.castShadow = true;
    arm.add(plate);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2.85, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x4d5347, roughness: 0.35, metalness: 0.8 })
    );
    rail.position.y = 0.11;
    arm.add(rail);
    core.add(arm);
  }

  // core glow seen through the gaps
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 512;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, 'rgba(255,191,112,.34)');
  grad.addColorStop(0.32, 'rgba(225,112,57,.18)');
  grad.addColorStop(0.7, 'rgba(122,67,35,.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 512, 512);
  const glowTex2 = new THREE.CanvasTexture(glowCanvas);
  glowTex2.encoding = THREE.sRGBEncoding;
  const coreGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(15.2, 15.2),
    new THREE.MeshBasicMaterial({
      map: glowTex2,
      transparent: true,
      depthWrite: false,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      color: 0xffb577
    })
  );
  coreGlow.rotation.x = -Math.PI / 2;
  coreGlow.position.y = 0.255;
  coreGlow.renderOrder = 4;
  core.add(coreGlow);
  world.coreGlow = coreGlow;

  const haloMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(256, 'rgba(255,220,166,.9)', 'rgba(255,181,94,0)'),
    color: 0xffc98c,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.y = 1.7;
  halo.scale.set(18, 18, 18);
  core.add(halo);
  world.coreHalo = halo;

  // thin glowing seam at the rim
  world.ringLineMat = new THREE.MeshBasicMaterial({
    color: 0xc6b279,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const seam = new THREE.Mesh(new THREE.TorusGeometry(8.07, 0.018, 5, 180), world.ringLineMat);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 0.69;
  core.add(seam);
}

function buildRodGeometry() {
  const bodyShape = roundedRectShape(0.398, 0.398, 0.022);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 3.15,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.007,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1
  });
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.translate(0, -3.15, 0);

  const capShape = roundedRectShape(0.374, 0.374, 0.018);
  const capGeo = new THREE.ExtrudeGeometry(capShape, {
    depth: 0.044,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1
  });
  capGeo.rotateX(-Math.PI / 2);
  capGeo.translate(0, -0.01, 0);

  const dotGeo = new THREE.BoxGeometry(0.134, 0.013, 0.134);
  dotGeo.translate(0, 0.038, 0);

  return { bodyGeo, capGeo, dotGeo };
}

function buildRodMatrix() {
  const N = 37;
  const pitch = 0.42;
  const R = 7.54;
  const rods = [];

  for (let iz = -Math.floor(N / 2); iz <= Math.floor(N / 2); iz++) {
    for (let ix = -Math.floor(N / 2); ix <= Math.floor(N / 2); ix++) {
      const x = ix * pitch;
      const z = iz * pitch;
      const r = Math.hypot(x, z);
      const edgeNoise = hash21(ix * 0.77 + 2.1, iz * 0.61 - 4.2);
      if (r > R - edgeNoise * 0.17) continue;
      if (r > R * 0.84 && edgeNoise > 0.975) continue;

      const n = Math.sin(x * 0.57 + 1.2) * 0.32
        + Math.sin(z * 0.71 - 0.7) * 0.26
        + Math.sin((x + z) * 0.3 + 2.4) * 0.17
        + Math.sin((x - z) * 0.95) * 0.08
        + hash21(ix * 1.31 + 9.2, iz * 1.17 - 2.6) * 0.55;

      let pal = 0;
      if (n > 0.78) pal = 1;
      else if (n > 0.63) pal = 2;
      else if (n > 0.25) pal = 3;
      else if (n < -0.43) pal = 4;
      else pal = 0;

      const angle = Math.atan2(z, x);
      const drive = 0.42 + hash21(ix * 2.3 - 7.1, iz * 3.7 + 8.9) * 0.7;
      const phase = hash21(ix * 5.7 + 1.3, iz * 2.9 - 3.8) * TAU;
      const rest = 0.405 + (hash11(ix * 9.1 + iz * 3.3) - 0.5) * 0.018;

      rods.push({
        x,
        z,
        r,
        angle,
        radial: r / R,
        palette: pal,
        drive,
        phase,
        rest,
        elev: 0,
        rot: (hash11(ix * 4.8 - iz * 2.2) - 0.5) * 0.02,
        accent: hash21(ix * 8.2 + 3.4, iz * 6.1 - 1.7) > 0.952,
        groupIndex: 0,
        groupRodIndex: 0,
        dotGroup: 0,
        dotIndex: 0
      });
    }
  }

  world.rods = rods;
  world.rodCount = rods.length;
  const { bodyGeo, capGeo, dotGeo } = buildRodGeometry();

  const groups = PALETTE.map((p) => ({
    palette: p,
    rods: [],
    body: null,
    cap: null,
    bodyArr: null,
    capArr: null
  }));

  rods.forEach((rod) => {
    rod.groupIndex = rod.palette;
    rod.groupRodIndex = groups[rod.palette].rods.length;
    groups[rod.palette].rods.push(rod);
  });

  groups.forEach((group) => {
    if (!group.rods.length) return;
    const p = group.palette;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: p.body,
      roughness: 0.72,
      metalness: 0.12,
      envMapIntensity: 0.3
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: p.cap,
      roughness: 0.56,
      metalness: 0.12,
      envMapIntensity: 0.38
    });

    const body = new THREE.InstancedMesh(bodyGeo, bodyMat, group.rods.length);
    const cap = new THREE.InstancedMesh(capGeo, capMat, group.rods.length);
    body.castShadow = true;
    body.receiveShadow = true;
    cap.castShadow = false;
    cap.receiveShadow = true;
    body.frustumCulled = false;
    cap.frustumCulled = false;
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cap.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    group.body = body;
    group.cap = cap;
    group.bodyArr = body.instanceMatrix.array;
    group.capArr = cap.instanceMatrix.array;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    group.rods.forEach((rod, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rod.rot);
      pos.set(rod.x, rod.rest, rod.z);
      m.compose(pos, q, scl);
      body.setMatrixAt(i, m);
      cap.setMatrixAt(i, m);
    });
    body.instanceMatrix.needsUpdate = true;
    cap.instanceMatrix.needsUpdate = true;
    world.coreGroup.add(body);
    world.coreGroup.add(cap);
    world.rodGroups.push(group);
  });

  // sockets: fixed dark wells under every control rod
  const socketGeo = new THREE.BoxGeometry(0.419, 0.13, 0.419);
  const socketMat = new THREE.MeshStandardMaterial({
    color: 0x050705,
    roughness: 0.9,
    metalness: 0.2,
    envMapIntensity: 0.04
  });
  const sockets = new THREE.InstancedMesh(socketGeo, socketMat, rods.length);
  sockets.receiveShadow = true;
  sockets.frustumCulled = false;
  const m2 = new THREE.Matrix4();
  const q2 = new THREE.Quaternion();
  const p2 = new THREE.Vector3();
  const s2 = new THREE.Vector3(1, 1, 1);
  rods.forEach((rod, i) => {
    q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rod.rot);
    p2.set(rod.x, 0.185, rod.z);
    m2.compose(p2, q2, s2);
    sockets.setMatrixAt(i, m2);
  });
  sockets.instanceMatrix.needsUpdate = true;
  world.coreGroup.add(sockets);
  world.socketMesh = sockets;

  // central indicator dots are split in two groups so a few can glow amber
  const normalRods = rods.filter((r) => !r.accent);
  const accentRods = rods.filter((r) => r.accent);
  const dotMat = new THREE.MeshStandardMaterial({
    color: 0xe8e1c5,
    roughness: 0.44,
    metalness: 0.04,
    emissive: 0x6e674d,
    emissiveIntensity: 0.08
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf0d493,
    roughness: 0.3,
    metalness: 0.08,
    emissive: 0xb68b37,
    emissiveIntensity: 0.36
  });
  world.dotMat = dotMat;
  world.accentDotMat = accentMat;

  function makeDots(list, material, tag) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(dotGeo, material, list.length);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const arr = mesh.instanceMatrix.array;
    const q3 = new THREE.Quaternion();
    const p3 = new THREE.Vector3();
    const s3 = new THREE.Vector3(1, 1, 1);
    const m3 = new THREE.Matrix4();
    list.forEach((rod, i) => {
      rod.dotGroup = tag;
      rod.dotIndex = i;
      q3.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rod.rot);
      p3.set(rod.x, rod.rest, rod.z);
      m3.compose(p3, q3, s3);
      mesh.setMatrixAt(i, m3);
    });
    mesh.instanceMatrix.needsUpdate = true;
    world.coreGroup.add(mesh);
    return { mesh, arr, rods: list };
  }

  world.dotMesh = makeDots(normalRods, dotMat, 0);
  world.accentDots = makeDots(accentRods, accentMat, 1);
}

function buildAtmosphere() {
  // suspended dust
  const dustCount = 380;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const a = Math.random() * TAU;
    const r = 4 + Math.pow(Math.random(), 0.7) * 24;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = -1.1 + Math.random() * 9.5;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xc9c3a8,
    size: 0.036,
    map: makeSoftDiscTexture(64),
    transparent: true,
    opacity: 0.33,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  world.dust = dust;

  // embers rising from the core, only visible when the core is excited
  const emberCount = 96;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(emberCount * 3);
  const emberColor = new Float32Array(emberCount * 3);
  const data = [];
  const baseColor = new THREE.Color(0xf2bd80);
  for (let i = 0; i < emberCount; i++) {
    const a = Math.random() * TAU;
    const r = Math.sqrt(Math.random()) * 6.7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    emberPos[i * 3] = x;
    emberPos[i * 3 + 1] = 0.3 + Math.random() * 1.4;
    emberPos[i * 3 + 2] = z;
    const c = baseColor.clone().offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.1);
    emberColor[i * 3] = c.r;
    emberColor[i * 3 + 1] = c.g;
    emberColor[i * 3 + 2] = c.b;
    data.push({
      x,
      z,
      y: emberPos[i * 3 + 1],
      speed: 0.18 + Math.random() * 0.42,
      phase: Math.random() * TAU,
      radius: r
    });
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('color', new THREE.BufferAttribute(emberColor, 3));
  const emberMat = new THREE.PointsMaterial({
    color: 0xffc389,
    size: 0.055,
    map: makeSoftDiscTexture(64),
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    sizeAttenuation: true
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  scene.add(embers);
  world.embers = embers;
  world.emberData = data;
}

function buildWorld() {
  buildEnvironment();
  buildLights();
  buildStage();
  buildVessel();
  buildRodMatrix();
  buildAtmosphere();
  dom.rodCount.textContent = String(world.rodCount);
}
