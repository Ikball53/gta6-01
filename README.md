# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ikball53/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ikball53/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR HEAT** — a full 3D open-world crime game in the browser, built with Three.js. Drive and walk through Solmar City at golden hour: steal cars, outrun the Solmar PD, lose the police helicopter, and run Rosa's five-chapter story from a stolen Falco GT to the vault heist. Traffic obeys the lights, the metro loops downtown, and side jobs (food delivery, taxi fares, ambulance runs) pay cash toward the $100,000 win.

## Run it

Serve the `game/` folder with any static server and open `index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests — Three.js is vendored under `game/vendor/`. Keyboard and mouse on desktop; touch joystick + buttons on landscape phones. Progress autosaves to localStorage.

## Scenes

Add `?scene=chase`, `?scene=downtown`, or `?scene=mission` to jump straight into a set piece (default is the title menu). `?seed=` changes the city layout randomisation.

<sub>Entered on [make.fun](https://make.fun/?ref=06mvdhm0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
