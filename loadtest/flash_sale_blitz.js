import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom Metrik
const successfulOrders = new Counter('successful_purchases');
const soldOutErrors = new Counter('sold_out_rejections');
const systemErrors = new Counter('system_errors');
const checkoutLatency = new Trend('checkout_latency_ms');

export const options = {
  scenarios: {
    flash_sale_blitz: {
      executor: 'shared-iterations',
      vus: 500, // 500 Virtual Users concurrent burst
      iterations: 2000, // 2000 total checkout attempts
      maxDuration: '45s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<500'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080/query';

export function setup() {
  // 1. Ambil admin token atau buat event khusus flash sale 100 tiket
  const adminLoginRes = http.post(BASE_URL, JSON.stringify({
    query: 'mutation { login(input: { email: "admin@example.com", password: "admin123" }) { token } }'
  }), { headers: { 'Content-Type': 'application/json' } });

  const adminToken = JSON.parse(adminLoginRes.body)?.data?.login?.token;

  if (adminToken) {
    const createRes = http.post(BASE_URL, JSON.stringify({
      query: `mutation {
        createEvent(input: {
          name: "🔥 VIP Flash Sale - 100 Limited Tickets",
          description: "Exclusive Blitz Event",
          startSaleAt: "${new Date(Date.now() - 3600000).toISOString()}",
          endSaleAt: "${new Date(Date.now() + 86400000).toISOString()}",
          totalStock: 100,
          price: 500000,
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
      return {
        eventId: createBody.data.createEvent.id,
        initialStock: 100,
      };
    }
  }

  // Fallback: Gunakan event aktif pertama
  const res = http.post(BASE_URL, JSON.stringify({
    query: 'query { events(status: ACTIVE) { id availableStock } }'
  }), { headers: { 'Content-Type': 'application/json' } });

  const events = JSON.parse(res.body)?.data?.events;
  return { eventId: events[0].id, initialStock: events[0].availableStock };
}

export default function (data) {
  const uniqueEmail = `blitz_${__VU}_${__ITER}_${Date.now()}@test.com`;

  // 1. Register User Baru
  const regRes = http.post(BASE_URL, JSON.stringify({
    query: `mutation { register(input: { name: "BlitzUser", email: "${uniqueEmail}", password: "password123" }) { token } }`
  }), { headers: { 'Content-Type': 'application/json' } });

  const regBody = JSON.parse(regRes.body);
  if (!regBody.data || !regBody.data.register) {
    systemErrors.add(1);
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
      'Idempotency-Key': `idem-blitz-${__VU}-${__ITER}`,
    },
  });

  checkoutLatency.add(Date.now() - startTime);

  const buyBody = JSON.parse(buyRes.body);

  if (buyBody.data && buyBody.data.purchaseTicket) {
    successfulOrders.add(1); // 🎟️ Dapat tiket!
  } else if (buyBody.errors && buyBody.errors[0]?.message.includes('sold out')) {
    soldOutErrors.add(1); // 🛑 Ditolak karena stok habis!
  } else {
    systemErrors.add(1);
  }
}

export function teardown(data) {
  // Verifikasi akhir sisa stok setelah benchmark
  const verifyRes = http.post(BASE_URL, JSON.stringify({
    query: `query { event(id: "${data.eventId}") { id totalStock availableStock } }`
  }), { headers: { 'Content-Type': 'application/json' } });

  const finalEvent = JSON.parse(verifyRes.body)?.data?.event;
  console.log(`\n================ BENCHMARK AUDIT VERIFICATION ================`);
  console.log(`Event ID: ${data.eventId}`);
  console.log(`Initial Stock: ${data.initialStock}`);
  console.log(`Final Available Stock in DB: ${finalEvent?.availableStock}`);
  console.log(`==============================================================\n`);
}
