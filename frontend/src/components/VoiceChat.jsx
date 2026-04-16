/* eslint-disable no-undef */
// components/VoiceChat.jsx - Minimal Voice Chat UI (Consistent with Chat Panel Design)
import React, { useEffect, useCallback, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  AlertCircle,
} from 'lucide-react';

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
  const [isStarting, setIsStarting] = useState(false);

  const handleStartVoiceChat = async () => {
    setIsStarting(true);
    try {
      await startVoiceChat();
    } finally {
      setIsStarting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === 'Space' && isVoiceChatActive && !event.target.matches('input, textarea, button')) {
        event.preventDefault();
        toggleMute();
      }
      if (event.code === 'Escape' && isVoiceChatActive) {
        event.preventDefault();
        stopVoiceChat();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isVoiceChatActive, toggleMute, stopVoiceChat]);

  const normalizeUsers = useCallback((users) => {
    if (!Array.isArray(users)) return [];
    
    return users.map((user, index) => {
      if (typeof user === 'string') {
        return { id: `user-${index}`, name: user };
      }
      if (user && typeof user === 'object' && user.id && user.name) {
        return user;
      }
      return { id: `user-${index}`, name: user?.name || user?.id || 'Unknown User' };
    }).filter(user => user.id && user.name);
  }, []);

  const normalizedUsers = normalizeUsers(connectedUsers);
  const connectedCount = Array.from(connectedPeers.values()).filter(p => p.connected).length;

  const getStatusMessage = () => {
    if (voiceError) return { type: 'error', message: voiceError };
    if (audioPermission === 'denied') return { 
      type: 'error', 
      message: 'Microphone access denied' 
    };
    if (isStarting) return { type: 'info', message: 'Starting voice chat...' };
    if (isVoiceChatActive) {
      if (isMuted) return { type: 'warning', message: 'Muted' };
      return { type: 'success', message: 'Active' };
    }
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Status Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isVoiceChatActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <span className="text-xs font-bold text-gray-700">
            {isVoiceChatActive ? 'Voice Active' : 'Voice Ready'}
          </span>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {isVoiceChatActive ? (
            <>
              <button
                onClick={toggleMute}
                className={`p-1.5 rounded-lg transition-all ${
                  isMuted 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
                title={`${isMuted ? 'Unmute' : 'Mute'} (Space)`}
              >
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button
                onClick={stopVoiceChat}
                className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                title="End Voice Call (Esc)"
              >
                <PhoneOff size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={handleStartVoiceChat}
              className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Start Voice Call"
              disabled={audioPermission === 'denied' || isStarting}
            >
              <Phone size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium ${
          statusMessage.type === 'error' ? 'text-red-700 bg-red-50' :
          statusMessage.type === 'warning' ? 'text-amber-700 bg-amber-50' :
          statusMessage.type === 'success' ? 'text-green-700 bg-green-50' :
          'text-blue-700 bg-blue-50'
        }`}>
          {statusMessage.type === 'error' && <AlertCircle size={12} className="flex-shrink-0" />}
          <span>{statusMessage.message}</span>
        </div>
      )}

      {/* Participants List */}
      {normalizedUsers.length > 0 && isVoiceChatActive && (
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
          <span className="text-[10px] font-bold text-gray-500 px-1 uppercase tracking-wide">
            Participants
          </span>
          <div className="space-y-1.5 px-1">
            {normalizedUsers.map((user, index) => {
              const isCurrentUser = index === 0;
              const peerStatus = connectedPeers.get(user.id);
              const isConnected = peerStatus?.connected;
              const isMutedRemote = peerStatus?.muted;

              return (
                <div 
                  key={user.id} 
                  className={`text-[11px] p-2 rounded-lg flex items-center justify-between font-medium transition-colors ${
                    isCurrentUser 
                      ? 'bg-indigo-50 border border-indigo-200'
                      : isConnected 
                      ? 'bg-green-50 border border-green-100'
                      : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700">
                      {user.name}{isCurrentUser ? ' (You)' : ''}
                    </span>
                    {isCurrentUser && (
                      <div className={`w-1.5 h-1.5 rounded-full ${isMuted ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                    )}
                  </div>
                  
                  {!isCurrentUser && (
                    <div className="flex items-center gap-1.5">
                      {isMutedRemote && <span className="text-red-600 text-[10px]">muted</span>}
                      <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Users Message */}
      {normalizedUsers.length <= 1 && (
        <div className="text-[11px] text-gray-400 text-center italic py-3">
          No other users to connect with
        </div>
      )}
    </div>
  );
};

export default VoiceChat;