import React from 'react';
import { FiSearch, FiShield, FiLogOut } from 'react-icons/fi';
import { HiOutlineBell } from 'react-icons/hi2';
import type { User } from '../lib/api';

interface HeaderProps {
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isAdminView: boolean;
  onToggleAdmin: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenAuth,
  onLogout,
  isAdminView,
  onToggleAdmin,
  searchQuery,
  setSearchQuery,
  onOpenNotifications,
  unreadCount = 0,
}) => {
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  // 1. Sleek Admin Console View Header
  if (isAdminView) {
    return (
      <header className="relative w-full bg-dark-900 text-white p-4 pb-4 border-b border-dark-700">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-coral flex items-center justify-center text-white text-xs font-black shadow-coral-sm">
              AD
            </div>
            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide block">
                Control Center
              </span>
              <span className="text-xs font-bold text-white block">
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleAdmin}
              className="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-white rounded-full text-xs font-bold border border-dark-700 transition-colors flex items-center gap-1.5"
            >
              <FiShield className="w-3.5 h-3.5 text-coral" />
              <span>Back to User Mode</span>
            </button>
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-full bg-dark-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 flex items-center justify-center border border-dark-700 transition-colors"
              title="Logout"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  // 2. Home Page Hero Header (Matching Screenshot Layout)
  return (
    <header className="relative w-full bg-gradient-to-b from-[#C6ED6F] via-[#A8E443] to-[#8FD42E] text-slate-900 rounded-b-[36px] shadow-lg pt-2 pb-8 px-4 select-none">
      {/* 📱 Mobile Top Status Bar Indicator (9:41, Cellular, WiFi, Battery) */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-900/90 pt-1 pb-2 px-1">
        <span className="tracking-tight font-extrabold text-[13px]">9:41</span>
        <div className="flex items-center gap-1.5 text-slate-900">
          {/* Signal bars */}
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
            <path d="M1 11h2v3H1zm4-3h2v6H5zm4-3h2v9H9zm4-3h2v12h-2z" />
          </svg>
          {/* WiFi icon */}
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
            <path d="M8 12a2 2 0 100 4 2 2 0 000-4zm4.24-2.83a6 6 0 00-8.48 0l1.41 1.41a4 4 0 015.66 0l1.41-1.41zm2.83-2.83a10 10 0 00-14.14 0l1.41 1.41a8 8 0 0111.32 0l1.41-1.41z" />
          </svg>
          {/* Battery icon */}
          <div className="w-5 h-2.5 border border-slate-900 rounded-xs p-0.5 flex items-center">
            <div className="h-full w-3 bg-slate-900 rounded-2xs"></div>
          </div>
        </div>
      </div>

      {/* 👤 Top Greeting Row: Avatar + "Hi, Orely Studio" + Bell Action */}
      <div className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={user ? undefined : onOpenAuth}
            className="w-10 h-10 rounded-full bg-[#FDE047] border-2 border-white/80 flex items-center justify-center text-lg shadow-sm shrink-0 overflow-hidden"
            title={user ? user.name : 'Sign In'}
          >
            <span className="text-lg select-none">👑</span>
          </button>
          <div className="leading-tight">
            <span className="text-xs font-bold text-slate-900 block tracking-tight">
              Hi, {user?.name || 'Orely Studio'}
            </span>
            <span className="text-[10px] font-semibold text-slate-800/80 block">
              {isAdmin ? 'Admin Member' : (user ? 'Verified Member' : 'Explore Tickets')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className="px-2.5 py-1 bg-white/70 hover:bg-white text-slate-900 rounded-full text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1 border border-black/10"
            >
              <FiShield className="w-3 h-3" />
              <span>Admin</span>
            </button>
          )}

          {/* 🔔 Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="w-9 h-9 rounded-full bg-white/50 hover:bg-white/80 text-slate-900 flex items-center justify-center relative transition-colors shadow-xs"
            title="Notifications"
          >
            <HiOutlineBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-coral text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Auth Button */}
          {user ? (
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full bg-white/40 hover:bg-rose-500/20 text-slate-800 hover:text-rose-700 flex items-center justify-center transition-colors"
              title="Logout"
            >
              <FiLogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-full transition-colors shadow-xs"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* 🌟 Hero Headline + Stage Singer Spotlight Illustration */}
      <div className="flex items-center justify-between pt-3 pb-3 relative">
        <div className="z-10 pl-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-[1.12] tracking-tight">
            Find events
            <br />
            near you
          </h1>
        </div>

        {/* 🎤 Custom SVG Stage Performer in Spotlight */}
        <div className="relative w-36 h-36 shrink-0 -my-2 -mr-2 pointer-events-none">
          <svg viewBox="0 0 160 160" className="w-full h-full">
            <defs>
              <linearGradient id="spotlightGlow" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="leafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3F7A18" />
                <stop offset="100%" stopColor="#2D5811" />
              </linearGradient>
              <linearGradient id="leafGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6DAF2B" />
                <stop offset="100%" stopColor="#4A801B" />
              </linearGradient>
            </defs>

            {/* Spotlight Beam Cone from Top to Performer */}
            <polygon points="80,0 20,160 145,160" fill="url(#spotlightGlow)" />

            {/* Stage Foliage & Green Leaves at Bottom */}
            <ellipse cx="145" cy="148" rx="26" ry="18" fill="url(#leafGrad1)" />
            <ellipse cx="125" cy="154" rx="24" ry="16" fill="url(#leafGrad2)" />
            <ellipse cx="65" cy="156" rx="20" ry="12" fill="url(#leafGrad1)" />
            <ellipse cx="90" cy="157" rx="22" ry="14" fill="url(#leafGrad2)" />
            <path d="M140,150 Q150,110 156,95" stroke="#3F7A18" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M142,125 Q152,120 156,122" stroke="#3F7A18" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M140,140 Q150,136 155,138" stroke="#3F7A18" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Singer Pants (Lilac / Lavender) */}
            <path d="M72,110 L68,146 L76,146 L80,114 Z" fill="#9384D1" />
            <path d="M80,114 L84,146 L93,146 L87,110 Z" fill="#7C6AC4" />

            {/* Singer Top & Yellow Jacket */}
            <path d="M74,80 L86,80 L84,112 L74,112 Z" fill="#F8FAFC" />
            <path d="M68,76 C68,76 74,73 80,73 C86,73 92,76 92,76 L94,106 C90,108 84,108 80,108 C76,108 70,108 66,106 Z" fill="#F59E0B" />
            <path d="M76,74 L73,95 L80,104 L87,95 L84,74 Z" fill="#FEF08A" />

            {/* Left Arm extended expressively */}
            <path d="M90,78 Q112,78 126,68" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="126" cy="68" r="4.5" fill="#D97706" />

            {/* Right Arm holding microphone */}
            <path d="M70,80 Q56,76 54,64" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="54" cy="64" r="4" fill="#D97706" />

            {/* Microphone */}
            <line x1="50" y1="72" x2="57" y2="58" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
            <circle cx="58" cy="56" r="4" fill="#4B5563" />

            {/* Head & Neck */}
            <rect x="76" y="66" width="8" height="9" fill="#D97706" rx="2" />
            <ellipse cx="80" cy="59" rx="9" ry="10" fill="#D97706" />

            {/* Dark Hair & Pink Headband */}
            <path d="M71,58 C70,44 89,44 89,58 C90,66 88,72 87,76 C85,73 83,72 83,68 C77,68 73,74 71,58 Z" fill="#18181B" />
            <path d="M72,55 Q80,52 88,55" stroke="#F43F5E" strokeWidth="3.5" strokeLinecap="round" fill="none" />

            {/* Small Musical Sparkles / Stars */}
            <circle cx="48" cy="46" r="1.5" fill="#18181B" opacity="0.6" />
            <path d="M42,40 Q44,43 47,43 Q44,44 42,47 Q41,44 38,43 Q41,43 42,40 Z" fill="#FEF08A" />
            <path d="M120,44 Q122,46 124,46 Q122,47 120,49 Q119,47 117,46 Q119,46 120,44 Z" fill="#FFFFFF" opacity="0.8" />
          </svg>
        </div>
      </div>

      {/* 🔍 Floating Pill Search Bar Overlapping Header Bottom */}
      <div className="relative -mb-14 px-1 z-20">
        <div className="w-full bg-white text-slate-900 rounded-full py-3.5 px-4 shadow-xl flex items-center gap-3 border border-slate-100 transition-all focus-within:ring-2 focus-within:ring-slate-900/10">
          <FiSearch className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, concerts, & festival"
            className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
