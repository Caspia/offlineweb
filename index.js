/**
 * Setup servers that read from response cache
 * @file
 */

const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars

const http = require('http');
const tls = require('tls');
const https = require('https');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const URL = require('url').URL;
const TraceError = require('./utils').TraceError;
const logging = require('./logging');
const utils = require('./utils');
const readconfig = require('./readconfig');

// We will run as root, but created files will be manipulated by a non-root
// user. Just let permissions be wide open to reduce headaches.
process.umask(0);

// web timeout in milliseconds
const webtimeout = process.env.OFFLINEWEB_WEBTIMEOUT || 5000;

// number of web browser instances
const webinstances = process.env.OFFLINEWEB_WEBINSTANCES || 1;
// path to certificate authority certificate

// There should be a volume pointing to /root/app/certificates but if missing or empty,
// default to the test certificates.

const caPath = fs.existsSync('certificates/ca.crt') ? 'certificates' : 'test'
const caCrtPath = caPath + '/ca.crt';

// path to certificate authority private key
const caKeyPath = caPath + '/ca.key';

// path to log files
const logFilesPath = '/var/log/offlineweb';

const caCrt = fs.readFileSync(caCrtPath);
const caKey = fs.readFileSync(caKeyPath);

const {includes, excludes, nocaches, directs} = fs.existsSync('url.config')
  ? readconfig('url.config') : readconfig('url.config.template');

const {errorLog, accessLog} = logging.setupLogging(logFilesPath);
errorLog.warn('Restarting offlineweb');

const responsecache = require('./responsecache');
const certificates = require('./certificates');

const responseCachePath = '/var/cache/offlineweb/responseDir';
const certificateCachePath = '/var/cache/offlineweb/cacheDir';
fs.ensureDirSync(responseCachePath);
fs.ensureDirSync(certificateCachePath);

const port = process.env.OFFLINEWEB_PORT || 3129;
const tlsport = process.env.OFFLINEWEB_TLSPORT || 3130;

/**
 * Respond to an incoming request with content. The content may come from the cache,
 * or from the original site if uncached.
 * @param {string} responseCachePath path to root directory for caching content
 * @param {http.IncomingMessage} request the request from a node http server (request, response)
 * @param {http.ServerResponse} response the response from a node http server (request, response)
 * @param {Number} timeout web timeout in millisecods
 */
function getContent(responseCachePath, request, response, timeout = 5000) {
  accessLog.info(`host: ${request.headers.host} url: ${request.url} method: ${request.method}`);
  const siteUrl = (new URL(request.url, 'http://' + request.headers.host)).toString();
  errorLog.verbose(`getContent for: ${siteUrl}`);

  // url disposition

  const dontCache = nocaches.some(regex => regex.test(siteUrl));
  const exclude = excludes.some(regex => regex.test(siteUrl));
  const include = includes.some(regex => regex.test(siteUrl));
  const direct = directs.some(regex => regex.test(siteUrl));

  if (exclude) { // We never respond to these urls
    response.statusCode = 522;
    response.statusMessage = 'Resource excluded by cache configuration';
    errorLog.info(`resource excluded by cache configuration: ${siteUrl}`);
    response.end('Resource excluded by cache configuration.');
    return;
  }

  // We only support GET, except for direct
  const allowedMethods = ['GET', 'HEAD'];
  if (!allowedMethods.includes(request.method) && !direct) {
    response.statusCode = 405;
    response.statusMessage = 'unsupported offlineweb web method';
    errorLog.info(`unsupport web method ${request.method} we support ${allowedMethods.join()} for siteUrl ${siteUrl}`);
    response.end(response.statusMessage);
    return;
  }

  if (!include || dontCache || direct) {
    errorLog.info(`Serving directly: ${siteUrl}`);
    // serve directly
    utils.fetchWithTimeout(request.siteUrl, {}, webtimeout)
      .then(fresponse => {
        // for (let pair of fresponse.headers.entries()) {
        //   response.setHeader(pair[0], pair[1]);
        // }
        response.setHeader('content-encoding', 'identity');
        if (direct && (request.method === 'POST' || request.method === 'PUT')) {
          fresponse.body.pipe(response);
        }
        fresponse.body.on('end', () => {
          errorLog.verbose(`200 response for ${request.siteUrl}: normal fetch for non-cached url`);
          response.end();
        });
      })
      .catch(err => {
        response.statusCode = 500;
        response.statusMessage = err.toString();
        errorLog.error(`500 response sent, error: ${err.toString()}`);
        response.end(err.toString());
      });
  } else {
    errorLog.info(`cacheAndRespond: ${siteUrl}`);
    cacheAndRespond(siteUrl, responseCachePath, request, response, timeout)
      .catch(err => {
        response.statusCode = 500;
        response.statusMessage = err.toString();
        errorLog.error(`Error from cacheAndResponse for ${siteUrl}: ${err.stack}`);
        response.end(err.toString());
      });
  }
}

/**
 * Serve http response content from the original site, caching the result. This method should complete
 * * the response (that is call response.end()) unless it throws an error.
 *
 * @param {string} siteUrl the url for the desired content
 * @param {string} responseCachePath path to root directory for caching content
 * @param {http.IncomingMessage} request the request from a node http server (request, response)
 * @param {http.ServerResponse} response the response from a node http server (request, response)
 * @param {Number} timeout web timeout in milliseconds
 */
async function cacheAndRespond(siteUrl, responseCachePath, request, response, timeout = 5000) {
  let isCached = false;
  try {
    isCached = await responsecache.isCached(siteUrl, responseCachePath);
  } catch (err) {
    throw new TraceError('error getting isCached', err);
  }
  if (!isCached) {
    if (!(await utils.isOnline())) {
      // Not online and not cached, use custom error 521, 'unavailable'
      response.statusCode = 521;
      response.statusMessage = 'Resource not cached, and we are offline';
      errorLog.verbose(`521 response from ${siteUrl}: resource not cached and offline`);
      response.end('Resource not cached, and we are offline.');
      return;
    }
    try {
      const options = {};
      options.headers = {
        'User-Agent': request.headers['user-agent'],
        'Accept': request.headers['accept']
      };
      await responsecache.saveToResponseCache(siteUrl, responseCachePath, options, timeout);
    } catch (err) {
      throw new TraceError('error saving to response cache', err);
    }
  }
  try {
    await responsecache.streamFromResponseCache(siteUrl, responseCachePath, response);
    response.statusCode = 200;
    errorLog.verbose(`200 response for ${siteUrl}: successful streamFromResponseCache`);
    response.end();
  } catch (err) {
    throw new TraceError('errors in streamFromResponseCache', err);
  }
}

const tlsOptions = {
  rejectUnauthorized: true,
  SNICallback: (servername, cb) => {
    errorLog.info('SNICallback servername ' + servername);
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
  getContent(responseCachePath, request, response, webtimeout);
});
httpsServer.listen(tlsport);
console.log('https:// server is listening on port ' + tlsport);

const httpServer = http.createServer();
httpServer.on('request', (request, response) => {
  getContent(responseCachePath, request, response, webtimeout);
});
httpServer.listen(port);
console.log('http:// server is listening on port ' + port);
