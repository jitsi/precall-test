export const Constants = {
  codeBaseType: {
    chrome: 'Chrome',
    firefox: 'Firefox',
    edge: 'Edge',
    plugin: 'Plugin',
  },

  browserName: {
    chrome: 'Chrome',
    firefox: 'Firefox',
    edge: 'Edge',
    msie: 'Microsoft Internet Explorer',
    safari: 'Safari',
  },

  osName: {
    windows: 'Windows',
    mac: 'Mac OS X',
    android: 'Android',
    ios: 'iOS',
  },
};

/**
 * detect - Detect the browser related inforamtion
 * @public
 * @return {Object} Browser and OS information
 */
export function detect() {
  let browserName = Constants.browserName.chrome;
  let osName = null;
  let osVersion = null;
  let userAgent = null;
  let agentVersion = null;

  let codeBaseType = Constants.codeBaseType.chrome;

  if (window && (!window.navigator || !window.navigator.userAgent || window.csioReactNative)) {
    if (window && window.csioGetOsName) {
      osName = window.csioGetOsName();
    }

    if (window && window.csioGetOsVer) {
      osVersion = window.csioGetOsVer();
    }

    if (window && window.csioReactNative) {
      userAgent = 'react-native';
    }

    return {
      browserName: browserName,
      codeBase: codeBaseType,
      os: osName,
      osVersion: osVersion,
      userAgent: userAgent,
    };
  }

  userAgent = navigator.userAgent;
  let nAgt = userAgent.toLowerCase();

  agentVersion = navigator.appVersion;
  let nVer;
  let fullVersion;
  if (agentVersion) {
    nVer = agentVersion.toLowerCase();
    fullVersion = '' + parseFloat(nVer);
  }
  let verOffset;
  let version = 'version';


  // In Opera, the true version is after "Opera" or after "Version"
  if ((verOffset = nAgt.indexOf('opera')) !== -1) {
    browserName = Constants.browserName.opera;
    fullVersion = nAgt.substring(verOffset + 6);
    if ((verOffset = nAgt.indexOf(version)) !== -1) {
      fullVersion = nAgt.substring(verOffset + 8);
    }
    codeBaseType = Constants.codeBaseType.chrome;
  } else if ((verOffset = nAgt.indexOf('opr')) !== -1) {
    browserName = Constants.browserName.opera;
    fullVersion = nAgt.substring(verOffset + 4);
    if ((verOffset = nAgt.indexOf(version)) !== -1) {
      fullVersion = nAgt.substring(verOffset + 8);
    }
    codeBaseType = Constants.codeBaseType.chrome;
  } else if ((verOffset = nAgt.indexOf('msie')) !== -1) { // In MSIE, the true version is after "MSIE" in userAgent
    browserName = Constants.browserName.msie;
    fullVersion = nAgt.substring(verOffset + 5);
    codeBaseType = Constants.codeBaseType.chrome;
  } else if ((verOffset = nAgt.indexOf('edge')) !== -1) {
    browserName = Constants.browserName.edge;
    fullVersion = nAgt.substring(verOffset + 5);
    codeBaseType = Constants.codeBaseType.edge;
  } else if ((verOffset = nAgt.indexOf('edg')) !== -1) {
    browserName = Constants.browserName.edge;
    fullVersion = nAgt.substring(verOffset + 4);
    codeBaseType = Constants.codeBaseType.chrome;
  } else if ((verOffset = nAgt.indexOf('chrome')) !== -1) { // In Chrome, the true version is after "Chrome"
    browserName = Constants.browserName.chrome;
    fullVersion = nAgt.substring(verOffset + 7);
    codeBaseType = Constants.codeBaseType.chrome;
  } else if ((verOffset = nAgt.indexOf('safari')) !== -1) { // In Safari, the true version is after "Safari" or after "Version"
    browserName = Constants.browserName.safari;
    fullVersion = nAgt.substring(verOffset + 7);
    if ((verOffset = nAgt.indexOf(version)) !== -1) {
      fullVersion = nAgt.substring(verOffset + 8);
      if (fullVersion) {
        let version = fullVersion.split(' ');
        if (version && version.length > 0) {
          fullVersion = version[0];
        }
      }
    }
    codeBaseType = Constants.codeBaseType.chrome;
  } else if ((verOffset = nAgt.indexOf('firefox')) !== -1) { // In Firefox, the true version is after "Firefox"
    browserName = Constants.browserName.firefox;
    fullVersion = nAgt.substring(verOffset + 8);
    codeBaseType = Constants.codeBaseType.firefox;
  } else if ((verOffset = nAgt.indexOf('trident')) !== -1) { // IE 11 has no MSIE
    browserName = Constants.browserName.msie;
    verOffset = nAgt.indexOf('rv'); // In IE11, the true version is after "rv"
    fullVersion = nAgt.substring(verOffset + 3, verOffset + 7);
    codeBaseType = Constants.codeBaseType.chrome;
  }

  // system
  // source: http://jsfiddle.net/ChristianL/AVyND/
  let clientStrings = [
    {s: 'Windows 3.11', r: /win16/},
    {s: 'Windows 95', r: /(windows 95|win95|windows_95)/},
    {s: 'Windows ME', r: /(win 9x 4.90|windows me)/},
    {s: 'Windows 98', r: /(windows 98|win98)/},
    {s: 'Windows CE', r: /windows ce/},
    {s: 'Windows 2000', r: /(windows nt 5.0|windows 2000)/},
    {s: 'Windows XP', r: /(windows nt 5.1|windows xp)/},
    {s: 'Windows Server 2003', r: /windows nt 5.2/},
    {s: 'Windows Vista', r: /windows nt 6.0/},
    {s: 'Windows 7', r: /(windows 7|windows nt 6.1)/},
    {s: 'Windows 8.1', r: /(windows 8.1|windows nt 6.3)/},
    {s: 'Windows 8', r: /(windows 8|windows nt 6.2)/},
    {s: 'Windows 10', r: /(windows 10|windows nt 10.0)/},
    {s: 'Windows NT 4.0', r: /(windows nt 4.0|winnt4.0|winnt|windows nt)/},
    {s: 'Windows ME', r: /windows me/},
    {s: 'Android', r: /android/},
    {s: 'Open BSD', r: /openbsd/},
    {s: 'Sun OS', r: /sunos/},
    {s: 'Linux', r: /(linux|x11)/},
    {s: 'iOS', r: /(iphone|ipad|ipod)/},
    {s: 'Mac OS X', r: /mac os x/},
    {s: 'Mac OS', r: /(macppc|macintel|mac_powerpc|macintosh)/},
    {s: 'QNX', r: /qnx/},
    {s: 'UNIX', r: /unix/},
    {s: 'BeOS', r: /beos/},
    {s: 'OS/2', r: /os\/2/},
    {s: 'Search Bot', r: /(nuhk|googlebot|yammybot|openbot|slurp|msnbot|ask jeeves\/teoma|ia_archiver)/},
  ];

  let id;
  let cs;
  for (id in clientStrings) {
    if (!clientStrings.hasOwnProperty(id)) {
      continue;
    }
    cs = clientStrings[id];
    if (cs.r.test(nAgt)) {
      osName = cs.s;
      break;
    }
  }


  if (osName && (/Windows/.test(osName))) {
    osVersion = /Windows (.*)/.exec(osName)[1];
    osName = Constants.osName.windows;
  }

  switch (osName) {
    case Constants.osName.mac:
      osVersion = /mac os x (1[\.\_\d]+)/.exec(nAgt);
      if (!osVersion) {
        break;
      }
      osVersion = osVersion[1];
      break;
    case Constants.osName.android:
      osVersion = /android ([\.\_\d]+)/.exec(nAgt);
      if (!osVersion) {
        break;
      }
      osVersion = osVersion[1];
      break;
    case Constants.osName.ios:
      if (!nVer) {
        break;
      }
      osVersion = /os (\d+)_(\d+)_?(\d+)?/.exec(nVer);
      if (!osVersion) {
        break;
      }
      osVersion = osVersion[1] + '.' + osVersion[2] + '.' + (osVersion[3] | 0);
      break;
  }

  const splitWords = fullVersion.split(' ');
  let browserVersion = fullVersion;
  if (splitWords && splitWords.length > 0) {
    browserVersion = splitWords[0];
  }

  return {
    browserName: browserName,
    browserVersion: browserVersion,
    os: osName,
    osVersion: osVersion,
    codeBase: codeBaseType,
    userAgent: userAgent,
  };
};
