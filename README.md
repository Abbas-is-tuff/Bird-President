# Bird President

A realistic political and geopolitical simulator starring a nation of birds. Win the election, then run the country: cabinet, laws, economy, 1,200 simulated citizens, diplomacy with 7 AI nations, the military, the news and random crises. It has a 3D presidential office, a living capital city and a 3D world map.

**Fully offline.** The whole game is one file, `bird-president/index.html` (~1 MB). Three.js, the fonts, the music and all textures are built in. No internet is needed.

## Play
- **On this computer:** download `bird-president/index.html` and open it in Chrome or Edge. It also works as a Steam non-Steam game: point Steam at the file or at your browser with the file as the launch option.
- **Install as an app (phone or PC):** turn on GitHub Pages (Settings > Pages > Deploy from branch > `main` > `/root`). Open `https://abbas-is-tuff.github.io/<repo-name>/bird-president/` in Chrome or Edge and choose **Install app** (on iPhone: Share > Add to Home Screen). After the first visit it runs with no connection.

Saves stay on the device. Use Menu > Save / load > Export to move a save to another device.

## Folders
- `bird-president/`: the game. This is all you need to play.
- `source/`: the editable code (modules, build script, tests). You don't need it to play.

## Rebuild after changing the source
```
cd source
npm install
node tools/build.mjs        # writes dist/bird-president/, then copy it over ../bird-president/
```
