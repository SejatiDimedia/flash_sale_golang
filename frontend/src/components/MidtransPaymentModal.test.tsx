import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MidtransPaymentModal } from './MidtransPaymentModal';
import type { Order, Event } from '../lib/api';

const mockOrder: Order = {
  id: 'ord-midtrans-1234',
  userId: 'user-1',
  eventId: 'event-1',
  quantity: 2,
  totalPrice: 1500000,
  status: 'CONFIRMED',
  createdAt: '2026-10-01T10:00:00Z',
};

const mockEvent: Event = {
  id: 'event-1',
  name: 'Coldplay Live in Jakarta',
  description: 'World Tour',
  category: 'concerts',
  totalStock: 100,
  availableStock: 50,
  price: 750000,
  maxPerUser: 4,
  status: 'ACTIVE',
  startSaleAt: '2026-10-01T10:00:00Z',
  endSaleAt: '2026-10-02T10:00:00Z',
};

describe('MidtransPaymentModal Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'CONFIRMED', order: mockOrder }),
    } as any);
  });

  it('renders Midtrans Payment Header and default QRIS view', async () => {
    render(
      <MidtransPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        order={mockOrder}
        event={mockEvent}
      />
    );

    expect(screen.getByText('Midtrans Payment')).toBeInTheDocument();
    expect(screen.getByText('QRIS / GoPay')).toBeInTheDocument();
    expect(screen.getByText('BCA VA')).toBeInTheDocument();
    expect(screen.getByText('Mandiri Bill')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*1\.500\.000/)).toBeInTheDocument();
  });

  it('switches to BCA Virtual Account and shows copyable VA number', async () => {
    render(
      <MidtransPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        order={mockOrder}
        event={mockEvent}
      />
    );

    const bcaTab = screen.getByText('BCA VA');
    fireEvent.click(bcaTab);

    expect(screen.getAllByText('BCA Virtual Account')[0]).toBeInTheDocument();
    expect(screen.getByText('Virtual Account Number')).toBeInTheDocument();
    expect(screen.getAllByText(/80777/)[0]).toBeInTheDocument();
  });

  it('triggers payment simulation and shows settled success screen', async () => {
    const onConfirmSuccess = vi.fn();
    render(
      <MidtransPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        order={mockOrder}
        event={mockEvent}
        onConfirmSuccess={onConfirmSuccess}
      />
    );

    const simulateBtn = screen.getByText(/Simulate Successful Payment/i);
    fireEvent.click(simulateBtn);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      expect(screen.getByText('Midtrans Payment Settled')).toBeInTheDocument();
      expect(onConfirmSuccess).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
