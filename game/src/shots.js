// Screenshot scenes behind ?shot=start|drive|chase|mission (with &seed=N).
// Each one stages a real game state through the same code the player uses —
// a title screen over the sunset city, a drive down the main street, a police
// chase at 3 stars, a mission firefight — then the caller paints it twice and
// sets window.__shotReady for the screenshot.
export function stageShot(name, api) {
  if (name === 'drive') {
    api.startNewGame();
    api.placePlayerInCar('Coral Cruiser', 0, 40, Math.PI);
    api.setCameraBehindCar();
    api.setTime(18.2);
    return 'play';
  }
  if (name === 'chase') {
    api.startNewGame();
    api.placePlayerInCar('Palm Coupe', -20, 0, Math.PI / 2);
    api.setWanted(3);
    api.spawnPoliceNearPlayer();
    api.setTime(19.4);
    api.setMessage('WANTED — 3 STARS', 60);
    return 'play';
  }
  if (name === 'mission') {
    api.startNewGame();
    api.setMission(3); // 0-based: mission 4, The Drop, with enforcers at the warehouse
    api.placePlayerOnFoot(80, 78, Math.PI * 0.85);
    api.giveAmmo(48);
    api.spawnEnforcersAt(96, 90, 3);
    api.setTime(18.6);
    api.setMessage('MISSION 4 — THE DROP', 60);
    return 'play';
  }
  // Default: start — the title screen over the city at sunset.
  api.showTitleOverCity();
  api.setTime(18.5);
  return 'title';
}
