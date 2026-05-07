// src/components/AsistenteFlotante.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, RefreshCw, Zap, Minimize2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { differenceInDays } from 'date-fns'
import { Notif } from '../lib/notificaciones'

const UMBRAL_STOCK = 10
const UMBRAL_DIAS_DEUDA = 30
const INTERVALO_REVISION = 60 * 60 * 1000

async function recolectarDatos() {
  const [{ data: deudas }, { data: almacenes }, { data: acuenta }, { data: ventas }] = await Promise.all([
    supabase.from('deudas').select('*').in('estado', ['activa', 'pagada_parcial']).or('eliminado.is.null,eliminado.eq.false'),
    supabase.from('almacenes').select('*').eq('activo', true),
    supabase.from('a_cuenta').select('*').eq('estado', 'pendiente'),
    supabase.from('ventas').select('cantidad,precio_unitario,metodo_pago,fecha').gte('fecha', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).or('eliminado.is.null,eliminado.eq.false'),
  ])
  const deudasUrgentes = (deudas || []).filter(d => differenceInDays(new Date(), new Date(d.fecha_deuda)) >= UMBRAL_DIAS_DEUDA)
  const stockBajos = (almacenes || []).filter(a => (a.stock_actual || 0) < UMBRAL_STOCK)
  const totalVentasSemana = (ventas || []).reduce((s, v) => s + (v.cantidad * v.precio_unitario), 0)
  const totalBalonesVendidos = (ventas || []).reduce((s, v) => s + v.cantidad, 0)
  return {
    deudas: deudas || [], deudasUrgentes, almacenes: almacenes || [], stockBajos,
    acuentaPendiente: acuenta || [], totalVentasSemana, totalBalonesVendidos,
    totalDeudores: (deudas || []).length,
    totalPendiente: (deudas || []).reduce((s, d) => s + (parseFloat(d.monto_pendiente) || 0), 0),
  }
}

async function llamarClaude(mensajes, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages })
  })
  const data = await response.json()
  return data.content?.[0]?.text || 'No pude generar una respuesta.'
}

// Ícono robot SVG
function RobotIcon({ size = 24, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="9" width="10" height="9" rx="2" stroke={color} strokeWidth="1.5"/>
      <rect x="9" y="11" width="2" height="2" rx="0.5" fill={color}/>
      <rect x="13" y="11" width="2" height="2" rx="0.5" fill={color}/>
      <path d="M10 16h4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 9V6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="5" r="1.5" stroke={color} strokeWidth="1.5"/>
      <path d="M7 13H5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M19 13h-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function AsistenteFlotante() {
  const { perfil } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  // Verificar permisos
  const isAdmin = perfil?.rol === 'admin'
  const tienePermiso = isAdmin || perfil?.permisos?.asistente === true
  if (!tienePermiso) return null

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  useEffect(() => {
    if (abierto) { setBadgeCount(0); inputRef.current?.focus() }
  }, [abierto])

  const agregarMensaje = useCallback((rol, texto, tipo = 'normal') => {
    setMensajes(prev => [...prev, {
      id: Date.now() + Math.random(), rol, texto, tipo,
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    }])
    if (rol === 'ia' && !abierto) setBadgeCount(n => n + 1)
  }, [abierto])

  const ejecutarAnalisis = useCallback(async (silencioso = false) => {
    if (!silencioso) setAnalizando(true)
    try {
      const d = await recolectarDatos()
      setDatos(d)
      const systemPrompt = `Eres el asistente inteligente de Centro Gas Paucara, una distribuidora de balones de gas en Perú.
Analiza los datos del negocio y da recomendaciones concretas al dueño Jordan.
Responde en español, de forma directa y práctica. Usa emojis.
Para cada problema da 2-3 opciones concretas (A, B, C) y di cuál recomiendas.`

      const resumen = `Datos actuales:
STOCK: ${d.almacenes.map(a => `${a.nombre}: ${a.stock_actual} bal`).join(', ')}
${d.stockBajos.length > 0 ? `⚠️ STOCK BAJO: ${d.stockBajos.map(a => a.nombre).join(', ')}` : '✅ Stock OK'}
DEUDAS: ${d.deudasUrgentes.length} urgentes (+30 días)
${d.deudasUrgentes.slice(0,3).map(x => `• ${x.nombre_deudor} S/${parseFloat(x.monto_pendiente).toFixed(0)} (${differenceInDays(new Date(), new Date(x.fecha_deuda))}d)`).join('\n')}
A CUENTA: ${d.acuentaPendiente.length} pendientes
VENTAS semana: S/${d.totalVentasSemana.toFixed(0)} | ${d.totalBalonesVendidos} balones

Genera reporte proactivo con recomendaciones. Sé conciso. Al final pregunta qué hacemos.`

      const respuesta = await llamarClaude([{ role: 'user', content: resumen }], systemPrompt)
      agregarMensaje('ia', respuesta, 'analisis')

      if (d.deudasUrgentes.length > 0 || d.stockBajos.length > 0) {
        const alertas = []
        if (d.stockBajos.length > 0) alertas.push(`stock bajo en ${d.stockBajos.map(a => a.nombre).join(', ')}`)
        if (d.deudasUrgentes.length > 0) alertas.push(`${d.deudasUrgentes.length} deudas urgentes`)
        Notif.stockBajo('Asistente IA', alertas.join(' · '))
      }
    } catch { agregarMensaje('ia', '❌ Error al analizar. Intenta de nuevo.', 'error') }
    setAnalizando(false)
  }, [agregarMensaje])

  useEffect(() => {
    agregarMensaje('ia', `¡Hola ${perfil?.nombre?.split(' ')[0] || 'Jordan'}! 👋 Analizando la app...`, 'sistema')
    ejecutarAnalisis()
    const intervalo = setInterval(() => {
      agregarMensaje('ia', '🔄 Revisión automática en curso...', 'sistema')
      ejecutarAnalisis(true)
    }, INTERVALO_REVISION)
    return () => clearInterval(intervalo)
  }, [])

  const enviarMensaje = useCallback(async () => {
    const texto = input.trim()
    if (!texto || cargando) return
    agregarMensaje('usuario', texto)
    setInput('')
    setCargando(true)
    try {
      const d = datos || await recolectarDatos()
      const systemPrompt = `Eres el asistente de Centro Gas Paucara.
DATOS: Stock bajo: ${d.stockBajos.map(a => `${a.nombre}(${a.stock_actual})`).join(',')||'ninguno'}
Deudas urgentes: ${d.deudasUrgentes.length} | A cuenta pendiente: ${d.acuentaPendiente.length}
Ventas semana: S/${d.totalVentasSemana.toFixed(0)}
Responde de forma práctica. Si recomiendas opciones usa A,B,C. Usa emojis. Responde en español.`

      const historial = mensajes.filter(m => m.rol !== 'sistema').slice(-8)
        .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto }))
      historial.push({ role: 'user', content: texto })
      const respuesta = await llamarClaude(historial, systemPrompt)
      agregarMensaje('ia', respuesta)
    } catch { agregarMensaje('ia', '❌ Error al procesar.') }
    setCargando(false)
    inputRef.current?.focus()
  }, [input, cargando, mensajes, datos, agregarMensaje])

  return (
    <>
      {/* Botón flotante */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--app-accent), #6366f1)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Asistente IA"
        >
          <RobotIcon size={26}/>
          {badgeCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 18, height: 18, borderRadius: '50%',
              background: '#ef4444', color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--app-bg)'
            }}>{badgeCount}</span>
          )}
        </button>
      )}

      {/* Panel chat */}
      {abierto && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          width: 360, height: 520,
          background: 'var(--app-card-bg)',
          border: '1px solid var(--app-card-border)',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="lg:w-96"
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, var(--app-accent), #6366f1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RobotIcon size={20}/>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Asistente IA</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0 }}>● Activo · revisa cada hora</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => ejecutarAnalisis()} disabled={analizando} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '5px 8px', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                {analizando ? <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }}/> : <Zap style={{ width: 12, height: 12 }}/>}
                {analizando ? '...' : 'Analizar'}
              </button>
              <button onClick={() => setAbierto(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '5px 8px', color: '#fff' }}>
                <Minimize2 style={{ width: 14, height: 14 }}/>
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensajes.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.rol === 'usuario' ? 'flex-end' : 'flex-start', gap: 6 }}>
                {m.rol === 'ia' && (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <RobotIcon size={13}/>
                  </div>
                )}
                <div style={{
                  maxWidth: '82%', padding: m.tipo === 'sistema' ? '5px 10px' : '8px 12px',
                  borderRadius: m.rol === 'usuario' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.rol === 'usuario' ? 'var(--app-accent)' : m.tipo === 'sistema' ? 'var(--app-card-bg-alt)' : 'var(--app-card-bg)',
                  border: m.rol === 'usuario' ? 'none' : '1px solid var(--app-card-border)',
                  color: m.rol === 'usuario' ? '#fff' : 'var(--app-text)',
                }}>
                  <p style={{ fontSize: m.tipo === 'sistema' ? 11 : 12, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: m.tipo === 'sistema' ? 'var(--app-text-secondary)' : 'inherit' }}>
                    {m.texto}
                  </p>
                  <p style={{ fontSize: 9, margin: '3px 0 0', opacity: 0.5, textAlign: m.rol === 'usuario' ? 'right' : 'left' }}>{m.hora}</p>
                </div>
              </div>
            ))}
            {cargando && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RobotIcon size={13}/>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '16px 16px 16px 4px', background: 'var(--app-card-bg)', border: '1px solid var(--app-card-border)' }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--app-accent)', animation: `bounce 1s ${i*0.2}s infinite` }}/>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--app-card-border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarMensaje()} }}
              placeholder="Escribe tu mensaje..."
              rows={1}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', color: 'var(--app-input-text)', fontSize: 12, resize: 'none', outline: 'none', maxHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = 'var(--app-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--app-input-border)'}
            />
            <button
              onClick={enviarMensaje}
              disabled={!input.trim() || cargando}
              style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: input.trim()&&!cargando?'var(--app-accent)':'var(--app-card-bg-alt)', border: '1px solid var(--app-card-border)', cursor: input.trim()?'pointer':'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            >
              <Send style={{ width: 14, height: 14, color: input.trim()&&!cargando?'#fff':'var(--app-text-secondary)' }}/>
            </button>
          </div>
        </div>
      )}

      <style>{\`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @media(max-width:640px){
          .chat-flotante{width:calc(100vw - 32px)!important;right:16px!important;bottom:80px!important}
        }
      \`}</style>
    </>
  )
}
