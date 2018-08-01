/**
 * Manage certificates for use with tls. These certificates are
 * created and cached as needed based on a hostname and certificate
 * authority.
 *
 * @module certificates
 */

const forge = require('node-forge');
const fs = require('fs-extra');
// const prettyFormat = require('pretty-format');

function promiseGenerateKeyPair(options) {
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

/**
 * @typedef {Object} CertificateCompletePem
 * @property {string} cert Server certificate in pem format
 * @property {string} privateKey Server private key in pem format
 *
 */

/**
 * make a server certificate signed with a certificate authority
 * @param {string} commonName The hostname, like example.caspia.org
 * @param {string} caCrtPem Certificate for certificate authority, pem format
 * @param {string} caKeyPem Private key for the certificate authority, pem format
 * @returns {CertificateCompletePem} The created certificate including private key
 */
async function makeServerCertificate(commonName, caCrtPem, caKeyPem) {
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

/**
 * Ensure that a certificate is cached locally
 *
 * @param {string} certPem The server certificate to cache in PEM format
 * @param {string} cacheDir Path to the root directory for cached certificates (must exist)
 * @param {boolean} [force = false] Should we replace an existing entry in the cache?
 * @returns {boolean} true if the certPem was written, false if existed and no write occurred.
 */
async function cacheCertificate(certPem, cacheDir, force = false) {
  const cacheDirExists = await fs.pathExists(cacheDir);
  if (!cacheDirExists) {
    throw new Error('certificates.cacheCertificate: cacheDir must exist');
  }
  const certForge = forge.pki.certificateFromPem(certPem);
  const hostname = certForge.subject.getField('CN').value;
  const cachedCertPath = cacheDir + '/' + hostname;
  const cachedCertExists = await fs.pathExists(cachedCertPath);
  let didWrite = false;
  if (!cachedCertExists || force) {
    fs.writeFile(cachedCertPath, certPem);
    didWrite = true;
  }
  return didWrite;
}

module.exports = {
  makeServerCertificate,
  cacheCertificate
};
