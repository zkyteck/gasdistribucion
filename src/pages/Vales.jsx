import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0])
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState({ cantidad_20: '', cantidad_43: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
  const [retiroForm, setRetiroForm] = useState({ monto: '', motivo: '', fecha: new Date().toISOString().split('T')[0] })

  useEffect(() => { cargar() }, [filtroFecha])

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
    const v20 = valesDelDia.filter(x => x.tipo_vale === '20')
    const v43 = valesDelDia.filter(x => x.tipo_vale === '43')
    setLotes(valesDelDia.length > 0 ? [{ fecha: filtroFecha, cant20: v20.length, cant43: v43.length, total: v20.length * 20 + v43.length * 43, vales: valesDelDia }] : [])
    setSaldo(s || { total_vales: 0, total_retiros: 0, saldo_disponible: 0 })
    setValesMes(totalMes || 0)
    setLoading(false)
    setReloadKey(k => k + 1)
  }

  async function guardarLote() {
    const c20 = parseInt(form.cantidad_20) || 0
    const c43 = parseInt(form.cantidad_43) || 0
    if (!c20 && !c43) { setError('Ingresa al menos una cantidad'); return }
    setSaving(true); setError('')

    const inserts = []
    for (let i = 0; i < c20; i++) inserts.push({ tipo_vale: '20', monto: 20, fecha_recepcion: form.fecha, lote_dia: form.fecha, estado: 'pendiente', notas: form.notas, usuario_id: perfil?.id || null })
    for (let i = 0; i < c43; i++) inserts.push({ tipo_vale: '43', monto: 43, fecha_recepcion: form.fecha, lote_dia: form.fecha, estado: 'pendiente', notas: form.notas, usuario_id: perfil?.id || null })

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
    setModal(null); setRetiroForm({ monto: '', motivo: '', fecha: new Date().toISOString().split('T')[0] }); cargar()
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
        <div className="flex gap-2">
          <button onClick={() => { setRetiroForm({ monto: '', motivo: '', fecha: new Date().toISOString().split('T')[0] }); setError(''); setModal('retiro') }} className="btn-secondary">
            <DollarSign className="w-4 h-4" />Registrar retiro
          </button>
          <button onClick={() => { setForm({ cantidad_20: '', cantidad_43: '', fecha: filtroFecha, notas: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
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
              {/* Tarjetas por tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-5 text-center relative">
                  {cant20 > 0 && (
                    <button onClick={() => eliminarValesPorTipo('20')}
                      className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900/20"
                      title="Eliminar vales S/20 de este día">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                  <p className="text-yellow-400 font-bold text-lg mb-1">S/ 20</p>
                  <p className="text-5xl font-bold text-yellow-400">{cant20}</p>
                  <p className="text-gray-500 text-xs mt-2">vales procesados</p>
                  <p className="text-yellow-300 font-bold text-sm mt-1">= S/ {cant20 * 20}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-5 text-center relative">
                  {cant43 > 0 && (
                    <button onClick={() => eliminarValesPorTipo('43')}
                      className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900/20"
                      title="Eliminar vales S/43 de este día">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                  <p className="text-orange-400 font-bold text-lg mb-1">S/ 43</p>
                  <p className="text-5xl font-bold text-orange-400">{cant43}</p>
                  <p className="text-gray-500 text-xs mt-2">vales procesados</p>
                  <p className="text-orange-300 font-bold text-sm mt-1">= S/ {cant43 * 43}</p>
                </div>
              </div>

              {/* Total del día */}
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total del día</p>
                  <p className="text-xs text-gray-500 mt-0.5">{cant20 + cant43} vales · {cant20} de S/20 + {cant43} de S/43</p>
                </div>
                <p className="text-3xl font-bold text-emerald-400">S/ {totalDia}</p>
              </div>
            </div>
          )}
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
                  <p className="text-yellow-400 font-bold text-lg mb-3">🎫 S/ 20</p>
                  <input type="number" min="0" className="input text-center text-2xl font-bold py-3"
                    value={form.cantidad_20} placeholder="0"
                    onChange={e => setForm(f => ({...f, cantidad_20: e.target.value}))} />
                  <p className="text-gray-500 text-xs mt-2">vales</p>
                  {parseInt(form.cantidad_20) > 0 && (
                    <p className="text-yellow-400 font-semibold text-sm mt-1">= S/ {parseInt(form.cantidad_20) * 20}</p>
                  )}
                </div>
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-4 text-center">
                  <p className="text-orange-400 font-bold text-lg mb-3">🎫 S/ 43</p>
                  <input type="number" min="0" className="input text-center text-2xl font-bold py-3"
                    value={form.cantidad_43} placeholder="0"
                    onChange={e => setForm(f => ({...f, cantidad_43: e.target.value}))} />
                  <p className="text-gray-500 text-xs mt-2">vales</p>
                  {parseInt(form.cantidad_43) > 0 && (
                    <p className="text-orange-400 font-semibold text-sm mt-1">= S/ {parseInt(form.cantidad_43) * 43}</p>
                  )}
                </div>
              </div>
            </div>

            {(parseInt(form.cantidad_20) > 0 || parseInt(form.cantidad_43) > 0) && (
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Total a registrar:</span>
                <span className="text-emerald-400 font-bold text-xl">
                  S/ {(parseInt(form.cantidad_20)||0)*20 + (parseInt(form.cantidad_43)||0)*43}
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
    // ✅ FIX: usar vista agrupada en lugar de traer filas individuales
    const { data, error } = await supabase
      .from('vista_historial_vales')
      .select('*')
      .order('lote_dia', { ascending: false })
      .limit(14)

    if (error || !data) {
      // Fallback: si la vista no existe aún, traer sin límite y agrupar en JS
      const { data: raw } = await supabase
        .from('vales_fise')
        .select('lote_dia, tipo_vale')
        .order('lote_dia', { ascending: false })
      if (raw) {
        const porDia = {}
        raw.forEach(v => {
          if (!porDia[v.lote_dia]) porDia[v.lote_dia] = { cant20: 0, cant43: 0 }
          if (v.tipo_vale === '20') porDia[v.lote_dia].cant20++
          else porDia[v.lote_dia].cant43++
        })
        setHistorial(Object.entries(porDia).slice(0, 14).map(([fecha, d]) => ({
          fecha, cant20: d.cant20, cant43: d.cant43,
          total: d.cant20 * 20 + d.cant43 * 43
        })))
      }
      setLoading(false)
      return
    }

    setHistorial(data.map(d => ({
      fecha: d.lote_dia,
      cant20: d.cant20,
      cant43: d.cant43,
      total: d.cant20 * 20 + d.cant43 * 43
    })))
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
            {['Fecha','Vales S/20','Vales S/43','Total vales','Monto total',''].map(h => (
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
                  <span className="text-yellow-400 font-bold text-lg">{d.cant20}</span>
                  <span className="text-gray-600 text-xs ml-1">× S/20</span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-orange-400 font-bold text-lg">{d.cant43}</span>
                  <span className="text-gray-600 text-xs ml-1">× S/43</span>
                </td>
                <td className="px-5 py-3 text-gray-300 text-sm">{d.cant20 + d.cant43} vales</td>
                <td className="px-5 py-3 text-emerald-400 font-bold">S/ {d.total}</td>
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
