import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketBarcode } from './TicketBarcode';

describe('TicketBarcode Component', () => {
  it('renders Code-128 barcode mode by default', () => {
    const { container } = render(<TicketBarcode value="BLK-COLDPLAY-9821" orderId="ord-1" />);

    expect(screen.getByText('Barcode (Gate Scanner)')).toBeInTheDocument();
    expect(screen.getByText('QR Code (Mobile Scan)')).toBeInTheDocument();
    expect(screen.getByText('Official Entry Gate Scanner Format (Code 128)')).toBeInTheDocument();
    
    // Check that SVG element for JsBarcode is present
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('switches to QR Code mode when toggle button clicked', async () => {
    render(<TicketBarcode value="BLK-COLDPLAY-9821" orderId="ord-1" />);

    const qrToggle = screen.getByText('QR Code (Mobile Scan)');
    fireEvent.click(qrToggle);

    await waitFor(() => {
      expect(screen.getByText('Scan with Smartphone Camera')).toBeInTheDocument();
      expect(screen.getByText('BLK-COLDPLAY-9821')).toBeInTheDocument();
    });
  });
});
