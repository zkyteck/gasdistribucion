import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, ShoppingCart, Ticket, ClipboardList, Users,
  CreditCard, Package, Truck, Warehouse, BarChart3, Settings,
  LogOut, Flame, X, Palette
} from 'lucide-react'

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas',         icon: ShoppingCart,    label: 'Ventas' },
  { to: '/vales',          icon: Ticket,          label: 'Vales FISE' },
  { to: '/acuenta',        icon: ClipboardList,   label: 'A Cuenta' },
  { to: '/clientes',       icon: Users,           label: 'Clientes' },
  { to: '/deudas',         icon: CreditCard,      label: 'Deudas' },
  { to: '/inventario',     icon: Package,         label: 'Inventario',     adminOnly: true },
  { to: '/distribuidores', icon: Truck,           label: 'Distribuidores', adminOnly: true },
  { to: '/almacenes',      icon: Warehouse,       label: 'Almacenes',      adminOnly: true },
  { to: '/reportes',       icon: BarChart3,       label: 'Reportes',       adminOnly: true },
  { to: '/configuracion',  icon: Settings,        label: 'Configuración',  adminOnly: true },
  { to: '/apariencia',     icon: Palette,         label: 'Apariencia' },
]

export default function Sidebar({ onClose }) {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.rol === 'admin'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Centro Gas</p>
            <p className="text-gray-500 text-xs">Paucara</p>
          </div>
        </div>
        {/* Botón cerrar — solo en móvil */}
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => !item.adminOnly || isAdmin).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
            {perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{perfil?.nombre || 'Usuario'}</p>
            <p className="text-gray-500 text-xs capitalize">{perfil?.rol || 'trabajador'}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-500 hover:text-red-400 text-xs w-full transition-colors">
          <LogOut className="w-3.5 h-3.5" />Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
