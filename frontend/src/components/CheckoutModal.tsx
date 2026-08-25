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
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#d946ef', '#c084fc', '#e879f9'],
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
          particleCount: 120,
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
      <div className="relative w-full max-w-sm bg-white rounded-[36px] p-6 shadow-2xl border-4 border-white overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>

        {!order ? (
          <div>
            <div className="mb-4">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5EEFD] text-app-purple rounded-full text-xs font-black mb-1">
                <IoFlash className="w-3.5 h-3.5 text-app-purple" />
                Express Checkout
              </span>
              <h2 className="text-xl font-black text-app-dark leading-tight">
                {event.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Available Stock: <strong className="text-app-purple">{event.availableStock} tickets</strong>
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="bg-[#F8F3FE] rounded-2xl p-4 border border-purple-100 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">Ticket Quantity (Max. {event.maxPerUser}):</span>
                <div className="flex items-center gap-3 bg-white rounded-xl p-1 border border-purple-200 shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 rounded-lg bg-[#F5EEFD] text-app-purple font-black hover:bg-purple-100 flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <span className="font-extrabold text-sm w-4 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(event.maxPerUser, quantity + 1))}
                    className="w-7 h-7 rounded-lg bg-[#F5EEFD] text-app-purple font-black hover:bg-purple-100 flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                <span className="text-xs text-slate-500 font-semibold">Total Price:</span>
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-app-purple to-app-magenta">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-4">
              <FiShield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Redis Lua Lock (100% Zero-Oversell)</span>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isProcessing || event.availableStock <= 0}
              className="w-full py-4 rounded-full font-black text-sm text-white bg-purple-btn hover:opacity-95 shadow-btn transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <CgSpinner className="w-5 h-5 animate-spin" />
                  Locking Stock in Redis...
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
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30 text-white">
              <FiCheckCircle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-1">
              Ticket Successfully Purchased!
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Your order is confirmed and stock has been securely reserved.
            </p>

            <div className="bg-[#F8F3FE] rounded-2xl p-4 border border-purple-200 text-left mb-6 relative overflow-hidden">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-black text-app-purple uppercase tracking-widest block">
                    Official E-Ticket
                  </span>
                  <h4 className="font-extrabold text-slate-800 text-sm">{event.name}</h4>
                </div>
                <HiTicket className="w-7 h-7 text-app-purple shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-purple-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Status</span>
                  <span className="font-extrabold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full inline-block">
                    {order.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Quantity</span>
                  <span className="font-extrabold text-slate-700">{order.quantity} Tickets</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Total Paid</span>
                  <span className="font-extrabold text-app-purple">{formatPrice(order.totalPrice)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Order ID</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate block">{order.id}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-full text-xs font-black text-white bg-purple-btn hover:opacity-95 shadow-btn transition-all"
            >
              Close & Finish
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
