import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const DEFAULT_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.DEV
    ? 'http://localhost:5000'
    : '/');

export const useSocket = (serverUrl = DEFAULT_SERVER_URL) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    console.log('🔌 Attempting to connect to:', serverUrl);
    
    // Create socket connection - use "/" to go through Nginx proxy
    const connectUrl = serverUrl === '/' ? '/' : serverUrl;
    
    socketRef.current = io(connectUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      path: '/socket.io/'
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🚨 Connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Room event debugging
    socket.on('room-created', (data) => {
      console.log('🎉 Room created event received:', data);
    });

    socket.on('room-joined', (data) => {
      console.log('🚪 Room joined event received:', data);
    });

    socket.on('room-error', (data) => {
      console.error('🚨 Room error received:', data);
    });

    socket.on('user-joined', (data) => {
      console.log('👤 User joined event received:', data);
    });

    socket.on('user-left', (data) => {
      console.log('👋 User left event received:', data);
    });

    // Test connection after a delay
    setTimeout(() => {
      if (socket.connected) {
        console.log('✅ Socket is connected and ready');
      } else {
        console.log('❌ Socket failed to connect after timeout');
      }
    }, 3000);

    return () => {
      console.log('🔌 Cleaning up socket connection');
      if (socket) {
        socket.disconnect();
      }
    };
  }, [serverUrl]);

  // Create event handler with debugging
  const createEventHandler = useCallback(() => {
    return {
      createRoom: (roomCode, userName) => {
        console.log('📤 Emitting create-room:', { roomCode, userName });
        console.log('Socket connected:', socketRef.current?.connected);
        console.log('Socket ID:', socketRef.current?.id);
        
        if (!socketRef.current?.connected) {
          console.error('❌ Cannot create room - socket not connected');
          return false;
        }
        
        socketRef.current.emit('create-room', { roomCode, userName });
        return true;
      },
      
      joinRoom: (roomCode, userName) => {
        console.log('📤 Emitting join-room:', { roomCode, userName });
        console.log('Socket connected:', socketRef.current?.connected);
        
        if (!socketRef.current?.connected) {
          console.error('❌ Cannot join room - socket not connected');
          return false;
        }
        
        socketRef.current.emit('join-room', { roomCode, userName });
        return true;
      },
      
      leaveRoom: (roomCode) => {
        console.log('📤 Emitting leave-room:', { roomCode });
        socketRef.current?.emit('leave-room', { roomCode });
      },
      
      startDrawing: (data) => {
        socketRef.current?.emit('draw-start', data);
      },
      
      draw: (data) => {
        socketRef.current?.emit('draw', data);
      },
      
      endDrawing: (element) => {
        socketRef.current?.emit('draw-end', { element });
      },
      
      clearCanvas: () => {
        socketRef.current?.emit('clear-canvas');
      },
      
      undo: () => {
        socketRef.current?.emit('undo');
      }
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      console.log('📤 Emitting event:', event, data);
      socketRef.current.emit(event, data);
    } else {
      console.error('❌ Cannot emit - socket not connected');
    }
  }, [isConnected]);

  // Debug function to check socket status
  const debugSocket = useCallback(() => {
    console.log('🔍 Socket Debug Info:');
    console.log('- Connected:', isConnected);
    console.log('- Socket ID:', socketRef.current?.id);
    console.log('- Socket connected:', socketRef.current?.connected);
    console.log('- Connection error:', connectionError);
    console.log('- Socket object:', socketRef.current);
  }, [isConnected, connectionError]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    createEventHandler,
    emit,
    debugSocket // Add this for debugging
  };
};