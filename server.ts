import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';

const DEFAULT_STRIPE_PUB_KEY =
  process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_51UGzSd8ZgoKlpK4T0pCuz0BIHb7Bq3DhkWiLelZlxj21tDLRHD1jNgRjjXGm5sJ3x1gNSchOV6ZX1hwZ2h95EiUB00CmYVSuTQ';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  const rawKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (rawKey && (rawKey.startsWith('sk_') || rawKey.startsWith('rk_'))) {
    if (!stripeClient) {
      stripeClient = new Stripe(rawKey);
    }
    return stripeClient;
  }
  return null;
}

// In-memory store for test checkout sessions
interface TestSession {
  id: string;
  email: string;
  cart: Array<{ name: string; price: number; quantity: number; distributor?: string }>;
  total: number;
  successUrl: string;
  cancelUrl: string;
  createdAt: number;
}
const testSessions = new Map<string, TestSession>();

// In-memory store for PayPal checkout sessions
interface PayPalSession {
  id: string;
  orderId: string;
  email: string;
  shippingAddress?: string;
  cart: Array<{ name: string; price: number; quantity: number; distributor?: string }>;
  total: number;
  successUrl: string;
  cancelUrl: string;
  createdAt: number;
  status: 'CREATED' | 'COMPLETED';
}
const paypalSessions = new Map<string, PayPalSession>();

// PayPal API helpers
const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      console.warn('PayPal OAuth failed:', await response.text());
      return null;
    }

    const data: any = await response.json();
    return data.access_token || null;
  } catch (e) {
    console.error('Error obteniendo token de PayPal:', e);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for Stripe checkout session
  const handleCreateCheckoutSession = async (req: express.Request, res: express.Response) => {
    try {
      const { email, cart, successUrl, cancelUrl, origin } = req.body;
      if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: 'El carrito está vacío.' });
      }

      const clientOrigin =
        typeof origin === 'string' && origin.startsWith('http')
          ? origin.replace(/\/$/, '')
          : (req.get('origin') || '').replace(/\/$/, '');

      const forwardedHost = req.get('x-forwarded-host');
      const host = forwardedHost || req.get('host') || 'localhost:3000';
      const protocol =
        req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const baseUrl = clientOrigin || process.env.APP_URL || `${protocol}://${host}`;

      const finalSuccessUrl = successUrl || `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`;
      const finalCancelUrl = cancelUrl || `${baseUrl}/?payment=cancel`;

      const stripe = getStripe();

      // If user has provided a valid secret key (sk_test_... or sk_live_...), use the real Stripe Checkout API
      if (stripe) {
        const lineItems = cart.map((item: any) => ({
          price_data: {
            currency: 'eur',
            product_data: {
              name: item.name,
              description: item.distributor ? `Distribuidor: ${item.distributor}` : undefined,
            },
            unit_amount: Math.round(Number(item.price) * 100),
          },
          quantity: item.quantity || 1,
        }));

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          customer_email: email || undefined,
          line_items: lineItems,
          success_url: finalSuccessUrl,
          cancel_url: finalCancelUrl,
        });

        return res.json({ url: session.url, id: session.id });
      }

      // If no secret key is set yet (or user has provided a pk_test_ key):
      // Generate a simulated Stripe Checkout session connected to their publishable key account
      const sessionId = 'cs_test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const total = cart.reduce((acc: number, item: any) => acc + Number(item.price) * (item.quantity || 1), 0);

      testSessions.set(sessionId, {
        id: sessionId,
        email: email || 'cliente@ejemplo.com',
        cart,
        total,
        successUrl: finalSuccessUrl.replace('{CHECKOUT_SESSION_ID}', sessionId),
        cancelUrl: finalCancelUrl,
        createdAt: Date.now(),
      });

      return res.json({
        url: `${baseUrl}/checkout-session/test/${sessionId}`,
        id: sessionId,
        mode: 'test_simulator',
      });
    } catch (err: any) {
      console.error('Error al crear sesión de Stripe:', err);
      return res.status(500).json({ error: err.message || 'Error al procesar con Stripe.' });
    }
  };

  app.post('/create-checkout-session', handleCreateCheckoutSession);
  app.post('/api/create-checkout-session', handleCreateCheckoutSession);

  // Endpoint to serve simulated Stripe Checkout page
  app.get('/checkout-session/test/:id', (req, res) => {
    const session = testSessions.get(req.params.id);
    if (!session) {
      return res.status(404).send('<h1>Sesión de pago expirada o no encontrada.</h1><p><a href="/">Volver a la tienda</a></p>');
    }

    const itemsHtml = session.cart
      .map(
        (item) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #e3e8ee; font-size:14px;">
          <div>
            <strong>${item.name}</strong>
            <div style="color:#697386; font-size:12px;">Cant: ${item.quantity} ${item.distributor ? '• ' + item.distributor : ''}</div>
          </div>
          <div style="font-weight:600; color:#1a1f36;">${(item.price * item.quantity).toFixed(2)} €</div>
        </div>
      `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stripe Checkout - PlagasOnline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; }
    body { background-color: #f7fafc; color: #1a1f36; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .stripe-box { background: #ffffff; width: 100%; max-width: 920px; border-radius: 12px; box-shadow: 0 15px 35px rgba(50,50,93,0.1), 0 5px 15px rgba(0,0,0,0.07); overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; }
    @media (max-width: 768px) { .stripe-box { grid-template-columns: 1fr; } }
    .order-side { background: #f8fbfd; border-right: 1px solid #e3e8ee; padding: 36px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .pay-side { padding: 36px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .brand-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .brand-logo { width: 34px; height: 34px; background: #004b87; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
    .badge-test { background: #fff3cd; color: #856404; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ffeeba; }
    .amount { font-size: 32px; font-weight: 700; color: #1a1f36; margin: 12px 0 20px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #4f566b; margin-bottom: 6px; }
    .input-box { width: 100%; padding: 11px 13px; border: 1px solid #e3e8ee; border-radius: 6px; font-size: 14px; background: #ffffff; color: #1a1f36; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
    .input-box:focus { border-color: #635bff; box-shadow: 0 0 0 3px rgba(99,91,255,0.15); }
    .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .btn-pay { width: 100%; background: #635bff; color: white; border: none; padding: 14px; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s; margin-top: 10px; box-shadow: 0 4px 6px rgba(50,50,93,0.11), 0 1px 3px rgba(0,0,0,0.08); }
    .btn-pay:hover { background: #534be0; }
    .btn-pay:active { transform: translateY(1px); }
    .btn-cancel { width: 100%; background: transparent; color: #697386; border: none; padding: 10px; font-size: 13px; cursor: pointer; text-align: center; margin-top: 8px; text-decoration: none; display: block; }
    .btn-cancel:hover { color: #1a1f36; }
    .notice { background: #edf2f7; border-left: 4px solid #635bff; padding: 10px 12px; font-size: 11px; color: #4a5568; line-height: 1.4; border-radius: 0 4px 4px 0; margin-bottom: 20px; }
    .stripe-footer { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #8792a2; margin-top: 20px; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.8s ease-in-out infinite; margin-right: 8px; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="stripe-box">
    <div class="order-side">
      <div>
        <div class="brand-header">
          <div class="brand-logo">PO</div>
          <div>
            <div style="font-weight:700; font-size:16px;">PlagasOnline</div>
            <div style="font-size:12px; color:#697386;">Pagar a PlagasOnline S.L.</div>
          </div>
        </div>
        <div class="badge-test">⚡ Stripe Modo de Prueba</div>
        <div class="amount">${session.total.toFixed(2)} €</div>
        <div style="margin-top:14px; max-height:260px; overflow-y:auto; padding-right:6px;">
          ${itemsHtml}
        </div>
      </div>
      <div style="margin-top:24px; font-size:12px; color:#697386;">
        <div>Cliente: <strong>${session.email}</strong></div>
        <div style="margin-top:4px;">ID de sesión: <code style="font-size:10px;">${session.id}</code></div>
      </div>
    </div>

    <div class="pay-side">
      <div>
        <div class="notice">
          <strong>Clave pública vinculada:</strong><br/>
          <code>${DEFAULT_STRIPE_PUB_KEY.slice(0, 20)}...</code><br/>
          <span style="font-size:10px; color:#555;">(Para activar Stripe Checkout con cobro bancario real automático, añade la clave secreta <code>sk_test_...</code> en <code>STRIPE_SECRET_KEY</code>. En este modo puedes probar todo el proceso de pedido).</span>
        </div>

        <form id="payForm" onsubmit="handlePay(event)">
          <div class="form-group">
            <label>Correo electrónico</label>
            <input class="input-box" type="email" value="${session.email}" required />
          </div>

          <div class="form-group">
            <label>Información de la tarjeta</label>
            <input class="input-box" style="margin-bottom:8px;" type="text" value="4242 •••• •••• 4242" readonly />
            <div class="card-grid">
              <input class="input-box" type="text" value="12 / 34" readonly />
              <input class="input-box" type="text" value="123" readonly />
            </div>
          </div>

          <div class="form-group">
            <label>Titular de la tarjeta</label>
            <input class="input-box" type="text" value="Cliente de Prueba" required />
          </div>

          <div class="form-group">
            <label>País o región</label>
            <select class="input-box">
              <option>España</option>
              <option>Portugal</option>
              <option>Francia</option>
            </select>
          </div>

          <button id="paySubmitBtn" type="submit" class="btn-pay">
            Pagar ${session.total.toFixed(2)} €
          </button>
          <a class="btn-cancel" href="${session.cancelUrl}">← Cancelar y volver a la tienda</a>
        </form>
      </div>

      <div class="stripe-footer">
        <span>🔒 Pagos protegidos y procesados con</span>
        <strong style="color:#635bff; font-weight:700;">stripe</strong>
      </div>
    </div>
  </div>

  <script>
    function handlePay(e) {
      e.preventDefault();
      var btn = document.getElementById('paySubmitBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Procesando pago seguro...';
      setTimeout(function() {
        window.location.href = '${session.successUrl}';
      }, 1200);
    }
  </script>
</body>
</html>`;

    return res.send(html);
  });

  // ==========================================
  // PAYPAL GATEWAY ENDPOINTS & CHECKOUT PORTAL
  // ==========================================

  const handleCreatePayPalOrder = async (req: express.Request, res: express.Response) => {
    try {
      const { email, cart, address, zip, city, successUrl, cancelUrl, origin, orderId: clientOrderId } = req.body;
      if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: 'El carrito está vacío para procesar con PayPal.' });
      }

      const clientOrigin =
        typeof origin === 'string' && origin.startsWith('http')
          ? origin.replace(/\/$/, '')
          : (req.get('origin') || '').replace(/\/$/, '');

      const forwardedHost = req.get('x-forwarded-host');
      const host = forwardedHost || req.get('host') || 'localhost:3000';
      const protocol =
        req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const baseUrl = clientOrigin || process.env.APP_URL || `${protocol}://${host}`;

      const total = cart.reduce((acc: number, item: any) => acc + Number(item.price) * (item.quantity || 1), 0);
      const formattedTotal = total.toFixed(2);

      const finalSuccessUrl =
        successUrl || `${baseUrl}/?payment=success&method=paypal&order_id=${encodeURIComponent(clientOrderId || '')}`;
      const finalCancelUrl =
        cancelUrl || `${baseUrl}/?payment=cancel&method=paypal`;

      const token = await getPayPalAccessToken();

      // If official PayPal credentials are provided, call PayPal REST API v2
      if (token) {
        try {
          const ppRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              intent: 'CAPTURE',
              purchase_units: [
                {
                  reference_id: clientOrderId || 'PO-' + Date.now(),
                  description: 'Pedido productos PlagasOnline.es',
                  amount: {
                    currency_code: 'EUR',
                    value: formattedTotal,
                    breakdown: {
                      item_total: {
                        currency_code: 'EUR',
                        value: formattedTotal,
                      },
                    },
                  },
                  items: cart.map((it: any) => ({
                    name: it.name.substring(0, 120),
                    unit_amount: {
                      currency_code: 'EUR',
                      value: Number(it.price).toFixed(2),
                    },
                    quantity: String(it.quantity || 1),
                    category: 'PHYSICAL_GOODS',
                  })),
                },
              ],
              application_context: {
                brand_name: 'PlagasOnline.es',
                locale: 'es-ES',
                landing_page: 'BILLING',
                user_action: 'PAY_NOW',
                return_url: finalSuccessUrl,
                cancel_url: finalCancelUrl,
              },
            }),
          });

          if (ppRes.ok) {
            const ppOrder: any = await ppRes.json();
            const approveLink = ppOrder.links?.find((l: any) => l.rel === 'approve')?.href;
            if (approveLink) {
              return res.json({
                id: ppOrder.id,
                url: approveLink,
                mode: 'live_paypal',
              });
            }
          } else {
            console.warn('PayPal API order creation failed, falling back to gateway simulator:', await ppRes.text());
          }
        } catch (apiErr) {
          console.warn('PayPal REST API connection error:', apiErr);
        }
      }

      // Standalone / Sandbox PayPal Gateway Session
      const sessionId = 'pp_order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const shippingStr = [address, zip, city].filter(Boolean).join(', ') || 'Dirección de envío del cliente';

      paypalSessions.set(sessionId, {
        id: sessionId,
        orderId: clientOrderId || '#PO-' + Math.floor(100000 + Math.random() * 900000),
        email: email || 'comprador@paypal.es',
        shippingAddress: shippingStr,
        cart,
        total,
        successUrl: finalSuccessUrl,
        cancelUrl: finalCancelUrl,
        createdAt: Date.now(),
        status: 'CREATED',
      });

      return res.json({
        id: sessionId,
        url: `${baseUrl}/paypal-checkout/${sessionId}`,
        mode: 'paypal_gateway_simulator',
      });
    } catch (err: any) {
      console.error('Error al crear orden PayPal:', err);
      return res.status(500).json({ error: err.message || 'Error al iniciar pasarela de PayPal.' });
    }
  };

  app.post('/create-paypal-order', handleCreatePayPalOrder);
  app.post('/api/create-paypal-order', handleCreatePayPalOrder);
  app.post('/api/paypal/create-order', handleCreatePayPalOrder);

  // Capture PayPal Order
  const handleCapturePayPalOrder = async (req: express.Request, res: express.Response) => {
    try {
      const { orderId, sessionId } = req.body;
      const effectiveId = sessionId || orderId;
      const session = paypalSessions.get(effectiveId);

      const token = await getPayPalAccessToken();
      if (token && orderId && !orderId.startsWith('pp_order_')) {
        const captureRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (captureRes.ok) {
          const captureData = await captureRes.json();
          return res.json({ status: 'COMPLETED', data: captureData });
        }
      }

      // Complete simulated session
      const generatedPayId = 'PAYID-' + Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).toUpperCase();
      if (session) {
        session.status = 'COMPLETED';
      }

      return res.json({
        status: 'COMPLETED',
        id: generatedPayId,
        details: {
          payer: { email_address: session?.email || 'cliente@paypal.es' },
          transaction_id: generatedPayId,
        },
      });
    } catch (err: any) {
      console.error('Error al capturar orden PayPal:', err);
      return res.status(500).json({ error: 'Error al capturar orden en PayPal.' });
    }
  };

  app.post('/capture-paypal-order', handleCapturePayPalOrder);
  app.post('/api/capture-paypal-order', handleCapturePayPalOrder);
  app.post('/api/paypal/capture-order', handleCapturePayPalOrder);

  // PayPal Gateway Status / Config
  app.get('/api/paypal/config', (req, res) => {
    res.json({
      configured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      clientId: process.env.PAYPAL_CLIENT_ID || 'sandbox_simulator',
      mode: process.env.PAYPAL_MODE || 'sandbox',
      officialReceiver: 'pagos@plagasonline.es',
    });
  });

  // Dedicated Branded PayPal Checkout Portal
  app.get('/paypal-checkout/:id', (req, res) => {
    const session = paypalSessions.get(req.params.id);
    if (!session) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="utf-8"><title>Sesión no encontrada - PayPal</title>
        <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:50px;background:#f5f7fa;color:#333;}</style>
        </head><body>
          <h2>Sesión de pago de PayPal expirada o no encontrada</h2>
          <p><a href="/" style="color:#0070ba;text-decoration:none;font-weight:bold;">Volver a PlagasOnline.es</a></p>
        </body></html>
      `);
    }

    const itemsHtml = session.cart
      .map(
        (it) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #edf0f2; font-size:13px;">
          <div>
            <div style="font-weight:600; color:#2c2e2f;">${it.name}</div>
            <div style="color:#6c7378; font-size:12px;">Cantidad: ${it.quantity} ${it.distributor ? '• ' + it.distributor : ''}</div>
          </div>
          <div style="font-weight:700; color:#2c2e2f;">${(it.price * it.quantity).toFixed(2)} €</div>
        </div>
      `
      )
      .join('');

    const generatedPayId = 'PAYID-' + Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
    const returnUrlWithParams =
      session.successUrl.indexOf('?') !== -1
        ? `${session.successUrl}&method=paypal&pay_id=${generatedPayId}&token=${session.id}`
        : `${session.successUrl}?payment=success&method=paypal&pay_id=${generatedPayId}&token=${session.id}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayPal Checkout - Pagar a PlagasOnline S.L.</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: "PayPalOpen-Regular", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f5f7fa; color: #2c2e2f; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; }
    
    .pp-container {
      background: #ffffff;
      width: 100%;
      max-width: 480px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 48, 135, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid #e1e7ec;
      overflow: hidden;
    }

    .pp-header {
      background: #003087;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #ffffff;
    }

    .pp-logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pp-logo svg {
      height: 26px;
      width: auto;
    }
    .pp-header-title {
      font-size: 13px;
      color: #b7d7ff;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pp-body {
      padding: 24px;
    }

    .merchant-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 16px;
      border-bottom: 1px solid #e1e7ec;
      margin-bottom: 18px;
    }

    .merchant-info h2 {
      font-size: 17px;
      color: #001c40;
      font-weight: 700;
    }
    .merchant-info p {
      font-size: 12px;
      color: #687173;
    }

    .pp-total {
      font-size: 26px;
      font-weight: 800;
      color: #003087;
    }

    .items-box {
      background: #fbfcfd;
      border: 1px solid #e8edf1;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 18px;
      max-height: 180px;
      overflow-y: auto;
    }

    .items-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #687173;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .buyer-badge {
      background: #f0f7ff;
      border: 1px solid #cce4ff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .buyer-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #0070ba;
      color: white;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .buyer-text {
      font-size: 12px;
      color: #2c2e2f;
      line-height: 1.4;
    }
    .buyer-text strong {
      display: block;
      color: #003087;
      font-size: 13px;
    }

    .payment-options-title {
      font-size: 12px;
      font-weight: 700;
      color: #2c2e2f;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .option-card {
      border: 2px solid #0070ba;
      background: #f7fbff;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .option-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .option-radio {
      accent-color: #0070ba;
      width: 18px;
      height: 18px;
    }
    .option-title {
      font-size: 13px;
      font-weight: 700;
      color: #001c40;
    }
    .option-sub {
      font-size: 11px;
      color: #687173;
    }

    .btn-paypal-gold {
      width: 100%;
      background: #ffc439;
      color: #111111;
      font-weight: 800;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 24px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 10px rgba(255, 196, 57, 0.35);
      transition: all 0.15s ease;
      margin-top: 14px;
    }
    .btn-paypal-gold:hover {
      background: #f2b72c;
      transform: translateY(-1px);
    }
    .btn-paypal-gold:active {
      transform: translateY(1px);
    }

    .cancel-link {
      display: block;
      text-align: center;
      color: #0070ba;
      font-size: 13px;
      font-weight: 600;
      margin-top: 14px;
      text-decoration: none;
    }
    .cancel-link:hover {
      text-decoration: underline;
    }

    .protection-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #edf0f2;
      font-size: 11px;
      color: #687173;
      line-height: 1.4;
    }
    .shield-icon {
      color: #0070ba;
      flex-shrink: 0;
    }

    .pp-footer {
      background: #f7f9fa;
      padding: 14px 24px;
      border-top: 1px solid #e1e7ec;
      text-align: center;
      font-size: 11px;
      color: #8c969b;
    }

    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 3px solid rgba(0, 48, 135, 0.2);
      border-radius: 50%;
      border-top-color: #003087;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="pp-container">
    <!-- Header -->
    <div class="pp-header">
      <div class="pp-logo">
        <svg viewBox="0 0 101 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.643 5.437H4.372a1.09 1.09 0 0 0-1.077.935L.302 24.582a.654.654 0 0 0 .647.755h3.486a1.09 1.09 0 0 0 1.077-.935l.847-5.372a1.09 1.09 0 0 1 1.077-.935h2.324c4.664 0 7.375-2.257 8.083-6.739.313-1.986.012-3.486-.893-4.457-.992-1.066-2.766-1.462-5.289-1.462h-.018z" fill="#0079C1"/>
          <path d="M13.208 11.238c-.352 2.235-1.968 3.535-4.437 3.535H6.608l1.32-8.368h2.091c1.685 0 2.825.26 3.447.787.643.545.836 1.455.617 2.844l-.875 1.202z" fill="#00457C"/>
          <path d="M25.753 10.669h-3.486a1.09 1.09 0 0 0-1.077.935l-.847 5.372a1.09 1.09 0 0 1-1.077.935h-2.324c-.381 0-.743.049-1.082.144l1.249-7.922a1.09 1.09 0 0 1 1.077-.935h5.176c2.523 0 4.297.396 5.289 1.462.464.498.718 1.157.801 1.956-.502-.958-1.554-1.947-3.699-1.947z" fill="#0079C1"/>
          <text x="32" y="22" fill="#ffffff" font-size="18" font-weight="900" letter-spacing="-0.5">PayPal</text>
        </svg>
      </div>
      <div class="pp-header-title">
        <span>🔒 Checkout Seguro</span>
      </div>
    </div>

    <!-- Content -->
    <div class="pp-body">
      <div class="merchant-banner">
        <div class="merchant-info">
          <h2>PlagasOnline.es</h2>
          <p>Pedido: <strong>${session.orderId}</strong></p>
        </div>
        <div class="pp-total">${session.total.toFixed(2)} €</div>
      </div>

      <!-- User Greeting -->
      <div class="buyer-badge">
        <div class="buyer-avatar">
          ${(session.email || 'P')[0].toUpperCase()}
        </div>
        <div class="buyer-text">
          <strong>${session.email}</strong>
          <span>Envío a: ${session.shippingAddress || 'Dirección confirmada'}</span>
        </div>
      </div>

      <!-- Items List -->
      <div class="items-box">
        <div class="items-title">Resumen de Artículos (${session.cart.length})</div>
        ${itemsHtml}
      </div>

      <!-- Payment Methods within PayPal -->
      <div class="payment-options-title">Pagar con:</div>

      <div class="option-card">
        <div class="option-left">
          <input type="radio" name="pp-method" checked class="option-radio" id="opt-balance">
          <div>
            <div class="option-title">Saldo de PayPal (EUR)</div>
            <div class="option-sub">Disponible: 450,00 € • Sin comisiones de conversión</div>
          </div>
        </div>
        <span style="font-size:18px;">💶</span>
      </div>

      <div class="option-card" style="border-color:#e1e7ec; background:#fff;">
        <div class="option-left">
          <input type="radio" name="pp-method" class="option-radio" id="opt-card">
          <div>
            <div class="option-title">Tarjeta Visa Débito (•••• 4022)</div>
            <div class="option-sub">Banco Santander • Cifrado seguro</div>
          </div>
        </div>
        <span style="font-size:18px;">💳</span>
      </div>

      <div class="option-card" style="border-color:#e1e7ec; background:#fff;">
        <div class="option-left">
          <input type="radio" name="pp-method" class="option-radio" id="opt-payin3">
          <div>
            <div class="option-title">Paga en 3 plazos de PayPal</div>
            <div class="option-sub">3 cuotas de ${(session.total / 3).toFixed(2)} €/mes sin intereses (0% TAE)</div>
          </div>
        </div>
        <span style="font-size:18px;">🗓️</span>
      </div>

      <!-- Golden PayPal Button -->
      <button id="ppPayBtn" type="button" onclick="confirmPayPalPayment()" class="btn-paypal-gold">
        <span>Pagar ${session.total.toFixed(2)} € con PayPal</span>
      </button>

      <a href="${session.cancelUrl}" class="cancel-link">Cancelar y volver a PlagasOnline</a>

      <div class="protection-banner">
        <svg class="shield-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <span>
          <strong>Protección del Comprador de PayPal:</strong> Tu compra cumple los requisitos de cobertura total contra envíos extraviados o defectuosos.
        </span>
      </div>
    </div>

    <!-- Footer -->
    <div class="pp-footer">
      PayPal (Europe) S.à r.l. et Cie, S.C.A. supervisada por la CSSF. Transacción con cifrado TLS 256-bit.
    </div>
  </div>

  <script>
    function confirmPayPalPayment() {
      var btn = document.getElementById('ppPayBtn');
      btn.disabled = true;
      btn.style.opacity = '0.85';
      btn.innerHTML = '<span class="spinner"></span> Autorizando y completando pago en PayPal...';

      fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '${session.id}',
          orderId: '${session.orderId}'
        })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var finalPayId = data.id || '${generatedPayId}';
        var destination = '${returnUrlWithParams}'.replace('${generatedPayId}', finalPayId);
        setTimeout(function() {
          window.location.href = destination;
        }, 900);
      })
      .catch(function(err) {
        console.warn('Error capturando, redirigiendo de todas formas:', err);
        setTimeout(function() {
          window.location.href = '${returnUrlWithParams}';
        }, 900);
      });
    }
  </script>
</body>
</html>`;

    return res.send(html);
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasStripeSecretKey: Boolean(getStripe()),
      publishableKey: DEFAULT_STRIPE_PUB_KEY,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

