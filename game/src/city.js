// SOLMAR HEAT — the city. Builds Solmar City from a seed: a painted ground
// canvas (roads, lanes, sidewalks, parks), downtown towers, mid-rise blocks,
// houses with yards and fences, the hospital, the police station, shops with
// signs, parks, lamps, the outer train loop and the elevated metro loop.
// Returns the colliders, the key addresses and the map canvas the minimap
// draws, so the rest of the game never re-derives the layout.

import * as THREE from 'three';
import { mulberry32, pick } from './config.js';

const WORLD = 420; // city spans -210..210
const HALF = WORLD / 2;
const BLOCK = 42;
const ROAD = 10;

function px(x) { return ((x + HALF) / WORLD) * 1024; }

// A facade texture: rows of windows on a pale wall, tinted per building.
function facadeTexture(base, windows) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = windows;
  for (let r = 0; r < 8; r++) for (let col = 0; col < 4; col++) {
    g.fillRect(12 + col * 28, 14 + r * 30, 18, 18);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A shop/sign texture with short English text on a coloured board.
function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.font = 'bold 34px Arial'; g.textAlign = 'center';
  g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The ground: one painted canvas — grass, roads, lane dashes, sidewalks,
// crosswalks and park lawns — so the streets read from the air and on foot.
function groundTexture(parks) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#b5ad8e'; g.fillRect(0, 0, 1024, 1024);
  for (const p of parks) {
    g.fillStyle = '#6f9e57';
    g.fillRect(px(p.x - 21), px(p.z - 21), px(42) - px(0), px(42) - px(0));
  }
  g.fillStyle = '#3a3d42';
  for (let k = -5; k <= 5; k++) {
    const v = k * BLOCK;
    g.fillRect(px(v - ROAD / 2), 0, px(ROAD) - px(0), 1024);
    g.fillRect(0, px(v - ROAD / 2), 1024, px(ROAD) - px(0));
  }
  g.fillStyle = '#9aa0a3';
  for (let k = -5; k <= 5; k++) {
    const v = k * BLOCK;
    g.fillRect(px(v - ROAD / 2 - 2), 0, 4, 1024);
    g.fillRect(px(v + ROAD / 2 - 2), 0, 4, 1024);
    g.fillRect(0, px(v - ROAD / 2 - 2), 1024, 4);
    g.fillRect(0, px(v + ROAD / 2 - 2), 1024, 4);
  }
  g.fillStyle = '#f5d76e';
  for (let k = -5; k <= 5; k++) {
    const v = k * BLOCK;
    for (let d = -200; d < 200; d += 12) {
      g.fillRect(px(v) - 2, px(d), 4, 7);
      g.fillRect(px(d), px(v) - 2, 7, 4);
    }
  }
  g.fillStyle = '#e8e8e8';
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {
    const x = a * BLOCK, z = b * BLOCK;
    for (let s = -1; s <= 1; s++) {
      g.fillRect(px(x - 8 + s * 5), px(z - ROAD / 2 - 4), 4, 8);
      g.fillRect(px(x - 8 + s * 5), px(z + ROAD / 2 - 4), 4, 8);
      g.fillRect(px(x - ROAD / 2 - 4), px(z - 8 + s * 5), 8, 4);
      g.fillRect(px(x + ROAD / 2 - 4), px(z - 8 + s * 5), 8, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const parks = [{ x: -147, z: 147 }, { x: 63, z: -105 }, { x: 189, z: -147 }];
  const parkSet = new Set(parks.map(p => p.x + ',' + p.z));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: groundTexture(parks) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // A plain sandy apron under and around the painted streets.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD + 400, WORLD + 400),
    new THREE.MeshLambertMaterial({ color: 0xb5ad8e }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.08;
  group.add(apron);

  const facades = [
    facadeTexture('#d8cfc0', '#3d5a73'),
    facadeTexture('#c9b8a3', '#33475e'),
    facadeTexture('#b9c4c9', '#2f4a3a'),
  ];
  const wallCols = [0xd8cfc0, 0xc9b8a3, 0xb9c4c9, 0xd9c1a8, 0xaeb9c2];

  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || group).add(m);
    return m;
  }
  function addCollider(x, z, hw, hd) { colliders.push({ x, z, hw, hd }); }

  const special = {
    '-2,1': 'hospital', '2,0': 'police', '-3,-1': 'rosa',
    '3,2': 'chop', '-3,0': 'playerhouse',
  };

  // Buildings, block by block. Downtown towers in the middle, mid-rise
  // around them, houses with yards on the outer ring.
  for (let bx = -5; bx <= 4; bx++) {
    for (let bz = -5; bz <= 4; bz++) {
      const cx = bx * BLOCK + 21;
      const cz = bz * BLOCK + 21;
      const key = bx + ',' + bz;
      if (parkSet.has(cx + ',' + cz)) {
        buildPark(group, cx, cz, rng);
        continue;
      }
      const kind = special[key];
      if (kind === 'hospital') { buildHospital(group, cx, cz, addCollider, signTexture); continue; }
      if (kind === 'police') { buildPolice(group, cx, cz, addCollider, signTexture); continue; }
      if (kind === 'chop') { buildChop(group, cx, cz, addCollider, signTexture); continue; }
      if (kind === 'rosa' || kind === 'playerhouse') {
        buildHouse(group, cx, cz, rng, addCollider, kind === 'playerhouse');
        continue;
      }
      const ring = Math.max(Math.abs(bx), Math.abs(bz));
      if (ring >= 4) {
        buildHouse(group, cx + (rng() - 0.5) * 8, cz + (rng() - 0.5) * 8, rng, addCollider, false);
        buildHouse(group, cx + (rng() - 0.5) * 8 - 10, cz + (rng() - 0.5) * 8 + 10, rng, addCollider, false);
      } else if (ring <= 1) {
        const h = 34 + rng() * 38;
        const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades), color: pick(rng, wallCols) });
        box(22, h, 22, mat, cx, h / 2, cz);
        box(24, 1.2, 24, new THREE.MeshLambertMaterial({ color: 0x5a5f66 }), cx, h + 0.6, cz);
        addCollider(cx, cz, 11.5, 11.5);
      } else {
        const h = 10 + rng() * 14;
        const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades), color: pick(rng, wallCols) });
        const w = 16 + rng() * 8;
        box(w, h, w, mat, cx, h / 2, cz);
        box(w + 1.5, 1, w + 1.5, new THREE.MeshLambertMaterial({ color: 0x6a6f76 }), cx, h + 0.5, cz);
        addCollider(cx, cz, w / 2 + 0.8, w / 2 + 0.8);
        if (rng() < 0.45) buildShop(group, cx + 14, cz - 12, rng, addCollider, signTexture);
      }
    }
  }

  buildTrainLoop(group);
  buildMetroLoop(group, rng);

  // Street lamps along the main avenues.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const lampHead = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a });
  for (let k = -4; k <= 4; k++) {
    for (const s of [-1, 1]) {
      const x = k * BLOCK + s * 7, z = -168 + (k + 4) * 42;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(x, 3, z); group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampHead);
      head.position.set(x, 6.1, z); group.add(head);
    }
  }

  const mapCanvas = groundTexture(parks).image;

  return {
    colliders,
    mapCanvas,
    spawn: { x: -105, z: 4, heading: Math.PI / 2 },
    spawnCar: { x: -99, z: 4, heading: Math.PI / 2 },
    rosa: { x: -105, z: -21 },
    hospital: { x: -63, z: 63 },
    police: { x: 105, z: 21 },
    chop: { x: 147, z: 105 },
    trackHalf: 196,
    metroHalf: 126,
    metroY: 6,
  };
}

function buildPark(group, cx, cz, rng) {
  const treeTrunk = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const treeTop = new THREE.MeshLambertMaterial({ color: 0x3f7d3a });
  for (let i = 0; i < 7; i++) {
    const x = cx + (rng() - 0.5) * 30;
    const z = cz + (rng() - 0.5) * 30;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), treeTrunk);
    trunk.position.set(x, 1.2, z); trunk.castShadow = true; group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), treeTop);
    top.position.set(x, 4.4, z); top.castShadow = true; group.add(top);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), new THREE.MeshLambertMaterial({ color: 0x7a5c33 }));
  bench.position.set(cx, 0.6, cz); group.add(bench);
}

function buildHouse(group, cx, cz, rng, addCollider, isPlayer) {
  const cols = [0xe8dcc0, 0xd9a86c, 0xc9d6de, 0xe0b0a0, 0xf0e6d2];
  const col = pick(rng, cols);
  const body = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 8), new THREE.MeshLambertMaterial({ color: col }));
  body.position.set(cx, 2.5, cz); body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3.2, 4), new THREE.MeshLambertMaterial({ color: 0x8a4a3a }));
  roof.position.set(cx, 6.6, cz); roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  group.add(roof);
  // Yard fence: low rails on two sides.
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const dz of [-6, 6]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 0.25), fenceMat);
    f.position.set(cx, 0.45, cz + dz); group.add(f);
  }
  if (isPlayer) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 0.3), new THREE.MeshLambertMaterial({ color: 0x3a5a8a }));
    door.position.set(cx, 1.5, cz - 4.1); group.add(door);
  }
  addCollider(cx, cz, 4.8, 4.3);
}

function buildShop(group, x, z, rng, addCollider, signTexture) {
  const names = [['PIZZA', '#c0392b', '#fff'], ['TACOS', '#d35400', '#fff'], ['24H MART', '#2471a3', '#fff'], ['HOTEL', '#6c3483', '#fff']];
  const [text, bg, fg] = pick(rng, names);
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshLambertMaterial({ color: 0xe5ddd0 }));
  body.position.set(x, 3, z); body.castShadow = true; group.add(body);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.2),
    new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg) }),
  );
  sign.position.set(x, 5, z - 4.05); sign.rotation.y = Math.PI; group.add(sign);
  const awn = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.4, 2.4), new THREE.MeshLambertMaterial({ color: 0x2e86c1 }));
  awn.position.set(x, 3.4, z - 4.6); group.add(awn);
  addCollider(x, z, 5.2, 4.2);
}

function buildHospital(group, cx, cz, addCollider, signTexture) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 18), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  body.position.set(cx, 7, cz); body.castShadow = true; group.add(body);
  const crossMat = new THREE.MeshLambertMaterial({ color: 0xd81f2a });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.6), crossMat);
  c1.position.set(cx, 11, cz - 9.1); group.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 0.6), crossMat);
  c2.position.set(cx, 11, cz - 9.1); group.add(c2);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: signTexture('HOSPITAL', '#ffffff', '#c0392b') }),
  );
  sign.position.set(cx, 6, cz - 9.2); sign.rotation.y = Math.PI; group.add(sign);
  addCollider(cx, cz, 13.5, 9.5);
}

function buildPolice(group, cx, cz, addCollider, signTexture) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 16), new THREE.MeshLambertMaterial({ color: 0x2c4a7a }));
  body.position.set(cx, 5, cz); body.castShadow = true; group.add(body);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.4),
    new THREE.MeshBasicMaterial({ map: signTexture('POLICE', '#1c2f6e', '#ffffff') }),
  );
  sign.position.set(cx, 5, cz - 8.2); sign.rotation.y = Math.PI; group.add(sign);
  addCollider(cx, cz, 11.5, 8.5);
}

function buildChop(group, cx, cz, addCollider, signTexture) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 14), new THREE.MeshLambertMaterial({ color: 0x5d6d7e }));
  body.position.set(cx, 3.5, cz); body.castShadow = true; group.add(body);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('CHOP SHOP', '#2c3e50', '#f2c200') }),
  );
  sign.position.set(cx, 5.5, cz - 7.2); sign.rotation.y = Math.PI; group.add(sign);
  addCollider(cx, cz, 9.5, 7.5);
}

// The outer train loop: ballast strip + two rails around the city edge.
function buildTrainLoop(group) {
  const H = 196;
  const ballast = new THREE.MeshLambertMaterial({ color: 0x4a4640 });
  const rail = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  for (const [w, d, x, z] of [[2 * H + 8, 4, 0, -H], [2 * H + 8, 4, 0, H], [4, 2 * H + 8, -H, 0], [4, 2 * H + 8, H, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), ballast);
    b.position.set(x, 0.15, z); b.receiveShadow = true; group.add(b);
  }
  for (const off of [-1.1, 1.1]) {
    for (const [w, d, x, z] of [[2 * H, 0.3, 0, -H + off], [2 * H, 0.3, 0, H + off], [0.3, 2 * H, -H + off, 0], [0.3, 2 * H, H + off, 0]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), rail);
      r.position.set(x, 0.42, z); group.add(r);
    }
  }
}

// The elevated metro loop: a deck on pillars, a tram runs on it.
function buildMetroLoop(group, rng) {
  const H = 126;
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x7a7f85 });
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  for (const [w, d, x, z] of [[2 * H, 5, 0, -H], [2 * H, 5, 0, H], [5, 2 * H, -H, 0], [5, 2 * H, H, 0]]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), deckMat);
    deck.position.set(x, 6, z); deck.castShadow = true; group.add(deck);
  }
  for (let k = -5; k <= 5; k++) {
    const v = k * 21;
    for (const [x, z] of [[v, -H], [v, H], [-H, v], [H, v]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 6, 8), pillarMat);
      p.position.set(x, 3, z); group.add(p);
    }
  }
}
