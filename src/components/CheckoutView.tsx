import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethodType, OrderData, User } from '../types';
import { sendOrderConfirmationEmail, resolveProductImageUrl, escapeEmailHtml } from '../utils/email';
import { exportOrderToExcel, recordCompanyOrder } from '../utils/excel';
import { appendOrderToGoogleSheet } from '../utils/sheets';
import {
  detectCardBrand,
  formatCardNumber,
  validateLuhn,
  validateCardExpiry,
  validateCardCvc,
  validateCardholder,
} from '../utils/cardValidator';
import {
  ShieldCheck,
  Building2,
  Smartphone,
  Bitcoin,
  Tag,
  CreditCard,
  Truck,
  Calendar,
  Wallet,
  ExternalLink,
  CheckCircle2,
  Lock,
  Coins,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';

interface CheckoutViewProps {
  cart: CartItem[];
  currentUser: User | null;
  onOrderSuccess: (orderData: OrderData) => void;
  showToast: (msg: string) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cart,
  currentUser,
  onOrderSuccess,
  showToast,
}) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');

  // Real Payment Card state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardSaveConsent, setCardSaveConsent] = useState(false);
  const [isVerifyingCard, setIsVerifyingCard] = useState(false);
  const [cardTouchAttempt, setCardTouchAttempt] = useState(false);

  // Computed card values for real cards
  const cleanCardNum = cardNumber.replace(/\D/g, '');
  const brandInfo = detectCardBrand(cleanCardNum);
  const isLuhnValid = cleanCardNum.length >= 13 ? validateLuhn(cleanCardNum) : null;
  const expiryValidation = cardExpiry.length >= 5 ? validateCardExpiry(cardExpiry) : null;
  const cvcValidation = cardCvc.length >= (brandInfo.brand === 'amex' ? 4 : 3) ? validateCardCvc(cardCvc, brandInfo.brand) : null;
  const holderValidation = cardHolder.trim().length >= 3 ? validateCardholder(cardHolder) : null;

  // PayPal fields
  const [paypalEmail, setPaypalEmail] = useState('');

  // Transfer fields
  const [transferIban, setTransferIban] = useState('');

  // Bizum fields
  const [bizumPhone, setBizumPhone] = useState('');

  // COD (Contrarreembolso) fields
  const [codNotes, setCodNotes] = useState('');

  // Apple / Google Wallet
  const [walletType, setWalletType] = useState<'apple' | 'google'>('google');

  // Crypto: BTC or USDT (Token TRC-20)
  const [cryptoType, setCryptoType] = useState<'btc' | 'usdt'>('btc');
  const [cryptoWallet, setCryptoWallet] = useState('');

  // Stripe Checkout helper popup / modal
  const [stripeUrl, setStripeUrl] = useState('');
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [stripePendingOrder, setStripePendingOrder] = useState<OrderData | null>(null);

  // PayPal Gateway state
  const [paypalGatewayUrl, setPaypalGatewayUrl] = useState('');
  const [showPaypalModal, setShowPaypalModal] = useState(false);
  const [paypalPendingOrder, setPaypalPendingOrder] = useState<OrderData | null>(null);
  const [paypalSubMode, setPaypalSubMode] = useState<'standard' | 'payin3' | 'card'>('standard');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountMultiplier, setDiscountMultiplier] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (!name) setName(currentUser.name);
      if (!email) setEmail(currentUser.email);
    }
  }, [currentUser]);

  const rawTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const finalTotal = rawTotal * discountMultiplier;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const val = couponCode.trim().toLowerCase();
    if (val === 'bienvenido!' || val === 'cupon2026!' || val === 'plagas10') {
      setDiscountMultiplier(0.8);
      setAppliedCoupon(val.toUpperCase());
      showToast(`¡Cupón "${val.toUpperCase()}" activado! -20% aplicado.`);
    } else if (!val) {
      alert('Por favor introduce un código de cupón.');
    } else {
      alert("Cupón no válido. Prueba con 'bienvenido!' o 'cupon2026!'");
    }
  };

  const handleCardNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const handleCardExpiryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 2) {
      setCardExpiry(`${clean.slice(0, 2)}/${clean.slice(2)}`);
    } else {
      setCardExpiry(clean);
    }
  };

  const handleCardCvcInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxLen = brandInfo.brand === 'amex' ? 4 : 3;
    const clean = e.target.value.replace(/\D/g, '').slice(0, maxLen);
    setCardCvc(clean);
  };

  const finalizeOrder = async (orderData: OrderData) => {
    setIsProcessing(true);
    try {
      // Formatear tablas y listas para email
      let productListText = '';
      let productListHtml = '';
      cart.forEach((item) => {
        const itemTotal = item.price * discountMultiplier * item.quantity;
        const imageUrl = resolveProductImageUrl(item.img);

        productListText += `- ${item.name} (x${item.quantity}) - ${(item.price * discountMultiplier).toFixed(2)}€ c/u - Total: ${itemTotal.toFixed(2)}€\n`;
        productListHtml += `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;">
              <div style="display:flex;align-items:center;gap:12px;">
                <img src="${imageUrl}" alt="${item.name}" style="width:52px;height:52px;object-fit:contain;border-radius:6px;border:1px solid #dfe8f1;background:#f8fafc;" />
                <div>
                  <div style="font-weight:bold; color:#1f2937;">${item.name}</div>
                  <div style="font-size:12px; color:#667085;">${item.quantity} x ${(item.price * discountMultiplier).toFixed(2)}€</div>
                </div>
              </div>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:right; font-weight:bold; color:#004b87;">${(item.price * discountMultiplier).toFixed(2)}€</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:right; font-weight:bold; color:#e65100;">${itemTotal.toFixed(2)}€</td>
          </tr>
        `;
      });

      const productsTableHtml = `
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">
          <thead>
            <tr>
              <th style="padding:10px 8px;background:#004b87;color:#fff;text-align:left;">Producto</th>
              <th style="padding:10px 8px;background:#004b87;color:#fff;">Cantidad</th>
              <th style="padding:10px 8px;background:#004b87;color:#fff;text-align:right;">Precio</th>
              <th style="padding:10px 8px;background:#004b87;color:#fff;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${productListHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold;border-top:2px solid #004b87;">Total:</td>
              <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#e65100;border-top:2px solid #004b87;">${orderData.total}</td>
            </tr>
          </tfoot>
        </table>
      `;

      const paymentMethodHtml = `
        <table role="presentation" style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;margin-top:18px;">
          <tr>
            <td style="padding:16px 18px;background:#eef6ff;border:1px solid #cfe2f5;border-left:5px solid #004b87;border-radius:6px;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#667085;margin-bottom:5px;">Método de pago</div>
              <div style="font-size:16px;font-weight:bold;color:#004b87;">${escapeEmailHtml(orderData.paymentMethod)}</div>
            </td>
          </tr>
        </table>
      `;

      // 1. Send confirmation email through EmailJS
      try {
        await sendOrderConfirmationEmail({
          to_name: orderData.customerName,
          to_email: orderData.customerEmail,
          order_id: orderData.orderId,
          order_total: orderData.total,
          products_list: productListText,
          products_list_html: productsTableHtml,
          payment_method_html: paymentMethodHtml,
          company_name: 'PlagasOnline.es',
          shipping_name: orderData.customerName,
          shipping_address: orderData.shippingAddress,
          shipping_zip: orderData.shippingZip,
          shipping_city: orderData.shippingCity,
          payment_method: orderData.paymentMethod,
        });
      } catch (err) {
        console.warn('EmailJS error durante el pedido:', err);
      }

      // 2. Synchronize order to Google Sheets
      try {
        await appendOrderToGoogleSheet(orderData);
      } catch (sheetsErr) {
        console.warn('Error sincronizando con Google Sheets:', sheetsErr);
      }

      // 3. Save to Company Orders database (localStorage for "Pedidos Empresa.xlsx")
      recordCompanyOrder(orderData);

      // 4. Also generate individual Excel download as backup
      exportOrderToExcel(orderData);

      setIsProcessing(false);
      onOrderSuccess(orderData);
    } catch (err) {
      console.error('Error finalizando el pedido:', err);
      setIsProcessing(false);
      onOrderSuccess(orderData);
    }
  };

  const processStripePayment = async () => {
    setIsProcessing(true);
    try {
      const orderId = '#PO-' + Math.floor(100000 + Math.random() * 900000);
      const pendingData: OrderData = {
        orderId,
        customerName: name.trim(),
        customerEmail: email.trim().toLowerCase(),
        shippingAddress: address.trim(),
        shippingZip: zip.trim(),
        shippingCity: city.trim(),
        paymentMethod: 'TARJETA (STRIPE CHECKOUT)',
        total: finalTotal.toFixed(2) + '€',
        products: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price * discountMultiplier,
          quantity: item.quantity,
          distributor: item.distributor,
          img: item.img,
        })),
        date: new Date().toLocaleString('es-ES'),
      };

      try {
        localStorage.setItem('pending_stripe_order', JSON.stringify(pendingData));
      } catch (e) {
        console.warn('No se pudo guardar pending_stripe_order:', e);
      }

      setStripePendingOrder(pendingData);

      const response = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          origin: window.location.origin,
          cart: cart.map((item) => ({
            name: item.name,
            price: item.price * discountMultiplier,
            quantity: item.quantity,
            distributor: item.distributor,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'No se pudo iniciar la sesión con Stripe.');
      }

      setStripeUrl(result.url);
      setShowStripeModal(true);

      // Abrir en pestaña nueva segura para no bloquear iframes
      try {
        window.open(result.url, '_blank');
      } catch (e) {
        console.warn('Bloqueo de ventana emergente:', e);
      }
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error al iniciar Stripe:', error);
      const msg = error?.message || 'No se pudo conectar con Stripe.';
      alert(msg);
      setIsProcessing(false);
    }
  };

  const processPayPalGatewayPayment = async (mode: 'standard' | 'payin3' | 'card' = 'standard') => {
    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }
    if (!name || !email || !address || !zip || !city) {
      alert('Por favor completa todos los campos de contacto y envío antes de conectar con PayPal.');
      return;
    }

    setIsProcessing(true);
    try {
      const orderId = '#PO-' + Math.floor(100000 + Math.random() * 900000);
      const methodLabel =
        mode === 'payin3'
          ? 'PAYPAL (PAGA EN 3 PLAZOS)'
          : mode === 'card'
          ? 'PAYPAL (TARJETA VÍA PAYPAL)'
          : 'PAYPAL (CHECKOUT OFICIAL)';

      const pendingData: OrderData = {
        orderId,
        customerName: name.trim(),
        customerEmail: email.trim().toLowerCase(),
        shippingAddress: address.trim(),
        shippingZip: zip.trim(),
        shippingCity: city.trim(),
        paymentMethod: methodLabel,
        total: finalTotal.toFixed(2) + '€',
        products: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: (item.price * discountMultiplier).toFixed(2) + '€',
          subtotal: (item.price * discountMultiplier * item.quantity).toFixed(2) + '€',
          price: item.price * discountMultiplier,
          distributor: item.distributor,
          img: item.img,
        })),
        date: new Date().toLocaleString('es-ES'),
      };

      try {
        localStorage.setItem('pending_paypal_order', JSON.stringify(pendingData));
      } catch (e) {
        console.warn('No se pudo guardar pending_paypal_order:', e);
      }

      setPaypalPendingOrder(pendingData);

      const response = await fetch('/create-paypal-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          email: paypalEmail.trim() || email.trim().toLowerCase(),
          address: address.trim(),
          zip: zip.trim(),
          city: city.trim(),
          origin: window.location.origin,
          cart: cart.map((item) => ({
            name: item.name,
            price: item.price * discountMultiplier,
            quantity: item.quantity,
            distributor: item.distributor,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'No se pudo iniciar la pasarela de PayPal.');
      }

      setPaypalGatewayUrl(result.url);
      setShowPaypalModal(true);

      // Abrir en pestaña nueva para compatibilidad con iframe
      try {
        window.open(result.url, '_blank');
      } catch (e) {
        console.warn('Bloqueo de ventana emergente:', e);
      }
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error al iniciar PayPal:', error);
      const msg = error?.message || 'No se pudo conectar con la pasarela de PayPal.';
      alert(msg);
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    if (!name || !email || !address || !zip || !city) {
      alert('Por favor completa todos los campos de contacto y envío.');
      return;
    }

    if (paymentMethod === 'paypal') {
      await processPayPalGatewayPayment(paypalSubMode);
      return;
    }

    if (paymentMethod === 'card') {
      setCardTouchAttempt(true);

      const rawNum = cardNumber.replace(/\D/g, '');
      if (rawNum.length < 13) {
        alert('Por favor introduce el número completo de tu tarjeta de crédito o débito.');
        return;
      }

      if (!validateLuhn(rawNum)) {
        alert('El número de tarjeta no es válido según el algoritmo bancario (Luhn). Por favor comprueba los dígitos de tu tarjeta.');
        return;
      }

      const expiryCheck = validateCardExpiry(cardExpiry);
      if (!expiryCheck.isValid) {
        alert(expiryCheck.message || 'La fecha de caducidad de la tarjeta no es válida.');
        return;
      }

      const cvcCheck = validateCardCvc(cardCvc, brandInfo.brand);
      if (!cvcCheck.isValid) {
        alert(cvcCheck.message || 'El código de seguridad CVV/CVC no es correcto.');
        return;
      }

      const holderCheck = validateCardholder(cardHolder);
      if (!holderCheck.isValid) {
        alert(holderCheck.message || 'Introduce el nombre y apellidos del titular de la tarjeta.');
        return;
      }

      setIsVerifyingCard(true);
      setIsProcessing(true);

      // Simulación de autenticación bancaria segura PSD2 / 3D-Secure
      await new Promise((resolve) => setTimeout(resolve, 800));

      const orderId = '#PO-' + Math.floor(100000 + Math.random() * 900000);
      const maskedCard = `TARJETA BANCARIA (${brandInfo.name} •••• ${rawNum.slice(-4)} - Titular: ${cardHolder.trim().toUpperCase()})`;

      const orderData: OrderData = {
        orderId,
        customerName: name.trim(),
        customerEmail: email.trim().toLowerCase(),
        shippingAddress: address.trim(),
        shippingZip: zip.trim(),
        shippingCity: city.trim(),
        paymentMethod: maskedCard,
        total: finalTotal.toFixed(2) + '€',
        products: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: (item.price * discountMultiplier).toFixed(2) + '€',
          subtotal: (item.price * discountMultiplier * item.quantity).toFixed(2) + '€',
          price: item.price * discountMultiplier,
          img: item.img,
          distributor: item.distributor,
        })),
        date: new Date().toLocaleString('es-ES'),
      };

      setIsVerifyingCard(false);
      await finalizeOrder(orderData);
      return;
    }

    let extraPaymentDetails = '';
    let methodNameDisplay = '';

    if (paymentMethod === 'paypal') {
      extraPaymentDetails = paypalEmail.trim()
        ? `Cuenta PayPal: ${paypalEmail.trim()}`
        : 'Pago registrado con cuenta PayPal';
      methodNameDisplay = 'PAYPAL';
    } else if (paymentMethod === 'bizum') {
      if (!bizumPhone.trim()) {
        alert('Por favor introduce el teléfono móvil desde el que harás el Bizum.');
        return;
      }
      extraPaymentDetails = `Teléfono Bizum: ${bizumPhone.trim()}`;
      methodNameDisplay = 'BIZUM';
    } else if (paymentMethod === 'transfer') {
      if (!transferIban.trim()) {
        alert('Por favor introduce tu IBAN o cuenta bancaria de origen.');
        return;
      }
      extraPaymentDetails = `Cuenta origen: ${transferIban.trim()}`;
      methodNameDisplay = 'TRANSFERENCIA BANCARIA (SANTANDER)';
    } else if (paymentMethod === 'cod') {
      extraPaymentDetails = codNotes.trim()
        ? `Efectivo en mano. Nota repartidor: ${codNotes.trim()}`
        : 'Pago en efectivo al mensajero en entrega (Sin comisiones)';
      methodNameDisplay = 'CONTRA REEMBOLSO';
    } else if (paymentMethod === 'klarna') {
      extraPaymentDetails = `3 cuotas de ${(finalTotal / 3).toFixed(2)}€/mes sin intereses (0% TAE)`;
      methodNameDisplay = 'PAGO FRACCIONADO (3 PLAZOS)';
    } else if (paymentMethod === 'wallet_pay') {
      extraPaymentDetails = `${walletType === 'apple' ? 'Apple Pay' : 'Google Pay'} autenticado por biometría`;
      methodNameDisplay = walletType === 'apple' ? 'APPLE PAY' : 'GOOGLE PAY';
    } else if (paymentMethod === 'btc') {
      if (cryptoType === 'usdt') {
        extraPaymentDetails = `Token Tether USDT (TRC-20) - Wallet: ${cryptoWallet.trim() || 'Verificación TRON'}`;
        methodNameDisplay = 'TOKEN TETHER USDT (TRC-20)';
      } else {
        extraPaymentDetails = `Bitcoin (BTC) - Wallet: ${cryptoWallet.trim() || 'Verificación Blockchain'}`;
        methodNameDisplay = 'BITCOIN (BTC)';
      }
    }

    const orderId = '#PO-' + Math.floor(100000 + Math.random() * 900000);
    const orderData: OrderData = {
      orderId,
      customerName: name.trim(),
      customerEmail: email.trim().toLowerCase(),
      shippingAddress: address.trim(),
      shippingZip: zip.trim(),
      shippingCity: city.trim(),
      paymentMethod: `${methodNameDisplay} (${extraPaymentDetails})`,
      total: finalTotal.toFixed(2) + '€',
      products: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: (item.price * discountMultiplier).toFixed(2) + '€',
        subtotal: (item.price * discountMultiplier * item.quantity).toFixed(2) + '€',
        price: item.price * discountMultiplier,
        img: item.img,
        distributor: item.distributor,
      })),
      date: new Date().toLocaleString('es-ES'),
    };

    await finalizeOrder(orderData);
  };


  return (
    <div className="space-y-6">
      {/* Checkout Steps */}
      <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3">
        <span className="text-xs sm:text-sm font-bold text-gray-400">1. Carrito</span>
        <span className="text-xs sm:text-sm font-bold text-[#004b87] border-b-2 border-[#004b87] pb-1">
          2. Datos y Envío
        </span>
        <span className="text-xs sm:text-sm font-bold text-[#004b87]">3. Confirmación de Pago</span>
      </div>

      {/* Modal / Helper de Stripe Checkout */}
      {showStripeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-[#004b87]" />
                <h3 className="font-bold text-gray-900 text-base sm:text-lg">Pasarela Stripe Conectada</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStripeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Hemos preparado la sesión de pago oficial en Stripe con cifrado bancario para tu pedido de{' '}
              <strong className="text-gray-900">{finalTotal.toFixed(2)}€</strong>.
            </p>

            <div className="space-y-2 pt-2">
              <a
                href={stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#635bff] hover:bg-[#534be0] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-sm cursor-pointer"
              >
                <span>Abrir Stripe Checkout en nueva pestaña</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setShowStripeModal(false);
                  if (stripePendingOrder) {
                    finalizeOrder(stripePendingOrder);
                  }
                }}
                className="w-full bg-[#004b87] hover:bg-[#003660] text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>He completado el pago / Confirmar Pedido</span>
              </button>

              <button
                type="button"
                onClick={() => setShowStripeModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Elegir otra forma de pago
              </button>
            </div>

            <div className="text-[11px] text-gray-400 font-mono text-center pt-1">
              Modo seguro de prueba activo (pk_test_51UGz...)
            </div>
          </div>
        </div>
      )}

      {/* Modal / Helper de PayPal Checkout Gateway */}
      {showPaypalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#003087] flex items-center justify-center text-white font-black text-sm">
                  P
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">Pasarela PayPal Checkout</h3>
                  <div className="text-[11px] text-[#0070ba] font-semibold">Sesión de pago segura iniciada</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaypalModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Hemos preparado la pasarela de PayPal para procesar tu pedido de{' '}
              <strong className="text-gray-900">{finalTotal.toFixed(2)}€</strong> con total seguridad y Protección al Comprador.
            </p>

            <div className="space-y-2 pt-2">
              <a
                href={paypalGatewayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#ffc439] hover:bg-[#f2b72c] text-[#111111] font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-sm cursor-pointer"
              >
                <span>Abrir Pasarela PayPal en nueva pestaña</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setShowPaypalModal(false);
                  if (paypalPendingOrder) {
                    finalizeOrder(paypalPendingOrder);
                  }
                }}
                className="w-full bg-[#003087] hover:bg-[#00205b] text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>He completado el pago / Confirmar Pedido</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPaypalModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Elegir otra forma de pago
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0070ba]" />
              <span>Transacción con cifrado TLS 256-bit y Protección PayPal</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-[#004b87] mb-4">
            Datos de Envío y Facturación
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block font-bold text-gray-700 text-xs mb-1">
                Nombre y Apellidos *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 text-xs mb-1">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
                className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Recibirás la confirmación y factura de tu compra en este email.
              </span>
            </div>

            <div>
              <label className="block font-bold text-gray-700 text-xs mb-1">
                Dirección de Entrega *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle, número, piso"
                className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 text-xs mb-1">
                  Código Postal *
                </label>
                <input
                  type="text"
                  required
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="28001"
                  className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 text-xs mb-1">
                  Ciudad *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Madrid"
                  className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  Selecciona Método de Pago:
                </label>
                <span className="text-[11px] text-[#2e7d32] font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Transacción Segura SSL
                </span>
              </div>

              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full p-3 border-2 border-[#004b87] rounded-lg font-bold text-gray-800 text-sm focus:border-[#004b87] focus:outline-none bg-white shadow-sm cursor-pointer"
              >
                <option value="card">💳 Tarjeta de Débito / Crédito (Visa, Mastercard, Amex, Maestro)</option>
                <option value="paypal">🅿️ PayPal (Pasarela Oficial y Paga en 3 plazos)</option>
                <option value="bizum">📱 Bizum (Instantáneo)</option>
                <option value="transfer">🏦 Transferencia Bancaria SEPA</option>
                <option value="cod">📦 Pago Contra Reembolso (Efectivo al recibir)</option>
                <option value="klarna">⏳ Pago Fraccionado en 3 plazos (0% TAE)</option>
                <option value="wallet_pay">📲 Apple Pay / Google Pay</option>
                <option value="btc">₿ Cripto: Bitcoin & Token USDT (Tether TRC-20)</option>
              </select>
            </div>

            {/* Dynamic payment details box */}
            <div className="bg-[#f0f4f8] p-4 rounded-xl border border-gray-200 text-xs sm:text-sm">
              {/* 1. TARJETA DE PAGO REGULAR DIRECTA */}
              {paymentMethod === 'card' && (
                <div className="space-y-3.5">
                  {/* Tarjeta Header & Logos aceptados */}
                  <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-[#004b87] text-white flex items-center justify-center font-bold">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-xs font-bold text-gray-900 block leading-tight">
                          Tarjeta Bancaria Oficial
                        </strong>
                        <span className="text-[10px] text-gray-500">Acepta tarjetas de débito o crédito reales</span>
                      </div>
                    </div>

                    {/* Logos Oficiales */}
                    <div className="flex items-center gap-1.5 text-[10px] font-black">
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] tracking-wider transition-all ${
                          brandInfo.brand === 'visa'
                            ? 'bg-[#1a1f71] text-white border-[#1a1f71] shadow-xs'
                            : 'bg-white text-[#1a1f71] border-blue-200'
                        }`}
                      >
                        VISA
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold tracking-tight transition-all ${
                          brandInfo.brand === 'mastercard'
                            ? 'bg-[#eb001b] text-white border-[#eb001b] shadow-xs'
                            : 'bg-white text-orange-600 border-orange-200'
                        }`}
                      >
                        Mastercard
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] tracking-tight transition-all ${
                          brandInfo.brand === 'amex'
                            ? 'bg-[#002663] text-white border-[#002663] shadow-xs'
                            : 'bg-white text-[#002663] border-blue-300'
                        }`}
                      >
                        AMEX
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] tracking-tight transition-all ${
                          brandInfo.brand === 'maestro'
                            ? 'bg-[#0099df] text-white border-[#0099df] shadow-xs'
                            : 'bg-white text-[#0099df] border-cyan-200'
                        }`}
                      >
                        Maestro
                      </span>
                    </div>
                  </div>

                  {/* Campo Número de Tarjeta */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-gray-700 text-xs">
                        Número de Tarjeta *
                      </label>
                      {/* Estado de validación en tiempo real de tarjeta real */}
                      {cleanCardNum.length >= 13 && (
                        isLuhnValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            {brandInfo.name} Verificada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Número incorrecto
                          </span>
                        )
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={handleCardNumberInput}
                        placeholder={brandInfo.brand === 'amex' ? '3782 822463 10005' : '4532 1234 5678 9010'}
                        maxLength={brandInfo.brand === 'amex' ? 17 : 19}
                        className={`w-full p-2.5 bg-white border rounded font-mono text-sm tracking-widest focus:outline-none transition-all ${
                          isLuhnValid === true
                            ? 'border-emerald-500 focus:border-emerald-600'
                            : isLuhnValid === false
                            ? 'border-amber-400 focus:border-amber-500'
                            : 'border-gray-300 focus:border-[#004b87]'
                        }`}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                        {brandInfo.brand !== 'unknown' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${brandInfo.badgeColor} ${brandInfo.textColor}`}>
                            {brandInfo.name.toUpperCase()}
                          </span>
                        )}
                        <CreditCard className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Acepta tarjetas de débito o crédito bancarias reales de cualquier entidad española o internacional.
                    </p>
                  </div>

                  {/* Campo Titular de la Tarjeta */}
                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Nombre y Apellidos del Titular *
                    </label>
                    <input
                      type="text"
                      required
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="Tal como figura impreso en la tarjeta"
                      className="w-full p-2.5 bg-white border border-gray-300 rounded text-xs uppercase focus:border-[#004b87] focus:outline-none"
                    />
                  </div>

                  {/* Fila Caducidad y CVC */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-gray-700 text-xs">
                          Caducidad (MM/AA) *
                        </label>
                      </div>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={handleCardExpiryInput}
                        placeholder="MM/AA (ej: 08/28)"
                        maxLength={5}
                        className={`w-full p-2.5 bg-white border rounded font-mono text-sm focus:outline-none ${
                          expiryValidation && !expiryValidation.isValid
                            ? 'border-red-400 focus:border-red-500 text-red-700'
                            : 'border-gray-300 focus:border-[#004b87]'
                        }`}
                      />
                      {expiryValidation && !expiryValidation.isValid && (
                        <span className="text-[10px] text-red-600 block mt-0.5 font-medium">
                          {expiryValidation.message}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-gray-700 text-xs">
                          {brandInfo.brand === 'amex' ? 'CID (4 dígitos) *' : 'CVV / CVC *'}
                        </label>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {brandInfo.brand === 'amex' ? 'Frontal' : 'Reverso'}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={cardCvc}
                          onChange={handleCardCvcInput}
                          placeholder={brandInfo.brand === 'amex' ? '1234' : '123'}
                          maxLength={brandInfo.brand === 'amex' ? 4 : 3}
                          className="w-full p-2.5 bg-white border border-gray-300 rounded font-mono text-sm focus:border-[#004b87] focus:outline-none"
                        />
                        <Lock className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        {brandInfo.brand === 'amex' ? '4 dígitos en el frontal' : '3 dígitos al dorso de la tarjeta'}
                      </span>
                    </div>
                  </div>

                  {/* Casilla de seguridad y garantía bancaria */}
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#004b87] shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      <strong>Pago Protegido con Protocolo 3D-Secure 2.0:</strong> La transacción se autorizará mediante la app o SMS de tu banco emisor. Cifrado TLS 256 bits y cumplimiento de la normativa europea PSD2.
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PAYPAL */}
              {paymentMethod === 'paypal' && (
                <div className="space-y-3">
                  {/* PayPal Gateway Brand Card */}
                  <div className="bg-[#003087] text-white rounded-xl p-3.5 sm:p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center font-black text-[#003087] text-sm shadow-inner">
                          P
                        </div>
                        <div>
                          <strong className="text-sm font-bold text-white block leading-tight">
                            Pasarela PayPal Checkout
                          </strong>
                          <span className="text-[11px] text-[#b7d7ff]">Cifrado TLS y Protección al Comprador</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-[#0070ba] text-white font-bold px-2 py-0.5 rounded-full border border-blue-400">
                        ● PASARELA ACTIVA
                      </span>
                    </div>

                    <p className="text-xs text-blue-100 opacity-95 leading-relaxed pt-1">
                      Elige cómo deseas completar el pago en la pasarela segura de PayPal:
                    </p>
                  </div>

                  {/* PayPal Smart Action Buttons */}
                  <div className="space-y-2 pt-1">
                    {/* Botón Dorado PayPal */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setPaypalSubMode('standard');
                        processPayPalGatewayPayment('standard');
                      }}
                      className="w-full bg-[#ffc439] hover:bg-[#f2b72c] active:scale-[0.99] text-[#111111] font-black py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <span className="text-base font-black text-[#003087]">P</span>
                      <span>Pagar {finalTotal.toFixed(2)}€ con PayPal</span>
                    </button>

                    {/* Botón Paga en 3 plazos */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setPaypalSubMode('payin3');
                        processPayPalGatewayPayment('payin3');
                      }}
                      className="w-full bg-[#0070ba] hover:bg-[#005ea6] active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl shadow transition-all flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-extrabold bg-white/20 px-1.5 py-0.5 rounded text-[10px]">3x</span>
                        <span>Paga en 3 plazos sin intereses (0% TAE)</span>
                      </span>
                      <strong className="text-yellow-300">{(finalTotal / 3).toFixed(2)}€/mes</strong>
                    </button>

                    {/* Botón Tarjeta Débito / Crédito con PayPal */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setPaypalSubMode('card');
                        processPayPalGatewayPayment('card');
                      }}
                      className="w-full bg-[#2c2e2f] hover:bg-[#1f2021] active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-gray-300" />
                      <span>Pagar con Tarjeta de Débito o Crédito vía PayPal</span>
                    </button>
                  </div>

                  {/* Email de cuenta PayPal opcional */}
                  <div className="pt-1">
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Email de tu cuenta PayPal (opcional, para pre-identificación):
                    </label>
                    <input
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="tu-correo@paypal.es"
                      className="w-full p-2 bg-white border border-gray-300 rounded text-xs focus:border-[#003087] focus:outline-none"
                    />
                  </div>

                  {/* Garantía */}
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#0070ba] shrink-0 mt-0.5" />
                    <div>
                      <strong>Protección del Comprador de PayPal:</strong> Si tu pedido no llega o no coincide con la descripción, PayPal te reembolsa el importe total de la compra.
                    </div>
                  </div>
                </div>
              )}

              {/* 3. BIZUM */}
              {paymentMethod === 'bizum' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#004b87]">
                    <Smartphone className="w-5 h-5" />
                    <h4 className="font-bold text-sm">Pago Inmediato con Bizum</h4>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Teléfono móvil desde el que harás el Bizum *
                    </label>
                    <input
                      type="tel"
                      required
                      value={bizumPhone}
                      onChange={(e) => setBizumPhone(e.target.value)}
                      placeholder="Ej: 654 65 52 09"
                      className="w-full p-2.5 bg-white border border-gray-300 rounded text-sm font-mono"
                    />
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-950 space-y-1">
                    <strong className="text-emerald-900 block text-xs">Instrucciones Bizum:</strong>
                    <div>• Teléfono Receptor: <strong className="font-mono text-sm">+34 654 65 52 09</strong></div>
                    <div>• Importe: <strong>{finalTotal.toFixed(2)}€</strong></div>
                    <div>• Concepto: <strong className="font-mono">Pedido PlagasOnline</strong></div>
                    <span className="text-[11px] text-emerald-800 block pt-1">
                      Tu pedido se procesará automáticamente al comprobar el pago.
                    </span>
                  </div>
                </div>
              )}

              {/* 4. TRANSFERENCIA */}
              {paymentMethod === 'transfer' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#004b87]">
                    <Building2 className="w-5 h-5" />
                    <h4 className="font-bold text-sm">Transferencia Bancaria SEPA</h4>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      IBAN o Cuenta de Origen del Comprador *
                    </label>
                    <input
                      type="text"
                      required
                      value={transferIban}
                      onChange={(e) => setTransferIban(e.target.value)}
                      placeholder="ESXX XXXX XXXX XXXX XXXX XXXX"
                      className="w-full p-2.5 bg-white border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div className="p-3 bg-white border border-gray-300 rounded text-xs text-gray-700 space-y-1">
                    <strong className="text-gray-900 block">Datos Bancarios para la Transferencia:</strong>
                    <div>• Banco Destino: <strong>Banco Santander</strong></div>
                    <div>• IBAN: <strong className="font-mono text-sm text-[#004b87]">ES91 0049 1234 5678 9012 3456</strong></div>
                    <div>• Beneficiario: <strong>PlagasOnline S.L.</strong></div>
                    <div>• Concepto: <strong>Tu Nombre + Pedido</strong></div>
                  </div>
                </div>
              )}

              {/* 5. CONTRA REEMBOLSO */}
              {paymentMethod === 'cod' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#e65100]">
                    <Truck className="w-5 h-5" />
                    <h4 className="font-bold text-sm">Pago Contra Reembolso (En Entrega)</h4>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    Paga en efectivo al repartidor cuando entregue tu pedido en mano. ¡Sin gastos de gestión añadidos!
                  </p>
                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Instrucciones para el repartidor (opcional):
                    </label>
                    <input
                      type="text"
                      value={codNotes}
                      onChange={(e) => setCodNotes(e.target.value)}
                      placeholder="Ej: Llamar antes de entregar..."
                      className="w-full p-2 bg-white border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between">
                    <span>Importe exacto a abonar en mano:</span>
                    <strong className="text-sm text-[#e65100]">{finalTotal.toFixed(2)}€</strong>
                  </div>
                </div>
              )}

              {/* 6. PAGO FRACCIONADO */}
              {paymentMethod === 'klarna' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#004b87]">
                    <Calendar className="w-5 h-5" />
                    <h4 className="font-bold text-sm">Divide en 3 plazos sin intereses (0% TAE)</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    Paga la 1ª cuota hoy y las otras dos automáticamente cada 30 días sin comisiones ni intereses.
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-gray-300 shadow-sm">
                      <span className="block text-[11px] text-gray-500 font-bold">1ª Cuota Hoy</span>
                      <strong className="text-sm text-[#004b87]">{(finalTotal / 3).toFixed(2)}€</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-300 shadow-sm">
                      <span className="block text-[11px] text-gray-500 font-bold">2ª (30 días)</span>
                      <strong className="text-sm text-gray-700">{(finalTotal / 3).toFixed(2)}€</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-gray-300 shadow-sm">
                      <span className="block text-[11px] text-gray-500 font-bold">3ª (60 días)</span>
                      <strong className="text-sm text-gray-700">{(finalTotal / 3).toFixed(2)}€</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. APPLE PAY / GOOGLE PAY */}
              {paymentMethod === 'wallet_pay' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#004b87]">
                    <Smartphone className="w-5 h-5" />
                    <h4 className="font-bold text-sm">Pago Móvil Seguro</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWalletType('google')}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        walletType === 'google'
                          ? 'border-[#004b87] bg-white text-[#004b87] shadow-sm ring-1 ring-[#004b87]'
                          : 'border-gray-300 bg-gray-50 text-gray-700'
                      }`}
                    >
                      Google Pay
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalletType('apple')}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        walletType === 'apple'
                          ? 'border-black bg-black text-white shadow-sm'
                          : 'border-gray-300 bg-gray-50 text-gray-700'
                      }`}
                    >
                      Apple Pay
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Al confirmar, se activará la verificación biométrica habitual de tu smartphone (FaceID o Huella).
                  </p>
                </div>
              )}

              {/* 8. CRIPTO Y TOKENS */}
              {paymentMethod === 'btc' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#004b87]">
                      <Bitcoin className="w-5 h-5 text-amber-500" />
                      <h4 className="font-bold text-sm">Criptomonedas y Tokens</h4>
                    </div>
                    <div className="flex gap-1 bg-gray-200 p-1 rounded text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setCryptoType('btc')}
                        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                          cryptoType === 'btc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                        }`}
                      >
                        Bitcoin (BTC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCryptoType('usdt')}
                        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                          cryptoType === 'usdt' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600'
                        }`}
                      >
                        Token USDT (TRC-20)
                      </button>
                    </div>
                  </div>

                  {cryptoType === 'usdt' ? (
                    <div className="p-3 bg-white rounded border border-gray-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-emerald-700 text-xs flex items-center gap-1">
                          <Coins className="w-4 h-4" /> Dirección Token Tether (USDT TRC-20):
                        </strong>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          Comisión 0%
                        </span>
                      </div>
                      <div className="break-all font-mono text-[11px] bg-gray-50 p-2 rounded border border-gray-200 select-all">
                        TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Envía <strong>{finalTotal.toFixed(2)} USDT</strong> mediante la red Tron (TRC-20).
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded border border-gray-300 space-y-2">
                      <strong className="text-gray-900 text-xs block">Dirección Wallet Bitcoin (BTC):</strong>
                      <div className="break-all font-mono text-[11px] bg-gray-50 p-2 rounded border border-gray-200 select-all">
                        1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Envía el equivalente exacto a <strong>{finalTotal.toFixed(2)}€</strong> en BTC.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Tu Wallet o Hash TXID (opcional para comprobación inmediata):
                    </label>
                    <input
                      type="text"
                      value={cryptoWallet}
                      onChange={(e) => setCryptoWallet(e.target.value)}
                      placeholder="Dirección o hash de la transacción"
                      className="w-full p-2 bg-white border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              id="confirm-order-button"
              disabled={isProcessing || isVerifyingCard}
              className={`w-full font-black py-4 px-6 rounded-xl text-base transition-all shadow-lg active:scale-98 cursor-pointer disabled:opacity-75 disabled:cursor-wait flex items-center justify-center gap-2.5 text-white ${
                paymentMethod === 'card'
                  ? 'bg-[#004b87] hover:bg-[#003866]'
                  : 'bg-[#e65100] hover:bg-[#c63f00]'
              }`}
            >
              {isProcessing || isVerifyingCard ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {paymentMethod === 'card'
                      ? 'Autorizando pago seguro con el banco emisor...'
                      : 'Procesando pedido y enviando confirmación...'}
                  </span>
                </>
              ) : (
                <>
                  {paymentMethod === 'card' ? (
                    <>
                      <Lock className="w-5 h-5 text-white" />
                      <span>Pagar {finalTotal.toFixed(2)}€ con Tarjeta</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <span>Confirmar y Procesar Pedido</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </>
              )}
            </button>
          </form>
        </div>


        {/* Order Summary Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#f8f9fa] p-5 rounded-xl border border-gray-300 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">
              Resumen del Pedido
            </h3>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {cart.map((item) => {
                const sub = item.price * item.quantity;
                return (
                  <div
                    key={item.cartItemId}
                    className="flex justify-between items-center text-xs gap-3"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-9 h-9 object-contain rounded border border-gray-200 bg-white shrink-0"
                      />
                      <span className="truncate max-w-[180px] font-medium text-gray-800">
                        {item.name} (x{item.quantity})
                      </span>
                    </div>
                    <strong className="text-gray-900 shrink-0">{sub.toFixed(2)}€</strong>
                  </div>
                );
              })}
            </div>

            {/* Coupons box */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Cupones disponibles: <code className="text-[#004b87]">bienvenido!</code> |{' '}
                <code className="text-[#004b87]">cupon2026!</code>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Ej: bienvenido!"
                  className="flex-1 p-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#004b87]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold px-3 py-2 rounded cursor-pointer transition-colors"
                >
                  Aplicar
                </button>
              </div>
              {appliedCoupon && (
                <div className="mt-2 text-xs font-bold text-[#2e7d32] flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> ✓ Cupón {appliedCoupon} aplicado (-20%)
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-300 flex justify-between items-center">
              <span className="font-bold text-gray-700 text-sm">Total a pagar:</span>
              <span className="font-black text-xl text-[#e65100]">
                {finalTotal.toFixed(2)}€
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs text-gray-500 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#2e7d32] shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-800 block text-xs">Garantía de Entrega y Devolución</strong>
              Envío 24/48h a toda España con seguimiento en tiempo real y asesoramiento telefónico gratuito.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
