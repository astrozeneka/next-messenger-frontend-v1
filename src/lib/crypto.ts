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
  // Generate a random AES key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Generate a random IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the message with AES
  const messageBuffer = new TextEncoder().encode(message);
  const encryptedMessage = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    messageBuffer
  );

  // Export the AES key to encrypt it with RSA
  const aesKeyBuffer = await window.crypto.subtle.exportKey('raw', aesKey);

  // Import the RSA public key
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

  // Encrypt the AES key with RSA (only 32 bytes - well under Safari's 190 byte limit)
  let encryptedAesKey;
  try {
    encryptedAesKey = await window.crypto.subtle.encrypt(
      'RSA-OAEP',
      publicKey,
      aesKeyBuffer
    );
  } catch (error) {
    console.error('RSA encryption of AES key failed:', error);
    throw new Error('Encryption failed: ' + (error as Error).message);
  }

  // Combine encrypted AES key, IV, and encrypted message
  const result = {
    encryptedKey: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(encryptedAesKey)))),
    iv: btoa(String.fromCharCode.apply(null, Array.from(iv))),
    encryptedData: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(encryptedMessage)))),
  };

  return btoa(JSON.stringify(result));
};

export const decryptMessage = async (encryptedMessage: string, privateKeyBase64: string): Promise<string> => {
  // Parse the encrypted message structure
  const encryptedData = JSON.parse(atob(encryptedMessage));
  const { encryptedKey, iv, encryptedData: encryptedMessageData } = encryptedData;

  // Import the RSA private key
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

  // Decrypt the AES key with RSA
  const encryptedAesKeyBuffer = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
  const decryptedAesKeyBuffer = await window.crypto.subtle.decrypt(
    'RSA-OAEP',
    privateKey,
    encryptedAesKeyBuffer
  );

  // Import the decrypted AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    decryptedAesKeyBuffer,
    {
      name: 'AES-GCM',
    },
    false,
    ['decrypt']
  );

  // Decrypt the message with AES
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const encryptedMessageBuffer = Uint8Array.from(atob(encryptedMessageData), c => c.charCodeAt(0));
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer,
    },
    aesKey,
    encryptedMessageBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
};