// SOLMAR HEAT — vehicles. Builds each of the nine vehicle types from boxes
// (a different body per shape tag), runs the traffic cars along the street
// grid, and parks stealable cars at the curbs.

import * as THREE from 'three';
import { VEHICLES, mulberry32, pick } from './config.js';

function bodyMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function wheel(parent, x, z, r) {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.3, 10),
    new THREE.MeshLambertMaterial({ color: 0x151515 }),
  );
  w.rotation.z = Math.PI / 2;
  w.position.set(x, r, z);
  parent.add(w);
  return w;
}

// Build one vehicle mesh from its type definition. The group faces +z when
// its heading is 0; the driver turns it with the steering rule.
export function makeVehicleMesh(def) {
  const g = new THREE.Group();
  g.name = 'car-' + def.id;
  const paint = bodyMat(def.color);
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const L = def.len, W = def.wid;
  const wheels = [];
  if (def.shape === 'bike' || def.shape === 'scooter') {
    box(g, 0.5, 0.5, L * 0.7, paint, 0, 0.55, 0);
    box(g, 0.4, 0.35, 0.7, glass, 0, 0.9, -0.2);
    const wr = def.shape === 'bike' ? 0.36 : 0.3;
    wheels.push(wheel(g, 0, -L / 2 + 0.3, wr), wheel(g, 0, L / 2 - 0.3, wr));
  } else if (def.shape === 'truck') {
    box(g, W, 2.2, L * 0.45, paint, 0, 1.3, L * 0.26);
    box(g, W * 0.9, 1.6, L * 0.4, glass, 0, 1.0, -L * 0.28);
    box(g, W * 0.95, 0.3, L * 0.42, bodyMat(0x8a8f96), 0, 2.0, -L * 0.28);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      wheels.push(wheel(g, sx * (W / 2 - 0.1), sz * (L / 2 - 0.7), 0.5));
    }
  } else {
    box(g, W, 0.7, L, paint, 0, 0.55, 0);
    const cabLen = def.shape === 'pickup' ? L * 0.3 : L * 0.5;
    const cabZ = def.shape === 'pickup' ? -L * 0.22 : -L * 0.05;
    box(g, W * 0.85, 0.6, cabLen, glass, 0, 1.15, cabZ);
    if (def.shape === 'pickup') {
      box(g, W * 0.95, 0.5, L * 0.34, paint, 0, 0.95, L * 0.28);
    }
    if (def.shape === 'taxi') {
      box(g, 0.9, 0.25, 0.5, bodyMat(0x111111), 0, 1.55, -0.1);
    }
    if (def.shape === 'police') {
      box(g, W * 1.01, 0.18, L * 0.55, bodyMat(0xf2f2f2), 0, 0.95, 0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0xd81f2a, emissive: 0x881111 }));
      bar.position.set(0, 1.55, -0.1); g.add(bar);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x112288 }));
      bar2.position.set(0, 1.55, 0.35); g.add(bar2);
    }
    if (def.shape === 'ambulance') {
      const cross = bodyMat(0xd81f2a);
      box(g, 0.9, 0.3, 0.3, cross, 0, 1.2, -L * 0.05);
      box(g, 0.3, 0.9, 0.3, cross, 0, 1.2, -L * 0.05);
    }
    if (def.shape === 'sports') {
      box(g, W * 0.9, 0.28, L * 0.55, paint, 0, 1.0, L * 0.18);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      wheels.push(wheel(g, sx * (W / 2 - 0.05), sz * (L / 2 - 0.6), 0.36));
    }
  }
  g.userData.wheels = wheels;
  return g;
}

export function defById(id) {
  return VEHICLES.find(v => v.id === id) || VEHICLES[0];
}

// Traffic: cars loop around the block grid, turning at intersections, never
// leaving the roads. Each car keeps a target intersection and a speed.
export function spawnTraffic(scene, seed) {
  const rng = mulberry32(seed + 101);
  const cars = [];
  const driveIds = ['sedan', 'taxi', 'pickup', 'truck', 'sports', 'ambulance', 'scooter'];
  for (let i = 0; i < 14; i++) {
    const def = defById(pick(rng, driveIds));
    const mesh = makeVehicleMesh(def);
    const gx = (Math.floor(rng() * 11) - 5) * 42;
    const gz = (Math.floor(rng() * 11) - 5) * 42;
    mesh.position.set(gx, 0, gz);
    scene.add(mesh);
    cars.push({
      def, mesh, speed: 6 + rng() * 6,
      tx: gx, tz: gz, heading: Math.floor(rng() * 4) * (Math.PI / 2),
      wait: 0,
    });
  }
  return cars;
}

function nextIntersection(c, rng) {
  const dir = Math.floor(rng() * 3) - 1; // -1: left, 0: straight, 1: right
  const step = 42;
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const rx = Math.cos(c.heading), rz = -Math.sin(c.heading);
  const nx = c.tx + fx * step + rx * dir * step;
  const nz = c.tz + fz * step + rz * dir * step;
  if (Math.abs(nx) > 210 || Math.abs(nz) > 210) {
    c.heading += Math.PI; // turn around at the edge
    return;
  }
  c.tx = nx; c.tz = nz;
  c.heading += dir * (Math.PI / 2);
}

export function updateTraffic(dt, cars, seed) {
  const rng = mulberry32((seed + Math.floor(performance.now() / 4000)) >>> 0);
  for (const c of cars) {
    const dx = c.tx - c.mesh.position.x;
    const dz = c.tz - c.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      nextIntersection(c, rng);
      continue;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - c.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
    const sp = Math.min(c.speed, dist * 1.5);
    c.mesh.position.x += Math.sin(c.heading) * sp * dt;
    c.mesh.position.z += Math.cos(c.heading) * sp * dt;
    c.mesh.rotation.y = c.heading;
    for (const w of c.mesh.userData.wheels) w.rotation.x += sp * dt * 2;
  }
}

// Parked cars at the curbs, stealable with E. One is parked in front of the
// player's house so the first drive is a step away.
export function spawnParked(scene, city, seed) {
  const rng = mulberry32(seed + 202);
  const spots = [
    city.spawnCar,
    { x: -84, z: -3, heading: Math.PI / 2 },
    { x: 63, z: 45, heading: -Math.PI / 2 },
    { x: -21, z: -87, heading: 0 },
    { x: 129, z: 3, heading: Math.PI / 2 },
    { x: 3, z: 129, heading: Math.PI },
    { x: -171, z: 45, heading: -Math.PI / 2 },
    { x: 87, z: -129, heading: Math.PI / 2 },
    { x: -45, z: 171, heading: 0 },
    { x: 171, z: -45, heading: Math.PI },
  ];
  const ids = ['sedan', 'sports', 'pickup', 'taxi', 'sedan', 'sports', 'scooter', 'sedan', 'bike', 'pickup'];
  const parked = [];
  for (let i = 0; i < spots.length; i++) {
    const def = defById(ids[i % ids.length]);
    const mesh = makeVehicleMesh(def);
    mesh.position.set(spots[i].x, 0, spots[i].z);
    mesh.rotation.y = spots[i].heading;
    scene.add(mesh);
    parked.push({ def, mesh, x: spots[i].x, z: spots[i].z, heading: spots[i].heading, taken: false });
  }
  return parked;
}
