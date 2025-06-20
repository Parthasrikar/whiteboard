/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// hooks/useVoiceChat.js - Fixed version with better connection handling
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

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  };

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
        existingConnection.close();
      }

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

      // Handle connection state changes
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
            break;

          case "connecting":
            console.log(`🔄 Connecting to ${userId}...`);
            // Set a timeout for connection attempts
            const newTimeoutId = setTimeout(() => {
              console.log(`⏰ Connection timeout for ${userId}`);
              closePeerConnection(userId);
            }, 30000); // 30 second timeout
            connectionTimeoutsRef.current.set(userId, newTimeoutId);
            break;

          case "disconnected":
            console.log(`⚠️ Voice connection disconnected with ${userId}`);
            updatePeerStatus(userId, { connected: false });
            // Try to reconnect after a short delay
            setTimeout(() => {
              if (isVoiceChatActive && peerConnectionsRef.current.has(userId)) {
                console.log(`🔄 Attempting to reconnect to ${userId}`);
                // You might want to implement reconnection logic here
              }
            }, 2000);
            break;

          case "failed":
            console.log(`❌ Voice connection failed with ${userId}`);
            closePeerConnection(userId);
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

        if (iceState === "failed" || iceState === "closed") {
          updatePeerStatus(userId, { connected: false });
        }
      };

      // Handle data channel events (optional, for future use)
      peerConnection.ondatachannel = (event) => {
        console.log(
          `📡 Data channel received from ${userId}:`,
          event.channel.label
        );
      };

      peerConnectionsRef.current.set(userId, peerConnection);
      return peerConnection;
    },
    [socket, isVoiceChatActive, updatePeerStatus]
  );

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
        audioElement.playsInline = true; // Important for mobile devices
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

  // Close peer connection with cleanup
  const closePeerConnection = useCallback(
    (userId) => {
      console.log(`🔒 Closing peer connection for user: ${userId}`);

      // Clear connection timeout
      const timeoutId = connectionTimeoutsRef.current.get(userId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        connectionTimeoutsRef.current.delete(userId);
      }

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

      isInitiatingRef.current = true;
      console.log("🚀 Initiating voice chat with users:", userIds);

      try {
        for (const userId of userIds) {
          if (userId === socket?.id) {
            console.log("⏭️ Skipping self:", userId);
            continue;
          }

          console.log(`📞 Creating offer for user: ${userId}`);
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

          // Set initial peer status
          updatePeerStatus(userId, { connected: false, initiating: true });
        }
      } catch (error) {
        console.error("❌ Error initiating voice chat:", error);
        setVoiceError("Failed to initiate voice chat: " + error.message);
      } finally {
        isInitiatingRef.current = false;
      }
    },
    [socket, createPeerConnection, updatePeerStatus]
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

      // Request to start voice chat with room and get user list
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

  // Toggle mute with better feedback
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

    const peerConnection = createPeerConnection(fromUserId);

    // 💥 Fix: Only set remote offer if state is stable (no local offer pending)
    if (peerConnection.signalingState !== "stable") {
      console.warn(
        `⚠️ Cannot handle offer, signaling state is '${peerConnection.signalingState}'`
      );
      return;
    }

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

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

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          console.log(`✅ Set remote description for: ${fromUserId}`);
          updatePeerStatus(fromUserId, { answering: false });
        } catch (error) {
          console.error("❌ Error handling voice answer:", error);
          setVoiceError("Failed to handle voice answer: " + error.message);
        }
      } else {
        console.warn(
          `⚠️ No peer connection found for answer from: ${fromUserId}`
        );
      }
    };

    const handleVoiceIceCandidate = async (data) => {
      const { fromUserId, candidate } = data;
      console.log(`📥 Received ICE candidate from: ${fromUserId}`);

      const peerConnection = peerConnectionsRef.current.get(fromUserId);

      if (peerConnection && peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`✅ Added ICE candidate from: ${fromUserId}`);
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      } else {
        console.warn(
          `⚠️ Cannot add ICE candidate from ${fromUserId} - no peer connection or remote description`
        );
      }
    };

    const handleVoiceChatRequested = async (data) => {
      const { fromUserId } = data;
      console.log(`📞 Voice chat requested from: ${fromUserId}`);

      // Auto-accept voice chat requests
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
        // The response handling is now done in handleVoiceChatStarted
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

      // Clear any existing error
      setVoiceError(null);

      // Initiate connections with all users
      if (userIds && userIds.length > 0) {
        setTimeout(() => {
          initiateVoiceChatWithUsers(userIds);
        }, 100); // Small delay to ensure all users are ready
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
