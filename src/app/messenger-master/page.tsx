'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { getPrivateKey, encryptMessage, decryptMessage } from '../../lib/crypto';

interface DecryptedMessageProps {
  message: { username: string; message: string };
  encryptionKey: string | null;
}

function DecryptedMessage({ message, encryptionKey }: DecryptedMessageProps) {
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(true);

  useEffect(() => {
    const decrypt = async () => {
      if (!encryptionKey) {
        setDecryptedContent('[Unable to decrypt - private key not loaded]');
        setIsDecrypting(false);
        return;
      }

      try {
        const decrypted = await decryptMessage(message.message, encryptionKey);
        setDecryptedContent(decrypted);
      } catch (error) {
        console.error('Decryption failed:', error);
        setDecryptedContent('[Decryption failed]');
      } finally {
        setIsDecrypting(false);
      }
    };

    decrypt();
  }, [message.message, encryptionKey]);

  if (isDecrypting) {
    return (
      <div className="mb-2">
        <span className="font-bold">{message.username}:</span> <span className="italic text-gray-500">Decrypting...</span>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <span className="font-bold">{message.username}:</span> {decryptedContent}
    </div>
  );
}

export default function MessengerMaster() {
  const { user, isAuthenticated, loading, logout, token } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const { messages, isConnected } = useMessages('chat');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleMessageSend = async () => {
    if (!message.trim() && !selectedFile) return;
    
    if (!remoteUser?.public_key) {
      console.error('Remote user public key not available');
      return;
    }

    setIsSending(true);
    
    try {
      let messageToSend = message.trim();

      // If there's a selected file, upload it first
      if (selectedFile) {
        // Get presigned URL
        const presignedResponse = await fetch('/api/upload/presigned-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error('Failed to get presigned URL');
        }

        const { presignedUrl, key } = await presignedResponse.json();

        // Upload file to S3
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        // Construct S3 URL
        const fileUrl = `https://next-messenger.s3.ap-southeast-1.amazonaws.com/${key}`;
        
        // Append file info to message
        const fileInfo = `(${selectedFile.name})[${fileUrl}]`;
        messageToSend = messageToSend ? `${messageToSend} ${fileInfo}` : fileInfo;

        console.log('File uploaded successfully:', key);
      }

      // Encrypt and send the message
      const encryptedMessage = await encryptMessage(messageToSend, remoteUser.public_key);
      
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: encryptedMessage,
          username: user?.name,
        }),
      });

      if (response.ok) {
        console.log('Message sent successfully');
        setMessage('');
        setSelectedFile(null);
        
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      console.log('File selected:', file);
    }
  };

  const handleSendFileClick = () => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput?.click();
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/messenger-login');
    }
  }, [isAuthenticated, loading, router]);

  const [remoteUser, setRemoteUser] = useState<{
    id: string;
    name: string;
    email: string;
    public_key: string | null;
  } | null>(null);

  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchRemoteUser = async () => {
      if (!user?.email || !token) return;

      try {
        const response = await fetch(`/api/users/remote?email=${encodeURIComponent(user.email)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const remoteUserData = await response.json();
          setRemoteUser(remoteUserData);
          console.log("Remote user fetched:", remoteUserData);
        } else {
          console.error('Failed to fetch remote user');
        }
      } catch (error) {
        console.error('Error fetching remote user:', error);
      }
    };

    fetchRemoteUser();
  }, [user, token]);

  useEffect(() => {
    console.log(user); // no public_key provided
    if (!user?.public_key) return;

    const userPrivateKey = getPrivateKey(user.public_key);
    if (userPrivateKey) {
      setEncryptionKey(userPrivateKey);
      console.log('Private key loaded successfully');
    } else {
      console.error('Private key not found in localStorage');
      router.push('/login');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Hello {user.name}</h1>
          <div className="text-sm text-gray-500">
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
        
        <div className="bg-gray-100 p-4 rounded-md h-64 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center">No messages yet...</p>
          ) : (
            messages.map((msg, index) => (
              <DecryptedMessage 
                key={index} 
                message={msg} 
                encryptionKey={encryptionKey} 
              />
            ))
          )}
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleMessageSend}
            disabled={isSending}
            className={`px-4 py-2 text-white rounded-md ${
              isSending 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
          <button
            onClick={handleSendFileClick}
            className={`px-4 py-2 text-white rounded-md ${
              selectedFile
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {selectedFile ? 'File Selected' : 'Send File'}
          </button>
        </div>

        <input
          id="file-input"
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile && (
          <div className="text-sm text-gray-600">
            Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </div>
        )}

        <div className="text-center">
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}