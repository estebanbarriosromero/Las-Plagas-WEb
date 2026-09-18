import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  isDiscounted: boolean;
  onAddToCart: (productId: number, quantity: number) => void;
  onOpenModal: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isDiscounted,
  onAddToCart,
  onOpenModal,
}) => {
  const [qty, setQty] = React.useState(1);

  const finalPrice = isDiscounted ? product.price * 0.8 : product.price;

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    let stars = '★'.repeat(full);
    if (rating % 1 !== 0) stars += '½';
    return stars;
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product.id, qty);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-[#004b87] relative group">
      {/* Badges */}
      <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 z-10">
        {isDiscounted && (
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#d32f2f] shadow-sm uppercase tracking-wide">
            -20% SOCIO
          </span>
        )}
        {product.badge === 'bestseller' && (
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#f57c00] shadow-sm uppercase tracking-wide">
            {product.badgeText || 'MÁS VENDIDO'}
          </span>
        )}
        {product.badge === 'cheapest' && (
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#2e7d32] shadow-sm uppercase tracking-wide">
            {product.badgeText || 'MÁS BARATO'}
          </span>
        )}
        {product.badge === 'recommended' && (
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#1976d2] shadow-sm uppercase tracking-wide">
            {product.badgeText || 'RECOMENDADO'}
          </span>
        )}
      </div>

      <div>
        <div className="text-[12px] text-gray-500 uppercase font-bold tracking-wider mb-1">
          {product.distributor}
        </div>

        <div
          className="overflow-hidden rounded-md mb-2.5 pb-2 border-b border-gray-100 cursor-pointer flex items-center justify-center bg-gray-50/50 h-[150px]"
          onClick={() => onOpenModal(product)}
        >
          <img
            src={product.img}
            alt={product.name}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <h4
          className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-[40px] cursor-pointer hover:text-[#004b87]"
          onClick={() => onOpenModal(product)}
        >
          {product.name}
        </h4>

        <div className="text-amber-500 text-xs font-semibold my-1.5 flex items-center gap-1">
          <span>{renderStars(product.rating)}</span>
          <span className="text-gray-500 font-normal">({product.rating})</span>
        </div>

        <div className="text-xs text-[#2e7d32] font-semibold min-h-[30px] line-clamp-2 leading-tight">
          {product.tagline}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="mb-2">
          {isDiscounted ? (
            <div className="flex items-baseline gap-2">
              <span className="line-through text-gray-400 text-xs">
                {product.price.toFixed(2)}€
              </span>
              <span className="text-xl font-black text-[#d32f2f]">
                {finalPrice.toFixed(2)}€
              </span>
            </div>
          ) : (
            <span className="text-xl font-extrabold text-[#004b87]">
              {product.price.toFixed(2)}€
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={qty}
            min={1}
            max={99}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 py-1.5 px-1 text-center font-bold border border-gray-300 rounded focus:border-[#004b87] focus:outline-none text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 bg-[#e65100] hover:bg-[#c63f00] active:scale-[0.98] text-white font-bold py-2 px-3 rounded text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            Añadir al Carrito
          </button>
        </div>
      </div>
    </div>
  );
};
