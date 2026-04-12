import { useLocation } from 'react-router-dom'
import { Bell, Search, Menu } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../context/AuthContext'

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
  '/apariencia':     'Apariencia',
}

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const { perfil } = useAuth()
  const title = titles[pathname] || 'Sistema'

  return (
    <header style={{
      height: 56,
      background: 'var(--app-topbar-bg)',
      borderBottom: '1px solid var(--app-topbar-border)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Izquierda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Hamburguesa — SOLO desktop (lg+) cuando hay sidebar */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="hidden lg:flex"
            style={{
              color: 'var(--app-text-secondary)', padding: 6, borderRadius: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>
        )}

        {/* Móvil: logo + nombre app */}
        <div className="flex lg:hidden" style={{ alignItems: 'center', gap: 8, display: 'flex' }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>🔥</div>
          <span style={{ color: 'var(--app-text)', fontWeight: 700, fontSize: 14 }}>
            Centro Gas
          </span>
        </div>

        {/* Desktop: título de la página */}
        <h1 className="hidden lg:block" style={{
          color: 'var(--app-text)', fontWeight: 600, fontSize: 14, margin: 0,
        }}>
          {title}
        </h1>
      </div>

      {/* Derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Búsqueda — solo desktop */}
        <div style={{ position: 'relative' }} className="hidden lg:block">
          <Search style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, color: 'var(--app-text-secondary)',
          }} />
          <input
            style={{
              background: 'var(--app-input-bg)',
              border: '1px solid var(--app-input-border)',
              borderRadius: 8,
              paddingLeft: 32, paddingRight: 16, paddingTop: 6, paddingBottom: 6,
              fontSize: 12, color: 'var(--app-input-text)', width: 192, outline: 'none',
            }}
            placeholder="Buscar..."
            onFocus={e => e.target.style.borderColor = 'var(--app-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--app-input-border)'}
          />
        </div>

        {/* Título de página — solo móvil */}
        <span className="lg:hidden" style={{
          color: 'var(--app-text-secondary)', fontSize: 12, fontWeight: 500,
        }}>
          {title}
        </span>

        {/* Bell */}
        <button style={{
          color: 'var(--app-text-secondary)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 4,
        }}>
          <Bell style={{ width: 18, height: 18 }} />
        </button>

        {/* Fecha — solo desktop */}
        <span className="hidden lg:block" style={{ color: 'var(--app-text-secondary)', fontSize: 12 }}>
          {format(new Date(), "EEE, d MMM.", { locale: es })}
        </span>

        {/* Avatar — solo móvil */}
        <div className="lg:hidden" style={{
          width: 30, height: 30,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 12,
        }}>
          {perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
