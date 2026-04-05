import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru, inicioDiaPeru, finDiaPeru, nowPeru } from '../lib/fechas'
import { ShoppingCart, Plus, X, AlertCircle, Trash2, Search } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'

const TIPOS_BALON = ['5kg', '10kg', '45kg']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Ventas() {
  const { perfil } = useAuth()
  const [ventas, setVentas] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [precioTipos, setPrecioTipos] = useState([])
  const [preciosPorTipo, setPreciosPorTipo] = useState([])
  const [stockPorTipo, setStockPorTipo] = useState([])
  const [clientes, setClientes] = useState([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre: '', telefono: '' })
  const [subModal, setSubModal] = useState(null)
  const [ventaAEliminar, setVentaAEliminar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroFecha, setFiltroFecha] = useState(hoyPeru())

  const [form, setForm] = useState({
    cliente_id: '', cliente_nombre: '', es_varios: false,
    almacen_id: '', precio_tipo_id: '', tipo_balon: '10kg',
    cantidad: '', precio_unitario: '', metodo_pago: 'efectivo', notas: '',
    fecha: hoyPeru(), al_credito: false, precio_especial_activo: false
  })

  useEffect(() => { cargar() }, [filtroFecha])

  const [distribuidores, setDistribuidores] = useState([])

  async function cargar() {
    setLoading(true)
    const [{ data: v }, { data: a }, { data: pt }, { data: c }, { data: ptb }, { data: spt }, { data: dist }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre), almacenes(nombre), precio_tipos(nombre)')
        .gte('fecha', filtroFecha + 'T00:00:00-05:00').lte('fecha', filtroFecha + 'T23:59:59-05:00').order('fecha', { ascending: false }),
      supabase.from('almacenes').select('id, nombre, stock_actual').eq('activo', true).order('nombre'),
      supabase.from('precio_tipos').select('*').eq('activo', true),
      supabase.from('clientes').select('id, nombre, tipo, es_varios, precio_personalizado, tipo_balon_personalizado').order('nombre').limit(100),
      supabase.from('precio_tipo_balon').select('*'),
      supabase.from('stock_por_tipo').select('*'),
      supabase.from('distribuidores').select('id, nombre, almacen_id, precio_base').eq('activo', true)
    ])
    setVentas(v || [])
    setAlmacenes(a || [])
    setPrecioTipos(pt || [])
    setClientes(c || [])
    setPreciosPorTipo(ptb || [])
    setStockPorTipo(spt || [])
    setDistribuidores(dist || [])
    setLoading(false)
  }

  function getPrecio(precioTipoId, tipoBalon) {
    const p = preciosPorTipo.find(p => p.precio_tipo_id === precioTipoId && p.tipo_balon === tipoBalon)
    return p?.precio || ''
  }

  function getStock(almacenId, tipoBalon) {
    const s = stockPorTipo.find(s => s.almacen_id === almacenId && s.tipo_balon === tipoBalon)
    return s?.stock_actual || 0
  }

  function abrirModal() {
    const clienteVarios = clientes.find(c => c.es_varios)
    const tiendaPrincipal = almacenes.find(a => a.nombre.toLowerCase().includes('tienda')) || almacenes[0]
    const primerTipo = precioTipos[0]
    setForm({
      cliente_id: clienteVarios?.id || '', cliente_nombre: 'Cliente Varios', es_varios: true,
      almacen_id: tiendaPrincipal?.id || '', precio_tipo_id: primerTipo?.id || '',
      tipo_balon: '10kg', cantidad: '',
      precio_unitario: getPrecio(primerTipo?.id, '10kg') || primerTipo?.precio || '',
      metodo_pago: 'efectivo', notas: '', fecha: hoyPeru(), al_credito: false, precio_especial_activo: false
    })
    setError(''); setModal(true); setBusquedaCliente(''); setSubModal(null)
  }

  function seleccionarTipoPrecio(tipoId) {
    // Si el cliente tiene precio especial, no sobreescribir
    if (form.precio_especial_activo) return
    const precio = getPrecio(tipoId, form.tipo_balon)
    setForm(f => ({ ...f, precio_tipo_id: tipoId, precio_unitario: precio }))
  }

  function seleccionarTipoBalon(tipoBalon) {
    // Si el cliente tiene precio especial, solo cambiar el tipo, no el precio
    if (form.precio_especial_activo) {
      setForm(f => ({ ...f, tipo_balon: tipoBalon }))
      return
    }
    const precio = getPrecio(form.precio_tipo_id, tipoBalon)
    setForm(f => ({ ...f, tipo_balon: tipoBalon, precio_unitario: precio }))
  }

  function seleccionarCliente(clienteId) {
    const c = clientes.find(c => c.id === clienteId)
    if (!c) return
    const tipoPrecio = precioTipos.find(t => t.nombre.toLowerCase().includes(c.tipo)) || precioTipos[0]
    if (c.precio_personalizado && c.tipo_balon_personalizado) {
      setForm(f => ({
        ...f, cliente_id: c.id, cliente_nombre: c.nombre, es_varios: c.es_varios,
        precio_tipo_id: tipoPrecio?.id || '',
        tipo_balon: c.tipo_balon_personalizado,
        precio_unitario: c.precio_personalizado,
        precio_especial_activo: true
      }))
    } else {
      const precio = getPrecio(tipoPrecio?.id, form.tipo_balon)
      setForm(f => ({
        ...f, cliente_id: c.id, cliente_nombre: c.nombre, es_varios: c.es_varios,
        precio_tipo_id: tipoPrecio?.id || '', precio_unitario: precio || tipoPrecio?.precio || '',
        precio_especial_activo: false
      }))
    }
  }

  async function eliminarVenta(venta) {
    if (!confirm(`¿Eliminar venta de ${venta.clientes?.nombre || 'Cliente Varios'} — S/${(venta.cantidad * venta.precio_unitario).toFixed(2)}?`)) return
    // Restaurar stock_por_tipo (por tipo de balón)
    const stockActual = getStock(venta.almacen_id, venta.tipo_balon || '10kg')
    await supabase.from('stock_por_tipo')
      .update({ stock_actual: stockActual + venta.cantidad, updated_at: new Date().toISOString() })
      .eq('almacen_id', venta.almacen_id).eq('tipo_balon', venta.tipo_balon || '10kg')
    // Restaurar stock_actual y restar vacíos en almacenes
    const almacen = almacenes.find(a => a.id === venta.almacen_id)
    if (almacen) {
      const tipo = venta.tipo_balon || '10kg'
      const campoVacios = tipo === '5kg' ? 'vacios_5kg' : tipo === '10kg' ? 'vacios_10kg' : 'vacios_45kg'
      await supabase.from('almacenes')
        .update({
          stock_actual: (almacen.stock_actual || 0) + venta.cantidad,
          balones_vacios: Math.max(0, (almacen.balones_vacios || 0) - venta.cantidad),
          [campoVacios]: Math.max(0, (almacen[campoVacios] || 0) - venta.cantidad)
        })
        .eq('id', venta.almacen_id)
    }
    await supabase.from('ventas').delete().eq('id', venta.id)
    cargar()
  }

  async function guardarClienteRapido() {
    if (!clienteRapidoForm.nombre) return
    const { data: nc } = await supabase.from('clientes').insert({
      nombre: clienteRapidoForm.nombre, telefono: clienteRapidoForm.telefono, tipo: 'general'
    }).select().single()
    if (nc) {
      setClientes(cs => [...cs, nc].sort((a,b) => a.nombre.localeCompare(b.nombre)))
      seleccionarCliente(nc.id)
      setBusquedaCliente(nc.nombre)
    }
    setClienteRapidoForm({ nombre: '', telefono: '' })
    setSubModal(null)
  }

  async function guardar() {
    if (!form.almacen_id || !form.cantidad || !form.precio_unitario) { setError('Completa todos los campos'); return }
    if (form.al_credito && form.es_varios) { setError('Para venta al crédito debes seleccionar un cliente específico'); return }
    const stockDisp = getStock(form.almacen_id, form.tipo_balon)
    if (stockDisp < parseInt(form.cantidad)) {
      setError(`Stock insuficiente de ${form.tipo_balon}. Disponible: ${stockDisp} balones`); return
    }
    setSaving(true); setError('')
    const metodo = form.al_credito ? 'credito' : form.metodo_pago
    const { error: e } = await supabase.from('ventas').insert({
      cliente_id: form.cliente_id || null,
      almacen_id: form.almacen_id,
      precio_tipo_id: form.precio_tipo_id || null,
      tipo_balon: form.tipo_balon,
      fecha: (form.fecha || hoyPeru()) + 'T12:00:00-05:00',
      cantidad: parseInt(form.cantidad),
      precio_unitario: parseFloat(form.precio_unitario),
      metodo_pago: metodo,
      notas: form.notas,
      usuario_id: perfil?.id || null
    })
    if (e) { setError(e.message); setSaving(false); return }
    // Descontar stock_por_tipo
    await supabase.from('stock_por_tipo')
      .update({ stock_actual: stockDisp - parseInt(form.cantidad), updated_at: new Date().toISOString() })
      .eq('almacen_id', form.almacen_id).eq('tipo_balon', form.tipo_balon)
    // Descontar stock_actual en almacenes
    // Si es al crédito NO suma vacíos (el balón está en la calle, no regresó)
    const almacen = almacenes.find(a => a.id === form.almacen_id)
    if (almacen) {
      const cant = parseInt(form.cantidad)
      const campoVacios = form.tipo_balon === '5kg' ? 'vacios_5kg' : form.tipo_balon === '10kg' ? 'vacios_10kg' : 'vacios_45kg'
      if (form.al_credito) {
        // Solo descuenta llenos, NO suma vacíos (balón en la calle)
        await supabase.from('almacenes')
          .update({ stock_actual: Math.max(0, (almacen.stock_actual || 0) - cant) })
          .eq('id', form.almacen_id)
      } else {
        await supabase.from('almacenes')
          .update({
            stock_actual: Math.max(0, (almacen.stock_actual || 0) - cant),
            balones_vacios: (almacen.balones_vacios || 0) + cant,
            [campoVacios]: (almacen[campoVacios] || 0) + cant
          })
          .eq('id', form.almacen_id)
      }
    }
    // Si es al crédito → crear deuda automáticamente
    if (form.al_credito) {
      const monto = parseInt(form.cantidad) * parseFloat(form.precio_unitario)
      const entradaHistorial = {
        tipo: 'deuda', fecha: form.fecha,
        monto, balones: parseInt(form.cantidad),
        tipo_balon: form.tipo_balon,
        vales_20: 0, vales_43: 0,
        notas: `Venta al crédito — ${form.tipo_balon} × ${form.cantidad}`
      }
      await supabase.from('deudas').insert({
        cliente_id: form.cliente_id || null,
        nombre_deudor: form.cliente_nombre,
        tipo_deuda: 'mixto',
        monto_original: monto, monto_pendiente: monto,
        cantidad_original: parseInt(form.cantidad), cantidad_pendiente: parseInt(form.cantidad),
        balones_pendiente: parseInt(form.cantidad),
        vales_20_pendiente: 0, vales_43_pendiente: 0,
        fecha_deuda: form.fecha, estado: 'activa',
        notas: form.notas || `Venta al crédito ${form.tipo_balon}`,
        historial: [entradaHistorial],
        almacen_id: form.almacen_id || null,
        usuario_id: perfil?.id || null
      })
    }
    setSaving(false); setModal(false); cargar()
  }

  const ventasFiltradas = ventas.filter(v =>
    !busqueda || v.clientes?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )
  const totalDia = ventas.reduce((s, v) => s + (v.cantidad * v.precio_unitario), 0)
  const totalBalones = ventas.reduce((s, v) => s + v.cantidad, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Ventas</h2><p className="text-gray-500 text-sm">Registro de ventas diarias</p></div>
        <button onClick={abrirModal} className="btn-primary"><Plus className="w-4 h-4" />Nueva venta</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-end gap-2">
          <div><label className="label">Filtrar por fecha</label><input type="date" className="input" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} /></div>
          <button onClick={() => setFiltroFecha(hoyPeru())} className="btn-secondary py-2 text-xs">📅 Hoy</button>
          <button onClick={() => setFiltroFecha(new Date(new Date().setDate(new Date().getDate()-1)).toISOString().split('T')[0])} className="btn-secondary py-2 text-xs">⬅ Ayer</button>
        </div>
        <div className="stat-card border border-blue-500/20"><p className="text-2xl font-bold text-white">{totalBalones}</p><p className="text-xs text-gray-500">Balones vendidos</p></div>
        <div className="stat-card border border-emerald-500/20"><p className="text-2xl font-bold text-emerald-400">S/ {totalDia.toLocaleString('es-PE')}</p><p className="text-xs text-gray-500">Ingresos del día</p></div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input className="input pl-9" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Ventas del {format(new Date(filtroFecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</h3>
          <span className="badge-blue">{ventasFiltradas.length} ventas</span>
        </div>
        {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> :
          ventasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
              <ShoppingCart className="w-8 h-8 opacity-30" /><p className="text-sm">Sin ventas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Hora','Cliente','Almacén','Tipo cliente','Balón','Cant.','Precio','Total','Pago',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {ventasFiltradas.map(v => (
                    <tr key={v.id} className="table-row-hover">
                      <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(v.fecha), 'HH:mm')}</td>
                      <td className="px-4 py-3 text-white text-sm font-medium">{v.clientes?.nombre || 'Cliente Varios'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{v.almacenes?.nombre}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{v.precio_tipos?.nombre || '-'}</td>
                      <td className="px-4 py-3"><span className="badge-blue">{v.tipo_balon || '10kg'}</span></td>
                      <td className="px-4 py-3 text-blue-400 font-bold">{v.cantidad}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">S/{v.precio_unitario}</td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">S/{(v.cantidad * v.precio_unitario).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.metodo_pago === 'efectivo' ? 'bg-emerald-900/40 text-emerald-400' :
                        v.metodo_pago === 'yape' ? 'bg-blue-900/40 text-blue-400' :
                        v.metodo_pago === 'vale' ? 'bg-yellow-900/40 text-yellow-400' :
                        v.metodo_pago === 'credito' ? 'bg-orange-900/40 text-orange-400' :
                        v.metodo_pago === 'cobro_credito' ? 'bg-teal-900/40 text-teal-400' :
                        v.metodo_pago === 'credito_distribuidor' ? 'bg-purple-900/40 text-purple-400' :
                        v.metodo_pago === 'cobro_distribuidor' ? 'bg-indigo-900/40 text-indigo-400' :
                        v.metodo_pago === 'abono_distribuidor' ? 'bg-cyan-900/40 text-cyan-400' :
                        'bg-gray-900/40 text-gray-400'
                      }`}>{
                        v.metodo_pago === 'credito' ? '💳 Crédito' :
                        v.metodo_pago === 'cobro_credito' ? '✅ Cobro crédito' :
                        v.metodo_pago === 'credito_distribuidor' ? '🚛 Distribuidor' :
                        v.metodo_pago === 'cobro_distribuidor' ? '✅ Cobro dist.' :
                        v.metodo_pago === 'abono_distribuidor' ? '💰 Abono dist.' :
                        v.metodo_pago
                      }</span></td>
                      <td className="px-4 py-3">
                        <button onClick={() => eliminarVenta(v)}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900/20"
                          title="Eliminar venta">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal && (
        <Modal title="Registrar venta" onClose={() => setModal(false)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="relative">
              <label className="label">Cliente</label>
              <input className="input" placeholder="Buscar cliente por nombre..."
                value={busquedaCliente}
                onChange={e => { setBusquedaCliente(e.target.value); if (!e.target.value) { const v = clientes.find(c => c.es_varios); if(v) seleccionarCliente(v.id) } }}
                autoFocus />
              {busquedaCliente.length >= 1 && (() => {
                const coincidencias = clientes.filter(c => !c.es_varios && c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
                const exacto = clientes.find(c => c.nombre.toLowerCase() === busquedaCliente.toLowerCase())
                if (exacto && !exacto.es_varios) return (
                  <div className="mt-1 flex items-center gap-2 text-xs text-emerald-400 px-1">✅ {exacto.nombre}</div>
                )
                return (
                  <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-10">
                    {coincidencias.slice(0,6).map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { seleccionarCliente(c.id); setBusquedaCliente(c.nombre) }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2">
                        <span className="text-blue-400">👤</span>{c.nombre}
                        <span className="ml-auto text-xs text-gray-500 capitalize">{c.tipo}</span>
                      </button>
                    ))}
                    <div className="px-3 py-2 flex items-center justify-between border-t border-gray-700">
                      <span className="text-xs text-gray-500">
                        {coincidencias.length === 0 ? 'No encontrado' : `${coincidencias.length} resultado(s)`}
                      </span>
                      <button type="button"
                        onClick={() => { setClienteRapidoForm({ nombre: busquedaCliente, telefono: '' }); setSubModal('clienteRapido') }}
                        className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-600/50">
                        + Registrar cliente
                      </button>
                    </div>
                  </div>
                )
              })()}
              {!busquedaCliente && (
                <p className="text-xs text-gray-500 mt-1 px-1">Dejando vacío → Cliente Varios (sin registro)</p>
              )}
            </div>
            <div>
              <label className="label">Almacén</label>
              <select className="input" value={form.almacen_id} onChange={e => {
                const almacenId = e.target.value
                const dist = distribuidores.find(d => d.almacen_id === almacenId)
                if (dist) {
                  setBusquedaCliente(dist.nombre)
                  setForm(f => ({
                    ...f,
                    almacen_id: almacenId,
                    cliente_id: '',
                    cliente_nombre: dist.nombre,
                    es_varios: false,
                    precio_unitario: dist.precio_base || f.precio_unitario,
                    al_credito: true,
                    precio_especial_activo: !!dist.precio_base
                  }))
                } else {
                  const clienteVarios = clientes.find(c => c.es_varios)
                  setBusquedaCliente('')
                  setForm(f => ({
                    ...f,
                    almacen_id: almacenId,
                    cliente_id: clienteVarios?.id || '',
                    cliente_nombre: 'Cliente Varios',
                    es_varios: true,
                    al_credito: false,
                    precio_especial_activo: false
                  }))
                }
              }}>
                {almacenes.map(a => {
                  const dist = distribuidores.find(d => d.almacen_id === a.id)
                  return <option key={a.id} value={a.id}>{a.nombre}{dist ? ` — ${dist.nombre}` : ''}</option>
                })}
              </select>
              {distribuidores.find(d => d.almacen_id === form.almacen_id) && (
                <p className="text-xs text-purple-400 mt-1 px-1">
                  🚛 Almacén de distribuidor — venta al crédito activada automáticamente
                </p>
              )}
            </div>
            <div>
              <label className="label">Tipo de balón</label>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_BALON.map(tipo => {
                  const stock = getStock(form.almacen_id, tipo)
                  return (
                    <button key={tipo} onClick={() => seleccionarTipoBalon(tipo)}
                      className={`py-3 px-3 rounded-lg border text-xs font-medium transition-all text-center ${form.tipo_balon === tipo ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                      🔵 {tipo}<br/>
                      <span className={`text-xs ${stock === 0 ? 'text-red-400' : stock < 5 ? 'text-yellow-400' : 'text-emerald-400'}`}>{stock} bal.</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="label">Tipo de cliente / precio</label>
              {form.precio_especial_activo ? (
                <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs text-emerald-300">⭐ Precio especial del cliente activo</p>
                  <button onClick={() => setForm(f => ({...f, precio_especial_activo: false, precio_unitario: getPrecio(f.precio_tipo_id, f.tipo_balon)}))}
                    className="text-xs text-gray-500 hover:text-gray-300 underline">usar precio normal</button>
                </div>
              ) : (
              <div className="grid grid-cols-3 gap-2">
                {precioTipos.map(t => {
                  const precio = getPrecio(t.id, form.tipo_balon) || t.precio
                  return (
                    <button key={t.id} onClick={() => seleccionarTipoPrecio(t.id)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${form.precio_tipo_id === t.id ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                      {t.nombre}<br/><span className="font-bold">S/{precio}</span>
                    </button>
                  )
                })}
              </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Cantidad</label>
                <input type="number" className="input" placeholder="1" value={form.cantidad} onChange={e => setForm(f => ({...f, cantidad: e.target.value}))} />
                <p className="text-xs text-gray-500 mt-1">Stock: {getStock(form.almacen_id, form.tipo_balon)} bal. de {form.tipo_balon}</p>
              </div>
              <div>
                <label className="label">Precio unitario (S/)</label>
                <input type="number" className="input" value={form.precio_unitario} onChange={e => setForm(f => ({...f, precio_unitario: e.target.value}))} />
              </div>
            </div>
            {form.cantidad && form.precio_unitario && (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Total venta:</span>
                <span className="text-emerald-400 font-bold text-lg">S/ {((parseInt(form.cantidad)||0) * (parseFloat(form.precio_unitario)||0)).toLocaleString('es-PE')}</span>
              </div>
            )}
            {/* Toggle al crédito */}
            <div
              onClick={() => setForm(f => ({...f, al_credito: !f.al_credito, metodo_pago: !f.al_credito ? 'credito' : 'efectivo'}))}
              className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${form.al_credito ? 'bg-orange-900/30 border-orange-600/50' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
              <div>
                <p className={`text-sm font-semibold ${form.al_credito ? 'text-orange-300' : 'text-gray-300'}`}>💳 Venta al crédito</p>
                <p className="text-xs text-gray-500 mt-0.5">Descuenta stock y crea deuda automáticamente</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-all relative ${form.al_credito ? 'bg-orange-500' : 'bg-gray-600'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.al_credito ? 'left-5' : 'left-1'}`} />
              </div>
            </div>

            {form.al_credito && (
              <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-xs text-gray-400 space-y-1">
                <p className="text-orange-300 font-medium">⚠️ Venta al crédito activa</p>
                <p>• Se descontarán <strong className="text-white">{form.cantidad || '?'} balones</strong> del stock</p>
                <p>• Se creará una deuda de <strong className="text-white">S/ {((parseInt(form.cantidad)||0)*(parseFloat(form.precio_unitario)||0)).toLocaleString('es-PE')}</strong> a nombre de <strong className="text-white">{form.cliente_nombre || '—'}</strong></p>
                <p>• Los vacíos <strong className="text-white">no</strong> se suman (el balón está en la calle)</p>
              </div>
            )}

            {/* Método de pago — solo si NO es crédito */}
            {!form.al_credito && (
            <div>
              <label className="label">Método de pago</label>
              <div className="grid grid-cols-4 gap-2">
                {[['efectivo','💵 Efectivo'],['yape','📱 Yape'],['vale','🎫 Vale'],['mixto','🔀 Mixto']].map(([val, label]) => (
                  <button key={val} onClick={() => setForm(f => ({...f, metodo_pago: val}))}
                    className={`py-2 px-2 rounded-lg border text-xs font-medium transition-all ${form.metodo_pago === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            )}
            <div><label className="label">Fecha</label><input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div><label className="label">Notas</label><input className="input" placeholder="Observaciones..." value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : '✓ Registrar venta'}</button>
            </div>
          </div>

          {subModal === 'clienteRapido' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">👤 Registrar cliente</h3>
                  <button onClick={() => setSubModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 py-4 space-y-3">
                  <div>
                    <label className="label">Nombre *</label>
                    <input className="input" value={clienteRapidoForm.nombre}
                      onChange={e => setClienteRapidoForm(f => ({...f, nombre: e.target.value}))} autoFocus
                      onKeyDown={e => e.key === 'Enter' && guardarClienteRapido()} />
                  </div>
                  <div>
                    <label className="label">Teléfono (opcional)</label>
                    <input className="input" value={clienteRapidoForm.telefono}
                      onChange={e => setClienteRapidoForm(f => ({...f, telefono: e.target.value}))} />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setSubModal(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={guardarClienteRapido} disabled={!clienteRapidoForm.nombre}
                      className="btn-primary flex-1 justify-center disabled:opacity-50">✓ Registrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
