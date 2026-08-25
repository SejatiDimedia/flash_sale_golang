import { createClient } from 'graphql-ws';
import type { Event, Order } from './api';

const WS_ENDPOINT = 'ws://localhost:8080/query';

export const wsClient = createClient({
  url: WS_ENDPOINT,
  connectionParams: () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  retryAttempts: 10,
  shouldRetry: () => true,
});

// Subscribe to Live Stock Updates
export function subscribeStock(eventId: string, onUpdate: (event: Event) => void) {
  const unsubscribe = wsClient.subscribe<{ stockUpdated: Event }>(
    {
      query: `
        subscription OnStockUpdated($eventId: ID!) {
          stockUpdated(eventId: $eventId) {
            id name availableStock totalStock status
          }
        }
      `,
      variables: { eventId },
    },
    {
      next: (data) => {
        if (data.data?.stockUpdated) {
          onUpdate(data.data.stockUpdated);
        }
      },
      error: (err) => console.error('🔴 [WebSocket] Stock subscription error:', err),
      complete: () => console.log('🔌 [WebSocket] Stock subscription completed'),
    }
  );

  return unsubscribe;
}

// Subscribe to Live Order Status Confirmation
export function subscribeOrderStatus(orderId: string, onUpdate: (order: Order) => void) {
  const unsubscribe = wsClient.subscribe<{ orderStatusChanged: Order }>(
    {
      query: `
        subscription OnOrderStatus($orderId: ID!) {
          orderStatusChanged(orderId: $orderId) {
            id status totalPrice quantity confirmedAt
          }
        }
      `,
      variables: { orderId },
    },
    {
      next: (data) => {
        if (data.data?.orderStatusChanged) {
          onUpdate(data.data.orderStatusChanged);
        }
      },
      error: (err) => console.error('🔴 [WebSocket] Order status error:', err),
      complete: () => console.log('🔌 [WebSocket] Order status completed'),
    }
  );

  return unsubscribe;
}
