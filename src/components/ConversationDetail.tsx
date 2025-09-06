'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
// import { useConversations } from "@/hooks/useConversations";
import { encryptMessage, getPrivateKey, decryptMessage } from "@/lib/crypto";
import { formatMessageTime } from "@/lib/dateUtils";
import { useCallback, useEffect, useState } from "react";

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
  onEditClick?: (message: Msg, decryptedContent: string) => void;
}

function DecryptedMessage({ message, encryptionKey, isReceived, onEditClick }: DecryptedMessageProps) {
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
      <div className={`mt-2 flex ${isReceived ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-xs lg:max-w-md ${
          isReceived ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white' : 'bg-blue-500 text-white'
        } rounded-2xl px-4 py-2 shadow-sm`}>
          <p className="text-sm italic">Decrypting...</p>
        </div>
      </div>
    );
  }

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick(message, decryptedContent);
    }
  };

  return (
    <div className={`mt-2 flex ${isReceived ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-xs lg:max-w-md ${
        isReceived ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white' : 'bg-blue-500 text-white'
      } rounded-2xl px-4 py-2 shadow-sm`}>
        <p className="text-sm">{decryptedContent}</p>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-1">
            <p className={`text-xs ${isReceived ? 'text-gray-500 dark:text-gray-400' : 'text-blue-100'}`}>
              {formatMessageTime(message.created_at)}
            </p>
            {!isReceived && (
              <div className="flex items-center ml-1">
                {message.status === 'sent' && (
                  <svg className="w-3 h-3 text-blue-100" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {message.status === 'delivered' && (
                  <div className="flex">
                    <svg className="w-3 h-3 text-blue-100" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <svg className="w-3 h-3 text-blue-100 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {message.status === 'read' && (
                  <div className="flex">
                    <svg className="w-3 h-3 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <svg className="w-3 h-3 text-green-300 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
          {!isReceived && (
            <button 
              onClick={handleEditClick}
              className="text-xs text-blue-100 hover:text-white ml-2"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EncryptionNotice() {
  return (
    <div className="text-center mb-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        End-to-end encryption is enabled for this conversation. It is impossible to fetch previous messages.
      </p>
    </div>
  );
}

interface ConversationDetailProps {
  conversationId: string;
  onBack?: () => void;
}

export default function ConversationDetail({ conversationId, onBack }: ConversationDetailProps) {
  const { token, user } = useAuth();
  const { messages, isConnected, initializeMessages, prependMessages } = useMessages(
    `conversation.${conversationId}`,
    user?.id,
    token || undefined,
    conversationId,
    (user?.public_key as any)?.id
  );
  //const { updateUnreadCount } = useConversations(user?.id, token || undefined);

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remoteUser, setRemoteUser] = useState<{
    id: string;
    name: string;
    email: string;
    public_keys: Array<{
      id: string;
      public_key_value: string;
      created_at: string | null;
    }>;
  } | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Msg | null>(null);

  // Used for managing pagination
  let [furthestId, setFurthestId] = useState<number | null>(null);
  let [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  let [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true); // Assume more messages initially

  // Load more function
  const loadMore = useCallback(async () => {
    if (isLoadingMore) return; // Prevent multiple loads
    if (!token || !conversationId || !user?.id) return;
    
    setIsLoadingMore(true);
    const response = await fetch(`/api/msgs?conversation_id=${conversationId}&before_id=${furthestId}&limit=20&public_key_id=${(user?.public_key as any).id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      const responseData = await response.json();
      const olderMessages = responseData.messages || [];
      const paginationInfo = responseData.pagination || {};


      if (olderMessages.length == 0 || !paginationInfo.has_more) {
        setHasMoreMessages(false);
      } else {
        // Format messages
        const formattedMessages = olderMessages.map((msg: Msg) => ({
          ...msg,
          id: msg.id.toString(),
          conversation_id: msg.conversation_id.toString(),
          sender_id: msg.sender_id.toString()
        }));
        // Set the furtest Id
        setFurthestId(formattedMessages[0].id)
        // Update the message content
        prependMessages(formattedMessages);
        // Set has more messages
        setHasMoreMessages(paginationInfo.has_more || false)
      }
    }
    setIsLoadingMore(false);
  }, [token, conversationId, user?.id, isLoadingMore, hasMoreMessages, prependMessages])

  // Handle scrolling for seamless pagination
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const remainingPixels = e.currentTarget.scrollHeight - e.currentTarget.clientHeight + e.currentTarget.scrollTop;
    if (remainingPixels < 100){
      loadMore()
    }
  }

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
        console.log("Retrieve remote users", data);
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
        const response = await fetch(`/api/msgs?conversation_id=${conversationId}&public_key_id=${(user?.public_key as any).id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const responseData = await response.json();
          const fetchedMessages = responseData.messages || [];
          const paginationInfo = responseData.pagination || {};

          const formattedMessages = fetchedMessages.map((msg: Msg) => ({
            ...msg,
            id: msg.id.toString(),
            conversation_id: msg.conversation_id.toString(),
            sender_id: msg.sender_id.toString()
          }));
          
          initializeMessages(formattedMessages);
          setFurthestId(formattedMessages[0].id)
          
          // Update pagination state based on API response
          setHasMoreMessages(paginationInfo.has_more || false);

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
    
    if (!remoteUser?.public_keys || remoteUser.public_keys.length === 0) {
      console.error('Remote user public keys not available');
      return;
    }

    setIsSending(true);

    // If editing, handle edit instead of send
    if (editingMessage) {
      await handleEditMessage(editingMessage.id, message.trim());
      return;
    }

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

      console.log("Public key list", [...remoteUser.public_keys, user?.public_key!])
      
      // Encrypt message for each public key and prepare data for batch sending
      const encryptedMessages = [];
      for (const publicKey of [...remoteUser.public_keys, user?.public_key!]) {
        const encryptedMessage = await encryptMessage(messageToSend, (publicKey as any).public_key_value);
        encryptedMessages.push({
          public_key_id: (publicKey as any).id,
          content: encryptedMessage
        });
      }

      // Send all encrypted messages in one request
      const response = await fetch('/api/msgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: encryptedMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Message sent successfully:', data);
      } else {
        console.error('Error sending message:', response.statusText);
      }

      setMessage('');
      setSelectedFile(null);
      
      const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Error sending message -:', error);
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

  const handleStartEdit = (messageToEdit: Msg, decryptedContent: string) => {
    setEditingMessage(messageToEdit);
    setMessage(decryptedContent);
    // Clear any selected file when starting to edit
    setSelectedFile(null);
    const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!remoteUser?.public_keys || remoteUser.public_keys.length === 0 || !token) {
      console.error('Remote user public keys or token not available');
      return;
    }

    try {
      const encryptedMessage = await encryptMessage(newContent, remoteUser.public_keys[0].public_key_value);
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
        setEditingMessage(null);
        setMessage('');
      } else {
        console.error('Error editing message:', response.statusText);
      }
    } catch (error) {
      console.error('Error editing message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!remoteUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900" style={{height: '100vh'}}>
        <div className="flex flex-1 flex-col items-center space-y-4">
          <div className="flex flex-1 space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm">Loading conversation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full flex-1">
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Mobile back button - only show on mobile when onBack prop is provided */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full mr-2"
              aria-label="Go back"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {remoteUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">{remoteUser.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected ? 'Online' : 'Last seen recently'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/*<button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button> */}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900" style={{ display: 'flex', flexDirection: 'column-reverse' }} onScroll={handleScroll}>
        {messages.slice().reverse().map((msg) => (
          <DecryptedMessage
            key={msg.id}
            message={msg}
            encryptionKey={user?.private_key!}
            isReceived={msg.sender_id !== user?.id}
            onEditClick={handleStartEdit}
          />
        ))}
        
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center py-12">
            <div className="w-16 h-16 mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12l-4-4h3V6h2v4h3l-4 4z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">No messages yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center">Send a message to start the conversation</p>
          </div>
        )}

        {isLoadingMore && (
          <div className="text-center text-gray-500 dark:text-gray-400">
            <span>Loading more messages...</span>
          </div>
        )}

        {!hasMoreMessages && messages.length > 0 && (<EncryptionNotice />)}
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        {editingMessage && (
          <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded text-sm">
            <span className="font-medium text-gray-800 dark:text-gray-200">Editing message:</span> 
            <span className="text-gray-600 dark:text-gray-300"> Click "Update" to save changes or "Cancel" to stop editing.</span>
          </div>
        )}
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
              className={`flex-1 bg-transparent focus:outline-none text-gray-800 dark:text-white ${
                editingMessage ? 'placeholder-orange-400 dark:placeholder-orange-300' : 'placeholder-gray-500 dark:placeholder-gray-400'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleMessageSend();
                }
              }}
            />
            {!editingMessage && (
              <button
                onClick={handleSendFileClick}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full inline-block w-8 h-8"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleMessageSend}
            disabled={isSending || (!message.trim() && !selectedFile)}
            className={`p-2 rounded-full inline-block w-10 h-10 ${
              isSending || (!message.trim() && !selectedFile)
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : editingMessage
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
          {editingMessage && (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>

        <input
          id={`file-input-${conversationId}`}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </div>
        )}
      </div>
    </div>
  );
}