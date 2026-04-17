import React, { useRef, useEffect, useState } from 'react';
import rough from 'roughjs';
import { ZoomIn, ZoomOut } from 'lucide-react';

const Canvas = ({ 
  elements, 
  currentPath, 
  tool, 
  color, 
  brushSize, 
  fontSize = 18,
  startPoint,
  isDrawing,
  onMouseDown, 
  onMouseMove, 
  onMouseUp, 
  onMouseLeave,
  onTextCommit,
  onImagePlace,
  onImageUpdate,
  remoteCursors = {},
  remoteDrawings = {},
  pendingImageData = null
}) => {
  // Text tool overlay state
  const [activeText, setActiveText] = useState(null); // { screenX, screenY, worldX, worldY, value }
  const activeTextRef = useRef(null);  // mirror of activeText for use in callbacks
  const textCommittedRef = useRef(false); // guard against double-fire from blur after Enter
  const canvasRef = useRef(null);
  const roughCanvasRef = useRef(null);
  const textareaRef = useRef(null);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const imageCache = useRef({}); // Cache for preloaded images
  
  // Image interaction state
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [draggedImageId, setDraggedImageId] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null); // 'tl', 'tr', 'br', 'bl', 'edge'
  const [isDraggingImage, setIsDraggingImage] = useState(false); // Track if currently dragging image
  const dragStartPos = useRef({ x: 0, y: 0 });
  const imageStartPos = useRef({ x: 0, y: 0 }); // Track image start position for dragging
  const imageStartSize = useRef({ width: 0, height: 0 });

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

  // Preload images from elements
  useEffect(() => {
    elements.forEach((element) => {
      if (element.type === 'image' && element.src && !imageCache.current[element.src]) {
        const img = new Image();
        img.onload = () => {
          imageCache.current[element.src] = img;
        };
        img.src = element.src;
      }
    });
  }, [elements]);

  // Helper: Find which image is at a world coordinate
  const getImageAtWorldPos = (worldX, worldY) => {
    // Check from last to first (top-most images first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === 'image') {
        if (
          worldX >= el.x &&
          worldX <= el.x + el.width &&
          worldY >= el.y &&
          worldY <= el.y + el.height
        ) {
          return el;
        }
      }
    }
    return null;
  };

  // Helper: Detect if clicking on resize handle (with 8px tolerance)
  const getResizeHandle = (image, worldX, worldY) => {
    const tolerance = 8;
    const onEdge = (val, edge, tolerance) => Math.abs(val - edge) < tolerance;

    if (onEdge(worldX, image.x, tolerance) && onEdge(worldY, image.y, tolerance)) return 'tl';
    if (onEdge(worldX, image.x + image.width, tolerance) && onEdge(worldY, image.y, tolerance)) return 'tr';
    if (onEdge(worldX, image.x + image.width, tolerance) && onEdge(worldY, image.y + image.height, tolerance)) return 'br';
    if (onEdge(worldX, image.x, tolerance) && onEdge(worldY, image.y + image.height, tolerance)) return 'bl';
    
    return null;
  };

  // Commit any active text input — called directly, NOT inside a state updater
  const commitText = (value) => {
    if (textCommittedRef.current) return;
    textCommittedRef.current = true;

    const pos = activeTextRef.current;
    if (pos && value && value.trim()) {
      onTextCommit?.(value.trim(), pos.worldX, pos.worldY);
    }
    setActiveText(null);
    activeTextRef.current = null;
  };

  // NEW: Ensure textarea is focused when it appears
  useEffect(() => {
    if (activeText && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const val = textareaRef.current.value;
      textareaRef.current.setSelectionRange(val.length, val.length);
    }
  }, [activeText]);



  // Wrap the original mouse event handlers to fix coordinates and intercept panning
  const handleMouseDown = (e) => {
    // Commit any pending text first
    if (activeText) return;

    // Intercept panning (middle click, right click, or pan tool)
    if (e.button === 1 || e.button === 2 || tool === 'pan') {
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Text tool: place an input overlay, don't start a stroke
    if (tool === 'text') {
      const rect = canvas.getBoundingClientRect();
      const pos = getMousePos(canvas, e.clientX, e.clientY);
      
      // Calculate screen coordinates and clamp to ensure box stays visible
      let screenX = e.clientX - rect.left;
      let screenY = e.clientY - rect.top;
      
      // Ensure box doesn't go off right/bottom edges (box is roughly 220x150)
      const boxW = 240;
      const boxH = 160;
      
      if (screenX + boxW > rect.width) screenX = rect.width - boxW - 10;
      if (screenY + boxH > rect.height) screenY = rect.height - boxH - 10;
      
      // Ensure not negative
      screenX = Math.max(10, screenX);
      screenY = Math.max(10, screenY);

      const textState = {
        screenX,
        screenY,
        worldX: pos.x,
        worldY: pos.y,
        value: ''
      };
      textCommittedRef.current = false;
      activeTextRef.current = textState;
      setActiveText(textState);
      return;
    }

    // Image tool: place image at click location
    if (tool === 'image' && pendingImageData) {
      const pos = getMousePos(canvas, e.clientX, e.clientY);
      
      const newImage = {
        id: Date.now(),
        type: 'image',
        src: pendingImageData,
        x: pos.x,
        y: pos.y,
        width: 150,
        height: 150
      };
      
      onImagePlace?.(newImage);
      setSelectedImageId(newImage.id);
      return;
    }

    // Image interaction: only when drag tool is active
    if (tool === 'drag') {
      const pos = getMousePos(canvas, e.clientX, e.clientY);
      const clickedImage = getImageAtWorldPos(pos.x, pos.y);
      
      if (clickedImage) {
        const handle = getResizeHandle(clickedImage, pos.x, pos.y);
        
        if (handle) {
          // Start resizing
          setResizeHandle(handle);
          setDraggedImageId(clickedImage.id);
          dragStartPos.current = { x: pos.x, y: pos.y };
          imageStartSize.current = { width: clickedImage.width, height: clickedImage.height };
          setSelectedImageId(clickedImage.id);
          return;
        } else {
          // Start dragging
          setIsDraggingImage(true);
          setDraggedImageId(clickedImage.id);
          dragStartPos.current = { x: pos.x, y: pos.y };
          imageStartPos.current = { x: clickedImage.x, y: clickedImage.y };
          setSelectedImageId(clickedImage.id);
          
          
          return;
        }
      }

      // Deselect image if clicking elsewhere
      setSelectedImageId(null);
    }
    
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
    // Handle image dragging and resizing
    if (draggedImageId) {
      const draggedImage = elements.find(el => el.id === draggedImageId);
      if (!draggedImage || draggedImage.type !== 'image') return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const pos = getMousePos(canvas, e.clientX, e.clientY);
      const dx = pos.x - dragStartPos.current.x;
      const dy = pos.y - dragStartPos.current.y;

      if (resizeHandle) {
        // Resizing
        const minSize = 30;
        let newX = draggedImage.x;
        let newY = draggedImage.y;
        let newWidth = imageStartSize.current.width;
        let newHeight = imageStartSize.current.height;

        if (resizeHandle === 'tl') {
          newX = draggedImage.x + dx;
          newY = draggedImage.y + dy;
          newWidth = imageStartSize.current.width - dx;
          newHeight = imageStartSize.current.height - dy;
        } else if (resizeHandle === 'tr') {
          newY = draggedImage.y + dy;
          newWidth = imageStartSize.current.width + dx;
          newHeight = imageStartSize.current.height - dy;
        } else if (resizeHandle === 'br') {
          newWidth = imageStartSize.current.width + dx;
          newHeight = imageStartSize.current.height + dy;
        } else if (resizeHandle === 'bl') {
          newX = draggedImage.x + dx;
          newWidth = imageStartSize.current.width - dx;
          newHeight = imageStartSize.current.height + dy;
        }

        // Apply minimum size
        if (newWidth < minSize) {
          newWidth = minSize;
          if (resizeHandle === 'tl' || resizeHandle === 'bl') {
            newX = draggedImage.x + imageStartSize.current.width - minSize;
          }
        }
        if (newHeight < minSize) {
          newHeight = minSize;
          if (resizeHandle === 'tl' || resizeHandle === 'tr') {
            newY = draggedImage.y + imageStartSize.current.height - minSize;
          }
        }

        const updatedElement = { ...draggedImage, x: newX, y: newY, width: newWidth, height: newHeight };
        onImageUpdate?.(updatedElement);
      } else if (isDraggingImage) {
        // Dragging image - canvas stays fixed, only move image
        const updatedElement = { ...draggedImage, x: imageStartPos.current.x + dx, y: imageStartPos.current.y + dy };
        onImageUpdate?.(updatedElement);
      }
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
    if (draggedImageId) {
      setDraggedImageId(null);
      setResizeHandle(null);
      setIsDraggingImage(false);
      return;
    }
    onMouseUp(e);
  };

  const interceptMouseLeave = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (isDraggingImage) {
      setIsDraggingImage(false);
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

    // Draw selection box and resize handles for selected image (before restore so it moves with image in world space)
    if (selectedImageId) {
      const selectedImage = elements.find(el => el.id === selectedImageId && el.type === 'image');
      if (selectedImage) {
        const pad = 4;
        const handleSize = 6;

        // Draw selection box
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
        ctx.strokeRect(
          selectedImage.x - pad,
          selectedImage.y - pad,
          selectedImage.width + pad * 2,
          selectedImage.height + pad * 2
        );
        ctx.setLineDash([]);

        // Draw resize handles
        ctx.fillStyle = '#3b82f6';
        const handlePos = [
          { x: selectedImage.x - pad, y: selectedImage.y - pad, name: 'tl' }, // top-left
          { x: selectedImage.x + selectedImage.width + pad, y: selectedImage.y - pad, name: 'tr' }, // top-right
          { x: selectedImage.x + selectedImage.width + pad, y: selectedImage.y + selectedImage.height + pad, name: 'br' }, // bottom-right
          { x: selectedImage.x - pad, y: selectedImage.y + selectedImage.height + pad, name: 'bl' } // bottom-left
        ];

        handlePos.forEach(pos => {
          ctx.fillRect(
            pos.x - handleSize / 2 / camera.zoom,
            pos.y - handleSize / 2 / camera.zoom,
            handleSize / camera.zoom,
            handleSize / camera.zoom
          );
        });
      }
    }

    ctx.restore();
  }, [elements, currentPath, isDrawing, tool, color, brushSize, startPoint, camera, remoteDrawings, selectedImageId]);

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
      case "text":
        if (element.text) {
          ctx.globalCompositeOperation = "source-over";
          const fs = element.fontSize || 18;
          ctx.font = `500 ${fs}px Inter, ui-sans-serif, sans-serif`;
          ctx.textBaseline = "top";

          const lines = element.text.split('\n');
          const lineH = fs * 1.5;
          const pad = fs * 0.5;
          const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
          const boxW = maxW + pad * 2;
          const boxH = lines.length * lineH + pad * 2;

          // Draw subtle filled background
          const radius = fs * 0.4;
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          ctx.moveTo(element.x - pad + radius, element.y - pad);
          ctx.lineTo(element.x - pad + boxW - radius, element.y - pad);
          ctx.arcTo(element.x - pad + boxW, element.y - pad, element.x - pad + boxW, element.y - pad + radius, radius);
          ctx.lineTo(element.x - pad + boxW, element.y - pad + boxH - radius);
          ctx.arcTo(element.x - pad + boxW, element.y - pad + boxH, element.x - pad + boxW - radius, element.y - pad + boxH, radius);
          ctx.lineTo(element.x - pad + radius, element.y - pad + boxH);
          ctx.arcTo(element.x - pad, element.y - pad + boxH, element.x - pad, element.y - pad + boxH - radius, radius);
          ctx.lineTo(element.x - pad, element.y - pad + radius);
          ctx.arcTo(element.x - pad, element.y - pad, element.x - pad + radius, element.y - pad, radius);
          ctx.closePath();
          ctx.fill();

          // Draw border
          ctx.strokeStyle = element.color || '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Draw text on top
          ctx.fillStyle = element.color || '#000000';
          lines.forEach((line, i) => {
            ctx.fillText(line, element.x, element.y + i * lineH);
          });
        }
        break;
      case "image":
        if (element.src) {
          // Use cached image if available, otherwise load it
          if (!imageCache.current[element.src]) {
            const img = new Image();
            img.onload = () => {
              imageCache.current[element.src] = img;
            };
            img.src = element.src;
          }
          
          // Draw if image is cached and loaded
          const cachedImg = imageCache.current[element.src];
          if (cachedImg && cachedImg.complete) {
            ctx.drawImage(
              cachedImg,
              element.x,
              element.y,
              element.width,
              element.height
            );
          }
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
          className={`w-full h-full block ${
            tool === 'pan' || isPanning
              ? 'cursor-grab active:cursor-grabbing'
              : tool === 'text'
              ? 'cursor-text'
              : 'cursor-crosshair'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={interceptMouseUp}
          onMouseLeave={interceptMouseLeave}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: 'none' }}
        />

        {activeText ? (
          <div
            className="absolute z-[100] flex flex-col shadow-2xl pointer-events-auto animate-in fade-in zoom-in duration-200"
            style={{
              left: activeText.screenX,
              top: activeText.screenY,
              minWidth: 260,
              minHeight: 120,
              border: `1px solid ${color}44`,
              borderRadius: 16,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: `0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)`,
              transform: 'translate(-4px, -4px)' 
            }}
          >
            {/* Context Header */}
            <div
              className="flex items-center justify-between px-4 py-2 select-none border-b border-gray-100"
              style={{ background: `${color}08` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">New Text</span>
              </div>
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter italic">Enter to stamp</span>
            </div>

            {/* Editable area */}
            <div className="flex-1 flex flex-col p-1">
              <textarea
                ref={textareaRef}
                autoFocus
                value={activeText.value}
                onChange={e => {
                  const updated = { ...activeText, value: e.target.value };
                  activeTextRef.current = updated;
                  setActiveText(updated);
                }}
                onBlur={() => {
                  // Keep box open until explicit action
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    textCommittedRef.current = true;
                    setActiveText(null);
                    activeTextRef.current = null;
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText(activeText.value);
                  }
                  e.stopPropagation();
                }}
                placeholder="Start typing..."
                className="flex-1 outline-none resize-none bg-transparent px-3 py-2 w-full text-gray-800"
                style={{
                  fontSize: `${Math.max(14, (fontSize || 18) * camera.zoom)}px`,
                  fontFamily: 'Inter, ui-sans-serif, sans-serif',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  caretColor: color,
                }}
                rows={3}
              />
              
              <div className="flex justify-end gap-2 p-2 bg-white/50 border-t border-gray-100/50">
                <button 
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveText(null);
                    activeTextRef.current = null;
                  }}
                  className="px-4 py-2 rounded-xl text-gray-400 text-[11px] font-bold uppercase hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commitText(activeText.value);
                  }}
                  className="px-5 py-2 rounded-xl text-white text-[11px] font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-md"
                  style={{ backgroundColor: color }}
                >
                  Stamp
                </button>
              </div>
            </div>
          </div>
        ) : null}
        
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