/**
 * Setup servers that read from reasponse cache
 */

const http = require('http');
const tls = require('tls');
const https = require('https');
const fetch = require('node-fetch');
const fs = require('fs-extra');

const dummyKey = fs.readFileSync('test/results/cacheDir/example.caspia.org.key');
const dummyCert = fs.readFileSync('test/results/cacheDir/example.caspia.org');
const caCrt = fs.readFileSync('test/ca.crt');
const caKey = fs.readFileSync('test/ca.key');

const dontCacheSites = [
  'http://google.com'
];

const responsecache = require('./responsecache');
const certificates = require('./certificates');

const responseCachePath = 'test/results/responseDir';
const certificateCachePath = 'test/results/cacheDir';
const port = 3000;

async function cacheAndRespond(siteUrl, responseCachePath, response) {
  const isCached = await responsecache.isCached(siteUrl, responseCachePath);
  if (!isCached) {
    await responsecache.saveToResponseCache(siteUrl, responseCachePath);
  }
  await responsecache.streamFromResponseCache(siteUrl, responseCachePath, response);
}

const options = {
  rejectUnauthorized: true,
  key: dummyKey,
  cert: dummyCert,
  SNICallback: (servername, cb) => {
    console.log('SNICallback servername ' + servername);
    certificates.getOrCreateServerCertificate(servername, certificateCachePath, caCrt, caKey)
      .then(serverCertKey => {
        cb(null, tls.createSecureContext({key: serverCertKey.privateKey, cert: serverCertKey.cert, ca: caCrt}));
      });
  }
};

const tlsServer = https.createServer(options);
tlsServer.on('request', (request, response) => {
  response.write('I am tls');
  response.end();
});
tlsServer.listen(3001);
console.log('tls server is listening on port 3001');

const server = http.createServer();
server.on('request', (request, response) => {
  // proxy to remote server
  // console.log('host: ' + request.headers.host);
  // console.log('url: ' + request.url);

  // We only support GET
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.statusMessage = 'offlineweb proxu only supports GET';
    response.end();
    return;
  }
  // bypass dont cache sites
  let dontCache = false;
  for (let site of dontCacheSites) {
    if (request.url.startsWith(site)) {
      dontCache = true;
      break;
    }
  }
  if (dontCache) {
    console.log('Serving directly: ' + request.url);
    // serve directly
    fetch(request.url)
      .then(fresponse => {
        // for (let pair of fresponse.headers.entries()) {
        //   response.setHeader(pair[0], pair[1]);
        // }
        response.setHeader('content-encoding', 'identity');
        fresponse.body.pipe(response);
        fresponse.body.on('end', () => {
          response.end();
        });
      })
      .catch(err => {
        response.statusCode = 500;
        response.statusMessage = err.toString();
        console.log(err.toString());
        response.end();
      });
  } else {
    console.log('cacheAndRespond: ' + request.url);
    cacheAndRespond(request.url, responseCachePath, response)
      .then(() => {
        response.end();
      }).catch(err => {
        response.statusCode = 500;
        response.statusMessage = err.toString();
        console.log(err.toString());
        response.end();
      });
  }
});

server.listen(port);
console.log('Server is listening on port ' + port);
