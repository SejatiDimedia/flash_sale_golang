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
    <div className="group bg-dark-800 rounded-3xl p-3 border border-dark-700/70 hover:border-dark-600 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-dark-card">
      {/* 🖼️ Card Media Banner (Screen 1 Style) */}
      <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-dark-750">
        <img
          src={getEventImage(event.category)}
          alt={event.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 via-transparent to-transparent"></div>

        {/* Top Badges (Category & Live Sale) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-dark-950/70 backdrop-blur-md rounded-full text-white text-[10px] font-bold border border-white/10">
            <FiTag className="w-3 h-3 text-coral" />
            <span className="capitalize">{event.category || 'Concert'}</span>
          </div>

          {isSoldOut ? (
            <span className="px-2.5 py-0.5 bg-dark-900/80 text-zinc-400 rounded-full text-[10px] font-bold border border-dark-700">
              SOLD OUT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/90 text-white rounded-full text-[10px] font-bold shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>LIVE</span>
            </span>
          )}
        </div>

        {/* Floating Price Tag (Bottom Left) & Bookmark / Details (Bottom Right) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <span className="px-3 py-1 bg-dark-950/80 backdrop-blur-md rounded-full text-xs font-black text-white border border-white/15 shadow-sm">
            {formatPrice(event.price)}
          </span>

          {onViewDetail && (
            <button
              onClick={() => onViewDetail(event)}
              className="w-8 h-8 rounded-full bg-dark-950/80 hover:bg-white text-white hover:text-dark-950 flex items-center justify-center backdrop-blur-md transition-all border border-white/15 shadow-sm"
              title="View Details"
            >
              <FiArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 💳 Details, Stock Bar, & Action Area */}
      <div className="p-2 pt-3 space-y-2.5">
        <div>
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-1">
            {event.name}
          </h3>
          <p className="text-[11px] font-bold text-coral flex items-center gap-1.5 mt-0.5">
            <FiCalendar className="w-3.5 h-3.5" />
            <span>{formattedDate} • {event.availableStock} Available</span>
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
            Gelora Bung Karno Main Stadium, Jakarta
          </p>
        </div>

        {/* Quota Progress Bar & Countdown */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-400 font-medium">Quota Remaining</span>
            {timeLeft && (
              <span className="flex items-center gap-1 font-mono text-zinc-300 font-bold">
                <FiClock className="w-3 h-3 text-coral" />
                <span>{timeLeft}</span>
              </span>
            )}
          </div>
          <div className="w-full h-1.5 bg-dark-750 rounded-full overflow-hidden border border-dark-700/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSoldOut
                  ? 'bg-zinc-600'
                  : stockPercentage < 20
                  ? 'bg-rose-500'
                  : 'bg-coral'
              }`}
              style={{ width: `${stockPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* CTA Button (WAR TICKET NOW) */}
        <button
          onClick={() => onWarTicket(event)}
          disabled={isSoldOut}
          className={`w-full py-2.5 px-4 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
            isSoldOut
              ? 'bg-dark-750 text-zinc-500 cursor-not-allowed border border-dark-700'
              : 'bg-coral hover:bg-coral-hover text-white shadow-coral active:scale-[0.99]'
          }`}
        >
          <IoFlash className="w-3.5 h-3.5" />
          <span>{isSoldOut ? 'Sold Out' : 'WAR TICKET NOW'}</span>
        </button>
      </div>
    </div>
  );
};
