import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiCheckCircle, FiClock, FiArrowRight, FiX, FiCopy, FiCheck } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api, type User, type Order, type Event, type QueueStatus } from '../lib/api';
import { getEventImage } from '../lib/images';
import { TicketBarcode } from './TicketBarcode';
import { MidtransPaymentModal } from './MidtransPaymentModal';

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
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pendingOrderToPay, setPendingOrderToPay] = useState<Order | null>(null);

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

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!user) return null;

  const queuedEvent = events.find((e) => e.id === activeQueueEventId);

  const getEventName = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    return found ? found.name : 'Coldplay Live in Jakarta';
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
    <div className="space-y-4 animate-fadeIn pb-6">
      {/* Top Header Bar for Tickets Page (Reference UI Style) */}
      <div className="w-full bg-dark-900 p-4 border-b border-dark-700 text-white flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-dark-800 hover:bg-dark-750 flex items-center justify-center text-zinc-300 hover:text-white transition-colors border border-dark-700"
          title="Back"
        >
          <FiArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-bold text-white tracking-wide">
          Ticket
        </h1>
        <div className="w-9"></div>
      </div>

      {/* Main Page Content */}
      <div className="px-4 space-y-4">
        {/* 🔘 Segmented Control Tabs: Coming soon vs History (Matches Screen 1) */}
        <div className="bg-dark-800 p-1 rounded-full border border-dark-700 flex items-center gap-1">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all text-center ${
              activeTab === 'upcoming'
                ? 'bg-white text-dark-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Coming soon {activeQueueEventId ? '• (In Queue)' : ''}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all text-center ${
              activeTab === 'history'
                ? 'bg-white text-dark-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            History ({orders.length})
          </button>
        </div>

        {/* 1. ⚡ UPCOMING / ACTIVE QUEUE PASS TAB */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {activeQueueEventId && queuedEvent && activeQueueStatus ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <IoFlash className="w-4 h-4 text-coral animate-pulse" />
                    <span>Live Queue Status</span>
                  </h3>
                  <button
                    onClick={handleCancelQueue}
                    className="text-xs font-medium text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    title="Leave queue"
                  >
                    <FiX className="w-3.5 h-3.5" />
                    <span>Leave Queue</span>
                  </button>
                </div>

                <div
                  className={`rounded-3xl p-4 border transition-all duration-300 ${
                    activeQueueStatus.isAllowedToPurchase
                      ? 'bg-dark-800 border-emerald-500/60 shadow-dark-card'
                      : 'bg-dark-800 border-dark-700 shadow-dark-card'
                  }`}
                >
                  {/* Event Mini Banner */}
                  <div className="flex items-start gap-3">
                    <img
                      src={getEventImage(queuedEvent.category)}
                      alt={queuedEvent.name}
                      className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-dark-700"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-dark-750 text-zinc-300">
                          {queuedEvent.category?.toUpperCase() || 'CONCERT'}
                        </span>

                        {activeQueueStatus.isAllowedToPurchase ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            Ready to Buy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                            <CgSpinner className="w-3 h-3 animate-spin text-coral" />
                            In Queue
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white truncate leading-tight">
                        {queuedEvent.name}
                      </h4>
                      <span className="text-xs font-bold text-coral block mt-0.5">
                        {formatPrice(queuedEvent.price)}
                      </span>
                    </div>
                  </div>

                  {/* Status Details / Stats */}
                  {activeQueueStatus.isAllowedToPurchase ? (
                    <div className="mt-4 pt-3 border-t border-dark-700 space-y-3">
                      <p className="text-xs font-semibold text-emerald-400 leading-tight">
                        🎉 It's your turn! Your 5-minute checkout session is active.
                      </p>
                      <button
                        onClick={() => onOpenCheckout && onOpenCheckout(queuedEvent)}
                        className="w-full py-3 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all flex items-center justify-center gap-2"
                      >
                        <IoFlash className="w-4 h-4 text-white" />
                        <span>Proceed to Express Checkout</span>
                        <FiArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-dark-700 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center bg-dark-750 p-3 rounded-2xl border border-dark-700">
                        <div>
                          <span className="text-[10px] font-medium text-zinc-400 block">Position</span>
                          <span className="text-xs font-bold text-coral">#{activeQueueStatus.position}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-zinc-400 block">In Queue</span>
                          <span className="text-xs font-bold text-white">{activeQueueStatus.totalInQueue}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-zinc-400 block">Est. Wait</span>
                          <span className="text-xs font-bold text-white">~{activeQueueStatus.estimatedWaitSeconds}s</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenWaitingRoom && onOpenWaitingRoom(queuedEvent)}
                        className="w-full py-2.5 bg-dark-750 hover:bg-dark-700 text-white rounded-full text-xs font-bold border border-dark-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <FiClock className="w-3.5 h-3.5 text-coral" />
                        <span>Open Live Waiting Room View</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* If there are orders, render confirmed ticket or pending payment card */}
            {orders.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED');
                  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
                  const targetOrder = orders.find((o) => o.id === selectedOrderId) || confirmedOrders[0] || pendingOrders[0];

                  if (!targetOrder) return null;

                  if (targetOrder.status === 'PENDING') {
                    return (
                      <div
                        key={targetOrder.id}
                        className="bg-dark-800 rounded-3xl p-5 border border-amber-500/40 shadow-dark-card space-y-4 animate-fadeIn"
                      >
                        {/* Ticket Header */}
                        <div className="flex items-start gap-3.5">
                          <img
                            src={getEventImage(getEventCategory(targetOrder.eventId))}
                            alt={getEventName(targetOrder.eventId)}
                            className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-dark-700"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-950/70 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider mb-1">
                              Awaiting Payment
                            </span>
                            <h3 className="text-sm font-bold text-white leading-tight truncate">
                              {getEventName(targetOrder.eventId)}
                            </h3>
                            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                              Gelora Bung Karno Main Stadium, Jakarta
                            </p>
                          </div>
                        </div>

                        {/* Payment Due & Info Card */}
                        <div className="bg-amber-950/30 p-3.5 rounded-2xl border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400 font-medium">Total Amount Due</span>
                            <span className="text-base font-black text-coral">
                              {formatPrice(targetOrder.totalPrice)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-amber-500/20 text-zinc-400">
                            <span>Order ID: <strong className="font-mono text-zinc-200">{targetOrder.id}</strong></span>
                            <span>Quantity: <strong className="text-zinc-200">{targetOrder.quantity} Tickets</strong></span>
                          </div>
                          <p className="text-[11px] text-amber-200/90 leading-relaxed pt-1">
                            ℹ️ Ticket reservation active. Official entry turnstile barcode will be unlocked as soon as your payment is confirmed by Midtrans.
                          </p>
                        </div>

                        {/* Pay Button */}
                        <button
                          type="button"
                          onClick={() => setPendingOrderToPay(targetOrder)}
                          className="w-full py-3.5 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                        >
                          <IoFlash className="w-4 h-4 text-white" />
                          <span>Pay Now with Midtrans</span>
                        </button>
                      </div>
                    );
                  }

                  const bookingCode = `BLK${targetOrder.id.replace(/[^0-9]/g, '').slice(0, 11) || '21738745123'}`;
                  return (
                    <div
                      key={targetOrder.id}
                      className="bg-dark-800 rounded-3xl p-5 border border-dark-700/80 shadow-dark-card space-y-4"
                    >
                      {/* Ticket Header (Reference Screen 2) */}
                      <div className="flex items-start gap-3.5">
                        <img
                          src={getEventImage(getEventCategory(targetOrder.eventId))}
                          alt={getEventName(targetOrder.eventId)}
                          className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-dark-700"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-dark-750 text-zinc-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                            {getEventCategory(targetOrder.eventId).toUpperCase()}
                          </span>
                          <h3 className="text-sm font-bold text-white leading-tight truncate">
                            {getEventName(targetOrder.eventId)}
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                            Gelora Bung Karno Main Stadium, Jakarta
                          </p>
                        </div>
                      </div>

                      {/* Ticket Spec Grid (Reference Screen 2) */}
                      <div className="space-y-3 pt-1">
                        <div>
                          <span className="text-[10px] font-medium text-zinc-400 block">Venue</span>
                          <span className="text-xs font-bold text-white">Gelora Bung Karno Main Stadium</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-medium text-zinc-400 block">Section</span>
                            <span className="text-xs font-bold text-white">Tribune VIP</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-zinc-400 block">Row</span>
                            <span className="text-xs font-bold text-white">8</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-medium text-zinc-400 block">Date</span>
                            <span className="text-xs font-bold text-white">
                              {new Date(targetOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-zinc-400 block">Time</span>
                            <span className="text-xs font-bold text-white">07.00 PM</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-medium text-zinc-400 block">Booking Code</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs font-bold text-white tracking-wider">
                              {bookingCode}
                            </span>
                            <button
                              onClick={() => handleCopy(bookingCode)}
                              className="text-zinc-400 hover:text-white transition-colors"
                              title="Copy Booking Code"
                            >
                              {copiedCode === bookingCode ? (
                                <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <FiCopy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ✂️ Dashed Ticket Divider with REAL BARCODE */}
                      <div className="ticket-dashed-divider pt-4 text-center">
                        <TicketBarcode value={bookingCode} orderId={targetOrder.id} />
                      </div>

                      {/* Terms and Conditions (Screen 2) */}
                      <div className="bg-dark-750/70 p-3.5 rounded-2xl border border-dark-700 space-y-1.5">
                        <h4 className="text-[11px] font-bold text-white">Terms and Conditions</h4>
                        <ul className="text-[10px] text-zinc-400 space-y-1 list-disc list-inside leading-relaxed">
                          <li>Tickets must be presented at gate entrance for barcode check.</li>
                          <li>No refunds, exchanges, or cancellations unless event is canceled.</li>
                          <li>A valid ticket and ID are required for entry. Re-entry is not allowed.</li>
                        </ul>
                      </div>

                      {/* Big Orange Download / Print CTA Button (Screen 2) */}
                      <button
                        onClick={() => alert(`Official E-Ticket (${bookingCode}) verified and ready for entry!`)}
                        className="w-full py-3.5 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all active:scale-[0.99]"
                      >
                        Download Ticket
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : !activeQueueEventId ? (
              <div className="bg-dark-800 rounded-3xl p-8 text-center border border-dark-700 space-y-3 shadow-dark-card">
                <div className="w-12 h-12 rounded-2xl bg-dark-750 text-coral flex items-center justify-center mx-auto shadow-sm">
                  <HiTicket className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Upcoming Tickets</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-[240px] mx-auto">
                    You do not have any active concert tickets yet. Join live flash sale events now!
                  </p>
                </div>
                <button
                  onClick={onExplore}
                  className="px-5 py-2.5 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all inline-block"
                >
                  Explore Flash Sale Events
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* 2. 🎟️ HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 bg-dark-800 rounded-3xl border border-dark-700 p-6">
                <CgSpinner className="w-7 h-7 text-coral animate-spin" />
                <span className="text-xs font-medium text-zinc-400">Loading ticket history...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-dark-800 rounded-3xl p-8 text-center border border-dark-700 space-y-3 shadow-dark-card">
                <div className="w-12 h-12 rounded-2xl bg-dark-750 text-zinc-500 flex items-center justify-center mx-auto">
                  <HiTicket className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Tickets Purchased Yet</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-[240px] mx-auto">
                    Your past orders and ticket passes will appear here after checkout.
                  </p>
                </div>
                <button
                  onClick={onExplore}
                  className="px-5 py-2.5 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all inline-block"
                >
                  Explore Flash Sale Events
                </button>
              </div>
            ) : (
              orders.map((o) => {
                const bookingCode = `BLK${o.id.replace(/[^0-9]/g, '').slice(0, 11) || '21738745123'}`;
                return (
                  <div
                    key={o.id}
                    onClick={() => {
                      setSelectedOrderId(o.id);
                      setActiveTab('upcoming');
                    }}
                    className="bg-dark-800 hover:bg-dark-750 transition-all cursor-pointer rounded-3xl p-4 border border-dark-700/80 shadow-dark-card space-y-3 group"
                    title="Click to view full e-ticket and barcode"
                  >
                    {/* Header Row */}
                    <div className="flex items-start gap-3">
                      <img
                        src={getEventImage(getEventCategory(o.eventId))}
                        alt={getEventName(o.eventId)}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-dark-700"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-coral uppercase tracking-wider block mb-0.5">
                          Official E-Ticket
                        </span>
                        <h4 className="text-xs font-bold text-white truncate">
                          {getEventName(o.eventId)}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          Gelora Bung Karno Main Stadium, Jakarta
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          o.status === 'CONFIRMED'
                            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30'
                            : o.status === 'PENDING'
                            ? 'bg-amber-950/70 text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-rose-950/70 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <FiCheckCircle className="w-3 h-3" />
                        {o.status}
                      </span>
                    </div>

                    {/* Booking Code & Price */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-dark-700 text-zinc-400">
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-medium">Quantity</span>
                        <span className="font-bold text-white">{o.quantity} Tickets</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-medium">Total Paid</span>
                        <span className="font-bold text-coral">{formatPrice(o.totalPrice)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-dark-700">
                      <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[140px]">
                        Code: {bookingCode}
                      </span>
                      <span className="text-[10px] font-bold text-coral group-hover:underline flex items-center gap-1">
                        View Barcode →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Midtrans Modal for Pending Orders */}
      <MidtransPaymentModal
        isOpen={!!pendingOrderToPay}
        onClose={() => {
          setPendingOrderToPay(null);
        }}
        order={pendingOrderToPay}
        event={events.find((e) => e.id === pendingOrderToPay?.eventId) || null}
        onConfirmSuccess={() => {
          setPendingOrderToPay(null);
          // Refetch orders to show newly confirmed ticket
          window.location.reload();
        }}
      />
    </div>
  );
};
