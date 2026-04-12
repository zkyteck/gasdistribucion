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
    <aside style={{
      width: 192,
      background: 'var(--app-sidebar-bg)',
      borderRight: '1px solid var(--app-sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--app-sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Flame style={{ width: 16, height: 16, color: '#fff' }} />
          </div>
          <div>
            <p style={{ color: 'var(--app-logo-text)', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>
              Centro Gas
            </p>
            <p style={{ color: 'var(--app-logo-sub)', fontSize: 11, marginTop: 2 }}>
              Paucara
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden"
            style={{ color: 'var(--app-sidebar-text)', padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {navItems.filter(item => !item.adminOnly || isAdmin).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.15s',
              background: isActive ? 'var(--app-sidebar-active-bg)' : 'transparent',
              color: isActive ? 'var(--app-sidebar-active-text)' : 'var(--app-sidebar-text)',
              border: isActive ? '1px solid var(--app-sidebar-active-border)' : '1px solid transparent',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'var(--app-sidebar-hover-bg)'
                e.currentTarget.style.color = 'var(--app-sidebar-hover-text)'
              }
            }}
            onMouseLeave={e => {
              // Reaplica estilo base si no está activo
              // NavLink maneja el activo, solo limpiamos hover
              const isActive = window.location.pathname === to
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--app-sidebar-text)'
              }
            }}
          >
            <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--app-sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 12,
          }}>
            {perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: 'var(--app-text)', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {perfil?.nombre || 'Usuario'}
            </p>
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 11, textTransform: 'capitalize' }}>
              {perfil?.rol || 'trabajador'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--app-text-secondary)',
            fontSize: 12, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 0.15s',
            padding: '4px 0',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--app-text-secondary)'}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
