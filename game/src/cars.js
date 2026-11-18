// Vehicles for SOLMAR HEAT: factory, traffic and parked cars.
// Every car is boxes + cylinders with its own silhouette and colour.
import * as THREE from 'three';
import { GRID, collideMove } from './city.js';

const SPECS = {
  sedan:   { w: 1.9, l: 4.4, h: 1.35, color: 0x8a9ab0, top: 24, accel: 16, max: 26 },
  taxi:    { w: 1.9, l: 4.4, h: 1.35, color: 0xf5c542, top: 26, accel: 16, max: 26 },
  pickup:  { w: 2.0, l: 5.0, h: 1.6,  color: 0x5a7a3a, top: 22, accel: 15, max: 24 },
  truck:   { w: 2.4, l: 7.0, h: 2.6,  color: 0xd8d8d8, top: 18, accel: 10, max: 20 },
  sports:  { w: 2.0, l: 4.6, h: 1.05, color: 0xe02040, top: 38, accel: 24, max: 42 },
  police:  { w: 1.9, l: 4.5, h: 1.4,  color: 0xf0f0f0, top: 34, accel: 22, max: 36 },
  ambulance: { w: 2.2, l: 5.6, h: 2.4, color: 0xffffff, top: 22, accel: 14, max: 26 },
  bike:    { w: 0.7, l: 2.2, h: 1.1,  color: 0x2a2a2e, top: 30, accel: 22, max: 34 },
  scooter: { w: 0.7, l: 1.9, h: 1.0,  color: 0x7ae0ff, top: 22, accel: 14, max: 20 },
};
export const CAR_TYPES = Object.keys(SPECS);
export function carSpec(type) { return SPECS[type] || SPECS.sedan; }

function lam(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, ...opts }); }

export function makeCarMesh(W, type) {
  const s = carSpec(type);
  const g = new THREE.Group();
  const bodyMat = lam(s.color);
  const darkMat = lam(0x181822);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x182838, emissive: 0x2a3a4a, emissiveIntensity: 0.5 });
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = lam(0x111111);
  const addWheel = (x, z) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z);
    w.castShadow = true; g.add(w); wheels.push(w);
  };

  if (type === 'bike' || type === 'scooter') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.9), bodyMat);
    frame.position.y = 0.7; frame.castShadow = true; g.add(frame);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.7), darkMat);
    seat.position.set(0, 1.0, -0.4); g.add(seat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), darkMat);
    bar.position.set(0, 1.15, 0.85); g.add(bar);
    addWheel(0, 0.85); addWheel(0, -0.85);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xfff2cc, emissive: 0xffd27a, emissiveIntensity: 1.6 }));
    light.position.set(0, 0.85, 1.05); g.add(light);
  } else if (type === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.2, 2.0), bodyMat);
    cab.position.set(0, 1.5, 2.4); cab.castShadow = true; g.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.1), glassMat);
    shield.position.set(0, 1.9, 3.38); g.add(shield);
    const boxBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 4.4), lam(0xcccccc));
    boxBody.position.set(0, 1.6, -1.2); boxBody.castShadow = true; g.add(boxBody);
    addWheel(-1.05, 2.5); addWheel(1.05, 2.5); addWheel(-1.05, -2.4); addWheel(1.05, -2.4);
  } else if (type === 'ambulance') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 5.4), bodyMat);
    body.position.y = 1.35; body.castShadow = true; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.5, 5.42), lam(0xc02030));
    stripe.position.y = 1.3; g.add(stripe);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06), lam(0xc02030));
    cross.position.set(0, 1.9, 2.72); g.add(cross);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.08), lam(0xffffff));
    cross2.position.set(0, 1.9, 2.74); g.add(cross2);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.4), glassMat);
    cab.position.set(0, 1.9, 2.0); g.add(cab);
    addWheel(-1.0, 1.9); addWheel(1.0, 1.9); addWheel(-1.0, -1.9); addWheel(1.0, -1.9);
  } else {
    // sedan / taxi / pickup / sports / police share the car body pattern
    const body = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h * 0.62, s.l), bodyMat);
    body.position.y = s.h * 0.55; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.86, s.h * 0.55, s.l * 0.5), glassMat);
    cabin.position.set(0, s.h * 0.95, -s.l * 0.06); cabin.castShadow = true; g.add(cabin);
    if (type === 'pickup') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.9, 0.5, s.l * 0.4), darkMat);
      bed.position.set(0, s.h * 0.8, -s.l * 0.28); g.add(bed);
    }
    if (type === 'sports') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.9, 0.08, 0.5), darkMat);
      spoiler.position.set(0, s.h * 1.05, -s.l * 0.48); g.add(spoiler);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.18, 0.4), darkMat);
      lip.position.set(0, 0.25, s.l * 0.5); g.add(lip);
    }
    if (type === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0xf5c542, emissiveIntensity: 0.8 }));
      sign.position.set(0, s.h * 1.3, -s.l * 0.06); g.add(sign);
    }
    if (type === 'police') {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.02, 0.3, s.l + 0.02), lam(0x1a2a4a));
      stripe.position.y = s.h * 0.55; g.add(stripe);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), darkMat);
      bar.position.set(0, s.h * 1.28, -s.l * 0.06); g.add(bar);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.42),
        new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
      r.position.set(-0.28, s.h * 1.4, -s.l * 0.06); g.add(r);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.42),
        new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
      b.position.set(0.28, s.h * 1.4, -s.l * 0.06); g.add(b);
      g.userData.flashers = [r, b];
    }
    // headlights + taillights
    for (const sx of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xfff2cc, emissive: 0xffd27a, emissiveIntensity: 1.8 }));
      hl.position.set(sx * s.w * 0.62, 0.55, s.l * 0.5); g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06),
        new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xaa1010, emissiveIntensity: 1 }));
      tl.position.set(sx * s.w * 0.62, 0.6, -s.l * 0.5); g.add(tl);
    }
    const wz = s.l * 0.32;
    addWheel(-s.w / 2, wz); addWheel(s.w / 2, wz);
    addWheel(-s.w / 2, -wz); addWheel(s.w / 2, -wz);
  }
  g.userData = { ...g.userData, type, spec: s, wheels };
  return g;
}

function lanePos(axis, line, dir) {
  // right-hand traffic: offset +2.6 to the right of travel direction
  return axis === 'x' ? { x: 0, z: line + (dir > 0 ? 2.6 : -2.6) } : { x: line + (dir > 0 ? -2.6 : 2.6), z: 0 };
}

export function spawnTraffic(W, n) {
  const rng = W.rng;
  const types = ['sedan', 'sedan', 'taxi', 'pickup', 'truck', 'sports', 'bike', 'scooter', 'sedan', 'taxi'];
  W.traffic = [];
  for (let i = 0; i < n; i++) {
    const type = types[Math.floor(rng() * types.length)];
    const mesh = makeCarMesh(W, type);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = GRID[Math.floor(rng() * GRID.length)];
    const dir = rng() < 0.5 ? 1 : -1;
    const along = -140 + rng() * 280;
    const lp = lanePos(axis, line, dir);
    const car = {
      mesh, type, axis, line, dir,
      speed: 7 + rng() * 6,
      x: axis === 'x' ? along : lp.x,
      z: axis === 'z' ? along : lp.z,
      heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      stopped: false, stopT: 0,
    };
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    W.scene.add(mesh);
    W.traffic.push(car);
  }
}

export function spawnParked(W) {
  const rng = W.rng;
  const spots = [
    { type: 'sports', x: -94, z: 96, ry: Math.PI / 2, name: 'Falco GT' },
    { type: 'sedan', x: -30, z: 6, ry: 0, name: 'Sedan' },
    { type: 'taxi', x: 14, z: -34, ry: Math.PI, name: 'Taxi' },
    { type: 'pickup', x: 46, z: 14, ry: -Math.PI / 2, name: 'Pickup' },
    { type: 'sedan', x: -74, z: -46, ry: Math.PI / 2, name: 'Sedan' },
    { type: 'sports', x: 86, z: 46, ry: 0, name: 'Falco GT' },
    { type: 'bike', x: 6, z: 74, ry: Math.PI / 2, name: 'Sport Bike' },
    { type: 'scooter', x: -46, z: -74, ry: 0, name: 'Scooter' },
    { type: 'ambulance', x: -54, z: 60, ry: Math.PI, name: 'Ambulance' },
    { type: 'truck', x: 74, z: -86, ry: -Math.PI / 2, name: 'Truck' },
    { type: 'sedan', x: -6, z: -86, ry: Math.PI, name: 'Sedan' },
    { type: 'taxi', x: 106, z: -14, ry: Math.PI / 2, name: 'Taxi' },
  ];
  W.parked = [];
  for (const s of spots) {
    const mesh = makeCarMesh(W, s.type);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.ry;
    W.scene.add(mesh);
    W.parked.push({ mesh, type: s.type, name: s.name, x: s.x, z: s.z, heading: s.ry, stolen: false });
  }
}

export function nearestCar(W, x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const c of W.parked) {
    if (c.stolen) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  for (const c of W.traffic) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd && c.speed < 2) { bd = d; best = c; }
  }
  return best;
}

export function updateTraffic(W, dt) {
  const greenZ = W.city.phase === 0; // z-axis roads green
  for (const c of W.traffic) {
    // find next intersection ahead
    let target = c.speed;
    const ahead = c.speed * dt + 6;
    const pos = c.axis === 'x' ? c.x : c.z;
    const next = GRID.find((g) => c.dir > 0 ? g > pos + 2 && g < pos + ahead + 8 : g < pos - 2 && g > pos - ahead - 8);
    if (next !== undefined) {
      const axisGreen = c.axis === 'z' ? greenZ : !greenZ;
      if (!axisGreen) target = 0; // red light: stop at the line
    }
    // random turn at intersections
    const nearInt = GRID.some((g) => Math.abs(pos - g) < 1.5);
    if (nearInt && W.rng() < dt * 0.35) {
      const other = c.axis === 'x' ? 'z' : 'x';
      const line = c.axis === 'x' ? c.z : c.x;
      const snapped = GRID.reduce((a, b) => Math.abs(b - line) < Math.abs(a - line) ? b : a, GRID[0]);
      const ndir = W.rng() < 0.5 ? 1 : -1;
      const lp = lanePos(other, snapped, ndir);
      c.axis = other; c.line = snapped; c.dir = ndir;
      c.x = other === 'x' ? c.x : lp.x;
      c.z = other === 'z' ? c.z : lp.z;
      c.heading = other === 'x' ? (ndir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ndir > 0 ? 0 : Math.PI);
    }
    c.speed += (target - c.speed) * Math.min(1, dt * 2.5);
    const step = c.dir * c.speed * dt;
    if (c.axis === 'x') c.x += step; else c.z += step;
    // wrap around the city edge
    if (c.x > 150) c.x = -150;
    if (c.x < -150) c.x = 150;
    if (c.z > 150) c.z = -150;
    if (c.z < -150) c.z = 150;
    // keep on the road line (lane)
    const lp = lanePos(c.axis, c.line, c.dir);
    if (c.axis === 'x') c.z = lp.z; else c.x = lp.x;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    // wheel spin
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2;
  }
}

// Simple circle-vs-car collision for the player car: returns pushback.
export function carHit(W, x, z, r) {
  for (const c of W.traffic) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < r + 2.2) return c;
  }
  for (const c of W.parked) {
    if (c.stolen) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < r + 2.2) return c;
  }
  return null;
}
