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
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden max-h-[92vh] flex flex-col justify-between">
        <div className="overflow-y-auto no-scrollbar">
          {/* Top Photo Banner */}
          <div className="relative w-full h-60 overflow-hidden">
            <img
              src={getEventImage(event.category)}
              alt={event.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/20 to-transparent"></div>

            {/* Top Navigation Row */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <button
                onClick={onClose}
                className="w-9 h-9 bg-dark-950/80 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-dark-800 transition-colors border border-white/10 shadow-sm"
              >
                <FiArrowLeft className="w-4 h-4" />
              </button>

              <span className="text-white text-xs font-bold uppercase tracking-wider drop-shadow-sm">
                Flash Sale Details
              </span>

              <button className="w-9 h-9 bg-dark-950/80 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:text-coral transition-colors border border-white/10 shadow-sm">
                <FiBookmark className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-coral uppercase tracking-wider block mb-1">
                  {event.category?.toUpperCase() || 'CONCERT'}
                </span>
                <h2 className="text-lg font-bold text-white leading-tight">
                  {event.name}
                </h2>
              </div>
              <span className="text-lg font-black text-coral shrink-0">
                {formatPrice(event.price)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-400">
              <span className="flex items-center gap-1">
                <FiCalendar className="w-3.5 h-3.5 text-coral" />
                {new Date(event.startSaleAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <FiMapPin className="w-3.5 h-3.5 text-coral" />
                Gelora Bung Karno Stadium, Jakarta
              </span>
            </div>

            {/* Real Stock Status Pill */}
            <div className="p-3 bg-dark-800 rounded-2xl border border-dark-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium text-zinc-400 block">Remaining Quota</span>
                <span className="text-xs font-bold text-white">
                  {event.availableStock} / {event.totalStock} Tickets Available
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                event.availableStock > 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' : 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
              }`}>
                {event.availableStock > 0 ? 'Available' : 'Sold Out'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                About Event
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {event.description || 'Experience an extraordinary live international performance with state-of-the-art stage visuals and sound engineering.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Venue Location
              </h3>
              <div className="p-3 bg-dark-800 rounded-2xl border border-dark-700 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-dark-750 text-coral flex items-center justify-center shrink-0">
                  <FiMapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Gelora Bung Karno Main Stadium</h4>
                  <p className="text-[11px] text-zinc-400">Pintu Satu Senayan, Central Jakarta</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Button */}
        <div className="p-4 bg-dark-900 border-t border-dark-700">
          <button
            onClick={() => onContinue(event)}
            disabled={event.availableStock <= 0}
            className="w-full py-3 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <IoFlash className="w-4 h-4 text-white" />
            <span>{event.availableStock > 0 ? 'WAR TICKET NOW' : 'SOLD OUT'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
