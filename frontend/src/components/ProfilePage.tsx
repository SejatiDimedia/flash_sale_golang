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
      <div className="w-full bg-slate-900 p-4 border-b border-slate-800 text-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Kembali"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold tracking-wide uppercase text-slate-400">Profil Pengguna</span>
          <div className="w-8"></div>
        </div>

        <div className="flex items-center gap-3.5 pt-1 pb-1">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 border border-indigo-500 shadow-sm flex items-center justify-center text-white text-lg font-bold tracking-wider">
              {getInitials(user.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
          </div>

          <div className="space-y-0.5 overflow-hidden">
            <h2 className="text-base font-bold text-white leading-tight truncate">
              {user.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <FiMail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-700">
                <FiShield className="w-3 h-3 text-indigo-400" />
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
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-400 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
              <HiTicket className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Tiket Saya</h4>
              <p className="text-[11px] text-slate-500">Lihat semua tiket konser dan riwayat pemesanan</p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
            Buka →
          </span>
        </div>

        {/* 📝 EDIT PROFILE FORM */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3.5"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <FiUser className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Profil</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">Hak Akses: {user.role.toUpperCase()}</span>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium border border-emerald-200 flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium border border-rose-200">
              {saveError}
            </div>
          )}

          {/* Edit Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Nama Lengkap
            </label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Edit Email */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="nama@example.com"
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Edit Password */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Password Baru <span className="text-slate-400 font-normal">(Kosongkan bila tidak diubah)</span>
            </label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Password baru (min. 6 karakter)"
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="w-4 h-4" />
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security & Account Badges */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FiAward className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">Akun Terverifikasi</span>
              <span className="text-[10px] text-slate-500">Sesi Login Aktif</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FiKey className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">Keamanan JWT</span>
              <span className="text-[10px] text-slate-500">Bearer Token Valid</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-1">
          <button
            onClick={onLogout}
            className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-rose-200"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Keluar Akun (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
