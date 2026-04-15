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
  CURSOR_MOVE: 'cursor-move',
  
  
  // Canvas events
  CLEAR_CANVAS: 'clear-canvas',
  CANVAS_CLEARED: 'canvas-cleared',
  UNDO: 'undo',
  CANVAS_UPDATED: 'canvas-updated',
  
  // Chat events
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
  
  // Actions
  CREATE_ROOM: 'create-room',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room'
};

export class SocketEventHandler {
  constructor(socket, callbacks = {}) {
    this.socket = socket;
    this.callbacks = callbacks;
    // Store named handlers so we can remove only our own listeners on cleanup
    this._handlers = {};
    this.setupEventListeners();
  }

  _on(event, fn) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(fn);
    this.socket.on(event, fn);
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Room events
    this._on(socketEvents.ROOM_CREATED, (data) => {
      this.callbacks.onRoomCreated?.(data);
    });
    this._on(socketEvents.ROOM_JOINED, (data) => {
      this.callbacks.onRoomJoined?.(data);
    });
    this._on(socketEvents.ROOM_LEFT, () => {
      this.callbacks.onRoomLeft?.();
    });
    this._on(socketEvents.ROOM_ERROR, (data) => {
      this.callbacks.onRoomError?.(data);
    });
    this._on(socketEvents.USER_JOINED, (data) => {
      this.callbacks.onUserJoined?.(data);
    });
    this._on(socketEvents.USER_LEFT, (data) => {
      this.callbacks.onUserLeft?.(data);
    });

    // Drawing events
    this._on(socketEvents.DRAW_START, (data) => {
      this.callbacks.onDrawStart?.(data);
    });
    this._on(socketEvents.DRAW, (data) => {
      this.callbacks.onDraw?.(data);
    });
    this._on(socketEvents.ELEMENT_ADDED, (data) => {
      this.callbacks.onElementAdded?.(data);
    });
    this._on(socketEvents.CURSOR_MOVE, (data) => {
      this.callbacks.onCursorMove?.(data);
    });

    // Chat events — critical: must survive re-renders
    this._on(socketEvents.RECEIVE_MESSAGE, (data) => {
      console.log('[Chat] receive-message fired:', data);
      this.callbacks.onReceiveMessage?.(data);
    });

    // Canvas events
    this._on(socketEvents.CANVAS_CLEARED, (data) => {
      this.callbacks.onCanvasCleared?.(data);
    });
    this._on(socketEvents.CANVAS_UPDATED, (data) => {
      this.callbacks.onCanvasUpdated?.(data);
    });

    // Connection events
    this._on('connect', () => {
      this.callbacks.onConnect?.();
    });
    this._on('disconnect', () => {
      this.callbacks.onDisconnect?.();
    });
    this._on('connect_error', (error) => {
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

  emitCursorMove(data) {
    this.socket?.emit(socketEvents.CURSOR_MOVE, data);
  }

  sendMessage(text, userName) {
    console.log('[Chat] emitting send-message:', { text, userName });
    this.socket?.emit(socketEvents.SEND_MESSAGE, { text, userName });
  }

  clearCanvas() {
    this.socket?.emit(socketEvents.CLEAR_CANVAS);
  }

  undo() {
    this.socket?.emit(socketEvents.UNDO);
  }

  // Only remove THIS handler's own listeners — do NOT call removeAllListeners()
  cleanup() {
    if (!this.socket) return;
    Object.entries(this._handlers).forEach(([event, fns]) => {
      fns.forEach(fn => this.socket.off(event, fn));
    });
    this._handlers = {};
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