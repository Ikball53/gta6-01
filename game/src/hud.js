// HUD for SOLMAR HEAT: mission card, cash/clock/stars, weapon slots,
// circular minimap, speedometer, dialogue box, menus and end screens.
// All in-game text is English, small, and kept in the corners.
import { WEAPONS } from './walker.js';
import { districtAt } from './city.js';

const $ = (id) => document.getElementById(id);

export function createHud(W) {
  const hud = {
    cash: $('hud-cash'), clock: $('hud-clock'), day: $('hud-day'),
    stars: $('hud-stars'), healthFill: $('health-fill'), healthNum: $('health-num'),
    armorFill: $('armor-fill'), district: $('hud-district'), street: $('hud-street'),
    mission: $('mission-card'), missionTitle: $('mission-title'),
    missionText: $('mission-text'), missionBar: $('mission-bar'),
    missionNext: $('mission-next'), missionDist: $('mission-dist'),
    dialogue: $('dialogue'), dlgName: $('dlg-name'), dlgText: $('dlg-text'),
    speedo: $('speedo'), speedNum: $('speed-num'), speedCar: $('speed-car'),
    weapons: $('weapon-slots'), minimap: $('minimap'),
    mapHeading: null, // smoothed heading for the minimap arrow (see updateHud)
    sayT: 0, sayQueue: [],
  };
  W.hud = hud;
  hud.mapCtx = hud.minimap.getContext('2d');
  // methods the game systems call through W.hud
  hud.say = (w, n, t, s) => say(w, n, t, s);
  hud.setMissionCard = (w, a, b, c, d, e) => setMissionCard(w, a, b, c, d, e);
  hud.setMissionDistance = (w, m) => setMissionDistance(w, m);
  hud.showScreen = (w, n) => showScreen(w, n);
  hud.hideScreens = (w) => hideScreens(w);
  // start screen buttons
  const play = $('btn-play');
  if (play) play.addEventListener('click', () => { W.sfx.ensure(); W.sfx.click(); startGame(W); });
  const how = $('btn-how');
  if (how) how.addEventListener('click', () => { W.sfx.click(); $('howto').classList.toggle('hidden'); });
  const settings = $('btn-settings');
  if (settings) settings.addEventListener('click', () => { W.sfx.click(); $('settings').classList.toggle('hidden'); });
  const muteBtn = $('btn-mute');
  if (muteBtn) muteBtn.addEventListener('click', () => {
    const m = W.sfx.toggleMute();
    muteBtn.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
    const s2 = $('settings-mute'); if (s2) s2.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
  });
  const mute2 = $('settings-mute');
  if (mute2) mute2.addEventListener('click', () => {
    const m = W.sfx.toggleMute();
    mute2.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
    if (muteBtn) muteBtn.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
  });
  const cont = $('btn-continue');
  if (cont) cont.addEventListener('click', () => { W.sfx.ensure(); W.sfx.click(); startGame(W); });
  // pause screen
  const resume = $('btn-resume');
  if (resume) resume.addEventListener('click', () => { W.sfx.click(); hideScreens(W); W.state = 'play'; });
  const saveBtn = $('btn-save');
  if (saveBtn) saveBtn.addEventListener('click', () => { W.saveNow && W.saveNow(); W.sfx.pickup(); saveBtn.textContent = 'SAVED'; setTimeout(() => { saveBtn.textContent = 'Save Game'; }, 1200); });
  const quit = $('btn-quit');
  if (quit) quit.addEventListener('click', () => { W.sfx.click(); hideScreens(W); W.state = 'menu'; showScreen(W, 'start'); });
  // end screens
  const again = $('btn-again');
  if (again) again.addEventListener('click', () => { W.sfx.click(); W.resetRun && W.resetRun(); });
  const menu2 = $('btn-menu2');
  if (menu2) menu2.addEventListener('click', () => { W.sfx.click(); hideScreens(W); W.state = 'menu'; showScreen(W, 'start'); });
  const bustedOk = $('btn-busted');
  if (bustedOk) bustedOk.addEventListener('click', () => { W.sfx.click(); W.resetRun && W.resetRun(); });
  const wastedOk = $('btn-wasted');
  if (wastedOk) wastedOk.addEventListener('click', () => { W.sfx.click(); W.resetRun && W.resetRun(); });
  // crosshair follows the mouse for aiming
  const cross = $('crosshair');
  if (cross) {
    window.addEventListener('mousemove', (e) => {
      cross.style.left = e.clientX + 'px';
      cross.style.top = e.clientY + 'px';
    });
  }
  return hud;
}

export function startGame(W) {
  hideScreens(W);
  W.state = 'play';
  if (W.jobs && !W.jobs.active && W.jobs.storyStage === 0 && !W.jobs.storyActive) {
    W.hud.setMissionCard(W, 'WELCOME TO SOLMAR', 'Head to Rosa\u2019s Diner to start the story — or take any glowing side-job pad.',
      0, 5, 'Rosa\u2019s Diner');
  }
  W.hud.say(W, 'ROSA', 'You made it. The city is yours — just do not get caught.');
}

export function showScreen(W, name) {
  hideScreens(W);
  const el = $('screen-' + name);
  if (el) el.classList.remove('hidden');
  if (name === 'win' || name === 'busted' || name === 'wasted') W.state = name;
  if (name === 'pause') {
    W.state = 'paused';
    drawPauseMap(W);
    updateStats(W);
  }
}

export function hideScreens(W) {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
}

export function say(W, name, text, secs) {
  const h = W.hud;
  h.sayQueue.push({ name, text, secs: secs || 5 });
  if (h.sayQueue.length === 1) showSay(W);
}
function showSay(W) {
  const h = W.hud;
  const item = h.sayQueue[0];
  if (!item) { h.dialogue.classList.add('hidden'); return; }
  h.dlgName.textContent = item.name;
  h.dlgText.textContent = item.text;
  h.dialogue.classList.remove('hidden');
  h.sayT = item.secs;
}

export function setMissionCard(W, title, text, stage, total, next) {
  const h = W.hud;
  if (!title) { h.mission.classList.add('hidden'); return; }
  h.mission.classList.remove('hidden');
  h.missionTitle.textContent = title;
  h.missionText.textContent = text || '';
  h.missionBar.style.width = total > 0 ? Math.round((stage / total) * 100) + '%' : '0%';
  h.missionNext.textContent = next || '';
  h._missionStage = stage; h._missionTotal = total;
}

export function setMissionDistance(W, meters) {
  const h = W.hud;
  if (h.missionDist) h.missionDist.textContent = meters + ' m';
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function updateHud(W, dt) {
  const h = W.hud;
  const P = W.player;
  // dialogue queue
  if (h.sayQueue.length > 0) {
    h.sayT -= dt;
    if (h.sayT <= 0) { h.sayQueue.shift(); showSay(W); }
  }
  // clock: 1 real second = 1 game minute
  W.timeMin = (W.timeMin || 0) + dt;
  if (W.timeMin >= 1) {
    W.timeMin -= 1;
    W.clockMin = (W.clockMin || 0) + 1;
    if (W.clockMin >= 60) {
      W.clockMin = 0;
      W.clockHour = (W.clockHour + 1) % 24;
      if (W.clockHour === 0) W.clockDay = (W.clockDay + 1) % 7;
    }
  }
  const hh = String(W.clockHour).padStart(2, '0');
  const mm = String(W.clockMin).padStart(2, '0');
  h.clock.textContent = `${hh}:${mm}`;
  h.day.textContent = DAYS[W.clockDay];
  h.cash.textContent = '$' + Math.floor(P.cash).toLocaleString('en-US');
  // wanted stars
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < P.wanted ? '★' : '☆';
  h.stars.textContent = stars;
  h.stars.className = 'stars' + (P.wanted >= 3 ? ' hot' : '');
  // health / armor
  h.healthFill.style.width = Math.max(0, P.health) + '%';
  h.healthNum.textContent = Math.max(0, Math.round(P.health));
  h.armorFill.style.width = Math.max(0, P.armor || 0) + '%';
  // district + street
  const px = P.inCar ? P.inCar.x : P.mesh.position.x;
  const pz = P.inCar ? P.inCar.z : P.mesh.position.z;
  const d = districtAt(W, px, pz);
  h.district.textContent = d.name.toUpperCase();
  h.street.textContent = d.street;
  // speedometer
  if (P.inCar) {
    h.speedo.classList.remove('hidden');
    h.speedNum.textContent = P.speedKmh || 0;
    h.speedCar.textContent = (P.inCar.name || P.inCar.type || 'CAR').toUpperCase();
  } else h.speedo.classList.add('hidden');
  // weapon slots
  if (h.weapons) {
    let html = '';
    WEAPONS.forEach((w, i) => {
      const ammo = P.ammo[i] === Infinity ? '∞' : `${P.ammo[i]}/${P.reserve[i]}`;
      html += `<div class="slot${i === P.weapon ? ' active' : ''}"><b>${i + 1}</b><span>${w.name}</span><em>${ammo}</em></div>`;
    });
    h.weapons.innerHTML = html;
  }
  // Minimap heading: a smoothed copy of the player's REAL heading only.
  // The joystick never feeds this value — the stick only moves the player,
  // and this chases the heading with frame-rate-independent smoothing, so
  // the arrow turns smoothly instead of snapping in stiff jumps (which is
  // what made the map look like it was spinning wildly on slow phones,
  // where dt*12 could jump most of the way in a single frame).
  const rawHeading = P.inCar ? P.inCar.heading : P.heading;
  if (h.mapHeading === null || h.mapHeading === undefined) h.mapHeading = rawHeading;
  let mdh = rawHeading - h.mapHeading;
  while (mdh > Math.PI) mdh -= Math.PI * 2;
  while (mdh < -Math.PI) mdh += Math.PI * 2;
  h.mapHeading += mdh * (1 - Math.exp(-dt * 7));
  drawMinimap(W);
}

function drawMinimap(W) {
  const h = W.hud;
  const ctx = h.mapCtx;
  if (!ctx) return;
  const S = 180, C = S / 2;
  const P = W.player;
  const px = P.inCar ? P.inCar.x : P.mesh.position.x;
  const pz = P.inCar ? P.inCar.z : P.mesh.position.z;
  const scale = S / 380; // whole city in the circle
  const toMap = (x, z) => [C + x * scale, C + z * scale];
  ctx.clearRect(0, 0, S, S);
  // clip to the circle
  ctx.save();
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.clip();
  // land + ocean
  ctx.fillStyle = '#5d7a4a'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2a6f8f';
  const [ox] = toMap(150, 0); ctx.fillRect(ox, 0, S - ox, S);
  ctx.fillStyle = '#e8c98a'; ctx.fillRect(ox - 8, 0, 8, S);
  // roads
  ctx.strokeStyle = '#33333d'; ctx.lineWidth = 5;
  for (const g of [-120, -80, -40, 0, 40, 80, 120]) {
    const [x1, y1] = toMap(g, -170); const [x2, y2] = toMap(g, 170);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [x3, y3] = toMap(-170, g); const [x4, y4] = toMap(170, g);
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
  }
  // metro loop
  ctx.strokeStyle = '#7ae0ff'; ctx.lineWidth = 2;
  ctx.strokeRect(...toMap(-60, -60), 120 * scale, 120 * scale);
  // mission marker
  if (W.jobs && W.jobs.marker && W.jobs.marker.visible) {
    const [mx, my] = toMap(W.jobs.marker.position.x, W.jobs.marker.position.z);
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.arc(mx, my, 5 + Math.sin(W.elapsed * 5) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.stroke();
  }
  // cops
  if (W.cops) {
    ctx.fillStyle = '#4a90ff';
    for (const u of W.cops.units) {
      if (u.dead) continue;
      const [cx, cy] = toMap(u.x, u.z);
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (W.cops.heli && W.cops.heli.visible) {
      const [hx, hy] = toMap(W.cops.heli.position.x, W.cops.heli.position.z);
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // traffic dots
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of (W.traffic || []).slice(0, 14)) {
    const [tx, ty] = toMap(c.x, c.z);
    ctx.fillRect(tx - 1, ty - 1, 2, 2);
  }
  // player arrow — the ONLY thing on the minimap that rotates (the map
  // itself stays north-up, N tick at the top). The arrow points along the
  // direction of travel: canvas y runs down, so the rotation is PI -
  // heading, not -heading — the old -heading pointed the arrow exactly
  // backwards, which is why it looked like the map was spinning wrong.
  const [plx, ply] = toMap(px, pz);
  const heading = (h.mapHeading !== null && h.mapHeading !== undefined)
    ? h.mapHeading : (P.inCar ? P.inCar.heading : P.heading);
  ctx.save();
  ctx.translate(plx, ply);
  ctx.rotate(Math.PI - heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // ring + north tick
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
  ctx.fillText('N', C, 16);
}

function drawPauseMap(W) {
  const cv = $('pause-map');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = 460;
  cv.width = S; cv.height = S;
  const scale = S / 380, C = S / 2;
  const toMap = (x, z) => [C + x * scale, C + z * scale];
  ctx.fillStyle = '#2a3a2e'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#5d7a4a'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2a6f8f';
  const [ox] = toMap(150, 0); ctx.fillRect(ox, 0, S - ox, S);
  ctx.strokeStyle = '#33333d'; ctx.lineWidth = 8;
  for (const g of [-120, -80, -40, 0, 40, 80, 120]) {
    const [x1, y1] = toMap(g, -170); const [x2, y2] = toMap(g, 170);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [x3, y3] = toMap(-170, g); const [x4, y4] = toMap(170, g);
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
  const labels = [['DOWNTOWN', 0, 0], ['CORAL SHORE', 140, 0], ['HILLSIDE', 0, 120], ['OLD TOWN', -110, 40], ['HARBOR', 80, -110]];
  for (const [t, x, z] of labels) { const [lx, ly] = toMap(x, z); ctx.fillText(t, lx, ly); }
  // spots
  const spots = [['R', '#ffd27a', W.city.spots.diner], ['H', '#ff6a6a', W.city.spots.hospital],
    ['P', '#4a90ff', W.city.spots.pd], ['$', '#7ae07a', W.city.spots.bank], ['⌂', '#fff', W.city.spots.house]];
  for (const [t, col, p] of spots) {
    const [sx, sy] = toMap(p.x, p.z);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillText(t, sx, sy + 5);
  }
  const P = W.player;
  const px = P.inCar ? P.inCar.x : P.mesh.position.x;
  const pz = P.inCar ? P.inCar.z : P.mesh.position.z;
  const [plx, ply] = toMap(px, pz);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(plx, ply, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = 'bold 11px Arial'; ctx.fillText('YOU', plx, ply + 4);
}

function updateStats(W) {
  const el = $('pause-stats');
  if (!el) return;
  const P = W.player;
  const j = W.jobs;
  const pct = Math.round((j.storyStage / 5) * 100);
  el.innerHTML =
    `<div class="stat-big">${pct}% COMPLETE</div>` +
    `<div>Story ${j.storyStage}/5 &nbsp;·&nbsp; Cash $${Math.floor(P.cash).toLocaleString('en-US')}</div>` +
    `<div>Health ${Math.round(P.health)} &nbsp;·&nbsp; Wanted ${'★'.repeat(P.wanted)}${'☆'.repeat(5 - P.wanted)}</div>` +
    `<div>Weapon ${WEAPONS[P.weapon].name} &nbsp;·&nbsp; ${P.inCar ? 'Driving ' + (P.inCar.name || P.inCar.type) : 'On foot'}</div>` +
    `<div class="legend">R Rosa · H Hospital · P Police · $ Bank · ⌂ Home</div>`;
}
