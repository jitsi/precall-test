import {TurnConnection} from './turnConnection';
import {RttTest} from './tests/rttTest';
import {ThroughputTest} from './tests/throughputTest';
import {LossTest} from './tests/lossTest';
import {ResultsHandler} from './utility/resultsHandler';
import {OnlineCheck} from './utility/onlineCheck';
import {detect, Constants} from './utility/stats/detectbrowser';

/** the names of the tests */
const TEST_NAMES = {
  RTT: 'rtt',
  LOSS: 'loss',
  THROUGHPUT: 'throughput',
};

/** the number of times the connection to the TURN server is retried if failed */
const FAILURE_RETRIES = 10;

/**
 * Main class for PreCallTest. It performs a series of tests to measure the
 * user's connectivity.
 */
class PreCallTest {
  /** Create a new instance */
  constructor() {
    this.browserInfo = detect();
    this.onlineCheck = new OnlineCheck();
    this.callsInProgress = 0;

    /* The sequence of TURN tests */
    this.turnTests = [
      TEST_NAMES.RTT,
      TEST_NAMES.LOSS,
      TEST_NAMES.THROUGHPUT,
    ];
    this.active = false;
    this.rtt = null;
    this.fractionLostBytes = -1;
    this.resultsHandler = null;
    this.startResolve = null;
    this.startReject = null;
  }

  /*
   * Public methods
   */

  /** Start the precall tests
   * @param {JSON} iceServers an RTCIceServer object/array
   * @public
   */
  start(iceServers) {
    this.iceServers = iceServers;

    return new Promise((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;

      if (this.browserInfo.browserName === Constants.browserName.msie) {
        // console.warn('precalltest: disable for IE');
        // this.callback(null, 'Not started: disabled for IE');
        this.startReject(new Error('Not started: disabled for IE'));
        
        return;
      }

      if (this.active) {
        // console.warn('Not started: already in progress');
        // this.callback(null, 'Not started: already in progress');
        this.startReject(new Error('Not started: already in progress'));
        
        return;
      }

      if (this.callsInProgress > 0) {
        // console.warn('Not started: call in progress');
        // this.callback(null, 'Not started: call in progress');
        this.startReject(new Error('Not started: call in progress'));
        
        return;
      }

      if (!iceServers) {
        // console.warn('Not started: no ICE servers given');
        // this.callback(null, 'Not started: no ICE servers given');
        this.startReject(new Error('Not started: no ICE servers given'));
        
        return;
      }

      // console.log('PreCallTest start');
      this.turnTestCounter = 0;
      this.resultsHandler = new ResultsHandler();

      let endpointInfo = {
        type: 'browser',
        os: this.browserInfo.os,
        osVersion: this.browserInfo.osVersion,
        buildName: this.browserInfo.browserName,
        buildVersion: this.browserInfo.browserVersion,
        userAgent: this.browserInfo.userAgent,
      };
      this.resultsHandler.add('endpointInfo', endpointInfo);

      this.onlineCheck.start();

      this.active = true;

      this._start();
    });
  }

  /** Internal start function
   * @private
   */
  _start() {
    if (!this.active) {
      return;
    }
    this.turnConnection = new TurnConnection(this.browserInfo);
    this.turnConnection.connect(this.iceServers).then(
      () => {
        // console.log('TURN connected.');
        if (!this.active) {
          this.stop();
          return;
        }

        if (this.resultsHandler) {
          this.resultsHandler.setStatusSuccess();
        }
        this.startTurnTests().then(() => {
          // console.log('All TURN tests completed');
          this.stop();
        }, (e) => {
          // console.error(e);
          this.stop();
        });
      }, (e) => {
        let continueFlag = e.continueFlag;
        // console.log('TURN connection failed:', e);
        if (this.resultsHandler) {
          this.resultsHandler.failure(e);
        }
        if (!continueFlag) {
          this.turnConnection.disconnect();
          this.active = false;
          let message = '';
          try {
            message = e.stack;
          } catch (err) {
            message = e.toString();
          }
          if (!message || message === '') {
            message = e.toString();
          }

          if (this.resultsHandler) {
            this.resultsHandler.setStatusFailed();
          }

          // console.warn('Error:', message);
          // this.callback(null, message);
          this.startReject(new Error(message));

          return;
        }
        if (this.resultsHandler) {
          this.resultsHandler.setStatusFailed();
          if (this.resultsHandler.getFailureNumber() >= FAILURE_RETRIES) {
            this.stop();
            return;
          }
        } else {
          this.stop();
          return;
        }
        // restart if it hasn't failed too often already
        this.turnConnection.disconnect();
        setTimeout(() => {
          // console.warn('PreCallTest REstart');
          this._start();
        }, 0);
      });
  }

  /** Stop the precall tests
   * @private */
  stop() {
    if (!this.active) {
      return;
    }

    this.active = false;
    if (this.activeTurnTest) {
       // console.warn('Stopping active test');
      this.activeTurnTest.forceStop();
    }
    // console.log('PreCallTest stop');

    let onlineCheckResults = this.onlineCheck.stop();
    if (this.resultsHandler) {
      this.resultsHandler.add('onlineStatus', onlineCheckResults);
    }

    this.turnConnection.getIceResults().then((iceResults) => {
      if (this.resultsHandler) {
        this.resultsHandler.add('ice', iceResults);
      }

      // stop everything
      // console.log('ICE obtained');
      this.turnConnection.disconnect();

      // send results
      this.sendResults();
    }, (err) => {
      if (this.resultsHandler) {
        this.resultsHandler.failure(err);
      }

      // stop everything
      // console.log('ICE failure');
      this.turnConnection.disconnect();

      // send results
      this.sendResults();
    });
  }

  /** Start the precall tests
   * @param {JSON} results full pct results
   * @return {JSON}
   * @private
   */
  getPublicPrecalltestResults(results) {
    const publicResults = {
      mediaConnectivity: false,
      throughput: null,
      fractionalLoss: null,
      rtt: null,
      jitter: null,
      timestamp: Date.now(),
    };
    if (!results || !results.tests) {
      return publicResults;
    }

    publicResults.startTimestamp = results.startTimestamp;
    publicResults.endTimestamp = results.endTimestamp;

    if (results.tests.rtt) {
      publicResults.rtt = results.tests.rtt.median;
      publicResults.mediaConnectivity = true;
      publicResults.jitter = results.tests.rtt.variance;
    }

    if (results.tests.throughput) {
      publicResults.throughput = results.tests.throughput.average;
      publicResults.fractionalLoss = Math.max(results.tests.throughput.fractionLostBytes, 0);
      publicResults.mediaConnectivity = true;
      // publicResults.bytesSent = results.tests.throughput.bytesSent;
    }

    if (results.tests.ice) {
      if (results.tests.ice.relayTcpSuccess ||
          results.tests.ice.relayTlsSuccess ||
          results.tests.ice.relayUdpSuccess) {
        publicResults.mediaConnectivity = true;
      }
    }
    return publicResults;
  }

  /** Send results via callback
   * @private
   */
  sendResults() {
    if (!this.resultsHandler) {
        // this.callback(null, 'No results present');
        this.startReject(new Error('No results present'));
        return;
    }

    const results = this.resultsHandler.getResults();
    const resultsMin = this.getPublicPrecalltestResults(results);
    // console.log('**** Results ', results, resultsMin);
      //this.callback(resultsMin, null);
    this.startResolve(resultsMin);
  }

  /** Call starts
   * @public */
  callStarts() {
    this.callsInProgress += 1;

    if (this.resultsHandler) {
      this.resultsHandler.setStatusStopped();
    }

    this.stop();
  }

  /** Call finished
   * @public */
  callFinished() {
    this.callsInProgress -= 1;
    // NOTE tests could be restarted here, if callsInProgress is 0
  }

  /**
   * Disconnect the peer connection (used only when some crash occurs)
   */
  crashDisconnect() {
    try {
       // console.error('something crashed');
      this.turnConnection.disconnect();
    } catch (err) {
       (err);
    }
  }

  /*
   * Private methods
   */

  /** Start TURN tests. The tests are serialized, the sequence given in this.turnTests
   * @return {Promise} all tests completed or error, does not reject if a single test fails
   * @private */
  startTurnTests() {
    if (this.turnTestCounter >= this.turnTests.length) {
      return new Promise((resolve, reject) => {
        resolve();
      });
    }

    let testName = this.turnTests[this.turnTestCounter];
    let test = null;
    switch (testName) {
      case TEST_NAMES.RTT:
        test = new RttTest(this.turnConnection);
        break;
      case TEST_NAMES.LOSS:
        test = new LossTest(this.turnConnection);
        break;
      case TEST_NAMES.THROUGHPUT:
        test = new ThroughputTest(this.turnConnection, this.rtt, this.fractionLostBytes);
        break;
      default:
        return new Promise((resolve, reject) => {
          reject(new Error(`Unknown test: ${testName}`));
        });
    }

    this.activeTurnTest = test;
    if (!this.active) {
      return new Promise((resolve, reject) => {
        reject(new Error('Test trying to start while testing is not active'));
      });
    }
    return test.start() // returns the Promise
    .then(() => {
      // console.info('Test succeeded', testName);
      this.handleTestResults(testName, test.getResults());

      this.turnTestCounter += 1;
      this.activeTurnTest = null;
      return this.startTurnTests();
    }, (e) => {
      // console.error('Test failed', testName, e);
      this.handleTestResults(testName, test.getResults(), e);

      this.turnTestCounter += 1;
      this.activeTurnTest = null;
      return this.startTurnTests();
    });
  }

  /** handle the results from a test
   * @param {String} testName the name of the test
   * @param {Object} results the results of the test
   * @param {Error=} error if the test failed
   */
  handleTestResults(testName, results, error=null) {
    if (error == null && testName == TEST_NAMES.RTT) {
      this.rtt = results.median;
    } else if (error == null && testName == TEST_NAMES.LOSS) {
      this.fractionLostBytes = results.fractionLostBytes;
    }
    if (this.resultsHandler) {
      this.resultsHandler.add(testName, results);
    }
  }
}

export default PreCallTest;

// for standlone browserify based testing
// (function() {
//   if (('function' === typeof define) && (define.amd)) {/* AMD support */
//     define('PreCallTest', [], PreCallTest);
//   } else {/* Browsers and Web Workers*/
//     global.PreCallTest = PreCallTest;
//   }
//   module.exports = PreCallTest;
// })(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this); // eslint-disable-line
