import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

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

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(400).json({
          error: 'Para procesar pagos con tarjeta con Stripe se requiere configurar la variable STRIPE_SECRET_KEY.',
        });
      }

      const stripe = getStripe();
      const host = req.get('host') || 'localhost:3000';
      const protocol =
        req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const baseUrl = `${protocol}://${host}`;

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
        success_url: successUrl || `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${baseUrl}/?payment=cancel`,
      });

      return res.json({ url: session.url, id: session.id });
    } catch (err: any) {
      console.error('Error al crear sesión de Stripe:', err);
      return res.status(500).json({ error: err.message || 'Error al procesar con Stripe.' });
    }
  };

  app.post('/create-checkout-session', handleCreateCheckoutSession);
  app.post('/api/create-checkout-session', handleCreateCheckoutSession);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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
