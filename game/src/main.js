// SOLMAR HEAT — bootstrap, game loop, menus and save flow.
// The game is Rex Vega's open-city story in Solmar City: free roam, optional
// jobs, a five-part story, a wanted level and a metro that loops the city.

import { WORLD, STORY, WIN_CASH_GOAL, dist, clamp, rand } from './config.js';
import { buildCity, randomRoadPoint } from './city.js';
import { makeVehicle, spawnTraffic, spawnParked, updateTraffic, collideVehicles, drawVehicle } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { makePlayer, updatePlayer, addHeat } from './player.js';
import { updateWanted, updatePolice, bustPlayer, wastePlayer } from './police.js';
import { availableJobs, tryStartJob, updateMission, updateRivals } from './missions.js';
import { makeTrain, updateTrain, trainCarPositions } from './train.js';
import { drawWorld, updateCamera } from './render.js';
import { drawMinimap } from './minimap.js';
import { makeAudio } from './audio.js';
import { makeInput, attachInput, updateMouseWorld } from './input.js';
import { saveGame, loadGame, applySave, clearSave } from './save.js';
import { collectHud, updateHud } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');
const hud = collectHud();

const audio = makeAudio();
audio.loadMuted();

const city = buildCity();

const G = {
  mode: 'menu',
  time: 0,
  clock: 480, // 08:00
  cash: 250,
  heat: 0,
  wanted: 0,
  city,
  player: makePlayer(city.spawn),
  vehicles: [],
  peds: [],
  rivals: [],
  officers: [],
  policeCars: [],
  train: makeTrain(city.track),
  trainCars: [],
  mission: null,
  missionKill: 0,
  storyStep: 0,
  stats: { jobsDone: 0, busted: 0, wasted: 0 },
  camera: { x: city.spawn.x, y: city.spawn.y, zoom: 1 },
  shake: 0,
  gunshotFlash: 0,
  tracers: [],
  message: '',
  messageT: 0,
  jobSpots: [],
  taxiStand: null,
  dirtySave: false,
  saveTimer: 0,
  wastedApplied: false,
  winShown: false,
  bustedFine: 0,
  wastedBill: 0,
  audio,
  sfx: (name) => audio.sfx(name),
};

function populateWorld() {
  G.vehicles = [...spawnTraffic(city, 18), ...spawnParked(city, 12)];
  // The player's own car, parked in front of the house.
  const home = city.landmarks.home;
  const myCar = makeVehicle('sedan', home.x + 90, home.y + 150, -Math.PI / 2, 'parked');
  G.vehicles.push(myCar);
  G.peds = spawnPeds(city, 42);
  const rp = randomRoadPoint();
  G.taxiStand = { x: rp.x, y: rp.y };
}

populateWorld();

// ---- scene staging for screenshots (?scene=chase|downtown|mission|train) ----
function applyScene(scene) {
  if (!scene) return;
  G.mode = 'playing';
  const p = G.player;
  if (scene === 'chase') {
    const car = makeVehicle('sports', 1350, 1350, 0, null);
    car.speed = 320;
    G.vehicles.push(car);
    p.vehicle = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y;
    addHeat(G, 130);
    G.wanted = 3;
    for (let i = 0; i < 3; i++) {
      const pc = makeVehicle('police', 1350 - 140 - i * 90, 1350 + (i % 2 ? 40 : -40), 0, 'police');
      pc.siren = true;
      pc.speed = 300;
      G.policeCars.push(pc);
      G.vehicles.push(pc);
    }
    G.camera.x = p.x; G.camera.y = p.y;
  } else if (scene === 'downtown') {
    const car = makeVehicle('sedan', 1050, 1050, 0, null);
    car.speed = 200;
    G.vehicles.push(car);
    p.vehicle = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y;
    G.camera.x = p.x; G.camera.y = p.y;
  } else if (scene === 'mission') {
    const d = city.landmarks.diner;
    p.x = d.x; p.y = d.y + 130;
    p.onFoot = true;
    G.camera.x = p.x; G.camera.y = p.y;
    const dest = city.houses[3] || { x: 750, y: 750 };
    G.mission = {
      id: 'delivery', kind: 'delivery', title: 'Food Delivery',
      brief: 'Pick up the order, then drop it off before the timer runs out.',
      stage: 0, timer: 75, reward: 120,
      target: { x: d.x, y: d.y + 60, label: 'Pick up the order' },
      pickup: { x: d.x, y: d.y + 60 },
      dest: { x: dest.x, y: dest.y, label: 'Deliver here' },
      legs: 1,
    };
  } else if (scene === 'train') {
    const st = city.track.stations[0];
    p.x = st.x; p.y = st.y + 150;
    p.onFoot = true;
    G.camera.x = p.x; G.camera.y = p.y;
    // Put the train right at the station.
    G.train.dist = 0;
  }
}

// ---- menus ----
const overlays = {
  menu: document.getElementById('menu'),
  howto: document.getElementById('howto'),
  settings: document.getElementById('settings'),
  pause: document.getElementById('pause'),
  busted: document.getElementById('busted'),
  wasted: document.getElementById('wasted'),
  win: document.getElementById('win'),
};

function showOverlay(name) {
  for (const key of Object.keys(overlays)) {
    if (overlays[key]) overlays[key].style.display = key === name ? 'flex' : 'none';
  }
}

function bindButton(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => { audio.ensure(); audio.sfx('click'); fn(); });
}

function startNewGame() {
  clearSave();
  G.cash = 250;
  G.storyStep = 0;
  G.stats = { jobsDone: 0, busted: 0, wasted: 0 };
  G.player = makePlayer(city.spawn);
  G.mission = null;
  G.heat = 0;
  G.wanted = 0;
  G.winShown = false;
  G.mode = 'playing';
  showOverlay(null);
  G.message = 'Welcome to Solmar City. Rosa’s Diner has work — look for the gold marker.';
  G.messageT = 4;
}

function continueGame() {
  const data = loadGame();
  if (data) applySave(G, data);
  G.mode = 'playing';
  showOverlay(null);
  G.message = 'Welcome back to Solmar City.';
  G.messageT = 3;
}

bindButton('btn-play', startNewGame);
bindButton('btn-continue', continueGame);
bindButton('btn-howto', () => { G.mode = 'howto'; showOverlay('howto'); });
bindButton('btn-settings', () => { G.mode = 'settings'; showOverlay('settings'); });
bindButton('btn-mute', () => {
  audio.setMuted(!audio.muted);
  document.getElementById('btn-mute').textContent = audio.muted ? 'Sound: Off' : 'Sound: On';
});
bindButton('btn-howto-back', () => { G.mode = 'menu'; showOverlay('menu'); });
bindButton('btn-settings-back', () => { G.mode = 'menu'; showOverlay('menu'); });
bindButton('btn-reset-save', () => {
  clearSave();
  document.getElementById('btn-continue').style.display = 'none';
});
bindButton('btn-resume', () => { G.mode = 'playing'; showOverlay(null); });
bindButton('btn-save', () => { saveGame(G); G.message = 'Game saved.'; G.messageT = 2; });
bindButton('btn-quit', () => { saveGame(G); G.mode = 'menu'; showOverlay('menu'); refreshMenu(); });
bindButton('btn-busted-ok', () => {
  G.stats.busted += 1;
  G.mode = 'playing';
  showOverlay(null);
  G.message = 'Busted — the PD took its cut. Stay sharp.';
  G.messageT = 3;
});
bindButton('btn-wasted-ok', () => {
  G.stats.wasted += 1;
  G.wastedApplied = false;
  G.mode = 'playing';
  showOverlay(null);
  G.message = 'Patched up at Solmar General. The bill hurt more than the fall.';
  G.messageT = 3;
});
bindButton('btn-win-keep', () => { G.mode = 'playing'; showOverlay(null); });
bindButton('btn-win-menu', () => { G.mode = 'menu'; showOverlay('menu'); refreshMenu(); });

function refreshMenu() {
  const hasSave = !!loadGame();
  const cont = document.getElementById('btn-continue');
  if (cont) cont.style.display = hasSave ? 'block' : 'none';
  const muteBtn = document.getElementById('btn-mute');
  if (muteBtn) muteBtn.textContent = audio.muted ? 'Sound: Off' : 'Sound: On';
  const saveNote = document.getElementById('save-note');
  if (saveNote) saveNote.textContent = hasSave ? 'Saved game found — Continue picks up where you left off.' : 'No saved game yet.';
}
refreshMenu();

// ---- input ----
const input = makeInput();
attachInput(input, canvas, {
  onPause: () => {
    if (G.mode === 'playing') { G.mode = 'paused'; showOverlay('pause'); }
    else if (G.mode === 'paused') { G.mode = 'playing'; showOverlay(null); }
  },
  onMute: () => {
    audio.setMuted(!audio.muted);
    refreshMenu();
  },
  onHorn: () => { if (G.player.vehicle) audio.sfx('horn'); },
});

// ---- sizing ----
let cssW = 0, cssH = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---- scene from URL ----
const scene = new URLSearchParams(window.location.search).get('scene');
if (scene) {
  applyScene(scene);
  showOverlay(null);
  refreshMenu();
} else {
  showOverlay('menu');
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 26);

  if (G.mode === 'playing') {
    G.clock += dt * 0.8;
    updateMouseWorld(input, G.camera, cssW, cssH);
    tryStartJob(G, input);
    updatePlayer(G, input, dt);
    updateTraffic(G, dt);
    collideVehicles(G);
    updatePeds(G, dt);
    updateWanted(G, dt);
    updatePolice(G, dt);
    updateMission(G, dt);
    updateRivals(G, dt);
    updateTrain(G, dt);
    for (const t of G.tracers) t.t -= dt;
    G.tracers = G.tracers.filter(t => t.t > 0);
    G.jobSpots = availableJobs(G);
    G.trainCars = trainCarPositions(G);
    updateCamera(G, dt);
    audio.update(dt, G.wanted, G.player.vehicle);
    // Autosave every 30s or right after a job.
    G.saveTimer += dt;
    if (G.dirtySave || G.saveTimer > 30) {
      saveGame(G);
      G.dirtySave = false;
      G.saveTimer = 0;
    }
    // Wasted: run the hospital respawn once.
    if (G.mode === 'wasted' && !G.wastedApplied) {
      G.wastedApplied = true;
      wastePlayer(G);
      const el = document.getElementById('wasted-bill');
      if (el) el.textContent = 'Hospital bill: $' + G.wastedBill + '. Cash left: $' + Math.round(G.cash) + '.';
      showOverlay('wasted');
    }
    if (G.mode === 'busted') {
      const el = document.getElementById('busted-fine');
      if (el) el.textContent = 'Fine paid: $' + G.bustedFine + '. Cash left: $' + Math.round(G.cash) + '.';
      showOverlay('busted');
    }
    if (G.mode === 'win' && !G.winShown) {
      G.winShown = true;
      const el = document.getElementById('win-stats');
      if (el) el.textContent = 'Story complete · ' + G.stats.jobsDone + ' jobs done · ' + fmtCash(G.cash) + ' in the bank.';
      showOverlay('win');
    }
    updateHud(G, hud, dt);
  } else if (G.mode === 'menu' || G.mode === 'howto' || G.mode === 'settings') {
    // Slow pan over the city behind the menu.
    G.camera.x = WORLD / 2 + Math.cos(G.time * 0.05) * 500;
    G.camera.y = WORLD / 2 + Math.sin(G.time * 0.04) * 500;
    G.camera.zoom = 0.55;
    updateTrain(G, dt);
    G.trainCars = trainCarPositions(G);
    G.jobSpots = availableJobs(G);
  } else if (G.mode === 'paused') {
    // Frozen world, still drawn.
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWorld(ctx, G, cssW, cssH);
  if (G.mode === 'playing') {
    drawMinimap(mapCtx, G, 180);
    mapCanvas.style.display = 'block';
  } else {
    mapCanvas.style.display = 'none';
  }
  requestAnimationFrame(frame);
}

function fmtCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

requestAnimationFrame(frame);
