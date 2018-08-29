/**
 * Utility functions
 * @module utility
 */

const dns = require('dns');
const fetch = require('node-fetch');

/** Error type that traces through promises */
class TraceError extends Error {
  /**
   * Create a TraceError error instance
   * @param {String} message Description of error in current method
   * @param {Error} error Previous error from catch(error), reject(error),  or catch(error => {})
   */
  constructor(message, error) {
    super(message);
    this.stack += '\ncause: ' + error.stack;
  }
}

/**
 * use a DNS query to determine if we are online (that is, have internet access)
 * @returns true if online
 */
async function isOnline() {
  // note in node 10.6 dns has a promise interface, but let's stick with node 8
  return new Promise((resolve, reject) => {
    const resolver = new dns.Resolver();
    // Offline generally times out, so limit the wait to two seconds.
    const timeout = setTimeout(() => {
      clearTimeout(timeout);
      resolver.cancel();
      resolve(false);
      // null this to avoid promise callbacks later.
      resolve = false;
    }, 2000);
    resolver.resolve4('google.com', (err, addresses) => {
      if (err) {
        // console.log('error from dns: ' + err);
      }
      if (!resolve) {
        return;
      }
      if (err || !addresses || !addresses.length) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Web fetch request with a timeout
 * @param url{string} - the web resource to fetch
 * @param options{Object} - options item for the web fetch command
 * @param timeout{Number} - time in milliseconds, defaults to 5000
 * @returns{Promise} - promise that resolves on fetch, rejects on timeout or
 *  fetch error, whichever comes first
 * 
 * @see https://stackoverflow.com/questions/46946380/fetch-api-request-timeout
 */
function fetchWithTimeout(url, options, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeout);
    })
  ])
}

module.exports = {
  TraceError,
  isOnline,
  fetchWithTimeout
};
