// SOLMAR HEAT — HUD: the small corner readouts, toasts and prompts.
// All text is tiny and stays in the corners, never over the middle of play.

import { fmtCash, fmtClock, STORY } from './config.js';
import { nearestVehicle } from './vehicles.js';
import { dist } from './config.js';

export function collectHud() {
  const el = (id) => document.getElementById(id);
  return {
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    cash: el('cash'),
    stars: el('stars'),
    clock: el('clock'),
    speed: el('speed'),
    ammo: el('ammo'),
    objective: el('objective'),
    objectiveTitle: el('objective-title'),
    objectiveBody: el('objective-body'),
    objectiveTimer: el('objective-timer'),
    message: el('message'),
    prompt: el('prompt'),
    story: el('story'),
  };
}

export function updateHud(G, hud, dt) {
  const p = G.player;
  if (hud.healthFill) hud.healthFill.style.width = Math.max(0, p.hp) + '%';
  if (hud.healthText) hud.healthText.textContent = Math.ceil(Math.max(0, p.hp));
  if (hud.cash) hud.cash.textContent = fmtCash(G.cash);
  if (hud.stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < G.wanted ? '★' : '☆';
    hud.stars.textContent = s;
    hud.stars.className = G.wanted > 0 ? 'wanted-hot' : '';
  }
  if (hud.clock) hud.clock.textContent = fmtClock(G.clock) + '  ·  Solmar City';
  if (hud.speed) {
    if (p.vehicle) {
      hud.speed.textContent = Math.round(Math.abs(p.vehicle.speed) * 0.9) + ' mph · ' + p.vehicle.name;
    } else {
      hud.speed.textContent = p.speed > 0 ? 'On foot' : '';
    }
  }
  if (hud.ammo) hud.ammo.textContent = p.onFoot ? 'Ammo ' + p.ammo : '';
  if (hud.story) {
    hud.story.textContent = G.storyStep < STORY.length
      ? 'Story ' + G.storyStep + '/' + STORY.length + ' · ' + STORY[G.storyStep].title
      : 'Story complete';
  }
  // Objective panel.
  if (hud.objective) {
    if (G.mission) {
      hud.objective.style.display = 'block';
      if (hud.objectiveTitle) hud.objectiveTitle.textContent = G.mission.title;
      if (hud.objectiveBody) hud.objectiveBody.textContent = G.mission.target.label;
      if (hud.objectiveTimer) hud.objectiveTimer.textContent = G.mission.timer > 0 ? Math.ceil(G.mission.timer) + 's' : '';
    } else {
      hud.objective.style.display = 'none';
    }
  }
  // Toast message.
  if (hud.message) {
    if (G.messageT > 0) {
      G.messageT -= dt;
      hud.message.textContent = G.message || '';
      hud.message.style.opacity = Math.min(1, G.messageT).toFixed(2);
    } else {
      hud.message.style.opacity = '0';
    }
  }
  // Context prompt.
  if (hud.prompt) {
    let text = '';
    if (G.mode === 'playing') {
      const nearCar = nearestVehicle(G, p.x, p.y, 52, () => true);
      const nearJob = G.jobSpots.find(j => dist(p.x, p.y, j.x, j.y) < 70);
      if (p.vehicle) text = 'E — Get out   ·   Space — Brake   ·   H — Horn';
      else if (nearCar) text = 'E — Enter ' + nearCar.name;
      else if (nearJob) text = 'E — ' + nearJob.label;
      else if (p.ammo > 0) text = 'Click — Shoot   ·   F — Punch   ·   E — Enter car';
      else text = 'F — Punch   ·   E — Enter car';
    }
    hud.prompt.textContent = text;
  }
}
