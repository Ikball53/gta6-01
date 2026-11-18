// Wanted system: police pursuit cars, foot officers, helicopter.
// Stars 1-5; the helicopter with its spotlight joins at 3+.
import * as THREE from 'three';
import { makeCarMesh } from './cars.js';
import { collideMove } from './city.js';

const OFFICER_COLORS = [0x1a2a4a, 0x2a3a5a, 0x1a2a4a];

export function createCops(W) {
  const cops = {
    units: [],        // pursuit cars + officers, each {mesh, kind, x, z, heading, speed, hp, dead, ...}
    heli: null,       // helicopter group
    heliLight: null,  // spotlight
    heliCone: null,
    decayT: 0,
    arrestT: 0,
    flashT: 0,
  };
  W.cops = cops;

  // --- helicopter: body, tail, spinning rotor, searchlight cone ---
  const heli = new THREE.Group();
  const hbody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 1.8),
    new THREE.MeshLambertMaterial({ color: 0x223a6b }));
  hbody.castShadow = true; heli.add(hbody);
  const hglass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x182838, emissive: 0x2a3a4a, emissiveIntensity: 0.6 }));
  hglass.position.set(1.6, 0.2, 0); heli.add(hglass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x223a6b }));
  tail.position.set(-3.0, 0.4, 0); heli.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1; heli.add(rotor);
  const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  skid.position.y = -1.0; heli.add(skid);
  const spot = new THREE.SpotLight(0xfff2cc, 900, 90, 0.32, 0.45, 1.2);
  spot.position.set(0, -0.8, 0);
  heli.add(spot);
  heli.add(spot.target);
  spot.target.position.set(0, -30, 0);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 32, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -16; cone.rotation.x = Math.PI;
  heli.add(cone);
  heli.visible = false;
  heli.position.set(0, 42, 0);
  W.scene.add(heli);
  // systems call these through W.cops
  cops.addWanted = (w, n) => addWanted(w, n);
  cops.setWanted = (w, n) => setWanted(w, n);
  cops.heli = heli;
  cops.heliLight = spot;
  cops.heliCone = cone;
  cops.rotor = rotor;
  return cops;
}

function makeOfficer(W, x, z) {
  const g = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: OFFICER_COLORS[Math.floor(W.rng() * 3)] });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), uni);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
  head.position.y = 1.66; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x101828 }));
  cap.position.y = 1.9; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.26), uni);
  legL.position.set(-0.16, 0.33, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const baton = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  baton.position.set(0.45, 0.9, 0.2); g.add(baton);
  g.position.set(x, 0, z);
  g.userData.enemyRef = null;
  W.scene.add(g);
  const unit = { mesh: g, kind: 'officer', x, z, heading: 0, speed: 5.2, hp: 60, dead: false, bounty: 0, walkPhase: 0 };
  g.userData.enemyRef = unit;
  return unit;
}

function makePursuitCar(W, x, z) {
  const mesh = makeCarMesh(W, 'police');
  mesh.position.set(x, 0, z);
  W.scene.add(mesh);
  const unit = { mesh, kind: 'car', x, z, heading: 0, speed: 0, hp: 120, dead: false, bounty: 0 };
  mesh.userData.enemyRef = unit;
  return unit;
}

function spawnForWanted(W, level) {
  const P = W.player;
  const px = P.mesh.position.x, pz = P.mesh.position.z;
  if (P.inCar) { /* player pos is the car pos; use car pos */ }
  const tx = P.inCar ? P.inCar.x : px;
  const tz = P.inCar ? P.inCar.z : pz;
  const cars = W.cops.units.filter((u) => u.kind === 'car' && !u.dead).length;
  const officers = W.cops.units.filter((u) => u.kind === 'officer' && !u.dead).length;
  const wantCars = Math.min(4, Math.max(1, level - 1));
  const wantOfficers = level >= 2 ? Math.min(4, level) : 0;
  const rng = W.rng;
  for (let i = cars; i < wantCars; i++) {
    const a = rng() * Math.PI * 2;
    const u = makePursuitCar(W, tx + Math.cos(a) * 45, tz + Math.sin(a) * 45);
    W.cops.units.push(u);
  }
  for (let i = officers; i < wantOfficers; i++) {
    const a = rng() * Math.PI * 2;
    const u = makeOfficer(W, tx + Math.cos(a) * 18, tz + Math.sin(a) * 18);
    W.cops.units.push(u);
  }
}

export function updateCops(W, dt) {
  const P = W.player;
  const cops = W.cops;
  if (!cops) return;
  // siren while any star is lit
  W.sfx.siren(P.wanted > 0 && W.state === 'play');
  // flasher strobe on pursuit cars
  cops.flashT += dt;
  const flashOn = Math.floor(cops.flashT * 6) % 2 === 0;
  for (const u of cops.units) {
    if (u.kind !== 'car' || !u.mesh.userData.flashers) continue;
    u.mesh.userData.flashers[0].material.emissiveIntensity = flashOn ? 2.5 : 0.2;
    u.mesh.userData.flashers[1].material.emissiveIntensity = flashOn ? 0.2 : 2.5;
  }
  if (P.wanted <= 0) {
    // stand down: cars drive off, officers walk away
    for (const u of cops.units) {
      if (u.dead) continue;
      u.x += Math.sin(u.heading) * 4 * dt;
      u.z += Math.cos(u.heading) * 4 * dt;
      if (u.mesh) { u.mesh.position.set(u.x, 0, u.z); }
      if (Math.hypot(u.x - P.mesh.position.x, u.z - P.mesh.position.z) > 120) {
        u.dead = true; if (u.mesh) u.mesh.visible = false;
      }
    }
    cops.units = cops.units.filter((u) => !u.dead);
    if (cops.heli) cops.heli.visible = false;
    return;
  }
  spawnForWanted(W, P.wanted);
  const tx = P.inCar ? P.inCar.x : P.mesh.position.x;
  const tz = P.inCar ? P.inCar.z : P.mesh.position.z;
  let nearest = 1e9;
  for (const u of cops.units) {
    if (u.dead) continue;
    const dx = tx - u.x, dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    nearest = Math.min(nearest, d);
    if (u.kind === 'car') {
      // pursuit: steer at the player, ram
      const want = Math.atan2(dx, dz);
      let dh = want - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-1, Math.min(1, dh)) * Math.min(1, dt * 2.2);
      const target = P.inCar ? 34 : 24;
      u.speed += ((d > 8 ? target : 12) - u.speed) * Math.min(1, dt * 1.2);
      u.x += Math.sin(u.heading) * u.speed * dt;
      u.z += Math.cos(u.heading) * u.speed * dt;
      const pos = new THREE.Vector3(u.x, 0, u.z);
      if (collideMove(W, pos, 1.6)) { u.x = pos.x; u.z = pos.z; u.speed *= 0.5; }
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      for (const w of u.mesh.userData.wheels) w.rotation.x += u.speed * dt * 2;
      // ram damage
      if (d < 3.2) {
        if (P.inCar) {
          P.carSpeed = (P.carSpeed || 0) * 0.6;
          if (W.elapsed - (u.lastRam || 0) > 1) { u.lastRam = W.elapsed; W.sfx.crash(); P.health -= 4; }
        } else if (W.elapsed - (u.lastRam || 0) > 1.2) {
          u.lastRam = W.elapsed; W.sfx.crash(); P.health -= 8;
          P.mesh.position.x += (P.mesh.position.x - u.x) * 0.2;
          P.mesh.position.z += (P.mesh.position.z - u.z) * 0.2;
        }
      }
    } else {
      // officer on foot: chase, then arrest
      const want = Math.atan2(dx, dz);
      u.heading = want;
      const step = Math.min(d, u.speed * dt);
      u.x += Math.sin(want) * step;
      u.z += Math.cos(want) * step;
      const pos = new THREE.Vector3(u.x, 0, u.z);
      collideMove(W, pos, 0.5);
      u.x = pos.x; u.z = pos.z;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      u.walkPhase += dt * 11;
      const legs = u.mesh.children.filter((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.height === 0.66);
      if (legs[0]) legs[0].rotation.x = Math.sin(u.walkPhase) * 0.6;
      if (legs[1]) legs[1].rotation.x = -Math.sin(u.walkPhase) * 0.6;
      if (d < 1.8 && !P.inCar) {
        cops.arrestT += dt;
        if (cops.arrestT > 2.5) {
          W.hud.showScreen(W, 'busted');
          return;
        }
      }
      if (d < 2.2 && !P.inCar && W.elapsed - (u.lastHit || 0) > 1) {
        u.lastHit = W.elapsed;
        P.health -= 6;
        W.sfx.punch();
      }
    }
  }
  if (nearest > 12) cops.arrestT = Math.max(0, cops.arrestT - dt);
  // wanted decay: stay out of sight and the heat fades
  if (nearest > 45) {
    cops.decayT += dt;
    if (cops.decayT > 9) {
      cops.decayT = 0;
      P.wanted = Math.max(0, P.wanted - 1);
      if (P.wanted === 0) W.hud.say(W, 'ROSA', 'You lost them. Nice driving.');
    }
  } else cops.decayT = 0;
  // helicopter at 3+ stars
  const heli = cops.heli;
  if (heli) {
    if (P.wanted >= 3) {
      heli.visible = true;
      const hx = tx + Math.sin(W.elapsed * 0.4) * 14;
      const hz = tz + Math.cos(W.elapsed * 0.33) * 14;
      heli.position.x += (hx - heli.position.x) * Math.min(1, dt * 1.5);
      heli.position.z += (hz - heli.position.z) * Math.min(1, dt * 1.5);
      heli.position.y = 40 + Math.sin(W.elapsed * 0.8) * 2;
      heli.rotation.y = Math.atan2(tx - heli.position.x, tz - heli.position.z);
      cops.rotor.rotation.y += dt * 22;
      cops.heliLight.target.position.set(tx - heli.position.x, -40, tz - heli.position.z);
      cops.heliCone.material.opacity = 0.1 + Math.sin(W.elapsed * 3) * 0.04;
    } else heli.visible = false;
  }
  cops.units = cops.units.filter((u) => !u.dead);
}

export function addWanted(W, n) {
  const P = W.player;
  P.wanted = Math.max(0, Math.min(5, P.wanted + n));
}

export function setWanted(W, n) {
  W.player.wanted = Math.max(0, Math.min(5, n));
}
