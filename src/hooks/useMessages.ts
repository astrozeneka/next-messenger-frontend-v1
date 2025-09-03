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

/**
 * The channel-id should be the user-id
 */
export const useMessages = (channel: string = 'chat', currentUserId?: string, token?: string, conversationId?: string, publicKeyId?: string) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Function to mark messages as read
  const markMessagesAsRead = useCallback(async (messagesToMark: Msg[]) => {
    if (!currentUserId || !token || !conversationId || messagesToMark.length === 0) return;

    const messageIds = messagesToMark.map(msg => msg.id);
    
    try {
      const response = await fetch('/api/msgs/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message_ids: messageIds,
          conversation_id: conversationId
        })
      });

      if (!response.ok) {
        console.error('Failed to mark messages as read:', response.statusText);
      } else {
        const result = await response.json();
        console.log(`Successfully marked ${result.updated_count} messages as read`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUserId, token, conversationId]);

  const addOrUpdateMessage = useCallback((newMessage: Msg, shouldCheckRead = false) => {
    setMessages((prevMessages) => {
      const existingIndex = prevMessages.findIndex(msg => msg.id === newMessage.id);
      
      let updatedMessages;
      if (existingIndex >= 0) {
        // Update existing message
        updatedMessages = [...prevMessages];
        updatedMessages[existingIndex] = newMessage;
      } else {
        // Add new message
        updatedMessages = [...prevMessages, newMessage];
      }

      // Sort messages by creation time
      const sortedMessages = updatedMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // If this is a new message from someone else and it's marked as 'sent' or 'delivered', mark it as read
      if (shouldCheckRead && currentUserId && newMessage.sender_id !== currentUserId && (newMessage.status === 'sent' || newMessage.status === 'delivered')) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          markMessagesAsRead([newMessage]);
        }, 0);
      }

      return sortedMessages;
    });
  }, [currentUserId, markMessagesAsRead]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channelInstance = pusher.subscribe(channel);

    pusher.connection.bind('connected', () => {
        setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
    });

    pusher.connection.bind('error', () => {
      setIsConnected(false);
    });

    // Listen to message events
    channelInstance.bind('message-sent', (data: Msg) => {
      // Only process messages that match the user's public_key_id
      if (!publicKeyId || data.public_key_id === publicKeyId) {
        // For real-time messages, check if read acknowledgment is needed
        addOrUpdateMessage(data, true);
      }
    });

    channelInstance.bind('message-updated', (data: Msg) => {
      // Only process messages that match the user's public_key_id
      if (!publicKeyId || data.public_key_id === publicKeyId) {
        // For updated messages, check if read acknowledgment is needed
        addOrUpdateMessage(data, true);
      }
    });

    // Listen to message status updates (from read acknowledgments)
    channelInstance.bind('message-status-updated', (data: Msg) => {
      // Only process messages that match the user's public_key_id
      if (!publicKeyId || data.public_key_id === publicKeyId) {
        // For status updates, don't trigger read acknowledgment to avoid loops
        addOrUpdateMessage(data, false);
      }
    });

    return () => {
        channelInstance.unbind('message-sent');
        channelInstance.unbind('message-updated');
        channelInstance.unbind('message-status-updated');
        pusher.unsubscribe(channel);
    }
  }, [channel, addOrUpdateMessage]);

  const initializeMessages = useCallback((initialMessages: Msg[]) => {
    const sortedMessages = initialMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    setMessages(sortedMessages);

    // Mark messages as read if they are from other users and still in 'sent' or 'delivered' status
    if (currentUserId) {
      const messagesToMarkAsRead = sortedMessages.filter(
        msg => msg.sender_id !== currentUserId && (msg.status === 'sent' || msg.status === 'delivered')
      );
      
      if (messagesToMarkAsRead.length > 0) {
        // Use setTimeout to avoid calling async function during state initialization
        setTimeout(() => {
          markMessagesAsRead(messagesToMarkAsRead);
        }, 0);
      }
    }
  }, [currentUserId, markMessagesAsRead]);

  return { messages, isConnected, addOrUpdateMessage, initializeMessages };
};
