/**
 * Testing of certificates.js module
 */

const assert = require('assert');
const fs = require('fs');
const certificates = require('../certificates');
const caKeyPem = fs.readFileSync('test/ca.key');
const caCertPem = fs.readFileSync('test/ca.crt');
const forge = require('node-forge');
// const prettyFormat = require('pretty-format');
const mkdirp = require('mkdirp');

describe('certificates module', function() {
  describe('makeServerCertificate', function() {
    it('Creates and signs certificates', async function() {
      this.timeout(10000);
      const {cert, privateKey} = await certificates.makeServerCertificate('example.caspia.org', caCertPem, caKeyPem);
      const forgeKey = forge.pki.privateKeyFromPem(privateKey);
      assert(forgeKey, 'pem key converted to object');

      const forgeCert = forge.pki.certificateFromPem(cert);
      assert.strictEqual(forgeCert.subject.getField('CN').value, 'example.caspia.org', 'CN has expected value');
      assert.strictEqual(forgeCert.issuer.getField('CN').value, 'Kent James', 'issuer is from CA');
      await new Promise((resolve, reject) => {
        mkdirp('test/results', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
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
  });
});
