// SOLMAR HEAT — input: keyboard, mouse and touch buttons for landscape phones.

export function makeInput() {
  return {
    up: false, down: false, left: false, right: false,
    run: false, enter: false, punch: false,
    mouseDown: false, aim: false,
    mouseX: 0, mouseY: 0, mouseWorldX: 0, mouseWorldY: 0,
    pausePressed: false, mutePressed: false,
  };
}

export function attachInput(input, canvas, callbacks) {
  const keys = {};
  const down = (code) => {
    if (code === 'KeyW' || code === 'ArrowUp') input.up = true;
    if (code === 'KeyS' || code === 'ArrowDown') input.down = true;
    if (code === 'KeyA' || code === 'ArrowLeft') input.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') input.right = true;
    if (code === 'ShiftLeft' || code === 'ShiftRight') input.run = true;
    if (code === 'KeyE') input.enter = true;
    if (code === 'KeyF') input.punch = true;
    if (code === 'Space') { input.down = true; }
    if (code === 'KeyP' || code === 'Escape') { input.pausePressed = true; if (callbacks.onPause) callbacks.onPause(); }
    if (code === 'KeyM') { input.mutePressed = true; if (callbacks.onMute) callbacks.onMute(); }
    if (code === 'KeyH') { if (callbacks.onHorn) callbacks.onHorn(); }
  };
  const up = (code) => {
    if (code === 'KeyW' || code === 'ArrowUp') input.up = false;
    if (code === 'KeyS' || code === 'ArrowDown') input.down = false;
    if (code === 'KeyA' || code === 'ArrowLeft') input.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') input.right = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') input.run = false;
    if (code === 'Space') input.down = false;
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) down(e.code);
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    up(e.code);
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
    input.aim = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch controls for phones in landscape: d-pad left, actions right.
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    const touch = document.getElementById('touch');
    if (touch) {
      touch.style.display = 'block';
      const bind = (id, on, off) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
        el.addEventListener('pointerup', (e) => { e.preventDefault(); if (off) off(); });
        el.addEventListener('pointerleave', () => { if (off) off(); });
        el.addEventListener('pointercancel', () => { if (off) off(); });
      };
      bind('t-up', () => { input.up = true; }, () => { input.up = false; });
      bind('t-down', () => { input.down = true; }, () => { input.down = false; });
      bind('t-left', () => { input.left = true; }, () => { input.left = false; });
      bind('t-right', () => { input.right = true; }, () => { input.right = false; });
      bind('t-run', () => { input.run = true; }, () => { input.run = false; });
      bind('t-enter', () => { input.enter = true; });
      bind('t-punch', () => { input.punch = true; });
      bind('t-shoot', () => { input.mouseDown = true; input.aim = true; }, () => { input.mouseDown = false; });
    }
  }
}

export function updateMouseWorld(input, camera, canvasW, canvasH) {
  const wx = (input.mouseX - canvasW / 2) / camera.zoom + camera.x;
  const wy = (input.mouseY - canvasH / 2) / camera.zoom + camera.y;
  input.mouseWorldX = wx;
  input.mouseWorldY = wy;
}
