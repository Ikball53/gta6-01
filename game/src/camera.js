// SOLMAR HEAT — the chase camera. It sits behind the player (or the car),
// a little above, looking slightly down, and eases toward its target so a
// turn never snaps. It never goes under the ground and never spins the
// minimap with it — the minimap is north-up and lives in hud.js. The rig
// is also pushed out of building boxes, so a chase never ends with the
// camera staring at the inside of a wall.

import * as THREE from 'three';
import { resolveCollisions } from './walker.js';

export function makeCamera() {
  return {
    rig: new THREE.Vector3(0, 8, -10),
    look: new THREE.Vector3(0, 1.5, 0),
  };
}

export function updateCamera(camera, rig, target, heading, dt, driving, colliders) {
  const dist = driving ? 12.5 : 7.5;
  const height = driving ? 5.4 : 4.0;
  const back = {
    x: target.x - Math.sin(heading) * dist,
    z: target.z - Math.cos(heading) * dist,
  };
  const wantRig = new THREE.Vector3(back.x, height, back.z);
  const k = 1 - Math.exp(-dt * (driving ? 5 : 7));
  rig.rig.lerp(wantRig, k);
  if (colliders) {
    const p = { x: rig.rig.x, z: rig.rig.z };
    resolveCollisions(p, colliders, 1.2);
    rig.rig.x = p.x; rig.rig.z = p.z;
    rig.rig.y = Math.max(rig.rig.y, 2.2);
  }
  const wantLook = new THREE.Vector3(
    target.x + Math.sin(heading) * 4,
    driving ? 1.6 : 1.4,
    target.z + Math.cos(heading) * 4,
  );
  rig.look.lerp(wantLook, 1 - Math.exp(-dt * 9));
  camera.position.copy(rig.rig);
  camera.lookAt(rig.look);
}

// A slow orbit for the start screen, so the menu shows the city itself.
export function menuOrbit(camera, time, city) {
  const a = time * 0.05;
  camera.position.set(Math.sin(a) * 150, 55 + Math.sin(time * 0.11) * 8, Math.cos(a) * 150);
  camera.lookAt(0, 8, 0);
}
