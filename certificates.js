/**
 * Manage certificates for use with tls. These certificates are
 * created and cached as needed based on a hostname and certificate
 * authority.
 *
 * @module certificates.js
 */

const forge = require('node-forge');
// const prettyFormat = require('pretty-format');

function promiseGenerateKeyPair (options) {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair(options, (err, keypair) => {
      if (err) {
        reject(err);
      } else {
        resolve(keypair);
      }
    });
  });
}

// function to create and sign certificate. Adopted from tls example in node-forge repo.
async function makeServerCertificate (commonName, caCrtPem, caKeyPem) {
  const keys = await promiseGenerateKeyPair({bits: 2048});

  const cert = forge.pki.createCertificate();
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + 10);
  var attrs = [
    {
      name: 'commonName',
      value: commonName
    },
    {
      name: 'countryName',
      value: 'US'
    },
    {
      shortName: 'ST',
      value: 'Washington'
    },
    {
      name: 'localityName',
      value: 'Redmond'
    },
    {
      name: 'organizationName',
      value: 'Caspia'
    },
    {
      shortName: 'OU',
      value: 'offlineweb'
    }
  ];
  cert.setSubject(attrs);
  const caCrt = forge.pki.certificateFromPem(caCrtPem);
  cert.setIssuer(caCrt.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints',
      cA: false
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    }
  ]);
  cert.publicKey = keys.publicKey;

  // sign certificate using the certificate authority
  cert.sign(forge.pki.privateKeyFromPem(caKeyPem), forge.md.sha256.create());
  return {
    cert: forge.pki.certificateToPem(cert),
    privateKey: forge.pki.privateKeyToPem(keys.privateKey)
  };
}

module.exports = {
  makeServerCertificate
};
