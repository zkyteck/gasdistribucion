import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, ShoppingCart, Ticket, ClipboardList, Users,
  CreditCard, Package, Truck, Warehouse, BarChart3, Settings,
  LogOut, Flame, Palette, Mail
} from 'lucide-react'

const ALL_ITEMS = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      permiso: null },
  { to: '/ventas',         icon: ShoppingCart,    label: 'Ventas',         permiso: 'ventas' },
  { to: '/vales',          icon: Ticket,          label: 'Vales FISE',     permiso: 'vales' },
  { to: '/acuenta',        icon: ClipboardList,   label: 'A Cuenta',       permiso: 'acuenta' },
  { to: '/clientes',       icon: Users,           label: 'Clientes',       permiso: 'clientes' },
  { to: '/deudas',         icon: CreditCard,      label: 'Deudas',         permiso: 'deudas' },
  { to: '/inventario',     icon: Package,         label: 'Inventario',     permiso: 'inventario',     adminOnly: true },
  { to: '/distribuidores', icon: Truck,           label: 'Distribuidores', permiso: 'distribuidores', adminOnly: true },
  { to: '/almacenes',      icon: Warehouse,       label: 'Almacenes',      permiso: 'almacenes',      adminOnly: true },
  { to: '/reportes',       icon: BarChart3,       label: 'Reportes',       permiso: 'reportes',       adminOnly: true },
  { to: '/configuracion',  icon: Settings,        label: 'Configuración',  permiso: 'configuracion',  adminOnly: true },
  { to: '/apariencia',     icon: Palette,         label: 'Apariencia',     permiso: null },
]

export default function Sidebar() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.rol === 'admin'
  const permisos = perfil?.permisos || {}

  // Filtrar según rol y permisos
  const itemsVisibles = ALL_ITEMS.filter(item => {
    if (isAdmin) return true
    if (item.adminOnly) return false
    if (item.permiso === null) return true
    return permisos[item.permiso] === true
  })

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
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--app-sidebar-border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Flame style={{ width: 16, height: 16, color: '#fff' }} />
        </div>
        <div>
          <p style={{ color: 'var(--app-logo-text)', fontWeight: 700, fontSize: 14, lineHeight: 1, margin: 0 }}>
            Centro Gas
          </p>
          <p style={{ color: 'var(--app-logo-sub)', fontSize: 11, margin: '2px 0 0' }}>
            Paucara
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {itemsVisibles.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              textDecoration: 'none', transition: 'all 0.15s',
              background: isActive ? 'var(--app-sidebar-active-bg)' : 'transparent',
              color: isActive ? 'var(--app-sidebar-active-text)' : 'var(--app-sidebar-text)',
              border: isActive ? '1px solid var(--app-sidebar-active-border)' : '1px solid transparent',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.style.background.includes('var(--app-sidebar-active')) {
                e.currentTarget.style.background = 'var(--app-sidebar-hover-bg)'
                e.currentTarget.style.color = 'var(--app-sidebar-hover-text)'
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.style.background.includes('var(--app-sidebar-active')) {
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

      {/* Usuario */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--app-sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
          }}>
            {perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              color: 'var(--app-text)', fontSize: 12, fontWeight: 500, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {perfil?.nombre || 'Usuario'}
            </p>
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>
              {perfil?.rol || 'trabajador'}
              {perfil?.almacenes?.nombre && (
                <span style={{ opacity: 0.7 }}> · {perfil.almacenes.nombre}</span>
              )}
            </p>
          </div>
        </div>
        <a
          href="https://outlook.live.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#60a5fa', fontSize: 12,
            width: '100%', background: 'none', border: 'none',
            cursor: 'pointer', transition: 'color 0.15s', padding: '4px 0',
            textDecoration: 'none', marginBottom: 6,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#93c5fd'}
          onMouseLeave={e => e.currentTarget.style.color = '#60a5fa'}
        >
          <Mail style={{ width: 14, height: 14 }} />
          Correo
        </a>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--app-text-secondary)', fontSize: 12,
            width: '100%', background: 'none', border: 'none',
            cursor: 'pointer', transition: 'color 0.15s', padding: '4px 0',
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
