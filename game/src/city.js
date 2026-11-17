// SOLMAR HEAT — city layout builder for Solmar City.
// Builds the road grid, blocks, landmarks, traffic lights and the elevated
// metro loop. All coordinates are world pixels; the world is WORLD x WORLD.

import { WORLD, ROAD_W, ROAD_LINES, STREET_NAMES, EATERY_NAMES, SHOP_NAMES, rand, randi, pick, clamp } from './config.js';

const HOUSE_ROOFS = ['#b8543f', '#8a5a3b', '#c97e4a', '#7a6a8a', '#4f7d5a', '#a04a5e'];
const HOUSE_WALLS = ['#f2e3c6', '#e8d5b0', '#dfe8ee', '#f5d7c4', '#e3e0d5'];
const SHOP_COLORS = ['#3f7d8a', '#c98a2e', '#7a4a8a', '#4a7a3f', '#a03a3a', '#2e6a8a'];

function blockRect(col, row) {
  const x0 = ROAD_LINES[col] + ROAD_W / 2 + 6;
  const y0 = ROAD_LINES[row] + ROAD_W / 2 + 6;
  const x1 = ROAD_LINES[col + 1] - ROAD_W / 2 - 6;
  const y1 = ROAD_LINES[row + 1] - ROAD_W / 2 - 6;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function houseBlock(b, solids) {
  const houses = [];
  const n = randi(2, 3);
  for (let i = 0; i < n; i++) {
    const w = rand(52, 74), h = rand(44, 62);
    const x = b.x + rand(14, Math.max(15, b.w - w - 14));
    const y = b.y + rand(14, Math.max(15, b.h - h - 14));
    const wall = pick(HOUSE_WALLS), roof = pick(HOUSE_ROOFS);
    houses.push({ x, y, w, h, wall, roof, kind: 'house' });
    solids.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 });
  }
  const trees = [];
  for (let i = 0; i < randi(3, 5); i++) {
    trees.push({ x: b.x + rand(12, b.w - 12), y: b.y + rand(12, b.h - 12), r: rand(7, 11) });
  }
  return { ...b, kind: 'houses', buildings: houses, trees, fenced: true };
}

function shopBlock(b, name, solids, color) {
  const w = rand(120, 150), h = rand(70, 90);
  const x = b.cx - w / 2, y = b.cy - h / 2;
  const building = { x, y, w, h, wall: color, roof: '#33333a', kind: 'shop', name };
  solids.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 });
  const trees = [{ x: b.x + 16, y: b.y + 16, r: 8 }, { x: b.x + b.w - 16, y: b.y + b.h - 16, r: 8 }];
  return { ...b, kind: 'shop', name, buildings: [building], trees, fenced: false };
}

function parkBlock(b) {
  const trees = [];
  for (let i = 0; i < randi(8, 11); i++) {
    trees.push({ x: b.x + rand(16, b.w - 16), y: b.y + rand(16, b.h - 16), r: rand(8, 13) });
  }
  const pond = { x: b.cx - 34, y: b.cy - 24, w: 68, h: 48 };
  return { ...b, kind: 'park', buildings: [], trees, pond, fenced: false };
}

function lotBlock(b) {
  const spots = [];
  for (let i = 0; i < 6; i++) {
    spots.push({ x: b.x + 24 + (i % 3) * 70, y: b.y + 30 + Math.floor(i / 3) * 90, angle: 0 });
  }
  return { ...b, kind: 'lot', buildings: [], trees: [], spots, fenced: false };
}

function landmarkBlock(b, name, kind, solids, color, w, h) {
  const x = b.cx - w / 2, y = b.cy - h / 2;
  const building = { x, y, w, h, wall: color, roof: '#2c2c34', kind, name };
  solids.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 });
  return { ...b, kind, name, buildings: [building], trees: [], fenced: false };
}

export function buildCity() {
  const solids = [];
  const blocks = [];
  const eateries = [];
  const shops = [];
  const houses = [];
  const parks = [];
  const landmarks = {};

  // Fixed landmark map: "col,row" -> [kind, name, color, w, h]
  const fixed = {
    '1,7': ['home', "Rex's House", '#f2e3c6', 96, 72],
    '2,7': ['garage', "Rosa's Garage", '#5a6a7a', 150, 90],
    '4,0': ['police', 'Solmar PD Central', '#3a4a6a', 160, 100],
    '6,0': ['hospital', 'Solmar General', '#e8e6df', 170, 110],
    '3,3': ['diner', "Rosa's Diner", '#c96a3b', 150, 90],
    '5,3': ['grand', 'Solmar Grand', '#8a6a2e', 170, 110],
    '1,1': ['park', 'Palm Park', null, 0, 0],
    '6,5': ['park', 'Bay Park', null, 0, 0],
    '3,6': ['park', 'Jacaranda Park', null, 0, 0],
    '0,3': ['lot', 'Harbor Lot', null, 0, 0],
    '7,2': ['lot', 'Marina Lot', null, 0, 0],
    '2,2': ['eatery', 'Taco Sol', '#c98a2e', 130, 80],
    '5,4': ['eatery', 'Bay Burger', '#a03a3a', 130, 80],
    '4,5': ['eatery', 'Cafe Alba', '#3f7d8a', 120, 76],
  };
  const shopSpots = ['0,0', '7,0', '0,5', '7,6', '2,5', '5,1', '1,4', '6,3'];
  let shopIdx = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const b = blockRect(col, row);
      const key = col + ',' + row;
      let block;
      if (fixed[key]) {
        const [kind, name, color, w, h] = fixed[key];
        if (kind === 'park') block = parkBlock(b);
        else if (kind === 'lot') block = lotBlock(b);
        else block = landmarkBlock(b, name, kind, solids, color, w, h);
        block.name = name;
        if (kind === 'home') landmarks.home = { x: b.cx, y: b.cy, block };
        if (kind === 'garage') landmarks.garage = { x: b.cx, y: b.cy + 60, block };
        if (kind === 'police') landmarks.police = { x: b.cx, y: b.cy, block };
        if (kind === 'hospital') landmarks.hospital = { x: b.cx, y: b.cy, block };
        if (kind === 'diner') { landmarks.diner = { x: b.cx, y: b.cy, block }; eateries.push({ x: b.cx, y: b.cy, name }); }
        if (kind === 'grand') landmarks.grand = { x: b.cx, y: b.cy, block };
        if (kind === 'eatery') eateries.push({ x: b.cx, y: b.cy, name });
        if (kind === 'park') parks.push({ x: b.cx, y: b.cy, name });
      } else if (shopSpots.includes(key)) {
        const name = SHOP_NAMES[shopIdx++ % SHOP_NAMES.length];
        block = shopBlock(b, name, solids, pick(SHOP_COLORS));
        shops.push({ x: b.cx, y: b.cy, name });
      } else {
        block = houseBlock(b, solids);
        houses.push({ x: b.cx, y: b.cy });
      }
      block.col = col;
      block.row = row;
      blocks.push(block);
    }
  }

  // Traffic lights at every other interior intersection.
  const lights = [];
  for (let i = 1; i < 8; i++) {
    for (let j = 1; j < 8; j++) {
      if ((i + j) % 2 === 0) {
        lights.push({ x: ROAD_LINES[i], y: ROAD_LINES[j], nsGreen: (i + j) % 4 === 0, timer: rand(0, 6) });
      }
    }
  }

  // Road signs: stop signs at a few corners, speed signs along Marina Blvd.
  const signs = [];
  for (let i = 0; i < 6; i++) {
    const li = randi(1, 7);
    signs.push({ x: ROAD_LINES[li] + ROAD_W / 2 + 8, y: ROAD_LINES[randi(1, 7)] - ROAD_W / 2 - 8, kind: 'stop' });
  }
  for (let i = 0; i < 5; i++) {
    signs.push({ x: ROAD_LINES[randi(1, 7)] - ROAD_W / 2 - 8, y: 150 + i * 500, kind: 'speed' });
  }

  // Elevated metro loop: rectangle inset 120px, two stations.
  const track = {
    x0: 120, y0: 120, x1: WORLD - 120, y1: WORLD - 120,
    stations: [
      { x: 1350, y: 120, name: 'Central Station' },
      { x: 1050, y: WORLD - 120, name: 'Harbor Station' },
    ],
  };

  const spawn = { x: landmarks.home.x, y: landmarks.home.y + 150, angle: -Math.PI / 2 };

  return { solids, blocks, lights, signs, track, landmarks, eateries, shops, houses, parks, spawn };
}

export function onRoad(city, x, y) {
  for (const l of ROAD_LINES) {
    if (Math.abs(x - l) <= ROAD_W / 2 + 2) return true;
    if (Math.abs(y - l) <= ROAD_W / 2 + 2) return true;
  }
  return false;
}

export function nearestRoadLine(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const l of ROAD_LINES) {
    const d = Math.abs(v - l);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

export function streetNameAt(x, y) {
  const ix = ROAD_LINES.indexOf(nearestRoadLine(x));
  const iy = ROAD_LINES.indexOf(nearestRoadLine(y));
  const dx = Math.abs(x - ROAD_LINES[ix]);
  const dy = Math.abs(y - ROAD_LINES[iy]);
  return dx < dy ? STREET_NAMES[ix % STREET_NAMES.length] : STREET_NAMES[iy % STREET_NAMES.length];
}

export function pointInSolid(city, x, y, r) {
  for (const s of city.solids) {
    if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return s;
  }
  return null;
}

// Push a circle out of building rects; returns corrected {x, y}.
export function resolveSolids(city, x, y, r) {
  for (const s of city.solids) {
    const nx = clamp(x, s.x, s.x + s.w);
    const ny = clamp(y, s.y, s.y + s.h);
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // centre inside the rect: push out along the smallest overlap
        const left = x - s.x, right = s.x + s.w - x;
        const top = y - s.y, bottom = s.y + s.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = s.x - r;
        else if (m === right) x = s.x + s.w + r;
        else if (m === top) y = s.y - r;
        else y = s.y + s.h + r;
      }
    }
  }
  return { x, y };
}

export function randomRoadPoint() {
  const vertical = Math.random() < 0.5;
  const line = pick(ROAD_LINES);
  const along = rand(100, WORLD - 100);
  return vertical ? { x: line + (Math.random() < 0.5 ? -16 : 16), y: along } : { x: along, y: line + (Math.random() < 0.5 ? -16 : 16) };
}

export function randomParkedSpot(city) {
  const lot = pick(city.blocks.filter(b => b.kind === 'lot'));
  if (lot && lot.spots) {
    const s = pick(lot.spots);
    return { x: s.x, y: s.y, angle: s.angle };
  }
  const p = randomRoadPoint();
  return { x: p.x, y: p.y, angle: 0 };
}
