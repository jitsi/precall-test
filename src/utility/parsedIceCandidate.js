/** Class for providing information about an ICE candidate */
class ParsedIceCandidate {
  /** Create a new object
   * @param {Object} iceCandidate the ice candidate */
  constructor(iceCandidate) {
    this.iceCandidateStr = iceCandidate.candidate;

    this.parse();
  }

  /** Parse the ICE candidate
   * @private
   */
  parse() {
    let parsed = this.iceCandidateStr.split(' ');
    if (parsed.length < 8) {
      return;
    }

    /* Candidate string examples with indices:
               0            1  2    3           4           5
       "candidate:911959162 1 udp 2113937151 192.168.1.175 49977
        6   7     8        9   10   11    12         13
       typ host generation 0 ufrag WBVw network-cost 50"

               0             1  2    3           4          5
       "candidate:3941065291 1 udp 33562367   172.18.0.2   30704
        6   7     8        9   10   11    12      13  14    15   16         17
       typ relay raddr 0.0.0.0 rport 0 generation 0 ufrag 2R2F network-cost 50"
    */

    this.protocol = (parsed[1] === '1' ? 'rtp' : 'rtcp');
    this.transport = parsed[2];
    this.typeTransport = this.extractTypeTransport(parsed[3]);

    this.ipv6 = parsed[4].indexOf(':') !== -1;
    this.ipAddress = parsed[4];
    this.port = parsed[5];

    this.type = parsed[7];
  }

  /** get the type of transport from the preference
   * @param {String} preference the preference from the ICE candidate
   * @return {String} UDP, TCP, or TLS
   * @private
   */
  extractTypeTransport(preference) {
    let ret = 'None';

    let tmp = (preference >> 24);
    if (this.protocol === 'rtp' && tmp >= 0 && tmp <= 2) {
      switch (tmp) {
        case 0:
          ret = 'TLS';
          break;
        case 1:
          ret = 'TCP';
          break;
        case 2:
          ret = 'UDP';
          break;
      }
    }

    return ret;
  };

  /** the candidate as string
   * @return {String} the candidate
   * @public
   */
  getString() {
    return this.iceCandidateStr;
  }

  /* --------- Type --------- */

  /** Type
   * @return {String} type
   * @public
   */
  getType() {
    return this.type;
  }

  /** host candidate or not
   * @return {Boolean} host or not
   * @public
   */
  isHost() {
    return this.type.toLowerCase() === 'host';
  }

  /** server reflexive candidate or not
   * @return {Boolean} reflexive or not
   * @public
   */
  isServerReflexive() {
    return this.type.toLowerCase() === 'srflx';
  }

  /** peer reflexive candidate or not
   * @return {Boolean} reflexive or not
   * @public
   */
  isPeerReflexive() {
    return this.type.toLowerCase() === 'prflx';
  }

  /** relay candidate or not
   * @return {Boolean} relay or not
   * @public
   */
  isRelay() {
    return this.type.toLowerCase() === 'relay' || this.type.toLowerCase() === 'relayed';
  }

  /** public candidate or not
   * @return {Boolean} relay or not
   * @public
   */
  isPublicIp() {
    return this.type.toLowerCase() === 'srflx' || this.type.toLowerCase() === 'prflx';
  }

  /* --------- Type transport --------- */

  /** type transport
   * @return {String} type transport (UDP, TCP, or TLS)
   * @public
   */
  getTypeTransport() {
    return this.typeTransport;
  }

  /** Type transport UDP
   * @return {Boolean} if UDP or not
   */
  isTypeTransportUdp() {
    return this.typeTransport === 'UDP';
  }

  /** Type transport TCP
   * @return {Boolean} if TCP or not
   */
  isTypeTransportTcp() {
    return this.typeTransport === 'TCP';
  }

  /** Type transport TLS
   * @return {Boolean} if TLS or not
   */
  isTypeTransportTls() {
    return this.typeTransport === 'TLS';
  }

  /* --------- Transport --------- */

  /** Transport used
   * @return {String} transport (udp or tcp)
   * @public
   */
  getTransport() {
    return this.transport;
  }

  /** UDP
   * @return {Boolean} UDP or not
   * @public
   */
  isUdp() {
    return this.transport.toLowerCase() === 'udp';
  }

  /** TCP
   * @return {Boolean} TCP or not
   * @public
   */
  isTcp() {
    return this.transport.toLowerCase() === 'tcp';
  }


  /* --------- Protocol --------- */

  /** Protocol used
   * @return {String} protocol (rtp or rtcp)
   * @public
   */
  getProtocol() {
    return this.protocol;
  }

  /** RTP
   * @return {Boolean} RTP or not
   * @public
   */
  isRtp() {
    return this.protocol === 'rtp';
  }

  /** RTCP
   * @return {Boolean} RTCP or not
   * @public
   */
  isRtcp() {
    return this.protocol === 'rtcp';
  }


  /* --------- IP/port --------- */

  /** IPv6 or not
   * @return {Boolean} ipv6 or not
   */
  isIpv6() {
    return this.ipv6;
  }

  /** IP address
   * @return {String} IP address
   * @public
   */
  getIpAddress() {
    return this.ipAddress;
  }

  /** port
   * @return {String} port
   * @public
   */
  getPort() {
    return this.port;
  }
}

export {ParsedIceCandidate};
