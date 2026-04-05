import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Plus, X, AlertCircle, Search, DollarSign, Package, Ticket, Clock, Edit2, Trash2, Phone, MapPin } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'

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

export default function Clientes() {
  const { perfil } = useAuth()
  const [tab, setTab] = useState('clientes')
  // Página solo clientes
  const [deudas, setDeudas] = useState([])
  const [clientes, setClientes] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('activas')

  const [deudaForm, setDeudaForm] = useState({
    nombre_deudor: '', cliente_id: '', tipo_deuda: 'dinero',
    monto_original: '', cantidad_original: '', fecha_deuda: new Date().toISOString().split('T')[0], notas: ''
  })
  const [pagoForm, setPagoForm] = useState({
    monto_pagado: '', cantidad_pagada: '', metodo_pago: 'efectivo',
    fecha_pago: new Date().toISOString().split('T')[0], notas: ''
  })
  const [clienteForm, setClienteForm] = useState({ nombre: '', dni: '', telefono: '', tipo: 'general', direccion: '', precio_personalizado: '', tipo_balon_personalizado: '10kg' })
  const [deudaClienteModal, setDeudaClienteModal] = useState(null) // deuda activa a mostrar

  useEffect(() => {
    cargar()
    const canal = supabase.channel('clientes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deudas' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [filtroEstado, tab])

  async function cargar() {
    setLoading(true)
    let q = supabase.from('deudas').select('*, clientes(nombre, telefono)').order('fecha_deuda', { ascending: true })
    if (filtroEstado === 'activas') q = q.in('estado', ['activa', 'pagada_parcial'])
    else if (filtroEstado === 'liquidadas') q = q.eq('estado', 'liquidada')
    const [{ data: d }, { data: c }] = await Promise.all([
      q,
      supabase.from('clientes').select('*').eq('es_varios', false).order('nombre')
    ])
    setDeudas(d || [])
    setClientes(c || [])
    setLoading(false)
  }

  async function cargarPagos(deudaId) {
    const { data } = await supabase.from('pagos_deuda').select('*').eq('deuda_id', deudaId).order('fecha_pago', { ascending: false })
    setPagos(data || [])
  }

  async function guardarDeuda() {
    if (!deudaForm.nombre_deudor) { setError('Ingresa el nombre'); return }
    if (deudaForm.tipo_deuda === 'dinero' && !deudaForm.monto_original) { setError('Ingresa el monto'); return }
    if (deudaForm.tipo_deuda !== 'dinero' && !deudaForm.cantidad_original) { setError('Ingresa la cantidad'); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('deudas').insert({
      cliente_id: deudaForm.cliente_id || null,
      nombre_deudor: deudaForm.nombre_deudor,
      tipo_deuda: deudaForm.tipo_deuda,
      monto_original: deudaForm.tipo_deuda === 'dinero' ? parseFloat(deudaForm.monto_original) : null,
      cantidad_original: deudaForm.tipo_deuda !== 'dinero' ? parseInt(deudaForm.cantidad_original) : null,
      monto_pendiente: deudaForm.tipo_deuda === 'dinero' ? parseFloat(deudaForm.monto_original) : null,
      cantidad_pendiente: deudaForm.tipo_deuda !== 'dinero' ? parseInt(deudaForm.cantidad_original) : null,
      fecha_deuda: deudaForm.fecha_deuda, estado: 'activa', notas: deudaForm.notas,
      usuario_id: perfil?.id || null
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function guardarPago() {
    if (!pagoForm.fecha_pago) { setError('Ingresa la fecha'); return }
    if (selected.tipo_deuda === 'dinero' && !pagoForm.monto_pagado) { setError('Ingresa el monto'); return }
    if (selected.tipo_deuda !== 'dinero' && !pagoForm.cantidad_pagada) { setError('Ingresa la cantidad'); return }
    setSaving(true); setError('')
    const { error: e1 } = await supabase.from('pagos_deuda').insert({
      deuda_id: selected.id,
      fecha_pago: pagoForm.fecha_pago,
      monto_pagado: selected.tipo_deuda === 'dinero' ? parseFloat(pagoForm.monto_pagado) : null,
      cantidad_pagada: selected.tipo_deuda !== 'dinero' ? parseInt(pagoForm.cantidad_pagada) : null,
      metodo_pago: selected.tipo_deuda === 'dinero' ? pagoForm.metodo_pago : null,
      notas: pagoForm.notas, usuario_id: perfil?.id || null
    })
    if (e1) { setError(e1.message); setSaving(false); return }
    let updateData = { updated_at: new Date().toISOString() }
    if (selected.tipo_deuda === 'dinero') {
      const nuevo = Math.max(0, (parseFloat(selected.monto_pendiente) || 0) - parseFloat(pagoForm.monto_pagado || 0))
      updateData = { ...updateData, monto_pendiente: nuevo, estado: nuevo <= 0 ? 'liquidada' : 'pagada_parcial' }
    } else {
      const nuevo = Math.max(0, (parseInt(selected.cantidad_pendiente) || 0) - parseInt(pagoForm.cantidad_pagada || 0))
      updateData = { ...updateData, cantidad_pendiente: nuevo, estado: nuevo <= 0 ? 'liquidada' : 'pagada_parcial' }
    }
    await supabase.from('deudas').update(updateData).eq('id', selected.id)
    setSaving(false); setModal(null); cargar()
  }

  async function guardarCliente() {
    if (!clienteForm.nombre) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    // Convertir campos vacíos a null para evitar conflicto con unique constraint
    const datos = {
      ...clienteForm,
      dni: clienteForm.dni?.trim() || null,
      telefono: clienteForm.telefono?.trim() || null,
      precio_personalizado: clienteForm.precio_personalizado ? parseFloat(clienteForm.precio_personalizado) : null,
      tipo_balon_personalizado: clienteForm.tipo_balon_personalizado || '10kg',
    }
    const op = selected
      ? supabase.from('clientes').update({ ...datos, updated_at: new Date().toISOString() }).eq('id', selected.id)
      : supabase.from('clientes').insert({ ...datos })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargar()
  }

  const deudasFiltradas = deudas.filter(d => !busqueda || d.nombre_deudor?.toLowerCase().includes(busqueda.toLowerCase()))
  const clientesFiltrados = clientes.filter(c => {
    const matchNombre = !busqueda || c.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo
    return matchNombre && matchTipo
  }).sort((a, b) => a.nombre?.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
  const totalDeudaDinero = deudas.filter(d => d.tipo_deuda === 'dinero' && d.estado !== 'liquidada').reduce((s, d) => s + (parseFloat(d.monto_pendiente) || 0), 0)
  const totalDeudaBalones = deudas.filter(d => d.tipo_deuda === 'balones' && d.estado !== 'liquidada').reduce((s, d) => s + (parseInt(d.cantidad_pendiente) || 0), 0)
  const iconoTipo = { dinero: DollarSign, balones: Package, vales: Ticket }
  const tipoLabel = { general: 'General', restaurante: 'Restaurante', mayorista: 'Mayorista' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Clientes</h2>
          <p className="text-gray-500 text-sm">Clientes registrados en el sistema</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setSelected(null); setClienteForm({ nombre: '', dni: '', telefono: '', tipo: 'general', direccion: '' }); setError(''); setModal('cliente') }} className="btn-primary">
              <Plus className="w-4 h-4" />Nuevo cliente
            </button>
        </div>
      </div>



      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input className="input pl-9" placeholder={tab === 'clientes' ? 'Buscar cliente...' : 'Buscar deudor...'}
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      {tab === 'clientes' && (
        <div className="flex gap-2 mt-3">
          {[['todos','Todos'],['general','General'],['restaurante','Restaurante'],['mayorista','Mayorista']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroTipo(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filtroTipo === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {label}
              <span className="ml-1.5 text-gray-500">
                {val === 'todos' ? clientes.length : clientes.filter(c => c.tipo === val).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ===== TAB CLIENTES ===== */}
      {tab === 'clientes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div className="stat-card border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-400">{clientes.length}</p>
              <p className="text-xs text-gray-500">Clientes registrados</p>
            </div>
            <div className="stat-card border border-emerald-500/20">
              <p className="text-2xl font-bold text-emerald-400">{clientes.filter(c => c.tipo === 'restaurante').length}</p>
              <p className="text-xs text-gray-500">Restaurantes</p>
            </div>
            <div className="stat-card border border-purple-500/20">
              <p className="text-2xl font-bold text-purple-400">{clientes.filter(c => c.tipo === 'mayorista').length}</p>
              <p className="text-xs text-gray-500">Mayoristas</p>
            </div>
          </div>

          {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> :
            clientesFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
                <Users className="w-8 h-8 opacity-30" /><p className="text-sm">Sin clientes registrados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clientesFiltrados.map(c => {
                  const deudaActiva = deudas.find(d => d.cliente_id === c.id && d.estado !== 'liquidada')
                  return (
                    <div key={c.id} className="card border border-gray-700/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {c.nombre?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-semibold text-sm">{c.nombre}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.tipo === 'restaurante' ? 'bg-orange-900/40 text-orange-400' : c.tipo === 'mayorista' ? 'bg-purple-900/40 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                                {tipoLabel[c.tipo] || c.tipo}
                              </span>
                              {deudaActiva && (
                                <button
                                  onClick={() => setDeudaClienteModal(deudaActiva)}
                                  className="badge-red text-xs hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                  Con deuda
                                </button>
                              )}
                            </div>
                            {c.telefono && <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefono}</p>}
                            {c.direccion && <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" />{c.direccion}</p>}
                            {c.dni && <p className="text-gray-600 text-xs mt-0.5">DNI: {c.dni}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setSelected(c); setClienteForm({ nombre: c.nombre, dni: c.dni||'', telefono: c.telefono||'', tipo: c.tipo||'general', direccion: c.direccion||'', precio_personalizado: c.precio_personalizado||'', tipo_balon_personalizado: c.tipo_balon_personalizado||'10kg' }); setError(''); setModal('cliente') }}
                            className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          {perfil?.rol === 'admin' && (
                            <button onClick={() => eliminarCliente(c.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      )}

      {/* ===== TAB DEUDAS ===== */}
      {tab === 'deudas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">S/ {totalDeudaDinero.toLocaleString('es-PE')}</p>
              <p className="text-xs text-gray-500">Deudas en dinero</p>
            </div>
            <div className="stat-card border border-orange-500/20">
              <p className="text-2xl font-bold text-orange-400">{totalDeudaBalones} bal.</p>
              <p className="text-xs text-gray-500">Balones prestados</p>
            </div>
            <div className="stat-card border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-400">{deudas.length}</p>
              <p className="text-xs text-gray-500">{filtroEstado === 'liquidadas' ? 'Liquidadas' : 'Deudores activos'}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {[['activas','🔴 Con deuda'],['liquidadas','✅ Sin deuda'],['todas','Todas']].map(([val, label]) => (
              <button key={val} onClick={() => setFiltroEstado(val)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${filtroEstado === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {filtroEstado === 'activas' ? 'Deudas activas' : filtroEstado === 'liquidadas' ? 'Liquidadas' : 'Todas'}
              </h3>
              <span className={filtroEstado === 'liquidadas' ? 'badge-green' : 'badge-red'}>{deudasFiltradas.length} registros</span>
            </div>
            {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> :
              deudasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
                  <Users className="w-8 h-8 opacity-30" />
                  <p className="text-sm">{filtroEstado === 'liquidadas' ? 'Sin deudas liquidadas' : 'Sin deudas activas'}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {deudasFiltradas.map(d => {
                    const dias = differenceInDays(new Date(), new Date(d.fecha_deuda))
                    const Icon = iconoTipo[d.tipo_deuda] || DollarSign
                    const pendiente = d.tipo_deuda === 'dinero' ? `S/ ${Number(d.monto_pendiente).toLocaleString('es-PE')}` : `${d.cantidad_pendiente} ${d.tipo_deuda}`
                    const original = d.tipo_deuda === 'dinero' ? `S/ ${Number(d.monto_original).toLocaleString('es-PE')}` : `${d.cantidad_original} ${d.tipo_deuda}`
                    return (
                      <div key={d.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${d.tipo_deuda === 'dinero' ? 'bg-red-500/10' : d.tipo_deuda === 'balones' ? 'bg-orange-500/10' : 'bg-yellow-500/10'}`}>
                              <Icon className={`w-4 h-4 ${d.tipo_deuda === 'dinero' ? 'text-red-400' : d.tipo_deuda === 'balones' ? 'text-orange-400' : 'text-yellow-400'}`} />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{d.nombre_deudor}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className={d.estado === 'liquidada' ? 'badge-green' : d.estado === 'pagada_parcial' ? 'badge-yellow' : 'badge-red'}>
                                  {d.estado === 'liquidada' ? '✅ Liquidada' : d.estado === 'pagada_parcial' ? 'Parcial' : 'Activa'}
                                </span>
                                <span className="text-gray-600 text-xs capitalize">{d.tipo_deuda}</span>
                                <span className="text-gray-600 text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(d.fecha_deuda + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })} ({dias} días)
                                </span>
                              </div>
                              {d.notas && <p className="text-gray-600 text-xs mt-1">{d.notas}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-sm ${d.estado === 'liquidada' ? 'text-emerald-400' : 'text-white'}`}>{pendiente}</p>
                            {original !== pendiente && <p className="text-gray-600 text-xs">Original: {original}</p>}
                            <div className="flex gap-2 mt-2 justify-end">
                              <button onClick={async () => { setSelected(d); await cargarPagos(d.id); setModal('historial') }}
                                className="text-xs bg-blue-600/20 border border-blue-600/30 text-blue-400 px-2 py-1 rounded-lg">Historial</button>
                              {d.estado !== 'liquidada' && (
                                <button onClick={() => { setSelected(d); setPagoForm({ monto_pagado: '', cantidad_pagada: '', metodo_pago: 'efectivo', fecha_pago: new Date().toISOString().split('T')[0], notas: '' }); setError(''); setModal('pago') }}
                                  className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg">Registrar pago</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Modal cliente */}
      {modal === 'cliente' && (
        <Modal title={selected ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre *</label><input className="input" value={clienteForm.nombre} onChange={e => setClienteForm(f => ({...f, nombre: e.target.value}))} autoFocus /></div>
            <div><label className="label">DNI</label><input className="input" value={clienteForm.dni} onChange={e => setClienteForm(f => ({...f, dni: e.target.value}))} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={clienteForm.telefono} onChange={e => setClienteForm(f => ({...f, telefono: e.target.value}))} /></div>
            <div>
              <label className="label">Tipo de cliente</label>
              <div className="grid grid-cols-3 gap-2">
                {[['general','👤 General'],['restaurante','🍽️ Restaurante'],['mayorista','📦 Mayorista']].map(([val, label]) => (
                  <button key={val} onClick={() => setClienteForm(f => ({...f, tipo: val}))}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all ${clienteForm.tipo === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="label">Dirección</label><input className="input" value={clienteForm.direccion} onChange={e => setClienteForm(f => ({...f, direccion: e.target.value}))} /></div>
            
            {/* Precio personalizado */}
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 space-y-3">
              <p className="text-xs text-blue-300 font-medium">💰 Precio especial (opcional)</p>
              <p className="text-xs text-gray-500">Si este cliente siempre compra a un precio fijo, ingrésalo aquí. Se usará automáticamente al vender.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio S/</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">S/</span>
                    <input type="number" min="0" step="0.50" className="input pl-9"
                      placeholder="Ej: 48"
                      value={clienteForm.precio_personalizado}
                      onChange={e => setClienteForm(f => ({...f, precio_personalizado: e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label className="label">Tipo de balón</label>
                  <div className="flex gap-1">
                    {['5kg','10kg','45kg'].map(t => (
                      <button key={t} type="button" onClick={() => setClienteForm(f => ({...f, tipo_balon_personalizado: t}))}
                        className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${clienteForm.tipo_balon_personalizado === t ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {clienteForm.precio_personalizado && (
                <p className="text-xs text-emerald-400">✅ Al vender a este cliente, el precio {clienteForm.tipo_balon_personalizado} se pondrá en S/ {clienteForm.precio_personalizado} automáticamente.</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCliente} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : selected ? 'Actualizar' : '✓ Registrar cliente'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal deuda */}
      {modal === 'deuda' && (
        <Modal title="Registrar deuda" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="relative">
              <label className="label">Nombre del deudor *</label>
              <input className="input" placeholder="Escribe el nombre..." value={deudaForm.nombre_deudor}
                onChange={e => setDeudaForm(f => ({...f, nombre_deudor: e.target.value, cliente_id: ''}))} />
              {deudaForm.nombre_deudor.length >= 2 && (() => {
                const coincidencias = clientes.filter(c => c.nombre.toLowerCase().includes(deudaForm.nombre_deudor.toLowerCase()))
                const exacto = clientes.find(c => c.nombre.toLowerCase() === deudaForm.nombre_deudor.toLowerCase())
                if (exacto) return <div className="mt-1 text-xs text-emerald-400 px-1">✅ Cliente registrado</div>
                return (
                  <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    {coincidencias.map(c => (
                      <button key={c.id} type="button" onClick={() => setDeudaForm(f => ({...f, nombre_deudor: c.nombre, cliente_id: c.id}))}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors flex items-center gap-2">
                        <span className="text-blue-400">👤</span> {c.nombre}
                      </button>
                    ))}
                    {coincidencias.length === 0 && (
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">No registrado</span>
                        <button type="button" onClick={() => { setClienteForm({ nombre: deudaForm.nombre_deudor, dni: '', telefono: '', tipo: 'general', direccion: '' }); setModal('clienteDesdeDeuda') }}
                          className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg">+ Registrar cliente</button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="label">Tipo de deuda</label>
              <div className="grid grid-cols-3 gap-2">
                {[['dinero','💰 Dinero'],['balones','🔵 Balones'],['vales','🎫 Vales']].map(([val, label]) => (
                  <button key={val} onClick={() => setDeudaForm(f => ({...f, tipo_deuda: val}))}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all ${deudaForm.tipo_deuda === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {deudaForm.tipo_deuda === 'dinero'
              ? <div><label className="label">Monto (S/) *</label><input type="number" className="input" placeholder="100" value={deudaForm.monto_original} onChange={e => setDeudaForm(f => ({...f, monto_original: e.target.value}))} /></div>
              : <div><label className="label">Cantidad ({deudaForm.tipo_deuda}) *</label><input type="number" className="input" placeholder="5" value={deudaForm.cantidad_original} onChange={e => setDeudaForm(f => ({...f, cantidad_original: e.target.value}))} /></div>
            }
            <div><label className="label">Fecha</label><input type="date" className="input" value={deudaForm.fecha_deuda} onChange={e => setDeudaForm(f => ({...f, fecha_deuda: e.target.value}))} /></div>
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={deudaForm.notas} onChange={e => setDeudaForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarDeuda} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : '✓ Registrar deuda'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal cliente desde deuda */}
      {modal === 'clienteDesdeDeuda' && (
        <Modal title="Registrar cliente" onClose={() => setModal('deuda')}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre *</label><input className="input" value={clienteForm.nombre} onChange={e => setClienteForm(f => ({...f, nombre: e.target.value}))} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={clienteForm.telefono} onChange={e => setClienteForm(f => ({...f, telefono: e.target.value}))} /></div>
            <div>
              <label className="label">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {[['general','👤 General'],['restaurante','🍽️ Restaurante'],['mayorista','📦 Mayorista']].map(([val, label]) => (
                  <button key={val} onClick={() => setClienteForm(f => ({...f, tipo: val}))}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all ${clienteForm.tipo === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal('deuda')} className="btn-secondary flex-1">Volver</button>
              <button onClick={async () => {
                if (!clienteForm.nombre) { setError('El nombre es obligatorio'); return }
                setSaving(true)
                const { data: nc } = await supabase.from('clientes').insert({ nombre: clienteForm.nombre, telefono: clienteForm.telefono, tipo: clienteForm.tipo }).select().single()
                await cargar()
                if (nc) setDeudaForm(f => ({...f, nombre_deudor: nc.nombre, cliente_id: nc.id}))
                setSaving(false); setModal('deuda')
              }} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : '✓ Registrar y continuar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal pago */}
      {modal === 'pago' && selected && (
        <Modal title={`Registrar pago — ${selected.nombre_deudor}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-gray-800/50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Tipo</p><p className="text-sm font-bold text-white capitalize">{selected.tipo_deuda === 'dinero' ? '💰 Dinero' : selected.tipo_deuda === 'balones' ? '🔵 Balones' : '🎫 Vales'}</p></div>
              <div><p className="text-xs text-gray-500">Pendiente</p>
                <p className="text-lg font-bold text-red-400">{selected.tipo_deuda === 'dinero' ? `S/ ${Number(selected.monto_pendiente).toLocaleString()}` : `${selected.cantidad_pendiente} ${selected.tipo_deuda}`}</p>
              </div>
            </div>
            {selected.tipo_deuda === 'dinero' ? (
              <>
                <div><label className="label">Monto pagado (S/)</label><input type="number" className="input" placeholder="0" value={pagoForm.monto_pagado} onChange={e => setPagoForm(f => ({...f, monto_pagado: e.target.value}))} /></div>
                <div>
                  <label className="label">Método de pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[['efectivo','💵 Efectivo'],['yape','📱 Yape'],['mixto','🔀 Mixto']].map(([val, label]) => (
                      <button key={val} onClick={() => setPagoForm(f => ({...f, metodo_pago: val}))}
                        className={`py-2 rounded-lg border text-xs font-medium ${pagoForm.metodo_pago === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div><label className="label">Cantidad devuelta ({selected.tipo_deuda})</label><input type="number" className="input" placeholder="0" value={pagoForm.cantidad_pagada} onChange={e => setPagoForm(f => ({...f, cantidad_pagada: e.target.value}))} /></div>
            )}
            <div><label className="label">Fecha de pago</label><input type="date" className="input" value={pagoForm.fecha_pago} onChange={e => setPagoForm(f => ({...f, fecha_pago: e.target.value}))} /></div>
            <div><label className="label">Notas</label><input className="input" value={pagoForm.notas} onChange={e => setPagoForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarPago} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg flex-1 justify-center flex items-center gap-2">{saving ? 'Guardando...' : '✓ Registrar pago'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal historial */}
      {modal === 'historial' && selected && (
        <Modal title={`Historial — ${selected.nombre_deudor}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Fecha de la deuda</p><p className="text-sm font-semibold text-white">{format(new Date(selected.fecha_deuda + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })}</p></div>
              <div><p className="text-xs text-gray-500">Estado</p><span className={selected.estado === 'liquidada' ? 'badge-green' : selected.estado === 'pagada_parcial' ? 'badge-yellow' : 'badge-red'}>{selected.estado === 'liquidada' ? '✅ Liquidada' : selected.estado === 'pagada_parcial' ? 'Pago parcial' : 'Activa'}</span></div>
              <div><p className="text-xs text-gray-500">Deuda original</p><p className="text-lg font-bold text-white">{selected.tipo_deuda === 'dinero' ? `S/ ${Number(selected.monto_original).toLocaleString()}` : `${selected.cantidad_original} ${selected.tipo_deuda}`}</p></div>
              <div><p className="text-xs text-gray-500">Pendiente</p><p className="text-lg font-bold text-red-400">{selected.tipo_deuda === 'dinero' ? `S/ ${Number(selected.monto_pendiente).toLocaleString()}` : `${selected.cantidad_pendiente} ${selected.tipo_deuda}`}</p></div>
            </div>
            <h4 className="text-sm font-semibold text-white">Pagos registrados</h4>
            {pagos.length === 0 ? <p className="text-center text-gray-600 text-sm py-4">Sin pagos registrados</p> : (
              <div className="space-y-2">
                {pagos.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{selected.tipo_deuda === 'dinero' ? `S/ ${Number(p.monto_pagado).toLocaleString()}` : `${p.cantidad_pagada} ${selected.tipo_deuda}`}</p>
                      <p className="text-gray-500 text-xs mt-0.5">📅 {format(new Date(p.fecha_pago + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })}{p.metodo_pago && ` · ${p.metodo_pago}`}</p>
                      {p.notas && <p className="text-gray-600 text-xs mt-0.5">{p.notas}</p>}
                    </div>
                    <span className="badge-green">✓ Pagado</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal deuda rápida desde badge */}
      {deudaClienteModal && (
        <Modal title={`Deuda — ${deudaClienteModal.nombre_deudor}`} onClose={() => setDeudaClienteModal(null)}>
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">Deuda pendiente:</p>
              <div className="flex flex-wrap gap-2">
                {parseFloat(deudaClienteModal.monto_pendiente) > 0 && (
                  <span className="text-sm bg-red-900/40 text-red-300 px-3 py-1 rounded-lg font-bold">
                    💰 S/ {Number(deudaClienteModal.monto_pendiente).toLocaleString('es-PE')}
                  </span>
                )}
                {parseInt(deudaClienteModal.balones_pendiente) > 0 && (
                  <span className="text-sm bg-orange-900/40 text-orange-300 px-3 py-1 rounded-lg font-bold">
                    🔵 {deudaClienteModal.balones_pendiente} bal.
                  </span>
                )}
                {parseInt(deudaClienteModal.vales_20_pendiente) > 0 && (
                  <span className="text-sm bg-yellow-900/40 text-yellow-300 px-3 py-1 rounded-lg font-bold">
                    🎫 {deudaClienteModal.vales_20_pendiente}×S/20
                  </span>
                )}
                {parseInt(deudaClienteModal.vales_43_pendiente) > 0 && (
                  <span className="text-sm bg-yellow-900/40 text-yellow-300 px-3 py-1 rounded-lg font-bold">
                    🎫 {deudaClienteModal.vales_43_pendiente}×S/43
                  </span>
                )}
              </div>
              <div className="flex gap-3 mt-2 text-xs text-gray-500">
                <span>📅 Desde: {format(new Date(deudaClienteModal.fecha_deuda + 'T12:00:00'), "dd/MM/yyyy", { locale: es })}</span>
                <span className={`font-medium ${deudaClienteModal.estado === 'pagada_parcial' ? 'text-yellow-400' : 'text-red-400'}`}>
                  {deudaClienteModal.estado === 'pagada_parcial' ? '⚡ Pago parcial' : '🔴 Activa'}
                </span>
              </div>
              {deudaClienteModal.notas && <p className="text-gray-500 text-xs mt-1 italic">"{deudaClienteModal.notas}"</p>}
            </div>
            {(deudaClienteModal.historial || []).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">📋 Historial de movimientos:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {(deudaClienteModal.historial || []).map((h, i) => {
                    const esPago = h.tipo === 'pago'
                    const items = []
                    if (parseFloat(h.monto) > 0) items.push(`S/ ${Number(h.monto).toLocaleString('es-PE')}`)
                    if (parseInt(h.balones) > 0) items.push(`${h.balones} bal. ${h.tipo_balon || ''}`.trim())
                    if (parseInt(h.vales_20) > 0) items.push(`${h.vales_20}×S/20`)
                    if (parseInt(h.vales_43) > 0) items.push(`${h.vales_43}×S/43`)
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg p-3 border ${esPago ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-red-900/20 border-red-800/30'}`}>
                        <span>{esPago ? '💚' : '🔴'}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className={`text-xs font-semibold ${esPago ? 'text-emerald-300' : 'text-red-300'}`}>
                                {esPago ? `Pagó${h.metodo_pago ? ' · ' + h.metodo_pago : ''}` : (i === 0 ? 'Deuda inicial' : 'Deuda adicional')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {h.fecha ? format(new Date(h.fecha + 'T12:00:00'), "dd/MM/yyyy", { locale: es }) : '—'}
                              </p>
                              {h.notas && <p className="text-gray-600 text-xs italic">"{h.notas}"</p>}
                            </div>
                            <p className={`text-sm font-bold flex-shrink-0 ${esPago ? 'text-emerald-300' : 'text-red-300'}`}>
                              {esPago ? '-' : '+'}{items.join(' + ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <button onClick={() => setDeudaClienteModal(null)} className="btn-secondary w-full">Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
