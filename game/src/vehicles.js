// Nine vehicle types, traffic flow, stealable parked cars, police pursuit
// cars and a helicopter with a spotlight. All cars are boxes with a cabin,
// wheels and headlights — cheap, readable, unmistakable.
import * as THREE from 'three';

// name, body colour, size [w,h,len], top speed m/s, price-ish value
export const VEHICLE_TYPES = [
  { key: 'sedan',   label: 'Sedan',   color: 0x3a6fd8, size: [1.9, 0.7, 4.4], top: 26 },
  { key: 'coupe',   label: 'Coupe',   color: 0xd83a3a, size: [1.8, 0.6, 4.0], top: 30 },
  { key: 'taxi',    label: 'Taxi',    color: 0xf5c518, size: [1.9, 0.7, 4.4], top: 26 },
  { key: 'van',     label: 'Van',     color: 0xe8e8e8, size: [2.0, 1.1, 5.0], top: 22 },
  { key: 'truck',   label: 'Truck',   color: 0x6a7a8a, size: [2.2, 1.4, 6.2], top: 20 },
  { key: 'bus',     label: 'Bus',     color: 0x2a9d5c, size: [2.4, 1.6, 8.0], top: 18 },
  { key: 'sport',   label: 'Sport',   color: 0xff7a1a, size: [1.9, 0.55, 4.2], top: 36 },
  { key: 'pickup',  label: 'Pickup',  color: 0x7a4a9d, size: [2.0, 0.9, 5.2], top: 24 },
  { key: 'police',  label: 'Police',  color: 0x1a1a2e, size: [1.9, 0.7, 4.6], top: 32 },
];

function makeCarMesh(type) {
  const g = new THREE.Group();
  const [w, h, len] = type.size;
  const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.35, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), bodyMat);
  body.position.y = 0.55 + h / 2;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.82, 0.55, len * 0.45),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.2, metalness: 0.4 })
  );
  cabin.position.set(0, 0.55 + h + 0.27, -len * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
  for (const [wx, wz] of [[-w / 2, len * 0.32], [w / 2, len * 0.32], [-w / 2, -len * 0.32], [w / 2, -len * 0.32]]) {
    const wh = new THREE.Mesh(wheelGeo, wheelMat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.36, wz);
    g.add(wh);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), lampMat);
    lamp.position.set(sx, 0.8, len / 2 + 0.02);
    g.add(lamp);
  }
  if (type.key === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 0.55 + h + 0.62, 0);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar2.position.set(0.6, 0.55 + h + 0.62, 0);
    g.add(bar2);
  }
  if (type.key === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    sign.position.set(0, 0.55 + h + 0.6, 0);
    g.add(sign);
  }
  return g;
}

export function makeVehicle(type, x, z, heading) {
  const mesh = makeCarMesh(type);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading || 0;
  return {
    type, mesh, heading: heading || 0,
    speed: 0, x, z,
    parked: false, police: type.key === 'police',
    steer: 0,
  };
}

// Traffic: cars cruise the road grid, turning at intersections.
export function makeTraffic(scene, count) {
  const list = [];
  const roadLines = [-168, -112, -56, 0, 56, 112, 168];
  const driveTypes = VEHICLE_TYPES.filter((t) => t.key !== 'police');
  for (let i = 0; i < count; i++) {
    const type = driveTypes[i % driveTypes.length];
    const along = roadLines[i % roadLines.length];
    const cross = -160 + ((i * 47) % 320);
    const vertical = i % 2 === 0;
    const v = makeVehicle(type, vertical ? along + 3 : cross, vertical ? cross : along + 3,
      vertical ? (i % 4 < 2 ? 0 : Math.PI) : (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2));
    v.speed = 8 + (i % 5);
    v.vertical = vertical;
    v.lane = along;
    scene.add(v.mesh);
    list.push(v);
  }
  return list;
}

export function stepTraffic(list, dt) {
  for (const v of list) {
    // Move along current heading; at an intersection, sometimes turn.
    const dx = Math.sin(v.heading) * v.speed * dt;
    const dz = Math.cos(v.heading) * v.speed * dt;
    v.x += dx;
    v.z += dz;
    const nearGrid = Math.abs(((v.x + 28) % 56 + 56) % 56 - 28) < 3 &&
      Math.abs(((v.z + 28) % 56 + 56) % 56 - 28) < 3;
    if (nearGrid && Math.random() < 0.02) {
      v.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    if (v.x > 185 || v.x < -185 || v.z > 185 || v.z < -185) {
      v.heading += Math.PI; // turn around at the edge
      v.x = Math.max(-180, Math.min(180, v.x));
      v.z = Math.max(-180, Math.min(180, v.z));
    }
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.heading;
  }
}

// Parked, stealable cars along the house street and downtown.
export function makeParked(scene) {
  const list = [];
  const spots = [
    [-20, 104, 0], [14, 104, 0], [-42, 136, Math.PI], [34, 136, Math.PI],
    [56, -40, Math.PI / 2], [-56, -84, -Math.PI / 2], [112, 28, 0], [-112, -28, Math.PI],
  ];
  const types = ['sedan', 'coupe', 'sport', 'pickup', 'taxi', 'van', 'sedan', 'coupe'];
  spots.forEach(([x, z, h], i) => {
    const type = VEHICLE_TYPES.find((t) => t.key === types[i]);
    const v = makeVehicle(type, x, z, h);
    v.parked = true;
    v.speed = 0;
    scene.add(v.mesh);
    list.push(v);
  });
  return list;
}

// Police helicopter with a visible spotlight cone.
export function makeHelicopter(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 }));
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e }));
  tail.position.set(0, 0.3, -5);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  g.add(rotor2);
  const spot = new THREE.SpotLight(0xfff2b0, 220, 90, 0.32, 0.45, 1.2);
  spot.position.set(0, -0.8, 2);
  const target = new THREE.Object3D();
  target.position.set(0, -10, 0);
  g.add(target);
  spot.target = target;
  g.add(spot);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4, 10, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -5;
  g.add(cone);
  g.visible = false;
  scene.add(g);
  return { group: g, rotor, rotor2, spot, target, cone, angle: -Math.PI / 2 };
}

export function stepHelicopter(heli, tx, tz, dt, active) {
  heli.group.visible = active;
  if (!active) return;
  heli.angle += dt * 0.55;
  const r = 45;
  heli.group.position.set(tx + Math.cos(heli.angle) * r, 10, tz + Math.sin(heli.angle) * r);
  heli.group.lookAt(tx, 0, tz);
  heli.rotor.rotation.y += dt * 22;
  heli.rotor2.rotation.y += dt * 22;
  heli.target.position.set(tx - heli.group.position.x, -10, tz - heli.group.position.z);
}
