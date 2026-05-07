import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Search, Menu, X, AlertTriangle, TrendingDown, Package, CheckCircle } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

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

const UMBRAL_STOCK_BAJO = 10
const UMBRAL_DIAS_DEUDA = 30

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const { perfil } = useAuth()
  const title = titles[pathname] || 'Sistema'

  const [panelAbierto, setPanelAbierto] = useState(false)
  const [alertas, setAlertas] = useState([])
  const [cargando, setCargando] = useState(false)

  const cargarAlertas = useCallback(async () => {
    setCargando(true)
    const nuevasAlertas = []

    const [{ data: deudas }, { data: almacenes }] = await Promise.all([
      supabase.from('deudas')
        .select('id, nombre_deudor, monto_pendiente, balones_pendiente, fecha_deuda, estado')
        .in('estado', ['activa', 'pagada_parcial'])
        .or('eliminado.is.null,eliminado.eq.false'),
      supabase.from('almacenes')
        .select('id, nombre, stock_actual')
        .eq('activo', true)
    ])

    // Alertas de deudas urgentes (>30 días)
    const deudasUrgentes = (deudas || []).filter(d =>
      differenceInDays(new Date(), new Date(d.fecha_deuda)) >= UMBRAL_DIAS_DEUDA
    )
    if (deudasUrgentes.length > 0) {
      nuevasAlertas.push({
        id: 'deudas-urgentes',
        tipo: 'urgente',
        icono: '🔴',
        titulo: `${deudasUrgentes.length} deuda${deudasUrgentes.length > 1 ? 's' : ''} urgente${deudasUrgentes.length > 1 ? 's' : ''}`,
        detalle: `Más de ${UMBRAL_DIAS_DEUDA} días sin pagar`,
        sub: deudasUrgentes.slice(0, 3).map(d => d.nombre_deudor).join(', '),
        url: '/deudas',
        tiempo: null
      })
    }

    // Alertas de stock bajo
    const stockBajos = (almacenes || []).filter(a =>
      (a.stock_actual || 0) < UMBRAL_STOCK_BAJO
    )
    stockBajos.forEach(a => {
      nuevasAlertas.push({
        id: `stock-${a.id}`,
        tipo: 'stock',
        icono: '⚠️',
        titulo: `Stock bajo — ${a.nombre}`,
        detalle: `Solo ${a.stock_actual || 0} balones disponibles`,
        sub: null,
        url: '/almacenes',
        tiempo: null
      })
    })

    setAlertas(nuevasAlertas)
    setCargando(false)
  }, [])

  useEffect(() => {
    if (panelAbierto) cargarAlertas()
  }, [panelAbierto, cargarAlertas])

  // Escuchar cambios en tiempo real para el badge
  useEffect(() => {
    cargarAlertas()
  }, [cargarAlertas])

  const totalAlertas = alertas.length

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
      zIndex: 30,
    }}>

      {/* Izquierda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onMenuClick && (
          <button onClick={onMenuClick} className="hidden lg:flex"
            style={{ color:'var(--app-text-secondary)', padding:6, borderRadius:8, background:'none', border:'none', cursor:'pointer', alignItems:'center', justifyContent:'center' }}>
            <Menu style={{ width:20, height:20 }} />
          </button>
        )}
        <div className="flex lg:hidden" style={{ alignItems:'center', gap:8, display:'flex' }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg, #3b82f6, #6366f1)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🔥</div>
          <span style={{ color:'var(--app-text)', fontWeight:700, fontSize:14 }}>Centro Gas</span>
        </div>
        <h1 className="hidden lg:block" style={{ color:'var(--app-text)', fontWeight:600, fontSize:14, margin:0 }}>{title}</h1>
      </div>

      {/* Derecha */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ position:'relative' }} className="hidden lg:block">
          <Search style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'var(--app-text-secondary)' }} />
          <input style={{ background:'var(--app-input-bg)', border:'1px solid var(--app-input-border)', borderRadius:8, paddingLeft:32, paddingRight:16, paddingTop:6, paddingBottom:6, fontSize:12, color:'var(--app-input-text)', width:192, outline:'none' }}
            placeholder="Buscar..."
            onFocus={e => e.target.style.borderColor = 'var(--app-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--app-input-border)'}
          />
        </div>

        <span className="lg:hidden" style={{ color:'var(--app-text-secondary)', fontSize:12, fontWeight:500 }}>{title}</span>

        {/* Bell con badge */}
        <div style={{ position:'relative' }}>
          <button
            onClick={() => setPanelAbierto(v => !v)}
            style={{ color: totalAlertas > 0 ? '#f87171' : 'var(--app-text-secondary)', background:'none', border:'none', cursor:'pointer', padding:4, position:'relative' }}>
            <Bell style={{ width:18, height:18 }} />
            {totalAlertas > 0 && (
              <span style={{
                position:'absolute', top:-2, right:-2,
                width:16, height:16, borderRadius:'50%',
                background:'#ef4444', color:'#fff',
                fontSize:9, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>{totalAlertas}</span>
            )}
          </button>

          {/* Panel de notificaciones */}
          {panelAbierto && (
            <>
              {/* Overlay */}
              <div onClick={() => setPanelAbierto(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>

              {/* Panel */}
              <div style={{
                position:'absolute', right:0, top:'calc(100% + 8px)',
                width:320, maxHeight:480,
                background:'var(--app-card-bg)',
                border:'1px solid var(--app-card-border)',
                borderRadius:14,
                boxShadow:'0 20px 40px rgba(0,0,0,0.3)',
                zIndex:50,
                display:'flex', flexDirection:'column',
                overflow:'hidden'
              }}>
                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--app-card-border)' }}>
                  <p style={{ fontSize:14, fontWeight:700, color:'var(--app-text)', margin:0 }}>🔔 Alertas</p>
                  <button onClick={() => setPanelAbierto(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--app-text-secondary)' }}>
                    <X style={{ width:16, height:16 }}/>
                  </button>
                </div>

                {/* Lista */}
                <div style={{ overflowY:'auto', flex:1 }}>
                  {cargando ? (
                    <div style={{ padding:'24px', textAlign:'center', color:'var(--app-text-secondary)', fontSize:13 }}>Cargando...</div>
                  ) : alertas.length === 0 ? (
                    <div style={{ padding:'32px 16px', textAlign:'center' }}>
                      <CheckCircle style={{ width:32, height:32, color:'#22c55e', margin:'0 auto 8px', opacity:0.6 }}/>
                      <p style={{ fontSize:13, color:'var(--app-text-secondary)', margin:0 }}>Todo en orden</p>
                      <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'4px 0 0', opacity:0.7 }}>Sin alertas por ahora</p>
                    </div>
                  ) : (
                    alertas.map(alerta => (
                      <a key={alerta.id} href={alerta.url}
                        onClick={() => setPanelAbierto(false)}
                        style={{ display:'block', padding:'12px 16px', borderBottom:'1px solid var(--app-card-border)', textDecoration:'none', cursor:'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--app-card-bg-alt)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                          <span style={{ fontSize:18, flexShrink:0 }}>{alerta.icono}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:13, fontWeight:600, color: alerta.tipo==='urgente' ? '#f87171' : '#eab308', margin:0 }}>
                              {alerta.titulo}
                            </p>
                            <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0' }}>{alerta.detalle}</p>
                            {alerta.sub && (
                              <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0', opacity:0.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {alerta.sub}
                              </p>
                            )}
                          </div>
                        </div>
                      </a>
                    ))
                  )}
                </div>

                {/* Footer */}
                {alertas.length > 0 && (
                  <div style={{ padding:'10px 16px', borderTop:'1px solid var(--app-card-border)', textAlign:'center' }}>
                    <button onClick={cargarAlertas} style={{ fontSize:11, color:'var(--app-text-secondary)', background:'none', border:'none', cursor:'pointer' }}>
                      🔄 Actualizar
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <span className="hidden lg:block" style={{ color:'var(--app-text-secondary)', fontSize:12 }}>
          {format(new Date(), "EEE, d MMM.", { locale: es })}
        </span>

        <div className="lg:hidden" style={{ width:30, height:30, background:'linear-gradient(135deg, #3b82f6, #6366f1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:12 }}>
          {perfil?.nombre?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
