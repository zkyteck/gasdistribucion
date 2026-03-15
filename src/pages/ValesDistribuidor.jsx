import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, AlertCircle, Search, Truck, CheckCircle, Clock } from 'lucide-react'
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

export default function ValesDistribuidor() {
  const { perfil } = useAuth()
  const [vales, setVales] = useState([])
  const [distribuidores, setDistribuidores] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroDistribuidor, setFiltroDistribuidor] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('pendiente')

  const [form, setForm] = useState({
    distribuidor_id: '', nombre_cliente: '', cliente_id: '',
    tipo_vale: '20', fecha: new Date().toISOString().split('T')[0], notas: ''
  })

  useEffect(() => { cargar() }, [filtroDistribuidor, filtroEstado])

  async function cargar() {
    setLoading(true)
    const [{ data: v }, { data: d }, { data: c }] = await Promise.all([
      supabase.from('vales_distribuidor').select('*, distribuidores(nombre)').order('fecha', { ascending: false }),
      supabase.from('distribuidores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    ])
    setDistribuidores(d || [])
    setClientes(c || [])
    // Apply filters
    let filtrados = v || []
    if (filtroDistribuidor !== 'todos') filtrados = filtrados.filter(x => x.distribuidor_id === filtroDistribuidor)
    if (filtroEstado !== 'todos') filtrados = filtrados.filter(x => x.estado === filtroEstado)
    setVales(filtrados)
    setLoading(false)
  }

  async function guardar() {
    if (!form.distribuidor_id) { setError('Selecciona un distribuidor'); return }
    if (!form.nombre_cliente) { setError('Ingresa el nombre del cliente'); return }
    setSaving(true); setError('')
    const monto = form.tipo_vale === '20' ? 20 : 43
    const { error: e } = await supabase.from('vales_distribuidor').insert({
      distribuidor_id: form.distribuidor_id,
      nombre_cliente: form.nombre_cliente,
      cliente_id: form.cliente_id || null,
      tipo_vale: form.tipo_vale,
      monto,
      fecha: form.fecha,
      notas: form.notas,
      estado: 'pendiente',
      usuario_id: perfil?.id || null
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null)
    setForm({ distribuidor_id: '', nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: new Date().toISOString().split('T')[0], notas: '' })
    cargar()
  }

  async function marcarCobrado(vale) {
    await supabase.from('vales_distribuidor').update({
      estado: 'cobrado',
      fecha_cobro: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    }).eq('id', vale.id)
    cargar()
  }

  async function anular(vale) {
    if (!confirm('¿Anular este vale?')) return
    await supabase.from('vales_distribuidor').update({ estado: 'anulado', updated_at: new Date().toISOString() }).eq('id', vale.id)
    cargar()
  }

  // Resumen por distribuidor
  const resumenPorDist = distribuidores.map(d => {
    const valesDist = vales.filter(v => v.distribuidor_id === d.id && v.estado === 'pendiente')
    const total20 = valesDist.filter(v => v.tipo_vale === '20').length
    const total43 = valesDist.filter(v => v.tipo_vale === '43').length
    const monto = total20 * 20 + total43 * 43
    return { ...d, total20, total43, monto, totalVales: valesDist.length }
  }).filter(d => d.totalVales > 0)

  const totalPendiente = vales.filter(v => v.estado === 'pendiente').reduce((s, v) => s + v.monto, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Vales — Distribuidores</h2>
          <p className="text-gray-500 text-sm">Vales que los clientes dejan a los distribuidores en campo</p>
        </div>
        <button onClick={() => { setForm({ distribuidor_id: distribuidores[0]?.id || '', nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: new Date().toISOString().split('T')[0], notas: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
          <Plus className="w-4 h-4" />Registrar vale
        </button>
      </div>

      {/* Resumen por distribuidor */}
      {resumenPorDist.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resumenPorDist.map(d => (
            <div key={d.id} className="card border border-orange-500/20 cursor-pointer hover:border-orange-500/50 transition-all"
              onClick={() => setFiltroDistribuidor(filtroDistribuidor === d.id ? 'todos' : d.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <Truck className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{d.nombre}</p>
                    <p className="text-gray-500 text-xs">
                      {d.total20 > 0 && `${d.total20} vale(s) S/20`}
                      {d.total20 > 0 && d.total43 > 0 && ' · '}
                      {d.total43 > 0 && `${d.total43} vale(s) S/43`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 font-bold">S/ {d.monto}</p>
                  <p className="text-gray-600 text-xs">{d.totalVales} pendientes</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card border border-yellow-500/20">
          <p className="text-2xl font-bold text-yellow-400">{vales.filter(v => v.estado === 'pendiente').length}</p>
          <p className="text-xs text-gray-500">Vales pendientes</p>
        </div>
        <div className="stat-card border border-orange-500/20">
          <p className="text-2xl font-bold text-orange-400">S/ {totalPendiente}</p>
          <p className="text-xs text-gray-500">Monto pendiente</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <p className="text-2xl font-bold text-emerald-400">{vales.filter(v => v.estado === 'cobrado').length}</p>
          <p className="text-xs text-gray-500">Cobrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtroDistribuidor} onChange={e => setFiltroDistribuidor(e.target.value)}>
          <option value="todos">Todos los distribuidores</option>
          {distribuidores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <div className="flex gap-2">
          {[['pendiente','⏳ Pendientes'],['cobrado','✅ Cobrados'],['todos','Todos']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroEstado(val)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${filtroEstado === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Vales registrados</h3>
          <span className="badge-blue">{vales.filter(v => !busqueda || v.nombre_cliente?.toLowerCase().includes(busqueda.toLowerCase())).length} registros</span>
        </div>
        {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> :
          vales.filter(v => !busqueda || v.nombre_cliente?.toLowerCase().includes(busqueda.toLowerCase())).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
              <Truck className="w-8 h-8 opacity-30" /><p className="text-sm">Sin vales registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {vales.filter(v => !busqueda || v.nombre_cliente?.toLowerCase().includes(busqueda.toLowerCase())).map(v => (
                <div key={v.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm ${v.tipo_vale === '20' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-orange-900/40 text-orange-400'}`}>
                        S/{v.tipo_vale}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{v.nombre_cliente}</p>
                        <p className="text-orange-400 text-xs mt-0.5 flex items-center gap-1">
                          <Truck className="w-3 h-3" />{v.distribuidores?.nombre}
                        </p>
                        <p className="text-gray-600 text-xs mt-0.5">{format(new Date(v.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</p>
                        {v.notas && <p className="text-gray-600 text-xs mt-0.5">{v.notas}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={v.estado === 'pendiente' ? 'badge-yellow' : v.estado === 'cobrado' ? 'badge-green' : 'text-xs text-gray-500'}>
                        {v.estado === 'pendiente' ? '⏳ Pendiente' : v.estado === 'cobrado' ? '✅ Cobrado' : '❌ Anulado'}
                      </span>
                      {v.estado === 'pendiente' && (
                        <div className="flex gap-2">
                          <button onClick={() => anular(v)} className="text-xs text-gray-600 hover:text-red-400 px-2 py-1 rounded-lg border border-gray-700 transition-all">Anular</button>
                          <button onClick={() => marcarCobrado(v)} className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg">✓ Cobrado</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Modal nuevo vale */}
      {modal === 'nuevo' && (
        <Modal title="Registrar vale de distribuidor" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            <div>
              <label className="label">Distribuidor *</label>
              <select className="input" value={form.distribuidor_id} onChange={e => setForm(f => ({...f, distribuidor_id: e.target.value}))}>
                <option value="">-- Seleccionar --</option>
                {distribuidores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>

            <div className="relative">
              <label className="label">Nombre del cliente *</label>
              <input className="input" placeholder="Escribe el nombre..." value={form.nombre_cliente}
                onChange={e => setForm(f => ({...f, nombre_cliente: e.target.value, cliente_id: ''}))} />
              {form.nombre_cliente.length >= 2 && (() => {
                const coincidencias = clientes.filter(c => c.nombre.toLowerCase().includes(form.nombre_cliente.toLowerCase()))
                const exacto = clientes.find(c => c.nombre.toLowerCase() === form.nombre_cliente.toLowerCase())
                if (exacto) return <div className="mt-1 text-xs text-emerald-400 px-1">✅ Cliente registrado</div>
                if (coincidencias.length === 0) return null
                return (
                  <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    {coincidencias.map(c => (
                      <button key={c.id} type="button" onClick={() => setForm(f => ({...f, nombre_cliente: c.nombre, cliente_id: c.id}))}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2">
                        <span className="text-blue-400">👤</span>{c.nombre}
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div>
              <label className="label">Tipo de vale</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setForm(f => ({...f, tipo_vale: '20'}))}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all ${form.tipo_vale === '20' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 20
                </button>
                <button onClick={() => setForm(f => ({...f, tipo_vale: '43'}))}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all ${form.tipo_vale === '43' ? 'bg-orange-900/30 border-orange-500 text-orange-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 43
                </button>
              </div>
            </div>

            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))} />
            </div>

            <div><label className="label">Notas (opcional)</label>
              <input className="input" placeholder="Ej: cliente en Km 12" value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : '✓ Registrar vale'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
