import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiLock, FiMail, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';
import { api, type User } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // Default role is always Customer ('user')
        const res = await api.register(name, email, password, 'user');
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
      <div className="relative w-full max-w-sm bg-dark-900 rounded-3xl p-6 shadow-2xl border border-dark-700">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-dark-700"
        >
          <FiX className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto mb-2.5 border border-dark-700 shadow-sm overflow-hidden p-1">
            <img src="/logo.png" alt="Flash Sale" className="w-full h-full object-contain rounded-xl" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {isLogin ? 'Sign In to Account' : 'Create New Account'}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isLogin ? 'Sign in to join live flash sales and war tickets' : 'Create an account to join flash sales and secure tickets'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full pl-10 pr-3 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-coral transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Email Address</label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-coral transition-colors"
              />
              {/* 👁️ Show / Hide Password Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-zinc-500 hover:text-white transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full font-bold text-xs text-white bg-coral hover:bg-coral-hover active:bg-coral-active shadow-coral transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
            className="text-xs font-semibold text-coral hover:text-coral-hover transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up here" : "Already have an account? Sign in here"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
