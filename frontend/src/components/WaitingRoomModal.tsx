import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiShield, FiUsers, FiArrowRight } from 'react-icons/fi';
import { IoSparkles } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api, type Event, type QueueStatus } from '../lib/api';

interface WaitingRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  onAdmitted: (wasWaiting?: boolean) => void;
}

export const WaitingRoomModal: React.FC<WaitingRoomModalProps> = ({
  isOpen,
  onClose,
  event,
  onAdmitted,
}) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !event) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const initQueue = async () => {
      try {
        localStorage.setItem('activeQueueEventId', event.id);
        const res = await api.joinWaitingRoom(event.id);
        if (isMounted) {
          setQueueStatus(res);
          setIsLoading(false);

          if (res.isAllowedToPurchase) {
            onAdmitted(false);
            return;
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to join waiting room');
          setIsLoading(false);
        }
      }
    };

    initQueue();

    const interval = setInterval(async () => {
      try {
        const status = await api.getQueueStatus(event.id);
        if (isMounted) {
          setQueueStatus(status);
          if (status.isAllowedToPurchase) {
            clearInterval(interval);
            onAdmitted(true);
          }
        }
      } catch (e) {
        // Silently retry
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  const isAdmitted = queueStatus?.isAllowedToPurchase;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 overflow-hidden text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold mb-3 border border-indigo-100">
          <FiShield className="w-3.5 h-3.5" />
          Virtual Waiting Room
        </div>

        <h2 className="text-xl font-bold text-slate-900 leading-tight mb-1">
          {isAdmitted ? "It's Your Turn!" : 'Antrean Tiket Aktif'}
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          {event.name} • Securing fair access for all
        </p>

        {/* Animated Queue Position Radar */}
        <div className="flex flex-col items-center justify-center my-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CgSpinner className="w-9 h-9 text-indigo-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-500">Mempersiapkan nomor antrean...</span>
            </div>
          ) : isAdmitted ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg text-white">
                <IoSparkles className="w-8 h-8" />
              </div>
              <span className="text-sm font-bold text-emerald-600">
                Sesi Checkout Aktif (5 Menit)!
              </span>
            </div>
          ) : (
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-indigo-100/60 animate-ping"></div>
              <div className="absolute inset-3 rounded-full bg-indigo-50 border border-indigo-100"></div>
              <div className="relative w-24 h-24 rounded-full bg-slate-900 shadow-md flex items-center justify-center text-white">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Posisi
                  </span>
                  <span className="text-2xl font-black text-white">
                    #{queueStatus?.position || 1}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Queue Statistics Card */}
          {!isLoading && !isAdmitted && (
            <div className="w-full grid grid-cols-2 gap-2.5 mt-5">
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Total Antrean</span>
                <span className="text-sm font-bold text-slate-900 flex items-center justify-center gap-1">
                  <FiUsers className="w-3.5 h-3.5 text-indigo-600" />
                  {queueStatus?.totalInQueue || 1} Users
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Estimasi Waktu</span>
                <span className="text-sm font-bold text-indigo-600">
                  ~{Math.max(1, Math.ceil((queueStatus?.position || 1) / 10))} Menit
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold w-full">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 mt-6">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>

          {isAdmitted ? (
            <button
              onClick={() => onAdmitted(true)}
              className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              Lanjut ke Checkout <FiArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-2/3 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <CgSpinner className="w-4 h-4 animate-spin text-indigo-600" />
              Menunggu Giliran...
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
