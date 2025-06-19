import React, { useRef, useEffect } from 'react';
import rough from 'roughjs';

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
  onMouseLeave 
}) => {
  const canvasRef = useRef(null);
  const roughCanvasRef = useRef(null);

  // Helper function to get correct mouse coordinates
  const getMousePos = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    
    // Simple coordinate transformation without scaling
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Wrap the original mouse event handlers to fix coordinates
  const handleMouseDown = (e) => {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext("2d");
    roughCanvasRef.current = rough.canvas(canvas);

    // Clear and redraw all elements
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  }, [elements, currentPath, isDrawing, tool, color, brushSize, startPoint]);

  const drawElement = (element, ctx, roughCanvas) => {
    switch (element.type) {
      case "pen":
        if (element.points && element.points.length > 1) {
          const pathString = element.points.reduce((path, point, index) => {
            return index === 0
              ? `M ${point.x} ${point.y}`
              : `${path} L ${point.x} ${point.y}`;
          }, "");

          roughCanvas.path(pathString, {
            stroke: element.color,
            strokeWidth: element.brushSize,
            roughness: 0.5,
            bowing: 1,
          });
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
      case "eraser":
        if (element.points && element.points.length > 1) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth = element.brushSize * 2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          element.points.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
        break;
    }
  };

  return (
    <div className="flex-1 p-4">
      <div className="bg-white rounded-lg shadow-sm border h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
};

export default Canvas;