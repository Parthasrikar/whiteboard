import React from 'react';
import { Copy, LogOut, PenTool } from 'lucide-react';

const Header = ({ currentRoom, copyRoomCode, handleLeaveRoom }) => {
  return (
    <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-3 pointer-events-none">
      
      {/* Brand Island */}
      <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 px-4 py-2 pointer-events-auto">
        <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-sm ring-1 ring-white/20">
          <PenTool className="w-4 h-4" />
        </div>
        <div className="flex flex-col pr-2">
          <h1 className="text-sm font-extrabold text-gray-900 leading-none mb-0.5 tracking-tight">Workspace</h1>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Editor</span>
        </div>
      </div>

      {/* Room Controls Island */}
      <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 px-2 py-1.5 pointer-events-auto">
        
        <div className="flex bg-gray-50 rounded-xl px-3 py-1.5 items-center gap-2 border border-gray-100">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pin</span>
          <code className="font-mono text-sm font-bold text-indigo-600">{currentRoom}</code>
        </div>
        
        <button
          onClick={copyRoomCode}
          className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition-colors group"
          title="Copy room PIN"
        >
          <Copy className="w-4 h-4 group-active:scale-95 transition-transform" />
        </button>
        
        <div className="w-px h-6 bg-gray-200/80 mx-1" />
        
        <button
          onClick={handleLeaveRoom}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Leave</span>
        </button>

      </div>
    </div>
  );
};

export default Header;