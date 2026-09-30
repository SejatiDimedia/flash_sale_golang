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
    <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          title="Close"
        >
          <FiX className="w-4 h-4" />
        </button>

        {!order ? (
          <div>
            <div className="mb-4 pr-6">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold mb-1.5 border border-indigo-100">
                <IoFlash className="w-3.5 h-3.5 text-indigo-600" />
                Express Checkout
              </span>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {event.name}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Remaining Quota: <strong className="text-indigo-600 font-bold">{event.availableStock} tickets</strong>
              </p>
            </div>

            {/* Quantity Selector Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Ticket Quantity (Max. {event.maxPerUser}):</span>
                <div className="flex items-center gap-3 bg-white rounded-lg p-1 border border-slate-300 shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm transition-colors"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm w-4 text-center text-slate-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(event.maxPerUser, quantity + 1))}
                    className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Total Amount:</span>
                <span className="text-lg font-black text-slate-900 tracking-tight">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium mb-4">
              <FiShield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Redis Lua Lock (100% Zero-Oversell Guaranteed)</span>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing || event.availableStock <= 0}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-btn transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <CgSpinner className="w-4 h-4 animate-spin" />
                  Securing Stock in Redis...
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
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <FiCheckCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Order Confirmed!
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Your ticket purchase has been confirmed and quota securely deducted.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left mb-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                    Official E-Ticket
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">{event.name}</h4>
                </div>
                <HiTicket className="w-6 h-6 text-indigo-600 shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Status</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                    {order.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Quantity</span>
                  <span className="font-bold text-slate-800">{order.quantity} Tickets</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Total Paid</span>
                  <span className="font-bold text-slate-900">{formatPrice(order.totalPrice)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Order ID</span>
                  <span className="font-mono text-[10px] text-slate-600 truncate block">{order.id}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
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
