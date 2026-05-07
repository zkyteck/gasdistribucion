// src/pages/Asistente.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { differenceInDays } from 'date-fns'
import { Send, Bot, RefreshCw, Zap } from 'lucide-react'
import { Notif } from '../lib/notificaciones'

const UMBRAL_STOCK = 10
const UMBRAL_DIAS_DEUDA = 30
const INTERVALO_REVISION = 60 * 60 * 1000 // 1 hora

// ─── Recolectar datos de la app ───────────────────────────────────────────────
async function recolectarDatos() {
  const [
    { data: deudas },
    { data: almacenes },
    { data: acuenta },
    { data: ventas },
  ] = await Promise.all([
    supabase.from('deudas').select('*').in('estado', ['activa', 'pagada_parcial']).or('eliminado.is.null,eliminado.eq.false'),
    supabase.from('almacenes').select('*').eq('activo', true),
    supabase.from('a_cuenta').select('*').eq('estado', 'pendiente'),
    supabase.from('ventas').select('cantidad,precio_unitario,metodo_pago,fecha').gte('fecha', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).or('eliminado.is.null,eliminado.eq.false'),
  ])

  const deudasUrgentes = (deudas || []).filter(d =>
    differenceInDays(new Date(), new Date(d.fecha_deuda)) >= UMBRAL_DIAS_DEUDA
  )
  const stockBajos = (almacenes || []).filter(a => (a.stock_actual || 0) < UMBRAL_STOCK)
  const acuentaPendiente = acuenta || []
  const totalVentasSemana = (ventas || []).reduce((s, v) => s + (v.cantidad * v.precio_unitario), 0)
  const totalBalonesVendidos = (ventas || []).reduce((s, v) => s + v.cantidad, 0)

  return {
    deudas: deudas || [],
    deudasUrgentes,
    almacenes: almacenes || [],
    stockBajos,
    acuentaPendiente,
    totalVentasSemana,
    totalBalonesVendidos,
    totalDeudores: (deudas || []).length,
    totalPendiente: (deudas || []).reduce((s, d) => s + (parseFloat(d.monto_pendiente) || 0), 0),
  }
}

// ─── Llamar a Claude API ──────────────────────────────────────────────────────
async function llamarClaude(mensajes, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    })
  })
  const data = await response.json()
  return data.content?.[0]?.text || 'No pude generar una respuesta.'
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Asistente() {
  const { perfil } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [datos, setDatos] = useState(null)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll automático al fondo
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensajes])

  const agregarMensaje = useCallback((rol, texto, tipo = 'normal') => {
    setMensajes(prev => [...prev, {
      id: Date.now() + Math.random(),
      rol,
      texto,
      tipo,
      hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    }])
  }, [])

  // ─── Análisis proactivo ───────────────────────────────────────────────────
  const ejecutarAnalisis = useCallback(async (silencioso = false) => {
    if (!silencioso) setAnalizando(true)
    try {
      const d = await recolectarDatos()
      setDatos(d)

      const systemPrompt = `Eres el asistente inteligente de Centro Gas Paucara, una distribuidora de balones de gas en Perú.
Tu trabajo es analizar los datos del negocio y dar recomendaciones concretas y útiles al dueño (Jordan).
Siempre respondes en español, de forma directa y práctica.
Cuando detectas problemas, das 2-3 opciones concretas de qué hacer.
Usas emojis para hacer el mensaje más fácil de leer.
Eres proactivo — si ves algo importante, lo dices aunque no te pregunten.`

      const resumen = `Aquí están los datos actuales del negocio:

STOCK:
${d.almacenes.map(a => `- ${a.nombre}: ${a.stock_actual} balones`).join('\n')}
${d.stockBajos.length > 0 ? `⚠️ STOCK BAJO en: ${d.stockBajos.map(a => a.nombre).join(', ')}` : '✅ Stock normal'}

DEUDAS:
- Total deudores activos: ${d.totalDeudores}
- Total pendiente por cobrar: S/${d.totalPendiente.toLocaleString('es-PE')}
- Deudas urgentes (+30 días): ${d.deudasUrgentes.length}
${d.deudasUrgentes.slice(0, 5).map(d2 => `  • ${d2.nombre_deudor} — S/${parseFloat(d2.monto_pendiente).toFixed(0)} (${differenceInDays(new Date(), new Date(d2.fecha_deuda))} días)`).join('\n')}

A CUENTA PENDIENTE:
- ${d.acuentaPendiente.length} clientes con a cuenta sin recoger
${d.acuentaPendiente.slice(0, 3).map(a => `  • ${a.nombre_cliente}`).join('\n')}

VENTAS (últimos 7 días):
- Total: S/${d.totalVentasSemana.toLocaleString('es-PE')}
- Balones vendidos: ${d.totalBalonesVendidos}

Analiza esta situación y genera un reporte proactivo. Para cada problema encontrado:
1. Explica qué es el problema
2. Da 2-3 opciones concretas de qué hacer (con letras A, B, C)
3. Di cuál recomiendas y por qué

Al final pregunta: "¿Qué hacemos con cada punto?"`

      const respuesta = await llamarClaude(
        [{ role: 'user', content: resumen }],
        systemPrompt
      )

      agregarMensaje('ia', respuesta, 'analisis')

      // Enviar notificación push si hay alertas urgentes
      if (d.deudasUrgentes.length > 0 || d.stockBajos.length > 0) {
        const alertas = []
        if (d.deudasUrgentes.length > 0) alertas.push(`${d.deudasUrgentes.length} deudas urgentes`)
        if (d.stockBajos.length > 0) alertas.push(`stock bajo en ${d.stockBajos.map(a => a.nombre).join(', ')}`)
        Notif.stockBajo('Asistente IA', alertas.join(' · '))
      }
    } catch (err) {
      agregarMensaje('ia', '❌ Error al analizar los datos. Intenta de nuevo.', 'error')
    }
    setAnalizando(false)
  }, [agregarMensaje])

  // Análisis inicial y cada hora
  useEffect(() => {
    // Mensaje de bienvenida
    agregarMensaje('ia', `¡Hola ${perfil?.nombre?.split(' ')[0] || 'Jordan'}! 👋 Soy tu asistente de Centro Gas. Estoy revisando la app ahora mismo...`, 'normal')
    ejecutarAnalisis()

    const intervalo = setInterval(() => {
      agregarMensaje('ia', '🔄 Revisando la app automáticamente...', 'sistema')
      ejecutarAnalisis(true)
    }, INTERVALO_REVISION)

    return () => clearInterval(intervalo)
  }, [])

  // ─── Enviar mensaje del usuario ───────────────────────────────────────────
  const enviarMensaje = useCallback(async () => {
    const texto = input.trim()
    if (!texto || cargando) return

    agregarMensaje('usuario', texto)
    setInput('')
    setCargando(true)

    try {
      // Recolectar datos frescos para contexto
      const d = datos || await recolectarDatos()

      const systemPrompt = `Eres el asistente inteligente de Centro Gas Paucara.
Tienes acceso a los datos del negocio y puedes ayudar a tomar decisiones.

DATOS ACTUALES:
- Stock bajo: ${d.stockBajos.map(a => `${a.nombre}(${a.stock_actual}bal)`).join(', ') || 'ninguno'}
- Deudas urgentes: ${d.deudasUrgentes.length} clientes
- Deudores principales: ${d.deudasUrgentes.slice(0,3).map(x => `${x.nombre_deudor}(S/${parseFloat(x.monto_pendiente).toFixed(0)})`).join(', ')}
- A cuenta pendiente: ${d.acuentaPendiente.length} clientes
- Ventas semana: S/${d.totalVentasSemana.toFixed(0)}

Responde de forma práctica y directa. Si el usuario confirma una acción, confirma que la ejecutarías (pero aclara que algunas acciones deben hacerse manualmente en la app por ahora).
Si recomiendas opciones, usa A, B, C.
Usa emojis para claridad.
Responde siempre en español.`

      // Construir historial de conversación (últimos 10 mensajes)
      const historial = mensajes
        .filter(m => m.rol !== 'sistema')
        .slice(-10)
        .map(m => ({
          role: m.rol === 'usuario' ? 'user' : 'assistant',
          content: m.texto
        }))

      historial.push({ role: 'user', content: texto })

      const respuesta = await llamarClaude(historial, systemPrompt)
      agregarMensaje('ia', respuesta)
    } catch (err) {
      agregarMensaje('ia', '❌ Error al procesar tu mensaje. Intenta de nuevo.')
    }

    setCargando(false)
    inputRef.current?.focus()
  }, [input, cargando, mensajes, datos, agregarMensaje])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxHeight: 700 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text)', margin: 0 }}>Asistente IA</p>
            <p style={{ fontSize: 11, color: '#22c55e', margin: 0 }}>● Activo · revisa cada hora</p>
          </div>
        </div>
        <button
          onClick={() => ejecutarAnalisis()}
          disabled={analizando}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--app-card-bg-alt)', border: '1px solid var(--app-card-border)', color: 'var(--app-text-secondary)', cursor: 'pointer' }}
        >
          {analizando
            ? <><RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Analizando...</>
            : <><Zap style={{ width: 13, height: 13 }} /> Analizar ahora</>
          }
        </button>
      </div>

      {/* Chat */}
      <div
        ref={chatRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}
      >
        {mensajes.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.rol === 'usuario' ? 'flex-end' : 'flex-start', gap: 8 }}>

            {/* Avatar IA */}
            {m.rol === 'ia' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Bot style={{ width: 14, height: 14, color: '#fff' }} />
              </div>
            )}

            {/* Burbuja */}
            <div style={{
              maxWidth: '80%',
              padding: m.tipo === 'sistema' ? '6px 12px' : '10px 14px',
              borderRadius: m.rol === 'usuario' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.rol === 'usuario'
                ? 'var(--app-accent)'
                : m.tipo === 'sistema'
                  ? 'var(--app-card-bg-alt)'
                  : 'var(--app-card-bg)',
              border: m.rol === 'usuario' ? 'none' : '1px solid var(--app-card-border)',
              color: m.rol === 'usuario' ? '#fff' : 'var(--app-text)',
            }}>
              <p style={{
                fontSize: m.tipo === 'sistema' ? 11 : 13,
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: m.tipo === 'sistema' ? 'var(--app-text-secondary)' : 'inherit'
              }}>
                {m.texto}
              </p>
              <p style={{ fontSize: 10, margin: '4px 0 0', opacity: 0.6, textAlign: m.rol === 'usuario' ? 'right' : 'left' }}>
                {m.hora}
              </p>
            </div>
          </div>
        ))}

        {/* Indicador cargando */}
        {cargando && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--app-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot style={{ width: 14, height: 14, color: '#fff' }} />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: 'var(--app-card-bg)', border: '1px solid var(--app-card-border)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--app-accent)', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu mensaje... (Enter para enviar)"
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)',
            color: 'var(--app-input-text)', fontSize: 13, resize: 'none',
            outline: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
            fontFamily: 'inherit'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--app-accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--app-input-border)'}
        />
        <button
          onClick={enviarMensaje}
          disabled={!input.trim() || cargando}
          style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: input.trim() && !cargando ? 'var(--app-accent)' : 'var(--app-card-bg-alt)',
            border: '1px solid var(--app-card-border)', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s'
          }}
        >
          <Send style={{ width: 16, height: 16, color: input.trim() && !cargando ? '#fff' : 'var(--app-text-secondary)' }} />
        </button>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
