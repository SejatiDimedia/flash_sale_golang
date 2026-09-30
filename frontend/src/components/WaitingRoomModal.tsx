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
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-dark-900 rounded-3xl p-6 shadow-2xl border border-dark-700 overflow-hidden text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-dark-800 text-coral rounded-full text-xs font-bold mb-3 border border-dark-700">
          <FiShield className="w-3.5 h-3.5" />
          Virtual Waiting Room
        </div>

        <h2 className="text-xl font-bold text-white leading-tight mb-1">
          {isAdmitted ? "It's Your Turn!" : 'Live Ticket Queue'}
        </h2>
        <p className="text-xs text-zinc-400 mb-6">
          {event.name} • Securing fair access for all
        </p>

        {/* Animated Queue Position Radar */}
        <div className="flex flex-col items-center justify-center my-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CgSpinner className="w-9 h-9 text-coral animate-spin" />
              <span className="text-xs font-semibold text-zinc-400">Preparing your queue ticket...</span>
            </div>
          ) : isAdmitted ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg text-white">
                <IoSparkles className="w-8 h-8" />
              </div>
              <span className="text-sm font-bold text-emerald-400">
                Checkout Session Active (5 Min)!
              </span>
            </div>
          ) : (
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-coral/20 animate-ping"></div>
              <div className="absolute inset-3 rounded-full bg-dark-800 border border-dark-700"></div>
              <div className="relative w-24 h-24 rounded-full bg-dark-950 shadow-md flex items-center justify-center text-white border border-dark-700">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">
                    Position
                  </span>
                  <span className="text-2xl font-black text-coral">
                    #{queueStatus?.position || 1}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Queue Statistics Card */}
          {!isLoading && !isAdmitted && (
            <div className="w-full grid grid-cols-2 gap-2.5 mt-5">
              <div className="bg-dark-800 rounded-2xl p-3 text-center border border-dark-700">
                <span className="text-[10px] font-semibold text-zinc-400 block mb-0.5">Total in Queue</span>
                <span className="text-sm font-bold text-white flex items-center justify-center gap-1">
                  <FiUsers className="w-3.5 h-3.5 text-coral" />
                  {queueStatus?.totalInQueue || 1} Users
                </span>
              </div>
              <div className="bg-dark-800 rounded-2xl p-3 text-center border border-dark-700">
                <span className="text-[10px] font-semibold text-zinc-400 block mb-0.5">Est. Wait Time</span>
                <span className="text-sm font-bold text-coral">
                  ~{Math.max(1, Math.ceil((queueStatus?.position || 1) / 10))} Min
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 p-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-2xl text-xs font-semibold w-full">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 mt-6">
          <button
            onClick={onClose}
            className="w-1/3 py-3 rounded-full text-xs font-semibold text-zinc-400 bg-dark-800 hover:bg-dark-750 border border-dark-700 transition-colors"
          >
            Cancel
          </button>

          {isAdmitted ? (
            <button
              onClick={() => onAdmitted(true)}
              className="w-2/3 py-3 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral flex items-center justify-center gap-1.5 transition-colors"
            >
              Proceed to Checkout <FiArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-2/3 py-3 bg-dark-800 text-zinc-400 border border-dark-700 rounded-full text-xs font-bold flex items-center justify-center gap-2">
              <CgSpinner className="w-4 h-4 animate-spin text-coral" />
              Waiting in Line...
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
