// Socket event handlers and utilities for the frontend
export const socketEvents = {
  // Room events
  ROOM_CREATED: 'room-created',
  ROOM_JOINED: 'room-joined',
  ROOM_LEFT: 'room-left',
  ROOM_ERROR: 'room-error',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  
  // Drawing events
  DRAW_START: 'draw-start',
  DRAW: 'draw',
  DRAW_END: 'draw-end',
  ELEMENT_ADDED: 'element-added',
  
  // Canvas events
  CLEAR_CANVAS: 'clear-canvas',
  CANVAS_CLEARED: 'canvas-cleared',
  UNDO: 'undo',
  CANVAS_UPDATED: 'canvas-updated',
  
  // Actions
  CREATE_ROOM: 'create-room',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room'
};

export class SocketEventHandler {
  constructor(socket, callbacks = {}) {
    this.socket = socket;
    this.callbacks = callbacks;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Room events
    this.socket.on(socketEvents.ROOM_CREATED, (data) => {
      console.log('Room created:', data);
      this.callbacks.onRoomCreated?.(data);
    });

    this.socket.on(socketEvents.ROOM_JOINED, (data) => {
      console.log('Room joined:', data);
      this.callbacks.onRoomJoined?.(data);
    });

    this.socket.on(socketEvents.ROOM_LEFT, () => {
      console.log('Room left');
      this.callbacks.onRoomLeft?.();
    });

    this.socket.on(socketEvents.ROOM_ERROR, (data) => {
      console.error('Room error:', data);
      this.callbacks.onRoomError?.(data);
    });

    this.socket.on(socketEvents.USER_JOINED, (data) => {
      console.log('User joined:', data);
      this.callbacks.onUserJoined?.(data);
    });

    this.socket.on(socketEvents.USER_LEFT, (data) => {
      console.log('User left:', data);
      this.callbacks.onUserLeft?.(data);
    });

    // Drawing events
    this.socket.on(socketEvents.DRAW_START, (data) => {
      this.callbacks.onDrawStart?.(data);
    });

    this.socket.on(socketEvents.DRAW, (data) => {
      this.callbacks.onDraw?.(data);
    });

    this.socket.on(socketEvents.ELEMENT_ADDED, (data) => {
      console.log('Element added:', data);
      this.callbacks.onElementAdded?.(data);
    });

    // Canvas events
    this.socket.on(socketEvents.CANVAS_CLEARED, (data) => {
      console.log('Canvas cleared by:', data.userName);
      this.callbacks.onCanvasCleared?.(data);
    });

    this.socket.on(socketEvents.CANVAS_UPDATED, (data) => {
      console.log('Canvas updated:', data);
      this.callbacks.onCanvasUpdated?.(data);
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.callbacks.onDisconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.callbacks.onConnectionError?.(error);
    });
  }

  // Emit methods
  createRoom(roomCode, userName) {
    this.socket?.emit(socketEvents.CREATE_ROOM, { roomCode, userName });
  }

  joinRoom(roomCode, userName) {
    this.socket?.emit(socketEvents.JOIN_ROOM, { roomCode, userName });
  }

  leaveRoom(roomCode) {
    this.socket?.emit(socketEvents.LEAVE_ROOM, { roomCode });
  }

  startDrawing(data) {
    this.socket?.emit(socketEvents.DRAW_START, data);
  }

  draw(data) {
    this.socket?.emit(socketEvents.DRAW, data);
  }

  endDrawing(element) {
    this.socket?.emit(socketEvents.DRAW_END, { element });
  }

  clearCanvas() {
    this.socket?.emit(socketEvents.CLEAR_CANVAS);
  }

  undo() {
    this.socket?.emit(socketEvents.UNDO);
  }

  cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

// Helper function to create event handler
export const createSocketEventHandler = (socket, callbacks) => {
  return new SocketEventHandler(socket, callbacks);
};

// Utility functions
export const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const validateRoomCode = (code) => {
  return code && code.length >= 4 && code.length <= 8 && /^[A-Z0-9]+$/.test(code);
};

export const formatUserName = (name) => {
  return name.trim().substring(0, 20); // Limit to 20 characters
};