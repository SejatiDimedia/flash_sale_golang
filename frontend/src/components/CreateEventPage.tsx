import React, { useState } from 'react';
import { FiArrowLeft, FiCalendar, FiDollarSign, FiTag, FiFileText, FiLayers } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api } from '../lib/api';

interface CreateEventPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

const categoryOptions = [
  { id: 'concerts', label: 'Concerts' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'sports', label: 'Sports' },
  { id: 'social', label: 'Social' },
];

export const CreateEventPage: React.FC<CreateEventPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const now = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('concerts');
  const [totalStock, setTotalStock] = useState<number>(100);
  const [price, setPrice] = useState<number>(750000);
  const [maxPerUser, setMaxPerUser] = useState<number>(2);
  const [startSaleAt, setStartSaleAt] = useState<string>(now.toISOString().slice(0, 16));
  const [endSaleAt, setEndSaleAt] = useState<string>(tomorrow.toISOString().slice(0, 16));
  const [status, setStatus] = useState<string>('ACTIVE');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const startRFC = new Date(startSaleAt).toISOString();
      const endRFC = new Date(endSaleAt).toISOString();

      await api.createEvent({
        name,
        description,
        category,
        totalStock: Number(totalStock),
        price: Number(price),
        maxPerUser: Number(maxPerUser),
        startSaleAt: startRFC,
        endSaleAt: endRFC,
        status,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header Bar for Create Event Page */}
      <div className="relative w-full rounded-b-[36px] bg-header-gradient p-5 pt-4 text-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 glass-circle rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold tracking-wide">Event Management</span>
          <div className="w-9"></div> {/* Spacer */}
        </div>

        <div className="pt-1 pb-2">
          <span className="text-[10px] font-bold text-white/75 tracking-wider uppercase block">
            Admin Console
          </span>
          <h1 className="text-xl font-black text-white leading-tight">
            Create Flash Sale Event
          </h1>
          <p className="text-xs text-white/80 mt-0.5">
            Publish new event and sync quotas to Redis cache
          </p>
        </div>
      </div>

      {/* Main Form Page Body */}
      <div className="px-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-[28px] p-5 border border-purple-100 shadow-card space-y-3.5">
          {/* Event Name */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              Event Title
            </label>
            <div className="relative">
              <FiTag className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coldplay Music of the Spheres Live"
                className="w-full pl-10 pr-3 py-3 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 flex items-center gap-1">
              <FiLayers className="w-3.5 h-3.5 text-app-purple" />
              <span>Event Category</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {categoryOptions.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-extrabold border transition-all text-center ${
                    category === cat.id
                      ? 'bg-app-purple text-white border-app-purple shadow-sm'
                      : 'bg-[#F8F3FE] text-slate-600 border-purple-100 hover:border-purple-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              Event Description
            </label>
            <div className="relative">
              <FiFileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event description, venue information, and line-up..."
                className="w-full pl-10 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-semibold text-slate-800 outline-none focus:border-app-purple resize-none"
              />
            </div>
          </div>

          {/* Total Stock & Price */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Total Ticket Quota
              </label>
              <div className="relative">
                <HiTicket className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  required
                  value={totalStock}
                  onChange={(e) => setTotalStock(Number(e.target.value))}
                  className="w-full pl-9 pr-2 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-black text-slate-800 outline-none focus:border-app-purple"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Ticket Price (IDR)
              </label>
              <div className="relative">
                <FiDollarSign className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  step={10000}
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full pl-9 pr-2 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-black text-slate-800 outline-none focus:border-app-purple"
                />
              </div>
            </div>
          </div>

          {/* Max Per User & Status */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Max Tickets / User
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={maxPerUser}
                onChange={(e) => setMaxPerUser(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-black text-slate-800 outline-none focus:border-app-purple text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Sale Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-black text-slate-800 outline-none focus:border-app-purple"
              >
                <option value="ACTIVE">ACTIVE (Live Flash Sale)</option>
                <option value="SCHEDULED">SCHEDULED (Upcoming)</option>
                <option value="DRAFT">DRAFT</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
          </div>

          {/* Start & End Dates */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              Sale Start Date & Time
            </label>
            <div className="relative">
              <FiCalendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="datetime-local"
                required
                value={startSaleAt}
                onChange={(e) => setStartSaleAt(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
              Sale End Date & Time
            </label>
            <div className="relative">
              <FiCalendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="datetime-local"
                required
                value={endSaleAt}
                onChange={(e) => setEndSaleAt(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-purple-btn text-white rounded-full text-xs font-black shadow-btn hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  <span>Publishing to Database & Redis...</span>
                </>
              ) : (
                <>
                  <IoFlash className="w-4 h-4" />
                  <span>Publish Flash Sale Event</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 text-center transition-colors"
            >
              Cancel and Return
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
