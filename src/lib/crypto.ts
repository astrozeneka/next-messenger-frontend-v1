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

export const encryptMessage = async (message: string, publicKeyBase64: string): Promise<string> => {
  const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
  
  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );

  const messageBuffer = new TextEncoder().encode(message);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    'RSA-OAEP',
    publicKey,
    messageBuffer
  );

  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(encryptedBuffer))));
};

export const decryptMessage = async (encryptedMessage: string, privateKeyBase64: string): Promise<string> => {
  const privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  
  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );

  const encryptedBuffer = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0));
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    'RSA-OAEP',
    privateKey,
    encryptedBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
};