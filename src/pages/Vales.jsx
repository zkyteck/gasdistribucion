import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { Ticket, Plus, X, AlertCircle, DollarSign, CheckCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Vales() {
  const { perfil } = useAuth()
  const [lotes, setLotes] = useState([])
  const [saldo, setSaldo] = useState({ total_vales: 0, total_retiros: 0, saldo_disponible: 0 })
  const [valesMes, setValesMes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filtroFecha, setFiltroFecha] = useState(hoyPeru())
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState({ cantidad_pequeno: '', cantidad_grande: '', fecha: hoyPeru(), notas: '' })
  const [valorVales, setValorVales] = useState({ pequeno: 20, grande: 43 })
  const [smsForm, setSmsForm] = useState({ dni: '', cupon: '', tipo: '20' })
  const [smsHistorial, setSmsHistorial] = useState([])
  const [modalSms, setModalSms] = useState(false)
  const [retiroForm, setRetiroForm] = useState({ monto: '', motivo: '', fecha: hoyPeru() })

  useEffect(() => {
    cargar()
    cargarValorVales()
    const canal = supabase.channel('vales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vales_fise' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [filtroFecha])

  async function cargarValorVales() {
    const { data } = await supabase.from('configuracion').select('*')
      .in('clave', ['valor_vale_pequeno', 'valor_vale_grande'])
    const mapa = { pequeno: 20, grande: 43 }
    data?.forEach(r => {
      if (r.clave === 'valor_vale_pequeno') mapa.pequeno = parseFloat(r.valor) || 20
      if (r.clave === 'valor_vale_grande') mapa.grande = parseFloat(r.valor) || 43
    })
    setValorVales(mapa)
  }

  async function cargar() {
    setLoading(true)
    const hoy = new Date()
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

    const [{ data: v }, { data: s }, { count: totalMes }] = await Promise.all([
      supabase.from('vales_fise').select('*').eq('lote_dia', filtroFecha).order('created_at', { ascending: false }),
      supabase.from('vista_saldo_vales').select('*').single(),
      supabase.from('vales_fise').select('*', { count: 'exact', head: true })
        .gte('lote_dia', inicioMes).lte('lote_dia', finMes).neq('estado', 'anulado')
    ])
    const valesDelDia = v || []
    // Agrupar por tipo_vale dinámicamente
    const porTipo = {}
    valesDelDia.forEach(x => {
      if (!porTipo[x.tipo_vale]) porTipo[x.tipo_vale] = { cant: 0, monto: 0 }
      porTipo[x.tipo_vale].cant++
      porTipo[x.tipo_vale].monto += parseFloat(x.monto) || 0
    })
    const totalDia = valesDelDia.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0)
    const cant20 = porTipo['20']?.cant || 0
    const cant43 = porTipo['43']?.cant || 0
    setLotes(valesDelDia.length > 0 ? [{ fecha: filtroFecha, cant20, cant43, porTipo, total: totalDia, vales: valesDelDia }] : [])
    setSaldo(s || { total_vales: 0, total_retiros: 0, saldo_disponible: 0 })
    setValesMes(totalMes || 0)
    setLoading(false)
    setReloadKey(k => k + 1)
  }

  async function guardarLote() {
    const cp = parseInt(form.cantidad_pequeno) || 0
    const cg = parseInt(form.cantidad_grande) || 0
    if (!cp && !cg) { setError('Ingresa al menos una cantidad'); return }
    setSaving(true); setError('')
    const inserts = []
    for (let i = 0; i < cp; i++) inserts.push({ tipo_vale: String(valorVales.pequeno), monto: valorVales.pequeno, fecha_recepcion: form.fecha, lote_dia: form.fecha, estado: 'pendiente', notas: form.notas, usuario_id: perfil?.id || null })
    for (let i = 0; i < cg; i++) inserts.push({ tipo_vale: String(valorVales.grande), monto: valorVales.grande, fecha_recepcion: form.fecha, lote_dia: form.fecha, estado: 'pendiente', notas: form.notas, usuario_id: perfil?.id || null })
    const { error: e } = await supabase.from('vales_fise').insert(inserts)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null)
    setFiltroFecha(form.fecha)
    cargar()
  }

  async function guardarRetiro() {
    if (!retiroForm.monto || !retiroForm.motivo) { setError('Completa todos los campos'); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('retiros_vales').insert({
      fecha: retiroForm.fecha, monto: parseFloat(retiroForm.monto),
      motivo: retiroForm.motivo, usuario_id: perfil?.id || null
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); setRetiroForm({ monto: '', motivo: '', fecha: hoyPeru() }); cargar()
  }

  function enviarSmsFise() {
    if (!smsForm.dni || !smsForm.cupon) return
    const mensaje = `Fise ah01 ${smsForm.dni} ${smsForm.cupon}`
    const url = `sms:58996?body=${encodeURIComponent(mensaje)}`
    // Guardar en historial local
    const nuevo = { id: Date.now(), dni: smsForm.dni, cupon: smsForm.cupon, tipo: smsForm.tipo, fecha: hoyPeru(), hora: new Date().toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'}), estado: 'enviado' }
    setSmsHistorial(h => [nuevo, ...h])
    setSmsForm({ dni: '', cupon: '', tipo: '20' })
    window.open(url, '_blank')
  }

  function consultarSaldo() {
    window.open('sms:58996?body=saldo%20ah01', '_blank')
  }

  function marcarEstadoSms(id, estado) {
    setSmsHistorial(h => h.map(x => x.id === id ? {...x, estado} : x))
  }

  async function eliminarValesPorTipo(tipo) {
    const cant = tipo === '20' ? cant20 : cant43
    if (!cant) return
    if (!confirm(`¿Eliminar ${cant} vale(s) de S/${tipo} del ${filtroFecha}?`)) return
    const { data: ids, error: fetchErr } = await supabase
      .from('vales_fise')
      .select('id')
      .eq('lote_dia', filtroFecha)
      .eq('tipo_vale', tipo)
    if (fetchErr) { alert('Error: ' + fetchErr.message); return }
    if (!ids || ids.length === 0) { alert('No se encontraron vales para borrar'); cargar(); return }
    const { error: delErr } = await supabase
      .from('vales_fise')
      .delete()
      .in('id', ids.map(x => x.id))
    if (delErr) { alert('Error al borrar: ' + delErr.message); return }
    cargar()
  }

  const lote = lotes[0]
  const cant20 = lote?.cant20 || 0
  const cant43 = lote?.cant43 || 0
  const totalDia = lote?.total || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Vales FISE</h2>
          <p className="text-gray-500 text-sm">Control de vales S/20 y S/43</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={consultarSaldo}
            className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-400 text-sm font-medium px-3 py-2 rounded-xl transition-all flex items-center gap-2">
            💰 Consultar saldo FISE
          </button>
          <button onClick={() => setModalSms(true)}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 text-sm font-medium px-3 py-2 rounded-xl transition-all flex items-center gap-2">
            📱 Procesar vale FISE
          </button>
          <button onClick={() => { setRetiroForm({ monto: '', motivo: '', fecha: hoyPeru() }); setError(''); setModal('retiro') }} className="btn-secondary">
            <DollarSign className="w-4 h-4" />Registrar retiro
          </button>
          <button onClick={() => { setForm({ cantidad_pequeno: '', cantidad_grande: '', fecha: filtroFecha, notas: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
            <Plus className="w-4 h-4" />Registrar vales
          </button>
        </div>
      </div>

      {/* Saldo del fondo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card border border-yellow-500/20">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center"><Ticket className="w-4 h-4 text-yellow-400" /></div>
          <p className="text-2xl font-bold text-yellow-400">S/ {Number(saldo.total_vales).toLocaleString('es-PE')}</p>
          <p className="text-xs text-gray-500">Fondo FISE acumulado</p>
        </div>
        <div className="stat-card border border-red-500/20">
          <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-red-400" /></div>
          <p className="text-2xl font-bold text-red-400">S/ {Number(saldo.total_retiros).toLocaleString('es-PE')}</p>
          <p className="text-xs text-gray-500">Total retirado</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><CheckCircle className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-emerald-400">S/ {Number(saldo.saldo_disponible).toLocaleString('es-PE')}</p>
          <p className="text-xs text-gray-500">Saldo disponible</p>
        </div>
        <div className="stat-card border border-indigo-500/20">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center"><Ticket className="w-4 h-4 text-indigo-400" /></div>
          <p className="text-2xl font-bold text-indigo-400">{valesMes}</p>
          <p className="text-xs text-gray-500">Vales este mes</p>
        </div>
      </div>

      {/* Selector de fecha */}
      <div className="flex items-center gap-3">
        <label className="text-gray-400 text-sm">Ver día:</label>
        <input type="date" className="input w-auto" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
        <button onClick={cargar} className="btn-secondary py-1.5"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {/* Resumen del día */}
      {loading ? (
        <div className="card flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div>
      ) : (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">
            Vales procesados — {format(new Date(filtroFecha + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: es })}
          </h3>

          {!lote ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-600 gap-2">
              <Ticket className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin vales registrados este día</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tarjetas por tipo — dinámicas */}
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(lote.porTipo || {}).map(([tipo, data]) => {
                  const colors = tipo === '20' ? 'yellow' : tipo === '43' ? 'orange' : 'blue'
                  const colorMap = {
                    yellow: { bg: 'bg-yellow-900/20', border: 'border-yellow-800/40', text: 'text-yellow-400', sub: 'text-yellow-300' },
                    orange: { bg: 'bg-orange-900/20', border: 'border-orange-800/40', text: 'text-orange-400', sub: 'text-orange-300' },
                    blue: { bg: 'bg-blue-900/20', border: 'border-blue-800/40', text: 'text-blue-400', sub: 'text-blue-300' },
                  }
                  const c = colorMap[colors]
                  return (
                    <div key={tipo} className={`${c.bg} border ${c.border} rounded-xl p-5 text-center relative`}>
                      <button onClick={() => eliminarValesPorTipo(tipo)}
                        className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                      <p className={`${c.text} font-bold text-lg mb-1`}>S/ {tipo}</p>
                      <p className={`text-5xl font-bold ${c.text}`}>{data.cant}</p>
                      <p className="text-gray-500 text-xs mt-2">vales procesados</p>
                      <p className={`${c.sub} font-bold text-sm mt-1`}>= S/ {data.monto.toFixed(0)}</p>
                    </div>
                  )
                })}
              </div>

              {/* Total del día */}
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total del día</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lote.vales?.length || 0} vales · {Object.entries(lote.porTipo || {}).map(([t, d]) => `${d.cant} de S/${t}`).join(' + ')}
                  </p>
                </div>
                <p className="text-3xl font-bold text-emerald-400">S/ {totalDia.toFixed(0)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial SMS FISE enviados */}
      {smsHistorial.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">📱 Vales FISE enviados por SMS (esta sesión)</h3>
            <span className="text-xs text-gray-500">{smsHistorial.length} enviados</span>
          </div>
          <div className="divide-y divide-gray-800/50">
            {smsHistorial.map(s => (
              <div key={s.id} className="flex items-center justify-between px-6 py-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.estado === 'procesado' ? 'bg-emerald-400' : s.estado === 'rechazado' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <div>
                    <p className="text-white text-sm font-medium">DNI: {s.dni} · Cupón: {s.cupon}</p>
                    <p className="text-gray-500 text-xs">{s.fecha} {s.hora} · Vale S/{s.tipo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.estado === 'enviado' ? (
                    <>
                      <span className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-700/40 px-2 py-1 rounded-lg">⏳ Esperando</span>
                      <button onClick={() => marcarEstadoSms(s.id, 'procesado')}
                        className="text-xs bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-600/30 transition-all">
                        ✅ Procesado
                      </button>
                      <button onClick={() => marcarEstadoSms(s.id, 'rechazado')}
                        className="text-xs bg-red-600/20 border border-red-600/40 text-red-400 px-2 py-1 rounded-lg hover:bg-red-600/30 transition-all">
                        ❌ Rechazado
                      </button>
                    </>
                  ) : s.estado === 'procesado' ? (
                    <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-1 rounded-lg">✅ Procesado</span>
                  ) : (
                    <span className="text-xs text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-1 rounded-lg">❌ Rechazado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de días */}
      <HistorialVales key={reloadKey} filtroFecha={filtroFecha} onFechaClick={cargar} />

      {/* Modal registrar vales */}
      {modal === 'nuevo' && (
        <Modal title="🎫 Registrar vales del día" onClose={() => setModal(null)}>
          <div className="space-y-5">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))} />
            </div>

            <div>
              <label className="label mb-3">Cantidad de vales procesados</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 text-center">
                  <p className="text-yellow-400 font-bold text-lg mb-1">🎫 S/ {valorVales.pequeno}</p>
                  <p className="text-gray-500 text-xs mb-3">Vale pequeño</p>
                  <input type="number" min="0" className="input text-center text-2xl font-bold py-3"
                    value={form.cantidad_pequeno} placeholder="0"
                    onChange={e => setForm(f => ({...f, cantidad_pequeno: e.target.value}))} />
                  {parseInt(form.cantidad_pequeno) > 0 && (
                    <p className="text-yellow-400 font-semibold text-sm mt-2">= S/ {parseInt(form.cantidad_pequeno) * valorVales.pequeno}</p>
                  )}
                </div>
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-4 text-center">
                  <p className="text-orange-400 font-bold text-lg mb-1">🎫 S/ {valorVales.grande}</p>
                  <p className="text-gray-500 text-xs mb-3">Vale grande</p>
                  <input type="number" min="0" className="input text-center text-2xl font-bold py-3"
                    value={form.cantidad_grande} placeholder="0"
                    onChange={e => setForm(f => ({...f, cantidad_grande: e.target.value}))} />
                  {parseInt(form.cantidad_grande) > 0 && (
                    <p className="text-orange-400 font-semibold text-sm mt-2">= S/ {parseInt(form.cantidad_grande) * valorVales.grande}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">💡 Para cambiar el valor del vale ve a Configuración → Vales FISE</p>
            </div>

            {(parseInt(form.cantidad_pequeno) > 0 || parseInt(form.cantidad_grande) > 0) && (
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Total a registrar:</span>
                <span className="text-emerald-400 font-bold text-xl">
                  S/ {((parseInt(form.cantidad_pequeno)||0) * valorVales.pequeno + (parseInt(form.cantidad_grande)||0) * valorVales.grande).toFixed(0)}
                </span>
              </div>
            )}

            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" placeholder="Observaciones..." value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarLote} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Registrar vales'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal procesar vale FISE por SMS */}
      {modalSms && (
        <Modal title="📱 Procesar vale FISE por SMS" onClose={() => setModalSms(false)}>
          <div className="space-y-5">
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-gray-400">
              <p className="text-blue-300 font-medium mb-1">¿Cómo funciona?</p>
              <p>1. Ingresa el DNI y cupón del cliente</p>
              <p className="mt-1">2. Presiona <strong className="text-white">"Enviar SMS"</strong> — abrirá tu celular con el mensaje listo</p>
              <p className="mt-1">3. Envía el SMS al <strong className="text-white">58996</strong></p>
              <p className="mt-1">4. Cuando recibas la respuesta, marca como ✅ Procesado o ❌ Rechazado</p>
            </div>

            <div>
              <label className="label">DNI del cliente</label>
              <input type="number" className="input text-lg font-mono" placeholder="Ej: 23219038"
                value={smsForm.dni} onChange={e => setSmsForm(f => ({...f, dni: e.target.value}))}
                maxLength={8} />
            </div>

            <div>
              <label className="label">Número de cupón FISE</label>
              <input type="text" className="input text-lg font-mono" placeholder="Ej: 0802267980430"
                value={smsForm.cupon} onChange={e => setSmsForm(f => ({...f, cupon: e.target.value}))} />
            </div>

            <div>
              <label className="label">Tipo de vale</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSmsForm(f => ({...f, tipo: '20'}))}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all ${smsForm.tipo === '20' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 20
                </button>
                <button onClick={() => setSmsForm(f => ({...f, tipo: '43'}))}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all ${smsForm.tipo === '43' ? 'bg-orange-900/30 border-orange-500 text-orange-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 43
                </button>
              </div>
            </div>

            {smsForm.dni && smsForm.cupon && (
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Mensaje que se enviará al 58996:</p>
                <p className="text-white font-mono text-sm bg-gray-900 rounded-lg px-3 py-2">
                  Fise ah01 {smsForm.dni} {smsForm.cupon}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalSms(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => { enviarSmsFise(); setModalSms(false) }}
                disabled={!smsForm.dni || !smsForm.cupon}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2">
                📱 Enviar SMS al 58996
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal retiro */}
      {modal === 'retiro' && (
        <Modal title="Registrar retiro del fondo FISE" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 text-sm">
              <span className="text-gray-400">Saldo disponible: </span>
              <span className="text-emerald-400 font-bold">S/ {Number(saldo.saldo_disponible).toLocaleString('es-PE')}</span>
            </div>
            <div><label className="label">Monto a retirar (S/)</label><input type="number" className="input" placeholder="500" value={retiroForm.monto} onChange={e => setRetiroForm(f => ({...f, monto: e.target.value}))} /></div>
            <div><label className="label">Motivo del retiro</label><textarea className="input" rows={2} placeholder="Ej: Compra de balones al proveedor" value={retiroForm.motivo} onChange={e => setRetiroForm(f => ({...f, motivo: e.target.value}))} /></div>
            <div><label className="label">Fecha</label><input type="date" className="input" value={retiroForm.fecha} onChange={e => setRetiroForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarRetiro} disabled={saving} className="btn-danger flex-1 justify-center">{saving ? 'Guardando...' : 'Registrar retiro'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function HistorialVales({ filtroFecha, onFechaClick }) {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [editDia, setEditDia] = useState(null)
  const [editForm, setEditForm] = useState({ cant20: '', cant43: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargarHistorial() }, [filtroFecha])

  async function cargarHistorial() {
    setLoading(true)
    // Traer datos raw para agrupar con todos los tipos de vale
    const { data: raw } = await supabase
      .from('vales_fise')
      .select('lote_dia, tipo_vale, monto')
      .neq('estado', 'anulado')
      .order('lote_dia', { ascending: false })

    if (raw) {
      const porDia = {}
      raw.forEach(v => {
        if (!porDia[v.lote_dia]) porDia[v.lote_dia] = { porTipo: {}, total: 0 }
        if (!porDia[v.lote_dia].porTipo[v.tipo_vale]) porDia[v.lote_dia].porTipo[v.tipo_vale] = { cant: 0, monto: 0 }
        porDia[v.lote_dia].porTipo[v.tipo_vale].cant++
        porDia[v.lote_dia].porTipo[v.tipo_vale].monto += parseFloat(v.monto) || 0
        porDia[v.lote_dia].total += parseFloat(v.monto) || 0
      })
      setHistorial(Object.entries(porDia).slice(0, 30).map(([fecha, d]) => ({
        fecha,
        cant20: d.porTipo['20']?.cant || 0,
        cant43: d.porTipo['43']?.cant || 0,
        porTipo: d.porTipo,
        total: d.total
      })))
    }
    setLoading(false)
  }

  async function eliminarDia(fecha) {
    if (!confirm(`¿Eliminar TODOS los vales del ${fecha}?`)) return
    const { data: ids } = await supabase.from('vales_fise').select('id').eq('lote_dia', fecha)
    if (ids && ids.length > 0) {
      const { error } = await supabase.from('vales_fise').delete().in('id', ids.map(x => x.id))
      if (error) { alert('Error: ' + error.message); return }
    }
    setHistorial(h => h.filter(x => x.fecha !== fecha))
    if (onFechaClick) onFechaClick()
  }

  async function guardarEdicion() {
    if (!editDia) return
    setSaving(true)
    await supabase.from('vales_fise').delete().eq('lote_dia', editDia.fecha)
    const inserts = []
    for (let i = 0; i < (parseInt(editForm.cant20)||0); i++)
      inserts.push({ tipo_vale: '20', monto: 20, fecha_recepcion: editDia.fecha, lote_dia: editDia.fecha, estado: 'pendiente' })
    for (let i = 0; i < (parseInt(editForm.cant43)||0); i++)
      inserts.push({ tipo_vale: '43', monto: 43, fecha_recepcion: editDia.fecha, lote_dia: editDia.fecha, estado: 'pendiente' })
    if (inserts.length > 0) await supabase.from('vales_fise').insert(inserts)
    setSaving(false)
    setEditDia(null)
    if (onFechaClick) onFechaClick()
    cargarHistorial()
  }

  if (loading || historial.length === 0) return null

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Historial de días</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800">
            {['Fecha','Detalle vales','Total vales','Monto total',''].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-800/50">
            {historial.map(d => (
              <tr key={d.fecha} className="table-row-hover">
                <td className="px-5 py-3 text-white text-sm font-medium">
                  {format(new Date(d.fecha + 'T12:00:00'), "dd/MM/yyyy", { locale: es })}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    {d.porTipo ? Object.entries(d.porTipo).map(([tipo, data]) => (
                      <span key={tipo} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-white font-bold">{data.cant}</span>
                        <span className="text-gray-500 ml-1">× S/{tipo}</span>
                      </span>
                    )) : (
                      <>
                        {d.cant20 > 0 && <span className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"><span className="text-yellow-400 font-bold">{d.cant20}</span><span className="text-gray-500 ml-1">× S/20</span></span>}
                        {d.cant43 > 0 && <span className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"><span className="text-orange-400 font-bold">{d.cant43}</span><span className="text-gray-500 ml-1">× S/43</span></span>}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-300 text-sm">
                  {d.porTipo ? Object.values(d.porTipo).reduce((s, x) => s + x.cant, 0) : d.cant20 + d.cant43} vales
                </td>
                <td className="px-5 py-3 text-emerald-400 font-bold">S/ {typeof d.total === 'number' ? d.total.toFixed(0) : d.total}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditDia(d); setEditForm({ cant20: d.cant20, cant43: d.cant43 }) }}
                      className="text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 px-2 py-1 rounded-lg transition-all">
                      ✏️ Editar
                    </button>
                    <button onClick={() => eliminarDia(d.fecha)}
                      className="text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 px-2 py-1 rounded-lg transition-all">
                      🗑️ Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editDia && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold text-sm">✏️ Editar vales — {format(new Date(editDia.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</h3>
              <button onClick={() => setEditDia(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 text-center">
                  <p className="text-yellow-400 font-bold mb-2">S/ 20</p>
                  <input type="number" min="0" className="input text-center text-2xl font-bold py-2"
                    value={editForm.cant20} onChange={e => setEditForm(f => ({...f, cant20: e.target.value}))} />
                  <p className="text-gray-500 text-xs mt-1">vales</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-4 text-center">
                  <p className="text-orange-400 font-bold mb-2">S/ 43</p>
                  <input type="number" min="0" className="input text-center text-2xl font-bold py-2"
                    value={editForm.cant43} onChange={e => setEditForm(f => ({...f, cant43: e.target.value}))} />
                  <p className="text-gray-500 text-xs mt-1">vales</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditDia(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={guardarEdicion} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
