import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { FiMaximize2 } from 'react-icons/fi';

interface TicketBarcodeProps {
  value: string;
  orderId?: string;
}

export const TicketBarcode: React.FC<TicketBarcodeProps> = ({ value, orderId }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [mode, setMode] = useState<'barcode' | 'qr'>('barcode');

  // Render authentic Code-128 1D Barcode
  useEffect(() => {
    if (mode === 'barcode' && barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 62,
          displayValue: true,
          font: 'monospace',
          fontSize: 13,
          fontOptions: 'bold',
          textMargin: 5,
          margin: 6,
          background: '#FFFFFF',
        });
      } catch (err) {
        console.error('Failed to render Code128 barcode:', err);
      }
    }
  }, [value, mode]);

  // Generate authentic 2D QR Code
  useEffect(() => {
    if (value) {
      const payload = `https://flashsale.tickets/gate/verify?code=${encodeURIComponent(value)}&id=${encodeURIComponent(orderId || '')}`;
      QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 1.5,
        width: 170,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to render QR Code:', err));
    }
  }, [value, orderId]);

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Format Toggle Pill: 1D Barcode vs 2D QR Code */}
      <div className="inline-flex items-center p-1 bg-dark-750 rounded-full border border-dark-700 text-[10px] font-bold shadow-xs">
        <button
          type="button"
          onClick={() => setMode('barcode')}
          className={`px-3 py-1 rounded-full transition-all ${
            mode === 'barcode'
              ? 'bg-coral text-white shadow-coral-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Barcode (Gate Scanner)
        </button>
        <button
          type="button"
          onClick={() => setMode('qr')}
          className={`px-3 py-1 rounded-full transition-all ${
            mode === 'qr'
              ? 'bg-coral text-white shadow-coral-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          QR Code (Mobile Scan)
        </button>
      </div>

      {/* Real Barcode / QR Surface */}
      <div className="w-full bg-white p-4 rounded-2xl shadow-md border border-zinc-200 flex flex-col items-center justify-center transition-all min-h-[140px]">
        {mode === 'barcode' ? (
          <div className="flex flex-col items-center w-full">
            <svg ref={barcodeRef} className="w-full max-w-[280px] h-auto mx-auto" />
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
              Official Entry Gate Scanner Format (Code 128)
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Real QR Code for ticket ${value}`}
                className="w-36 h-36 object-contain"
              />
            ) : (
              <div className="w-36 h-36 bg-zinc-100 rounded-xl flex items-center justify-center text-xs text-zinc-400 animate-pulse">
                Generating Real QR Code...
              </div>
            )}
            <span className="font-mono text-xs font-bold text-black tracking-wider mt-1.5">
              {value}
            </span>
            <span className="text-[9px] text-zinc-500 font-medium tracking-wider uppercase mt-0.5">
              Scan with Smartphone Camera
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
        <FiMaximize2 className="w-3 h-3 text-coral" />
        <span>Turn up screen brightness for fast scanning at the gate</span>
      </div>
    </div>
  );
};
