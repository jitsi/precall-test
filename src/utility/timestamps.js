/** @module Timestamps */

/** Return the current timestamp with millisecond accuracy if available
 * @return {Number} The timestamp
 * @public */
export function getCurrent() {
  if (!window || !window.performance || !window.performance.now) {
    return Date.now();
  }
  if (!window.performance.timing || !window.performance.timing.navigationStart) {
    return Date.now();
  }
  return window.performance.now() + window.performance.timing.navigationStart;
}
