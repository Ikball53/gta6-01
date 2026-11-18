// SOLMAR HEAT — missions and money. Rosa's five-part story is a chain of
// glowing markers: walk or drive into one to advance, get paid at the end
// of each part. Stolen cars sell at the chop shop. Win the story at
// $50,000, or win rich at $100,000. Nothing here ever forces the player.

import * as THREE from 'three';
import { CFG, STORY } from './config.js';

export function makeMarkers(scene) {
  const geo = new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf2c200, transparent: true, opacity: 0.75 });
  const ring = new THREE.Mesh(geo, mat);
  ring.visible = false;
  scene.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf2c200, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  beam.visible = false;
  scene.add(beam);
  const rosaMat = new THREE.MeshBasicMaterial({ color: 0xe0609e, transparent: true, opacity: 0.75 });
  const rosa = new THREE.Mesh(geo, rosaMat);
  rosa.visible = false;
  scene.add(rosa);
  return { ring, beam, rosa };
}

function playerPos(S) {
  if (S.inCar) return { x: S.inCar.x, z: S.inCar.z };
  return { x: S.player.x, z: S.player.z };
}

function distTo(S, p) {
  const q = playerPos(S);
  return Math.hypot(q.x - p.x, q.z - p.z);
}

// Current objective marker position, or null when nothing is active.
export function currentStop(S) {
  if (!S.storyActive || S.story >= STORY.length) return null;
  return STORY[S.story].stops[S.storyStep];
}

export function updateMissions(dt, S, markers, city, onPaid, onWin) {
  const rosaAt = city.rosa;
  const p = playerPos(S);
  const nearRosa = Math.hypot(p.x - rosaAt.x, p.z - rosaAt.z) < 6;

  // Rosa's beacon shows when the next part is waiting to start.
  markers.rosa.visible = !S.storyActive && S.story < STORY.length;
  if (markers.rosa.visible) markers.rosa.position.set(rosaAt.x, 0.2, rosaAt.z);

  if (!S.storyActive && nearRosa && S.story < STORY.length) {
    S.storyActive = true;
    S.storyStep = 0;
    S.objective = STORY[S.story].title + ' — ' + STORY[S.story].stops[0].label;
  }

  const stop = currentStop(S);
  const show = !!stop;
  markers.ring.visible = show;
  markers.beam.visible = show;
  if (show) {
    markers.ring.position.set(stop.x, 0.2, stop.z);
    markers.beam.position.set(stop.x, 30, stop.z);
    if (distTo(S, stop) < 4.5) {
      S.storyStep++;
      if (S.storyStep >= STORY[S.story].stops.length) {
        const pay = STORY[S.story].pay;
        S.money += pay;
        S.story++;
        S.storyActive = false;
        S.objective = S.story >= STORY.length
          ? 'Story complete — Solmar is yours.'
          : 'Part done! +$' + pay + ' — visit Rosa for part ' + (S.story + 1) + '.';
        if (onPaid) onPaid(pay);
      } else {
        S.objective = STORY[S.story].title + ' — ' + STORY[S.story].stops[S.storyStep].label;
      }
    }
  }

  // Chop shop: drive a stolen car into the yard to sell it.
  if (S.inCar && S.inCar.stolen) {
    const d = Math.hypot(S.inCar.x - city.chop.x, S.inCar.z - city.chop.z);
    if (d < 10) {
      S.money += CFG.chopPay;
      S.carsSold++;
      S.objective = 'Sold the car for $' + CFG.chopPay + '.';
      if (onPaid) onPaid(CFG.chopPay);
      return S.inCar; // the sold car leaves the game
    }
  }
  return null;
}

// Hospital: standing in the zone refills health.
export function hospitalHeal(dt, S, city) {
  const p = playerPos(S);
  const d = Math.hypot(p.x - city.hospital.x, p.z - city.hospital.z);
  if (d < 16 && S.health < 100) {
    S.health = Math.min(100, S.health + CFG.hospitalHeal * dt);
    return true;
  }
  return false;
}

export function checkWin(S) {
  if (S.won || S.busted || S.wasted) return;
  if (S.story >= STORY.length) {
    S.won = true;
    S.winText = 'STORY COMPLETE — You finished Rosa’s five jobs and Solmar is yours.';
  } else if (S.money >= CFG.winRichMoney) {
    S.won = true;
    S.winText = 'RICH — $100,000 in the bank. Solmar is yours.';
  } else if (S.money >= CFG.winStoryMoney && S.story >= STORY.length) {
    S.won = true;
    S.winText = 'STORY COMPLETE — $50,000 earned. Solmar is yours.';
  }
}
