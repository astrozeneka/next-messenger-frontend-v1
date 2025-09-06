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
  encryptionKey: string | null | undefined;
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

  return (
    <>
      <span className="text-sm text-gray-500">{decryptedContent}</span>
      f<span>{JSON.stringify(message as any)}</span>
    </>
  );
}

function ConversationPlaceholder() {
  return (
    <div className="hidden md:flex w-2/3 items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No conversation selected</h3>
        <p className="text-gray-500">Choose a conversation to start messaging</p>
      </div>
    </div>
  );
}

export default function MessengerMaster() {
  const { user, isAuthenticated, loading, logout, token } = useAuth();
  const router = useRouter();
  const { isConnected } = useMessages('chat');
  const { conversations, isLoading, updateUnreadCount } = useConversations(user?.id, token || undefined);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobilePopup, setShowMobilePopup] = useState(false);

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
      console.warn('The error above is deprecated');
      // router.push('/login');
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
    // Reset unread count when conversation is clicked
    updateUnreadCount(conversationId, 0);
    
    if (isMobile) {
      setSelectedConversationId(conversationId);
      setShowMobilePopup(true);
    } else {
      setSelectedConversationId(conversationId);
    }
  };

  const closeMobilePopup = () => {
    setShowMobilePopup(false);
    setSelectedConversationId(null);
  };

  return (
    <div className="flex h-screen">
      {/* Master View - Conversations List */}
      <div className="w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Messages</h1>
          <div className="flex items-center space-x-3">
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-gray-50">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            <div>
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                    selectedConversationId === conversation.conversation_id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => handleConversationClick(conversation.conversation_id)}
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {conversation.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800 truncate">{conversation.name}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {conversation.latest_message ? 'Just now' : 'Yesterday'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 truncate">
                        <DecryptedLatestMessage 
                          message={conversation.latest_message} 
                          encryptionKey={user.private_key} 
                        />
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 ml-2">{conversation.unread_count}</span>
                      )}
                    </div>
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
      </div>

      {/* Detail View - Chat Interface or Empty State */}
      {!isMobile && (
        selectedConversationId ? (
          <div className="hidden md:flex w-full md:w-2/3 flex-col bg-gray-50">
            <ConversationDetail conversationId={selectedConversationId} />
          </div>
        ) : (
          <ConversationPlaceholder />
        )
      )}

      {/* Mobile Popup Overlay */}
      {isMobile && showMobilePopup && selectedConversationId && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <button
                onClick={closeMobilePopup}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="Close conversation"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1" />
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationDetail conversationId={selectedConversationId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}