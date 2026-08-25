import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiMail, FiShield, FiLogOut, FiCheckCircle, FiUser, FiLock, FiKey, FiAward } from 'react-icons/fi';
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

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header Bar for Profile Page */}
      <div className="relative w-full rounded-b-[36px] bg-header-gradient p-5 pt-4 text-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 glass-circle rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold tracking-wide">Account Profile</span>
          <div className="w-9"></div> {/* Spacer */}
        </div>

        <div className="flex items-center gap-3.5 pt-1 pb-2">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/90 shadow-md flex items-center justify-center text-white text-xl font-black tracking-wider">
              {getInitials(user.name)}
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full"></span>
          </div>

          <div className="space-y-0.5 overflow-hidden">
            <h2 className="text-lg font-black text-white leading-tight truncate">
              {user.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-white/80 truncate">
              <FiMail className="w-3.5 h-3.5 text-pink-200 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/25 backdrop-blur-md text-white rounded-full text-[10px] font-black uppercase tracking-wider border border-white/30">
                <FiShield className="w-3 h-3" />
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="px-4 space-y-4">
        {/* Quick Shortcut Card to My Tickets */}
        <div
          onClick={onNavigateTickets}
          className="bg-white rounded-[24px] p-4 border border-purple-100 shadow-card flex items-center justify-between gap-3 cursor-pointer hover:border-purple-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F8F3FE] group-hover:bg-app-purple text-app-purple group-hover:text-white flex items-center justify-center transition-colors">
              <HiTicket className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800">My Tickets</h4>
              <p className="text-[10px] text-slate-400">View all purchased active concert tickets</p>
            </div>
          </div>
          <span className="text-xs font-black text-app-purple group-hover:translate-x-1 transition-transform">
            Open →
          </span>
        </div>

        {/* 📝 EDIT PROFILE FORM */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-[28px] p-5 border border-purple-100 shadow-card space-y-3.5"
        >
          <div className="flex items-center justify-between pb-2 border-b border-purple-50">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
              <FiUser className="w-4 h-4 text-app-purple" />
              <span>Profile Settings & Edit</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Role: {user.role.toUpperCase()}</span>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-200">
              {saveError}
            </div>
          )}

          {/* Edit Name */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-10 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
              />
            </div>
          </div>

          {/* Edit Email */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
              />
            </div>
          </div>

          {/* Edit Password */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              New Password <span className="text-slate-400 font-normal">(Leave blank to keep unchanged)</span>
            </label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="New password (min. 6 characters)"
                className="w-full pl-10 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 bg-purple-btn text-white rounded-full text-xs font-black shadow-btn hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security & Account Badges */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-[22px] p-3.5 border border-purple-100 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <FiAward className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black text-slate-800 block">Verified Account</span>
              <span className="text-[9px] text-slate-400 font-bold">100% Authentic</span>
            </div>
          </div>

          <div className="bg-white rounded-[22px] p-3.5 border border-purple-100 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-app-purple flex items-center justify-center shrink-0">
              <FiKey className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black text-slate-800 block">JWT Security</span>
              <span className="text-[9px] text-slate-400 font-bold">256-Bit Encrypted</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-2">
          <button
            onClick={onLogout}
            className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-red-200 shadow-sm"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Sign Out (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
