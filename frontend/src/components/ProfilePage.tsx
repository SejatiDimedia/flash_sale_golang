import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiMail, FiShield, FiLogOut, FiCheckCircle, FiUser, FiLock, FiHelpCircle } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { CgSpinner } from 'react-icons/cg';
import { api, type User } from '../lib/api';

interface ProfilePageProps {
  user: User | null;
  onBack: () => void;
  onLogout: () => void;
  onNavigateTickets: () => void;
  onUpdateUser: (user: User) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onBack,
  onLogout,
  onNavigateTickets,
  onUpdateUser,
}) => {
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPassword, setEditPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
    }
  }, [user]);

  if (!user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const updatedUser = await api.updateProfile(editName, editEmail, editPassword || undefined);
      onUpdateUser(updatedUser);
      setSaveSuccess('Profile information updated successfully!');
      setEditPassword('');
      setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

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

  const isAdmin = user.role?.toLowerCase() === 'admin';

  return (
    <div className="space-y-4 animate-fadeIn pb-6">
      {/* Top Header Bar for Profile Page */}
      <div className="w-full bg-dark-900 p-4 border-b border-dark-700 text-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-dark-800 hover:bg-dark-750 flex items-center justify-center text-zinc-300 hover:text-white transition-colors border border-dark-700"
            title="Back"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold tracking-wide uppercase text-zinc-400">Profile &amp; Settings</span>
          <div className="w-9"></div>
        </div>

        <div className="flex items-center gap-3.5 pt-1 pb-1">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-coral flex items-center justify-center text-white text-base font-black tracking-wider shadow-coral-sm">
              {getInitials(user.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-dark-900 rounded-full"></span>
          </div>

          <div className="space-y-0.5 overflow-hidden">
            <h2 className="text-base font-bold text-white leading-tight truncate">
              {user.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
              <FiMail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            {/* Show badge only if Admin staff */}
            {isAdmin && (
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-coral/10 text-coral rounded-full text-[10px] font-bold uppercase tracking-wider border border-coral/20">
                  <FiShield className="w-3 h-3 text-coral" />
                  Admin Console Access
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="px-4 space-y-4">
        {/* Quick Shortcut Card to My Tickets */}
        <div
          onClick={onNavigateTickets}
          className="bg-dark-800 rounded-3xl p-4 border border-dark-700 shadow-dark-card flex items-center justify-between gap-3 cursor-pointer hover:border-dark-600 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-dark-750 text-coral group-hover:bg-coral group-hover:text-white flex items-center justify-center transition-colors">
              <HiTicket className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">My Tickets</h4>
              <p className="text-[11px] text-zinc-400">View purchased tickets and order history</p>
            </div>
          </div>
          <span className="text-xs font-bold text-coral group-hover:translate-x-1 transition-transform">
            View →
          </span>
        </div>

        {/* 📝 PERSONAL INFORMATION FORM */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-dark-800 rounded-3xl p-5 border border-dark-700 shadow-dark-card space-y-3.5"
        >
          <div className="flex items-center justify-between pb-2 border-b border-dark-700">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <FiUser className="w-4 h-4 text-coral" />
              <span>Personal Information</span>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-950/60 text-emerald-300 rounded-2xl text-xs font-medium border border-emerald-500/40 flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-950/60 text-rose-300 rounded-2xl text-xs font-medium border border-rose-500/40">
              {saveError}
            </div>
          )}

          {/* Edit Name */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
              Full Name
            </label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-10 pr-3 py-2.5 bg-dark-750 border border-dark-700 rounded-xl text-xs font-medium text-white placeholder-zinc-500 outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Edit Email */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3 py-2.5 bg-dark-750 border border-dark-700 rounded-xl text-xs font-medium text-white placeholder-zinc-500 outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Edit Password */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
              New Password <span className="text-zinc-500 font-normal">(Leave blank to keep unchanged)</span>
            </label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="New password (min. 6 characters)"
                className="w-full pl-10 pr-3 py-2.5 bg-dark-750 border border-dark-700 rounded-xl text-xs font-medium text-white placeholder-zinc-500 outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ❓ Help Center & FAQ (Helpful for Real Users) */}
        <div className="bg-dark-800 rounded-3xl p-4 border border-dark-700 shadow-dark-card space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <FiHelpCircle className="w-4 h-4 text-coral" />
            <span>Help Center &amp; Flash Sale FAQ</span>
          </div>
          <div className="space-y-2 text-[11px] text-zinc-400">
            <div className="p-3 bg-dark-750/70 rounded-2xl border border-dark-700/60">
              <p className="font-bold text-white mb-0.5">How does the Virtual Waiting Room work?</p>
              <p className="text-[10px] leading-relaxed text-zinc-400">During flash sales, fans join a fair live waiting room. You will automatically proceed to express checkout when it's your turn.</p>
            </div>
            <div className="p-3 bg-dark-750/70 rounded-2xl border border-dark-700/60">
              <p className="font-bold text-white mb-0.5">How do I enter the venue?</p>
              <p className="text-[10px] leading-relaxed text-zinc-400">Simply open "My Tickets" from the bottom menu and present your digital QR code at the entrance gate scanner.</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-1">
          <button
            onClick={onLogout}
            className="w-full py-3 bg-dark-800 hover:bg-rose-950/40 text-rose-400 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 border border-dark-700"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
