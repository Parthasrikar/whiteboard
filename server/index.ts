import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import RoomManager, { RoomElement } from './roomManager';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://whiteboard-frontend-2e8f.onrender.com",
      "https://your-production-domain.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    ...stats
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

  // Voice chat signaling events
  socket.on('voice-offer', (data: { targetUserId: string, offer: any }) => {
    if (!socket.currentRoom) return;
    
    const { targetUserId, offer } = data;
    
    socket.to(targetUserId).emit('voice-offer', {
      fromUserId: socket.id,
      fromUserName: socket.userName,
      offer
    });
    
    console.log(`Voice offer from ${socket.id} to ${targetUserId}`);
  });

  socket.on('voice-answer', (data: { targetUserId: string, answer: any }) => {
    if (!socket.currentRoom) return;
    
    const { targetUserId, answer } = data;
    
    socket.to(targetUserId).emit('voice-answer', {
      fromUserId: socket.id,
      fromUserName: socket.userName,
      answer
    });
    
    console.log(`Voice answer from ${socket.id} to ${targetUserId}`);
  });

  socket.on('voice-ice-candidate', (data: { targetUserId: string, candidate: any }) => {
    if (!socket.currentRoom) return;
    
    const { targetUserId, candidate } = data;
    
    socket.to(targetUserId).emit('voice-ice-candidate', {
      fromUserId: socket.id,
      fromUserName: socket.userName,
      candidate
    });
  });

  socket.on('voice-toggle', (data: { isMuted: boolean }) => {
    if (!socket.currentRoom) return;
    
    const { isMuted } = data;
    
    const result = roomManager.updateUserVoiceStatus(socket.currentRoom, socket.id, { isMuted });
    
    if (result.success) {
      socket.to(socket.currentRoom).emit('user-voice-status', {
        userId: socket.id,
        userName: socket.userName,
        isMuted
      });
    }
  });

  socket.on('request-voice-chat', () => {
    if (!socket.currentRoom) return;
    
    const roomUsers = roomManager.getRoomUsers(socket.currentRoom);
    const otherUserIds = roomUsers
      .filter(user => user.id !== socket.id)
      .map(user => user.id);
    
    if (otherUserIds.length === 0) {
      socket.emit('voice-error', { error: 'No other users in room' });
      return;
    }
    
    socket.to(socket.currentRoom).emit('voice-chat-requested', {
      fromUserId: socket.id,
      fromUserName: socket.userName
    });
    
    socket.emit('voice-chat-started', {
      userIds: otherUserIds
    });
    
    socket.to(socket.currentRoom).emit('voice-chat-started', {
      userIds: [socket.id]
    });
  });

  socket.on('voice-chat-response', (data: { accepted: boolean, targetUserId: string }) => {
    if (!socket.currentRoom) return;
    
    const { accepted, targetUserId } = data;
    
    socket.to(targetUserId).emit('voice-chat-response', {
      fromUserId: socket.id,
      fromUserName: socket.userName,
      accepted
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
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
