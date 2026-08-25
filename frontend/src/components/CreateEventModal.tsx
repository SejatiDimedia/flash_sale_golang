import React, { useState } from 'react';
import { FiX, FiPlus, FiCalendar, FiDollarSign, FiTag } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api } from '../lib/api';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const now = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalStock, setTotalStock] = useState<number>(100);
  const [price, setPrice] = useState<number>(750000);
  const [maxPerUser, setMaxPerUser] = useState<number>(2);
  const [startSaleAt, setStartSaleAt] = useState<string>(now.toISOString().slice(0, 16));
  const [endSaleAt, setEndSaleAt] = useState<string>(tomorrow.toISOString().slice(0, 16));
  const [status, setStatus] = useState<string>('ACTIVE');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Convert datetime-local string to ISO 8601 / RFC3339
      const startRFC = new Date(startSaleAt).toISOString();
      const endRFC = new Date(endSaleAt).toISOString();

      await api.createEvent({
        name,
        description,
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
      setError(err.message || 'Gagal menambahkan event baru');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-[36px] shadow-2xl border-4 border-white overflow-hidden max-h-[92vh] flex flex-col justify-between">
        <div className="overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-header-gradient flex items-center justify-center text-white shadow-btn">
                <FiPlus className="w-4 h-4" />
              </div>
              <h2 className="text-base font-black text-slate-900">
                Buat Event Flash Sale
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          <form id="create-event-form" onSubmit={handleSubmit} className="space-y-3">
            {/* Event Name */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Nama Event / Konser
              </label>
              <div className="relative">
                <FiTag className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Bruno Mars Live in Jakarta"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Deskripsi Singkat
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Konser tur dunia spektakuler dengan pengalaman audio visual terbaik..."
                className="w-full p-3 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-semibold text-slate-800 outline-none focus:border-app-purple resize-none"
              />
            </div>

            {/* Total Stock & Price */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Total Kuota Tiket
                </label>
                <div className="relative">
                  <HiTicket className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalStock}
                    onChange={(e) => setTotalStock(Number(e.target.value))}
                    className="w-full pl-9 pr-2 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Harga Tiket (Rp)
                </label>
                <div className="relative">
                  <FiDollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full pl-9 pr-2 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
                  />
                </div>
              </div>
            </div>

            {/* Max Per User & Status */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Maks / User (Anti-Scalper)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={maxPerUser}
                  onChange={(e) => setMaxPerUser(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Status Event
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
                >
                  <option value="ACTIVE">ACTIVE (Flash Sale)</option>
                  <option value="SCHEDULED">SCHEDULED (Segera)</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="CLOSED">CLOSED (Ditutup)</option>
                </select>
              </div>
            </div>

            {/* Start Sale Time & End Sale Time */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Waktu Mulai Penjualan
              </label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  required
                  value={startSaleAt}
                  onChange={(e) => setStartSaleAt(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                Waktu Berakhir Penjualan
              </label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  required
                  value={endSaleAt}
                  onChange={(e) => setEndSaleAt(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#F8F3FE] rounded-2xl border border-purple-100 text-xs font-bold text-slate-800 outline-none focus:border-app-purple"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer with Submit Button */}
        <div className="p-4 bg-white border-t border-purple-100">
          <button
            type="submit"
            form="create-event-form"
            disabled={isLoading}
            className="w-full py-3.5 bg-purple-btn text-white rounded-full text-xs font-black shadow-btn hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <CgSpinner className="w-4 h-4 animate-spin" />
                <span>Mendaftarkan Event ke Database & Redis...</span>
              </>
            ) : (
              <>
                <IoFlash className="w-4 h-4" />
                <span>Publikasikan Event Flash Sale 🚀</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
