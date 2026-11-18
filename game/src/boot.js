// SOLMAR HEAT — boot: renderer, sunset lights, wiring, main loop.
// One shared world object W is passed to every system module.
import * as THREE from 'three';
import { createKeys } from './keys.js';
import { createSfx } from './sfx.js';
import { loadSave, storeSave, clearSave } from './stash.js';
import { buildCity, updateCity, GRID } from './city.js';
import { spawnTraffic, spawnParked, updateTraffic } from './cars.js';
import { createPlayer, updateWalker, WEAPONS } from './walker.js';
import { updateDriver, tryEnterCar, exitCar } from './driver.js';
import { createCops, updateCops, addWanted } from './cops.js';
import { createJobs, updateJobs, updateEnemies } from './jobs.js';
import { createHud, updateHud, showScreen, hideScreens, say } from './hud.js';
import { applyScene } from './shots.js';

window.addEventListener('error', (e) => {
  window.__solmarError = String(e.message || e.error || 'error');
  try { document.title = 'SOLMAR ERR: ' + window.__solmarError.slice(0, 120); } catch (err) {}
});
window.addEventListener('unhandledrejection', (e) => { window.__solmarError = String(e.reason || 'rejection'); });

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '20261118', 10) || 20261118;
const sceneName = (params.get('scene') || 'menu').toLowerCase();

// --- renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd86a7a, 120, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(24, 9, 52);

// --- golden-hour sun + warm fill ---
const sun = new THREE.DirectionalLight(0xffa050, 2.6);
sun.position.set(180, 55, -140);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
sun.shadow.camera.far = 700;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.9;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8a5aa0, 0xff9a50, 1.05));
const bounce = new THREE.DirectionalLight(0xff7a5a, 0.35);
bounce.position.set(-120, 40, 120);
scene.add(bounce);

const W = {
  THREE, scene, camera, renderer,
  seed, rng: mulberry(seed),
  keys: null, sfx: createSfx(),
  state: 'menu', menuOrbit: false,
  elapsed: 0, timeMin: 0,
  clockDay: 5, clockHour: 17, clockMin: 20, // SAT 17:20
  player: {
    mesh: null, heading: Math.PI, speed: 0,
    health: 100, armor: 0, cash: 320, wanted: 0,
    weapon: 0, ammo: [Infinity, 12, 32, 6], reserve: [Infinity, 48, 128, 18],
    inCar: null, car: null, onFoot: true, carSpeed: 0, speedKmh: 0,
    lastShot: 0, lastPunch: 0,
  },
  traffic: [], parked: [], enemies: [], peds: [],
  tracers: [], camKick: 0,
  saveNow: null, resetRun: null,
};
W.keys = createKeys();
W.hud = null;

// --- world ---
buildCity(W);
spawnTraffic(W, 16);
spawnParked(W);
W.player.mesh = createPlayer(W);
W.player.mesh.position.set(-97, 0, 92);
W.player.mesh.rotation.y = W.player.heading;
createCops(W);
createJobs(W);
createHud(W);
// killing an officer draws more heat
W.cops.onKill = (world, enemy) => { if (enemy.kind === 'officer') addWanted(world, 1); };

// --- pedestrians: simple walkers on the sidewalks ---
const PED_SHIRTS = [0xd8d8d8, 0x5a8ac8, 0xc85a8a, 0x8a5ac8, 0x3a6a4a, 0xe8a03a, 0x707070];
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: PED_SHIRTS[i % PED_SHIRTS.length] });
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98a5a, 0x8a5a3a, 0xe8b88a][i % 3] });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirt);
  body.position.y = 1.0; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.36), skin);
  head.position.y = 1.6; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legL.position.set(-0.15, 0.31, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const axis = W.rng() < 0.5 ? 'x' : 'z';
  const line = GRID[Math.floor(W.rng() * GRID.length)];
  const dir = W.rng() < 0.5 ? 1 : -1;
  const along = -140 + W.rng() * 280;
  const ped = {
    mesh: g, axis, line, dir,
    x: axis === 'x' ? along : line + (dir > 0 ? -8.5 : 8.5),
    z: axis === 'z' ? along : line + (dir > 0 ? 8.5 : -8.5),
    speed: 1.2 + W.rng() * 1.2, walkPhase: W.rng() * 6,
    legL, legR,
  };
  g.position.set(ped.x, 0, ped.z);
  scene.add(g);
  W.peds.push(ped);
}

function updatePeds(W, dt) {
  for (const p of W.peds) {
    const step = p.dir * p.speed * dt;
    if (p.axis === 'x') p.x += step; else p.z += step;
    const along = p.axis === 'x' ? p.x : p.z;
    if (along > 150 || along < -150) p.dir *= -1;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    p.walkPhase += dt * 7;
    p.legL.rotation.x = Math.sin(p.walkPhase) * 0.55;
    p.legR.rotation.x = -Math.sin(p.walkPhase) * 0.55;
  }
}

// --- save / load ---
const saved = loadSave();
if (saved) {
  const P = W.player;
  if (typeof saved.cash === 'number') P.cash = saved.cash;
  if (typeof saved.health === 'number') P.health = saved.health;
  if (typeof saved.storyStage === 'number') {
    W.jobs.storyStage = Math.min(5, saved.storyStage);
    if (W.jobs.storyStage > 0 && W.jobs.storyStage < 5) W.jobs.nextChapterAt = W.city.spots.diner.clone();
  }
  if (saved.x !== undefined && saved.z !== undefined) {
    P.mesh.position.set(saved.x, 0, saved.z);
  }
  if (saved.muted) { W.sfx.muted = true; const b = document.getElementById('btn-mute'); if (b) b.textContent = 'SOUND: OFF'; }
}
window.__W = W; // debug handle: inspect the live world from the console
W.saveNow = () => {
  const P = W.player;
  storeSave({
    cash: Math.floor(P.cash), health: Math.round(P.health),
    storyStage: W.jobs.storyStage,
    x: P.inCar ? P.inCar.x : P.mesh.position.x,
    z: P.inCar ? P.inCar.z : P.mesh.position.z,
    muted: W.sfx.muted,
  });
};
W.resetRun = () => {
  clearSave();
  window.location.href = window.location.pathname + '?scene=menu';
};

// --- scene preset (menu / chase / downtown / mission) ---
applyScene(W, sceneName);
if (sceneName !== 'menu') hideScreens(W);
if (sceneName === 'menu') {
  showScreen(W, 'start');
  const cont = document.getElementById('btn-continue');
  const saveInfo = document.getElementById('save-info');
  if (saved && cont && saveInfo) {
    cont.classList.remove('hidden');
    saveInfo.textContent = `Continue — Story ${saved.storyStage || 0}/5 · $${Math.floor(saved.cash || 0).toLocaleString('en-US')}`;
  }
}
W.hud.say = say;

// --- main loop ---
const clock = new THREE.Clock();
let firstFrame = true;
let saveT = 0;
let orbitA = 0.6;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  W.elapsed += dt;
  const P = W.player;
  const K = W.keys;

  // global keys
  if (K.wasPressed('KeyM')) {
    const m = W.sfx.toggleMute();
    const b = document.getElementById('btn-mute');
    if (b) b.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
  }
  if ((K.wasPressed('Escape') || K.wasPressed('KeyP')) && W.state === 'play') showScreen(W, 'pause');
  else if ((K.wasPressed('Escape') || K.wasPressed('KeyP')) && W.state === 'paused') {
    hideScreens(W); W.state = 'play';
  }

  updateCity(W, dt);
  updateTraffic(W, dt);
  updatePeds(W, dt);
  updateEnemies(W, dt);
  updateJobs(W, dt);
  updateCops(W, dt);

  if (W.state === 'play') {
    if (P.inCar) updateDriver(W, dt);
    else {
      updateWalker(W, dt);
      if ((K.wasPressed('KeyE') || K.touch.enter)) {
        K.touch.enter = false;
        tryEnterCar(W);
      }
    }
    // $100,000 cash wins the game too
    if (!W.jobs.won && P.cash >= 100000) {
      W.jobs.won = true;
      W.sfx.complete();
      showScreen(W, 'win');
    }
    // wasted
    if (P.health <= 0 && W.state === 'play') {
      P.health = 0;
      W.sfx.fail();
      showScreen(W, 'wasted');
    }
    // autosave
    saveT += dt;
    if (saveT > 10) { saveT = 0; W.saveNow(); }
  } else if (W.state === 'menu' && W.menuOrbit) {
    orbitA += dt * 0.06;
    const r = 78;
    camera.position.set(Math.cos(orbitA) * r, 24 + Math.sin(W.elapsed * 0.1) * 3, Math.sin(orbitA) * r);
    camera.lookAt(0, 8, 0);
  }

  // camera kick from gunfire settles fast
  if (W.camKick > 0) {
    camera.position.y += W.camKick;
    W.camKick *= 0.7;
  }

  updateHud(W, dt);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    document.title = 'SOLMAR OK';
    window.__solmarReady = true;
  }
}
renderer.setAnimationLoop(tick);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
