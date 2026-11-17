// Keyboard + mouse input. Movement keys are held state; action keys (E, F, P, M,
// click, Space) are queued as one-shot flags and taken once per frame, so a press
// between two frames is never lost and never counted twice.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MUTE = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  let forward = false;
  let back = false;
  let left = false;
  let right = false;
  let run = false;
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let dragDX = 0;
  let dragDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code)) forward = true;
    else if (BACK.has(event.code)) back = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (RUN.has(event.code)) run = true;
    else if (event.code === 'KeyE') { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (event.code === 'KeyF') { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (event.code === 'KeyP' || event.code === 'Escape') { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'Space' || event.code === 'Enter') { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else return;
    if (event.code !== 'KeyM') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (FORWARD.has(event.code)) forward = false;
    else if (BACK.has(event.code)) back = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (RUN.has(event.code)) run = false;
  });
  window.addEventListener('blur', () => {
    forward = back = left = right = run = false;
    dragging = false;
    mouseDown = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (dragging) {
      dragDX += event.clientX - lastX;
      dragDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  window.addEventListener('pointerup', () => {
    // A click without a drag is a gunshot; a drag is a camera move.
    if (mouseDown && Math.abs(dragDX) + Math.abs(dragDY) < 6) actions |= ACTION_CONFIRM;
    mouseDown = false;
    dragging = false;
  });

  return {
    // -1..1 forward, -1..1 strafe (right positive).
    move() {
      return {
        f: (forward ? 1 : 0) - (back ? 1 : 0),
        s: (right ? 1 : 0) - (left ? 1 : 0),
        run,
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeDrag() {
      const d = { x: dragDX, y: dragDY };
      dragDX = 0;
      dragDY = 0;
      return d;
    },
    mouse() { return { x: mouseX, y: mouseY }; },
    isMouseDown() { return mouseDown; },
  };
}
