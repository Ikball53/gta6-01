// SOLMAR HEAT — scene presets. ?scene= picks how the game opens, and
// ?shot= picks a deterministic pose for screenshots: the camera, the
// player's place and the wanted level are set, then the game runs. The
// shots in shots.json use these names, so a screenshot is reproducible.

export const SCENES = {
  menu: { start: false },
  chase: { start: true, inCar: 'sports', at: { x: 0, z: 42 }, heading: 0, wanted: 3, speed: 24 },
  downtown: { start: true, at: { x: 42, z: 42 }, heading: Math.PI, wanted: 0 },
  mission: { start: true, at: { x: -84, z: -42 }, heading: 0, wanted: 0, story: true },
};

export const SHOTS = {
  start: 'menu',
  play: 'downtown',
  chase: 'chase',
  mission: 'mission',
};

// Apply a scene to a fresh game: place the player, set the wanted level,
// start Rosa's first part for the mission shot. Returns the scene name.
export function applyScene(name, S, world) {
  const scene = SCENES[name] || SCENES.menu;
  S.scene = name;
  if (scene.at) {
    S.player.x = scene.at.x;
    S.player.z = scene.at.z;
    S.player.heading = scene.heading ?? 0;
    S.player.speed = 0;
  }
  if (scene.inCar) {
    const car = world.parked.find(p => p.def.id === scene.inCar) || world.parked[0];
    enterCarForShot(S, world, car, scene.at, scene.heading);
    S.carSpeed = scene.speed || 0;
  }
  if (scene.wanted) {
    S.wanted = scene.wanted;
    S.heat = scene.wanted / 5;
  }
  if (scene.story) {
    S.storyActive = true;
    S.storyStep = 0;
    S.objective = 'Rosa 1: The Package — Pick up the package';
  }
  S.started = !!scene.start;
  return name;
}

function enterCarForShot(S, world, parkedCar, at, heading) {
  parkedCar.taken = true;
  world.scene.remove(parkedCar.mesh);
  const def = parkedCar.def;
  const mesh = world.makeCarMesh(def);
  world.scene.add(mesh);
  // The scene's address wins over the parked spot: the shot stages the car
  // on a clear stretch of road, not wherever it was parked.
  const x = at ? at.x : parkedCar.x;
  const z = at ? at.z : parkedCar.z;
  const hd = heading ?? parkedCar.heading;
  mesh.position.set(x, 0, z);
  mesh.rotation.y = hd;
  S.inCar = {
    def, mesh, x, z,
    heading: hd, stolen: true,
  };
  S.onFoot = false;
  S.player.x = x;
  S.player.z = z;
}
