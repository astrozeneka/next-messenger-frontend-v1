'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
// import { useConversations } from "@/hooks/useConversations";
import { encryptMessage, getPrivateKey, decryptMessage } from "@/lib/crypto";
import { useEffect, useState } from "react";

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
  isReceived: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
}

function DecryptedMessage({ message, encryptionKey, isReceived, onEdit }: DecryptedMessageProps) {
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    const decrypt = async () => {
      if (!encryptionKey) {
        setDecryptedContent('[Unable to decrypt - private key not loaded]');
        setIsDecrypting(false);
        return;
      }

      try {
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

  const handleEditClick = () => {
    setEditContent(decryptedContent);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== decryptedContent) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  if (isEditing) {
    return (
      <div className="mb-2">
        <span className="font-bold">REMOTE:</span>
        <div className="mt-1">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm"
            rows={2}
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSaveEdit}
              className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <span className="font-bold">REMOTE:</span> {decryptedContent} [{message.status}]
      {!isReceived && (
        <button 
          onClick={handleEditClick}
          className="text-xs text-gray-500 hover:text-blue-500 ml-1"
        >
          (Edit)
        </button>
      )}
    </div>
  );
}

interface ConversationDetailProps {
  conversationId: string;
}

export default function ConversationDetail({ conversationId }: ConversationDetailProps) {
  const { token, user } = useAuth();
  const { messages, isConnected, initializeMessages } = useMessages(
    `conversation.${conversationId}`,
    user?.id,
    token || undefined,
    conversationId
  );
  //const { updateUnreadCount } = useConversations(user?.id, token || undefined);

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

  useEffect(() => {
    if (!token) return;
    
    const fetchRemoteUsers = async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/users`, {
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
  }, [token, conversationId]);

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

  useEffect(() => {
    if (!token || !conversationId || !user?.id) return;

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/msgs?conversation_id=${conversationId}`, {
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
          
          initializeMessages(formattedMessages);

          const messagesToMarkAsRead = formattedMessages
            .filter((msg: Msg) => msg.sender_id !== user.id && (msg.status === 'sent' || msg.status === 'delivered'))
            .map((msg: Msg) => msg.id);

          if (messagesToMarkAsRead.length > 0) {
            try {
              const readResponse = await fetch('/api/msgs/read', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  message_ids: messagesToMarkAsRead,
                  conversation_id: conversationId
                })
              });

              if (readResponse.ok) {
                const readResult = await readResponse.json();
                console.log(`Marked ${readResult.updated_count} messages as read`);
                
                if (readResult.updated_count > 0) {
                  // Messages marked as read - unread count will be reset by master component
                }
              } else {
                console.error('Error marking messages as read:', readResponse.statusText);
              }
            } catch (error) {
              console.error('Error marking messages as read:', error);
            }
          }
        } else {
          console.error('Error loading messages:', response.statusText);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [token, conversationId, initializeMessages, user?.id/*, updateUnreadCount*/]);

  const handleMessageSend = async () => {
    if (!message.trim() && !selectedFile) return;
    
    if (!remoteUser?.public_key) {
      console.error('Remote user public key not available');
      return;
    }

    setIsSending(true);

    try {
      let messageToSend = message.trim();

      if (selectedFile) {
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

        const fileUrl = `https://next-messenger.s3.ap-southeast-1.amazonaws.com/${key}`;
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
          conversation_id: conversationId,
          content: encryptedMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Message sent successfully:', data);
        setMessage('');
        setSelectedFile(null);
        
        const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
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
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      console.log('File selected:', file);
    }
  };

  const handleSendFileClick = () => {
    const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
    fileInput?.click();
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!remoteUser?.public_key || !token) {
      console.error('Remote user public key or token not available');
      return;
    }

    try {
      const encryptedMessage = await encryptMessage(newContent, remoteUser.public_key);
      const response = await fetch(`/api/msgs/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: encryptedMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Message edited successfully:', data);
      } else {
        console.error('Error editing message:', response.statusText);
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  if (!remoteUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full flex-1">
      <div className="border-b p-4">
        <h2 className="text-xl font-bold">Chat with {remoteUser.name}</h2>
        <div className="text-sm text-gray-500 flex gap-4">
          <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
          <span>Conversation ID: {conversationId}</span>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 p-4 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id}>
            <DecryptedMessage
              message={msg}
              encryptionKey={encryptionKey}
              isReceived={msg.sender_id !== user?.id}
              onEdit={handleEditMessage}
            />
          </div>
        ))}
        
        {messages.length === 0 && (
          <p className="text-gray-500 text-center">No messages yet...</p>
        )}
      </div>

      <div className="border-t p-4">
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
          id={`file-input-${conversationId}`}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile && (
          <div className="text-sm text-gray-600 mt-2">
            Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </div>
        )}
      </div>
    </div>
  );
}