// Coral Bay Heist — the game itself: boot, loop, camera, the player
// on foot and behind the wheel, combat, police, missions, saving.
// It is the only file that knows about everything; every other
// module owns one job and is called from here.

import * as THREE from 'three';
import { WORLD, PALETTE, PLAYER, CAR, MISSIONS } from './config.js';
import { Rng } from './random.js';
import { buildCity, hitsCollider } from './city.js';
import { makeCarMesh, createCar, driveStep, updateTraffic, loopRoute } from './vehicles.js';
import { makePedMesh, updatePed, spawnPeds } from './pedestrians.js';
import { Wanted, createEnforcer, updateEnforcer, maintainPolice, updatePolice, makeTracer, updateTracers } from './police.js';
import { MissionRunner } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'coral-bay-heist-save-v1';
const TRAFFIC_COLORS = [0xc94f4f, 0x4f7fb8, 0xd9a441, 0x7fb069, 0x8a8f98, 0xe8e4da, 0x5b6abf];

class Game {
  constructor() {
    this.rng = new Rng(WORLD.seed);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 130, 430);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
    sun.position.set(120, 180, 60);
    this.scene.add(sun);

    this.city = buildCity(this.scene, this.rng);
    this.colliders = this.city.colliders;
    this.hud = new Hud();
    this.input = new Input();
    this.sound = new SoundBank();
    this.wanted = new Wanted();
    this.missions = new MissionRunner(this.scene);

    this.state = 'title';
    this.time = 0;
    this.cash = PLAYER.startCash;
    this.missionIndex = 0;
    this.pendingMission = null;
    this.autoDrive = null;
    this.cruiser = null;
    this.enforcers = [];
    this.tracers = [];
    this.policeCars = [];
    this.trafficCars = [];
    this.parkedCars = [];
    this.loadSave();

    // The player on foot: a teal-jacketed figure, built from the same
    // parts as any pedestrian, so the city stays consistent.
    const playerRng = new Rng(7);
    this.player = {
      mesh: makePedMesh(playerRng),
      x: this.city.spawn.x,
      z: this.city.spawn.z,
      heading: this.city.spawn.heading,
      health: PLAYER.health,
      inCar: false,
      car: null,
      speed: 0,
    };
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.scene.add(this.player.mesh);

    // Traffic: ten cars looping the streets.
    for (let i = 0; i < 10; i += 1) {
      const route = loopRoute(this.city.intersections(), this.rng);
      const car = createCar(this.rng.pick(TRAFFIC_COLORS), route[0].x, route[0].z, 0, { kind: 'traffic' });
      car.route = route;
      this.scene.add(car.mesh);
      this.trafficCars.push(car);
    }
    this.peds = spawnPeds(this.scene, this.rng, this.city.streets, 26);

    this.ctx = this.makeMissionCtx();
    this.bindScreens();
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health);
    this.hud.setWanted(0);
    this.hud.setObjective('Press Start — take the wheel, Coral Bay is waiting.');
    this.hud.showStart();

    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      applyShot(this, shot);
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---- save / load -------------------------------------------------
  loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      if (typeof save.cash === 'number') this.cash = save.cash;
      if (typeof save.mission === 'number') this.missionIndex = Math.max(0, Math.min(MISSIONS.length - 1, save.mission));
    } catch {
      // A corrupt save is a fresh start, not a crash.
    }
  }

  save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: this.cash, mission: this.missionIndex }));
    } catch {
      // Storage full or blocked: the game goes on unsaved.
    }
  }

  // ---- mission plumbing ---------------------------------------------
  makeMissionCtx() {
    return {
      playerPos: () => ({ x: this.player.x, z: this.player.z }),
      addCash: (n) => {
        this.cash += n;
        this.hud.setCash(this.cash);
        this.sound.jingle();
        this.save();
      },
      setWanted: (n) => this.wanted.set(n),
      wantedLevel: () => this.wanted.level,
      isDrivingCruiser: () => this.player.inCar && this.player.car === this.cruiser,
      spawnCruiser: (spot) => {
        if (this.cruiser) {
          this.cruiser.x = spot.x;
          this.cruiser.z = spot.z;
          this.cruiser.mesh.position.set(spot.x, 0, spot.z);
          return;
        }
        this.cruiser = createCar(PALETTE.cruiser, spot.x, spot.z, Math.PI / 2, { cruiser: true, kind: 'cruiser' });
        this.scene.add(this.cruiser.mesh);
      },
      spawnEnforcers: (n, at) => {
        for (let i = 0; i < n; i += 1) {
          const angle = (i / n) * Math.PI * 2;
          const foe = createEnforcer(at.x + Math.sin(angle) * 9, at.z + Math.cos(angle) * 9);
          this.scene.add(foe.mesh);
          this.enforcers.push(foe);
        }
      },
      enforcersLeft: () => this.enforcers.filter((e) => e.alive).length,
      setObjective: (t) => this.hud.setObjective(t),
      showLine: (t) => this.hud.showLine(t),
      showToast: (t) => this.hud.showToast(t),
      onMissionComplete: (next) => {
        this.missionIndex = next;
        this.save();
        this.pendingMission = { index: next, timer: 4.5 };
      },
      onGameWon: () => {
        this.state = 'won';
        this.hud.showWin(this.cash);
        this.save();
      },
    };
  }

  bindScreens() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.sound.ensure();
      this.startGame({ mission: this.missionIndex });
    });
    document.getElementById('btn-win-again').addEventListener('click', () => {
      this.resetRun();
      this.startGame({ mission: 0 });
    });
    document.getElementById('btn-over-retry').addEventListener('click', () => {
      this.resetRun();
      this.startGame({ mission: this.missionIndex });
    });
  }

  resetRun() {
    this.player.health = PLAYER.health;
    this.wanted.clear();
    for (const car of this.policeCars) this.scene.remove(car.mesh);
    this.policeCars = [];
    for (const foe of this.enforcers) this.scene.remove(foe.mesh);
    this.enforcers = [];
    this.player.inCar = false;
    this.player.car = null;
    this.player.x = this.city.spawn.x;
    this.player.z = this.city.spawn.z;
    this.player.heading = this.city.spawn.heading;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.rotation.y = this.player.heading;
    this.hud.setHealth(this.player.health);
  }

  startGame(opts = {}) {
    this.hud.hideStart();
    document.getElementById('screen-win').style.display = 'none';
    document.getElementById('screen-over').style.display = 'none';
    this.state = 'playing';
    this.sound.ensure();
    if (opts.mission !== null && opts.mission !== undefined) {
      this.missions.start(opts.mission, this.ctx);
    } else {
      this.hud.setObjective('Free roam — explore Coral Bay. Steal a car with E.');
    }
  }

  // A police car placed by hand, for the chase screenshot: it joins
  // the regular police list and chases like any other.
  spawnPoliceCar(x, z, heading) {
    const car = createCar(0xf2f2f2, x, z, heading, { police: true, kind: 'police' });
    this.scene.add(car.mesh);
    this.policeCars.push(car);
    return car;
  }

  minimapView() {
    return {
      streets: this.city.streets,
      colliders: this.colliders,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      police: this.policeCars.map((c) => ({ x: c.x, z: c.z })),
      marker: this.missions.markerPos,
      cruiser: this.cruiser ? { x: this.cruiser.x, z: this.cruiser.z } : null,
    };
  }

  // ---- test and screenshot hooks ------------------------------------
  spawnPlayerCar(color, x, z, heading) {
    const car = createCar(color, x, z, heading, { kind: 'player' });
    this.scene.add(car.mesh);
    return car;
  }

  enterCar(car) {
    this.player.inCar = true;
    this.player.car = car;
    this.player.mesh.visible = false;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    // A car the player takes leaves the traffic flow and parks in
    // the player's own list, so it can be entered again later.
    if (car.kind === 'traffic') {
      const i = this.trafficCars.indexOf(car);
      if (i !== -1) this.trafficCars.splice(i, 1);
      if (!this.parkedCars.includes(car)) this.parkedCars.push(car);
    }
    // Stealing a stranger's car is a crime; the Cruiser is worse.
    if (car.kind === 'traffic') this.wanted.add(1);
    if (car === this.cruiser) this.wanted.set(2);
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    const side = { x: car.x + Math.cos(car.heading) * 2.4, z: car.z - Math.sin(car.heading) * 2.4 };
    this.player.inCar = false;
    this.player.car = null;
    this.player.x = side.x;
    this.player.z = side.z;
    this.player.heading = car.heading;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
  }

  teleportPlayer(x, z, heading) {
    if (this.player.inCar) this.exitCar();
    this.player.x = x;
    this.player.z = z;
    this.player.heading = heading;
    this.player.mesh.position.set(x, 0, z);
    this.player.mesh.rotation.y = heading;
  }

  setAutoDrive(throttle, steer) {
    this.autoDrive = { throttle, steer };
  }

  setWanted(n) {
    this.wanted.set(n);
  }

  // ---- combat ---------------------------------------------------------
  playerShoot() {
    if (this.player.inCar) return;
    const px = this.player.x;
    const pz = this.player.z;
    let best = null;
    let bestScore = Infinity;
    for (const foe of this.enforcers) {
      if (!foe.alive) continue;
      const dx = foe.x - px;
      const dz = foe.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 34) continue;
      const aim = Math.atan2(dx, dz);
      let diff = aim - this.player.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const score = dist + Math.abs(diff) * 12;
      if (Math.abs(diff) < 0.7 && score < bestScore) {
        best = foe;
        bestScore = score;
      }
    }
    this.sound.gunshot();
    if (best) {
      this.tracers.push(makeTracer(this.scene, { x: px, y: 1.3, z: pz }, { x: best.x, y: 1.2, z: best.z }));
      best.health -= 1;
      if (best.health <= 0) {
        best.alive = false;
        best.mesh.rotation.x = Math.PI / 2;
        best.mesh.position.y = 0.3;
        this.hud.showToast('Enforcer down.');
      }
    } else {
      const fx = px + Math.sin(this.player.heading) * 26;
      const fz = pz + Math.cos(this.player.heading) * 26;
      this.tracers.push(makeTracer(this.scene, { x: px, y: 1.3, z: pz }, { x: fx, y: 1.2, z: fz }));
    }
  }

  // ---- per-frame ------------------------------------------------------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.state === 'paused') {
      if (this.input.pressed('Escape') || this.input.pressed('KeyP')) {
        this.state = 'playing';
        this.hud.showPause(false);
      }
      this.input.endFrame();
    } else if (this.state === 'title') {
      this.titleFrame(dt);
    } else if (this.state === 'playing') {
      this.playFrame(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  titleFrame(dt) {
    // Slow orbit over the city while the start screen waits.
    const a = this.time * 0.06;
    this.camera.position.set(Math.sin(a) * 130, 62, Math.cos(a) * 130);
    this.camera.lookAt(0, 4, 0);
    this.ambientFrame(dt);
    this.hud.drawMinimap(this.minimapView());
  }

  ambientFrame(dt) {
    // Traffic and pedestrians keep the city alive in every state.
    for (const car of this.trafficCars) {
      updateTraffic(car, dt, this.colliders, this.trafficCars);
    }
    for (const ped of this.peds) {
      const nearCar = this.player.inCar && Math.hypot(ped.x - this.player.x, ped.z - this.player.z) < 7;
      updatePed(ped, dt, this.colliders, this.player.x, this.player.z, nearCar);
    }
  }

  playFrame(dt) {
    // Pause and mute.
    if (this.input.pressed('Escape') || this.input.pressed('KeyP')) {
      this.state = 'paused';
      this.hud.showPause(true);
    }
    if (this.input.pressed('KeyM')) {
      this.sound.setMuted(!this.sound.muted);
      this.hud.showToast(this.sound.muted ? 'Sound off.' : 'Sound on.');
    }

    // Pending next mission.
    if (this.pendingMission) {
      this.pendingMission.timer -= dt;
      if (this.pendingMission.timer <= 0) {
        const next = this.pendingMission.index;
        this.pendingMission = null;
        this.missions.start(next, this.ctx);
      }
    }

    // Movement: on foot or behind the wheel.
    if (this.player.inCar && this.player.car) {
      const controls = this.autoDrive || this.input.driveControls();
      const brake = !this.autoDrive && controls.brake;
      driveStep(this.player.car, brake ? 0 : controls.throttle, controls.steer, dt, this.colliders);
      if (brake && Math.abs(this.player.car.speed) > 0.5) this.player.car.speed -= Math.sign(this.player.car.speed) * 18 * dt;
      this.player.x = this.player.car.x;
      this.player.z = this.player.car.z;
      this.player.heading = this.player.car.heading;
      if (this.input.pressed('KeyE')) this.exitCar();
    } else {
      const walk = this.input.walkControls();
      const speed = walk.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const camHeading = this.player.heading;
      let mx = 0;
      let mz = 0;
      if (walk.forward !== 0 || walk.strafe !== 0) {
        const fx = Math.sin(camHeading);
        const fz = Math.cos(camHeading);
        const rx = Math.cos(camHeading);
        const rz = -Math.sin(camHeading);
        mx = fx * walk.forward + rx * walk.strafe;
        mz = fz * walk.forward + rz * walk.strafe;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len;
        mz /= len;
        const targetHeading = Math.atan2(mx, mz);
        let diff = targetHeading - this.player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.player.heading += diff * Math.min(1, dt * 10);
        const nx = this.player.x + mx * speed * dt;
        if (!hitsCollider(this.colliders, nx, this.player.z, PLAYER.radius) && Math.abs(nx) < 176) this.player.x = nx;
        const nz = this.player.z + mz * speed * dt;
        if (!hitsCollider(this.colliders, this.player.x, nz, PLAYER.radius) && Math.abs(nz) < 176) this.player.z = nz;
      }
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.player.mesh.rotation.y = this.player.heading;
      if (this.input.pressed('KeyE')) {
        const car = this.nearestCar();
        if (car) this.enterCar(car);
      }
      if (this.input.pressed('KeyF') || this.input.clicked) this.playerShoot();
    }

    this.ambientFrame(dt);

    // Police and wanted.
    maintainPolice(this.policeCars, this.scene, this.wanted, this.player.x, this.player.z, this.rng, this.colliders);
    const nearestCop = updatePolice(this.policeCars, dt, this.colliders, this.player.x, this.player.z, this.time);
    this.wanted.update(dt, nearestCop);
    this.sound.setSiren(this.wanted.level > 0);

    // Enforcers shoot back.
    for (const foe of this.enforcers) {
      if (!foe.alive) continue;
      const damage = updateEnforcer(foe, dt, this.player.x, this.player.z, (shooter, hit) => {
        this.sound.gunshot();
        this.tracers.push(makeTracer(this.scene, { x: shooter.x, y: 1.4, z: shooter.z }, { x: this.player.x, y: 1.2, z: this.player.z }));
      });
      if (damage > 0) {
        this.player.health -= damage;
        this.hud.setHealth(this.player.health);
        if (this.player.health <= 0) {
          this.player.health = 0;
          this.state = 'over';
          this.hud.showGameOver();
        }
      }
    }
    updateTracers(this.tracers, this.scene, dt);

    // Missions.
    this.missions.update(dt, this.ctx, this.time);

    // Camera: chase behind the player, a little higher in a car.
    const dist = this.player.inCar ? 12 : 8.5;
    const height = this.player.inCar ? 5.2 : 4.4;
    const fx = Math.sin(this.player.heading);
    const fz = Math.cos(this.player.heading);
    const wantX = this.player.x - fx * dist;
    const wantZ = this.player.z - fz * dist;
    const k = 1 - Math.exp(-5 * dt);
    this.camera.position.x += (wantX - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (wantZ - this.camera.position.z) * k;
    this.camera.lookAt(this.player.x + fx * 8, 1.6, this.player.z + fz * 8);

    // HUD and sound.
    this.hud.tick(dt);
    this.hud.setWanted(this.wanted.level);
    this.hud.drawMinimap(this.minimapView());
    const speed = this.player.inCar && this.player.car ? Math.abs(this.player.car.speed) : 0;
    this.sound.setEngine(speed, this.player.inCar);

    this.input.endFrame();
  }

  nearestCar() {
    let best = null;
    let bestDist = CAR.enterRange;
    const pool = [...this.trafficCars, ...this.parkedCars];
    if (this.cruiser) pool.push(this.cruiser);
    for (const car of pool) {
      const d = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (d < bestDist) {
        best = car;
        bestDist = d;
      }
    }
    return best;
  }
}

const game = new Game();

// A handle for playtests and the capture tool: state, not code.
window.__game = {
  state: () => game.state,
  cash: () => game.cash,
  health: () => game.player.health,
  wanted: () => game.wanted.level,
  player: () => ({ x: game.player.x, z: game.player.z, heading: game.player.heading, inCar: game.player.inCar, speed: game.player.inCar && game.player.car ? game.player.car.speed : 0 }),
  mission: () => (game.missions.def ? game.missions.def.id : null),
  enforcersLeft: () => game.enforcers.filter((e) => e.alive).length,
  enforcers: () => game.enforcers.map((e) => ({ x: e.x, z: e.z, alive: e.alive, health: e.health })),
  startGame: (mission) => game.startGame({ mission }),
  teleport: (x, z, heading) => game.teleportPlayer(x, z, heading),
};

export { game };
