// SOLMAR HEAT — the single game-state object and the localStorage save.
// Everything the HUD, the missions and the police read lives here, so no
// system keeps a private copy of money, health or the wanted level.

import { CFG, STORY } from './config.js';

export function createState() {
  return {
    time: 0,
    money: CFG.startMoney,
    health: 100,
    wanted: 0,
    heat: 0, // 0..1, builds while the player commits crimes, decays quietly
    story: 0, // index into STORY, how many parts are done
    storyActive: false,
    storyStep: 0,
    objective: 'Free roam — visit Rosa to start her story.',
    inCar: null, // the vehicle record the player is driving, else null
    onFoot: true,
    player: { x: -126, z: 0, heading: Math.PI / 2, speed: 0 },
    carSpeed: 0,
    carsStolen: 0,
    carsSold: 0,
    busted: false,
    wasted: false,
    won: false,
    winText: '',
    started: false, // false while the start screen is up
    paused: false,
    muted: false,
    seed: 7,
    scene: 'menu',
  };
}

// Save only the progress numbers, never positions of traffic or police.
export function saveGame(S) {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      money: S.money, health: S.health, story: S.story,
      carsStolen: S.carsStolen, carsSold: S.carsSold,
    }));
  } catch (e) { /* storage unavailable: play on without a save */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() {
  return loadGame() !== null;
}

export function applySave(S, data) {
  if (!data) return;
  S.money = data.money ?? CFG.startMoney;
  S.health = data.health ?? 100;
  S.story = data.story ?? 0;
  S.carsStolen = data.carsStolen ?? 0;
  S.carsSold = data.carsSold ?? 0;
  if (S.story >= STORY.length) S.story = STORY.length;
  S.objective = S.story >= STORY.length
    ? 'Story complete — Solmar is yours.'
    : 'Free roam — visit Rosa to start part ' + (S.story + 1) + '.';
}

export function clearSave() {
  try { localStorage.removeItem(CFG.saveKey); } catch (e) { /* ignore */ }
}
