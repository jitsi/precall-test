import {Constants} from './detectbrowser';
import {StatsAdapter} from './statsadapter';

/** Class that handles getStats */
class GetStatsHandler {
  /**
   * Creates an instance of GetStatsHandler.
   * @param {Object} browserInfo
   * @constructor
   */
  constructor(browserInfo) {
    this.codeBase = browserInfo.codeBase;
    this.browserName = browserInfo.browserName;

    this.adapter = new StatsAdapter(this.codeBase, this.browserName);

    this.isPromiseBased = true;
  }

  /**
   * getIceCandidates - gets ice candiates information from getstats
   * @param {Object} pc
   * @public
   * @return {Promise} promise resolves when the ice candiates are obtained from getstats
   */
  getIceCandidates(pc) {
    let self = this;
    return new Promise( function(resolve, reject) {
      self.csioGetStats(self.iceCandidatesHandler.bind(self), pc, (candidatesObj) => {
        resolve(candidatesObj);
      });
    });
  }


  /**
   * iceCandidatesHandler - getstats callback handler for getting ice candidate information
   * @param {Object} stats
   * @param {Function} callback
   * @private
   */
  iceCandidatesHandler(stats, callback) {
    let candidatesObj = this.adapter.getIceCandidates(stats);
    callback(candidatesObj);
  }

  /**
   * Calls the broswer getStats promise or function
   * @private
   * @param {Function} statsHandler
   * @param {Object} pc
   * @param {Function} callback
   *
   */
  csioGetStats(statsHandler, pc, callback) {
    let firefox = Constants.codeBaseType.firefox;
    let chrome = Constants.codeBaseType.chrome;
    let edge = Constants.codeBaseType.edge;
    let safari = Constants.browserName.safari;

    if (!pc) {
      return;
    }

    if (this.codeBase === firefox) {
      this.getStatsFirefox(statsHandler, pc, callback);
    } else if (this.browserName === safari) {
      this.getStatsSafari(statsHandler, pc, callback);
    } else if (this.codeBase === chrome) {
      this.getStatsChrome(statsHandler, pc, callback);
    } else if (this.codeBase === edge) {
      this.getStatsEdge(statsHandler, pc, callback);
    }
  }

  /**
   * Calls the broswer getStats promise or function for firefox
   * @private
   * @memberof GetStatsHandler
   * @param {Function} statsHandler
   * @param {Object} pc
   * @param {Function} callback
   */
  getStatsFirefox(statsHandler, pc, callback) {
    let self = this;

    if (!self.isPromiseBased) {
      pc.getStats(null, (stats) => {
        statsHandler(stats, callback);
      }, () => {});
      return;
    }

    try {
      pc.getStats()
      .then((stats) => {
        statsHandler(stats, callback);
      })
      .catch(function(e) {
        self.isPromiseBased = false;
        pc.getStats(null, (stats)=>{
          statsHandler(stats, callback);
        }, () => {});
      });
    } catch (e) {
      self.isPromiseBased = false;
      pc.getStats(null, (stats) => {
        statsHandler(stats, callback);
      }, () => {});
    }
  }

  /**
   * Calls the broswer getStats promise or function for chrome
   * @private
   * @memberof GetStatsHandler
   * @param {Function} statsHandler
   * @param {Object} pc
   * @param {Function} callback
   */
  getStatsChrome(statsHandler, pc, callback) {
    let self = this;

    if (window && window.csioReactNative) {
      pc.getStats(null, (stats) => {
        statsHandler(stats, callback);
      },
      function logError(e) {
      });
      return;
    }

    if (!self.isPromiseBased) {
      pc.getStats((stats) => {
        statsHandler(stats, callback);
      });
      return;
    }

    try {
      pc.getStats()
      .then((stats) => {
        statsHandler(stats, callback);
      })
      .catch(function(e) {
         // console.error('Error ', e);
        self.isPromiseBased = false;
        pc.getStats((stats) => {
          statsHandler(stats, callback);
        });
      });
    } catch (e) {
      // todo @karthik can you please check whether it will be self.isPromiseBased or not ?
      self.isPromiseBased = false;
      pc.getStats((stats) => {
        statsHandler(stats, callback);
      });
    }
  }

  /**
   * Calls the broswer getStats for edge
   * @private
   * @memberof GetStatsHandler
   * @param {Function} statsHandler
   * @param {Object} pc
   * @param {Function} callback
   */
  getStatsEdge(statsHandler, pc, callback) {
    pc.getStats()
    .then((stats) => {
      statsHandler(stats, callback);
    })
    .catch(function(e) {
    });
  }

  /**
   * Calls the broswer getStats for safari
   * @private
   * @memberof GetStatsHandler
   * @param {Function} statsHandler
   * @param {Object} pc
   * @param {Function} callback
   */
  getStatsSafari(statsHandler, pc, callback) {
    pc.getStats()
    .then((stats) => {
       statsHandler(stats, callback);
    })
    .catch(function(e) {
    });
  }
}

export {GetStatsHandler};
