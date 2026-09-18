import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethodType, OrderData, User } from '../types';
import { sendOrderConfirmationEmail, resolveProductImageUrl, escapeEmailHtml } from '../utils/email';
import { exportOrderToExcel, recordCompanyOrder } from '../utils/excel';
import { appendOrderToGoogleSheet } from '../utils/sheets';
import { ShieldCheck, CreditCard, Building2, Smartphone, Bitcoin, Tag } from 'lucide-react';

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

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleCardExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length > 2) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    setCardExp(raw);
  };

  const handleCardCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardCvc(raw);
  };

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

  const validateCardPaymentData = (): string => {
    const holder = cardHolder.trim();
    const cleanNumber = cardNumber.replace(/\s+/g, '');
    const cleanExp = cardExp.trim();
    const cleanCvc = cardCvc.trim();

    if (!holder) return 'Debes indicar el nombre del titular de la tarjeta.';
    if (!/^\d{13,19}$/.test(cleanNumber)) return 'El número de tarjeta no es válido.';
    if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(cleanExp)) return 'La fecha de caducidad debe tener formato MM/AA.';
    if (!/^\d{3,4}$/.test(cleanCvc)) return 'El CVC/CVV no es válido.';

    return '';
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
      const errorMsg = validateCardPaymentData();
      if (errorMsg) {
        alert(errorMsg);
        return;
      }
      const cleanNumber = cardNumber.replace(/\s+/g, '');
      extraPaymentDetails = `Tarjeta Titular: ${cardHolder.trim()} (Nº terminación: ${cleanNumber.slice(-4)})`;
    } else if (paymentMethod === 'transfer') {
      if (!transferIban.trim()) {
        alert('Por favor introduce tu IBAN o cuenta de origen.');
        return;
      }
      extraPaymentDetails = `Cuenta origen terminada en: ${transferIban.trim().slice(-4)}`;
    } else if (paymentMethod === 'bizum') {
      if (!bizumPhone.trim()) {
        alert('Por favor introduce el teléfono móvil del Bizum.');
        return;
      }
      extraPaymentDetails = `Teléfono Bizum pagador: ${bizumPhone.trim()}`;
    } else if (paymentMethod === 'btc') {
      extraPaymentDetails = `Wallet Origen: ${btcWallet.trim() || 'No especificada'}`;
    }

    const orderId = '#PO-' + Math.floor(100000 + Math.random() * 900000);
    const orderTotalStr = finalTotal.toFixed(2) + '€';

    let productListText = '';
    let productListHtml = '';
    cart.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      const imageUrl = resolveProductImageUrl(item.img);

      productListText += `- ${item.name} (x${item.quantity}) - ${item.price.toFixed(2)}€ c/u - Total: ${itemTotal.toFixed(2)}€\n`;
      productListHtml += `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${imageUrl}" alt="${item.name}" style="width:52px;height:52px;object-fit:contain;border-radius:6px;border:1px solid #dfe8f1;background:#f8fafc;" />
              <div>
                <div style="font-weight:bold; color:#1f2937;">${item.name}</div>
                <div style="font-size:12px; color:#667085;">${item.quantity} x ${item.price.toFixed(2)}€</div>
              </div>
            </div>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:right; font-weight:bold; color:#004b87;">${item.price.toFixed(2)}€</td>
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
            <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#e65100;border-top:2px solid #004b87;">${orderTotalStr}</td>
          </tr>
        </tfoot>
      </table>
    `;

    const paymentMethodHtml = `
      <table role="presentation" style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;margin-top:18px;">
        <tr>
          <td style="padding:16px 18px;background:#eef6ff;border:1px solid #cfe2f5;border-left:5px solid #004b87;border-radius:6px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#667085;margin-bottom:5px;">Método de pago</div>
            <div style="font-size:16px;font-weight:bold;color:#004b87;">${escapeEmailHtml(paymentMethod.toUpperCase())}</div>
            <div style="font-size:13px;color:#475467;margin-top:6px;">${escapeEmailHtml(extraPaymentDetails)}</div>
          </td>
        </tr>
      </table>
    `;

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
      date: new Date().toLocaleString('es-ES'),
    };

    setIsProcessing(true);

    try {
      // 1. Send confirmation email through EmailJS
      const emailResult = await sendOrderConfirmationEmail({
        to_name: name,
        to_email: email,
        order_id: orderId,
        order_total: orderTotalStr,
        products_list: productListText,
        products_list_html: productsTableHtml,
        payment_method_html: paymentMethodHtml,
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
    }

    // 2. Synchronize order to Google Sheets
    try {
      const sheetsSuccess = await appendOrderToGoogleSheet(orderData);
      if (sheetsSuccess) {
        console.log('Pedido sincronizado con Google Sheets.');
      } else {
        console.warn('El pedido no pudo registrarse en Google Sheets (se guardará en la base local de la empresa).');
      }
    } catch (sheetsErr) {
      console.warn('Error sincronizando con Google Sheets:', sheetsErr);
    }

    // 3. Save to Company Orders database (localStorage for "Pedidos Empresa.xlsx")
    recordCompanyOrder(orderData);

    // 4. Also generate individual Excel download as backup
    exportOrderToExcel(orderData);

    setIsProcessing(false);
    onOrderSuccess(orderData);
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

            <h3 className="text-base font-bold text-[#004b87] pt-4 border-t border-gray-200">
              Selecciona Método de Pago
            </h3>

            <div>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full p-2.5 border border-gray-300 rounded font-medium focus:border-[#004b87] focus:outline-none"
              >
                <option value="card">💳 Tarjeta de Crédito / Débito</option>
                <option value="transfer">🏦 Transferencia Bancaria</option>
                <option value="bizum">📱 Bizum</option>
                <option value="btc">₿ Bitcoin (BTC)</option>
              </select>
            </div>

            {/* Dynamic payment details box */}
            <div className="bg-[#f0f4f8] p-4 rounded-lg border border-gray-200 text-xs sm:text-sm">
              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-[#0d2a4b] to-[#1d4d7a] text-white rounded-xl p-4 shadow-md">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] tracking-wider uppercase opacity-90">Pasarela segura</span>
                      <CreditCard className="w-5 h-5 text-gray-300" />
                    </div>
                    <div className="text-base sm:text-lg tracking-widest font-mono font-bold">
                      {cardNumber || '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between mt-3 text-[10px] opacity-90">
                      <span>TITULAR: {cardHolder.toUpperCase() || 'NOMBRE'}</span>
                      <span>EXP: {cardExp || 'MM/AA'}</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-[#004b87]">Datos de la tarjeta</h4>

                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Nombre del titular *
                    </label>
                    <input
                      type="text"
                      required
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="Nombre como aparece en la tarjeta"
                      className="w-full p-2 bg-white border border-gray-300 rounded focus:border-[#004b87] focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Número de tarjeta *
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      inputMode="numeric"
                      className="w-full p-2 bg-white border border-gray-300 rounded font-mono focus:border-[#004b87] focus:outline-none text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 text-xs mb-1">
                        Caducidad *
                      </label>
                      <input
                        type="text"
                        required
                        value={cardExp}
                        onChange={handleCardExpChange}
                        placeholder="MM/AA"
                        maxLength={5}
                        inputMode="numeric"
                        className="w-full p-2 bg-white border border-gray-300 rounded font-mono focus:border-[#004b87] focus:outline-none text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 text-xs mb-1">
                        CVC / CVV *
                      </label>
                      <input
                        type="password"
                        required
                        value={cardCvc}
                        onChange={handleCardCvcChange}
                        placeholder="123"
                        maxLength={4}
                        inputMode="numeric"
                        className="w-full p-2 bg-white border border-gray-300 rounded font-mono focus:border-[#004b87] focus:outline-none text-xs text-center"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                    🔒 Pago protegido con cifrado SSL. <strong>Este entorno es de prueba</strong> y no realiza ningún cobro real.
                  </p>
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-[#004b87]">Datos bancarios del pagador:</h4>
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
                      className="w-full p-2 bg-white border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div className="pt-2 border-t border-gray-300 space-y-1 text-xs text-gray-700">
                    <strong className="text-gray-900">Instrucciones de Transferencia:</strong>
                    <div>• Banco Destino: Santander</div>
                    <div>• IBAN Destino: ES91 0049 1234 5678 9012 3456</div>
                    <div>• Beneficiario: PlagasOnline S.L.</div>
                    <em className="text-gray-500 text-[11px] block mt-1">
                      Debes incluir tu nombre y el código de tu pedido en el concepto.
                    </em>
                  </div>
                </div>
              )}

              {paymentMethod === 'bizum' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-[#004b87]">Datos Bizum del Comprador:</h4>
                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Teléfono móvil desde el que harás el Bizum *
                    </label>
                    <input
                      type="tel"
                      required
                      value={bizumPhone}
                      onChange={(e) => setBizumPhone(e.target.value)}
                      placeholder="Ej: 600 000 000"
                      className="w-full p-2 bg-white border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="pt-2 border-t border-gray-300 space-y-1 text-xs text-gray-700">
                    <strong className="text-gray-900">Instrucciones Bizum:</strong>
                    <div>• Teléfono de Pago Destino: +34 654 65 52 09</div>
                    <div>• Concepto: Pedido PlagasOnline</div>
                    <em className="text-gray-500 text-[11px] block mt-1">
                      Comprobaremos la entrada del dinero asociada a tu número de teléfono.
                    </em>
                  </div>
                </div>
              )}

              {paymentMethod === 'btc' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-[#004b87]">Datos Bitcoin del Comprador:</h4>
                  <div>
                    <label className="block font-bold text-gray-700 text-xs mb-1">
                      Dirección Wallet de Origen (opcional para verificación):
                    </label>
                    <input
                      type="text"
                      value={btcWallet}
                      onChange={(e) => setBtcWallet(e.target.value)}
                      placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      className="w-full p-2 bg-white border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div className="pt-2 border-t border-gray-300 space-y-1 text-xs text-gray-700">
                    <strong className="text-gray-900">Instrucciones de Pago Bitcoin:</strong>
                    <div className="break-all font-mono text-[11px] bg-white p-2 rounded border border-gray-200 mt-1">
                      1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
                    </div>
                    <em className="text-gray-500 text-[11px] block mt-1">
                      Por favor, transfiere el valor equivalente exacto a tu orden.
                    </em>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#e65100] hover:bg-[#c63f00] text-white font-extrabold py-3.5 px-6 rounded-lg text-base transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
            >
              {isProcessing ? 'Procesando y enviando correo...' : 'Confirmar y Procesar Pedido'}
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
