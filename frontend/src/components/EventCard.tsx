import React, { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiTag, FiArrowUpRight } from 'react-icons/fi';
import { IoFlash } from 'react-icons/io5';
import { getEventImage } from '../lib/images';
import type { Event } from '../lib/api';

interface EventCardProps {
  event: Event;
  onWarTicket: (event: Event) => void;
  onViewDetail?: (event: Event) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onWarTicket, onViewDetail }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(event.endSaleAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Selesai');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [event.endSaleAt]);

  const stockPercentage = Math.max(0, Math.min(100, (event.availableStock / event.totalStock) * 100));
  const isSoldOut = event.availableStock <= 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formattedDate = new Date(event.startSaleAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-sm hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between overflow-hidden">
      {/* 🖼️ Card Media Banner */}
      <div className="relative w-full h-52 overflow-hidden bg-slate-100">
        <img
          src={getEventImage(event.category)}
          alt={event.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>

        {/* Category Badge (Top Left) */}
        <div className="absolute top-3 left-3 flex items-center gap-1 px-3 py-1 bg-slate-900/80 backdrop-blur-sm rounded-lg text-white text-[11px] font-bold border border-white/10 shadow-sm">
          <FiTag className="w-3 h-3 text-indigo-400" />
          <span className="capitalize">{event.category || 'General'}</span>
        </div>

        {/* Live Status Badge (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {isSoldOut ? (
            <span className="px-2.5 py-1 bg-slate-800/90 text-slate-300 rounded-lg text-[10px] font-bold border border-slate-700">
              SOLD OUT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/90 text-white rounded-lg text-[10px] font-bold shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>LIVE SALE</span>
            </span>
          )}
        </div>

        {/* Event Title Over Image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white leading-snug drop-shadow-sm line-clamp-1">
              {event.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <FiCalendar className="w-3.5 h-3.5 text-indigo-300" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {onViewDetail && (
            <button
              onClick={() => onViewDetail(event)}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center backdrop-blur-sm transition-all shadow-sm shrink-0"
              title="View Details"
            >
              <FiArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 💳 Details, Stock Bar, & Action Area */}
      <div className="p-4 space-y-4">
        {/* Price & Countdown Timer */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Flash Sale Price
            </span>
            <span className="text-lg font-black text-slate-900 tracking-tight">
              {formatPrice(event.price)}
            </span>
          </div>

          {timeLeft && (
            <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              <FiClock className="w-3 h-3 text-indigo-600" />
              <span>{timeLeft}</span>
            </div>
          )}
        </div>

        {/* Real-Time Live Stock Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium text-[11px]">Available Quota</span>
            <span className={`font-bold ${isSoldOut ? 'text-rose-600' : 'text-slate-900'}`}>
              {isSoldOut ? 'Sold Out' : `${event.availableStock} / ${event.totalStock}`}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSoldOut
                  ? 'bg-slate-300'
                  : stockPercentage < 20
                  ? 'bg-rose-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${stockPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onWarTicket(event)}
          disabled={isSoldOut}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm ${
            isSoldOut
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-btn'
          }`}
        >
          <IoFlash className="w-3.5 h-3.5" />
          <span>{isSoldOut ? 'Sold Out' : 'WAR TICKET NOW'}</span>
        </button>
      </div>
    </div>
  );
};
