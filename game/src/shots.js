// Screenshot scenes behind ?shot=start|drive|chase|mission (with &seed=N).
// Each one stages a real game state through the same code the player uses —
// a title screen over the sunset city, a drive down the main street, a police
// chase at 3 stars, a mission firefight — then the caller paints it twice and
// sets window.__shotReady for the screenshot.
//
// Scenes are data: each entry lists the setup calls in order. 'start' is the
// default when the name is missing or unknown.
const SCENES = {
  drive: {
    screen: 'play',
    setup(api) {
      api.startNewGame();
      api.placePlayerInCar('Coral Cruiser', 0, 40, Math.PI);
      api.setTime(17.0);
    },
  },
  chase: {
    screen: 'play',
    setup(api) {
      api.startNewGame();
      api.placePlayerInCar('Palm Coupe', -20, 0, Math.PI / 2);
      api.setWanted(3);
      api.spawnPoliceNearPlayer();
      api.setTime(19.4);
      api.setMessage('WANTED — 3 STARS', 60);
    },
  },
  mission: {
    screen: 'play',
    setup(api) {
      api.startNewGame();
      api.setMission(3); // 0-based: mission 4, The Drop, with enforcers at the warehouse
      api.placePlayerOnFoot(96, 66, 0);
      api.giveAmmo(48);
      api.spawnEnforcersAt(96, 90, 3);
      api.setTime(17.8);
      api.setMessage('MISSION 4 — THE DROP', 60);
    },
  },
  start: {
    screen: 'title',
    setup(api) {
      api.showTitleOverCity();
      api.setTime(18.5);
    },
  },
};

export function stageShot(name, api) {
  const scene = SCENES[name] || SCENES.start;
  scene.setup(api);
  return scene.screen;
}
