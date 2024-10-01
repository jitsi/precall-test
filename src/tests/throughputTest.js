import * as Timestamps from '../utility/timestamps';
import {MessageMaker} from '../utility/messageMaker';
/* eslint require-jsdoc: 0 */

import {TurnTest} from './turnTest';

class ThroughputTest extends TurnTest {
  constructor(connection, rtt, loss) {
    super(connection);

    this.sentBytes = 0;
    this.receivedBytes = 0;
    this.secondHalfBytes = 0;
    this.secondHalfStart = null;
    this.bufferEmpty = 1;

    this.chunkSize = 1200;
    this.messageMaker = new MessageMaker(this.chunkSize);

    this.duration = 5000; // ms
    if (rtt != null) {
      // duration is dependent on RTT, upper bound 10 s, lower bound 1 s
      // it seems 50 RTTs is needed for reliable testing
      let duration = 50 * rtt;
      this.duration = Math.max(Math.min(duration, 10*1000), 1*1000);
    }
    this.sendTimer = null;

    this.intervals = [];
    this.intervalStart = 0;
    this.intervalLength = 100; // ms
    this.intervalBytes = 0;
    this.loss = loss;
    this.lastReceivedTimestamp = 0;
  }

  /*
   * Override functions
   */
  initiate() {
    if (window && window.csioReactNative) {
      /* NOTE react-native does not support RTCDataChannel.bufferedAmount, so it
          is stuck in a loop when putting data to the buffer.
          Also, when it is ever supported, there is no removeEventListener which has be taken care of */
      let errMsg = 'Not running throughput test for react-native';
      // console.error(errMsg);
      this.handleError(new Error(errMsg));
      return;
    }
    // console.log('start', this.duration);
    this.startSend();
  }

  handleMessage(msg) {
    if (!this.isActive()) {
      return;
    }

    // save last received message for loss calculations
    this.lastMessage = msg;

    // count the total received bytes
    this.receivedBytes += msg.length;

    // record start time, and set timer to stop
    let now = Timestamps.getCurrent();
    this.lastReceivedTimestamp = now;
    if (!this.sendTimer) {
      this.results.startTimestamp = now;
      this.sendTimer = setTimeout(() => {
        this.stop();
        this.finished();
      }, this.duration);
    }

    // calculate intervals
    if (this.intervalStart == 0) {
      this.intervalStart = now;
    }
    this.intervalBytes += msg.length;
    if (now - this.intervalStart >= this.intervalLength) {
      // average throughput
      let intervalDuration = now - this.intervalStart; // ms
      let intervalAvg = this.averageThroughput(this.intervalBytes, intervalDuration);

      // RTT
      let rtt = null;
      try {
        let msgJson = JSON.parse(this.lastMessage);
        rtt = now - msgJson.timestamp;
      } catch (e) {
        // console.error('Error parsing msg:', msg, e);
      }

      // add and reset
      this.intervals.push({
        'startTimestamp': this.intervalStart,
        'endTimestamp': now,
        'bytesReceived': this.intervalBytes,
        'average': intervalAvg,
        'rtt': rtt,
      });

      this.intervalStart = now;
      this.intervalBytes = 0;
    }

    // calculation for second half of the connection
    if (this.results.startTimestamp && now - this.results.startTimestamp > this.duration/2) {
      if (!this.secondHalfStart) {
        this.secondHalfStart = now;
      }
      this.secondHalfBytes += msg.length;
    }
  }

  handleError(error) {
    this.stop();

    this.failed(error);
  }

  /*
   * Private functions
   */
  averageThroughput(bytes, milliseconds) {
    if (milliseconds === 0) {
      return 0;
    }
    let seconds = milliseconds/1000.0;
    let avg = ((bytes / seconds) * 8.0 ) / 1024.0; // kbps
    return avg;
  }

   // Listen for one bufferedamountlow event.
  bufferListener() {
    this.sendChannel.removeEventListener('bufferedamountlow', this.bufferListener.bind(this));
    this.fillBuffer();
  }

  fillBuffer() {
    // NOTE bufferedAmount might be 0 when the event is processed too late
    if (this.sendChannel.bufferedAmount == 0) {
      this.bufferEmpty += 1;
    }

    while (this.isActive()) {
      if (this.sentBytes > 1000000) {
        break;
      }
      if (this.sendChannel.bufferedAmount > this.bufferFullThreshold) {
        if (this.usePolling) {
          setTimeout(this.fillBuffer.bind(this), 250); // max rate: 11Mbps <= (300 * 1200 Bytes) / 0.25 s
        } else {
          this.sendChannel.addEventListener('bufferedamountlow', this.bufferListener.bind(this));
        }
        return;
      }
      let message = this.messageMaker.make(this.sentBytes);
      this.sentBytes += message.length;
      this.send(message);
    }
    this.sendChannel.removeEventListener('bufferedamountlow', this.bufferListener.bind(this));
  }

  startSend() {
    if (!this.isActive()) {
      return;
    }

    // the amount of data to be buffered
    this.bufferFullThreshold = 1000 * this.chunkSize;
    this.sendChannel = this.connection.sendChannel;
    this.usePolling = true;
    if (typeof this.sendChannel.bufferedAmountLowThreshold === 'number') {
       // console.log('Using the bufferedamountlow event for flow control');
      this.usePolling = false;

      this.sendChannel.bufferedAmountLowThreshold = this.bufferFullThreshold/10;
    }
    setTimeout(this.fillBuffer.bind(this), 0);
  }

  fillResults() {
    this.results.endTimestamp = this.lastReceivedTimestamp;
    this.results.maxDuration = this.duration;
    this.results.forceStopped = this.forceStopped;
    this.results.bufferEmpty = this.bufferEmpty;
    this.results.intervals = this.intervals;

    this.results.bytesPrepared = this.sentBytes;
    this.results.bytesReceived = this.receivedBytes;

    if (!this.results.startTimestamp) {
      this.results.startTimestamp = this.results.endTimestamp;
    }
    // calculate average throughput
    let duration = 0;
    let average = 0;
    if (this.secondHalfStart) {
      duration = this.results.endTimestamp - this.secondHalfStart; // ms
      average = this.averageThroughput(this.secondHalfBytes, duration);
    }
    // fallback if there is no data for second half
    let allDuration = this.results.endTimestamp - this.results.startTimestamp; // ms
    let allAverage = this.averageThroughput(this.receivedBytes, allDuration);
    if (allAverage > average) {
      average = allAverage;
    }

    this.results.average = average;
    this.results.fractionLostBytes = this.loss;
  }

  stop() {
    if (!this.isActive()) {
      return;
    }
    clearTimeout(this.sendTimer);
    this.sendTimer = null;

    super.stop();
    this.fillResults();
  }
}

export {ThroughputTest};
