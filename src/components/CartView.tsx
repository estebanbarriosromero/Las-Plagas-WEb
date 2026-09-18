import React from 'react';
import { CartItem, ViewType } from '../types';
import { Trash2, ArrowLeft, ArrowRight } from 'lucide-react';

interface CartViewProps {
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: number, quantity: number) => void;
  onRemoveItem: (cartItemId: number) => void;
  onNavigate: (view: ViewType) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onNavigate,
}) => {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center shadow-sm max-w-xl mx-auto flex flex-col items-center">
        {/* Sad Cat SVG from original app */}
        <div className="w-40 h-40 mb-4 animate-bounce duration-1000">
          <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <polygon points="45,80 20,25 75,50" fill="#78909c" />
            <polygon points="40,70 25,35 65,52" fill="#cfd8dc" />
            <polygon points="155,80 180,25 125,50" fill="#78909c" />
            <polygon points="160,70 175,35 135,52" fill="#cfd8dc" />
            <ellipse cx="100" cy="105" rx="68" ry="58" fill="#90a4ae" />
            <ellipse cx="75" cy="95" rx="9" ry="12" fill="#37474f" />
            <ellipse cx="125" cy="95" rx="9" ry="12" fill="#37474f" />
            <circle cx="72" cy="91" r="3" fill="#ffffff" />
            <circle cx="122" cy="91" r="3" fill="#ffffff" />
            <path d="M 75,108 C 73,118 68,124 75,128 C 81,124 77,118 75,108 Z" fill="#29b6f6" opacity="0.8" />
            <path d="M 125,108 C 123,118 118,124 125,128 C 131,124 127,118 125,108 Z" fill="#29b6f6" opacity="0.8" />
            <polygon points="100,108 94,115 106,115" fill="#f48fb1" />
            <path d="M 100,115 Q 92,128 85,122" stroke="#37474f" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 100,115 Q 108,128 115,122" stroke="#37474f" strokeWidth="3" fill="none" strokeLinecap="round" />
            <line x1="45" y1="108" x2="15" y2="105" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
            <line x1="45" y1="115" x2="20" y2="120" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
            <line x1="155" y1="108" x2="185" y2="105" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
            <line x1="155" y1="115" x2="180" y2="120" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-2">
          ¡Miau... Tu cesta está completamente vacía!
        </h3>
        <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
          Parece que aún no has agregado productos para combatir las plagas. ¡Explora nuestro catálogo e intenta alegrarle el día al minino!
        </p>
        <button
          onClick={() => onNavigate('view-productos')}
          className="bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-3 px-6 rounded-lg text-sm transition-all shadow cursor-pointer active:scale-95"
        >
          Ir al Catálogo de Productos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-[#004b87]">Tu Cesta de Compras</h2>

      {/* Cart Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f1f5f9] text-[#004b87] text-xs uppercase font-extrabold tracking-wider border-b border-gray-200">
                <th className="py-3 px-4 w-20">Producto</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4 w-24">Cant.</th>
                <th className="py-3 px-4 w-28">Precio</th>
                <th className="py-3 px-4 w-20 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {cart.map((item) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <tr key={item.cartItemId} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="w-16 h-16 rounded border border-gray-200 p-1 bg-white flex items-center justify-center">
                        <img
                          src={item.img}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <strong className="text-gray-900 block font-semibold">{item.name}</strong>
                      <span className="text-xs text-gray-500">Distribuidor: {item.distributor}</span>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateQuantity(item.cartItemId, parseInt(e.target.value) || 1)
                        }
                        className="w-14 py-1 px-2 border border-gray-300 rounded font-bold text-center text-sm focus:border-[#004b87] focus:outline-none"
                      />
                    </td>
                    <td className="py-3 px-4 font-bold text-[#004b87] text-base whitespace-nowrap">
                      {itemTotal.toFixed(2)}€
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onRemoveItem(item.cartItemId)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors cursor-pointer"
                        title="Eliminar este producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cart Summary and Actions */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div>
          <span className="text-xs sm:text-sm text-gray-500 uppercase font-bold tracking-wider">
            Subtotal de compra:
          </span>
          <h2 className="text-[#e65100] text-2xl sm:text-3xl font-black">
            {total.toFixed(2)}€
          </h2>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('view-productos')}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2.5 px-4 rounded text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Continuar Comprando
          </button>
          <button
            onClick={() => onNavigate('view-checkout')}
            className="bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-2.5 px-6 rounded text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-98"
          >
            Tramitar Pedido <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
