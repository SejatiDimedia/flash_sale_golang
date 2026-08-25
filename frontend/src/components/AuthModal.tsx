import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiLock, FiMail, FiUser, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import { IoSparkles } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api, type User } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('Admin Flash Sale');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [role, setRole] = useState<'user' | 'admin'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        try {
          const res = await api.login(email, password);
          onSuccess(res.user, res.token);
          onClose();
        } catch (loginErr: any) {
          // If admin@example.com doesn't exist yet in DB, auto-register as admin for convenience
          if (email === 'admin@example.com' && password === 'admin123') {
            try {
              const regRes = await api.register('Administrator', 'admin@example.com', 'admin123', 'admin');
              onSuccess(regRes.user, regRes.token);
              onClose();
              return;
            } catch (regErr) {
              throw loginErr;
            }
          }
          throw loginErr;
        }
      } else {
        const res = await api.register(name, email, password, role);
        onSuccess(res.user, res.token);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-[36px] p-6 shadow-2xl border-4 border-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-header-gradient flex items-center justify-center mx-auto mb-2 text-white shadow-btn">
            <IoSparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">
            {isLogin ? 'Sign In to Account' : 'Create New Account'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isLogin ? 'Use your admin or customer account to log in' : 'Register a new account to join flash sales'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-3 py-3 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-semibold focus:border-app-purple outline-none"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all border ${
                      role === 'user'
                        ? 'bg-app-purple text-white border-app-purple shadow-sm'
                        : 'bg-[#F8F3FE] text-slate-600 border-purple-100'
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1 ${
                      role === 'admin'
                        ? 'bg-app-purple text-white border-app-purple shadow-sm'
                        : 'bg-[#F8F3FE] text-slate-600 border-purple-100'
                    }`}
                  >
                    <FiShield className="w-3.5 h-3.5" />
                    Admin
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3 py-3 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-semibold focus:border-app-purple outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-semibold focus:border-app-purple outline-none"
              />
              {/* 👁️ Show / Hide Password Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-app-purple transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-full font-black text-xs text-white bg-purple-btn hover:opacity-95 shadow-btn transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <CgSpinner className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              'Sign In Now'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-xs font-bold text-app-purple hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up here" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
