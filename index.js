/**
 * Setup servers that read from response cache
 * @file
 */

const http = require('http');
const tls = require('tls');
const https = require('https');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const URL = require('url').URL;
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars
const TraceError = require('./utils').TraceError;
const logging = require('./logging');

// path to certificate authority certificate
const caCrtPath = process.env.OFFLINEWEB_CACRTPATH || 'test/ca.crt';

// path to certificate authority private key
const caKeyPath = process.env.OFFLINEWEB_CAKEYPATH || 'test/ca.key';

// path to log files
const logFilesPath = process.env.OFFLINEWEB_LOGFILESPATH || '/var/log/offlineweb';

const caCrt = fs.readFileSync(caCrtPath);
const caKey = fs.readFileSync(caKeyPath);
const dontCacheSites = [
  'google.com'
];

const {errorLog, accessLog} = logging.setupLogging(logFilesPath);
errorLog.info('Restarting offlineweb');

const responsecache = require('./responsecache');
const certificates = require('./certificates');

const responseCachePath = process.env.OFFLINEWEB_RESPONSECACHEPATH || '/var/cache/offlineweb/responseDir';
const certificateCachePath = process.env.OFFLINEWEB_CERTIFICATECACHEPATH || '/var/cache/offlineweb/cacheDir';
const port = process.env.OFFLINEWEB_PORT || 3129;
const tlsport = process.env.OFFLINEWEB_TLSPORT || 3130;

/**
 * Respond to an incoming request with content. The content may come from the cache,
 * or from the original site if uncached.
 * @param {string} responseCachePath path to root directory for caching content
 * @param {http.IncomingMessage} request the request from a node http server (request, response)
 * @param {http.ServerResponse} response the response from a node http server (request, response)
 */
function getContent(responseCachePath, request, response) {
  accessLog.info(`host: ${request.headers.host} url: ${request.url} method: ${request.method}`);
  const siteUrl = (new URL(request.url, 'http://' + request.headers.host)).toString();
  errorLog.info(`siteUrl: ${siteUrl}`);

  // We only support GET
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.statusMessage = 'offlineweb proxy only supports GET';
    errorLog.warn(`non-GET request for siteUrl ${siteUrl}`);
    response.end();
    return;
  }
  // bypass dont cache sites
  let dontCache = false;
  for (let site of dontCacheSites) {
    if (siteUrl.startsWith(site)) {
      dontCache = true;
      break;
    }
  }
  if (dontCache) {
    errorLog.info(`Serving directly: ${siteUrl}`);
    // serve directly
    fetch(request.siteUrl)
      .then(fresponse => {
        // for (let pair of fresponse.headers.entries()) {
        //   response.setHeader(pair[0], pair[1]);
        // }
        response.setHeader('content-encoding', 'identity');
        fresponse.body.pipe(response);
        fresponse.body.on('end', () => {
          response.end();
        });
      })
      .catch(err => {
        response.statusCode = 500;
        response.statusMessage = err.toString();
        errorLog.error(`500 response sent, error: ${err.toString()}`);
        response.end();
      });
  } else {
    errorLog.info(`cacheAndRespond: ${siteUrl}`);
    cacheAndRespond(siteUrl, responseCachePath, request, response)
      .then(() => {
        response.end();
      }).catch(err => {
        response.statusCode = 500;
        response.statusMessage = err.toString();
        errorLog.error(`Error from cacheAndResponse: ${err.stack}`);
        response.end();
      });
  }
}

/**
 * Serve http response content from the original site, caching the result.
 *
 * @param {string} siteUrl the url for the desired content
 * @param {string} responseCachePath path to root directory for caching content
 * @param {http.IncomingMessage} request the request from a node http server (request, response)
 * @param {http.ServerResponse} response the response from a node http server (request, response)
 */
async function cacheAndRespond(siteUrl, responseCachePath, request, response) {
  let isCached = false;
  try {
    isCached = await responsecache.isCached(siteUrl, responseCachePath);
  } catch (err) {
    throw new TraceError('error getting isCached', err);
  }
  if (!isCached) {
    try {
      const options = {};
      options.headers = {
        'User-Agent': request.headers['user-agent'],
        'Accept': request.headers['accept']
      };
      await responsecache.saveToResponseCache(siteUrl, responseCachePath, options);
    } catch (err) {
      throw new TraceError('error saving to response cache', err);
    }
  }
  try {
    await responsecache.streamFromResponseCache(siteUrl, responseCachePath, response);
  } catch (err) {
    throw new TraceError('errors in streamFromResponseCache', err);
  }
}

const tlsOptions = {
  rejectUnauthorized: true,
  SNICallback: (servername, cb) => {
    console.log('SNICallback servername ' + servername);
    try {
      certificates.multiGetOrCreateServerCertificate(servername, certificateCachePath, caCrt, caKey)
        .then(serverCertKey => {
          cb(null, tls.createSecureContext({key: serverCertKey.privateKey, cert: serverCertKey.cert, ca: caCrt}));
        });
    } catch (err) {
      const error = new TraceError('error in multiGetOrCreateServerCertificate', err);
      // in a callback, no way to propagate error upwards
      console.log(error.stack);
    }
  }
};

const httpsServer = https.createServer(tlsOptions);
httpsServer.on('request', (request, response) => {
  getContent(responseCachePath, request, response);
});
httpsServer.listen(tlsport);
console.log('https:// server is listening on port ' + tlsport);

const httpServer = http.createServer();
httpServer.on('request', (request, response) => {
  getContent(responseCachePath, request, response);
});
httpServer.listen(port);
console.log('http:// server is listening on port ' + port);
