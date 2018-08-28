/**
 * Manage an offine cache of responses to http:// and https:// requests.
 *
 * @module responsecache
 */

const url = require('url');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const crypto = require('crypto');
const dockerports = require('./dockerports');
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars
const TraceError = require('./utils').TraceError;

/**
 * Does content for a url exist in the cache?
 *
 * @param {string} siteUrl the url of the desired content
 * @param {string} responseCachePath path to root directory of content cache
 * @returns {boolean} true if content is cached
 */
async function isCached(siteUrl, responseCachePath) {
  try {
    const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
    const urlFilePath = responseCachePath + '/' + encodedHostname + '/' + encodedFilename;
    let isCached = true;
    try {
      await fs.stat(urlFilePath);
    } catch (err) {
      isCached = false;
    }
    return isCached;
  } catch (error) {
    throw new TraceError('Unexpected error in isCached', error);
  }
}

/**
 * Fetch and cache remote content for a url
 *
 * @param {string} siteUrl the url of the desired content
 * @param {string} responseCachePath path to root directory of content cache
 * @param {Object} options Pass to fetch, see node-fetch or MDN Fetch API
 */
async function saveToResponseCache(siteUrl, responseCachePath, options) {
  try {
    const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
    await fs.ensureDir(responseCachePath + '/' + encodedHostname);
    let response;

    // add ports to any VIRTUAL_HOSTS
    const siteUrlObject = new url.URL(siteUrl);
    const ports = await dockerports.getPorts();
    const host = siteUrlObject.host;
    if (ports[host]) {
      if (ports[host].httpPort) {
        siteUrlObject.protocol = 'http';
        siteUrlObject.port = ports[host].httpPort;
      }
      else if (ports[host].httpsPort) {
        siteUrlObject.protocol = 'https';
        siteUrlObject.port = ports[host].httpsPort;
      }
      siteUrl = siteUrlObject.toString();
      // console.log(`siteUrl fixed to ${siteUrl}`);
    }
    try {
      response = await fetch(siteUrl, options);
    } catch (err) {
      throw new TraceError('error fetching ' + siteUrl, err);
    }
    await new Promise((resolve, reject) => {
      let headersObject = {};
      for (let pair of response.headers.entries()) {
        headersObject[pair[0]] = pair[1];
      }
      const dest = fs.createWriteStream(responseCachePath + '/' + encodedHostname + '/' + encodedFilename);
      response.body.pipe(dest);
      response.body.on('error', err => {
        reject(new TraceError('error piping from response.body', err));
      });
      dest.on('finish', () => {
        // write the headers file
        fs.writeFile(responseCachePath + '/' + encodedHostname + '/' + encodedFilename + '.headers', JSON.stringify(headersObject))
          .then(() => resolve())
          .catch(err => reject(new TraceError('error writing headers', err)));
      });
      dest.on('error', err => reject(new TraceError('error piping to file', err)));
    });
  } catch (error) {
    throw new TraceError('Unexpected error in saveToResponseCache', error);
  }
};

/**
 * Stream contents of the response cache to an http response
 *
 * @param {string} siteUrl the url of the desired content
 * @param {string} responseCachePath path to root directory of content cache
 * @param {http.ServerResponse} response the response from a node http server (request, response)
 */
async function streamFromResponseCache(siteUrl, responseCachePath, response) {
  try {
    const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
    const urlFilePath = responseCachePath + '/' + encodedHostname + '/' + encodedFilename;
    // console.log('siteUrl: ' + siteUrl);
    // console.log('urlFilePath: ' + urlFilePath);
    // get content type
    const cachedHeaders = JSON.parse(await fs.readFile(urlFilePath + '.headers'));
    if (response.setHeader) {
      if (cachedHeaders['content-type']) {
        response.setHeader('content-type', cachedHeaders['content-type']);
      } else {
        require('./logging').errorLog.warn(`No content-type for response from ${siteUrl}`);
      }
      if (cachedHeaders['access-control-allow-origin']) {
        response.setHeader('access-control-allow-origin', cachedHeaders['access-control-allow-origin']);
      }
    }
    const readStream = fs.createReadStream(urlFilePath);
    await new Promise((resolve, reject) => {
      readStream.pipe(response);
      response.on('error', err => {
        console.log('response error: ' + err);
        reject(new TraceError('error piping to response', err));
      });
      readStream.on('end', () => {
        resolve();
      });
      readStream.on('error', err => {
        reject(new TraceError('error piping from cache file', err));
      });
    });
  } catch (err) {
    throw new TraceError('Unexpected error processing ' + siteUrl, err);
  }
}

/**
 * @typedef {Object} EncodedUrlNames host and file names for cached content
 * @property {string} encodedHostaame sanitized host name (used as a directory name)
 * @property {string} encodedFilename sanitized filename
 */

/**
 * Generate the filename for the cached response.
 *
 * We recognize a url for cache writing and reading by the sanitized hostname
 * and path. Hostnames are represented by directories, containing files starting with sanitized
 * paths beginning with '/' so we can represent the empty path.
 *
 * @param {string} siteUrl the url of the desired content
 * @returns {EncodedUrlNames} host and file names
 */
function encodeUrl(siteUrl) {
  const siteUrlObject = url.parse(siteUrl);
  const encodedHostname = encodeURIComponent(siteUrlObject.host);
  let encodedFilename = encodeURIComponent(siteUrlObject.path);

  // Some urls are too long to be filenames, use a hash instead.
  if (encodedFilename.length > 128) {
    const hash = crypto.createHash('sha256');
    hash.update(encodedFilename);
    encodedFilename = hash.digest('hex');
  }
  return {encodedHostname, encodedFilename};
}

module.exports = {
  encodeUrl,
  saveToResponseCache,
  streamFromResponseCache,
  isCached
};
