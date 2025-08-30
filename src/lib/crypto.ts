export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export const generateKeyPair = async (): Promise<KeyPair> => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyBase64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(publicKeyBuffer))));
  const privateKeyBase64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(privateKeyBuffer))));

  return {
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
  };
};

export const storePrivateKey = (privateKey: string): void => {
  localStorage.setItem('privateKey', privateKey);
};

export const getPrivateKey = (): string | null => {
  return localStorage.getItem('privateKey');
};