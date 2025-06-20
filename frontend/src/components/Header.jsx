// components/Header.jsx - Updated to handle user objects properly
import React from 'react';
import { Copy, LogOut, Users } from 'lucide-react';

const Header = ({ currentRoom, connectedUsers, copyRoomCode, handleLeaveRoom }) => {
  // Normalize users to handle both string and object formats
  const normalizedUsers = connectedUsers.map((user, index) => {
    if (typeof user === 'string') {
      return { id: `user-${index}`, name: user };
    }
    if (user && typeof user === 'object' && user.id && user.name) {
      return user;
    }
    return { id: `user-${index}`, name: user?.name || user?.id || 'Unknown User' };
  }).filter(user => user.id && user.name);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Room info */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Collaborative Whiteboard
          </h1>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Room:</span>
            <code className="bg-gray-100 px-2 py-1 rounded font-mono text-blue-600">
              {currentRoom}
            </code>
            <button
              onClick={copyRoomCode}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Copy room code"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* Right side - User info and controls */}
        <div className="flex items-center space-x-4">
          {/* Connected users */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users size={16} />
            <span>{normalizedUsers.length} connected</span>
            
            {/* User list dropdown/tooltip */}
            <div className="relative group">
              <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                <span className="text-xs">👥</span>
              </button>
              
              {/* Tooltip showing user names */}
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="text-xs font-semibold text-gray-700 mb-2">Connected Users:</div>
                <div className="space-y-1">
                  {normalizedUsers.map((user, index) => (
                    <div key={user.id || index} className="flex items-center space-x-2 text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className={index === 0 ? "font-medium text-blue-600" : "text-gray-600"}>
                        {user.name}
                        {index === 0 && " (You)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Leave room button */}
          <button
            onClick={handleLeaveRoom}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            <span>Leave Room</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;