import React, { useRef, useEffect, useState } from 'react';
import rough from 'roughjs';
import { ZoomIn, ZoomOut, Focus } from 'lucide-react';

const Canvas = ({ 
  elements, 
  currentPath, 
  tool, 
  color, 
  brushSize, 
  startPoint,
  isDrawing,
  onMouseDown, 
  onMouseMove, 
  onMouseUp, 
  onMouseLeave,
  remoteCursors = {},
  remoteDrawings = {}
}) => {
  const canvasRef = useRef(null);
  const roughCanvasRef = useRef(null);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  // Camera state for infinite canvas
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);

  // Helper function to get correct world coordinates for the canvas
  const getMousePos = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    
    // Convert screen coordinates to world coordinates based on camera location and zoom
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom
    };
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomSensitivity = 0.001;
      const zoomDelta = -e.deltaY * zoomSensitivity;
      const newZoom = Math.min(Math.max(0.1, camera.zoom * (1 + zoomDelta)), 5);
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setCamera(prev => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / prev.zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / prev.zoom),
        zoom: newZoom
      }));
    } else {
      // Pan
      setCamera(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleZoomIn = () => {
    setCamera(prev => {
      // Zoom towards center of canvas instead of mouse
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const newZoom = Math.min(5, prev.zoom * 1.2);
      
      return {
        x: centerX - (centerX - prev.x) * (newZoom / prev.zoom),
        y: centerY - (centerY - prev.y) * (newZoom / prev.zoom),
        zoom: newZoom
      };
    });
  };

  const handleZoomOut = () => {
    setCamera(prev => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const newZoom = Math.max(0.1, prev.zoom / 1.2);
      
      return {
        x: centerX - (centerX - prev.x) * (newZoom / prev.zoom),
        y: centerY - (centerY - prev.y) * (newZoom / prev.zoom),
        zoom: newZoom
      };
    });
  };

  const handleResetView = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  // Wrap the original mouse event handlers to fix coordinates and intercept panning
  const handleMouseDown = (e) => {
    // Intercept panning (middle click, right click, or pan tool)
    if (e.button === 1 || e.button === 2 || tool === "pan") {
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const pos = getMousePos(canvas, e.clientX, e.clientY);
    const syntheticEvent = {
      ...e,
      nativeEvent: {
        ...e.nativeEvent,
        offsetX: pos.x,
        offsetY: pos.y
      }
    };
    onMouseDown(syntheticEvent);
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      setCamera(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const pos = getMousePos(canvas, e.clientX, e.clientY);
    const syntheticEvent = {
      ...e,
      nativeEvent: {
        ...e.nativeEvent,
        offsetX: pos.x,
        offsetY: pos.y
      }
    };
    onMouseMove(syntheticEvent);
  };

  const interceptMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    onMouseUp(e);
  };

  const interceptMouseLeave = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    onMouseLeave(e);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to match display size with High DPI support
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    roughCanvasRef.current = rough.canvas(canvas);

    // Clear whole screen (taking dpr into account)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Apply camera transform
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    elements.forEach((element) => {
      drawElement(element, ctx, roughCanvasRef.current);
    });

    // Draw current path/shape if drawing
    if (isDrawing && (currentPath.length > 0 || startPoint)) {
      let tempElement;
      
      if (tool === "pen" || tool === "eraser") {
        tempElement = {
          id: Date.now(),
          type: tool,
          points: currentPath,
          color,
          brushSize,
        };
      } else if (startPoint && currentPath.length > 0) {
        const lastPoint = currentPath[currentPath.length - 1];
        tempElement = {
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
      
      if (tempElement) {
        drawElement(tempElement, ctx, roughCanvasRef.current);
      }
    }
    
    // Draw remote active paths
    if (Object.keys(remoteDrawings).length > 0) {
      Object.values(remoteDrawings).forEach(remote => {
        if (!remote.points || remote.points.length === 0) return;
        
        let tempElement;
        if (remote.tool === "pen" || remote.tool === "eraser") {
          tempElement = {
            id: Date.now() + Math.random(),
            type: remote.tool,
            points: remote.points,
            color: remote.color,
            brushSize: remote.brushSize,
          };
        } else if (remote.startPoint && remote.points.length > 0) {
          const lastPoint = remote.points[remote.points.length - 1];
          tempElement = {
            id: Date.now() + Math.random(),
            type: remote.tool,
            x1: remote.startPoint.x,
            y1: remote.startPoint.y,
            x2: lastPoint.x,
            y2: lastPoint.y,
            color: remote.color,
            brushSize: remote.brushSize,
          };
        }
        
        if (tempElement) {
          drawElement(tempElement, ctx, roughCanvasRef.current);
        }
      });
    }

    ctx.restore();
  }, [elements, currentPath, isDrawing, tool, color, brushSize, startPoint, camera, remoteDrawings]); // Added camera to dependencies

  // Dot grid background pattern that moves with the camera
  const dotGridStyle = {
    backgroundImage: `radial-gradient(#d1d5db 1px, transparent 1px)`,
    backgroundSize: `${24 * camera.zoom}px ${24 * camera.zoom}px`,
    backgroundPosition: `${camera.x}px ${camera.y}px`,
    backgroundColor: '#ffffff'
  };

  const drawElement = (element, ctx, roughCanvas) => {
    switch (element.type) {
      case "pen":
        if (element.points && element.points.length > 1) {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = element.color;
          ctx.lineWidth = element.brushSize;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          // Quadratic bezier curves for smoother curved lines
          ctx.moveTo(element.points[0].x, element.points[0].y);
          for (let i = 1; i < element.points.length - 1; i++) {
            const xc = (element.points[i].x + element.points[i + 1].x) / 2;
            const yc = (element.points[i].y + element.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(element.points[i].x, element.points[i].y, xc, yc);
          }
          // For the last point
          const lastPoint = element.points[element.points.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
          ctx.stroke();
        }
        break;
      case "rectangle":
        roughCanvas.rectangle(
          element.x1,
          element.y1,
          element.x2 - element.x1,
          element.y2 - element.y1,
          {
            stroke: element.color,
            strokeWidth: element.brushSize,
            roughness: 0.5,
            fill: element.fill || undefined,
          }
        );
        break;
      case "circle":
        {
          const dx = element.x2 - element.x1;
          const dy = element.y2 - element.y1;
          const radius = Math.sqrt(dx * dx + dy * dy) / 2;

          const centerX = (element.x1 + element.x2) / 2;
          const centerY = (element.y1 + element.y2) / 2;

          roughCanvas.circle(centerX, centerY, radius * 2, {
            stroke: element.color,
            strokeWidth: element.brushSize,
            roughness: 0.5,
            fill: element.fill || undefined,
          });
          break;
        }
      case "line":
        roughCanvas.line(element.x1, element.y1, element.x2, element.y2, {
          stroke: element.color,
          strokeWidth: element.brushSize,
          roughness: 0.5,
        });
        break;
      case "triangle":
        {
          const midX = (element.x1 + element.x2) / 2;
          roughCanvas.polygon(
            [
              [midX, element.y1],
              [element.x2, element.y2],
              [element.x1, element.y2]
            ],
            {
              stroke: element.color,
              strokeWidth: element.brushSize,
              roughness: 0.5,
              fill: element.fill || undefined,
            }
          );
          break;
        }
      case "diamond":
        {
          const midX = (element.x1 + element.x2) / 2;
          const midY = (element.y1 + element.y2) / 2;
          roughCanvas.polygon(
            [
              [midX, element.y1],
              [element.x2, midY],
              [midX, element.y2],
              [element.x1, midY]
            ],
            {
              stroke: element.color,
              strokeWidth: element.brushSize,
              roughness: 0.5,
              fill: element.fill || undefined,
            }
          );
          break;
        }
      case "hexagon":
        {
          const cw = (element.x2 - element.x1) / 4;
          const midY = (element.y1 + element.y2) / 2;
          roughCanvas.polygon(
            [
              [element.x1 + cw, element.y1],
              [element.x2 - cw, element.y1],
              [element.x2, midY],
              [element.x2 - cw, element.y2],
              [element.x1 + cw, element.y2],
              [element.x1, midY]
            ],
            {
              stroke: element.color,
              strokeWidth: element.brushSize,
              roughness: 0.5,
              fill: element.fill || undefined,
            }
          );
          break;
        }
      case "eraser":
        if (element.points && element.points.length > 1) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth = element.brushSize * 2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          for (let i = 1; i < element.points.length - 1; i++) {
            const xc = (element.points[i].x + element.points[i + 1].x) / 2;
            const yc = (element.points[i].y + element.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(element.points[i].x, element.points[i].y, xc, yc);
          }
          const lastPoint = element.points[element.points.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
        break;
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-50 flex flex-col">
      <div 
        className="rounded-xl shadow-md border border-gray-200 h-full overflow-hidden relative ring-1 ring-gray-900/5 transition-all"
        style={dotGridStyle}
      >
        {/* Floating Zoom Controls Overlay */}
        <div className="absolute bottom-4 left-4 flex bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-gray-200 overflow-hidden select-none z-10">
          <button 
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 text-gray-600 transition-colors border-r border-gray-200 flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            onClick={handleResetView}
            className="px-3 py-2 hover:bg-gray-100 text-gray-600 text-xs font-bold transition-colors border-r border-gray-200 flex items-center justify-center min-w-[56px]"
            title="Reset to 100%"
          >
            {Math.round(camera.zoom * 100)}%
          </button>
          <button 
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 text-gray-600 transition-colors flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className={`w-full h-full block ${tool === 'pan' || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={interceptMouseUp}
          onMouseLeave={interceptMouseLeave}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: 'none' }}
        />
        
        {/* Render Live Cursors Overlay */}
        {Object.entries(remoteCursors).map(([userId, cursor]) => {
          if (cursor.x === undefined || cursor.y === undefined) return null;
          
          // Apply camera zoom/pan offsets specifically to map world position accurately back to screen position
          const screenX = (cursor.x * camera.zoom) + camera.x;
          const screenY = (cursor.y * camera.zoom) + camera.y;

          return (
            <div 
              key={userId}
              className="absolute pointer-events-none z-50 flex items-start -translate-x-1 -translate-y-1 drop-shadow-md"
              style={{ 
                left: screenX, 
                top: screenY,
                transition: 'top 50ms linear, left 50ms linear' // smooth interpolation
              }}
            >
              <svg 
                style={{ color: cursor.color || '#4f46e5' }} 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86A.5.5 0 0 0 5.5 3.21z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <div 
                className="bg-white/95 backdrop-blur px-2 py-0.5 rounded-md shadow-sm border text-[10px] font-bold text-gray-700 ml-1 mt-3" 
                style={{ borderColor: cursor.color || '#e5e7eb' }}
              >
                {cursor.userName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Canvas;