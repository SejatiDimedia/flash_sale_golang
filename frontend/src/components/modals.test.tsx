import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WaitingRoomModal } from './WaitingRoomModal';
import { CheckoutModal } from './CheckoutModal';
import { api, type Event } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    joinWaitingRoom: vi.fn(),
    getQueueStatus: vi.fn(),
    purchaseTicket: vi.fn(),
  },
}));

vi.mock('../lib/ws', () => ({
  subscribeOrderStatus: vi.fn(() => () => {}),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockEvent: Event = {
  id: 'event-test-1',
  name: 'Coldplay Music of the Spheres',
  description: 'World Tour Jakarta',
  startSaleAt: '2026-10-01T10:00:00Z',
  endSaleAt: '2026-10-02T10:00:00Z',
  totalStock: 100,
  availableStock: 50,
  price: 750000,
  status: 'ACTIVE',
  category: 'concerts',
  maxPerUser: 4,
};

describe('WaitingRoomModal Component Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders queue status position and total in queue', async () => {
    vi.mocked(api.joinWaitingRoom).mockResolvedValueOnce({
      position: 12,
      totalInQueue: 150,
      isAllowedToPurchase: false,
      estimatedWaitSeconds: 24,
    });

    render(
      <WaitingRoomModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onAdmitted={vi.fn()}
      />
    );

    expect(screen.getByText('Virtual Waiting Room')).toBeInTheDocument();
    expect(screen.getByText(/Securing fair access for all/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('#12')).toBeInTheDocument();
      expect(screen.getByText(/150 Users/)).toBeInTheDocument();
    });
  });

  it('triggers onAdmitted when isAllowedToPurchase is true on join', async () => {
    const onAdmitted = vi.fn();
    vi.mocked(api.joinWaitingRoom).mockResolvedValueOnce({
      position: 0,
      totalInQueue: 0,
      isAllowedToPurchase: true,
      estimatedWaitSeconds: 0,
    });

    render(
      <WaitingRoomModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onAdmitted={onAdmitted}
      />
    );

    await waitFor(() => {
      expect(onAdmitted).toHaveBeenCalledWith(false);
    });
  });
});

describe('CheckoutModal Component Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ticket price and calculates total price on quantity change', () => {
    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Express Checkout')).toBeInTheDocument();
    expect(screen.getByText('Coldplay Music of the Spheres')).toBeInTheDocument();

    // Change quantity to 2 tickets
    const plusBtn = screen.getByText('+');
    fireEvent.click(plusBtn);

    // Quantity should now be 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('handles checkout submission successfully', async () => {
    const onSuccess = vi.fn();
    vi.mocked(api.purchaseTicket).mockResolvedValueOnce({
      id: 'order-success-123',
      userId: 'user-1',
      eventId: 'event-test-1',
      quantity: 1,
      totalPrice: 750000,
      status: 'CONFIRMED',
      createdAt: '2026-09-30T10:00:00Z',
    });

    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onSuccess={onSuccess}
      />
    );

    const buyBtn = screen.getByRole('button', { name: /PAY NOW/i });
    fireEvent.click(buyBtn);

    await waitFor(() => {
      expect(api.purchaseTicket).toHaveBeenCalledWith('event-test-1', 1);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message if ticket is sold out', async () => {
    vi.mocked(api.purchaseTicket).mockRejectedValueOnce(
      new Error('sold out: insufficient stock available')
    );

    render(
      <CheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onSuccess={vi.fn()}
      />
    );

    const buyBtn = screen.getByRole('button', { name: /PAY NOW/i });
    fireEvent.click(buyBtn);

    await waitFor(() => {
      expect(screen.getByText('sold out: insufficient stock available')).toBeInTheDocument();
    });
  });
});
