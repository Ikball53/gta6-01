// SOLMAR HEAT — core loop: on-foot and driving controls (character-relative),
// wanted level, police + helicopter, missions, hospital, metro, minimap.
import * as THREE from 'three';
import { buildWorld, CITY } from './world.js';
import {
  VEHICLE_TYPES, makeVehicle, makeTraffic, stepTraffic,
  makeParked, makeHelicopter, stepHelicopter,
} from './vehicles.js';
import { makeAudio } from './audio.js';

const WIN_CASH = 55000;    // +$50,000 over the $5,000 start
const RICH_CASH = 100000;  // the $100,000 dream
const TURN_RATE = 3.0;     // rad/s on foot, stick X
const WALK_SPEED = 4.4;
const SPRINT_SPEED = 7.5;
const STEER_RATE = 1.9;    // car steering coefficient (see spec)

const STORY = [
  'Part 1 — Rosa calls. A package waits in the north park, and the rent is due.',
  'Part 2 — The cops saw the pickup. Lose them before the bridge.',
  'Part 3 — A downtown delivery, no questions, no stops.',
  'Part 4 — Three drops across Solmar. Fast, quiet, paid.',
  'Part 5 — The final run. One hundred thousand, and Rosa is free.',
];

const MISSIONS = [
  { id: 1, title: 'Rosa: park pickup', text: 'Reach the park marker', x: -84, z: 84, pay: 10000 },
  { id: 2, title: 'Rosa: lose the cops', text: 'Get your wanted level to zero', x: 0, z: 0, pay: 12000, loseCops: true },
  { id: 3, title: 'Rosa: downtown delivery', text: 'Reach the downtown tower', x: 0, z: -60, pay: 15000 },
  { id: 4, title: 'Rosa: three drops', text: 'Visit all three drop markers', x: 112, z: -112, pay: 18000, drops: [[112, -112], [-112, 28], [56, 112]] },
  { id: 5, title: 'Rosa: the final run', text: 'Reach the metro station', x: 84, z: -84, pay: 40000 },
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function fmt(n) { return '$' + n.toLocaleString('en-US'); }

export function boot() {
  const params = new URLSearchParams(location.search);
  const sceneName = params.get('scene') || 'menu';
  const audio = makeAudio();
  const canvas = document.getElementById('gl');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x9fc3e8, 180, 420);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(0, 14, 130);

  // Lighting is the top visual priority: warm low sun + bright sky fill.
  const sun = new THREE.DirectionalLight(0xffe3b3, 2.6);
  sun.position.set(120, 160, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  const sky = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 1.1);
  scene.add(sky);
  const bounce = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(bounce);

  const world = buildWorld(scene);
  const traffic = makeTraffic(scene, 10);
  const parked = makeParked(scene);
  const heli = makeHelicopter(scene);

  // --- player -------------------------------------------------------------
  const playerMesh = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), jacket);
  body.position.y = 1.05; body.castShadow = true;
  playerMesh.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8b98a }));
  head.position.y = 1.75; head.castShadow = true;
  playerMesh.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x223344 }));
  legs.position.y = 0.35;
  playerMesh.add(legs);
  scene.add(playerMesh);

  // --- pedestrians --------------------------------------------------------
  const peds = [];
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x3a7ad8, roughness: 0.8 });
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.35), pedMat.clone());
    b.material.color.setHSL((i * 0.09) % 1, 0.55, 0.5);
    b.position.y = 1.0; b.castShadow = true;
    m.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8a077 }));
    h.position.y = 1.7;
    m.add(h);
    const px = -150 + (i * 29) % 300;
    const pz = -150 + (i * 53) % 300;
    m.position.set(px, 0, pz);
    scene.add(m);
    peds.push({ mesh: m, x: px, z: pz, heading: (i * 1.1) % (Math.PI * 2), speed: 1.1 + (i % 3) * 0.3 });
  }

  // --- state --------------------------------------------------------------
  const state = {
    playing: false, paused: false, over: false, won: false, wonRich: false,
    cash: 5000, health: 100, wanted: 0,
    missionIndex: 0, missionActive: false, dropsLeft: 0, dropsHit: [],
    time: 0, decayTimer: 0, healTimer: 0, saveTimer: 0,
    camYaw: 0,
  };
  const player = { x: CITY.house.x, z: CITY.house.z - 14, heading: Math.PI, speed: 0 };
  let car = null; // current vehicle when driving
  const policeCars = [];
  let marker = null; // mission marker mesh

  // Restore save.
  try {
    const s = JSON.parse(localStorage.getItem('solmar-save') || 'null');
    if (s && typeof s.cash === 'number') {
      state.cash = s.cash; state.health = s.health ?? 100;
      state.missionIndex = s.missionIndex ?? 0;
      player.x = s.x ?? player.x; player.z = s.z ?? player.z;
    }
  } catch (e) { /* fresh start */ }

  function save() {
    try {
      localStorage.setItem('solmar-save', JSON.stringify({
        cash: state.cash, health: state.health, missionIndex: state.missionIndex,
        x: player.x, z: player.z,
      }));
    } catch (e) {}
  }

  // --- input: keyboard + touch stick + headless test hook -----------------
  const keys = {};
  const stick = { x: 0, y: 0 };
  const testInput = { x: 0, y: 0, active: false };
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyM') { audio.toggleMuted(); toast(audio.isMuted() ? 'Muted' : 'Sound on'); syncSettings(); }
    if (e.code === 'KeyE') tryEnterExit();
    if (e.code === 'Space') { audio.sounds.horn(); e.preventDefault(); }
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyR') restartMission();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  function readMove() {
    if (testInput.active) return { x: testInput.x, y: testInput.y };
    let x = stick.x;
    let y = stick.y;
    if (keys.KeyW || keys.ArrowUp) y += 1;
    if (keys.KeyS || keys.ArrowDown) y -= 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  const sprinting = () => testInput.active ? testInput.sprint === true : (keys.ShiftLeft || keys.ShiftRight || stick.sprint === true);

  // Touch joystick (160px) + big buttons (88px).
  const stickEl = document.getElementById('stick');
  const nub = document.getElementById('stick-nub');
  let stickId = null;
  function stickMove(e) {
    const r = stickEl.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    stick.x = dx; stick.y = -dy;
    nub.style.left = (56 + dx * 52) + 'px';
    nub.style.top = (56 + dy * 52) + 'px';
  }
  stickEl.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stickEl.setPointerCapture(stickId); stickMove(e); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null; stick.x = 0; stick.y = 0;
    nub.style.left = '56px'; nub.style.top = '56px';
  };
  stickEl.addEventListener('pointerup', stickEnd);
  stickEl.addEventListener('pointercancel', stickEnd);
  document.getElementById('tb-enter').addEventListener('click', tryEnterExit);
  document.getElementById('tb-sprint').addEventListener('pointerdown', () => { stick.sprint = true; });
  document.getElementById('tb-sprint').addEventListener('pointerup', () => { stick.sprint = false; });
  document.getElementById('tb-horn').addEventListener('click', () => audio.sounds.horn());

  // --- UI -----------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2600);
  }
  function setBanner(msg) {
    const b = $('banner');
    if (!msg) { b.style.display = 'none'; return; }
    b.textContent = msg; b.style.display = 'block';
  }
  function syncSettings() {
    $('set-sound').checked = !audio.isMuted();
  }
  $('set-sound').addEventListener('change', (e) => audio.setMuted(!e.target.checked));
  $('set-shadows').addEventListener('change', (e) => { renderer.shadowMap.enabled = e.target.checked; });
  $('set-quality').addEventListener('change', (e) => {
    renderer.setPixelRatio(e.target.value === 'low' ? 1 : Math.min(devicePixelRatio, 2));
  });
  $('menu-story').textContent = STORY[state.missionIndex] || STORY[0];
  const savedNote = $('menu-save');
  try {
    const s = JSON.parse(localStorage.getItem('solmar-save') || 'null');
    if (s) savedNote.textContent = `Save found: ${fmt(s.cash)} · mission ${((s.missionIndex ?? 0) + 1)} of 5`;
  } catch (e) {}

  function showEnd(win, text) {
    state.over = true; state.won = win;
    $('end-title').textContent = win ? 'You win' : 'Busted';
    $('end-text').textContent = text;
    $('end').classList.remove('hidden');
    if (win) audio.sounds.win(); else audio.sounds.lose();
    save();
  }
  function resetSaveAndMenu() {
    try { localStorage.removeItem('solmar-save'); } catch (e) {}
    location.search = '?scene=menu';
  }
  $('btn-again').addEventListener('click', () => { if (state.wonRich || !state.won) resetSaveAndMenu(); });
  $('btn-play').addEventListener('click', () => { audio.unlock(); audio.sounds.click(); startPlaying(); });
  $('btn-how').addEventListener('click', () => { $('how').classList.toggle('hidden'); });
  $('btn-settings').addEventListener('click', () => { $('settings').classList.toggle('hidden'); });
  function togglePause() {
    if (!state.playing) return;
    state.paused = !state.paused;
    toast(state.paused ? 'Paused' : 'Resumed');
  }

  function startPlaying() {
    $('menu').classList.add('hidden');
    state.playing = true;
    state.paused = false;
    audio.unlock();
    if (sceneName === 'mission' || state.missionIndex < MISSIONS.length) startMission(state.missionIndex);
    toast('Solmar City — earn $50,000 to win');
  }

  // --- missions -----------------------------------------------------------
  function clearMarker() {
    if (marker) { scene.remove(marker); marker = null; }
  }
  function placeMarker(x, z, color) {
    clearMarker();
    marker = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 8),
      new THREE.MeshBasicMaterial({ color: color || 0xffd34d }));
    pole.position.y = 7;
    marker.add(pole);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 32),
      new THREE.MeshBasicMaterial({ color: color || 0xffd34d, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    marker.add(ring);
    marker.position.set(x, 0, z);
    scene.add(marker);
  }
  function startMission(i) {
    const m = MISSIONS[i];
    if (!m) return;
    state.missionIndex = i;
    state.missionActive = true;
    state.dropsLeft = m.drops ? m.drops.length : 0;
    state.dropsHit = [];
    $('menu-story').textContent = STORY[i];
    if (m.drops) placeMarker(m.drops[0][0], m.drops[0][1]);
    else if (!m.loseCops) placeMarker(m.x, m.z);
    else clearMarker();
    $('hud-mission').textContent = `Mission ${m.id}/5: ${m.title}`;
    toast(`Mission ${m.id}: ${m.title}`);
    if (m.loseCops && state.wanted < 2) setWanted(2);
  }
  function restartMission() {
    if (!state.missionActive) return;
    startMission(state.missionIndex);
    toast('Mission restarted');
  }
  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    state.cash += m.pay;
    audio.sounds.cash();
    toast(`Mission complete — +${fmt(m.pay)}`);
    state.missionActive = false;
    clearMarker();
    state.missionIndex++;
    save();
    checkWin();
    if (!state.over && state.missionIndex < MISSIONS.length) {
      setTimeout(() => startMission(state.missionIndex), 1200);
    } else if (!state.over) {
      $('hud-mission').textContent = 'All missions done — free roam';
    }
  }
  function checkWin() {
    if (state.cash >= RICH_CASH && !state.wonRich) {
      state.wonRich = true;
      showEnd(true, `Rosa is free. ${fmt(state.cash)} — the $100,000 dream, done.`);
    } else if (state.cash >= WIN_CASH && !state.won) {
      showEnd(true, `+$50,000 earned — ${fmt(state.cash)} banked. Rosa's rent is covered.`);
      // Let the player keep chasing $100,000 from the win screen.
      const again = $('btn-again');
      again.textContent = 'Keep playing for $100,000';
      again.onclick = () => {
        $('end').classList.add('hidden');
        state.over = false;
        again.textContent = 'Play again';
        again.onclick = () => { try { localStorage.removeItem('solmar-save'); } catch (e) {} location.search = '?scene=menu'; };
      };
    }
  }

  // --- wanted / police ----------------------------------------------------
  function setWanted(n) {
    const before = state.wanted;
    state.wanted = clamp(n, 0, 5);
    if (state.wanted > before && state.wanted >= 1) audio.sounds.siren();
    updateWantedHud();
  }
  function updateWantedHud() {
    $('hud-wanted').textContent = state.wanted > 0 ? '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted) + ' WANTED' : '';
  }
  function spawnPolice() {
    const type = VEHICLE_TYPES.find((t) => t.key === 'police');
    const v = makeVehicle(type, player.x + 30, player.z + 30, 0);
    scene.add(v.mesh);
    policeCars.push(v);
    audio.sounds.siren();
  }
  function stepPolice(dt) {
    const want = Math.min(state.wanted, 3);
    while (policeCars.length < want) spawnPolice();
    while (policeCars.length > want) {
      const v = policeCars.pop();
      scene.remove(v.mesh);
    }
    for (const v of policeCars) {
      const dx = player.x - v.x, dz = player.z - v.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
      v.speed = Math.min(v.speed + 14 * dt, 30);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;
      if (d < 3.2) {
        // Ram: damage + push.
        state.health = Math.max(0, state.health - 12 * dt);
        audio.sounds.crash();
        if (car) { car.speed *= 0.6; }
        if (state.health <= 0) {
          showEnd(false, 'Busted — the Solmar PD caught you. Rosa is still waiting.');
        }
      }
    }
  }

  // --- enter / exit car ---------------------------------------------------
  function nearestParked() {
    let best = null, bd = 6;
    for (const v of parked) {
      const d = dist2d(player.x, player.z, v.x, v.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function tryEnterExit() {
    if (!state.playing || state.paused || state.over) return;
    if (car) {
      // Exit beside the car.
      player.x = car.x + Math.cos(car.heading) * 2.5;
      player.z = car.z - Math.sin(car.heading) * 2.5;
      player.heading = car.heading;
      car = null;
      playerMesh.visible = true;
      toast('On foot');
      return;
    }
    const v = nearestParked();
    if (v) {
      car = v;
      parked.splice(parked.indexOf(v), 1);
      v.parked = false;
      v.speed = 0;
      playerMesh.visible = false;
      setWanted(state.wanted + 1);
      audio.sounds.engine();
      toast(`Stole a ${v.type.label} — wanted up! Chop shop downtown pays $2,000`);
    } else {
      toast('No car nearby — parked cars glow on the map');
    }
  }

  // --- chop shop: sell a stolen car downtown ------------------------------
  const CHOP = { x: 112, z: -56 };
  const chopRing = new THREE.Mesh(new THREE.RingGeometry(4, 5.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x2aff7a, side: THREE.DoubleSide }));
  chopRing.rotation.x = -Math.PI / 2;
  chopRing.position.set(CHOP.x, 0.1, CHOP.z);
  scene.add(chopRing);

  // --- minimap (north-up: -z is up; only the arrow rotates) --------------
  const mapCtx = $('map').getContext('2d');
  function drawMap() {
    const S = 168, C = S / 2, k = S / 420;
    mapCtx.fillStyle = '#12233a';
    mapCtx.fillRect(0, 0, S, S);
    mapCtx.strokeStyle = '#3a4a63';
    mapCtx.lineWidth = 5;
    for (let i = -3; i <= 3; i++) {
      const c = C + i * 56 * k;
      mapCtx.beginPath(); mapCtx.moveTo(c, 0); mapCtx.lineTo(c, S); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, c); mapCtx.lineTo(S, c); mapCtx.stroke();
    }
    // Parks
    mapCtx.fillStyle = '#2f7a33';
    for (const [px, pz] of [[-84, 84], [84, 28]]) mapCtx.fillRect(C + (px - 20) * k, C + (pz - 20) * k, 40 * k, 40 * k);
    // Hospital (red cross) + police (blue) + house (yellow)
    const dot = (x, z, color, r) => {
      mapCtx.fillStyle = color;
      mapCtx.beginPath(); mapCtx.arc(C + x * k, C + z * k, r, 0, Math.PI * 2); mapCtx.fill();
    };
    dot(CITY.hospital.x, CITY.hospital.z, '#ff4444', 5);
    dot(CITY.police.x, CITY.police.z, '#4488ff', 5);
    dot(CITY.house.x, CITY.house.z, '#ffd34d', 4);
    dot(CHOP.x, CHOP.z, '#2aff7a', 4);
    if (marker) dot(marker.position.x, marker.position.z, '#ffd34d', 6);
    // Traffic dots
    mapCtx.fillStyle = '#cfd8ea';
    for (const v of traffic) { mapCtx.fillRect(C + v.x * k - 1, C + v.z * k - 1, 2, 2); }
    // Player arrow (rotates; map does not)
    const px = C + player.x * k, pz = C + player.z * k;
    const h = car ? car.heading : player.heading;
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(Math.PI - h); // heading 0 (+z, south) points down; north-up
    mapCtx.fillStyle = '#ff5a3c';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(-5, 6); mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    mapCtx.fillStyle = '#ffffff';
    mapCtx.font = 'bold 11px sans-serif';
    mapCtx.fillText('N', 6, 14);
  }

  // --- HUD ----------------------------------------------------------------
  function updateHud() {
    $('hud-cash').textContent = `${fmt(state.cash)}  ·  goal ${fmt(WIN_CASH)}`;
    $('hud-health').textContent = `HP ${Math.round(state.health)}${car ? ` · ${car.type.label} ${Math.round(Math.abs(car.speed) * 3.6)} km/h` : ''}`;
    if (!state.missionActive && state.missionIndex < MISSIONS.length) {
      $('hud-mission').textContent = `Free roam — mission ${state.missionIndex + 1}/5 ready (N starts it)`;
    }
  }

  // --- per-frame ----------------------------------------------------------
  const clock = new THREE.Clock();
  let trainT = 0;
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!state.playing || state.paused || state.over) {
      renderer.render(scene, camera);
      drawMap();
      return;
    }
    state.time += dt;

    // Traffic lights cycle.
    for (const l of world.lights) {
      l.timer += dt;
      const phase = (l.timer % 8) < 4;
      l.mat.color.setHex(phase ? 0x30d158 : 0xff3b30);
    }
    // Metro train loops the ring.
    trainT += dt * 0.045;
    const tt = trainT % 1;
    const R = world.loopR;
    let tx, tz, ty = world.railY + 1.6, trot = 0;
    if (tt < 0.25) { const u = tt / 0.25; tx = -R + u * 2 * R; tz = -R; trot = Math.PI / 2; }
    else if (tt < 0.5) { const u = (tt - 0.25) / 0.25; tx = R; tz = -R + u * 2 * R; trot = Math.PI; }
    else if (tt < 0.75) { const u = (tt - 0.5) / 0.25; tx = R - u * 2 * R; tz = R; trot = -Math.PI / 2; }
    else { const u = (tt - 0.75) / 0.25; tx = -R; tz = R - u * 2 * R; trot = 0; }
    world.train.position.set(tx, ty, tz);
    world.train.rotation.y = trot;

    stepTraffic(traffic, dt);

    // Pedestrians wander the sidewalks.
    for (const p of peds) {
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.x) > 175 || Math.abs(p.z) > 175) p.heading += Math.PI;
      if (Math.random() < 0.002) p.heading += (Math.random() - 0.5) * 1.4;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Hit by the player's car: wanted up, health fine, ped stumbles away.
      const px = car ? car.x : player.x, pz = car ? car.z : player.z;
      if (car && Math.abs(car.speed) > 3 && dist2d(p.x, p.z, px, pz) < 2.2) {
        setWanted(state.wanted + 2);
        audio.sounds.crash();
        p.heading += Math.PI / 2;
        p.x += Math.sin(p.heading) * 4;
        p.z += Math.cos(p.heading) * 4;
      }
    }

    const move = readMove();

    if (car) {
      // --- driving: character-relative steering per spec ------------------
      const steerAuthority = clamp(Math.abs(car.speed) / 8, 0.25, 1);
      car.heading -= move.x * STEER_RATE * steerAuthority * dt * Math.sign(car.speed || 1);
      const accel = move.y * 16;
      car.speed = clamp(car.speed + accel * dt, -12, car.type.top);
      car.speed *= (move.y === 0 ? Math.pow(0.4, dt) : Math.pow(0.92, dt));
      if (Math.abs(car.speed) < 0.05 && move.y === 0) car.speed = 0;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = clamp(car.x, -188, 188);
      car.z = clamp(car.z, -188, 188);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      player.x = car.x; player.z = car.z;
      if (Math.abs(car.speed) > 20 && Math.random() < dt * 0.1) audio.sounds.engine();
      // Chop shop sale.
      if (dist2d(car.x, car.z, CHOP.x, CHOP.z) < 6) {
        state.cash += 2000;
        audio.sounds.cash();
        toast('Chop shop paid $2,000 for the car');
        scene.remove(car.mesh);
        car = null;
        playerMesh.visible = true;
        player.x = CHOP.x + 8; player.z = CHOP.z + 8;
        checkWin();
        save();
      }
    } else {
      // --- on foot: stick Y along own facing, stick X turns ---------------
      player.heading -= move.x * TURN_RATE * dt;
      const speed = sprinting() ? SPRINT_SPEED : WALK_SPEED;
      const fwd = move.y;
      player.x += Math.sin(player.heading) * fwd * speed * dt;
      player.z += Math.cos(player.heading) * fwd * speed * dt;
      player.x = clamp(player.x, -188, 188);
      player.z = clamp(player.z, -188, 188);
      player.speed = Math.abs(fwd) * speed;
      if (fwd !== 0 && Math.random() < dt * 2) audio.sounds.step();
    }

    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;

    // Hospital refills health.
    if (dist2d(player.x, player.z, CITY.hospital.x, CITY.hospital.z) < 16) {
      state.healTimer += dt;
      if (state.health < 100 && state.healTimer > 1) {
        state.health = 100;
        state.healTimer = 0;
        audio.sounds.heal();
        toast('Hospital — health refilled');
      }
    } else state.healTimer = 0;

    // Wanted decay when police are far.
    if (state.wanted > 0) {
      state.decayTimer += dt;
      const nearCop = policeCars.some((v) => dist2d(v.x, v.z, player.x, player.z) < 40);
      if (!nearCop && state.decayTimer > 20) {
        setWanted(state.wanted - 1);
        state.decayTimer = 0;
      }
    } else state.decayTimer = 0;

    stepPolice(dt);
    stepHelicopter(heli, player.x, player.z, dt, state.wanted >= 3);

    // Mission progress.
    if (state.missionActive) {
      const m = MISSIONS[state.missionIndex];
      if (m) {
        if (m.loseCops) {
          if (state.wanted === 0) completeMission();
        } else if (m.drops) {
          const target = m.drops[state.dropsHit.length];
          if (target && dist2d(player.x, player.z, target[0], target[1]) < 7) {
            state.dropsHit.push(target);
            audio.sounds.cash();
            toast(`Drop ${state.dropsHit.length}/3 collected`);
            if (state.dropsHit.length >= m.drops.length) completeMission();
            else placeMarker(m.drops[state.dropsHit.length][0], m.drops[state.dropsHit.length][1]);
          }
        } else if (dist2d(player.x, player.z, m.x, m.z) < 7) {
          completeMission();
        }
      }
    }

    // Camera: chase behind the heading, smooth.
    const head = car ? car.heading : player.heading;
    const fx = Math.sin(head), fz = Math.cos(head);
    const dist = car ? 13 : 9;
    const wantPos = new THREE.Vector3(
      player.x - fx * dist, car ? 5.5 : 4.5, player.z - fz * dist);
    camera.position.lerp(wantPos, 1 - Math.pow(0.001, dt));
    camera.lookAt(player.x + fx * 4, 1.6, player.z + fz * 4);

    // Autosave every 10s.
    state.saveTimer += dt;
    if (state.saveTimer > 10) { state.saveTimer = 0; save(); }

    updateHud();
    drawMap();
    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // Mission start key (M is mute; use N for next mission prompt).
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyN' && state.playing && !state.missionActive && state.missionIndex < MISSIONS.length) {
      startMission(state.missionIndex);
    }
  });

  // --- scene presets ------------------------------------------------------
  if (sceneName === 'chase') {
    player.x = 0; player.z = -40; player.heading = Math.PI;
    setWanted(3);
    startPlaying();
    $('menu').classList.add('hidden');
  } else if (sceneName === 'downtown') {
    player.x = 0; player.z = -70; player.heading = Math.PI;
    startPlaying();
  } else if (sceneName === 'mission') {
    player.x = -60; player.z = 60; player.heading = Math.PI * 0.75;
    startPlaying();
  } else {
    // menu: camera orbits the spawn street behind the menu overlay.
    state.playing = false;
    camera.position.set(0, 26, 150);
    camera.lookAt(0, 2, 110);
  }

  updateWantedHud();
  updateHud();
  drawMap();
  tick();

  // Headless-test hooks (also handy for debugging in the console).
  window.__solmar = {
    state, player,
    get car() { return car; },
    get parked() { return parked; },
    get police() { return policeCars; },
    setTestInput(x, y, sprint) { testInput.x = x; testInput.y = y; testInput.sprint = !!sprint; testInput.active = true; },
    clearTestInput() { testInput.active = false; testInput.x = 0; testInput.y = 0; },
    enterCar() { tryEnterExit(); },
    startPlaying,
    setWanted,
    version: 'solmar-heat-v3',
  };
  return window.__solmar;
}
