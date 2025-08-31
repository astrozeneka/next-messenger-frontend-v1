'use client';

export default function MessengerDetail({ params }: { params: { id: string } }) {
  const userId = params.id;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-4">Chat with User {userId}</h1>
        <div className="bg-gray-100 p-4 rounded-md">
          <p>Chat interface for user ID: {userId}</p>
          <p>Discussion ID: TODO</p>
        </div>
      </div>
    </div>
  );
}