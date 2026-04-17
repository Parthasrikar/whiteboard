import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  Eraser, 
  Pen,
  Type, 
  Circle, 
  Square, 
  Minus,
  Triangle,
  Hexagon,
  Diamond,
  ChevronUp,
  RotateCcw, 
  Download,
  Users,
  Hand,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  MessageSquare,
  Image as ImageIcon,
  Move
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
  onUploadImage,
  isUploadingImage,
  connectedUsers,
  // Voice chat props
  isVoiceChatActive,
  isMuted,
  connectedPeers,
  audioPermission,
  voiceError,
  startVoiceChat,
  stopVoiceChat,
  toggleMute,
  messages = [],
  sendMessage,
  fontSize,
  setFontSize
}) => {
  const colorPresets = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", 
    "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", 
    "#800080", "#FFC0CB", "#A52A2A", "#808080"
  ];

  // Helper function to safely render user data

  // Helper function to determine if user is current user

  const mainTools = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'image', icon: ImageIcon, label: 'Image' },
    { id: 'drag', icon: Move, label: 'Drag' },
    { id: 'pan', icon: Hand, label: 'Pan' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' }
  ];

  const shapesList = [
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'triangle', icon: Triangle, label: 'Triangle' },
    { id: 'diamond', icon: Diamond, label: 'Diamond' },
    { id: 'hexagon', icon: Hexagon, label: 'Hexagon' },
    { id: 'line', icon: Minus, label: 'Line' }
  ];

  const [showCommPanel, setShowCommPanel] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [commTab, setCommTab] = useState('chat'); // 'voice' or 'chat'
  const [chatInput, setChatInput] = useState('');
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);
  const chatScrollRef = useRef(null);

  // Track unread messages
  const unreadMessageCount = messages.length - lastReadMessageCount;
  const hasUnreadMessages = unreadMessageCount > 0 && commTab !== 'chat';

  // Auto-scroll chat
  useEffect(() => {
    if (commTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      // Mark messages as read when viewing chat
      setLastReadMessageCount(messages.length);
    }
  }, [messages, commTab]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  // Derive active shape for the icon
  const activeShapeDef = shapesList.find(s => s.id === tool) || shapesList[0];
  const ActiveShapeIcon = activeShapeDef.icon;

  return (
    <>
      {/* Top Right Communications Floating Island */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-20 pointer-events-none">
        
        {showCommPanel ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 w-80 pointer-events-auto transition-all animate-in slide-in-from-top-4 fade-in duration-200 overflow-hidden flex flex-col h-[400px]">
            {/* Header Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/50">
              <button 
                onClick={() => setCommTab('chat')} 
                className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors relative ${commTab === 'chat' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                Team Chat
                {hasUnreadMessages && commTab !== 'chat' && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
              <button 
                onClick={() => setCommTab('voice')} 
                className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${commTab === 'voice' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                Voice Call
              </button>
              <button 
                onClick={() => setShowCommPanel(false)} 
                className="px-3.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 text-[10px] font-bold transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto w-full relative">
              
              {/* CHAT TAB */}
              {commTab === 'chat' && (
                <div className="absolute inset-0 flex flex-col bg-white">
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 style-scrollbars" ref={chatScrollRef}>
                    {messages.length === 0 ? (
                      <div className="text-[11px] font-medium text-gray-400 text-center my-4 italic">Say hello to the room!</div>
                    ) : (
                      messages.map((m, i) => (
                        <div key={i} className="flex flex-col w-full max-w-[90%]">
                          <span className="text-[9px] font-bold text-gray-400 mb-0.5 ml-1.5 uppercase tracking-wide">
                            {m.userName} <span className="font-medium text-gray-300 ml-1 lowercase tracking-normal">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </span>
                          <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm leading-relaxed">
                            {m.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendChat} className="p-2 border-t border-gray-100 bg-gray-50 flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)} 
                      placeholder="Type a message..." 
                      className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium placeholder:text-gray-400" 
                    />
                    <button 
                      type="submit" 
                      disabled={!chatInput.trim()} 
                      className="bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* VOICE TAB */}
              {commTab === 'voice' && (
                <div className="p-2">
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
              )}
            </div>
          </div>
        ) : (
          <button 
             onClick={() => setShowCommPanel(true)}
             className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 p-3 pointer-events-auto flex items-center gap-3 hover:bg-gray-50 transition-colors group filter active:brightness-95 relative"
          >
             {/* Notification Badge - Outer Badge on Button */}
             {hasUnreadMessages && (
               <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-lg"></span>
             )}
             
             <div className="relative">
               <MessageSquare className="w-5 h-5 text-gray-500 group-hover:text-indigo-600 transition-colors" />
               {isVoiceChatActive && !hasUnreadMessages && (
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
               )}
               {isVoiceChatActive && hasUnreadMessages && (
                 <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
               )}
             </div>
             <div className="flex flex-col items-start leading-none gap-1">
               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-800 transition-colors">Workspace</span>
               <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded inline-block">
                 {Array.isArray(connectedUsers) ? connectedUsers.length : 0} ON LIVE
               </span>
             </div>
          </button>
        )}

      </div>
        


      {/* Bottom Center Toolbar Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
        
        {/* Settings Popover (Stroke & Color) */}
        {['pen', 'text', 'rectangle', 'circle', 'triangle', 'diamond', 'hexagon', 'line'].includes(tool) && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 p-3 mb-3 pointer-events-auto flex items-center gap-5 mx-auto w-max transition-all">
            
            {/* dynamic stroke and font size based on tool */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {tool === 'text' ? 'Font' : 'Size'}
                </span>
                <input
                  type="range"
                  min={tool === 'text' ? "12" : "1"}
                  max={tool === 'text' ? "72" : "20"}
                  value={tool === 'text' ? fontSize : brushSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (tool === 'text') setFontSize(val);
                    else setBrushSize(val);
                  }}
                  className="w-24 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {tool === 'text' ? fontSize : brushSize}px
                </span>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-200" />

            {/* palettes */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Colors</span>
              {colorPresets.slice(0, 8).map((presetColor) => (
                <button
                  key={presetColor}
                  onClick={() => setColor(presetColor)}
                  className={`w-5 h-5 rounded-full transition-all transform hover:scale-110 ${
                    color === presetColor
                      ? "ring-2 ring-offset-2 ring-indigo-500 shadow-sm"
                      : "ring-1 ring-black/10"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
              <div className="mx-1 relative rounded-full overflow-hidden w-6 h-6 border border-gray-200 hover:scale-105 transition-transform flex items-center justify-center bg-gray-50 ml-1">
                 <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute -inset-2 w-10 h-10 cursor-pointer"
                 />
                 <Palette className="w-3 h-3 text-gray-600 pointer-events-none relative z-10 mix-blend-difference" />
              </div>
            </div>

          </div>
        )}

        {/* Main Floating Dock */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 p-1.5 pointer-events-auto flex items-center gap-1.5">
          
          {/* Tools Grid */}
          <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-xl relative">
            {mainTools.map((t) => {
              const Icon = t.icon;
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTool(t.id);
                    setShowShapesMenu(false);
                    // If image tool, trigger file upload
                    if (t.id === 'image') {
                      document.getElementById('imageUploadInput')?.click();
                    }
                  }}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-500/20 scale-105' 
                      : 'bg-transparent text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                  }`}
                  title={t.label}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </button>
              );
            })}

            {/* Shapes Dropdown Toggle */}
            <div className="relative static-popover-container">
              <button
                onClick={() => setShowShapesMenu(!showShapesMenu)}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                  shapesList.some(s => s.id === tool) || showShapesMenu
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-500/20 scale-105' 
                    : 'bg-transparent text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Shapes"
              >
                <div className="relative flex items-center justify-center w-full h-full">
                  <ActiveShapeIcon className="w-5 h-5" strokeWidth={shapesList.some(s => s.id === tool) ? 2.5 : 2} />
                  <ChevronUp className={`w-2.5 h-2.5 absolute bottom-1 right-1 opacity-70 transition-transform ${showShapesMenu ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Shapes Flyout Menu */}
              {showShapesMenu && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 p-2 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-xl rounded-2xl flex flex-col gap-1 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-150 w-[140px]">
                  <div className="px-2 pb-1.5 mb-1 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                    Insert Shape
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {shapesList.map(s => {
                      const ShapeIcon = s.icon;
                      const isShapeActive = tool === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setTool(s.id); 
                            setShowShapesMenu(false); 
                          }}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                            isShapeActive ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                          }`}
                          title={s.label}
                        >
                          <ShapeIcon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="w-px h-8 bg-gray-200/80 mx-1" />

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
             <button
              onClick={undoLastAction}
              disabled={elements.length === 0}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group"
              title="Undo"
            >
              <RotateCcw className="w-4 h-4 group-hover:-rotate-45 transition-transform" />
            </button>
            <button
              onClick={clearCanvas}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-transparent text-red-500 hover:bg-red-50 transition-colors group"
              title="Clear All"
            >
              <Eraser className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={downloadCanvas}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-transparent text-indigo-500 hover:bg-indigo-50 transition-colors group"
              title="Export Canvas"
            >
              <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
            
            {/* Image Upload Loader */}
            {isUploadingImage && (
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 text-indigo-500">
                <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}
            
            <input
              id="imageUploadInput"
              type="file"
              accept="image/*"
              disabled={isUploadingImage}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    if (event.target?.result) {
                      onUploadImage?.(event.target.result);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
            />
          </div>

          <div className="w-px h-8 bg-gray-200/80 mx-1" />

          {/* Mini Voice Chat Controls */}
          <div className="flex items-center gap-1">
             {isVoiceChatActive ? (
               <>
                 <button
                   onClick={toggleMute}
                   className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                     isMuted ? 'bg-red-50 text-red-500 hover:bg-red-100 shadow-sm' : 'bg-green-50 text-green-600 hover:bg-green-100 shadow-sm'
                   }`}
                   title="Toggle Mute"
                 >
                   {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                 </button>
                 <button
                   onClick={stopVoiceChat}
                   className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                   title="Disconnect"
                 >
                   <PhoneOff className="w-4 h-4" />
                 </button>
               </>
             ) : (
                <button
                   onClick={startVoiceChat}
                   className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
                   title="Join Voice"
                 >
                   <Phone className="w-4 h-4" />
                 </button>
             )}
             
             {/* Chat Trigger Option */}
             <button
               onClick={() => { setShowCommPanel(true); setCommTab('chat'); }}
               className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors relative ml-1"
               title="Open Chat"
             >
               <MessageSquare className="w-4 h-4" />
             </button>
          </div>

        </div>

      </div>
    </>
  );
};

export default Toolbar;