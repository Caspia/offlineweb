/** @module readconfig
 *
 * @description
 * Read sync a configuration file describing how to process urls.
 *
 * The config file has three sections, for items to include, exclude,
 * and items to always bypass cache and read from internet. These sections
 * are denoted by lines beginning with ::includes, ::excludes, and ::nocaches
 *
 * Blank lines, or lines beginning with #, are ignored.
 *
 * @param path{string} The file path
 * @returns {Object} {includes, excludes, nocaches}: Arrays of regexs of urls to include,
 *                   exclude, and process directly.
 */
module.exports = function(path) {
  const lines = require('fs')
    .readFileSync(path, 'utf-8')
    .split('\n');

  // arrays of regep of urls to include, exclude, and bypass cache (respectively)
  const includes = [];
  const excludes = [];
  const nocaches = [];

  let active = includes;
  for (let line of lines) {
    line = line.trimEnd();
    if (line.length === 0) { // skip empty lines
      continue;
    }
    if (line[0] === '#') { // skip comments
      continue;
    }
    if (line.startsWith('::includes')) {
      active = includes;
      continue;
    }
    if (line.startsWith('::excludes')) {
      active = excludes;
      continue;
    }
    if (line.startsWith('::nocaches')) {
      active = nocaches;
      continue;
    }
    active.push(RegExp(line));
  }
  return {includes, excludes, nocaches};
};
