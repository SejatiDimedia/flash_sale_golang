import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { CgSpinner } from 'react-icons/cg';
import { api, type User, type Order, type Event } from '../lib/api';

interface TicketsPageProps {
  user: User | null;
  onBack: () => void;
  onExplore: () => void;
  events: Event[];
}

export const TicketsPage: React.FC<TicketsPageProps> = ({
  user,
  onBack,
  onExplore,
  events,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyOrders();
    }
  }, [user]);

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

  if (!user) return null;

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
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header Bar for Tickets Page */}
      <div className="relative w-full rounded-b-[36px] bg-header-gradient p-5 pt-4 text-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 glass-circle rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold tracking-wide">My E-Tickets</span>
          <div className="w-9"></div> {/* Spacer */}
        </div>

        <div className="pt-1 pb-2">
          <span className="text-[10px] font-bold text-white/75 tracking-wider uppercase block">
            Active Ticket Passes
          </span>
          <h1 className="text-xl font-black text-white leading-tight">
            Order & Ticket History
          </h1>
          <p className="text-xs text-white/80 mt-0.5">
            All flash sale concert passes you have successfully secured
          </p>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="px-4 space-y-4">
        <div className="flex items-center justify-between px-1 pt-1">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <HiTicket className="w-4 h-4 text-app-purple" />
            <span>Ticket Collection ({orders.length})</span>
          </h3>
          <button
            onClick={fetchMyOrders}
            className="text-xs font-extrabold text-app-purple hover:underline"
          >
            Refresh
          </button>
        </div>

        {/* Tickets Feed */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 bg-white rounded-[28px] border border-purple-100 p-6">
            <CgSpinner className="w-8 h-8 text-app-purple animate-spin" />
            <span className="text-xs font-bold text-slate-400">Loading your tickets...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-[28px] p-8 text-center border border-purple-100 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-full bg-purple-100 text-app-purple flex items-center justify-center mx-auto">
              <HiTicket className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-black text-slate-800">No Tickets Purchased Yet</h4>
            <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
              You do not have any active concert passes. Join upcoming flash sale wars on the home page!
            </p>
            <button
              onClick={onExplore}
              className="px-6 py-2.5 bg-purple-btn text-white rounded-full text-xs font-black shadow-btn hover:opacity-95 transition-all inline-block"
            >
              Explore Flash Sale Events
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-[26px] p-4 border border-purple-100/90 shadow-card space-y-2.5 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black text-app-purple uppercase tracking-widest block mb-0.5">
                      Official E-Ticket
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 line-clamp-1">
                      {getEventName(o.eventId)}
                    </h4>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                      o.status === 'CONFIRMED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : o.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <FiCheckCircle className="w-3 h-3" />
                    {o.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-purple-50 text-slate-500">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Quantity</span>
                    <span className="font-extrabold text-slate-800">{o.quantity} Tickets</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Total Paid</span>
                    <span className="font-black text-app-purple">{formatPrice(o.totalPrice)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-purple-50/60">
                  <span className="font-mono truncate max-w-[150px]">ID: {o.id}</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <FiCalendar className="w-3.5 h-3.5 text-app-purple" />
                    {new Date(o.createdAt).toLocaleDateString('en-US')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
