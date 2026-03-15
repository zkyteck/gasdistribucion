import { useLocation } from 'react-router-dom'
import { Bell, Search, Menu } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const titles = {
  '/dashboard':      'Dashboard',
  '/ventas':         'Ventas',
  '/vales':          'Vales FISE',
  '/acuenta':        'A Cuenta',
  '/clientes':       'Clientes y Deudas',
  '/deudas':         'Deudas',
  '/inventario':     'Inventario',
  '/distribuidores': 'Distribuidores',
  '/almacenes':      'Almacenes',
  '/reportes':       'Reportes',
  '/configuracion':  'Configuración',
}

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const title = titles[pathname] || 'Sistema'

  return (
    <header className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Botón hamburguesa — solo en móvil */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-white font-semibold text-sm">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-48"
            placeholder="Buscar..." />
        </div>
        <button className="relative text-gray-500 hover:text-gray-300 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <span className="text-gray-600 text-xs hidden sm:block">
          {format(new Date(), "EEE, d MMM.", { locale: es })}
        </span>
      </div>
    </header>
  )
}
