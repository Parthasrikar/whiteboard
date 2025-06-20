/* eslint-disable no-undef */
// components/VoiceChat.jsx - Fixed version
import React from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Users } from 'lucide-react';

const VoiceChat = ({ 
  isVoiceChatActive, 
  isMuted, 
  connectedPeers, 
  audioPermission, 
  voiceError,
  startVoiceChat, 
  stopVoiceChat, 
  toggleMute,
  connectedUsers = []
}) => {
  const handleStartVoiceChat = async () => {
    const success = await startVoiceChat();
    if (!success) {
      console.error('Failed to start voice chat');
    }
  };

  const getVoiceStatus = (userId) => {
    const peer = connectedPeers.get(userId);
    return peer || { connected: false, muted: true };
  };

  // Normalize users to ensure consistent data structure
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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 m-2 shadow-lg">
      <div className="flex flex-col space-y-4">
        {/* Voice Chat Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 rounded-full">
              <Users size={18} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Voice Chat</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            {isVoiceChatActive ? (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-full transition-colors ${
                    isMuted 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  onClick={stopVoiceChat}
                  className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                  title="End Voice Chat"
                >
                  <PhoneOff size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={handleStartVoiceChat}
                className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Start Voice Chat"
                disabled={audioPermission === 'denied'}
              >
                <Phone size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {voiceError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
            <strong>Error:</strong> {voiceError}
          </div>
        )}

        {audioPermission === 'denied' && (
          <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 p-3 rounded-lg">
            <strong>Microphone Blocked:</strong> Please enable microphone permissions in your browser settings to use voice chat.
          </div>
        )}

        {audioPermission === null && (
          <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <strong>Permission Needed:</strong> Click the phone icon to request microphone access.
          </div>
        )}

        {/* Voice Chat Active Status */}
        {isVoiceChatActive && (
          <div className="text-xs text-green-600 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <strong>Voice chat is active</strong>
            {isMuted && <span className="ml-2 text-red-600">(You are muted)</span>}
          </div>
        )}

        {/* Connected Users Voice Status */}
        {normalizedUsers.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-gray-600 font-semibold border-b border-gray-200 pb-1">
              Participants ({normalizedUsers.length}):
            </div>
            <div className="space-y-2">
              {normalizedUsers.map((user, index) => {
                // Check if this is the current user
                const isCurrentUser = user.name === 'You' || index === 0;
                
                if (isCurrentUser) {
                  return (
                    <div key={user.id || 'current-user'} className="flex items-center justify-between text-xs bg-blue-50 p-2 rounded">
                      <span className="font-medium text-blue-700">{user.name}</span>
                      <div className="flex items-center space-x-1">
                        {isVoiceChatActive ? (
                          <>
                            {isMuted ? (
                              <MicOff size={12} className="text-red-500" />
                            ) : (
                              <Mic size={12} className="text-green-500" />
                            )}
                            <span className="text-green-600 text-xs">Connected</span>
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">Not in voice chat</span>
                        )}
                      </div>
                    </div>
                  );
                }
                
                const voiceStatus = getVoiceStatus(user.id);
                
                return (
                  <div key={user.id || `user-${index}`} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                    <span className="text-gray-700">{user.name}</span>
                    <div className="flex items-center space-x-1">
                      {isVoiceChatActive && voiceStatus.connected ? (
                        <>
                          {voiceStatus.muted ? (
                            <MicOff size={12} className="text-red-500" />
                          ) : (
                            <Mic size={12} className="text-green-500" />
                          )}
                          <Volume2 size={12} className="text-blue-500" />
                          <span className="text-green-600 text-xs">Connected</span>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">Not connected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isVoiceChatActive && !voiceError && audioPermission !== 'denied' && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <strong>Get Started:</strong> Click the <Phone size={12} className="inline mx-1" /> icon to start voice chat with room participants.
          </div>
        )}

        {/* Connection Info */}
        <div className="text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-200">
          <span>Room: {normalizedUsers.length} user{normalizedUsers.length !== 1 ? 's' : ''}</span>
          {isVoiceChatActive && (
            <span className="text-green-600">● Live</span>
          )}
        </div>

        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-100 rounded">
            <div>Users: {JSON.stringify(normalizedUsers.map(u => ({ id: u.id, name: u.name })))}</div>
            <div>Connected Peers: {connectedPeers.size}</div>
            <div>Audio Permission: {audioPermission}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceChat;