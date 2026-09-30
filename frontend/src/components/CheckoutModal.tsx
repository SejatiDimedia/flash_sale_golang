import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheckCircle, FiAlertCircle, FiShield } from 'react-icons/fi';
import { IoFlash } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { HiTicket } from 'react-icons/hi2';
import confetti from 'canvas-confetti';
import { api, type Event, type Order } from '../lib/api';
import { subscribeOrderStatus } from '../lib/ws';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setIsProcessing(false);
      setOrder(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!order || order.status === 'CONFIRMED') return;

    const unsubscribe = subscribeOrderStatus(order.id, (updatedOrder) => {
      setOrder(updatedOrder);
      if (updatedOrder.status === 'CONFIRMED') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4F46E5', '#10B981', '#6366F1', '#38BDF8'],
        });
        onSuccess();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [order, onSuccess]);

  if (!isOpen || !event) return null;

  const totalPrice = event.price * quantity;

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const res = await api.purchaseTicket(event.id, quantity);
      setOrder(res);
      setIsProcessing(false);

      if (res.status === 'CONFIRMED') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process ticket purchase');
      setIsProcessing(false);
    }
  };

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(p);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-dark-900 rounded-3xl p-6 shadow-2xl border border-dark-700 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-dark-700"
          title="Close"
        >
          <FiX className="w-4 h-4" />
        </button>

        {!order ? (
          <div>
            <div className="mb-4 pr-6">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-dark-800 text-coral rounded-full text-xs font-bold mb-2 border border-dark-700">
                <IoFlash className="w-3.5 h-3.5 text-coral" />
                Express Checkout
              </span>
              <h2 className="text-lg font-bold text-white leading-snug">
                {event.name}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Remaining Quota: <strong className="text-coral font-bold">{event.availableStock} tickets</strong>
              </p>
            </div>

            {/* Quantity Selector Card */}
            <div className="bg-dark-800 rounded-2xl p-4 border border-dark-700 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Ticket Quantity (Max. {event.maxPerUser}):</span>
                <div className="flex items-center gap-3 bg-dark-750 rounded-xl p-1 border border-dark-700 shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-700 text-white font-bold flex items-center justify-center text-sm transition-colors border border-dark-700"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm w-4 text-center text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(event.maxPerUser, quantity + 1))}
                    className="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-700 text-white font-bold flex items-center justify-center text-sm transition-colors border border-dark-700"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-dark-700">
                <span className="text-xs text-zinc-400 font-medium">Total Amount:</span>
                <span className="text-lg font-black text-coral tracking-tight">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-medium mb-4">
              <FiShield className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Official Tickets • Guaranteed Reservation</span>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing || event.availableStock <= 0}
              className="w-full py-3.5 rounded-full font-bold text-xs text-white bg-coral hover:bg-coral-hover active:bg-coral-active shadow-coral transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  Securing Your Tickets...
                </>
              ) : (
                <>
                  <IoFlash className="w-4 h-4" />
                  PAY NOW ({formatPrice(totalPrice)})
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center py-2 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/40">
              <FiCheckCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">
              Order Confirmed!
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Your ticket purchase is confirmed and your booking is complete.
            </p>

            <div className="bg-dark-800 rounded-2xl p-4 border border-dark-700 text-left mb-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-bold text-coral uppercase tracking-wider block">
                    Official E-Ticket
                  </span>
                  <h4 className="font-bold text-white text-sm">{event.name}</h4>
                </div>
                <HiTicket className="w-6 h-6 text-coral shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-dark-700">
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium block">Status</span>
                  <span className="font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-md inline-block">
                    {order.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium block">Quantity</span>
                  <span className="font-bold text-white">{order.quantity} Tickets</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium block">Total Paid</span>
                  <span className="font-bold text-coral">{formatPrice(order.totalPrice)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium block">Order ID</span>
                  <span className="font-mono text-[10px] text-zinc-400 truncate block">{order.id}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-full text-xs font-bold text-white bg-dark-750 hover:bg-dark-700 border border-dark-700 transition-colors"
            >
              Done & Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
