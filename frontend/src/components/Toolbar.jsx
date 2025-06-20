import React from 'react';
import { 
  Palette, 
  Eraser, 
  Pen, 
  Circle, 
  Square, 
  Minus, 
  RotateCcw, 
  Download,
  Users 
} from 'lucide-react';
import VoiceChat from './VoiceChat';

const Toolbar = ({
  tool,
  setTool,
  color,
  setColor,
  brushSize,
  setBrushSize,
  elements,
  undoLastAction,
  clearCanvas,
  downloadCanvas,
  connectedUsers,
  // Voice chat props
  isVoiceChatActive,
  isMuted,
  connectedPeers,
  audioPermission,
  voiceError,
  startVoiceChat,
  stopVoiceChat,
  toggleMute
}) => {
  const colorPresets = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", 
    "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", 
    "#800080", "#FFC0CB", "#A52A2A", "#808080"
  ];

  // Helper function to safely render user data
  const renderUserName = (user, index) => {
    // Handle different user data formats
    if (typeof user === 'string') {
      return user;
    }
    if (typeof user === 'object' && user !== null) {
      return user.name || user.userName || user.id || `User ${index + 1}`;
    }
    return `User ${index + 1}`;
  };

  // Helper function to determine if user is current user
  const isCurrentUser = (user) => {
    if (typeof user === 'string') {
      return user === "You";
    }
    if (typeof user === 'object' && user !== null) {
      return user.isOwner || user.name === "You" || user.userName === "You";
    }
    return false;
  };

  return (
    <div className="bg-white border-r min-w-[280px] max-w-[320px] h-full flex flex-col">
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Drawing Tools */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Drawing Tools
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTool("pen")}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  tool === "pen"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Pen className="w-5 h-5" />
              </button>

              <button
                onClick={() => setTool("eraser")}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  tool === "eraser"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Eraser className="w-5 h-5" />
              </button>

              <button
                onClick={() => setTool("rectangle")}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  tool === "rectangle"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Square className="w-5 h-5" />
              </button>

              <button
                onClick={() => setTool("circle")}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  tool === "circle"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Circle className="w-5 h-5" />
              </button>

              <button
                onClick={() => setTool("line")}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all col-span-2 ${
                  tool === "line"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Color</h3>
            <div className="flex items-center space-x-2 mb-3">
              <Palette className="w-4 h-4 text-gray-600" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-xs text-gray-600 font-mono">{color}</span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {colorPresets.map((presetColor) => (
                <button
                  key={presetColor}
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded border-2 ${
                    color === presetColor
                      ? "border-gray-800"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          </div>

          {/* Brush Size */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Brush Size
            </h3>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>1px</span>
              <span className="font-medium">{brushSize}px</span>
              <span>20px</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t">
            <button
              onClick={undoLastAction}
              disabled={elements.length === 0}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm font-medium">Undo</span>
            </button>

            <button
              onClick={clearCanvas}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              <Eraser className="w-4 h-4" />
              <span className="text-sm font-medium">Clear All</span>
            </button>

            <button
              onClick={downloadCanvas}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Download</span>
            </button>
          </div>

          {/* Voice Chat Section - Integrated */}
          <div className="pt-4 border-t">
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

          {/* Connected Users */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Connected Users ({Array.isArray(connectedUsers) ? connectedUsers.length : 0})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Array.isArray(connectedUsers) && connectedUsers.length > 0 ? (
                connectedUsers.map((user, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isCurrentUser(user) ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <span className="text-sm text-gray-600">
                      {renderUserName(user, index)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No users connected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;