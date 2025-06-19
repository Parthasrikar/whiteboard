import React from 'react';
import { Users, Pen, Copy, LogOut } from 'lucide-react';

const Header = ({ 
  currentRoom, 
  connectedUsers, 
  copyRoomCode, 
  handleLeaveRoom 
}) => {
  return (
    <div className="bg-white shadow-sm border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Pen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Whiteboard</h1>
          </div>

          <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Room:</span>
            <span className="text-sm font-mono font-bold text-gray-900">
              {currentRoom}
            </span>
            <button
              onClick={copyRoomCode}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Copy room code"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">
              {connectedUsers.length} users
            </span>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;