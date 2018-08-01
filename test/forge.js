/**
 * Demo and test of node-forge module for certificate management.
 */
const forge = require('node-forge');
const assert = require('assert');
const fs = require('fs');
// const prettyFormat = require('pretty-format');

/*
  In trying to understand this package, I figured out that there
  are "forge" objects (like a certificate) which are js objects
  native to the forge package. Then there are the pem formats of
  these objects, which as the string representations used externally
  to forge. These are strings that begin with, for example,
  '-----BEGIN CERTIFICATE-----' that are commonly used in openssl
  and other programs. As is typical, is is tricky sometimes to figure
  out what the program expects.
*/

const caCertificatePem = fs.readFileSync('test/ca.crt');

describe('node-forge module demo and test', function () {
  it('Has a method pki', function () {
    assert(forge.pki, 'method pki exists');
  });

  it('Converts PEM certificate to forge certificate', function () {
    const caCertificate = forge.pki.certificateFromPem(caCertificatePem);
    assert.strictEqual(caCertificate.subject.getField('O').value,
      'Caspia',
      'Organization is Caspia');
  });
});
