"use client"

import Counter from "./components/counter";
import ClientForm from "./components/client-form";

export default function Home() {

  /*useEffect(() => {
    const pusher = getPusherClient();

    pusher.connection.bind('connected', () => {
      setConnectionState('Connected');
      console.log('Pusher connected');
    });

    pusher.connection.bind('disconnected', () => {
      setConnectionState('Disconnected');
      console.log('Pusher disconnected');
    });

    pusher.connection.bind('error', (err: any) => {
      setConnectionState('Error');
      console.log('Pusher error', err);
    })
    console.log(pusher);
  }, []);*/
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      Hello world <br/>
      <Counter />
      <ClientForm />
    </div>
  );
}
