import { useEffect, useState } from 'react';
import { getPusherClient } from '../lib/pusher';

interface Message {
  message: string;
  username: string;
  timestamp: string;
}

/**
 * The channel-id should be the user-id
 */
export const useMessages = (channel: string = 'chat') => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

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

    /*channelInstance.bind('new-message', (data: Message) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });*/

    channelInstance.bind('message-sent', (data: Message) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    return () => {
        //channelInstance.unbind('new-message');
        channelInstance.unbind('message-sent');
        pusher.unsubscribe(channel);
    }
  }, [channel]);

  return { messages, isConnected }
};
