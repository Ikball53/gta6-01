// SOLMAR HEAT — the player: on-foot movement, stealing cars, punching,
// shooting, health. The player is Rex Vega, a driver for hire in Solmar City.

import { PLAYER, WORLD, CRIME_HEAT, clamp, dist, angleTo, angleDiff, rand } from './config.js';
import { resolveSolids, pointInSolid } from './city.js';
import { nearestVehicle, driveVehicle } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

export function makePlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, angle: -Math.PI / 2,
    speed: 0, onFoot: true, vehicle: null,
    hp: PLAYER.maxHealth, ammo: PLAYER.startAmmo,
    punchCd: 0, shootCd: 0, punchAnim: 0, hurtCd: 0,
    lastDamage: -99, facing: -Math.PI / 2,
  };
}

function segmentHit(ax, ay, bx, by, px, py, r) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cy = ay + dy * t;
  return dist(cx, cy, px, py) < r;
}

export function addHeat(G, amount) {
  G.heat = Math.min(400, (G.heat || 0) + amount);
}

export function updatePlayer(G, input, dt) {
  const p = G.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  G.gunshotFlash = Math.max(0, (G.gunshotFlash || 0) - dt);

  // Slow health recovery after 10 calm seconds.
  if (G.time - p.lastDamage > 10 && p.hp > 0 && p.hp < PLAYER.maxHealth) {
    p.hp = Math.min(PLAYER.maxHealth, p.hp + 4 * dt);
  }

  if (!p.onFoot && p.vehicle) {
    driveVehicle(G, p.vehicle, input, dt);
    p.x = p.vehicle.x;
    p.y = p.vehicle.y;
    p.angle = p.vehicle.angle;
    p.facing = p.vehicle.angle;
    if (input.enter) {
      exitVehicle(G);
      input.enter = false;
    }
    return;
  }

  // On foot.
  const run = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const mag = Math.hypot(mx, my);
  if (mag > 0) {
    mx /= mag; my /= mag;
    p.speed = run;
    p.angle = Math.atan2(my, mx);
    p.facing = p.angle;
    const nx = p.x + mx * run * dt;
    const ny = p.y + my * run * dt;
    const res = resolveSolids(G.city, nx, ny, PLAYER.radius);
    p.x = clamp(res.x, 20, WORLD - 20);
    p.y = clamp(res.y, 20, WORLD - 20);
  } else {
    p.speed = 0;
  }

  // Aim at the mouse when the mouse is down or recently moved.
  if (input.mouseDown || input.aim) {
    p.facing = angleTo(p.x, p.y, input.mouseWorldX, input.mouseWorldY);
  }

  if (input.enter) {
    enterVehicle(G);
    input.enter = false;
  }
  if (input.punch && p.punchCd <= 0) {
    punch(G);
  }
  if (input.mouseDown && p.shootCd <= 0) {
    shoot(G);
  }

  if (p.hp <= 0) {
    G.mode = 'wasted';
    if (G.sfx) G.sfx('wasted');
  }
}

function enterVehicle(G) {
  const p = G.player;
  const v = nearestVehicle(G, p.x, p.y, 52, vv => vv.ai !== null || true);
  if (!v) return;
  if (v.type === 'police') addHeat(G, 40);
  else if (v.type === 'ambulance') addHeat(G, 30);
  else if (v.ai === 'traffic') addHeat(G, CRIME_HEAT.stealCar);
  p.vehicle = v;
  p.onFoot = false;
  v.ai = null;
  v.driver = 'player';
  if (G.sfx) G.sfx('door');
  G.message = 'Driving the ' + v.name;
  G.messageT = 2;
}

export function exitVehicle(G) {
  const p = G.player;
  const v = p.vehicle;
  if (!v) return;
  v.speed = 0;
  v.ai = 'parked';
  v.driver = null;
  const side = p.facing + Math.PI / 2;
  const nx = v.x + Math.cos(side) * (v.wid / 2 + 16);
  const ny = v.y + Math.sin(side) * (v.wid / 2 + 16);
  const res = resolveSolids(G.city, nx, ny, PLAYER.radius);
  p.x = res.x;
  p.y = res.y;
  p.onFoot = true;
  p.vehicle = null;
  p.angle = p.facing;
  if (G.sfx) G.sfx('door');
}

function punch(G) {
  const p = G.player;
  p.punchCd = 0.45;
  p.punchAnim = 0.3;
  if (G.sfx) G.sfx('punch');
  const reach = 34;
  const hx = p.x + Math.cos(p.facing) * reach;
  const hy = p.y + Math.sin(p.facing) * reach;
  let hitSomething = false;
  for (const ped of G.peds) {
    if (dist(hx, hy, ped.x, ped.y) < 20) {
      ped.flee = 3;
      ped.angle = angleTo(p.x, p.y, ped.x, ped.y);
      addHeat(G, CRIME_HEAT.punchPed);
      hitSomething = true;
    }
  }
  for (const o of G.officers) {
    if (dist(hx, hy, o.x, o.y) < 22) {
      o.hp -= PLAYER.punchDamage;
      o.knock = 0.3;
      addHeat(G, CRIME_HEAT.punchCop);
      hitSomething = true;
      if (o.hp <= 0) {
        G.officers = G.officers.filter(x => x !== o);
        G.cash = Math.max(0, G.cash - 0);
        G.message = 'Officer down. The PD will remember this.';
        G.messageT = 2.5;
      }
    }
  }
  for (const r of G.rivals) {
    if (dist(hx, hy, r.x, r.y) < 22) {
      r.hp -= PLAYER.punchDamage;
      r.knock = 0.3;
      hitSomething = true;
      if (r.hp <= 0) {
        G.rivals = G.rivals.filter(x => x !== r);
        G.missionKill = (G.missionKill || 0) + 1;
      }
    }
  }
  if (hitSomething) G.shake = Math.min(8, (G.shake || 0) + 3);
}

function shoot(G) {
  const p = G.player;
  if (p.ammo <= 0) {
    if (G.sfx) G.sfx('empty');
    p.shootCd = 0.3;
    G.message = 'Out of ammo — find ammo at the garage';
    G.messageT = 2;
    return;
  }
  p.ammo -= 1;
  p.shootCd = 0.28;
  G.gunshotFlash = 0.12;
  addHeat(G, CRIME_HEAT.shoot);
  if (G.sfx) G.sfx('shot');
  scarePeds(G, p.x, p.y, 260);
  const range = 420;
  const tx = p.x + Math.cos(p.facing) * range;
  const ty = p.y + Math.sin(p.facing) * range;
  G.tracers.push({ x1: p.x, y1: p.y, x2: tx, y2: ty, t: 0.12 });
  let endX = tx, endY = ty;
  // Hit the first thing along the shot line.
  const targets = [];
  for (const ped of G.peds) targets.push({ x: ped.x, y: ped.y, r: 16, kind: 'ped', ref: ped });
  for (const o of G.officers) targets.push({ x: o.x, y: o.y, r: 16, kind: 'officer', ref: o });
  for (const r of G.rivals) targets.push({ x: r.x, y: r.y, r: 16, kind: 'rival', ref: r });
  let bestD = range;
  let best = null;
  for (const t of targets) {
    if (segmentHit(p.x, p.y, tx, ty, t.x, t.y, t.r)) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
  }
  if (best) {
    endX = best.x; endY = best.y;
    G.tracers[G.tracers.length - 1].x2 = endX;
    G.tracers[G.tracers.length - 1].y2 = endY;
    if (best.kind === 'ped') {
      best.ref.flee = 4;
      best.ref.angle = angleTo(p.x, p.y, best.ref.x, best.ref.y);
      addHeat(G, CRIME_HEAT.killPed);
    } else if (best.kind === 'officer') {
      best.ref.hp -= PLAYER.pistolDamage;
      addHeat(G, CRIME_HEAT.punchCop);
      if (best.ref.hp <= 0) G.officers = G.officers.filter(x => x !== best.ref);
    } else if (best.kind === 'rival') {
      best.ref.hp -= PLAYER.pistolDamage;
      if (best.ref.hp <= 0) {
        G.rivals = G.rivals.filter(x => x !== best.ref);
        G.missionKill = (G.missionKill || 0) + 1;
      }
    }
  }
  // Shooting a car damages it.
  for (const v of G.vehicles) {
    if (segmentHit(p.x, p.y, endX, endY, v.x, v.y, v.len * 0.4)) {
      v.hp -= 12;
      v.damageFlash = 0.2;
      if (v.hp <= 0 && v.ai === 'traffic') {
        v.ai = 'parked';
        v.speed = 0;
        if (G.sfx) G.sfx('crash');
      }
      break;
    }
  }
}

export function hurtPlayer(G, amount, fromX, fromY) {
  const p = G.player;
  if (p.hurtCd > 0 || p.hp <= 0) return;
  p.hp -= amount;
  p.lastDamage = G.time;
  p.hurtCd = 0.5;
  G.shake = Math.min(10, (G.shake || 0) + 6);
  if (G.sfx) G.sfx('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = 'wasted';
    if (G.sfx) G.sfx('wasted');
  }
}

export function drawPlayer(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(5, 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = p.speed > 0 ? Math.sin(time * 12) * 2 : 0;
  ctx.rotate(p.facing);
  // legs
  ctx.strokeStyle = '#2c3e6b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-10, bob);
  ctx.moveTo(4, 0);
  ctx.lineTo(10, -bob);
  ctx.stroke();
  // body
  ctx.fillStyle = '#e8e6df';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(-2, -9, 4, 18); // jacket stripe
  // head
  ctx.fillStyle = '#e8b04a';
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // gun or fist
  if (p.punchAnim > 0) {
    ctx.fillStyle = '#e8b04a';
    ctx.beginPath();
    ctx.arc(16, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.ammo > 0) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
}
