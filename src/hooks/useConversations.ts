import { useEffect, useState, useCallback } from 'react';
import { getPusherClient } from '../lib/pusher';

interface Msg {
  id: string;
  created_at: string | Date;
  updated_at: string | Date;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  status: string;
  public_key_id?: string;
}

interface Conversation {
  conversation_id: string;
  id: string;
  name: string;
  email: string;
  latest_message: Msg | null;
  unread_count: number;
}

interface ConversationUpdate {
  conversation_id: string;
  latestMessage: Msg;
  unread_count: number;
}

export const useConversations = (userId?: string, token?: string, publicKeyId?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const updateConversationWithMessage = useCallback((conversationId: string, message: Msg, unreadCount?: number) => {
    console.log('Updating conversation:', conversationId, 'with message:', message, 'unread_count:', unreadCount);
    
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.conversation_id === conversationId) {
          // Handle cases where created_at might be null/undefined
          const messageTime = message.created_at ? new Date(message.created_at).getTime() : Date.now();
          const currentTime = conv.latest_message?.created_at ? 
            new Date(conv.latest_message.created_at).getTime() : 0;
          
          const shouldUpdate = !conv.latest_message || messageTime > currentTime;
          
          if (shouldUpdate) {
            console.log('Updating conversation', conversationId, 'from:', conv.latest_message, 'to:', message);
            return {
              ...conv,
              latest_message: message,
              unread_count: unreadCount !== undefined ? unreadCount : conv.unread_count
            };
          }
        }
        return conv;
      });

      // Sort by latest message timestamp, handling null values
      return updated.sort((a, b) => {
        const aTime = a.latest_message?.created_at ? 
          new Date(a.latest_message.created_at).getTime() : 0;
        const bTime = b.latest_message?.created_at ? 
          new Date(b.latest_message.created_at).getTime() : 0;
        return bTime - aTime;
      });
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      
      const data = await response.json();
      const sortedConversations = data.sort((a: Conversation, b: Conversation) => {
        const aTime = a.latest_message ? new Date(a.latest_message.created_at).getTime() : 0;
        const bTime = b.latest_message ? new Date(b.latest_message.created_at).getTime() : 0;
        return bTime - aTime;
      });
      
      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!userId) return;

    const pusher = getPusherClient();
    const channelInstance = pusher.subscribe(`user.${userId}.conversations`);

    pusher.connection.bind('connected', () => {
      setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
    });

    pusher.connection.bind('error', () => {
      setIsConnected(false);
    });

    channelInstance.bind('conversation-updated', (data: ConversationUpdate) => {
      console.log('conversation-updated received', data);
      
      // Only process messages that match the user's public_key_id
      if (!publicKeyId || data.latestMessage.public_key_id === publicKeyId) {
        updateConversationWithMessage(data.conversation_id, data.latestMessage, data.unread_count);
      }
    });

    return () => {
      channelInstance.unbind('conversation-updated');
      pusher.unsubscribe(`user.${userId}.conversations`);
    };
  }, [userId, updateConversationWithMessage]);

  const refreshConversations = useCallback(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Function to update unread count for a specific conversation
  const updateUnreadCount = useCallback((conversationId: string, newUnreadCount: number) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.conversation_id === conversationId 
          ? { ...conv, unread_count: newUnreadCount }
          : conv
      )
    );
  }, []);

  return {
    conversations,
    isLoading,
    isConnected,
    refreshConversations,
    updateConversationWithMessage,
    updateUnreadCount
  };
};