// SOLMAR HEAT — vehicles: types, traffic AI, player driving, drawing.
// Every vehicle is a top-down shape with its own silhouette, colour and feel.

import { VEHICLES, ROAD_W, ROAD_LINES, WORLD, clamp, angleDiff, rand, randi, pick, dist } from './config.js';
import { onRoad, nearestRoadLine, resolveSolids } from './city.js';

let nextId = 1;

export function makeVehicle(type, x, y, angle, ai) {
  const def = VEHICLES[type];
  return {
    id: nextId++,
    type, name: def.name,
    x, y, angle, speed: 0,
    len: def.len, wid: def.wid,
    maxSpeed: def.maxSpeed, accel: def.accel, turn: def.turn,
    color: def.color, color2: def.color2,
    ai: ai || null, // null = player driven, 'traffic' | 'police' | 'parked'
    axis: 'x', line: 0, dir: 1, lane: 16,
    hp: 100, brake: false, siren: false,
    steer: 0, throttle: 0, damageFlash: 0,
  };
}

export function spawnTraffic(city, n) {
  const out = [];
  const types = ['sedan', 'sedan', 'taxi', 'pickup', 'truck', 'sedan', 'taxi', 'sports'];
  for (let i = 0; i < n; i++) {
    const vertical = Math.random() < 0.5;
    const line = pick(ROAD_LINES);
    const along = rand(120, WORLD - 120);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const v = makeVehicle(pick(types),
      vertical ? line + (dir > 0 ? -16 : 16) : along,
      vertical ? along : line + (dir > 0 ? 16 : -16),
      vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), 'traffic');
    v.axis = vertical ? 'y' : 'x';
    v.line = line;
    v.dir = dir;
    v.lane = 16;
    v.speed = rand(90, 170);
    out.push(v);
  }
  return out;
}

export function spawnParked(city, n) {
  const out = [];
  const types = ['sedan', 'pickup', 'taxi', 'sports', 'scooter', 'bike', 'sedan', 'pickup'];
  for (let i = 0; i < n; i++) {
    if (i < 4) {
      const lot = pick(city.blocks.filter(b => b.kind === 'lot'));
      if (lot && lot.spots) {
        const s = pick(lot.spots);
        const v = makeVehicle(pick(types), s.x, s.y, s.angle, 'parked');
        out.push(v);
        continue;
      }
    }
    // Parked along a curb, facing the road direction.
    const vertical = Math.random() < 0.5;
    const line = pick(ROAD_LINES);
    const along = rand(200, WORLD - 200);
    const side = Math.random() < 0.5 ? 1 : -1;
    const off = ROAD_W / 2 - 14;
    const v = makeVehicle(pick(types),
      vertical ? line + side * off : along,
      vertical ? along : line + side * off,
      vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI), 'parked');
    out.push(v);
  }
  return out;
}

function lightAt(city, x, y) {
  for (const l of city.lights) {
    if (Math.abs(l.x - x) < 46 && Math.abs(l.y - y) < 46) return l;
  }
  return null;
}

function carAheadInLane(G, v, range) {
  let best = null, bestD = range;
  for (const o of G.vehicles) {
    if (o === v || o.ai === 'parked') continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const along = v.axis === 'x' ? dx * v.dir : dy * v.dir;
    const side = v.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
    if (along > 0 && along < bestD && side < 30) { best = o; bestD = along; }
  }
  return best;
}

export function updateTraffic(G, dt) {
  for (const v of G.vehicles) {
    if (v.ai !== 'traffic') continue;
    let target = 150; // cruise speed base
    // Red light: stop before the intersection when our axis is red.
    const ahead = v.axis === 'x' ? v.x + v.dir * 78 : v.y + v.dir * 78;
    const cx = v.axis === 'x' ? ahead : v.x;
    const cy = v.axis === 'x' ? v.y : ahead;
    const light = lightAt(G.city, cx, cy);
    if (light) {
      const greenForMe = v.axis === 'y' ? light.nsGreen : !light.nsGreen;
      if (!greenForMe) target = 0;
    }
    // Car ahead: slow down or stop.
    const aheadCar = carAheadInLane(G, v, 90);
    if (aheadCar) {
      const gap = Math.abs(v.axis === 'x' ? aheadCar.x - v.x : aheadCar.y - v.y);
      target = Math.min(target, gap < 46 ? 0 : 60);
    }
    // Ease speed toward target.
    if (v.speed < target) v.speed = Math.min(target, v.speed + 160 * dt);
    else if (v.speed > target) v.speed = Math.max(target, v.speed - 320 * dt);
    // Move along the road.
    if (v.axis === 'x') v.x += v.dir * v.speed * dt;
    else v.y += v.dir * v.speed * dt;
    // Wrap around the world edge.
    if (v.x < 40) v.x = WORLD - 40;
    if (v.x > WORLD - 40) v.x = 40;
    if (v.y < 40) v.y = WORLD - 40;
    if (v.y > WORLD - 40) v.y = 40;
    // At an intersection, sometimes turn onto the crossing road.
    const crossPos = v.axis === 'x' ? v.x : v.y;
    const crossLine = nearestRoadLine(crossPos);
    if (Math.abs(crossPos - crossLine) < 8) {
      if (Math.random() < 0.22) {
        const turnVertical = v.axis === 'x';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        v.axis = turnVertical ? 'y' : 'x';
        v.line = crossLine;
        v.dir = newDir;
        if (v.axis === 'x') { v.y = crossLine + (newDir > 0 ? 16 : -16); v.angle = newDir > 0 ? 0 : Math.PI; }
        else { v.x = crossLine + (newDir > 0 ? -16 : 16); v.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      }
    }
  }
}

// Player driving: arcade handling with a little drift.
export function driveVehicle(G, v, input, dt) {
  const def = VEHICLES[v.type];
  const onroad = onRoad(G.city, v.x, v.y);
  const top = def.maxSpeed * (onroad ? 1 : 0.55);
  const accel = input.up ? def.accel : 0;
  const brake = input.down ? def.accel * 1.4 : 0;
  if (input.up) v.speed = Math.min(top, v.speed + accel * dt);
  else if (input.down) v.speed = Math.max(-top * 0.35, v.speed - brake * dt);
  else {
    // coast down
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 140 * dt);
    if (Math.abs(v.speed) < 2) v.speed = 0;
  }
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerAmount = steerInput * def.turn * clamp(Math.abs(v.speed) / 120, 0, 1) * (v.speed >= 0 ? 1 : -1);
  v.angle += steerAmount * dt;
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  const pushed = resolveSolids(G.city, nx, ny, v.len * 0.42);
  const hitWall = Math.abs(pushed.x - nx) > 0.5 || Math.abs(pushed.y - ny) > 0.5;
  v.x = clamp(pushed.x, 30, WORLD - 30);
  v.y = clamp(pushed.y, 30, WORLD - 30);
  if (hitWall) {
    if (Math.abs(v.speed) > 200) {
      v.hp -= 6;
      v.damageFlash = 0.25;
      G.shake = Math.min(10, (G.shake || 0) + 5);
      if (G.sfx) G.sfx('crash');
    }
    v.speed *= 0.45;
  }
  v.brake = !!input.down;
}

// Simple circle push-apart between vehicles.
export function collideVehicles(G) {
  const list = G.vehicles;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const min = (a.len + b.len) * 0.32;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        if (a.ai !== 'parked') { a.x -= nx * push; a.y -= ny * push; }
        if (b.ai !== 'parked') { b.x += nx * push; b.y += ny * push; }
        if (a.ai === 'traffic' || b.ai === 'traffic') {
          const t = a.ai === 'traffic' ? a : b;
          t.speed *= 0.6;
        }
      }
    }
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawVehicle(ctx, v, time) {
  const def = VEHICLES[v.type];
  ctx.save();
  ctx.translate(v.x, v.y);
  // long golden-hour shadow
  ctx.save();
  ctx.translate(14, 22);
  ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  rr(ctx, -v.len / 2, -v.wid / 2, v.len, v.wid, 8);
  ctx.fill();
  ctx.restore();
  // headlight glow
  ctx.rotate(v.angle);
  const glow = ctx.createRadialGradient(v.len / 2, 0, 2, v.len / 2, 0, 60);
  glow.addColorStop(0, 'rgba(255,240,180,0.35)');
  glow.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(v.len / 2, -v.wid / 2);
  ctx.lineTo(v.len / 2 + 60, -26);
  ctx.lineTo(v.len / 2 + 60, 26);
  ctx.lineTo(v.len / 2, v.wid / 2);
  ctx.closePath();
  ctx.fill();
  // wheels
  ctx.fillStyle = '#16161a';
  const wy = v.wid / 2 - 2, wx = v.len / 2 - 12;
  ctx.fillRect(-wx - 4, -wy - 3, 12, 6);
  ctx.fillRect(wx - 8, -wy - 3, 12, 6);
  ctx.fillRect(-wx - 4, wy - 3, 12, 6);
  ctx.fillRect(wx - 8, wy - 3, 12, 6);
  // body
  ctx.fillStyle = v.damageFlash > 0 ? '#ff5a4a' : def.color;
  rr(ctx, -v.len / 2, -v.wid / 2, v.len, v.wid, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // type details
  if (v.type === 'taxi') {
    ctx.fillStyle = '#222';
    for (let i = 0; i < 6; i++) ctx.fillRect(-v.len / 2 + 6 + i * 7, -3, 4, 6);
    ctx.fillStyle = '#f2c200';
    ctx.fillRect(-8, -v.wid / 2 - 4, 16, 6);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -v.wid / 2 - 0.5);
  } else if (v.type === 'pickup') {
    ctx.fillStyle = def.color2;
    rr(ctx, -v.len / 2 + 6, -v.wid / 2 + 4, v.len * 0.38, v.wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    rr(ctx, v.len * 0.08, -v.wid / 2 + 5, v.len * 0.32, v.wid - 10, 4);
    ctx.fill();
  } else if (v.type === 'truck') {
    ctx.fillStyle = '#e8e6df';
    rr(ctx, -v.len / 2 + 4, -v.wid / 2 + 3, v.len * 0.62, v.wid - 6, 3);
    ctx.fill();
    ctx.fillStyle = '#8a8f98';
    ctx.fillRect(-v.len / 2 + 10, -v.wid / 2 + 7, v.len * 0.5, 3);
    ctx.fillStyle = '#20242c';
    rr(ctx, v.len * 0.22, -v.wid / 2 + 4, v.len * 0.22, v.wid - 8, 4);
    ctx.fill();
  } else if (v.type === 'sports') {
    ctx.fillStyle = def.color2;
    rr(ctx, -v.len * 0.12, -v.wid / 2 + 5, v.len * 0.4, v.wid - 10, 6);
    ctx.fill();
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(-v.len / 2 - 2, -v.wid / 2 + 2, 5, v.wid - 4); // spoiler
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(v.len / 2 - 3, -v.wid / 2 + 4, 3, 5);
    ctx.fillRect(v.len / 2 - 3, v.wid / 2 - 9, 3, 5);
  } else if (v.type === 'police') {
    ctx.fillStyle = '#f2f2f2';
    rr(ctx, -v.len / 2 + 8, -v.wid / 2 + 3, v.len * 0.55, v.wid - 6, 5);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-7, -v.wid / 2 - 3, 6, 4);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(1, -v.wid / 2 - 3, 6, 4);
  } else if (v.type === 'ambulance') {
    ctx.fillStyle = '#d92b2b';
    ctx.fillRect(-v.len * 0.2, -3, 7, 14);
    ctx.fillRect(-v.len * 0.2 - 3.5, 0.5, 14, 7);
    ctx.fillStyle = '#d92b2b';
    ctx.fillRect(-v.len / 2, -2, v.len, 4);
  } else if (v.type === 'bike' || v.type === 'scooter') {
    ctx.fillStyle = '#16161a';
    ctx.beginPath();
    ctx.arc(v.len / 2 - 6, 0, 4, 0, Math.PI * 2);
    ctx.arc(-v.len / 2 + 6, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b04a';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill(); // rider helmet
  } else {
    // sedan / generic: cabin + windshield
    ctx.fillStyle = def.color2;
    rr(ctx, -v.len * 0.14, -v.wid / 2 + 4, v.len * 0.34, v.wid - 8, 5);
    ctx.fill();
    ctx.fillStyle = '#bfe3ee';
    ctx.fillRect(v.len * 0.2, -v.wid / 2 + 5, 4, v.wid - 10);
    ctx.fillRect(-v.len * 0.18, -v.wid / 2 + 5, 4, v.wid - 10);
  }
  ctx.restore();
}

export function nearestVehicle(G, x, y, maxD, filter) {
  let best = null, bd = maxD;
  for (const v of G.vehicles) {
    if (filter && !filter(v)) continue;
    const d = dist(x, y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
