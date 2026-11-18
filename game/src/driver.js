// SOLMAR HEAT — driving. The steering rule, fixed once and for all: the
// car turns with the stick, steering right turns the car right, and reverse
// flips the steering the way a real car does. The sign on the speed term is
// the whole fix — get it backwards and every turn feels wrong.

import * as THREE from 'three';
import { CFG } from './config.js';

export function updateDriver(dt, move, S, car, colliders, onBump) {
  const def = car.def;
  const fwd = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
  // Throttle: W accelerates, S brakes, then reverses to 40% of top speed.
  if (move.y > 0) {
    S.carSpeed += def.accel * dt;
  } else if (move.y < 0) {
    if (S.carSpeed > 0.5) S.carSpeed -= def.accel * 1.6 * dt;
    else S.carSpeed -= def.accel * 0.7 * dt;
  } else {
    S.carSpeed -= S.carSpeed * 1.4 * dt; // coast-down drag
    if (Math.abs(S.carSpeed) < 0.05) S.carSpeed = 0;
  }
  S.carSpeed = THREE.MathUtils.clamp(S.carSpeed, -def.top * 0.4, def.top);

  // Steering: full lock at low speed, lighter as the car goes faster.
  const authority = THREE.MathUtils.clamp(Math.abs(S.carSpeed) / 8, 0, 1)
    * (1 - (Math.abs(S.carSpeed) / def.top) * 0.45);
  const dir = S.carSpeed === 0 ? 1 : Math.sign(S.carSpeed);
  car.heading -= move.x * CFG.steerRate * authority * dt * dir;

  const nx = car.x + Math.sin(car.heading) * S.carSpeed * dt;
  const nz = car.z + Math.cos(car.heading) * S.carSpeed * dt;
  const probe = { x: nx, z: nz };
  resolveCarCollision(probe, colliders, def.len / 2);
  const hitWall = probe.x !== nx || probe.z !== nz;
  if (hitWall) {
    S.carSpeed *= -0.25; // a dull bounce off the wall, not a dead stop
    if (onBump) onBump();
  }
  car.x = probe.x;
  car.z = probe.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Body lean into the turn, wheels spinning with the road.
  car.mesh.rotation.z = THREE.MathUtils.clamp(-move.x * authority * 0.06, -0.08, 0.08);
  for (const w of car.mesh.userData.wheels) w.rotation.x += S.carSpeed * dt * 2.2;
}

function resolveCarCollision(pos, colliders, radius) {
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
