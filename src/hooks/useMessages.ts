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
}

/**
 * The channel-id should be the user-id
 */
export const useMessages = (channel: string = 'chat', currentUserId?: string, token?: string, conversationId?: string) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Function to mark messages as delivered
  const markMessagesAsDelivered = useCallback(async (messagesToMark: Msg[]) => {
    if (!currentUserId || !token || !conversationId || messagesToMark.length === 0) return;

    const messageIds = messagesToMark.map(msg => msg.id);
    
    try {
      const response = await fetch('/api/msgs/delivered', {
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
        console.error('Failed to mark messages as delivered:', response.statusText);
      } else {
        const result = await response.json();
        console.log(`Successfully marked ${result.updated_count} messages as delivered`);
      }
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  }, [currentUserId, token, conversationId]);

  const addOrUpdateMessage = useCallback((newMessage: Msg, shouldCheckDelivery = false) => {
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

      // If this is a new message from someone else and it's marked as 'sent', mark it as delivered
      if (shouldCheckDelivery && currentUserId && newMessage.sender_id !== currentUserId && newMessage.status === 'sent') {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          markMessagesAsDelivered([newMessage]);
        }, 0);
      }

      return sortedMessages;
    });
  }, [currentUserId, markMessagesAsDelivered]);

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
      // For real-time messages, check if delivery acknowledgment is needed
      addOrUpdateMessage(data, true);
    });

    channelInstance.bind('message-updated', (data: Msg) => {
      console.log("Message update ===>", data);
      // For updated messages, check if delivery acknowledgment is needed
      addOrUpdateMessage(data, true);
    });

    // Listen to message status updates (from delivery acknowledgments)
    channelInstance.bind('message-status-updated', (data: Msg) => {
      console.log("Message status update ===>", data);
      // For status updates, don't trigger delivery acknowledgment to avoid loops
      addOrUpdateMessage(data, false);
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

    // Mark messages as delivered if they are from other users and still in 'sent' status
    if (currentUserId) {
      const messagesToMarkDelivered = sortedMessages.filter(
        msg => msg.sender_id !== currentUserId && msg.status === 'sent'
      );
      
      if (messagesToMarkDelivered.length > 0) {
        // Use setTimeout to avoid calling async function during state initialization
        setTimeout(() => {
          markMessagesAsDelivered(messagesToMarkDelivered);
        }, 0);
      }
    }
  }, [currentUserId, markMessagesAsDelivered]);

  return { messages, isConnected, addOrUpdateMessage, initializeMessages };
};
