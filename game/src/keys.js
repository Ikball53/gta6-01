// Input: keyboard, mouse and touch controls for SOLMAR HEAT.
// One shared object; boot.js reads it every frame. Edge presses are
// consumed on read so a single tap never fires twice.
export function createKeys() {
  const K = {
    down: new Set(),
    edge: new Set(),
    mouse: { x: 0, y: 0, ndcX: 0, ndcY: 0, down: false, clicked: false },
    joy: { x: 0, y: 0, active: false },
    touch: { enter: false, shoot: false, sprint: false },
    move: { x: 0, y: 0 },
  };

  const codeOf = (e) => e.code;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    K.down.add(codeOf(e));
    K.edge.add(codeOf(e));
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(codeOf(e))) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => K.down.delete(codeOf(e)));
  window.addEventListener('blur', () => { K.down.clear(); K.edge.clear(); K.mouse.down = false; });
  // Right-click is for aiming, not the browser menu, on the game canvas.
  window.addEventListener('contextmenu', (e) => {
    if (e.target && (e.target.tagName === 'CANVAS' || e.target.id === 'game')) e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    K.mouse.x = e.clientX; K.mouse.y = e.clientY;
    K.mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    K.mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('button, a, input, .panel')) return;
    K.mouse.down = true; K.mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => { K.mouse.down = false; });

  K.isDown = (code) => K.down.has(code);
  K.wasPressed = (code) => {
    if (K.edge.has(code)) { K.edge.delete(code); return true; }
    return false;
  };
  K.mouseClicked = () => {
    if (K.mouse.clicked) { K.mouse.clicked = false; return true; }
    return false;
  };
  // Fresh movement vector from keys or the touch joystick, -1..1.
  K.pollMove = () => {
    let x = 0, y = 0;
    if (K.down.has('KeyW') || K.down.has('ArrowUp')) y += 1;
    if (K.down.has('KeyS') || K.down.has('ArrowDown')) y -= 1;
    if (K.down.has('KeyA') || K.down.has('ArrowLeft')) x -= 1;
    if (K.down.has('KeyD') || K.down.has('ArrowRight')) x += 1;
    if (K.joy.active) { x += K.joy.x; y += K.joy.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    K.move.x = x; K.move.y = y;
    return K.move;
  };
  K.sprint = () => K.down.has('ShiftLeft') || K.down.has('ShiftRight') || K.touch.sprint;

  // --- touch joystick + buttons (landscape phones) ---
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  if (stick && knob) {
    let sid = null;
    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sid = t.identifier; K.joy.active = true;
      e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        const r = stick.getBoundingClientRect();
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        K.joy.x = dx; K.joy.y = -dy;
        // Knob travel follows the actual stick size (stick is much bigger
        // now): max travel is base radius minus knob radius.
        const maxTravel = (r.width - knob.offsetWidth) / 2;
        setKnob(dx * maxTravel, dy * maxTravel);
      }
      e.preventDefault();
    }, { passive: false });
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        sid = null; K.joy.active = false; K.joy.x = 0; K.joy.y = 0; setKnob(0, 0);
      }
    };
    stick.addEventListener('touchend', endStick);
    stick.addEventListener('touchcancel', endStick);
  }
  const bindBtn = (id, prop) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { K.touch[prop] = true; e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', () => { K.touch[prop] = false; });
    el.addEventListener('touchcancel', () => { K.touch[prop] = false; });
  };
  bindBtn('btn-enter', 'enter');
  bindBtn('btn-shoot', 'shoot');
  bindBtn('btn-sprint', 'sprint');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch');
  }
  return K;
}
