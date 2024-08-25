class Crypto {
  constructor(options = {}) {
    this.jsEncrypt = new JSEncrypt({
      default_key_size: options.keySize || 1024,
    });
    if (options.privateKey) {
      this.setKeyPair(options.privateKey);
    } else {
      this.generateKeyPair();
    }
  }

  setKeyPair(privateKey) {
    this.jsEncrypt.setPrivateKey(privateKey);
    this.privateKey = privateKey;
    this.publicKey = this.jsEncrypt.getPublicKey();
  }

  generateKeyPair() {
    this.jsEncrypt.getKey();
    this.privateKey = this.jsEncrypt.getPrivateKey();
    this.publicKey = this.jsEncrypt.getPublicKey();
  }

  generateSessionKey() {
    return CryptoJS.lib.WordArray.random(32);
  }

  encryptSymmetric(message, sessionKey) {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(message, sessionKey, { iv: iv });
    return {
      iv: CryptoJS.enc.Hex.stringify(iv),
      encryptedData: encrypted.toString()
    };
  }

  decryptSymmetric(encryptedMessage, sessionKey) {
    const decrypted = CryptoJS.AES.decrypt(
      encryptedMessage.encryptedData,
      sessionKey,
      { iv: CryptoJS.enc.Hex.parse(encryptedMessage.iv) }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  encryptAsymmetric(data, recipientPublicKey) {
    const jsEncrypt = new JSEncrypt();
    jsEncrypt.setPublicKey(recipientPublicKey);
    return jsEncrypt.encrypt(data);
  }

  decryptAsymmetric(encryptedData) {
    return this.jsEncrypt.decrypt(encryptedData);
  }

  sign(data) {
    return this.jsEncrypt.sign(data, CryptoJS.SHA256, "sha256");
  }

  verify(data, signature, publicKey) {
    const jsEncrypt = new JSEncrypt();
    jsEncrypt.setPublicKey(publicKey);
    return jsEncrypt.verify(data, signature, CryptoJS.SHA256);
  }

  getPublicKey() {
    return this.publicKey;
  }

  getPrivateKey() {
    return this.privateKey;
  }
}

class Messenger {
  constructor(name, options = {}) {
    this.name = name;
    this.crypto = new Crypto(options);
  }

  sendMessage(message, recipientPublicKey) {
    const sessionKey = this.crypto.generateSessionKey();
    const encryptedMessage = this.crypto.encryptSymmetric(message, sessionKey);
    const encryptedSessionKey = this.crypto.encryptAsymmetric(sessionKey.toString(), recipientPublicKey);
    const signature = this.crypto.sign(message);

    return {
      sender: this.name,
      encryptedMessage,
      encryptedSessionKey,
      signature,
      timestamp: new Date().toISOString()
    };
  }

  receiveMessage(encryptedPackage, senderPublicKey) {
    const sessionKey = this.crypto.decryptAsymmetric(encryptedPackage.encryptedSessionKey);
    const decryptedMessage = this.crypto.decryptSymmetric(encryptedPackage.encryptedMessage, CryptoJS.enc.Hex.parse(sessionKey));
    const isSignatureValid = this.crypto.verify(decryptedMessage, encryptedPackage.signature, senderPublicKey);

    return {
      sender: encryptedPackage.sender,
      message: decryptedMessage,
      isSignatureValid,
      timestamp: encryptedPackage.timestamp
    };
  }

  getPublicKey() {
    return this.crypto.getPublicKey();
  }

  getPrivateKey() {
    return this.crypto.getPrivateKey();
  }
}