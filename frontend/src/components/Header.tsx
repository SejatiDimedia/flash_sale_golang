import React from 'react';
import { FiSearch, FiSliders, FiShield, FiLogOut, FiUser } from 'react-icons/fi';
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
    <header className="relative w-full rounded-b-[36px] bg-header-gradient p-5 pt-5 text-white shadow-card overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-pink-500/20 rounded-full blur-2xl pointer-events-none"></div>

      {/* User Avatar & Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/90 shadow-md flex items-center justify-center text-white text-sm font-black tracking-wider">
              {getInitials(user?.name)}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-white/75 tracking-wider uppercase block">
              {user ? `Hi, ${user.name}` : 'Welcome Guest'}
            </span>
            <span className="text-xs font-extrabold text-white">
              {isAdmin ? 'Admin Console' : (user ? 'Verified Member' : 'Flash Sale Platform')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Admin Switcher - ONLY VISIBLE IF USER HAS 'ADMIN' ROLE */}
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm ${
                isAdminView
                  ? 'bg-white text-app-purple shadow-md'
                  : 'glass-circle text-white hover:bg-white/40'
              }`}
            >
              <FiShield className="w-3.5 h-3.5" />
              <span>{isAdminView ? 'User App' : 'Admin'}</span>
            </button>
          )}

          {/* Login/Logout Button */}
          {user ? (
            <button
              onClick={onLogout}
              className="w-9 h-9 glass-circle rounded-full flex items-center justify-center text-white/90 hover:text-red-200 transition-colors shadow-sm"
              title="Logout"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 bg-white text-app-purple rounded-full text-xs font-black shadow-md hover:bg-white/90 transition-all flex items-center gap-1"
            >
              <FiUser className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          )}

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            className="w-9 h-9 glass-circle rounded-full flex items-center justify-center text-white relative shadow-sm hover:bg-white/40 transition-colors"
            title="Notifications"
          >
            <HiOutlineBell className="w-4 h-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-pink-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-purple-600 animate-pulse">
                {unreadCount}
              </span>
            ) : (
              <span className="absolute top-2 right-2 w-2 h-2 bg-pink-400/80 rounded-full ring-2 ring-purple-600"></span>
            )}
          </button>
        </div>
      </div>

      {/* Large Title */}
      <h1 className="text-2xl font-extrabold text-white leading-tight mb-4 tracking-tight drop-shadow-sm">
        {isAdminView ? 'Admin Dashboard\nCommand Center' : 'Discover Amazing\nEvents Near You'}
      </h1>

      {/* Frosted Glass Search Bar */}
      {!isAdminView && (
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, concerts..."
              className="w-full pl-11 pr-4 py-3 glass-input rounded-2xl text-xs font-semibold text-white placeholder-white/80 outline-none focus:ring-2 focus:ring-white/50 transition-all shadow-inner"
            />
          </div>
          <button className="w-11 h-11 glass-circle rounded-2xl flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm shrink-0">
            <FiSliders className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
