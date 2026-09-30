import React from 'react';
import { FiSearch, FiShield, FiLogOut, FiUser } from 'react-icons/fi';
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
    if (!name) return 'GU';
    const clean = name.trim();
    if (!clean) return 'GU';
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <header className="relative w-full bg-dark-900 text-white p-4 pb-4 border-b border-dark-700">
      {/* Top Row: User Avatar, Name, & Actions */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-coral flex items-center justify-center text-white text-xs font-black tracking-wider shadow-coral-sm">
              {getInitials(user?.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-dark-900 rounded-full"></span>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide truncate block">
              {user ? `Hi, ${user.name}` : 'Welcome, Guest'}
            </span>
            <span className="text-xs font-bold text-white truncate block">
              {isAdmin ? 'Admin Console' : (user ? 'Verified Member' : 'Flash Sale Ticket')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Admin Switcher */}
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                isAdminView
                  ? 'bg-coral text-white shadow-coral-sm'
                  : 'bg-dark-800 text-zinc-300 hover:text-white border border-dark-700'
              }`}
            >
              <FiShield className="w-3.5 h-3.5" />
              <span>{isAdminView ? 'User' : 'Admin'}</span>
            </button>
          )}

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="w-9 h-9 rounded-full bg-dark-800 hover:bg-dark-750 text-zinc-300 hover:text-white flex items-center justify-center relative border border-dark-700 transition-colors"
            title="Notifications"
          >
            <HiOutlineBell className="w-4 h-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-coral text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-dark-900">
                {unreadCount}
              </span>
            ) : null}
          </button>

          {/* Login / Logout */}
          {user ? (
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-full bg-dark-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 flex items-center justify-center border border-dark-700 transition-colors"
              title="Logout"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral-sm transition-all flex items-center gap-1.5"
            >
              <FiUser className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input Bar (Matches Reference UI Pill) */}
      {!isAdminView && (
        <div className="relative w-full pt-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-11 pr-4 py-2.5 bg-dark-800 text-white placeholder-zinc-400 text-xs rounded-full border border-dark-700 focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral transition-all"
          />
        </div>
      )}
    </header>
  );
};
