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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
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
  const [distribuidores, setDistribuidores] = useState([])
  const [lotesDistribuidor, setLotesDistribuidor] = useState([])
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroFecha, setFiltroFecha] = useState(hoyPeru())

  const [form, setForm] = useState({
    cliente_id: '', cliente_nombre: '', es_varios: false,
    almacen_id: '', precio_tipo_id: '', tipo_balon: '10kg',
    cantidad: '', precio_unitario: '', metodo_pago: 'efectivo', notas: '',
    fecha: hoyPeru(), es_credito: false, credito_tipo: 'dinero',
    tipo_venta: 'gas', precio_balon: '100'
  })

  useEffect(() => { cargar() }, [filtroFecha])

  async function cargar() {
    setLoading(true)
    const [{ data: v }, { data: a }, { data: pt }, { data: c }, { data: ptb }, { data: spt }, { data: dist }, { data: lotes }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre), almacenes(nombre), precio_tipos(nombre)')
        .gte('fecha', filtroFecha + 'T00:00:00-05:00').lte('fecha', filtroFecha + 'T23:59:59-05:00').order('fecha', { ascending: false }),
      supabase.from('almacenes').select('id, nombre, stock_actual').eq('activo', true).order('nombre'),
      supabase.from('precio_tipos').select('*').eq('activo', true),
      supabase.from('clientes').select('id, nombre, tipo, es_varios').order('nombre').limit(100),
      supabase.from('precio_tipo_balon').select('*'),
      supabase.from('stock_por_tipo').select('*'),
      supabase.from('distribuidores').select('id, nombre, almacen_id, precio_base').eq('activo', true),
      supabase.from('lotes_distribuidor').select('*').eq('cerrado', false).order('fecha', { ascending: true })
    ])
    setVentas(v || [])
    setAlmacenes(a || [])
    setPrecioTipos(pt || [])
    setClientes(c || [])
    setPreciosPorTipo(ptb || [])
    setStockPorTipo(spt || [])
    setDistribuidores(dist || [])
    setLotesDistribuidor(lotes || [])
    setLoading(false)
  }

  function getPrecio(precioTipoId, tipoBalon) {
    const p = preciosPorTipo.find(p => p.precio_tipo_id === precioTipoId && p.tipo_balon === tipoBalon)
    return p?.precio || ''
  }

  // Detecta si un almacén pertenece a un distribuidor
  function getDistribuidor(almacenId) {
    return distribuidores.find(d => d.almacen_id === almacenId) || null
  }

  // Obtiene el precio FIFO del lote más antiguo activo del distribuidor
  function getPrecioFIFO(distribuidorId, tipoBalon = '10kg') {
    const lote = lotesDistribuidor.find(l =>
      l.distribuidor_id === distribuidorId &&
      l.tipo_balon === tipoBalon &&
      !l.cerrado &&
      l.cantidad_restante > 0
    )
    return lote ? { precio: lote.precio_unitario, lote } : null
  }

  function getStock(almacenId, tipoBalon) {
    // Si es almacén de distribuidor → stock viene de lotes FIFO
    const dist = getDistribuidor(almacenId)
    if (dist) {
      return lotesDistribuidor
        .filter(l => l.distribuidor_id === dist.id && l.tipo_balon === tipoBalon && !l.cerrado && l.cantidad_restante > 0)
        .reduce((s, l) => s + l.cantidad_restante, 0)
    }
    const s = stockPorTipo.find(s => s.almacen_id === almacenId && s.tipo_balon === tipoBalon)
    return s?.stock_actual || 0
  }

  function abrirModal() {
    const clienteVarios = clientes.find(c => c.es_varios)
    const almacenPerfil = perfil?.almacen_id ? almacenes.find(a => a.id === perfil.almacen_id) : null
    const almacenTienda = almacenes.find(a => a.nombre?.toLowerCase().includes('tienda'))
    const almacenDefault = almacenPerfil || almacenTienda || almacenes[0]
    const primerTipo = precioTipos[0]
    setForm({
      cliente_id: clienteVarios?.id || '', cliente_nombre: 'Cliente Varios', es_varios: true,
      almacen_id: almacenDefault?.id || '', precio_tipo_id: primerTipo?.id || '',
      tipo_balon: '10kg', cantidad: '',
      precio_unitario: getPrecio(primerTipo?.id, '10kg') || primerTipo?.precio || '',
      metodo_pago: 'efectivo', notas: '', es_credito: false, credito_tipo: 'dinero', vales20: '', vales30: '', vales43: '', efectivoDist: '',
      tipo_venta: 'gas', precio_balon: '100'
    })
    setError(''); setModal(true); setBusquedaCliente(''); setSubModal(null)
  }

  function seleccionarTipoPrecio(tipoId) {
    const precio = getPrecio(tipoId, form.tipo_balon)
    setForm(f => ({ ...f, precio_tipo_id: tipoId, precio_unitario: precio }))
  }

  function seleccionarTipoBalon(tipoBalon) {
    const precio = getPrecio(form.precio_tipo_id, tipoBalon)
    setForm(f => ({ ...f, tipo_balon: tipoBalon, precio_unitario: precio }))
  }

  function seleccionarCliente(clienteId) {
    const c = clientes.find(c => c.id === clienteId)
    if (!c) return
    const tipoPrecio = precioTipos.find(t => t.nombre.toLowerCase().includes(c.tipo)) || precioTipos[0]
    const precio = getPrecio(tipoPrecio?.id, form.tipo_balon)
    setForm(f => ({
      ...f, cliente_id: c.id, cliente_nombre: c.nombre, es_varios: c.es_varios,
      precio_tipo_id: tipoPrecio?.id || '', precio_unitario: precio || tipoPrecio?.precio || ''
    }))
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

  // Descuenta ventas de lotes FIFO (más antiguo primero)
  async function aplicarFIFO(distribuidorId, tipoBalon, cantidadVendida) {
    // Obtener lotes abiertos ordenados por fecha ASC (más antiguo primero)
    const { data: lotesAbiertos } = await supabase
      .from('lotes_distribuidor')
      .select('*')
      .eq('distribuidor_id', distribuidorId)
      .eq('tipo_balon', tipoBalon)
      .eq('cerrado', false)
      .gt('cantidad_restante', 0)
      .order('fecha', { ascending: true })

    if (!lotesAbiertos || lotesAbiertos.length === 0) return

    let restante = cantidadVendida

    for (const lote of lotesAbiertos) {
      if (restante <= 0) break

      const descontar = Math.min(restante, lote.cantidad_restante)
      const nuevaVendida = lote.cantidad_vendida + descontar
      const nuevaRestante = lote.cantidad_restante - descontar
      const cerrar = nuevaRestante <= 0

      await supabase.from('lotes_distribuidor').update({
        cantidad_vendida: nuevaVendida,
        cantidad_restante: nuevaRestante,
        cerrado: cerrar
      }).eq('id', lote.id)

      restante -= descontar
    }
  }

  async function guardar() {
    const cant = parseInt(form.cantidad)
    const precioBajon = parseFloat(form.precio_balon) || 0
    const precioGas = parseFloat(form.precio_unitario) || 0

    // Validaciones según tipo de venta
    if (form.tipo_venta === 'gas' || form.tipo_venta === 'gas_balon') {
      if (!form.almacen_id || !cant || !precioGas) { setError('Completa todos los campos'); return }
      const stockDisp = getStock(form.almacen_id, form.tipo_balon)
      if (stockDisp < cant) { setError(`Stock insuficiente. Disponible: ${stockDisp} balones`); return }
    }
    if (form.tipo_venta === 'balon_vacio') {
      if (!form.almacen_id || !cant || !precioBajon) { setError('Completa todos los campos'); return }
    }

    setSaving(true); setError('')
    const campoVacios = form.tipo_balon === '5kg' ? 'vacios_5kg' : form.tipo_balon === '45kg' ? 'vacios_45kg' : 'vacios_10kg'
    const { data: almFresco } = await supabase.from('almacenes')
      .select('stock_actual, balones_vacios, vacios_5kg, vacios_10kg, vacios_45kg')
      .eq('id', form.almacen_id).single()

    // Determinar comportamiento según tipo de crédito
    const esCred = form.es_credito
    const credTipo = form.credito_tipo
    const debeBalon = esCred && (credTipo === 'balon' || credTipo === 'ambos')
    const debeDinero = esCred && (credTipo === 'dinero' || credTipo === 'ambos')

    if (form.tipo_venta === 'gas') {
      // Venta normal — solo gas, cliente trae su vacío
      const stockDisp = getStock(form.almacen_id, form.tipo_balon)
      const { error: e } = await supabase.from('ventas').insert({
        cliente_id: form.cliente_id || null, almacen_id: form.almacen_id,
        precio_tipo_id: form.precio_tipo_id || null, tipo_balon: form.tipo_balon,
        fecha: (form.fecha || hoyPeru()) + 'T12:00:00-05:00',
        cantidad: cant, precio_unitario: precioGas,
        metodo_pago: debeDinero ? 'credito' : form.metodo_pago,
        notas: form.notas, usuario_id: perfil?.id || null,
        vales_20: form.es_distribuidor ? (parseInt(form.vales20)||0) : null,
        vales_30: form.es_distribuidor ? (parseInt(form.vales30)||0) : null,
        vales_43: form.es_distribuidor ? (parseInt(form.vales43)||0) : null,
        efectivo_dist: form.es_distribuidor ? (parseFloat(form.efectivoDist)||0) : null
      })
      if (e) { setError(e.message); setSaving(false); return }
      // Solo actualizar stock_por_tipo para almacenes normales
      if (!form.es_distribuidor) {
        await supabase.from('stock_por_tipo')
          .update({ stock_actual: Math.max(0, stockDisp - cant) })
          .eq('almacen_id', form.almacen_id).eq('tipo_balon', form.tipo_balon)
      }
      if (form.es_distribuidor && form.distribuidor_id) {
        // Distribuidor: solo descontar lotes FIFO
        await aplicarFIFO(form.distribuidor_id, form.tipo_balon, cant)
        // Sincronizar stock_actual con lotes restantes + sumar vacíos
        const { data: lotesActivos } = await supabase.from('lotes_distribuidor')
          .select('cantidad_restante')
          .eq('distribuidor_id', form.distribuidor_id)
          .eq('cerrado', false)
        const totalRestante = (lotesActivos || []).reduce((s,l) => s + (l.cantidad_restante||0), 0)
        const { data: almDist } = await supabase.from('almacenes')
          .select('balones_vacios, vacios_5kg, vacios_10kg, vacios_45kg')
          .eq('id', form.almacen_id).single()
        await supabase.from('almacenes').update({
          stock_actual: totalRestante,
          balones_vacios: (almDist?.balones_vacios || 0) + cant,
          [campoVacios]: (almDist?.[campoVacios] || 0) + cant
        }).eq('id', form.almacen_id)
      } else {
        // Almacén normal: descontar stock_actual y sumar vacíos
        const { data: almActual } = await supabase.from('almacenes')
          .select('stock_actual, balones_vacios, vacios_5kg, vacios_10kg, vacios_45kg')
          .eq('id', form.almacen_id).single()
        if (almActual) {
          const updateData = { stock_actual: Math.max(0, (almActual.stock_actual || 0) - cant) }
          if (!debeBalon) {
            updateData.balones_vacios = (almActual.balones_vacios || 0) + cant
            updateData[campoVacios] = (almActual[campoVacios] || 0) + cant
          }
          await supabase.from('almacenes').update(updateData).eq('id', form.almacen_id)
        }
      }

    } else if (form.tipo_venta === 'gas_balon') {
      // Venta gas + balón — precio total = gas + balón
      const precioTotal = precioGas + precioBajon
      const stockDisp = getStock(form.almacen_id, form.tipo_balon)
      const { error: e } = await supabase.from('ventas').insert({
        cliente_id: form.cliente_id || null, almacen_id: form.almacen_id,
        precio_tipo_id: form.precio_tipo_id || null, tipo_balon: form.tipo_balon,
        fecha: (form.fecha || hoyPeru()) + 'T12:00:00-05:00',
        cantidad: cant, precio_unitario: precioTotal, metodo_pago: form.metodo_pago,
        notas: `Gas+Balón (gas:S/${precioGas} bal:S/${precioBajon})${form.notas ? ' — ' + form.notas : ''}`,
        usuario_id: perfil?.id || null
      })
      if (e) { setError(e.message); setSaving(false); return }
      if (!form.es_distribuidor) {
        await supabase.from('stock_por_tipo')
          .update({ stock_actual: Math.max(0, stockDisp - cant) })
          .eq('almacen_id', form.almacen_id).eq('tipo_balon', form.tipo_balon)
      }
      // Descuenta lleno, NO suma vacío (el balón se fue con el cliente)
      const { data: almActualGB } = await supabase.from('almacenes')
        .select('stock_actual').eq('id', form.almacen_id).single()
      if (almActualGB) {
        await supabase.from('almacenes').update({
          stock_actual: Math.max(0, (almActualGB.stock_actual || 0) - cant)
        }).eq('id', form.almacen_id)
      }

    } else if (form.tipo_venta === 'balon_vacio') {
      // Venta de balón vacío — sale del stock de vacíos
      const { error: e } = await supabase.from('ventas').insert({
        cliente_id: form.cliente_id || null, almacen_id: form.almacen_id,
        tipo_balon: form.tipo_balon,
        fecha: (form.fecha || hoyPeru()) + 'T12:00:00-05:00',
        cantidad: cant, precio_unitario: precioBajon, metodo_pago: form.metodo_pago,
        notas: `Venta balón vacío${form.notas ? ' — ' + form.notas : ''}`,
        usuario_id: perfil?.id || null
      })
      if (e) { setError(e.message); setSaving(false); return }
      // Descontar vacíos del stock
      if (almFresco) {
        await supabase.from('almacenes').update({
          balones_vacios: Math.max(0, (almFresco.balones_vacios || 0) - cant),
          [campoVacios]: Math.max(0, (almFresco[campoVacios] || 0) - cant)
        }).eq('id', form.almacen_id)
      }
    }
    // Si es venta al crédito → crear o sumar a deuda existente
    if (esCred) {
      const totalDeuda = cant * parseFloat(form.precio_unitario)
      const montoDeuda = debeDinero ? totalDeuda : 0
      const balonesDeuda = debeBalon ? cant : 0

      // Buscar deuda activa del mismo cliente
      const { data: deudaExistente } = await supabase.from('deudas')
        .select('*').in('estado', ['activa', 'pagada_parcial'])
        .ilike('nombre_deudor', (form.cliente_nombre || 'Cliente Varios').trim())
        .limit(1).single()

      if (deudaExistente) {
        // Sumar a deuda existente
        const historialAnterior = deudaExistente.historial || []
        await supabase.from('deudas').update({
          monto_pendiente: (parseFloat(deudaExistente.monto_pendiente) || 0) + montoDeuda,
          monto_original: (parseFloat(deudaExistente.monto_original) || 0) + montoDeuda,
          balones_pendiente: (parseInt(deudaExistente.balones_pendiente) || 0) + balonesDeuda,
          cantidad_pendiente: (parseInt(deudaExistente.cantidad_pendiente) || 0) + balonesDeuda,
          estado: 'activa',
          historial: [...historialAnterior, { tipo: 'deuda', fecha: form.fecha || hoyPeru(), monto: montoDeuda, balones: balonesDeuda, tipo_balon: form.tipo_balon, notas: 'Venta al crédito' }],
          updated_at: new Date().toISOString()
        }).eq('id', deudaExistente.id)
      } else {
        // Crear nueva deuda
        await supabase.from('deudas').insert({
          cliente_id: form.cliente_id || null,
          nombre_deudor: (form.cliente_nombre || 'Cliente Varios').trim(),
          tipo_deuda: 'mixto',
          monto_original: montoDeuda, monto_pendiente: montoDeuda,
          cantidad_original: balonesDeuda, cantidad_pendiente: balonesDeuda,
          balones_pendiente: balonesDeuda,
          fecha_deuda: form.fecha || hoyPeru(),
          estado: 'activa',
          notas: `Venta al crédito${form.notas ? ' — ' + form.notas : ''}`,
          almacen_id: form.almacen_id,
          usuario_id: perfil?.id || null,
          historial: [{ tipo: 'deuda', fecha: form.fecha || hoyPeru(), monto: montoDeuda, balones: balonesDeuda, tipo_balon: form.tipo_balon, notas: 'Venta al crédito' }]
        })
      }
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
            <>
            {/* Móvil — cards */}
            <div className="lg:hidden divide-y" style={{borderColor:'var(--app-card-border)'}}>
              {ventasFiltradas.map(v => (
                <div key={v.id} style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:8}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div>
                      <p style={{color:'var(--app-text)', fontWeight:600, fontSize:14, margin:0}}>{v.clientes?.nombre || 'Cliente Varios'}</p>
                      <p style={{color:'var(--app-text-secondary)', fontSize:11, margin:0}}>{new Date(v.fecha).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'})} · {v.almacenes?.nombre}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{color:'#34d399', fontWeight:700, fontSize:16, margin:0}}>S/{(v.cantidad * v.precio_unitario).toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.metodo_pago==='efectivo'?'bg-emerald-900/40 text-emerald-400':v.metodo_pago==='yape'?'bg-blue-900/40 text-blue-400':v.metodo_pago==='vale'?'bg-yellow-900/40 text-yellow-400':'bg-purple-900/40 text-purple-400'}`}>{v.metodo_pago}</span>
                    </div>
                  </div>
                  <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                    <span className="badge-blue">{v.tipo_balon||'10kg'}</span>
                    <span style={{color:'var(--app-text-secondary)', fontSize:12}}>x{v.cantidad} · S/{v.precio_unitario}c/u</span>
                    {v.precio_tipos?.nombre && <span style={{color:'var(--app-text-secondary)', fontSize:11}}>{v.precio_tipos.nombre}</span>}
                    {v.notas && <span style={{color:'var(--app-text-secondary)', fontSize:11, fontStyle:'italic'}}>"{v.notas}"</span>}
                    <button onClick={() => eliminarVenta(v)} style={{marginLeft:'auto', color:'#6b7280', background:'none', border:'none', cursor:'pointer', padding:4}}>
                      <Trash2 style={{width:14,height:14}} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop — tabla */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-800">
                  {['Hora','Cliente','Almacén','Tipo cliente','Balón','Cant.','Precio','Total','Pago','Notas',''].map(h => (
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
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.metodo_pago === 'efectivo' ? 'bg-emerald-900/40 text-emerald-400' : v.metodo_pago === 'yape' ? 'bg-blue-900/40 text-blue-400' : v.metodo_pago === 'vale' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-purple-900/40 text-purple-400'}`}>{v.metodo_pago}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-32 truncate" title={v.notas || ''}>{v.notas || <span className="text-gray-700">—</span>}</td>
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
            </>
          )}
      </div>

      {modal && (
        <Modal title="Registrar venta" onClose={() => setModal(false)} wide>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
            {/* ── Columna izquierda ── */}
            <div className="space-y-4">
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
                  <div className=" mt-1 rounded-lg overflow-hidden" style={{zIndex:9999,position:'absolute',background:'var(--app-modal-bg)',border:'1px solid #374151',width:'100%'}}>
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
                const almId = e.target.value
                const dist = getDistribuidor(almId)
                if (dist) {
                  // Almacén de distribuidor → precio FIFO automático
                  const fifo = getPrecioFIFO(dist.id, form.tipo_balon)
                  setForm(f => ({
                    ...f,
                    almacen_id: almId,
                    es_distribuidor: true,
                    distribuidor_id: dist.id,
                    precio_unitario: fifo ? fifo.precio : dist.precio_base,
                    precio_tipo_id: '' // no aplica tipo de cliente
                  }))
                } else {
                  setForm(f => ({ ...f, almacen_id: almId, es_distribuidor: false, distribuidor_id: null }))
                }
              }}>
                {almacenes.map(a => {
                  const dist = getDistribuidor(a.id)
                  return <option key={a.id} value={a.id}>{dist ? `🚛 ${a.nombre}` : a.nombre}</option>
                })}
              </select>
              {form.es_distribuidor && (() => {
                const fifo = getPrecioFIFO(form.distribuidor_id, form.tipo_balon)
                const lote = fifo?.lote
                return (
                  <div style={{marginTop:6, padding:'8px 12px', borderRadius:8, background:'rgba(251,146,60,0.1)', border:'1px solid rgba(251,146,60,0.3)'}}>
                    <p style={{fontSize:11, color:'#fb923c', margin:0, fontWeight:600}}>
                      🚛 Almacén distribuidor — Precio FIFO automático
                    </p>
                    {lote ? (
                      <p style={{fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0'}}>
                        Lote {lote.fecha} · S/{lote.precio_unitario}/bal. · {lote.cantidad_restante} restantes
                      </p>
                    ) : (
                      <p style={{fontSize:11, color:'#f87171', margin:'2px 0 0'}}>⚠️ Sin lotes activos — registra una reposición primero</p>
                    )}
                  </div>
                )
              })()}
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
            </div>
            {/* Tipo de venta — toggle */}
            <div className={`rounded-xl border p-3 cursor-pointer transition-all ${form.tipo_venta !== 'gas' ? 'bg-blue-900/20 border-blue-600/50' : 'bg-gray-800/50 border-gray-700'}`}
              onClick={() => setForm(f => ({...f, tipo_venta: f.tipo_venta === 'gas' ? 'gas_balon' : 'gas', precio_balon: '100'}))}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${form.tipo_venta !== 'gas' ? 'text-blue-300' : 'text-gray-400'}`}>🔵 ¿Incluye balón?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Activa si el cliente se lleva el envase también</p>
                </div>
                <div className={`w-10 h-5 rounded-full transition-all relative ${form.tipo_venta !== 'gas' ? 'bg-blue-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.tipo_venta !== 'gas' ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
            </div>

            {/* Opciones de balón — aparecen solo si está activado */}
            {form.tipo_venta !== 'gas' && (
              <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-3 space-y-3">
                <p className="text-xs text-blue-300 font-medium">¿Qué tipo de balón?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['gas_balon','⛽🔵 Gas + Balón lleno','Se lleva balón lleno con gas'],
                    ['balon_vacio','🔵 Solo balón vacío','Compra solo el envase'],
                  ].map(([val, label, desc]) => (
                    <button key={val} type="button"
                      onClick={e => { e.stopPropagation(); setForm(f => ({...f, tipo_venta: val})) }}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all text-center ${form.tipo_venta === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                      <p>{label}</p>
                      <p className="text-gray-500 font-normal mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="label">Precio balón S/</label>
                  <input type="number" className="input" placeholder="100"
                    value={form.precio_balon}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setForm(f => ({...f, precio_balon: e.target.value}))} />
                </div>
              </div>
            )}

            </div>{/* fin col izquierda */}

            {/* ── Columna derecha ── */}
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Cantidad</label>
                <input type="number" className="input" placeholder="1" value={form.cantidad} onChange={e => setForm(f => ({...f, cantidad: e.target.value}))} />
                {form.tipo_venta !== 'balon_vacio' && <p className="text-xs text-gray-500 mt-1">Stock llenos: {getStock(form.almacen_id, form.tipo_balon)} bal.</p>}
              </div>
              <div>
                {form.tipo_venta === 'balon_vacio' ? (
                  <div>
                    <label className="label">Precio balón vacío S/</label>
                    <input type="number" className="input" placeholder="100" value={form.precio_balon} onChange={e => setForm(f => ({...f, precio_balon: e.target.value}))} />
                  </div>
                ) : (
                  <div>
                    <label className="label">Precio gas S/</label>
                    <input type="number" className="input" value={form.precio_unitario} onChange={e => setForm(f => ({...f, precio_unitario: e.target.value}))} />
                  </div>
                )}
              </div>
            </div>

            {/* Campo precio balón si es gas+balón */}
            {form.tipo_venta === 'gas_balon' && (
              <div>
                <label className="label">Precio balón S/</label>
                <input type="number" className="input" placeholder="100" value={form.precio_balon} onChange={e => setForm(f => ({...f, precio_balon: e.target.value}))} />
              </div>
            )}

            {/* Total */}
            {form.cantidad && (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Total venta:</span>
                <span className="text-emerald-400 font-bold text-lg">
                  S/ {(() => {
                    const cant = parseInt(form.cantidad) || 0
                    if (form.tipo_venta === 'balon_vacio') return (cant * (parseFloat(form.precio_balon)||0)).toLocaleString('es-PE')
                    if (form.tipo_venta === 'gas_balon') return (cant * ((parseFloat(form.precio_unitario)||0) + (parseFloat(form.precio_balon)||0))).toLocaleString('es-PE')
                    return (cant * (parseFloat(form.precio_unitario)||0)).toLocaleString('es-PE')
                  })()}
                </span>
              </div>
            )}
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
            <div><label className="label">Fecha</label><input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div><label className="label">Notas</label><input className="input" placeholder="Observaciones..." value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} /></div>

            {/* Toggle venta al crédito */}
            <div className={`rounded-xl border p-3 cursor-pointer transition-all ${form.es_credito ? 'bg-orange-900/20 border-orange-600/50' : 'bg-gray-800/50 border-gray-700'}`}
              onClick={() => setForm(f => ({...f, es_credito: !f.es_credito, credito_tipo: 'dinero'}))}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${form.es_credito ? 'text-orange-300' : 'text-gray-400'}`}>💳 Venta al crédito</p>
                  <p className="text-xs text-gray-500 mt-0.5">El cliente pagará después</p>
                </div>
                <div className={`w-10 h-5 rounded-full transition-all relative ${form.es_credito ? 'bg-orange-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.es_credito ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
            </div>

            {/* Selector de qué debe */}
            {form.es_credito && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">¿Qué debe el cliente?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['dinero', '💰 Solo dinero', 'Pagará la plata después'],
                    ['balon', '🔵 Solo balón', 'Nos debe devolver el vacío'],
                    ['ambos', '💰🔵 Ambos', 'Debe plata y balón'],
                  ].map(([val, label, desc]) => (
                    <button key={val} type="button"
                      onClick={e => { e.stopPropagation(); setForm(f => ({...f, credito_tipo: val})) }}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all text-center ${form.credito_tipo === val ? 'bg-orange-600/30 border-orange-500 text-orange-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                      <p>{label}</p>
                      <p className="text-gray-500 font-normal mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
                <div className="bg-orange-900/20 rounded-lg p-2 text-xs text-orange-300">
                  {form.credito_tipo === 'dinero' && `⚠️ Deuda: S/${((parseInt(form.cantidad)||0) * (parseFloat(form.precio_unitario)||0)).toLocaleString()} en efectivo`}
                  {form.credito_tipo === 'balon' && `⚠️ Deuda: ${form.cantidad || 0} balón(es) a devolver — dinero cobrado`}
                  {form.credito_tipo === 'ambos' && `⚠️ Deuda: S/${((parseInt(form.cantidad)||0) * (parseFloat(form.precio_unitario)||0)).toLocaleString()} + ${form.cantidad || 0} balón(es)`}
                </div>
              </div>
            )}
            {/* Vales para almacén distribuidor */}
            {form.es_distribuidor && (() => {
              const cant = parseInt(form.cantidad) || 0
              const precio = parseFloat(form.precio_unitario) || 0
              const totalVenta = cant * precio
              const v20 = parseInt(form.vales20) || 0
              const v30 = parseInt(form.vales30) || 0
              const v43 = parseInt(form.vales43) || 0
              const totalVales = v20*20 + v30*30 + v43*43
              const saldo = totalVenta - totalVales
              return (
                <div style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:12,padding:'12px 14px'}}>
                  <p style={{fontSize:12,fontWeight:700,color:'#818cf8',margin:'0 0 10px'}}>🎫 Vales entregados</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
                    <div>
                      <label className="label" style={{fontSize:10}}>Vales S/20</label>
                      <input type="number" min="0" className="input text-center"
                        placeholder="0" value={form.vales20}
                        onChange={e => setForm(f => ({...f, vales20: e.target.value}))} />
                      {v20>0 && <p style={{fontSize:10,color:'#fde047',textAlign:'center',marginTop:2}}>= S/{v20*20}</p>}
                    </div>
                    <div>
                      <label className="label" style={{fontSize:10}}>Vales S/30</label>
                      <input type="number" min="0" className="input text-center"
                        placeholder="0" value={form.vales30}
                        onChange={e => setForm(f => ({...f, vales30: e.target.value}))} />
                      {v30>0 && <p style={{fontSize:10,color:'#fde047',textAlign:'center',marginTop:2}}>= S/{v30*30}</p>}
                    </div>
                    <div>
                      <label className="label" style={{fontSize:10}}>Vales S/43</label>
                      <input type="number" min="0" className="input text-center"
                        placeholder="0" value={form.vales43}
                        onChange={e => setForm(f => ({...f, vales43: e.target.value}))} />
                      {v43>0 && <p style={{fontSize:10,color:'#fde047',textAlign:'center',marginTop:2}}>= S/{v43*43}</p>}
                    </div>
                  </div>
                  {/* Efectivo adicional si hay saldo */}
                  {saldo > 0 && (
                    <div style={{marginTop:8}}>
                      <label className="label" style={{fontSize:10}}>💵 Efectivo S/ (saldo restante)</label>
                      <input type="number" min="0" step="0.50" className="input text-center"
                        placeholder={`S/${saldo.toLocaleString('es-PE')}`}
                        value={form.efectivoDist || ''}
                        onChange={e => setForm(f => ({...f, efectivoDist: e.target.value}))} />
                    </div>
                  )}
                  {totalVales > 0 && (() => {
                    const efectivo = parseFloat(form.efectivoDist) || 0
                    const totalPagado = totalVales + efectivo
                    const saldoFinal = totalVenta - totalPagado
                    return (
                      <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:saldoFinal<=0?'rgba(52,211,153,0.08)':'rgba(251,146,60,0.08)',border:`1px solid ${saldoFinal<=0?'rgba(52,211,153,0.2)':'rgba(251,146,60,0.2)'}`,marginTop:8}}>
                        <div>
                          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>Vales: <span style={{color:'#fde047',fontWeight:700}}>S/{totalVales.toLocaleString('es-PE')}</span></p>
                          {efectivo > 0 && <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Efectivo: <span style={{color:'#34d399',fontWeight:700}}>S/{efectivo.toLocaleString('es-PE')}</span></p>}
                          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Saldo pendiente: <span style={{color:saldoFinal>0?'#f87171':'#34d399',fontWeight:700}}>S/{Math.max(0,saldoFinal).toLocaleString('es-PE')}</span></p>
                        </div>
                        <p style={{fontSize:14,fontWeight:700,color:saldoFinal<=0?'#34d399':'#f87171',margin:0,alignSelf:'center'}}>
                          {saldoFinal<=0?'✅ Pagado':'⏳ Debe S/'+saldoFinal.toLocaleString('es-PE')}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            </div>{/* fin col derecha */}
            </div>{/* fin grid */}

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
