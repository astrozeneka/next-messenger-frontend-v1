'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

export default function MessengerDetail({ params }: { params: { id: string } }) {
  const conversation_id = params.id;

  const { token } = useAuth();

  // State variables
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  // Get the remote user list
  useEffect(()=>{
    if (!token) return;
    
    const fetchRemoteUsers = async () => {
      try {
        const response = await fetch(`/api/conversations/${conversation_id}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        if (data.length !== 1) {
          console.error('Unexpected number of remote users:', data);
          return;
        }
        setRemoteUser(data[0]);
      } catch (error) {
        console.error('Error fetching remote users:', error);
      }
    };

    fetchRemoteUsers();
  }, [token])

  const handleMessageSend = async () => {
    if (!message.trim() && !selectedFile) return;
    
    /*if (!remoteUser?.public_key) {
      console.error('Remote user public key not available');
      return;
    }*/

  }

  const handleSendFileClick = async () => {
    // TODO later
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-4">Chat with {remoteUser?.name}</h1>
        <div className="bg-gray-100 p-4 rounded-md">
          <p>Conversation ID: {conversation_id}</p>
        </div>
      </div>

      <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleMessageSend}
            disabled={isSending}
            className={`px-4 py-2 text-white rounded-md ${
              isSending 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
          <button
            onClick={handleSendFileClick}
            className={`px-4 py-2 text-white rounded-md ${
              selectedFile
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {selectedFile ? 'File Selected' : 'Send File'}
          </button>
        </div>
    </div>
  );
}