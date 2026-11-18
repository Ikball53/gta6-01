// SOLMAR HEAT — shared tuning, vehicle roster, story data and the seeded
// random source. Every number the game balances on lives here, so a balance
// change is one edit, and the city layout is seeded so the same seed always
// builds the same streets.

export const CFG = {
  worldHalf: 210, // city spans -210..210 m on x and z
  block: 42, // city block pitch in metres
  roadWidth: 10,
  walkSpeed: 4.4, // m/s, on foot
  sprintSpeed: 7.5, // m/s, on foot holding sprint
  turnRate: 3.0, // rad/s, how fast the walker turns with stick X
  steerRate: 1.9, // rad/s factor for car steering
  maxWanted: 5,
  startMoney: 500,
  winStoryMoney: 50000, // finishing Rosa's story pays out past this
  winRichMoney: 100000, // or reach this net worth to win
  chopPay: 800, // cash for selling a stolen car at the chop shop
  hospitalHeal: 25, // health per second inside the hospital zone
  saveKey: 'solmar-heat-save-v1',
};

// The nine drivable vehicle types. Each has its own shape tag (the factory
// builds a different body per tag), colour, top speed and acceleration.
export const VEHICLES = [
  { id: 'sedan', name: 'Sedan', color: 0x3a6fd8, top: 26, accel: 14, len: 4.4, wid: 1.9, shape: 'sedan' },
  { id: 'taxi', name: 'Taxi', color: 0xf2c200, top: 25, accel: 13, len: 4.4, wid: 1.9, shape: 'taxi' },
  { id: 'pickup', name: 'Pickup', color: 0x8a5a2b, top: 24, accel: 12, len: 5.0, wid: 2.0, shape: 'pickup' },
  { id: 'truck', name: 'Truck', color: 0x5b7d8a, top: 19, accel: 8, len: 6.4, wid: 2.4, shape: 'truck' },
  { id: 'sports', name: 'Sports', color: 0xd81f2a, top: 38, accel: 22, len: 4.2, wid: 2.0, shape: 'sports' },
  { id: 'police', name: 'Police', color: 0x1c2f6e, top: 30, accel: 18, len: 4.6, wid: 2.0, shape: 'police' },
  { id: 'ambulance', name: 'Ambulance', color: 0xf2f2f2, top: 27, accel: 15, len: 5.2, wid: 2.2, shape: 'ambulance' },
  { id: 'bike', name: 'Sport Bike', color: 0x111111, top: 34, accel: 24, len: 2.2, wid: 0.8, shape: 'bike' },
  { id: 'scooter', name: 'Scooter', color: 0x2fae6e, top: 16, accel: 11, len: 1.9, wid: 0.7, shape: 'scooter' },
];

// Rosa's five-part story. Each part is a short chain of go-to markers; the
// last one pays out and the story ends. Missions are optional: the player
// starts one by walking into Rosa's marker, never by force.
export const STORY = [
  { title: 'Rosa 1: The Package', pay: 2000, brief: 'Pick up the package at the docks and bring it to Rosa.',
    stops: [{ x: -168, z: 168, label: 'Pick up the package' }, { x: -126, z: -42, label: 'Bring it back to Rosa' }] },
  { title: 'Rosa 2: The Fare', pay: 4000, brief: 'Drive the client across town to the hotel. No scratches.',
    stops: [{ x: 126, z: 126, label: 'Pick up the client' }, { x: 168, z: -126, label: 'Drop off at the hotel' }] },
  { title: 'Rosa 3: The Errand', pay: 8000, brief: 'Three drops, one night. The cops are jumpy — keep it clean.',
    stops: [{ x: -42, z: 168, label: 'Drop 1: north market' }, { x: 168, z: 42, label: 'Drop 2: east pier' }, { x: -126, z: -42, label: 'Drop 3: back to Rosa' }] },
  { title: 'Rosa 4: The Getaway', pay: 15000, brief: 'Rosa needs a fast car and a faster exit. Lose the tail, then meet her.',
    stops: [{ x: 42, z: -168, label: 'Grab the sports car' }, { x: -168, z: -168, label: 'Lose the heat, reach the hideout' }] },
  { title: 'Rosa 5: The Last Job', pay: 25000, brief: 'One last run to the airport. Finish this and Solmar is yours.',
    stops: [{ x: 0, z: 168, label: 'Collect the case' }, { x: 168, z: 168, label: 'Deliver to the airport' }] },
];

// Small deterministic RNG (mulberry32) so a seed rebuilds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
