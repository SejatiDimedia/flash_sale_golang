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
    <header className="relative w-full bg-slate-900 text-white p-4 pb-5 border-b border-slate-800 shadow-sm">
      {/* Top Row: User Avatar, Name, & Actions */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 border border-indigo-400/30 flex items-center justify-center text-white text-sm font-bold tracking-wider shadow-sm">
              {getInitials(user?.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate block">
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
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                isAdminView
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <FiShield className="w-3.5 h-3.5" />
              <span>{isAdminView ? 'User' : 'Admin'}</span>
            </button>
          )}

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center relative border border-slate-700 transition-colors"
            title="Notifications"
          >
            <HiOutlineBell className="w-4 h-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-slate-900">
                {unreadCount}
              </span>
            ) : null}
          </button>

          {/* Login / Logout */}
          {user ? (
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 flex items-center justify-center border border-slate-700 transition-colors"
              title="Logout"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
            >
              <FiUser className="w-3.5 h-3.5" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* Title & Tagline */}
      {!isAdminView && (
        <div className="space-y-0.5 mb-3">
          <h1 className="text-lg font-black text-white tracking-tight">
            Flash Sale & Live Events
          </h1>
          <p className="text-[11px] text-slate-400">
            Antrean adil dan pencegahan overselling instan.
          </p>
        </div>
      )}

      {/* Search Input Bar */}
      {!isAdminView && (
        <div className="relative w-full">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari event konser, festival..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/90 text-white placeholder-slate-400 text-xs rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      )}
    </header>
  );
};
