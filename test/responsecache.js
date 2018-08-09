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
  this.timeout(10000);
  before(async function() {
    await fs.remove(responseDir);
  });

  describe('encodeUrl', function() {
    it('encodes a simple url', function() {
      let {encodedHostname, encodedFilename} = responsecache.encodeUrl('https://website.example.org/index.html');
      assert.strictEqual(encodedHostname, 'website.example.org');
      assert.strictEqual(encodedFilename, '%2Findex.html');
      // hash for long filename
      const longUrl = 'https://www.example.org/01234567891123456789212345678931234567894123456789512345678961234567897123456789812345678991234567890123456789112345678921234567893123456789.js';
      ({encodedFilename} = responsecache.encodeUrl(longUrl));
      assert.strictEqual(encodedFilename, '47870b6a948beab629763b3788e27d9f71c4cc9068865bd38d7e800c496419a8', 'log filenames hash');
    });

    it('encoded a more complex url', function() {
      const {encodedHostname, encodedFilename} = responsecache.encodeUrl('https://user@website.example.org:8080/index.html?abc=def#ref');
      assert.strictEqual(encodedHostname, 'website.example.org%3A8080');
      assert.strictEqual(encodedFilename, '%2Findex.html%3Fabc%3Ddef');
    });
  });

  describe('saveToResponseCache', function() {
    it('throws an error', async function() {
      try {
        await responsecache.saveToResponseCache('http://doesnotexist.example.org', responseDir);
        assert(false, 'should not be reached');
      } catch (err) {
        // console.log('Expected error: ' + err.stack);
        assert(true, 'expected error');
      }
    });

    it('gets a body', async function() {
      await responsecache.saveToResponseCache(testUrl, responseDir);
    });
  });

  describe('isCached', function() {
    it('detects cached', async function() {
      assert(await responsecache.isCached(testUrl, responseDir));
    });
    it('detects uncached', async function() {
      assert(!(await responsecache.isCached('http://invalid.com', responseDir)));
    });
  });

  describe('streamFromResponseCache', function() {
    it('throws an error', async function() {
      try {
        await responsecache.streamFromResponseCache(testUrl, responseDir, {});
        assert(false, 'should not be reached');
      } catch (err) {
        // console.log('expected error: ' + err.stack);
        assert(true, 'Expected error');
      }
    });

    it('streams a correct length string', async function() {
      const writeStream = new MemoryStream(null, {readable: false});
      await responsecache.streamFromResponseCache(testUrl, responseDir, writeStream);
      const writeString = writeStream.toString();
      assert.strictEqual(writeString.length, 1384, 'cached url response has correct length');
    });
  });
});
