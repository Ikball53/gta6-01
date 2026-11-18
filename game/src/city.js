// Solmar City: sunset coastal grid city for SOLMAR HEAT.
// Roads, buildings, shops, parks, beach, metro loop, palms and lights.
// Everything is procedural boxes + canvas textures, no external assets.
import * as THREE from 'three';

export const GRID = [-120, -80, -40, 0, 40, 80, 120];
export const BOUND = 168;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function facadeTexture(base, litRatio, rng) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < 8; y++) g.fillRect(0, y * 32 + 30, w, 2);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 5; x++) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? '#ffd27a' : '#2a2f45';
        if (lit) { g.shadowColor = '#ffb347'; g.shadowBlur = 6; } else g.shadowBlur = 0;
        g.fillRect(10 + x * 23, 8 + y * 31, 14, 18);
        g.shadowBlur = 0;
      }
    }
  });
}

function signTexture(text, bg, fg, sub) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = 'bold 52px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, sub ? h / 2 - 14 : h / 2);
    if (sub) { g.font = 'bold 26px Arial'; g.fillText(sub, w / 2, h / 2 + 34); }
  });
}

export function buildCity(W) {
  const { scene } = W;
  const rng = mulberry(W.seed || 1337);
  const city = {
    colliders: [], lights: [], train: null, trainT: 0, trainWait: 0,
    phase: 0, phaseT: 0, lamps: [], spots: {},
  };
  W.city = city;
  const add = (mesh) => { scene.add(mesh); return mesh; };
  const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
  const box = (w, h, d, color, x, y, z, opts) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts?.material || mat(color));
    m.position.set(x, y, z);
    if (opts?.ry) m.rotation.y = opts.ry;
    m.castShadow = opts?.cast !== false; m.receiveShadow = true;
    if (opts?.collide) city.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return add(m);
  };

  // --- sky dome: orange horizon melting into purple dusk ---
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3a2a6e) },
      mid: { value: new THREE.Color(0xc65d8a) },
      low: { value: new THREE.Color(0xff9a3d) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.75, h)) : mix(low, mid, smoothstep(-0.05, 0.22, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  add(new THREE.Mesh(skyGeo, skyMat));
  // low sun disc over the ocean
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
  sun.position.set(560, 58, -120); sun.lookAt(0, 40, 0);
  add(sun);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.28, fog: false }));
  sunGlow.position.set(565, 58, -120); sunGlow.lookAt(0, 40, 0);
  add(sunGlow);

  // --- ground, sand, ocean ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), mat(0x5d7a4a));
  ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.05, 0); ground.receiveShadow = true;
  add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 380), mat(0xe8c98a));
  sand.rotation.x = -Math.PI / 2; sand.position.set(180, 0.0, 0); sand.receiveShadow = true;
  add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(260, 560),
    new THREE.MeshLambertMaterial({ color: 0x2a6f8f, transparent: true, opacity: 0.94 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(330, -0.4, 0);
  add(ocean);
  // boardwalk strip along the beach
  box(8, 0.3, 360, 0xb98d5f, 148, 0.1, 0, { cast: false });

  // --- roads + sidewalks ---
  // Two texture orientations: x-roads run along u, z-roads along v.
  const roadTexX = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#454550'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5c542'; g.fillRect(0, h / 2 - 2, w, 4);
    g.fillStyle = '#e8e8e8';
    for (let x = 0; x < w; x += 32) { g.fillRect(x, 14, 18, 3); g.fillRect(x, h - 17, 18, 3); }
  });
  const roadTexZ = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#454550'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5c542'; g.fillRect(w / 2 - 2, 0, 4, h);
    g.fillStyle = '#e8e8e8';
    for (let y = 0; y < h; y += 32) { g.fillRect(14, y, 3, 18); g.fillRect(w - 17, y, 3, 18); }
  });
  roadTexX.wrapS = roadTexX.wrapT = THREE.RepeatWrapping;
  roadTexZ.wrapS = roadTexZ.wrapT = THREE.RepeatWrapping;
  const walkMat = mat(0x9a938a);
  for (const g of GRID) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(340, 10),
      new THREE.MeshLambertMaterial({ map: roadTexX.clone() }));
    rx.material.map.needsUpdate = true;
    rx.material.map.repeat.set(12, 1);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.06, g); rx.receiveShadow = true; add(rx);
    // north-south road: bake the flat rotation into the geometry so the
    // 340-unit axis lies along Z (a mesh rotation.z would swing it east-west)
    const rzGeo = new THREE.PlaneGeometry(10, 340);
    rzGeo.rotateX(-Math.PI / 2);
    const rz = new THREE.Mesh(rzGeo,
      new THREE.MeshLambertMaterial({ map: roadTexZ.clone() }));
    rz.material.map.needsUpdate = true;
    rz.material.map.repeat.set(1, 12); // tile along the length (v), once across
    rz.position.set(g, 0.06, 0); rz.receiveShadow = true; add(rz);
    const wx = new THREE.Mesh(new THREE.PlaneGeometry(340, 16), walkMat);
    wx.rotation.x = -Math.PI / 2; wx.position.set(0, 0.03, g); wx.receiveShadow = true; add(wx);
    const wz = new THREE.Mesh(new THREE.PlaneGeometry(16, 340), walkMat);
    wz.rotation.x = -Math.PI / 2; wz.position.set(g, 0.03, 0); wz.receiveShadow = true; add(wz);
  }
  // crosswalks at the big downtown crossings
  const crossTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#33333d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2f2f2';
    for (let i = 0; i < 6; i++) g.fillRect(8 + i * 20, 10, 10, h - 20);
  });
  for (const [cx, cz] of [[0, 0], [0, 40], [40, 0], [-40, 0], [0, -40], [40, 40], [-40, -40]]) {
    const cw = new THREE.Mesh(new THREE.PlaneGeometry(15, 15),
      new THREE.MeshLambertMaterial({ map: crossTex }));
    cw.rotation.x = -Math.PI / 2; cw.position.set(cx, 0.08, cz); cw.receiveShadow = true; add(cw);
  }

  // --- buildings, block by block ---
  const facades = [
    facadeTexture('#c98a5a', 0.45, rng),
    facadeTexture('#8a6f9e', 0.4, rng),
    facadeTexture('#5a7a8a', 0.5, rng),
    facadeTexture('#b05a5a', 0.35, rng),
    facadeTexture('#7a8a5a', 0.4, rng),
  ];
  const houseColors = [0xe8d8b0, 0xd8a0a0, 0xa0c8d8, 0xf0e0c0, 0xc8b8e8];
  const blockC = [-100, -60, -20, 20, 60, 100];
  const parks = new Set(['-60,60', '60,-100']);
  const isDowntown = (x, z) => Math.abs(x) <= 40 && Math.abs(z) <= 40;
  for (const bx of blockC) {
    for (const bz of blockC) {
      const key = `${bx},${bz}`;
      if (parks.has(key)) continue;
      if (bx === -100 && bz === 100) continue; // player house block, built below
      const downtown = isDowntown(bx, bz);
      const n = downtown ? 3 + Math.floor(rng() * 2) : (rng() < 0.45 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const ox = (rng() - 0.5) * 20, oz = (rng() - 0.5) * 20;
        const x = bx + ox, z = bz + oz;
        if (downtown) {
          const w = 12 + rng() * 8, d = 12 + rng() * 8, h = 14 + rng() * 26;
          const tex = facades[Math.floor(rng() * facades.length)];
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
            new THREE.MeshLambertMaterial({ map: tex, emissive: 0x332211, emissiveMap: tex, emissiveIntensity: 0.55 }));
          m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; add(m);
          box(w * 0.5, 2, d * 0.5, 0x444455, x, h + 1, z);
          city.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
        } else if (rng() < 0.5) {
          // house with pitched roof + yard fence
          const w = 9 + rng() * 3, d = 8 + rng() * 3, h = 4.5 + rng() * 1.5;
          const col = houseColors[Math.floor(rng() * houseColors.length)];
          box(w, h, d, col, x, h / 2, z, { collide: true });
          const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.6, 4), mat(0x8a4a3a));
          roof.position.set(x, h + 1.3, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; add(roof);
          // fence + a palm in the yard
          box(w + 6, 0.9, 0.3, 0xf0e8d8, x, 0.45, z + d / 2 + 3, { cast: false });
        } else {
          // low shop block
          const w = 14 + rng() * 6, d = 10 + rng() * 4, h = 6 + rng() * 2;
          const tex = facades[Math.floor(rng() * facades.length)];
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
            new THREE.MeshLambertMaterial({ map: tex, emissive: 0x332211, emissiveMap: tex, emissiveIntensity: 0.5 }));
          m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; add(m);
          city.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
        }
      }
    }
  }

  // --- named shops (sign planes on shopfronts) ---
  const shops = [
    { name: "Rosa's Diner", sub: 'OPEN 24 HRS', bg: '#7a1f2b', fg: '#ffd27a', x: -20, z: 14, ry: 0 },
    { name: 'Taco Sol', sub: 'TACOS • BURRITOS', bg: '#c96a1e', fg: '#fff2cc', x: 40, z: -6, ry: Math.PI },
    { name: 'Bay Burger', sub: 'FAST. HOT. LOUD.', bg: '#1e5a8a', fg: '#ffe066', x: 20, z: -46, ry: 0 },
    { name: 'Cafe Alba', sub: 'COFFEE • PASTRY', bg: '#3a6b4a', fg: '#f0e8d8', x: -40, z: 46, ry: Math.PI },
    { name: 'Solmar PD', sub: 'CENTRAL STATION', bg: '#223a6b', fg: '#cfe0ff', x: 60, z: -54, ry: 0 },
    { name: 'Solmar General', sub: 'HOSPITAL', bg: '#f0f0e8', fg: '#c02030', x: -60, z: 54, ry: Math.PI },
    { name: 'Solmar Bank', sub: 'VAULT • LOANS', bg: '#8a7a3a', fg: '#fff8d8', x: 20, z: 46, ry: Math.PI },
    { name: 'METRO', sub: 'SOLMAR LOOP', bg: '#22222e', fg: '#7ae0ff', x: 66, z: 0, ry: -Math.PI / 2 },
  ];
  for (const s of shops) {
    const tex = signTexture(s.name, s.bg, s.fg, s.sub);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.2),
      new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(s.x, 5.4, s.z); sign.rotation.y = s.ry; add(sign);
    // awning stripe under the sign
    box(13, 0.4, 1.6, 0xc96a3a, s.x, 3.4, s.z + (s.ry === 0 ? 0.8 : s.ry === Math.PI ? -0.8 : 0), { cast: false });
  }
  // landmark buildings for the named spots (so the signs sit on real walls)
  const landmark = (w, h, d, color, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; add(m);
    city.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  };
  landmark(16, 7, 12, 0x8a2a30, -20, 20);          // Rosa's Diner
  landmark(16, 8, 12, 0x2a4a6b, 60, -60);          // PD Central
  landmark(20, 10, 14, 0xf0f0e8, -60, 60);         // Hospital
  landmark(14, 9, 12, 0xc8b060, 20, 40);           // Bank
  city.spots = {
    diner: new THREE.Vector3(-20, 0, 8),
    pd: new THREE.Vector3(60, 0, -48),
    hospital: new THREE.Vector3(-60, 0, 48),
    bank: new THREE.Vector3(20, 0, 34),
    house: new THREE.Vector3(-100, 0, 100),
    market: new THREE.Vector3(40, 0, 40),
    hideout: new THREE.Vector3(-100, 0, -100),
    beach: new THREE.Vector3(150, 0, 0),
    metroEast: new THREE.Vector3(66, 0, 0),
    metroWest: new THREE.Vector3(-66, 0, 0),
  };

  // --- player's house + yard (spawn) ---
  box(10, 5, 9, 0xe8d8b0, -100, 2.5, 106, { collide: true });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3, 4), mat(0x8a4a3a));
  roof.position.set(-100, 6.5, 106); roof.rotation.y = Math.PI / 4; roof.castShadow = true; add(roof);
  box(16, 0.9, 0.3, 0xf0e8d8, -100, 0.45, 96, { cast: false });
  box(0.3, 0.9, 14, 0xf0e8d8, -108, 0.45, 103, { cast: false });
  box(0.3, 0.9, 14, 0xf0e8d8, -92, 0.45, 103, { cast: false });

  // --- parks with ponds ---
  for (const [px, pz] of [[-60, 60], [60, -100]]) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), mat(0x4a7a3a));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(px, 0.04, pz); lawn.receiveShadow = true; add(lawn);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(6, 24), mat(0x3a8ab0));
    pond.rotation.x = -Math.PI / 2; pond.position.set(px + 6, 0.07, pz + 4); add(pond);
    box(8, 0.8, 1.2, 0x8a6a4a, px - 8, 0.4, pz - 8, { cast: false });
    box(8, 0.8, 1.2, 0x8a6a4a, px + 8, 0.4, pz - 10, { cast: false });
  }

  // --- palms (instanced trunks + canopies) ---
  const palmSpots = [];
  for (let i = 0; i < 26; i++) palmSpots.push([142 + rng() * 8, -170 + i * 13.5 + rng() * 4]);
  for (const g of GRID) for (let i = 0; i < 4; i++) palmSpots.push([g + 9, -120 + i * 70 + rng() * 10]);
  for (const [px, pz] of [[-60, 60], [60, -100]]) for (let i = 0; i < 6; i++) palmSpots.push([px - 12 + rng() * 24, pz - 12 + rng() * 24]);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const trunkMat = mat(0x7a5a3a);
  const canopyGeo = new THREE.ConeGeometry(2.6, 2.2, 7);
  const canopyMat = mat(0x2a7a3a);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmSpots.length);
  trunks.castShadow = true; canopies.castShadow = true;
  const dummy = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3, z); dummy.rotation.set(0, rng() * Math.PI, (rng() - 0.5) * 0.14);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.6, z); dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.updateMatrix(); canopies.setMatrixAt(i, dummy.matrix);
  });
  add(trunks); add(canopies);

  // --- street lamps (instanced poles + glowing heads) ---
  const lampSpots = [];
  for (const g of GRID) for (let i = -2; i <= 2; i++) lampSpots.push([g + 7.5, i * 60 + 20]);
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6);
  const poles = new THREE.InstancedMesh(poleGeo, mat(0x222228), lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo,
    new THREE.MeshLambertMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.4 }), lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 2.7, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.5, z); dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  poles.castShadow = false; add(poles); add(heads);

  // --- traffic lights at main crossings ---
  const lightHeads = [];
  for (const [cx, cz] of [[0, 0], [40, 0], [0, 40], [-40, 0]]) {
    box(0.3, 5.4, 0.3, 0x222228, cx + 7, 2.7, cz + 7, { cast: false });
    const head = box(1.1, 2.4, 0.7, 0x111116, cx + 7, 5.6, cz + 7, { cast: false });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x331111, emissive: 0xff3020, emissiveIntensity: 1.2 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampMat);
    lamp.position.set(cx + 7, 6.2, cz + 6.6); add(lamp);
    lightHeads.push({ lampMat, axis: 'z' });
    city.lights.push({ x: cx, z: cz });
  }
  city.lightHeads = lightHeads;

  // --- elevated metro loop + 2 stations + 4-car train ---
  const railMat = mat(0x3a3a44);
  const pillarGeo = new THREE.BoxGeometry(1.2, 8, 1.2);
  const pillars = new THREE.InstancedMesh(pillarGeo, mat(0x55555f), 24);
  let pi = 0;
  const loop = [[-60, -60], [60, -60], [60, 60], [-60, 60]];
  for (let s = 0; s < 4; s++) {
    const a = loop[s], b = loop[(s + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const midX = (a[0] + b[0]) / 2, midZ = (a[1] + b[1]) / 2;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(s % 2 === 0 ? len : 1.6, 0.7, s % 2 === 0 ? 1.6 : len), railMat);
    rail.position.set(midX, 8, midZ); rail.castShadow = true; add(rail);
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6;
      dummy.position.set(a[0] + (b[0] - a[0]) * t, 4, a[1] + (b[1] - a[1]) * t);
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      pillars.setMatrixAt(pi++, dummy.matrix);
    }
  }
  add(pillars);
  // stations
  for (const [sx, sz, ry] of [[66, 0, -Math.PI / 2], [-66, 0, Math.PI / 2]]) {
    box(10, 1, 22, 0x8a8578, sx, 8.5, sz, { cast: false });
    box(10, 0.5, 22, 0x2a6a8a, sx, 10.2, sz, { cast: false });
    const tex = signTexture('METRO', '#22222e', '#7ae0ff', 'SOLMAR LOOP');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(sx, 12, sz); sign.rotation.y = ry; add(sign);
  }
  // train: 4 cars
  const train = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.6, 2.8),
      new THREE.MeshLambertMaterial({ color: i === 0 ? 0x2a6a8a : 0x3a8ab0, emissive: 0x113344, emissiveIntensity: 0.6 }));
    car.position.set(-i * 8.4, 0, 0); car.castShadow = true; train.add(car);
    const win = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.9, 2.9),
      new THREE.MeshLambertMaterial({ color: 0x111122, emissive: 0xffd27a, emissiveIntensity: 0.7 }));
    win.position.set(-i * 8.4, 0.4, 0); train.add(win);
  }
  train.position.set(-60, 9.6, -60);
  add(train);
  city.train = train;
  city.trainPath = loop;

  // --- beach umbrellas ---
  for (let i = 0; i < 6; i++) {
    const ux = 158 + rng() * 10, uz = -120 + i * 48;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), mat(0xe8e8e8));
    pole.position.set(ux, 1.2, uz); add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
      mat([0xff6a5a, 0xffd27a, 0x7ae0ff][i % 3]));
    top.position.set(ux, 2.7, uz); top.castShadow = true; add(top);
  }

  // --- billboard near the beach road ---
  const bbTex = signTexture('SOLMAR', '#ff8a3d', '#fff2cc', 'SUN • SAND • SPEED');
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), new THREE.MeshBasicMaterial({ map: bbTex }));
  bb.position.set(140, 9, -80); bb.rotation.y = -Math.PI / 2; add(bb);
  box(0.8, 9, 0.8, 0x444444, 140, 4.5, -86, { cast: false });
  box(0.8, 9, 0.8, 0x444444, 140, 4.5, -74, { cast: false });

  return city;
}

export function updateCity(W, dt) {
  const city = W.city;
  if (!city) return;
  // traffic light cycle: 7s each way
  city.phaseT += dt;
  if (city.phaseT > 7) { city.phaseT = 0; city.phase = 1 - city.phase; }
  const greenZ = city.phase === 0;
  for (const lh of city.lightHeads || []) {
    lh.lampMat.emissive.setHex(greenZ ? 0x30ff60 : 0xff3020);
    lh.lampMat.color.setHex(greenZ ? 0x113311 : 0x331111);
  }
  // train: run the rectangle, pause at the two stations
  const train = city.train;
  if (train) {
    if (city.trainWait > 0) {
      city.trainWait -= dt;
    } else {
      city.trainT += dt * 11; // units per second
      const P = city.trainPath;
      const per = 480; // rectangle perimeter
      let d = city.trainT % per;
      let x = 0, z = 0, ry = 0;
      if (d < 120) { x = -60 + d; z = -60; ry = Math.PI / 2; }
      else if (d < 240) { x = 60; z = -60 + (d - 120); ry = Math.PI; }
      else if (d < 360) { x = 60 - (d - 240); z = 60; ry = -Math.PI / 2; }
      else { x = -60; z = 60 - (d - 360); ry = 0; }
      train.position.set(x, 9.6, z);
      train.rotation.y = ry;
      // station stops at (60,0) and (-60,0)
      const atEast = Math.abs(x - 60) < 1.2 && Math.abs(z) < 1.2;
      const atWest = Math.abs(x + 60) < 1.2 && Math.abs(z) < 1.2;
      if ((atEast || atWest) && city.trainT % per > 2) city.trainWait = 4;
    }
  }
}

// Push a circle (x,z,r) out of every building AABB; clamp to the map.
export function collideMove(W, pos, r) {
  const city = W.city;
  let hit = false;
  if (city) {
    for (const c of city.colliders) {
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
      const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        } else {
          pos.x = c.x1 + r;
        }
      }
    }
  }
  pos.x = Math.max(-BOUND, Math.min(176, pos.x));
  pos.z = Math.max(-BOUND, Math.min(BOUND, pos.z));
  return hit;
}

const STREETS_X = ['Palm Ave', 'Coral St', 'Sunset Blvd', 'Harbor Rd', 'Anchor St', 'Vista Way', 'Dune Dr'];
const STREETS_Z = ['Ocean Dr', 'Marina Blvd', 'Plaza St', 'Market Row', 'Bay St', 'Hillside Ave', 'Pier Rd'];

export function districtAt(W, x, z) {
  let name = 'Old Town';
  if (x > 120) name = 'Coral Shore';
  else if (Math.abs(x) <= 40 && Math.abs(z) <= 40) name = 'Downtown';
  else if (x > 60 && z < -40) name = 'Harbor';
  else if (z > 60) name = 'Hillside';
  else if (z < -60) name = 'North End';
  else if (x < -60) name = 'West End';
  const gi = (v) => {
    let best = 0, bd = 1e9;
    GRID.forEach((g, i) => { const d = Math.abs(v - g); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const street = Math.abs(x - GRID[gi(x)]) < Math.abs(z - GRID[gi(z)])
    ? STREETS_Z[gi(z)] : STREETS_X[gi(x)];
  return { name, street };
}
