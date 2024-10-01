import {ParsedIceCandidate} from './utility/parsedIceCandidate';
import {GetStatsHandler} from './utility/stats/getstatshandler';
import {Constants} from './utility/stats/detectbrowser';

const ICE_CHECKING_TIMEOUT = 10000;
const CONNECTION_TIMEOUT = 30000;

class TurnConnection {
  /**
   * Create a new instance
   * @param {Object} browserInfo
   */
  constructor(browserInfo) {
    this.reset();

    this.statshandler = new GetStatsHandler(browserInfo);
  }

  /**
   * Reset the module
   */
  reset() {
    this.disconnect();

    this.iceServers = null;

    this.pctpc1 = null;
    this.pctpc2 = null;

    this.sendChannel = null;

    this.messageCallback = null;
    this.errorCallback = null;

    this.parsedIceResults = {};

    this.resolveCb = null;
    this.rejectCb = null;
    this.localIpAddressInfo = [];
    this.localIpAddresses = [];
    this.localIp = null;
    this.localIpType = null;
    this.numberOfLocalIp = 0;
  }

  setMessageCallback(func) {
    this.messageCallback = func;
  }

  setErrorCallback(func) {
    this.errorCallback = func;
  }

  send(data) {
    if (this.sendChannel && this.sendChannel.readyState === 'open') {
      try {
        this.sendChannel.send(data);
      } catch (error) {
        this.raiseSendError(new Error('Send channel Error'));
      }
    } else {
      this.raiseSendError(new Error('No send channel'));
    }
  }

  raiseSendError(error) {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
    // console.error('sendChannel error:', error);
  }

  assignEvent(obj, ev, func) {
    if (obj.addEventListener) {
      obj.addEventListener(ev, func.bind(this), false);
    } else if (obj.attachEvent) {
      ev = 'on' + ev;
      obj.attachEvent(ev, func.bind(this));
    }
  }

  /**
   * Start the TURN connection
   * @param {JSON} iceServers
   * @return {Promise} resolves when the datachannel is open
   */
  connect(iceServers) {
    this.reset();

    let promise = new Promise((resolve, reject) => {
      this.resolveCb = resolve;
      this.rejectCb = reject;
    });

    this.iceServers = iceServers;

    let CSRTCPeerConnection = null;
    try {
      if (RTCPeerConnection) {
        CSRTCPeerConnection = RTCPeerConnection;
      } else if (webkitRTCPeerConnection) {
        CSRTCPeerConnection = webkitRTCPeerConnection;
      } else if (mozRTCPeerConnection) {
        CSRTCPeerConnection = mozRTCPeerConnection;
      } else if (window && window.RTCPeerConnection) {
        CSRTCPeerConnection = window.RTCPeerConnection;
      }

      if (!CSRTCPeerConnection) {
        let err = new Error('RTCPeerConnection not found');
        err.continueFlag = false,
        this.rejectCb(err);
        return promise;
      }
    } catch (err) {
        err.continueFlag = false,
        this.rejectCb(err);
        return promise;
    }

    // Settings
    let datachannelLabel = 'precalltest';
    let datachannelSettings = {
      ordered: false,
      maxRetransmits: 0,
    };
    let servers = {
      'iceTransportPolicy': 'all',
      'iceServers': this.iceServers,
    };
    // console.log('ICE servers:', servers);

    // PeerConnection objects
    try {
      this.pctpc1 = new CSRTCPeerConnection(servers);
      this.pctpc2 = new CSRTCPeerConnection(servers);
    } catch (err) {
      // console.error('Error creating PCs:', err);
      this.rejectDisconnect(false, new Error('Error creating PCs'));
      return promise;
    }

    // console.log('created pcs:', this.pctpc1, this.pctpc2);

    // make sure the connection gets closed at some point
    this.connectionTimer = setTimeout(() => {
      // console.error('Connection timeout');
      delete this.connectionTimer;
      this.rejectDisconnect(false, new Error('Connection timeout'));
    }, CONNECTION_TIMEOUT);

    try {
      // Datachannel as only source
      this.sendChannel = this.pctpc1.createDataChannel(datachannelLabel, datachannelSettings);
       // console.log('created datachannel');
      this.sendChannel.binaryType = 'arraybuffer';
      this.assignEvent(this.sendChannel, 'error', (error) => {
        // console.error('Datachannel error:', error);
        this.raiseSendError(new Error('Datachannel error'));
        this.rejectDisconnect(true, new Error('Datachannel error'));
      });
       // console.log('add onerror event');
      this.assignEvent(this.pctpc2, 'datachannel', (event) => {
        let channel = event.channel;
        this.assignEvent(channel, 'open', (event) => {
          if (this.resolveCb) {
            this.resolveCb();
            this.resolveCb = null;
          }
        });
        this.assignEvent(channel, 'close', (event) => {
          if (this && this.disconnect) {
            // console.log('datachannel close');
            this.disconnect();
          }
        });
        this.assignEvent(channel, 'message', (event) => {
          if (this.messageCallback) {
            this.messageCallback(event.data);
          }
        });
        this.assignEvent(channel, 'error', (error) => {
          if (this.errorCallback) {
            this.errorCallback(error);
          }
          // console.error('receiveChannel error:', error);
          this.rejectDisconnect(true, new Error('receiveChannel error'));
        });
      });
    } catch (err) {
      // console.error('Error adding datachannel:', err);
      this.rejectDisconnect(false, new Error('Error adding datachannel'));
      return promise;
    }

    try {
      // Set callbacks for connection procedure
      this.assignEvent(this.pctpc1, 'icecandidate', (e) => {
        this.onIceCandidate(this.pctpc1, e);
      });
      this.assignEvent(this.pctpc1, 'iceconnectionstatechange', (e) => {
        this.onIceStateChange(this.pctpc1, e);
      });

      this.assignEvent(this.pctpc2, 'icecandidate', (e) => {
        this.onIceCandidate(this.pctpc2, e);
      });
      this.assignEvent(this.pctpc2, 'iceconnectionstatechange', (e) => {
        this.onIceStateChange(this.pctpc2, e);
      });

      // Start connection procedure
      // console.log('pctpc1 createOffer start');
      this.pctpc1.createOffer()
      .then(
        (desc, test) => {
          this.onCreateOfferSuccess(desc);
        },
        (e) => {
          this.onCreateOfferError(this.pctpc1, e);
        }
      );
    } catch (err) {
      // console.error('Error starting connection:', err);
      this.rejectDisconnect(false, new Error('Error starting connection'));
      return promise;
    }

    return promise;
  }

  /**
   * Reject and disconnect
   * @param {Boolean} continueFlag indicate if it should be tried again
   * @param {Error} err the occured error
   */
  rejectDisconnect(continueFlag, err) {
    this.disconnect();
    if (this.rejectCb) {
      // console.log('rejectDisconnect');
      err.continueFlag = continueFlag;
      this.rejectCb(err);
    }

    this.resolveCb = null;
    this.rejectCb = null;
  }

  /**
   * Stop the precall tests
   */
  disconnect() {
    // console.log('disconnect');
    clearTimeout(this.connectionTimer);
    clearTimeout(this.iceTimer);
    if (this.sendChannel) {
      try {
        this.sendChannel.close();
      } catch (err) {
        // console.error(err);
      }
    }

    if (this.pctpc1) {
      try {
        this.pctpc1.close();
      } catch (err) {
        // console.error(err);
      }
    }
    this.pctpc1 = null;

    if (this.pctpc2) {
      try {
        this.pctpc2.close();
      } catch (err) {
        // console.error(err);
      }
    }
    this.pctpc2 = null;
  }

  /*
   * PRIVATE: Methods for connection procedure
   */
  getName(pc) {
    return (pc === this.pctpc1) ? 'pctpc1' : 'pctpc2';
  }

  getOtherPc(pc) {
    return (pc === this.pctpc1) ? this.pctpc2 : this.pctpc1;
  }

  onCreateOfferError(pc, error) {
    // console.error('Failed to create offer: ' + error.toString());
    this.rejectDisconnect(false, new Error('Failed to create offer'));
  }

  onCreateAnswerError(pc, error) {
    // console.error('Failed to create answer: ' + error.toString());
    this.rejectDisconnect(false, new Error('Failed to create answer'));
  }

  onCreateOfferSuccess(desc) {
    try {
      // console.log('Offer from pctpc1, pctpc1 setLocalDescription start', this.pctpc1);
      this.pctpc1.setLocalDescription(desc).then(
        () => {
          this.onSetLocalSuccess(this.pctpc1);
        },
        (e) => {
          this.onSetSessionDescriptionError(this.pctpc1, e);
        }
      );
       // console.log('pctpc2 setRemoteDescription start');
      this.pctpc2.setRemoteDescription(desc).then(
        () => {
          this.onSetRemoteSuccess(this.pctpc2);
        },
        (e) => {
          this.onSetRemoteSessionDescriptionError(this.pctpc2, e);
        }
      );
      // console.log('pctpc2 createAnswer start');
      // Since the 'remote' side has no media stream we need
      // to pass in the right constraints in order for it to
      // accept the incoming offer of audio and video.
      this.pctpc2.createAnswer().then(
        (desc) => {
          this.onCreateAnswerSuccess(desc);
        },
        (e) => {
          this.onCreateAnswerError(this.pctpc2, e);
        }
      );
    } catch (err) {
      // console.error('Error processing offer:', err);
      this.rejectDisconnect(false, new Error('Error processing offer'));
    }
  }

  onSetLocalSuccess(pc) {
     (this.getName(pc) + ' setLocalDescription complete');
  }

  onSetRemoteSuccess(pc) {
     (this.getName(pc) + ' setRemoteDescription complete');
  }

  onSetSessionDescriptionError(pc, error) {
    // console.error('Failed to set session description: ' + error.toString());
    this.rejectDisconnect(false, new Error('Failed to set session description'));
  }

  onSetRemoteSessionDescriptionError(pc, error) {
    // console.error('Failed to set session description: ' + error.toString());
    this.rejectDisconnect(false, new Error('Failed to set session description'));
  }

  onCreateAnswerSuccess(desc) {
    try {
      // console.log('Answer from pctpc2, pctpc2 setLocalDescription start');
      this.pctpc2.setLocalDescription(desc).then(
        () => {
          this.onSetLocalSuccess(this.pctpc2);
        },
        (e) => {
          this.onSetSessionDescriptionError(this.pctpc2, e);
        }
      );
      // console.log('pctpc1 setRemoteDescription start');
      this.pctpc1.setRemoteDescription(desc).then(
        () => {
          this.onSetRemoteSuccess(this.pctpc1);
        },
        (e) => {
          this.onSetRemoteSessionDescriptionError(this.pctpc1, e);
        }
      );
    } catch (err) {
      // console.error('Error processing answer:', err);
      this.rejectDisconnect(false, new Error('Error processing answer'));
    }
  }

  onIceCandidate(pc, event) {
    try {
      // null - indicates iceGatheringState is complete
      if (!event.candidate) {
        return;
      }
      // end-of-candidates -  indicates end of generation of candidates
      // https://github.com/w3c/webrtc-pc/issues/1952#issuecomment-416645360
      if (!event.candidate.candidate) {
        return;
      }

      // only add relay candidates
      let parsed = new ParsedIceCandidate(event.candidate);

      if (pc == this.pctpc1) {
        // console.log('candidate:', parsed.getType(), parsed);

        if (this.statshandler.codeBase == Constants.codeBaseType.chrome) {
          // check seen candidates for Chrome (doesn't work reliably with getStats)
          if (parsed.isRelay()) {
            if (parsed.isTypeTransportUdp()) {
              this.parsedIceResults.relayUdpGathered = true;
            }
            if (parsed.isTypeTransportTcp()) {
              this.parsedIceResults.relayTcpGathered = true;
            }
            if (parsed.isTypeTransportTls()) {
              this.parsedIceResults.relayTlsGathered = true;
            }
          }

          if (parsed.isServerReflexive()) {
            this.parsedIceResults.srflxGathered = true;
          }
        }
      }

      if (!parsed.isRelay()) {
        if (!this.localIpAddresses.includes(parsed.getIpAddress())) {
          this.localIpAddresses.push(parsed.getIpAddress());
          this.localIpAddressInfo.push({
            ip: parsed.getIpAddress(),
            candidateType: parsed.getType(),
            networkType: 'unknown',
          });
          if (parsed.isPublicIp()) {
            this.numberOfLocalIp++;
          }
        }
        if (parsed.isPublicIp() && this.localIp === null) {
          this.localIp = parsed.getIpAddress();
          this.localIpType = parsed.getType();
        }
        return;
      }

      this.getOtherPc(pc).addIceCandidate(event.candidate)
      .then(
        () => {
          this.onAddIceCandidateSuccess(pc);
        },
        (err) => {
          this.onAddIceCandidateError(pc, err, parsed.isRelay());
        }
      );
    } catch (err) {
      // console.error('Error processing ICE candidate:', err);
      this.rejectDisconnect(false, err);
    }
  }

  onAddIceCandidateSuccess(pc) {
     (this.getName(pc) + ' addIceCandidate success');
  }

  onAddIceCandidateError(pc, error, isRelay) {
    // console.error(this.getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
    if (isRelay) {
      this.rejectDisconnect(false, new Error('failed to add ICE Candidate'));
    }
  }

  onIceStateChange(pc, event) {
    try {
      let newstate = '(?)';
      if (pc) {
        newstate = pc.iceConnectionState;
      }
      if (newstate === 'failed') {
        // console.error('ICE failure');
        this.rejectDisconnect(true, new Error('ICE failure'));
      }

      // timeout, since chrome seems to be stuck in checking
      if (newstate === 'checking' && !this.iceTimer) {
        this.iceTimer = setTimeout(() => {
          delete this.iceTimer;
          // console.error('ICE timeout');
          this.rejectDisconnect(true, new Error('ICE timeout'));
        }, ICE_CHECKING_TIMEOUT);
      }
      if (newstate === 'completed' || newstate === 'connected') {
        clearTimeout(this.iceTimer);
        delete this.iceTimer;
      }

      // console.warn('ICE state change:', newstate);
    } catch (err) {
      // console.error('Error processing ICE state change:', err);
      this.rejectDisconnect(false, new Error('Error processing ICE state change'));
    }
  }

  getIceResults() {
    return new Promise((resolve, reject) => {
      let iceServers = JSON.parse(JSON.stringify(this.iceServers)); // deepcopy, needed for react native
      for (let i = 0; i < iceServers.length; i++) {
        let server = iceServers[i];
        if (!iceServers.hasOwnProperty(server)) {
          delete server.credential;
        }
      };

      let iceResults = {
        turnIpAddress: '',
        turnIpVersion: '',
        turnTransport: '',
        iceServers: iceServers,
        ipv6Supported: false,
        ipv4Supported: false,
        relayTlsGathered: false,
        relayTcpGathered: false,
        relayUdpGathered: false,
        srflxGathered: false,
        relayTlsSuccess: false,
        relayTcpSuccess: false,
        relayUdpSuccess: false,
        srflxSuccess: false,
        localIpAddressInfo: [],
        localIP: '',
        numberOfLocalIPs: 0,
        localIPType: '',
        localIPNetworkType: '',
      };

      // merge results from parsed ICE candidates (to get Chrome's seen candidates)
      for (let entry in this.parsedIceResults) {
        if (this.parsedIceResults.hasOwnProperty(entry)) {
          iceResults[entry] = this.parsedIceResults[entry];
        }
      }

      // get stats
      if (!this.pctpc1) {
        reject(new Error('PC not available for stats'));
        return;
      }
      this.statshandler.getIceCandidates(this.pctpc1).then((results) => {
         // console.log('ICE results:', results);
        iceResults.localIP = this.localIp;
        iceResults.localIPType = this.localIpType;
        iceResults.numberOfLocalIPs = this.numberOfLocalIp;
        for (let j = 0; j < this.localIpAddressInfo.length; j++) {
          let ipInfo = this.localIpAddressInfo[j];
          for (let i = 0; i < results.localCandidates.length; i++) {
            let candidate = results.localCandidates[i];
            let ip = null;
            if (candidate.ip) {
              ip = candidate.ip;
            } else if (candidate.address) {
              ip = candidate.address;
            } else {
              ip = candidate.ipAddress;
            }
            if (ip === ipInfo.ip && candidate.networkType !== 'unknown') {
              ipInfo.networkType = candidate.networkType;
            }
          }
          iceResults.localIpAddressInfo.push(ipInfo);
        }

        let foundActiveCand = false;
        for (let i = 0; i < results.iceCandidatePairs.length; i++) {
          let pair = results.iceCandidatePairs[i];
          const googActiveConnection = typeof pair.googActiveConnection === 'string' ?
              pair.googActiveConnection === 'true' : pair.googActiveConnection;
          const selected = typeof pair.selected === 'string' ?
              pair.selected === 'true' : pair.selected;
          if (googActiveConnection || selected) {
            for (let i = 0; i < results.localCandidates.length; i++) {
              let cand = results.localCandidates[i];
              // figure out IP address
              let ip = null;
              if (cand.ip) {
                ip = cand.ip;
              } else if (cand.address) {
                ip = cand.address;
              } else {
                ip = cand.ipAddress;
              }

              // fill infos for active pair
              if (cand.id == pair.localCandidateId) {
                 // console.log('Active candidate local transport:', cand);

                iceResults.turnIpAddress = ip;
                iceResults.turnNetworkType = cand.networkType;
                iceResults.localIPNetworkType = cand.networkType;
                let ipv6 = ip.indexOf(':') !== -1;
                iceResults.turnIpVersion = ipv6?'ipv6':'ipv4';

                iceResults.turnTransport = cand.mozLocalTransport;

                foundActiveCand = true;
              }
              /* For Chrome, the active candidate sometimes is not in 'succeeded' state,
                  so it would not trigger the normal relay*Succeeded setting below ..
              */
              if (cand.candidateType === 'relay' || cand.candidateType === 'relayed') {
                if (cand.mozLocalTransport === 'udp') {
                  iceResults.relayUdpSuccess = true;
                }
                if (cand.mozLocalTransport === 'tcp') {
                  iceResults.relayTcpSuccess = true;
                }
                if (cand.mozLocalTransport === 'tls') {
                  iceResults.relayTlsSuccess = true;
                }
              }

              if (!ip) {
                continue;
              }
              // IPv6 candidate seen?
              if (ip.indexOf(':') !== -1) {
                iceResults.ipv6Supported = true;
              } else {
                iceResults.ipv4Supported = true;
              }
            }
          }
        }

        // NOTE candidate and pair checking is unreliable for getStats (e.g. chrome doesnt necessarily generate stats for all candidates)

        // check for existing candidates
        for (let i = 0; i < results.localCandidates.length; i++) {
          let cand = results.localCandidates[i];
          if (cand.candidateType === 'relay' || cand.candidateType === 'relayed') {
            if (cand.mozLocalTransport === 'udp') {
              iceResults.relayUdpGathered = true;
            }
            if (cand.mozLocalTransport === 'tcp') {
              iceResults.relayTcpGathered = true;
            }
            if (cand.mozLocalTransport === 'tls') {
              iceResults.relayTlsGathered = true;
            }
          }

          if (cand.candidateType === 'srflx' || cand.candidateType === 'serverreflexive') {
            iceResults.srflxGathered = true;
          }
        }

        // check for successful pairs
        for (let i = 0; i < results.iceCandidatePairs.length; i++) {
          let pair = results.iceCandidatePairs[i];
          if (pair.state === 'succeeded') {
            for (let i = 0; i < results.localCandidates.length; i++) {
              let cand = results.localCandidates[i];
              if (cand.id == pair.localCandidateId) {
                if (cand.candidateType === 'relay' || cand.candidateType === 'relayed') {
                  if (cand.mozLocalTransport === 'udp') {
                    iceResults.relayUdpSuccess = true;
                  }
                  if (cand.mozLocalTransport === 'tcp') {
                    iceResults.relayTcpSuccess = true;
                  }
                  if (cand.mozLocalTransport === 'tls') {
                    iceResults.relayTlsSuccess = true;
                  }
                }

                if (cand.candidateType === 'srflx' || cand.candidateType === 'serverreflexive') {
                  iceResults.srflxSuccess = true;
                }
              }
            }
          }
        }

        if (!foundActiveCand) {
          // console.error('Active ICE candidate pair not found.');
        }
        resolve(iceResults);
      },
      (e) => {
        reject(e);
      });
    },
    (e) => {
      reject(e);
    });
  }
}

export {TurnConnection};
