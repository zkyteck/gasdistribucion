// src/components/layout/Layout.jsx
import { useState, useCallback, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { LogOut, MoreHorizontal, X, Mail } from 'lucide-react'
import BotonNotificaciones from '../BotonNotificaciones'
import { inicializarNotificaciones } from '../../lib/notificaciones'
import { useItemsVisibles, BOTTOM_FIXED } from './navConfig'

// ── Drawer "Más" ──────────────────────────────────────────────────────────────
function BottomDrawer({ open, onClose, extraItems }) {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = useCallback(async () => {
    onClose()
    await signOut()
    navigate('/login')
  }, [onClose, signOut, navigate])

  const inicial = perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'
  const tieneCorreo = perfil?.rol === 'admin' || perfil?.permisos?.correo

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: 'var(--app-modal-bg)',
        borderTop: '1px solid var(--app-modal-border)',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--app-card-border)' }} />
        </div>

        {/* Header usuario */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 16px',
          borderBottom: '1px solid var(--app-card-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              {inicial}
            </div>
            <div>
              <p style={{ color: 'var(--app-text)', fontSize: 14, fontWeight: 600, margin: 0 }}>
                {perfil?.nombre || 'Usuario'}
              </p>
              <p style={{ color: 'var(--app-text-secondary)', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>
                {perfil?.rol || 'trabajador'}
                {perfil?.almacenes?.nombre ? ` · ${perfil.almacenes.nombre}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--app-card-border)', border: 'none', cursor: 'pointer',
              borderRadius: '50%', width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--app-text-secondary)',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Items extras */}
        {extraItems.length > 0 ? (
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {extraItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 12,
                  textDecoration: 'none', fontWeight: 500, fontSize: 13,
                  background: isActive ? 'var(--app-sidebar-active-bg)' : 'var(--app-card-bg-alt)',
                  color: isActive ? 'var(--app-sidebar-active-text)' : 'var(--app-text-secondary)',
                  border: `1px solid ${isActive ? 'var(--app-sidebar-active-border)' : 'var(--app-card-border)'}`,
                  transition: 'all 0.15s',
                })}
              >
                <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                {label}
              </NavLink>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>
              No tienes acceso a módulos adicionales
            </p>
          </div>
        )}

        {/* Correo */}
        {tieneCorreo && (
          <div style={{ padding: '4px 16px 8px' }}>
            <a
              href="https://outlook.live.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.3)',
                background: 'rgba(59,130,246,0.08)', color: '#60a5fa',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <Mail style={{ width: 16, height: 16 }} />
              Abrir correo
            </a>
          </div>
        )}

        {/* Notificaciones */}
        <div style={{ padding: '4px 16px 8px' }}>
          <BotonNotificaciones />
        </div>

        {/* Cerrar sesión */}
        <div style={{ padding: '4px 16px 20px' }}>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)', color: '#f87171',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            <LogOut style={{ width: 16, height: 16 }} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )
}

// ── Barra de navegación inferior ─────────────────────────────────────────────
function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const itemsVisibles = useItemsVisibles()

  const fixedItems = itemsVisibles.filter(i => BOTTOM_FIXED.includes(i.to))
  const extraItems = itemsVisibles.filter(i => !BOTTOM_FIXED.includes(i.to))

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--app-modal-bg)',
        borderTop: '1px solid var(--app-modal-border)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(12px)',
      }}>
        {fixedItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '10px 4px 8px',
              textDecoration: 'none', fontSize: 10, fontWeight: 500,
              color: isActive ? 'var(--app-accent)' : 'var(--app-text-secondary)',
              transition: 'color 0.15s', position: 'relative',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28, height: 3, borderRadius: '0 0 3px 3px',
                    background: 'var(--app-accent)',
                  }} />
                )}
                <div style={{
                  width: 36, height: 32, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive
                    ? 'color-mix(in srgb, var(--app-accent) 12%, transparent)'
                    : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <Icon style={{ width: 20, height: 20 }} />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Botón Más */}
        <button
          onClick={openDrawer}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '10px 4px 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 500,
            color: 'var(--app-text-secondary)',
          }}
        >
          <div style={{
            width: 36, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MoreHorizontal style={{ width: 20, height: 20 }} />
          </div>
          <span>Más</span>
        </button>
      </nav>

      <BottomDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        extraItems={extraItems}
      />
    </>
  )
}

// ── Layout principal ──────────────────────────────────────────────────────────
export default function Layout() {
  const { perfil } = useAuth()

  // Auto-inicializar notificaciones si ya tiene permiso
  useEffect(() => {
    if (perfil?.id && 'Notification' in window && Notification.permission === 'granted') {
      inicializarNotificaciones(perfil.id)
    }
  }, [perfil?.id])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', display: 'flex' }}>

      {/* Sidebar — solo desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <main
          style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            background: 'var(--app-main-bg)',
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
          }}
          className="lg:pb-6 lg:p-6"
        >
          <Outlet />
        </main>
      </div>

      {/* Bottom Nav — solo móvil */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
