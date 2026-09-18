import React from 'react';
import { Product, ViewType } from '../types';
import { ProductCard } from './ProductCard';
import { ArrowRight, Sparkles, Shield, Award, Truck } from 'lucide-react';

interface HomeViewProps {
  products: Product[];
  discountedIds: number[];
  onNavigate: (view: ViewType) => void;
  onAddToCart: (productId: number, quantity: number) => void;
  onOpenModal: (product: Product) => void;
  isLoggedIn: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  discountedIds,
  onNavigate,
  onAddToCart,
  onOpenModal,
  isLoggedIn,
}) => {
  // First 4 products are featured
  const featured = products.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-[#003366] via-[#004b87] to-[#002244] text-white p-8 md:p-12 shadow-md">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-[#2e7d32] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" /> Tratamientos Certificados
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-white">
            Soluciones Profesionales para el Control de Plagas
          </h1>
          <p className="text-sm md:text-base text-gray-200 leading-relaxed mb-6">
            Fórmula avanzada y tecnología de captura comprobada. Usa los cupones{' '}
            <strong className="text-amber-300 font-bold bg-white/10 px-1.5 py-0.5 rounded">bienvenido!</strong> o{' '}
            <strong className="text-amber-300 font-bold bg-white/10 px-1.5 py-0.5 rounded">cupon2026!</strong> para obtener descuentos inmediatos.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('view-productos')}
              className="bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-3 px-6 rounded-lg text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-98"
            >
              Ver Catálogo Completo <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('view-contacto')}
              className="bg-white/15 hover:bg-white/25 text-white font-semibold py-3 px-5 rounded-lg text-sm transition-colors border border-white/30 cursor-pointer"
            >
              Asesoramiento Técnico
            </button>
          </div>
        </div>

        {/* Feature badges row */}
        <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-200">
          <div className="flex items-center gap-2.5">
            <Truck className="w-4 h-4 text-[#81c784]" />
            <span>Envíos rápidos a toda España (24/48h)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-[#81c784]" />
            <span>Fórmulas autorizadas por Sanidad</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#81c784]" />
            <span>Soporte por biólogos y técnicos</span>
          </div>
        </div>
      </div>

      {/* Member Promo Banner */}
      {isLoggedIn && (
        <div className="bg-[#e8f5e9] border border-[#81c784] p-4 rounded-lg text-[#1b5e20] flex items-center gap-3 shadow-xs">
          <span className="text-2xl">🎉</span>
          <div>
            <strong className="font-bold">¡Oferta Socio Activada!</strong> Tienes un 20% de descuento aplicado en productos seleccionados de tu catálogo.
          </div>
        </div>
      )}

      {/* Featured Section */}
      <div>
        <div className="flex justify-between items-center border-b-2 border-[#004b87] pb-2.5 mb-4">
          <h3 className="text-lg md:text-xl font-extrabold text-[#004b87] flex items-center gap-2">
            Productos Destacados Anti-Ratas
          </h3>
          <button
            onClick={() => onNavigate('view-productos')}
            className="text-xs md:text-sm font-bold text-[#004b87] hover:text-[#e65100] transition-colors"
          >
            Ver todos ({products.length}) →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {featured.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isDiscounted={isLoggedIn && discountedIds.includes(p.id)}
              onAddToCart={onAddToCart}
              onOpenModal={onOpenModal}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
