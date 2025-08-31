'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { encryptMessage, getPrivateKey, decryptMessage } from "@/lib/crypto";
import { useEffect, useState } from "react";

// TODO, refactor in a separate interface file
export interface Msg {
  id: string
  created_at: string | Date
  updated_at: string | Date
  conversation_id: string
  sender_id: string
  content: string
  type: string
  status: string
}

interface DecryptedMessageProps {
  message: Msg;
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
        console.log(message);
        const decrypted = await decryptMessage(message.content, encryptionKey);
        setDecryptedContent(decrypted);
      } catch (error) {
        console.error('Decryption failed:', error);
        setDecryptedContent('[Decryption failed]');
      } finally {
        setIsDecrypting(false);
      }
    };

    decrypt();
  }, [message, encryptionKey]);

  if (isDecrypting) {
    return (
      <div className="mb-2">
        <span className="font-bold">REMOTE:</span> <span className="italic text-gray-500">Decrypting...</span>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <span className="font-bold">REMOTE:</span> {decryptedContent} [{message.status}]
    </div>
  );
}

export default function MessengerDetail({ params }: { params: { id: string } }) {
  const conversation_id = params.id;
  const { token, user } = useAuth();
  const { messages, isConnected, initializeMessages } = useMessages(
    `conversation.${conversation_id}`,
    user?.id,
    token || undefined,
    conversation_id
  );

  // State variables
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remoteUser, setRemoteUser] = useState<{
    id: string;
    name: string;
    email: string;
    public_key: string | null;
  } | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

  // Get the remote user list
  useEffect(()=>{
    if (!token) return;
    
    const fetchRemoteUsers = async () => {
      try {
        const response = await fetch(`/api/conversations/${conversation_id}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        if (data.length !== 1) {
          console.error('Unexpected number of remote users:', data);
          return;
        }
        setRemoteUser(data[0]);
      } catch (error) {
        console.error('Error fetching remote users:', error);
      }
    };

    fetchRemoteUsers();
  }, [token, conversation_id])

  // Load encryption key from localStorage
  useEffect(() => {
    if (!remoteUser) return;
    if (!user?.public_key) return;

    const userPrivateKey = getPrivateKey(user.public_key);
    if (userPrivateKey) {
      setEncryptionKey(userPrivateKey);
      console.log('Private key loaded successfully');
    } else {
      console.error('Private key not found in localStorage');
    }
  }, [user, remoteUser]);

  // Load messages when the page loads
  useEffect(() => {
    if (!token || !conversation_id) return;

    const loadMessages = async () => {
      try {
        console.log("*****")
        const response = await fetch(`/api/msgs?conversation_id=${conversation_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const fetchedMessages = await response.json();
          const formattedMessages = fetchedMessages.map((msg: Msg) => ({
            ...msg,
            id: msg.id.toString(),
            conversation_id: msg.conversation_id.toString(),
            sender_id: msg.sender_id.toString()
          }));
          
          // Initialize messages using the hook's method
          initializeMessages(formattedMessages);
        } else {
          console.error('Error loading messages:', response.statusText);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [token, conversation_id, initializeMessages]);

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

      const encryptedMessage = await encryptMessage(messageToSend, remoteUser.public_key);
      const response = await fetch('/api/msgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id,
          content: encryptedMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Message sent successfully:', data);
        setMessage('');
        setSelectedFile(null);
        
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        console.error('Error sending message:', response.statusText);
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

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Chat with {remoteUser?.name}</h1>
          <div className="text-sm text-gray-500">
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <div className="text-sm text-gray-500">
            Conversation ID: {conversation_id}
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-md h-64 overflow-y-auto">
          {/* Display unified message list (sorted and deduplicated) */}
          {messages.map((msg) => (
            <div key={msg.id}>
              <DecryptedMessage
                message={msg}
                encryptionKey={encryptionKey}
              />
            </div>
          ))}
          
          {messages.length === 0 && (
            <p className="text-gray-500 text-center">No messages yet...</p>
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
      </div>
    </div>
  );
}