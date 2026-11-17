// Coral Bay Heist — screenshot scenes.
// ?shot=title|drive|chase|mission stages one scene of the game, then
// raises window.SHOT_READY so the capture tool knows the frame is
// worth taking.

export function applyShot(game, name) {
  const waitMs = { title: 1400, drive: 2400, chase: 3600, mission: 3600 }[name] || 1600;
  if (name === 'drive') {
    game.startGame({ mission: null });
    const car = game.spawnPlayerCar(0x3f8fbf, 0, 40, 0);
    game.enterCar(car);
    game.setAutoDrive(0.55, 0);
  } else if (name === 'chase') {
    game.startGame({ mission: null });
    const car = game.spawnPlayerCar(0x3f8fbf, 0, 40, 0);
    game.enterCar(car);
    game.setAutoDrive(0.9, 0);
    game.setWanted(3);
    // One cruiser of the law parked ahead, so the frame shows the
    // chase instead of only its stars.
    game.spawnPoliceCar(6, 88, Math.PI);
    game.spawnPoliceCar(-8, 96, Math.PI);
  } else if (name === 'mission') {
    game.startGame({ mission: 3 });
    game.teleportPlayer(100, -27, Math.PI / 2);
  }
  // Title needs nothing: the game already idles on the start screen.
  window.setTimeout(() => {
    window.SHOT_READY = true;
  }, waitMs);
}
