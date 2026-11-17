// SOLMAR HEAT — wanted level and police response.
// Stars rise with crime and fall when the player stays unseen; the PD sends
// pursuit cars and, on foot, officers who try to make an arrest.

import { WANTED_HEAT, HEAT_DECAY, WORLD, clamp, dist, angleTo, angleDiff, rand, pick } from './config.js';
import { makeVehicle, nearestVehicle } from './vehicles.js';
import { randomRoadPoint, resolveSolids } from './city.js';
import { hurtPlayer } from './player.js';

export function wantedFromHeat(heat) {
  let w = 0;
  for (let i = 1; i < WANTED_HEAT.length; i++) {
    if (heat >= WANTED_HEAT[i]) w = i;
  }
  return w;
}

export function updateWanted(G, dt) {
  // Heat decays when no police can see the player.
  const seen = G.policeCars.some(c => dist(c.x, c.y, G.player.x, G.player.y) < 320) ||
    G.officers.some(o => dist(o.x, o.y, G.player.x, G.player.y) < 200);
  if (!seen) G.heat = Math.max(0, G.heat - HEAT_DECAY * dt);
  const w = wantedFromHeat(G.heat);
  if (w !== G.wanted) {
    G.wanted = w;
    if (w > 0 && G.sfx) G.sfx('wanted');
    if (w === 0 && G.policeCars.length === 0) {
      G.message = 'You lost them. Stay clean.';
      G.messageT = 2.5;
    }
  }
  // Desired number of pursuit cars follows the wanted level.
  const want = G.wanted === 0 ? 0 : Math.min(4, G.wanted);
  if (G.policeCars.length < want) {
    const spot = randomRoadPoint();
    // Spawn a little way off, on a road.
    const a = angleTo(G.player.x, G.player.y, spot.x, spot.y);
    const d = dist(G.player.x, G.player.y, spot.x, spot.y);
    let sx = spot.x, sy = spot.y;
    if (d < 380) {
      sx = G.player.x + Math.cos(a) * 420;
      sy = G.player.y + Math.sin(a) * 420;
      sx = clamp(sx, 60, WORLD - 60);
      sy = clamp(sy, 60, WORLD - 60);
    }
    const car = makeVehicle('police', sx, sy, angleTo(sx, sy, G.player.x, G.player.y), 'police');
    car.siren = true;
    car.maxSpeed = 330 + G.wanted * 12;
    G.policeCars.push(car);
    G.vehicles.push(car);
  }
  // Drop pursuit cars that are far away once the heat is gone.
  if (G.wanted === 0) {
    for (const c of [...G.policeCars]) {
      if (dist(c.x, c.y, G.player.x, G.player.y) > 700) {
        G.policeCars = G.policeCars.filter(x => x !== c);
        G.vehicles = G.vehicles.filter(x => x !== c);
      }
    }
  }
}

export function updatePolice(G, dt) {
  const p = G.player;
  for (const car of [...G.policeCars]) {
    const d = dist(car.x, car.y, p.x, p.y);
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    // Steer toward the player, accelerate; ram when close.
    car.angle += clamp(angleDiff(car.angle, targetAngle), -2.4 * dt, 2.4 * dt);
    const wantSpeed = d > 60 ? car.maxSpeed : 120;
    car.speed = Math.min(wantSpeed, car.speed + 300 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const pushed = resolveSolids(G.city, nx, ny, car.len * 0.42);
    const hitWall = Math.abs(pushed.x - nx) > 0.5 || Math.abs(pushed.y - ny) > 0.5;
    car.x = clamp(pushed.x, 30, WORLD - 30);
    car.y = clamp(pushed.y, 30, WORLD - 30);
    if (hitWall) car.speed *= 0.4;
    car.damageFlash = Math.max(0, car.damageFlash - dt);
    // Ram the player's car.
    if (!p.onFoot && p.vehicle && d < (car.len + p.vehicle.len) * 0.42) {
      p.vehicle.hp -= 22 * dt * 4;
      p.vehicle.damageFlash = 0.2;
      car.speed *= 0.5;
      G.shake = Math.min(10, (G.shake || 0) + 4);
      if (Math.random() < dt * 2 && G.sfx) G.sfx('crash');
      if (p.vehicle.hp <= 0) {
        p.vehicle.hp = 0;
        p.vehicle.speed = 0;
        G.message = 'Your car is wrecked — get out!';
        G.messageT = 2.5;
      }
    }
    // Ram the player on foot.
    if (p.onFoot && d < 26) {
      hurtPlayer(G, 18 * dt * 4, car.x, car.y);
      car.speed *= 0.5;
    }
    // Officer gets out when the player is on foot and the car is close.
    if (p.onFoot && d < 120 && G.officers.length < G.wanted + 1 && Math.random() < dt * 0.8) {
      G.officers.push({
        x: car.x + 20, y: car.y + 20, angle: targetAngle,
        speed: 155, hp: 50, arrest: 0, knock: 0, bob: rand(0, 6),
      });
      if (G.sfx) G.sfx('door');
    }
  }
  // Officers on foot chase and try to arrest.
  for (const o of [...G.officers]) {
    o.bob += dt * 10;
    o.knock = Math.max(0, (o.knock || 0) - dt);
    const d = dist(o.x, o.y, p.x, p.y);
    if (p.onFoot && p.hp > 0) {
      const a = angleTo(o.x, o.y, p.x, p.y);
      o.angle = a;
      const sp = o.knock > 0 ? 0 : o.speed;
      const nx = o.x + Math.cos(a) * sp * dt;
      const ny = o.y + Math.sin(a) * sp * dt;
      const res = resolveSolids(G.city, nx, ny, 10);
      o.x = res.x;
      o.y = res.y;
      if (d < 24) {
        o.arrest += dt;
        if (o.arrest > 1.2) {
          bustPlayer(G);
          return;
        }
      } else {
        o.arrest = Math.max(0, o.arrest - dt * 2);
      }
      // Officer too far or player escaped in a car: give up.
      if (d > 600 || !p.onFoot) {
        G.officers = G.officers.filter(x => x !== o);
      }
    } else {
      G.officers = G.officers.filter(x => x !== o);
    }
  }
}

export function bustPlayer(G) {
  const fine = Math.min(G.cash, Math.max(200, Math.round(G.cash * 0.1)));
  G.cash -= fine;
  G.heat = 0;
  G.wanted = 0;
  G.policeCars = G.policeCars.filter(c => { G.vehicles = G.vehicles.filter(v => v !== c); return false; });
  G.officers = [];
  if (G.player.vehicle) {
    G.player.vehicle.ai = 'parked';
    G.player.vehicle.speed = 0;
    G.player.vehicle = null;
    G.player.onFoot = true;
  }
  const st = G.city.landmarks.police;
  G.player.x = st.x;
  G.player.y = st.y + 130;
  G.player.hp = 100;
  G.mode = 'busted';
  G.bustedFine = fine;
  if (G.sfx) G.sfx('busted');
}

export function wastePlayer(G) {
  const bill = Math.min(G.cash, 500);
  G.cash -= bill;
  G.heat = 0;
  G.wanted = 0;
  G.policeCars = G.policeCars.filter(c => { G.vehicles = G.vehicles.filter(v => v !== c); return false; });
  G.officers = [];
  if (G.player.vehicle) {
    G.player.vehicle.ai = 'parked';
    G.player.vehicle.speed = 0;
    G.player.vehicle = null;
    G.player.onFoot = true;
  }
  const h = G.city.landmarks.hospital;
  G.player.x = h.x;
  G.player.y = h.y + 140;
  G.player.hp = 100;
  G.mode = 'wasted';
  G.wastedBill = bill;
  if (G.sfx) G.sfx('wasted');
}

export function drawOfficer(ctx, o, time) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(5, 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(o.angle);
  const bob = Math.sin(o.bob) * 2;
  ctx.strokeStyle = '#1c2a4a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.lineTo(-10, bob);
  ctx.moveTo(4, 0); ctx.lineTo(10, -bob);
  ctx.stroke();
  ctx.fillStyle = '#1c2a4a';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b04a';
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c2a4a';
  ctx.fillRect(-3, -11, 6, 4); // cap
  if (o.arrest > 0.3) {
    ctx.fillStyle = '#ff2e2e';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -18);
  }
  ctx.restore();
}
