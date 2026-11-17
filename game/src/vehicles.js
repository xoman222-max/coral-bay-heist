// Vehicles: the car mesh factory, arcade driving physics, parked cars, and the
// traffic system (NPC cars cruising the street grid, with drivers to steal from).
import * as THREE from 'three';
import { CAR, CAR_TYPES, CITY, PITCH } from './config.js';
import { clamp, distance2D, pick, range } from './random.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);

// Build the visible car: body, cabin, pickup bed, headlights and taillights,
// a taxi sign for taxis, and four spinning wheels (kept on userData).
export function createCarMesh(type, colorOverride) {
  const group = new THREE.Group();
  const color = colorOverride !== undefined ? colorOverride : type.color;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const len = type.len;
  const wid = type.wid;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabinH = type.kind === 'van' ? 1.05 : 0.62;
  const cabinLen = type.kind === 'van' ? len * 0.82 : len * 0.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, cabinH, cabinLen), glassMat);
  cabin.position.set(0, 1.05 + cabinH / 2 - 0.35, type.kind === 'van' ? -0.2 : -len * 0.06);
  group.add(cabin);
  if (type.kind === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.45, len * 0.34), darkMat);
    bed.position.set(0, 1.15, -len * 0.28);
    group.add(bed);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), headMat);
    head.position.set(s * (wid / 2 - 0.3), 0.62, len / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), tailMat);
    tail.position.set(s * (wid / 2 - 0.3), 0.62, -len / 2 - 0.02);
    group.add(tail);
  }
  if (type.kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.75, 0);
    group.add(sign);
  }
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len / 2 - 0.9], [wid / 2, len / 2 - 0.9], [-wid / 2, -len / 2 + 0.9], [wid / 2, -len / 2 + 0.9]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

// One arcade driving step for a car state object ({x, z, heading, speed,
// damage, mesh, type, ...}). Shared by the player's car and by any car the
// game drives directly: accelerate / brake / reverse, steering that scales
// with speed, building and car collision with damage and sparks, and smoke
// once the car is badly hurt. `input` is {f, s} (-1..1) or null to coast.
export function drivePhysics(car, dt, input, others, city, audio) {
  const maxSpeed = CAR.maxSpeed * car.type.speed;
  let throttle = 0;
  let steer = 0;
  if (input) {
    throttle = input.f;
    steer = input.s;
    if (input.f < 0) throttle = input.f * 0.7; // reverse is weaker
  }
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt; // brake first
    else car.speed += CAR.accel * 0.6 * throttle * dt; // then reverse
  } else {
    car.speed -= Math.sign(car.speed) * 9 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR.reverseMax, maxSpeed);
  if (car.damage > 70) car.speed = clamp(car.speed, -6, maxSpeed * 0.45);
  const steerAmount = steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading += steerAmount * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  let hit = false;
  if (city.isBlocked(nx, nz, 1.6)) {
    hit = true;
  } else {
    for (const other of others || []) {
      if (other === car || other.wrecked) continue;
      if (distance2D(nx, nz, other.x, other.z) < 3.4) { hit = true; break; }
    }
  }
  if (hit) {
    if (Math.abs(car.speed) > 6) {
      car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.9);
      if (audio) audio.crash();
      city.sparks(car.x + Math.sin(car.heading) * 2, 1, car.z + Math.cos(car.heading) * 2);
    }
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  // Damage smoke.
  if (car.damage > 45) {
    car.smokeTimer = (car.smokeTimer || 0) - dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      city.smoke(car.x, 1.4, car.z);
    }
  }
  return car;
}

// A drivable car: arcade physics with inertia, steering that scales with speed,
// building collision, damage and smoke.
export function createVehicle(type, x, z, heading, city, audio) {
  const mesh = createCarMesh(type);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  const state = {
    mesh, type, x, z, heading,
    speed: 0,
    damage: 0,          // 0 fine .. 100 wrecked
    smokeTimer: 0,
    npc: false,
    driver: null,       // a pedestrian object, when an NPC drives it
    parked: false,
    id: Math.random().toString(36).slice(2, 8),
  };
  function update(dt, input, others) {
    return drivePhysics(state, dt, input, others, city, audio);
  }
  return { state, update };
}

// Traffic: NPC cars that cruise the grid, stop for nothing, and can be stolen.
// Parked cars sit at the kerb with no driver.
export function createTraffic(scene, city, rand, audio) {
  const cars = [];
  const streetCoords = city.streetCoords;
  const HALF = CITY.half;

  function spawnCar(parked) {
    const type = pick(rand, CAR_TYPES);
    let x; let z; let heading;
    if (parked) {
      const street = pick(rand, streetCoords);
      const along = range(rand, -HALF + 14, HALF - 14);
      if (rand() < 0.5) { x = street + 8.2; z = along; heading = 0; }
      else { x = along; z = street + 8.2; heading = Math.PI / 2; }
    } else {
      const street = pick(rand, streetCoords);
      const along = range(rand, -HALF + 10, HALF - 10);
      const dir = rand() < 0.5 ? 1 : -1;
      if (rand() < 0.5) { x = street + (dir > 0 ? 3.5 : -3.5); z = along; heading = dir > 0 ? 0 : Math.PI; }
      else { x = along; z = street + (dir > 0 ? 3.5 : -3.5); heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    }
    const v = createVehicle(type, x, z, heading, city, audio);
    v.state.npc = true;
    v.state.parked = parked;
    v.state.cruiseSpeed = range(rand, 9, 14);
    v.state.axis = Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z';
    v.state.dir = Math.abs(Math.sin(heading)) > 0.5
      ? (Math.sin(heading) > 0 ? 1 : -1)
      : (Math.cos(heading) > 0 ? 1 : -1);
    scene.add(v.state.mesh);
    cars.push(v.state);
    return v.state;
  }

  for (let i = 0; i < 12; i += 1) spawnCar(false);
  for (let i = 0; i < 7; i += 1) spawnCar(true);

  // Is another car (or the player's) right in front of this one?
  function blockedAhead(car, playerCar) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const inFront = (ox, oz) => {
      const dx = ox - car.x;
      const dz = oz - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      return along > 0 && along < 9 && side < 2.5;
    };
    for (const other of cars) {
      if (other !== car && inFront(other.x, other.z)) return true;
    }
    if (playerCar && playerCar !== car && inFront(playerCar.x, playerCar.z)) return true;
    return false;
  }

  function update(dt, playerPos, playerCar) {
    for (const car of cars) {
      if (car.wrecked || car.parked || car.stolen || car.cruiseSpeed === undefined) continue;
      const target = blockedAhead(car, playerCar) ? 0 : car.cruiseSpeed;
      car.speed += clamp(target - car.speed, -14 * dt, 10 * dt);
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const nx = car.x + fx * car.speed * dt;
      const nz = car.z + fz * car.speed * dt;
      // At the city edge or a random intersection, turn 90 degrees.
      const atEdge = Math.abs(nx) > HALF - 6 || Math.abs(nz) > HALF - 6;
      const wrappedX = ((nx % PITCH) + PITCH) % PITCH;
      const wrappedZ = ((nz % PITCH) + PITCH) % PITCH;
      const atCross = wrappedX < 1.2 || wrappedZ < 1.2;
      if ((atEdge || (atCross && rand() < 0.004)) && car.speed > 2) {
        const turn = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.heading += turn;
        car.x = clamp(car.x, -HALF + 8, HALF - 8);
        car.z = clamp(car.z, -HALF + 8, HALF - 8);
      } else if (!city.isBlocked(nx, nz, 1.6)) {
        car.x = nx;
        car.z = nz;
      } else {
        car.heading += Math.PI / 2;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
    }
  }

  function nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.wrecked) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  return { cars, update, nearestCar, spawnCar };
}
