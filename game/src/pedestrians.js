// SOLMAR HEAT — pedestrians: sidewalk walkers who flee from trouble.

import { ROAD_W, ROAD_LINES, WORLD, rand, randi, pick, dist, angleTo } from './config.js';
import { pointInSolid } from './city.js';

const SKINS = ['#e8b04a', '#c98a6a', '#8a5a3b', '#f2d0a8', '#6a4a2e'];
const SHIRTS = ['#d94f3d', '#3d7dd9', '#4fae5a', '#e8c53d', '#8a4fd9', '#e87ab0', '#4fd9c9', '#f2f2f2'];

export function spawnPeds(city, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const vertical = Math.random() < 0.5;
    const line = pick(ROAD_LINES);
    const along = rand(100, WORLD - 100);
    const side = Math.random() < 0.5 ? 1 : -1;
    const off = ROAD_W / 2 + 12;
    const p = {
      x: vertical ? line + side * off : along,
      y: vertical ? along : line + side * off,
      angle: vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI),
      speed: rand(34, 62),
      skin: pick(SKINS), shirt: pick(SHIRTS),
      flee: 0, bob: rand(0, Math.PI * 2),
      axis: vertical ? 'y' : 'x',
      dir: Math.random() < 0.5 ? 1 : -1,
      wait: 0,
    };
    out.push(p);
  }
  return out;
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (dist(x, y, p.x, p.y) < radius) {
      p.flee = rand(1.5, 3);
      p.angle = angleTo(x, y, p.x, p.y);
    }
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x, py = G.player.y;
  const threat = G.player.vehicle || null;
  for (const p of G.peds) {
    p.bob += dt * (p.flee > 0 ? 14 : 7);
    if (p.flee > 0) {
      p.flee -= dt;
      const sp = 150;
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
      p.x = Math.max(20, Math.min(WORLD - 20, p.x));
      p.y = Math.max(20, Math.min(WORLD - 20, p.y));
      continue;
    }
    // A nearby speeding car or a gunshot scares them.
    const carNear = threat && dist(threat.x, threat.y, p.x, p.y) < 70 && Math.abs(threat.speed) > 200;
    const playerNear = !G.player.vehicle && dist(px, py, p.x, p.y) < 26;
    if (carNear || G.gunshotFlash > 0) {
      p.flee = rand(1.5, 3);
      p.angle = angleTo(threat ? threat.x : px, threat ? threat.y : py, p.x, p.y);
      continue;
    }
    if (playerNear) { p.wait = 0.4; }
    if (p.wait > 0) { p.wait -= dt; continue; }
    // Walk along the sidewalk; sometimes turn at an intersection.
    const step = p.speed * dt;
    if (p.axis === 'x') p.x += p.dir * step;
    else p.y += p.dir * step;
    const nearCross = Math.abs((p.axis === 'x' ? p.x : p.y) - nearestLine(p.axis === 'x' ? p.x : p.y)) < 4;
    if (nearCross && Math.random() < 0.004) {
      p.axis = p.axis === 'x' ? 'y' : 'x';
      p.dir = Math.random() < 0.5 ? 1 : -1;
      p.angle = p.axis === 'x' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    if (p.x < 30) { p.x = 30; p.dir = 1; p.angle = 0; }
    if (p.x > WORLD - 30) { p.x = WORLD - 30; p.dir = -1; p.angle = Math.PI; }
    if (p.y < 30) { p.y = 30; p.dir = 1; p.angle = Math.PI / 2; }
    if (p.y > WORLD - 30) { p.y = WORLD - 30; p.dir = -1; p.angle = -Math.PI / 2; }
    // Stay out of buildings.
    if (pointInSolid(G.city, p.x, p.y, 6)) {
      p.angle += Math.PI / 2;
      p.x -= Math.cos(p.angle) * step * 2;
      p.y -= Math.sin(p.angle) * step * 2;
    }
  }
}

function nearestLine(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const l of ROAD_LINES) {
    const d = Math.abs(v - l);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

export function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(6, 9, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(p.bob) * 1.5;
  // body
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 7, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 2, -9 + bob * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  // walking legs hint
  ctx.strokeStyle = '#2c2c34';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-3, 5);
  ctx.lineTo(-3 + Math.sin(p.bob) * 3, 11);
  ctx.moveTo(3, 5);
  ctx.lineTo(3 - Math.sin(p.bob) * 3, 11);
  ctx.stroke();
  ctx.restore();
}
