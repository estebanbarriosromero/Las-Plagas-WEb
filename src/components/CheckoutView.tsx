import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethodType, OrderData, User } from '../types';
import { sendOrderConfirmationEmail } from '../utils/email';
import { exportOrderToExcel } from '../utils/excel';
import { ShieldCheck, CreditCard, Building2, Smartphone, Bitcoin } from 'lucide-react';

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

  // Card fields
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Transfer fields
  const [transferIban, setTransferIban] = useState('');

  // Bizum fields
  const [bizumPhone, setBizumPhone] = useState('');

  // BTC fields
  const [btcWallet, setBtcWallet] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    if (!name || !email || !address || !zip || !city) {
      alert('Por favor completa todos los campos obligatorios.');
      return;
    }

    let extraPaymentDetails = '';
    if (paymentMethod === 'card') {
      if (!cardHolder || !cardNumber) {
        alert('Por favor completa los datos de la tarjeta.');
        return;
      }
      extraPaymentDetails = `Tarjeta Titular: ${cardHolder} (Nº terminación: ${cardNumber.slice(-4)})`;
    } else if (paymentMethod === 'transfer') {
      if (!transferIban) {
        alert('Por favor introduce tu IBAN o cuenta de origen.');
        return;
      }
      extraPaymentDetails = `Cuenta origen terminada en: ${transferIban.slice(-4)}`;
    } else if (paymentMethod === 'bizum') {
      if (!bizumPhone) {
        alert('Por favor introduce el teléfono móvil del Bizum.');
        return;
      }
      extraPaymentDetails = `Teléfono Bizum pagador: ${bizumPhone}`;
    } else if (paymentMethod === 'btc') {
      extraPaymentDetails = `Wallet Origen: ${btcWallet || 'No especificada'}`;
    }

    const orderId = '#PO-' + Math.floor(100000 + Math.random() * 900000);
    const orderTotalStr = finalTotal.toFixed(2) + '€';

    let productListText = '';
    let productListHtml = '';
    cart.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      productListText += `- ${item.name} (x${item.quantity}): ${itemTotal.toFixed(2)}€\n`;
      productListHtml += `<tr><td style="padding:8px;border-bottom:1px solid #e0e0e0;">${item.name}</td><td style="padding:8px;border-bottom:1px solid #e0e0e0;text-align:center;">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #e0e0e0;text-align:right;">${itemTotal.toFixed(2)}€</td></tr>`;
    });

    const productsTableHtml = `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;"><thead><tr><th style="padding:8px;background:#004b87;color:#fff;text-align:left;">Producto</th><th style="padding:8px;background:#004b87;color:#fff;">Cantidad</th><th style="padding:8px;background:#004b87;color:#fff;text-align:right;">Importe</th></tr></thead><tbody>${productListHtml}</tbody><tfoot><tr><td colspan="2" style="padding:10px 8px;text-align:right;font-weight:bold;border-top:2px solid #004b87;">Total:</td><td style="padding:10px 8px;text-align:right;font-weight:bold;color:#e65100;border-top:2px solid #004b87;">${orderTotalStr}</td></tr></tfoot></table>`;

    const orderData: OrderData = {
      orderId,
      customerName: name,
      customerEmail: email,
      shippingAddress: address,
      shippingZip: zip,
      shippingCity: city,
      paymentMethod: `${paymentMethod.toUpperCase()} (${extraPaymentDetails})`,
      total: orderTotalStr,
      products: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price.toFixed(2) + '€',
        subtotal: (item.price * item.quantity).toFixed(2) + '€',
      })),
      date: new Date().toLocaleDateString('es-ES'),
    };

    setIsProcessing(true);

    try {
      // Send confirmation email through EmailJS
      const emailResult = await sendOrderConfirmationEmail({
        to_name: name,
        to_email: email,
        order_id: orderId,
        order_total: orderTotalStr,
        products_list: productListText,
        products_list_html: productsTableHtml,
        company_name: 'PlagasOnline.es',
        shipping_name: name,
        shipping_address: address,
        shipping_zip: zip,
        shipping_city: city,
        payment_method: `${paymentMethod.toUpperCase()} (${extraPaymentDetails})`,
      });

      if (!emailResult.success) {
        console.warn('Nota sobre el envío de correo:', emailResult.message);
      }
    } catch (err) {
      console.warn('EmailJS error durante el pedido:', err);
    } finally {
      setIsProcessing(false);
      // Automatically export to Excel as in the original app
      exportOrderToExcel(orderData);
      onOrderSuccess(orderData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Checkout Steps */}
      <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3">
        <span className="text-xs sm:text-sm font-bold text-gray-400">1. Carrito</span>
        <span className="text-xs sm:text-sm font-bold text-[#004b87] border-b-2 border-[#004b87] pb-1">
          2. Datos y Envío
        </span>
        <span className="text-xs sm:text-sm font-bold text-[#004b87]">3. Confirmación</span>
      </div>

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

            <div className="grid grid-cols-2 gap-3">
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

            <h3 className="text-base font-bold text-[#004b87] pt-3 border-t border-gray-100">
              Selecciona Método de Pago
            </h3>

            <div>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full p-2.5 border border-gray-300 rounded font-semibold text-gray-800 bg-white focus:border-[#004b87] focus:outline-none"
              >
                <option value="card">💳 Tarjeta de Crédito / Débito</option>
                <option value="transfer">🏦 Transferencia Bancaria</option>
                <option value="bizum">📱 Bizum</option>
                <option value="btc">₿ Bitcoin (BTC)</option>
              </select>
            </div>

            {/* Dynamic payment details */}
            <div className="bg-[#f0f4f8] p-4 rounded-lg text-xs space-y-3">
              {paymentMethod === 'card' && (
                <div>
                  <h4 className="font-bold text-[#004b87] text-sm mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" /> Datos de la Tarjeta del Comprador:
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block font-semibold mb-0.5">
                        Nombre del Titular de la Tarjeta *
                      </label>
                      <input
                        type="text"
                        required
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="Nombre como aparece en la tarjeta"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-0.5">Número de Tarjeta *</label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold mb-0.5">Expira (MM/AA) *</label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={cardExp}
                          onChange={(e) => setCardExp(e.target.value)}
                          placeholder="12/28"
                          className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5">CVC / CVV *</label>
                        <input
                          type="text"
                          required
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="123"
                          className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-gray-500 pt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Transacción protegida por cifrado SSL seguro.
                    </p>
                  </div>
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div>
                  <h4 className="font-bold text-[#004b87] text-sm mb-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Datos bancarios del pagador:
                  </h4>
                  <div className="mb-3">
                    <label className="block font-semibold mb-0.5">
                      IBAN o Cuenta de Origen del Comprador *
                    </label>
                    <input
                      type="text"
                      required
                      value={transferIban}
                      onChange={(e) => setTransferIban(e.target.value)}
                      placeholder="ESXX XXXX XXXX XXXX XXXX XXXX"
                      className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                    />
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-gray-700 leading-relaxed">
                    <strong>Instrucciones de Transferencia:</strong>
                    <br />
                    • Banco Destino: Santander
                    <br />
                    • IBAN Destino: <code className="bg-white px-1 rounded font-bold">ES91 0049 1234 5678 9012 3456</code>
                    <br />
                    • Beneficiario: PlagasOnline S.L.
                    <br />
                    <em className="text-gray-500">Debes incluir tu nombre y el código de tu pedido en el concepto.</em>
                  </div>
                </div>
              )}

              {paymentMethod === 'bizum' && (
                <div>
                  <h4 className="font-bold text-[#004b87] text-sm mb-2 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" /> Datos Bizum del Comprador:
                  </h4>
                  <div className="mb-3">
                    <label className="block font-semibold mb-0.5">
                      Teléfono móvil desde el que harás el Bizum *
                    </label>
                    <input
                      type="tel"
                      required
                      value={bizumPhone}
                      onChange={(e) => setBizumPhone(e.target.value)}
                      placeholder="Ej: 600 000 000"
                      className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                    />
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-gray-700 leading-relaxed">
                    <strong>Instrucciones Bizum:</strong>
                    <br />
                    • Teléfono de Pago Destino: <strong className="text-green-700">+34 654 65 52 09</strong>
                    <br />
                    • Concepto: Pedido PlagasOnline
                    <br />
                    <em className="text-gray-500">Comprobaremos la entrada del dinero asociada a tu número de teléfono.</em>
                  </div>
                </div>
              )}

              {paymentMethod === 'btc' && (
                <div>
                  <h4 className="font-bold text-[#004b87] text-sm mb-2 flex items-center gap-1.5">
                    <Bitcoin className="w-4 h-4" /> Datos Bitcoin del Comprador:
                  </h4>
                  <div className="mb-3">
                    <label className="block font-semibold mb-0.5">
                      Dirección Wallet de Origen (opcional para verificación):
                    </label>
                    <input
                      type="text"
                      value={btcWallet}
                      onChange={(e) => setBtcWallet(e.target.value)}
                      placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      className="w-full p-2 bg-white border border-gray-300 rounded focus:outline-none"
                    />
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-gray-700 leading-relaxed">
                    <strong>Instrucciones de Pago Bitcoin:</strong>
                    <br />
                    • Wallet Destino:{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1 overflow-x-auto">
                      1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
                    </code>
                    <em className="text-gray-500 block mt-1">Por favor, transfiere el valor equivalente exacto a tu orden.</em>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#e65100] hover:bg-[#c63f00] text-white font-black py-3.5 px-4 rounded-lg text-base transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
            >
              {isProcessing ? 'Procesando y enviando confirmación...' : 'Confirmar y Procesar Pedido Real'}
            </button>
          </form>
        </div>

        {/* Summary Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#f8f9fa] border border-gray-300 rounded-xl p-5 shadow-xs">
            <h3 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
              Resumen del Pedido
            </h3>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {cart.map((item) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <div
                    key={item.cartItemId}
                    className="flex justify-between items-center text-xs text-gray-700 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-9 h-9 object-contain rounded border border-gray-200 bg-white shrink-0 p-0.5"
                      />
                      <span className="truncate">
                        {item.name} <strong className="text-gray-900">(x{item.quantity})</strong>
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 whitespace-nowrap">
                      {itemTotal.toFixed(2)}€
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Coupon input */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Cupones disponibles: <code className="text-green-700">bienvenido!</code> |{' '}
                <code className="text-green-700">cupon2026!</code>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Ej: bienvenido!"
                  className="p-2 flex-1 text-xs border border-gray-300 rounded bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="bg-gray-700 hover:bg-gray-800 text-white font-bold text-xs px-3 py-2 rounded transition-colors cursor-pointer"
                >
                  Aplicar
                </button>
              </div>

              {appliedCoupon && (
                <div className="text-xs font-bold text-[#2e7d32] mt-1.5 flex items-center gap-1">
                  <span>✓ Cupón {appliedCoupon} aplicado (-20%)</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-300 flex justify-between items-center font-bold">
              <span className="text-sm text-gray-700">Total a pagar:</span>
              <span className="text-xl font-black text-[#e65100]">
                {finalTotal.toFixed(2)}€
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
