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
      <div className="w-full bg-slate-900 p-4 border-b border-slate-800 text-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Kembali"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold tracking-wide uppercase text-slate-400">E-Tiket & Antrean</span>
          <div className="w-8"></div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white leading-tight">
            Tiket & Status Antrean
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Daftar tiket terverifikasi dan status antrean flash sale Anda
          </p>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="px-4 space-y-4">
        {/* 1. ⚡ LIVE WAITING ROOM & ACTIVE QUEUE PASS (Pinned at top if active) */}
        {activeQueueEventId && queuedEvent && activeQueueStatus && (
          <div className="space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <IoFlash className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Tiket Antrean Aktif</span>
              </h3>
              <button
                onClick={handleCancelQueue}
                className="text-xs font-medium text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                title="Tinggalkan antrean"
              >
                <FiX className="w-3.5 h-3.5" />
                <span>Keluar Antrean</span>
              </button>
            </div>

            <div
              className={`rounded-2xl p-4 border transition-all duration-300 ${
                activeQueueStatus.isAllowedToPurchase
                  ? 'bg-emerald-50/90 border-emerald-200 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-900 shadow-sm'
              }`}
            >
              {/* Event Mini Banner */}
              <div className="flex items-start gap-3">
                <img
                  src={getEventImage(queuedEvent.category)}
                  alt={queuedEvent.name}
                  className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {queuedEvent.category?.toUpperCase() || 'CONCERT'}
                    </span>

                    {activeQueueStatus.isAllowedToPurchase ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                        Giliran Tiba
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <CgSpinner className="w-3 h-3 animate-spin text-indigo-600" />
                        Dalam Antrean
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">
                    {queuedEvent.name}
                  </h4>
                  <span className="text-xs font-bold text-indigo-600 block mt-0.5">
                    {formatPrice(queuedEvent.price)}
                  </span>
                </div>
              </div>

              {/* Status Details / Stats */}
              {activeQueueStatus.isAllowedToPurchase ? (
                <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-2">
                  <p className="text-xs font-medium text-emerald-800 leading-tight">
                    Sesi pembelian Anda sedang aktif! Segera selesaikan pemesanan tiket Anda dalam 5 menit.
                  </p>
                  <button
                    onClick={() => onOpenCheckout && onOpenCheckout(queuedEvent)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <IoFlash className="w-4 h-4 text-amber-300" />
                    <span>Lanjut ke Checkout Pembelian</span>
                    <FiArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 block">Posisi</span>
                      <span className="text-xs font-bold text-indigo-600">#{activeQueueStatus.position}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 block">Total Antrean</span>
                      <span className="text-xs font-bold text-slate-800">{activeQueueStatus.totalInQueue}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 block">Est. Tunggu</span>
                      <span className="text-xs font-bold text-slate-800">~{activeQueueStatus.estimatedWaitSeconds}d</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenWaitingRoom && onOpenWaitingRoom(queuedEvent)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <FiClock className="w-3.5 h-3.5" />
                    <span>Lihat Ruang Tunggu Live</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. 🎟️ CONFIRMED TICKETS LIST */}
        <div className="flex items-center justify-between px-1 pt-1">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <HiTicket className="w-4 h-4 text-indigo-600" />
            <span>Tiket yang Dimiliki ({orders.length})</span>
          </h3>
          <button
            onClick={fetchMyOrders}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Muat Ulang
          </button>
        </div>

        {/* Tickets Feed */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 bg-slate-50 rounded-2xl border border-slate-200 p-6">
            <CgSpinner className="w-7 h-7 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium text-slate-500">Memuat riwayat tiket...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <HiTicket className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Belum Ada Tiket yang Dibeli</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                Anda belum memiliki tiket konser aktif. Ikuti flash sale pada halaman utama sekarang!
              </p>
            </div>
            <button
              onClick={onExplore}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors inline-block"
            >
              Jelajahi Flash Sale
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3"
              >
                {/* Event Photo & Title Row */}
                <div className="flex items-start gap-3">
                  <img
                    src={getEventImage(getEventCategory(o.eventId))}
                    alt={getEventName(o.eventId)}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-0.5">
                      E-Tiket Resmi
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {getEventName(o.eventId)}
                    </h4>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      o.status === 'CONFIRMED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : o.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <FiCheckCircle className="w-3 h-3" />
                    {o.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-slate-100 text-slate-500">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Jumlah</span>
                    <span className="font-bold text-slate-800">{o.quantity} Tiket</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Total Pembayaran</span>
                    <span className="font-bold text-indigo-600">{formatPrice(o.totalPrice)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-[150px]">ID: {o.id}</span>
                  <span className="flex items-center gap-1 font-medium text-[10px] text-slate-500">
                    <FiCalendar className="w-3.5 h-3.5 text-indigo-600" />
                    {new Date(o.createdAt).toLocaleDateString('id-ID')}
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
