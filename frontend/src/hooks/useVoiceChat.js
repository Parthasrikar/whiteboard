/* eslint-disable no-case-declarations */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// hooks/useVoiceChat.js - Improved version with better error handling and connection management
import { useState, useEffect, useRef, useCallback } from "react";

export const useVoiceChat = (socket, roomCode, userName) => {
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [connectedPeers, setConnectedPeers] = useState(new Map());
  const [audioPermission, setAudioPermission] = useState(null);
  const [voiceError, setVoiceError] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const audioElementsRef = useRef(new Map());
  const isInitiatingRef = useRef(false);
  const connectionTimeoutsRef = useRef(new Map());
  const myUserIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef(new Map()); // NEW: Store pending candidates
  const reconnectAttemptsRef = useRef(new Map()); // NEW: Track reconnection attempts

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    // NEW: Add ICE transport policy for better connection stability
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Set current user ID when socket connects
  useEffect(() => {
    if (socket?.id) {
      myUserIdRef.current = socket.id;
      console.log("🆔 Set current user ID:", socket.id);
    }
  }, [socket?.id]);

  // Deterministic role selection - prevents offer collisions
  const shouldInitiateOffer = useCallback((remoteUserId) => {
    const myId = myUserIdRef.current;
    if (!myId) return false;
    
    // Simple deterministic rule: user with "smaller" ID creates the offer
    const shouldOffer = myId < remoteUserId;
    console.log(`🎯 Role selection: ${myId} ${shouldOffer ? 'WILL' : 'WILL NOT'} create offer for ${remoteUserId}`);
    return shouldOffer;
  }, []);

  // NEW: Process pending ICE candidates
  const processPendingIceCandidates = useCallback(async (userId) => {
    const peerConnection = peerConnectionsRef.current.get(userId);
    const pendingCandidates = pendingIceCandidatesRef.current.get(userId) || [];
    
    if (peerConnection && peerConnection.remoteDescription && pendingCandidates.length > 0) {
      console.log(`🧊 Processing ${pendingCandidates.length} pending ICE candidates for ${userId}`);
      
      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`✅ Added pending ICE candidate for ${userId}`);
        } catch (error) {
          console.error(`❌ Failed to add pending ICE candidate for ${userId}:`, error);
        }
      }
      
      // Clear pending candidates
      pendingIceCandidatesRef.current.delete(userId);
    }
  }, []);

  // Initialize local audio stream
  const initializeAudioStream = useCallback(async () => {
    try {
      console.log("🎤 Requesting microphone access...");

      // Stop any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setAudioPermission("granted");
      setVoiceError(null);

      // Start muted by default
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        console.log(
          "🎵 Audio track initialized:",
          track.label,
          "enabled:",
          track.enabled
        );
      });

      return stream;
    } catch (error) {
      console.error("❌ Error accessing microphone:", error);
      setAudioPermission("denied");
      setVoiceError(`Microphone access denied: ${error.message}`);
      return null;
    }
  }, []);

  // Update peer connection status
  const updatePeerStatus = useCallback((userId, updates) => {
    setConnectedPeers((prev) => {
      const newPeers = new Map(prev);
      const currentStatus = newPeers.get(userId) || {
        connected: false,
        muted: true,
      };
      newPeers.set(userId, { ...currentStatus, ...updates });
      console.log(`👥 Updated peer ${userId} status:`, {
        ...currentStatus,
        ...updates,
      });
      return newPeers;
    });
  }, []);

  // Create peer connection with better error handling
  const createPeerConnection = useCallback(
    (userId) => {
      console.log(`🔗 Creating peer connection for user: ${userId}`);

      // Close existing connection if it exists
      const existingConnection = peerConnectionsRef.current.get(userId);
      if (existingConnection) {
        console.log(`🔄 Closing existing connection for ${userId}`);
        existingConnection.close();
      }

      // Clear any pending ICE candidates for this user
      pendingIceCandidatesRef.current.delete(userId);

      const peerConnection = new RTCPeerConnection(iceServers);

      // Add local stream to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(
            `➕ Adding track to peer connection for ${userId}:`,
            track.kind,
            track.enabled
          );
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log(
          `📥 Received remote track from ${userId}:`,
          event.track.kind
        );
        const [remoteStream] = event.streams;
        if (remoteStream) {
          playRemoteAudio(userId, remoteStream);
          updatePeerStatus(userId, { connected: true });
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log(`🧊 Sending ICE candidate to ${userId}`);
          socket.emit("voice-ice-candidate", {
            targetUserId: userId,
            candidate: event.candidate,
          });
        } else if (!event.candidate) {
          console.log(`🧊 ICE gathering complete for ${userId}`);
        }
      };

      // Handle connection state changes - IMPROVED
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔄 Peer connection state with ${userId}:`, state);

        // Clear any existing timeout
        const timeoutId = connectionTimeoutsRef.current.get(userId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          connectionTimeoutsRef.current.delete(userId);
        }

        switch (state) {
          case "connected":
            updatePeerStatus(userId, { connected: true });
            console.log(`✅ Voice connection established with ${userId}`);
            // Reset reconnection attempts on successful connection
            reconnectAttemptsRef.current.delete(userId);
            break;

          case "connecting":
            console.log(`🔄 Connecting to ${userId}...`);
            // IMPROVED: Shorter timeout for faster recovery
            const newTimeoutId = setTimeout(() => {
              console.log(`⏰ Connection timeout for ${userId}`);
              const attempts = reconnectAttemptsRef.current.get(userId) || 0;
              if (attempts < 3) {
                restartConnectionWithUser(userId);
              } else {
                console.log(`❌ Max reconnection attempts reached for ${userId}`);
                closePeerConnection(userId);
              }
            }, 15000); // Reduced from 30s to 15s
            connectionTimeoutsRef.current.set(userId, newTimeoutId);
            break;

          case "disconnected":
            console.log(`⚠️ Voice connection disconnected with ${userId}`);
            updatePeerStatus(userId, { connected: false });
            // IMPROVED: Smarter reconnection logic
            const attempts = reconnectAttemptsRef.current.get(userId) || 0;
            if (isVoiceChatActive && attempts < 3) {
              setTimeout(() => {
                if (isVoiceChatActive && peerConnectionsRef.current.has(userId)) {
                  console.log(`🔄 Attempting to reconnect to ${userId} (attempt ${attempts + 1})`);
                  restartConnectionWithUser(userId);
                }
              }, Math.min(2000 * Math.pow(2, attempts), 10000)); // Exponential backoff, max 10s
            }
            break;

          case "failed":
            console.log(`❌ Voice connection failed with ${userId}`);
            updatePeerStatus(userId, { connected: false });
            const failAttempts = reconnectAttemptsRef.current.get(userId) || 0;
            if (isVoiceChatActive && failAttempts < 3) {
              setTimeout(() => restartConnectionWithUser(userId), 1000);
            } else {
              closePeerConnection(userId);
            }
            break;

          case "closed":
            console.log(`🔒 Voice connection closed with ${userId}`);
            updatePeerStatus(userId, { connected: false });
            break;
        }
      };

      // Handle ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log(`🧊 ICE connection state with ${userId}:`, iceState);

        if (iceState === "failed") {
          console.log(`🧊 ICE connection failed with ${userId}, attempting restart`);
          updatePeerStatus(userId, { connected: false });
          // Try ICE restart
          peerConnection.restartIce();
        } else if (iceState === "disconnected") {
          updatePeerStatus(userId, { connected: false });
        } else if (iceState === "connected" || iceState === "completed") {
          updatePeerStatus(userId, { connected: true });
        }
      };

      peerConnectionsRef.current.set(userId, peerConnection);
      return peerConnection;
    },
    [socket, isVoiceChatActive, updatePeerStatus]
  );

  // Restart connection with a specific user - IMPROVED
  const restartConnectionWithUser = useCallback(async (userId) => {
    console.log(`🔄 Restarting connection with ${userId}`);
    
    // Track reconnection attempts
    const attempts = reconnectAttemptsRef.current.get(userId) || 0;
    reconnectAttemptsRef.current.set(userId, attempts + 1);
    
    // Close existing connection
    closePeerConnection(userId);
    
    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Only restart if we're still in voice chat
    if (isVoiceChatActive) {
      if (shouldInitiateOffer(userId)) {
        initiateConnectionWithUser(userId);
      } else {
        // Create peer connection and wait for offer
        createPeerConnection(userId);
        updatePeerStatus(userId, { connected: false, waiting: true });
      }
    }
  }, [isVoiceChatActive, shouldInitiateOffer]);

  // Initiate connection with a single user
  const initiateConnectionWithUser = useCallback(async (userId) => {
    if (!localStreamRef.current) {
      console.warn("⚠️ No local stream available for connection initiation");
      return;
    }

    try {
      console.log(`📞 Initiating connection with user: ${userId}`);
      const peerConnection = createPeerConnection(userId);

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await peerConnection.setLocalDescription(offer);

      console.log(`📤 Sending offer to ${userId}`);
      socket.emit("voice-offer", {
        targetUserId: userId,
        offer,
      });

      updatePeerStatus(userId, { connected: false, initiating: true });
    } catch (error) {
      console.error(`❌ Error initiating connection with ${userId}:`, error);
      setVoiceError(`Failed to connect to user: ${error.message}`);
    }
  }, [socket, createPeerConnection, updatePeerStatus]);

  // Play remote audio with better error handling
  const playRemoteAudio = useCallback(
    (userId, stream) => {
      console.log(`🔊 Setting up audio playback for user: ${userId}`);

      let audioElement = audioElementsRef.current.get(userId);

      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElement.controls = false;
        audioElement.volume = 1.0;
        audioElement.playsInline = true;
        audioElementsRef.current.set(userId, audioElement);
      }

      // Set the stream
      audioElement.srcObject = stream;

      // Handle audio events
      audioElement.onloadedmetadata = () => {
        console.log(`🎵 Audio metadata loaded for ${userId}`);
      };

      audioElement.oncanplay = () => {
        console.log(`🎵 Audio can play for ${userId}`);
      };

      audioElement.onerror = (error) => {
        console.error(`❌ Audio error for ${userId}:`, error);
      };

      // Try to play the audio
      const playPromise = audioElement.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`✅ Audio playback started for ${userId}`);
            updatePeerStatus(userId, { connected: true, audioPlaying: true });
          })
          .catch((error) => {
            console.error(
              `❌ Error playing remote audio for ${userId}:`,
              error
            );
            // Try to play again after user interaction
            document.addEventListener(
              "click",
              () => {
                audioElement.play().catch(console.error);
              },
              { once: true }
            );
          });
      }
    },
    [updatePeerStatus]
  );

  // Close peer connection with cleanup - IMPROVED
  const closePeerConnection = useCallback(
    (userId) => {
      console.log(`🔒 Closing peer connection for user: ${userId}`);

      // Clear connection timeout
      const timeoutId = connectionTimeoutsRef.current.get(userId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeoutsRef.current.delete(userId);
      }

      // Clear pending ICE candidates
      pendingIceCandidatesRef.current.delete(userId);

      // Close peer connection
      const peerConnection = peerConnectionsRef.current.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnectionsRef.current.delete(userId);
      }

      // Clean up audio element
      const audioElement = audioElementsRef.current.get(userId);
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.pause();
        audioElementsRef.current.delete(userId);
      }

      // Update peer status
      updatePeerStatus(userId, { connected: false, audioPlaying: false });
    },
    [updatePeerStatus]
  );

  // Initiate voice chat with all users in room
  const initiateVoiceChatWithUsers = useCallback(
    async (userIds) => {
      if (!localStreamRef.current || isInitiatingRef.current) {
        console.log(
          "⚠️ Cannot initiate voice chat - no local stream or already initiating"
        );
        return;
      }

      const myUserId = myUserIdRef.current;
      if (!myUserId) {
        console.error("❌ No user ID available");
        return;
      }

      isInitiatingRef.current = true;
      console.log("🚀 Initiating voice chat with users:", userIds);

      try {
        for (const userId of userIds) {
          if (userId === myUserId) {
            console.log("⏭️ Skipping self:", userId);
            continue;
          }

          // Reset reconnection attempts for new connections
          reconnectAttemptsRef.current.delete(userId);

          if (shouldInitiateOffer(userId)) {
            await initiateConnectionWithUser(userId);
          } else {
            console.log(`⏳ Waiting for offer from ${userId} (they will initiate)`);
            createPeerConnection(userId);
            updatePeerStatus(userId, { connected: false, waiting: true });
          }
        }
      } catch (error) {
        console.error("❌ Error initiating voice chat:", error);
        setVoiceError("Failed to initiate voice chat: " + error.message);
      } finally {
        isInitiatingRef.current = false;
      }
    },
    [shouldInitiateOffer, initiateConnectionWithUser, createPeerConnection, updatePeerStatus]
  );

  // Start voice chat
  const startVoiceChat = useCallback(async () => {
    try {
      console.log("🎤 Starting voice chat...");
      setVoiceError(null);

      const stream = await initializeAudioStream();
      if (!stream) {
        console.error("❌ Failed to get audio stream");
        return false;
      }

      setIsVoiceChatActive(true);

      if (socket) {
        console.log("📡 Requesting voice chat for room:", roomCode);
        socket.emit("request-voice-chat", { roomCode });
      }

      return true;
    } catch (error) {
      console.error("❌ Error starting voice chat:", error);
      setVoiceError("Failed to start voice chat: " + error.message);
      return false;
    }
  }, [initializeAudioStream, socket, roomCode]);

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    console.log("🛑 Stopping voice chat...");

    // Clear all timeouts
    connectionTimeoutsRef.current.forEach((timeoutId) =>
      clearTimeout(timeoutId)
    );
    connectionTimeoutsRef.current.clear();

    // Clear reconnection attempts
    reconnectAttemptsRef.current.clear();

    // Clear pending ICE candidates
    pendingIceCandidatesRef.current.clear();

    // Close all peer connections
    peerConnectionsRef.current.forEach((_, userId) => {
      closePeerConnection(userId);
    });

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("🛑 Stopped local audio track:", track.label);
      });
      localStreamRef.current = null;
    }

    // Reset states
    setIsVoiceChatActive(false);
    setIsMuted(true);
    setConnectedPeers(new Map());
    setAudioPermission(null);
    setVoiceError(null);
    isInitiatingRef.current = false;

    console.log("✅ Voice chat stopped successfully");
  }, [closePeerConnection]);

  // Toggle mute with debouncing to prevent rapid toggling
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) {
      console.warn("⚠️ No local stream to mute/unmute");
      return;
    }

    const audioTracks = localStreamRef.current.getAudioTracks();
    const newMutedState = !isMuted;

    audioTracks.forEach((track) => {
      track.enabled = !newMutedState;
      console.log(
        `🎵 Audio track ${newMutedState ? "muted" : "unmuted"}:`,
        track.label
      );
    });

    setIsMuted(newMutedState);

    // Notify other users about mute status
    if (socket) {
      socket.emit("voice-toggle", { isMuted: newMutedState });
      console.log(
        `📡 Sent mute status to server: ${newMutedState ? "muted" : "unmuted"}`
      );
    }
  }, [isMuted, socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleVoiceOffer = async (data) => {
      const { fromUserId, offer } = data;
      console.log(`📥 Received voice offer from: ${fromUserId}`);

      try {
        if (!localStreamRef.current) {
          console.log("🎤 No local stream, initializing...");
          const stream = await initializeAudioStream();
          if (!stream) {
            console.error("❌ Failed to initialize audio stream for offer");
            return;
          }
        }

        let peerConnection = peerConnectionsRef.current.get(fromUserId);
        
        if (!peerConnection || peerConnection.signalingState === "closed") {
          peerConnection = createPeerConnection(fromUserId);
        }

        // IMPROVED: Better handling of signaling state conflicts
        if (peerConnection.signalingState === "have-local-offer") {
          console.log(`🔄 Offer collision detected with ${fromUserId}, handling gracefully`);
          
          // Use the deterministic rule to decide who should back off
          if (shouldInitiateOffer(fromUserId)) {
            // We should be the offerer, ignore this offer and let our offer proceed
            console.log(`⏭️ Ignoring offer from ${fromUserId} - we are the designated offerer`);
            return;
          } else {
            // They should be the offerer, rollback and accept their offer
            console.log(`🔄 Rolling back our offer to accept offer from ${fromUserId}`);
            await peerConnection.setLocalDescription({type: "rollback"});
          }
        } else if (peerConnection.signalingState !== "stable") {
          console.warn(
            `⚠️ Peer connection not in stable state: '${peerConnection.signalingState}'. Recreating...`
          );
          peerConnection.close();
          peerConnection = createPeerConnection(fromUserId);
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process any pending ICE candidates now that we have remote description
        await processPendingIceCandidates(fromUserId);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit("voice-answer", {
          targetUserId: fromUserId,
          answer,
        });

        console.log(`📤 Sent voice answer to: ${fromUserId}`);
        updatePeerStatus(fromUserId, { connected: false, answering: true });
      } catch (error) {
        console.error("❌ Error handling voice offer:", error);
        setVoiceError("Failed to handle voice offer: " + error.message);
      }
    };

    const handleVoiceAnswer = async (data) => {
      const { fromUserId, answer } = data;
      console.log(`📥 Received voice answer from: ${fromUserId}`);

      const peerConnection = peerConnectionsRef.current.get(fromUserId);

      if (peerConnection) {
        try {
          if (peerConnection.signalingState !== "have-local-offer") {
            console.warn(
              `⚠️ Cannot apply answer: peerConnection with ${fromUserId} is in '${peerConnection.signalingState}' state`
            );
            return;
          }

          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log(`✅ Set remote description for: ${fromUserId}`);
          
          // Process any pending ICE candidates
          await processPendingIceCandidates(fromUserId);
          
          updatePeerStatus(fromUserId, { answering: false });
        } catch (error) {
          console.error("❌ Error handling voice answer:", error);
          setVoiceError("Failed to handle voice answer: " + error.message);
        }
      } else {
        console.warn(`⚠️ No peer connection found for answer from: ${fromUserId}`);
      }
    };

    // IMPROVED: Better ICE candidate handling
    const handleVoiceIceCandidate = async (data) => {
      const { fromUserId, candidate } = data;
      console.log(`📥 Received ICE candidate from: ${fromUserId}`);

      const peerConnection = peerConnectionsRef.current.get(fromUserId);

      if (peerConnection) {
        if (peerConnection.remoteDescription) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`✅ Added ICE candidate from: ${fromUserId}`);
          } catch (error) {
            console.error(`❌ Error adding ICE candidate from ${fromUserId}:`, error);
          }
        } else {
          // Store candidate for later processing
          console.log(`📦 Storing ICE candidate from ${fromUserId} for later processing`);
          const pending = pendingIceCandidatesRef.current.get(fromUserId) || [];
          pending.push(candidate);
          pendingIceCandidatesRef.current.set(fromUserId, pending);
        }
      } else {
        console.warn(`⚠️ No peer connection found for ICE candidate from: ${fromUserId}`);
      }
    };

    const handleVoiceChatRequested = async (data) => {
      const { fromUserId } = data;
      console.log(`📞 Voice chat requested from: ${fromUserId}`);

      const accepted = true;

      socket.emit("voice-chat-response", {
        targetUserId: fromUserId,
        accepted,
      });

      if (accepted && !localStreamRef.current) {
        await initializeAudioStream();
      }
    };

    const handleVoiceChatResponse = async (data) => {
      const { fromUserId, accepted } = data;
      console.log(
        `📞 Voice chat response from ${fromUserId}: ${
          accepted ? "accepted" : "rejected"
        }`
      );

      if (accepted) {
        console.log(`✅ User ${fromUserId} accepted voice chat`);
      } else {
        console.log(`❌ User ${fromUserId} rejected voice chat`);
        updatePeerStatus(fromUserId, { connected: false });
      }
    };

    const handleUserVoiceStatus = (data) => {
      const { userId, isMuted } = data;
      console.log(
        `🎵 User ${userId} voice status: ${isMuted ? "muted" : "unmuted"}`
      );

      updatePeerStatus(userId, { muted: isMuted });
    };

    const handleVoiceChatStarted = (data) => {
      const { userIds } = data;
      console.log("🚀 Voice chat started with users:", userIds);

      setVoiceError(null);

      if (userIds && userIds.length > 0) {
        setTimeout(() => {
          initiateVoiceChatWithUsers(userIds);
        }, 100);
      }
    };

    const handleVoiceError = (data) => {
      console.error("📞 Voice error:", data);
      setVoiceError(data.error || "Voice chat error occurred");
    };

    // Register event listeners
    socket.on("voice-offer", handleVoiceOffer);
    socket.on("voice-answer", handleVoiceAnswer);
    socket.on("voice-ice-candidate", handleVoiceIceCandidate);
    socket.on("voice-chat-requested", handleVoiceChatRequested);
    socket.on("voice-chat-response", handleVoiceChatResponse);
    socket.on("user-voice-status", handleUserVoiceStatus);
    socket.on("voice-chat-started", handleVoiceChatStarted);
    socket.on("voice-error", handleVoiceError);

    return () => {
      socket.off("voice-offer", handleVoiceOffer);
      socket.off("voice-answer", handleVoiceAnswer);
      socket.off("voice-ice-candidate", handleVoiceIceCandidate);
      socket.off("voice-chat-requested", handleVoiceChatRequested);
      socket.off("voice-chat-response", handleVoiceChatResponse);
      socket.off("user-voice-status", handleUserVoiceStatus);
      socket.off("voice-chat-started", handleVoiceChatStarted);
      socket.off("voice-error", handleVoiceError);
    };
  }, [
    socket,
    createPeerConnection,
    initializeAudioStream,
    initiateVoiceChatWithUsers,
    updatePeerStatus,
    shouldInitiateOffer,
    processPendingIceCandidates,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Cleaning up voice chat hook");
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
    toggleMute,
  };
};