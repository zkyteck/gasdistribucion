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
  const [editStockAlmacen, setEditStockAlmacen] = useState(null)
  const [editStockVal, setEditStockVal] = useState(0)
  const [movimientoForm, setMovimientoForm] = useState({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: new Date().toISOString().split('T')[0] })
  const [vaciosForm, setVaciosForm] = useState({ almacen_id: '', cantidad: '', notas: '', fecha: new Date().toISOString().split('T')[0] })

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


  const [balonesEnCalle, setBalonesEnCalle] = useState(0)
  const [stockPorTipo, setStockPorTipo] = useState([])

  async function cargar() {
    setLoading(true)
    const [{ data: a }, { data: p }, { data: m }, { data: c }, { data: mv }, { data: dl }, { data: deudasBal }, { data: spt }] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true),
      supabase.from('marcas_gas').select('*').eq('activo', true).order('nombre'),
      supabase.from('compras').select('*, proveedores(nombre), marcas_gas(nombre)').order('fecha', { ascending: false }).limit(30),
      supabase.from('movimientos_stock').select('*, almacenes(nombre)').not('almacen_id', 'is', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('distribuidores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('deudas').select('balones_pendiente').neq('estado', 'liquidada'),
      supabase.from('stock_por_tipo').select('*')
    ])
    const totalEnCalle = (deudasBal || []).reduce((s, d) => s + (parseInt(d.balones_pendiente) || 0), 0)
    setBalonesEnCalle(totalEnCalle)
    setStockPorTipo(spt || [])
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

  async function guardarMovimiento() {
    if (!movimientoForm.origen_id || !movimientoForm.destino_id || !movimientoForm.cantidad) { setError('Completa todos los campos'); return }
    if (movimientoForm.origen_id === movimientoForm.destino_id) { setError('Origen y destino deben ser distintos'); return }
    const cant = parseInt(movimientoForm.cantidad) || 0
    const origen = almacenes.find(a => a.id === movimientoForm.origen_id)
    if (origen && origen.stock_actual < cant) { setError(`Stock insuficiente. Disponible: ${origen.stock_actual} bal.`); return }
    setSaving(true); setError('')
    await supabase.from('almacenes').update({ stock_actual: (origen?.stock_actual || 0) - cant }).eq('id', movimientoForm.origen_id)
    const destino = almacenes.find(a => a.id === movimientoForm.destino_id)
    await supabase.from('almacenes').update({ stock_actual: (destino?.stock_actual || 0) + cant }).eq('id', movimientoForm.destino_id)
    await supabase.from('movimientos_stock').insert({
      almacen_id: movimientoForm.origen_id,
      almacen_destino_id: movimientoForm.destino_id,
      tipo: 'traslado', cantidad: cant,
      tipo_balon: movimientoForm.tipo_balon,
      notas: movimientoForm.notas || null,
      fecha: movimientoForm.fecha
    })
    setSaving(false); setModal(null)
    setMovimientoForm({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: new Date().toISOString().split('T')[0] })
    cargar()
  }

  async function guardarVacios() {
    if (!vaciosForm.almacen_id || !vaciosForm.cantidad) { setError('Completa todos los campos'); return }
    const cant = parseInt(vaciosForm.cantidad) || 0
    const alm = almacenes.find(a => a.id === vaciosForm.almacen_id)
    setSaving(true); setError('')
    await supabase.from('almacenes').update({ balones_vacios: (alm?.balones_vacios || 0) + cant }).eq('id', vaciosForm.almacen_id)
    await supabase.from('movimientos_stock').insert({
      almacen_id: vaciosForm.almacen_id, tipo: 'entrada_vacios',
      cantidad: cant, notas: vaciosForm.notas || null, fecha: vaciosForm.fecha
    })
    setSaving(false); setModal(null)
    setVaciosForm({ almacen_id: '', cantidad: '', notas: '', fecha: new Date().toISOString().split('T')[0] })
    cargar()
  }

  async function guardarEditStock() {
    if (!editStockAlmacen) return
    setSaving(true)
    await supabase.from('almacenes').update({ stock_actual: parseInt(editStockVal) || 0 }).eq('id', editStockAlmacen.id)
    await supabase.from('movimientos_stock').insert({
      almacen_id: editStockAlmacen.id, tipo: 'ajuste_manual',
      cantidad: parseInt(editStockVal) || 0, notas: 'Ajuste manual de stock'
    })
    setSaving(false); setEditStockAlmacen(null); cargar()
  }

  function iniciarDistribucion() {
    const dist = []
    almacenes.forEach(a => {
      const tipos = ['5kg', '10kg', '45kg']
      tipos.forEach(t => {
        dist.push({ almacen_id: a.id, nombre: a.nombre, responsable: a.responsable, tipo_balon: t, cantidad: 0 })
      })
    })
    setCompraForm(f => ({ ...f, distribucion: dist }))
  }

  const totalCompra = ['5kg','10kg','45kg'].reduce((s,t) => s + (parseInt(compraForm.cantidades[t])||0), 0)

  const distPorAlmacen = almacenes.map(a => ({
    ...a,
    tipos: ['5kg','10kg','45kg'].map(tipo => {
      const idx = compraForm.distribucion.findIndex(d => d.almacen_id === a.id && d.tipo_balon === tipo)
      return { tipo, idx, cantidad: idx >= 0 ? (compraForm.distribucion[idx].cantidad || 0) : 0 }
    })
  }))

  function setDistCantidad(idx, val) {
    if (idx < 0) return
    const dist = [...compraForm.distribucion]
    dist[idx] = { ...dist[idx], cantidad: parseInt(val) || 0 }
    setCompraForm(f => ({ ...f, distribucion: dist }))
  }

  const distribOk = totalCompra === 0 || ['5kg','10kg','45kg'].every(t => {
    const comp = parseInt(compraForm.cantidades[t]) || 0
    const dist = compraForm.distribucion.filter(d => d.tipo_balon === t).reduce((s,d) => s + (d.cantidad||0), 0)
    return dist === comp
  })

  async function guardarQuick() {
    if (!quickNombre.trim()) return
    setSavingQuick(true)
    if (quickModal === 'marca') {
      const { data } = await supabase.from('marcas_gas').insert({ nombre: quickNombre.trim(), activo: true }).select().single()
      if (data) setCompraForm(f => ({ ...f, marca_id: data.id }))
    } else {
      const { data } = await supabase.from('proveedores').insert({ nombre: quickNombre.trim(), telefono: quickTel.trim() || null, activo: true }).select().single()
      if (data) setCompraForm(f => ({ ...f, proveedor_id: data.id }))
    }
    setSavingQuick(false)
    setQuickModal(null)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Inventario</h2>
          <p className="text-gray-500 text-sm">Compras, stock e historial</p>
        </div>
        <button onClick={() => { iniciarDistribucion(); setError(''); setModal('compra') }} className="btn-primary">
          <Plus className="w-4 h-4" />Registrar compra
        </button>
      </div>

      {/* Botones de acción secundarios */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setError(''); setMovimientoForm({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: new Date().toISOString().split('T')[0] }); setModal('movimiento') }}
          className="btn-secondary text-xs">
          🔄 Mover entre almacenes
        </button>
        <button onClick={() => { setError(''); setVaciosForm({ almacen_id: '', cantidad: '', notas: '', fecha: new Date().toISOString().split('T')[0] }); setModal('vacios') }}
          className="btn-secondary text-xs">
          ⚪ Registrar vacíos recibidos
        </button>
      </div>

      {/* Stock por almacén */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {almacenes.map(a => {
          const spt5 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '5kg')
          const spt10 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '10kg')
          const spt45 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '45kg')
          return (
          <div key={a.id} className="stat-card border border-gray-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-blue-400" /></div>
              <p className="text-gray-300 text-sm font-medium">{a.nombre}</p>
            </div>
            <div className="flex gap-3 mt-1">
              <div>
                <p className={`text-2xl font-bold ${a.stock_actual > 100 ? 'text-emerald-400' : a.stock_actual > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{a.stock_actual}</p>
                <p className="text-xs text-gray-500">🟢 llenos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-400">{a.balones_vacios || 0}</p>
                <p className="text-xs text-gray-500">⚪ vacíos</p>
              </div>
            </div>
            {/* Desglose por tipo */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {(spt5?.stock_actual || 0) > 0 && <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-lg">🔵 5kg: {spt5.stock_actual}</span>}
              {(spt10?.stock_actual || 0) > 0 && <span className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-0.5 rounded-lg">🟡 10kg: {spt10.stock_actual}</span>}
              {(spt45?.stock_actual || 0) > 0 && <span className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded-lg">🔴 45kg: {spt45.stock_actual}</span>}
              {!spt5 && !spt10 && !spt45 && <span className="text-xs text-gray-600">Sin desglose por tipo</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Responsable: {a.responsable}</p>
          </div>
        )})}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 overflow-x-auto">
        {[['stock','📦 Stock'],['compras','🛒 Compras'],['movimientos','🔄 Movimientos'],['historial','📋 Historial']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
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
                {['Almacén','Responsable','🟢 Llenos (por tipo)','⚪ Vacíos','🔵 En calle','Estado',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {almacenes.map(a => {
                  const esTienda = !a.nombre?.toLowerCase().includes('distribuidor') && !a.nombre?.toLowerCase().includes('dist')
                  const spt5 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '5kg')
                  const spt10 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '10kg')
                  const spt45 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '45kg')
                  return (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-6 py-4 text-white font-medium text-sm">{a.nombre}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{a.responsable}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-lg font-bold ${a.stock_actual > 100 ? 'text-emerald-400' : a.stock_actual > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{a.stock_actual} bal.</span>
                        <div className="flex gap-1 flex-wrap">
                          {(spt5?.stock_actual || 0) > 0 && <span className="text-xs bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">5kg: {spt5.stock_actual}</span>}
                          {(spt10?.stock_actual || 0) > 0 && <span className="text-xs bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">10kg: {spt10.stock_actual}</span>}
                          {(spt45?.stock_actual || 0) > 0 && <span className="text-xs bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">45kg: {spt45.stock_actual}</span>}
                        </div>
                      </div>
                    </td>
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
                    <td className="px-6 py-4">
                      {esTienda ? (
                        <span className="text-orange-400 font-bold text-lg">{balonesEnCalle} bal.</span>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><span className={a.stock_actual > 50 ? 'badge-green' : a.stock_actual > 10 ? 'badge-yellow' : 'badge-red'}>{a.stock_actual > 50 ? 'Bien' : a.stock_actual > 10 ? 'Bajo' : 'Crítico'}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditVacios(a.id); setEditVaciosVal(a.balones_vacios || 0) }}
                          className="text-gray-500 hover:text-blue-400 transition-colors p-1" title="Editar vacíos">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditStockAlmacen(a); setEditStockVal(a.stock_actual || 0) }}
                          className="text-gray-500 hover:text-emerald-400 transition-colors p-1" title="Editar stock llenos">
                          <Package className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
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
      {/* Tab: Movimientos entre almacenes */}
      {tab === 'movimientos' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Movimientos entre almacenes</h3>
            <button onClick={() => { setError(''); setMovimientoForm({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: new Date().toISOString().split('T')[0] }); setModal('movimiento') }}
              className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" />Nuevo movimiento
            </button>
          </div>
          {movimientos.filter(m => m.tipo === 'traslado').length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Sin movimientos registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Fecha','Origen','Destino','Cantidad','Tipo balón','Notas'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {movimientos.filter(m => m.tipo === 'traslado').map(m => (
                    <tr key={m.id} className="table-row-hover">
                      <td className="px-6 py-4 text-gray-400 text-xs">{m.fecha ? format(new Date(m.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es }) : format(new Date(m.created_at), 'dd/MM/yy', { locale: es })}</td>
                      <td className="px-6 py-4 text-white text-sm">{almacenes.find(a => a.id === m.almacen_id)?.nombre || '-'}</td>
                      <td className="px-6 py-4 text-emerald-400 text-sm">{almacenes.find(a => a.id === m.almacen_destino_id)?.nombre || '-'}</td>
                      <td className="px-6 py-4 text-yellow-400 font-bold">{m.cantidad} bal.</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{m.tipo_balon || '10kg'}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{m.notas || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Historial */}
      {tab === 'historial' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Todos los movimientos</h3></div>
          {movimientos.length === 0 ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Sin movimientos</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Fecha','Almacén','Tipo','Cantidad','Notas',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {movimientos.map(m => (
                    <tr key={m.id} className="table-row-hover">
                      <td className="px-6 py-4 text-gray-400 text-xs">{format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: es })}</td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{m.almacenes?.nombre || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.tipo === 'traslado' ? 'bg-blue-900/40 text-blue-300' :
                          m.tipo === 'entrada_vacios' ? 'bg-gray-700 text-gray-300' :
                          m.tipo === 'ajuste_manual' ? 'bg-yellow-900/40 text-yellow-300' :
                          'bg-emerald-900/40 text-emerald-300'
                        }`}>
                          {m.tipo === 'traslado' ? '🔄 Traslado' :
                           m.tipo === 'entrada_vacios' ? '⚪ Vacíos' :
                           m.tipo === 'ajuste_manual' ? '✏️ Ajuste' : m.tipo || 'movimiento'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white font-bold text-sm">{m.cantidad} bal.</td>
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

      {/* Modal editar stock manual */}
      {editStockAlmacen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold text-sm">✏️ Editar stock llenos</h3>
                <p className="text-gray-500 text-xs mt-0.5">{editStockAlmacen.nombre}</p>
              </div>
              <button onClick={() => setEditStockAlmacen(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-500">Ingresa el stock actual por tipo de balón:</p>
              <div className="grid grid-cols-3 gap-3">
                {[['5kg','🔵','blue'],['10kg','🟡','yellow'],['45kg','🔴','red']].map(([tipo, icon, color]) => {
                  const sptVal = stockPorTipo.find(s => s.almacen_id === editStockAlmacen.id && s.tipo_balon === tipo)
                  return (
                    <div key={tipo} className={`bg-${color}-900/20 border border-${color}-800/40 rounded-xl p-3 text-center`}>
                      <p className={`text-${color}-400 font-bold text-xs mb-2`}>{icon} {tipo}</p>
                      <input type="number" min="0"
                        className="input text-center font-bold py-2"
                        defaultValue={sptVal?.stock_actual || 0}
                        id={`stock-edit-${tipo}`} />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditStockAlmacen(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={async () => {
                  setSaving(true)
                  const tipos = ['5kg','10kg','45kg']
                  let totalNuevo = 0
                  for (const tipo of tipos) {
                    const val = parseInt(document.getElementById(`stock-edit-${tipo}`)?.value) || 0
                    totalNuevo += val
                    const existing = stockPorTipo.find(s => s.almacen_id === editStockAlmacen.id && s.tipo_balon === tipo)
                    if (existing) {
                      await supabase.from('stock_por_tipo').update({ stock_actual: val }).eq('id', existing.id)
                    } else if (val > 0) {
                      await supabase.from('stock_por_tipo').insert({ almacen_id: editStockAlmacen.id, tipo_balon: tipo, stock_actual: val })
                    }
                  }
                  await supabase.from('almacenes').update({ stock_actual: totalNuevo }).eq('id', editStockAlmacen.id)
                  setSaving(false); setEditStockAlmacen(null); cargar()
                }} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal mover entre almacenes */}
      {modal === 'movimiento' && (
        <Modal title="🔄 Mover balones entre almacenes" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div>
              <label className="label">Almacén origen</label>
              <select className="input" value={movimientoForm.origen_id} onChange={e => setMovimientoForm(f => ({...f, origen_id: e.target.value}))}>
                <option value="">Seleccionar...</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.stock_actual} bal.)</option>)}
              </select>
            </div>
            <div>
              <label className="label">Almacén destino</label>
              <select className="input" value={movimientoForm.destino_id} onChange={e => setMovimientoForm(f => ({...f, destino_id: e.target.value}))}>
                <option value="">Seleccionar...</option>
                {almacenes.filter(a => a.id !== movimientoForm.origen_id).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cantidad</label>
                <input type="number" min="1" className="input" placeholder="0"
                  value={movimientoForm.cantidad} onChange={e => setMovimientoForm(f => ({...f, cantidad: e.target.value}))} />
              </div>
              <div>
                <label className="label">Tipo balón</label>
                <div className="flex gap-1 mt-1">
                  {['5kg','10kg','45kg'].map(t => (
                    <button key={t} type="button" onClick={() => setMovimientoForm(f => ({...f, tipo_balon: t}))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${movimientoForm.tipo_balon === t ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={movimientoForm.fecha} onChange={e => setMovimientoForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div><label className="label">Notas (opcional)</label>
              <input className="input" placeholder="Motivo del traslado..." value={movimientoForm.notas} onChange={e => setMovimientoForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarMovimiento} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Registrar movimiento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal registrar vacíos recibidos */}
      {modal === 'vacios' && (
        <Modal title="⚪ Registrar balones vacíos recibidos" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div>
              <label className="label">Almacén</label>
              <select className="input" value={vaciosForm.almacen_id} onChange={e => setVaciosForm(f => ({...f, almacen_id: e.target.value}))}>
                <option value="">Seleccionar...</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.balones_vacios || 0} vacíos)</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad de vacíos recibidos</label>
              <input type="number" min="1" className="input text-center text-2xl font-bold py-3"
                value={vaciosForm.cantidad} onChange={e => setVaciosForm(f => ({...f, cantidad: e.target.value}))} placeholder="0" />
            </div>
            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={vaciosForm.fecha} onChange={e => setVaciosForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div><label className="label">Notas (opcional)</label>
              <input className="input" placeholder="De quién se recibieron..." value={vaciosForm.notas} onChange={e => setVaciosForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarVacios} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Registrar vacíos'}
              </button>
            </div>
          </div>
        </Modal>
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