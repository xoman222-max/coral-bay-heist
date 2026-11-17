// Coral Bay Heist — every tuning number in one place.
// The city is a grid of blocks centred on the origin; streets run every BLOCK+STREET units.
// The bay (water + pier) lies to the south, past z = CITY_HALF.
export const STEP = 1 / 60;
export const CITY = {
  blocks: 5,            // blocks per side
  blockSize: 34,
  streetWidth: 14,
  half: 125,            // playable half-extent in world units
  buildingMin: 8,
  buildingMax: 46,
};
export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.7,
  height: 1.8,
  maxHealth: 100,
  maxArmor: 100,
  punchDamage: 18,
  punchRange: 2.2,
  punchCooldown: 0.45,
  gunDamage: 34,
  gunRange: 90,
  gunCooldown: 0.28,
  startAmmo: 24,
  startCash: 500,
};
export const CAR = {
  accel: 26,
  brake: 42,
  reverseMax: 12,
  maxSpeed: 38,
  turnRate: 1.9,
  grip: 6,
  maxDamage: 100,
};
// Car models: name, body colour, top speed factor, size (length, width), kind.
export const CAR_TYPES = [
  { name: 'Coral Cruiser', color: 0xff4d6d, speed: 1.25, len: 4.6, wid: 2.0, kind: 'sport' },
  { name: 'Bay Taxi', color: 0xffc93c, speed: 1.0, len: 4.4, wid: 1.9, kind: 'taxi' },
  { name: 'Harbor Sedan', color: 0x3fa7ff, speed: 1.0, len: 4.4, wid: 1.9, kind: 'sedan' },
  { name: 'Dock Van', color: 0x8d99ae, speed: 0.85, len: 5.2, wid: 2.1, kind: 'van' },
  { name: 'Palm Coupe', color: 0x2ec4b6, speed: 1.15, len: 4.3, wid: 1.9, kind: 'sport' },
  { name: 'Sunset Pickup', color: 0xff7b2f, speed: 0.95, len: 4.8, wid: 2.0, kind: 'pickup' },
];
export const POLICE = {
  carColor: 0x1a1a2e,
  chaseSpeed: 34,
  ramDamage: 8,
  arrestRange: 2.4,
  arrestTime: 2.5,
  decayDelay: 25,       // seconds hidden from police before a star drops
  sightRange: 70,
};
export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  ramPolice: 1,
  max: 5,
};
export const PALETTE = {
  skyDay: 0x87b5e0, skyDusk: 0xff9a5c, skyNight: 0x0d1530,
  road: 0x4a505e, sidewalk: 0x9aa0ab, ground: 0x4a7a58,
  water: 0x1d6f8e, sand: 0xd9c08a, pier: 0x7a5a38,
  building: [0xe8b4b8, 0xa8d8ea, 0xf6e27a, 0xc3b2e8, 0x9fd8a8, 0xf2a65a, 0x7fb3d5, 0xe07a5f],
  windowLit: 0xffd97a, windowDark: 0x1c2733,
  leaf: 0x2e8b57, trunk: 0x6b4a2f, lamp: 0xffe9a8,
};
export const SAVE_KEY = 'coral-bay-heist.save.v1';
export const BEST_KEY = 'coral-bay-heist.best.v1';
export const MISSION_REWARDS = [400, 900, 1400, 1800, 2500, 6000];
