// Coral Bay Heist — shared tuning and mission data.
// Every number the game balances on lives here, so the rest of the
// code reads like a design doc instead of a pile of magic numbers.

export const WORLD = {
  seed: 20261117,
  // Half-extent of the playable city, in metres. Buildings stop at this
  // edge; beyond it is sand, sea and a fence of palms.
  half: 180,
  // A city block is this wide; streets run between the blocks.
  block: 40,
  street: 14,
  // Streets are laid on this pitch: block + street.
  get pitch() {
    return this.block + this.street;
  },
};

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8d0e6,
  sand: 0xd9c28f,
  grass: 0x7fae62,
  asphalt: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  water: 0x1f7fa8,
  building: 0xcfc4b0,
  buildingDowntown: 0x8f9bb0,
  warehouse: 0xb0703c,
  casino: 0xd94f70,
  neonPink: 0xff4fa3,
  neonTeal: 0x2fe6c8,
  neonGold: 0xffc94d,
  cruiser: 0xff5fa2,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  health: 100,
  radius: 0.6,
  startCash: 500,
};

export const CAR = {
  accel: 14,
  brake: 26,
  reverseAccel: 8,
  maxSpeed: 34,
  maxReverse: 9,
  turnRate: 1.9,
  drag: 0.6,
  // How close the player must be to steal or enter a car.
  enterRange: 3.4,
};

export const WANTED = {
  // Seconds the player must stay unseen for one star to fall off.
  decaySeconds: 9,
  // How far a cop must be before the player counts as "hidden".
  hideDistance: 55,
  maxStars: 5,
};

// The story, in order. Each mission names its giver, the lines the
// player hears when it starts, what has to happen, and what it pays.
// The mission code in missions.js reads these definitions and nothing
// else knows the story.
export const MISSIONS = [
  {
    id: 'errand',
    title: 'First Errand',
    giver: 'Marina Sol',
    brief: [
      'Marina Sol: "You need work, I need a courier. Pick up the parcel at the corner and bring it to my place."',
      'Marina Sol: "Drive straight, keep it quiet, and there is four hundred in it for you."',
    ],
    reward: 400,
    pickup: { x: 0, z: 108 },
    dropoff: { x: -108, z: 0 },
    complete: 'Marina Sol: "Clean run. You drive like you mean it."',
  },
  {
    id: 'cruiser',
    title: 'The Coral Cruiser',
    giver: 'Marina Sol',
    brief: [
      'Marina Sol: "Marlo Vane wants his Coral Cruiser back. It is parked outside the casino, pink as a sunset."',
      'Marina Sol: "Take it. The valets will not stop you. The police might."',
    ],
    reward: 900,
    cruiserSpot: { x: -54, z: 162 },
    complete: 'Marina Sol: "The Cruiser is ours. Marlo owes you one."',
  },
  {
    id: 'heat',
    title: 'Shake the Heat',
    giver: 'Marlo Vane',
    brief: [
      'Marlo Vane: "Three stars on your head and my name on their list. Lose them."',
      'Marlo Vane: "Stay out of sight. Outrun them, hide, wait them out. Come back clean."',
    ],
    reward: 600,
    startWanted: 3,
    complete: 'Marlo Vane: "Clean. You are a ghost when you want to be."',
  },
  {
    id: 'warehouse',
    title: 'Warehouse War',
    giver: 'Marlo Vane',
    brief: [
      'Marlo Vane: "My warehouse, my men, and a crew that thinks it can take both. Go in shooting."',
      'Marina Sol: "Four of them, at least. Watch the doorways, and do not get flanked."',
    ],
    reward: 1400,
    warehouse: { x: 108, z: -27 },
    enforcers: 4,
    complete: 'Marlo Vane: "The warehouse is mine again. You fight like family."',
  },
  {
    id: 'heist',
    title: 'The Big Score',
    giver: 'Marina Sol',
    brief: [
      'Marina Sol: "The casino vault. One crack, one grab, one very fast exit."',
      'Marina Sol: "Stand at the vault door and hold it together. The alarm will bring company."',
    ],
    reward: 2500,
    vault: { x: -27, z: 108 },
    crackSeconds: 8,
    complete: 'Marina Sol: "Two and a half grand, and nobody saw your face. Beautiful."',
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Marlo Vane',
    brief: [
      'Marlo Vane: "Last one. Four stars, the whole bay awake. Get to the boat at the harbor and do not look back."',
      'Marlo Vane: "When you are on that boat, Coral Bay is yours."',
    ],
    reward: 3000,
    boat: { x: -168, z: -108 },
    startWanted: 4,
    complete: 'Marlo Vane: "You made it. Coral Bay is yours now, kid."',
  },
];

export const SHOT_SCENES = ['title', 'drive', 'chase', 'mission'];
