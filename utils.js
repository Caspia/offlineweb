/**
 * Utility functions
 * @module utility
 */

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

module.exports = {
  TraceError
};
