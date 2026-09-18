import emailjs from '@emailjs/browser';

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
  company_name: string;
  shipping_name: string;
  shipping_address: string;
  shipping_zip: string;
  shipping_city: string;
  payment_method: string;
}

export async function sendOrderConfirmationEmail(params: OrderEmailParams): Promise<{ success: boolean; message?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, message: 'EmailJS no configurado.' };
  }

  try {
    const res = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      params as unknown as Record<string, unknown>,
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
