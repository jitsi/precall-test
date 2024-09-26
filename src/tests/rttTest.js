import * as Timestamps from '../utility/timestamps';
/* eslint require-jsdoc: 0 */

import {TurnTest} from './turnTest';

const RTTSAMPLES = 10;
const TIMEOUT = 100; // ms
const LAST_TIMEOUT = 500; // ms

class RttTest extends TurnTest {
  constructor(connection) {
    super(connection);

    this.sendTimer = null;
    this.countSent = 0;
    this.rtts = [];
  }

  /*
   * Override functions
   */
  initiate() {
    this.results.startTimestamp = Timestamps.getCurrent();
    this.sendPing();
  }

  handleMessage(msg) {
    if (!this.isActive()) {
      return;
    }

    let sentTs = parseInt(msg, 10);
    let rtt = this.calculateRtt(sentTs); // ms

    this.rtts.push(rtt);
    if (this.countSent < RTTSAMPLES) {
      this.sendPing();
      return;
    }

    // enough samples arrived
    this.calculateMetrics();
  }

  handleError(error) {
    this.fillResults();

    this.failed(error);
  }

  /*
   * Private functions
   */
  sendPing() {
    if (!this.isActive()) {
      return;
    }

    let now = Timestamps.getCurrent(); // ms
    this.send(now.toString());
    this.countSent += 1;

    // cancel timer
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }
    // setup timer
    if (this.countSent < RTTSAMPLES) {
      this.sendTimer = setTimeout(this.sendPing.bind(this), TIMEOUT);
      return;
    }
    this.sendTimer = setTimeout(this.calculateMetrics.bind(this), LAST_TIMEOUT);
  }

  calculateRtt(sentTs) {
    let now = Timestamps.getCurrent();
    return now - sentTs;
  }

  calculateMetrics() {
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }

    this.fillResults();

    this.finished();
  }

  fillResults() {
    this.results.sentMessages = this.countSent;
    this.results.unAckedMessages = this.countSent - this.rtts.length;
    this.results.maxMessages = RTTSAMPLES;
    this.results.forceStopped = this.forceStopped;

    this.results.median = this.median();
    this.results.average = this.average();

    /* use standard deviation instead of variance
    when calculating jitter
    ToDo: clean up the code so that key 'variance'
    is not used instead of std  */
    this.results.variance = this.std();

    this.results.endTimestamp = Timestamps.getCurrent();
  }

  median() {
    if (this.rtts.length == 0) {
      return LAST_TIMEOUT;
    }

    // the middle entry of the sorted list
    this.rtts.sort();
    let half = Math.floor(this.rtts.length/2);
    return this.rtts[half];
  }

  average() {
    if (this.rtts.length == 0) {
      return LAST_TIMEOUT;
    }

    let sum = 0;
    for (let i = 0; i < this.rtts.length; i++ ) {
      sum += this.rtts[i];
    }
    return sum / this.rtts.length;
  }

  variance() {
    if (this.rtts.length == 0) {
      return LAST_TIMEOUT;
    }

    let variance = 0;
    let average = this.average();
    for (let i = 0; i < this.rtts.length; i++) {
      let rtt = this.rtts[i];
      variance += Math.pow(rtt - average, 2);
    }
    variance /= this.rtts.length;
    return variance;
  }

  std() {
    let variance = this.variance();
    if (variance <= 0) {
      return 0;
    }
    let std = Math.sqrt(variance);
    return std;
  }

  stop() {
    if (!this.isActive()) {
      return;
    }
    super.stop();
    this.fillResults();
  }
}

export {RttTest};
