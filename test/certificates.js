/**
 * Testing of certificates.js module
 */

const assert = require('assert');
const fs = require('fs-extra');
const certificates = require('../certificates');
const caKeyPem = fs.readFileSync('test/ca.key');
const caCertPem = fs.readFileSync('test/ca.crt');
const forge = require('node-forge');
// const prettyFormat = require('pretty-format');

describe('certificates module', function() {
  let cert, forgeCert, privateKey, forgeKey;
  const cacheDir = 'test/results/cacheDir';

  before(async function() {
    await fs.remove(cacheDir);
    await fs.ensureDir(cacheDir);
  });

  describe('makeServerCertificate', function() {
    it('Creates and signs certificates', async function() {
      this.timeout(10000);
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
      let didWrite = await certificates.cacheCertificate(cert, cacheDir);
      assert(didWrite, 'write to empty directory didWrite');
      didWrite = await certificates.cacheCertificate(cert, cacheDir);
      assert(!didWrite, 'cache of existing certificate does not write');
      didWrite = await certificates.cacheCertificate(cert, cacheDir, true);
      assert(didWrite, 'forced write overwrites existing certificate');
      const hostname = forgeCert.subject.getField('CN').value;
      const cachedCertificateExists = await fs.pathExists(cacheDir + '/' + hostname);
      assert(cachedCertificateExists, 'cache file of certificate exists');
      const cachedCertPem = await fs.readFile(cacheDir + '/' + hostname);
      assert(!!cachedCertPem.length, 'cached certificate pem has length');
      const cachedCertForge = forge.pki.certificateFromPem(cachedCertPem);
      assert.strictEqual(cachedCertForge.subject.getField('CN').value, hostname,
        'cached certificate hostname matches');
    });
  });
});
