// Driving: arcade car physics, chase camera, enter / exit car.
// The player car is a parked or traffic car the player has taken over.
import * as THREE from 'three';
import { collideMove } from './city.js';
import { nearestCar, carHit, carSpec } from './cars.js';
import { shootAt } from './walker.js';

export function enterCar(W, car) {
  const P = W.player;
  P.inCar = car;
  P.onFoot = false;
  P.carSpeed = 0;
  car.stolen = true;
  if (car.mesh.parent) car.mesh.parent.remove(car.mesh);
  // re-add as the player car (same mesh, now driven by us)
  W.scene.add(car.mesh);
  P.mesh.visible = false;
  P.car = car;
  W.sfx.door();
  if (!car.wasTraffic) W.cops.addWanted(W, 1); // stealing a parked car is a crime
  W.hud.say(W, 'YOU', `You took the ${car.name || car.type}. Drive!`);
}

export function exitCar(W) {
  const P = W.player;
  if (!P.inCar) return;
  const car = P.inCar;
  P.inCar = null;
  P.onFoot = true;
  P.mesh.visible = true;
  // step out to the left of the car
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  P.mesh.position.set(car.x + side.x * 2.2, 0, car.z + side.z * 2.2);
  P.heading = car.heading;
  P.mesh.rotation.y = P.heading;
  W.sfx.door();
  W.sfx.engineOff();
}

export function updateDriver(W, dt) {
  const P = W.player;
  const K = W.keys;
  const car = P.inCar;
  if (!car) return;
  const spec = carSpec(car.type);
  const move = K.pollMove();
  // throttle / brake / reverse
  if (move.y > 0) P.carSpeed += spec.accel * dt;
  else if (move.y < 0) {
    if (P.carSpeed > 1) P.carSpeed -= spec.accel * 1.6 * dt; // brake
    else P.carSpeed -= spec.accel * 0.6 * dt; // reverse
  } else {
    P.carSpeed -= Math.sign(P.carSpeed) * Math.min(Math.abs(P.carSpeed), 8 * dt);
  }
  P.carSpeed = Math.max(-12, Math.min(spec.max, P.carSpeed));
  // steering scales with speed, less at top speed
  const steerAuthority = Math.min(1, Math.abs(P.carSpeed) / 8);
  car.heading += move.x * 1.9 * steerAuthority * dt * Math.sign(P.carSpeed || 1);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.x += fx * P.carSpeed * dt;
  car.z += fz * P.carSpeed * dt;
  const pos = new THREE.Vector3(car.x, 0, car.z);
  if (collideMove(W, pos, 1.6)) {
    if (Math.abs(P.carSpeed) > 8) {
      W.sfx.crash();
      P.carSpeed *= -0.25;
      if (W.cops) W.cops.addWanted(W, 0); // crash alone is not a crime
    } else {
      P.carSpeed *= 0.4;
    }
    car.x = pos.x; car.z = pos.z;
  }
  // bump into traffic cars
  const other = carHit(W, car.x, car.z, 1.6);
  if (other && other !== car) {
    if (Math.abs(P.carSpeed) > 10) {
      W.sfx.crash();
      W.sfx.honk();
      P.carSpeed *= 0.5;
      // shove the other car aside
      other.x += fx * 1.5; other.z += fz * 1.5;
      if (other.mesh) { other.mesh.position.set(other.x, 0, other.z); }
    } else {
      P.carSpeed *= 0.6;
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // body roll + wheel spin
  car.mesh.rotation.z = -move.x * 0.05 * Math.min(1, Math.abs(P.carSpeed) / 15);
  for (const w of car.mesh.userData.wheels) w.rotation.x += P.carSpeed * dt * 2;
  W.sfx.engine(Math.abs(P.carSpeed) / spec.max);
  // handbrake slide
  if (K.isDown('Space') && Math.abs(P.carSpeed) > 5) {
    car.heading += move.x * 0.6 * dt;
    P.carSpeed *= (1 - 0.4 * dt);
  }
  // exit
  if (K.wasPressed('KeyE') || K.touch.enter) {
    K.touch.enter = false;
    if (Math.abs(P.carSpeed) < 3) exitCar(W);
  }
  // shooting from the car window (drive-by, through the mouse ray)
  if (P.weapon > 0 && K.mouseClicked()) shootAt(W);
  // chase camera: behind the car, smoothed
  const camTarget = new THREE.Vector3(car.x, 1.4, car.z);
  const back = new THREE.Vector3(-fx, 0, -fz);
  const desired = camTarget.clone()
    .addScaledVector(back, 8.5 + Math.abs(P.carSpeed) * 0.08)
    .add(new THREE.Vector3(0, 3.4, 0));
  W.camera.position.lerp(desired, Math.min(1, dt * 5));
  const look = camTarget.clone().addScaledVector(new THREE.Vector3(fx, 0, fz), 6);
  W.camera.lookAt(look.x, 1.6, look.z);
  // speedometer value for the HUD
  P.speedKmh = Math.round(Math.abs(P.carSpeed) * 3.6);
}

// Try to enter the nearest car (called from boot when E is pressed on foot).
export function tryEnterCar(W) {
  const P = W.player;
  const car = nearestCar(W, P.mesh.position.x, P.mesh.position.z, 3.6);
  if (!car) return false;
  if (car.mesh && W.traffic.includes(car)) {
    // yank the driver out of a moving car: it stops and becomes ours
    car.speed = 0;
    car.wasTraffic = true;
    W.traffic = W.traffic.filter((c) => c !== car);
    car.name = car.type === 'taxi' ? 'Taxi' : 'Sedan';
    W.cops.addWanted(W, 1);
  }
  enterCar(W, car);
  return true;
}
