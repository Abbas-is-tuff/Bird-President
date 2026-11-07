# Bird President — Realistic Political Simulator

A browser game: win the presidency of a fictional nation of birds, then govern its economy, politics, citizens, diplomacy and military in a living world.

## Technology choice

**Three.js (WebGL) + plain ES modules, no build step.**

- Runs on phones and desktops with nothing to install. You can share it as a link.
- Three.js gives physically based rendering, real-time shadows, image-based reflections, bloom, instancing (thousands of cars, pedestrians and windows) and a physical sky. That is enough for a "sophisticated, not cartoon" look in a browser.
- The simulation is pure JavaScript with no DOM access. It runs headless in Node for soak tests (`node tools/soak.mjs`), and that also keeps it deterministic: there is a seeded RNG inside the save state.
- All textures (feathers, wood, marble, facades, flags, seals) are generated procedurally on canvases, so the project has no binary assets.

Trade-off: browser WebGL is not Unreal or Unity. There are no hand-sculpted assets or motion capture. The visuals use procedural geometry with PBR materials, so they look polished but stylised rather than photoreal.

## Project structure

```
index.html            entry, import map for three@0.160
css/main.css          government-software UI (dark, responsive; mobile dock at bottom)
js/main.js            bootstrap, game loop, HUD, menus, decision flows (events, press, speeches, elections)
js/sim/               ── simulation (pure, testable) ──
  util.js             seeded RNG, calendar, formatting
  data.js             characters, parties, nations, laws, executive orders, research
  setup.js            new-game state
  engine.js           simulation clock: daily / weekly / monthly systems, history, briefings, weather
  economy.js          macro model: potential growth, output gap, Phillips curve, Okun, Taylor rule, FX, trade, debt
  citizens.js         1,200 agents: jobs, income, education, needs, happiness, ideology, approval, protests
  politics.js         parliament votes, bills, vetoes, budgets, coalitions, campaigns, elections, impeachment
  government.js       cabinet & department efficiency, executive orders, emergencies, press conferences, speeches
  diplomacy.js        relations, treaties, sanctions, embassies, disputes, wars, AI leaders, AI elections & coups
  military.js         forces from budgets, readiness, research, exercises, deployment, mobilisation, war
  events.js           20+ dynamic events (auto or player decisions)
  news.js             outlets with editorial slant; headlines/articles/interviews generated from sim events
  mapgen.js           deterministic world: terrain, organic borders, disputed regions
  save.js             localStorage slots + portable export/import codes
js/render/            ── 3D ──
  engine3d.js         renderer, bloom, view switching, picking, day/night clock
  office.js           interactive presidential office (clickable computer, documents, phone, TV, door, lectern, globe)
  city.js             capital: instanced buildings, palace, river, traffic, pedestrians, sky, weather, protests
  worldmap.js         3D terrain map, borders, capitals, dispute/war overlays, six map modes
  bird.js             procedural feathered bird characters with idle animation
  portraits.js        studio portraits rendered once for the UI
  textures.js         procedural canvas textures
js/audio/
  music.js            adaptive generative soundtrack (Web Audio): anthem, calm, campaign march, crisis + cues
js/ui/
  dom.js              modal, toasts, charts, hemicycle
  panels.js           Government, Economy, Legislation, Politics, Citizens, Diplomacy, Military, News, Inbox
tools/                Node soak/event tests and a Playwright screenshot harness (not shipped)
```

## How 3D and simulation fit together

The sim never touches the renderer. Each frame, `main.js` advances the clock by `SPEEDS[speed] × dt` days and calls `tick(S)`. Then it renders the active view with `view.update(dt, t, S, env)`. Views *read* state:

- Traffic density follows employment.
- Lit windows at night follow the economy.
- Protest crowds gather in the palace plaza.
- Weather comes from the sim's weather state, including disaster storms.
- The office TV and computer screens draw live headlines and indicators.
- The map recolours as relations, alliances, growth or military power change.
- Borders move when a war transfers a disputed region.

Clicks in 3D are turned into UI actions. Every UI control calls a sim function (`ACTIONS` in `panels.js`).

## Stage status

| Stage | Status |
|---|---|
| 1 Core game, 3D office/city/world map, clock | Done |
| 2 Government, elections, politics | Done |
| 3 Economy & citizens | Done |
| 4 Diplomacy | Done |
| 5 Military | Done |
| 6 News, events, AI | Done (template-based news; AI leaders are rule-based) |
| 7 Polish | Partial: quality settings, bloom, shadows, mobile layout. Next: richer bird animation (walking/flying), interior meeting room, traffic lights, unit models on the map, sound effects |

## Run locally

Serve the folder with any static server (`python3 -m http.server`) and open `index.html`.
