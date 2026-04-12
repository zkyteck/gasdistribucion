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
  '/apariencia':     'Apariencia',
}

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
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
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Hamburguesa — solo móvil */}
        <button
          onClick={onMenuClick}
          className="lg:hidden"
          style={{
            color: 'var(--app-text-secondary)',
            padding: 6, borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <Menu style={{ width: 20, height: 20 }} />
        </button>
        <h1 style={{ color: 'var(--app-text)', fontWeight: 600, fontSize: 14 }}>{title}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Búsqueda */}
        <div style={{ position: 'relative' }} className="hidden sm:block">
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
              fontSize: 12,
              color: 'var(--app-input-text)',
              width: 192,
              outline: 'none',
            }}
            placeholder="Buscar..."
            onFocus={e => e.target.style.borderColor = 'var(--app-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--app-input-border)'}
          />
        </div>

        {/* Bell */}
        <button style={{ color: 'var(--app-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
          <Bell style={{ width: 16, height: 16 }} />
        </button>

        {/* Fecha */}
        <span style={{ color: 'var(--app-text-secondary)', fontSize: 12 }} className="hidden sm:block">
          {format(new Date(), "EEE, d MMM.", { locale: es })}
        </span>
      </div>
    </header>
  )
}
