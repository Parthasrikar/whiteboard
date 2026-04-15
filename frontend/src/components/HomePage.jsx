import React from 'react';
import { Users, PenTool, Sparkles, ArrowRight, LogIn } from 'lucide-react';

const HomePage = ({ 
  userName, 
  setUserName, 
  roomCode, 
  setRoomCode, 
  handleCreateRoom, 
  handleJoinRoom 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Dot Grid & Ambient Effects */}
      <div 
        className="absolute inset-0 z-0 opacity-40 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full mix-blend-multiply pointer-events-none z-0" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-3xl rounded-[2rem] border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
        
        {/* Header Hero */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-gray-100/50 bg-gradient-to-b from-white/50 to-transparent">
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg ring-1 ring-white/20">
              <PenTool className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Workspace</h1>
          <p className="text-sm text-gray-500 font-medium pb-2">Infinite collaboration start here.</p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              Your Alias
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
            />
          </div>

          <div className="h-px w-full bg-gray-100" />

          {/* Action Grid */}
          <div className="flex flex-col gap-4">
            <button
              onClick={handleCreateRoom}
              className="w-full flex items-center justify-between px-5 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-semibold shadow-md hover:shadow-xl hover:-translate-y-0.5 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-indigo-300" />
                </div>
                <span>Create New Room</span>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </button>

            <div className="flex items-center gap-3 w-full opacity-60">
              <div className="h-px w-full bg-gray-300"></div>
              <span className="text-xs font-bold text-gray-400 uppercase">OR</span>
              <div className="h-px w-full bg-gray-300"></div>
            </div>

            <div className="flex gap-2.5">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="ROOM PIN"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all text-center uppercase tracking-widest font-bold placeholder:font-medium placeholder:tracking-normal placeholder:text-gray-400"
                maxLength={6}
              />
              <button
                onClick={handleJoinRoom}
                className="flex items-center justify-center px-6 py-3.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all font-semibold whitespace-nowrap"
              >
                Join Space
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HomePage;