/**
 * Tests responsecache module
 */

const responsecache = require('../responsecache');
const assert = require('assert');
const fs = require('fs-extra');
const MemoryStream = require('memorystream');

const responseDir = 'test/results/responseDir';
const testUrl = 'https://cdnjs.cloudflare.com/ajax/libs/angular-i18n/1.7.2/angular-locale_en-us.min.js';

describe('responsecache module', function() {
  before(async function() {
    await fs.remove(responseDir);
  });

  describe('encodeUrl', function() {
    it('encodes a simple url', function() {
      const {encodedHostname, encodedFilename} = responsecache.encodeUrl('https://website.example.org/index.html');
      assert.strictEqual(encodedHostname, 'website.example.org');
      assert.strictEqual(encodedFilename, '%2Findex.html');
    });

    it('encoded a more complex url', function() {
      const {encodedHostname, encodedFilename} = responsecache.encodeUrl('https://user@website.example.org:8080/index.html?abc=def#ref');
      assert.strictEqual(encodedHostname, 'website.example.org%3A8080');
      assert.strictEqual(encodedFilename, '%2Findex.html%3Fabc%3Ddef');
    });
  });

  describe('saveToResponseCache', function() {
    it('gets a body', async function() {
      await responsecache.saveToResponseCache(testUrl, responseDir);
    });
  });

  describe('streamFromResponseCache', function() {
    it('streams a correct length string', async function() {
      const writeStream = new MemoryStream(null, {readable: false});
      await responsecache.streamFromResponseCache(testUrl, responseDir, writeStream);
      const writeString = writeStream.toString();
      assert.strictEqual(writeString.length, 1384, 'cached url response has correct length');
    });
  });
});
