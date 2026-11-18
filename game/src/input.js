// SOLMAR HEAT — input. Keyboard (WASD/arrows, Shift sprint, E enter/exit,
// F punch, M mute, P pause) plus a big touch joystick (160 px) and big
// action buttons (88 px) for phone landscape play. Both feed one move
// vector: move.x is turn (right positive), move.y is forward.

export function createInput() {
  const input = {
    move: { x: 0, y: 0 },
    sprint: false,
    joyActive: false,
    keys: {},
    onAction: null, // (name) => void, wired by main.js
  };
  const joy = { id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  const base = document.getElementById('stick-base');

  function keyMove() {
    const k = input.keys;
    let x = 0, y = 0;
    if (k['KeyA'] || k['ArrowLeft']) x -= 1;
    if (k['KeyD'] || k['ArrowRight']) x += 1;
    if (k['KeyW'] || k['ArrowUp']) y += 1;
    if (k['KeyS'] || k['ArrowDown']) y -= 0.6;
    input.sprint = !!(k['ShiftLeft'] || k['ShiftRight']);
    if (!input.joyActive) input.move = { x, y };
  }

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    input.keys[e.code] = true;
    keyMove();
    if (e.code === 'KeyE' && input.onAction) input.onAction('enter');
    if (e.code === 'KeyF' && input.onAction) input.onAction('punch');
    if (e.code === 'KeyM' && input.onAction) input.onAction('mute');
    if (e.code === 'KeyP' && input.onAction) input.onAction('pause');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    input.keys[e.code] = false;
    keyMove();
  });

  // Touch joystick: drag the knob, it reports a vector in [-1,1].
  function joyStart(e) {
    const t = e.changedTouches[0];
    joy.id = t.identifier;
    const r = base.getBoundingClientRect();
    joy.cx = r.left + r.width / 2;
    joy.cy = r.top + r.height / 2;
    joyMove(t);
    e.preventDefault();
  }
  function joyMove(t) {
    if (t.identifier !== joy.id) return;
    let dx = (t.clientX - joy.cx) / 64;
    let dy = (t.clientY - joy.cy) / 64;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joy.dx = dx; joy.dy = dy;
    knob.style.transform = `translate(${dx * 52}px, ${dy * 52}px)`;
    input.joyActive = true;
    input.move = { x: dx, y: -dy };
    input.sprint = len > 0.92;
  }
  function joyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joy.id) continue;
      joy.id = null;
      knob.style.transform = 'translate(0px, 0px)';
      input.joyActive = false;
      input.move = { x: 0, y: 0 };
      input.sprint = false;
      keyMove();
    }
  }
  base.addEventListener('touchstart', joyStart, { passive: false });
  base.addEventListener('touchmove', e => { joyMove(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
  base.addEventListener('touchend', joyEnd);
  base.addEventListener('touchcancel', joyEnd);

  // Action buttons: E enter/exit car, F punch, sprint hold.
  for (const btn of document.querySelectorAll('[data-act]')) {
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      const act = btn.getAttribute('data-act');
      if (act === 'sprint') { input.sprint = true; return; }
      if (input.onAction) input.onAction(act);
    }, { passive: false });
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      if (btn.getAttribute('data-act') === 'sprint') input.sprint = false;
    });
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-act');
      if (act !== 'sprint' && input.onAction) input.onAction(act);
    });
  }
  return input;
}
