// Deterministic screenshot scenes for SOLMAR HEAT (?scene=menu|chase|downtown|mission).
// Each preset places everything before the first frame so the shot
// looks finished the moment the page loads — no waiting, no timers.
import * as THREE from 'three';
import { enterCar } from './driver.js';
import { setWanted } from './cops.js';
import { startSideJob } from './jobs.js';

export function applyScene(W, name) {
  const P = W.player;
  const S = W.city.spots;
  W.sceneName = name;
  if (name === 'menu') {
    // start screen over a slow orbit of downtown at sunset
    W.state = 'menu';
    W.menuOrbit = true;
    P.mesh.position.set(-20, 0, 30);
    P.heading = Math.PI * 0.8;
    P.mesh.rotation.y = P.heading;
    W.camera.position.set(24, 9, 52);
    W.camera.lookAt(0, 6, 0);
    return;
  }
  // every gameplay scene starts playing, HUD on, start screen hidden
  W.state = 'play';
  if (name === 'chase') {
    // player in the red Falco GT, wanted 3, police + helicopter behind
    const car = W.parked.find((c) => c.type === 'sports' && c.x < 0) || W.parked[0];
    car.x = -40; car.z = 0; car.heading = Math.PI / 2; // east down Sunset Blvd
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    enterCar(W, car);
    P.carSpeed = 26;
    setWanted(W, 3);
    // force the pursuit in close behind the player
    W.cops.updateNow = true;
    W.hud.setMissionCard(W, 'CHAPTER 3 · THREE-STAR GETAWAY', 'Escape with the cash! Lose the cops.',
      1, 2, 'Reach the hideout in the West End.');
    W.hud.say(W, 'ROSA', 'Lose that helicopter before you come near my garage!');
    W.camera.position.set(car.x - 10, 4.5, car.z - 12);
    W.camera.lookAt(car.x, 1.5, car.z);
    return;
  }
  if (name === 'downtown') {
    // on foot downtown, facing east down Sunset Blvd: canyon, traffic, sun
    P.mesh.position.set(-20, 0, 0);
    P.heading = Math.PI / 2;
    P.mesh.rotation.y = P.heading;
    P.weapon = 1;
    P.mesh.userData.gun.visible = true;
    W.hud.setMissionCard(W, 'FREE ROAM · DOWNTOWN', 'Explore Solmar City. Steal a car with E, take a glowing side-job pad.',
      0, 5, 'Rosa\u2019s Diner');
    W.camera.position.set(-27, 4, -6);
    W.camera.lookAt(-20, 1.6, 0);
    return;
  }
  if (name === 'mission') {
    // food delivery active, marker up, player facing the diner + marker
    P.mesh.position.set(-14, 0, 2);
    P.heading = -Math.PI / 4;
    P.mesh.rotation.y = P.heading;
    P.weapon = 0;
    startSideJob(W, 'delivery');
    W.hud.say(W, 'ROSA', 'First order is ready. Get it to the customer, fast!');
    W.camera.position.set(-8, 5, -5);
    W.camera.lookAt(-16, 1.6, 5);
    return;
  }
  // unknown scene: fall back to menu
  W.state = 'menu';
  W.menuOrbit = true;
}
