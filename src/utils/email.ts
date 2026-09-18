import emailjs from '@emailjs/browser';
import { OrderData } from '../types';

export const EMAIL_CONFIG = {
  publicKey: "PTCNbBrXG3qTAF6_5",
  serviceId: "service_n8r7a8l",
  templateId: "template_l7xi94c"
};

export function isEmailConfigured(): boolean {
  return !Object.values(EMAIL_CONFIG).some(
    value => !value || /^(YOUR_|TU_)/i.test(value)
  );
}

export function initEmailJS() {
  if (isEmailConfigured()) {
    try {
      emailjs.init(EMAIL_CONFIG.publicKey);
    } catch (err) {
      console.warn('Error inicializando EmailJS:', err);
    }
  }
}

export interface ContactParams {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(params: ContactParams): Promise<{ success: boolean; message?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, message: 'EmailJS aún no está configurado correctamente.' };
  }

  try {
    const templateParams = {
      from_name: params.name,
      reply_to: params.email,
      phone: params.phone,
      subject: params.subject,
      message: params.message,
      to_email: 'soporte@plagasonline.es'
    };

    const res = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      templateParams,
      EMAIL_CONFIG.publicKey
    );

    return { success: res.status === 200 };
  } catch (error: any) {
    console.error('Error enviando mensaje de contacto:', error);
    return {
      success: false,
      message: error?.text || error?.message || 'Error en el envío de correo'
    };
  }
}

export interface OrderEmailParams {
  to_name: string;
  to_email: string;
  order_id: string;
  order_total: string;
  products_list: string;
  products_list_html: string;
  payment_method_html?: string;
  company_name: string;
  shipping_name: string;
  shipping_address: string;
  shipping_zip: string;
  shipping_city: string;
  payment_method: string;
}

export function resolveProductImageUrl(imageValue: string): string {
  const fallbackImage = 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=300&q=80';
  if (!imageValue) return fallbackImage;
  if (/^https?:\/\//i.test(String(imageValue))) return String(imageValue);

  const pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!/^https?:$/i.test(typeof window !== 'undefined' ? window.location.protocol : '') || pageOrigin === 'null') {
    return fallbackImage;
  }

  const cleanImage = String(imageValue).replace(/^\/+/, '');
  return `${pageOrigin.replace(/\/$/, '')}/${cleanImage}`;
}

export function escapeEmailHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character] || character));
}

export function formatOrderToEmailParams(order: OrderData): OrderEmailParams {
  let productListText = '';
  let productListHtml = '';
  order.products.forEach((item) => {
    const itemPriceNum = typeof item.price === 'number'
      ? item.price
      : parseFloat(String(item.unitPrice || '0').replace('€', '').trim()) || 0;
    const itemTotalNum = itemPriceNum * (item.quantity || 1);
    const priceStr = item.unitPrice || itemPriceNum.toFixed(2) + '€';
    const subtotalStr = item.subtotal || itemTotalNum.toFixed(2) + '€';
    const imageUrl = resolveProductImageUrl(item.img || '');

    productListText += `- ${item.name} (x${item.quantity}) - ${priceStr} c/u - Total: ${subtotalStr}\n`;
    productListHtml += `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${imageUrl}" alt="${item.name}" style="width:52px;height:52px;object-fit:contain;border-radius:6px;border:1px solid #dfe8f1;background:#f8fafc;" />
            <div>
              <div style="font-weight:bold; color:#1f2937;">${item.name}</div>
              <div style="font-size:12px; color:#667085;">${item.quantity} x ${priceStr}</div>
            </div>
          </div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:right; font-weight:bold; color:#004b87;">${priceStr}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:right; font-weight:bold; color:#e65100;">${subtotalStr}</td>
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
          <td style="padding:12px 8px;text-align:right;font-weight:bold;color:#e65100;border-top:2px solid #004b87;">${order.total}</td>
        </tr>
      </tfoot>
    </table>
  `;

  return {
    to_name: order.customerName,
    to_email: order.customerEmail,
    order_id: order.orderId,
    order_total: order.total,
    products_list: productListText,
    products_list_html: productsTableHtml,
    payment_method_html: `
      <table role="presentation" style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;margin-top:18px;">
        <tr>
          <td style="padding:16px 18px;background:#eef6ff;border:1px solid #cfe2f5;border-left:5px solid #004b87;border-radius:6px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#667085;margin-bottom:5px;">Método de pago</div>
            <div style="font-size:16px;font-weight:bold;color:#004b87;">${escapeEmailHtml(order.paymentMethod)}</div>
          </td>
        </tr>
      </table>
    `,
    company_name: 'PlagasOnline S.L.',
    shipping_name: order.customerName,
    shipping_address: order.shippingAddress,
    shipping_zip: order.shippingZip,
    shipping_city: order.shippingCity,
    payment_method: order.paymentMethod,
  };
}

export async function sendOrderConfirmationEmail(params: OrderEmailParams | OrderData): Promise<{ success: boolean; message?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, message: 'EmailJS no configurado.' };
  }

  const emailPayload = 'products' in params ? formatOrderToEmailParams(params) : params;

  try {
    const res = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      emailPayload as unknown as Record<string, unknown>,
      EMAIL_CONFIG.publicKey
    );

    return { success: res.status === 200 };
  } catch (error: any) {
    console.error('Error enviando confirmación de pedido:', error);
    return {
      success: false,
      message: error?.text || error?.message || 'Error en el envío de correo'
    };
  }
}
