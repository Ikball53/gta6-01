# SOLMAR HEAT

An open-world crime game in the spirit of GTA 6, built for make.fun's
**gta6-01** bounty ("Make GTA 6"). Everything is original: the city of
Solmar, its people, its cars, its story. Nothing from Rockstar Games.

## The game

Solmar City is a sun-soaked 3D open world you explore on foot and by car:

- **Free roam + optional story** — Rosa's five-part story (win at $50,000),
  or win rich at $100,000. Missions never force themselves on you.
- **Nine vehicles** — sedan, taxi, pickup, truck, sports car, police car,
  ambulance, sport bike and scooter — each a different shape, colour and
  speed. Traffic drives the grid; parked cars can be stolen.
- **Wanted level 1–5** — police chase and ram you; a helicopter with a
  spotlight joins at three stars. Get caught on foot and you're busted.
- **A living city** — houses with yards and fences, shops, a hospital that
  refills health, a police station, parks, pedestrians, a moving train on
  the outer loop and a tram on the elevated metro loop.
- **Extras** — a chop shop that buys stolen cars, WebAudio sound per event
  with mute (M), localStorage saves, touch controls for phone landscape,
  and `?scene=menu|chase|downtown|mission` to jump to a scene.

## Controls

| Key | Action |
| --- | --- |
| W / S | Walk forward / back (in a car: accelerate / brake) |
| A / D | Turn (on foot and in a car) |
| Shift | Sprint |
| E | Enter / exit a car |
| F | Punch |
| M | Mute · P pause |

On touch screens the left stick turns and moves you, with big RUN / CAR /
HIT buttons.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
kit's vendored library. The game is static files under `game/` and plays
offline in a desktop browser — Three.js 0.160.0 is vendored under
`game/vendor/`, and no file loads anything over the network.

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.
