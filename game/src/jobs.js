// Missions and the Rosa story for SOLMAR HEAT.
// Five story chapters plus repeatable side jobs (delivery, taxi, ambulance).
// Win the story for $50,000 — or reach $100,000 cash any way you like.
import * as THREE from 'three';
import { setWanted } from './cops.js';

const STORY = [
  {
    id: 'steal', title: 'CHAPTER 1 · THE FALCO GT', name: 'Steal the Falco GT',
    brief: 'Rosa needs a fast car. Take the red Falco GT parked by your house and bring it to the diner.',
    next: 'Get in the Falco GT, then drive to Rosa\u2019s Diner.',
  },
  {
    id: 'lunch', title: 'CHAPTER 2 · LUNCH RUSH', name: 'Lunch rush',
    brief: 'Rosa\u2019s Diner is slammed. Deliver food to three hungry customers across town before the timer runs out.',
    next: 'Pick up the food at the diner, then deliver it. 3 stops left.',
  },
  {
    id: 'getaway', title: 'CHAPTER 3 · THREE-STAR GETAWAY', name: 'Three-star getaway',
    brief: 'The crew hit the wrong truck. The whole PD is on you. Lose the cops and reach the hideout in the West End.',
    next: 'Lose the cops, then reach the hideout.',
  },
  {
    id: 'rivals', title: 'CHAPTER 4 · RIVAL CREW', name: 'Rival crew fight',
    brief: 'The Harbor crew is muscling in on the market. Drive them out — fists or firepower, your call.',
    next: 'Take out the rival crew at the market. 4 left.',
  },
  {
    id: 'vault', title: 'CHAPTER 5 · THE VAULT', name: 'The vault heist',
    brief: 'One last job: grab the cash from Solmar Bank and bring it home to the hideout. No cops on your tail.',
    next: 'Grab the cash at the bank, then reach the hideout.',
  },
];

const SIDE_JOBS = {
  delivery: { title: 'SIDE JOB · FOOD DELIVERY', name: 'Food delivery', pay: 150,
    brief: 'A customer is hungry. Pick up the order at Rosa\u2019s Diner and deliver it fast.' },
  taxi: { title: 'SIDE JOB · TAXI FARE', name: 'Taxi fare', pay: 120,
    brief: 'A fare is waiting downtown. Pick them up and drop them at the beach.' },
  ambulance: { title: 'SIDE JOB · AMBULANCE RUN', name: 'Ambulance run', pay: 200,
    brief: 'A patient needs the hospital. Drive the ambulance to the pickup, then to Solmar General.' },
};

export function createJobs(W) {
  const jobs = {
    storyStage: 0,          // 0..5, 5 = story complete
    storyActive: false,
    active: null,           // {kind, title, name, stage, total, target, timer, pay, ...}
    marker: null,           // glowing target marker mesh
    beacon: null,
    rivalsLeft: 0,
    won: false,
  };
  W.jobs = jobs;
  // marker: glowing ring + light pillar so the target reads from anywhere
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  W.scene.add(ring);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  pillar.visible = false;
  W.scene.add(pillar);
  jobs.marker = ring;
  jobs.beacon = pillar;
  // side-job start pads (small glowing pads on the ground)
  jobs.pads = [];
  const padDefs = [
    { kind: 'delivery', pos: W.city.spots.diner, color: 0xffd27a },
    { kind: 'taxi', pos: new THREE.Vector3(0, 0, 6), color: 0x7ae0ff },
    { kind: 'ambulance', pos: W.city.spots.hospital, color: 0xff6a6a },
  ];
  for (const pd of padDefs) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.25, 20),
      new THREE.MeshLambertMaterial({ color: pd.color, emissive: pd.color, emissiveIntensity: 0.5 }));
    pad.position.set(pd.pos.x, 0.15, pd.pos.z);
    W.scene.add(pad);
    jobs.pads.push({ ...pd, mesh: pad });
  }
  return jobs;
}

function setMarker(W, pos) {
  const j = W.jobs;
  if (!pos) { j.marker.visible = false; j.beacon.visible = false; return; }
  j.marker.visible = true; j.beacon.visible = true;
  j.marker.position.set(pos.x, 0.35, pos.z);
  j.beacon.position.set(pos.x, 30, pos.z);
}

function playerPos(W) {
  const P = W.player;
  return P.inCar ? new THREE.Vector3(P.inCar.x, 0, P.inCar.z) : P.mesh.position;
}

function startStoryChapter(W, stage) {
  const j = W.jobs;
  const ch = STORY[stage];
  if (!ch) return;
  j.storyActive = true;
  const S = W.city.spots;
  const job = { kind: 'story', chapter: stage, title: ch.title, name: ch.name, stage: 0, total: 1, timer: 0, pay: 0 };
  if (ch.id === 'steal') {
    job.target = new THREE.Vector3(-94, 0, 96); // the Falco GT
    job.total = 2; job.stage = 0;
  } else if (ch.id === 'lunch') {
    job.target = S.diner.clone(); job.total = 4; job.stage = 0; job.timer = 150;
    job.stops = [new THREE.Vector3(40, 0, 80), new THREE.Vector3(-80, 0, -40), new THREE.Vector3(120, 0, 20)];
  } else if (ch.id === 'getaway') {
    setWanted(W, 3);
    job.target = S.hideout.clone(); job.total = 2; job.stage = 0;
    W.hud.say(W, 'ROSA', 'Cops everywhere! Lose them and get to the hideout, West End.');
  } else if (ch.id === 'rivals') {
    job.target = S.market.clone(); job.total = 5; job.stage = 0;
    spawnRivals(W, S.market);
  } else if (ch.id === 'vault') {
    job.target = S.bank.clone(); job.total = 2; job.stage = 0;
  }
  j.active = job;
  setMarker(W, job.target);
  W.hud.setMissionCard(W, ch.title, ch.brief, job.stage, job.total, ch.next);
  W.hud.say(W, 'ROSA', ch.brief);
  W.sfx.pickup();
}

function spawnRivals(W, center) {
  W.enemies = W.enemies || [];
  const rng = W.rng;
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: [0xc02030, 0x8a2a5a, 0x30202a, 0xa03030][i] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a06a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
    head.position.y = 1.66; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    legL.position.set(-0.16, 0.33, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    const x = center.x + (rng() - 0.5) * 16;
    const z = center.z + (rng() - 0.5) * 16;
    g.position.set(x, 0, z);
    W.scene.add(g);
    const enemy = { mesh: g, kind: 'rival', x, z, hp: 70, dead: false, bounty: 120, speed: 3.4, walkPhase: rng() * 6 };
    g.userData.enemyRef = enemy;
    W.enemies.push(enemy);
  }
  W.jobs.rivalsLeft = 4;
}

function completeJob(W, job) {
  const j = W.jobs;
  const P = W.player;
  if (job.kind === 'story') {
    j.storyStage = job.chapter + 1;
    setMarker(W, null);
    W.sfx.complete();
    if (job.chapter === 4) {
      P.cash += 50000;
      j.won = true;
      W.hud.say(W, 'ROSA', 'We did it. Fifty grand, and the city is ours.');
      W.hud.showScreen(W, 'win');
      return;
    }
    W.hud.say(W, 'ROSA', 'Chapter done. Come see me at the diner when you are ready.');
    j.active = null;
    j.storyActive = false;
    // next chapter starts at the diner
    j.nextChapterAt = W.city.spots.diner.clone();
    setMarker(W, j.nextChapterAt);
    W.hud.setMissionCard(W, 'STORY · NEXT CHAPTER', 'Head to Rosa\u2019s Diner to start the next chapter.',
      j.storyStage, 5, 'Rosa\u2019s Diner');
    return;
  }
  P.cash += job.pay;
  W.sfx.cash();
  W.hud.say(W, 'ROSA', `Job done. +$${job.pay}.`);
  setMarker(W, null);
  j.active = null;
  W.hud.setMissionCard(W, '', '', 0, 0, '');
}

function failJob(W, job, why) {
  W.jobs.active = null;
  setMarker(W, null);
  W.sfx.fail();
  W.hud.say(W, 'ROSA', why);
  W.hud.setMissionCard(W, '', '', 0, 0, '');
}

export function startSideJob(W, kind) {
  const j = W.jobs;
  if (j.active) return false;
  const def = SIDE_JOBS[kind];
  const S = W.city.spots;
  const job = { kind, title: def.title, name: def.name, stage: 0, total: 2, timer: kind === 'delivery' ? 120 : 180, pay: def.pay };
  if (kind === 'delivery') { job.target = S.diner.clone(); job.stops = [new THREE.Vector3(80, 0, -80)]; }
  if (kind === 'taxi') { job.target = new THREE.Vector3(0, 0, 6); job.stops = [S.beach.clone()]; }
  if (kind === 'ambulance') { job.target = new THREE.Vector3(40, 0, 40); job.stops = [S.hospital.clone()]; }
  j.active = job;
  setMarker(W, job.target);
  W.hud.setMissionCard(W, def.title, def.brief, 0, 2, 'Reach the marker.');
  W.hud.say(W, 'ROSA', def.brief);
  W.sfx.pickup();
  return true;
}

export function updateJobs(W, dt) {
  const j = W.jobs;
  const P = W.player;
  if (!j) return;
  // marker pulse
  if (j.marker.visible) {
    j.marker.rotation.z += dt * 1.2;
    const s = 1 + Math.sin(W.elapsed * 4) * 0.12;
    j.marker.scale.set(s, s, 1);
  }
  // walk into the diner pad to start / continue the story
  if (!j.active && j.nextChapterAt) {
    const p = playerPos(W);
    if (Math.hypot(p.x - j.nextChapterAt.x, p.z - j.nextChapterAt.z) < 4) {
      j.nextChapterAt = null;
      startStoryChapter(W, j.storyStage);
    }
  }
  if (!j.active && !j.storyActive && j.storyStage === 0) {
    const p = playerPos(W);
    const d = W.city.spots.diner;
    if (Math.hypot(p.x - d.x, p.z - d.z) < 5) startStoryChapter(W, 0);
  }
  // walk onto a side-job pad to start it
  if (!j.active) {
    const p = playerPos(W);
    for (const pad of j.pads) {
      if (Math.hypot(p.x - pad.pos.x, p.z - pad.pos.z) < 3) {
        startSideJob(W, pad.kind);
        break;
      }
    }
  }
  const job = j.active;
  if (!job) return;
  // countdown
  if (job.timer > 0) {
    job.timer -= dt;
    if (job.timer <= 0) { failJob(W, job, 'Too slow. The job is gone.'); return; }
  }
  const p = playerPos(W);
  const d = Math.hypot(p.x - job.target.x, p.z - job.target.z);
  W.hud.setMissionDistance(W, Math.round(d));
  if (d > 4) return; // not there yet
  // arrived at the current target
  if (job.kind === 'story') {
    const ch = STORY[job.chapter];
    if (ch.id === 'steal') {
      if (job.stage === 0) {
        if (P.inCar && P.inCar.type === 'sports') {
          job.stage = 1; job.target = W.city.spots.diner.clone(); setMarker(W, job.target);
          W.hud.setMissionCard(W, ch.title, ch.brief, 1, 2, 'Drive the Falco GT to Rosa\u2019s Diner.');
          W.hud.say(W, 'ROSA', 'That is the one. Now bring it to the diner.');
        } else {
          W.hud.say(W, 'ROSA', 'Get in the red Falco GT first.');
          job.target = new THREE.Vector3(-94, 0, 96);
        }
        return;
      }
      if (P.inCar && P.inCar.type === 'sports') completeJob(W, job);
      else W.hud.say(W, 'ROSA', 'Bring the Falco GT here, not on foot.');
      return;
    }
    if (ch.id === 'lunch') {
      if (job.stage === 0) {
        job.stage = 1; job.target = job.stops[0].clone(); setMarker(W, job.target);
        W.hud.setMissionCard(W, ch.title, ch.brief, 1, 4, 'Deliver the food. 3 stops left.');
        W.sfx.pickup();
        return;
      }
      job.stage++;
      W.sfx.cash(); P.cash += 80;
      if (job.stage > 3) { completeJob(W, job); return; }
      job.target = job.stops[job.stage - 1].clone(); setMarker(W, job.target);
      W.hud.setMissionCard(W, ch.title, ch.brief, job.stage, 4, `Deliver the food. ${4 - job.stage} stops left.`);
      return;
    }
    if (ch.id === 'getaway') {
      if (job.stage === 0) {
        if (P.wanted > 0) { W.hud.say(W, 'ROSA', 'Lose the cops first — get out of sight.'); return; }
        job.stage = 1; job.target = W.city.spots.hideout.clone(); setMarker(W, job.target);
        W.hud.setMissionCard(W, ch.title, ch.brief, 1, 2, 'Reach the hideout.');
        return;
      }
      completeJob(W, job);
      return;
    }
    if (ch.id === 'rivals') {
      const left = (W.enemies || []).filter((e) => e.kind === 'rival' && !e.dead).length;
      W.jobs.rivalsLeft = left;
      W.hud.setMissionCard(W, ch.title, ch.brief, 4 - left, 5, `Take out the rival crew. ${left} left.`);
      if (left === 0) completeJob(W, job);
      return;
    }
    if (ch.id === 'vault') {
      if (job.stage === 0) {
        job.stage = 1; job.target = W.city.spots.hideout.clone(); setMarker(W, job.target);
        P.cash += 2000; // grabbed from the vault counter
        W.sfx.cash();
        W.hud.setMissionCard(W, ch.title, ch.brief, 1, 2, 'Cash grabbed. Reach the hideout — no cops.');
        W.hud.say(W, 'ROSA', 'Got it! Now get to the hideout, quiet and fast.');
        return;
      }
      completeJob(W, job);
      return;
    }
  } else {
    // side jobs: pickup then drop-off
    if (job.stage === 0) {
      job.stage = 1; job.target = job.stops[0].clone(); setMarker(W, job.target);
      W.sfx.pickup();
      W.hud.setMissionCard(W, job.title, '', 1, 2, 'Now deliver it.');
      return;
    }
    completeJob(W, job);
  }
}

// Rivals chase and punch the player when close.
export function updateEnemies(W, dt) {
  const P = W.player;
  const pp = playerPos(W);
  for (const e of (W.enemies || [])) {
    if (e.dead || !e.mesh) continue;
    const dx = pp.x - e.mesh.position.x, dz = pp.z - e.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 26) {
      const step = Math.min(d, e.speed * dt);
      e.mesh.position.x += (dx / (d || 1)) * step;
      e.mesh.position.z += (dz / (d || 1)) * step;
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.walkPhase += dt * 10;
      const legs = e.mesh.children.filter((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.height === 0.66);
      if (legs[0]) legs[0].rotation.x = Math.sin(e.walkPhase) * 0.6;
      if (legs[1]) legs[1].rotation.x = -Math.sin(e.walkPhase) * 0.6;
      if (d < 1.9 && W.elapsed - (e.lastHit || 0) > 1.1) {
        e.lastHit = W.elapsed;
        P.health -= 7;
        W.sfx.punch();
      }
    }
  }
}
