// SOLMAR HEAT — shared tuning and content data.
// All numbers here are the single source of truth for the game modules.

export const WORLD = 2600; // world is WORLD x WORLD px
export const ROAD_W = 64; // road width in px
export const GRID = 300; // distance between road centrelines
export const ROAD_LINES = [150, 450, 750, 1050, 1350, 1650, 1950, 2250, 2550];

export const GOLDEN_HOUR = {
  skyTop: '#ffd9a0',
  skyBottom: '#ff9e6e',
  sunX: 0.78,
  sunY: 0.2,
  shadowDx: 14,
  shadowDy: 22,
  shadowAlpha: 0.22,
  ground: '#c9b18a',
  sidewalk: '#d8cbb2',
  road: '#4a4a52',
  roadEdge: '#3a3a42',
  lane: '#e8d27a',
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  water: '#5fb8c9',
};

export const VEHICLES = {
  sedan:    { name: 'Comet S',    len: 52, wid: 26, maxSpeed: 300, accel: 210, turn: 2.6, color: '#3a6fd8', color2: '#274b94', price: 800,  desc: 'Everyday sedan' },
  taxi:     { name: 'City Cab',   len: 52, wid: 26, maxSpeed: 290, accel: 200, turn: 2.6, color: '#f2c200', color2: '#222222', price: 900,  desc: 'Taxi, always in a hurry' },
  pickup:   { name: 'Ranchero',   len: 58, wid: 28, maxSpeed: 280, accel: 190, turn: 2.4, color: '#c23b2e', color2: '#7e241b', price: 1100, desc: 'Pickup with an open bed' },
  truck:    { name: 'Hauler',     len: 84, wid: 30, maxSpeed: 210, accel: 120, turn: 1.7, color: '#e8e6df', color2: '#8a8f98', price: 1500, desc: 'Box truck, slow but solid' },
  sports:   { name: 'Falco GT',   len: 54, wid: 26, maxSpeed: 430, accel: 320, turn: 3.1, color: '#ff7a1a', color2: '#1c1c22', price: 12000, desc: 'Fastest car in Solmar' },
  police:   { name: 'Interceptor',len: 54, wid: 27, maxSpeed: 360, accel: 300, turn: 2.9, color: '#20242c', color2: '#f2f2f2', price: 0,    desc: 'Solmar PD pursuit car' },
  ambulance:{ name: 'Medic One',  len: 62, wid: 28, maxSpeed: 320, accel: 230, turn: 2.5, color: '#f5f5f0', color2: '#d92b2b', price: 0,    desc: 'Ambulance, lights and siren' },
  bike:     { name: 'Vortex R',   len: 48, wid: 14, maxSpeed: 420, accel: 340, turn: 3.6, color: '#1fae6b', color2: '#0d5c36', price: 4500, desc: 'Sport bike, quick and nimble' },
  scooter:  { name: 'Zippy',      len: 40, wid: 13, maxSpeed: 200, accel: 180, turn: 3.4, color: '#17b8a6', color2: '#0b6b60', price: 600,  desc: 'Scooter, cheap and cheerful' },
};

export const VEHICLE_TYPES = Object.keys(VEHICLES);

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 265,
  radius: 13,
  maxHealth: 100,
  punchDamage: 25,
  pistolDamage: 34,
  startAmmo: 24,
  maxAmmo: 120,
};

export const WANTED_HEAT = [0, 25, 60, 120, 200, 320]; // heat needed for each star
export const HEAT_DECAY = 1.6; // heat lost per second while unseen
export const CRIME_HEAT = { stealCar: 30, shoot: 18, punchPed: 22, punchCop: 40, speedNearCop: 6, killPed: 60 };

export const STREET_NAMES = [
  'Palm Ave', 'Coral St', 'Marina Blvd', 'Sunset Dr',
  'Bayview Rd', 'Harbor St', 'Jacaranda Ave', 'Flamingo St', 'Solmar Way',
];

export const EATERY_NAMES = ["Rosa's Diner", 'Taco Sol', 'Bay Burger', 'Cafe Alba', 'Noodle Palm'];
export const SHOP_NAMES = ['Solmar Market', 'Velo Bikes', 'Sun Surf Shop', 'Palm Pharmacy', 'Kicks & Co', 'Bay Books'];

export const STORY = [
  { id: 's1', title: 'First Wheels', brief: 'Rosa needs a Falco GT for a client. Borrow one — any way you can — and bring it to the garage.', reward: 1200 },
  { id: 's2', title: 'Lunch Rush', brief: 'Three deliveries, one lunch rush. Pick up at Rosa’s Diner and drop them off before the timers run out.', reward: 1500 },
  { id: 's3', title: 'Getaway Driver', brief: 'The PD is on your tail. Lose a 3-star wanted level and make it back to the garage in one piece.', reward: 2500 },
  { id: 's4', title: 'Rival Crew', brief: 'The Harbor crew is muscling in on Rosa’s block. Deal with four of them, on foot or by car.', reward: 4000 },
  { id: 's5', title: 'The Big Score', brief: 'One last job: lift the vault cash from the Solmar Grand, shake a 4-star chase, and bring it home.', reward: 50000 },
];

export const WIN_CASH_GOAL = 100000;

export const SAVE_KEY = 'solmar-heat-save-v1';

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function rand(a, b) { return a + Math.random() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
