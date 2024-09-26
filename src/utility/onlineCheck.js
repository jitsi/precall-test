import * as Timestamps from './timestamps';

/** ---- Online checks ---- */
class OnlineCheck {
  /**
   * constructor
   */
  constructor() {
    this.active = false; // added, because react-native does not support removeEventListener
  }

  /** checks if the browser has a connection
   * @private
   */
  start() {
    this.active = true;
    this.onlineCheck = [];

    if (!window || !window.addEventListener || typeof window.addEventListener != 'function') {
      return;
    }

    window.addEventListener('offline', () => {
      this.addEntry();
    });
    window.addEventListener('online', () => {
      this.addEntry();
    });

    this.addEntry();
  }

  /** adds an entry for online check
   * @private
   */
  addEntry() {
    if (!this.active) {
      return;
    }

    let now = Timestamps.getCurrent();
    if (navigator && navigator.onLine) {
      let entry = navigator.onLine;

      this.onlineCheck.push({'timestamp': now, 'online': entry});
    }
  }

  /** stops checking for browser connection
   * @return {Object} online check results
   * @private
   */
  stop() {
    this.active = false;

    if (window && window.removeEventListener && typeof window.removeEventListener === 'function') {
      window.removeEventListener('offline', () => {
        this.addEntry();
      });
      window.removeEventListener('online', () => {
        this.addEntry();
      });
    }

    return this.onlineCheck;
  }
}

export {OnlineCheck};
