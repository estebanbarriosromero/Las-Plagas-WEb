import React from 'react';
import { OrderData, ViewType } from '../types';
import { exportOrderToExcel } from '../utils/excel';
import { CheckCircle2, FileSpreadsheet, Store } from 'lucide-react';

interface SuccessViewProps {
  orderData: OrderData | null;
  onNavigate: (view: ViewType) => void;
  showToast: (msg: string) => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  orderData,
  onNavigate,
  showToast,
}) => {
  const handleDownloadExcel = () => {
    if (!orderData) {
      alert('No hay datos del pedido para exportar.');
      return;
    }
    const success = exportOrderToExcel(orderData);
    if (success) {
      showToast('Archivo Excel descargado con éxito.');
    } else {
      alert('No se pudo generar el archivo Excel.');
    }
  };

  return (
    <div className="max-w-xl mx-auto my-8 bg-white border-2 border-[#2e7d32] rounded-2xl p-8 sm:p-12 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-green-100 text-[#2e7d32] rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-[#004b87] mb-2">
        ¡Pago Confirmado y Pedido Procesado!
      </h2>

      <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
        Gracias por tu compra en <strong className="text-gray-900">PlagasOnline.es</strong>. Hemos recibido tu pago y tu pedido se encuentra en fase de preparación y embalaje prioritario.
      </p>

      <div className="bg-[#f4f6f9] p-4 rounded-xl mb-6 text-sm text-gray-800 space-y-1 border border-gray-200">
        <div>
          Número de Pedido:{' '}
          <span className="font-extrabold text-[#e65100] text-base">
            {orderData?.orderId || '#PO-89412'}
          </span>
        </div>
        {orderData?.customerEmail && (
          <div className="text-xs text-gray-600">
            Confirmación y justificante enviados a <strong>{orderData.customerEmail}</strong>
          </div>
        )}
        <div className="text-xs text-gray-500 pt-1">
          Importe Total abonado: <strong>{orderData?.total}</strong>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={handleDownloadExcel}
          className="bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-green-400" /> Descargar pedido en Excel
        </button>

        <button
          onClick={() => onNavigate('view-inicio')}
          className="bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-3 px-6 rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
        >
          <Store className="w-4 h-4" /> Volver a la Tienda
        </button>
      </div>
    </div>
  );
};
