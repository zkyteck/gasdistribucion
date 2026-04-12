import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// ─── Definición completa de temas ───────────────────────────────────────────
export const TEMAS = {
  neon: {
    id: 'neon',
    nombre: 'Neón',
    descripcion: 'Tema oscuro con acentos neón',
    badge: 'Actual',
    dark: true,
    preview: { bg: '#0f172a', sidebar: '#1e293b', accent: '#3b82f6', text: '#94a3b8' },
    vars: {
      '--app-bg':             '#0f172a',
      '--app-main-bg':        '#0f172a',
      '--app-sidebar-bg':     '#1e293b',
      '--app-sidebar-border': '#334155',
      '--app-sidebar-text':   '#94a3b8',
      '--app-sidebar-active-bg':   'rgba(59,130,246,0.15)',
      '--app-sidebar-active-text': '#60a5fa',
      '--app-sidebar-active-border':'rgba(59,130,246,0.4)',
      '--app-sidebar-hover-bg':    'rgba(255,255,255,0.05)',
      '--app-sidebar-hover-text':  '#e2e8f0',
      '--app-topbar-bg':      'rgba(30,41,59,0.85)',
      '--app-topbar-border':  '#334155',
      '--app-text':           '#e2e8f0',
      '--app-text-secondary': '#94a3b8',
      '--app-accent':         '#3b82f6',
      '--app-accent-hover':   '#2563eb',
      '--app-card-bg':        'rgba(30,41,59,0.6)',
      '--app-card-border':    '#334155',
      '--app-input-bg':       '#1e293b',
      '--app-input-border':   '#475569',
      '--app-input-text':     '#e2e8f0',
      '--app-logo-text':      '#ffffff',
      '--app-logo-sub':       '#64748b',
    }
  },
  corporate_blue: {
    id: 'corporate_blue',
    nombre: 'Azul corporativo',
    descripcion: 'Dark navy + azul profesional',
    badge: 'Empresarial',
    dark: true,
    preview: { bg: '#0a0f1e', sidebar: '#111827', accent: '#2563eb', text: '#9ca3af' },
    vars: {
      '--app-bg':             '#0a0f1e',
      '--app-main-bg':        '#0a0f1e',
      '--app-sidebar-bg':     '#111827',
      '--app-sidebar-border': '#1f2937',
      '--app-sidebar-text':   '#9ca3af',
      '--app-sidebar-active-bg':   'rgba(37,99,235,0.15)',
      '--app-sidebar-active-text': '#3b82f6',
      '--app-sidebar-active-border':'rgba(37,99,235,0.4)',
      '--app-sidebar-hover-bg':    'rgba(255,255,255,0.05)',
      '--app-sidebar-hover-text':  '#f3f4f6',
      '--app-topbar-bg':      'rgba(17,24,39,0.9)',
      '--app-topbar-border':  '#1f2937',
      '--app-text':           '#f3f4f6',
      '--app-text-secondary': '#9ca3af',
      '--app-accent':         '#2563eb',
      '--app-accent-hover':   '#1d4ed8',
      '--app-card-bg':        'rgba(17,24,39,0.7)',
      '--app-card-border':    '#1f2937',
      '--app-input-bg':       '#1f2937',
      '--app-input-border':   '#374151',
      '--app-input-text':     '#f3f4f6',
      '--app-logo-text':      '#ffffff',
      '--app-logo-sub':       '#6b7280',
    }
  },
  navy_red: {
    id: 'navy_red',
    nombre: 'Marino + rojo',
    descripcion: 'Azul oscuro con acento rojo',
    badge: 'Empresarial',
    dark: true,
    preview: { bg: '#1a1a2e', sidebar: '#16213e', accent: '#e94560', text: '#8892b0' },
    vars: {
      '--app-bg':             '#1a1a2e',
      '--app-main-bg':        '#1a1a2e',
      '--app-sidebar-bg':     '#16213e',
      '--app-sidebar-border': '#0f3460',
      '--app-sidebar-text':   '#8892b0',
      '--app-sidebar-active-bg':   'rgba(233,69,96,0.15)',
      '--app-sidebar-active-text': '#e94560',
      '--app-sidebar-active-border':'rgba(233,69,96,0.4)',
      '--app-sidebar-hover-bg':    'rgba(255,255,255,0.05)',
      '--app-sidebar-hover-text':  '#ccd6f6',
      '--app-topbar-bg':      'rgba(22,33,62,0.9)',
      '--app-topbar-border':  '#0f3460',
      '--app-text':           '#ccd6f6',
      '--app-text-secondary': '#8892b0',
      '--app-accent':         '#e94560',
      '--app-accent-hover':   '#c73652',
      '--app-card-bg':        'rgba(22,33,62,0.7)',
      '--app-card-border':    '#0f3460',
      '--app-input-bg':       '#16213e',
      '--app-input-border':   '#0f3460',
      '--app-input-text':     '#ccd6f6',
      '--app-logo-text':      '#ffffff',
      '--app-logo-sub':       '#8892b0',
    }
  },
  terminal: {
    id: 'terminal',
    nombre: 'Negro + verde',
    descripcion: 'Estilo terminal, muy limpio',
    badge: 'Empresarial',
    dark: true,
    preview: { bg: '#0d1117', sidebar: '#161b22', accent: '#238636', text: '#8b949e' },
    vars: {
      '--app-bg':             '#0d1117',
      '--app-main-bg':        '#0d1117',
      '--app-sidebar-bg':     '#161b22',
      '--app-sidebar-border': '#21262d',
      '--app-sidebar-text':   '#8b949e',
      '--app-sidebar-active-bg':   'rgba(35,134,54,0.15)',
      '--app-sidebar-active-text': '#3fb950',
      '--app-sidebar-active-border':'rgba(35,134,54,0.4)',
      '--app-sidebar-hover-bg':    'rgba(255,255,255,0.04)',
      '--app-sidebar-hover-text':  '#c9d1d9',
      '--app-topbar-bg':      'rgba(22,27,34,0.9)',
      '--app-topbar-border':  '#21262d',
      '--app-text':           '#c9d1d9',
      '--app-text-secondary': '#8b949e',
      '--app-accent':         '#238636',
      '--app-accent-hover':   '#1a6628',
      '--app-card-bg':        'rgba(22,27,34,0.8)',
      '--app-card-border':    '#21262d',
      '--app-input-bg':       '#161b22',
      '--app-input-border':   '#30363d',
      '--app-input-text':     '#c9d1d9',
      '--app-logo-text':      '#ffffff',
      '--app-logo-sub':       '#6e7681',
    }
  },
  light_indigo: {
    id: 'light_indigo',
    nombre: 'Claro + índigo',
    descripcion: 'Modo claro moderno y limpio',
    badge: 'Moderno',
    dark: false,
    preview: { bg: '#f8fafc', sidebar: '#f1f5f9', accent: '#6366f1', text: '#64748b' },
    vars: {
      '--app-bg':             '#f1f5f9',
      '--app-main-bg':        '#f8fafc',
      '--app-sidebar-bg':     '#ffffff',
      '--app-sidebar-border': '#e2e8f0',
      '--app-sidebar-text':   '#64748b',
      '--app-sidebar-active-bg':   'rgba(99,102,241,0.1)',
      '--app-sidebar-active-text': '#6366f1',
      '--app-sidebar-active-border':'rgba(99,102,241,0.3)',
      '--app-sidebar-hover-bg':    'rgba(0,0,0,0.04)',
      '--app-sidebar-hover-text':  '#1e293b',
      '--app-topbar-bg':      'rgba(255,255,255,0.9)',
      '--app-topbar-border':  '#e2e8f0',
      '--app-text':           '#1e293b',
      '--app-text-secondary': '#64748b',
      '--app-accent':         '#6366f1',
      '--app-accent-hover':   '#4f46e5',
      '--app-card-bg':        '#ffffff',
      '--app-card-border':    '#e2e8f0',
      '--app-input-bg':       '#f8fafc',
      '--app-input-border':   '#cbd5e1',
      '--app-input-text':     '#1e293b',
      '--app-logo-text':      '#1e293b',
      '--app-logo-sub':       '#94a3b8',
    }
  },
  carbon_orange: {
    id: 'carbon_orange',
    nombre: 'Carbón + naranja',
    descripcion: 'Estilo Apple dark, elegante',
    badge: 'Premium',
    dark: true,
    preview: { bg: '#1c1c1e', sidebar: '#2c2c2e', accent: '#ff9f0a', text: '#98989d' },
    vars: {
      '--app-bg':             '#1c1c1e',
      '--app-main-bg':        '#1c1c1e',
      '--app-sidebar-bg':     '#2c2c2e',
      '--app-sidebar-border': '#3a3a3c',
      '--app-sidebar-text':   '#98989d',
      '--app-sidebar-active-bg':   'rgba(255,159,10,0.12)',
      '--app-sidebar-active-text': '#ff9f0a',
      '--app-sidebar-active-border':'rgba(255,159,10,0.35)',
      '--app-sidebar-hover-bg':    'rgba(255,255,255,0.05)',
      '--app-sidebar-hover-text':  '#f5f5f7',
      '--app-topbar-bg':      'rgba(44,44,46,0.9)',
      '--app-topbar-border':  '#3a3a3c',
      '--app-text':           '#f5f5f7',
      '--app-text-secondary': '#98989d',
      '--app-accent':         '#ff9f0a',
      '--app-accent-hover':   '#e8890a',
      '--app-card-bg':        'rgba(44,44,46,0.8)',
      '--app-card-border':    '#3a3a3c',
      '--app-input-bg':       '#2c2c2e',
      '--app-input-border':   '#48484a',
      '--app-input-text':     '#f5f5f7',
      '--app-logo-text':      '#ffffff',
      '--app-logo-sub':       '#636366',
    }
  },
  ultra_dark: {
    id: 'ultra_dark',
    nombre: 'Negro + violeta',
    descripcion: 'Ultra dark con acento violeta',
    badge: 'Dark Pro',
    dark: true,
    preview: { bg: '#0a0a0a', sidebar: '#141414', accent: '#a855f7', text: '#737373' },
    vars: {
      '--app-bg':             '#0a0a0a',
      '--app-main-bg':        '#0a0a0a',
      '--app-sidebar-bg':     '#141414',
      '--app-sidebar-border': '#262626',
      '--app-sidebar-text':   '#737373',
      '--app-sidebar-active-bg':   'rgba(168,85,247,0.12)',
      '--app-sidebar-active-text': '#a855f7',
      '--app-sidebar-active-border':'rgba(168,85,247,0.35)',
      '--app-sidebar-hover-bg':    'rgba(255,255,255,0.04)',
      '--app-sidebar-hover-text':  '#e5e5e5',
      '--app-topbar-bg':      'rgba(20,20,20,0.9)',
      '--app-topbar-border':  '#262626',
      '--app-text':           '#e5e5e5',
      '--app-text-secondary': '#737373',
      '--app-accent':         '#a855f7',
      '--app-accent-hover':   '#9333ea',
      '--app-card-bg':        'rgba(20,20,20,0.9)',
      '--app-card-border':    '#262626',
      '--app-input-bg':       '#141414',
      '--app-input-border':   '#404040',
      '--app-input-text':     '#e5e5e5',
      '--app-logo-text':      '#ffffff',
      '--app-logo-sub':       '#525252',
    }
  },
}

// ─── Función exportable para aplicar un tema ────────────────────────────────
export function aplicarTemaAlDOM(temaId) {
  const tema = TEMAS[temaId]
  if (!tema) return
  const root = document.documentElement
  Object.entries(tema.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  // class para modo claro/oscuro en body
  if (tema.dark) {
    document.body.classList.remove('tema-claro')
    document.body.classList.add('tema-oscuro')
  } else {
    document.body.classList.remove('tema-oscuro')
    document.body.classList.add('tema-claro')
  }
}

// ─── Preview mini ────────────────────────────────────────────────────────────
function TemaPreview({ tema, seleccionado, onSeleccionar }) {
  const p = tema.preview
  const badgeColors = {
    'Actual':       { bg: '#dbeafe', color: '#1e40af' },
    'Empresarial':  { bg: '#dbeafe', color: '#1e40af' },
    'Moderno':      { bg: '#ede9fe', color: '#5b21b6' },
    'Premium':      { bg: '#fff7ed', color: '#c2410c' },
    'Dark Pro':     { bg: '#f3e8ff', color: '#7e22ce' },
  }
  const bc = badgeColors[tema.badge] || { bg: '#e5e7eb', color: '#374151' }

  return (
    <div
      onClick={() => onSeleccionar(tema.id)}
      style={{
        border: seleccionado ? `2px solid ${p.accent}` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
        transform: seleccionado ? 'scale(1.02)' : 'scale(1)',
        boxShadow: seleccionado ? `0 0 0 1px ${p.accent}33, 0 4px 20px ${p.accent}22` : 'none',
        background: 'var(--app-card-bg)',
      }}>
      {/* Mini preview */}
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
              <div key={i} style={{ flex: 1, background: p.sidebar, borderRadius: 4, padding: '3px 5px' }}>
                <div style={{ fontSize: 7, color: p.text }}>stat</div>
                <div style={{ fontSize: 10, color: i === 0 ? p.accent : '#22c55e', fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 5, borderRadius: 3, background: p.accent, width: '70%' }} />
          <div style={{ height: 5, borderRadius: 3, background: p.text, opacity: 0.2, width: '100%' }} />
          <div style={{ height: 5, borderRadius: 3, background: p.text, opacity: 0.2, width: '85%' }} />
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--app-text)' }}>{tema.nombre}</span>
          {seleccionado && (
            <span style={{ fontSize: 10, background: p.accent, color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
              Activo
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--app-text-secondary)', marginBottom: 4 }}>{tema.descripcion}</div>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: bc.bg, color: bc.color, fontWeight: 500 }}>
          {tema.badge}
        </span>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function Apariencia() {
  const { perfil } = useAuth()
  const storageKey = perfil?.id ? `tema_${perfil.id}` : 'tema_default'

  const [temaActual, setTemaActual] = useState(() => localStorage.getItem(storageKey) || 'neon')
  const [guardado, setGuardado] = useState(false)

  function seleccionarTema(id) {
    setTemaActual(id)
    localStorage.setItem(storageKey, id)
    aplicarTemaAlDOM(id)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const empresariales = ['neon', 'corporate_blue', 'navy_red', 'terminal'].map(id => TEMAS[id])
  const alternativos  = ['light_indigo', 'carbon_orange', 'ultra_dark'].map(id => TEMAS[id])
  const temaInfo = TEMAS[temaActual]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--app-text)', marginBottom: 2 }}>Apariencia</h2>
          <p style={{ fontSize: 13, color: 'var(--app-text-secondary)' }}>Tu tema es independiente — cada usuario elige el suyo</p>
        </div>
        {guardado && (
          <span style={{ fontSize: 13, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 14px', borderRadius: 8 }}>
            ✓ Guardado
          </span>
        )}
      </div>

      {/* Tema activo info */}
      {temaInfo && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: 'var(--app-card-bg)',
          border: `1px solid ${temaInfo.preview.accent}44`,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: temaInfo.preview.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            🎨
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text)' }}>
              Tema activo: {temaInfo.nombre}
            </p>
            <p style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
              {temaInfo.dark ? '🌙 Modo oscuro' : '☀️ Modo claro'} · {temaInfo.descripcion}
            </p>
          </div>
        </div>
      )}

      {/* Temas empresariales */}
      <div>
        <p style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 12, fontWeight: 500 }}>
          Temas empresariales
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {empresariales.map(tema => (
            <TemaPreview key={tema.id} tema={tema} seleccionado={temaActual === tema.id} onSeleccionar={seleccionarTema} />
          ))}
        </div>
      </div>

      {/* Temas alternativos */}
      <div>
        <p style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 12, fontWeight: 500 }}>
          Temas alternativos
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {alternativos.map(tema => (
            <TemaPreview key={tema.id} tema={tema} seleccionado={temaActual === tema.id} onSeleccionar={seleccionarTema} />
          ))}
        </div>
      </div>

      {/* Nota */}
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '12px 16px' }}>
        <p style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
          💡 Tu tema se guarda automáticamente en este dispositivo. Cada trabajador puede tener su propio tema sin afectar a los demás.
        </p>
      </div>
    </div>
  )
}
