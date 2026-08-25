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
            // Instant Pass: User is admitted immediately without waiting (NO NOTIFICATION SPAM)
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
            // Delayed Admission: User was actually waiting in the queue and just got admitted (SEND NOTIFICATION)
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
      <div className="relative w-full max-w-sm bg-white rounded-[36px] p-6 shadow-2xl border-4 border-white overflow-hidden text-center">
        {/* Background Glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-300/30 rounded-full blur-2xl pointer-events-none"></div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F5EEFD] text-app-purple rounded-full text-xs font-black mb-3">
          <FiShield className="w-3.5 h-3.5" />
          Virtual Waiting Room
        </div>

        <h2 className="text-xl font-black text-app-dark leading-tight mb-1">
          {isAdmitted ? "It's Your Turn!" : 'You Are in the Queue'}
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          {event.name} • Securing fair access for all
        </p>

        {/* Animated Radar Container */}
        <div className="flex flex-col items-center justify-center my-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CgSpinner className="w-10 h-10 text-app-purple animate-spin" />
              <span className="text-xs font-bold text-slate-400">Assigning queue ticket...</span>
            </div>
          ) : isAdmitted ? (
            <div className="flex flex-col items-center gap-3 py-4 animate-bounce">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white">
                <IoSparkles className="w-10 h-10" />
              </div>
              <span className="text-sm font-black text-emerald-600">
                Checkout Pass Active (5 Mins)!
              </span>
            </div>
          ) : (
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-purple-300/30 animate-ping"></div>
              <div className="absolute inset-3 rounded-full bg-purple-200/40"></div>
              <div className="relative w-24 h-24 rounded-full bg-header-gradient p-1 shadow-lg shadow-purple-500/25 flex items-center justify-center">
                <div className="w-full h-full bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Position #
                  </span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-app-purple to-app-magenta">
                    #{queueStatus?.position || 1}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Queue Statistics Card */}
          {!isLoading && !isAdmitted && (
            <div className="w-full grid grid-cols-2 gap-2.5 mt-5">
              <div className="bg-[#F8F3FE] rounded-2xl p-3 text-center border border-purple-100">
                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Total in Queue</span>
                <span className="text-sm font-black text-slate-800 flex items-center justify-center gap-1">
                  <FiUsers className="w-3.5 h-3.5 text-app-purple" />
                  {queueStatus?.totalInQueue || 1} Users
                </span>
              </div>
              <div className="bg-[#F8F3FE] rounded-2xl p-3 text-center border border-purple-100">
                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Estimated Wait</span>
                <span className="text-sm font-black text-app-magenta">
                  ~{Math.max(1, Math.ceil((queueStatus?.position || 1) / 10))} Mins
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 p-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold w-full">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="w-1/3 py-3.5 rounded-full text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>

          {isAdmitted ? (
            <button
              onClick={() => onAdmitted(true)}
              className="w-2/3 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 animate-pulse"
            >
              Proceed to Checkout <FiArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-2/3 py-3.5 bg-[#F5EEFD] text-app-purple border border-purple-200 rounded-full text-xs font-black flex items-center justify-center gap-2">
              <CgSpinner className="w-4 h-4 animate-spin" />
              Waiting in Queue...
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
