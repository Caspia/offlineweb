
createKeyPair(512, (err, keypair) => {

});

promiseCreateKeyPair = function (bits) {
  return new Promise( (resolve, reject) => {
    createKeyPair(bits, (err, keypair) => {
      if (err) reject(err);
      else resolve(keypair);
    })
  })
}