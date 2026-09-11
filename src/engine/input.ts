/**
 * 键盘输入 —— 物理无关的状态收集层。
 * 每帧调用 update() 后读取 axis()。
 */

export type Action =
  | 'fire-left'
  | 'fire-right'
  | 'fire-jump'
  | 'water-left'
  | 'water-right'
  | 'water-jump'
  | 'pause'
  | 'restart'
  | 'menu';

interface KeyMap {
  [action: string]: string[];
}

const DEFAULT_BINDINGS: KeyMap = {
  'fire-left': ['ArrowLeft'],
  'fire-right': ['ArrowRight'],
  'fire-jump': ['ArrowUp', 'Space'],
  'water-left': ['KeyA'],
  'water-right': ['KeyD'],
  'water-jump': ['KeyW'],
  'pause': ['Escape'],
  'restart': ['KeyR'],
  'menu': ['Backspace'],
};

export class Input {
  private bindings: KeyMap;
  private held = new Map<string, boolean>();
  private pressed = new Map<string, boolean>();
  private prev = new Map<string, boolean>();

  constructor(bindings: KeyMap = DEFAULT_BINDINGS) {
    this.bindings = bindings;
    this.attach();
  }

  private actionFor(code: string): Action | null {
    for (const [action, codes] of Object.entries(this.bindings)) {
      if (codes.includes(code)) return action as Action;
    }
    return null;
  }

  private attach() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      const action = this.actionFor(e.code);
      if (!action) return;
      if (!this.held.get(action)) this.pressed.set(action, true);
      this.held.set(action, true);
      // 阻止方向键滚动页面 / Space 触发按钮
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'KeyR') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const action = this.actionFor(e.code);
      if (!action) return;
      this.held.set(action, false);
    });
    window.addEventListener('blur', () => this.clear());
  }

  clear(): void {
    this.held.clear();
    this.pressed.clear();
    this.prev.clear();
  }

  /** 仅供测试 / 编程式触发 */
  _set(action: Action, down: boolean): void {
    if (!this.held.get(action) && down) this.pressed.set(action, true);
    this.held.set(action, down);
  }

  /** 帧结束时调用，把 pressed 翻转为 prev */
  endFrame(): void {
    this.prev = new Map(this.held);
    this.pressed.clear();
  }

  isHeld(action: Action): boolean {
    return !!this.held.get(action);
  }

  isPressed(action: Action): boolean {
    return !!this.pressed.get(action);
  }
}