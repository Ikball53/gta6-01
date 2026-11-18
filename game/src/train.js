// SOLMAR HEAT — the trains. A three-car train circles the outer loop at
// street level and a two-car tram rides the elevated metro loop, both
// moving on the rectangles the city built, so the city always feels alive.

import * as THREE from 'three';

// A point on a rectangle loop of half-size H, s metres along the perimeter.
// Returns the position and the heading of travel there.
export function rectPoint(H, s, y) {
  const per = 8 * H;
  let d = ((s % per) + per) % per;
  if (d < 2 * H) return { x: -H + d, z: -H, heading: Math.PI / 2, y };
  d -= 2 * H;
  if (d < 2 * H) return { x: H, z: -H + d, heading: Math.PI, y };
  d -= 2 * H;
  if (d < 2 * H) return { x: H - d, z: H, heading: -Math.PI / 2, y };
  d -= 2 * H;
  return { x: -H, z: H - d, heading: 0, y };
}

function makeTrainCar(color, len) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.6, len),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 1.6; body.castShadow = true; g.add(body);
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const win = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.9, len * 0.7), glass);
  win.position.y = 1.9; g.add(win);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.3, len),
    new THREE.MeshLambertMaterial({ color: 0x2c2f33 }),
  );
  roof.position.y = 3.05; g.add(roof);
  return g;
}

export function makeRail(scene, city) {
  const trainCars = [];
  for (let i = 0; i < 3; i++) {
    const car = makeTrainCar(i === 0 ? 0xc0392b : 0x8e44ad, 9);
    scene.add(car);
    trainCars.push(car);
  }
  const tramCars = [];
  for (let i = 0; i < 2; i++) {
    const car = makeTrainCar(0x2e86c1, 8);
    scene.add(car);
    tramCars.push(car);
  }
  return {
    train: { cars: trainCars, s: 0, speed: 16 },
    tram: { cars: tramCars, s: 120, speed: 12 },
    city,
  };
}

function placeCars(cars, H, s, y, gap) {
  for (let i = 0; i < cars.length; i++) {
    const p = rectPoint(H, s - i * gap, y);
    cars[i].position.set(p.x, p.y, p.z);
    cars[i].rotation.y = p.heading;
  }
}

export function updateRail(dt, rail) {
  const H = rail.city.trackHalf;
  rail.train.s += rail.train.speed * dt;
  placeCars(rail.train.cars, H, rail.train.s, 0, 10);
  const M = rail.city.metroHalf;
  rail.tram.s += rail.tram.speed * dt;
  placeCars(rail.tram.cars, M, rail.tram.s, rail.city.metroY + 0.9, 9);
}
