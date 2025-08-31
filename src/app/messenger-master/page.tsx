'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useConversations } from '../../hooks/useConversations';
import { getPrivateKey, decryptMessage } from '../../lib/crypto';
import { Msg } from '../messenger-detail/[id]/page';


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

export default function MessengerMaster() {
  const { user, isAuthenticated, loading, logout, token } = useAuth();
  const router = useRouter();
  const { isConnected } = useMessages('chat');
  const { conversations, isLoading, refreshConversations } = useConversations(user?.id, token);



  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/messenger-login');
    }
  }, [isAuthenticated, loading, router]);

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

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Hello {user.name}</h1>
          <div className="text-sm text-gray-500">
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          {isLoading && <div className="text-sm text-gray-400">Loading conversations...</div>}
        </div>

        {conversations.length > 0 && (
          <div className="bg-gray-100 p-4 rounded-md">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <ul className="space-y-2">
              {conversations.map((conversation) => (
                <li 
                  key={conversation.id} 
                  className="flex flex-col p-3 rounded cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => router.push(`/messenger-detail/${conversation.conversation_id}`)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{conversation.name} (#C{conversation.conversation_id})</span>
                    <span className="text-xs text-gray-400">{conversation.email}</span>
                  </div>
                  <div className="mt-1">
                    <DecryptedLatestMessage 
                      message={conversation.latest_message} 
                      encryptionKey={encryptionKey} 
                    />
                  </div>
                </li>
              ))}
            </ul>
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