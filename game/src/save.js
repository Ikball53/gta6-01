// SOLMAR HEAT — save: autosave to localStorage, load on start.
// Nothing leaves the browser; the save is one small JSON object.

import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      v: 1,
      cash: Math.round(G.cash),
      health: Math.round(G.player.hp),
      ammo: G.player.ammo,
      storyStep: G.storyStep,
      jobsDone: G.stats.jobsDone || 0,
      busted: G.stats.busted || 0,
      wasted: G.stats.wasted || 0,
      player: { x: Math.round(G.player.x), y: Math.round(G.player.y) },
      taxiStand: G.taxiStand,
      clock: Math.round(G.clock),
      muted: G.audio ? G.audio.muted : false,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* no storage */ }
}

export function applySave(G, data) {
  if (!data) return;
  G.cash = data.cash || 250;
  G.player.hp = data.health || 100;
  G.player.ammo = data.ammo || 24;
  G.storyStep = data.storyStep || 0;
  G.stats.jobsDone = data.jobsDone || 0;
  G.stats.busted = data.busted || 0;
  G.stats.wasted = data.wasted || 0;
  if (data.player) {
    G.player.x = data.player.x;
    G.player.y = data.player.y;
  }
  if (data.taxiStand) G.taxiStand = data.taxiStand;
  if (data.clock) G.clock = data.clock;
}
