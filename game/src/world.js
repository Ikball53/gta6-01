// Solmar City layout: a 5x5 road grid, downtown towers, houses, parks,
// hospital, police station, and an elevated metro loop. All boxes and
// planes — cheap enough for software rendering, lit by sun + sky.
import * as THREE from 'three';

export const CITY = {
  half: 190,          // city extends -190..190 on x and z
  block: 56,          // block pitch
  roadW: 12,          // road width
  hospital: { x: -140, z: -140 },
  police: { x: 140, z: -140 },
  house: { x: 0, z: 120 },   // player spawn, in front of this house
  downtown: { x: 0, z: -60 },
};

const PALETTE = [0x8fa3c0, 0xc0a58f, 0x9fb08f, 0xb08fa3, 0x7f93b0, 0xc7b299];

function box(w, h, d, color, x, y, z, mat) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat || new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02 })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  group.name = 'city';
  const rnd = rand(20261118);
  const mats = {
    grass: new THREE.MeshStandardMaterial({ color: 0x4d8a4a, roughness: 1 }),
    road: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 1 }),
    walk: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 1 }),
    line: new THREE.MeshBasicMaterial({ color: 0xf5d90a }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    roof: new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 1 }),
  };

  // Ground + parks
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mats.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: grid every 56 units, plus sidewalks as slightly wider pale strips.
  const roads = [];
  for (let i = -3; i <= 3; i++) {
    const c = i * CITY.block;
    const walkX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadW + 6, 400), mats.walk);
    walkX.rotation.x = -Math.PI / 2;
    walkX.position.set(c, 0.02, 0);
    walkX.receiveShadow = true;
    group.add(walkX);
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadW, 400), mats.road);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(c, 0.04, 0);
    roadX.receiveShadow = true;
    group.add(roadX);
    const walkZ = new THREE.Mesh(new THREE.PlaneGeometry(400, CITY.roadW + 6), mats.walk);
    walkZ.rotation.x = -Math.PI / 2;
    walkZ.position.set(0, 0.02, c);
    walkZ.receiveShadow = true;
    group.add(walkZ);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(400, CITY.roadW), mats.road);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.04, c);
    roadZ.receiveShadow = true;
    group.add(roadZ);
    roads.push(c);
    // Dashed centre lines along both roads
    for (let t = -180; t < 180; t += 12) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), mats.line);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(c, 0.06, t);
      group.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), mats.line);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.06, c);
      group.add(d2);
    }
  }

  // Buildings: downtown towers near centre-north, mid blocks elsewhere.
  const towers = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      const bx = gx * CITY.block + 28;
      const bz = gz * CITY.block + 28;
      if (Math.abs(bx) > 175 || Math.abs(bz) > 175) continue;
      // Keep the spawn street, hospital and police plots clear.
      if (Math.abs(bx - CITY.hospital.x) < 24 && Math.abs(bz - CITY.hospital.z) < 24) continue;
      if (Math.abs(bx - CITY.police.x) < 24 && Math.abs(bz - CITY.police.z) < 24) continue;
      if (Math.abs(bx - CITY.house.x) < 24 && Math.abs(bz - CITY.house.z) < 24) continue;
      const downtown = Math.abs(bx) < 90 && bz < 0 && bz > -140;
      const h = downtown ? 26 + rnd() * 55 : 8 + rnd() * 14;
      const w = 16 + rnd() * 10;
      const d = 16 + rnd() * 10;
      const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
      const b = box(w, h, d, color, bx, h / 2, bz);
      group.add(b);
      towers.push(b);
      // Lit windows: a slightly larger dark box with emissive speckle is too
      // costly; use a thin glowing strip near the top instead.
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, 0.8, d + 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
      );
      strip.position.set(bx, h * 0.72, bz);
      group.add(strip);
    }
  }

  // Houses with yards and fences (south side, player street).
  const houses = [];
  for (let i = -2; i <= 2; i++) {
    const hx = i * 34;
    const hz = CITY.house.z;
    const home = box(12, 5, 10, 0xe8dcc0, hx, 2.5, hz);
    group.add(home);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(9.5, 3.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 1 })
    );
    roof.position.set(hx, 6.7, hz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    // Yard fence: four thin rails around a 20x16 yard.
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
    [[0, -8, 20, 0.3], [0, 8, 20, 0.3]].forEach(([ox, oz, w, d]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), fenceMat);
      f.position.set(hx + ox, 0.55, hz + oz);
      f.castShadow = true;
      group.add(f);
    });
    [[-10, 0, 0.3, 16], [10, 0, 0.3, 16]].forEach(([ox, oz, w, d]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), fenceMat);
      f.position.set(hx + ox, 0.55, hz + oz);
      f.castShadow = true;
      group.add(f);
    });
    houses.push(home);
  }

  // Hospital: white block with red cross slab + green lawn.
  const hosp = box(26, 12, 18, 0xf4f6f8, CITY.hospital.x, 6, CITY.hospital.z);
  group.add(hosp);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xd92020 });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 2), crossMat);
  c1.position.set(CITY.hospital.x, 13.4, CITY.hospital.z + 9.2);
  group.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(2, 7, 2), crossMat);
  c2.position.set(CITY.hospital.x, 13.4, CITY.hospital.z + 9.2);
  group.add(c2);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(34, 26),
    new THREE.MeshStandardMaterial({ color: 0x5da85a, roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(CITY.hospital.x, 0.03, CITY.hospital.z);
  group.add(lawn);

  // Police station: dark blue block, badge disc, flag pole.
  const station = box(24, 10, 16, 0x2c4a7a, CITY.police.x, 5, CITY.police.z);
  group.add(station);
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  badge.rotation.x = Math.PI / 2;
  badge.position.set(CITY.police.x, 6, CITY.police.z + 8.2);
  group.add(badge);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }));
  pole.position.set(CITY.police.x + 14, 6, CITY.police.z + 8);
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2),
    new THREE.MeshBasicMaterial({ color: 0x2c6fd6, side: THREE.DoubleSide }));
  flag.position.set(CITY.police.x + 15.8, 10.5, CITY.police.z + 8);
  group.add(flag);

  // Parks: trees (cone + cylinder) on two green squares.
  const parkSpots = [[-84, 84], [84, 28]];
  const trees = [];
  for (const [px, pz] of parkSpots) {
    const lawnP = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x5da85a, roughness: 1 }));
    lawnP.rotation.x = -Math.PI / 2;
    lawnP.position.set(px, 0.03, pz);
    group.add(lawnP);
    for (let i = 0; i < 7; i++) {
      const tx = px - 14 + rnd() * 28;
      const tz = pz - 14 + rnd() * 28;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
      trunk.position.set(tx, 1.2, tz);
      trunk.castShadow = true;
      group.add(trunk);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f7a33, roughness: 1 }));
      top.position.set(tx, 4.4, tz);
      top.castShadow = true;
      group.add(top);
      trees.push(top);
    }
  }

  // Traffic lights + signs at a few intersections.
  const lights = [];
  for (const [lx, lz] of [[0, 0], [56, -56], [-56, 56], [0, -112]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    post.position.set(lx + 7.5, 2.75, lz + 7.5);
    group.add(post);
    const head = box(1, 2.4, 1, 0x111111, lx + 7.5, 5.6, lz + 7.5);
    group.add(head);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x30d158 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), lampMat);
    lamp.position.set(lx + 7.5, 6.1, lz + 8.05);
    group.add(lamp);
    lights.push({ lamp, mat: lampMat, timer: rnd() * 6 });
    // Street sign plate
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1),
      new THREE.MeshBasicMaterial({ color: 0x1f6fd6, side: THREE.DoubleSide }));
    sign.position.set(lx - 7.5, 3.4, lz - 7.5);
    group.add(sign);
  }

  // Street lamps along the main avenue.
  for (let t = -168; t <= 168; t += 28) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    post.position.set(7.5, 3, t);
    group.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    bulb.position.set(7.5, 6.1, t);
    group.add(bulb);
  }

  // Elevated metro loop: a square rail ring with a moving train.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x555c66, roughness: 0.6, metalness: 0.5 });
  const railY = 7;
  const loopR = 84;
  const railSegs = [];
  for (const [x, z, w, d] of [
    [0, -loopR, loopR * 2 + 4, 2], [0, loopR, loopR * 2 + 4, 2],
    [-loopR, 0, 2, loopR * 2 + 4], [loopR, 0, 2, loopR * 2 + 4],
  ]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), railMat);
    r.position.set(x, railY, z);
    group.add(r);
    railSegs.push(r);
    // Support pillars every 28 units along the ring.
    const n = Math.floor((w > d ? w : d) / 28);
    for (let i = 0; i <= n; i++) {
      const t = -((w > d ? w : d) / 2) + i * 28;
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, railY, 1.2), railMat);
      p.position.set(w > d ? t : x, railY / 2, w > d ? z : t);
      group.add(p);
    }
  }
  const train = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const car = box(8, 2.6, 3, i === 0 ? 0xd92020 : 0xe8e8e8, -i * 9, 0, 0);
    train.add(car);
    const win = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.9, 3.1),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
    win.position.set(-i * 9, 0.4, 0);
    train.add(win);
  }
  train.position.set(-loopR, railY + 1.6, -loopR);
  group.add(train);

  scene.add(group);
  return { group, towers, houses, lights, train, loopR, railY, roads };
}
