import React, { useState } from 'react';
import { ViewType, User } from '../types';
import { Search, ShoppingCart, User as UserIcon, LogOut } from 'lucide-react';

interface NavbarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  cartCount: number;
  isCartBouncing: boolean;
  currentUser: User | null;
  onLogout: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  cartCount,
  isCartBouncing,
  currentUser,
  onLogout,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="sticky top-0 z-40">
      {/* Top Header */}
      <header className="bg-[#004b87] text-white px-4 md:px-6 py-3.5 flex flex-wrap justify-between items-center border-b-4 border-[#2e7d32] gap-3 rounded-t-lg shadow-md">
        <div
          onClick={() => onNavigate('view-inicio')}
          className="font-black text-2xl tracking-tight text-white cursor-pointer select-none hover:opacity-95 transition-opacity"
        >
          Plagas<span className="text-[#81c784]">Online</span><span className="text-sm font-semibold opacity-80">.es</span>
        </div>

        {/* Search Box */}
        <div className="flex-1 max-w-md min-w-[220px] relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (currentView !== 'view-productos') {
                onNavigate('view-productos');
              }
            }}
            placeholder="🔍 Buscar por marca o producto..."
            className="w-full py-1.5 pl-3 pr-8 bg-white text-gray-800 rounded-full text-sm outline-none border-2 border-transparent focus:border-[#81c784] shadow-inner transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* User Greeting & Auth */}
        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          <div className="bg-white/20 text-white px-3 py-1 rounded-full font-medium text-xs sm:text-sm flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5" />
            <span>{currentUser ? `Hola, ${currentUser.name}` : 'Hola, Invitado'}</span>
          </div>

          {currentUser ? (
            <button
              onClick={onLogout}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-semibold py-1.5 px-3 rounded transition-colors flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" /> Cerrar Sesión
            </button>
          ) : (
            <button
              onClick={() => onNavigate('view-login')}
              className="bg-[#2e7d32] hover:bg-[#256629] text-white text-xs font-bold py-1.5 px-3 rounded transition-colors cursor-pointer"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </header>

      {/* Navigation Sub-Bar */}
      <nav className="bg-[#003366] text-white px-4 md:px-6 py-0 flex justify-between items-center shadow-md flex-wrap">
        <div className="flex">
          <button
            onClick={() => onNavigate('view-inicio')}
            className={`py-3 px-4 font-bold text-sm transition-colors cursor-pointer border-b-2 ${
              currentView === 'view-inicio'
                ? 'bg-[#2e7d32] border-white'
                : 'border-transparent hover:bg-white/10'
            }`}
          >
            Inicio
          </button>
          <button
            onClick={() => onNavigate('view-productos')}
            className={`py-3 px-4 font-bold text-sm transition-colors cursor-pointer border-b-2 ${
              currentView === 'view-productos'
                ? 'bg-[#2e7d32] border-white'
                : 'border-transparent hover:bg-white/10'
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => onNavigate('view-contacto')}
            className={`py-3 px-4 font-bold text-sm transition-colors cursor-pointer border-b-2 ${
              currentView === 'view-contacto'
                ? 'bg-[#2e7d32] border-white'
                : 'border-transparent hover:bg-white/10'
            }`}
          >
            Contacto
          </button>
          <button
            onClick={() => onNavigate(currentUser ? 'view-inicio' : 'view-login')}
            className={`py-3 px-4 font-bold text-sm transition-colors cursor-pointer border-b-2 ${
              currentView === 'view-login' || currentView === 'view-registro'
                ? 'bg-[#2e7d32] border-white'
                : 'border-transparent hover:bg-white/10'
            }`}
          >
            Mi Cuenta
          </button>
        </div>

        {/* Cart Status Badge */}
        <div
          onClick={() => onNavigate('view-carrito')}
          className={`bg-[#e65100] hover:bg-[#c63f00] text-white my-1.5 py-1.5 px-4 rounded text-sm font-bold flex items-center gap-2 cursor-pointer transition-transform shadow select-none ${
            isCartBouncing ? 'scale-110' : 'scale-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Carrito (<span className="font-extrabold">{cartCount}</span>)</span>
        </div>
      </nav>
    </div>
  );
};
