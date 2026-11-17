// SOLMAR HEAT — minimap: the corner map with roads, the player, jobs,
// police and the metro train.

import { WORLD, ROAD_LINES } from './config.js';

export function drawMinimap(ctx, G, size) {
  const s = size / WORLD;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  // Panel.
  ctx.fillStyle = 'rgba(20,20,28,0.82)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  // Blocks.
  ctx.fillStyle = 'rgba(120,110,90,0.9)';
  for (const b of G.city.blocks) {
    ctx.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
  }
  // Parks.
  ctx.fillStyle = 'rgba(90,160,80,0.9)';
  for (const b of G.city.blocks) {
    if (b.kind === 'park') ctx.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
  }
  // Roads.
  ctx.strokeStyle = 'rgba(230,230,230,0.9)';
  ctx.lineWidth = 2;
  for (const l of ROAD_LINES) {
    ctx.beginPath();
    ctx.moveTo(0, l * s);
    ctx.lineTo(size, l * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(l * s, 0);
    ctx.lineTo(l * s, size);
    ctx.stroke();
  }
  // Metro loop.
  ctx.strokeStyle = 'rgba(90,160,220,0.9)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(G.city.track.x0 * s, G.city.track.y0 * s, (G.city.track.x1 - G.city.track.x0) * s, (G.city.track.y1 - G.city.track.y0) * s);
  // Landmarks.
  const lm = G.city.landmarks;
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * s, y * s, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(lm.police.x, lm.police.y, '#3d7dd9', 3.5);
  dot(lm.hospital.x, lm.hospital.y, '#f2f2f2', 3.5);
  dot(lm.diner.x, lm.diner.y, '#ff9a3d', 3);
  dot(lm.garage.x, lm.garage.y, '#ffd21a', 3);
  dot(lm.grand.x, lm.grand.y, '#e8c53d', 3);
  // Job markers.
  for (const job of G.jobSpots) {
    dot(job.x, job.y, job.kind === 'story' ? '#ffd21a' : '#2ed95a', 2.5);
  }
  // Mission target: pulsing gold diamond.
  if (G.mission) {
    const t = G.mission.target;
    const r = 3 + Math.sin(G.time * 5) * 1.2;
    ctx.save();
    ctx.translate(t.x * s, t.y * s);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd21a';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  // Police cars.
  ctx.fillStyle = '#3d7dd9';
  for (const c of G.policeCars) {
    ctx.beginPath();
    ctx.arc(c.x * s, c.y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Train.
  if (G.trainCars && G.trainCars.length > 0) {
    ctx.fillStyle = '#7ab8e8';
    ctx.beginPath();
    ctx.arc(G.trainCars[0].x * s, G.trainCars[0].y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(p.x * s, p.y * s);
  ctx.rotate(p.facing);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}
