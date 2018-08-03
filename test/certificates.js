/**
 * Testing of certificates.js module
 */

const assert = require('assert');
const fs = require('fs-extra');
const certificates = require('../certificates');
const caKeyPem = fs.readFileSync('test/ca.key');
const caCertPem = fs.readFileSync('test/ca.crt');
const forge = require('node-forge');
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars

describe('certificates module', function() {
  let cert, forgeCert, privateKey, forgeKey;
  const cacheDir = 'test/results/cacheDir';

  before(async function() {
    await fs.remove(cacheDir);
    await fs.ensureDir(cacheDir);
  });

  describe('makeServerCertificate', function() {
    it('Creates and signs certificates', async function() {
      this.timeout(30000);
      ({cert, privateKey} = await certificates.makeServerCertificate('example.caspia.org', caCertPem, caKeyPem));
      forgeKey = forge.pki.privateKeyFromPem(privateKey);
      assert(forgeKey, 'pem key converted to object');

      forgeCert = forge.pki.certificateFromPem(cert);
      assert.strictEqual(forgeCert.subject.getField('CN').value, 'example.caspia.org', 'CN has expected value');
      assert.strictEqual(forgeCert.issuer.getField('CN').value, 'Kent James', 'issuer is from CA');
      await fs.ensureDir('test/results');
      fs.writeFileSync('test/results/example.caspia.org.pem', cert);
      fs.writeFileSync('test/results/example.caspia.org.key', privateKey);

      await new Promise((resolve, reject) => {
        const caStore = forge.pki.createCaStore();
        caStore.addCertificate(forge.pki.certificateFromPem(caCertPem));
        forge.pki.verifyCertificateChain(caStore, [forgeCert], function(vfd, depth, chain) {
          if (vfd) {
            console.log('Certificate verified');
            resolve();
          } else {
            reject(new Error('certificate unverified'));
          }
        });
      });
    });

    it('caches certificates', async function() {
      this.timeout(10000);
      let didWrite = await certificates.cacheCertificate(cert, privateKey, cacheDir);
      assert(didWrite, 'write to empty directory didWrite');

      didWrite = await certificates.cacheCertificate(cert, privateKey, cacheDir);
      assert(!didWrite, 'cache of existing certificate does not write');

      didWrite = await certificates.cacheCertificate(cert, privateKey, cacheDir, true);
      assert(didWrite, 'forced write overwrites existing certificate');

      const hostname = forgeCert.subject.getField('CN').value;
      const cachedCertificateExists = await fs.pathExists(cacheDir + '/' + hostname);
      assert(cachedCertificateExists, 'cache file of certificate exists');

      const cachedKeyExists = await fs.pathExists(cacheDir + '/' + hostname + '.key');
      assert(cachedKeyExists, 'cache file of privateKey exists');

      const cachedCertPem = await fs.readFile(cacheDir + '/' + hostname, 'ascii');
      assert(!!cachedCertPem.length, 'cached certificate pem has length');

      const cachedCertForge = forge.pki.certificateFromPem(cachedCertPem);
      assert.strictEqual(cachedCertForge.subject.getField('CN').value, hostname,
        'cached certificate hostname matches');
    });

    it('gets or creates server certificates', async function() {
      this.timeout(30000);
      const certKey1 = await certificates.getOrCreateServerCertificate('example.caspia.org', cacheDir, caCertPem, caKeyPem);
      const cert1 = certKey1.cert;
      // const key1 = certKey1.privateKey;
      const cert1Forge = forge.pki.certificateFromPem(cert1);
      assert.strictEqual('example.caspia.org', cert1Forge.subject.getField('CN').value, 'gets cached cert');

      let cert2CacheExists = await fs.pathExists(cacheDir + '/' + 'example.caspia.com');
      assert(!cert2CacheExists, 'example.caspia.com is not already cached');

      const certKey2 = await certificates.getOrCreateServerCertificate('example.caspia.com', cacheDir, caCertPem, caKeyPem);
      const cert2 = certKey2.cert;
      const cert2Forge = forge.pki.certificateFromPem(cert2);
      assert.strictEqual('example.caspia.com', cert2Forge.subject.getField('CN').value, 'creates new cert');

      cert2CacheExists = await fs.pathExists(cacheDir + '/' + 'example.caspia.com');
      assert(cert2CacheExists, 'example.caspia.com is cached after get');
    });
  });
});
