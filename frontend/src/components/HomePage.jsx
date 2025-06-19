import React from 'react';
import { Users, Pen } from 'lucide-react';

const HomePage = ({ 
  userName, 
  setUserName, 
  roomCode, 
  setRoomCode, 
  handleCreateRoom, 
  handleJoinRoom 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Pen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Whiteboard</h1>
          <p className="text-gray-600">Collaborative drawing made simple</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCreateRoom}
              className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
            >
              <Users className="w-5 h-5 mr-2" />
              Create Room
            </button>

            <div className="space-y-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Room Code"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-center uppercase"
                maxLength={6}
              />
              <button
                onClick={handleJoinRoom}
                className="w-full px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Create a room to start drawing or join an existing room with a code
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;