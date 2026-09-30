import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const checkoutLatency = new Trend('checkout_latency_ms');
const successfulOrders = new Counter('successful_purchases');

export const options = {
  scenarios: {
    sudden_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3s', target: 10 },   // Low baseline
        { duration: '2s', target: 300 },  // SUDDEN SPIKE ke 300 VUs!
        { duration: '15s', target: 300 }, // Sustain spike burst
        { duration: '5s', target: 0 },    // Cooldown
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<400', 'p(99)<800'],
    'error_rate': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080/query';

export function setup() {
  // Try login admin and create fresh event
  const adminLoginRes = http.post(BASE_URL, JSON.stringify({
    query: 'mutation { login(input: { email: "admin@example.com", password: "admin123" }) { token } }'
  }), { headers: { 'Content-Type': 'application/json' } });

  const adminToken = JSON.parse(adminLoginRes.body)?.data?.login?.token;
  if (adminToken) {
    const createRes = http.post(BASE_URL, JSON.stringify({
      query: `mutation {
        createEvent(input: {
          name: "Sudden Spike Test Event",
          description: "Sudden spike load test",
          startSaleAt: "${new Date(Date.now() - 3600000).toISOString()}",
          endSaleAt: "${new Date(Date.now() + 86400000).toISOString()}",
          totalStock: 500,
          price: 250000,
          status: ACTIVE,
          maxPerUser: 1
        }) { id totalStock availableStock }
      }`
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    const createBody = JSON.parse(createRes.body);
    if (createBody.data && createBody.data.createEvent) {
      return { eventId: createBody.data.createEvent.id };
    }
  }

  const res = http.post(BASE_URL, JSON.stringify({
    query: 'query { events(status: ACTIVE) { id name totalStock availableStock } }'
  }), { headers: { 'Content-Type': 'application/json' } });

  const body = JSON.parse(res.body);
  if (!body.data || !body.data.events || body.data.events.length === 0) {
    throw new Error('No active event available for load test setup.');
  }

  return { eventId: body.data.events[0].id };
}

export default function (data) {
  const uniqueEmail = `user_spike_${__VU}_${__ITER}_${Date.now()}@loadtest.com`;

  // 1. Register User Baru
  const regRes = http.post(BASE_URL, JSON.stringify({
    query: `mutation { register(input: { name: "SpikeTester", email: "${uniqueEmail}", password: "password123" }) { token } }`
  }), { headers: { 'Content-Type': 'application/json' } });

  const regBody = JSON.parse(regRes.body);
  if (!regBody.data || !regBody.data.register) {
    errorRate.add(1);
    return;
  }
  const token = regBody.data.register.token;

  // 2. Checkout Tiket Seketika
  const startTime = Date.now();
  const buyRes = http.post(BASE_URL, JSON.stringify({
    query: `mutation { purchaseTicket(eventId: "${data.eventId}", quantity: 1) { id status } }`
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': `idem-spike-${__VU}-${__ITER}-${Date.now()}`,
    },
  });

  checkoutLatency.add(Date.now() - startTime);

  const buyBody = JSON.parse(buyRes.body);
  const isSuccess = buyBody.data && buyBody.data.purchaseTicket;
  const isSoldOut = buyBody.errors && buyBody.errors[0]?.message.includes('sold out');

  if (isSuccess) {
    successfulOrders.add(1);
    errorRate.add(0);
  } else if (isSoldOut) {
    errorRate.add(0);
  } else {
    errorRate.add(1);
  }

  sleep(0.05);
}
