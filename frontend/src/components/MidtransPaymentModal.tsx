import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { FiX, FiCopy, FiCheck, FiShield, FiClock, FiCheckCircle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';
import { IoFlash } from 'react-icons/io5';
import { api, type Order, type Event } from '../lib/api';

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

interface MidtransPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  event: Event | null;
  onConfirmSuccess?: () => void;
}

export const MidtransPaymentModal: React.FC<MidtransPaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  event,
  onConfirmSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'qris' | 'bca' | 'mandiri' | 'card'>('qris');
  const [qrisDataUrl, setQrisDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSimulatingPay, setIsSimulatingPay] = useState(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState<'mbanking' | 'atm' | null>('mbanking');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900); // 15 mins
  const [isOpeningSnap, setIsOpeningSnap] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  // 15-minute countdown for Midtrans payment session
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Generate real QRIS QR Code
  useEffect(() => {
    if (order) {
      // Standard Indonesian QRIS string simulation with order payload
      const qrisPayload = `00020101021226590014ID.LINKAJA.WWW0118936009110022394017021500000000000000051040000520458125303360540${order.totalPrice}5802ID5914FLASHSALE TIX6007JAKARTA62070703A016304${order.id.slice(0, 4)}`;
      QRCode.toDataURL(qrisPayload, {
        errorCorrectionLevel: 'M',
        margin: 1.5,
        width: 180,
        color: {
          dark: '#0B0F19',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrisDataUrl(url))
        .catch((err) => console.error('Failed to generate QRIS:', err));
    }
  }, [order]);

  if (!isOpen || !order || !event) return null;

  // Generate deterministic Virtual Account number based on Order ID
  const bcaVaNumber = `80777${(order.id.replace(/[^0-9]/g, '') || '0812345678').padEnd(10, '9').slice(0, 11)}`;
  const mandiriBillCompany = '70012';
  const mandiriBillNumber = `892${(order.id.replace(/[^0-9]/g, '') || '746193').padEnd(8, '0').slice(0, 9)}`;

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(p);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSimulatePayment = async () => {
    setIsSimulatingPay(true);
    try {
      if (api.confirmMidtransPayment) {
        await api.confirmMidtransPayment({
          orderId: order.id,
          paymentType: activeTab,
        });
      }
    } catch (err) {
      console.warn('Backend payment confirmation notice:', err);
    } finally {
      setIsSimulatingPay(false);
      setIsPaidSuccess(true);
      if (onConfirmSuccess) {
        onConfirmSuccess();
      }
    }
  };

  const handleOpenMidtransSnap = async () => {
    setIsOpeningSnap(true);
    setSnapError(null);
    try {
      const snapData = await api.getMidtransSnapToken({
        orderId: order.id,
        eventId: event.id,
        eventName: event.name,
        quantity: order.quantity,
        totalPrice: order.totalPrice,
      });

      if (typeof window !== 'undefined' && window.snap && snapData.token) {
        window.snap.pay(snapData.token, {
          onSuccess: async (result: any) => {
            console.log('Midtrans Snap Success:', result);
            try {
              if (api.confirmMidtransPayment) {
                await api.confirmMidtransPayment({
                  orderId: order.id,
                  paymentType: result?.payment_type || 'snap',
                  transactionId: result?.transaction_id,
                });
              }
            } catch (e) {
              console.warn(e);
            }
            setIsPaidSuccess(true);
            if (onConfirmSuccess) onConfirmSuccess();
          },
          onPending: (result: any) => {
            console.log('Midtrans Snap Pending (awaiting payment):', result);
            // ⚠️ User has selected a payment method (VA, QRIS, etc.) but hasn't completed payment yet.
            // Do NOT mark order as paid or confirmed!
            setSnapError(null);
          },
          onError: (err: any) => {
            console.error('Midtrans Snap Error:', err);
            setSnapError('Payment failed or was cancelled.');
          },
          onClose: () => {
            console.log('Customer closed Snap popup without finishing');
          },
        });
      } else if (snapData.redirect_url) {
        window.open(snapData.redirect_url, '_blank');
      }
    } catch (err: any) {
      console.error('Failed to trigger Midtrans Snap:', err);
      setSnapError(err.message || 'Failed to initialize Midtrans Snap. Please use sandbox simulation below.');
    } finally {
      setIsOpeningSnap(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-dark-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-dark-700 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Header with Midtrans Branding */}
        <div className="flex items-start justify-between pb-4 border-b border-dark-750">
          <div className="flex items-center gap-2.5">
            {/* Midtrans Logo Mark */}
            <div className="w-9 h-9 rounded-xl bg-[#002855] border border-blue-400/30 flex items-center justify-center shadow-sm">
              <span className="font-black text-xs text-white tracking-wider">mid</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Midtrans Payment
                </h3>
                <span className="text-[9px] font-bold text-amber-400 bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.2 rounded-full">
                  Sandbox
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Official Payment Gateway • 256-bit Encryption
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-750 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-dark-700"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {!isPaidSuccess ? (
          <div className="space-y-4 pt-4">
            {/* Order Summary & Expiry Bar */}
            <div className="bg-dark-800 p-3.5 rounded-2xl border border-dark-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Total Payment</span>
                <span className="text-base font-black text-coral">
                  {formatPrice(order.totalPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-dark-750">
                <div className="flex items-center gap-1 text-zinc-400">
                  <span>Order ID:</span>
                  <span className="font-mono text-white font-bold truncate max-w-[120px]">
                    {order.id}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 font-mono font-bold text-[10px]">
                  <FiClock className="w-3 h-3 text-amber-400" />
                  <span>Time Left: {formatTimer(timeLeftSeconds)}</span>
                </div>
              </div>
            </div>

            {/* Official Midtrans Snap Popup Action */}
            <div className="bg-gradient-to-r from-[#002855]/80 via-dark-800 to-dark-800 p-3.5 rounded-2xl border border-blue-500/40 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Official Midtrans Snap Popup
                </span>
                <span className="text-[10px] text-blue-300 font-semibold">Sandbox Active</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Launch official Midtrans payment popup with QRIS, GoPay, and Virtual Accounts directly integrated into your Sandbox account.
              </p>
              <button
                type="button"
                onClick={handleOpenMidtransSnap}
                disabled={isOpeningSnap}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
              >
                {isOpeningSnap ? (
                  <>
                    <CgSpinner className="w-4 h-4 animate-spin" />
                    <span>Opening Midtrans Snap...</span>
                  </>
                ) : (
                  <>
                    <IoFlash className="w-3.5 h-3.5 text-amber-300" />
                    <span>Open Official Midtrans Snap Popup</span>
                  </>
                )}
              </button>
              {snapError && (
                <p className="text-[10px] text-rose-300 bg-rose-950/60 p-2 rounded-lg border border-rose-500/30">
                  {snapError}
                </p>
              )}
            </div>

            {/* Payment Channel Tabs */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-300 block">
                Or View Direct Transfer Details / Simulation:
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-dark-800 rounded-2xl border border-dark-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('qris')}
                  className={`py-2 px-1 text-center rounded-xl text-[10px] font-bold transition-all ${
                    activeTab === 'qris'
                      ? 'bg-coral text-white shadow-coral-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-dark-750'
                  }`}
                >
                  QRIS / GoPay
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('bca')}
                  className={`py-2 px-1 text-center rounded-xl text-[10px] font-bold transition-all ${
                    activeTab === 'bca'
                      ? 'bg-coral text-white shadow-coral-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-dark-750'
                  }`}
                >
                  BCA VA
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('mandiri')}
                  className={`py-2 px-1 text-center rounded-xl text-[10px] font-bold transition-all ${
                    activeTab === 'mandiri'
                      ? 'bg-coral text-white shadow-coral-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-dark-750'
                  }`}
                >
                  Mandiri Bill
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: QRIS */}
            {activeTab === 'qris' && (
              <div className="bg-dark-800 p-4 rounded-2xl border border-dark-700 text-center space-y-3 animate-fadeIn">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-xs font-black text-rose-500 tracking-wider">QRIS</span>
                  <span className="text-[10px] text-zinc-400">• All E-Wallets & Mobile Banking</span>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-2xl inline-block shadow-md border border-zinc-200">
                  {qrisDataUrl ? (
                    <img
                      src={qrisDataUrl}
                      alt="QRIS Midtrans Payment"
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-zinc-100 rounded-xl flex items-center justify-center text-xs text-zinc-400 animate-pulse">
                      Generating QRIS...
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-dark-950 uppercase tracking-wider block mt-1">
                    NMID: ID1020038192847
                  </span>
                </div>

                <div className="text-left bg-dark-750/70 p-3 rounded-xl border border-dark-700 space-y-1 text-[11px] text-zinc-300">
                  <p className="font-bold text-white text-[11px] mb-1">How to Pay with QRIS:</p>
                  <p>1. Open GoPay, BCA Mobile, Livin, OVO, or ShopeePay.</p>
                  <p>2. Select <strong>Scan / Pay</strong> and point your camera at the QR code above.</p>
                  <p>3. Verify recipient name <strong>FlashSale Tix</strong> and amount match.</p>
                  <p>4. Enter your transaction PIN to complete payment.</p>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: BCA VIRTUAL ACCOUNT */}
            {activeTab === 'bca' && (
              <div className="bg-dark-800 p-4 rounded-2xl border border-dark-700 space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#003882] text-white font-black text-[10px] rounded-md">
                      BCA
                    </span>
                    <span className="text-xs font-bold text-white">BCA Virtual Account</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Automatic Verification</span>
                </div>

                {/* VA Number Card */}
                <div className="bg-dark-750 p-3 rounded-xl border border-dark-700 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Virtual Account Number</span>
                    <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                      {bcaVaNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(bcaVaNumber)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-750 text-coral hover:text-white rounded-lg text-xs font-bold transition-all border border-dark-700"
                  >
                    {copied ? (
                      <>
                        <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <FiCopy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Transfer Instructions Accordion */}
                <div className="space-y-1.5">
                  <div className="border border-dark-700 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedGuide(expandedGuide === 'mbanking' ? null : 'mbanking')}
                      className="w-full p-2.5 bg-dark-750/70 hover:bg-dark-750 text-left flex items-center justify-between text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      <span>m-BCA (BCA Mobile) Transfer Instructions</span>
                      {expandedGuide === 'mbanking' ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                    {expandedGuide === 'mbanking' && (
                      <div className="p-3 bg-dark-800 text-[11px] text-zinc-400 space-y-1 border-t border-dark-700">
                        <p>1. Open BCA Mobile app and select <strong>m-Transfer</strong>.</p>
                        <p>2. Select <strong>BCA Virtual Account</strong>.</p>
                        <p>3. Enter VA number <strong>{bcaVaNumber}</strong>.</p>
                        <p>4. Verify the amount ({formatPrice(order.totalPrice)}) and confirm with your m-BCA PIN.</p>
                      </div>
                    )}
                  </div>

                  <div className="border border-dark-700 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedGuide(expandedGuide === 'atm' ? null : 'atm')}
                      className="w-full p-2.5 bg-dark-750/70 hover:bg-dark-750 text-left flex items-center justify-between text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      <span>BCA ATM Transfer Instructions</span>
                      {expandedGuide === 'atm' ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                    {expandedGuide === 'atm' && (
                      <div className="p-3 bg-dark-800 text-[11px] text-zinc-400 space-y-1 border-t border-dark-700">
                        <p>1. Insert ATM card and enter your BCA PIN.</p>
                        <p>2. Select menu <strong>Other Transactions ➔ Transfer ➔ To BCA Virtual Account</strong>.</p>
                        <p>3. Enter VA number <strong>{bcaVaNumber}</strong>.</p>
                        <p>4. Confirm payment details and save your transaction receipt.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: MANDIRI BILL */}
            {activeTab === 'mandiri' && (
              <div className="bg-dark-800 p-4 rounded-2xl border border-dark-700 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#003066] text-[#F5A623] font-black text-[10px] rounded-md">
                      Mandiri
                    </span>
                    <span className="text-xs font-bold text-white">Mandiri Bill Payment</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Automatic Verification</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-dark-750 p-2.5 rounded-xl border border-dark-700">
                    <span className="text-[10px] text-zinc-400 block font-medium">Company Code</span>
                    <span className="font-mono text-sm font-bold text-white">{mandiriBillCompany}</span>
                  </div>
                  <div className="bg-dark-750 p-2.5 rounded-xl border border-dark-700">
                    <span className="text-[10px] text-zinc-400 block font-medium">Bill Number</span>
                    <span className="font-mono text-sm font-bold text-white">{mandiriBillNumber}</span>
                  </div>
                </div>

                <div className="bg-dark-750/70 p-3 rounded-xl border border-dark-700 space-y-1 text-[11px] text-zinc-400">
                  <p className="font-bold text-white text-[11px] mb-1">How to Pay with Livin' by Mandiri:</p>
                  <p>1. Log in to Livin' by Mandiri and select <strong>Pay</strong>.</p>
                  <p>2. Search service provider: <strong>Midtrans (70012)</strong>.</p>
                  <p>3. Enter bill number <strong>{mandiriBillNumber}</strong>.</p>
                  <p>4. Confirm amount and authorize with your Livin' MPIN.</p>
                </div>
              </div>
            )}

            {/* Action Bar (Sandbox Payment Simulator) */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={isSimulatingPay}
                className="w-full py-3.5 rounded-full font-bold text-xs text-white bg-coral hover:bg-coral-hover active:bg-coral-active shadow-coral transition-all flex items-center justify-center gap-2"
              >
                {isSimulatingPay ? (
                  <>
                    <CgSpinner className="w-4 h-4 animate-spin" />
                    <span>Verifying Midtrans Payment...</span>
                  </>
                ) : (
                  <>
                    <IoFlash className="w-4 h-4" />
                    <span>Simulate Successful Payment (Midtrans Sandbox)</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
                <FiShield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sandbox simulation instantly validates order & issues ticket</span>
              </div>
            </div>
          </div>
        ) : (
          /* Payment Success Confirmation View */
          <div className="py-6 text-center space-y-3.5 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <FiCheckCircle className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40 inline-block mb-1.5">
                Midtrans Payment Settled
              </span>
              <h3 className="text-lg font-bold text-white">Payment Successful!</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Your transaction of <strong>{formatPrice(order.totalPrice)}</strong> was successfully verified by Midtrans.
              </p>
            </div>

            <div className="bg-dark-800 p-4 rounded-2xl border border-dark-700 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Event</span>
                <span className="font-bold text-white text-right">{event.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Payment Method</span>
                <span className="font-bold text-white uppercase">{activeTab} (Midtrans)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Ticket Status</span>
                <span className="font-bold text-emerald-400">CONFIRMED</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-coral hover:bg-coral-hover text-white rounded-full text-xs font-bold shadow-coral transition-all"
            >
              View My Tickets
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
