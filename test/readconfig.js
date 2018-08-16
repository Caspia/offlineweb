/**
 * Testing of module readconfig
 */

const readconfig = require('../readconfig');
const assert = require('assert');

const tests = [
  // [teststring, ?includes, ?excludes, ?nocaches]
  ['fonts.googleapi.com/fonts/thefont.ttf', true, false, false, false],
  ['registry.npmjs.org', true, false, false, false],
  ['caspia.org', true, false, false, false],
  ['google.com', false, true, false, false],
  ['google-analytics.com', false, true, false, false],
  ['https://tiles.services.mozilla.org', false, false, true, false],
  ['/cdn.sellads.com', false, true, false, false],
  ['/sellads.com', false, false, false, false],
  // match .ed domain
  ['example.ed', false, false, false, true],
  ['example.ed/', false, false, false, true],
  ['www.example.ed', false, false, false, true],
  ['example.edx', false, false, false, false]
];

describe('module readconfig', function() {
  it('correctly categorizes urls', function() {
    const {includes, excludes, nocaches, directs} = readconfig('test/url.config');
    tests.forEach(test => {
      const [url, tincludes, texcludes, tnocaches, tdirects] = test;
      // console.log(`testing url ${url}`);
      assert.strictEqual(includes.some(regex => regex.test(url)), tincludes);
      assert.strictEqual(excludes.some(regex => regex.test(url)), texcludes);
      assert.strictEqual(nocaches.some(regex => regex.test(url)), tnocaches);
      assert.strictEqual(directs.some(regex => regex.test(url)), tdirects);
    });
  });
});
