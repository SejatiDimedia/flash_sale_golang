import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// Custom Metrik untuk memantau hasil bisnis secara presisi
const successfulOrders = new Counter('successful_purchases');
const soldOutErrors = new Counter('sold_out_rejections');

export const options = {
    scenarios: {
        flash_sale_blitz: {
            executor: 'shared-iterations',
            vus: 50,
            iterations: 300,
            maxDuration: '30s',
        },
    },
};

const BASE_URL = 'http://localhost:8080/query';

export function setup() {
    const eventRes = http.post(BASE_URL, JSON.stringify({
        query: 'query { events(status: ACTIVE) { id name availableStock } }'
    }), { headers: { 'Content-Type': 'application/json' } });

    const events = JSON.parse(eventRes.body).data.events;
    return { eventId: events[0].id };
}

export default function (data) {
    const uniqueEmail = `user_${__VU}_${__ITER}_${Date.now()}@test.com`;

    // 1. Register User Baru
    const regRes = http.post(BASE_URL, JSON.stringify({
        query: `mutation { register(input: { name: "User", email: "${uniqueEmail}", password: "pwd" }) { token } }`
    }), { headers: { 'Content-Type': 'application/json' } });

    const userToken = JSON.parse(regRes.body).data.register.token;

    // 2. Checkout Tiket
    const purchaseRes = http.post(BASE_URL, JSON.stringify({
        query: `mutation { purchaseTicket(eventId: "${data.eventId}", quantity: 1) { id status } }`
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
    });

    const body = JSON.parse(purchaseRes.body);

    if (body.data && body.data.purchaseTicket) {
        successfulOrders.add(1); // 🎟️ Berhasil dapat tiket!
    } else if (body.errors && body.errors[0].message.includes('sold out')) {
        soldOutErrors.add(1);    // 🛑 Ditolak karena stok habis!
    }
}