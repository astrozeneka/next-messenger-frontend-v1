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
  batch_id?: number;
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
        // Handle null latest_message - put conversations without messages at the bottom
        if (!a.latest_message && !b.latest_message) return 0;
        if (!a.latest_message) return 1; // a goes to bottom
        if (!b.latest_message) return -1; // b goes to bottom
        
        const aBatchId = a.latest_message.batch_id || 0;
        const bBatchId = b.latest_message.batch_id || 0;
        return bBatchId - aBatchId; // Higher batch_id first
      });
      
      console.log("Sorted conversations:", sortedConversations);
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
          // Use batch_id for comparison since created_at can be null
          const messageBatchId = message.batch_id || 0;
          const currentBatchId = conv.latest_message?.batch_id || 0;
          
          const shouldUpdate = !conv.latest_message || messageBatchId > currentBatchId;
          
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
      const output = updated.sort((a, b) => {
        // Handle null latest_message - put conversations without messages at the bottom
        if (!a.latest_message && !b.latest_message) return 0;
        if (!a.latest_message) return 1; // a goes to bottom
        if (!b.latest_message) return -1; // b goes to bottom
        
        const aBatchId = a.latest_message.batch_id || 0;
        const bBatchId = b.latest_message.batch_id || 0;
        return bBatchId - aBatchId; // Higher batch_id first
      });
      return output;
    });
    console.log('Conversations after update:', conversations);
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