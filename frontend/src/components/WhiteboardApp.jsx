// Updated WhiteboardApp.jsx with proper user data handling
import React, { useState, useEffect, useCallback } from 'react';
import HomePage from './HomePage';
import Header from './Header';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import VoiceChat from './VoiceChat';
import { useSocket } from '../hooks/useSocket';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { createSocketEventHandler, generateRoomCode, validateRoomCode, formatUserName } from '../utils/socketEvents';

const WhiteboardApp = () => {
  // Page and room states
  const [currentPage, setCurrentPage] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [userName, setUserName] = useState("");
  const [connectedUsers, setConnectedUsers] = useState([]);

  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(2);
  const [currentPath, setCurrentPath] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [elements, setElements] = useState([]);

  // Socket connection
  const { socket, isConnected } = useSocket();
  const [socketEventHandler, setSocketEventHandler] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Voice chat integration
  const {
    isVoiceChatActive,
    isMuted,
    connectedPeers,
    audioPermission,
    voiceError,
    startVoiceChat,
    stopVoiceChat,
    toggleMute
  } = useVoiceChat(socket, currentRoom, userName);

  // Helper function to normalize user data
  const normalizeUsers = (users) => {
    if (!Array.isArray(users)) return [];
    
    return users.map(user => {
      if (typeof user === 'string') {
        return { id: user, name: user };
      }
      if (user && typeof user === 'object') {
        return {
          id: user.id || user.name || 'unknown',
          name: user.name || user.id || 'Unknown User'
        };
      }
      return { id: 'unknown', name: 'Unknown User' };
    }).filter(user => user.id && user.name);
  };

  // Socket event listeners setup
  useEffect(() => {
    if (!socket || !isConnected) return;

    const callbacks = {
      // Connection callbacks
      onConnect: () => {
        setConnectionStatus('connected');
        console.log('Successfully connected to server');
      },
      
      onDisconnect: () => {
        setConnectionStatus('disconnected');
        console.log('Disconnected from server');
        // Stop voice chat on disconnect
        if (isVoiceChatActive) {
          stopVoiceChat();
        }
      },
      
      onConnectionError: (error) => {
        setConnectionStatus('error');
        console.error('Connection error:', error);
        alert('Connection error. Please try again.');
      },

      // Room callbacks
      onRoomCreated: (data) => {
        console.log('Room created successfully:', data.roomCode);
        setCurrentRoom(data.roomCode);
        
        // Normalize users and add current user
        const normalizedUsers = normalizeUsers(data.users || []);
        const currentUser = { id: socket.id, name: formatUserName(userName) };
        const allUsers = [currentUser, ...normalizedUsers.filter(u => u.id !== socket.id)];
        
        setConnectedUsers(allUsers);
        setCurrentPage("whiteboard");
      },
      
      onRoomJoined: (data) => {
        console.log('Successfully joined room:', data.roomCode);
        
        // Normalize users and add current user
        const normalizedUsers = normalizeUsers(data.users || []);
        const currentUser = { id: socket.id, name: formatUserName(userName) };
        const allUsers = [currentUser, ...normalizedUsers.filter(u => u.id !== socket.id)];
        
        setConnectedUsers(allUsers);
        setElements(data.elements || []);
        setCurrentPage("whiteboard");
      },
      
      onRoomLeft: () => {
        handleLeaveRoom();
      },
      
      onRoomError: (data) => {
        alert(data.error || data.message || 'Room error occurred');
        console.error('Room error:', data);
      },
      
      onUserJoined: (data) => {
        console.log('User joined:', data);
        
        if (data.user && data.user.id && data.user.name) {
          setConnectedUsers(prev => {
            const exists = prev.some(user => user.id === data.user.id);
            if (exists) return prev;
            return [...prev, { id: data.user.id, name: data.user.name }];
          });
        } else if (data.users) {
          // Update with full user list if provided
          const normalizedUsers = normalizeUsers(data.users);
          const currentUser = { id: socket.id, name: formatUserName(userName) };
          const allUsers = [currentUser, ...normalizedUsers.filter(u => u.id !== socket.id)];
          setConnectedUsers(allUsers);
        }
      },
      
      onUserLeft: (data) => {
        console.log('User left:', data);
        
        if (data.userId) {
          setConnectedUsers(prev => prev.filter(user => user.id !== data.userId));
        } else if (data.users) {
          // Update with remaining users if provided
          const normalizedUsers = normalizeUsers(data.users);
          const currentUser = { id: socket.id, name: formatUserName(userName) };
          const allUsers = [currentUser, ...normalizedUsers.filter(u => u.id !== socket.id)];
          setConnectedUsers(allUsers);
        }
      },

      // Drawing callbacks
      onDrawStart: (data) => {
        console.log('Remote user started drawing:', data);
      },
      
      onDraw: (data) => {
        console.log('Remote draw event:', data);
      },
      
      onElementAdded: (data) => {
        if (data.element && data.element.id) {
          setElements(prev => {
            const exists = prev.some(el => el.id === data.element.id);
            return exists ? prev : [...prev, data.element];
          });
        }
        console.log('Remote element added:', data);
      },
      
      onCanvasCleared: (data) => {
        setElements([]);
        setCurrentPath([]);
        setIsDrawing(false);
        console.log('Canvas cleared by:', data.userName);
      },
      
      onCanvasUpdated: (data) => {
        if (data.elements) {
          setElements(data.elements);
        }
        console.log('Canvas updated:', data);
      }
    };

    const eventHandler = createSocketEventHandler(socket, callbacks);
    setSocketEventHandler(eventHandler);

    return () => {
      eventHandler?.cleanup();
    };
  }, [socket, isConnected, userName, isVoiceChatActive, stopVoiceChat]);

  // Generate random room code
  const createRoomCode = () => {
    return generateRoomCode();
  };

  // Room management
  const handleCreateRoom = () => {
    const formattedName = formatUserName(userName);
    if (!formattedName) {
      alert("Please enter your name");
      return;
    }

    const newRoomCode = createRoomCode();
    socketEventHandler?.createRoom(newRoomCode, formattedName);
  };

  const handleJoinRoom = () => {
    const formattedName = formatUserName(userName);
    if (!formattedName) {
      alert("Please enter your name");
      return;
    }
    
    const upperRoomCode = roomCode.toUpperCase();
    if (!validateRoomCode(upperRoomCode)) {
      alert("Please enter a valid room code (4-8 characters, letters and numbers only)");
      return;
    }

    socketEventHandler?.joinRoom(upperRoomCode, formattedName);
  };

  const handleLeaveRoom = () => {
    // Stop voice chat before leaving
    if (isVoiceChatActive) {
      stopVoiceChat();
    }
    
    socketEventHandler?.leaveRoom(currentRoom);
    
    // Reset states
    setCurrentPage("home");
    setCurrentRoom("");
    setRoomCode("");
    setConnectedUsers([]);
    setElements([]);
    setCurrentPath([]);
    setIsDrawing(false);
    setStartPoint(null);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(currentRoom);
    alert("Room code copied to clipboard!");
  };

  // Drawing event handlers
  const handleMouseDown = useCallback((e) => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    
    if (tool === "pen" || tool === "eraser") {
      setCurrentPath([{ x, y }]);
    } else {
      setStartPoint({ x, y });
      setCurrentPath([{ x, y }]);
    }

    // Emit draw start event
    socketEventHandler?.startDrawing({
      tool,
      color,
      brushSize,
      point: { x, y },
      roomCode: currentRoom,
      userName: formatUserName(userName)
    });
  }, [tool, color, brushSize, currentRoom, userName, socketEventHandler]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentPath(prev => [...prev, { x, y }]);

    // Emit draw event for real-time collaboration
    socketEventHandler?.draw({
      tool,
      color,
      brushSize,
      point: { x, y },
      roomCode: currentRoom,
      userName: formatUserName(userName)
    });
  }, [isDrawing, tool, color, brushSize, currentRoom, userName, socketEventHandler]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    // Create element based on tool
    let newElement;
    
    if (tool === "pen" || tool === "eraser") {
      if (currentPath.length > 0) {
        newElement = {
          id: Date.now(),
          type: tool,
          points: currentPath,
          color,
          brushSize,
        };
      }
    } else if (startPoint && currentPath.length > 0) {
      const lastPoint = currentPath[currentPath.length - 1];
      newElement = {
        id: Date.now(),
        type: tool,
        x1: startPoint.x,
        y1: startPoint.y,
        x2: lastPoint.x,
        y2: lastPoint.y,
        color,
        brushSize,
      };
    }
    
    if (newElement) {
      setElements(prev => [...prev, newElement]);
      
      // Emit completed element
      socketEventHandler?.endDrawing(newElement);
    }
    
    setCurrentPath([]);
    setStartPoint(null);
  }, [isDrawing, tool, color, brushSize, currentPath, startPoint, socketEventHandler]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      handleMouseUp();
    }
  }, [isDrawing, handleMouseUp]);

  // Canvas actions
  const undoLastAction = () => {
    if (elements.length === 0) return;
    
    const newElements = elements.slice(0, -1);
    setElements(newElements);
    
    // Emit undo event
    socketEventHandler?.undo();
  };

  const clearCanvas = () => {
    setElements([]);
    setCurrentPath([]);
    setIsDrawing(false);
    setStartPoint(null);
    
    // Emit clear canvas event
    socketEventHandler?.clearCanvas();
  };

  const downloadCanvas = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `whiteboard-${currentRoom}-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  // Render appropriate page
  if (currentPage === "home") {
    return (
      <HomePage
        userName={userName}
        setUserName={setUserName}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        handleCreateRoom={handleCreateRoom}
        handleJoinRoom={handleJoinRoom}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        currentRoom={currentRoom}
        connectedUsers={connectedUsers}
        copyRoomCode={copyRoomCode}
        handleLeaveRoom={handleLeaveRoom}
      />
      
      <div className="flex-1 flex ">
        <div className="flex flex-col">
          <Toolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            elements={elements}
            undoLastAction={undoLastAction}
            clearCanvas={clearCanvas}
            downloadCanvas={downloadCanvas}
            connectedUsers={connectedUsers}
          />
          
          {/* Voice Chat Component */}
          <VoiceChat
            isVoiceChatActive={isVoiceChatActive}
            isMuted={isMuted}
            connectedPeers={connectedPeers}
            audioPermission={audioPermission}
            voiceError={voiceError}
            startVoiceChat={startVoiceChat}
            stopVoiceChat={stopVoiceChat}
            toggleMute={toggleMute}
            connectedUsers={connectedUsers}
          />
        </div>
        
        <Canvas
          elements={elements}
          currentPath={currentPath}
          tool={tool}
          color={color}
          brushSize={brushSize}
          startPoint={startPoint}
          isDrawing={isDrawing}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>
      
      {connectionStatus !== 'connected' && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg ${
          connectionStatus === 'error' 
            ? 'bg-red-100 border border-red-400 text-red-800'
            : 'bg-yellow-100 border border-yellow-400 text-yellow-800'
        }`}>
          {connectionStatus === 'error' ? 'Connection failed' : 'Connecting to server...'}
        </div>
      )}
    </div>
  );
};

export default WhiteboardApp;