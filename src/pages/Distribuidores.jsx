import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Truck, Plus, Edit2, Package, X, AlertCircle, History, ChevronDown, ChevronUp, DollarSign, RefreshCw, Ticket, Clock, CheckCircle } from 'lucide-react'
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
  const [modal, setModal] = useState(null) // 'nuevo'|'editar'|'reponer'|'historial'|'cuenta'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', almacen_id: '', precio_base: '' })
  const [repoForm, setRepoForm] = useState({ cantidad: '', notas: '' })
  const [cuentaForm, setCuentaForm] = useState({ vales20: '', vales43: '', adelantos: '', balones_devueltos: '', notas: '' })
  const [historial, setHistorial] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [valesDist, setValesDist] = useState([])
  const [clientes, setClientes] = useState([])
  const [valeForm, setValeForm] = useState({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: new Date().toISOString().split('T')[0], notas: '' })
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre: '', telefono: '' })
  const [subModal, setSubModal] = useState(null) // 'clienteRapido'

  useEffect(() => { cargar() }, [])

  async function cargarValesDist(distId) {
    const { data } = await supabase.from('vales_distribuidor')
      .select('*').eq('distribuidor_id', distId).order('fecha', { ascending: false })
    setValesDist(data || [])
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    setClientes(data || [])
  }

  async function cargar() {
    setLoading(true)
    const [{ data: d }, { data: a }, { data: vp }] = await Promise.all([
      supabase.from('distribuidores').select('*, almacenes(nombre)').eq('activo', true).order('nombre'),
      supabase.from('almacenes').select('id, nombre, stock_actual').eq('activo', true),
      supabase.from('vales_distribuidor').select('distribuidor_id').eq('estado', 'pendiente')
    ])
    const distConVales = (d || []).map(dist => ({
      ...dist,
      vales_pendientes: (vp || []).filter(v => v.distribuidor_id === dist.id).length
    }))
    setDistribuidores(distConVales)
    setAlmacenes(a || [])
    setLoading(false)
  }

  async function cargarHistorial(distId) {
    const { data } = await supabase.from('reposiciones_distribuidor')
      .select('*, almacenes(nombre)').eq('distribuidor_id', distId).order('fecha', { ascending: false }).limit(20)
    setHistorial(data || [])
  }

  async function cargarMovimientos(distId) {
    const { data } = await supabase.from('movimientos_stock')
      .select('*').eq('distribuidor_id', distId).order('created_at', { ascending: false }).limit(30)
    setMovimientos(data || [])
  }

  async function abrirVales(d) {
    setSelected(d)
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: new Date().toISOString().split('T')[0], notas: '' })
    setError('')
    await cargarValesDist(d.id)
    await cargarClientes()
    setModal('vales')
  }

  async function guardarVale() {
    if (!form_vale_nombre) { setError('Ingresa el nombre del cliente'); return }
    setSaving(true); setError('')
    const monto = valeForm.tipo_vale === '20' ? 20 : 43
    const { error: e } = await supabase.from('vales_distribuidor').insert({
      distribuidor_id: selected.id,
      nombre_cliente: valeForm.nombre_cliente,
      cliente_id: valeForm.cliente_id || null,
      tipo_vale: valeForm.tipo_vale,
      monto,
      fecha: valeForm.fecha,
      notas: valeForm.notas,
      estado: 'pendiente'
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: new Date().toISOString().split('T')[0], notas: '' })
    await cargarValesDist(selected.id)
  }

  async function marcarValeCobrado(vale) {
    await supabase.from('vales_distribuidor').update({ estado: 'cobrado', fecha_cobro: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() }).eq('id', vale.id)
    await cargarValesDist(selected.id)
  }

  async function anularVale(vale) {
    if (!confirm('¿Anular este vale?')) return
    await supabase.from('vales_distribuidor').update({ estado: 'anulado', updated_at: new Date().toISOString() }).eq('id', vale.id)
    await cargarValesDist(selected.id)
  }

  async function guardarClienteRapido() {
    if (!clienteRapidoForm.nombre) return
    const { data: nc } = await supabase.from('clientes').insert({
      nombre: clienteRapidoForm.nombre, telefono: clienteRapidoForm.telefono, tipo: 'general'
    }).select().single()
    await cargarClientes()
    if (nc) setValeForm(f => ({...f, nombre_cliente: nc.nombre, cliente_id: nc.id}))
    setClienteRapidoForm({ nombre: '', telefono: '' })
    setSubModal(null)
  }

  const form_vale_nombre = valeForm.nombre_cliente

  async function guardarDistribuidor() {
    if (!form.nombre || !form.precio_base) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    const data = { nombre: form.nombre, telefono: form.telefono, almacen_id: form.almacen_id || null, precio_base: parseFloat(form.precio_base) }
    const op = selected
      ? supabase.from('distribuidores').update({ ...data, updated_at: new Date().toISOString() }).eq('id', selected.id)
      : supabase.from('distribuidores').insert({ ...data, stock_actual: 0 })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function guardarReposicion() {
    const cant = parseInt(repoForm.cantidad)
    if (!cant || cant <= 0) { setError('Ingresa una cantidad válida'); return }
    const almacen = almacenes.find(a => a.id === selected.almacen_id)
    if (!almacen || almacen.stock_actual < cant) { setError(`Stock insuficiente en almacén. Disponible: ${almacen?.stock_actual || 0}`); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('reposiciones_distribuidor').insert({
      distribuidor_id: selected.id,
      almacen_origen_id: selected.almacen_id,
      cantidad: cant,
      stock_antes_dist: selected.stock_actual,
      stock_despues_dist: selected.stock_actual + cant,
      notas: repoForm.notas,
      fecha: new Date().toISOString()
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); setRepoForm({ cantidad: '', notas: '' }); cargar()
  }

  async function abrirHistorial(d) {
    setSelected(d); await cargarHistorial(d.id); await cargarMovimientos(d.id); setModal('historial')
  }

  async function abrirCuenta(d) {
    setSelected(d); setCuentaForm({ vales20: '', vales43: '', adelantos: '', balones_devueltos: '', notas: '' }); setError(''); setModal('cuenta')
  }

  async function guardarCuenta() {
    const v20 = parseInt(cuentaForm.vales20) || 0
    const v43 = parseInt(cuentaForm.vales43) || 0
    const adelantos = parseFloat(cuentaForm.adelantos) || 0
    const balonesDevueltos = parseInt(cuentaForm.balones_devueltos) || 0
    const balonesFaltantes = selected.stock_actual - balonesDevueltos
    const totalVales = (v20 * 20) + (v43 * 43)
    const totalEsperado = selected.stock_actual * selected.precio_base
    const saldoEfectivo = totalEsperado - totalVales - adelantos
    const estadoCuenta = saldoEfectivo <= 0 && balonesFaltantes <= 0 ? 'cancelado' : 'por_cobrar'
    setSaving(true); setError('')
    const hoy = new Date().toISOString().split('T')[0]
    const { data: cuenta, error: e1 } = await supabase.from('cuentas_distribuidor').insert({
      distribuidor_id: selected.id,
      periodo_inicio: hoy, periodo_fin: hoy,
      balones_entregados: selected.stock_actual,
      balones_vendidos: selected.stock_actual,
      precio_por_balon: selected.precio_base,
      total_esperado: totalEsperado,
      total_vales: totalVales,
      total_adelantos: adelantos,
      balones_devueltos: balonesDevueltos,
      balones_faltantes: balonesFaltantes,
      estado: estadoCuenta, notas: cuentaForm.notas
    }).select().single()
    if (e1) { setError(e1.message); setSaving(false); return }
    const detalles = []
    if (v20 > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'vale_20', cantidad: v20, monto: v20 * 20, fecha: hoy })
    if (v43 > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'vale_43', cantidad: v43, monto: v43 * 43, fecha: hoy })
    if (adelantos > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'adelanto', monto: adelantos, fecha: hoy })
    if (detalles.length > 0) await supabase.from('cuenta_distribuidor_detalles').insert(detalles)
    setSaving(false); setModal(null); cargar()
    const icono = estadoCuenta === 'cancelado' ? '✅ CANCELADO' : '⏳ POR COBRAR'
    const msgBalones = balonesFaltantes > 0 ? `\n⚠️ Balones faltantes: ${balonesFaltantes}` : '\n✅ Balones completos'
    alert(`${icono}\nTotal esperado: S/ ${totalEsperado}\nVales: S/ ${totalVales}\nAdelantos: S/ ${adelantos}\n💰 Saldo: S/ ${saldoEfectivo.toFixed(2)}${msgBalones}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Distribuidores</h2>
          <p className="text-gray-500 text-sm">Control de stock, reposiciones y cuentas</p>
        </div>
        <button onClick={() => { setSelected(null); setForm({ nombre: '', telefono: '', almacen_id: '', precio_base: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
          <Plus className="w-4 h-4" />Nuevo distribuidor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border border-indigo-500/20">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-indigo-400" /></div>
          <p className="text-2xl font-bold text-white">{distribuidores.length}</p>
          <p className="text-xs text-gray-500">Distribuidores activos</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-white">{distribuidores.reduce((s, d) => s + d.stock_actual, 0)}</p>
          <p className="text-xs text-gray-500">Balones en distribución</p>
        </div>
        <div className="stat-card border border-yellow-500/20">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-yellow-400" /></div>
          <p className="text-2xl font-bold text-white">S/ {distribuidores.reduce((s, d) => s + (d.stock_actual * d.precio_base), 0).toLocaleString('es-PE')}</p>
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
                <button onClick={() => { setSelected(d); setForm({ nombre: d.nombre, telefono: d.telefono || '', almacen_id: d.almacen_id || '', precio_base: d.precio_base }); setError(''); setModal('editar') }}
                  className="text-gray-600 hover:text-blue-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>

              {/* Stock y precio */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className={`text-xl font-bold ${d.stock_actual > 100 ? 'text-emerald-400' : d.stock_actual > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{d.stock_actual}</p>
                  <p className="text-xs text-gray-500">Balones</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-400">S/{d.precio_base}</p>
                  <p className="text-xs text-gray-500">Precio/bal.</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">S/{(d.stock_actual * d.precio_base).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total campo</p>
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => { setSelected(d); setRepoForm({ cantidad: '', notas: '' }); setError(''); setModal('reponer') }}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3" />Reponer
                </button>
                <button onClick={() => abrirCuenta(d)}
                  className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <DollarSign className="w-3 h-3" />Cuenta
                </button>
                <button onClick={() => abrirHistorial(d)}
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <History className="w-3 h-3" />Historial
                </button>
              </div>
              <button onClick={() => abrirVales(d)}
                className="w-full bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                <Ticket className="w-3 h-3" />🎫 Vales A Cuenta ({d.vales_pendientes || 0} pendientes)
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo/editar distribuidor */}
      {(modal === 'nuevo' || modal === 'editar') && (
        <Modal title={modal === 'nuevo' ? 'Nuevo distribuidor' : 'Editar distribuidor'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre</label><input className="input" placeholder="Nombre del distribuidor" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
            <div><label className="label">Teléfono</label><input className="input" placeholder="999 888 777" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /></div>
            <div>
              <label className="label">Almacén asignado</label>
              <select className="input" value={form.almacen_id} onChange={e => setForm({...form, almacen_id: e.target.value})}>
                <option value="">Sin almacén</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.stock_actual} bal.)</option>)}
              </select>
            </div>
            <div><label className="label">Precio por balón (S/)</label><input type="number" className="input" placeholder="100" value={form.precio_base} onChange={e => setForm({...form, precio_base: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarDistribuidor} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal reponer */}
      {modal === 'reponer' && selected && (
        <Modal title={`Reponer stock — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-gray-800/50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Stock actual distribuidor</p><p className="text-xl font-bold text-white">{selected.stock_actual} bal.</p></div>
              <div><p className="text-xs text-gray-500">Stock en almacén</p><p className="text-xl font-bold text-blue-400">{almacenes.find(a => a.id === selected.almacen_id)?.stock_actual || 0} bal.</p></div>
            </div>
            <div><label className="label">Cantidad a entregar</label><input type="number" className="input" placeholder="50" value={repoForm.cantidad} onChange={e => setRepoForm({...repoForm, cantidad: e.target.value})} /></div>
            {repoForm.cantidad && (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 text-sm">
                <p className="text-emerald-400">Stock nuevo del distribuidor: <span className="font-bold">{selected.stock_actual + (parseInt(repoForm.cantidad) || 0)} balones</span></p>
              </div>
            )}
            <div><label className="label">Notas (opcional)</label><textarea className="input" rows={2} placeholder="Observaciones..." value={repoForm.notas} onChange={e => setRepoForm({...repoForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarReposicion} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all flex-1 justify-center flex items-center gap-2">{saving ? 'Guardando...' : '✓ Confirmar reposición'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal rendición de cuentas */}
      {modal === 'cuenta' && selected && (
        <Modal title={`Rendición de cuentas — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Balones en campo × Precio</p>
              <p className="text-lg font-bold text-white">{selected.stock_actual} bal. × S/{selected.precio_base} = <span className="text-yellow-400">S/{(selected.stock_actual * selected.precio_base).toLocaleString()}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Vales de S/ 20</label><input type="number" className="input" placeholder="0" value={cuentaForm.vales20} onChange={e => setCuentaForm({...cuentaForm, vales20: e.target.value})} /></div>
              <div><label className="label">Vales de S/ 43</label><input type="number" className="input" placeholder="0" value={cuentaForm.vales43} onChange={e => setCuentaForm({...cuentaForm, vales43: e.target.value})} /></div>
            </div>
            <div><label className="label">Adelantos en efectivo (S/)</label><input type="number" className="input" placeholder="0" value={cuentaForm.adelantos} onChange={e => setCuentaForm({...cuentaForm, adelantos: e.target.value})} /></div>

            {/* Balones devueltos */}
            <div>
              <label className="label">Balones vacíos devueltos</label>
              <div className="flex items-center gap-3">
                <input type="number" className="input flex-1" placeholder="0"
                  value={cuentaForm.balones_devueltos}
                  onChange={e => setCuentaForm({...cuentaForm, balones_devueltos: e.target.value})} />
                <div className="text-right flex-shrink-0">
                  {(() => {
                    const devueltos = parseInt(cuentaForm.balones_devueltos) || 0
                    const faltantes = selected.stock_actual - devueltos
                    if (!cuentaForm.balones_devueltos) return <span className="text-gray-500 text-xs">de {selected.stock_actual} bal.</span>
                    if (faltantes > 0) return <span className="text-red-400 text-sm font-bold">⚠️ Faltan {faltantes}</span>
                    if (faltantes < 0) return <span className="text-yellow-400 text-sm font-bold">+{Math.abs(faltantes)} extra</span>
                    return <span className="text-emerald-400 text-sm font-bold">✅ Completo</span>
                  })()}
                </div>
              </div>
            </div>

            {/* Cálculo automático */}
            {(cuentaForm.vales20 || cuentaForm.vales43 || cuentaForm.adelantos || cuentaForm.balones_devueltos) && (() => {
              const v20 = (parseInt(cuentaForm.vales20) || 0) * 20
              const v43 = (parseInt(cuentaForm.vales43) || 0) * 43
              const adel = parseFloat(cuentaForm.adelantos) || 0
              const devueltos = parseInt(cuentaForm.balones_devueltos) || 0
              const faltantes = selected.stock_actual - devueltos
              const total = selected.stock_actual * selected.precio_base
              const saldo = total - v20 - v43 - adel
              return (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Total esperado</span><span className="text-white font-semibold">S/ {total.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vales S/20 ({cuentaForm.vales20||0} × 20)</span><span className="text-yellow-400">- S/ {v20}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vales S/43 ({cuentaForm.vales43||0} × 43)</span><span className="text-yellow-400">- S/ {v43}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Adelantos</span><span className="text-yellow-400">- S/ {adel}</span></div>
                  {faltantes !== 0 && cuentaForm.balones_devueltos && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Balones faltantes</span>
                      <span className={faltantes > 0 ? 'text-red-400 font-semibold' : 'text-yellow-400'}>
                        {faltantes > 0 ? `⚠️ ${faltantes} sin devolver` : `+${Math.abs(faltantes)} extra`}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                    <span className="text-white font-semibold">💰 Saldo en efectivo</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>S/ {saldo.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${saldo <= 0 && faltantes <= 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/50' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-600/50'}`}>
                        {saldo <= 0 && faltantes <= 0 ? '✅ CANCELADO' : '⏳ POR COBRAR'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div><label className="label">Notas</label><textarea className="input" rows={2} value={cuentaForm.notas} onChange={e => setCuentaForm({...cuentaForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCuenta} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Registrar rendición'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Vales A Cuenta distribuidor */}
      {modal === 'vales' && selected && (
        <Modal title={`🎫 Vales A Cuenta — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/20</p>
                <p className="text-xs text-yellow-400/70 font-semibold">S/ {valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length * 20}</p>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/43</p>
                <p className="text-xs text-orange-400/70 font-semibold">S/ {valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length * 43}</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">S/ {valesDist.filter(v => v.estado === 'pendiente').reduce((s, v) => s + v.monto, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total pendiente</p>
                <p className="text-xs text-emerald-400/70">{valesDist.filter(v => v.estado === 'cobrado').length} cobrados</p>
              </div>
            </div>

            {/* Formulario nuevo vale */}
            <div className="bg-gray-800/40 rounded-xl p-4 space-y-3 border border-gray-700/50">
              <p className="text-sm font-semibold text-white">Registrar nuevo vale</p>
              <div className="relative">
                <label className="label">Cliente *</label>
                <input className="input" placeholder="Escribe el nombre..." value={valeForm.nombre_cliente}
                  onChange={e => setValeForm(f => ({...f, nombre_cliente: e.target.value, cliente_id: ''}))} />
                {valeForm.nombre_cliente.length >= 2 && (() => {
                  const coincidencias = clientes.filter(c => c.nombre.toLowerCase().includes(valeForm.nombre_cliente.toLowerCase()))
                  const exacto = clientes.find(c => c.nombre.toLowerCase() === valeForm.nombre_cliente.toLowerCase())
                  if (exacto) return <div className="mt-1 text-xs text-emerald-400 px-1">✅ Cliente registrado</div>
                  return (
                    <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                      {coincidencias.map(c => (
                        <button key={c.id} type="button" onClick={() => setValeForm(f => ({...f, nombre_cliente: c.nombre, cliente_id: c.id}))}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2">
                          <span className="text-blue-400">👤</span>{c.nombre}
                        </button>
                      ))}
                      {coincidencias.length === 0 && (
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">No encontrado</span>
                          <button type="button"
                            onClick={() => { setClienteRapidoForm({ nombre: valeForm.nombre_cliente, telefono: '' }); setSubModal('clienteRapido') }}
                            className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-600/50 transition-all">
                            + Registrar cliente
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Fecha</label>
                  <input type="date" className="input" value={valeForm.fecha} onChange={e => setValeForm(f => ({...f, fecha: e.target.value}))} />
                </div>
                <div><label className="label">Notas</label>
                  <input className="input" placeholder="Ej: Km 12" value={valeForm.notas} onChange={e => setValeForm(f => ({...f, notas: e.target.value}))} />
                </div>
              </div>
              <button onClick={guardarVale} disabled={saving || !valeForm.nombre_cliente}
                className="w-full btn-primary justify-center">{saving ? 'Guardando...' : '+ Registrar vale'}</button>
            </div>

            {/* Historial de vales */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Historial de vales</p>
              {valesDist.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-6">Sin vales registrados</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {valesDist.map(v => (
                    <div key={v.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${v.tipo_vale === '20' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-orange-900/40 text-orange-400'}`}>
                          S/{v.tipo_vale}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{v.nombre_cliente}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            📅 {format(new Date(v.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                            {v.notas && ` · ${v.notas}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={v.estado === 'pendiente' ? 'badge-yellow' : v.estado === 'cobrado' ? 'badge-green' : 'text-xs text-gray-500'}>
                          {v.estado === 'pendiente' ? '⏳ Pendiente' : v.estado === 'cobrado' ? '✅ Cobrado' : '❌ Anulado'}
                        </span>
                        {v.estado === 'pendiente' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => anularVale(v)} className="text-xs text-gray-600 hover:text-red-400 px-2 py-0.5 rounded border border-gray-700">Anular</button>
                            <button onClick={() => marcarValeCobrado(v)} className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-0.5 rounded">✓ Cobrado</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sub-modal cliente rápido */}
          {subModal === 'clienteRapido' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">Registrar cliente</h3>
                  <button onClick={() => setSubModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 py-4 space-y-3">
                  <div>
                    <label className="label">Nombre *</label>
                    <input className="input" value={clienteRapidoForm.nombre}
                      onChange={e => setClienteRapidoForm(f => ({...f, nombre: e.target.value}))} autoFocus />
                  </div>
                  <div>
                    <label className="label">Teléfono (opcional)</label>
                    <input className="input" value={clienteRapidoForm.telefono}
                      onChange={e => setClienteRapidoForm(f => ({...f, telefono: e.target.value}))} />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setSubModal(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={guardarClienteRapido} className="btn-primary flex-1 justify-center">✓ Registrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal historial */}
      {modal === 'historial' && selected && (
        <Modal title={`Historial — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-white">{selected.stock_actual}</p><p className="text-xs text-gray-500">Stock actual</p></div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-blue-400">S/{selected.precio_base}</p><p className="text-xs text-gray-500">Precio/bal.</p></div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-yellow-400">S/{(selected.stock_actual * selected.precio_base).toLocaleString()}</p><p className="text-xs text-gray-500">Valor campo</p></div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Reposiciones recientes</h4>
              {historial.length === 0 ? <p className="text-gray-600 text-sm text-center py-4">Sin reposiciones registradas</p> : (
                <div className="space-y-2">
                  {historial.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">+{r.cantidad} balones</p>
                        <p className="text-gray-500 text-xs">{r.almacenes?.nombre} · {format(new Date(r.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{r.stock_antes_dist} → <span className="text-emerald-400 font-semibold">{r.stock_despues_dist}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Movimientos de stock</h4>
              {movimientos.length === 0 ? <p className="text-gray-600 text-sm text-center py-4">Sin movimientos</p> : (
                <div className="space-y-2">
                  {movimientos.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium capitalize">{m.tipo_movimiento.replace('_', ' ')}</p>
                        <p className="text-gray-500 text-xs">{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${m.cantidad > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</p>
                        <p className="text-xs text-gray-500">{m.stock_anterior} → {m.stock_nuevo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
