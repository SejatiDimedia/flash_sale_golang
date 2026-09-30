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

  const getInitials = (name?: string): string => {
    if (!name) return 'OS';
    const clean = name.trim();
    if (!clean) return 'OS';
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

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

  // 2. Home Page Hero Header (Dark Graphite & Coral Theme - Clean Layout Without Illustration)
  return (
    <header className="relative w-full bg-gradient-to-b from-dark-850 to-dark-900 text-white rounded-b-[32px] border-b border-dark-700/80 shadow-lg pt-4 pb-8 px-4 select-none">
      {/* 👤 Top Greeting Row: Avatar + "Hi, {name}" + Actions */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2.5">
          <button
            onClick={user ? undefined : onOpenAuth}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-coral to-amber-500 flex items-center justify-center text-white text-xs font-black shadow-coral-sm border-2 border-dark-700 shrink-0 overflow-hidden"
            title={user ? user.name : 'Sign In'}
          >
            {user ? getInitials(user.name) : '👑'}
          </button>
          <div className="leading-tight">
            <span className="text-xs font-bold text-white block tracking-tight">
              Hi, {user?.name || 'Orely Studio'}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 block">
              {isAdmin ? 'Admin Member' : (user ? 'Verified Member' : 'Explore Tickets')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className="px-2.5 py-1 bg-dark-800 hover:bg-dark-750 text-zinc-200 rounded-full text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1 border border-dark-700"
            >
              <FiShield className="w-3 h-3 text-coral" />
              <span>Admin</span>
            </button>
          )}

          {/* 🔔 Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="w-9 h-9 rounded-full bg-dark-800 hover:bg-dark-750 text-zinc-300 hover:text-white flex items-center justify-center relative transition-colors shadow-xs border border-dark-700"
            title="Notifications"
          >
            <HiOutlineBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-coral text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-dark-900 shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Auth Button */}
          {user ? (
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full bg-dark-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors border border-dark-700"
              title="Logout"
            >
              <FiLogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 bg-coral hover:bg-coral-hover text-white text-[11px] font-bold rounded-full transition-colors shadow-coral-sm"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* 🌟 Hero Headline (Compelling, Longer, Flash Sale Themed) */}
      <div className="pt-2 pb-3">
        <h1 className="text-xl sm:text-2xl font-black text-white leading-snug tracking-tight">
          Discover Live Concerts &amp; War Your Exclusive Tickets
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed">
          Secure instant access to top live shows with fair virtual queue protection.
        </p>
      </div>

      {/* 🔍 Floating Pill Search Bar Overlapping Header Bottom (Dark Graphite & Coral Accent) */}
      <div className="relative -mb-14 px-1 z-20">
        <div className="w-full bg-dark-800 text-white rounded-full py-3.5 px-4 shadow-xl flex items-center gap-3 border border-dark-700 transition-all focus-within:border-coral focus-within:ring-1 focus-within:ring-coral">
          <FiSearch className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, concerts, & festival"
            className="w-full bg-transparent text-xs font-semibold text-white placeholder-zinc-500 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-5 h-5 rounded-full bg-dark-700 hover:bg-dark-600 text-zinc-300 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
