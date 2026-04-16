import { v4 as uuidv4 } from "uuid";

export interface VoiceStatus {
  isMuted: boolean;
  isConnected: boolean;
  lastUpdated?: Date;
}

export interface User {
  id: string;
  name: string;
  isOwner: boolean;
  joinedAt: Date;
  voiceStatus: VoiceStatus;
}

export interface RoomElement {
  id: string;
  type: string;
  timestamp: Date;
  [key: string]: any;
}

export interface Room {
  id: string;
  createdAt: Date;
  users: Map<string, User>;
  elements: RoomElement[];
  maxUsers: number;
  voiceChatEnabled: boolean;
}

class RoomManager {
  private rooms: Map<string, Room>;
  
  // Incremental tracking for massive optimization of getStats() O(1)
  private statsTotalUsers: number = 0;
  private activeRoomIds: Set<string>;

  constructor() {
    this.rooms = new Map();
    this.activeRoomIds = new Set();
  }

  createRoom(roomCode: string, userId: string, userName: string) {
    if (this.rooms.has(roomCode)) {
      return { success: false, error: "Room already exists" };
    }

    const room: Room = {
      id: roomCode,
      createdAt: new Date(),
      users: new Map(),
      elements: [],
      maxUsers: 10,
      voiceChatEnabled: true,
    };

    // Add creator to room with voice status
    room.users.set(userId, {
      id: userId,
      name: userName,
      isOwner: true,
      joinedAt: new Date(),
      voiceStatus: {
        isMuted: true,
        isConnected: false,
      },
    });

    this.rooms.set(roomCode, room);
    
    // Incremental Stats tracking
    this.statsTotalUsers++;
    this.activeRoomIds.add(roomCode);

    return { success: true, room };
  }

  joinRoom(roomCode: string, userId: string, userName: string) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.users.size >= room.maxUsers) {
      return { success: false, error: "Room is full" };
    }

    // Check if user is already in room
    if (room.users.has(userId)) {
      return { success: true, room, rejoined: true };
    }

    // Add user to room with voice status
    room.users.set(userId, {
      id: userId,
      name: userName,
      isOwner: false,
      joinedAt: new Date(),
      voiceStatus: {
        isMuted: true,
        isConnected: false,
      },
    });

    // Incremental Stats tracking
    this.statsTotalUsers++;
    if (room.users.size === 1) {
      this.activeRoomIds.add(roomCode);
    }

    return { success: true, room };
  }

  leaveRoom(roomCode: string, userId: string) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    const user = room.users.get(userId);
    if (!user) {
      return { success: false, error: "User not in room" };
    }

    room.users.delete(userId);
    this.statsTotalUsers = Math.max(0, this.statsTotalUsers - 1);

    // If room is empty, delete it immediately or mark inactive
    if (room.users.size === 0) {
      this.rooms.delete(roomCode);
      this.activeRoomIds.delete(roomCode);
      return { success: true, roomDeleted: true };
    }

    // If owner left, assign new owner to the first available user
    if (user.isOwner && room.users.size > 0) {
      const newOwner = room.users.values().next().value;
      if (newOwner) newOwner.isOwner = true;
    }

    return { success: true, room };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomUsers(roomCode: string): User[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];

    return Array.from(room.users.values());
  }

  addElement(roomCode: string, element: any) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    room.elements.push({
      ...element,
      id: element.id || uuidv4(),
      timestamp: new Date(),
    });

    return true;
  }

  clearRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    room.elements = [];
    return true;
  }

  undoLastElement(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room || room.elements.length === 0) return false;

    room.elements.pop();
    return true;
  }

  getRoomElements(roomCode: string): RoomElement[] {
    const room = this.rooms.get(roomCode);
    return room ? room.elements : [];
  }

  cleanup() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.users.size === 0 && (now.getTime() - room.createdAt.getTime()) > maxAge) {
        this.rooms.delete(roomCode);
        this.activeRoomIds.delete(roomCode);
        console.log(`Cleaned up inactive room: ${roomCode}`);
      }
    }
  }

  // Highly optimized O(1) stats retrieval
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: this.statsTotalUsers,
      activeRooms: this.activeRoomIds.size,
    };
  }

  // Get comprehensive voice statistics across all rooms
  getVoiceStats() {
    let totalActiveVoiceSessions = 0;
    let totalUsersWithMicrophone = 0;
    let totalMutedUsers = 0;

    for (const room of this.rooms.values()) {
      // Count users with active voice connections
      const voiceActiveUsers = Array.from(room.users.values()).filter(
        u => u.voiceStatus.isConnected
      ).length;

      if (voiceActiveUsers > 0) {
        totalActiveVoiceSessions++;
      }

      // Count users status
      for (const user of room.users.values()) {
        if (user.voiceStatus.isConnected) {
          totalUsersWithMicrophone++;
          if (user.voiceStatus.isMuted) {
            totalMutedUsers++;
          }
        }
      }
    }

    return {
      activeVoiceSessions: totalActiveVoiceSessions,
      usersConnected: totalUsersWithMicrophone,
      usersMuted: totalMutedUsers,
      usersUnmuted: totalUsersWithMicrophone - totalMutedUsers,
      timestamp: new Date().toISOString()
    };
  }

  updateUserVoiceStatus(roomCode: string, userId: string, voiceStatus: Partial<VoiceStatus>) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    const user = room.users.get(userId);
    if (!user) {
      return { success: false, error: "User not in room" };
    }

    // Update user's voice status
    user.voiceStatus = {
      ...user.voiceStatus,
      ...voiceStatus,
      lastUpdated: new Date(),
    };

    return { success: true, user };
  }

  getUsersWithVoiceStatus(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];

    return Array.from(room.users.values()).map((user) => ({
      id: user.id,
      name: user.name,
      isOwner: user.isOwner,
      voiceStatus: user.voiceStatus || {
        isMuted: true,
        isConnected: false,
      },
    }));
  }
}

export default RoomManager;
