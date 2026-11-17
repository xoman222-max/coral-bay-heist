[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/rank/gta6-01/coral-bay-heist.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/reward/gta6-01.svg)](https://make.fun/bounty/gta6-01)

# Coral Bay Heist

An open-world crime game in the spirit of GTA 6, built with three.js — a
sun-soaked fictional bay city you can explore on foot and by car, with
traffic, pedestrians, car theft, a 1–5 star wanted level, police chases, gun
and fist combat, and six linked story missions ending in a bank vault job.

**Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.**
Repo: `xoman222-max/coral-bay-heist` · referral: `b8rrz4sr`.

## Story

Marlo Vane just walked out of Coral Bay prison after three years. His old
friend Marina Sol has one last plan: a string of jobs across the city, ending
with the vault of the Coral Bay Bank — while Sheriff Dray Cole, the crooked
lawman who put Marlo away, tries to bring him back in. Drive fast, stay low,
get paid.

Everything is original: the city, characters, cars, dialogue and music are
all invented for this game. No real city, person, brand or commercial game
appears in it.

## Play

- **Explore** a procedural 3D city: street grid, towers, lamps, palms,
  benches, a beach and a pier over the bay, with sunset-to-night lighting.
- **On foot**: WASD to move, mouse drag to orbit the camera, Shift to run,
  F to punch, click to shoot (limited ammo — grab the yellow crates).
- **Driving**: get in any car with E. Arcade handling with inertia, damage
  and smoke. Six original models: Coral Cruiser, Bay Taxi, Harbor Sedan,
  Dock Van, Palm Coupe, Sunset Pickup — plus black-and-white police
  Interceptors.
- **Steal cars**: press E near a parked or moving car. The driver bails and
  the heat goes up.
- **Wanted level**: 1–5 stars for stealing, hurting pedestrians, shooting
  and ramming police. Foot officers chase and arrest you; interceptors ram
  you. Break line of sight and lay low to cool off.
- **Missions**: six linked jobs — meet Marina at the pier, steal the Coral
  Cruiser, shake the heat, run a package to the warehouse, crack the bank
  vault, and escape to the pier. Each has a target beacon, dialogue, a cash
  reward, and a retry on failure (busted or wasted).
- **HUD**: health and armor bars, cash, wanted stars, mission objective with
  distance, speedometer, ammo, clock, and a live 2D minimap (streets,
  player, traffic, police, mission marker).
- **Save**: progress (cash, mission, health, ammo) saves to localStorage;
  the title screen offers New Game / Continue. P pauses, M mutes.
- **Sound**: all synthesised with WebAudio — engine hum, two-tone sirens,
  gunshots, pickups, mission jingles and a sunset pad loop. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Orbit camera |
| Shift | Run |
| E | Enter / exit / steal a car |
| F | Punch |
| Click | Shoot |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. The game is plain
static files under `game/` and makes zero network requests.

Screenshots are staged with `?shot=start|drive|chase|mission&seed=N`, which
poses a real game scene and sets `window.__shotReady` once painted.

## Layout

- `game/index.html` — page, HUD, import map for `three`
- `game/src/main.js` — boot, game loop, screens, combat glue
- `game/src/config.js` — tuning numbers, car models, palettes
- `game/src/city.js` — procedural city, lighting, pickups, particles
- `game/src/vehicles.js` — car factory, driving physics, traffic
- `game/src/pedestrians.js` — walkers and gang enforcers
- `game/src/police.js` — wanted level, chases, arrests
- `game/src/missions.js` — story and the six missions
- `game/src/hud.js` — DOM HUD and the 2D minimap
- `game/src/audio.js` — synthesised WebAudio sounds and music
- `game/src/input.js` — keyboard and mouse input
- `game/src/shots.js` — `?shot=` screenshot staging
- `game/vendor/three.module.min.js` — three.js 0.160 (vendored)
- `main.ts` — hand-in program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json`
- `screenshots/` — 4 real rendered screenshots (1-start is the cover)

## License

MIT — see `LICENSE`.
