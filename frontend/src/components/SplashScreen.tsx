import React, { useEffect, useState } from 'react';
import { IoFlash } from 'react-icons/io5';
import { FiShield, FiArrowRight } from 'react-icons/fi';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  minDuration = 2100,
}) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Finding the hottest live concerts...');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion (Antislop-human accessibility)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.round((elapsed / minDuration) * 100));
      setProgress(currentProgress);

      if (currentProgress < 35) {
        setStatusText('Finding the hottest live concerts...');
      } else if (currentProgress < 75) {
        setStatusText('Loading upcoming shows and festivals...');
      } else if (currentProgress < 100) {
        setStatusText('Preparing your tickets • Ready');
      } else {
        clearInterval(interval);
        setIsExiting(true);
        setTimeout(() => {
          onComplete();
        }, 350);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [minDuration, onComplete]);

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 200);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[999999] flex justify-center items-center select-none transition-all duration-300 pointer-events-auto ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="dialog"
      aria-label="Application Loading Screen"
    >
      {/* Dimmed desktop backdrop to emphasize mobile view */}
      <div className="absolute inset-0 bg-dark-950/70 backdrop-blur-xs"></div>

      {/* 📱 Mobile View Container (Strictly max-w-md matching app shell) */}
      <div
        className={`relative w-full max-w-md h-full min-h-screen bg-[#0A0A0D] border-x border-dark-700/80 shadow-2xl flex flex-col justify-between items-center px-6 py-10 overflow-hidden transition-all duration-300 ${
          isExiting ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* 🌌 Ambient Coral Radial Glow (Crafted with subtle restraint, no slop) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-coral/15 rounded-full blur-[90px] animate-pulse"></div>
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] bg-coral/10 rounded-full blur-[50px]"></div>
        </div>

        {/* Top Header: Trust Guarantee Pill */}
        <div className="relative z-10 w-full flex items-center justify-between animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-dark-800/80 backdrop-blur-md text-zinc-300 rounded-full text-[10px] font-bold border border-dark-700/80">
            <FiShield className="w-3 h-3 text-emerald-400" />
            <span>Official Ticket Partner</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className="px-3 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white bg-dark-800/60 hover:bg-dark-750 border border-dark-700/70 rounded-full transition-colors flex items-center gap-1"
            title="Skip intro"
          >
            <span>Skip</span>
            <FiArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Center Brand Identity: Official Circular Badge + Kinetic Typography */}
        <div className="relative z-10 flex flex-col items-center text-center my-auto space-y-6 max-w-xs">
          {/* Logo Container with Breathing Halo Ring */}
          <div className="relative group cursor-pointer">
            {/* Subtle outer breathing ring */}
            <div className="absolute -inset-2.5 rounded-full bg-gradient-to-tr from-coral/40 via-amber-500/20 to-coral/0 blur-md opacity-80 animate-spin" style={{ animationDuration: '6s' }}></div>
            
            <div className="relative w-28 h-28 rounded-full bg-dark-900 border-2 border-dark-700/90 shadow-2xl p-2.5 flex items-center justify-center transition-transform active:scale-95 duration-200">
              <img
                src="/logo.png"
                alt="Flash Sale Logo"
                className="w-full h-full object-contain rounded-full drop-shadow-md"
              />
            </div>
          </div>

          {/* Brand Headline & Punchy Value Prop */}
          <div className="space-y-1.5 animate-fadeIn">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-coral/10 border border-coral/25 text-coral text-[10px] font-black tracking-widest uppercase">
              <IoFlash className="w-3 h-3 text-coral" />
              <span>Live Concerts &amp; Events</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none uppercase">
              Flash Sale
            </h1>

            <p className="text-xs font-semibold text-zinc-400 tracking-wide">
              War Your Exclusive Tickets
            </p>
          </div>

          {/* Micro Loader Bar & Real-Time Status String */}
          <div className="w-64 space-y-2 pt-2">
            {/* 3px Precision Progress Bar */}
            <div className="w-full h-1.5 bg-dark-800 rounded-full overflow-hidden border border-dark-700/60 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-coral to-amber-500 rounded-full transition-all duration-150 ease-out shadow-coral-sm"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium px-0.5">
              <span className="flex items-center gap-1.5 truncate text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-coral animate-ping shrink-0"></span>
                <span className="truncate">{statusText}</span>
              </span>
              <span className="font-mono text-zinc-400 font-bold ml-2">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer Info: Clean Consumer Ticketing Guarantee */}
        <div className="relative z-10 w-full text-center space-y-1">
          <p className="text-[10px] font-semibold text-zinc-400">
            100% Official Tickets • Guaranteed Seats
          </p>
          <span className="text-[9px] text-zinc-500 tracking-wider block font-medium">
            Live Concert &amp; Entertainment Platform
          </span>
        </div>
      </div>
    </div>
  );
};
