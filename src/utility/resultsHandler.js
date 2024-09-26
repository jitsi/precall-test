import * as Timestamps from './timestamps';
import {randomAsciiString} from './messageMaker';

let status = {
  'success': 'success',
  'stopped': 'stopped',
  'failed': 'failed',
};

/** Stores results for tests and failures, and returns a complete results object.
 * The tests themselves are responsible for the format of their own results. */
class ResultsHandler {
  /** Creates a new object */
  constructor() {
    this.start = Timestamps.getCurrent();
    this.id = `${Math.trunc(this.start)}-${randomAsciiString(20)}`;
    this.version = '@@pctVersion';
    this.failures = [];
    this.results = {};
    this.status = status.success;
  }

  /** Sets status to stopped
   */
  setStatusStopped() {
    if (this.status === status.failed) {
      return;
    }
    this.status = status.stopped;
  }

  /** Sets status to failed
   */
  setStatusFailed() {
    this.status = status.failed;
  }

  /** Sets status to success
   */
  setStatusSuccess() {
    if (this.status === status.stopped) {
      return;
    }
    this.status = status.success;
  }

  /** Returns the overall result of the PreCallTest
   * @return {Object} the results
   */
  getResults() {
    let results = {
      id: this.id,
      version: this.version,
      status: this.status,
      startTimestamp: this.start,
      endTimestamp: Timestamps.getCurrent(),
      failures: this.failures,
      tests: this.results,
    };

    return results;
  }

  /** Return the number of failures that have occured
   * @return {Number} the number of failures
   */
  getFailureNumber() {
    return this.failures.length;
  }

  /** Returns the current ID
   * @return {String} the ID
   */
  getId() {
    return this.id;
  }

  /** adds test result
   * @param {String} testName the name of the test
   * @param {Object} result the test result
   */
  add(testName, result) {
    this.results[testName] = result;
    if (result.hasOwnProperty('forceStopped') && result.forceStopped == true) {
      this.setStatusStopped();
    }
  }

  /** adds a failure to start a PreCallTest, e.g. no connection to TURN server
   * @param {Error} reason A description for the failure
   */
  failure(reason) {
    if (typeof reason === 'object') {
      reason = reason.toString();
    }
    let failure = {
      timestamp: Timestamps.getCurrent(),
      reason: reason,
    };
    this.failures.push(failure);
  }
}

export {ResultsHandler};
