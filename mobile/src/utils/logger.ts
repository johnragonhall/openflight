// Centralized dev-only logger.
//
// Production bundles (__DEV__ === false) stay silent, so this is the single
// sanctioned console call site in the app. Use it instead of swallowing
// errors with empty catch blocks - failures stay visible during development
// without leaking to release builds.

declare const __DEV__: boolean;

type Args = unknown[];

function emit(level: 'log' | 'warn' | 'error', args: Args): void {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
  // eslint-disable-next-line no-console
  console[level](...args);
}

export const logger = {
  log: (...args: Args): void => emit('log', args),
  warn: (...args: Args): void => emit('warn', args),
  error: (...args: Args): void => emit('error', args),
};
