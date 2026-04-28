import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import RoomManager, { RoomElement } from './roomManager';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  transports: ['polling', 'websocket'],
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize room manager
const roomManager = new RoomManager();

// Extend Socket interface correctly without relying on @types/socket.io module declarations
interface AppSocket extends Socket {
  currentRoom?: string;
  userName?: string;
}

// Health check endpoint - enhanced with voice metrics
app.get('/health', (req: Request, res: Response) => {
  const stats = roomManager.getStats();
  const voiceStats = roomManager.getVoiceStats();
  
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    rooms: stats,
    voice: voiceStats
  });
});

// Socket.IO connection handling
io.on('connection', (baseSocket: Socket) => {
  const socket = baseSocket as AppSocket;
  console.log(`User connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', (data: { roomCode: string, userName: string }) => {
    try {
      const { roomCode, userName } = data;
      const userId = socket.id;

      // Leave any existing rooms
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      const result = roomManager.joinRoom(roomCode, userId, userName);
      
      if (!result.success) {
        socket.emit('room-error', { error: result.error });
        return;
      }

      // Join socket room
      socket.join(roomCode);
      socket.currentRoom = roomCode;
      socket.userName = userName;

      // Send room data to user
      const roomUsers = roomManager.getRoomUsers(roomCode);
      const roomElements = roomManager.getRoomElements(roomCode);

      socket.emit('room-joined', {
        roomCode,
        users: roomUsers,
        elements: roomElements,
        rejoined: result.rejoined || false
      });

      // Notify other users
      socket.to(roomCode).emit('user-joined', {
        user: { id: userId, name: userName },
        users: roomUsers
      });

      console.log(`User ${userName} (${userId}) joined room ${roomCode}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room-error', { error: 'Failed to join room' });
    }
  });

  // Create a room
  socket.on('create-room', (data: { roomCode: string, userName: string }) => {
    try {
      const { roomCode, userName } = data;
      const userId = socket.id;

      const result = roomManager.createRoom(roomCode, userId, userName);
      
      if (!result.success) {
        socket.emit('room-error', { error: result.error });
        return;
      }

      // Join socket room
      socket.join(roomCode);
      socket.currentRoom = roomCode;
      socket.userName = userName;

      // Send room data to creator
      const roomUsers = roomManager.getRoomUsers(roomCode);

      socket.emit('room-created', {
        roomCode,
        users: roomUsers,
        elements: []
      });

      console.log(`User ${userName} (${userId}) created room ${roomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('room-error', { error: 'Failed to create room' });
    }
  });

  // Leave room
  socket.on('leave-room', (data: { roomCode?: string }) => {
    try {
      const roomCode = data.roomCode;
      const userId = socket.id;

      if (socket.currentRoom) {
        const result = roomManager.leaveRoom(socket.currentRoom, userId);
        
        if (result.success) {
          // Notify other users
          if (!result.roomDeleted) {
            const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
            socket.to(socket.currentRoom).emit('user-left', {
              userId,
              users: roomUsers
            });
          }

          // Leave socket room
          socket.leave(socket.currentRoom);
          
          console.log(`User ${userId} left room ${roomCode || socket.currentRoom}`);
          socket.currentRoom = undefined;
          socket.userName = undefined;

          socket.emit('room-left');
        }
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Drawing events
  socket.on('draw-start', (data: any) => {
    if (!socket.currentRoom) return;
    
    socket.to(socket.currentRoom).emit('draw-start', {
      ...data,
      userId: socket.id,
      userName: socket.userName
    });
  });

  socket.on('draw', (data: any) => {
    if (!socket.currentRoom) return;
    
    socket.to(socket.currentRoom).emit('draw', {
      ...data,
      userId: socket.id,
      userName: socket.userName
    });
  });

  socket.on('cursor-move', (data: any) => {
    if (!socket.currentRoom) return;
    
    socket.to(socket.currentRoom).emit('cursor-move', {
      ...data,
      userId: socket.id,
      userName: socket.userName
    });
  });

  socket.on('send-message', (data: { text: string }) => {
    if (!socket.currentRoom) return;
    
    const messagePayload = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text: data.text,
      userId: socket.id,
      userName: socket.userName,
      timestamp: Date.now()
    };
    
    socket.to(socket.currentRoom).emit('receive-message', messagePayload);
    socket.emit('receive-message', messagePayload);
  });

  socket.on('draw-end', (data: { element: RoomElement }) => {
    if (!socket.currentRoom) return;

    const { element } = data;
    
    // Add element to room
    const success = roomManager.addElement(socket.currentRoom, element);
    
    if (success) {
      // Broadcast to all users in room including sender
      io.to(socket.currentRoom).emit('element-added', {
        element,
        userId: socket.id,
        userName: socket.userName
      });
    }
  });

  // Clear canvas
  socket.on('clear-canvas', () => {
    if (!socket.currentRoom) return;

    const success = roomManager.clearRoom(socket.currentRoom);
    
    if (success) {
      io.to(socket.currentRoom).emit('canvas-cleared', {
        userId: socket.id,
        userName: socket.userName
      });
    }
  });

  // Undo last action
  socket.on('undo', () => {
    if (!socket.currentRoom) return;

    const success = roomManager.undoLastElement(socket.currentRoom);
    
    if (success) {
      const elements = roomManager.getRoomElements(socket.currentRoom);
      io.to(socket.currentRoom).emit('canvas-updated', {
        elements,
        action: 'undo',
        userId: socket.id,
        userName: socket.userName
      });
    }
  });

  // ============================================
  // OPTIMIZED VOICE CHAT SIGNALING WITH VALIDATION
  // ============================================
  
  // Track ICE candidates per user for rate limiting (max 50/sec)
  const iceCandidateTimestamps = new Map<string, number[]>();
  
  const checkIceRateLimit = (userId: string): boolean => {
    const now = Date.now();
    const timestamps = iceCandidateTimestamps.get(userId) || [];
    
    // Keep only timestamps from last second
    const recentTimestamps = timestamps.filter(ts => now - ts < 1000);
    
    if (recentTimestamps.length >= 50) {
      console.warn(`⚠️ ICE rate limit exceeded for ${userId}`);
      return false;
    }
    
    recentTimestamps.push(now);
    iceCandidateTimestamps.set(userId, recentTimestamps);
    return true;
  };

  // Validate voice signaling data
  const validateVoiceData = (data: any): { valid: boolean; error?: string } => {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data format' };
    }

    const { targetUserId } = data;
    if (!targetUserId || typeof targetUserId !== 'string') {
      return { valid: false, error: 'Invalid targetUserId' };
    }

    return { valid: true };
  };

  // Validate offer/answer/candidate structure
  const validateSessionDescription = (desc: any): { valid: boolean; error?: string } => {
    if (!desc || typeof desc !== 'object') {
      return { valid: false, error: 'Invalid session description' };
    }

    if (!desc.type || !desc.sdp) {
      return { valid: false, error: 'Missing type or sdp in session description' };
    }

    if (typeof desc.type !== 'string' || typeof desc.sdp !== 'string') {
      return { valid: false, error: 'Invalid type or sdp format' };
    }

    return { valid: true };
  };

  const validateIceCandidate = (candidate: any): { valid: boolean; error?: string } => {
    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, error: 'Invalid ICE candidate format' };
    }

    // ICE candidate should have foundation, component, priority
    if (!candidate.candidate || typeof candidate.candidate !== 'string') {
      return { valid: false, error: 'Invalid ICE candidate string' };
    }

    return { valid: true };
  };

  // Voice offer - optimized with validation
  socket.on('voice-offer', (data: { targetUserId: string; offer: any }) => {
    try {
      if (!socket.currentRoom || !socket.id) {
        socket.emit('voice-error', { error: 'Not in a room' });
        return;
      }

      // Validate data format
      const validation = validateVoiceData(data);
      if (!validation.valid) {
        socket.emit('voice-error', { error: validation.error });
        console.warn(`❌ Invalid voice offer from ${socket.id}: ${validation.error}`);
        return;
      }

      const { targetUserId, offer } = data;

      // Prevent self-offer
      if (targetUserId === socket.id) {
        socket.emit('voice-error', { error: 'Cannot send offer to yourself' });
        return;
      }

      // Validate room and users
      const room = roomManager.getRoom(socket.currentRoom);
      if (!room) {
        socket.emit('voice-error', { error: 'Room not found' });
        return;
      }

      if (!room.voiceChatEnabled) {
        socket.emit('voice-error', { error: 'Voice chat disabled in this room' });
        return;
      }

      // Check if target user is in the same room
      const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
      const targetUserExists = roomUsers.some(u => u.id === targetUserId);

      if (!targetUserExists) {
        socket.emit('voice-error', { error: 'Target user not in room' });
        console.warn(`⚠️ Voice offer to non-existent user ${targetUserId} from ${socket.id}`);
        return;
      }

      // Validate offer structure
      const offerValidation = validateSessionDescription(offer);
      if (!offerValidation.valid) {
        socket.emit('voice-error', { error: offerValidation.error });
        return;
      }

      // Send offer to target user only
      socket.to(targetUserId).emit('voice-offer', {
        fromUserId: socket.id,
        fromUserName: socket.userName,
        offer
      });

      console.log(`📞 Voice offer: ${socket.id} → ${targetUserId}`);
    } catch (error) {
      console.error('❌ Error handling voice offer:', error);
      socket.emit('voice-error', { error: 'Failed to process voice offer' });
    }
  });

  // Voice answer - optimized with validation
  socket.on('voice-answer', (data: { targetUserId: string; answer: any }) => {
    try {
      if (!socket.currentRoom || !socket.id) {
        socket.emit('voice-error', { error: 'Not in a room' });
        return;
      }

      // Validate data format
      const validation = validateVoiceData(data);
      if (!validation.valid) {
        socket.emit('voice-error', { error: validation.error });
        return;
      }

      const { targetUserId, answer } = data;

      // Prevent self-answer
      if (targetUserId === socket.id) {
        socket.emit('voice-error', { error: 'Cannot send answer to yourself' });
        return;
      }

      // Validate room and users
      const room = roomManager.getRoom(socket.currentRoom);
      if (!room) {
        socket.emit('voice-error', { error: 'Room not found' });
        return;
      }

      if (!room.voiceChatEnabled) {
        socket.emit('voice-error', { error: 'Voice chat disabled in this room' });
        return;
      }

      // Check if target user is in the same room
      const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
      const targetUserExists = roomUsers.some(u => u.id === targetUserId);

      if (!targetUserExists) {
        socket.emit('voice-error', { error: 'Target user not in room' });
        return;
      }

      // Validate answer structure
      const answerValidation = validateSessionDescription(answer);
      if (!answerValidation.valid) {
        socket.emit('voice-error', { error: answerValidation.error });
        return;
      }

      // Send answer to target user only
      socket.to(targetUserId).emit('voice-answer', {
        fromUserId: socket.id,
        fromUserName: socket.userName,
        answer
      });

      console.log(`📞 Voice answer: ${socket.id} → ${targetUserId}`);
    } catch (error) {
      console.error('❌ Error handling voice answer:', error);
      socket.emit('voice-error', { error: 'Failed to process voice answer' });
    }
  });

  // ICE candidate - optimized with rate limiting & validation
  socket.on('voice-ice-candidate', (data: { targetUserId: string; candidate: any }) => {
    try {
      if (!socket.currentRoom || !socket.id) {
        return; // Silently ignore - candidates are frequent
      }

      // Validate data format
      const validation = validateVoiceData(data);
      if (!validation.valid) {
        return; // Silently ignore invalid candidates
      }

      // Check rate limit (50 candidates per second max)
      if (!checkIceRateLimit(socket.id)) {
        socket.emit('voice-error', { error: 'ICE candidate rate limit exceeded' });
        return;
      }

      const { targetUserId, candidate } = data;

      // Validate ICE candidate structure
      const candidateValidation = validateIceCandidate(candidate);
      if (!candidateValidation.valid) {
        return; // Silently ignore invalid candidates
      }

      // Check if target user is in the same room
      const room = roomManager.getRoom(socket.currentRoom);
      if (!room) return;

      const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
      const targetUserExists = roomUsers.some(u => u.id === targetUserId);

      if (!targetUserExists) {
        return; // Silently ignore - target user not in room
      }

      // Send candidate to target user only (no acknowledgment needed)
      socket.to(targetUserId).emit('voice-ice-candidate', {
        fromUserId: socket.id,
        candidate
      });
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  });

  // Mute/unmute toggle - optimized
  socket.on('voice-toggle', (data: { isMuted: boolean }) => {
    try {
      if (!socket.currentRoom || !socket.id) {
        socket.emit('voice-error', { error: 'Not in a room' });
        return;
      }

      if (typeof data?.isMuted !== 'boolean') {
        socket.emit('voice-error', { error: 'Invalid mute data' });
        return;
      }

      const { isMuted } = data;

      // Update voice status in room manager
      const result = roomManager.updateUserVoiceStatus(socket.currentRoom, socket.id, { isMuted });

      if (!result.success) {
        socket.emit('voice-error', { error: result.error });
        return;
      }

      // Broadcast mute status to all users in room
      socket.to(socket.currentRoom).emit('user-voice-status', {
        userId: socket.id,
        userName: socket.userName,
        isMuted
      });

      console.log(`🔇 ${socket.userName} (${socket.id}) ${isMuted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      console.error('❌ Error handling voice toggle:', error);
      socket.emit('voice-error', { error: 'Failed to update mute status' });
    }
  });

  // Request voice chat - optimized with efficient broadcasting
  socket.on('request-voice-chat', () => {
    try {
      if (!socket.currentRoom || !socket.id) {
        socket.emit('voice-error', { error: 'Not in a room' });
        return;
      }

      const room = roomManager.getRoom(socket.currentRoom);
      if (!room) {
        socket.emit('voice-error', { error: 'Room not found' });
        return;
      }

      if (!room.voiceChatEnabled) {
        socket.emit('voice-error', { error: 'Voice chat disabled in this room' });
        return;
      }

      const roomUsers = roomManager.getRoomUsers(socket.currentRoom);

      // Check if there are other users in the room
      const otherUserIds = roomUsers
        .filter(user => user.id !== socket.id)
        .map(user => user.id);

      if (otherUserIds.length === 0) {
        socket.emit('voice-error', { error: 'No other users in room to connect with' });
        return;
      }

      // Notify current user of other users to connect to
      socket.emit('voice-chat-started', {
        userIds: otherUserIds
      });

      // Notify other users that this user is starting voice chat
      socket.to(socket.currentRoom).emit('voice-chat-started', {
        userIds: [socket.id]
      });

      console.log(`📢 Voice chat requested by ${socket.userName} in room ${socket.currentRoom}`);
    } catch (error) {
      console.error('❌ Error handling voice chat request:', error);
      socket.emit('voice-error', { error: 'Failed to start voice chat' });
    }
  });

  // Voice chat response - optimized with validation
  socket.on('voice-chat-response', (data: { accepted: boolean; targetUserId: string }) => {
    try {
      if (!socket.currentRoom || !socket.id) {
        socket.emit('voice-error', { error: 'Not in a room' });
        return;
      }

      const validation = validateVoiceData(data);
      if (!validation.valid) {
        socket.emit('voice-error', { error: validation.error });
        return;
      }

      if (typeof data?.accepted !== 'boolean') {
        socket.emit('voice-error', { error: 'Invalid acceptance data' });
        return;
      }

      const { accepted, targetUserId } = data;

      // Verify target user is in the same room
      const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
      const targetUserExists = roomUsers.some(u => u.id === targetUserId);

      if (!targetUserExists) {
        socket.emit('voice-error', { error: 'Target user not in room' });
        return;
      }

      // Send response to target user
      socket.to(targetUserId).emit('voice-chat-response', {
        fromUserId: socket.id,
        fromUserName: socket.userName,
        accepted
      });

      console.log(`📞 Voice chat response: ${socket.userName} ${accepted ? 'accepted' : 'rejected'} from ${targetUserId}`);
    } catch (error) {
      console.error('❌ Error handling voice chat response:', error);
      socket.emit('voice-error', { error: 'Failed to send response' });
    }
  });

  // Handle disconnection - cleanup voice tracking
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    // Clean up ICE candidate rate limiting
    iceCandidateTimestamps.delete(socket.id);
    
    if (socket.currentRoom) {
      const result = roomManager.leaveRoom(socket.currentRoom, socket.id);
      
      if (result.success && !result.roomDeleted) {
        const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
        socket.to(socket.currentRoom).emit('user-left', {
          userId: socket.id,
          users: roomUsers
        });
      }
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Cleanup inactive rooms every hour
setInterval(() => {
  roomManager.cleanup();
}, 60 * 60 * 1000);

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Whiteboard server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});
