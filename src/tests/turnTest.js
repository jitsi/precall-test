/** A base class for tests that need the TURN server */
class TurnTest {
  /** Create a new instance (normally with super())
   * @param {TurnConnection} connection the connection to the TURN server
   */
  constructor(connection) {
    this.connection = connection;
    this.active = false;

    this.results = {};
  }

  /*
   * Public functions
   */

  /** Returns the obtained results from the test
   * @return {Object} the results
   * @public
   */
  getResults() {
    return this.results;
  }

  /** Start the tests
   * @return {Promise} resolve when test is completed successfully
   * @public
   */
  start() {
    let promise = new Promise((resolve, reject) => {
      this.resolveCb = resolve;
      this.rejectCb = reject;
    });

    this.connection.setMessageCallback(this.handleMessage.bind(this));
    this.connection.setErrorCallback(this.handleError.bind(this));

    this.active = true;
    this.forceStopped = false;
    this.initiate();

    return promise;
  }

  /** Stop the test
   * @protected */
  stop() {
    this.active = false;
  }

  /** Force the test to stop
   * @public
   */
  forceStop() {
    this.forceStopped = true;
    this.stop();
    this.finished();
  }

  /** Returns if this test is currently running
   * @return {Boolean} active or not
   * @public
   */
  isActive() {
    return this.active;
  }

  /*
   * Override functions
   */

  /** Initiate the test sequence
   * @protected
   */
  initiate() {
    // console.error('initiate not implemented');
  }

  /** Handle the response for a sent msg
   * @param {String} msg The received message
   * @protected
   */
  handleMessage(msg) {
    // console.error('handleMessage not implemented');
  }

  /** Handle an error occuring on the connection's datachannel
   * @param {Error} error The received message
   * @protected
   */
  handleError(error) {
    // console.error('handleError not implemented');
  }

  /*
   * Protected functions
   */

  /** Send data through the connection
   * @param {String} msg The message to send
   * @protected
   */
  send(msg) {
    this.connection.send(msg);
  }

  /** The test finished successful.
   * WARNING finished() or failed() HAS to be called by the inherited class
   * @protected
   */
  finished() {
    this.active = false;
    if (this.resolveCb) {
      this.resolveCb();
      this.resolveCb = null;
    }
  }

  /** The test failed.
   * WARNING finished() or failed() HAS to be called by the inherited class
   * @param {Error} error The error that was raised
   * @protected
   */
  failed(error) {
    this.active = false;
    if (this.rejectCb) {
      this.rejectCb(error);
      this.rejectCb = null;
    }
  }
}

export {TurnTest};
