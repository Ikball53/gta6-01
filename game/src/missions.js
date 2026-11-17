// SOLMAR HEAT — missions: optional jobs and the five-part story.
// Jobs are taken at map markers and never forced; the story pays the big money.

import { STORY, WIN_CASH_GOAL, dist, rand, randi, pick, clamp } from './config.js';
import { randomRoadPoint } from './city.js';
import { addHeat } from './player.js';

function houseSpot(G) {
  return pick(G.city.houses);
}

export function availableJobs(G) {
  const jobs = [];
  const d = G.city.landmarks.diner;
  if (!G.mission && G.storyStep < STORY.length) {
    jobs.push({ x: d.x, y: d.y + 110, label: 'STORY: ' + STORY[G.storyStep].title, kind: 'story' });
  }
  if (!G.mission) {
    for (const e of G.city.eateries) {
      jobs.push({ x: e.x, y: e.y + 80, label: 'Delivery job', kind: 'delivery', eatery: e });
    }
    const taxi = G.taxiStand;
    if (taxi) jobs.push({ x: taxi.x, y: taxi.y, label: 'Taxi fare', kind: 'taxi' });
    const h = G.city.landmarks.hospital;
    jobs.push({ x: h.x, y: h.y + 140, label: 'Ambulance run', kind: 'ambulance' });
  }
  return jobs;
}

export function tryStartJob(G, input) {
  if (G.mission || !input.enter) return false;
  const p = G.player;
  for (const job of availableJobs(G)) {
    if (dist(p.x, p.y, job.x, job.y) < 70) {
      startJob(G, job);
      input.enter = false;
      return true;
    }
  }
  return false;
}

function startJob(G, job) {
  if (job.kind === 'story') startStory(G, G.storyStep);
  else if (job.kind === 'delivery') startDelivery(G, job.eatery);
  else if (job.kind === 'taxi') startTaxi(G);
  else if (job.kind === 'ambulance') startAmbulance(G);
}

function startDelivery(G, eatery) {
  const dest = houseSpot(G);
  G.mission = {
    id: 'delivery', kind: 'delivery', title: 'Food Delivery',
    brief: 'Pick up the order, then drop it off before the timer runs out.',
    stage: 0, timer: 75, reward: randi(80, 150),
    target: { x: eatery.x, y: eatery.y + 60, label: 'Pick up the order' },
    pickup: { x: eatery.x, y: eatery.y + 60 },
    dest: { x: dest.x, y: dest.y, label: 'Deliver here' },
    legs: 1,
  };
  G.message = 'New job: Food Delivery — pick up the order';
  G.messageT = 3;
  if (G.sfx) G.sfx('mission');
}

function startTaxi(G) {
  const dest = houseSpot(G);
  G.mission = {
    id: 'taxi', kind: 'taxi', title: 'Taxi Fare',
    brief: 'A passenger is waiting. Pick them up, then drive them home.',
    stage: 0, timer: 90, reward: 0,
    target: { x: G.taxiStand.x, y: G.taxiStand.y, label: 'Pick up the passenger' },
    pickup: { x: G.taxiStand.x, y: G.taxiStand.y },
    dest: { x: dest.x, y: dest.y, label: 'Drop off here' },
    legs: 1,
  };
  G.message = 'New job: Taxi Fare — pick up the passenger';
  G.messageT = 3;
  if (G.sfx) G.sfx('mission');
}

function startAmbulance(G) {
  if (!G.player.vehicle || G.player.vehicle.type !== 'ambulance') {
    G.message = 'Ambulance run needs an ambulance — steal one first';
    G.messageT = 3;
    return;
  }
  const patient = randomRoadPoint();
  G.mission = {
    id: 'ambulance', kind: 'ambulance', title: 'Ambulance Run',
    brief: 'A patient is down. Reach them, then rush them to Solmar General.',
    stage: 0, timer: 100, reward: 220,
    target: { x: patient.x, y: patient.y, label: 'Reach the patient' },
    pickup: { x: patient.x, y: patient.y },
    dest: { x: G.city.landmarks.hospital.x, y: G.city.landmarks.hospital.y + 120, label: 'Solmar General' },
    legs: 1,
  };
  G.message = 'New job: Ambulance Run — reach the patient';
  G.messageT = 3;
  if (G.sfx) G.sfx('mission');
}

function startStory(G, step) {
  const s = STORY[step];
  const g = G.city.landmarks.garage;
  const d = G.city.landmarks.diner;
  const gr = G.city.landmarks.grand;
  if (step === 0) {
    G.mission = { id: 's1', kind: 'story', title: s.title, brief: s.brief, stage: 0, timer: 0, reward: s.reward,
      target: { x: g.x, y: g.y, label: 'Bring a Falco GT to the garage' }, needCar: 'sports', legs: 1 };
  } else if (step === 1) {
    G.mission = { id: 's2', kind: 'story', title: s.title, brief: s.brief, stage: 0, timer: 0, reward: s.reward,
      target: { x: d.x, y: d.y + 60, label: 'Pick up order 1 of 3' }, legs: 3, leg: 0,
      pickup: { x: d.x, y: d.y + 60 }, dest: null };
  } else if (step === 2) {
    addHeat(G, 130);
    G.mission = { id: 's3', kind: 'story', title: s.title, brief: s.brief, stage: 0, timer: 0, reward: s.reward,
      target: { x: g.x, y: g.y, label: 'Lose the cops, then reach the garage' }, legs: 1, hadWanted: true };
  } else if (step === 3) {
    spawnRivals(G, 4);
    G.mission = { id: 's4', kind: 'story', title: s.title, brief: s.brief, stage: 0, timer: 0, reward: s.reward,
      target: { x: d.x, y: d.y, label: 'Deal with the Harbor crew: 4 left' }, legs: 1, toKill: 4 };
    G.missionKill = 0;
  } else if (step === 4) {
    G.mission = { id: 's5', kind: 'story', title: s.title, brief: s.brief, stage: 0, timer: 0, reward: s.reward,
      target: { x: gr.x, y: gr.y, label: 'Lift the vault cash at the Solmar Grand' }, legs: 1, collect: 0 };
  }
  G.message = 'Story: ' + s.title;
  G.messageT = 3;
  if (G.sfx) G.sfx('mission');
}

function spawnRivals(G, n) {
  const d = G.city.landmarks.diner;
  G.rivals = [];
  for (let i = 0; i < n; i++) {
    G.rivals.push({
      x: d.x + rand(-160, 160), y: d.y + rand(-120, 160),
      angle: 0, speed: 140, hp: 60, punchCd: 0, knock: 0, bob: rand(0, 6),
    });
  }
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  const p = G.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'Out of time — the job fell through.');
      return;
    }
  }
  const nearTarget = dist(p.x, p.y, m.target.x, m.target.y) < (m.target.r || 70);

  if (m.kind === 'delivery' || m.kind === 'taxi' || m.kind === 'ambulance') {
    if (m.stage === 0 && nearTarget) {
      m.stage = 1;
      m.timer = m.kind === 'ambulance' ? 110 : 90;
      m.target = { x: m.dest.x, y: m.dest.y, label: m.dest.label };
      G.message = m.kind === 'taxi' ? 'Passenger aboard — drive them home' : 'Got it — now deliver it';
      G.messageT = 2.5;
      if (G.sfx) G.sfx('pickup');
    } else if (m.stage === 1 && nearTarget) {
      if (m.kind === 'taxi') {
        m.reward = Math.round(40 + dist(m.pickup.x, m.pickup.y, m.dest.x, m.dest.y) / 12);
      }
      completeMission(G);
    }
    return;
  }

  if (m.id === 's1') {
    if (p.vehicle && p.vehicle.type === 'sports' && nearTarget) completeMission(G);
    return;
  }
  if (m.id === 's2') {
    if (m.stage === 0 && nearTarget) {
      m.stage = 1;
      const dest = houseSpot(G);
      m.dest = { x: dest.x, y: dest.y, label: 'Deliver order ' + (m.leg + 1) + ' of 3' };
      m.target = { x: dest.x, y: dest.y, label: m.dest.label };
      m.timer = 70;
      G.message = 'Order picked up — deliver it fast';
      G.messageT = 2;
      if (G.sfx) G.sfx('pickup');
    } else if (m.stage === 1 && nearTarget) {
      m.leg += 1;
      if (m.leg >= 3) { completeMission(G); return; }
      m.stage = 0;
      m.timer = 0;
      m.target = { x: G.city.landmarks.diner.x, y: G.city.landmarks.diner.y + 60, label: 'Pick up order ' + (m.leg + 1) + ' of 3' };
      G.message = 'Order ' + m.leg + ' of 3 delivered — back to the diner';
      G.messageT = 2.5;
      if (G.sfx) G.sfx('cash');
    }
    return;
  }
  if (m.id === 's3') {
    if (G.wanted === 0 && m.hadWanted) {
      m.target = { x: G.city.landmarks.garage.x, y: G.city.landmarks.garage.y, label: 'Back to the garage' };
      if (nearTarget) completeMission(G);
    }
    return;
  }
  if (m.id === 's4') {
    const left = m.toKill - (G.missionKill || 0);
    m.target.label = 'Deal with the Harbor crew: ' + Math.max(0, left) + ' left';
    if (left <= 0) completeMission(G);
    return;
  }
  if (m.id === 's5') {
    if (m.stage === 0 && nearTarget) {
      m.collect += dt;
      m.target.label = 'Lifting the vault cash… ' + Math.ceil(3 - m.collect) + 's';
      if (m.collect >= 3) {
        m.stage = 1;
        addHeat(G, 200);
        m.target = { x: G.city.landmarks.garage.x, y: G.city.landmarks.garage.y, label: 'Shake the chase — bring the cash home' };
        G.message = 'Cash grabbed! The whole PD is coming — run!';
        G.messageT = 3;
        if (G.sfx) G.sfx('wanted');
      }
    } else if (m.stage === 1 && nearTarget && G.wanted <= 2) {
      completeMission(G);
    } else if (m.stage === 1 && nearTarget && G.wanted > 2) {
      m.target.label = 'Too hot — lose the cops first, then come back';
    }
    return;
  }
}

function completeMission(G) {
  const m = G.mission;
  G.cash += m.reward;
  G.stats.jobsDone = (G.stats.jobsDone || 0) + 1;
  if (m.kind === 'story') {
    G.storyStep += 1;
    G.stats.storyDone = G.storyStep;
    G.message = 'Story complete: ' + m.title + ' — +' + '$' + m.reward.toLocaleString('en-US');
    if (G.storyStep >= STORY.length) {
      G.mode = 'win';
      if (G.sfx) G.sfx('win');
      G.mission = null;
      G.dirtySave = true;
      return;
    }
  } else {
    G.message = 'Job done — +' + '$' + m.reward.toLocaleString('en-US');
  }
  G.messageT = 3;
  if (G.sfx) G.sfx('cash');
  G.mission = null;
  G.dirtySave = true;
  // Move the taxi stand so fares keep coming.
  const rp = randomRoadPoint();
  G.taxiStand = { x: rp.x, y: rp.y };
  if (G.cash >= WIN_CASH_GOAL && G.mode === 'playing') {
    G.mode = 'win';
    if (G.sfx) G.sfx('win');
  }
}

function failMission(G, reason) {
  G.mission = null;
  G.message = reason;
  G.messageT = 3;
  if (G.sfx) G.sfx('fail');
}

export function updateRivals(G, dt) {
  const p = G.player;
  for (const r of [...G.rivals]) {
    r.bob += dt * 10;
    r.punchCd = Math.max(0, r.punchCd - dt);
    r.knock = Math.max(0, (r.knock || 0) - dt);
    const d = dist(r.x, r.y, p.x, p.y);
    if (d > 500) continue;
    const a = Math.atan2(p.y - r.y, p.x - r.x);
    r.angle = a;
    if (r.knock <= 0 && d > 26) {
      const nx = r.x + Math.cos(a) * r.speed * dt;
      const ny = r.y + Math.sin(a) * r.speed * dt;
      r.x = nx;
      r.y = ny;
    }
    if (d < 30 && r.punchCd <= 0 && p.hp > 0) {
      r.punchCd = 1.1;
      if (p.onFoot) {
        p.hp -= 8;
        p.lastDamage = G.time;
        G.shake = Math.min(8, (G.shake || 0) + 4);
        if (G.sfx) G.sfx('hurt');
        if (p.hp <= 0) { p.hp = 0; G.mode = 'wasted'; if (G.sfx) G.sfx('wasted'); }
      }
    }
  }
}

export function drawRival(ctx, r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(5, 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(r.angle);
  const bob = Math.sin(r.bob) * 2;
  ctx.strokeStyle = '#3a2a2a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.lineTo(-10, bob);
  ctx.moveTo(4, 0); ctx.lineTo(10, -bob);
  ctx.stroke();
  ctx.fillStyle = '#5a2a6a';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b04a';
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(-3, -11, 6, 4);
  // hp bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-12, -22, 24, 4);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-12, -22, 24 * Math.max(0, r.hp / 60), 4);
  ctx.restore();
}
