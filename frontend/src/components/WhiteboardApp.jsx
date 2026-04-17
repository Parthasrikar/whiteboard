// Updated WhiteboardApp.jsx with VoiceChat integrated into Toolbar
import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomePage from './HomePage';
import Header from './Header';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
// Remove separate VoiceChat import since it's now in Toolbar
// import VoiceChat from './VoiceChat';
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
  const [messages, setMessages] = useState([]);
  const [toast, setToast] = useState(null);

  // Toast utility
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 3000);
  }, []);

  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(18);
  const [currentPath, setCurrentPath] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [elements, setElements] = useState([]);
  const [remoteDrawings, setRemoteDrawings] = useState({});
  const [remoteCursors, setRemoteCursors] = useState({});
  const [pendingImageData, setPendingImageData] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const lastCursorEmitRef = React.useRef(0);

  // Socket connection
  const { socket, isConnected } = useSocket();
  const [socketEventHandler, setSocketEventHandler] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // --- Stable callback ref so the socket handler never needs to be re-created ---
  const callbacksRef = useRef({});

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

  // Keep callbacksRef always pointing at the latest closures
  useEffect(() => {
    callbacksRef.current = {
      onConnect: () => setConnectionStatus('connected'),
      onDisconnect: () => {
        setConnectionStatus('disconnected');
        if (isVoiceChatActive) stopVoiceChat();
      },
      onConnectionError: () => setConnectionStatus('error'),

      onRoomCreated: (data) => {
        setCurrentRoom(data.roomCode);
        const normalizedUsers = normalizeUsers(data.users || []);
        const currentUser = { id: socket?.id, name: formatUserName(userName) };
        setConnectedUsers([currentUser, ...normalizedUsers.filter(u => u.id !== socket?.id)]);
        setCurrentPage('whiteboard');
      },
      onRoomJoined: (data) => {
        const normalizedUsers = normalizeUsers(data.users || []);
        const currentUser = { id: socket?.id, name: formatUserName(userName) };
        setConnectedUsers([currentUser, ...normalizedUsers.filter(u => u.id !== socket?.id)]);
        setElements(data.elements || []);
        setCurrentPage('whiteboard');
      },
      onRoomLeft: () => handleLeaveRoom(),
      onRoomError: (data) => showToast(data.error || 'Room error occurred', 'error'),

      onUserJoined: (data) => {
        if (data.user?.id && data.user?.name) {
          setConnectedUsers(prev => prev.some(u => u.id === data.user.id) ? prev : [...prev, { id: data.user.id, name: data.user.name }]);
        } else if (data.users) {
          const norm = normalizeUsers(data.users);
          setConnectedUsers([{ id: socket?.id, name: formatUserName(userName) }, ...norm.filter(u => u.id !== socket?.id)]);
        }
      },
      onUserLeft: (data) => {
        if (data.userId) {
          setConnectedUsers(prev => prev.filter(u => u.id !== data.userId));
        }
      },

      onDrawStart: (data) => {
        setRemoteDrawings(prev => ({
          ...prev,
          [data.userId]: { tool: data.tool, color: data.color, brushSize: data.brushSize, points: [data.point], startPoint: data.point }
        }));
      },
      onDraw: (data) => {
        setRemoteDrawings(prev => {
          const remote = prev[data.userId];
          if (!remote) return prev;
          return { ...prev, [data.userId]: { ...remote, points: [...remote.points, data.point] } };
        });
        setRemoteCursors(prev => ({ ...prev, [data.userId]: { x: data.point.x, y: data.point.y, userName: data.userName, color: data.color } }));
      },
      onElementAdded: (data) => {
        if (data.element?.id) {
          setElements(prev => prev.some(el => el.id === data.element.id) ? prev : [...prev, data.element]);
        }
        if (data.userId) {
          setRemoteDrawings(prev => { const s = { ...prev }; delete s[data.userId]; return s; });
        }
      },
      onCursorMove: (data) => {
        setRemoteCursors(prev => ({ ...prev, [data.userId]: { x: data.point.x, y: data.point.y, userName: data.userName, color: data.color } }));
      },

      // Chat — most critical
      onReceiveMessage: (msg) => {
        console.log('[Chat] onReceiveMessage called, msg:', msg);
        setMessages(prev => [...prev, msg]);
      },

      onCanvasCleared: () => { setElements([]); setCurrentPath([]); setIsDrawing(false); },
      onCanvasUpdated: (data) => { if (data.elements) setElements(data.elements); },
    };
  });

  // Create the socket event handler ONCE when the socket connects — never re-create it
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Stable proxy: always delegates to the current callbacksRef
    const stableCallbacks = new Proxy({}, {
      get: (_, key) => (...args) => callbacksRef.current[key]?.(...args)
    });

    const eventHandler = createSocketEventHandler(socket, stableCallbacks);
    setSocketEventHandler(eventHandler);

    return () => { eventHandler.cleanup(); };
  }, [socket, isConnected]); // Only depend on socket identity — not userName or other state

  // Generate random room code
  const createRoomCode = () => {
    return generateRoomCode();
  };

  // Room management
  const handleCreateRoom = () => {
    const formattedName = formatUserName(userName);
    if (!formattedName) {
      showToast("Please enter your name", "error");
      return;
    }

    const newRoomCode = createRoomCode();
    socketEventHandler?.createRoom(newRoomCode, formattedName);
  };

  const handleJoinRoom = () => {
    const formattedName = formatUserName(userName);
    if (!formattedName) {
      showToast("Please enter your name", "error");
      return;
    }
    
    const upperRoomCode = roomCode.toUpperCase();
    if (!validateRoomCode(upperRoomCode)) {
      showToast("Please enter a valid room code (4-8 characters, letters and numbers only)", "error");
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
    setRemoteDrawings({});
    setRemoteCursors({});
    setMessages([]);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(currentRoom);
    showToast("Room code copied to clipboard!", "success");
  };

  // Drawing event handlers
  const handleMouseDown = useCallback((e) => {
    let x, y;
    if (e.nativeEvent && e.nativeEvent.offsetX !== undefined) {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    } else {
      const rect = e.target.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
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
    let x, y;
    if (e.nativeEvent && e.nativeEvent.offsetX !== undefined) {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    } else {
      const rect = e.target.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    if (!isDrawing) {
      // Throttle cursor emit heavily when not drawing
      const now = Date.now();
      if (now - lastCursorEmitRef.current > 40) {
        socketEventHandler?.emitCursorMove({
          point: { x, y },
          roomCode: currentRoom,
          userName: formatUserName(userName),
          color
        });
        lastCursorEmitRef.current = now;
      }
      return;
    }
    
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

  // Ctrl+Z / Cmd+Z keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't undo if user is typing in a textarea or input
      const target = e.target;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoLastAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [elements, socketEventHandler]);

  // Text tool handler
  const handleTextCommit = useCallback((text, x, y) => {
    const newElement = {
      id: Date.now(),
      type: 'text',
      text,
      x,
      y,
      color,
      fontSize,
    };
    setElements(prev => [...prev, newElement]);
    socketEventHandler?.endDrawing(newElement);
  }, [color, fontSize, socketEventHandler]);

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
      // Create a new canvas with white background
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvas.width;
      newCanvas.height = canvas.height;
      
      const ctx = newCanvas.getContext('2d');
      if (ctx) {
        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        
        // Draw the original canvas on top
        ctx.drawImage(canvas, 0, 0);
      }
      
      const link = document.createElement('a');
      link.download = `whiteboard-${currentRoom}-${Date.now()}.png`;
      link.href = newCanvas.toDataURL();
      link.click();
    }
  };

  const onUploadImage = (imageDataUrl) => {
    // Set tool to image mode and store the image data
    setIsUploadingImage(true);
    setPendingImageData(imageDataUrl);
    setTool('image');
    // Loading state will be cleared when image is placed
  };

  const onImagePlace = (imageElement) => {
    // Add image to canvas when user clicks
    setElements(prev => [...prev, imageElement]);
    
    // Emit image element to other users
    socketEventHandler?.drawElement(imageElement);
    
    // Clear pending image data, reset tool, and clear loading state
    setPendingImageData(null);
    setIsUploadingImage(false);
    setTool('pen');
  };

  const onImageUpdate = (imageElement) => {
    // Update existing image element (for dragging/resizing)
    setElements(prev => 
      prev.map(el => el.id === imageElement.id ? imageElement : el)
    );
    
    // Emit updated image to other users
    socketEventHandler?.drawElement(imageElement);
  };

  // Global Connection Indicator Bulb Component
  const displayStatus = isConnected ? 'connected' : connectionStatus;
  
  const ConnectionIndicator = () => (
    <div className="fixed bottom-6 right-6 flex items-center bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-200/60 z-50 hover:scale-105 transition-transform duration-200 cursor-default">
      <div className="relative flex h-3 w-3 mr-3">
        {displayStatus === 'connected' && (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" style={{ animationDuration: '3s' }}></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </>
        )}
        {displayStatus === 'error' && (
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        )}
        {displayStatus !== 'connected' && displayStatus !== 'error' && (
          <>
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </>
        )}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
        {displayStatus === 'connected' ? 'Online' : displayStatus === 'error' ? 'Offline' : 'Connecting'}
      </span>
    </div>
  );

  const ToastNotification = () => {
    if (!toast) return null;
    return (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-200">
        <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 backdrop-blur-xl ${
          toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' :
          toast.type === 'success' ? 'bg-green-50/95 border-green-200 text-green-700' :
          'bg-white/95 border-gray-200 text-gray-700'
        }`}>
          <span className="text-[13px] font-bold tracking-wide">{toast.message}</span>
        </div>
      </div>
    );
  };

  // Render appropriate page
  if (currentPage === "home") {
    return (
      <>
        <ToastNotification />
        <HomePage
          userName={userName}
          setUserName={setUserName}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          handleCreateRoom={handleCreateRoom}
          handleJoinRoom={handleJoinRoom}
        />
        <ConnectionIndicator />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <ToastNotification />
      <Header
        currentRoom={currentRoom}
        connectedUsers={connectedUsers}
        copyRoomCode={copyRoomCode}
        handleLeaveRoom={handleLeaveRoom}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Enhanced Toolbar with integrated VoiceChat */}
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
          onUploadImage={onUploadImage}
          isUploadingImage={isUploadingImage}
          connectedUsers={connectedUsers}
          // Voice chat props passed to toolbar
          isVoiceChatActive={isVoiceChatActive}
          isMuted={isMuted}
          connectedPeers={connectedPeers}
          audioPermission={audioPermission}
          voiceError={voiceError}
          startVoiceChat={startVoiceChat}
          stopVoiceChat={stopVoiceChat}
          toggleMute={toggleMute}
          messages={messages}
          sendMessage={(text) => socketEventHandler?.sendMessage(text, formatUserName(userName))}
          fontSize={fontSize}
          setFontSize={setFontSize}
        />
        
        {/* Canvas takes the remaining space */}
        <Canvas
          elements={elements}
          currentPath={currentPath}
          tool={tool}
          color={color}
          brushSize={brushSize}
          fontSize={fontSize}
          startPoint={startPoint}
          isDrawing={isDrawing}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTextCommit={handleTextCommit}
          onImagePlace={onImagePlace}
          onImageUpdate={onImageUpdate}
          remoteCursors={remoteCursors}
          remoteDrawings={remoteDrawings}
          pendingImageData={pendingImageData}
        />
      </div>
      
      
      {/* Global Connection status indicator bulb */}
      <ConnectionIndicator />
    </div>
  );
};

export default WhiteboardApp;