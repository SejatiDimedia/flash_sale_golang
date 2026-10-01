import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheck, FiDollarSign, FiTag, FiUsers, FiClock } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { CgSpinner } from 'react-icons/cg';
import { api, type Event } from '../lib/api';

interface EditEventModalProps {
  isOpen: boolean;
  event: Event | null;
  onClose: () => void;
  onSuccess: () => void;
}

const categoryOptions = [
  { id: 'concerts', label: 'Concerts' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'sports', label: 'Sports' },
  { id: 'social', label: 'Social' },
];

const statusOptions: Array<{ id: 'ACTIVE' | 'SCHEDULED' | 'DRAFT' | 'CLOSED'; label: string; desc: string }> = [
  { id: 'ACTIVE', label: 'Active', desc: 'War tickets open & live' },
  { id: 'SCHEDULED', label: 'Scheduled', desc: 'Sale countdown preview' },
  { id: 'DRAFT', label: 'Draft', desc: 'Hidden from public feed' },
  { id: 'CLOSED', label: 'Closed', desc: 'Sale ended / Sold out' },
];

const toLocalInputString = (isoString?: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export const EditEventModal: React.FC<EditEventModalProps> = ({
  isOpen,
  event,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('concerts');
  const [totalStock, setTotalStock] = useState<number>(100);
  const [price, setPrice] = useState<number>(500000);
  const [maxPerUser, setMaxPerUser] = useState<number>(1);
  const [startSaleAt, setStartSaleAt] = useState<string>('');
  const [endSaleAt, setEndSaleAt] = useState<string>('');
  const [status, setStatus] = useState<'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'CLOSED'>('ACTIVE');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setName(event.name);
      setDescription(event.description || '');
      setCategory(event.category || 'concerts');
      setTotalStock(event.totalStock);
      setPrice(event.price);
      setMaxPerUser(event.maxPerUser || 1);
      setStartSaleAt(toLocalInputString(event.startSaleAt));
      setEndSaleAt(toLocalInputString(event.endSaleAt));
      setStatus(event.status);
      setError(null);
    }
  }, [event, isOpen]);

  if (!isOpen || !event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const startRFC = new Date(startSaleAt).toISOString();
      const endRFC = new Date(endSaleAt).toISOString();

      await api.updateEvent(event.id, {
        name,
        description: description || undefined,
        category,
        totalStock: Number(totalStock),
        price: Number(price),
        maxPerUser: Number(maxPerUser),
        startSaleAt: startRFC,
        endSaleAt: endRFC,
        status,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update event');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPricePreview = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-dark-900 rounded-3xl p-5 shadow-2xl border border-dark-700 max-h-[90vh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-dark-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-coral/10 text-coral flex items-center justify-center border border-coral/20">
              <HiTicket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                Edit Ticket & Event
              </h3>
              <p className="text-[10px] text-zinc-400">
                Update event parameters, pricing, and live inventory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-dark-700"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="edit-event-form" onSubmit={handleSubmit} className="overflow-y-auto no-scrollbar flex-1 py-3.5 space-y-3.5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Event Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Event / Concert Name
            </label>
            <div className="relative">
              <FiTag className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coldplay: Music of the Spheres"
                className="w-full pl-10 pr-3 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {categoryOptions.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                    category === cat.id
                      ? 'bg-coral text-white border-coral shadow-coral'
                      : 'bg-dark-800 text-zinc-400 border-dark-700 hover:border-dark-600 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Event Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setStatus(st.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    status === st.id
                      ? 'bg-dark-750 border-coral shadow-coral-sm'
                      : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-xs font-bold ${
                        status === st.id ? 'text-coral' : 'text-zinc-200'
                      }`}
                    >
                      {st.label}
                    </span>
                    {status === st.id && (
                      <span className="w-2 h-2 rounded-full bg-coral animate-pulse"></span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 block leading-tight">
                    {st.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-300">Ticket Price</label>
                <span className="text-[10px] text-coral font-bold truncate max-w-[90px]">
                  {formatPricePreview(price)}
                </span>
              </div>
              <div className="relative">
                <FiDollarSign className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="number"
                  required
                  min={0}
                  step={5000}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full pl-10 pr-3 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white focus:outline-none focus:border-coral transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-300">Total Stock</label>
                <span className="text-[10px] text-zinc-400 font-semibold">
                  Avail: {event.availableStock}
                </span>
              </div>
              <div className="relative">
                <HiTicket className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="number"
                  required
                  min={1}
                  value={totalStock}
                  onChange={(e) => setTotalStock(Number(e.target.value))}
                  className="w-full pl-10 pr-3 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white focus:outline-none focus:border-coral transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Max per User */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Max Tickets Per User (War Limit)
            </label>
            <div className="relative">
              <FiUsers className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="number"
                required
                min={1}
                max={10}
                value={maxPerUser}
                onChange={(e) => setMaxPerUser(Number(e.target.value))}
                className="w-full pl-10 pr-3 py-2.5 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white focus:outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1 flex items-center gap-1">
                <FiClock className="w-3 h-3 text-coral" />
                <span>Start Sale</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startSaleAt}
                onChange={(e) => setStartSaleAt(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white focus:outline-none focus:border-coral transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1 flex items-center gap-1">
                <FiClock className="w-3 h-3 text-zinc-400" />
                <span>End Sale</span>
              </label>
              <input
                type="datetime-local"
                required
                value={endSaleAt}
                onChange={(e) => setEndSaleAt(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white focus:outline-none focus:border-coral transition-colors"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Description & Location
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Gelora Bung Karno Stadium, Jakarta"
              className="w-full px-3 py-2 bg-dark-800 rounded-xl border border-dark-700 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-coral transition-colors resize-none"
            />
          </div>
        </form>

        {/* Action Buttons Footer */}
        <div className="pt-3 border-t border-dark-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-750 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-colors border border-dark-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-event-form"
            disabled={isLoading}
            className="flex-1 py-2.5 bg-coral hover:bg-coral-hover text-white rounded-xl text-xs font-bold shadow-coral transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <CgSpinner className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <FiCheck className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
