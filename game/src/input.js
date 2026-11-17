// Keyboard + mouse input.
//
// Movement keys are held state; action keys (E, F, P, M, click, Space) are
// queued as one-shot flags and taken once per frame, so a press between two
// frames is never lost and never counted twice. A pointer press that moves
// less than a few pixels is a click (shoot); a longer press is a camera drag.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MUTE = 16;

const CLICK_DRAG_LIMIT = 6; // pixels: below this a pointer press is a click

// Held keys: which state each code sets while it is down.
const HELD_KEYS = [
  { codes: ['KeyW', 'ArrowUp'], key: 'forward' },
  { codes: ['KeyS', 'ArrowDown'], key: 'back' },
  { codes: ['KeyA', 'ArrowLeft'], key: 'left' },
  { codes: ['KeyD', 'ArrowRight'], key: 'right' },
  { codes: ['ShiftLeft', 'ShiftRight'], key: 'run' },
];

// One-shot keys: which action flag each code raises (once per press).
const ACTION_KEYS = [
  { codes: ['KeyE'], flag: ACTION_ENTER },
  { codes: ['KeyF'], flag: ACTION_PUNCH },
  { codes: ['KeyP', 'Escape'], flag: ACTION_PAUSE },
  { codes: ['KeyM'], flag: ACTION_MUTE },
  { codes: ['Space', 'Enter'], flag: ACTION_CONFIRM },
];

function lookup(table, code) {
  for (const entry of table) {
    if (entry.codes.includes(code)) return entry;
  }
  return null;
}

export function createInput(canvas) {
  const held = { forward: false, back: false, left: false, right: false, run: false };
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
    const heldKey = lookup(HELD_KEYS, event.code);
    if (heldKey) {
      held[heldKey.key] = true;
    } else {
      const actionKey = lookup(ACTION_KEYS, event.code);
      if (!actionKey) return;
      if (!event.repeat) actions |= actionKey.flag;
    }
    // Mute must not swallow the browser's own shortcut handling.
    if (event.code !== 'KeyM') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const heldKey = lookup(HELD_KEYS, event.code);
    if (heldKey) held[heldKey.key] = false;
  });
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
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
    // A press without a drag is a gunshot; a drag is a camera move.
    if (mouseDown && Math.abs(dragDX) + Math.abs(dragDY) < CLICK_DRAG_LIMIT) {
      actions |= ACTION_CONFIRM;
    }
    mouseDown = false;
    dragging = false;
  });

  return {
    // -1..1 forward, -1..1 strafe (right positive).
    move() {
      return {
        f: (held.forward ? 1 : 0) - (held.back ? 1 : 0),
        s: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        run: held.run,
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
