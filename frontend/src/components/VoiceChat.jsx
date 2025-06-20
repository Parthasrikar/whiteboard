/* eslint-disable no-undef */
// components/VoiceChat.jsx - Complete Enhanced Version with better state management
import React, { useEffect, useCallback, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX, 
  Users, 
  Loader, 
  AlertCircle, 
  CheckCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  Signal
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
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(new Map());

  const handleStartVoiceChat = async () => {
    setIsStarting(true);
    try {
      const success = await startVoiceChat();
      if (!success) {
        console.error('Failed to start voice chat');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopVoiceChat = useCallback(() => {
    stopVoiceChat();
    setConnectionRetries(new Map());
  }, [stopVoiceChat]);

  // Add keyboard shortcut for mute toggle
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Space bar to toggle mute when voice chat is active
      if (event.code === 'Space' && isVoiceChatActive && !event.target.matches('input, textarea, button')) {
        event.preventDefault();
        toggleMute();
      }
      // ESC to stop voice chat
      if (event.code === 'Escape' && isVoiceChatActive) {
        event.preventDefault();
        handleStopVoiceChat();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isVoiceChatActive, toggleMute, handleStopVoiceChat]);

  const getVoiceStatus = useCallback((userId) => {
    const peer = connectedPeers.get(userId);
    if (!peer) return { connected: false, muted: true, status: 'disconnected' };
    
    let status = 'disconnected';
    if (peer.initiating || peer.answering) {
      status = 'connecting';
    } else if (peer.waiting) {
      status = 'waiting';
    } else if (peer.connected) {
      status = 'connected';
    }
    
    return { 
      connected: peer.connected || false, 
      muted: peer.muted !== undefined ? peer.muted : true,
      status,
      audioPlaying: peer.audioPlaying || false,
      retryCount: connectionRetries.get(userId) || 0
    };
  }, [connectedPeers, connectionRetries]);

  // Normalize users to ensure consistent data structure
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

  // Get connection statistics
  const connectionStats = {
    total: normalizedUsers.length,
    connected: Array.from(connectedPeers.values()).filter(peer => peer.connected).length,
    connecting: Array.from(connectedPeers.values()).filter(peer => peer.initiating || peer.answering).length,
    waiting: Array.from(connectedPeers.values()).filter(peer => peer.waiting).length,
    failed: Array.from(connectedPeers.values()).filter(peer => peer.status === 'failed').length
  };

  const getConnectionQuality = () => {
    if (!isVoiceChatActive || connectionStats.total <= 1) return null;
    
    const connectedRatio = connectionStats.connected / (connectionStats.total - 1);
    
    if (connectedRatio >= 0.8) return { level: 'excellent', color: 'green' };
    if (connectedRatio >= 0.5) return { level: 'good', color: 'yellow' };
    if (connectedRatio > 0) return { level: 'poor', color: 'orange' };
    return { level: 'failed', color: 'red' };
  };

  const connectionQuality = getConnectionQuality();

  const renderConnectionStatus = (status, isCurrentUser = false) => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center space-x-1 text-green-600">
            <CheckCircle size={12} />
            <span className="text-xs">Connected</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center space-x-1 text-blue-600">
            <Loader size={12} className="animate-spin" />
            <span className="text-xs">Connecting...</span>
          </div>
        );
      case 'waiting':
        return (
          <div className="flex items-center space-x-1 text-yellow-600">
            <Loader size={12} className="animate-pulse" />
            <span className="text-xs">Waiting...</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-1 text-red-600">
            <AlertCircle size={12} />
            <span className="text-xs">Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-1 text-gray-400">
            <AlertCircle size={12} />
            <span className="text-xs">
              {isCurrentUser ? (isVoiceChatActive ? 'Ready' : 'Not in voice chat') : 'Not connected'}
            </span>
          </div>
        );
    }
  };

  const renderVoiceIndicator = (voiceStatus, isCurrentUser = false) => {
    if (isCurrentUser) {
      if (!isVoiceChatActive) return <WifiOff size={12} className="text-gray-400" />;
      return isMuted ? <MicOff size={12} className="text-red-500" /> : <Mic size={12} className="text-green-500 animate-pulse" />;
    }

    if (!voiceStatus.connected) return <WifiOff size={12} className="text-gray-400" />;
    
    return (
      <div className="flex items-center space-x-1">
        {voiceStatus.muted ? (
          <MicOff size={12} className="text-red-500" />
        ) : (
          <Mic size={12} className="text-green-500 animate-pulse" />
        )}
        {voiceStatus.audioPlaying && <Volume2 size={12} className="text-blue-500 animate-bounce" />}
      </div>
    );
  };

  const getStatusMessage = () => {
    if (voiceError) return { type: 'error', message: voiceError };
    if (audioPermission === 'denied') return { 
      type: 'warning', 
      message: 'Microphone access denied. Please enable microphone permissions in your browser settings.' 
    };
    if (isStarting) return { type: 'info', message: 'Starting voice chat...' };
    if (!isVoiceChatActive && audioPermission === null) return { 
      type: 'info', 
      message: 'Click the phone icon to request microphone access and start voice chat.' 
    };
    if (isVoiceChatActive && isMuted) return { 
      type: 'warning', 
      message: 'You are currently muted. Click the microphone icon or press Space to unmute.' 
    };
    if (isVoiceChatActive) return { 
      type: 'success', 
      message: 'Voice chat is active and ready.' 
    };
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 m-2 shadow-lg">
      <div className="flex flex-col space-y-4">
        {/* Voice Chat Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-full transition-colors ${
              isVoiceChatActive ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              <Users size={18} className={isVoiceChatActive ? 'text-green-600' : 'text-blue-600'} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                <span>Voice Chat</span>
                {isVoiceChatActive && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </h3>
              {isVoiceChatActive && connectionStats.total > 1 && (
                <div className="text-xs text-gray-600">
                  {connectionStats.connected}/{connectionStats.total - 1} connected
                  {connectionStats.connecting > 0 && `, ${connectionStats.connecting} connecting`}
                  {connectionStats.waiting > 0 && `, ${connectionStats.waiting} waiting`}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Settings/Debug Toggle */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
                title="Toggle Debug Info"
              >
                <Settings size={14} />
              </button>
            )}
            
            {isVoiceChatActive ? (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    isMuted 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200 shadow-lg' 
                      : 'bg-green-100 text-green-600 hover:bg-green-200 shadow-lg'
                  }`}
                  title={`${isMuted ? 'Unmute' : 'Mute'} (Space)`}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  onClick={handleStopVoiceChat}
                  className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-200 shadow-lg"
                  title="End Voice Chat (Esc)"
                >
                  <PhoneOff size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={handleStartVoiceChat}
                className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Start Voice Chat"
                disabled={audioPermission === 'denied' || isStarting}
              >
                {isStarting ? <Loader size={16} className="animate-spin" /> : <Phone size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div className={`text-xs p-3 rounded-lg flex items-start space-x-2 ${
            statusMessage.type === 'error' ? 'text-red-600 bg-red-50 border border-red-200' :
            statusMessage.type === 'warning' ? 'text-orange-600 bg-orange-50 border border-orange-200' :
            statusMessage.type === 'success' ? 'text-green-600 bg-green-50 border border-green-200' :
            'text-blue-600 bg-blue-50 border border-blue-200'
          }`}>
            {statusMessage.type === 'error' && <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />}
            {statusMessage.type === 'warning' && <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />}
            {statusMessage.type === 'success' && <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />}
            {statusMessage.type === 'info' && <Loader size={14} className="mt-0.5 flex-shrink-0 animate-spin" />}
            <div>{statusMessage.message}</div>
          </div>
        )}

        {/* Connection Quality Indicator */}
        {connectionQuality && (
          <div className={`flex items-center justify-between text-xs p-2 rounded border ${
            connectionQuality.color === 'green' ? 'bg-green-50 border-green-200' :
            connectionQuality.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
            connectionQuality.color === 'orange' ? 'bg-orange-50 border-orange-200' :
            'bg-red-50 border-red-200'
          }`}>
            <span className="text-gray-600">Connection Quality:</span>
            <div className="flex items-center space-x-1">
              <Signal size={12} className={`text-${connectionQuality.color}-500`} />
              <span className={`text-${connectionQuality.color}-600 capitalize font-medium`}>
                {connectionQuality.level}
              </span>
              <span className={`text-${connectionQuality.color}-500`}>
                ({connectionStats.connected}/{connectionStats.total - 1})
              </span>
            </div>
          </div>
        )}

        {/* Connected Users Voice Status */}
        {normalizedUsers.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-gray-600 font-semibold border-b border-gray-200 pb-1 flex items-center justify-between">
              <span>Participants ({normalizedUsers.length}):</span>
              {isVoiceChatActive && (
                <div className="flex items-center space-x-1 text-green-600">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live</span>
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {normalizedUsers.map((user, index) => {
                // Check if this is the current user
                const isCurrentUser = user.name === 'You' || index === 0;
                
                if (isCurrentUser) {
                  return (
                    <div key={user.id || 'current-user'} className="flex items-center justify-between text-xs bg-blue-50 p-2 rounded border border-blue-200">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-blue-700">{user.name} (You)</span>
                        {renderVoiceIndicator(null, true)}
                      </div>
                      {renderConnectionStatus('connected', true)}
                    </div>
                  );
                }
                
                const voiceStatus = getVoiceStatus(user.id);
                
                return (
                  <div key={user.id || `user-${index}`} className={`flex items-center justify-between text-xs p-2 rounded border transition-colors ${
                    voiceStatus.connected ? 'bg-green-50 border-green-200' : 
                    voiceStatus.status === 'connecting' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-700">{user.name}</span>
                      {renderVoiceIndicator(voiceStatus)}
                      {voiceStatus.retryCount > 0 && (
                        <span className="text-xs text-orange-500">
                          (retry {voiceStatus.retryCount})
                        </span>
                      )}
                    </div>
                    {renderConnectionStatus(voiceStatus.status)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isVoiceChatActive && !voiceError && audioPermission !== 'denied' && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <div className="font-semibold mb-1">Quick Start:</div>
            <ul className="space-y-1">
              <li>• Click <Phone size={12} className="inline mx-1" /> to start voice chat</li>
              <li>• Press <kbd className="px-1 py-0.5 bg-white rounded text-xs">Space</kbd> to toggle mute</li>
              <li>• Press <kbd className="px-1 py-0.5 bg-white rounded text-xs">Esc</kbd> to end voice chat</li>
            </ul>
          </div>
        )}

        {/* Room Info Footer */}
        <div className="text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-200">
          <span>Room: {normalizedUsers.length} participant{normalizedUsers.length !== 1 ? 's' : ''}</span>
          {isVoiceChatActive && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Wifi size={10} className="text-green-500" />
                <span className="text-green-600">Active</span>
              </div>
              <div className="text-gray-400">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>

        {/* Debug Info - Development Only */}
        {showDebugInfo && process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 p-2 bg-gray-100 rounded border-t border-gray-300">
            <div className="font-semibold mb-1">Debug Information:</div>
            <div className="space-y-1 font-mono">
              <div>Users: {JSON.stringify(normalizedUsers.map(u => ({ id: u.id, name: u.name })))}</div>
              <div>Connected Peers: {connectedPeers.size}</div>
              <div>Audio Permission: {audioPermission}</div>
              <div>Is Muted: {isMuted.toString()}</div>
              <div>Voice Chat Active: {isVoiceChatActive.toString()}</div>
              <div>Connection Stats: {JSON.stringify(connectionStats)}</div>
              <div>Peer Details: {JSON.stringify(Array.from(connectedPeers.entries()))}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceChat;