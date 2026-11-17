// Police: foot officers and black-and-white interceptors that chase the player
// while wanted, ram the player's car, and arrest on foot after a hold.
// Wanted stars fall again after the player stays out of sight for a while.
import * as THREE from 'three';
import { POLICE, WANTED } from './config.js';
import { clamp, distance2D, range } from './random.js';
import { createCarMesh } from './vehicles.js';
import { createPedMesh } from './pedestrians.js';

const POLICE_TYPE = { name: 'Interceptor', color: 0x1a1a2e, speed: 1.05, len: 4.5, wid: 2.0, kind: 'sedan' };

export function createPolice(scene, city, rand, audio) {
  const cops = [];        // foot officers
  const cars = [];        // police cars
  let wanted = 0;
  let hiddenTimer = 0;    // seconds since any police last saw the player
  let arrestProgress = 0;

  function addWanted(amount, reason) {
    const before = wanted;
    wanted = clamp(wanted + amount, 0, WANTED.max);
    if (wanted > before) hiddenTimer = 0;
    return wanted;
  }

  function spawnCarNear(x, z) {
    const type = POLICE_TYPE;
    const mesh = createCarMesh(type, 0xf8f9fa);
    // Black doors, white body: add a dark stripe box over the body.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x11131a }));
    stripe.position.y = 0.62;
    mesh.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.62, 0);
    mesh.add(bar);
    // Spawn on a street 40-60 units away, facing the player.
    const a = rand() * Math.PI * 2;
    const sx = clamp(x + Math.sin(a) * 50, -110, 110);
    const sz = clamp(z + Math.cos(a) * 50, -110, 110);
    const heading = Math.atan2(x - sx, z - sz);
    mesh.position.set(sx, 0, sz);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh, bar, x: sx, z: sz, heading, speed: 0,
      damage: 0, flash: 0, siren: true, wrecked: false,
    };
    cars.push(car);
    return car;
  }

  function spawnFootCop(x, z) {
    const mesh = createPedMesh(0x1b2a4a, 0xe0ac69, 1.05);
    mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0x14213d });
    const a = rand() * Math.PI * 2;
    const sx = clamp(x + Math.sin(a) * 30, -110, 110);
    const sz = clamp(z + Math.cos(a) * 30, -110, 110);
    mesh.position.set(sx, 0, sz);
    scene.add(mesh);
    const cop = { mesh, x: sx, z: sz, heading: 0, speed: 5.2, arrest: 0 };
    cops.push(cop);
    return cop;
  }

  function ensureForce(playerX, playerZ) {
    // Desired force scales with stars: 1-2 stars = 1 car, 3 = 2 cars + 1 cop,
    // 4-5 = 3 cars + 2 cops.
    const wantCars = wanted === 0 ? 0 : wanted <= 2 ? 1 : wanted === 3 ? 2 : 3;
    const wantCops = wanted >= 3 ? (wanted >= 4 ? 2 : 1) : 0;
    while (cars.filter((c) => !c.wrecked).length < wantCars) spawnCarNear(playerX, playerZ);
    while (cops.length < wantCops) spawnFootCop(playerX, playerZ);
  }

  function update(dt, player, playerCar, onArrested, onRam) {
    const px = player.x;
    const pz = player.z;
    ensureForce(px, pz);
    let seen = false;
    // Police cars chase, ram, and spin out when wrecked.
    for (const car of cars) {
      if (car.wrecked) continue;
      const d = distance2D(px, pz, car.x, car.z);
      if (d < POLICE.sightRange) seen = true;
      const want = Math.atan2(px - car.x, pz - car.z);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += clamp(diff, -1.8 * dt, 1.8 * dt);
      const targetSpeed = d > 6 ? POLICE.chaseSpeed : 16;
      car.speed += clamp(targetSpeed - car.speed, -22 * dt, 16 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      if (!city.isBlocked(nx, nz, 1.6)) { car.x = nx; car.z = nz; }
      else { car.heading += Math.PI / 3; car.speed *= 0.5; }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.flash += dt;
      car.bar.material.color.setHex(Math.floor(car.flash * 3) % 2 === 0 ? 0xff2222 : 0x2266ff);
      // Ram the player's car.
      if (playerCar && d < 4.2 && Math.abs(car.speed) > 8) {
        playerCar.damage = Math.min(100, playerCar.damage + POLICE.ramDamage);
        car.speed *= 0.4;
        if (onRam) onRam();
        city.sparks(car.x, 1, car.z);
        if (audio) audio.crash();
      }
      // A wrecked police car (rammed hard) stops chasing.
      if (car.damage > 80) {
        car.wrecked = true;
        car.mesh.rotation.z = 0.12;
        city.smoke(car.x, 1.4, car.z);
      }
    }
    // Foot officers run at the player and hold them to arrest.
    for (const cop of cops) {
      const d = distance2D(px, pz, cop.x, cop.z);
      if (d < POLICE.sightRange) seen = true;
      if (playerCar) {
        // Officers cannot catch a car: they jog after it and give up close in.
        cop.arrest = 0;
      } else if (d < POLICE.arrestRange) {
        cop.arrest += dt;
        arrestProgress = cop.arrest / POLICE.arrestTime;
        if (cop.arrest >= POLICE.arrestTime && onArrested) onArrested();
      } else {
        cop.arrest = 0;
        arrestProgress = 0;
      }
      if (d > 1.2 && !playerCar) {
        const want = Math.atan2(px - cop.x, pz - cop.z);
        cop.heading = want;
        const nx = cop.x + Math.sin(want) * cop.speed * dt;
        const nz = cop.z + Math.cos(want) * cop.speed * dt;
        if (!city.isBlocked(nx, nz, 0.5)) { cop.x = nx; cop.z = nz; }
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      cop.mesh.userData.armL.rotation.x = Math.sin(performance.now() / 130) * 0.7;
      cop.mesh.userData.armR.rotation.x = -Math.sin(performance.now() / 130) * 0.7;
    }
    // Wanted decay: stay unseen and the heat cools off.
    if (wanted > 0) {
      if (seen) hiddenTimer = 0;
      else {
        hiddenTimer += dt;
        if (hiddenTimer > POLICE.decayDelay) {
          wanted -= 1;
          hiddenTimer = 0;
        }
      }
    }
    if (audio) audio.siren(wanted > 0 && cars.some((c) => !c.wrecked));
    return { arrestProgress };
  }

  function clearAll() {
    for (const car of cars) scene.remove(car.mesh);
    for (const cop of cops) scene.remove(cop.mesh);
    cars.length = 0;
    cops.length = 0;
    wanted = 0;
    hiddenTimer = 0;
    arrestProgress = 0;
    if (audio) audio.siren(false);
  }

  function damageNearestPoliceCar(x, z, amount) {
    let best = null;
    let bestD = 60;
    for (const car of cars) {
      if (car.wrecked) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (best) best.damage += amount;
    return best;
  }

  return {
    get wanted() { return wanted; },
    set wanted(v) { wanted = clamp(v, 0, WANTED.max); },
    addWanted, update, clearAll, damageNearestPoliceCar,
    get cars() { return cars; },
    get cops() { return cops; },
  };
}
