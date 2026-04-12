import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const TEMAS = [
  {
    id: 'neon',
    nombre: 'Neón (actual)',
    descripcion: 'Tema oscuro con acentos neón',
    badge: 'Actual',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
    preview: {
      bg: '#0f172a', sidebar: '#1e293b', accent: '#3b82f6',
      text: '#94a3b8', stat: '#1e293b', bar: '#3b82f6'
    }
  },
  {
    id: 'corporate_blue',
    nombre: 'Azul corporativo',
    descripcion: 'Dark navy + azul profesional',
    badge: 'Empresarial',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
    preview: {
      bg: '#0f172a', sidebar: '#1e293b', accent: '#2563eb',
      text: '#94a3b8', stat: '#1e293b', bar: '#2563eb'
    },
    vars: {
      '--sidebar-bg': '#1e293b',
      '--sidebar-border': '#334155',
      '--sidebar-text': '#94a3b8',
      '--sidebar-active': '#2563eb',
      '--accent': '#2563eb',
      '--accent-hover': '#1d4ed8',
    }
  },
  {
    id: 'navy_red',
    nombre: 'Marino + rojo',
    descripcion: 'Azul oscuro con acento rojo',
    badge: 'Empresarial',
    badgeColor: '#991b1b',
    badgeBg: '#fee2e2',
    preview: {
      bg: '#1a1a2e', sidebar: '#16213e', accent: '#e94560',
      text: '#8892b0', stat: '#16213e', bar: '#e94560'
    }
  },
  {
    id: 'terminal',
    nombre: 'Negro + verde',
    descripcion: 'Estilo terminal, muy limpio',
    badge: 'Empresarial',
    badgeColor: '#166534',
    badgeBg: '#dcfce7',
    preview: {
      bg: '#0d1117', sidebar: '#161b22', accent: '#238636',
      text: '#8b949e', stat: '#161b22', bar: '#238636'
    }
  },
  {
    id: 'light_indigo',
    nombre: 'Claro + índigo',
    descripcion: 'Modo claro moderno y limpio',
    badge: 'Moderno',
    badgeColor: '#5b21b6',
    badgeBg: '#ede9fe',
    preview: {
      bg: '#f8fafc', sidebar: '#f1f5f9', accent: '#6366f1',
      text: '#64748b', stat: '#e2e8f0', bar: '#6366f1'
    },
    light: true
  },
  {
    id: 'carbon_orange',
    nombre: 'Carbón + naranja',
    descripcion: 'Estilo Apple dark, elegante',
    badge: 'Premium',
    badgeColor: '#c2410c',
    badgeBg: '#fff7ed',
    preview: {
      bg: '#1c1c1e', sidebar: '#2c2c2e', accent: '#ff9f0a',
      text: '#98989d', stat: '#2c2c2e', bar: '#ff9f0a'
    }
  },
  {
    id: 'ultra_dark',
    nombre: 'Negro + violeta',
    descripcion: 'Ultra dark con acento violeta',
    badge: 'Dark Pro',
    badgeColor: '#7e22ce',
    badgeBg: '#f3e8ff',
    preview: {
      bg: '#0a0a0a', sidebar: '#141414', accent: '#a855f7',
      text: '#737373', stat: '#141414', bar: '#a855f7'
    }
  },
]

function TemaPreview({ tema, seleccionado, onSeleccionar }) {
  const p = tema.preview
  return (
    <div
      onClick={() => onSeleccionar(tema.id)}
      style={{
        border: seleccionado ? `2px solid ${p.accent}` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, border-color 0.15s',
        transform: seleccionado ? 'scale(1.02)' : 'scale(1)',
        background: 'rgba(255,255,255,0.03)'
      }}>
      {/* Preview */}
      <div style={{ height: 100, display: 'flex', background: p.bg }}>
        <div style={{ width: 52, background: p.sidebar, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 7, borderRadius: 3, background: p.accent, opacity: 0.9 }} />
          {[0.5, 0.5, 0.5, 0.9].map((o, i) => (
            <div key={i} style={{ height: 7, borderRadius: 3, background: i === 3 ? p.accent : p.text, opacity: o, width: i === 3 ? '90%' : '75%' }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['S/423', '63 bal'].map((v, i) => (
              <div key={i} style={{ flex: 1, background: p.stat, borderRadius: 4, padding: '3px 5px' }}>
                <div style={{ fontSize: 7, color: p.text }}>stat</div>
                <div style={{ fontSize: 10, color: i === 0 ? p.accent : '#22c55e', fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 5, borderRadius: 3, background: p.bar, width: '70%' }} />
          <div style={{ height: 5, borderRadius: 3, background: p.stat, width: '100%' }} />
          <div style={{ height: 5, borderRadius: 3, background: p.stat, width: '85%' }} />
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{tema.nombre}</span>
          {seleccionado && <span style={{ fontSize: 10, background: p.accent, color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Activo</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{tema.descripcion}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: tema.badgeBg, color: tema.badgeColor, fontWeight: 500 }}>{tema.badge}</span>
        </div>
      </div>
    </div>
  )
}

export default function Apariencia() {
  const { perfil } = useAuth()
  const storageKey = perfil?.id ? `tema_${perfil.id}` : 'tema_default'
  const modoKey = perfil?.id ? `modo_${perfil.id}` : 'modo_default'

  const [temaActual, setTemaActual] = useState(() => localStorage.getItem(storageKey) || 'neon')
  const [modoClaro, setModoClaro] = useState(() => localStorage.getItem(modoKey) === 'claro')
  const [guardado, setGuardado] = useState(false)

  function aplicarTema(id) {
    setTemaActual(id)
    localStorage.setItem(storageKey, id)
    aplicarCSSVars(id, modoClaro)
    mostrarGuardado()
  }

  function toggleModo() {
    const nuevo = !modoClaro
    setModoClaro(nuevo)
    localStorage.setItem(modoKey, nuevo ? 'claro' : 'oscuro')
    aplicarCSSVars(temaActual, nuevo)
    mostrarGuardado()
  }

  function aplicarCSSVars(temaId, claro) {
    const root = document.documentElement
    if (claro) {
      root.style.setProperty('--app-bg', '#f8fafc')
      root.style.setProperty('--app-sidebar', '#f1f5f9')
      root.style.setProperty('--app-text', '#1e293b')
      root.style.setProperty('--app-border', '#e2e8f0')
    } else {
      const tema = TEMAS.find(t => t.id === temaId)
      const p = tema?.preview || {}
      root.style.setProperty('--app-bg', p.bg || '#0f172a')
      root.style.setProperty('--app-sidebar', p.sidebar || '#1e293b')
      root.style.setProperty('--app-text', p.text || '#94a3b8')
      root.style.setProperty('--app-accent', p.accent || '#3b82f6')
    }
  }

  function mostrarGuardado() {
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const empresariales = TEMAS.filter(t => t.badge === 'Empresarial' || t.id === 'neon')
  const alternativos = TEMAS.filter(t => t.badge !== 'Empresarial' && t.id !== 'neon')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Apariencia</h2>
          <p className="text-gray-500 text-sm">Tu tema es independiente — cada usuario elige el suyo</p>
        </div>
        {guardado && (
          <span style={{ fontSize: 13, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 14px', borderRadius: 8 }}>
            ✓ Guardado
          </span>
        )}
      </div>

      {/* Modo claro/oscuro */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="text-white font-medium" style={{ fontSize: 14 }}>{modoClaro ? '☀️ Modo claro' : '🌙 Modo oscuro'}</p>
          <p className="text-gray-500" style={{ fontSize: 12 }}>{modoClaro ? 'Interfaz con fondo blanco' : 'Interfaz con fondo oscuro'}</p>
        </div>
        <div
          onClick={toggleModo}
          style={{
            width: 48, height: 26, borderRadius: 13, cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            background: modoClaro ? '#6366f1' : '#374151'
          }}>
          <div style={{
            width: 20, height: 20, background: '#fff', borderRadius: '50%',
            position: 'absolute', top: 3, transition: 'left 0.2s',
            left: modoClaro ? 24 : 4
          }} />
        </div>
      </div>

      {/* Temas empresariales */}
      <div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, fontWeight: 500 }}>
          Temas empresariales
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {empresariales.map(tema => (
            <TemaPreview
              key={tema.id}
              tema={tema}
              seleccionado={temaActual === tema.id}
              onSeleccionar={aplicarTema}
            />
          ))}
        </div>
      </div>

      {/* Temas alternativos */}
      <div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, fontWeight: 500 }}>
          Temas alternativos
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {alternativos.map(tema => (
            <TemaPreview
              key={tema.id}
              tema={tema}
              seleccionado={temaActual === tema.id}
              onSeleccionar={aplicarTema}
            />
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '12px 16px' }}>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          💡 Tu tema se guarda automáticamente en este dispositivo. Cada trabajador puede tener su propio tema sin afectar a los demás.
        </p>
      </div>
    </div>
  )
}
