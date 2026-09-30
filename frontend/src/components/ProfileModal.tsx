import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiMail, FiShield, FiLogOut, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { CgSpinner } from 'react-icons/cg';
import { api, type User, type Order, type Event } from '../lib/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onLogout: () => void;
  events: Event[];
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
  events,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchMyOrders();
    }
  }, [isOpen, user]);

  const fetchMyOrders = async () => {
    setIsLoading(true);
    try {
      const data = await api.getMyOrders();
      setOrders(data);
    } catch (e) {
      console.error('Failed to fetch user orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const getEventName = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    return found ? found.name : 'Coldplay Concert Flash Sale';
  };

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-[36px] shadow-2xl border-4 border-white overflow-hidden max-h-[90vh] flex flex-col justify-between">
        <div className="overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FiUser className="w-4 h-4 text-app-purple" />
              <span>User Profile</span>
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          {/* User Info Card */}
          <div className="bg-[#F8F3FE] rounded-[28px] p-4 border border-purple-100 flex items-center gap-3.5">
            <div className="relative shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140&auto=format&fit=crop"
                alt="Profile"
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full"></span>
            </div>

            <div className="space-y-0.5 overflow-hidden">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">
                {user.name}
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                <FiMail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-app-purple text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                  <FiShield className="w-2.5 h-2.5" />
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* My Tickets & Order History Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <HiTicket className="w-4 h-4 text-app-purple" />
                <span>My Tickets ({orders.length})</span>
              </h4>
              <button
                onClick={fetchMyOrders}
                className="text-[10px] font-extrabold text-app-purple hover:underline"
              >
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CgSpinner className="w-6 h-6 text-app-purple animate-spin" />
                <span className="text-[11px] text-slate-400 font-bold">Loading tickets...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-[#F8F3FE] rounded-2xl p-6 text-center border border-purple-50">
                <HiTicket className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No Tickets Purchased Yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Join the flash sale ticket wars to secure passes for your favorite concerts!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="bg-white rounded-2xl p-3.5 border border-purple-100 shadow-sm space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-black text-app-purple uppercase tracking-widest block">
                          Official E-Ticket
                        </span>
                        <h5 className="text-xs font-extrabold text-slate-900 line-clamp-1">
                          {getEventName(o.eventId)}
                        </h5>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                          o.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : o.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <FiCheckCircle className="w-2.5 h-2.5" />
                        {o.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-purple-50 text-slate-500">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold">Quantity</span>
                        <span className="font-extrabold text-slate-800">{o.quantity} Tickets</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold">Total Paid</span>
                        <span className="font-black text-app-purple">{formatPrice(o.totalPrice)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span className="font-mono truncate max-w-[140px]">ID: {o.id}</span>
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3" />
                        {new Date(o.createdAt).toLocaleDateString('en-US')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Logout Button */}
        <div className="p-4 bg-[#F8F3FE] border-t border-purple-100 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-red-200"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Sign Out (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
