/**
 * Manage an offine cache of responses to http:// and https:// requests.
 *
 * @module responsecache
 */

// const sanitizeFilename = require('sanitize-filename');
const url = require('url');
const fs = require('fs-extra');
const fetch = require('node-fetch');

async function saveToResponseCache(siteUrl, responseCachePath) {
  const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
  await fs.ensureDir(responseCachePath + '/' + encodedHostname);
  const response = await fetch(siteUrl);
  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(responseCachePath + '/' + encodedHostname + '/' + encodedFilename);
    response.body.pipe(dest);
    response.body.on('error', err => {
      reject(err);
    });
    dest.on('finish', () => {
      resolve();
    });
    dest.on('error', err => {
      reject(err);
    });
  });
};

async function streamFromResponseCache(siteUrl, responseCachePath, response) {
  const {encodedHostname, encodedFilename} = encodeUrl(siteUrl);
  const urlFilePath = responseCachePath + '/' + encodedHostname + '/' + encodedFilename;
  const readStream = fs.createReadStream(urlFilePath);
  await new Promise((resolve, reject) => {
    readStream.pipe(response);
    response.on('error', err => {
      reject(err);
    });
    readStream.on('end', () => {
      resolve();
    });
    response.on('err', err => {
      reject(err);
    });
  });
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
  streamFromResponseCache
};
