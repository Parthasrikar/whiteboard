// VoiceChatDebug.jsx - Debug component to diagnose voice chat issues
import React, { useState } from 'react';
import { RefreshCw, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const VoiceChatDebug = ({ 
  connectedPeers, 
  isVoiceChatActive, 
  isMuted,
  connectedUsers,
  socket 
}) => {
  const [debugInfo, setDebugInfo] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);

  const checkPeerConnections = () => {
    const info = {};
    
    connectedPeers.forEach((peer, userId) => {
      info[userId] = {
        peer: peer,
        hasConnection: !!peer,
        connected: peer?.connected || false,
        status: peer?.status || 'unknown',
        muted: peer?.muted,
        audioPlaying: peer?.audioPlaying,
        initiating: peer?.initiating,
        answering: peer?.answering
      };
    });
    
    setDebugInfo(info);
  };
  // Add to your useVoiceChat hook
useEffect(() => {
  if (!socket) return;
  
  socket.on('voice-offer', (data) => {
    console.log('🟢 RECEIVED voice-offer:', data);
  });
  
  socket.on('voice-answer', (data) => {
    console.log('🟢 RECEIVED voice-answer:', data);
  });
  
  socket.on('voice-chat-started', (data) => {
    console.log('🟢 RECEIVED voice-chat-started:', data);
  });
  
  return () => {
    socket.off('voice-offer');
    socket.off('voice-answer'); 
    socket.off('voice-chat-started');
  };
}, [socket]);

  const testAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      
      console.log('🎤 Audio Input Devices:', audioInputs);
      console.log('🔊 Audio Output Devices:', audioOutputs);
      
      // Test microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone test successful:', stream.getAudioTracks());
      
      // Stop test stream
      stream.getTracks().forEach(track => track.stop());
      
      return { audioInputs, audioOutputs, micTest: true };
    } catch (error) {
      console.error('❌ Audio device test failed:', error);
      return { error: error.message };
    }
  };

  const diagnoseConnection = () => {
    console.log('🔍 VOICE CHAT DIAGNOSIS');
    console.log('======================');
    console.log('Active:', isVoiceChatActive);
    console.log('Muted:', isMuted);
    console.log('Socket connected:', socket?.connected);
    console.log('Connected Users:', connectedUsers);
    console.log('Connected Peers Map:', Object.fromEntries(connectedPeers));
    
    // Check each peer connection in detail
    connectedPeers.forEach((peer, userId) => {
      console.log(`\n👤 User ${userId}:`);
      console.log('  - Peer object:', peer);
      console.log('  - Connected:', peer?.connected);
      console.log('  - Muted:', peer?.muted);
      console.log('  - Audio Playing:', peer?.audioPlaying);
      console.log('  - Initiating:', peer?.initiating);
      console.log('  - Answering:', peer?.answering);
    });
    
    // Test audio devices
    testAudioDevices().then(result => {
      console.log('🎵 Audio Device Test:', result);
    });
    
    checkPeerConnections();
  };

  const troubleshootSteps = [
    {
      title: "Check WebRTC Connection State",
      description: "The peer connection exists but shows connected:0, indicating WebRTC handshake issues",
      status: connectedPeers.size > 0 && Array.from(connectedPeers.values()).some(p => p.connected) ? 'success' : 'warning'
    },
    {
      title: "Verify Audio Permissions",
      description: "Audio permission is granted, which is good",
      status: 'success'
    },
    {
      title: "Check ICE Connection",
      description: "ICE candidates might not be exchanging properly",
      status: 'warning'
    },
    {
      title: "Verify Offer/Answer Exchange",
      description: "SDP offer/answer handshake might be incomplete",
      status: 'warning'
    }
  ];

  const fixingSuggestions = [
    "Check browser console for WebRTC errors",
    "Verify STUN servers are accessible",
    "Ensure both users are in the same room",
    "Try refreshing both browser windows",
    "Check if firewall is blocking WebRTC",
    "Test on different network/browser"
  ];

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 m-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <AlertTriangle size={18} className="text-yellow-600" />
          <h3 className="text-sm font-semibold text-yellow-800">Voice Chat Debug</h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={diagnoseConnection}
            className="p-1 bg-yellow-100 hover:bg-yellow-200 rounded"
            title="Run Diagnosis"
          >
            <RefreshCw size={14} className="text-yellow-600" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 bg-yellow-100 hover:bg-yellow-200 rounded"
          >
            <Info size={14} className="text-yellow-600" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Quick Status */}
        <div className="bg-white p-3 rounded border">
          <div className="text-sm font-medium mb-2">Quick Status:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Voice Active: {isVoiceChatActive ? '✅' : '❌'}</div>
            <div>Peers: {connectedPeers.size}</div>
            <div>Actually Connected: {Array.from(connectedPeers.values()).filter(p => p.connected).length}</div>
            <div>Socket: {socket?.connected ? '✅' : '❌'}</div>
          </div>
        </div>

        {/* Issue Detected */}
        <div className="bg-red-50 border border-red-200 p-3 rounded">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle size={14} className="text-red-500" />
            <span className="text-sm font-medium text-red-700">Issue Detected</span>
          </div>
          <div className="text-xs text-red-600">
            You have {connectedPeers.size} peer(s) but {Array.from(connectedPeers.values()).filter(p => p.connected).length} actually connected. 
            This means WebRTC connection is not established properly.
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Troubleshooting Steps */}
            <div className="bg-white p-3 rounded border">
              <div className="text-sm font-medium mb-2">Diagnosis:</div>
              <div className="space-y-2">
                {troubleshootSteps.map((step, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    {step.status === 'success' ? (
                      <CheckCircle size={12} className="text-green-500 mt-0.5" />
                    ) : (
                      <AlertTriangle size={12} className="text-yellow-500 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-medium">{step.title}</div>
                      <div className="text-xs text-gray-600">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fixing Suggestions */}
            <div className="bg-blue-50 border border-blue-200 p-3 rounded">
              <div className="text-sm font-medium mb-2 text-blue-700">Try These Fixes:</div>
              <ol className="text-xs text-blue-600 space-y-1">
                {fixingSuggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span className="font-mono text-blue-500">{index + 1}.</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Peer Details */}
            {Object.keys(debugInfo).length > 0 && (
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-sm font-medium mb-2">Peer Connection Details:</div>
                <div className="space-y-2">
                  {Object.entries(debugInfo).map(([userId, info]) => (
                    <div key={userId} className="bg-white p-2 rounded border text-xs">
                      <div className="font-medium">User: {userId}</div>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div>Connected: {info.connected ? '✅' : '❌'}</div>
                        <div>Muted: {info.muted ? '🔇' : '🔊'}</div>
                        <div>Audio: {info.audioPlaying ? '🎵' : '🔕'}</div>
                      </div>
                      {(info.initiating || info.answering) && (
                        <div className="text-blue-600 mt-1">
                          Status: {info.initiating ? 'Initiating...' : 'Answering...'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Console Instructions */}
        <div className="bg-gray-100 p-3 rounded text-xs">
          <strong>Check Browser Console:</strong> Press F12 → Console tab to see detailed WebRTC logs and errors.
          Look for messages starting with 🔗, 📥, 📤, ❌, or ✅.
        </div>
      </div>
    </div>
  );
};

export default VoiceChatDebug;