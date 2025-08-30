'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';

export default function MessengerMaster() {
  const { user, isAuthenticated, loading, logout, token } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const { messages, isConnected } = useMessages('chat');

  const handleMessageSend = async () => {
    if (!message.trim()) return;
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          username: user?.name,
        }),
      });

      if (response.ok) {
        console.log('Message sent successfully');
        setMessage('');
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

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
              <div key={index} className="mb-2">
                <span className="font-bold">{msg.username}:</span> {msg.message}
              </div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Send
          </button>
        </div>

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