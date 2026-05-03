// src/components/layout/Sidebar.jsx
import { useCallback, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LogOut, Flame, Mail, ChevronLeft, ChevronRight } from 'lucide-react'
import BotonNotificaciones from '../BotonNotificaciones'
import { useItemsVisibles } from './navConfig'

export default function Sidebar() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.rol === 'admin'
  const permisos = perfil?.permisos || {}
  const itemsVisibles = useItemsVisibles()
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/login')
  }, [signOut, navigate])

  const inicial = perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'
  const w = collapsed ? 64 : 192

  return (
    <aside style={{
      width: w,
      background: 'var(--app-sidebar-bg)',
      borderRight: '1px solid var(--app-sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>

      {/* Logo + botón colapsar */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--app-sidebar-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 8, minHeight: 64,
      }}>
        {/* Ícono llama — siempre visible */}
        <div style={{
          width: 32, height: 32, flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Flame style={{ width: 16, height: 16, color: '#fff' }} />
        </div>

        {/* Texto — solo expandido */}
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--app-logo-text)', fontWeight: 700, fontSize: 14, lineHeight: 1, margin: 0 }}>
              Centro Gas
            </p>
            <p style={{ color: 'var(--app-logo-sub)', fontSize: 11, margin: '2px 0 0' }}>
              Paucara
            </p>
          </div>
        )}

        {/* Botón colapsar — solo cuando está expandido */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Colapsar menú"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--app-text-secondary)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--app-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--app-text-secondary)'}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
        overflowY: 'auto', overflowX: 'hidden',
      }}>
        {itemsVisibles.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: '8px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              textDecoration: 'none', transition: 'all 0.15s',
              background: isActive ? 'var(--app-sidebar-active-bg)' : 'transparent',
              color: isActive ? 'var(--app-sidebar-active-text)' : 'var(--app-sidebar-text)',
              border: isActive ? '1px solid var(--app-sidebar-active-border)' : '1px solid transparent',
              whiteSpace: 'nowrap', overflow: 'hidden',
            })}
          >
            <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px',
        borderTop: '1px solid var(--app-sidebar-border)',
      }}>

        {/* Avatar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          marginBottom: collapsed ? 8 : 10,
        }}>
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 12,
          }}>
            {inicial}
          </div>
          {!collapsed && (
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
          )}
        </div>

        {/* Correo */}
        {(isAdmin || permisos?.correo) && (
          <a
            href="https://outlook.live.com"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Correo' : undefined}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 6,
              color: '#60a5fa', fontSize: 12,
              width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.15s',
              padding: collapsed ? '6px 0' : '4px 0',
              textDecoration: 'none', marginBottom: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#93c5fd'}
            onMouseLeave={e => e.currentTarget.style.color = '#60a5fa'}
          >
            <Mail style={{ width: 14, height: 14, flexShrink: 0 }} />
            {!collapsed && 'Correo'}
          </a>
        )}

        {/* Cerrar sesión */}
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Cerrar sesión' : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 6,
            color: 'var(--app-text-secondary)', fontSize: 12,
            width: '100%', background: 'none', border: 'none',
            cursor: 'pointer', transition: 'color 0.15s',
            padding: collapsed ? '6px 0' : '4px 0',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--app-text-secondary)'}
        >
          <LogOut style={{ width: 14, height: 14, flexShrink: 0 }} />
          {!collapsed && 'Cerrar sesión'}
        </button>

        {/* Notificaciones — solo expandido */}
        {!collapsed && (
          <div style={{ marginBottom: 6 }}>
            <BotonNotificaciones />
          </div>
        )}

        {/* Botón expandir — solo cuando está colapsado */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expandir menú"
            style={{
              marginTop: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--app-text-secondary)',
              padding: '6px 0', borderRadius: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--app-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--app-text-secondary)'}
          >
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>
    </aside>
  )
}
