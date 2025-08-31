import { useEffect, useState, useCallback } from 'react';
import { getPusherClient } from '../lib/pusher';

interface Msg {
  id: string;
  created_at: any;
  updated_at: any;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  status: string;
}

/**
 * The channel-id should be the user-id
 */
export const useMessages = (channel: string = 'chat') => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addOrUpdateMessage = (newMessage: Msg) => {
    setMessages((prevMessages) => {
      const existingIndex = prevMessages.findIndex(msg => msg.id === newMessage.id);
      
      if (existingIndex >= 0) {
        // Update existing message
        const updatedMessages = [...prevMessages];
        updatedMessages[existingIndex] = newMessage;
        return updatedMessages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      } else {
        // Add new message and sort
        return [...prevMessages, newMessage].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    });
  };

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

    // Listen to both message-sent and message-updated events
    channelInstance.bind('message-sent', (data: Msg) => {
      addOrUpdateMessage(data);
    });

    channelInstance.bind('message-updated', (data: Msg) => {
      addOrUpdateMessage(data);
    });

    return () => {
        channelInstance.unbind('message-sent');
        channelInstance.unbind('message-updated');
        pusher.unsubscribe(channel);
    }
  }, [channel]);

  const initializeMessages = useCallback((initialMessages: Msg[]) => {
    setMessages(initialMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ));
  }, []);

  return { messages, isConnected, addOrUpdateMessage, initializeMessages };
};
