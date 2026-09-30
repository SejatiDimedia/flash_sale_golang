import React from 'react';
import { createPortal } from 'react-dom';
import { FiArrowLeft, FiBookmark, FiCalendar, FiMapPin } from 'react-icons/fi';
import { IoFlash } from 'react-icons/io5';
import { getEventImage } from '../lib/images';
import type { Event } from '../lib/api';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  onContinue: (event: Event) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onContinue,
}) => {
  if (!isOpen || !event) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col justify-between">
        <div className="overflow-y-auto no-scrollbar">
          {/* Top Photo Banner */}
          <div className="relative w-full h-64 overflow-hidden">
            <img
              src={getEventImage(event.category)}
              alt={event.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-slate-950/40"></div>

            {/* Top Navigation Row */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <button
                onClick={onClose}
                className="w-9 h-9 bg-slate-900/80 backdrop-blur-md rounded-xl flex items-center justify-center text-white hover:bg-slate-800 transition-colors shadow-sm border border-slate-700/60"
              >
                <FiArrowLeft className="w-4 h-4" />
              </button>

              <span className="text-white text-xs font-bold uppercase tracking-wider drop-shadow-sm">
                Detail Flash Sale
              </span>

              <button className="w-9 h-9 bg-slate-900/80 backdrop-blur-md rounded-xl flex items-center justify-center text-white hover:text-indigo-300 transition-colors shadow-sm border border-slate-700/60">
                <FiBookmark className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                  {event.category?.toUpperCase() || 'CONCERT'}
                </span>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {event.name}
                </h2>
              </div>
              <span className="text-lg font-bold text-indigo-600 shrink-0">
                {formatPrice(event.price)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <FiCalendar className="w-3.5 h-3.5 text-indigo-600" />
                {new Date(event.startSaleAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <FiMapPin className="w-3.5 h-3.5 text-indigo-600" />
                Stadion Utama GBK, Jakarta
              </span>
            </div>

            {/* Real Stock Status Pill */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium text-slate-500 block">Sisa Kuota Tiket</span>
                <span className="text-xs font-bold text-slate-900">
                  {event.availableStock} / {event.totalStock} Tiket Tersedia
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                event.availableStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {event.availableStock > 0 ? 'Tersedia' : 'Habis'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Tentang Event
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {event.description || 'Nikmati pengalaman pertunjukan live berskala internasional dengan tata panggung canggih dan tata suara spektakuler.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lokasi Venue
              </h3>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FiMapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Gelora Bung Karno (GBK)</h4>
                  <p className="text-[11px] text-slate-500">Pintu Satu Senayan, Jakarta Pusat</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Button */}
        <div className="p-4 bg-white border-t border-slate-100">
          <button
            onClick={() => onContinue(event)}
            disabled={event.availableStock <= 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <IoFlash className="w-4 h-4 text-amber-300" />
            <span>{event.availableStock > 0 ? 'Ikuti War Tiket Sekarang' : 'Tiket Sudah Habis'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
