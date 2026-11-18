// SOLMAR HEAT — walking. Character-relative movement, the rule the whole
// game is tuned around: stick Y moves along the character's OWN facing, and
// stick X turns the character. Pushing the stick sideways never slides the
// character sideways and never spins the map — it turns the walker.

import * as THREE from 'three';
import { CFG } from './config.js';

const RADIUS = 0.6;

export function makeWalkerMesh() {
  const g = new THREE.Group();
  g.name = 'walker';
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairM.position.y = 1.66; g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.26), pants);
  legL.position.set(-0.17, 0.34, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0); g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR, swing: 0 };
  return g;
}

// Push a circle out of every building box it overlaps.
export function resolveCollisions(pos, colliders, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
    const nz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        pos.x = c.x + c.hw + radius;
      }
    }
  }
  const lim = 206;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}

// One step of walking. move.x in [-1,1] (right positive), move.y in
// [-0.6,1] (forward positive). Turning is exactly TURN_RATE rad/s at full
// stick, and releasing the stick leaves the heading exactly where it was.
export function updateWalker(dt, move, sprint, S, colliders, mesh) {
  const p = S.player;
  p.heading -= move.x * CFG.turnRate * dt;
  const target = THREE.MathUtils.clamp(move.y, -0.6, 1) * (sprint ? CFG.sprintSpeed : CFG.walkSpeed);
  p.speed += (target - p.speed) * Math.min(1, dt * 10);
  if (Math.abs(p.speed) < 0.02) p.speed = 0;
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  resolveCollisions(p, colliders, RADIUS);
  mesh.position.set(p.x, 0, p.z);
  mesh.rotation.y = p.heading;
  // A light walk cycle, driven by distance covered.
  const u = mesh.userData;
  u.swing += Math.abs(p.speed) * dt * 2.4;
  const amp = Math.min(0.55, Math.abs(p.speed) * 0.09);
  u.legL.rotation.x = Math.sin(u.swing) * amp;
  u.legR.rotation.x = -Math.sin(u.swing) * amp;
  u.armL.rotation.x = -Math.sin(u.swing) * amp * 0.7;
  u.armR.rotation.x = Math.sin(u.swing) * amp * 0.7;
}
