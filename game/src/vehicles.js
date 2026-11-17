// Coral Bay Heist — cars: meshes, driving physics and traffic.
// One physics step serves the player, the traffic and the police,
// so every car in the city answers the road the same way.

import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';
import { hitsCollider } from './city.js';

const BODY = { w: 2.0, h: 0.72, l: 4.3 };
const WHEEL_R = 0.42;

function wheelMesh(x, z) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.34, 10),
    new THREE.MeshLambertMaterial({ color: 0x14161a }),
  );
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, WHEEL_R, z);
  return wheel;
}

// A car is a body, a cabin, four wheels and lights. Police cars get a
// light bar; the Cruiser gets a spoiler and gold trim.
export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1d2b33 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(BODY.w, BODY.h, BODY.l), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.1), glass);
  cabin.position.set(0, 1.22, -0.25);
  group.add(cabin);
  for (const sx of [-0.95, 0.95]) {
    for (const sz of [-1.45, 1.45]) group.add(wheelMesh(sx, sz));
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), headMat);
    head.position.set(sx, 0.66, BODY.l / 2 + 0.02);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), tailMat);
    tail.position.set(sx, 0.66, -BODY.l / 2 - 0.02);
    group.add(tail);
  }
  if (opts.police) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barBase.position.set(0, 1.6, -0.25);
    group.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.72, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.32, 1.72, -0.25);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  if (opts.cruiser) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.4), new THREE.MeshLambertMaterial({ color: PALETTE.neonGold }));
    spoiler.position.set(0, 1.05, -BODY.l / 2 + 0.15);
    group.add(spoiler);
  }
  return group;
}

export function createCar(color, x, z, heading, opts = {}) {
  const mesh = makeCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    kind: opts.kind || 'traffic',
    color,
    route: null,
    routeIndex: 0,
    waitTimer: 0,
  };
}

// Move a car one step. Throttle is -1..1, steer is -1..1, and the
// collision is axis-separated, so a car slides along a wall instead
// of sticking to it. Returns true when the car actually moved.
export function driveStep(car, throttle, steer, dt, colliders) {
  // Throttle picks a target speed and the car eases toward it, so a
  // half throttle really does cruise at half speed.
  const targetSpeed = throttle * (throttle >= 0 ? CAR.maxSpeed : CAR.maxReverse);
  if (throttle !== 0) {
    const rate = throttle >= 0 ? CAR.accel : CAR.reverseAccel;
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + rate * dt);
    else if (car.speed > targetSpeed) car.speed = Math.max(targetSpeed, car.speed - CAR.brake * dt);
  } else {
    car.speed -= car.speed * CAR.drag * dt * 2;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  const steerAmount = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.25) * Math.sign(car.speed || 1);
  car.heading += steerAmount;
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  const m = 1.25;
  let moved = false;
  const nx = car.x + dx;
  if (nx > -176 && nx < 176 && !hitsCollider(colliders, nx, car.z, m)) {
    car.x = nx;
    moved = true;
  } else {
    car.speed *= 0.55;
  }
  const nz = car.z + dz;
  if (nz > -176 && nz < 176 && !hitsCollider(colliders, car.x, nz, m)) {
    car.z = nz;
    moved = true;
  } else {
    car.speed *= 0.55;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  return moved;
}

function angleToward(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Traffic follows a loop of street intersections, steering toward
// the next one and easing off when another car is right ahead.
export function updateTraffic(car, dt, colliders, others) {
  if (!car.route || car.route.length === 0) return;
  const target = car.route[car.routeIndex];
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 5) {
    car.routeIndex = (car.routeIndex + 1) % car.route.length;
    return;
  }
  let blocked = false;
  for (const other of others) {
    if (other === car) continue;
    const ox = other.x - car.x;
    const oz = other.z - car.z;
    const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
    const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 9 && side < 2.4) {
      blocked = true;
      break;
    }
  }
  const desired = Math.atan2(dx, dz);
  const turn = Math.max(-1, Math.min(1, angleToward(car.heading, desired) * 1.6));
  driveStep(car, blocked ? 0 : 0.45, turn, dt, colliders);
}

// A police car steers straight at the player and rams. It runs at
// four-fifths throttle, so a player who floors it can pull away and
// hide — that is the only way the heat ever comes off.
export function updatePoliceCar(car, dt, colliders, playerX, playerZ, time) {
  const dx = playerX - car.x;
  const dz = playerZ - car.z;
  const desired = Math.atan2(dx, dz);
  const turn = Math.max(-1, Math.min(1, angleToward(car.heading, desired) * 2.2));
  driveStep(car, 0.8, turn, dt, colliders);
  const beat = Math.floor(time * 4) % 2 === 0;
  if (car.mesh.userData.lightRed) {
    car.mesh.userData.lightRed.material.color.setHex(beat ? 0xff2222 : 0x551111);
    car.mesh.userData.lightBlue.material.color.setHex(beat ? 0x113366 : 0x2266ff);
  }
}

// A rectangular loop of intersections along two streets, for traffic.
export function loopRoute(intersections, rng) {
  const xs = [-108, -54, 0, 54, 108];
  const zs = [-108, -54, 0, 54, 108];
  const x0 = rng.pick(xs);
  const x1 = rng.pick(xs.filter((v) => v !== x0));
  const z0 = rng.pick(zs);
  const z1 = rng.pick(zs.filter((v) => v !== z0));
  return [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ];
}
