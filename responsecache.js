/**
 * Manage an offine cache of responses to http:// and https:// requests.
 *
 * @module responsecache
 */

// const sanitizeFilename = require('sanitize-filename');
const url = require('url');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars

async function isCached(siteUrl, responseCachePath) {
  const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
  const urlFilePath = responseCachePath + '/' + encodedHostname + '/' + encodedFilename;
  let isCached = true;
  try {
    await fs.stat(urlFilePath);
  } catch (err) {
    isCached = false;
  }
  return isCached;
}

async function saveToResponseCache(siteUrl, responseCachePath) {
  const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
  await fs.ensureDir(responseCachePath + '/' + encodedHostname);
  const response = await fetch(siteUrl);
  await new Promise((resolve, reject) => {
    let headersObject = {};
    for (let pair of response.headers.entries()) {
      headersObject[pair[0]] = pair[1];
    }
    const dest = fs.createWriteStream(responseCachePath + '/' + encodedHostname + '/' + encodedFilename);
    response.body.pipe(dest);
    response.body.on('error', err => {
      reject(err);
    });
    dest.on('finish', () => {
      // write the headers file
      fs.writeFile(responseCachePath + '/' + encodedHostname + '/' + encodedFilename + '.headers', JSON.stringify(headersObject))
        .then(() => resolve())
        .catch(err => reject(err));
    });
    dest.on('error', err => {
      reject(err);
    });
  });
};

async function streamFromResponseCache(siteUrl, responseCachePath, response) {
  try {
    const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
    const urlFilePath = responseCachePath + '/' + encodedHostname + '/' + encodedFilename;
    // console.log('siteUrl: ' + siteUrl);
    // console.log('urlFilePath: ' + urlFilePath);
    // get content type
    const cachedHeaders = JSON.parse(await fs.readFile(urlFilePath + '.headers'));
    if (response.setHeader) {
      response.setHeader('content-type', cachedHeaders['content-type']);
    }
    const readStream = fs.createReadStream(urlFilePath);
    await new Promise((resolve, reject) => {
      readStream.pipe(response);
      response.on('error', err => {
        console.log('response error: ' + err);
        reject(err);
      });
      readStream.on('end', () => {
        resolve();
      });
      readStream.on('error', err => {
        console.log('readStream error' + err);
        reject(err);
      });
    });
  } catch (err) {
    console.log('siteUrl: ' + siteUrl + ' Error: ' + err); throw err;
  }
}

function encodeUrl(siteUrl) {
  // Generate the filename for the cached response. We recognize a url for
  // cache writing and reading by the sanitized hostname and path. Hostnames
  // are represented by directories, containing files starting with sanitized
  // paths beginning with '/' so we can represent the empty path.

  const siteUrlObject = url.parse(siteUrl);
  const encodedHostname = encodeURIComponent(siteUrlObject.host);
  const encodedFilename = encodeURIComponent(siteUrlObject.path);
  return {encodedHostname, encodedFilename};
}

module.exports = {
  encodeUrl,
  saveToResponseCache,
  streamFromResponseCache,
  isCached
};
