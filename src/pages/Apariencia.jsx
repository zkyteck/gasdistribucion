import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

// ─── Temas ───────────────────────────────────────────────────────────────────
export const TEMAS = {
  // ── Azul acero ──────────────────────────────────────────────────────────────
  acero_oscuro: {
    id: 'acero_oscuro', nombre: 'Azul acero', descripcion: 'Profesional y serio',
    badge: 'Oscuro', dark: true,
    preview: { bg: '#0d1117', sidebar: '#161b22', accent: '#1f6feb', text: '#8b949e' },
    vars: {
      '--app-bg':                    '#0d1117',
      '--app-main-bg':               '#0d1117',
      '--app-sidebar-bg':            '#161b22',
      '--app-sidebar-border':        '#21262d',
      '--app-sidebar-text':          '#8b949e',
      '--app-sidebar-active-bg':     'rgba(31,111,235,0.15)',
      '--app-sidebar-active-text':   '#388bfd',
      '--app-sidebar-active-border': 'rgba(31,111,235,0.4)',
      '--app-sidebar-hover-bg':      'rgba(255,255,255,0.04)',
      '--app-sidebar-hover-text':    '#f0f6fc',
      '--app-topbar-bg':             'rgba(22,27,34,0.9)',
      '--app-topbar-border':         '#21262d',
      '--app-text':                  '#f0f6fc',
      '--app-text-secondary':        '#8b949e',
      '--app-accent':                '#1f6feb',
      '--app-accent-hover':          '#1158d1',
      '--app-card-bg':               'rgba(22,27,34,0.8)',
      '--app-card-bg-alt':           '#1c2128',
      '--app-card-border':           '#21262d',
      '--app-input-bg':              '#161b22',
      '--app-input-border':          '#30363d',
      '--app-input-text':            '#f0f6fc',
      '--app-logo-text':             '#ffffff',
      '--app-logo-sub':              '#6e7681',
      '--app-modal-bg':              '#161b22',
      '--app-modal-border':          '#21262d',
    }
  },
  acero_claro: {
    id: 'acero_claro', nombre: 'Azul acero claro', descripcion: 'Profesional en modo claro',
    badge: 'Claro', dark: false,
    preview: { bg: '#f8fafc', sidebar: '#ffffff', accent: '#1f6feb', text: '#64748b' },
    vars: {
      '--app-bg':                    '#f1f5f9',
      '--app-main-bg':               '#f8fafc',
      '--app-sidebar-bg':            '#ffffff',
      '--app-sidebar-border':        '#e2e8f0',
      '--app-sidebar-text':          '#64748b',
      '--app-sidebar-active-bg':     'rgba(31,111,235,0.1)',
      '--app-sidebar-active-text':   '#1f6feb',
      '--app-sidebar-active-border': 'rgba(31,111,235,0.3)',
      '--app-sidebar-hover-bg':      'rgba(0,0,0,0.04)',
      '--app-sidebar-hover-text':    '#1e293b',
      '--app-topbar-bg':             'rgba(255,255,255,0.9)',
      '--app-topbar-border':         '#e2e8f0',
      '--app-text':                  '#1e293b',
      '--app-text-secondary':        '#64748b',
      '--app-accent':                '#1f6feb',
      '--app-accent-hover':          '#1158d1',
      '--app-card-bg':               '#ffffff',
      '--app-card-bg-alt':           '#f8fafc',
      '--app-card-border':           '#e2e8f0',
      '--app-input-bg':              '#f8fafc',
      '--app-input-border':          '#cbd5e1',
      '--app-input-text':            '#1e293b',
      '--app-logo-text':             '#1e293b',
      '--app-logo-sub':              '#94a3b8',
      '--app-modal-bg':              '#ffffff',
      '--app-modal-border':          '#e2e8f0',
    }
  },

  // ── Grafito + naranja ────────────────────────────────────────────────────────
  naranja_oscuro: {
    id: 'naranja_oscuro', nombre: 'Grafito + naranja', descripcion: 'Energético, distribución y gas',
    badge: 'Oscuro', dark: true,
    preview: { bg: '#1a1a1a', sidebar: '#242424', accent: '#e67e22', text: '#888888' },
    vars: {
      '--app-bg':                    '#1a1a1a',
      '--app-main-bg':               '#1a1a1a',
      '--app-sidebar-bg':            '#242424',
      '--app-sidebar-border':        '#333333',
      '--app-sidebar-text':          '#888888',
      '--app-sidebar-active-bg':     'rgba(230,126,34,0.15)',
      '--app-sidebar-active-text':   '#e67e22',
      '--app-sidebar-active-border': 'rgba(230,126,34,0.4)',
      '--app-sidebar-hover-bg':      'rgba(255,255,255,0.05)',
      '--app-sidebar-hover-text':    '#f5f5f5',
      '--app-topbar-bg':             'rgba(36,36,36,0.9)',
      '--app-topbar-border':         '#333333',
      '--app-text':                  '#f5f5f5',
      '--app-text-secondary':        '#888888',
      '--app-accent':                '#e67e22',
      '--app-accent-hover':          '#c96a12',
      '--app-card-bg':               'rgba(36,36,36,0.8)',
      '--app-card-bg-alt':           '#2a2a2a',
      '--app-card-border':           '#333333',
      '--app-input-bg':              '#242424',
      '--app-input-border':          '#444444',
      '--app-input-text':            '#f5f5f5',
      '--app-logo-text':             '#ffffff',
      '--app-logo-sub':              '#888888',
      '--app-modal-bg':              '#242424',
      '--app-modal-border':          '#333333',
    }
  },
  naranja_claro: {
    id: 'naranja_claro', nombre: 'Naranja claro', descripcion: 'Energético en modo claro',
    badge: 'Claro', dark: false,
    preview: { bg: '#fafafa', sidebar: '#ffffff', accent: '#e67e22', text: '#6b7280' },
    vars: {
      '--app-bg':                    '#f5f5f4',
      '--app-main-bg':               '#fafafa',
      '--app-sidebar-bg':            '#ffffff',
      '--app-sidebar-border':        '#e5e7eb',
      '--app-sidebar-text':          '#6b7280',
      '--app-sidebar-active-bg':     'rgba(230,126,34,0.1)',
      '--app-sidebar-active-text':   '#e67e22',
      '--app-sidebar-active-border': 'rgba(230,126,34,0.3)',
      '--app-sidebar-hover-bg':      'rgba(0,0,0,0.04)',
      '--app-sidebar-hover-text':    '#111827',
      '--app-topbar-bg':             'rgba(255,255,255,0.9)',
      '--app-topbar-border':         '#e5e7eb',
      '--app-text':                  '#111827',
      '--app-text-secondary':        '#6b7280',
      '--app-accent':                '#e67e22',
      '--app-accent-hover':          '#c96a12',
      '--app-card-bg':               '#ffffff',
      '--app-card-bg-alt':           '#fafafa',
      '--app-card-border':           '#e5e7eb',
      '--app-input-bg':              '#fafafa',
      '--app-input-border':          '#d1d5db',
      '--app-input-text':            '#111827',
      '--app-logo-text':             '#111827',
      '--app-logo-sub':              '#9ca3af',
      '--app-modal-bg':              '#ffffff',
      '--app-modal-border':          '#e5e7eb',
    }
  },

  // ── Marino + cian ────────────────────────────────────────────────────────────
  cian_oscuro: {
    id: 'cian_oscuro', nombre: 'Marino + cian', descripcion: 'Tecnológico, estilo logística',
    badge: 'Oscuro', dark: true,
    preview: { bg: '#0a0f1e', sidebar: '#0d1526', accent: '#06b6d4', text: '#64748b' },
    vars: {
      '--app-bg':                    '#0a0f1e',
      '--app-main-bg':               '#0a0f1e',
      '--app-sidebar-bg':            '#0d1526',
      '--app-sidebar-border':        '#1a2540',
      '--app-sidebar-text':          '#64748b',
      '--app-sidebar-active-bg':     'rgba(6,182,212,0.15)',
      '--app-sidebar-active-text':   '#06b6d4',
      '--app-sidebar-active-border': 'rgba(6,182,212,0.4)',
      '--app-sidebar-hover-bg':      'rgba(255,255,255,0.04)',
      '--app-sidebar-hover-text':    '#e2e8f0',
      '--app-topbar-bg':             'rgba(13,21,38,0.9)',
      '--app-topbar-border':         '#1a2540',
      '--app-text':                  '#e2e8f0',
      '--app-text-secondary':        '#64748b',
      '--app-accent':                '#06b6d4',
      '--app-accent-hover':          '#0891b2',
      '--app-card-bg':               'rgba(13,21,38,0.8)',
      '--app-card-bg-alt':           '#111e35',
      '--app-card-border':           '#1a2540',
      '--app-input-bg':              '#0d1526',
      '--app-input-border':          '#1e3a5f',
      '--app-input-text':            '#e2e8f0',
      '--app-logo-text':             '#ffffff',
      '--app-logo-sub':              '#64748b',
      '--app-modal-bg':              '#0d1526',
      '--app-modal-border':          '#1a2540',
    }
  },
  cian_claro: {
    id: 'cian_claro', nombre: 'Cian claro', descripcion: 'Tecnológico en modo claro',
    badge: 'Claro', dark: false,
    preview: { bg: '#f0f9ff', sidebar: '#ffffff', accent: '#06b6d4', text: '#64748b' },
    vars: {
      '--app-bg':                    '#e0f2fe',
      '--app-main-bg':               '#f0f9ff',
      '--app-sidebar-bg':            '#ffffff',
      '--app-sidebar-border':        '#bae6fd',
      '--app-sidebar-text':          '#64748b',
      '--app-sidebar-active-bg':     'rgba(6,182,212,0.1)',
      '--app-sidebar-active-text':   '#0891b2',
      '--app-sidebar-active-border': 'rgba(6,182,212,0.3)',
      '--app-sidebar-hover-bg':      'rgba(0,0,0,0.03)',
      '--app-sidebar-hover-text':    '#0c4a6e',
      '--app-topbar-bg':             'rgba(255,255,255,0.9)',
      '--app-topbar-border':         '#bae6fd',
      '--app-text':                  '#0c4a6e',
      '--app-text-secondary':        '#64748b',
      '--app-accent':                '#06b6d4',
      '--app-accent-hover':          '#0891b2',
      '--app-card-bg':               '#ffffff',
      '--app-card-bg-alt':           '#f0f9ff',
      '--app-card-border':           '#bae6fd',
      '--app-input-bg':              '#f0f9ff',
      '--app-input-border':          '#7dd3fc',
      '--app-input-text':            '#0c4a6e',
      '--app-logo-text':             '#0c4a6e',
      '--app-logo-sub':              '#94a3b8',
      '--app-modal-bg':              '#ffffff',
      '--app-modal-border':          '#bae6fd',
    }
  },

  // ── Negro + verde (terminal) ─────────────────────────────────────────────────
  terminal_oscuro: {
    id: 'terminal_oscuro', nombre: 'Negro + verde', descripcion: 'Estilo terminal clásico',
    badge: 'Oscuro', dark: true,
    preview: { bg: '#0d1117', sidebar: '#161b22', accent: '#238636', text: '#8b949e' },
    vars: {
      '--app-bg':                    '#0d1117',
      '--app-main-bg':               '#0d1117',
      '--app-sidebar-bg':            '#161b22',
      '--app-sidebar-border':        '#21262d',
      '--app-sidebar-text':          '#8b949e',
      '--app-sidebar-active-bg':     'rgba(35,134,54,0.15)',
      '--app-sidebar-active-text':   '#3fb950',
      '--app-sidebar-active-border': 'rgba(35,134,54,0.4)',
      '--app-sidebar-hover-bg':      'rgba(255,255,255,0.04)',
      '--app-sidebar-hover-text':    '#c9d1d9',
      '--app-topbar-bg':             'rgba(22,27,34,0.9)',
      '--app-topbar-border':         '#21262d',
      '--app-text':                  '#c9d1d9',
      '--app-text-secondary':        '#8b949e',
      '--app-accent':                '#238636',
      '--app-accent-hover':          '#1a6628',
      '--app-card-bg':               'rgba(22,27,34,0.8)',
      '--app-card-bg-alt':           '#1c2128',
      '--app-card-border':           '#21262d',
      '--app-input-bg':              '#161b22',
      '--app-input-border':          '#30363d',
      '--app-input-text':            '#c9d1d9',
      '--app-logo-text':             '#ffffff',
      '--app-logo-sub':              '#6e7681',
      '--app-modal-bg':              '#161b22',
      '--app-modal-border':          '#21262d',
    }
  },
  terminal_claro: {
    id: 'terminal_claro', nombre: 'Verde claro', descripcion: 'Terminal en modo claro',
    badge: 'Claro', dark: false,
    preview: { bg: '#f8fafc', sidebar: '#ffffff', accent: '#16a34a', text: '#64748b' },
    vars: {
      '--app-bg':                    '#f0fdf4',
      '--app-main-bg':               '#f8fafc',
      '--app-sidebar-bg':            '#ffffff',
      '--app-sidebar-border':        '#dcfce7',
      '--app-sidebar-text':          '#64748b',
      '--app-sidebar-active-bg':     'rgba(22,163,74,0.1)',
      '--app-sidebar-active-text':   '#16a34a',
      '--app-sidebar-active-border': 'rgba(22,163,74,0.3)',
      '--app-sidebar-hover-bg':      'rgba(0,0,0,0.03)',
      '--app-sidebar-hover-text':    '#14532d',
      '--app-topbar-bg':             'rgba(255,255,255,0.9)',
      '--app-topbar-border':         '#dcfce7',
      '--app-text':                  '#14532d',
      '--app-text-secondary':        '#64748b',
      '--app-accent':                '#16a34a',
      '--app-accent-hover':          '#15803d',
      '--app-card-bg':               '#ffffff',
      '--app-card-bg-alt':           '#f0fdf4',
      '--app-card-border':           '#dcfce7',
      '--app-input-bg':              '#f0fdf4',
      '--app-input-border':          '#bbf7d0',
      '--app-input-text':            '#14532d',
      '--app-logo-text':             '#14532d',
      '--app-logo-sub':              '#94a3b8',
      '--app-modal-bg':              '#ffffff',
      '--app-modal-border':          '#dcfce7',
    }
  },
}

// ─── Aplicar tema al DOM ──────────────────────────────────────────────────────
export function aplicarTemaAlDOM(temaId) {
  const tema = TEMAS[temaId]
  if (!tema) return
  const root = document.documentElement
  Object.entries(tema.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  if (tema.dark) {
    document.body.classList.remove('tema-claro')
    document.body.classList.add('tema-oscuro')
  } else {
    document.body.classList.remove('tema-oscuro')
    document.body.classList.add('tema-claro')
  }
}

// ─── Colores de badge por tipo ────────────────────────────────────────────────
const BADGE_COLORS = {
  'Oscuro': { bg: '#1e293b', color: '#94a3b8' },
  'Claro':  { bg: '#f1f5f9', color: '#475569' },
}

// ─── Grupos de temas ──────────────────────────────────────────────────────────
const GRUPOS = [
  { label: 'Azul acero',        ids: ['acero_oscuro',    'acero_claro']    },
  { label: 'Grafito + naranja', ids: ['naranja_oscuro',  'naranja_claro']  },
  { label: 'Marino + cian',     ids: ['cian_oscuro',     'cian_claro']     },
  { label: 'Negro + verde',     ids: ['terminal_oscuro', 'terminal_claro'] },
]

// ─── Preview mini ─────────────────────────────────────────────────────────────
function TemaPreview({ tema, seleccionado, onSeleccionar }) {
  const p = tema.preview
  const bc = BADGE_COLORS[tema.badge] || { bg: '#e5e7eb', color: '#374151' }

  return (
    <div
      onClick={() => onSeleccionar(tema.id)}
      style={{
        border: seleccionado ? `2px solid ${p.accent}` : '1px solid rgba(128,128,128,0.15)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        transform: seleccionado ? 'scale(1.02)' : 'scale(1)',
        boxShadow: seleccionado ? `0 0 0 1px ${p.accent}33, 0 4px 16px ${p.accent}22` : 'none',
        background: 'var(--app-card-bg)',
      }}
    >
      {/* Mini preview */}
      <div style={{ height: 80, display: 'flex', background: p.bg }}>
        <div style={{ width: 44, background: p.sidebar, padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 5, borderRadius: 2, background: p.accent, width: '85%' }} />
          {[0.4, 0.4, 0.9].map((o, i) => (
            <div key={i} style={{ height: 5, borderRadius: 2, background: i === 2 ? p.accent : p.text, opacity: o, width: i === 2 ? '90%' : '70%' }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {['S/423', '63'].map((v, i) => (
              <div key={i} style={{ flex: 1, background: p.sidebar, borderRadius: 3, padding: '2px 4px' }}>
                <div style={{ fontSize: 6, color: p.text }}>dato</div>
                <div style={{ fontSize: 9, color: i === 0 ? p.accent : '#22c55e', fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 4, borderRadius: 2, background: p.accent, width: '65%' }} />
          <div style={{ height: 4, borderRadius: 2, background: p.text, opacity: 0.2, width: '100%' }} />
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--app-text)' }}>{tema.nombre}</span>
          {seleccionado && (
            <span style={{ fontSize: 9, background: p.accent, color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
              Activo
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--app-text-secondary)' }}>{tema.descripcion}</span>
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: bc.bg, color: bc.color, fontWeight: 500 }}>
            {tema.badge}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Apariencia() {
  const { perfil } = useAuth()
  const storageKey = perfil?.id ? `tema_${perfil.id}` : 'tema_default'

  const [temaActual, setTemaActual] = useState(() => localStorage.getItem(storageKey) || 'terminal_oscuro')
  const [guardado, setGuardado] = useState(false)

  const seleccionarTema = useCallback((id) => {
    setTemaActual(id)
    localStorage.setItem(storageKey, id)
    aplicarTemaAlDOM(id)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }, [storageKey])

  const temaInfo = TEMAS[temaActual]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--app-text)', marginBottom: 2 }}>Apariencia</h2>
          <p style={{ fontSize: 13, color: 'var(--app-text-secondary)' }}>Cada usuario elige su propio tema</p>
        </div>
        {guardado && (
          <span style={{
            fontSize: 13, color: '#22c55e',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            padding: '6px 14px', borderRadius: 8,
          }}>
            ✓ Guardado
          </span>
        )}
      </div>

      {/* Tema activo */}
      {temaInfo && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'var(--app-card-bg)',
          border: `1px solid ${temaInfo.preview.accent}44`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: temaInfo.preview.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            🎨
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text)', margin: 0 }}>
              Tema activo: {temaInfo.nombre}
            </p>
            <p style={{ fontSize: 12, color: 'var(--app-text-secondary)', margin: 0 }}>
              {temaInfo.dark ? '🌙 Modo oscuro' : '☀️ Modo claro'} · {temaInfo.descripcion}
            </p>
          </div>
        </div>
      )}

      {/* Grupos de temas */}
      {GRUPOS.map(grupo => (
        <div key={grupo.label}>
          <p style={{ fontSize: 12, color: 'var(--app-text-secondary)', fontWeight: 500, marginBottom: 10 }}>
            {grupo.label}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {grupo.ids.map(id => (
              <TemaPreview
                key={id}
                tema={TEMAS[id]}
                seleccionado={temaActual === id}
                onSeleccionar={seleccionarTema}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Nota */}
      <div style={{
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 12, padding: '12px 16px',
      }}>
        <p style={{ fontSize: 12, color: 'var(--app-text-secondary)', margin: 0 }}>
          💡 Tu tema se guarda en este dispositivo. Cada trabajador puede tener el suyo sin afectar a los demás.
        </p>
      </div>
    </div>
  )
}
