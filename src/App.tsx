import React, { useState, useEffect } from 'react';
import { Product, CartItem, User, ViewType, OrderData } from './types';
import { INITIAL_PRODUCTS } from './data/products';
import { initEmailJS, sendOrderConfirmationEmail } from './utils/email';
import { appendOrderToGoogleSheet } from './utils/sheets';
import { recordCompanyOrder } from './utils/excel';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { CatalogView } from './components/CatalogView';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { SuccessView } from './components/SuccessView';
import { ContactView } from './components/ContactView';
import { AuthViews } from './components/AuthViews';
import { ProductModal } from './components/ProductModal';
import { Toast } from './components/Toast';

const CURRENT_SESSION_KEY = 'plagasOnlineCurrentUser';

export default function App() {
  const [products] = useState<Product[]>(INITIAL_PRODUCTS);
  const [currentView, setCurrentView] = useState<ViewType>('view-inicio');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [discountedProductIds, setDiscountedProductIds] = useState<number[]>([]);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [lastOrderData, setLastOrderData] = useState<OrderData | null>(null);

  // Initialize EmailJS & Restore stored session & Stripe redirects
  useEffect(() => {
    initEmailJS();

    try {
      const saved = localStorage.getItem(CURRENT_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) {
          setCurrentUser(parsed);
          generateRandomDiscounts();
        }
      }
    } catch (e) {
      console.error('Error restaurando sesión:', e);
    }

    // Check Stripe return URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        let restoredOrder: any = null;
        try {
          const raw = localStorage.getItem('pending_stripe_order');
          if (raw) {
            restoredOrder = JSON.parse(raw);
            localStorage.removeItem('pending_stripe_order');
          }
        } catch (err) {
          console.warn('Error leyendo pending_stripe_order:', err);
        }

        const finalOrder: OrderData = {
          orderId: restoredOrder?.orderId || '#PO-' + Math.floor(100000 + Math.random() * 900000),
          customerName: restoredOrder?.customerName || currentUser?.name || 'Cliente',
          customerEmail: restoredOrder?.customerEmail || currentUser?.email || 'pago@stripe.com',
          shippingAddress: restoredOrder?.shippingAddress || 'Dirección confirmada en Stripe',
          shippingZip: restoredOrder?.shippingZip || '',
          shippingCity: restoredOrder?.shippingCity || '',
          paymentMethod: 'TARJETA (STRIPE CHECKOUT)',
          total: restoredOrder?.total || 'Pago procesado',
          products: restoredOrder?.products || [],
        };

        setLastOrderData(finalOrder);
        setCart([]);
        setCurrentView('view-success');
        showToast('¡Pago con Stripe completado con éxito!');

        if (restoredOrder?.products && restoredOrder.products.length > 0) {
          sendOrderConfirmationEmail(finalOrder).catch((err) =>
            console.error('Error enviando email tras Stripe:', err)
          );
          appendOrderToGoogleSheet(finalOrder).catch((err) =>
            console.error('Error guardando en Google Sheets tras Stripe:', err)
          );
          recordCompanyOrder(finalOrder);
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get('payment') === 'cancel') {
        localStorage.removeItem('pending_stripe_order');
        showToast('Proceso de pago en Stripe cancelado.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.error('Error leyendo parámetros de Stripe:', e);
    }
  }, []);

  const generateRandomDiscounts = () => {
    const discounted: number[] = [];
    INITIAL_PRODUCTS.forEach((p) => {
      // 45% chance of being discounted for socio
      if (Math.random() < 0.45) {
        discounted.push(p.id);
      }
    });
    // Ensure at least 3 products are discounted for clear feedback
    if (discounted.length < 3) {
      discounted.push(INITIAL_PRODUCTS[0].id, INITIAL_PRODUCTS[1].id, INITIAL_PRODUCTS[4].id);
    }
    setDiscountedProductIds(discounted);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  const triggerCartBounce = () => {
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 350);
  };

  const handleAddToCart = (productId: number, quantity: number = 1) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;

    const isDisc = !!currentUser && discountedProductIds.includes(p.id);
    const itemPrice = isDisc ? p.price * 0.8 : p.price;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === productId);
      if (existing) {
        return prevCart.map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            cartItemId: Date.now() + Math.random(),
            id: p.id,
            name: p.name,
            price: itemPrice,
            distributor: p.distributor,
            img: p.img,
            quantity,
          },
        ];
      }
    });

    triggerCartBounce();
    showToast(`Añadido (${quantity}): ${p.name}`);
  };

  const handleUpdateCartQuantity = (cartItemId: number, quantity: number) => {
    const validQty = Math.max(1, quantity);
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: validQty } : item
      )
    );
    triggerCartBounce();
  };

  const handleRemoveFromCart = (cartItemId: number) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
    triggerCartBounce();
    showToast('Producto eliminado de la cesta.');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Error al guardar sesión:', e);
    }
    generateRandomDiscounts();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setDiscountedProductIds([]);
    try {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    } catch (e) {
      console.error('Error eliminando sesión:', e);
    }
    showToast('Sesión cerrada.');
    setCurrentView('view-inicio');
  };

  const handleOrderSuccess = (order: OrderData) => {
    setLastOrderData(order);
    setCart([]);
    triggerCartBounce();
    setCurrentView('view-success');
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#333333] flex justify-center p-2 sm:p-4 md:p-6 font-sans">
      <div className="w-full max-w-[1100px] bg-white rounded-lg shadow-xl flex flex-col min-h-[850px] overflow-hidden border border-gray-200">
        {/* Navigation & Header */}
        <Navbar
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          cartCount={cartItemCount}
          isCartBouncing={isCartBouncing}
          currentUser={currentUser}
          onLogout={handleLogout}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* Main Content Area */}
        <main className="p-4 sm:p-6 md:p-8 flex-1">
          {currentView === 'view-inicio' && (
            <HomeView
              products={products}
              discountedIds={discountedProductIds}
              onNavigate={setCurrentView}
              onAddToCart={handleAddToCart}
              onOpenModal={setModalProduct}
              isLoggedIn={!!currentUser}
            />
          )}

          {currentView === 'view-productos' && (
            <CatalogView
              products={products}
              discountedIds={discountedProductIds}
              searchTerm={searchTerm}
              onClearSearch={() => setSearchTerm('')}
              onAddToCart={handleAddToCart}
              onOpenModal={setModalProduct}
              isLoggedIn={!!currentUser}
            />
          )}

          {currentView === 'view-contacto' && (
            <ContactView currentUser={currentUser} showToast={showToast} />
          )}

          {(currentView === 'view-login' || currentView === 'view-registro') && (
            <AuthViews
              currentView={currentView}
              onNavigate={setCurrentView}
              onLoginSuccess={handleLoginSuccess}
              showToast={showToast}
            />
          )}

          {currentView === 'view-carrito' && (
            <CartView
              cart={cart}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveFromCart}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'view-checkout' && (
            <CheckoutView
              cart={cart}
              currentUser={currentUser}
              onOrderSuccess={handleOrderSuccess}
              showToast={showToast}
            />
          )}

          {currentView === 'view-success' && (
            <SuccessView
              orderData={lastOrderData}
              onNavigate={setCurrentView}
              showToast={showToast}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="bg-[#002244] text-white/80 text-xs px-6 py-6 border-t border-gray-200 mt-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
              <div className="font-extrabold text-base text-white">
                Plagas<span className="text-[#81c784]">Online</span>.es
              </div>
              <p className="text-white/60 text-[11px] mt-0.5">
                Especialistas en control profesional de plagas, raticidas y desinfección ambiental.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-white/70">
              <span>Distribuidores oficiales: Bayer, BASF, Syngenta, Remi Control</span>
              <span>•</span>
              <span>Registro Sanitario Oficial</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 text-center text-white/40 text-[10px]">
            © {new Date().getFullYear()} PlagasOnline.es — Todos los derechos reservados. Mocejón, Toledo.
          </div>
        </footer>
      </div>

      {/* Quick View Modal */}
      <ProductModal
        product={modalProduct}
        isDiscounted={!!currentUser && !!modalProduct && discountedProductIds.includes(modalProduct.id)}
        onClose={() => setModalProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Toast notifications */}
      <Toast message={toastMessage} />
    </div>
  );
}
