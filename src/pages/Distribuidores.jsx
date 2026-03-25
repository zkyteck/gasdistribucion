import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { Truck, Plus, Edit2, X, AlertCircle, History, DollarSign, RefreshCw, Ticket, Package } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Distribuidores() {
  const [distribuidores, setDistribuidores] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Cuenta corriente
  const [cuentaData, setCuentaData] = useState(null)
  const [loadingCuenta, setLoadingCuenta] = useState(false)

  // Formularios
  const [distForm, setDistForm] = useState({ nombre: '', telefono: '', almacen_id: '', precio_base: '' })
  const [cargaForm, setCargaForm] = useState({ fecha: hoyPeru(), cantidad: '', tipo_balon: '10kg', precio_por_balon: '', notas: '' })
  const [abonoForm, setAbonoForm] = useState({ fecha: hoyPeru(), efectivo: '', vales_20: '', vales_43: '', balones_devueltos: '', notas: '' })
  const [pagoForm, setPagoForm] = useState({ fecha: hoyPeru(), efectivo: '', vales_20: '', vales_43: '', balones_devueltos: '', notas: '' })

  // Vales a cuenta
  const [valesDist, setValesDist] = useState([])
  const [clientes, setClientes] = useState([])
  const [valeForm, setValeForm] = useState({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: d }, { data: a }, { data: vp }] = await Promise.all([
      supabase.from('distribuidores').select('*, almacenes(nombre, stock_actual, balones_vacios, balones_pendientes_devolucion)').eq('activo', true).order('nombre'),
      supabase.from('almacenes').select('id, nombre, stock_actual, balones_vacios, balones_pendientes_devolucion').eq('activo', true),
      supabase.from('vales_distribuidor').select('distribuidor_id').eq('estado', 'pendiente')
    ])

    const distEnriquecidos = (d || []).map(dist => {
      const almacenAsignado = (a || []).find(alm => alm.id === dist.almacen_id)
      return {
        ...dist,
        stock_actual: almacenAsignado?.stock_actual || 0,
        balones_vacios: almacenAsignado?.balones_vacios || 0,
        balones_pendientes_devolucion: almacenAsignado?.balones_pendientes_devolucion || 0,
        vales_pendientes: (vp || []).filter(v => v.distribuidor_id === dist.id).length
      }
    })
    setDistribuidores(distEnriquecidos)
    setAlmacenes(a || [])
    setLoading(false)
  }

  async function cargarCuenta(distId) {
    setLoadingCuenta(true)
    const [{ data: cargas }, { data: abonos }] = await Promise.all([
      supabase.from('cargas_distribuidor').select('*').eq('distribuidor_id', distId).order('fecha', { ascending: false }),
      supabase.from('abonos_distribuidor').select('*').eq('distribuidor_id', distId).order('fecha', { ascending: false })
    ])

    const totalCargas = (cargas || []).reduce((s, c) => s + (c.total || 0), 0)
    const totalBalonesEntregados = (cargas || []).reduce((s, c) => s + (c.cantidad || 0), 0)
    const totalAbonado = (abonos || []).reduce((s, a) => s + (a.total_abonado || 0), 0)
    const totalBalonesDevueltos = (abonos || []).reduce((s, a) => s + (a.balones_devueltos || 0), 0)
    const saldoPendiente = totalCargas - totalAbonado
    const balonesPendientes = totalBalonesEntregados - totalBalonesDevueltos

    setCuentaData({
      cargas: cargas || [],
      abonos: abonos || [],
      totalCargas,
      totalBalonesEntregados,
      totalAbonado,
      totalBalonesDevueltos,
      saldoPendiente,
      balonesPendientes
    })
    setLoadingCuenta(false)
  }

  async function guardarDistribuidor() {
    if (!distForm.nombre || !distForm.precio_base) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    const data = { nombre: distForm.nombre, telefono: distForm.telefono, almacen_id: distForm.almacen_id || null, precio_base: parseFloat(distForm.precio_base) }
    const op = selected
      ? supabase.from('distribuidores').update({ ...data, updated_at: new Date().toISOString() }).eq('id', selected.id)
      : supabase.from('distribuidores').insert({ ...data, stock_actual: 0 })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function guardarCarga() {
    if (!cargaForm.cantidad || !cargaForm.precio_por_balon) { setError('Completa cantidad y precio'); return }
    const cant = parseInt(cargaForm.cantidad)
    const almacen = almacenes.find(a => a.id === selected.almacen_id)
    if (almacen && almacen.stock_actual < cant) { setError(`Stock insuficiente. Disponible: ${almacen.stock_actual} bal.`); return }

    setSaving(true); setError('')
    // Registrar carga
    const { error: e } = await supabase.from('cargas_distribuidor').insert({
      distribuidor_id: selected.id,
      fecha: cargaForm.fecha,
      cantidad: cant,
      tipo_balon: cargaForm.tipo_balon,
      precio_por_balon: parseFloat(cargaForm.precio_por_balon),
      notas: cargaForm.notas || null
    })
    if (e) { setError(e.message); setSaving(false); return }

    // Descontar del almacén
    if (almacen) {
      await supabase.from('almacenes').update({
        stock_actual: almacen.stock_actual - cant
      }).eq('id', selected.almacen_id)
      const { data: spt } = await supabase.from('stock_por_tipo')
        .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', cargaForm.tipo_balon).single()
      if (spt) await supabase.from('stock_por_tipo')
        .update({ stock_actual: Math.max(0, spt.stock_actual - cant) })
        .eq('almacen_id', selected.almacen_id).eq('tipo_balon', cargaForm.tipo_balon)
    }

    setSaving(false)
    setModal(null)
    setCargaForm({ fecha: hoyPeru(), cantidad: '', tipo_balon: '10kg', precio_por_balon: '', notas: '' })
    await cargarCuenta(selected.id)
    cargar()
  }

  async function guardarAbono() {
    const efectivo = parseFloat(abonoForm.efectivo) || 0
    const vales20 = parseInt(abonoForm.vales_20) || 0
    const vales43 = parseInt(abonoForm.vales_43) || 0
    const balonesDevueltos = parseInt(abonoForm.balones_devueltos) || 0
    if (efectivo === 0 && vales20 === 0 && vales43 === 0 && balonesDevueltos === 0) {
      setError('Ingresa al menos un valor'); return
    }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('abonos_distribuidor').insert({
      distribuidor_id: selected.id,
      fecha: abonoForm.fecha,
      efectivo,
      vales_20: vales20,
      vales_43: vales43,
      balones_devueltos: balonesDevueltos,
      notas: abonoForm.notas || null
    })
    if (e) { setError(e.message); setSaving(false); return }

    // Actualizar vacíos en almacén
    if (balonesDevueltos > 0 && selected.almacen_id) {
      const almacen = almacenes.find(a => a.id === selected.almacen_id)
      if (almacen) {
        await supabase.from('almacenes').update({
          balones_vacios: (almacen.balones_vacios || 0) + balonesDevueltos,
          vacios_10kg: (almacen.vacios_10kg || 0) + balonesDevueltos,
          balones_pendientes_devolucion: Math.max(0, (almacen.balones_pendientes_devolucion || 0) - balonesDevueltos)
        }).eq('id', selected.almacen_id)
      }
    }

    setSaving(false)
    setModal(null)
    setAbonoForm({ fecha: hoyPeru(), efectivo: '', vales_20: '', vales_43: '', balones_devueltos: '', notas: '' })
    await cargarCuenta(selected.id)
    cargar()
  }

  async function eliminarCarga(carga) {
    if (!confirm(`¿Eliminar esta carga de ${carga.cantidad} balones? Se restaurará el stock.`)) return
    // Restaurar stock
    const almacen = almacenes.find(a => a.id === selected.almacen_id)
    if (almacen) {
      await supabase.from('almacenes').update({ stock_actual: almacen.stock_actual + carga.cantidad }).eq('id', selected.almacen_id)
      const { data: spt } = await supabase.from('stock_por_tipo')
        .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', carga.tipo_balon || '10kg').single()
      if (spt) await supabase.from('stock_por_tipo')
        .update({ stock_actual: spt.stock_actual + carga.cantidad })
        .eq('almacen_id', selected.almacen_id).eq('tipo_balon', carga.tipo_balon || '10kg')
    }
    await supabase.from('cargas_distribuidor').delete().eq('id', carga.id)
    await cargarCuenta(selected.id)
    cargar()
  }

  async function eliminarAbono(abono) {
    if (!confirm('¿Eliminar este abono?')) return
    // Revertir vacíos si había balones devueltos
    if (abono.balones_devueltos > 0 && selected.almacen_id) {
      const almacen = almacenes.find(a => a.id === selected.almacen_id)
      if (almacen) {
        await supabase.from('almacenes').update({
          balones_vacios: Math.max(0, (almacen.balones_vacios || 0) - abono.balones_devueltos),
          vacios_10kg: Math.max(0, (almacen.vacios_10kg || 0) - abono.balones_devueltos),
        }).eq('id', selected.almacen_id)
      }
    }
    await supabase.from('abonos_distribuidor').delete().eq('id', abono.id)
    await cargarCuenta(selected.id)
    cargar()
  }

  async function abrirVales(d) {
    setSelected(d)
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('vales_distribuidor').select('*').eq('distribuidor_id', d.id).order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    ])
    setValesDist(v || [])
    setClientes(c || [])
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
    setModal('vales')
  }

  async function guardarVale() {
    if (!valeForm.nombre_cliente) { setError('Ingresa el nombre del cliente'); return }
    setSaving(true); setError('')
    const monto = valeForm.tipo_vale === '20' ? 20 : 43
    await supabase.from('vales_distribuidor').insert({
      distribuidor_id: selected.id,
      nombre_cliente: valeForm.nombre_cliente,
      cliente_id: valeForm.cliente_id || null,
      tipo_vale: valeForm.tipo_vale,
      monto, fecha: valeForm.fecha, notas: valeForm.notas, estado: 'pendiente'
    })
    setSaving(false)
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
    const { data: v } = await supabase.from('vales_distribuidor').select('*').eq('distribuidor_id', selected.id).order('fecha', { ascending: false })
    setValesDist(v || [])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Distribuidores</h2>
          <p className="text-gray-500 text-sm">Control de cargas, abonos y cuenta corriente</p>
        </div>
        <button onClick={() => { setSelected(null); setDistForm({ nombre: '', telefono: '', almacen_id: '', precio_base: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
          <Plus className="w-4 h-4" />Nuevo distribuidor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card border border-indigo-500/20">
          <Truck className="w-4 h-4 text-indigo-400 mb-1" />
          <p className="text-2xl font-bold text-white">{distribuidores.length}</p>
          <p className="text-xs text-gray-500">Distribuidores activos</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <Package className="w-4 h-4 text-emerald-400 mb-1" />
          <p className="text-2xl font-bold text-white">{distribuidores.reduce((s, d) => s + (d.stock_actual || 0), 0)}</p>
          <p className="text-xs text-gray-500">Balones en campo</p>
        </div>
        <div className="stat-card border border-yellow-500/20">
          <DollarSign className="w-4 h-4 text-yellow-400 mb-1" />
          <p className="text-2xl font-bold text-white">S/ {distribuidores.reduce((s, d) => s + (d.stock_actual || 0) * (d.precio_base || 0), 0).toLocaleString('es-PE')}</p>
          <p className="text-xs text-gray-500">Valor en campo</p>
        </div>
      </div>

      {/* Cards distribuidores */}
      {loading ? <div className="text-center text-gray-500 py-10">Cargando...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {distribuidores.map(d => (
            <div key={d.id} className="card border border-gray-700/50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{d.nombre}</p>
                    <p className="text-gray-500 text-xs">{d.telefono || 'Sin teléfono'} · {d.almacenes?.nombre || 'Sin almacén'}</p>
                  </div>
                </div>
                <button onClick={() => { setSelected(d); setDistForm({ nombre: d.nombre, telefono: d.telefono || '', almacen_id: d.almacen_id || '', precio_base: d.precio_base }); setError(''); setModal('editar') }}
                  className="text-gray-600 hover:text-blue-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${d.stock_actual > 50 ? 'text-emerald-400' : d.stock_actual > 10 ? 'text-yellow-400' : 'text-red-400'}`}>{d.stock_actual}</p>
                  <p className="text-xs text-gray-500 mt-0.5">🟢 Llenos</p>
                </div>
                <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-300">{d.balones_vacios || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">⚪ Vacíos devueltos</p>
                </div>
              </div>

              {(d.balones_pendientes_devolucion || 0) > 0 && (
                <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg p-2 mb-2 flex items-center justify-between">
                  <span className="text-xs text-orange-300 font-medium">⏳ Pendientes de devolución</span>
                  <span className="text-orange-400 font-bold text-sm">{d.balones_pendientes_devolucion} bal.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <p className="text-blue-400 font-bold">S/{d.precio_base}</p>
                  <p className="text-xs text-gray-500">Precio/bal.</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <p className="text-yellow-400 font-bold">S/{((d.stock_actual || 0) * d.precio_base).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Valor campo</p>
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => {
                  setSelected(d)
                  setCargaForm({ fecha: hoyPeru(), cantidad: '', tipo_balon: '10kg', precio_por_balon: d.precio_base?.toString() || '', notas: '' })
                  setError(''); setModal('carga')
                }} className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <Package className="w-3 h-3" />Registrar carga
                </button>
                <button onClick={() => {
                  setSelected(d)
                  setAbonoForm({ fecha: hoyPeru(), efectivo: '', vales_20: '', vales_43: '', balones_devueltos: '', notas: '' })
                  setError(''); setModal('abono')
                }} className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <DollarSign className="w-3 h-3" />Registrar abono
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={async () => {
                  setSelected(d)
                  await cargarCuenta(d.id)
                  setModal('cuenta')
                }} className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <History className="w-3 h-3" />Ver cuenta corriente
                </button>
                <button onClick={() => abrirVales(d)}
                  className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 text-purple-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <Ticket className="w-3 h-3" />Vales A Cuenta {d.vales_pendientes > 0 && `(${d.vales_pendientes})`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo/editar distribuidor */}
      {(modal === 'nuevo' || modal === 'editar') && (
        <Modal title={modal === 'nuevo' ? 'Nuevo distribuidor' : 'Editar distribuidor'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre</label><input className="input" value={distForm.nombre} onChange={e => setDistForm({...distForm, nombre: e.target.value})} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={distForm.telefono} onChange={e => setDistForm({...distForm, telefono: e.target.value})} /></div>
            <div>
              <label className="label">Almacén asignado</label>
              <select className="input" value={distForm.almacen_id} onChange={e => setDistForm({...distForm, almacen_id: e.target.value})}>
                <option value="">Sin almacén</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.stock_actual} bal.)</option>)}
              </select>
            </div>
            <div><label className="label">Precio por balón (S/)</label><input type="number" className="input" value={distForm.precio_base} onChange={e => setDistForm({...distForm, precio_base: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarDistribuidor} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal registrar carga */}
      {modal === 'carga' && selected && (
        <Modal title={`📦 Registrar carga — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-gray-800/50 rounded-xl p-3 flex justify-between">
              <div><p className="text-xs text-gray-500">Stock en almacén</p><p className="text-xl font-bold text-emerald-400">{almacenes.find(a => a.id === selected.almacen_id)?.stock_actual || 0} bal.</p></div>
              <div className="text-right"><p className="text-xs text-gray-500">Precio base</p><p className="text-xl font-bold text-blue-400">S/{selected.precio_base}/bal.</p></div>
            </div>
            <div><label className="label">Fecha</label><input type="date" className="input" value={cargaForm.fecha} onChange={e => setCargaForm({...cargaForm, fecha: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cantidad de balones</label>
                <input type="number" className="input" placeholder="50" value={cargaForm.cantidad} onChange={e => setCargaForm({...cargaForm, cantidad: e.target.value})} />
              </div>
              <div>
                <label className="label">Tipo de balón</label>
                <div className="flex gap-1 mt-1">
                  {['5kg','10kg','45kg'].map(t => (
                    <button key={t} onClick={() => setCargaForm({...cargaForm, tipo_balon: t})}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${cargaForm.tipo_balon === t ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="label">Precio por balón (S/)</label>
              <input type="number" className="input" value={cargaForm.precio_por_balon} onChange={e => setCargaForm({...cargaForm, precio_por_balon: e.target.value})} />
            </div>
            {cargaForm.cantidad && cargaForm.precio_por_balon && (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 flex justify-between">
                <span className="text-gray-400 text-sm">Total carga:</span>
                <span className="text-emerald-400 font-bold">S/ {((parseInt(cargaForm.cantidad)||0) * (parseFloat(cargaForm.precio_por_balon)||0)).toLocaleString('es-PE')}</span>
              </div>
            )}
            <div><label className="label">Notas</label><input className="input" placeholder="Observaciones..." value={cargaForm.notas} onChange={e => setCargaForm({...cargaForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCarga} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : '✓ Registrar carga'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal registrar abono */}
      {modal === 'abono' && selected && (
        <Modal title={`💰 Registrar abono — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Fecha</label><input type="date" className="input" value={abonoForm.fecha} onChange={e => setAbonoForm({...abonoForm, fecha: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">💵 Efectivo (S/)</label><input type="number" min="0" className="input" placeholder="0" value={abonoForm.efectivo} onChange={e => setAbonoForm({...abonoForm, efectivo: e.target.value})} /></div>
              <div><label className="label">⚪ Balones vacíos devueltos</label><input type="number" min="0" className="input" placeholder="0" value={abonoForm.balones_devueltos} onChange={e => setAbonoForm({...abonoForm, balones_devueltos: e.target.value})} /></div>
              <div><label className="label">🎫 Vales S/20</label><input type="number" min="0" className="input" placeholder="0" value={abonoForm.vales_20} onChange={e => setAbonoForm({...abonoForm, vales_20: e.target.value})} /></div>
              <div><label className="label">🎫 Vales S/43</label><input type="number" min="0" className="input" placeholder="0" value={abonoForm.vales_43} onChange={e => setAbonoForm({...abonoForm, vales_43: e.target.value})} /></div>
            </div>
            {((parseFloat(abonoForm.efectivo)||0) + (parseInt(abonoForm.vales_20)||0)*20 + (parseInt(abonoForm.vales_43)||0)*43) > 0 && (
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Total abono en dinero:</p>
                <p className="text-blue-400 font-bold text-xl">S/ {((parseFloat(abonoForm.efectivo)||0) + (parseInt(abonoForm.vales_20)||0)*20 + (parseInt(abonoForm.vales_43)||0)*43).toLocaleString('es-PE')}</p>
                {(parseInt(abonoForm.balones_devueltos)||0) > 0 && <p className="text-gray-400 text-sm mt-1">+ {abonoForm.balones_devueltos} balones vacíos devueltos</p>}
              </div>
            )}
            <div><label className="label">Notas</label><input className="input" placeholder="Ej: Pago parcial, vales del día..." value={abonoForm.notas} onChange={e => setAbonoForm({...abonoForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarAbono} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : '✓ Registrar abono'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal cuenta corriente */}
      {modal === 'cuenta' && selected && (
        <Modal title={`📊 Cuenta corriente — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            {loadingCuenta ? <div className="text-center text-gray-500 py-8">Cargando...</div> : cuentaData && (
              <>
                {/* Resumen general */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Total cargas (debe)</p>
                    <p className="text-3xl font-bold text-red-400">S/ {cuentaData.totalCargas.toLocaleString('es-PE')}</p>
                    <p className="text-xs text-gray-500 mt-1">{cuentaData.totalBalonesEntregados} balones entregados</p>
                  </div>
                  <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Total abonado (haber)</p>
                    <p className="text-3xl font-bold text-emerald-400">S/ {cuentaData.totalAbonado.toLocaleString('es-PE')}</p>
                    <p className="text-xs text-gray-500 mt-1">{cuentaData.totalBalonesDevueltos} balones devueltos</p>
                  </div>
                </div>

                {/* Saldo pendiente */}
                <div className={`rounded-2xl p-5 border ${cuentaData.saldoPendiente > 0 ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-emerald-900/20 border-emerald-700/40'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-gray-400 text-sm">Saldo pendiente en dinero</p>
                      <p className={`text-4xl font-bold mt-1 ${cuentaData.saldoPendiente > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        S/ {Math.abs(cuentaData.saldoPendiente).toLocaleString('es-PE')}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">{cuentaData.saldoPendiente > 0 ? '⏳ Por cobrar' : '✅ Al día'}</p>
                    </div>
                    {cuentaData.balonesPendientes > 0 && (
                      <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">⏳ Balones por devolver</p>
                        <p className="text-2xl font-bold text-orange-400">{cuentaData.balonesPendientes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Historial de cargas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">📦 Cargas</h4>
                    <button onClick={() => { setModal(null); setTimeout(() => { setSelected(selected); setCargaForm({ fecha: hoyPeru(), cantidad: '', tipo_balon: '10kg', precio_por_balon: selected.precio_base?.toString() || '', notas: '' }); setError(''); setModal('carga') }, 100) }}
                      className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg">
                      + Nueva carga
                    </button>
                  </div>
                  {cuentaData.cargas.length === 0 ? <p className="text-gray-600 text-sm text-center py-4">Sin cargas registradas</p> : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {cuentaData.cargas.map(c => (
                        <div key={c.id} className="flex items-center justify-between bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-3">
                          <div>
                            <p className="text-white text-sm font-medium">📦 {c.cantidad} bal. {c.tipo_balon} × S/{c.precio_por_balon}</p>
                            <p className="text-gray-500 text-xs">{format(new Date(c.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}{c.notas ? ` · ${c.notas}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-red-400 font-bold">S/ {(c.total||0).toLocaleString()}</p>
                            <button onClick={() => eliminarCarga(c)} className="text-gray-600 hover:text-red-400 text-xs px-1.5 py-0.5 rounded border border-gray-700 hover:border-red-600/40">🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Historial de abonos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">💰 Abonos</h4>
                    <button onClick={() => { setModal(null); setTimeout(() => { setSelected(selected); setAbonoForm({ fecha: hoyPeru(), efectivo: '', vales_20: '', vales_43: '', balones_devueltos: '', notas: '' }); setError(''); setModal('abono') }, 100) }}
                      className="text-xs bg-blue-600/20 border border-blue-600/30 text-blue-400 px-2 py-1 rounded-lg">
                      + Nuevo abono
                    </button>
                  </div>
                  {cuentaData.abonos.length === 0 ? <p className="text-gray-600 text-sm text-center py-4">Sin abonos registrados</p> : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {cuentaData.abonos.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-emerald-900/20 border border-emerald-800/30 rounded-lg px-4 py-3">
                          <div>
                            <div className="flex gap-2 flex-wrap">
                              {(a.efectivo||0) > 0 && <span className="text-xs bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded">💵 S/{a.efectivo}</span>}
                              {(a.vales_20||0) > 0 && <span className="text-xs bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded">🎫 {a.vales_20}×S/20</span>}
                              {(a.vales_43||0) > 0 && <span className="text-xs bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded">🎫 {a.vales_43}×S/43</span>}
                              {(a.balones_devueltos||0) > 0 && <span className="text-xs bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded">⚪ {a.balones_devueltos} bal.</span>}
                            </div>
                            <p className="text-gray-500 text-xs mt-1">{format(new Date(a.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}{a.notas ? ` · ${a.notas}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-emerald-400 font-bold">S/ {(a.total_abonado||0).toLocaleString()}</p>
                            <button onClick={() => eliminarAbono(a)} className="text-gray-600 hover:text-red-400 text-xs px-1.5 py-0.5 rounded border border-gray-700 hover:border-red-600/40">🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Vales A Cuenta */}
      {modal === 'vales' && selected && (
        <Modal title={`🎫 Vales A Cuenta — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/20 pendientes</p>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/43 pendientes</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">S/ {valesDist.filter(v => v.estado === 'pendiente').reduce((s, v) => s + v.monto, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total pendiente</p>
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-4 space-y-3 border border-gray-700/50">
              <p className="text-sm font-semibold text-white">Registrar nuevo vale</p>
              <input className="input" placeholder="Nombre del cliente..." value={valeForm.nombre_cliente} onChange={e => setValeForm(f => ({...f, nombre_cliente: e.target.value}))} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setValeForm(f => ({...f, tipo_vale: '20'}))}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${valeForm.tipo_vale === '20' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 20
                </button>
                <button onClick={() => setValeForm(f => ({...f, tipo_vale: '43'}))}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${valeForm.tipo_vale === '43' ? 'bg-orange-900/30 border-orange-500 text-orange-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 43
                </button>
              </div>
              <input type="date" className="input" value={valeForm.fecha} onChange={e => setValeForm(f => ({...f, fecha: e.target.value}))} />
              <button onClick={guardarVale} disabled={saving || !valeForm.nombre_cliente} className="w-full btn-primary justify-center">+ Registrar vale</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {valesDist.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2">
                  <div>
                    <p className="text-white text-sm">{v.nombre_cliente}</p>
                    <p className="text-gray-500 text-xs">{format(new Date(v.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${v.tipo_vale === '20' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-orange-900/40 text-orange-400'}`}>S/{v.tipo_vale}</span>
                    <span className={v.estado === 'pendiente' ? 'badge-yellow' : 'badge-green'}>{v.estado === 'pendiente' ? '⏳' : '✅'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
