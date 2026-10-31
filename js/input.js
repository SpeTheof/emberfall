// ============================================================
// EMBERFALL — input (keyboard, pointer, touch, gamepad)
// ============================================================

const KEY_MAP = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'jump', ArrowUp: 'jump', Space: 'jump',
  KeyS: 'down', ArrowDown: 'down',
  KeyJ: 'attack',
  KeyK: 'skill',
  ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyE: 'interact',
  KeyQ: 'potion',
};

const GAMEPAD_MAP = {
  0: 'jump', 1: 'dash', 2: 'attack', 3: 'skill',
  4: 'potion', 5: 'interact', 9: 'pause', 8: 'pause',
};

export class Input {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.down = new Set();
    this.pressedSet = new Set();
    this.touchMove = 0;
    this.stickValue = { x: 0, y: 0 };
    this.gamepad = null;
    this.padPrev = {};
    this.lastTap = { left: 0, right: 0 };
    this.enabled = true;
    this.bind();
  }

  bind() {
    this.onKeyDown = (e) => {
      if (e.repeat) {
        if (KEY_MAP[e.code]) e.preventDefault();
        return;
      }
      const action = KEY_MAP[e.code];
      if (action) {
        e.preventDefault();
        this.press(action);
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.callbacks.onPause?.();
      }
      if (e.code === 'KeyI') {
        e.preventDefault();
        this.callbacks.onInventory?.();
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.callbacks.onMute?.();
      }
    };
    this.onKeyUp = (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        e.preventDefault();
        this.release(action);
      }
    };
    this.onBlur = () => this.reset();

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });

    this.onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (e.target !== this.canvas) return;
      this.press('attack');
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDown);

    window.addEventListener('gamepadconnected', (e) => { this.gamepad = e.gamepad; });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepad && this.gamepad.index === e.gamepad.index) this.gamepad = null;
    });
  }

  press(action) {
    if (!this.enabled) return;
    this.down.add(action);
    this.pressedSet.add(action);
  }

  release(action) {
    this.down.delete(action);
  }

  isDown(action) { return this.down.has(action); }
  wasPressed(action) { return this.pressedSet.has(action); }

  setStick(x, y = 0) {
    this.stickValue.x = Math.max(-1, Math.min(1, x));
    this.stickValue.y = Math.max(-1, Math.min(1, y));
  }

  setTouchMove(x) {
    this.touchMove = Math.max(-1, Math.min(1, x));
  }

  reset() {
    this.down.clear();
    this.pressedSet.clear();
    this.touchMove = 0;
    this.stickValue.x = 0;
    this.stickValue.y = 0;
  }

  endFrame() {
    this.pressedSet.clear();
  }

  get moveX() {
    let x = 0;
    if (this.down.has('left')) x -= 1;
    if (this.down.has('right')) x += 1;
    if (Math.abs(this.stickValue.x) > 0.1) x = this.stickValue.x;
    return Math.max(-1, Math.min(1, x));
  }

  pollGamepad() {
    if (!this.gamepad) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (pad) { this.gamepad = pad; break; }
      }
    }
    const pad = this.gamepad;
    if (!pad) return;

    const axis = pad.axes[0] || 0;
    if (Math.abs(axis) > 0.22) {
      if (axis < 0) this.press('left'); else this.press('right');
      this.stickValue.x = axis;
    } else {
      this.release('left'); this.release('right');
      if (Math.abs(this.stickValue.x) <= 0.22) this.stickValue.x = 0;
    }

    for (const [idx, action] of Object.entries(GAMEPAD_MAP)) {
      const btn = pad.buttons[Number(idx)];
      if (!btn) continue;
      const was = !!this.padPrev[idx];
      if (btn.pressed && !was) {
        if (action === 'pause') this.callbacks.onPause?.();
        else this.press(action);
      } else if (!btn.pressed && was && action !== 'pause') {
        this.release(action);
      }
      this.padPrev[idx] = btn.pressed;
    }
    // left stick down = drop through platform
    if (pad.axes[1] > 0.6) this.press('down');
    else if ((this.padPrev.downAxis || false)) this.release('down');
    this.padPrev.downAxis = pad.axes[1] > 0.6;
  }
}
