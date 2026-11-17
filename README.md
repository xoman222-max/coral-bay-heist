# Coral Bay Heist

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/xoman222-max/coral-bay-heist/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/xoman222-max/coral-bay-heist/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are a driver with empty pockets in Coral Bay — a sun-soaked city of grid streets, a harbor, a warehouse district and a casino strip. Take work from Marina Sol, run jobs for Marlo Vane, steal cars, lose the cops, survive the shootout, crack the vault, and make the getaway boat.

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests: every script, texture and sound is a file under `game/` (three.js is vendored as `game/vendor/three.module.min.js`).

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive and walk |
| E | Enter / steal a car, exit a car |
| F or mouse click | Shoot (on foot) |
| Space | Brake |
| Shift | Run |
| Esc / P | Pause |
| M | Mute |

## The city

- A seeded grid city: downtown towers, residential blocks, a warehouse district, a casino strip with neon, and a harbor with a dock and a boat.
- Traffic cars cruise the streets and brake for the car ahead; pedestrians stroll the sidewalks and slide around buildings.
- A wanted level of 1–5 stars: police cars chase and ram, and the stars only fall when you stay out of sight.
- HUD with cash, health, wanted stars, objective text and a live minimap.

## Missions

1. **First Errand** — pick up a parcel and deliver it to Marina. Pays $400.
2. **The Coral Cruiser** — steal Marlo Vane's pink Cruiser from outside the casino. Pays $900.
3. **Shake the Heat** — three stars on your head. Lose them all. Pays $600.
4. **Warehouse War** — four enforcers at the warehouse. Go in shooting. Pays $1,400.
5. **The Big Score** — crack the casino vault while the alarm brings company. Pays $2,500.
6. **The Getaway** — four stars, one boat at the harbor. Pays $3,000.

Progress and cash save automatically to local storage.

## Structure

- `game/index.html` — the page, HUD and start screens.
- `game/src/main.js` — boot, game loop, camera, player, combat, saving.
- `game/src/config.js` — tuning and the mission story data.
- `game/src/random.js` — seeded RNG; one seed builds the same city every run.
- `game/src/city.js` — streets, buildings by district, harbor, palms, streetlights, collision.
- `game/src/vehicles.js` — car meshes, shared driving physics, traffic AI, police chases.
- `game/src/pedestrians.js` — sidewalk walkers that slide around buildings.
- `game/src/police.js` — wanted level, police cars, enforcers, tracers.
- `game/src/missions.js` — the six-mission story runner and its markers.
- `game/src/hud.js` — cash, health, stars, objective, subtitles, minimap.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — engine, sirens and gunshots synthesized with WebAudio.
- `game/src/shots.js` — the four screenshot scenes (`?shot=title|drive|chase|mission`).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the output and writes `dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
