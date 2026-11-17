// SOLMAR HEAT — renderer: camera, golden-hour city, entities, effects.
// Draws the whole world top-down with long warm shadows and a sun glare.

import { WORLD, ROAD_W, ROAD_LINES, GOLDEN_HOUR } from './config.js';
import { drawVehicle } from './vehicles.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';
import { drawOfficer } from './police.js';
import { drawRival } from './missions.js';
import { drawTrack, drawTrain } from './train.js';

export function updateCamera(G, dt) {
  const p = G.player;
  const targetZoom = p.vehicle ? 0.82 : 1.0;
  G.camera.zoom += (targetZoom - G.camera.zoom) * Math.min(1, dt * 2);
  const tx = p.x, ty = p.y;
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 6);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 6);
}

export function drawWorld(ctx, G, W, H) {
  const cam = G.camera;
  const shakeX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shakeY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  // Golden-hour sky gradient behind everything.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, GOLDEN_HOUR.skyTop);
  sky.addColorStop(1, GOLDEN_HOUR.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

  drawGround(ctx, G);
  drawRoads(ctx, G);
  drawBlocks(ctx, G);
  drawTrack(ctx, G.city.track);
  drawMarkers(ctx, G);
  drawLights(ctx, G);

  for (const v of G.vehicles) drawVehicle(ctx, v, G.time);
  for (const p of G.peds) drawPed(ctx, p);
  for (const r of G.rivals) drawRival(ctx, r);
  for (const o of G.officers) drawOfficer(ctx, o, G.time);
  drawPlayer(ctx, G.player, G.time);
  drawTrain(ctx, G);
  drawTracers(ctx, G);

  ctx.restore();

  // Screen-space golden light: warm wash + sun glare + vignette.
  const wash = ctx.createRadialGradient(W * GOLDEN_HOUR.sunX, H * GOLDEN_HOUR.sunY, 40, W * GOLDEN_HOUR.sunX, H * GOLDEN_HOUR.sunY, Math.max(W, H) * 0.7);
  wash.addColorStop(0, 'rgba(255,210,130,0.20)');
  wash.addColorStop(1, 'rgba(255,150,80,0.02)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(40,10,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  if (G.player.hurtCd > 0.15) {
    ctx.fillStyle = 'rgba(255,30,20,0.14)';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawGround(ctx, G) {
  ctx.fillStyle = GOLDEN_HOUR.ground;
  ctx.fillRect(-80, -80, WORLD + 160, WORLD + 160);
  // Subtle ground texture: scattered darker patches.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 60; i++) {
    const x = (i * 397) % WORLD, y = (i * 641) % WORLD;
    ctx.beginPath();
    ctx.ellipse(x, y, 60 + (i % 5) * 18, 40 + (i % 3) * 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoads(ctx, G) {
  // Road surfaces.
  ctx.fillStyle = GOLDEN_HOUR.road;
  for (const l of ROAD_LINES) {
    ctx.fillRect(-40, l - ROAD_W / 2, WORLD + 80, ROAD_W);
    ctx.fillRect(l - ROAD_W / 2, -40, ROAD_W, WORLD + 80);
  }
  // Sidewalks: lighter strips along each road.
  ctx.fillStyle = GOLDEN_HOUR.sidewalk;
  for (const l of ROAD_LINES) {
    ctx.fillRect(-40, l - ROAD_W / 2 - 10, WORLD + 80, 10);
    ctx.fillRect(-40, l + ROAD_W / 2, WORLD + 80, 10);
    ctx.fillRect(l - ROAD_W / 2 - 10, -40, 10, WORLD + 80);
    ctx.fillRect(l + ROAD_W / 2, -40, 10, WORLD + 80);
  }
  // Lane markings: dashed centre lines.
  ctx.strokeStyle = GOLDEN_HOUR.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const l of ROAD_LINES) {
    ctx.beginPath();
    ctx.moveTo(0, l);
    ctx.lineTo(WORLD, l);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(l, 0);
    ctx.lineTo(l, WORLD);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(240,240,235,0.85)';
  for (const x of ROAD_LINES) {
    for (const y of ROAD_LINES) {
      for (let k = -3; k <= 3; k++) {
        ctx.fillRect(x + k * 8 - 3, y - ROAD_W / 2 - 8, 5, 10);
        ctx.fillRect(x + k * 8 - 3, y + ROAD_W / 2 - 2, 5, 10);
      }
    }
  }
}

function drawBlocks(ctx, G) {
  for (const b of G.city.blocks) {
    // Block base: grass or pavement.
    ctx.fillStyle = b.kind === 'park' ? GOLDEN_HOUR.grass : (b.kind === 'lot' ? '#8a8a90' : '#b7a67e');
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    if (b.kind === 'park' && b.pond) {
      ctx.fillStyle = GOLDEN_HOUR.water;
      ctx.beginPath();
      ctx.ellipse(b.pond.x + b.pond.w / 2, b.pond.y + b.pond.h / 2, b.pond.w / 2, b.pond.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.kind === 'lot' && b.spots) {
      ctx.strokeStyle = 'rgba(240,240,235,0.7)';
      ctx.lineWidth = 2;
      for (const s of b.spots) {
        ctx.strokeRect(s.x - 16, s.y - 26, 32, 52);
      }
    }
    if (b.fenced) {
      ctx.strokeStyle = 'rgba(120,90,50,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      ctx.setLineDash([]);
    }
    // Buildings with long shadows and roofs.
    for (const bd of b.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(bd.x + GOLDEN_HOUR.shadowDx, bd.y + GOLDEN_HOUR.shadowDy, bd.w, bd.h);
      ctx.fillStyle = bd.wall;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bd.x, bd.y, bd.w, bd.h);
      if (bd.kind === 'house') {
        ctx.fillStyle = bd.roof;
        ctx.beginPath();
        ctx.moveTo(bd.x - 3, bd.y + bd.h * 0.45);
        ctx.lineTo(bd.x + bd.w / 2, bd.y - 8);
        ctx.lineTo(bd.x + bd.w + 3, bd.y + bd.h * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(bd.x + bd.w / 2 - 7, bd.y + bd.h - 18, 14, 18); // door
        ctx.fillStyle = '#bfe3ee';
        ctx.fillRect(bd.x + 8, bd.y + 10, 12, 10);
        ctx.fillRect(bd.x + bd.w - 20, bd.y + 10, 12, 10);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(bd.x + 4, bd.y + 4, bd.w - 8, bd.h - 8);
        ctx.fillStyle = '#e8e6df';
        ctx.fillRect(bd.x + 6, bd.y + bd.h - 16, bd.w - 12, 10); // awning strip
        if (bd.name) {
          ctx.fillStyle = '#222';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(bd.name, bd.x + bd.w / 2, bd.y + bd.h / 2 + 3);
        }
      }
    }
    // Trees.
    for (const t of b.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(t.x + 8, t.y + 11, t.r, t.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a7a3f';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d9c4c';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLights(ctx, G) {
  for (const l of G.city.lights) {
    l.timer += 0.016;
    if (l.timer > 7) { l.timer = 0; l.nsGreen = !l.nsGreen; }
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(l.x - 3, l.y - ROAD_W / 2 - 14, 6, 16);
    ctx.fillRect(l.x - 3, l.y - ROAD_W / 2 - 14, 6, 16);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(l.x, l.y - ROAD_W / 2 - 18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = l.nsGreen ? '#2ed95a' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(l.x, l.y - ROAD_W / 2 - 18, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of G.city.signs) {
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.kind === 'stop') {
      ctx.fillStyle = '#c22e2e';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const px = Math.cos(a) * 8, py = Math.sin(a) * 8;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STOP', 0, 2);
    } else {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-6, -8, 12, 16);
      ctx.strokeStyle = '#222';
      ctx.strokeRect(-6, -8, 12, 16);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('40', 0, 3);
    }
    ctx.restore();
  }
}

function drawMarkers(ctx, G) {
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  const drawDiamond = (x, y, color, label) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 34);
    ctx.lineTo(x + 5, y - 22);
    ctx.lineTo(x - 5, y - 22);
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(label, x + 1, y - 40);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y - 41);
    }
  };
  if (G.mission) {
    drawDiamond(G.mission.target.x, G.mission.target.y, '#ffd21a', G.mission.target.label);
  }
  for (const job of G.jobSpots) {
    const color = job.kind === 'story' ? '#ffd21a' : job.kind === 'delivery' ? '#2ed95a' : job.kind === 'taxi' ? '#f2c200' : '#ff5a5a';
    drawDiamond(job.x, job.y, color, job.label);
  }
}

function drawTracers(ctx, G) {
  for (const t of G.tracers) {
    ctx.strokeStyle = 'rgba(255,240,160,' + Math.max(0, t.t / 0.12) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
}
