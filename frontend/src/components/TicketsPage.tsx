import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiArrowRight, FiX } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api, type User, type Order, type Event, type QueueStatus } from '../lib/api';
import { getEventImage } from '../lib/images';

interface TicketsPageProps {
  user: User | null;
  onBack: () => void;
  onExplore: () => void;
  events: Event[];
  onOpenCheckout?: (event: Event) => void;
  onOpenWaitingRoom?: (event: Event) => void;
}

export const TicketsPage: React.FC<TicketsPageProps> = ({
  user,
  onBack,
  onExplore,
  events,
  onOpenCheckout,
  onOpenWaitingRoom,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ⏳ Active Waiting Room Queue Pass State
  const [activeQueueEventId, setActiveQueueEventId] = useState<string | null>(() => {
    return localStorage.getItem('activeQueueEventId');
  });
  const [activeQueueStatus, setActiveQueueStatus] = useState<QueueStatus | null>(null);

  useEffect(() => {
    if (user) {
      fetchMyOrders();
    }
  }, [user]);

  // 🔄 Poll Live Queue Status if User is in a Waiting Room
  useEffect(() => {
    const queuedId = localStorage.getItem('activeQueueEventId');
    setActiveQueueEventId(queuedId);

    if (!queuedId || !user) return;

    let isMounted = true;

    const checkQueue = async () => {
      try {
        const status = await api.getQueueStatus(queuedId);
        if (isMounted) {
          setActiveQueueStatus(status);
        }
      } catch (e) {
        // If queue session expired or invalid, remove from state
      }
    };

    checkQueue();
    const interval = setInterval(checkQueue, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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

  const handleCancelQueue = () => {
    localStorage.removeItem('activeQueueEventId');
    setActiveQueueEventId(null);
    setActiveQueueStatus(null);
  };

  if (!user) return null;

  const queuedEvent = events.find((e) => e.id === activeQueueEventId);

  const getEventName = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    return found ? found.name : 'Coldplay Concert Flash Sale';
  };

  const getEventCategory = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    return found?.category || 'concerts';
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
          <span className="text-sm font-extrabold tracking-wide">My E-Tickets & Passes</span>
          <div className="w-9"></div> {/* Spacer */}
        </div>

        <div className="pt-1 pb-2">
          <span className="text-[10px] font-bold text-white/75 tracking-wider uppercase block">
            Digital Ticket Wallet
          </span>
          <h1 className="text-xl font-black text-white leading-tight">
            Order & Ticket History
          </h1>
          <p className="text-xs text-white/80 mt-0.5">
            Active queue passes and verified concert tickets
          </p>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="px-4 space-y-4">
        {/* 1. ⚡ LIVE WAITING ROOM & ACTIVE QUEUE PASS (Pinned at top if active) */}
        {activeQueueEventId && queuedEvent && activeQueueStatus && (
          <div className="space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <IoFlash className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Live Waiting Room Pass</span>
              </h3>
              <button
                onClick={handleCancelQueue}
                className="text-[11px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-0.5 transition-colors"
                title="Leave waiting room queue"
              >
                <FiX className="w-3.5 h-3.5" />
                <span>Leave Queue</span>
              </button>
            </div>

            <div
              className={`rounded-[28px] p-4 border shadow-card relative overflow-hidden transition-all duration-300 ${
                activeQueueStatus.isAllowedToPurchase
                  ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white border-emerald-400 shadow-emerald-500/20'
                  : 'bg-white border-purple-200 text-slate-900'
              }`}
            >
              {/* Event Mini Hero Banner with Overlay */}
              <div className="flex items-start gap-3">
                <img
                  src={getEventImage(queuedEvent.category)}
                  alt={queuedEvent.name}
                  className="w-16 h-16 rounded-2xl object-cover shadow-sm shrink-0 border border-white/40"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        activeQueueStatus.isAllowedToPurchase
                          ? 'bg-white/20 text-white backdrop-blur-sm'
                          : 'bg-purple-100 text-app-purple'
                      }`}
                    >
                      {queuedEvent.category?.toUpperCase() || 'CONCERT'}
                    </span>

                    {activeQueueStatus.isAllowedToPurchase ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping"></span>
                        Pass Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <CgSpinner className="w-3 h-3 animate-spin text-app-purple" />
                        In Queue
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-black truncate leading-tight">
                    {queuedEvent.name}
                  </h4>
                  <span
                    className={`text-xs font-extrabold block mt-0.5 ${
                      activeQueueStatus.isAllowedToPurchase ? 'text-white/90' : 'text-app-purple font-black'
                    }`}
                  >
                    {formatPrice(queuedEvent.price)}
                  </span>
                </div>
              </div>

              {/* Status Details / Stats */}
              {activeQueueStatus.isAllowedToPurchase ? (
                <div className="mt-3 pt-3 border-t border-white/20 space-y-2.5">
                  <p className="text-[11px] font-bold text-white/90 leading-tight">
                    🎉 It's your turn! Your 5-minute checkout session is active.
                  </p>
                  <button
                    onClick={() => onOpenCheckout && onOpenCheckout(queuedEvent)}
                    className="w-full py-3 bg-white text-emerald-800 rounded-2xl text-xs font-black shadow-lg shadow-black/10 hover:bg-white/95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    <IoFlash className="w-4 h-4 text-amber-500" />
                    <span>Proceed to Express Checkout</span>
                    <FiArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-purple-50 space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5 text-center bg-[#F8F3FE] p-2 rounded-2xl border border-purple-100/80">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Position</span>
                      <span className="text-xs font-black text-app-purple">#{activeQueueStatus.position}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">In Queue</span>
                      <span className="text-xs font-black text-slate-700">{activeQueueStatus.totalInQueue}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Est. Wait</span>
                      <span className="text-xs font-black text-slate-700">~{activeQueueStatus.estimatedWaitSeconds}s</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenWaitingRoom && onOpenWaitingRoom(queuedEvent)}
                    className="w-full py-2.5 bg-purple-btn text-white rounded-2xl text-xs font-black shadow-btn hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                  >
                    <FiClock className="w-3.5 h-3.5" />
                    <span>Open Live Waiting Room View</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. 🎟️ CONFIRMED TICKETS LIST */}
        <div className="flex items-center justify-between px-1 pt-1">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <HiTicket className="w-4 h-4 text-app-purple" />
            <span>Purchased E-Tickets ({orders.length})</span>
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
                className="bg-white rounded-[26px] p-4 border border-purple-100/90 shadow-card space-y-3 relative overflow-hidden"
              >
                {/* Event Photo & Title Row */}
                <div className="flex items-start gap-3">
                  <img
                    src={getEventImage(getEventCategory(o.eventId))}
                    alt={getEventName(o.eventId)}
                    className="w-12 h-12 rounded-xl object-cover shadow-xs shrink-0 border border-purple-100"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black text-app-purple uppercase tracking-widest block mb-0.5">
                      Official E-Ticket
                    </span>
                    <h4 className="text-xs font-black text-slate-900 truncate">
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
                  <span className="font-mono truncate max-w-[150px] text-[10px]">ID: {o.id}</span>
                  <span className="flex items-center gap-1 font-semibold text-[10px]">
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
