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
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <IoFlash className="w-4 h-4 text-emerald-600" />
          </div>
        );
      case 'order_confirmed':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-app-purple flex items-center justify-center shrink-0">
            <HiTicket className="w-4 h-4 text-app-purple" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-app-purple flex items-center justify-center shrink-0">
            <FiBell className="w-4 h-4 text-app-purple" />
          </div>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-[32px] p-5 shadow-2xl border-4 border-white max-h-[85vh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-purple-50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-pink-500 text-white rounded-full text-[10px] font-black">
                {unreadCount} New
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Clear all notifications"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto no-scrollbar flex-1 py-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-300 flex items-center justify-center mx-auto">
                <FiBell className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-black text-slate-800">No Notifications Yet</h4>
              <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                Updates on your waiting room queue admission and ticket booking will appear here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onSelectNotification(n)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative overflow-hidden ${
                  !n.read
                    ? 'bg-[#F8F3FE] border-purple-200 shadow-sm'
                    : 'bg-white border-purple-50 hover:border-purple-100'
                }`}
              >
                {!n.read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-pink-500"></span>
                )}
                {getIcon(n.type)}
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                      {n.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      <FiClock className="w-3 h-3 text-app-purple" />
                      {getTimeAgo(n.timestamp)}
                    </span>
                    {n.type === 'admitted' && (
                      <span className="text-app-purple font-black">Checkout Now →</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-purple-50 flex gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="flex-1 py-2.5 bg-[#F8F3FE] hover:bg-purple-100 text-app-purple rounded-xl text-xs font-bold transition-all"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-purple-btn text-white rounded-xl text-xs font-black shadow-btn hover:opacity-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
