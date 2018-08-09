/**
 * Manage certificates for use with tls. These certificates are
 * created and cached as needed based on a hostname and certificate
 * authority.
 *
 * @module certificates
 */

const forge = require('node-forge');
const fs = require('fs-extra');
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars
const TraceError = require('./utils').TraceError;

function promiseGenerateKeyPair(options) {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair(options, (err, keypair) => {
      if (err) {
        reject(new TraceError('Failure generating key pair', err));
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
  try {
    const keys = await promiseGenerateKeyPair({bits: 2048});

    const cert = forge.pki.createCertificate();
    // a large number
    cert.serialNumber = Math.floor(Math.random() * 100000000000000000).toString(10);
    // notBefore a week earlier than now to handle small clock differences between systems
    cert.validity.notBefore = new Date(Date.now() - 1000 * 3600 * 24 * 7);
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 11);
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
  } catch (error) {
    throw new TraceError('Unexpected error in makeServerCertificate', error);
  }
}

/**
 * Ensure that a certificate is cached locally
 *
 * @param {string} certPem The server certificate to cache in PEM format
 * @param {string} keyPem The server private key to cache in PEM format
 * @param {string} cacheDir Path to the root directory for cached certificates (must exist)
 * @param {boolean} [force = false] Should we replace an existing entry in the cache?
 * @returns {boolean} true if the certPem was written, false if existed and no write occurred.
 */
async function cacheCertificate(certPem, keyPem, cacheDir, force = false) {
  try {
    const cacheDirExists = await fs.pathExists(cacheDir);
    if (!cacheDirExists) {
      throw new Error('certificates.cacheCertificate: cacheDir must exist');
    }
    const certForge = forge.pki.certificateFromPem(certPem);
    const hostname = certForge.subject.getField('CN').value;
    const cachedCertPath = cacheDir + '/' + hostname;
    const cachedKeyPath = cachedCertPath + '.key';
    const cachedCertExists = await fs.pathExists(cachedCertPath);
    let didWrite = false;
    if (!cachedCertExists || force) {
      await fs.writeFile(cachedCertPath, certPem);
      await fs.writeFile(cachedKeyPath, keyPem);
      didWrite = true;
    }
    return didWrite;
  } catch (error) {
    throw new TraceError('Unexpected error in cacheCertificate', error);
  }
}

const certPromises = new Map(); // Active promises to getOrCreateCertificate

/**
 * Get a server certificate from cache, or create and cache if needed. This variant
 * combines multiple requests to the same hostname.
 * @param {string} hostname The server hostname, like example.caspia.org
 * @param {string} cacheDir Path to the root directory for cached certificates (must exist)
 * @param {string} caCrtPem Certificate for certificate authority, pem format
 * @param {string} caKeyPem Private key for the certificate authority, pem format
 * @returns {CertificateCompletePem} The server key, certificate in pem format
 */
async function multiGetOrCreateServerCertificate(hostname, cacheDir, caCrtPem, caKeyPem) {
  if (certPromises.has(hostname)) {
    return certPromises.get(hostname);
  }
  const promiseHostnameCert = getOrCreateServerCertificate(hostname, cacheDir, caCrtPem, caKeyPem);
  certPromises.set(hostname, promiseHostnameCert);
  const {cert, privateKey} = await promiseHostnameCert;
  certPromises.delete(hostname);
  return {cert, privateKey};
}

/**
 * Get a server certificate from cache, or create and cache if needed
 * @param {string} hostname The server hostname, like example.caspia.org
 * @param {string} cacheDir Path to the root directory for cached certificates (must exist)
 * @param {string} caCrtPem Certificate for certificate authority, pem format
 * @param {string} caKeyPem Private key for the certificate authority, pem format
 * @returns {CertificateCompletePem} The server key, certificate in pem format
 */
async function getOrCreateServerCertificate(hostname, cacheDir, caCrtPem, caKeyPem) {
  try {
    const cachedCertPath = cacheDir + '/' + hostname;
    const cachedKeyPath = cachedCertPath + '.key';
    let cert; // the server certificate to return in pem format
    let privateKey; // the server key in pem format
    if (await fs.pathExists(cachedCertPath)) {
      cert = await fs.readFile(cachedCertPath, 'ascii');
      privateKey = await fs.readFile(cachedKeyPath, 'ascii');
    } else {
      ({cert, privateKey} = await makeServerCertificate(hostname, caCrtPem, caKeyPem));
      await cacheCertificate(cert, privateKey, cacheDir);
    }
    return {cert, privateKey};
  } catch (error) {
    throw new TraceError('Unexpected error in getOrCreateServerCertificate', error.stack);
  }
}

module.exports = {
  makeServerCertificate,
  cacheCertificate,
  getOrCreateServerCertificate,
  multiGetOrCreateServerCertificate
};
