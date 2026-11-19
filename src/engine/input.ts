export type Action = 'up' | 'down' | 'left' | 'right' | 'special' | 'pause' | 'debug' | 'resetTally';

// Dev-console keys still work while staff type stats into the start form.
const CONSOLE_ACTIONS: ReadonlySet<Action> = new Set<Action>(['debug', 'resetTally']);

export interface InputState {
  isDown(a: Action): boolean;
  consume(a: Action): boolean;
}

export class Input implements InputState {
  private readonly codeToAction = new Map<string, Action>();
  private readonly held = new Set<string>();
  private readonly pressed = new Set<Action>();

  constructor(private readonly bindings: Record<Action, readonly string[]>) {
    for (const action of Object.keys(bindings) as Action[]) {
      for (const code of bindings[action]) this.codeToAction.set(code, action);
    }
  }

  /** Returns true when the code is bound. Auto-repeat keeps the key held but latches no press. */
  keyDown(code: string, repeat = false): boolean {
    const action = this.codeToAction.get(code);
    if (action === undefined) return false;
    this.held.add(code);
    if (!repeat) this.pressed.add(action);
    return true;
  }

  keyUp(code: string): boolean {
    if (!this.codeToAction.has(code)) return false;
    this.held.delete(code);
    return true;
  }

  isDown(a: Action): boolean {
    for (const code of this.bindings[a]) if (this.held.has(code)) return true;
    return false;
  }

  consume(a: Action): boolean {
    return this.pressed.delete(a);
  }

  clear(): void {
    this.held.clear();
    this.pressed.clear();
  }

  attach(target: Window): () => void {
    // Keys typed into the start form must never reach the game; console keys are the exception.
    const fromTextField = (e: KeyboardEvent): boolean => {
      if (!(e.target instanceof HTMLInputElement)) return false;
      const action = this.codeToAction.get(e.code);
      return action === undefined || !CONSOLE_ACTIONS.has(action);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (fromTextField(e)) return;
      if (this.keyDown(e.code, e.repeat)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (fromTextField(e)) return;
      if (this.keyUp(e.code)) e.preventDefault();
    };
    const onBlur = (): void => this.clear();
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    };
  }
}
