import React, { useState } from 'react';
import { sendContactEmail } from '../utils/email';
import { downloadCompanyOrdersExcel, COMPANY_DATA_EMAIL } from '../utils/excel';
import { User } from '../types';
import { MapPin, Phone, MessageCircle, Mail, Clock, Send, Database } from 'lucide-react';

interface ContactViewProps {
  currentUser?: User | null;
  showToast: (msg: string) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({ currentUser, showToast }) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [subject, setSubject] = useState('Consulta general');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const isCompanyUser = currentUser?.email?.toLowerCase() === COMPANY_DATA_EMAIL.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !message) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    setIsSending(true);

    try {
      const res = await sendContactEmail({
        name,
        email,
        phone,
        subject,
        message,
      });

      if (res.success) {
        showToast('Mensaje enviado correctamente. Te responderemos pronto.');
        setName(currentUser?.name || '');
        setPhone('');
        setEmail(currentUser?.email || '');
        setMessage('');
        setSubject('Consulta general');
      } else {
        alert(`No se pudo enviar el mensaje: ${res.message || 'Comprueba la configuración de EmailJS'}.`);
      }
    } catch (err: any) {
      alert(`Error al enviar: ${err?.message || 'Error inesperado'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadDatabase = () => {
    const ok = downloadCompanyOrdersExcel();
    if (ok) {
      showToast('Base de datos de pedidos descargada correctamente.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Contact Form Card */}
      <div className="lg:col-span-7 bg-gradient-to-br from-white to-[#f4f9ff] p-6 sm:p-8 rounded-2xl border border-[#dfe8f1] shadow-sm">
        <div className="inline-block px-3 py-1 bg-[#004b87]/10 text-[#004b87] rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2.5">
          Atención especializada
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-[#004b87] mb-2 leading-tight">
          Contacto y atención al cliente
        </h2>

        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          Estamos aquí para ayudarte con dudas técnicas, asesoramiento sobre productos y cualquier consulta sobre tu pedido o tratamiento contra plagas.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="bg-[#ebf8ee] text-[#2e7d32] border border-[#2e7d32]/20 rounded-full px-3 py-1 text-xs font-bold">
            ✓ Respuesta en 24h
          </span>
          <span className="bg-[#ebf8ee] text-[#2e7d32] border border-[#2e7d32]/20 rounded-full px-3 py-1 text-xs font-bold">
            ✓ Atención vía WhatsApp
          </span>
          <span className="bg-[#ebf8ee] text-[#2e7d32] border border-[#2e7d32]/20 rounded-full px-3 py-1 text-xs font-bold">
            ✓ Soporte técnico certificado
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:border-[#004b87] focus:ring-2 focus:ring-[#004b87]/10 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 123 456"
                className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:border-[#004b87] focus:ring-2 focus:ring-[#004b87]/10 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Correo electrónico *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:border-[#004b87] focus:ring-2 focus:ring-[#004b87]/10 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Tipo de consulta
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-800 focus:border-[#004b87] focus:ring-2 focus:ring-[#004b87]/10 focus:outline-none transition-all"
            >
              <option value="Consulta general">Consulta general</option>
              <option value="Pedido y envío">Pedido y envío</option>
              <option value="Asesoramiento técnico">Asesoramiento técnico</option>
              <option value="Reclamación o incidencia">Reclamación o incidencia</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Mensaje *
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cuéntanos qué necesitas y te responderemos lo antes posible..."
              className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:border-[#004b87] focus:ring-2 focus:ring-[#004b87]/10 focus:outline-none resize-y transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full bg-gradient-to-r from-[#e65100] to-[#ff7a1a] hover:from-[#d84315] hover:to-[#f57c00] text-white font-extrabold py-3.5 px-6 rounded-xl text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-wait"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Enviando mensaje...' : 'Enviar mensaje'}
          </button>
        </form>
      </div>

      {/* Contact Sidebar */}
      <div className="lg:col-span-5 bg-gradient-to-b from-[#003366] to-[#004b87] text-white p-6 sm:p-8 rounded-2xl shadow-md space-y-5">
        <h3 className="text-xl font-extrabold text-white">Información central</h3>

        <div className="space-y-3.5 text-xs sm:text-sm">
          <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="p-2 bg-[#81c784]/20 rounded-lg text-[#81c784] shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-white font-bold text-sm">Dirección</strong>
              <p className="text-gray-200">TO-1740, 45500 Mocejón, Toledo, España</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="p-2 bg-[#81c784]/20 rounded-lg text-[#81c784] shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-white font-bold text-sm">Teléfono gratuito</strong>
              <p className="text-gray-200">+34 900 123 456</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="p-2 bg-[#81c784]/20 rounded-lg text-[#81c784] shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-white font-bold text-sm">WhatsApp Soporte</strong>
              <p className="text-gray-200">+34 654 65 52 09</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="p-2 bg-[#81c784]/20 rounded-lg text-[#81c784] shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <strong className="block text-white font-bold text-sm">Email directo</strong>
              <p className="text-gray-200">soporte@plagasonline.es</p>
            </div>
          </div>

          {/* Admin Database Download Button if logged in with company account */}
          {isCompanyUser && (
            <button
              type="button"
              id="contact-company-orders-download"
              onClick={handleDownloadDatabase}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-white/30 transition-all cursor-pointer shadow-sm mt-2"
            >
              <Database className="w-4 h-4 text-green-300" /> Descargar base de datos
            </button>
          )}
        </div>

        <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-white text-sm mb-1">
            <Clock className="w-4 h-4 text-[#81c784]" /> Horario de atención
          </div>
          <p className="text-gray-200">Lunes a viernes: 08:00 - 19:00 h</p>
          <p className="text-gray-300">Sábados: 09:00 - 14:00 h (urgencias por WhatsApp)</p>
        </div>

        <div className="bg-[#81c784]/20 border border-[#81c784]/40 p-3 rounded-xl flex items-center gap-3 text-xs font-bold text-[#e9fff0]">
          <span className="w-3 h-3 rounded-full bg-[#81c784] shadow-xs shadow-green-400 shrink-0"></span>
          <span>Servicio técnico rápido en toda España peninsular e islas</span>
        </div>
      </div>
    </div>
  );
};
