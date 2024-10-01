import * as Timestamps from '../utility/timestamps';
import {MessageMaker} from '../utility/messageMaker';
/* eslint require-jsdoc: 0 */

import {TurnTest} from './turnTest';

const MAX_BUFFER_FILL = 2;
class LossTest extends TurnTest {
  constructor(connection) {
    super(connection);

    this.sentBytes = 0;
    this.receivedBytes = 0;

    this.chunkSize = 1024;
    this.messageMaker = new MessageMaker(this.chunkSize);

    this.duration = 3000; // ms
    this.sendTimer = null;
    this.lastMessage = null;
    this.numBufferFill = 0;
  }

  /*
   * Override functions
   */
  initiate() {
    if (window && window.csioReactNative) {
      /* NOTE react-native does not support RTCDataChannel.bufferedAmount, so it
          is stuck in a loop when putting data to the buffer.
          Also, when it is ever supported, there is no removeEventListener which has be taken care of */
      let errMsg = 'Not running loss test for react-native';
       (errMsg);
      this.handleError(new Error(errMsg));
      return;
    }
     // console.log('LossTest start', this.duration);
    let now = Timestamps.getCurrent();
    this.results.startTimestamp = now;
    this.startSend();
  }

  handleMessage(msg) {
    if (!this.isActive()) {
      return;
    }
    this.lastMessage = msg;
    // count the total received bytes
    this.receivedBytes += msg.length;

    // record start time, and set timer to stop
    if (!this.sendTimer) {
      this.sendTimer = setTimeout(() => {
        this.stop();
        this.finished();
      }, this.duration);
    }
  }

  handleError(error) {
    this.stop();
    this.failed(error);
  }

  fillBuffer() {
    let sentData = 0;
    while (this.isActive()) {
      if (sentData > this.bufferFullThreshold) {
        break;
      }
      let message = this.messageMaker.make(this.sentBytes);
      this.sentBytes += message.length;
      sentData += message.length;
      setTimeout(this.send(message), 8); // sending by pacing, making sure we send 1Mbps
    }
    sentData = 0;
    this.numBufferFill++;
    if (this.numBufferFill >= MAX_BUFFER_FILL) {
      return;
    } else {
      this.startSend();
    }
  }

  startSend() {
    if (!this.isActive()) {
      return;
    }
    // the amount of data to be buffered
    this.bufferFullThreshold = (1000 * this.chunkSize) / 8; // The threshold is 1 Mbps
    this.sendChannel = this.connection.sendChannel;
    setTimeout(this.fillBuffer.bind(this), 250);
  }

  fillResults() {
    this.results.endTimestamp = Timestamps.getCurrent();
    this.results.maxDuration = this.duration;
    this.results.forceStopped = this.forceStopped;
    this.results.sentBytes = this.sentBytes;
    this.results.bytesReceived = this.receivedBytes;

    let msgJson = null;
    try {
      msgJson = JSON.parse(this.lastMessage);
    } catch (e) {
      // console.error('Error parsing msg:', msg, e);
      return;
    }
    if (msgJson) {
      let totalBytes = msgJson.sentBytes + this.lastMessage.length;

      this.results.bytesSent = totalBytes;
      this.results.fractionLostBytes = 1 - this.receivedBytes/totalBytes;
    } else {
      this.results.bytesSent = -1;
      this.results.fractionLostBytes = -1;
    }
     // console.log('Loss Results are ', this.results);
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

export {LossTest};
