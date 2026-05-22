// background.js - Allround Web IP Lookup Extension

console.log('background.js service worker loaded');

let currentIP = '';
let cache = {
  lastUrl: '',
  ipAddress: null,
  ptrInfo: null,
  panelInfo: null,
  source: null,
  timestamp: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuten cache

function extractARecord(data) {
  if (!data || !data.Answer || !Array.isArray(data.Answer)) {
    return null;
  }
  const answer = data.Answer.find(record => record.type === 1);
  return answer ? answer.data : null;
}

// Utility functie voor API requests met timeout
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log('fetchWithTimeout request:', url, {
      ...options,
      timeout
    });

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    console.log('fetchWithTimeout response:', url, {
      status: response.status,
      statusText: response.statusText,
      redirected: response.redirected
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('fetchWithTimeout timeout:', url, timeout);
    } else {
      console.error('fetchWithTimeout error:', url, error.message);
    }
    throw error;
  }
}

// IP adres ophalen via verschillende API's
async function getIPAddress(url) {
  try {
    const domain = new URL(url).hostname;

    // Controleer op lokale/private adressen
    if (domain === 'localhost' || domain.startsWith('192.168.') ||
        domain.startsWith('10.') || domain.startsWith('172.')) {
      throw new Error('Lokale adressen worden niet ondersteund');
    }

    console.log('Looking up IP for domain:', domain);

    // Probeer DNS resolvers eerst, ip-api.com alleen als fallback
    const apis = [
      {
        name: 'dns.google',
        url: `https://dns.google/resolve?name=${domain}&type=A`,
        headers: {
          'Accept': 'application/json'
        },
        parseResponse: (data) => {
          const ipAddress = extractARecord(data);
          if (ipAddress) return ipAddress;
          throw new Error('Geen A record gevonden');
        }
      },
      {
        name: 'cloudflare-dns',
        url: `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
        headers: {
          'Accept': 'application/dns-json'
        },
        parseResponse: (data) => {
          const ipAddress = extractARecord(data);
          if (ipAddress) return ipAddress;
          throw new Error('Geen A record gevonden');
        }
      },
      {
        name: 'ip-api.com',
        url: `https://ip-api.com/json/${domain}?fields=status,message,query`,
        headers: {
          'User-Agent': 'Allround-Web-IP-Lookup/2.0',
          'Accept': 'application/json'
        },
        parseResponse: (data) => {
          if (data.status === 'fail') throw new Error(data.message);
          return data.query;
        }
      }
    ];

    // Probeer elke API tot er een werkt
    for (const api of apis) {
      try {
        console.log(`Trying ${api.name} for IP lookup...`, api.url);
        const response = await fetchWithTimeout(api.url, {
          headers: api.headers
        }, 3000);

        const data = await response.json();
        console.log(`${api.name} response:`, data);

        let ipAddress;
        try {
          ipAddress = api.parseResponse(data);
        } catch (parseError) {
          console.error(`${api.name} parseResponse failed:`, parseError.message, data);
          throw parseError;
        }

        if (ipAddress) {
          console.log(`IP found via ${api.name}:`, {
            domain,
            api: api.name,
            ipAddress
          });
          currentIP = ipAddress;
          return {
            ipAddress,
            source: api.name
          };
        }
      } catch (error) {
        console.log(`${api.name} failed:`, error.message);
        continue;
      }
    }

    throw new Error('Alle IP lookup services faalden');

  } catch (error) {
    console.error('IP lookup error:', error);
    throw new Error(error.message.includes('Failed to fetch') ?
      'Netwerkfout - controleer internetverbinding' : error.message);
  }
}

// PTR/hostname lookup via verschillende API's
async function getPTRInfo(ipAddress) {
  try {
    if (!ipAddress) {
      throw new Error('Geen IP adres beschikbaar');
    }

    // Valideer of het een echt IP adres is (niet een hostname)
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (!ipPattern.test(ipAddress)) {
      console.log('Not a valid IP address, might be hostname already:', ipAddress);
      return ipAddress.endsWith('.') ? ipAddress.slice(0, -1) : ipAddress;
    }

    console.log('Starting PTR lookup for IP:', ipAddress);

    // Converteer IP naar in-addr.arpa format voor PTR lookup
    const parts = ipAddress.split('.').reverse();
    const ptrDomain = `${parts.join('.')}.in-addr.arp+a`;
    console.log('PTR domain:', ptrDomain);

    // Probeer verschillende PTR lookup methoden
    const ptrApis = [
      {
        name: 'dns.google PTR',
        url: `https://dns.google/resolve?name=${ptrDomain}&type=PTR`,
        parseResponse: (data) => {
          if (data.Answer && data.Answer.length > 0) {
            let hostname = data.Answer[0].data;
            return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
          }
          return null;
        }
      },
      {
        name: 'cloudflare PTR',
        url: `https://cloudflare-dns.com/dns-query?name=${ptrDomain}&type=PTR`,
        parseResponse: (data) => {
          if (data.Answer && data.Answer.length > 0) {
            let hostname = data.Answer[0].data;
            return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
          }
          return null;
        }
      },
      {
        name: 'ipinfo.io',
        url: `https://ipinfo.io/${ipAddress}/json`,
        parseResponse: (data) => data.hostname || null
      },
      {
        name: 'ip-api.com PTR',
        url: `https://ip-api.com/json/${ipAddress}?fields=reverse`,
        parseResponse: (data) => {
          return (data.reverse && data.reverse !== ipAddress) ? data.reverse : null;
        }
      }
    ];

    // Probeer elke PTR API
    for (const api of ptrApis) {
      try {
        console.log(`Trying ${api.name} for PTR lookup...`, api.url);
        const response = await fetchWithTimeout(api.url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Allround-Web-IP-Lookup/2.0'
          }
        }, 3000);

        const data = await response.json();
        console.log(`${api.name} response:`, data);

        let hostname;
        try {
          hostname = api.parseResponse(data);
        } catch (parseError) {
          console.error(`${api.name} parseResponse failed:`, parseError.message, data);
          throw parseError;
        }

        if (hostname) {
          console.log(`PTR found via ${api.name}:`, hostname);
          return hostname;
        }
      } catch (error) {
        console.log(`${api.name} failed:`, error.message);
        continue;
      }
    }

    console.log('No PTR record found for', ipAddress);
    return null;

  } catch (error) {
    console.error('PTR lookup error:', error);
    return null;
  }
}

// Detecteer control panel type gebaseerd op hostname
function detectControlPanel(hostname) {
  if (!hostname) return null;

  const lowerHostname = hostname.toLowerCase();

  if (lowerHostname.endsWith('.zxcs.nl')) {
    return {
      type: 'DirectAdmin',
      port: '2222',
      url: `https://${hostname}:2222`,
      icon: '🔧'
    };
  }

  if (lowerHostname.endsWith('.allroundhosting.nl')) {
    return {
      type: 'Plesk',
      port: '8443',
      url: `https://${hostname}:8443`,
      icon: '⚙️'
    };
  }

  return null;
}

// Controleer cache
function getCachedData(url) {
  const now = Date.now();
  if (cache.lastUrl === url &&
      cache.timestamp > 0 &&
      (now - cache.timestamp) < CACHE_DURATION) {
    console.log('Using cached data for', url, { source: cache.source });
    return cache;
  }
  return null;
}

// Update cache
function updateCache(url, ipAddress, ptrInfo, panelInfo, source = null) {
  cache = {
    lastUrl: url,
    ipAddress,
    ptrInfo,
    panelInfo,
    source,
    timestamp: Date.now()
  };
  console.log('Cache updated for', url, { source });
}

// Message listener met verbeterde error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request, 'from sender:', sender);

  if (request.action === 'getIPAddress') {
    // Check cache eerst
    const cached = getCachedData(request.url);
    if (cached) {
      sendResponse({
        ipAddress: cached.ipAddress,
        source: cached.source
      });
      return;
    }

    getIPAddress(request.url)
      .then(({ ipAddress, source }) => {
        sendResponse({ ipAddress, source });
        // Start PTR lookup in background voor volgende keer
        getPTRInfo(ipAddress).then(ptrInfo => {
          const panelInfo = detectControlPanel(ptrInfo);
          updateCache(request.url, ipAddress, ptrInfo, panelInfo, source);
        });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });

    return true; // Asynchrone response
  }

  if (request.action === 'sendIPAddress') {
    // Check cache eerst
    const cached = getCachedData(request.ipAddress);
    if (cached && cached.ptrInfo !== null) {
      console.log('Using cached PTR data');
      sendResponse({
        success: true,
        ptrInfo: cached.ptrInfo || 'Geen PTR record gevonden',
        panelInfo: cached.panelInfo
      });
      return;
    }

    // PTR lookup uitvoeren
    (async () => {
      try {
        console.log('Starting fresh PTR lookup for currentIP:', currentIP);

        if (!currentIP) {
          throw new Error('Geen IP adres beschikbaar voor PTR lookup');
        }

        // PTR lookup met timeout
        const ptrInfo = await Promise.race([
          getPTRInfo(currentIP),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PTR lookup timeout')), 8000)
          )
        ]);

        const panelInfo = detectControlPanel(ptrInfo);

        console.log('Fresh PTR Info:', ptrInfo);
        console.log('Panel Info:', panelInfo);

        // Update cache
        updateCache(request.ipAddress, currentIP, ptrInfo, panelInfo);

        // Stuur resultaat direct terug naar popup
        sendResponse({
          success: true,
          ptrInfo: ptrInfo || 'Geen PTR record gevonden',
          panelInfo: panelInfo
        });
      } catch (error) {
        console.error('PTR lookup failed:', error);
        sendResponse({
          success: true,
          ptrInfo: 'PTR lookup gefaald',
          panelInfo: null,
          error: error.message
        });
      }
    })();

    return true; // Asynchrone response
  }

  // Nieuwe actie: haal alle data op in één keer
  if (request.action === 'getAllData') {
    (async () => {
      try {
        const url = request.url;

        // Check cache eerst
        const cached = getCachedData(url);
        if (cached) {
          console.log('Returning all cached data');
          sendResponse({
            success: true,
            ipAddress: cached.ipAddress,
            ptrInfo: cached.ptrInfo || 'Geen PTR record gevonden',
            panelInfo: cached.panelInfo,
            source: cached.source
          });
          return;
        }

        console.log('Fetching all data fresh for:', url);

        // Haal IP address op
        const { ipAddress, source } = await getIPAddress(url);

        // Direct ook PTR lookup doen
        const ptrInfo = await Promise.race([
          getPTRInfo(ipAddress),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PTR lookup timeout')), 8000)
          )
        ]).catch(() => null);

        const panelInfo = detectControlPanel(ptrInfo);

        // Update cache
        updateCache(url, ipAddress, ptrInfo, panelInfo, source);

        sendResponse({
          success: true,
          ipAddress: ipAddress,
          ptrInfo: ptrInfo || 'Geen PTR record gevonden',
          panelInfo: panelInfo
        });

      } catch (error) {
        console.error('getAllData failed:', error);
        sendResponse({
          success: false,
          error: error.message,
          ipAddress: null,
          ptrInfo: 'Fout bij lookup',
          panelInfo: null
        });
      }
    })();

    return true; // Asynchrone response
  }
});