import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Package, Plus, X, AlertCircle, TrendingUp, DollarSign, ShoppingCart, Edit2 } from 'lucide-react'
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

export default function Inventario() {
  const [almacenes, setAlmacenes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [marcas, setMarcas] = useState([])
  const [distribuidoresList, setDistribuidoresList] = useState([])
  const [compras, setCompras] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('stock')
  const [editVacios, setEditVacios] = useState(null) // almacen id
  const [editVaciosVal, setEditVaciosVal] = useState(0)

  // Ganancias
  const [quickModal, setQuickModal] = useState(null) // 'marca' | 'proveedor'
  const [quickNombre, setQuickNombre] = useState('')
  const [quickTel, setQuickTel] = useState('')
  const [savingQuick, setSavingQuick] = useState(false) // 'juntos' | dist_id

  const [editCompraSelected, setEditCompraSelected] = useState(null)
  const [editCompraForm, setEditCompraForm] = useState({ fecha: '', notas: '', proveedor_id: '', marca_id: '' })
  const [editDist, setEditDist] = useState([]) // [{almacen_id, nombre, responsable, tipo_balon, cantidad, detalle_id}]
  const [compraForm, setCompraForm] = useState({
    proveedor_id: '', marca_id: '', fecha: new Date().toISOString().split('T')[0],
    cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, precios: { '5kg': '', '10kg': '', '45kg': '' }, notas: '', distribucion: []
  })

  useEffect(() => { cargar() }, [])


  async function cargar() {
    setLoading(true)
    const [{ data: a }, { data: p }, { data: m }, { data: c }, { data: mv }, { data: dl }] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true),
      supabase.from('marcas_gas').select('*').eq('activo', true).order('nombre'),
      supabase.from('compras').select('*, proveedores(nombre), marcas_gas(nombre)').order('fecha', { ascending: false }).limit(30),
      supabase.from('movimientos_stock').select('*, almacenes(nombre)').not('almacen_id', 'is', null).order('created_at', { ascending: false }).limit(30),
      supabase.from('distribuidores').select('id, nombre').eq('activo', true).order('nombre')
    ])
    // Enrich almacenes: match distribuidor almacenes with distribuidor names
    const distAlmacenes = (a || []).filter(alm => alm.nombre?.toLowerCase().includes('distribuidor') || alm.nombre?.toLowerCase().includes('dist'))
    const tiendaAlmacenes = (a || []).filter(alm => !alm.nombre?.toLowerCase().includes('distribuidor') && !alm.nombre?.toLowerCase().includes('dist'))
    const enriched = (a || []).map(alm => {
      const idx = distAlmacenes.findIndex(da => da.id === alm.id)
      if (idx >= 0 && (dl || []).length > idx) {
        return { ...alm, responsable: alm.responsable || (dl || [])[idx]?.nombre || alm.responsable }
      }
      return alm
    })
    setAlmacenes(enriched)
    setProveedores(p || [])
    setMarcas(m || [])
    setDistribuidoresList(dl || [])
    setCompras(c || [])
    setMovimientos(mv || [])
    setLoading(false)
  }


  async function eliminarCompra(compra) {
    if (!confirm(`¿Eliminar esta compra de ${compra.cantidad_total} balones? Esto también restará el stock de los almacenes.`)) return
    // Get compra_detalles to revert stock
    const { data: detalles } = await supabase.from('compra_detalles').select('*').eq('compra_id', compra.id)
    if (detalles && detalles.length > 0) {
      for (const d of detalles) {
        if (!d.almacen_id || !d.cantidad) continue
        const { data: st } = await supabase.from('stock_por_tipo').select('cantidad').eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon || '10kg').maybeSingle()
        if (st) await supabase.from('stock_por_tipo').update({ cantidad: Math.max(0, (st.cantidad||0) - d.cantidad) }).eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon || '10kg')
        const { data: alm } = await supabase.from('almacenes').select('stock_actual').eq('id', d.almacen_id).maybeSingle()
        if (alm) await supabase.from('almacenes').update({ stock_actual: Math.max(0, (alm.stock_actual||0) - d.cantidad) }).eq('id', d.almacen_id)
      }
    }
    await supabase.from('compra_detalles').delete().eq('compra_id', compra.id)
    await supabase.from('compras').delete().eq('id', compra.id)
    cargar()
  }

  async function guardarEdicionCompra() {
    if (!editCompraSelected) return
    setSaving(true); setError('')
    // Update compra fields
    const { error: e } = await supabase.from('compras').update({
      fecha: editCompraForm.fecha,
      notas: editCompraForm.notas,
      proveedor_id: editCompraForm.proveedor_id || null,
      marca_id: editCompraForm.marca_id || null,
    }).eq('id', editCompraSelected.id)
    if (e) { setError(e.message); setSaving(false); return }

    // For each editDist entry, update stock: revert old, apply new
    for (const d of editDist) {
      const oldCant = d.oldCantidad || 0
      const newCant = parseInt(d.cantidad) || 0
      const diff = newCant - oldCant
      if (diff === 0) continue

      // Update compra_detalle
      if (d.detalle_id) {
        await supabase.from('compra_detalles').update({ cantidad: newCant }).eq('id', d.detalle_id)
      } else if (newCant > 0) {
        await supabase.from('compra_detalles').insert({ compra_id: editCompraSelected.id, almacen_id: d.almacen_id, cantidad: newCant, tipo_balon: d.tipo_balon })
      }

      // Update stock_por_tipo
      const { data: st } = await supabase.from('stock_por_tipo').select('cantidad').eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon).single()
      if (st) {
        await supabase.from('stock_por_tipo').update({ cantidad: Math.max(0, (st.cantidad||0) + diff) }).eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon)
      }
      // Update almacen stock_actual
      const { data: alm } = await supabase.from('almacenes').select('stock_actual').eq('id', d.almacen_id).single()
      if (alm) {
        await supabase.from('almacenes').update({ stock_actual: Math.max(0, (alm.stock_actual||0) + diff) }).eq('id', d.almacen_id)
      }
    }
    setSaving(false)
    setModal(null)
    cargar()
  }

  async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento del historial?')) return
    await supabase.from('movimientos_stock').delete().eq('id', id)
    cargar()
  }

  async function guardarCompra() {
    if (!totalCompra || !compraForm.fecha) { setError('Completa los campos obligatorios'); return }

    setSaving(true); setError('')
    const marcaSeleccionada = marcas.find(m => m.id === compraForm.marca_id)
    // Weighted average price across tipos
    const precioPromedio = totalCompra > 0 ? ['5kg','10kg','45kg'].reduce((s,t) => {
      return s + (parseInt(compraForm.cantidades[t])||0) * (parseFloat(compraForm.precios[t])||0)
    }, 0) / totalCompra : 0
    const { data: compra, error: e1 } = await supabase.from('compras').insert({
      proveedor_id: compraForm.proveedor_id || null,
      marca_id: compraForm.marca_id || null,
      marca_nombre: marcaSeleccionada?.nombre || null,
      fecha: compraForm.fecha,
      cantidad_total: totalCompra,
      precio_unitario: precioPromedio,
      notas: compraForm.notas
    }).select().single()
    if (e1) { setError(e1.message); setSaving(false); return }
    const detalles = compraForm.distribucion.filter(d => d.cantidad > 0).map(d => ({
      compra_id: compra.id, almacen_id: d.almacen_id, cantidad: d.cantidad, tipo_balon: d.tipo_balon
    }))
    await supabase.from('compra_detalles').insert(detalles)
    // Update stock_por_tipo for each almacen+tipo_balon
    for (const d of detalles) {
      const { data: existing } = await supabase.from('stock_por_tipo')
        .select('stock_actual').eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon).single()
      if (existing) {
        await supabase.from('stock_por_tipo')
          .update({ stock_actual: existing.stock_actual + d.cantidad, updated_at: new Date().toISOString() })
          .eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon)
      } else {
        await supabase.from('stock_por_tipo').insert({ almacen_id: d.almacen_id, tipo_balon: d.tipo_balon, stock_actual: d.cantidad })
      }
    }
    setSaving(false)
    setModal(null)
    setCompraForm({ proveedor_id: '', marca_id: '', fecha: new Date().toISOString().split('T')[0], cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, precios: { '5kg': '', '10kg': '', '45kg': '' }, notas: '', distribucion: [] })
    cargar()
  }

  function iniciarDistribucion() {
    const dist = []
    almacenes.forEach(a => {
      ;['5kg', '10kg', '45kg'].forEach(t => {
        dist.push({ almacen_id: a.id, nombre: a.nombre, responsable: a.responsable, tipo_balon: t, cantidad: 0 })
      })
    })
    setCompraForm(f => ({ ...f, distribucion: dist }))
  }

  const totalCompra = ['5kg','10kg','45kg'].reduce((s,t) => s + (parseInt(compraForm.cantidades[t])||0), 0)

  return (
          <p className="text-gray-500 text-sm">Compras, stock e historial</p>
        </div>
        <button onClick={() => { iniciarDistribucion(); setError(''); setModal('compra') }} className="btn-primary">
          <Plus className="w-4 h-4" />Registrar compra
        </button>
      </div>

      {/* Stock por almacén */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {almacenes.map(a => (
          <div key={a.id} className="stat-card border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-blue-400" /></div>
              <p className="text-gray-300 text-sm font-medium">{a.nombre}</p>
            </div>
            <div className="flex gap-4 mt-1">
              <div>
                <p className={`text-2xl font-bold ${a.stock_actual > 100 ? 'text-emerald-400' : a.stock_actual > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{a.stock_actual}</p>
                <p className="text-xs text-gray-500">🟢 llenos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-400">{a.balones_vacios || 0}</p>
                <p className="text-xs text-gray-500">⚪ vacíos</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Responsable: {a.responsable}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {[['stock','📦 Stock'],['compras','🛒 Compras'],['historial','📋 Historial']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${tab === key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Stock */}
      {tab === 'stock' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Stock consolidado</h3>
            <span className="text-xs text-gray-500">Toca ✏️ para actualizar vacíos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                {['Almacén','Responsable','🟢 Llenos','⚪ Vacíos','Estado',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {almacenes.map(a => (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-6 py-4 text-white font-medium text-sm">{a.nombre}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{a.responsable}</td>
                    <td className="px-6 py-4"><span className={`text-lg font-bold ${a.stock_actual > 100 ? 'text-emerald-400' : a.stock_actual > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{a.stock_actual} bal.</span></td>
                    <td className="px-6 py-4">
                      {editVacios === a.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" className="input w-20 py-1 text-sm text-center"
                            value={editVaciosVal}
                            onChange={e => setEditVaciosVal(e.target.value)}
                            autoFocus
                          />
                          <button onClick={async () => {
                            await supabase.from('almacenes').update({ balones_vacios: parseInt(editVaciosVal) || 0 }).eq('id', a.id)
                            setEditVacios(null); cargar()
                          }} className="text-xs bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 px-2 py-1 rounded-lg">✓</button>
                          <button onClick={() => setEditVacios(null)} className="text-xs text-gray-500 hover:text-gray-300 px-1">✕</button>
                        </div>
                      ) : (
                        <span className="text-gray-300 font-bold text-lg">{a.balones_vacios || 0} bal.</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><span className={a.stock_actual > 50 ? 'badge-green' : a.stock_actual > 10 ? 'badge-yellow' : 'badge-red'}>{a.stock_actual > 50 ? 'Bien' : a.stock_actual > 10 ? 'Bajo' : 'Crítico'}</span></td>
                    <td className="px-6 py-4">
                      <button onClick={() => { setEditVacios(a.id); setEditVaciosVal(a.balones_vacios || 0) }}
                        className="text-gray-500 hover:text-blue-400 transition-colors p-1" title="Editar vacíos">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Compras */}
      {tab === 'compras' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Historial de compras</h3></div>
          {compras.length === 0 ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Sin compras registradas</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Fecha','Proveedor','Marca','Cantidad','Costo/bal.','Total invertido','Notas',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {compras.map(c => (
                    <tr key={c.id} className="table-row-hover">
                      <td className="px-4 py-4 text-gray-400 text-sm whitespace-nowrap">{format(new Date(c.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</td>
                      <td className="px-4 py-4 text-white text-sm">{c.proveedores?.nombre || '-'}</td>
                      <td className="px-4 py-4">
                        {c.marcas_gas?.nombre || c.marca_nombre
                          ? <span className="badge-blue">{c.marcas_gas?.nombre || c.marca_nombre}</span>
                          : <span className="text-gray-600 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-4 text-emerald-400 font-bold">{c.cantidad_total} bal.</td>
                      <td className="px-4 py-4 text-gray-400 text-sm">S/ {c.precio_unitario}</td>
                      <td className="px-4 py-4 text-yellow-400 font-bold">S/ {(c.cantidad_total * c.precio_unitario).toLocaleString('es-PE')}</td>
                      <td className="px-4 py-4 text-gray-500 text-xs">{c.notas || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => { 
                            setEditCompraSelected(c)
                            setEditCompraForm({ fecha: c.fecha, notas: c.notas||'', proveedor_id: c.proveedor_id||'', marca_id: c.marca_id||'' })
                            setError('')
                            // Load distribution details
                            supabase.from('compra_detalles').select('*').eq('compra_id', c.id).then(({data: dets}) => {
                              const tipos = ['5kg','10kg','45kg']
                              const dist = almacenes.flatMap(a => tipos.map(t => {
                                const det = (dets||[]).find(d => d.almacen_id === a.id && d.tipo_balon === t)
                                return { almacen_id: a.id, nombre: a.nombre, responsable: a.responsable, tipo_balon: t, cantidad: det?.cantidad||0, oldCantidad: det?.cantidad||0, detalle_id: det?.id||null }
                              }))
                              setEditDist(dist)
                              setModal('editCompra')
                            })
                          }}
                            className="text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 px-2 py-1 rounded-lg transition-all">
                            ✏️ Editar
                          </button>
                          <button onClick={() => eliminarCompra(c)}
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
          )}
        </div>
      )}

      {/* Tab: GANANCIAS */}
      {/* Tab: Historial */}
      {tab === 'historial' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Movimientos de stock</h3></div>
          {movimientos.length === 0 ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Sin movimientos</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Fecha','Almacén','Tipo','Cantidad','Antes','Después','Notas',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {movimientos.map(m => (
                    <tr key={m.id} className="table-row-hover">
                      <td className="px-6 py-4 text-gray-500 text-xs">{format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: es })}</td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{m.almacenes?.nombre || '-'}</td>
                      <td className="px-6 py-4"><span className="badge-blue capitalize">{m.tipo_movimiento.replace(/_/g,' ')}</span></td>
                      <td className="px-6 py-4"><span className={`font-bold text-sm ${m.cantidad > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</span></td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{m.stock_anterior}</td>
                      <td className="px-6 py-4 text-white font-semibold text-sm">{m.stock_nuevo}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{m.notas || '-'}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => eliminarMovimiento(m.id)}
                          className="text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 px-2 py-1 rounded-lg transition-all">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal compra */}
      {modal === 'compra' && (
        <Modal title="Registrar compra de balones" onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Proveedor</label>
                  <button type="button" onClick={() => { setQuickNombre(''); setQuickTel(''); setQuickModal('proveedor') }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <span className="text-lg leading-none">+</span> Nuevo
                  </button>
                </div>
                <select className="input" value={compraForm.proveedor_id} onChange={e => setCompraForm(f => ({...f, proveedor_id: e.target.value}))}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={compraForm.fecha} onChange={e => setCompraForm(f => ({...f, fecha: e.target.value}))} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Marca del gas</label>
                  <button type="button" onClick={() => { setQuickNombre(''); setQuickModal('marca') }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <span className="text-lg leading-none">+</span> Nueva
                  </button>
                </div>
                <select className="input" value={compraForm.marca_id} onChange={e => setCompraForm(f => ({...f, marca_id: e.target.value}))}>
                  <option value="">Sin marca / otra</option>
                  {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="label">Cantidad y precio por tipo de balón</label>
                <div className="space-y-2">
                  {[['5kg','🔵'],['10kg','🟡'],['45kg','🔴']].map(([tipo, icon]) => (
                    <div key={tipo} className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 w-16 flex-shrink-0">{icon} {tipo}</span>
                      <div className="flex-1">
                        <input type="number" min="0" className="input text-center w-full"
                          value={compraForm.cantidades[tipo] || ''}
                          placeholder="Cantidad"
                          onChange={e => {
                            const newCants = { ...compraForm.cantidades, [tipo]: parseInt(e.target.value)||0 }
                            setCompraForm(f => ({ ...f, cantidades: newCants }))
                            iniciarDistribucion()
                          }} />
                        <p className="text-xs text-gray-600 text-center mt-0.5">balones</p>
                      </div>
                      <div className="flex-1">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">S/</span>
                          <input type="number" min="0" step="0.5" className="input pl-8 w-full"
                            value={compraForm.precios[tipo] || ''}
                            placeholder="Precio"
                            onChange={e => setCompraForm(f => ({ ...f, precios: { ...f.precios, [tipo]: e.target.value } }))} />
                        </div>
                        <p className="text-xs text-gray-600 text-center mt-0.5">c/u</p>
                      </div>
                    </div>
                  ))}
                </div>
                {totalCompra > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-right">Total: <span className="text-white font-semibold">{totalCompra} balones</span></p>
                )}
              </div>
            </div>

            {totalCompra > 0 && (
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-2 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Total compra:</span>
                  <span className="text-blue-400 font-bold">S/ {['5kg','10kg','45kg'].reduce((s,t) => s + (parseInt(compraForm.cantidades[t])||0)*(parseFloat(compraForm.precios[t])||0), 0).toLocaleString('es-PE')}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  {['5kg','10kg','45kg'].map(t => parseInt(compraForm.cantidades[t]) > 0 && (
                    <span key={t}>{t === '5kg'?'🔵':t==='10kg'?'🟡':'🔴'} {t}: S/{((parseInt(compraForm.cantidades[t])||0)*(parseFloat(compraForm.precios[t])||0)).toLocaleString()}</span>
                  ))}
                </div>
              </div>
            )}

            {compraForm.distribucion.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Distribución por almacén y tipo</label>
                  <div className="flex flex-col items-end gap-0.5">
                    {['5kg','10kg','45kg'].map(t => {
                      const comp = parseInt(compraForm.cantidades[t])||0
                      const dist = compraForm.distribucion.filter(d=>d.tipo_balon===t).reduce((s,d)=>s+d.cantidad,0)
                      if (!comp) return null
                      return <span key={t} className={`text-xs font-medium ${dist===comp?'text-emerald-400':'text-yellow-400'}`}>{t}: {dist}/{comp}</span>
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  {distPorAlmacen.map(a => (
                    <div key={a.id} className="bg-gray-800/40 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 mb-2"><p className="text-gray-300 text-sm font-medium">📦 {a.nombre}</p>{a.responsable && <span className="text-xs text-gray-500">({a.responsable})</span>}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {a.tipos.map(({ tipo, idx, cantidad }) => (
                          <div key={tipo} className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 text-center">
                              {tipo === '5kg' ? '🔵' : tipo === '10kg' ? '🟡' : '🔴'} {tipo}
                            </span>
                            <input type="number" min="0" className="input text-center text-sm px-2 py-1.5"
                              value={cantidad || ''} placeholder="0"
                              onChange={e => setDistCantidad(idx, e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <p className="text-right text-xs text-gray-500 mt-1">
                        Subtotal: {a.tipos.reduce((s,t) => s + t.cantidad, 0)} bal.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={compraForm.notas} onChange={e => setCompraForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCompra} disabled={saving || !distribOk} className="btn-primary flex-1 justify-center disabled:opacity-50">
                {saving ? 'Guardando...' : '✓ Registrar compra'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Quick modal: nueva marca / nuevo proveedor */}
      {quickModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold text-sm">
                {quickModal === 'marca' ? '🏷️ Nueva marca de gas' : '🏢 Nuevo proveedor'}
              </h3>
              <button onClick={() => setQuickModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder={quickModal === 'marca' ? 'Ej: Llamagas' : 'Ej: GLP Sur SAC'}
                  value={quickNombre} onChange={e => setQuickNombre(e.target.value)} autoFocus
                  onKeyDown={e => e.key === 'Enter' && guardarQuick()} />
              </div>
              {quickModal === 'proveedor' && (
                <div>
                  <label className="label">Teléfono (opcional)</label>
                  <input className="input" placeholder="999 888 777" value={quickTel} onChange={e => setQuickTel(e.target.value)} />
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setQuickModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={guardarQuick} disabled={savingQuick || !quickNombre.trim()} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {savingQuick ? 'Guardando...' : '✓ Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal editar compra */}
      {modal === 'editCompra' && editCompraSelected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold">✏️ Editar compra</h3>
                <p className="text-gray-500 text-xs mt-0.5">{editCompraSelected.cantidad_total} bal. · S/{editCompraSelected.precio_unitario}/bal.</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
              {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={editCompraForm.fecha} onChange={e => setEditCompraForm(f => ({...f, fecha: e.target.value}))} />
              </div>
              <div>
                <label className="label">Proveedor</label>
                <select className="input" value={editCompraForm.proveedor_id} onChange={e => setEditCompraForm(f => ({...f, proveedor_id: e.target.value}))}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Marca del gas</label>
                <select className="input" value={editCompraForm.marca_id} onChange={e => setEditCompraForm(f => ({...f, marca_id: e.target.value}))}>
                  <option value="">Sin marca</option>
                  {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} value={editCompraForm.notas} onChange={e => setEditCompraForm(f => ({...f, notas: e.target.value}))} />
              </div>

              {/* Distribución por almacén */}
              <div>
                <label className="label">Distribución por almacén</label>
                <div className="space-y-3 mt-1">
                  {almacenes.map(a => (
                    <div key={a.id} className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-white text-sm font-semibold mb-2">{a.nombre} <span className="text-gray-500 font-normal text-xs">({a.responsable})</span></p>
                      <div className="grid grid-cols-3 gap-2">
                        {['5kg','10kg','45kg'].map(t => {
                          const entry = editDist.find(d => d.almacen_id === a.id && d.tipo_balon === t)
                          return (
                            <div key={t}>
                              <p className="text-xs text-gray-500 mb-1">{t==='5kg'?'🔵':t==='10kg'?'🟡':'🔴'} {t}</p>
                              <input type="number" min="0" className="input text-sm py-1.5" 
                                value={entry?.cantidad||0}
                                onChange={e => setEditDist(prev => prev.map(d => d.almacen_id===a.id && d.tipo_balon===t ? {...d, cantidad: parseInt(e.target.value)||0} : d))} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">💡 Solo ingresa si cambió la cantidad distribuida. El stock se ajustará automáticamente.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={guardarEdicionCompra} disabled={saving} className="btn-primary flex-1 justify-center">
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