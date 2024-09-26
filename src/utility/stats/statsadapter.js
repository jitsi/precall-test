import {Constants} from './detectbrowser';


/** Represents a adapter for the result of getStats*/
class StatsAdapter {
  /**
  * Create a StatsAdapter Component for parsing WebRTC getStats
  * @param {Object} codeBase The codebase for the stats
  * @param {Object} browser The browser for the stats
  * @constructor
  */
  constructor(codeBase, browser) {
    this.codeBase = codeBase;
    this.browser = browser;
  }

  /**
   * getIceCandidates - Obtains ice candidates from stats
   *
   * @param {Object} rawData - Raw data by browser on getstats call/promise.
   *
   * @return {Object} Ice candidate information
   */
  getIceCandidates(rawData) {
    if (!rawData) {
      return {localCandidates: [], remoteCandidates: [],
        iceCandidatePairs: []};
    }
    let rawStats = this.extractRawStats(rawData);
    let result = this.processRawStatsForIceInfo(rawStats);
    return result;
  }

  /**
   * extractRawStats - extracts the objects from raw stats
   * @private
   * @param {Object} rawStats raw stats from browser
   *
   * @return {Object[]} Array of Objects from raw stats
   */
  extractRawStats(rawStats) {
    let results = [];
    let key;

    let firefox = Constants.codeBaseType.firefox;
    let chrome = Constants.codeBaseType.chrome;
    let safari = Constants.browserName.safari;
    if (this.codeBase === firefox && this.browser !== safari) {
      rawStats.forEach(function(item) {
        results.push(item);
      });
    } else if (this.codeBase === chrome && this.browser !== safari) {
      if (rawStats && rawStats.result) {
        results = rawStats.result();
      } else if (rawStats && rawStats.forEach) {
        results = [];
        rawStats.forEach(function(item) {
          results.push(item);
        });
      }
    } else {
      for (key in rawStats) {
        if (rawStats.hasOwnProperty(key)) {
          results.push(rawStats[key]);
        }
      }
    }
    return results;
  }

  /**
   * processRawStatsForIceInfo - process the raw stats to obtain ICE related information
   *
   * @param {Object} rawStats extracted raw stats
   *
   * @return {Object} Ice information
   */
  processRawStatsForIceInfo(rawStats) {
    let localCandidates = [];
    let remoteCandidates = [];
    let candidatePairs = [];
    let selectedCandidatePairId;

    if (!rawStats) {
      return {localCandidates: localCandidates, remoteCandidates: remoteCandidates,
        iceCandidatePairs: candidatePairs};
    }

    for (let i = 0; i < rawStats.length; ++i) {
      let parsedStats = this.getParsedStats(rawStats[i]);
      let classifiedStats = this.statsClassifier(parsedStats);
      if (classifiedStats.candidatePair) {
        candidatePairs.push(classifiedStats.candidatePair);
      } else if (classifiedStats.transportStats) {
        if (classifiedStats.transportStats.type === 'transport') {
          selectedCandidatePairId = classifiedStats.transportStats.selectedCandidatePairId;
          continue;
        }
        candidatePairs.push(classifiedStats.transportStats);
      } else if (classifiedStats.localCandidate) {
        let cand = classifiedStats.localCandidate;
        if (cand.candidateType == 'relay' || cand.candidateType == 'relayed') {
          if (!cand.mozLocalTransport) {
            // assume Chrome, get it from the priority
            let relayType = cand.priority >> 24;
            cand.mozLocalTransport = this.formatRelayType(relayType);
          }
          cand.mozLocalTransport = cand.mozLocalTransport.toLowerCase();
        }
        localCandidates.push(cand);
      } else if (classifiedStats.remoteCandidate) {
        remoteCandidates.push(classifiedStats.remoteCandidate);
      }
    }

    if (selectedCandidatePairId) {
      for (let i=0; i < candidatePairs.length; ++i) {
        if (candidatePairs[i].id === selectedCandidatePairId) {
          candidatePairs[i].googActiveConnection = 'true';
        }
      }
    }

    return {localCandidates: localCandidates, remoteCandidates: remoteCandidates,
      iceCandidatePairs: candidatePairs};
  }

  /**
   * getParsedStats - Parse the each raw stats object to dictionary
   * @private
   * @param {Object} rawStats raw stats object from browser
   * @return {Object} parsed stats dictionary
   */
  getParsedStats(rawStats) {
    let stats = {};
    if (rawStats.timestamp instanceof Date) {
      stats.timestamp = rawStats.timestamp.getTime().toString();
    }

    if (rawStats.type) {
      stats.type = rawStats.type;
    }

    if (rawStats.names) {
      let names = rawStats.names();
      for (let i = 0; i < names.length; ++i) {
        stats[names[i]] = rawStats.stat(names[i]);
      }
    } else {
      Object.assign(stats, rawStats);
    }

    // for react-native, values is a array of objects each contains a single -
    // stat value
    if (stats.values) {
      for (let i = 0; i < stats.values.length; i++) {
        let values = stats.values[i];
        Object.assign(stats, values);
      }
      delete stats.values;
    }
    return stats;
  }

  /**
   * statsClassifier - classifies the parsed stats dictionary
   * @private
   * @param {Object} stats dictionary
   * @return {Object} stats dictionary after on classification
   */
  statsClassifier(stats) {
    let result = {};
    let isType = (...expectedTypes) => {
      for (let i = 0; i < expectedTypes.length; i++) {
        let expectedType = expectedTypes[i];
        if (stats.type === expectedType) {
          return true;
        }
      }
      return false;
    };

    let typeIsInbound = isType('inbound-rtp', 'inboundrtp');
    let isRemote = (stats.isRemote === 'true' || stats.isRemote === true);
    if (typeIsInbound || isType('outbound-rtp', 'outboundrtp')) {
      result.tracks = {};
      result.tracks.data = stats;
      result.tracks.ssrc = stats.ssrc;
      result.tracks.streamType = typeIsInbound ? 'inbound' : 'outbound';
      result.tracks.reportType = 'local';
      if (stats.isRemote !== undefined) {
        result.tracks.reportType = isRemote ? 'remote' : 'local';
      }
    } else if (isType('candidatepair') && stats.selected) {
      result.transportStats = stats;
    } else if (isType('localcandidate', 'local-candidate')) {
      result.localCandidate = stats;
    } else if (isType('remotecandidate', 'remote-candidate')) {
      result.remoteCandidate = stats;
    } else if (isType('transport', 'googCandidatePair')) {
      result.transportStats = stats;
    } else if (isType('VideoBwe')) {
      result.bwe = stats;
    } else if (isType('track')) {
      result.trackStats = stats;
    } else if (isType('candidate-pair')) {
      result.candidatePair = stats;
    } else if (isType('codec')) {
      result.codec = stats;
    } else if (isType('ssrc')) {
      result.tracks = {};
      result.tracks.data = stats;
      result.tracks.ssrc = stats.ssrc;
      result.tracks.reportType = 'local';
      result.tracks.streamType = (stats.bytesSent) ? 'outbound' : 'inbound';
    }
    return result;
  }

   /**
    * formatRelayType - returns the formated realayType
    *
    * @param {Number} relayType
    *
    * @return {String} formated relayType string
    */
   formatRelayType(relayType) {
    let ret = 'none';
    switch (relayType) {
      case 0:
        ret = 'tls';
        break;
      case 1:
        ret = 'tcp';
        break;
      case 2:
        ret = 'udp';
        break;
    }
    return ret;
  }
}

export {StatsAdapter};
