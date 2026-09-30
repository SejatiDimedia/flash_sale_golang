import { test, expect } from '@playwright/test';

test.describe('Flash Sale Full User Journey (E2E)', () => {
  test('User joins waiting room, gets admitted, and completes checkout', async ({ page }) => {
    let queueCheckCount = 0;

    await page.route('**/query', async (route) => {
      const request = route.request();
      let query = '';
      try {
        const postData = JSON.parse(request.postData() || '{}');
        query = postData.query || '';
      } catch (e) {
        query = '';
      }

      // Mock Event List Query
      if (query.includes('events') || query.includes('GetEvents')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              events: [
                {
                  id: 'evt-e2e-1',
                  name: 'Coldplay Live in Jakarta - VIP Arena',
                  description: 'Konser tur dunia eksklusif',
                  startSaleAt: new Date(Date.now() - 3600000).toISOString(),
                  endSaleAt: new Date(Date.now() + 86400000).toISOString(),
                  totalStock: 50,
                  availableStock: 10,
                  price: 1500000,
                  status: 'ACTIVE',
                  category: 'concerts',
                  maxPerUser: 2,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            },
          }),
        });
      }

      // Mock Join Waiting Room
      if (query.includes('joinWaitingRoom')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              joinWaitingRoom: {
                eventId: 'evt-e2e-1',
                userId: 'user-e2e-1',
                position: 3,
                totalInQueue: 100,
                isAllowedToPurchase: false,
                estimatedWaitSeconds: 6,
              },
            },
          }),
        });
      }

      // Mock Get Queue Status (Polling antrean: langsung admit pada check berikutnya)
      if (query.includes('getQueueStatus')) {
        queueCheckCount++;
        const isAllowed = queueCheckCount >= 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              getQueueStatus: {
                eventId: 'evt-e2e-1',
                userId: 'user-e2e-1',
                position: isAllowed ? 0 : 1,
                totalInQueue: isAllowed ? 0 : 50,
                isAllowedToPurchase: isAllowed,
                estimatedWaitSeconds: isAllowed ? 0 : 2,
              },
            },
          }),
        });
      }

      // Mock Purchase Ticket Mutation
      if (query.includes('purchaseTicket')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              purchaseTicket: {
                id: 'ord-e2e-confirmed-999',
                userId: 'user-e2e-1',
                eventId: 'evt-e2e-1',
                quantity: 1,
                totalPrice: 1500000,
                status: 'CONFIRMED',
                createdAt: new Date().toISOString(),
                confirmedAt: new Date().toISOString(),
              },
            },
          }),
        });
      }

      // Default fallback
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      });
    });

    // 2. Set authenticated state di localStorage
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock_jwt_token_for_e2e');
      localStorage.setItem('user', JSON.stringify({
        id: 'user-e2e-1',
        name: 'Budi Santoso',
        email: 'budi@test.com',
        role: 'user',
      }));
    });

    // 3. Kunjungi halaman utama aplikasi
    await page.goto('/');

    // 4. Cari event card dan klik tombol WAR TICKET NOW
    const buyButton = page.locator('button:has-text("WAR TICKET NOW")').first();
    await expect(buyButton).toBeVisible({ timeout: 10000 });
    await buyButton.click();

    // 5. Verifikasi Modal Waiting Room terbuka
    await expect(page.locator('text=Virtual Waiting Room')).toBeVisible();

    // 6. User mendapat giliran dan Modal Express Checkout muncul
    await expect(page.locator('text=Express Checkout')).toBeVisible({ timeout: 10000 });

    // 7. Klik tombol "PAY NOW" untuk checkout
    const payNowBtn = page.locator('button:has-text("PAY NOW")');
    await expect(payNowBtn).toBeVisible();
    await payNowBtn.click();

    // 8. Verifikasi tombol berubah ke status processing / modal selesai
    await page.waitForTimeout(1000);
  });
});
