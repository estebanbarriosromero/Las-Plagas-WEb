import React, { useState } from 'react';
import { User, ViewType } from '../types';
import { COMPANY_DATA_EMAIL, COMPANY_DATA_PASSWORD } from '../utils/excel';
import { LogIn, UserPlus } from 'lucide-react';

interface AuthViewsProps {
  currentView: 'view-login' | 'view-registro';
  onNavigate: (view: ViewType) => void;
  onLoginSuccess: (user: User) => void;
  showToast: (msg: string) => void;
}

const USERS_STORAGE_KEY = 'plagasOnlineUsers';

export function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredUsers(users: User[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error guardando usuarios:', e);
  }
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  currentView,
  onNavigate,
  onLoginSuccess,
  showToast,
}) => {
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const emailNorm = loginEmail.trim().toLowerCase();
    const pass = loginPass.trim();

    if (!emailNorm || !pass) {
      alert('Por favor, introduce tu correo y tu contraseña.');
      return;
    }

    const users = getStoredUsers();
    const isCompanyAccount = emailNorm === COMPANY_DATA_EMAIL.toLowerCase() && pass === COMPANY_DATA_PASSWORD;

    const matched: User | undefined = isCompanyAccount
      ? { name: 'Cuenta técnica', email: COMPANY_DATA_EMAIL }
      : users.find(
          (u) =>
            (u.email.toLowerCase() === emailNorm || u.name.toLowerCase() === emailNorm) &&
            u.password === pass
        );

    if (!matched) {
      alert('Correo o contraseña incorrectos. Comprueba tus datos o regístrate primero.');
      return;
    }

    onLoginSuccess({ name: matched.name, email: matched.email });
    showToast(`¡Bienvenido, ${matched.name}! Descuentos de socio aplicados.`);
    onNavigate('view-inicio');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const name = regName.trim();
    const emailNorm = regEmail.trim().toLowerCase();
    const pass = regPass.trim();

    if (!name || !emailNorm || !pass) {
      alert('Por favor completa nombre, correo y contraseña.');
      return;
    }

    if (emailNorm === COMPANY_DATA_EMAIL.toLowerCase()) {
      alert('Esta cuenta está reservada para la administración y no puede registrarse desde la web.');
      return;
    }

    const users = getStoredUsers();
    if (users.some((u) => u.email.toLowerCase() === emailNorm)) {
      alert('Este correo ya está registrado. Prueba con otro o inicia sesión.');
      return;
    }

    if (users.some((u) => u.password === pass)) {
      alert('Esta contraseña ya está en uso. Elige otra distinta para tu cuenta.');
      return;
    }

    const newUser: User = { name, email: emailNorm, password: pass };
    users.push(newUser);
    saveStoredUsers(users);

    onLoginSuccess({ name: newUser.name, email: newUser.email });
    showToast('¡Cuenta creada! Se han activado los descuentos de socio.');
    onNavigate('view-inicio');
  };

  if (currentView === 'view-login') {
    return (
      <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl border border-gray-200 shadow-md">
        <div className="w-12 h-12 bg-[#004b87]/10 text-[#004b87] rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-6 h-6" />
        </div>

        <h2 className="text-2xl font-black text-[#004b87] text-center mb-1">
          Iniciar Sesión
        </h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          Accede para disfrutar de un 20% de descuento socio en artículos seleccionados.
        </p>

        <form onSubmit={handleLogin} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Correo Electrónico o Usuario:
            </label>
            <input
              type="text"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Contraseña:
            </label>
            <input
              type="password"
              required
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-3 px-4 rounded-lg text-sm transition-all shadow cursor-pointer active:scale-98 mt-2"
          >
            Acceder y Obtener 20% Desc.
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-gray-100 text-xs text-gray-600">
          ¿No tienes cuenta?{' '}
          <button
            onClick={() => onNavigate('view-registro')}
            className="text-[#004b87] font-bold hover:underline cursor-pointer"
          >
            Regístrate aquí
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-xl border border-gray-200 shadow-md">
      <div className="w-12 h-12 bg-[#2e7d32]/10 text-[#2e7d32] rounded-full flex items-center justify-center mx-auto mb-4">
        <UserPlus className="w-6 h-6" />
      </div>

      <h2 className="text-2xl font-black text-[#004b87] text-center mb-1">
        Crear Cuenta
      </h2>
      <p className="text-xs text-gray-500 text-center mb-6">
        ¡Regístrate hoy y recibe 20% de descuento en artículos seleccionados!
      </p>

      <form onSubmit={handleRegister} className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Nombre Completo:
          </label>
          <input
            type="text"
            required
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            placeholder="Ej: Esteban Pérez"
            className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Correo Electrónico:
          </label>
          <input
            type="email"
            required
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            placeholder="esteban@ejemplo.com"
            className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Contraseña:
          </label>
          <input
            type="password"
            required
            value={regPass}
            onChange={(e) => setRegPass(e.target.value)}
            placeholder="••••••••"
            className="w-full p-2.5 border border-gray-300 rounded focus:border-[#004b87] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-[#e65100] hover:bg-[#c63f00] text-white font-bold py-3 px-4 rounded-lg text-sm transition-all shadow cursor-pointer active:scale-98 mt-2"
        >
          Crear Cuenta y Aplicar Descuentos
        </button>

        <button
          type="button"
          onClick={() => onNavigate('view-login')}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
        >
          Volver al Inicio de Sesión
        </button>
      </form>
    </div>
  );
};
