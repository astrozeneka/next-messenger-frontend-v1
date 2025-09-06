'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useConversations } from '../../hooks/useConversations';
import { getPrivateKey, decryptMessage } from '../../lib/crypto';
import { formatMessageTime } from '../../lib/dateUtils';
import { Msg } from '../messenger-detail/[id]/page';
import ConversationDetail from '../../components/ConversationDetail';

function parseMessageWithAttachment(content: string): { text: string; hasAttachment: boolean } {
  const attachmentRegex = /\(([^)]+)\)\[([^\]]+)\]/;
  const match = content.match(attachmentRegex);
  
  if (match) {
    const text = content.replace(attachmentRegex, '').trim();
    return {
      text,
      hasAttachment: true
    };
  }
  
  return {
    text: content,
    hasAttachment: false
  };
}


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
        setDecryptedContent('No recent messages');
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
        
        // Handle deleted messages
        if (decrypted === '[deleted]') {
          setDecryptedContent('This message has been deleted');
          setIsDecrypting(false);
          return;
        }
        
        // Parse for attachments
        const { text, hasAttachment } = parseMessageWithAttachment(decrypted);
        
        if (hasAttachment) {
          // If there's text with the attachment, show the text
          if (text.trim()) {
            const displayText = text.length > 30 ? text.substring(0, 30) + '...' : text;
            setDecryptedContent(`📎 ${displayText}`);
          } else {
            // If it's only an attachment without text
            setDecryptedContent('An attachment file has been sent');
          }
        } else {
          // Regular text message
          setDecryptedContent(decrypted.length > 30 ? decrypted.substring(0, 30) + '...' : decrypted);
        }
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
    </>
  );
}

function ConversationPlaceholder() {
  return (
    <div className="hidden md:flex w-2/3 items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">No conversation selected</h3>
        <p className="text-gray-500 dark:text-gray-400">Choose a conversation to start messaging</p>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm">Loading conversations...</div>
        </div>
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
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Master View - Conversations List */}
      <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Next Messenger</h1>
          <div className="flex items-center space-x-3">
            {/*<button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>*/}
            <button 
              onClick={logout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              title="Log out"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {/* <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div> */}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            <div>
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 ${
                    selectedConversationId === conversation.conversation_id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => handleConversationClick(conversation.conversation_id)}
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {conversation.name.charAt(0).toUpperCase()}
                    </div>
                    {/*<div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white dark:border-gray-800 rounded-full"></div>*/}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800 dark:text-white truncate">{conversation.name}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {conversation.latest_message ? formatMessageTime(conversation.latest_message.created_at) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">No conversations yet</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Start a new conversation to begin messaging</p>
            </div>
          )}
        </div>

        {/* @copyright 2025 Next Messenger. All rights reserved. */}
        <div className="p-3 text-center border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">© 2025 Next Messenger</p>
        </div>
      </div>

      {/* Detail View - Chat Interface or Empty State */}
      {!isMobile && (
        selectedConversationId ? (
          <div className="hidden md:flex w-full md:w-2/3 flex-col bg-gray-50 dark:bg-gray-900">
            <ConversationDetail conversationId={selectedConversationId} />
          </div>
        ) : (
          <ConversationPlaceholder />
        )
      )}

      {/* Mobile Popup Overlay */}
      {isMobile && showMobilePopup && selectedConversationId && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
          <ConversationDetail 
            conversationId={selectedConversationId} 
            onBack={closeMobilePopup}
          />
        </div>
      )}
    </div>
  );
}