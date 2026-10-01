import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditEventModal } from './EditEventModal';
import { api, type Event } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    updateEvent: vi.fn(),
  },
}));

const mockEvent: Event = {
  id: 'ev-test-101',
  name: 'Coldplay Live in Jakarta',
  description: 'Gelora Bung Karno Main Stadium',
  startSaleAt: '2026-10-01T12:00:00.000Z',
  endSaleAt: '2026-10-02T12:00:00.000Z',
  totalStock: 500,
  availableStock: 350,
  price: 1250000,
  status: 'ACTIVE',
  category: 'concerts',
  maxPerUser: 2,
};

describe('EditEventModal Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with prefilled event data when open', () => {
    render(
      <EditEventModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Ticket & Event')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Coldplay Live in Jakarta')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1250000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gelora Bung Karno Main Stadium')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('submits updated event data and triggers onSuccess', async () => {
    vi.mocked(api.updateEvent).mockResolvedValueOnce({
      ...mockEvent,
      name: 'Coldplay Live in Jakarta (Extended Show)',
      price: 1500000,
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <EditEventModal
        isOpen={true}
        event={mockEvent}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    const nameInput = screen.getByDisplayValue('Coldplay Live in Jakarta');
    fireEvent.change(nameInput, { target: { value: 'Coldplay Live in Jakarta (Extended Show)' } });

    const priceInput = screen.getByDisplayValue('1250000');
    fireEvent.change(priceInput, { target: { value: '1500000' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateEvent).toHaveBeenCalledWith(
        'ev-test-101',
        expect.objectContaining({
          name: 'Coldplay Live in Jakarta (Extended Show)',
          price: 1500000,
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <EditEventModal
        isOpen={false}
        event={mockEvent}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
