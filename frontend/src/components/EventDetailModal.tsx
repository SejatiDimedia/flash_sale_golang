import React from 'react';
import { createPortal } from 'react-dom';
import { FiArrowLeft, FiBookmark, FiCalendar, FiMapPin } from 'react-icons/fi';
import { IoFlash } from 'react-icons/io5';
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
      <div className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl border-4 border-white overflow-hidden max-h-[92vh] flex flex-col justify-between">
        <div className="overflow-y-auto no-scrollbar">
          {/* Top Photo Banner */}
          <div className="relative w-full h-72 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop"
              alt={event.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30"></div>

            {/* Top Navigation Row */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <button
                onClick={onClose}
                className="w-10 h-10 glass-circle rounded-full flex items-center justify-center text-white hover:bg-white hover:text-slate-900 transition-all shadow-md"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>

              <span className="text-white text-sm font-extrabold drop-shadow-md">
                Event Details
              </span>

              <button className="w-10 h-10 glass-circle rounded-full flex items-center justify-center text-white hover:text-pink-300 transition-colors shadow-md">
                <FiBookmark className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-5 -mt-6 bg-white rounded-t-[32px] relative z-10 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-extrabold text-app-dark leading-tight">
                {event.name}
              </h2>
              <span className="text-2xl font-black text-app-purple shrink-0">
                {formatPrice(event.price)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <FiCalendar className="w-3.5 h-3.5 text-app-purple" />
                {new Date(event.startSaleAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • 08:00 PM
              </span>
              <span className="flex items-center gap-1">
                <FiMapPin className="w-3.5 h-3.5 text-app-purple" />
                GBK Stadium, Jakarta
              </span>
            </div>

            {/* Avatar Stack */}
            <div className="flex items-center gap-2.5 py-1">
              <div className="flex -space-x-2">
                <img className="w-7 h-7 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" alt="Avatar" />
                <img className="w-7 h-7 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100" alt="Avatar" />
                <img className="w-7 h-7 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100" alt="Avatar" />
              </div>
              <span className="text-xs font-bold text-slate-600">
                +30 Participants Waiting in Queue
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-extrabold text-app-dark uppercase tracking-wider">
                About Event
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {event.description || 'Experience a world-class live performance with high-energy visuals, futuristic stage setups, and unforgettable concert vibes.'}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-app-dark uppercase tracking-wider">
                Location
              </h3>
              <div className="p-3 bg-[#F8F3FE] rounded-2xl border border-purple-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-app-purple/15 text-app-purple flex items-center justify-center shrink-0">
                  <FiMapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">Gelora Bung Karno Stadium</h4>
                  <p className="text-[11px] text-slate-500">Pintu Satu Senayan, Central Jakarta</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Button */}
        <div className="p-4 bg-white border-t border-purple-50">
          <button
            onClick={() => onContinue(event)}
            disabled={event.availableStock <= 0}
            className="w-full py-4 bg-purple-btn text-white rounded-full text-sm font-black shadow-btn hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <IoFlash className="w-4 h-4" />
            <span>Continue • War Ticket Now</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
