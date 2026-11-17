// Coral Bay Heist — keyboard and mouse input.
// Keys are tracked by code, so WASD and the arrows both work, and
// `pressed` gives one-shot actions (enter a car, pause, shoot).

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedSet = new Set();
    this.clickX = 0;
    this.clickY = 0;
    this.clicked = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedSet.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('mousedown', (e) => {
      this.clickX = e.clientX;
      this.clickY = e.clientY;
      this.clicked = true;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  pressed(code) {
    if (this.pressedSet.has(code)) {
      this.pressedSet.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressedSet.clear();
    this.clicked = false;
  }

  // Driving controls: throttle -1..1, steer -1..1, brake.
  driveControls() {
    let throttle = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) throttle += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) throttle -= 1;
    let steer = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) steer -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) steer += 1;
    return { throttle, steer, brake: this.down('Space') };
  }

  // On-foot movement, relative to the camera heading.
  walkControls() {
    let forward = 0;
    let strafe = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) forward += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) forward -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) strafe -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) strafe += 1;
    return { forward, strafe, run: this.down('ShiftLeft') || this.down('ShiftRight') };
  }
}
