// SOLMAR HEAT — bootstrap and game loop. Builds the world, wires the
// start screen, runs the frame loop and connects every system: walking,
// driving, traffic, police, trains, missions, the HUD and the save.

import * as THREE from 'three';
import { CFG } from './config.js';
import { createState, saveGame, loadGame, applySave, hasSave } from './state.js';
import { buildCity } from './city.js';
import { makeVehicleMesh, spawnTraffic, updateTraffic, spawnParked, defById } from './vehicles.js';
import { makeWalkerMesh, updateWalker } from './walker.js';
import { updateDriver } from './driver.js';
import { addHeat, updateWanted, makePoliceForce, updatePolice } from './police.js';
import { makePeds, updatePeds, punchNear } from './peds.js';
import { makeRail, updateRail } from './train.js';
import { makeMarkers, updateMissions, hospitalHeal, checkWin, currentStop } from './missions.js';
import { hudRefs, updateHud, drawMinimap, showToast, showEnd, hideEnd } from './hud.js';
import { SoundBank } from './audio.js';
import { createInput } from './input.js';
import { makeCamera, updateCamera, menuOrbit } from './camera.js';
import { applyScene, SHOTS } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const S = createState();
S.seed = seed;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc5e8);
scene.fog = new THREE.Fog(0xa8c6e8, 280, 560);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

const sun = new THREE.DirectionalLight(0xffe3b3, 2.6);
sun.position.set(140, 190, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -230; sun.shadow.camera.right = 230;
sun.shadow.camera.top = 230; sun.shadow.camera.bottom = -230;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95));

const city = buildCity(scene, seed);
const traffic = spawnTraffic(scene, seed);
const parked = spawnParked(scene, city, seed);
const peds = makePeds(scene, seed);
const rail = makeRail(scene, city);
const police = makePoliceForce(scene);
const markers = makeMarkers(scene);
const walkerMesh = makeWalkerMesh();
walkerMesh.position.set(S.player.x, 0, S.player.z);
scene.add(walkerMesh);

const refs = hudRefs();
const sound = new SoundBank();
const input = createInput();
const camRig = makeCamera();

const world = {
  scene, city, parked, traffic, peds, rail, police,
  makeCarMesh: def => makeVehicleMesh(def),
};

// --- start screen wiring -------------------------------------------------
const menu = refs.menu;
const saved = hasSave();
document.getElementById('btn-continue').style.display = saved ? 'inline-block' : 'none';
function startGame(fresh) {
  sound.ensure();
  sound.click();
  if (fresh) { const keep = S.money; Object.assign(S, createState(), { seed }); S.money = keep; }
  else { const data = loadGame(); if (data) applySave(S, data); }
  S.started = true;
  S.paused = false;
  menu.style.display = 'none';
  hideEnd(refs);
  showToast(refs, S.story > 0 ? 'Welcome back to Solmar.' : 'Welcome to Solmar City. Visit Rosa to start her story.');
  saveGame(S);
}
document.getElementById('btn-play').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-how').addEventListener('click', () => {
  document.getElementById('how-panel').style.display = 'block';
});
document.getElementById('btn-how-close').addEventListener('click', () => {
  document.getElementById('how-panel').style.display = 'none';
});
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('settings-panel').style.display = 'block';
});
document.getElementById('btn-settings-close').addEventListener('click', () => {
  document.getElementById('settings-panel').style.display = 'none';
});
document.getElementById('opt-mute').addEventListener('change', e => {
  S.muted = e.target.checked;
  sound.setMuted(S.muted);
});
document.getElementById('opt-shadows').addEventListener('change', e => {
  renderer.shadowMap.enabled = e.target.checked;
});
document.getElementById('btn-mute').addEventListener('click', () => {
  S.muted = !S.muted;
  sound.setMuted(S.muted);
  document.getElementById('btn-mute').textContent = S.muted ? 'Unmute' : 'Mute';
});
document.getElementById('btn-again').addEventListener('click', () => location.reload());

// --- actions ---------------------------------------------------------------
function nearestParked(maxDist) {
  let best = null, bd = maxDist;
  for (const p of parked) {
    if (p.taken) continue;
    const d = Math.hypot(p.x - S.player.x, p.z - S.player.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function enterCar() {
  if (S.inCar) { exitCar(); return; }
  const p = nearestParked(4.5);
  if (!p) return;
  p.taken = true;
  const owned = p === parked[0]; // the car in front of the player's house
  S.inCar = { def: p.def, mesh: p.mesh, x: p.x, z: p.z, heading: p.heading, stolen: !owned, record: p };
  S.onFoot = false;
  S.carSpeed = 0;
  walkerMesh.visible = false;
  sound.ensure(); sound.chime();
  if (!owned) {
    S.carsStolen++;
    addHeat(S, 0.2);
    showToast(refs, 'Car stolen — the cops noticed.');
  } else {
    showToast(refs, 'Your car. Drive safe.');
  }
}

function exitCar() {
  const car = S.inCar;
  if (!car) return;
  car.record.x = car.x; car.record.z = car.z; car.record.heading = car.heading;
  car.record.taken = false;
  S.player.x = car.x + Math.cos(car.heading) * 2.2;
  S.player.z = car.z - Math.sin(car.heading) * 2.2;
  S.player.heading = car.heading;
  S.player.speed = 0;
  S.inCar = null;
  S.onFoot = true;
  S.carSpeed = 0;
  walkerMesh.visible = true;
  walkerMesh.position.set(S.player.x, 0, S.player.z);
}

function doPunch() {
  if (S.inCar) return;
  sound.punch();
  punchNear(S.player.x, S.player.z, peds, () => {
    addHeat(S, 0.2);
    showToast(refs, 'Assault — the cops noticed.');
  });
}

input.onAction = name => {
  if (!S.started) return;
  if (name === 'enter') enterCar();
  if (name === 'punch') doPunch();
  if (name === 'mute') {
    S.muted = !S.muted;
    sound.setMuted(S.muted);
  }
  if (name === 'pause') {
    S.paused = !S.paused;
    showToast(refs, S.paused ? 'Paused.' : 'Resumed.');
  }
};

// --- scenes and shots --------------------------------------------------------
const shotName = params.get('shot');
const sceneName = params.get('scene') || (shotName ? SHOTS[shotName] || 'menu' : 'menu');
if (shotName || params.get('scene')) {
  applyScene(sceneName, S, world);
  if (sceneName === 'chase') {
    // Put two police cars on the player right away for the chase shot.
    for (const [dx, dz] of [[-14, -18], [16, -14]]) {
      const def = defById('police');
      const mesh = makeVehicleMesh(def);
      mesh.position.set(S.inCar.x + dx, 0, S.inCar.z + dz);
      scene.add(mesh);
      police.cars.push({ def, mesh, x: S.inCar.x + dx, z: S.inCar.z + dz, heading: 0, speed: 20 });
    }
  }
  if (S.started) menu.style.display = 'none';
  walkerMesh.visible = S.onFoot;
  walkerMesh.position.set(S.player.x, 0, S.player.z);
}
if (params.get('touch') === '1') document.body.classList.add('touch');

// --- frame loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let saveTimer = 0;
let firstFrame = false;

function endRun(kind, title, text) {
  if (kind === 'won') { S.won = true; S.winText = text; }
  if (kind === 'busted') S.busted = true;
  if (kind === 'wasted') S.wasted = true;
  showEnd(refs, title, text);
  sound.paid();
  saveGame(S);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.time += dt;
  if (S.started && !S.paused && !S.won && !S.busted && !S.wasted) {
    if (S.inCar) {
      updateDriver(dt, input.move, S, S.inCar, city.colliders, () => sound.bump());
    } else {
      updateWalker(dt, input.move, input.sprint, S, city.colliders, walkerMesh);
    }
    updateTraffic(dt, traffic, seed);
    updatePeds(dt, peds, seed);
    updateRail(dt, rail);
    updateWanted(dt, S);
    updatePolice(dt, S, police, scene, city.colliders,
      () => endRun('busted', 'BUSTED', 'The police caught you. Solmar keeps its secrets — for now.'),
      dmg => {
        S.health -= dmg;
        sound.bump();
        if (S.health <= 0) endRun('wasted', 'WASTED', 'You ran out of health. The city moves on without you.');
      });
    const sold = updateMissions(dt, S, markers, city,
      pay => { sound.paid(); showToast(refs, '+$' + pay.toLocaleString('en-US')); },
      () => {});
    if (sold) {
      scene.remove(sold.mesh);
      const idx = parked.indexOf(sold.record);
      if (idx !== -1) parked.splice(idx, 1);
      S.inCar = null; S.onFoot = true; S.carSpeed = 0;
      S.player.x = city.chop.x; S.player.z = city.chop.z + 12;
      walkerMesh.visible = true;
      walkerMesh.position.set(S.player.x, 0, S.player.z);
    }
    if (hospitalHeal(dt, S, city)) { /* quietly refilling */ }
    checkWin(S);
    if (S.won) endRun('won', 'SOLMAR IS YOURS', S.winText);
    sound.engineHum(S.inCar ? Math.abs(S.carSpeed) / (S.inCar.def.top || 1) : 0, !!S.inCar);
    sound.siren(S.wanted > 0);
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; saveGame(S); }
  }
  const target = S.inCar
    ? { x: S.inCar.x, z: S.inCar.z }
    : { x: S.player.x, z: S.player.z };
  const heading = S.inCar ? S.inCar.heading : S.player.heading;
  if (!S.started) menuOrbit(camera, S.time, city);
  else updateCamera(camera, camRig, target, heading, dt, !!S.inCar, city.colliders);
  updateHud(S, refs);
  drawMinimap(refs, city.mapCanvas, S, city, { stop: currentStop(S) }, police.cars, peds);
  renderer.render(scene, camera);
  if (!firstFrame) {
    firstFrame = true;
    window.__solmarReady = true;
    if (shotName) setTimeout(() => { window.__solmarShotReady = true; }, 2600);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.addEventListener('error', e => {
  const el = document.getElementById('err');
  if (el) el.textContent = 'Error: ' + (e.message || 'unknown');
});

// Headless hooks for playtesting: state, input and the world, nothing more.
window.__solmar = { S, input, world, city, parked, traffic, peds, police, startGame, enterCar };
frame();
