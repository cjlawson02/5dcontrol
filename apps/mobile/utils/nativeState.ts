/**
 * Read/write helpers for Expo UI `useNativeState`.
 *
 * Native (iOS/Android) exposes React Compiler–compliant `get`/`set`.
 * The web polyfill only has a `.value` accessor.
 */
type NativeStateLike<T> = {
  value: T;
  get?: () => T;
  set?: (value: T) => void;
};

export function readNativeState<T>(state: NativeStateLike<T>): T {
  return typeof state.get === "function" ? state.get() : state.value;
}

export function writeNativeState<T>(state: NativeStateLike<T>, next: T): void {
  if (typeof state.set === "function") {
    state.set(next);
  } else {
    state.value = next;
  }
}
