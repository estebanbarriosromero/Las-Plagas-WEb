import React, { useState, useMemo } from 'react';
import { Product, ProductCategory, SortOption } from '../types';
import { ProductCard } from './ProductCard';
import { SlidersHorizontal, SearchX } from 'lucide-react';

interface CatalogViewProps {
  products: Product[];
  discountedIds: number[];
  searchTerm: string;
  onClearSearch: () => void;
  onAddToCart: (productId: number, quantity: number) => void;
  onOpenModal: (product: Product) => void;
  isLoggedIn: boolean;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  discountedIds,
  searchTerm,
  onClearSearch,
  onAddToCart,
  onOpenModal,
  isLoggedIn,
}) => {
  const [category, setCategory] = useState<ProductCategory>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    let list = products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.distributor.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q);

      const matchesCat = category === 'all' || p.category === category;

      return matchesQuery && matchesCat;
    });

    const getPrice = (p: Product) => {
      return isLoggedIn && discountedIds.includes(p.id) ? p.price * 0.8 : p.price;
    };

    if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => getPrice(a) - getPrice(b));
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => getPrice(b) - getPrice(a));
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [products, searchTerm, category, sortBy, isLoggedIn, discountedIds]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <h2 className="text-xl md:text-2xl font-black text-[#004b87]">
          {searchTerm ? `Resultados de búsqueda para: "${searchTerm}"` : 'Catálogo General de Productos'}
        </h2>
        <span className="text-xs font-semibold text-gray-500">
          Mostrando {filteredProducts.length} de {products.length} productos
        </span>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="flex flex-wrap gap-4 bg-[#eef2f5] p-3.5 rounded-lg items-center text-sm border border-gray-200">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-600" />
          <label className="font-bold text-gray-700">Categoría:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            className="py-1.5 px-3 rounded bg-white border border-gray-300 font-semibold text-gray-800 text-xs sm:text-sm focus:outline-none focus:border-[#004b87]"
          >
            <option value="all">Todas las categorías</option>
            <option value="raticidas">Raticidas y Trampas</option>
            <option value="insecticidas">Insecticidas</option>
            <option value="equipos">Equipos y Luz UV</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-bold text-gray-700">Ordenar por:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="py-1.5 px-3 rounded bg-white border border-gray-300 font-semibold text-gray-800 text-xs sm:text-sm focus:outline-none focus:border-[#004b87]"
          >
            <option value="default">Relevancia</option>
            <option value="price-asc">Precio: Menor a Mayor</option>
            <option value="price-desc">Precio: Mayor a Menor</option>
            <option value="rating">Mejor Valorados</option>
          </select>
        </div>

        {searchTerm && (
          <button
            onClick={onClearSearch}
            className="ml-auto text-xs font-bold text-[#e65100] hover:underline"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isDiscounted={isLoggedIn && discountedIds.includes(product.id)}
              onAddToCart={onAddToCart}
              onOpenModal={onOpenModal}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
          <SearchX className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">
            No se encontraron artículos que coincidan con tu búsqueda
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Prueba a buscar con otros términos o cambia el filtro de categoría.
          </p>
          <button
            onClick={() => {
              onClearSearch();
              setCategory('all');
            }}
            className="mt-2 bg-[#004b87] text-white font-bold text-xs py-2 px-4 rounded hover:bg-[#003366] transition-colors"
          >
            Restablecer filtros
          </button>
        </div>
      )}
    </div>
  );
};
