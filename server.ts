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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for Stripe checkout session
  const handleCreateCheckoutSession = async (req: express.Request, res: express.Response) => {
    try {
      const { email, cart, successUrl, cancelUrl } = req.body;
      if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: 'El carrito está vacío.' });
      }

      const host = req.get('host') || 'localhost:3000';
      const protocol =
        req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const baseUrl = `${protocol}://${host}`;

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

