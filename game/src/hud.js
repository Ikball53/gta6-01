// SOLMAR HEAT — the HUD. Small text, top-left, English only. The minimap
// is NORTH-UP and never rotates: the streets stay fixed and only the
// player arrow turns, so the map always reads the same way.

export function hudRefs() {
  return {
    money: document.getElementById('money'),
    healthFill: document.getElementById('health-fill'),
    stars: document.getElementById('stars'),
    objective: document.getElementById('objective'),
    speed: document.getElementById('speed'),
    toast: document.getElementById('toast'),
    map: document.getElementById('minimap'),
    menu: document.getElementById('menu'),
    end: document.getElementById('end'),
    endTitle: document.getElementById('end-title'),
    endText: document.getElementById('end-text'),
  };
}

let toastTimer = 0;
export function showToast(refs, text) {
  refs.toast.textContent = text;
  refs.toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { refs.toast.style.opacity = '0'; }, 3200);
}

export function updateHud(S, refs) {
  refs.money.textContent = '$' + Math.floor(S.money).toLocaleString('en-US');
  refs.healthFill.style.width = Math.max(0, S.health) + '%';
  refs.healthFill.style.background = S.health > 50 ? '#4caf50' : S.health > 25 ? '#ff9800' : '#e53935';
  refs.stars.textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
  refs.stars.style.color = S.wanted > 0 ? '#ff5252' : '#cfd8dc';
  refs.objective.textContent = S.objective;
  if (S.inCar) {
    refs.speed.style.display = 'block';
    refs.speed.textContent = Math.round(Math.abs(S.carSpeed) * 3.6) + ' km/h · ' + S.inCar.def.name;
  } else {
    refs.speed.style.display = 'none';
  }
}

// Draw the minimap: the painted ground as the base, then blips. The canvas
// is 168 px for a 420 m city; north (+z is down on the map) never moves.
export function drawMinimap(refs, mapCanvas, S, city, markers, policeCars, peds) {
  const ctx = refs.map.getContext('2d');
  const W = refs.map.width;
  const scale = W / 420;
  const toX = x => (x + 210) * scale;
  const toY = z => (z + 210) * scale;
  ctx.clearRect(0, 0, W, W);
  ctx.drawImage(mapCanvas, 0, 0, W, W);
  // Mission marker.
  const stop = markers && markers.stop;
  if (stop) {
    ctx.fillStyle = '#f2c200';
    ctx.beginPath(); ctx.arc(toX(stop.x), toY(stop.z), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Rosa.
  ctx.fillStyle = '#e0609e';
  ctx.beginPath(); ctx.arc(toX(city.rosa.x), toY(city.rosa.z), 4, 0, Math.PI * 2); ctx.fill();
  // Hospital.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(toX(city.hospital.x) - 4, toY(city.hospital.z) - 1.5, 8, 3);
  ctx.fillRect(toX(city.hospital.x) - 1.5, toY(city.hospital.z) - 4, 3, 8);
  // Police cars, blue dots.
  ctx.fillStyle = '#2244ff';
  for (const c of policeCars || []) {
    ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow: tip ahead, base behind, computed from the heading so the
  // arrow turns while the map stays north-up.
  const px = S.inCar ? S.inCar.x : S.player.x;
  const pz = S.inCar ? S.inCar.z : S.player.z;
  const h = S.inCar ? S.inCar.heading : S.player.heading;
  const fx = Math.sin(h), fz = Math.cos(h);
  const cx = toX(px), cy = toY(pz);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + fx * 9, cy + fz * 9);
  ctx.lineTo(cx - fz * 5 - fx * 6, cy + fx * 5 - fz * 6);
  ctx.lineTo(cx + fz * 5 - fx * 6, cy - fx * 5 - fz * 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

export function showEnd(refs, title, text) {
  refs.endTitle.textContent = title;
  refs.endText.textContent = text;
  refs.end.style.display = 'flex';
}

export function hideEnd(refs) {
  refs.end.style.display = 'none';
}
