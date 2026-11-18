// SOLMAR HEAT — pedestrians. A dozen locals wander the sidewalks, cross at
// the corners and scatter when the player shoves or punches near them.
// Hitting one is a crime: the wanted level notices.

import * as THREE from 'three';
import { mulberry32, pick } from './config.js';

const SHIRTS = [0xd86a6a, 0x6a9fd8, 0x7fb069, 0xe0a458, 0x9b7ede, 0x5bc0be];

export function makePeds(scene, seed) {
  const rng = mulberry32(seed + 303);
  const peds = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    g.name = 'ped';
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98e5f });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.34), shirt);
    torso.position.y = 1.02; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.56; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.24), pants);
    legL.position.set(-0.16, 0.32, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    const x = (Math.floor(rng() * 11) - 5) * 42 + (rng() - 0.5) * 8;
    const z = (Math.floor(rng() * 11) - 5) * 42 + (rng() - 0.5) * 8;
    g.position.set(x, 0, z);
    scene.add(g);
    peds.push({
      mesh: g, legL, legR, x, z,
      heading: rng() * Math.PI * 2,
      speed: 1 + rng() * 0.8,
      target: null, swing: rng() * 6, flee: 0,
    });
  }
  return peds;
}

function pickTarget(p, rng) {
  const gx = (Math.floor(rng() * 11) - 5) * 42 + (rng() - 0.5) * 6;
  const gz = (Math.floor(rng() * 11) - 5) * 42 + (rng() - 0.5) * 6;
  p.target = { x: gx, z: gz };
}

export function updatePeds(dt, peds, seed) {
  const rng = mulberry32((seed + Math.floor(performance.now() / 5000)) >>> 0);
  for (const p of peds) {
    if (!p.target || p.flee > 0) {
      if (p.flee > 0) {
        p.flee -= dt;
        p.target = null;
      } else pickTarget(p, rng);
    }
    if (!p.target) continue;
    const dx = p.target.x - p.x, dz = p.target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) { p.target = null; continue; }
    const want = Math.atan2(dx, dz);
    let dh = want - p.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    p.heading += THREE.MathUtils.clamp(dh, -3 * dt, 3 * dt);
    const sp = p.flee > 0 ? p.speed * 2.6 : p.speed;
    p.x += Math.sin(p.heading) * sp * dt;
    p.z += Math.cos(p.heading) * sp * dt;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.swing += sp * dt * 3;
    p.legL.rotation.x = Math.sin(p.swing) * 0.4;
    p.legR.rotation.x = -Math.sin(p.swing) * 0.4;
  }
}

// Shove every pedestrian within reach: they flee, and the law notices.
export function punchNear(playerX, playerZ, peds, onCrime) {
  let hit = false;
  for (const p of peds) {
    const d = Math.hypot(p.x - playerX, p.z - playerZ);
    if (d < 2.6) {
      p.flee = 3;
      p.heading = Math.atan2(p.x - playerX, p.z - playerZ);
      hit = true;
    }
  }
  if (hit && onCrime) onCrime();
}
