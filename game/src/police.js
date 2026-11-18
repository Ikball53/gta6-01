// SOLMAR HEAT — the law. The wanted level rises with crimes and cools
// down when the player stays quiet; police cars chase and ram, and from
// three stars a helicopter circles overhead with a spotlight. Getting
// caught on foot ends the run (busted); losing all health ends it (wasted).

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeVehicleMesh, defById } from './vehicles.js';

export function addHeat(S, amount) {
  S.heat = Math.min(1, S.heat + amount);
  const stars = Math.ceil(S.heat * CFG.maxWanted);
  if (stars > S.wanted) {
    S.wanted = stars;
    S.objective = S.wanted >= 3
      ? 'Wanted level ' + S.wanted + ' — lose the cops!'
      : S.objective;
  }
}

export function updateWanted(dt, S) {
  if (S.wanted === 0) { S.heat = Math.max(0, S.heat - dt * 0.02); return; }
  // Heat cools slowly when the player is not committing crimes.
  S.heat = Math.max(0, S.heat - dt * 0.012);
  const stars = Math.ceil(S.heat * CFG.maxWanted);
  if (stars < S.wanted) S.wanted = stars;
}

export function makePoliceForce(scene) {
  const heliGroup = new THREE.Group();
  heliGroup.name = 'heli';
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f6e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 5.2), bodyMat);
  body.castShadow = true;
  heliGroup.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), bodyMat);
  tail.position.set(0, 0.3, -4.2);
  heliGroup.add(tail);
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), rotorMat);
  rotor.position.y = 1.0;
  heliGroup.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.5), rotorMat);
  tailRotor.position.set(0.5, 0.4, -6.2);
  heliGroup.add(tailRotor);
  const spot = new THREE.SpotLight(0xfff2c0, 900, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.8, 0);
  heliGroup.add(spot);
  heliGroup.add(spot.target);
  heliGroup.visible = false;
  scene.add(heliGroup);
  return {
    cars: [], // {mesh, def, x, z, heading, speed}
    heli: heliGroup,
    heliRotor: rotor,
    heliAngle: 0,
    spawnTimer: 0,
  };
}

function spawnPoliceCar(scene, force, x, z) {
  const def = defById('police');
  const mesh = makeVehicleMesh(def);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const car = { def, mesh, x, z, heading: 0, speed: 0 };
  force.cars.push(car);
  return car;
}

function playerPos(S) {
  if (S.inCar) return { x: S.inCar.x, z: S.inCar.z };
  return { x: S.player.x, z: S.player.z };
}

// Chase the player: steer toward them, ram on contact. On foot, a touch
// busts the player; in a car, a ram damages health and slows the car.
export function updatePolice(dt, S, force, scene, colliders, onBusted, onDamage) {
  const p = playerPos(S);
  const want = Math.min(S.wanted, 5);
  const need = want === 0 ? 0 : want <= 2 ? 2 : 4;
  force.spawnTimer -= dt;
  while (force.cars.length < need && force.spawnTimer <= 0) {
    const a = Math.random() * Math.PI * 2;
    spawnPoliceCar(scene, force, p.x + Math.sin(a) * 60, p.z + Math.cos(a) * 60);
    force.spawnTimer = 1.5;
  }
  while (force.cars.length > need) {
    const gone = force.cars.pop();
    scene.remove(gone.mesh);
  }
  for (const c of force.cars) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    c.heading += THREE.MathUtils.clamp(dh, -2.4 * dt, 2.4 * dt);
    const top = c.def.top * (0.9 + S.wanted * 0.04);
    c.speed = Math.min(top, c.speed + c.def.accel * dt);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    if (dist < 2.4) {
      if (S.inCar) {
        onDamage(8);
        S.carSpeed *= 0.55;
        c.speed *= 0.4;
        c.x -= Math.sin(c.heading) * 2;
        c.z -= Math.cos(c.heading) * 2;
      } else {
        onBusted();
      }
    }
  }
  // Helicopter: only at three stars and up, circling with a spotlight.
  const heliOn = S.wanted >= 3;
  force.heli.visible = heliOn;
  if (heliOn) {
    force.heliAngle += dt * 0.55;
    const hx = p.x + Math.sin(force.heliAngle) * 26;
    const hz = p.z + Math.cos(force.heliAngle) * 26;
    force.heli.position.set(hx, 42, hz);
    force.heli.rotation.y = Math.atan2(p.x - hx, p.z - hz);
    force.heliRotor.rotation.y += dt * 22;
    const spot = force.heli.children.find(o => o.isSpotLight);
    if (spot) spot.target.position.set(p.x - hx, -42, p.z - hz);
  }
}
