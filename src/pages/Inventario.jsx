import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { Package, Plus, X, AlertCircle, TrendingUp, DollarSign, ShoppingCart, Edit2, LayoutList } from 'lucide-react'
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
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

export default function Inventario() {
  const [almacenes, setAlmacenes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [marcas, setMarcas] = useState([])
  const [distribuidoresList, setDistribuidoresList] = useState([])
  const [preciosDistTipo, setPreciosDistTipo] = useState([])
  const [compras, setCompras] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('stock')
  const [editVacios, setEditVacios] = useState(null) // almacen object
  const [editVaciosVal, setEditVaciosVal] = useState({ '5kg': 0, '10kg': 0, '45kg': 0 })
  const [editStockAlmacen, setEditStockAlmacen] = useState(null)
  const [editStockVal, setEditStockVal] = useState(0)
  const [editVaciosModal, setEditVaciosModal] = useState(null)
  const [lotesModal, setLotesModal] = useState(null)
  const [lotesData, setLotesData] = useState([])
  const [loadingLotes, setLoadingLotes] = useState(false)
  const [editPrecioLote, setEditPrecioLote] = useState(null) // {id, precio_unitario}
  const [editPrecioVal, setEditPrecioVal] = useState('')
  const [savingPrecio, setSavingPrecio] = useState(false)
  const [editVaciosModalVal, setEditVaciosModalVal] = useState({ '5kg': 0, '10kg': 0, '45kg': 0 })
  const [movimientoForm, setMovimientoForm] = useState({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: hoyPeru() })
  const [vaciosForm, setVaciosForm] = useState({ almacen_id: '', cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, notas: '', fecha: hoyPeru() })

  // Ganancias
  const [quickModal, setQuickModal] = useState(null) // 'marca' | 'proveedor'
  const [quickNombre, setQuickNombre] = useState('')
  const [quickTel, setQuickTel] = useState('')
  const [savingQuick, setSavingQuick] = useState(false) // 'juntos' | dist_id

  const [editCompraSelected, setEditCompraSelected] = useState(null)
  const [detalleCompra, setDetalleCompra] = useState(null) // { compra, detalles }
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [editCompraForm, setEditCompraForm] = useState({ fecha: '', notas: '', proveedor_id: '', marca_id: '' })
  const [editDist, setEditDist] = useState([]) // [{almacen_id, nombre, responsable, tipo_balon, cantidad, detalle_id}]
  const [compraForm, setCompraForm] = useState({
    proveedor_id: '', marca_id: '', fecha: hoyPeru(),
    cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, precios: { '5kg': '', '10kg': '', '45kg': '' },
    notas: '', distribucion: [],
    monto_amortizado: '', estado_pago: 'cancelado'
  })

  useEffect(() => { cargar() }, [])


  const [balonesEnCalle, setBalonesEnCalle] = useState(0)
  const [stockPorTipo, setStockPorTipo] = useState([])

  async function cargar() {
    setLoading(true)
    const [{ data: a }, { data: p }, { data: m }, { data: c }, { data: mv }, { data: dl }, { data: deudasBal }, { data: spt }, { data: pdt }] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true),
      supabase.from('marcas_gas').select('*').eq('activo', true).order('nombre'),
      supabase.from('compras').select('*, proveedores(nombre), marcas_gas(nombre)').order('fecha', { ascending: false }).limit(30),
      supabase.from('movimientos_stock').select('*, almacenes(nombre)').not('almacen_id', 'is', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('distribuidores').select('id, nombre, almacen_id, precio_base, modalidad').eq('activo', true).order('nombre'),
      supabase.from('precio_distribuidor_tipo').select('*'),
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
    setPreciosDistTipo(pdt || [])
    setCompras(c || [])
    setMovimientos(mv || [])
    setLoading(false)
  }



  async function abrirLotesModal(almacen) {
    setLotesModal(almacen)
    setLoadingLotes(true)
    const dist = distribuidoresList.find(d => d.almacen_id === almacen.id)
    if (dist) {
      const { data } = await supabase.from('lotes_distribuidor')
        .select('*')
        .eq('distribuidor_id', dist.id)
        .order('fecha', { ascending: false })
      setLotesData(data || [])
    } else {
      // Almacén normal: leer stock_por_tipo
      const spt = stockPorTipo.filter(s => s.almacen_id === almacen.id)
      setLotesData(spt.map(s => ({
        fecha: '—',
        precio_unitario: almacen.precio_base || '—',
        cantidad_inicial: s.stock_actual,
        cantidad_restante: s.stock_actual,
        cantidad_vendida: 0,
        tipo_balon: s.tipo_balon,
        cerrado: false,
      })))
    }
    setLoadingLotes(false)
  }

  async function actualizarEstadoPago(compraId, nuevoEstado, montoExtra) {
    const { data: compra } = await supabase.from('compras').select('monto_amortizado, monto_total').eq('id', compraId).single()
    if (!compra) return
    const nuevoAmortizado = (compra.monto_amortizado || 0) + (parseFloat(montoExtra) || 0)
    const nuevoPendiente = Math.max(0, (compra.monto_total || 0) - nuevoAmortizado)
    const estadoFinal = nuevoPendiente <= 0 ? 'cancelado' : 'por_cancelar'
    await supabase.from('compras').update({
      monto_amortizado: nuevoAmortizado,
      monto_pendiente: nuevoPendiente,
      estado_pago: estadoFinal,
      updated_at: new Date().toISOString()
    }).eq('id', compraId)
    cargar()
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
    const montoTotal = ['5kg','10kg','45kg'].reduce((s,t) =>
      s + (parseInt(compraForm.cantidades[t])||0) * (parseFloat(compraForm.precios[t])||0), 0)
    const montoAmortizado = parseFloat(compraForm.monto_amortizado) || 0
    const montoPendiente = Math.max(0, montoTotal - montoAmortizado)
    const estadoPago = montoPendiente <= 0 ? 'cancelado' : 'por_cancelar'

    const { data: compra, error: e1 } = await supabase.from('compras').insert({
      proveedor_id: compraForm.proveedor_id || null,
      marca_id: compraForm.marca_id || null,
      marca_nombre: marcaSeleccionada?.nombre || null,
      fecha: compraForm.fecha,
      cantidad_total: totalCompra,
      precio_unitario: precioPromedio,
      notas: compraForm.notas,
      monto_total: montoTotal,
      monto_amortizado: montoAmortizado,
      monto_pendiente: montoPendiente,
      estado_pago: estadoPago
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
    // Actualizar stock_actual de almacenes y crear lotes FIFO para distribuidores
    for (const d of detalles) {
      if (d.cantidad <= 0) continue
      // Actualizar stock_actual del almacén
      const { data: almFresco } = await supabase.from('almacenes').select('stock_actual').eq('id', d.almacen_id).single()
      if (almFresco) {
        await supabase.from('almacenes').update({
          stock_actual: (almFresco.stock_actual || 0) + d.cantidad,
          updated_at: new Date().toISOString()
        }).eq('id', d.almacen_id)
      }
      // Si el almacén pertenece a un distribuidor → crear lote FIFO
      const distrib = distribuidoresList.find(dist => dist.almacen_id === d.almacen_id)
      if (distrib) {
        const precioLote = parseFloat(compraForm.precios[d.tipo_balon]) || distrib.precio_base || 0
        if (precioLote > 0) {
          await supabase.from('lotes_distribuidor').insert({
            distribuidor_id: distrib.id,
            reposicion_id: null,
            fecha: compraForm.fecha,
            cantidad_inicial: d.cantidad,
            cantidad_vendida: 0,
            cantidad_restante: d.cantidad,
            precio_unitario: precioLote,
            tipo_balon: d.tipo_balon,
            notas: `Compra ${compraForm.fecha}${compraForm.notas ? ' — ' + compraForm.notas : ''}`
          })
        }
      }
    }

    setSaving(false)
    setModal(null)
    setCompraForm({ proveedor_id: '', marca_id: '', fecha: hoyPeru(), cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, precios: { '5kg': '', '10kg': '', '45kg': '' }, notas: '', distribucion: [], monto_amortizado: '', estado_pago: 'cancelado' })
    // Actualizar costos de compra en configuracion
    for (const tipo of ['5kg','10kg','45kg']) {
      if (parseFloat(compraForm.precios[tipo]) > 0) {
        await supabase.from('configuracion').upsert({ clave: `costo_${tipo.replace('kg','')}kg`, valor: compraForm.precios[tipo].toString(), updated_at: new Date().toISOString() }, { onConflict: 'clave' })
      }
    }
    cargar()
  }

  async function guardarMovimiento() {
    if (!movimientoForm.origen_id || !movimientoForm.destino_id || !movimientoForm.cantidad) { setError('Completa todos los campos'); return }
    if (movimientoForm.origen_id === movimientoForm.destino_id) { setError('Origen y destino deben ser distintos'); return }
    const cant = parseInt(movimientoForm.cantidad) || 0
    const origen = almacenes.find(a => a.id === movimientoForm.origen_id)
    if (origen && origen.stock_actual < cant) { setError(`Stock insuficiente. Disponible: ${origen.stock_actual} bal.`); return }
    setSaving(true); setError('')
    const destino = almacenes.find(a => a.id === movimientoForm.destino_id)
    const tipoBalon = movimientoForm.tipo_balon

    // Actualizar stock_actual en almacenes
    await supabase.from('almacenes').update({ stock_actual: (origen?.stock_actual || 0) - cant }).eq('id', movimientoForm.origen_id)
    await supabase.from('almacenes').update({ stock_actual: (destino?.stock_actual || 0) + cant }).eq('id', movimientoForm.destino_id)

    // Actualizar stock_por_tipo en origen
    const { data: sptOrigen } = await supabase.from('stock_por_tipo')
      .select('*').eq('almacen_id', movimientoForm.origen_id).eq('tipo_balon', tipoBalon).single()
    if (sptOrigen) {
      await supabase.from('stock_por_tipo')
        .update({ stock_actual: Math.max(0, sptOrigen.stock_actual - cant) })
        .eq('id', sptOrigen.id)
    }

    // Actualizar stock_por_tipo en destino
    const { data: sptDestino } = await supabase.from('stock_por_tipo')
      .select('*').eq('almacen_id', movimientoForm.destino_id).eq('tipo_balon', tipoBalon).single()
    if (sptDestino) {
      await supabase.from('stock_por_tipo')
        .update({ stock_actual: sptDestino.stock_actual + cant })
        .eq('id', sptDestino.id)
    } else {
      await supabase.from('stock_por_tipo')
        .insert({ almacen_id: movimientoForm.destino_id, tipo_balon: tipoBalon, stock_actual: cant })
    }

    // Registrar movimiento
    await supabase.from('movimientos_stock').insert({
      almacen_id: movimientoForm.origen_id,
      almacen_destino_id: movimientoForm.destino_id,
      tipo: 'traslado', cantidad: cant,
      tipo_balon: tipoBalon,
      notas: movimientoForm.notas || null,
      fecha: movimientoForm.fecha
    })
    setSaving(false); setModal(null)
    setMovimientoForm({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: hoyPeru() })
    cargar()
  }

  async function guardarVacios() {
    if (!vaciosForm.almacen_id) { setError('Selecciona un almacén'); return }
    const total = Object.values(vaciosForm.cantidades).reduce((s, v) => s + (parseInt(v) || 0), 0)
    if (total === 0) { setError('Ingresa al menos una cantidad'); return }
    const alm = almacenes.find(a => a.id === vaciosForm.almacen_id)
    setSaving(true); setError('')
    const v5 = parseInt(vaciosForm.cantidades['5kg']) || 0
    const v10 = parseInt(vaciosForm.cantidades['10kg']) || 0
    const v45 = parseInt(vaciosForm.cantidades['45kg']) || 0
    await supabase.from('almacenes').update({
      balones_vacios: (alm?.balones_vacios || 0) + total,
      vacios_5kg: (alm?.vacios_5kg || 0) + v5,
      vacios_10kg: (alm?.vacios_10kg || 0) + v10,
      vacios_45kg: (alm?.vacios_45kg || 0) + v45,
    }).eq('id', vaciosForm.almacen_id)
    await supabase.from('movimientos_stock').insert({
      almacen_id: vaciosForm.almacen_id, tipo: 'entrada_vacios',
      cantidad: total, notas: vaciosForm.notas || null, fecha: vaciosForm.fecha
    })
    setSaving(false); setModal(null)
    setVaciosForm({ almacen_id: '', cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, notas: '', fecha: hoyPeru() })
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
    setCompraForm(f => {
      const newForm = { ...f, distribucion: dist }
      // Si el almacén pertenece a un distribuidor y el precio está vacío → pre-rellenar
      const almacenId = dist[idx].almacen_id
      const tipoBalon = dist[idx].tipo_balon
      const distrib = distribuidoresList.find(d => d.almacen_id === almacenId)
      if (distrib && parseInt(val) > 0) {
        // Buscar precio en precio_distribuidor_tipo
        const pdt = preciosDistTipo.find(p => p.distribuidor_id === distrib.id && p.tipo_balon === tipoBalon)
        const precioSugerido = pdt?.precio || distrib.precio_base || ''
        // Solo pre-rellenar si el precio actual está vacío
        if (!newForm.precios[tipoBalon]) {
          newForm.precios = { ...newForm.precios, [tipoBalon]: precioSugerido.toString() }
        }
      }
      return newForm
    })
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
        <button onClick={() => { setError(''); setMovimientoForm({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: hoyPeru() }); setModal('movimiento') }}
          className="btn-secondary text-xs">
          🔄 Mover entre almacenes
        </button>
        <button onClick={() => { setError(''); setVaciosForm({ almacen_id: '', cantidad: '', notas: '', fecha: hoyPeru() }); setModal('vacios') }}
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
            <button onClick={() => abrirLotesModal(a)}
              style={{marginTop:8,padding:'5px 12px',borderRadius:8,border:'1px solid rgba(59,130,246,0.4)',background:'rgba(59,130,246,0.1)',color:'#60a5fa',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
              📋 Ver lotes
            </button>
            {/* Desglose llenos por tipo */}
            <div className="flex gap-2 mt-1 flex-wrap">
              {(spt5?.stock_actual || 0) > 0 && <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-lg">🔵 5kg: {spt5.stock_actual}</span>}
              {(spt10?.stock_actual || 0) > 0 && <span className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-0.5 rounded-lg">🟡 10kg: {spt10.stock_actual}</span>}
              {(spt45?.stock_actual || 0) > 0 && <span className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded-lg">🔴 45kg: {spt45.stock_actual}</span>}
            </div>
            {/* Desglose vacíos por tipo */}
            {(a.balones_vacios || 0) > 0 && (
              <div className="flex gap-2 mt-1 flex-wrap">
                {(a.vacios_5kg || 0) > 0 && <span className="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-lg">⚪ 5kg: {a.vacios_5kg}</span>}
                {(a.vacios_10kg || 0) > 0 && <span className="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-lg">⚪ 10kg: {a.vacios_10kg}</span>}
                {(a.vacios_45kg || 0) > 0 && <span className="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-lg">⚪ 45kg: {a.vacios_45kg}</span>}
              </div>
            )}
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
          {/* Vista móvil — cards */}
          <div className="lg:hidden divide-y" style={{borderColor:'var(--app-card-border)'}}>
            {almacenes.map(a => {
              const esTienda = a.nombre?.toLowerCase().includes('tienda') || a.nombre?.toLowerCase().includes('principal')
              const spt5 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '5kg')
              const spt10 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '10kg')
              const spt45 = stockPorTipo.find(s => s.almacen_id === a.id && s.tipo_balon === '45kg')
              return (
                <div key={a.id} style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:10}}>
                  {/* Nombre + estado */}
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div>
                      <p style={{color:'var(--app-text)', fontWeight:600, fontSize:14, margin:0}}>{a.nombre}</p>
                      <p style={{color:'var(--app-text-secondary)', fontSize:11, margin:0}}>{a.responsable}</p>
                    </div>
                    <span className={a.stock_actual > 50 ? 'badge-green' : a.stock_actual > 10 ? 'badge-yellow' : 'badge-red'}>
                      {a.stock_actual > 50 ? 'Bien' : a.stock_actual > 10 ? 'Bajo' : 'Crítico'}
                    </span>
                  </div>
                  {/* Stats */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                    <div style={{background:'var(--app-card-bg-alt)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--app-card-border)'}}>
                      <p style={{fontSize:10, color:'var(--app-text-secondary)', margin:'0 0 2px'}}>🟢 Llenos</p>
                      <p style={{fontSize:18, fontWeight:700, color: a.stock_actual > 100 ? '#34d399' : a.stock_actual > 30 ? '#fbbf24' : '#f87171', margin:0}}>{a.stock_actual}</p>
                      <div style={{display:'flex', gap:3, flexWrap:'wrap', marginTop:2}}>
                        {(spt5?.stock_actual||0) > 0 && <span style={{fontSize:9, background:'rgba(59,130,246,0.15)', color:'#93c5fd', padding:'1px 4px', borderRadius:4}}>5kg:{spt5.stock_actual}</span>}
                        {(spt10?.stock_actual||0) > 0 && <span style={{fontSize:9, background:'rgba(234,179,8,0.15)', color:'#fde047', padding:'1px 4px', borderRadius:4}}>10kg:{spt10.stock_actual}</span>}
                        {(spt45?.stock_actual||0) > 0 && <span style={{fontSize:9, background:'rgba(239,68,68,0.15)', color:'#fca5a5', padding:'1px 4px', borderRadius:4}}>45kg:{spt45.stock_actual}</span>}
                      </div>
                    </div>
                    <div style={{background:'var(--app-card-bg-alt)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--app-card-border)'}}>
                      <p style={{fontSize:10, color:'var(--app-text-secondary)', margin:'0 0 2px'}}>⚪ Vacíos</p>
                      <p style={{fontSize:18, fontWeight:700, color:'var(--app-text)', margin:0}}>{a.balones_vacios||0}</p>
                      <div style={{display:'flex', gap:3, flexWrap:'wrap', marginTop:2}}>
                        {(a.vacios_5kg||0) > 0 && <span style={{fontSize:9, color:'var(--app-text-secondary)'}}>5kg:{a.vacios_5kg}</span>}
                        {(a.vacios_10kg||0) > 0 && <span style={{fontSize:9, color:'var(--app-text-secondary)'}}>10kg:{a.vacios_10kg}</span>}
                        {(a.vacios_45kg||0) > 0 && <span style={{fontSize:9, color:'var(--app-text-secondary)'}}>45kg:{a.vacios_45kg}</span>}
                      </div>
                    </div>
                    <div style={{background:'var(--app-card-bg-alt)', borderRadius:10, padding:'8px 10px', border:'1px solid var(--app-card-border)'}}>
                      <p style={{fontSize:10, color:'var(--app-text-secondary)', margin:'0 0 2px'}}>🔵 En calle</p>
                      <p style={{fontSize:18, fontWeight:700, color: esTienda ? '#fb923c' : 'var(--app-text-secondary)', margin:0}}>
                        {esTienda ? balonesEnCalle : '—'}
                      </p>
                    </div>
                  </div>
                  {/* Botones editar */}
                  <div style={{display:'flex', gap:6}}>
                    <button onClick={() => { setEditVaciosModal(a); setEditVaciosModalVal({ '5kg': a.vacios_5kg||0, '10kg': a.vacios_10kg||0, '45kg': a.vacios_45kg||0 }) }}
                      style={{flex:1, padding:'7px', borderRadius:8, border:'1px solid var(--app-card-border)', background:'var(--app-card-bg-alt)', color:'var(--app-text-secondary)', fontSize:11, cursor:'pointer'}}>
                      ✏️ Editar vacíos
                    </button>
                    <button onClick={() => { setEditStockAlmacen(a); setEditStockVal(a.stock_actual || 0) }}
                      style={{flex:1, padding:'7px', borderRadius:8, border:'1px solid var(--app-card-border)', background:'var(--app-card-bg-alt)', color:'var(--app-text-secondary)', fontSize:11, cursor:'pointer'}}>
                      📦 Editar stock
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Vista desktop — tabla */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                {['Almacén','Responsable','🟢 Llenos (por tipo)','⚪ Vacíos','🔵 En calle','Estado',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {almacenes.map(a => {
                  const esTienda = a.nombre?.toLowerCase().includes('tienda') || a.nombre?.toLowerCase().includes('principal')
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
                      {editVacios?.id === a.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-1">
                            {[['5kg','blue'],['10kg','yellow'],['45kg','red']].map(([tipo, color]) => (
                              <div key={tipo} className="text-center">
                                <p className="text-xs text-gray-500 mb-1">{tipo}</p>
                                <input type="number" min="0" className="input text-center text-sm py-1 px-1"
                                  value={editVaciosVal[tipo]}
                                  onChange={e => setEditVaciosVal(v => ({...v, [tipo]: parseInt(e.target.value)||0}))} />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={async () => {
                              const total = Object.values(editVaciosVal).reduce((s,v) => s+(v||0), 0)
                              await supabase.from('almacenes').update({
                                balones_vacios: total,
                                vacios_5kg: editVaciosVal['5kg'] || 0,
                                vacios_10kg: editVaciosVal['10kg'] || 0,
                                vacios_45kg: editVaciosVal['45kg'] || 0,
                              }).eq('id', a.id)
                              setEditVacios(null); cargar()
                            }} className="text-xs bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 px-2 py-1 rounded-lg flex-1">✓</button>
                            <button onClick={() => setEditVacios(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 border border-gray-700 rounded-lg">✕</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-gray-300 font-bold text-lg">{a.balones_vacios || 0} bal.</span>
                          {(a.balones_vacios || 0) > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {(a.vacios_5kg||0) > 0 && <span className="text-xs text-gray-500">5kg:{a.vacios_5kg}</span>}
                              {(a.vacios_10kg||0) > 0 && <span className="text-xs text-gray-500">10kg:{a.vacios_10kg}</span>}
                              {(a.vacios_45kg||0) > 0 && <span className="text-xs text-gray-500">45kg:{a.vacios_45kg}</span>}
                            </div>
                          )}
                        </div>
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
                        <button onClick={() => { setEditVaciosModal(a); setEditVaciosModalVal({ '5kg': a.vacios_5kg||0, '10kg': a.vacios_10kg||0, '45kg': a.vacios_45kg||0 }) }}
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
                  {['Fecha','Proveedor','Marca','Cantidad','Costo/bal.','Total','Amortizado','Pendiente','Estado','Notas',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {compras.map(c => {
                    const montoTotal = c.monto_total || (c.cantidad_total * c.precio_unitario)
                    const amortizado = c.monto_amortizado || 0
                    const pendiente = c.monto_pendiente ?? Math.max(0, montoTotal - amortizado)
                    const estado = c.estado_pago || (pendiente <= 0 ? 'cancelado' : 'por_cancelar')
                    return (
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
                      <td className="px-4 py-4 text-yellow-400 font-bold">S/ {montoTotal.toLocaleString('es-PE')}</td>
                      <td className="px-4 py-4 text-blue-400 text-sm">S/ {amortizado.toLocaleString('es-PE')}</td>
                      <td className="px-4 py-4 font-bold">
                        <span className={pendiente > 0 ? 'text-red-400' : 'text-emerald-400'}>
                          S/ {pendiente.toLocaleString('es-PE')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${estado === 'cancelado' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-orange-900/20 text-orange-300'}`}>
                          {estado === 'cancelado' ? '✅ Cancelado' : '⏳ Por cancelar'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">{c.notas || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={async () => {
                            setLoadingDetalle(true)
                            const { data: dets } = await supabase.from('compra_detalles').select('*').eq('compra_id', c.id)
                            setDetalleCompra({ compra: c, detalles: dets || [] })
                            setLoadingDetalle(false)
                          }}
                            className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg transition-all">
                            👁️ Detalle
                          </button>
                          {estado === 'por_cancelar' && (
                            <button onClick={async () => {
                              const extra = prompt(`Pendiente: S/${pendiente.toLocaleString('es-PE')}\n¿Cuánto pagas ahora? (deja en blanco para cancelar todo)`)
                              if (extra === null) return
                              const monto = extra === '' ? pendiente : parseFloat(extra) || 0
                              await actualizarEstadoPago(c.id, 'cancelado', monto)
                            }}
                              className="text-xs bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-300 px-2 py-1 rounded-lg transition-all">
                              💰 Abonar
                            </button>
                          )}
                          <button onClick={() => { 
                            setEditCompraSelected(c)
                            setEditCompraForm({ fecha: c.fecha, notas: c.notas||'', proveedor_id: c.proveedor_id||'', marca_id: c.marca_id||'' })
                            setError('')
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
                  )})}
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
            <button onClick={() => { setError(''); setMovimientoForm({ origen_id: '', destino_id: '', cantidad: '', tipo_balon: '10kg', notas: '', fecha: hoyPeru() }); setModal('movimiento') }}
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
      {/* Modal detalle compra */}
      {detalleCompra && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <div>
                <h3 className="text-white font-semibold">📦 Detalle de compra</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  {format(new Date(detalleCompra.compra.fecha + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>
              <button onClick={() => setDetalleCompra(null)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Resumen compra */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Proveedor</p>
                  <p className="text-white font-medium text-sm">{detalleCompra.compra.proveedores?.nombre || '-'}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Marca</p>
                  <p className="text-white font-medium text-sm">{detalleCompra.compra.marcas_gas?.nombre || detalleCompra.compra.marca_nombre || '-'}</p>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total balones</p>
                  <p className="text-2xl font-bold text-emerald-400">{detalleCompra.compra.cantidad_total} bal.</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total invertido</p>
                  <p className="text-2xl font-bold text-yellow-400">S/ {(detalleCompra.compra.cantidad_total * detalleCompra.compra.precio_unitario).toLocaleString('es-PE')}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 text-center col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Costo por balón</p>
                  <p className="text-xl font-bold text-blue-400">S/ {detalleCompra.compra.precio_unitario}/bal.</p>
                </div>
              </div>

              {/* Distribución por almacén */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Distribución por almacén y tipo</p>
                {detalleCompra.detalles.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4">Sin detalles de distribución registrados</p>
                ) : (
                  <div className="space-y-2">
                    {/* Agrupar por almacén */}
                    {almacenes.filter(a => detalleCompra.detalles.some(d => d.almacen_id === a.id)).map(a => {
                      const dets = detalleCompra.detalles.filter(d => d.almacen_id === a.id)
                      const totalAlmacen = dets.reduce((s, d) => s + (d.cantidad || 0), 0)
                      return (
                        <div key={a.id} className="bg-gray-800/40 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-white font-medium text-sm">📦 {a.nombre}</p>
                            <span className="text-emerald-400 font-bold text-sm">{totalAlmacen} bal.</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {dets.map((d, i) => (
                              <span key={i} className={`text-xs px-2 py-1 rounded-lg font-medium ${
                                d.tipo_balon === '5kg' ? 'bg-blue-900/30 text-blue-300' :
                                d.tipo_balon === '10kg' ? 'bg-yellow-900/30 text-yellow-300' :
                                'bg-red-900/30 text-red-300'
                              }`}>
                                {d.tipo_balon === '5kg' ? '🔵' : d.tipo_balon === '10kg' ? '🟡' : '🔴'} {d.tipo_balon}: {d.cantidad} bal.
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-600 mt-2">
                            Costo: S/ {(totalAlmacen * detalleCompra.compra.precio_unitario).toLocaleString('es-PE')}
                          </p>
                        </div>
                      )
                    })}
                    {/* Total */}
                    <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total distribuido:</span>
                      <span className="text-emerald-400 font-bold">{detalleCompra.detalles.reduce((s,d) => s+(d.cantidad||0), 0)} bal.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notas */}
              {detalleCompra.compra.notas && (
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">📝 Notas</p>
                  <p className="text-amber-300 text-sm">{detalleCompra.compra.notas}</p>
                </div>
              )}

              <button onClick={() => setDetalleCompra(null)} className="btn-secondary w-full">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar vacíos */}
      {editVaciosModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold text-sm">⚪ Editar balones vacíos</h3>
                <p className="text-gray-500 text-xs mt-0.5">{editVaciosModal.nombre}</p>
              </div>
              <button onClick={() => setEditVaciosModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-500">Ingresa la cantidad de balones vacíos por tipo:</p>
              <div className="grid grid-cols-3 gap-3">
                {[['5kg','🔵','blue'],['10kg','🟡','yellow'],['45kg','🔴','red']].map(([tipo, icon, color]) => (
                  <div key={tipo} className={`bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-center`}>
                    <p className="text-gray-300 font-bold text-xs mb-2">{icon} {tipo}</p>
                    <input type="number" min="0"
                      className="input text-center font-bold py-2"
                      value={editVaciosModalVal[tipo]}
                      onChange={e => setEditVaciosModalVal(v => ({...v, [tipo]: parseInt(e.target.value)||0}))} />
                  </div>
                ))}
              </div>
              {Object.values(editVaciosModalVal).reduce((s,v) => s+(v||0), 0) > 0 && (
                <p className="text-xs text-gray-400 text-right">
                  Total: <span className="text-white font-bold">{Object.values(editVaciosModalVal).reduce((s,v) => s+(v||0), 0)} bal. vacíos</span>
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setEditVaciosModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={async () => {
                  setSaving(true)
                  const total = Object.values(editVaciosModalVal).reduce((s,v) => s+(v||0), 0)
                  await supabase.from('almacenes').update({
                    balones_vacios: total,
                    vacios_5kg: editVaciosModalVal['5kg'] || 0,
                    vacios_10kg: editVaciosModalVal['10kg'] || 0,
                    vacios_45kg: editVaciosModalVal['45kg'] || 0,
                  }).eq('id', editVaciosModal.id)
                  setSaving(false); setEditVaciosModal(null); cargar()
                }} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editStockAlmacen && (() => {
        const distAutonomo = distribuidoresList.find(d => d.almacen_id === editStockAlmacen.id && d.modalidad === 'autonomo')
        return (
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
              {distAutonomo ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-center">
                    <p className="text-yellow-400 font-bold text-xs mb-2">🟡 10kg</p>
                    <input type="number" min="0"
                      className="input text-center font-bold py-2"
                      defaultValue={editStockAlmacen.stock_actual || 0}
                      id="stock-edit-10kg-autonomo" />
                  </div>
                </div>
              ) : (
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
              )}
              <div className="flex gap-3">
                <button onClick={() => setEditStockAlmacen(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={async () => {
                  setSaving(true)
                  if (distAutonomo) {
                    const val = parseInt(document.getElementById('stock-edit-10kg-autonomo')?.value) || 0
                    await supabase.from('almacenes').update({ stock_actual: val }).eq('id', editStockAlmacen.id)
                  } else {
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
                  }
                  setSaving(false); setEditStockAlmacen(null); cargar()
                }} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

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
              <label className="label">Cantidad por tipo de balón</label>
              <div className="grid grid-cols-3 gap-3">
                {[['5kg','🔵','blue'],['10kg','🟡','yellow'],['45kg','🔴','red']].map(([tipo, icon, color]) => (
                  <div key={tipo} className={`bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-center`}>
                    <p className="text-gray-300 font-bold text-xs mb-2">{icon} {tipo}</p>
                    <input type="number" min="0" className="input text-center font-bold py-2"
                      value={vaciosForm.cantidades[tipo] || ''}
                      placeholder="0"
                      onChange={e => setVaciosForm(f => ({...f, cantidades: {...f.cantidades, [tipo]: parseInt(e.target.value)||0}}))} />
                  </div>
                ))}
              </div>
              {Object.values(vaciosForm.cantidades).reduce((s,v) => s+(parseInt(v)||0), 0) > 0 && (
                <p className="text-xs text-gray-400 mt-2 text-right">
                  Total: <span className="text-white font-bold">{Object.values(vaciosForm.cantidades).reduce((s,v) => s+(parseInt(v)||0), 0)} bal.</span>
                </p>
              )}
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
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-gray-300 text-sm font-medium">
                          {distribuidoresList.find(d => d.almacen_id === a.id) ? '🚛' : '📦'} {a.nombre}
                        </p>
                        {a.responsable && <span className="text-xs text-gray-500">({a.responsable})</span>}
                        {(() => {
                          const distrib = distribuidoresList.find(d => d.almacen_id === a.id)
                          if (!distrib) return null
                          return (
                            <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(251,146,60,0.15)', color:'#fb923c', fontWeight:600}}>
                              Dist. · precio config: S/{preciosDistTipo.find(p => p.distribuidor_id === distrib.id && p.tipo_balon === '10kg')?.precio || distrib.precio_base}
                            </span>
                          )
                        })()}
                      </div>
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

            {/* Campos de pago */}
            {(() => {
              const montoTotal = ['5kg','10kg','45kg'].reduce((s,t) =>
                s + (parseInt(compraForm.cantidades[t])||0) * (parseFloat(compraForm.precios[t])||0), 0)
              const amortizado = parseFloat(compraForm.monto_amortizado) || 0
              const pendiente = Math.max(0, montoTotal - amortizado)
              return (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase">💰 Estado de pago</p>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="bg-gray-900 rounded-lg p-2">
                      <p className="text-white font-bold">S/ {montoTotal.toLocaleString('es-PE')}</p>
                      <p className="text-xs text-gray-500">Monto total</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-2">
                      <p className={`font-bold ${pendiente > 0 ? 'text-red-400' : 'text-emerald-400'}`}>S/ {pendiente.toLocaleString('es-PE')}</p>
                      <p className="text-xs text-gray-500">Pendiente</p>
                    </div>
                    <div className={`rounded-lg p-2 ${pendiente <= 0 ? 'bg-emerald-900/30' : 'bg-orange-900/20'}`}>
                      <p className={`font-bold text-xs ${pendiente <= 0 ? 'text-emerald-400' : 'text-orange-300'}`}>
                        {pendiente <= 0 ? '✅ Cancelado' : '⏳ Por cancelar'}
                      </p>
                      <p className="text-xs text-gray-500">Estado</p>
                    </div>
                  </div>
                  <div>
                    <label className="label">Amortizado (lo que pagas ahora) S/</label>
                    <input type="number" min="0" step="0.01" className="input"
                      placeholder="0 — si pagas todo pon el monto total"
                      value={compraForm.monto_amortizado}
                      onChange={e => setCompraForm(f => ({...f, monto_amortizado: e.target.value}))} />
                  </div>
                </div>
              )
            })()}
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

      {/* Modal lotes por almacén */}
      {lotesModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900">
              <div>
                <h3 style={{color:'var(--app-text)',fontWeight:700,fontSize:18,margin:0}}>📦 Lotes — {lotesModal.nombre}</h3>
                <p style={{color:'var(--app-text-secondary)',fontSize:13,marginTop:3}}>{lotesModal.stock_actual} llenos · {lotesModal.balones_vacios || 0} vacíos</p>
              </div>
              <button onClick={() => setLotesModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5">
              {loadingLotes ? (
                <p className="text-center text-gray-500 py-8">Cargando lotes...</p>
              ) : lotesData.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Sin lotes registrados</p>
              ) : (
                <div className="overflow-x-auto">
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#1a3a2a'}}>
                        {['Fecha','Precio/bal','Inicial','Vendidos','Restantes','Valor restante','Estado',''].map(h => (
                          <th key={h} style={{padding:'14px 16px',fontSize:14,fontWeight:700,color:'#4ade80',textAlign:'center',borderRight:'1px solid rgba(255,255,255,0.1)',letterSpacing:'0.5px',textTransform:'uppercase'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lotesData.map((l, i) => {
                        const agotado = l.cerrado || l.cantidad_restante <= 0
                        const valorRestante = (l.cantidad_restante || 0) * (l.precio_unitario || 0)
                        const editando = editPrecioLote?.id === l.id
                        return (
                          <tr key={i} style={{borderBottom:'1px solid var(--app-card-border)',background:i%2===0?'transparent':'var(--app-row-alt)'}}>
                            <td style={{padding:'16px',fontSize:15,color:'var(--app-text)',textAlign:'center',fontWeight:600}}>{l.fecha}</td>
                            <td style={{padding:'16px',fontSize:18,fontWeight:800,color:'#fb923c',textAlign:'center'}}>
                              {editando ? (
                                <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
                                  <span style={{color:'#fb923c',fontSize:15}}>S/</span>
                                  <input type="number" min="0" step="0.01" autoFocus
                                    style={{width:80,padding:'4px 8px',borderRadius:6,border:'1px solid #fb923c',background:'rgba(251,146,60,0.1)',color:'#fb923c',fontSize:16,fontWeight:700,textAlign:'center'}}
                                    value={editPrecioVal}
                                    onChange={e => setEditPrecioVal(e.target.value)} />
                                </div>
                              ) : (
                                l.precio_unitario ? `S/${l.precio_unitario}` : <span style={{color:'#f87171',fontSize:13}}>Sin precio</span>
                              )}
                            </td>
                            <td style={{padding:'16px',fontSize:16,color:'var(--app-text-secondary)',textAlign:'center'}}>{l.cantidad_inicial}</td>
                            <td style={{padding:'16px',fontSize:16,color:'#60a5fa',textAlign:'center',fontWeight:600}}>{l.cantidad_vendida || 0}</td>
                            <td style={{padding:'16px',fontSize:22,fontWeight:800,color:agotado?'#9ca3af':'#34d399',textAlign:'center'}}>{l.cantidad_restante}</td>
                            <td style={{padding:'16px',fontSize:16,fontWeight:700,color:'#34d399',textAlign:'center'}}>
                              {l.precio_unitario ? `S/${valorRestante.toLocaleString('es-PE')}` : '—'}
                            </td>
                            <td style={{padding:'8px',textAlign:'center'}}>
                              <span style={{fontSize:13,fontWeight:700,padding:'5px 14px',borderRadius:6,
                                background:agotado?'rgba(107,114,128,0.15)':'rgba(52,211,153,0.15)',
                                color:agotado?'#9ca3af':'#34d399'}}>
                                {agotado ? 'Agotado' : l.cantidad_vendida === 0 ? 'Nuevo' : 'Activo'}
                              </span>
                            </td>
                            <td style={{padding:'8px',textAlign:'center'}}>
                              {editando ? (
                                <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                                  <button onClick={async () => {
                                    setSavingPrecio(true)
                                    await supabase.from('lotes_distribuidor').update({ precio_unitario: parseFloat(editPrecioVal) }).eq('id', l.id)
                                    setSavingPrecio(false)
                                    setEditPrecioLote(null)
                                    const dist = distribuidoresList.find(d => d.almacen_id === lotesModal.id)
                                    if (dist) {
                                      const { data } = await supabase.from('lotes_distribuidor').select('*').eq('distribuidor_id', dist.id).order('fecha', { ascending: false })
                                      setLotesData(data || [])
                                    }
                                  }} disabled={savingPrecio}
                                    style={{padding:'4px 10px',borderRadius:6,border:'none',background:'#34d399',color:'#000',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                                    {savingPrecio ? '...' : '✓'}
                                  </button>
                                  <button onClick={() => setEditPrecioLote(null)}
                                    style={{padding:'4px 10px',borderRadius:6,border:'none',background:'rgba(239,68,68,0.2)',color:'#f87171',fontSize:12,cursor:'pointer'}}>
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditPrecioLote(l); setEditPrecioVal(l.precio_unitario || '') }}
                                  style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(251,146,60,0.3)',background:'rgba(251,146,60,0.1)',color:'#fb923c',fontSize:12,cursor:'pointer'}}>
                                  ✏️ Precio
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Fila total */}
                    {lotesData.length > 1 && (() => {
                      const totalIni = lotesData.reduce((s,l) => s+(l.cantidad_inicial||0), 0)
                      const totalVend = lotesData.reduce((s,l) => s+(l.cantidad_vendida||0), 0)
                      const totalRest = lotesData.reduce((s,l) => s+(l.cantidad_restante||0), 0)
                      const totalValor = lotesData.reduce((s,l) => s+((l.cantidad_restante||0)*(l.precio_unitario||0)), 0)
                      return (
                        <tfoot>
                          <tr style={{background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)'}}>
                            <td style={{padding:'14px 16px',fontWeight:800,color:'var(--app-text-secondary)',fontSize:15}}>TOTAL</td>
                            <td></td>
                            <td style={{padding:'14px',fontWeight:800,color:'var(--app-text)',textAlign:'center',fontSize:16}}>{totalIni}</td>
                            <td style={{padding:'14px',fontWeight:800,color:'#60a5fa',textAlign:'center',fontSize:16}}>{totalVend}</td>
                            <td style={{padding:'14px',fontWeight:800,color:'#34d399',fontSize:22,textAlign:'center'}}>{totalRest}</td>
                            <td style={{padding:'14px',fontWeight:800,color:'#34d399',textAlign:'center',fontSize:16}}>S/{totalValor.toLocaleString('es-PE')}</td>
                            <td></td><td></td>
                          </tr>
                        </tfoot>
                      )
                    })()}
                  </table>
                </div>
              )}
              <button onClick={() => setLotesModal(null)} className="btn-secondary w-full mt-4">Cerrar</button>
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