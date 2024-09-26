import * as Timestamps from '../utility/timestamps';


/** Create a random string
 * @param {Integer} length The length of the string
 * @return {String} The string of a certain length
 */
function randomAsciiString(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    // Visible ASCII chars are between 35 and 93.
    result += String.fromCharCode(35 + Math.random() * (93-35));
  }
  return result;
}

/** Class produces strings of a certain length that contain a timestamp.
 * Due to the timestamp, the message is always unique, although the padding is constant.
 * The random padding ensures that the effect of compression in the network is mitigated.
 * Since the timestamp should be kept in float, the size of the message might vary by a few bytes. */
class MessageMaker {
  /** Create a new object
   * @param {Integer} size The total size of the message
   */
  constructor(size = 1200) {
    this.message = {timestamp: '', sentBytes: 10000, padding: ''};

    const TIMESTAMP_BYTES = Timestamps.getCurrent().toString().length;
    const MESSAGE_BYTES = JSON.stringify(this.message).length;
    const PADDING = randomAsciiString(size - TIMESTAMP_BYTES - MESSAGE_BYTES);

    // NOTE somehow this creates slightly too big messages?
    this.message.padding = PADDING;
  }

  /** Make a new message
   * @param {Number} sentBytes the amount of bytes sent so far
   * @return {String} The message
   * @public
   */
  make(sentBytes) {
    this.message.timestamp = Timestamps.getCurrent();
    this.message.sentBytes = sentBytes;
    return JSON.stringify(this.message);
  }
}

export {MessageMaker, randomAsciiString};
