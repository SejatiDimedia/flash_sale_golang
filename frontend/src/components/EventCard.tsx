import React, { useState, useEffect } from 'react';
import { FiMapPin, FiBookmark, FiArrowUpRight, FiClock } from 'react-icons/fi';
import { IoFlash, IoFlame } from 'react-icons/io5';
import type { Event } from '../lib/api';

interface EventCardProps {
  event: Event;
  onWarTicket: (event: Event) => void;
  onViewDetail?: (event: Event) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onWarTicket, onViewDetail }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 2,
    minutes: 14,
    seconds: 38,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const stockPercentage = Math.max(0, Math.min(100, (event.availableStock / event.totalStock) * 100));
  const isSoldOut = event.availableStock <= 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="group relative bg-white rounded-[32px] p-3.5 shadow-card hover:shadow-xl transition-all duration-300 border border-purple-100/70 flex flex-col justify-between overflow-hidden">
      {/* 🖼️ Card Hero Image matching Reference Screen 1 */}
      <div className="relative w-full h-64 rounded-[26px] overflow-hidden mb-3.5 shadow-sm">
        <img
          src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop"
          alt={event.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>

        {/* Location Pill (Top Left) */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 glass-card-pill rounded-full text-white text-[11px] font-bold shadow-sm">
          <FiMapPin className="w-3 h-3 text-pink-300" />
          <span>GBK Stadium, Jakarta</span>
        </div>

        {/* Bookmark Button (Top Right) */}
        <button className="absolute top-3 right-3 w-8 h-8 glass-card-pill rounded-full flex items-center justify-center text-white hover:text-pink-300 transition-colors shadow-sm">
          <FiBookmark className="w-3.5 h-3.5" />
        </button>

        {/* Live Tag & Category Tag */}
        <div className="absolute top-12 left-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full text-[10px] font-black shadow-md animate-pulse">
            <IoFlame className="w-3 h-3" />
            <span>FLASH SALE</span>
          </span>
          {event.category && (
            <span className="px-2.5 py-0.5 glass-card-pill text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
              {event.category}
            </span>
          )}
        </div>

        {/* Bottom Content Over Image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white leading-tight drop-shadow-sm line-clamp-1">
              {event.name}
            </h3>

            {/* Avatar Stack + Date */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <img className="w-5 h-5 rounded-full border border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80" alt="Avatar" />
                <img className="w-5 h-5 rounded-full border border-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" alt="Avatar" />
                <div className="w-5 h-5 rounded-full border border-white bg-app-purple text-[9px] font-bold text-white flex items-center justify-center">
                  +30
                </div>
              </div>
              <span className="text-[11px] font-semibold text-white/90">
                {new Date(event.startSaleAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • 08:00 PM
              </span>
            </div>
          </div>

          {/* Diagonal Arrow Button */}
          <button
            onClick={() => (onViewDetail ? onViewDetail(event) : onWarTicket(event))}
            className="w-9 h-9 glass-card-pill rounded-full flex items-center justify-center text-white hover:bg-white hover:text-app-purple transition-all shadow-md shrink-0"
            title="View Details"
          >
            <FiArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pricing & Live Stock Counter */}
      <div className="px-1 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Flash Sale Price
            </span>
            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-app-purple to-app-magenta">
              {formatPrice(event.price)}
            </span>
          </div>

          {/* Countdown Pill */}
          <div className="flex items-center gap-1 font-mono text-[11px] font-black text-app-dark bg-[#F5EEFD] px-2.5 py-1.5 rounded-xl border border-purple-100">
            <FiClock className="w-3 h-3 text-app-purple" />
            <span>{String(timeLeft.hours).padStart(2, '0')}:</span>
            <span>{String(timeLeft.minutes).padStart(2, '0')}:</span>
            <span className="text-pink-600">{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Real-time Live Stock Bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
              <IoFlash className="w-3 h-3 text-amber-500" />
              Available Stock:
            </span>
            <span className={isSoldOut ? 'text-red-500 font-extrabold' : 'text-app-purple font-extrabold'}>
              {isSoldOut ? 'SOLD OUT' : `${event.availableStock} / ${event.totalStock}`}
            </span>
          </div>

          <div className="w-full h-2.5 bg-purple-50 rounded-full overflow-hidden p-0.5 border border-purple-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSoldOut
                  ? 'bg-slate-300'
                  : stockPercentage < 20
                  ? 'bg-gradient-to-r from-red-500 to-amber-500'
                  : 'bg-gradient-to-r from-app-purple via-app-violet to-app-magenta'
              }`}
              style={{ width: `${stockPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onWarTicket(event)}
          disabled={isSoldOut}
          className={`w-full py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-btn ${
            isSoldOut
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-purple-btn text-white hover:opacity-95 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          <IoFlash className="w-3.5 h-3.5" />
          <span>{isSoldOut ? 'SOLD OUT' : 'WAR TICKET NOW'}</span>
        </button>
      </div>
    </div>
  );
};
