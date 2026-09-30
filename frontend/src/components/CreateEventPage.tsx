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
      <div className="w-full bg-slate-900 p-4 border-b border-slate-800 text-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Back"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold tracking-wide uppercase text-slate-400">Admin Console</span>
          <div className="w-8"></div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white leading-tight">
            Create Flash Sale Event
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Register new concert/event and sync quota to Redis RAM
          </p>
        </div>
      </div>

      {/* Main Form Page Body */}
      <div className="px-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3.5">
          {/* Event Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Event Name
            </label>
            <div className="relative">
              <FiTag className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coldplay Music of the Spheres Tour"
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <FiLayers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Event Category</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {categoryOptions.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    category === cat.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Event Description
            </label>
            <div className="relative">
              <FiFileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write brief description, venue location, terms & conditions..."
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Total Stock & Price */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Total Ticket Quota
              </label>
              <div className="relative">
                <HiTicket className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  required
                  value={totalStock}
                  onChange={(e) => setTotalStock(Number(e.target.value))}
                  className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Ticket Price (IDR)
              </label>
              <div className="relative">
                <FiDollarSign className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  step={10000}
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Max Per User & Status */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Max. Tickets / User
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={maxPerUser}
                onChange={(e) => setMaxPerUser(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Sale Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
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
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Sale Start Time
            </label>
            <div className="relative">
              <FiCalendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="datetime-local"
                required
                value={startSaleAt}
                onChange={(e) => setStartSaleAt(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Sale End Time
            </label>
            <div className="relative">
              <FiCalendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="datetime-local"
                required
                value={endSaleAt}
                onChange={(e) => setEndSaleAt(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium border border-rose-200">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  <span>Registering in DB & Redis...</span>
                </>
              ) : (
                <>
                  <IoFlash className="w-4 h-4 text-amber-300" />
                  <span>Publish Flash Sale Event</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 rounded-xl text-center transition-colors"
            >
              Cancel and Go Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
