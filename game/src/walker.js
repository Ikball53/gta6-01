// On-foot player: low-poly walker, third-person camera, punch and gun.
// Shooting raycasts from the camera through the mouse (or screen centre).
import * as THREE from 'three';
import { collideMove } from './city.js';

const WEAPONS = [
  { name: 'Fists', ammo: Infinity, reserve: Infinity, dmg: 26, rate: 0.45, range: 2.4 },
  { name: 'Pistol', ammo: 12, reserve: 48, dmg: 34, rate: 0.28, range: 60 },
  { name: 'Rifle', ammo: 32, reserve: 128, dmg: 26, rate: 0.1, range: 80 },
  { name: 'Shotgun', ammo: 6, reserve: 18, dmg: 60, rate: 0.8, range: 22 },
];
export { WEAPONS };

export function createPlayer(W) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2a9a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
  head.position.y = 1.66; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), hair);
  cap.position.y = 1.9; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.26), pants);
  legL.position.set(-0.16, 0.33, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  // pistol in the right hand when armed
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  barrel.position.z = 0.18; gun.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  grip.position.set(0, -0.1, 0); gun.add(grip);
  gun.position.set(0.42, 0.82, 0.25);
  gun.visible = false;
  g.add(gun);
  g.userData = { legL, legR, armL, armR, gun, walkPhase: 0 };
  W.scene.add(g);
  return g;
}

function spawnTracer(W, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 }));
  W.scene.add(line);
  W.tracers = W.tracers || [];
  W.tracers.push({ line, life: 0.09 });
}

function damageEnemy(W, enemy, dmg, fromPos) {
  enemy.hp -= dmg;
  if (enemy.mesh) {
    enemy.mesh.position.x += (enemy.mesh.position.x - fromPos.x) * 0.02;
    enemy.mesh.position.z += (enemy.mesh.position.z - fromPos.z) * 0.02;
  }
  if (enemy.hp <= 0 && !enemy.dead) {
    enemy.dead = true;
    if (enemy.mesh) enemy.mesh.visible = false;
    W.player.cash += enemy.bounty || 0;
    if (enemy.kind === 'rival') W.sfx.pickup();
    if (W.cops) W.cops.onKill && W.cops.onKill(W, enemy);
  }
}

export function shootAt(W) {
  const P = W.player;
  const wpn = WEAPONS[P.weapon];
  if (!wpn || P.weapon === 0) return;
  if (P.ammo[P.weapon] <= 0) { W.sfx.click(); return; }
  const now = W.elapsed;
  if (now - (P.lastShot || 0) < wpn.rate) return;
  P.lastShot = now;
  P.ammo[P.weapon]--;
  W.sfx.shot();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(W.keys.mouse.ndcX, W.keys.mouse.ndcY), W.camera);
  ray.far = wpn.range;
  // muzzle flash point
  const from = P.mesh.position.clone(); from.y = 1.4;
  let end = ray.ray.at(wpn.range, new THREE.Vector3());
  // hit enemies first
  const targets = [];
  for (const e of (W.enemies || [])) {
    if (e.dead || !e.mesh || !e.mesh.visible) continue;
    targets.push(e.mesh);
  }
  for (const c of (W.cops?.units || [])) {
    if (c.dead || !c.mesh || !c.mesh.visible) continue;
    targets.push(c.mesh);
  }
  const hits = ray.intersectObjects(targets, true);
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    // walk up to the enemy root
    let obj = hit.object;
    while (obj && !obj.userData.enemyRef) obj = obj.parent;
    const enemy = obj ? obj.userData.enemyRef : null;
    if (enemy) damageEnemy(W, enemy, wpn.dmg, P.mesh.position);
  }
  spawnTracer(W, from, end);
  // recoil kick on the camera
  W.camKick = (W.camKick || 0) + 0.012;
  // firing a gun in public draws the law
  if (W.cops && P.wanted < 2) W.cops.addWanted(W, 1);
}

export function punchAt(W) {
  const P = W.player;
  const now = W.elapsed;
  if (now - (P.lastPunch || 0) < 0.45) return;
  P.lastPunch = now;
  W.sfx.punch();
  const px = P.mesh.position.x, pz = P.mesh.position.z;
  const all = [...(W.enemies || []), ...(W.cops?.units || [])];
  for (const e of all) {
    if (e.dead || !e.mesh || !e.mesh.visible) continue;
    const d = Math.hypot(e.mesh.position.x - px, e.mesh.position.z - pz);
    if (d < 2.4) damageEnemy(W, e, WEAPONS[0].dmg, P.mesh.position);
  }
}

export function updateWalker(W, dt) {
  const P = W.player;
  const K = W.keys;
  const move = K.pollMove();
  const sprint = K.sprint();
  const speed = sprint ? 7.5 : 4.4;
  // Character-relative movement (GTA-style): the stick / WASD moves the
  // player along their OWN facing, and left/right TURNS the player.
  // The old camera-relative scheme fed the camera direction back into the
  // movement direction while the chase camera was slaved to the player
  // heading, so holding the stick sideways made the target heading chase
  // itself in a circle and the player spun forever (~300 deg/s) — which is
  // what made the minimap arrow spin nonstop. Turning now comes only from
  // explicit left/right input, so there is no feedback loop: the heading
  // only changes while the stick is held sideways, and stops dead the
  // moment it is released.
  // Sign: heading DECREASES for stick-right. Facing is (sin h, cos h) and
  // the minimap draws +x right / +z down, so a right turn from facing
  // south (+z) is toward west (-x), i.e. heading 0 -> -PI/2. (The old
  // `heading +=` direction and the old inverted `right` vector both turned
  // the player screen-left for stick-right.)
  const TURN_RATE = 3.0; // rad/s at full deflection: a full 360 turn ~2.1 s
  if (Math.abs(move.x) > 0.001) {
    P.heading -= move.x * TURN_RATE * dt;
    P.mesh.rotation.y = P.heading;
  }
  const moving = Math.abs(move.y) > 0.001;
  if (moving) {
    const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
    P.mesh.position.x += fx * move.y * speed * dt;
    P.mesh.position.z += fz * move.y * speed * dt;
    P.mesh.userData.walkPhase += dt * (sprint ? 13 : 9);
    const ph = P.mesh.userData.walkPhase;
    P.mesh.userData.legL.rotation.x = Math.sin(ph) * 0.7;
    P.mesh.userData.legR.rotation.x = -Math.sin(ph) * 0.7;
    P.mesh.userData.armL.rotation.x = -Math.sin(ph) * 0.5;
    P.mesh.userData.armR.rotation.x = Math.sin(ph) * 0.5;
  } else {
    P.mesh.userData.legL.rotation.x *= 0.8;
    P.mesh.userData.legR.rotation.x *= 0.8;
    P.mesh.userData.armL.rotation.x *= 0.8;
    P.mesh.userData.armR.rotation.x *= 0.8;
  }
  collideMove(W, P.mesh.position, 0.55);
  // hospital heals
  const h = W.city.spots.hospital;
  if (Math.hypot(P.mesh.position.x - h.x, P.mesh.position.z - h.z) < 14) {
    P.health = Math.min(100, P.health + dt * 12);
  }
  // weapon switching
  for (let i = 0; i < 4; i++) {
    if (K.wasPressed('Digit' + (i + 1))) {
      P.weapon = i;
      P.mesh.userData.gun.visible = i > 0;
      W.sfx.click();
    }
  }
  if (K.wasPressed('KeyF') || (P.weapon === 0 && K.mouseClicked())) punchAt(W);
  if (P.weapon > 0 && (K.mouse.down || K.touch.shoot)) shootAt(W);
  if (K.mouseClicked() && P.weapon > 0) shootAt(W);
  // tracers fade
  if (W.tracers) {
    for (const t of W.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09);
      if (t.life <= 0) { W.scene.remove(t.line); t.line.geometry.dispose(); }
    }
    W.tracers = W.tracers.filter((t) => t.life > 0);
  }
  // third-person camera: behind and above the walker
  const camTarget = P.mesh.position.clone();
  camTarget.y += 1.6;
  const back = new THREE.Vector3(Math.sin(P.heading), 0, Math.cos(P.heading));
  const desired = camTarget.clone().addScaledVector(back, -6.2).add(new THREE.Vector3(0, 3.1, 0));
  W.camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
  W.camera.lookAt(camTarget.x, camTarget.y + 0.4, camTarget.z);
}
