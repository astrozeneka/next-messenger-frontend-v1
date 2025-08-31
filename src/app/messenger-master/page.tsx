'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useConversations } from '../../hooks/useConversations';
import { getPrivateKey, decryptMessage } from '../../lib/crypto';
import { Msg } from '../messenger-detail/[id]/page';
import ConversationDetail from '../../components/ConversationDetail';


interface DecryptedLatestMessageProps {
  message: Msg | null;
  encryptionKey: string | null;
}

function DecryptedLatestMessage({ message, encryptionKey }: DecryptedLatestMessageProps) {
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(true);

  useEffect(() => {
    const decrypt = async () => {
      if (!message) {
        setDecryptedContent('No messages yet');
        setIsDecrypting(false);
        return;
      }

      if (!encryptionKey) {
        setDecryptedContent('[Unable to decrypt]');
        setIsDecrypting(false);
        return;
      }

      try {
        const decrypted = await decryptMessage(message.content, encryptionKey);
        setDecryptedContent(decrypted.length > 30 ? decrypted.substring(0, 30) + '...' : decrypted);
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
    return <span className="text-sm text-gray-400 italic">Decrypting...</span>;
  }

  return <span className="text-sm text-gray-500">{decryptedContent}</span>;
}

function ConversationPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50">
      <div className="text-center text-gray-500 max-w-md px-6">
        <div className="text-8xl mb-6 opacity-50">💬</div>
        <h2 className="text-3xl font-semibold mb-4 text-gray-700">Welcome to Messenger</h2>
        <p className="text-lg mb-2">Select a conversation from the list to start messaging</p>
        <p className="text-sm text-gray-400">Your conversations will appear here with end-to-end encryption</p>
      </div>
    </div>
  );
}

export default function MessengerMaster() {
  const { user, isAuthenticated, loading, logout, token } = useAuth();
  const router = useRouter();
  const { isConnected } = useMessages('chat');
  const { conversations, isLoading } = useConversations(user?.id, token || undefined);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/messenger-login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

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

  // Mark all messages from remote users as delivered when user enters messenger-master
  useEffect(() => {
    if (!token || !conversations || conversations.length === 0) return;

    const markAllMessagesAsDelivered = async () => {
      try {
        // Mark messages as delivered for each conversation
        for (const conversation of conversations) {
          const response = await fetch('/api/msgs/delivered', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              conversation_id: conversation.conversation_id
              // No message_ids provided, so it will mark all messages from remote users
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`Marked ${result.updated_count} messages as delivered for conversation ${conversation.conversation_id}`);
          } else {
            console.error(`Error marking messages as delivered for conversation ${conversation.conversation_id}:`, response.statusText);
          }
        }
      } catch (error) {
        console.error('Error marking messages as delivered:', error);
      }
    };

    markAllMessagesAsDelivered();
  }, [token, conversations]);


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

  const handleConversationClick = (conversationId: string) => {
    if (isMobile) {
      router.push(`/messenger-detail/${conversationId}`);
    } else {
      setSelectedConversationId(conversationId);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Conversations List - Left Column */}
      <div className="w-full md:w-80 flex flex-col bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold">Hello {user.name}</h1>
          <div className="text-sm text-gray-500 flex gap-4">
            <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
            {isLoading && <span className="text-gray-400">Loading...</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex flex-col p-4 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100 ${
                    selectedConversationId === conversation.conversation_id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => handleConversationClick(conversation.conversation_id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{conversation.name}</span>
                      {conversation.unread_count > 0 && (
                        <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center font-bold">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{conversation.email}</div>
                  <div className="mt-1">
                    <DecryptedLatestMessage 
                      message={conversation.latest_message} 
                      encryptionKey={encryptionKey} 
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <div className="text-4xl mb-2">💬</div>
              <p>No conversations yet</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Conversation Detail - Right Column */}
      {!isMobile && (
        selectedConversationId ? (
          <div className="flex flex-1">
            <ConversationDetail conversationId={selectedConversationId} />
          </div>
        ) : (
          <ConversationPlaceholder />
        )
      )}
    </div>
  );
}