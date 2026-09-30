import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiTrash2, FiClock, FiBell } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'admitted' | 'order_confirmed' | 'stock_alert';
  read: boolean;
  eventId?: string;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectNotification: (notif: AppNotification) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearAll,
  onSelectNotification,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString('en-US');
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'admitted':
        return (
          <div className="w-8 h-8 rounded-xl bg-dark-750 text-coral flex items-center justify-center shrink-0">
            <IoFlash className="w-4 h-4 text-coral" />
          </div>
        );
      case 'order_confirmed':
        return (
          <div className="w-8 h-8 rounded-xl bg-dark-750 text-emerald-400 flex items-center justify-center shrink-0">
            <HiTicket className="w-4 h-4 text-emerald-400" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-dark-750 text-coral flex items-center justify-center shrink-0">
            <FiBell className="w-4 h-4 text-coral" />
          </div>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-dark-900 rounded-3xl p-5 shadow-2xl border border-dark-700 max-h-[85vh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-coral text-white rounded-full text-[10px] font-bold shadow-coral-sm">
                {unreadCount} New
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="p-2 text-zinc-400 hover:text-rose-400 rounded-full hover:bg-dark-800 transition-colors"
                title="Clear all notifications"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-dark-700"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto no-scrollbar flex-1 py-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-dark-800 text-zinc-500 flex items-center justify-center mx-auto border border-dark-700">
                <FiBell className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-white">No Notifications Yet</h4>
              <p className="text-[11px] text-zinc-400 max-w-[200px] mx-auto">
                Waiting room turn alerts and order confirmation updates will appear here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onSelectNotification(n)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative overflow-hidden ${
                  !n.read
                    ? 'bg-dark-800 border-coral/40 shadow-dark-card'
                    : 'bg-dark-800/60 border-dark-700 hover:border-dark-600'
                }`}
              >
                {!n.read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-coral"></span>
                )}
                {getIcon(n.type)}
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {n.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-medium text-zinc-500">
                    <span className="flex items-center gap-1">
                      <FiClock className="w-3 h-3 text-coral" />
                      {getTimeAgo(n.timestamp)}
                    </span>
                    {n.type === 'admitted' && (
                      <span className="text-coral font-bold">Open Checkout →</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-dark-700 flex gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-750 text-zinc-300 rounded-full text-xs font-semibold border border-dark-700 transition-colors"
            >
              Mark All as Read
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
