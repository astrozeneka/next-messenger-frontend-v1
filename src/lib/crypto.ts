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

const PRIVATE_KEYS_STORAGE_KEY = 'privateKeys';

export const storePrivateKey = (publicKey: string, privateKey: string): void => {
  const existingKeys = getPrivateKeysMap();
  existingKeys[publicKey] = privateKey;
  localStorage.setItem(PRIVATE_KEYS_STORAGE_KEY, JSON.stringify(existingKeys));
};

export const getPrivateKey = (publicKey: string): string | null => {
  const keysMap = getPrivateKeysMap();
  return keysMap[publicKey] || null;
};

export const getPrivateKeysMap = (): Record<string, string> => {
  const stored = localStorage.getItem(PRIVATE_KEYS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const removePrivateKey = (publicKey: string): void => {
  const existingKeys = getPrivateKeysMap();
  delete existingKeys[publicKey];
  localStorage.setItem(PRIVATE_KEYS_STORAGE_KEY, JSON.stringify(existingKeys));
};