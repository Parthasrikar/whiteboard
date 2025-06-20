/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// hooks/useVoiceChat.js
import { useState, useEffect, useRef, useCallback } from 'react';

export const useVoiceChat = (socket, roomCode, userName) => {
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [connectedPeers, setConnectedPeers] = useState(new Map());
  const [audioPermission, setAudioPermission] = useState(null);
  const [voiceError, setVoiceError] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const audioElementsRef = useRef(new Map());

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Initialize local audio stream
  const initializeAudioStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;
      setAudioPermission('granted');
      
      // Mute by default
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setAudioPermission('denied');
      setVoiceError('Microphone access denied');
      return null;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((userId) => {
    const peerConnection = new RTCPeerConnection(iceServers);
    
    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      playRemoteAudio(userId, remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice-ice-candidate', {
          targetUserId: userId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer connection state with ${userId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        setConnectedPeers(prev => new Map(prev.set(userId, { connected: true, muted: false })));
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        closePeerConnection(userId);
      }
    };

    peerConnectionsRef.current.set(userId, peerConnection);
    return peerConnection;
  }, [socket]);

  // Play remote audio
  const playRemoteAudio = useCallback((userId, stream) => {
    let audioElement = audioElementsRef.current.get(userId);
    
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.autoplay = true;
      audioElement.controls = false;
      audioElementsRef.current.set(userId, audioElement);
    }

    audioElement.srcObject = stream;
    audioElement.play().catch(error => {
      console.error('Error playing remote audio:', error);
    });
  }, []);

  // Close peer connection
  const closePeerConnection = useCallback((userId) => {
    const peerConnection = peerConnectionsRef.current.get(userId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(userId);
    }

    const audioElement = audioElementsRef.current.get(userId);
    if (audioElement) {
      audioElement.srcObject = null;
      audioElementsRef.current.delete(userId);
    }

    setConnectedPeers(prev => {
      const newPeers = new Map(prev);
      newPeers.delete(userId);
      return newPeers;
    });
  }, []);

  // Start voice chat
  const startVoiceChat = useCallback(async () => {
    try {
      setVoiceError(null);
      
      const stream = await initializeAudioStream();
      if (!stream) return false;

      setIsVoiceChatActive(true);
      
      // Request to start voice chat with room
      if (socket) {
        socket.emit('request-voice-chat', { roomCode });
      }
      
      return true;
    } catch (error) {
      console.error('Error starting voice chat:', error);
      setVoiceError('Failed to start voice chat');
      return false;
    }
  }, [initializeAudioStream, socket, roomCode]);

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    // Close all peer connections
    peerConnectionsRef.current.forEach((_, userId) => {
      closePeerConnection(userId);
    });

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    setIsVoiceChatActive(false);
    setIsMuted(true);
    setConnectedPeers(new Map());
    setAudioPermission(null);
  }, [closePeerConnection]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      
      // Notify other users about mute status
      if (socket) {
        socket.emit('voice-toggle', { isMuted: newMutedState });
      }
    }
  }, [isMuted, socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleVoiceOffer = async (data) => {
      const { fromUserId, offer } = data;
      
      if (!localStreamRef.current) {
        await initializeAudioStream();
      }
      
      const peerConnection = createPeerConnection(fromUserId);
      
      try {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('voice-answer', {
          targetUserId: fromUserId,
          answer
        });
      } catch (error) {
        console.error('Error handling voice offer:', error);
      }
    };

    const handleVoiceAnswer = async (data) => {
      const { fromUserId, answer } = data;
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(answer);
        } catch (error) {
          console.error('Error handling voice answer:', error);
        }
      }
    };

    const handleVoiceIceCandidate = async (data) => {
      const { fromUserId, candidate } = data;
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    const handleVoiceChatRequested = async (data) => {
      const { fromUserId } = data;
      
      // Auto-accept voice chat requests (you can add user confirmation here)
      const accepted = true;
      
      socket.emit('voice-chat-response', {
        targetUserId: fromUserId,
        accepted
      });
      
      if (accepted && !localStreamRef.current) {
        await initializeAudioStream();
      }
    };

    const handleVoiceChatResponse = async (data) => {
      const { fromUserId, accepted } = data;
      
      if (accepted) {
        // Create offer for the user who accepted
        const peerConnection = createPeerConnection(fromUserId);
        
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          
          socket.emit('voice-offer', {
            targetUserId: fromUserId,
            offer
          });
        } catch (error) {
          console.error('Error creating voice offer:', error);
        }
      }
    };

    const handleUserVoiceStatus = (data) => {
      const { userId, isMuted } = data;
      setConnectedPeers(prev => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(userId) || {};
        newPeers.set(userId, { ...peer, muted: isMuted });
        return newPeers;
      });
    };

    // Register event listeners
    socket.on('voice-offer', handleVoiceOffer);
    socket.on('voice-answer', handleVoiceAnswer);
    socket.on('voice-ice-candidate', handleVoiceIceCandidate);
    socket.on('voice-chat-requested', handleVoiceChatRequested);
    socket.on('voice-chat-response', handleVoiceChatResponse);
    socket.on('user-voice-status', handleUserVoiceStatus);

    return () => {
      socket.off('voice-offer', handleVoiceOffer);
      socket.off('voice-answer', handleVoiceAnswer);
      socket.off('voice-ice-candidate', handleVoiceIceCandidate);
      socket.off('voice-chat-requested', handleVoiceChatRequested);
      socket.off('voice-chat-response', handleVoiceChatResponse);
      socket.off('user-voice-status', handleUserVoiceStatus);
    };
  }, [socket, createPeerConnection, initializeAudioStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceChat();
    };
  }, [stopVoiceChat]);

  return {
    isVoiceChatActive,
    isMuted,
    connectedPeers,
    audioPermission,
    voiceError,
    startVoiceChat,
    stopVoiceChat,
    toggleMute
  };
};