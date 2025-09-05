import { useEffect, useState, useCallback } from 'react';
import { getPusherClient } from '../lib/pusher';
import { useAuth } from '@/contexts/AuthContext';

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

export const useConversations = (userId?: string, token?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const {user} = useAuth();

  const fetchConversations = useCallback(async () => {
    if (!token || !user) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/users?public_key_id=' + (user?.public_key as any).id, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
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
  }, [token, user]);

  const updateConversationWithMessage = useCallback((conversationId: string, message: Msg, unreadCount?: number) => {
    console.log('Updating conversation:', conversationId, 'with message:', message, 'unread_count:', unreadCount);
    
    setConversations(prev => {
      const conversationExists = prev.find(c => c.conversation_id === conversationId);
      
      if (!conversationExists) {
        console.log('Conversation ID not found, triggering refresh for new conversation:', conversationId);
        // Trigger refresh for new conversations
        setTimeout(() => {
          fetchConversations();
        }, 100);
        return prev;
      }

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
  }, [fetchConversations]);

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
      /* {
            "id": "1795",
            "batch_id": 1,
            "created_at": null,
            "updated_at": null,
            "conversation_id": "146",
            "sender_id": "105",
            "content": "dDLjDG7xoqTaVgqpcKjwseJ7BzDSiT+xfRrDyjBrBSP8o7lsKS+JP/0TIE/69eafCIzGAt968b2twNHpb5PU2wlcQBhNq8Uerldvk5xI26UDSaZpbMLXAoA1aaH8JwRFgXa9d8T6Ijj/IB1mrxmtzzF1ngNACOawt33Wr9txmuFSa0fLkQ+G8TYbh8jALAShmQDnNp7Ez2T6tZJ3GetyuraDXcy/UDCenDw6NzT9rBC6zufzUpZaa3negtJf/uZyz0dKtQSj+CZqA0JctmLVIHsE35bUw7VhuYT602ULApCkg4ph3q+jEf32cL0qGqMlItFnl2NMsUgrZFM6MSm26A==",
            "type": "text",
            "status": "sent",
            "public_key_id": "107",
            "latestMessage": {
                "id": "1795",
                "content": "dDLjDG7xoqTaVgqpcKjwseJ7BzDSiT+xfRrDyjBrBSP8o7lsKS+JP/0TIE/69eafCIzGAt968b2twNHpb5PU2wlcQBhNq8Uerldvk5xI26UDSaZpbMLXAoA1aaH8JwRFgXa9d8T6Ijj/IB1mrxmtzzF1ngNACOawt33Wr9txmuFSa0fLkQ+G8TYbh8jALAShmQDnNp7Ez2T6tZJ3GetyuraDXcy/UDCenDw6NzT9rBC6zufzUpZaa3negtJf/uZyz0dKtQSj+CZqA0JctmLVIHsE35bUw7VhuYT602ULApCkg4ph3q+jEf32cL0qGqMlItFnl2NMsUgrZFM6MSm26A==",
                "created_at": null,
                "sender_id": "105",
                "public_key_id": "107",
                "batch_id": 1
            },
            "unread_count": 1
        } */
      console.log('self is ', (user?.public_key as any).id)
      // Only process messages that match the user's public_key_id
      if (!(user?.public_key as any) || data.latestMessage.public_key_id === (user?.public_key as any).id) {
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