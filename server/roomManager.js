const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomCode, userId, userName) {
    if (this.rooms.has(roomCode)) {
      return { success: false, error: 'Room already exists' };
    }

    const room = {
      id: roomCode,
      createdAt: new Date(),
      users: new Map(),
      elements: [],
      maxUsers: 10
    };

    // Add creator to room
    room.users.set(userId, {
      id: userId,
      name: userName,
      isOwner: true,
      joinedAt: new Date()
    });

    this.rooms.set(roomCode, room);
    return { success: true, room };
  }

  joinRoom(roomCode, userId, userName) {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.users.size >= room.maxUsers) {
      return { success: false, error: 'Room is full' };
    }

    // Check if user is already in room
    if (room.users.has(userId)) {
      return { success: true, room, rejoined: true };
    }

    // Add user to room
    room.users.set(userId, {
      id: userId,
      name: userName,
      isOwner: false,
      joinedAt: new Date()
    });

    return { success: true, room };
  }

  leaveRoom(roomCode, userId) {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const user = room.users.get(userId);
    if (!user) {
      return { success: false, error: 'User not in room' };
    }

    room.users.delete(userId);

    // If room is empty, delete it
    if (room.users.size === 0) {
      this.rooms.delete(roomCode);
      return { success: true, roomDeleted: true };
    }

    // If owner left, assign new owner
    if (user.isOwner && room.users.size > 0) {
      const newOwner = room.users.values().next().value;
      newOwner.isOwner = true;
    }

    return { success: true, room };
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomUsers(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    
    return Array.from(room.users.values());
  }

  addElement(roomCode, element) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    room.elements.push({
      ...element,
      id: element.id || uuidv4(),
      timestamp: new Date()
    });

    return true;
  }

  clearRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    room.elements = [];
    return true;
  }

  undoLastElement(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.elements.length === 0) return false;

    room.elements.pop();
    return true;
  }

  getRoomElements(roomCode) {
    const room = this.rooms.get(roomCode);
    return room ? room.elements : [];
  }

  // Cleanup inactive rooms (older than 24 hours with no users)
  cleanup() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.users.size === 0 && (now - room.createdAt) > maxAge) {
        this.rooms.delete(roomCode);
        console.log(`Cleaned up inactive room: ${roomCode}`);
      }
    }
  }

  getStats() {
    const totalRooms = this.rooms.size;
    const totalUsers = Array.from(this.rooms.values())
      .reduce((sum, room) => sum + room.users.size, 0);
    
    return {
      totalRooms,
      totalUsers,
      activeRooms: Array.from(this.rooms.values())
        .filter(room => room.users.size > 0).length
    };
  }
}

module.exports = RoomManager;