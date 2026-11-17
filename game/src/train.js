// SOLMAR HEAT — the elevated metro: a train that loops the city.
// The loop is a rectangle around the city; the train is an engine plus cars.

import { WORLD } from './config.js';

export function makeTrain(track) {
  const w = track.x1 - track.x0;
  const h = track.y1 - track.y0;
  const perimeter = 2 * (w + h);
  return {
    track, perimeter,
    dist: 0, speed: 58,
    cars: 4, carLen: 64, gap: 14,
  };
}

// Point on the rectangle loop at distance d from the start corner.
export function loopPoint(track, d) {
  const w = track.x1 - track.x0;
  const h = track.y1 - track.y0;
  const per = 2 * (w + h);
  let dd = ((d % per) + per) % per;
  if (dd < w) return { x: track.x0 + dd, y: track.y0, angle: 0 };
  dd -= w;
  if (dd < h) return { x: track.x1, y: track.y0 + dd, angle: Math.PI / 2 };
  dd -= h;
  if (dd < w) return { x: track.x1 - dd, y: track.y1, angle: Math.PI };
  dd -= w;
  return { x: track.x0, y: track.y1 - dd, angle: -Math.PI / 2 };
}

export function updateTrain(G, dt) {
  G.train.dist += G.train.speed * dt;
}

export function trainCarPositions(G) {
  const out = [];
  const step = G.train.carLen + G.train.gap;
  for (let i = 0; i < G.train.cars; i++) {
    out.push(loopPoint(G.train.track, G.train.dist - i * step));
  }
  return out;
}

export function drawTrack(ctx, track) {
  // Pillars every 160px along the loop.
  ctx.save();
  ctx.strokeStyle = '#6a6a72';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#7a7a82';
  const step = 160;
  const w = track.x1 - track.x0, h = track.y1 - track.y0;
  const per = 2 * (w + h);
  for (let d = 0; d < per; d += step) {
    const p = loopPoint(track, d);
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  // Two rails.
  ctx.strokeStyle = '#3a3a42';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.rect(track.x0, track.y0, w, h);
  ctx.stroke();
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(track.x0 - 4, track.y0 - 4, w + 8, h + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(track.x0 + 4, track.y0 + 4, w - 8, h - 8);
  ctx.stroke();
  // Stations.
  ctx.fillStyle = '#2e5a8a';
  for (const s of track.stations) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillRect(-34, -10, 68, 20);
    ctx.fillStyle = '#e8e6df';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('METRO', 0, 3);
    ctx.restore();
    ctx.fillStyle = '#2e5a8a';
  }
  ctx.restore();
}

export function drawTrain(ctx, G) {
  const cars = trainCarPositions(G);
  ctx.save();
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    ctx.save();
    ctx.translate(c.x + 10, c.y + 16);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-32, -10, 64, 20);
    ctx.restore();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    const isEngine = i === 0;
    ctx.fillStyle = isEngine ? '#2e5a8a' : '#4a7a9a';
    ctx.beginPath();
    ctx.roundRect(-32, -11, 64, 22, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#bfe3ee';
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(-24 + k * 14, -7, 9, 14);
    }
    if (isEngine) {
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(30, -8, 4, 6);
      ctx.fillRect(30, 2, 4, 6);
    }
    ctx.restore();
  }
  ctx.restore();
}
