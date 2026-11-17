// Missions and story: six linked jobs for Marlo Vane, from the pier meeting
// with Marina Sol to the vault job at the Coral Bay Bank. Each mission has a
// title, a target point, dialogue lines, a reward, and a check that decides
// when it is done. Missions can fail (arrested, or the car destroyed) and retry.
import { MISSION_REWARDS } from './config.js';
import { distance2D } from './random.js';

export const STORY_INTRO =
  'Marlo Vane just walked out of Coral Bay prison after three years. ' +
  'His old friend Marina Sol has one last plan: a string of jobs across the city, ' +
  'ending with the vault of the Coral Bay Bank — and Sheriff Dray Cole, the crooked ' +
  'lawman who put Marlo away, standing in the way. Drive fast, stay low, get paid.';

const MISSIONS = [
  {
    id: 1,
    title: '1 — The Pier Meeting',
    target: { x: -48, z: 132, label: 'Marina at the pier' },
    objective: 'Meet Marina Sol at the end of the pier.',
    dialog: [
      ['Marina Sol', 'Marlo! Three years and you still walk like a delivery driver. Good — you will need that van... I mean, those legs.'],
      ['Marlo Vane', 'Marina. You look like trouble that learned to dress well. What is the job?'],
      ['Marina Sol', 'Six jobs, one vault, and Dray Cole breathing down our necks. First: wheels. The Coral Cruiser parked by the marina is ours tonight.'],
    ],
    reward: MISSION_REWARDS[0],
    check(state) { return distance2D(state.player.x, state.player.z, -48, 132) < 6; },
  },
  {
    id: 2,
    title: '2 — Borrowed Wheels',
    target: { x: 56, z: -48, label: 'Coral Cruiser' },
    objective: 'Steal the red Coral Cruiser parked by the marina (press E near a car).',
    dialog: [
      ['Marina Sol', 'That Cruiser belongs to a Shark who owes me money. Take it. If the driver argues, argue back.'],
      ['Marlo Vane', 'Borrowed, not stolen. I will return it... eventually. Probably not.'],
    ],
    reward: MISSION_REWARDS[1],
    needsCar: 'Coral Cruiser',
    check(state) {
      return state.car && state.car.type.name === 'Coral Cruiser' &&
        distance2D(state.player.x, state.player.z, 56, -48) < 30;
    },
  },
  {
    id: 3,
    title: '3 — Shake the Heat',
    target: { x: -96, z: -48, label: 'Hideout alley' },
    objective: 'Lose the police, then reach the hideout at the north-west crossroads.',
    dialog: [
      ['Marina Sol', 'Cole’s boys are on you already. Lose them — lay low, break line of sight, let the stars cool off.'],
      ['Marlo Vane', 'I have not even had the car an hour and the whole city is after me. Feels like old times.'],
    ],
    reward: MISSION_REWARDS[2],
    spawnWanted: 2,
    check(state) {
      return state.wanted === 0 &&
        distance2D(state.player.x, state.player.z, -96, -48) < 12;
    },
  },
  {
    id: 4,
    title: '4 — The Drop',
    target: { x: 96, z: 96, label: 'Harbor warehouse' },
    objective: 'Drive the package to the harbor warehouse. The Sharks will not let it go easy.',
    dialog: [
      ['Marina Sol', 'Package is in the trunk. The Sharks want it back — expect company at the warehouse.'],
      ['Marlo Vane', 'Company I can handle. A delivery with a gunfight attached. Just like my old job, minus the tips.'],
    ],
    reward: MISSION_REWARDS[3],
    enforcers: 3,
    enforcerAt: { x: 96, z: 90 },
    check(state) {
      return state.car && distance2D(state.player.x, state.player.z, 96, 96) < 10 &&
        state.enforcersLeft === 0;
    },
  },
  {
    id: 5,
    title: '5 — The Bank Run',
    target: { x: 0, z: -48, label: 'Coral Bay Bank' },
    objective: 'Reach the Coral Bay Bank downtown and crack the vault door (stand at the marker).',
    dialog: [
      ['Marina Sol', 'This is it. The vault, the crew, the getaway. Dray Cole knows — his interceptors will be waiting.'],
      ['Marlo Vane', 'Then we give them a chase worth remembering.'],
    ],
    reward: MISSION_REWARDS[4],
    spawnWanted: 3,
    enforcers: 2,
    enforcerAt: { x: 0, z: -44 },
    check(state) {
      return distance2D(state.player.x, state.player.z, 0, -48) < 8 &&
        state.enforcersLeft === 0;
    },
  },
  {
    id: 6,
    title: '6 — The Getaway',
    target: { x: -48, z: 132, label: 'Escape pier' },
    objective: 'Escape to the pier with the loot. Lose the police on the way — 5 stars will not follow you home.',
    dialog: [
      ['Marina Sol', 'Vault is open, Marlo! Boat is waiting at the pier. Do not stop for anything — especially not the law.'],
      ['Marlo Vane', 'One last drive. Coral Bay, you have been a terrible host. I am keeping the tip.'],
    ],
    reward: MISSION_REWARDS[5],
    spawnWanted: 4,
    check(state) {
      return distance2D(state.player.x, state.player.z, -48, 132) < 8;
    },
  },
];

export function createMissions() {
  let index = 0;          // 0-based into MISSIONS
  let started = false;
  let done = false;
  let lineIndex = 0;
  let atTargetTimer = 0;

  function current() { return MISSIONS[index] || null; }
  function start() { started = true; index = 0; lineIndex = 0; done = false; atTargetTimer = 0; }
  function reset() { start(); }
  function setIndex(i) { index = Math.max(0, Math.min(MISSIONS.length - 1, i)); lineIndex = 0; atTargetTimer = 0; }
  // Returns 'complete' | 'failed' | null each frame.
  function update(dt, state) {
    const m = current();
    if (!m || done) return null;
    if (state.failed) return 'failed';
    if (m.check(state)) {
      atTargetTimer += dt;
      if (atTargetTimer > 0.6) {
        index += 1;
        lineIndex = 0;
        atTargetTimer = 0;
        if (index >= MISSIONS.length) { done = true; return 'complete'; }
        return 'advanced';
      }
    } else {
      atTargetTimer = 0;
    }
    return null;
  }
  function nextDialogLine() {
    const m = current();
    if (!m) return null;
    if (lineIndex >= m.dialog.length) return null;
    return m.dialog[lineIndex++];
  }
  function dialogLeft() {
    const m = current();
    return m ? m.dialog.length - lineIndex : 0;
  }
  return {
    get index() { return index; },
    get started() { return started; },
    get done() { return done; },
    get total() { return MISSIONS.length; },
    current, start, reset, setIndex, update, nextDialogLine, dialogLeft,
  };
}
