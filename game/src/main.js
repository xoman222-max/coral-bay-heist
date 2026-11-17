// Coral Bay Heist — boot, the one loop, screens, and the glue between systems.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import * as THREE from 'three';
import { STEP, PLAYER, CAR_TYPES, SAVE_KEY, BEST_KEY, WANTED, POLICE } from './config.js';
import { createRandom, clamp, distance2D, angleDiff } from './random.js';
import { createInput, ACTION_ENTER, ACTION_PUNCH, ACTION_PAUSE, ACTION_CONFIRM, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createVehicle, createTraffic } from './vehicles.js';
import { createPedestrians, createPedMesh } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions, STORY_INTRO } from './missions.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rand = createRandom(seed);

const canvas = document.getElementById('game');
const screenEl = document.getElementById('screen');
const statusEl = document.getElementById('status');
const errEl = document.getElementById('err');
window.addEventListener('error', (event) => {
  errEl.style.display = 'block';
  errEl.textContent = 'Error: ' + (event.message || event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  errEl.style.display = 'block';
  errEl.textContent = 'Error: ' + (event.reason && event.reason.message ? event.reason.message : event.reason);
});

const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);

// --- Three.js setup ------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff9a5c);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 30, 80);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const city = buildCity(scene, rand);
const traffic = createTraffic(scene, city, rand, audio);
const peds = createPedestrians(scene, city, rand);
const police = createPolice(scene, city, rand, audio);
const missions = createMissions();

// --- Player ----------------------------------------------------------------------
const playerMesh = createPedMesh(0x2ec4b6, 0xe0ac69, 1.0);
const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46),
  new THREE.MeshLambertMaterial({ color: 0xffd23e }));
cap.position.y = 1.98;
playerMesh.add(cap);
scene.add(playerMesh);

const player = {
  x: 0, z: 20, heading: Math.PI, health: PLAYER.maxHealth, armor: 0,
  ammo: PLAYER.startAmmo, cash: PLAYER.startCash, walkPhase: 0,
  punchTimer: 0, gunTimer: 0, hurtTimer: 0, inCar: null, aiming: false,
};
let camYaw = Math.PI;
let camPitch = 0.32;
let camDist = 9;
let hours = 18.4;
let day = 1;
let screen = 'title'; // title | play | paused | over | complete
let overReason = '';
let best = 0;
let crimeCooldown = 0;
let enforcersLeft = 0;
let dialogQueue = [];
let dialogTimer = 0;
let missionFailedReason = '';
let frameCount = 0;
let elapsed = 0;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash, missionIndex: missions.index, health: player.health,
      ammo: player.ammo, day, hours,
    }));
  } catch { /* storage may be off */ }
}
function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function writeBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}
best = readBest();

function announce(message) { statusEl.textContent = message; }

function spawnEnforcers(count, at) {
  for (let i = 0; i < count; i += 1) {
    const e = peds.spawnPed(at.x + (i - 1) * 4, at.z + (i % 2) * 3, 'enforcer');
    e.health = 80;
  }
  enforcersLeft = count;
}

function applyMissionSetup(mission) {
  if (!mission) return;
  if (mission.spawnWanted) police.wanted = Math.max(police.wanted, mission.spawnWanted);
  if (mission.enforcers && mission.enforcerAt) spawnEnforcers(mission.enforcers, mission.enforcerAt);
  const target = mission.target;
  city.beacon.position.set(target.x, 0, target.z);
  city.beacon.visible = true;
  dialogQueue = mission.dialog.slice();
  dialogTimer = 0.5;
}

function startMissionIndex(i) {
  missions.setIndex(i);
  enforcersLeft = 0;
  const m = missions.current();
  applyMissionSetup(m);
  hud.setMessage(m.title, 3);
}

function startNewGame(fromSave) {
  const save = fromSave ? readSave() : null;
  missions.start();
  police.clearAll();
  player.health = PLAYER.maxHealth;
  player.armor = 0;
  player.ammo = PLAYER.startAmmo;
  player.cash = save ? save.cash : PLAYER.startCash;
  player.x = -48;
  player.z = 110;
  player.heading = Math.PI;
  player.inCar = null;
  hours = save && save.hours !== undefined ? save.hours : 18.4;
  day = save && save.day ? save.day : 1;
  camYaw = Math.PI;
  if (save) missions.setIndex(save.missionIndex || 0);
  ensureMissionCruiser();
  const m = missions.current();
  applyMissionSetup(m);
  hud.show(true);
  screen = 'play';
  screenEl.style.display = 'none';
  audio.unlock();
  audio.startMusic();
  audio.startEngine();
  announce('Playing Coral Bay Heist. ' + m.objective);
}

function damagePlayer(amount, source) {
  if (player.hurtTimer > 0 || screen !== 'play') return;
  player.hurtTimer = 0.4;
  let rest = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest * 0.6);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  if (player.health <= 0) {
    player.health = 0;
    endGame('wasted', source || 'You were taken out on the streets of Coral Bay.');
  }
}

function endGame(kind, reason) {
  overReason = reason;
  screen = kind === 'complete' ? 'complete' : 'over';
  audio.siren(false);
  if (kind === 'complete') {
    audio.missionDone();
    if (player.cash > best) { best = player.cash; writeBest(best); }
    writeSave();
    showComplete();
  } else {
    audio.fail();
    if (kind === 'wasted') audio.arrest();
    writeSave();
    showOver(kind);
  }
  hud.show(false);
  announce(reason);
}

// The red Coral Cruiser for mission 2 is always parked by the marina: the
// job is impossible without it, so it is (re)spawned whenever it is missing.
function ensureMissionCruiser() {
  const existing = traffic.cars.find((c) => c.type.name === 'Coral Cruiser' && !c.wrecked &&
    Math.hypot(c.x - 56, c.z + 48) < 10);
  if (existing) return;
  const type = CAR_TYPES.find((t) => t.name === 'Coral Cruiser');
  const v = createVehicle(type, 56, -48, Math.PI / 2, city, audio);
  v.state.npc = true;
  v.state.parked = true;
  v.state.cruiseSpeed = 0;
  scene.add(v.state.mesh);
  traffic.cars.push(v.state);
}

function retryMission() {
  police.clearAll();
  player.health = PLAYER.maxHealth;
  player.armor = Math.max(player.armor, 25);
  player.ammo = Math.max(player.ammo, 24);
  if (player.inCar) { player.inCar = null; }
  player.x = missions.current() ? missions.current().target.x + 12 : 0;
  player.z = missions.current() ? missions.current().target.z + 12 : 20;
  player.heading = Math.PI;
  enforcersLeft = 0;
  ensureMissionCruiser();
  applyMissionSetup(missions.current());
  hud.show(true);
  screen = 'play';
  screenEl.style.display = 'none';
  announce('Retrying: ' + missions.current().title);
}

// --- Screens ---------------------------------------------------------------------
function showTitle() {
  screen = 'title';
  hud.show(false);
  const save = readSave();
  const canContinue = save && save.missionIndex > 0;
  screenEl.style.display = 'flex';
  screenEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  const h1 = document.createElement('h1');
  h1.textContent = 'CORAL BAY HEIST';
  const h2 = document.createElement('h2');
  h2.textContent = 'AN OPEN-WORLD CRIME STORY';
  const story = document.createElement('p');
  story.textContent = STORY_INTRO;
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.innerHTML = '<b>WASD</b> move / drive &nbsp; <b>Mouse drag</b> camera &nbsp; <b>Shift</b> run<br>' +
    '<b>E</b> enter or steal a car &nbsp; <b>F</b> punch &nbsp; <b>Click</b> shoot &nbsp; <b>P</b> pause &nbsp; <b>M</b> mute';
  const btnNew = document.createElement('button');
  btnNew.textContent = 'New Game';
  btnNew.addEventListener('click', () => { audio.unlock(); startNewGame(false); });
  card.appendChild(h1);
  card.appendChild(h2);
  card.appendChild(story);
  card.appendChild(controls);
  card.appendChild(btnNew);
  if (canContinue) {
    const btnContinue = document.createElement('button');
    btnContinue.className = 'alt';
    btnContinue.textContent = 'Continue — Mission ' + (save.missionIndex + 1) + ' ($' + save.cash + ')';
    btnContinue.addEventListener('click', () => { audio.unlock(); startNewGame(true); });
    card.appendChild(btnContinue);
  }
  const small = document.createElement('p');
  small.className = 'small';
  small.textContent = 'Best haul: $' + best.toLocaleString('en-US') +
    '  •  An original game. No real city, person or brand appears in it.  •  Progress saves in this browser.';
  card.appendChild(small);
  screenEl.appendChild(card);
}

function showPause() {
  screen = 'paused';
  const save = readSave();
  screenEl.style.display = 'flex';
  screenEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  const h1 = document.createElement('h1');
  h1.textContent = 'PAUSED';
  h1.style.fontSize = '34px';
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.textContent = 'Mission ' + (missions.index + 1) + ' of ' + missions.total +
    ' — ' + (missions.current() ? missions.current().title : '') +
    '  •  Cash $' + player.cash.toLocaleString('en-US') +
    '  •  Wanted ' + police.wanted + ' star' + (police.wanted === 1 ? '' : 's') +
    '  •  ' + (audio.isMuted() ? 'Muted (M to unmute)' : 'Sound on (M to mute)');
  const btnResume = document.createElement('button');
  btnResume.textContent = 'Resume';
  btnResume.addEventListener('click', () => { screen = 'play'; screenEl.style.display = 'none'; });
  const btnSave = document.createElement('button');
  btnSave.className = 'alt';
  btnSave.textContent = 'Save & Resume';
  btnSave.addEventListener('click', () => { writeSave(); screen = 'play'; screenEl.style.display = 'none'; hud.setMessage('Progress saved.', 2); });
  const btnQuit = document.createElement('button');
  btnQuit.className = 'alt';
  btnQuit.textContent = 'Quit to Title';
  btnQuit.addEventListener('click', () => { writeSave(); showTitle(); });
  card.appendChild(h1);
  card.appendChild(p);
  card.appendChild(btnResume);
  card.appendChild(btnSave);
  card.appendChild(btnQuit);
  screenEl.appendChild(card);
  announce('Paused.');
}

function showOver(kind) {
  screen = 'over';
  screenEl.style.display = 'flex';
  screenEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  const h1 = document.createElement('h1');
  h1.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  h1.style.fontSize = '40px';
  h1.style.color = kind === 'busted' ? '#57b6ff' : '#ff5a5a';
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.textContent = overReason + ' Cash kept: $' + player.cash.toLocaleString('en-US') + '.';
  const btnRetry = document.createElement('button');
  btnRetry.textContent = 'Retry Mission';
  btnRetry.addEventListener('click', () => retryMission());
  const btnTitle = document.createElement('button');
  btnTitle.className = 'alt';
  btnTitle.textContent = 'Title Screen';
  btnTitle.addEventListener('click', () => showTitle());
  card.appendChild(h1);
  card.appendChild(p);
  card.appendChild(btnRetry);
  card.appendChild(btnTitle);
  screenEl.appendChild(card);
}

function showComplete() {
  screen = 'complete';
  screenEl.style.display = 'flex';
  screenEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  const h1 = document.createElement('h1');
  h1.textContent = 'THE VAULT IS YOURS';
  h1.style.fontSize = '34px';
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.textContent = 'Marlo and Marina sail out of Coral Bay with the vault loot as the sun comes up. ' +
    'Sheriff Cole is left holding an empty bank and a very full incident report. ' +
    'Final haul: $' + player.cash.toLocaleString('en-US') + '.';
  const btnAgain = document.createElement('button');
  btnAgain.textContent = 'Play Again';
  btnAgain.addEventListener('click', () => { audio.unlock(); startNewGame(false); });
  const btnTitle = document.createElement('button');
  btnTitle.className = 'alt';
  btnTitle.textContent = 'Title Screen';
  btnTitle.addEventListener('click', () => showTitle());
  card.appendChild(h1);
  card.appendChild(p);
  card.appendChild(btnAgain);
  card.appendChild(btnTitle);
  screenEl.appendChild(card);
}

// --- Combat helpers ---------------------------------------------------------------
function commitCrime(amount) {
  if (crimeCooldown > 0) return;
  crimeCooldown = 2.5;
  police.addWanted(amount);
}

function tryPunch() {
  if (player.punchTimer > 0) return;
  player.punchTimer = PLAYER.punchCooldown;
  audio.punch();
  const px = player.x + Math.sin(player.heading) * 1.2;
  const pz = player.z + Math.cos(player.heading) * 1.2;
  const target = peds.nearest(px, pz, PLAYER.punchRange);
  const cop = police.cops.find((c) => distance2D(px, pz, c.x, c.z) < PLAYER.punchRange);
  if (cop) {
    damagePlayer(6, 'A foot officer fought back.');
    hud.setMessage('The officer shoves you back!', 1.5);
    return;
  }
  if (target) {
    target.health -= PLAYER.punchDamage;
    city.blood(target.x, 1.2, target.z);
    if (target.health <= 0) {
      if (target.kind === 'enforcer') enforcersLeft = Math.max(0, enforcersLeft - 1);
      else commitCrime(WANTED.hitPed);
      peds.remove(target);
      hud.setMessage(target.kind === 'enforcer' ? 'Enforcer down!' : 'You knocked out ' + target.name + '.', 1.5);
    }
  }
}

function tryShoot() {
  if (player.gunTimer > 0 || player.ammo <= 0) {
    if (player.ammo <= 0) { audio.denied(); hud.setMessage('Out of ammo — find a yellow crate.', 2); }
    return;
  }
  player.gunTimer = PLAYER.gunCooldown;
  player.ammo -= 1;
  audio.gunshot();
  peds.scare(player.x, player.z, 30);
  // Muzzle flash at the player's gun.
  const mx = player.x + Math.sin(player.heading) * 0.9;
  const mz = player.z + Math.cos(player.heading) * 0.9;
  city.muzzle(mx, 1.5, mz);
  // Aim along the camera: find the closest target near the camera ray.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let bestTarget = null;
  let bestScore = 0.14; // max angular miss in radians
  let bestDist = PLAYER.gunRange;
  function consider(x, z, y, obj) {
    const dx = x - camera.position.x;
    const dy = y - camera.position.y;
    const dz = z - camera.position.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > PLAYER.gunRange || dist < 0.5) return;
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / dist;
    const angle = Math.acos(clamp(dot, -1, 1));
    if (angle < bestScore && dist < bestDist + 20) { bestScore = angle; bestDist = dist; bestTarget = obj; }
  }
  for (const ped of peds.peds) {
    if (ped.alive) consider(ped.x, ped.z, 1.4, { kind: 'ped', ped });
  }
  for (const cop of police.cops) consider(cop.x, cop.z, 1.4, { kind: 'cop', cop });
  for (const car of police.cars) {
    if (!car.wrecked) consider(car.x, car.z, 1.0, { kind: 'policeCar', car });
  }
  for (const car of traffic.cars) {
    if (!car.wrecked && !car.parked) consider(car.x, car.z, 1.0, { kind: 'car', car });
  }
  if (!bestTarget) {
    // Tracer into the distance; a gunshot in public still draws the police.
    const tx = camera.position.x + dir.x * 40;
    const tz = camera.position.z + dir.z * 40;
    city.sparks(tx, Math.max(0.5, camera.position.y + dir.y * 40), tz);
    commitCrime(WANTED.shoot);
    return;
  }
  if (bestTarget.kind === 'ped') {
    const ped = bestTarget.ped;
    ped.health -= PLAYER.gunDamage;
    city.blood(ped.x, 1.2, ped.z);
    if (ped.health <= 0) {
      if (ped.kind === 'enforcer') enforcersLeft = Math.max(0, enforcersLeft - 1);
      else commitCrime(WANTED.hitPed);
      peds.remove(ped);
    } else {
      commitCrime(WANTED.shoot);
    }
  } else if (bestTarget.kind === 'cop') {
    commitCrime(WANTED.killCop);
    damagePlayer(8, 'A foot officer returned fire.');
    hud.setMessage('You shot an officer! The heat is on.', 2);
  } else if (bestTarget.kind === 'policeCar') {
    bestTarget.car.damage += 45;
    city.sparks(bestTarget.car.x, 1, bestTarget.car.z);
    commitCrime(WANTED.ramPolice);
  } else if (bestTarget.kind === 'car') {
    bestTarget.car.damage = Math.min(100, (bestTarget.car.damage || 0) + 30);
    city.sparks(bestTarget.car.x, 1, bestTarget.car.z);
    commitCrime(WANTED.shoot);
  }
}

function tryEnterCar() {
  if (player.inCar) {
    // Get out beside the car.
    const car = player.inCar;
    player.inCar = null;
    player.x = car.x + Math.cos(car.heading) * 2.6;
    player.z = car.z - Math.sin(car.heading) * 2.6;
    player.heading = car.heading;
    audio.setEngine(0, false);
    return;
  }
  const car = traffic.nearestCar(player.x, player.z, 4.5);
  if (!car) { hud.setMessage('No car close enough.', 1.5); return; }
  if (car.damage >= 100) { hud.setMessage('That car is wrecked.', 1.5); return; }
  if (!car.parked && car.driver !== null && car.driver !== undefined) {
    // Occupied: handled below by stealing from a moving car.
  }
  const wasNpc = car.npc;
  const wasParked = car.parked;
  car.npc = false;
  car.parked = false;
  car.stolen = true;
  car.speed = 0;
  player.inCar = car;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  if (wasNpc && !wasParked) {
    // The driver bails and runs.
    const driver = peds.spawnPed(car.x + 2, car.z + 2, 'walker');
    driver.flee = 5;
    driver.fleeFrom = { x: car.x, z: car.z };
    driver.speed = 5.5;
    commitCrime(WANTED.stealCar);
    hud.setMessage('You jacked the ' + car.type.name + '! Wanted level up.', 2.5);
    audio.crash();
  } else {
    hud.setMessage('You are driving the ' + car.type.name + '.', 2);
  }
  audio.startEngine();
}

// --- Per-frame update ----------------------------------------------------------------
function updatePlayerOnFoot(dt, move) {
  const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  // Movement is relative to the camera yaw.
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = -Math.sin(camYaw);
  let mx = fx * move.f + rx * move.s;
  let mz = fz * move.f + rz * move.s;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const want = Math.atan2(mx, mz);
    let diff = angleDiff(player.heading, want);
    player.heading += clamp(diff, -10 * dt, 10 * dt);
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    if (!city.isBlocked(nx, player.z, PLAYER.radius)) player.x = nx;
    if (!city.isBlocked(player.x, nz, PLAYER.radius)) player.z = nz;
    player.walkPhase += dt * speed * 1.6;
  }
  playerMesh.position.set(player.x, 0, player.z);
  playerMesh.rotation.y = player.heading;
  playerMesh.userData.armL.rotation.x = Math.sin(player.walkPhase) * 0.7;
  playerMesh.userData.armR.rotation.x = -Math.sin(player.walkPhase) * 0.7;
  playerMesh.userData.legs.rotation.x = Math.sin(player.walkPhase) * 0.35;
  player.aiming = input.isMouseDown() && screen === 'play';
}

function updateDriving(dt, move) {
  const car = player.inCar;
  const others = traffic.cars.filter((c) => c !== car);
  const prevX = car.x;
  const prevZ = car.z;
  const prevSpeed = car.speed;
  // Reuse the vehicle physics via a small wrapper object.
  const veh = { state: car, update: null };
  // Drive with the shared physics by temporarily calling the creator's logic:
  // vehicles expose createVehicle; here we replicate the call through a module
  // helper stored on the car at spawn time.
  if (car._drive) car._drive(dt, move, others);
  else {
    // Fallback simple drive (should not happen: _drive is set at spawn).
    car.speed = clamp(car.speed + move.f * 20 * dt, -12, 38);
    car.heading += move.s * 1.6 * dt * Math.sign(car.speed || 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  camYaw = car.heading + Math.PI; // camera looks along the car's forward
  audio.setEngine(Math.abs(car.speed) / 38, true);
  // Running over pedestrians.
  for (const ped of peds.peds.slice()) {
    if (!ped.alive) continue;
    if (distance2D(ped.x, ped.z, car.x, car.z) < 2.4 && Math.abs(car.speed) > 5) {
      city.blood(ped.x, 1, ped.z);
      if (ped.kind === 'enforcer') enforcersLeft = Math.max(0, enforcersLeft - 1);
      else commitCrime(WANTED.hitPed);
      peds.remove(ped);
      car.speed *= 0.7;
      car.damage = Math.min(100, car.damage + 4);
      audio.crash();
      hud.setMessage('You hit a pedestrian!', 1.5);
    }
  }
  // Ramming a police car counts as a crime.
  for (const pc of police.cars) {
    if (!pc.wrecked && distance2D(pc.x, pc.z, car.x, car.z) < 4.4 && Math.abs(car.speed) > 10) {
      pc.damage += 30;
      commitCrime(WANTED.ramPolice);
      car.damage = Math.min(100, car.damage + 8);
      audio.crash();
    }
  }
  if (car.damage >= 100) {
    city.smoke(car.x, 1.5, car.z);
    car.wrecked = true;
    player.inCar = null;
    player.x = car.x + 3;
    player.z = car.z + 3;
    audio.setEngine(0, false);
    hud.setMessage('Your car is wrecked!', 3);
    const m = missions.current();
    if (m && m.needsCar) {
      missionFailedReason = 'Your getaway car was destroyed.';
      endGame('over', missionFailedReason);
    }
  }
}

function updateEnforcers(dt) {
  for (const ped of peds.peds) {
    if (!ped.alive || ped.kind !== 'enforcer') continue;
    const d = distance2D(ped.x, ped.z, player.x, player.z);
    ped.shootTimer -= dt;
    if (d < 42 && ped.shootTimer <= 0) {
      ped.shootTimer = 1.6 + Math.random() * 1.2;
      // Enforcer fires: a tracer and a chance to hit.
      city.muzzle(ped.x, 1.5, ped.z);
      audio.gunshot();
      if (d < 26 && Math.random() < 0.45) {
        damagePlayer(7 + Math.floor(Math.random() * 6), 'A Bay Sharks enforcer shot you.');
      }
    }
    // Enforcers close in on foot, sliding along walls.
    if (d > 8 && d < 60) {
      const want = Math.atan2(player.x - ped.x, player.z - ped.z);
      ped.heading = want;
      const step = 3.4 * dt;
      // Try forward, then the two sides, then back, so enforcers walk
      // around buildings instead of pressing against them.
      const dirs = [want, want + Math.PI / 2, want - Math.PI / 2, want + Math.PI];
      let moved = false;
      for (const dir of dirs) {
        const tx = ped.x + Math.sin(dir) * step;
        const tz = ped.z + Math.cos(dir) * step;
        if (!city.isBlocked(tx, tz, 0.5)) { ped.x = tx; ped.z = tz; moved = true; break; }
      }
      if (!moved) ped.heading += Math.PI / 2;
    }
  }
}

function updatePickups() {
  for (const p of city.pickups) {
    if (p.taken) continue;
    if (distance2D(player.x, player.z, p.x, p.z) < 2.2) {
      p.taken = true;
      p.mesh.visible = false;
      audio.pickup();
      if (p.kind === 'ammo') { player.ammo += 24; hud.setMessage('+24 ammo', 2); }
      else if (p.kind === 'health') { player.health = Math.min(100, player.health + 40); hud.setMessage('+40 health', 2); }
      else { player.armor = Math.min(100, player.armor + 50); hud.setMessage('+50 armor', 2); }
    }
  }
}

function updateCamera(dt) {
  let targetYaw = camYaw;
  let dist = camDist;
  let height = 3.4;
  let lookY = 1.6;
  if (player.inCar) {
    dist = 12;
    height = 3.2;
    lookY = 1.4;
    targetYaw = player.inCar.heading; // camera sits behind the car, looking its way
  }
  // Smooth the yaw toward the target (shortest way round).
  let diff = angleDiff(camYaw, targetYaw);
  camYaw += diff * (1 - Math.exp(-6 * dt));
  const pitch = player.inCar ? camPitch * 0.45 : camPitch;
  const cx = player.x - Math.sin(camYaw) * dist * Math.cos(pitch);
  const cz = player.z - Math.cos(camYaw) * dist * Math.cos(pitch);
  const cy = height + Math.sin(pitch) * dist;
  camera.position.x += (cx - camera.position.x) * (1 - Math.exp(-10 * dt));
  camera.position.y += (cy - camera.position.y) * (1 - Math.exp(-10 * dt));
  camera.position.z += (cz - camera.position.z) * (1 - Math.exp(-10 * dt));
  camera.lookAt(player.x, lookY, player.z);
}

function step(dt) {
  elapsed += dt;
  hours += dt / 90; // one game hour every 90 real seconds
  if (hours >= 24) { hours -= 24; day += 1; }
  if (crimeCooldown > 0) crimeCooldown -= dt;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.gunTimer > 0) player.gunTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;

  const move = input.move();
  const drag = input.takeDrag();
  if (drag.x !== 0 || drag.y !== 0) {
    if (!player.inCar) camYaw -= drag.x * 0.005;
    camPitch = clamp(camPitch + drag.y * 0.003, -0.15, 0.9);
  }
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    hud.setMessage(audio.isMuted() ? 'Muted' : 'Sound on', 1.5);
  }
  if (actions & ACTION_PAUSE) {
    if (screen === 'play') { writeSave(); showPause(); }
    else if (screen === 'paused') { screen = 'play'; screenEl.style.display = 'none'; }
    return;
  }
  if (screen !== 'play') return;
  if (actions & ACTION_ENTER) tryEnterCar();
  if (actions & ACTION_PUNCH && !player.inCar) tryPunch();
  if (actions & ACTION_CONFIRM && !player.inCar) {
    // Click (not a drag) while playing = shoot.
    tryShoot();
  }

  // Dialogue lines advance on a timer.
  if (dialogQueue.length > 0) {
    dialogTimer -= dt;
    if (dialogTimer <= 0) {
      const line = dialogQueue.shift();
      hud.setDialog(line[0], line[1], 5.5);
      dialogTimer = 6;
    }
  }

  if (player.inCar) updateDriving(dt, move);
  else updatePlayerOnFoot(dt, move);
  traffic.update(dt, player, player.inCar);
  peds.update(dt, player, player.inCar);
  updateEnforcers(dt);
  const arrest = police.update(dt, player, player.inCar, () => {
    endGame('busted', 'Sheriff Cole’s officers dragged you out of the car and cuffed you.');
    audio.arrest();
  }, () => { hud.setMessage('Police rammed you!', 1.5); });
  if (arrest && arrest.arrestProgress > 0.05 && !player.inCar) {
    hud.setMessage('ARREST IN PROGRESS — run! ' + Math.round(arrest.arrestProgress * 100) + '%', 0.5);
  }
  audio.updateSiren(dt);
  updatePickups();
  city.update(dt, elapsed, hours);

  // Mission progress.
  const m = missions.current();
  if (m) {
    const result = missions.update(dt, {
      player, car: player.inCar, wanted: police.wanted, enforcersLeft,
      failed: false,
    });
    if (result === 'advanced') {
      player.cash += m.reward;
      audio.missionDone();
      hud.setMessage('Mission complete! +$' + m.reward, 3.5);
      writeSave();
      const next = missions.current();
      if (next) applyMissionSetup(next);
    } else if (result === 'complete') {
      player.cash += m.reward;
      endGame('complete', 'All missions complete.');
    }
  }
  updateCamera(dt);
  hud.update(dt, {
    health: player.health, armor: player.armor, cash: player.cash,
    wanted: police.wanted,
    missionTitle: m ? m.title : 'Coral Bay Heist',
    missionText: m ? m.objective : 'All missions complete!',
    target: m ? m.target : null,
    targetDist: m ? distance2D(player.x, player.z, m.target.x, m.target.z) : 0,
    speed: player.inCar ? player.inCar.speed : 0,
    carName: player.inCar ? player.inCar.type.name : 'On foot',
    ammo: player.ammo, hours, day,
    aiming: !player.inCar && input.isMouseDown(),
    player: { x: player.x, z: player.z, heading: player.heading },
    traffic: traffic.cars.filter((c) => !c.parked),
    policeCars: police.cars,
    policeCops: police.cops,
  });
}

// Attach the shared drive physics to every traffic car once (created in vehicles).
for (const car of traffic.cars) {
  car._drive = (dt, move, others) => {
    const maxSpeed = 38 * car.type.speed;
    let throttle = move.f;
    if (throttle > 0) car.speed += 26 * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= 42 * dt;
      else car.speed += 26 * 0.6 * throttle * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 9 * dt;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    car.speed = clamp(car.speed, -12, maxSpeed);
    if (car.damage > 70) car.speed = clamp(car.speed, -6, maxSpeed * 0.45);
    car.heading += move.s * 1.9 * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    let hit = false;
    if (city.isBlocked(nx, nz, 1.6)) hit = true;
    else {
      for (const other of others || []) {
        if (other === car || other.wrecked) continue;
        if (distance2D(nx, nz, other.x, other.z) < 3.4) { hit = true; break; }
      }
    }
    if (hit) {
      if (Math.abs(car.speed) > 6) {
        car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.9);
        audio.crash();
        city.sparks(car.x + Math.sin(car.heading) * 2, 1, car.z + Math.cos(car.heading) * 2);
      }
      car.speed *= -0.25;
    } else { car.x = nx; car.z = nz; }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
    if (car.damage > 45) {
      car._smoke = (car._smoke || 0) - dt;
      if (car._smoke <= 0) { car._smoke = 0.12; city.smoke(car.x, 1.4, car.z); }
    }
  };
}

ensureMissionCruiser();

// --- Screenshot staging API ------------------------------------------------------
const api = {
  startNewGame() { startNewGame(false); screen = 'play'; screenEl.style.display = 'none'; hud.show(true); },
  showTitleOverCity() {
    showTitle();
    camera.position.set(30, 26, 90);
    camera.lookAt(0, 8, 0);
  },
  placePlayerInCar(typeName, x, z, heading) {
    const type = CAR_TYPES.find((t) => t.name === typeName) || CAR_TYPES[0];
    const v = createVehicle(type, x, z, heading, city, audio);
    v.state._drive = traffic.cars[0] ? traffic.cars[0]._drive : null;
    // Reuse the drive closure by copying from a traffic car.
    const donor = traffic.cars.find((c) => c._drive);
    if (donor) v.state._drive = donor._drive;
    scene.add(v.state.mesh);
    traffic.cars.push(v.state);
    player.inCar = v.state;
    player.x = x; player.z = z; player.heading = heading;
    v.state.npc = false;
    v.state.parked = false;
    v.state.stolen = true; // keep the traffic system from driving the player's car
    v.state.cruiseSpeed = 0;
  },
  placePlayerOnFoot(x, z, heading) {
    if (player.inCar) player.inCar = null;
    player.x = x; player.z = z; player.heading = heading;
    camYaw = heading;
    playerMesh.position.set(x, 0, z);
    playerMesh.rotation.y = heading;
  },
  setWanted(n) { police.wanted = n; },
  police() {
    return {
      cars: police.cars.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), wrecked: c.wrecked })),
      cops: police.cops.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), arrest: Math.round(c.arrest * 10) / 10 })),
    };
  },
  spawnPoliceNearPlayer() {
    police.update(0.01, player, player.inCar, null, null);
    // Stage the chase in frame: one interceptor ahead-left, one closing in behind.
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const rx = Math.cos(player.heading);
    const rz = -Math.sin(player.heading);
    const spots = [
      { x: player.x + fx * 30 + rx * 2, z: player.z + fz * 30 + rz * 2 },
      { x: player.x - fx * 24 + rx * 7, z: player.z - fz * 24 + rz * 7 },
    ];
    police.cars.forEach((car, i) => {
      const spot = spots[i % spots.length];
      car.x = spot.x;
      car.z = spot.z;
      car.heading = player.heading;
      car.speed = 20;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    });
  },
  setMission(i) { startMissionIndex(i); },
  giveAmmo(n) { player.ammo = n; },
  spawnEnforcersAt(x, z, count) { spawnEnforcers(count, { x, z }); },
  setTime(h) { hours = h; city.setTimeOfDay(h); },
  setMessage(text, seconds) { hud.setMessage(text, seconds); },
};

function renderFrame() {
  city.update(0, elapsed, hours);
  renderer.render(scene, camera);
}

function runShot(name) {
  const kind = stageShot(name, api);
  // Let the staged scene settle for a couple of frames, then flag readiness.
  let painted = 0;
  function paint() {
    if (kind === 'play') {
      // Drive the staged scene forward a touch so traffic and the camera settle.
      // Fewer steps for the chase so the trailing interceptor stays behind the camera.
      const steps = name === 'chase' ? 12 : 30;
      for (let i = 0; i < steps; i += 1) {
        traffic.update(STEP, player, player.inCar);
        peds.update(STEP, player, player.inCar);
        if (player.inCar) {
          const cruise = name === 'chase' ? 26 : 22;
          player.inCar.speed = cruise;
          const nx = player.inCar.x + Math.sin(player.inCar.heading) * cruise * STEP;
          const nz = player.inCar.z + Math.cos(player.inCar.heading) * cruise * STEP;
          if (!city.isBlocked(nx, nz, 1.6)) { player.inCar.x = nx; player.inCar.z = nz; }
          player.inCar.mesh.position.set(player.inCar.x, 0, player.inCar.z);
          player.x = player.inCar.x; player.z = player.inCar.z;
        }
        if (name === 'chase') {
          police.update(STEP, player, player.inCar, null, null);
        }
      }
      updateCamera(0.5);
      hud.update(0.016, {
        health: player.health, armor: player.armor, cash: player.cash,
        wanted: police.wanted,
        missionTitle: missions.current() ? missions.current().title : 'Coral Bay Heist',
        missionText: missions.current() ? missions.current().objective : '',
        target: missions.current() ? missions.current().target : null,
        targetDist: missions.current() ? distance2D(player.x, player.z, missions.current().target.x, missions.current().target.z) : 0,
        speed: player.inCar ? player.inCar.speed : 0,
        carName: player.inCar ? player.inCar.type.name : 'On foot',
        ammo: player.ammo, hours, day, aiming: name === 'mission',
        player: { x: player.x, z: player.z, heading: player.heading },
        traffic: traffic.cars.filter((c) => !c.parked),
        policeCars: police.cars, policeCops: police.cops,
      });
    }
    renderFrame();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      statusEl.textContent = 'SHOT_READY ' + name;
      // Keep re-painting the staged scene: a later resize clears a WebGL
      // canvas, and the screenshot must still find the frame there.
      (function keepPainting() {
        renderFrame();
        requestAnimationFrame(keepPainting);
      })();
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  showTitle();
  // Idle camera drift over the city behind the title screen.
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dtReal = Math.min((now - last) / 1000, 0.25);
    last = now;
    frameCount += 1;
    if (screen === 'title') {
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 90, 34 + Math.sin(t * 0.03) * 6, Math.cos(t * 0.05) * 90);
      camera.lookAt(0, 6, 0);
      city.update(dtReal, t, hours);
      traffic.update(dtReal, player, null);
      peds.update(dtReal, player, null);
      renderer.render(scene, camera);
      return;
    }
    if (screen === 'paused' || screen === 'over' || screen === 'complete') {
      renderer.render(scene, camera);
      return;
    }
    accumulator += dtReal;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      step(STEP);
      accumulator -= STEP;
      guard += 1;
      if (screen !== 'play') { accumulator = 0; break; }
    }
    if (guard >= 8) accumulator = 0;
    renderer.render(scene, camera);
  }
  announce('Coral Bay Heist. Press New Game to start.');
  requestAnimationFrame(frame);
}

// Debug handle for headless testing: exposes live state without changing the game.
window.__cbh = {
  get player() { return { x: player.x, z: player.z, heading: player.heading, inCar: !!player.inCar, speed: player.inCar ? player.inCar.speed : 0 }; },
  get car() { const c = player.inCar; return c ? { x: c.x, z: c.z, heading: c.heading, speed: c.speed, meshX: c.mesh.position.x, meshZ: c.mesh.position.z } : null; },
  get camera() { return { x: camera.position.x, y: camera.position.y, z: camera.position.z }; },
  get hours() { return hours; },
  get sceneChildren() { return scene.children.length; },
  get state() {
    return {
      screen, mission: missions.index, missionTitle: missions.current() ? missions.current().title : 'done',
      wanted: police.wanted, health: Math.round(player.health), cash: player.cash,
      ammo: player.ammo, inCar: !!player.inCar, carName: player.inCar ? player.inCar.type.name : null,
      x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10,
      enforcersLeft,
    };
  },
  nearbyCars() {
    return traffic.cars
      .filter((c) => Math.hypot(c.x - player.x, c.z - player.z) < 25)
      .map((c) => ({ name: c.type.name, x: Math.round(c.x), z: Math.round(c.z), parked: c.parked, wrecked: !!c.wrecked, stolen: !!c.stolen }));
  },
  setWanted(n) { police.wanted = n; },
  police() {
    return {
      cars: police.cars.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), wrecked: c.wrecked })),
      cops: police.cops.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), arrest: Math.round(c.arrest * 10) / 10 })),
    };
  },
  teleport(x, z) { player.x = x; player.z = z; if (player.inCar) { player.inCar.x = x; player.inCar.z = z; player.inCar.mesh.position.set(x, 0, z); } },
  get renderer() { return renderer; },
  get scene() { return scene; },
  get cam() { return camera; },
  get canvasPixels() {
    const c = renderer.domElement;
    const gl = renderer.getContext();
    return { w: c.width, h: c.height, contextLost: gl.isContextLost() };
  },
};

if (shotName) runShot(shotName);
else runGame();
