import Pusher from 'pusher-js';

let pusher: Pusher;

export const getPusherClient = () => {
  if (!pusher) {
    pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      wsHost: process.env.NEXT_PUBLIC_PUSHER_HOST,
      wsPort: parseInt(process.env.NEXT_PUBLIC_PUSHER_PORT!),
      wssPort: parseInt(process.env.NEXT_PUBLIC_PUSHER_PORT!),
      forceTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
    });
  }
  return pusher;
};

export default getPusherClient;