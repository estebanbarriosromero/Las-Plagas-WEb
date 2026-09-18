import React, { useState } from 'react';
import { Product } from '../types';
import { X, Star, ShieldCheck, Truck } from 'lucide-react';

interface ProductModalProps {
  product: Product | null;
  isDiscounted: boolean;
  onClose: () => void;
  onAddToCart: (productId: number, quantity: number) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isDiscounted,
  onClose,
  onAddToCart,
}) => {
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const finalPrice = isDiscounted ? product.price * 0.8 : product.price;

  const handleAdd = () => {
    onAddToCart(product.id, qty);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-full h-52 bg-gray-50 rounded-lg p-3 flex items-center justify-center mb-4 border border-gray-100">
            <img
              src={product.img}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="text-xs uppercase font-bold tracking-wider text-gray-500 mb-1">
            Distribuidor: {product.distributor}
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug">
            {product.name}
          </h3>

          <div className="flex items-center gap-1.5 text-amber-500 text-sm font-semibold mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.floor(product.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-gray-700 font-bold">({product.rating}/5)</span>
          </div>

          <p className="text-sm text-[#2e7d32] font-medium mb-4 px-3 py-1.5 bg-green-50 rounded-md">
            {product.tagline}
          </p>

          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-5">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-blue-600" /> Grado Profesional
            </span>
            <span className="flex items-center gap-1">
              <Truck className="w-4 h-4 text-green-600" /> Envío 24/48h
            </span>
          </div>

          <div className="mb-5">
            {isDiscounted ? (
              <div className="flex items-center justify-center gap-2">
                <span className="line-through text-gray-400 text-base">
                  {product.price.toFixed(2)}€
                </span>
                <span className="text-2xl font-black text-[#d32f2f]">
                  {finalPrice.toFixed(2)}€
                </span>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                  -20% SOCIO
                </span>
              </div>
            ) : (
              <span className="text-3xl font-extrabold text-[#004b87]">
                {product.price.toFixed(2)}€
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <input
              type="number"
              value={qty}
              min={1}
              max={99}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 py-2 text-center font-bold border border-gray-300 rounded-lg text-base focus:border-[#004b87] focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="flex-1 bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-3 px-4 rounded-lg text-sm transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Añadir al Carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
