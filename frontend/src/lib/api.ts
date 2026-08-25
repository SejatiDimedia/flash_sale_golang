const GRAPHQL_ENDPOINT = 'http://localhost:8080/query';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  category?: string;
  totalStock: number;
  availableStock: number;
  price: number;
  maxPerUser: number;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'CLOSED';
  startSaleAt: string;
  endSaleAt: string;
}

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  quantity: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  confirmedAt?: string;
}

export interface QueueStatus {
  position: number;
  totalInQueue: number;
  isAllowedToPurchase: boolean;
  estimatedWaitSeconds?: number;
}

export interface OrderLog {
  id: string;
  orderId: string;
  eventType: string;
  payload: string;
  createdAt: string;
}

export async function graphqlFetch<T>(query: string, variables: Record<string, any> = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = token || localStorage.getItem('token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

// Queries & Mutations
export const api = {
  // Auth
  register: async (name: string, email: string, password: string, role: string = 'user') => {
    const data = await graphqlFetch<{ register: { token: string; user: User } }>(`
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          token
          user { id name email role }
        }
      }
    `, { input: { name, email, password, role } });
    return data.register;
  },

  login: async (email: string, password: string) => {
    const data = await graphqlFetch<{ login: { token: string; user: User } }>(`
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          user { id name email role }
        }
      }
    `, { input: { email, password } });
    return data.login;
  },

  updateProfile: async (name: string, email: string, password?: string) => {
    const data = await graphqlFetch<{ updateProfile: User }>(`
      mutation UpdateProfile($input: UpdateProfileInput!) {
        updateProfile(input: $input) {
          id name email role createdAt
        }
      }
    `, { input: { name, email, password: password || undefined } });
    return data.updateProfile;
  },

  // Events
  getEvents: async (status?: string) => {
    const data = await graphqlFetch<{ events: Event[] }>(`
      query GetEvents($status: EventStatus) {
        events(status: $status) {
          id name description category totalStock availableStock price maxPerUser status startSaleAt endSaleAt
        }
      }
    `, { status });
    return data.events;
  },

  getEvent: async (id: string) => {
    const data = await graphqlFetch<{ event: Event }>(`
      query GetEvent($id: ID!) {
        event(id: $id) {
          id name description category totalStock availableStock price maxPerUser status startSaleAt endSaleAt
        }
      }
    `, { id });
    return data.event;
  },

  createEvent: async (input: {
    name: string;
    description?: string;
    category?: string;
    startSaleAt: string;
    endSaleAt: string;
    totalStock: number;
    price: number;
    status?: string;
    maxPerUser?: number;
  }) => {
    const data = await graphqlFetch<{ createEvent: Event }>(`
      mutation CreateEvent($input: CreateEventInput!) {
        createEvent(input: $input) {
          id name description category totalStock availableStock price maxPerUser status startSaleAt endSaleAt
        }
      }
    `, { input });
    return data.createEvent;
  },

  // Waiting Room
  joinWaitingRoom: async (eventId: string) => {
    const data = await graphqlFetch<{ joinWaitingRoom: QueueStatus }>(`
      mutation JoinWaitingRoom($eventId: ID!) {
        joinWaitingRoom(eventId: $eventId) {
          position totalInQueue isAllowedToPurchase estimatedWaitSeconds
        }
      }
    `, { eventId });
    return data.joinWaitingRoom;
  },

  getQueueStatus: async (eventId: string) => {
    const data = await graphqlFetch<{ getQueueStatus: QueueStatus }>(`
      query GetQueueStatus($eventId: ID!) {
        getQueueStatus(eventId: $eventId) {
          position totalInQueue isAllowedToPurchase estimatedWaitSeconds
        }
      }
    `, { eventId });
    return data.getQueueStatus;
  },

  // Checkout War Ticket
  purchaseTicket: async (eventId: string, quantity: number) => {
    const data = await graphqlFetch<{ purchaseTicket: Order }>(`
      mutation PurchaseTicket($eventId: ID!, $quantity: Int!) {
        purchaseTicket(eventId: $eventId, quantity: $quantity) {
          id userId eventId quantity totalPrice status createdAt confirmedAt
        }
      }
    `, { eventId, quantity });
    return data.purchaseTicket;
  },

  // Admin Operations
  admitUsers: async (eventId: string, batchSize: number) => {
    const data = await graphqlFetch<{ admitUsers: string[] }>(`
      mutation AdmitUsers($eventId: ID!, $batchSize: Int!) {
        admitUsers(eventId: $eventId, batchSize: $batchSize)
      }
    `, { eventId, batchSize });
    return data.admitUsers.length;
  },

  getGateMode: async (eventId: string) => {
    const data = await graphqlFetch<{ getGateMode: string }>(`
      query GetGateMode($eventId: ID!) {
        getGateMode(eventId: $eventId)
      }
    `, { eventId });
    return data.getGateMode as 'AUTO' | 'MANUAL';
  },

  setGateMode: async (eventId: string, mode: 'AUTO' | 'MANUAL') => {
    const data = await graphqlFetch<{ setGateMode: string }>(`
      mutation SetGateMode($eventId: ID!, $mode: String!) {
        setGateMode(eventId: $eventId, mode: $mode)
      }
    `, { eventId, mode });
    return data.setGateMode as 'AUTO' | 'MANUAL';
  },

  getAllOrders: async (eventId?: string) => {
    const data = await graphqlFetch<{ orders: Order[] }>(`
      query GetAllOrders($eventId: ID) {
        orders(eventId: $eventId) {
          id userId eventId quantity totalPrice status createdAt confirmedAt
        }
      }
    `, { eventId });
    return data.orders;
  },

  getMyOrders: async () => {
    const data = await graphqlFetch<{ myOrders: Order[] }>(`
      query GetMyOrders {
        myOrders {
          id userId eventId quantity totalPrice status createdAt confirmedAt
        }
      }
    `);
    return data.myOrders;
  },

  getOrderLogs: async (orderId: string) => {
    const data = await graphqlFetch<{ orderLogs: OrderLog[] }>(`
      query GetOrderLogs($orderId: ID!) {
        orderLogs(orderId: $orderId) {
          id orderId eventType payload createdAt
        }
      }
    `, { orderId });
    return data.orderLogs;
  },
};
