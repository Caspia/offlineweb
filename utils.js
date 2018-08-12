/**
 * Utility functions
 * @module utility
 */

const dns = require('dns');

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

module.exports = {
  TraceError,
  isOnline
};
