/**
 * Testing of module readconfig
 */

const readconfig = require('../readconfig');
const assert = require('assert');

const tests = [
  // [teststring, ?includes, ?excludes, ?nocaches]
  ['fonts.googleapi.com/fonts/thefont.ttf', true, false, false],
  ['registry.npmjs.org', true, false, false],
  ['caspia.org', true, false, false],
  ['google.com', false, true, false],
  ['google-analytics.com', false, true, false],
  ['https://tiles.services.mozilla.org', false, false, true]
];

describe('module readconfig', function() {
  it('correctly categorizes urls', function() {
    const {includes, excludes, nocaches} = readconfig('test/url.config');
    tests.forEach(test => {
      const [url, tincludes, texcludes, tnocaches] = test;
      // console.log(`testing url ${url}`);
      assert.strictEqual(includes.some(regex => regex.test(url)), tincludes);
      assert.strictEqual(excludes.some(regex => regex.test(url)), texcludes);
      assert.strictEqual(nocaches.some(regex => regex.test(url)), tnocaches);
    });
  });
});
