import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { ShoppingCart, Plus, X, AlertCircle, Trash2, Search, Printer, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { Notif } from '../lib/notificaciones'
import VentaRapida from './VentaRapida'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { exportarExcel } from '../lib/exportar'

const TIPOS_BALON = ['5kg', '10kg', '45kg']



// ─── Modal ────────────────────────────────────────────────────────────────────

// ─── Badge método de pago ─────────────────────────────────────────────────────
function PagoBadge({ metodo }) {
  const map = {
    efectivo:      { bg:'rgba(34,197,94,0.12)',  color:'#22c55e',  label:'Efectivo' },
    yape:          { bg:'rgba(99,102,241,0.12)', color:'#818cf8',  label:'Yape' },
    vale:          { bg:'rgba(234,179,8,0.12)',  color:'#eab308',  label:'Vale' },
    credito:       { bg:'rgba(251,146,60,0.12)', color:'#fb923c',  label:'Crédito' },
    mixto:         { bg:'rgba(234,179,8,0.12)',  color:'#eab308',  label:'Combinado' },
    cobro_credito: { bg:'rgba(59,130,246,0.12)', color:'#60a5fa',  label:'Cobro' },
    transferencia: { bg:'rgba(168,85,247,0.12)', color:'#c084fc',  label:'Transfer.' },
  }
  const s = map[metodo] || { bg:'rgba(107,114,128,0.12)', color:'#9ca3af', label: metodo }
  return (
    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500, background:s.bg, color:s.color, border:`1px solid ${s.color}33` }}>
      {s.label}
    </span>
  )
}

const POR_PAGINA = 50

export default function Ventas() {
  const { perfil } = useAuth()
  const { toasts, toast } = useToast()

  // Datos
  const [ventas, setVentas] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [precioTipos, setPrecioTipos] = useState([])
  const [preciosPorTipo, setPreciosPorTipo] = useState([])
  const [stockPorTipo, setStockPorTipo] = useState([])
  const [clientes, setClientes] = useState([])
  const [distribuidores, setDistribuidores] = useState([])
  const [lotesDistribuidor, setLotesDistribuidor] = useState([])

  // UI
  const [loading, setLoading] = useState(true)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [paginaOffset, setPaginaOffset] = useState(0)
  const [modal, setModal] = useState(false)
  const [modalRapido, setModalRapido] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const [filtroFecha, setFiltroFecha] = useState(hoyPeru())
  const [subModal, setSubModal] = useState(null)
  const [confirmando, setConfirmando] = useState(null) // id de venta a confirmar
  const [modalConfirm, setModalConfirm] = useState(null)
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre:'', telefono:'' })
  const [deudaExistente, setDeudaExistente] = useState(null)
  const [loadingDeuda, setLoadingDeuda] = useState(false)

  // Cierre/apertura

  // Formulario venta
  const [form, setForm] = useState({
    cliente_id:'', cliente_nombre:'', es_varios:false,
    almacen_id:'', precio_tipo_id:'', tipo_balon:'10kg',
    cantidad:'', precio_unitario:'', metodo_pago:'efectivo', notas:'',
    fecha:hoyPeru(), es_credito:false, credito_tipo:'dinero',
    tipo_venta:'gas', precio_balon:'100', balones_credito:'',
    vales20:'', vales30:'', vales43:'', efectivoDist:'',
    pago_al_momento:'', // ← nuevo: pago parcial al registrar crédito
    // ── Desglose de pago (vale / combinado) para ventas normales ──
    pago_vale20:'', pago_vale43:'', pago_efectivo_combo:'', pago_yape_combo:'',
  })

  // ─── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    setPaginaOffset(0)
    const [{ data:v, count:totalV },{ data:a },{ data:pt },{ data:c },{ data:ptb },{ data:spt },{ data:dist },{ data:lotes }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre), almacenes(nombre), precio_tipos(nombre)', {count:'exact'})
        .gte('fecha', filtroFecha+'T00:00:00-05:00').lte('fecha', filtroFecha+'T23:59:59-05:00')
        .or('eliminado.is.null,eliminado.eq.false').order('fecha',{ascending:false}).range(0, POR_PAGINA-1),
      supabase.from('almacenes').select('id,nombre,stock_actual').eq('activo',true).order('nombre'),
      supabase.from('precio_tipos').select('*').eq('activo',true),
      supabase.from('clientes').select('id,nombre,tipo,es_varios,telefono,precio_personalizado,tipo_balon_personalizado').order('nombre').limit(200),
      supabase.from('precio_tipo_balon').select('*'),
      supabase.from('stock_por_tipo').select('*'),
      supabase.from('distribuidores').select('id,nombre,almacen_id,precio_base,usa_fifo').eq('activo',true),
      supabase.from('lotes_distribuidor').select('*').eq('cerrado',false).order('fecha',{ascending:true})
    ])
    setVentas(v||[]); setHayMas((totalV||0) > POR_PAGINA); setAlmacenes(a||[]); setPrecioTipos(pt||[])
    setClientes(c||[]); setPreciosPorTipo(ptb||[]); setStockPorTipo(spt||[])
    setDistribuidores(dist||[]); setLotesDistribuidor(lotes||[])
    setLoading(false)
  }, [filtroFecha])


  const cargarMas = useCallback(async () => {
    setCargandoMas(true)
    const nuevaOffset = paginaOffset + POR_PAGINA
    const { data:v, count:totalV } = await supabase.from('ventas')
      .select('*, clientes(nombre), almacenes(nombre), precio_tipos(nombre)', {count:'exact'})
      .gte('fecha', filtroFecha+'T00:00:00-05:00').lte('fecha', filtroFecha+'T23:59:59-05:00')
      .or('eliminado.is.null,eliminado.eq.false').order('fecha',{ascending:false})
      .range(nuevaOffset, nuevaOffset+POR_PAGINA-1)
    setVentas(prev => [...prev, ...(v||[])])
    setHayMas((totalV||0) > nuevaOffset + POR_PAGINA)
    setPaginaOffset(nuevaOffset)
    setCargandoMas(false)
  }, [filtroFecha, paginaOffset])

  useEffect(() => { cargar() }, [cargar])

  // Auto-seleccionar cliente cuando hay coincidencia exacta en búsqueda
  useEffect(() => {
    if(!busquedaCliente || !clientes.length) return
    const exacto = clientes.find(c => !c.es_varios && c.nombre.toLowerCase() === busquedaCliente.toLowerCase())
    if(exacto && form.cliente_id !== exacto.id) seleccionarCliente(exacto.id)
  }, [busquedaCliente, clientes])

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getPrecio = useCallback((precioTipoId, tipoBalon) => {
    const p = preciosPorTipo.find(p => p.precio_tipo_id===precioTipoId && p.tipo_balon===tipoBalon)
    return p?.precio || ''
  }, [preciosPorTipo])

  const getDistribuidor = useCallback((almacenId) => {
    // Solo se considera "distribuidor FIFO" si usa_fifo = true (ej. Cristian).
    // Felix (Alazan) => usa_fifo = false => se trata como almacén normal (stock directo).
    return distribuidores.find(d => d.almacen_id===almacenId && d.usa_fifo) || null
  }, [distribuidores])

  const getPrecioFIFO = useCallback((distribuidorId, tipoBalon='10kg') => {
    const lote = lotesDistribuidor.find(l => l.distribuidor_id===distribuidorId && l.tipo_balon===tipoBalon && !l.cerrado && l.cantidad_restante>0)
    if(lote) return { precio:lote.precio_unitario, lote }
    // Sin lotes → usar precio_base del distribuidor
    const dist = distribuidores.find(d => d.id===distribuidorId)
    return dist ? { precio:dist.precio_base, lote:null } : null
  }, [lotesDistribuidor, distribuidores])

  const getStock = useCallback((almacenId, tipoBalon) => {
    const dist = getDistribuidor(almacenId)
    if(dist) {
      // Si tiene lotes FIFO activos → usar lotes
      const stockFIFO = lotesDistribuidor.filter(l => l.distribuidor_id===dist.id && l.tipo_balon===tipoBalon && !l.cerrado && l.cantidad_restante>0).reduce((s,l) => s+l.cantidad_restante, 0)
      if(stockFIFO > 0) return stockFIFO
      // Sin lotes → usar stock_por_tipo por tipo exacto (NO fallback a stock_actual general)
      const spt = stockPorTipo.find(s => s.almacen_id===almacenId && s.tipo_balon===tipoBalon)
      return spt?.stock_actual || 0
    }
    // Tienda Principal y almacenes normales
    const spt = stockPorTipo.find(s => s.almacen_id===almacenId && s.tipo_balon===tipoBalon)
    if(spt?.stock_actual > 0) return spt.stock_actual
    const alm = almacenes.find(a => a.id===almacenId)
    return alm?.stock_actual || 0
  }, [getDistribuidor, lotesDistribuidor, stockPorTipo, almacenes])

  // ─── Buscar deuda existente del cliente ────────────────────────────────────
  const buscarDeudaCliente = useCallback(async (clienteId, clienteNombre) => {
    if(!clienteId && !clienteNombre) { setDeudaExistente(null); return }
    setLoadingDeuda(true)
    let deuda = null
    if(clienteId) {
      const { data } = await supabase.from('deudas').select('id,monto_pendiente,balones_pendiente,estado').in('estado',['activa','pagada_parcial']).eq('cliente_id',clienteId).maybeSingle()
      deuda = data
    }
    if(!deuda && clienteNombre && !clienteNombre.toLowerCase().includes('varios')) {
      const { data } = await supabase.from('deudas').select('id,monto_pendiente,balones_pendiente,estado').in('estado',['activa','pagada_parcial']).ilike('nombre_deudor',clienteNombre.trim()).maybeSingle()
      deuda = data
    }
    setDeudaExistente(deuda)
    setLoadingDeuda(false)
  }, [])

  // ─── Abrir modal ───────────────────────────────────────────────────────────
  const abrirModal = useCallback(() => {
    const clienteVarios = clientes.find(c => c.es_varios)
    const almacenPerfil = perfil?.almacen_id ? almacenes.find(a => a.id===perfil.almacen_id) : null
    const almacenTienda = almacenes.find(a => a.nombre?.toLowerCase().includes('tienda'))
    const almacenDefault = almacenPerfil || almacenTienda || almacenes[0]
    const primerTipo = precioTipos[0]
    setForm({
      cliente_id:clienteVarios?.id||'', cliente_nombre:'Cliente Varios', es_varios:true,
      almacen_id:almacenDefault?.id||'', precio_tipo_id:primerTipo?.id||'',
      tipo_balon:'10kg', cantidad:'',
      precio_unitario:getPrecio(primerTipo?.id,'10kg')||primerTipo?.precio||'',
      metodo_pago:'efectivo', notas:'', es_credito:false, credito_tipo:'dinero', balones_credito:'',
      fecha:hoyPeru(), tipo_venta:'gas', precio_balon:'100',
      vales20:'', vales30:'', vales43:'', efectivoDist:'', pago_al_momento:'',
      pago_vale20:'', pago_vale43:'', pago_efectivo_combo:'', pago_yape_combo:'',
    })
    setDeudaExistente(null); setError(''); setModal(true); setBusquedaCliente(''); setSubModal(null)
  }, [clientes, almacenes, precioTipos, perfil, getPrecio])

  const seleccionarTipoPrecio = useCallback((tipoId) => {
    const precio = getPrecio(tipoId, form.tipo_balon)
    setForm(f => ({...f, precio_tipo_id:tipoId, precio_unitario:precio}))
  }, [getPrecio, form.tipo_balon])

  const seleccionarTipoBalon = useCallback((tipoBalon) => {
    const precio = getPrecio(form.precio_tipo_id, tipoBalon)
    // Respetar precio personalizado del cliente si aplica a este tipo de balón
    const c = clientes.find(c => c.id === form.cliente_id)
    const precioFinal = (c?.precio_personalizado && (!c?.tipo_balon_personalizado || c?.tipo_balon_personalizado === tipoBalon))
      ? c.precio_personalizado
      : precio
    setForm(f => ({...f, tipo_balon:tipoBalon, precio_unitario:precioFinal}))
  }, [getPrecio, form.precio_tipo_id, form.cliente_id, clientes])

  const seleccionarCliente = useCallback((clienteId) => {
    const c = clientes.find(c => c.id===clienteId)
    if(!c) return
    const tipoPrecio = precioTipos.find(t => t.nombre.toLowerCase().includes(c.tipo)) || precioTipos[0]
    const precio = getPrecio(tipoPrecio?.id, form.tipo_balon)
    // Si es venta de distribuidor, NO sobreescribir el precio FIFO
    if(form.es_distribuidor) {
      setForm(f => ({...f, cliente_id:c.id, cliente_nombre:c.nombre, es_varios:c.es_varios}))
    } else {
      // Si el cliente tiene precio personalizado para el tipo de balón actual, usarlo
      const precioFinal = (c.precio_personalizado && (!c.tipo_balon_personalizado || c.tipo_balon_personalizado === form.tipo_balon))
        ? c.precio_personalizado
        : (precio || tipoPrecio?.precio || '')
      setForm(f => ({...f, cliente_id:c.id, cliente_nombre:c.nombre, es_varios:c.es_varios, precio_tipo_id:tipoPrecio?.id||'', precio_unitario:precioFinal}))
    }
    buscarDeudaCliente(c.id, c.nombre)
  }, [clientes, precioTipos, getPrecio, form.tipo_balon, form.es_distribuidor, buscarDeudaCliente])

  // ─── Guardar cliente rápido ────────────────────────────────────────────────
  const guardarClienteRapido = useCallback(async () => {
    if(!clienteRapidoForm.nombre) return
    const { data:nc } = await supabase.from('clientes').insert({ nombre:clienteRapidoForm.nombre, telefono:clienteRapidoForm.telefono, tipo:'general' }).select().maybeSingle()
    if(nc) {
      setClientes(cs => [...cs, nc].sort((a,b) => a.nombre.localeCompare(b.nombre)))
      seleccionarCliente(nc.id)
      setBusquedaCliente(nc.nombre)
    }
    setClienteRapidoForm({nombre:'',telefono:''}); setSubModal(null)
  }, [clienteRapidoForm, seleccionarCliente])

  // ─── FIFO distribuidor ─────────────────────────────────────────────────────
  const aplicarFIFO = useCallback(async (distribuidorId, tipoBalon, cantidadVendida) => {
    const { data:lotesAbiertos } = await supabase.from('lotes_distribuidor').select('*').eq('distribuidor_id',distribuidorId).eq('tipo_balon',tipoBalon).eq('cerrado',false).gt('cantidad_restante',0).order('fecha',{ascending:true})
    if(!lotesAbiertos?.length) return
    let restante = cantidadVendida
    for(const lote of lotesAbiertos) {
      if(restante <= 0) break
      const descontar = Math.min(restante, lote.cantidad_restante)
      await supabase.from('lotes_distribuidor').update({ cantidad_vendida:lote.cantidad_vendida+descontar, cantidad_restante:lote.cantidad_restante-descontar, cerrado:lote.cantidad_restante-descontar<=0 }).eq('id',lote.id)
      restante -= descontar
    }
  }, [])

  // ─── Eliminar venta ────────────────────────────────────────────────────────
  const eliminarVenta = useCallback(async (venta) => {
    try {
      const stockActual = getStock(venta.almacen_id, venta.tipo_balon||'10kg')
      const tipo = venta.tipo_balon||'10kg'
      const campoVacios = tipo==='5kg'?'vacios_5kg':tipo==='10kg'?'vacios_10kg':'vacios_45kg'
      const almacen = almacenes.find(a => a.id===venta.almacen_id)
      // 1. Restaurar stock — leer DB fresco para sincronizar ambas tablas
      const { data:almFrescoRev } = await supabase.from('almacenes').select('stock_actual,balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',venta.almacen_id).single()
      if(almFrescoRev) {
        const stockRestaurado = (almFrescoRev.stock_actual||0) + venta.cantidad
        await Promise.all([
          supabase.from('stock_por_tipo').update({ stock_actual:stockRestaurado, updated_at:new Date().toISOString() }).eq('almacen_id',venta.almacen_id).eq('tipo_balon',tipo),
          supabase.from('almacenes').update({ stock_actual:stockRestaurado, balones_vacios:Math.max(0,(almFrescoRev.balones_vacios||0)-venta.cantidad), [campoVacios]:Math.max(0,(almFrescoRev[campoVacios]||0)-venta.cantidad) }).eq('id',venta.almacen_id)
        ])
      }
      // 2. Borrar detalles FIFO (FK constraint) — verificar error explicitamente
      const { error:errDet } = await supabase.from('venta_lote_detalles').delete().eq('venta_id',venta.id)
      if(errDet) { console.error('Error FK venta_lote_detalles:', errDet); toast('Error FK: '+errDet.message, 'error'); return }
      // 3. Borrar venta
      const { error } = await supabase.from('ventas').delete().eq('id',venta.id)
      if(error) { console.error('Error eliminando venta:', error); toast('Error: '+error.message, 'error'); return }
      // 4. Si fue venta al crédito → revertir monto de la deuda del cliente
      if(venta.metodo_pago === 'credito') {
        const montoRevertir = (venta.cantidad||0) * (venta.precio_unitario||0)
        let deudaAct = null
        if(venta.cliente_id) {
          const { data:d1 } = await supabase.from('deudas').select('*').in('estado',['activa','pagada_parcial']).eq('cliente_id',venta.cliente_id).limit(1).maybeSingle()
          deudaAct = d1
        }
        if(!deudaAct && venta.clientes?.nombre) {
          const { data:d2 } = await supabase.from('deudas').select('*').in('estado',['activa','pagada_parcial']).ilike('nombre_deudor',venta.clientes.nombre.trim()).limit(1).maybeSingle()
          deudaAct = d2
        }
        if(deudaAct && montoRevertir > 0) {
          const nuevoMonto = Math.max(0, (parseFloat(deudaAct.monto_pendiente)||0) - montoRevertir)
          const nuevosBalones = Math.max(0, parseInt(deudaAct.balones_pendiente)||0)
          const nuevoEstado = nuevoMonto <= 0 && nuevosBalones <= 0 ? 'liquidada' : deudaAct.estado
          await supabase.from('deudas').update({
            monto_pendiente: nuevoMonto,
            estado: nuevoEstado,
            historial: [...(deudaAct.historial||[]), {
              tipo: 'reversal',
              fecha: new Date().toISOString().split('T')[0],
              monto: -montoRevertir,
              balones: 0,
              notas: 'Venta eliminada — crédito revertido automáticamente'
            }],
            updated_at: new Date().toISOString()
          }).eq('id', deudaAct.id)
        }
      }
      toast('Venta eliminada')
      cargar()
    } catch(err) {
      console.error('Error inesperado al eliminar:', err)
      toast('Error al eliminar', 'error')
    } finally {
      setConfirmando(null)
      setModalConfirm(null)
    }
  }, [getStock, almacenes, cargar, toast])

  // ─── Guardar apertura ──────────────────────────────────────────────────────

  // ─── Guardar cierre ────────────────────────────────────────────────────────

  // ─── GUARDAR VENTA ─────────────────────────────────────────────────────────
  const guardar = useCallback(async () => {
    const cant = parseInt(form.cantidad)
    const precioBalon = parseFloat(form.precio_balon)||0
    const precioGas = parseFloat(form.precio_unitario)||0
    const pagoMomento = parseFloat(form.pago_al_momento)||0

    // Validaciones
    if(form.tipo_venta==='gas'||form.tipo_venta==='gas_balon') {
      if(!form.almacen_id||!cant||!precioGas) { setError('Completa todos los campos'); return }
      if(precioGas<=0) { setError('El precio no puede ser cero'); return }
      const stockDisp = getStock(form.almacen_id, form.tipo_balon)
      if(stockDisp<cant) { setError(`Stock insuficiente. Disponible: ${stockDisp} balones`); return }
    }
    if(form.tipo_venta==='balon_vacio') {
      if(!form.almacen_id||!cant||!precioBalon) { setError('Completa todos los campos'); return }
      if(precioBalon<=0) { setError('El precio del balón no puede ser cero'); return }
    }
    // Venta al crédito requiere cliente específico (no Cliente Varios)
    if(form.es_credito && form.es_varios) {
      setError('⚠️ Las ventas al crédito requieren un cliente específico. Busca y selecciona el cliente antes de continuar.')
      return
    }
    // Validar que el desglose de vale/combinado cuadre con el total de la venta
    if(!form.es_distribuidor && !form.es_credito && (form.metodo_pago==='vale'||form.metodo_pago==='mixto')) {
      const totalVentaChk = cant*precioGas
      const v20chk = parseInt(form.pago_vale20)||0, v43chk = parseInt(form.pago_vale43)||0
      const efChk = form.metodo_pago==='mixto' ? (parseFloat(form.pago_efectivo_combo)||0) : 0
      const yaChk = form.metodo_pago==='mixto' ? (parseFloat(form.pago_yape_combo)||0) : 0
      const totalPagadoChk = v20chk*20+v43chk*43+efChk+yaChk
      if(Math.abs(totalPagadoChk-totalVentaChk) > 0.01) { setError(`El desglose de pago (S/${totalPagadoChk}) no cuadra con el total de la venta (S/${totalVentaChk})`); return }
    }

    setSaving(true); setError('')
    const campoVacios = form.tipo_balon==='5kg'?'vacios_5kg':form.tipo_balon==='45kg'?'vacios_45kg':'vacios_10kg'
    const { data:almFresco } = await supabase.from('almacenes').select('stock_actual,balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',form.almacen_id).single()

    const esCred = form.es_credito
    const credTipo = form.credito_tipo
    const debeBalon = esCred&&(credTipo==='balon'||credTipo==='ambos')
    const debeDinero = esCred&&(credTipo==='dinero'||credTipo==='ambos')

    // ── Venta gas normal ──────────────────────────────────────────────────────
    if(form.tipo_venta==='gas') {
      const stockDisp = getStock(form.almacen_id, form.tipo_balon)
      const esComboPago = !form.es_distribuidor && !esCred && (form.metodo_pago==='vale'||form.metodo_pago==='mixto')
      const { error:e } = await supabase.from('ventas').insert({
        cliente_id:form.cliente_id||null, almacen_id:form.almacen_id,
        precio_tipo_id:form.precio_tipo_id||null, tipo_balon:form.tipo_balon,
        fecha:form.fecha===hoyPeru() ? new Date().toISOString() : (form.fecha+'T12:00:00-05:00'),
        cantidad:cant, precio_unitario:precioGas,
        metodo_pago:debeDinero?'credito':form.metodo_pago,
        notas:form.notas, usuario_id:perfil?.id||null,
        vales_20:form.es_distribuidor?(parseInt(form.vales20)||0):(esComboPago?(parseInt(form.pago_vale20)||0):null),
        vales_30:form.es_distribuidor?(parseInt(form.vales30)||0):null,
        vales_43:form.es_distribuidor?(parseInt(form.vales43)||0):(esComboPago?(parseInt(form.pago_vale43)||0):null),
        efectivo_dist:form.es_distribuidor?(parseFloat(form.efectivoDist)||0):null,
        monto_efectivo: form.es_distribuidor||esCred ? null : (form.metodo_pago==='efectivo' ? cant*precioGas : form.metodo_pago==='mixto' ? (parseFloat(form.pago_efectivo_combo)||0) : 0),
        monto_yape: form.es_distribuidor||esCred ? null : (form.metodo_pago==='yape' ? cant*precioGas : form.metodo_pago==='mixto' ? (parseFloat(form.pago_yape_combo)||0) : 0),
      })
      if(e) { setError(e.message); setSaving(false); return }
      if(!form.es_distribuidor) {
        await supabase.from('stock_por_tipo').update({ stock_actual:Math.max(0,stockDisp-cant) }).eq('almacen_id',form.almacen_id).eq('tipo_balon',form.tipo_balon)
      }
      if(form.es_distribuidor&&form.distribuidor_id) {
        // Verificar si hay lotes FIFO activos
        const { data:lotesCheck } = await supabase.from('lotes_distribuidor').select('id').eq('distribuidor_id',form.distribuidor_id).eq('tipo_balon',form.tipo_balon).eq('cerrado',false).gt('cantidad_restante',0).limit(1)
        if(lotesCheck?.length > 0) {
          // Con lotes → FIFO
          await aplicarFIFO(form.distribuidor_id, form.tipo_balon, cant)
          const { data:lotesActivos } = await supabase.from('lotes_distribuidor').select('cantidad_restante').eq('distribuidor_id',form.distribuidor_id).eq('cerrado',false)
          const totalRestante = (lotesActivos||[]).reduce((s,l) => s+(l.cantidad_restante||0),0)
          const { data:almDist } = await supabase.from('almacenes').select('balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',form.almacen_id).single()
          await supabase.from('almacenes').update({ stock_actual:totalRestante, balones_vacios:(almDist?.balones_vacios||0)+cant, [campoVacios]:(almDist?.[campoVacios]||0)+cant }).eq('id',form.almacen_id)
        } else {
          // Sin lotes → leer DB fresco UNA VEZ y actualizar ambas tablas simultáneamente
          const { data:almDist } = await supabase.from('almacenes').select('stock_actual,balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',form.almacen_id).single()
          if(almDist) {
            const nuevoStock = Math.max(0, (almDist.stock_actual||0) - cant)
            await Promise.all([
              supabase.from('stock_por_tipo').update({ stock_actual:nuevoStock }).eq('almacen_id',form.almacen_id).eq('tipo_balon',form.tipo_balon),
              supabase.from('almacenes').update({ stock_actual:nuevoStock, balones_vacios:(almDist.balones_vacios||0)+cant, [campoVacios]:(almDist[campoVacios]||0)+cant }).eq('id',form.almacen_id)
            ])
          }
        }
      } else {
        const { data:almActual } = await supabase.from('almacenes').select('stock_actual,balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',form.almacen_id).single()
        if(almActual) {
          const vaciosEntregados = debeBalon ? Math.max(0,cant-(parseInt(form.balones_credito)||cant)) : cant
          const updateData = { stock_actual:Math.max(0,(almActual.stock_actual||0)-cant) }
          if(vaciosEntregados>0) { updateData.balones_vacios=(almActual.balones_vacios||0)+vaciosEntregados; updateData[campoVacios]=(almActual[campoVacios]||0)+vaciosEntregados }
          await supabase.from('almacenes').update(updateData).eq('id',form.almacen_id)
        }
      }
    // ── Venta gas + balón ─────────────────────────────────────────────────────
    } else if(form.tipo_venta==='gas_balon') {
      const precioTotal = precioGas+precioBalon
      const stockDisp = getStock(form.almacen_id, form.tipo_balon)
      const { error:e } = await supabase.from('ventas').insert({
        cliente_id:form.cliente_id||null, almacen_id:form.almacen_id,
        precio_tipo_id:form.precio_tipo_id||null, tipo_balon:form.tipo_balon,
        fecha:form.fecha===hoyPeru() ? new Date().toISOString() : (form.fecha+'T12:00:00-05:00'),
        cantidad:cant, precio_unitario:precioTotal, metodo_pago:form.metodo_pago,
        notas:`Gas+Balón (gas:S/${precioGas} bal:S/${precioBalon})${form.notas?' — '+form.notas:''}`,
        usuario_id:perfil?.id||null
      })
      if(e) { setError(e.message); setSaving(false); return }
      if(!form.es_distribuidor) await supabase.from('stock_por_tipo').update({ stock_actual:Math.max(0,stockDisp-cant) }).eq('almacen_id',form.almacen_id).eq('tipo_balon',form.tipo_balon)
      const { data:almActualGB } = await supabase.from('almacenes').select('stock_actual').eq('id',form.almacen_id).single()
      if(almActualGB) await supabase.from('almacenes').update({ stock_actual:Math.max(0,(almActualGB.stock_actual||0)-cant) }).eq('id',form.almacen_id)
    // ── Venta balón vacío ─────────────────────────────────────────────────────
    } else if(form.tipo_venta==='balon_vacio') {
      const { error:e } = await supabase.from('ventas').insert({
        cliente_id:form.cliente_id||null, almacen_id:form.almacen_id,
        tipo_balon:form.tipo_balon, fecha:form.fecha===hoyPeru() ? new Date().toISOString() : (form.fecha+'T12:00:00-05:00'),
        cantidad:cant, precio_unitario:precioBalon, metodo_pago:form.metodo_pago,
        notas:`Venta balón vacío${form.notas?' — '+form.notas:''}`, usuario_id:perfil?.id||null
      })
      if(e) { setError(e.message); setSaving(false); return }
      if(almFresco) await supabase.from('almacenes').update({ balones_vacios:Math.max(0,(almFresco.balones_vacios||0)-cant), [campoVacios]:Math.max(0,(almFresco[campoVacios]||0)-cant) }).eq('id',form.almacen_id)
    }

    // ── Crédito: crear/sumar deuda con pago parcial ───────────────────────────
    if(esCred) {
      const totalDeuda = cant*precioGas
      const montoDeuda = debeDinero ? Math.max(0,totalDeuda-pagoMomento) : 0
      const balonesDeuda = debeBalon ? (parseInt(form.balones_credito)||cant) : 0

      let deudaAct = null
      if(form.cliente_id) {
        const { data:d1 } = await supabase.from('deudas').select('*').in('estado',['activa','pagada_parcial']).eq('cliente_id',form.cliente_id).limit(1).maybeSingle()
        deudaAct = d1
      }
      if(!deudaAct) {
        const { data:d2 } = await supabase.from('deudas').select('*').in('estado',['activa','pagada_parcial']).ilike('nombre_deudor',(form.cliente_nombre||'Cliente Varios').trim()).limit(1).maybeSingle()
        deudaAct = d2
      }
      const notasDeuda = `Venta al crédito${pagoMomento>0?` (pagó S/${pagoMomento} al momento)`:''}`+(form.notas?' — '+form.notas:'')
      if(deudaAct) {
        await supabase.from('deudas').update({
          monto_pendiente:(parseFloat(deudaAct.monto_pendiente)||0)+montoDeuda,
          monto_original:(parseFloat(deudaAct.monto_original)||0)+montoDeuda,
          balones_pendiente:(parseInt(deudaAct.balones_pendiente)||0)+balonesDeuda,
          cantidad_pendiente:(parseInt(deudaAct.cantidad_pendiente)||0)+balonesDeuda,
          estado:'activa',
          historial:[...(deudaAct.historial||[]),{tipo:'deuda',fecha:form.fecha||hoyPeru(),monto:montoDeuda,balones:balonesDeuda,tipo_balon:form.tipo_balon,notas:notasDeuda}],
          updated_at:new Date().toISOString()
        }).eq('id',deudaAct.id)
      } else if(montoDeuda>0||balonesDeuda>0) {
        await supabase.from('deudas').insert({
          cliente_id:form.cliente_id||null,
          nombre_deudor:(form.cliente_nombre||'Cliente Varios').trim(),
          tipo_deuda:'mixto',
          monto_original:montoDeuda, monto_pendiente:montoDeuda,
          cantidad_original:balonesDeuda, cantidad_pendiente:balonesDeuda, balones_pendiente:balonesDeuda,
          fecha_deuda:form.fecha||hoyPeru(), estado:'activa', notas:notasDeuda,
          almacen_id:form.almacen_id, usuario_id:perfil?.id||null,
          historial:[{tipo:'deuda',fecha:form.fecha||hoyPeru(),monto:montoDeuda,balones:balonesDeuda,tipo_balon:form.tipo_balon,notas:notasDeuda}]
        })
      }
    }

    setSaving(false); setModal(false); toast('Venta registrada'); cargar()
    // Notificar si fue venta al crédito
    if(esCred) {
      const actor = perfil?.nombre || 'Un usuario'
      const cliente = form.cliente_nombre || 'Cliente Varios'
      const montoCred = Math.max(0,(parseInt(form.cantidad)||0)*(parseFloat(form.precio_unitario)||0)-(parseFloat(form.pago_al_momento)||0))
      const balonesCredito = parseInt(form.balones_credito)||0
      const resumen = debeDinero ? `S/${montoCred.toFixed(0)}` : debeBalon ? `${balonesCredito} balón(es)` : ''
      Notif.nuevaVentaCredito(cliente, resumen, actor)
    }
  }, [form, getStock, aplicarFIFO, perfil, cargar, toast])

  // ─── Cálculos del día ──────────────────────────────────────────────────────
  const ventasFiltradas = ventas.filter(v =>
    !busqueda || v.clientes?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || v.clientes?.telefono?.includes(busqueda)
  )
  const totalDia = ventas.reduce((s,v) => s+(v.cantidad*v.precio_unitario),0)
  const totalBalones = ventas.reduce((s,v) => s+v.cantidad,0)
  // Efectivo/Yape/Vales — incluye la parte correspondiente de ventas combinadas ('mixto')
  const totalEfectivo = ventas.reduce((s,v) => {
    if(v.metodo_pago==='efectivo') return s+(v.monto_efectivo!=null?v.monto_efectivo:v.cantidad*v.precio_unitario)
    if(v.metodo_pago==='mixto') return s+(v.monto_efectivo||0)
    return s
  }, 0)
  const totalYape = ventas.reduce((s,v) => {
    if(v.metodo_pago==='yape') return s+(v.monto_yape!=null?v.monto_yape:v.cantidad*v.precio_unitario)
    if(v.metodo_pago==='mixto') return s+(v.monto_yape||0)
    return s
  }, 0)
  const totalVale20 = ventas.reduce((s,v) => (v.metodo_pago==='vale'||v.metodo_pago==='mixto') ? s+(v.vales_20||0) : s, 0)
  const totalVale43 = ventas.reduce((s,v) => (v.metodo_pago==='vale'||v.metodo_pago==='mixto') ? s+(v.vales_43||0) : s, 0)
  const totalCredito = ventas.filter(v=>v.metodo_pago==='credito').reduce((s,v) => s+(v.cantidad*v.precio_unitario),0)
  const totalCreditos = ventas.filter(v=>v.metodo_pago==='credito').length

  // ─── Resumen en 3 bloques: ventas del día / créditos otorgados hoy / cobros y devoluciones recibidos hoy ──
  // Los "cobros" (metodo_pago='cobro_credito') son pagos o devoluciones de deudas de otros días —
  // no se cuentan como "venta del día" para no inflar el conteo de balones vendidos hoy.
  const ventasDelDia   = ventasFiltradas.filter(v => v.metodo_pago !== 'cobro_credito')
  const creditosHoy    = ventasFiltradas.filter(v => v.metodo_pago === 'credito')
  const cobrosHoy      = ventasFiltradas.filter(v => v.metodo_pago === 'cobro_credito')
  const totalCreditosHoy = creditosHoy.reduce((s,v) => s+(v.cantidad*v.precio_unitario), 0)
  const totalCobrosHoy   = cobrosHoy.reduce((s,v) => s+(v.cantidad*v.precio_unitario), 0)
  const balonesCobrosHoy = cobrosHoy.filter(v => (v.notas||'').includes('bal. devuelto')).length

  // ─── Reporte del día ───────────────────────────────────────────────────────
  const imprimirReporte = useCallback(() => {
    const ventasPorTipo = TIPOS_BALON.map(tipo => {
      const vs = ventas.filter(v => (v.tipo_balon||'10kg')===tipo)
      return { tipo, cantidad:vs.reduce((s,v)=>s+v.cantidad,0), monto:vs.reduce((s,v)=>s+v.cantidad*v.precio_unitario,0) }
    }).filter(x => x.cantidad>0)
    const win = window.open('','_blank')
    win.document.write(`
      <html><head><title>Reporte de Ventas ${filtroFecha}</title>
      <style>body{font-family:Arial;max-width:600px;margin:0 auto;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}tfoot td{font-weight:bold;background:#eee}.credito{color:#f97316}.header{display:flex;justify-content:space-between;margin-bottom:16px}</style>
      </head><body>
      <h1>📋 Reporte de Ventas — ${filtroFecha}</h1>
      <div class="header"><div><b>Total:</b> S/${totalDia.toLocaleString('es-PE',{minimumFractionDigits:2})}</div><div><b>Balones:</b> ${totalBalones}</div></div>
      <table><thead><tr><th>Hora</th><th>Cliente</th><th>Tipo</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Pago</th></tr></thead>
      <tbody>
      ${ventasFiltradas.map(v=>`<tr class="${v.metodo_pago==='credito'?'credito':''}"><td>${new Date(v.fecha).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td><td>${v.clientes?.nombre||'Varios'}</td><td>${v.tipo_balon||'10kg'}</td><td>${v.cantidad}</td><td>S/${v.precio_unitario}</td><td>S/${(v.cantidad*v.precio_unitario).toLocaleString()}</td><td>${v.metodo_pago}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="3">TOTALES</td><td>${totalBalones}</td><td>—</td><td>S/${totalDia.toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td>—</td></tr></tfoot>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:8px">
        <p>💵 Efectivo: <b>S/${totalEfectivo.toLocaleString('es-PE',{minimumFractionDigits:2})}</b></p>
        <p>🟠 Crédito: <b>S/${totalCredito.toLocaleString('es-PE',{minimumFractionDigits:2})}</b> (${totalCreditos} ventas)</p>
        <p style="margin-top:8px;font-weight:bold">Por tipo de balón:</p>
        ${ventasPorTipo.map(x=>`<p>🔵 ${x.tipo}: ${x.cantidad} bal. — S/${x.monto.toLocaleString('es-PE',{minimumFractionDigits:2})}</p>`).join('')}
      </div>
      <script>window.print()</script></body></html>
    `)
    win.document.close()
  }, [ventas, ventasFiltradas, filtroFecha, totalDia, totalBalones, totalEfectivo, totalCredito, totalCreditos])

  // ─── Exportar a Excel ───────────────────────────────────────────────────────
  const exportarExcelDia = useCallback(() => {
    const filas = ventasFiltradas.map(v => ({
      Fecha: format(new Date(v.fecha), 'dd/MM/yyyy HH:mm', { locale: es }),
      Cliente: v.clientes?.nombre || 'Varios',
      'Tipo balón': v.tipo_balon || '10kg',
      Cantidad: v.cantidad,
      'Precio unit.': v.precio_unitario,
      Total: v.cantidad * v.precio_unitario,
      'Método de pago': v.metodo_pago,
      'Efectivo S/': v.monto_efectivo || (v.metodo_pago==='efectivo' ? v.cantidad*v.precio_unitario : 0),
      'Yape S/': v.monto_yape || (v.metodo_pago==='yape' ? v.cantidad*v.precio_unitario : 0),
      'Vales S/20': v.vales_20 || 0,
      'Vales S/43': v.vales_43 || 0,
      Categoría: v.metodo_pago === 'cobro_credito' ? 'Cobro/devolución' : v.metodo_pago === 'credito' ? 'Crédito otorgado' : 'Venta normal',
      Notas: v.notas || '',
    }))
    exportarExcel(filas, `ventas_${filtroFecha}`, 'Ventas')
  }, [ventasFiltradas, filtroFecha])


  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--app-text)',margin:0}}>Ventas</h2>
          <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Registro de ventas diarias</p>
        </div>
        <button onClick={()=>setModalRapido(true)} className="btn-primary"><Plus className="w-4 h-4"/>Nueva venta</button>
      </div>
      {/* ── TAB VENTAS ── */}

      {/* Resumen del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'12px 16px'}}>
          <div className="flex items-end gap-2">
            <div><label className="label text-xs">Filtrar fecha</label><input type="date" className="input text-sm" value={filtroFecha} onChange={e=>setFiltroFecha(e.target.value)}/></div>
            <button onClick={()=>setFiltroFecha(hoyPeru())} className="btn-secondary py-2 text-xs">Hoy</button>
          </div>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontSize:22,fontWeight:700,color:'var(--app-accent)',margin:0}}>{totalBalones}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Balones vendidos</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontSize:20,fontWeight:700,color:'#22c55e',margin:0}}>S/{totalEfectivo.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Efectivo del día</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:`1px solid ${totalCreditos>0?'rgba(251,146,60,0.3)':'var(--app-card-border)'}`,borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontSize:20,fontWeight:700,color:totalCreditos>0?'#fb923c':'var(--app-text-secondary)',margin:0}}>S/{totalCredito.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Crédito ({totalCreditos} ventas)</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontSize:20,fontWeight:700,color:'#818cf8',margin:0}}>S/{totalYape.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Yape del día</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontSize:20,fontWeight:700,color:'#eab308',margin:0}}>{totalVale20}<span style={{fontSize:12,fontWeight:500}}> ×S/20</span></p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Vales S/20 recibidos</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontSize:20,fontWeight:700,color:'#eab308',margin:0}}>{totalVale43}<span style={{fontSize:12,fontWeight:500}}> ×S/43</span></p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Vales S/43 recibidos</p>
        </div>
      </div>

      {/* Resumen en 3 bloques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Bloque 1: Ventas del día */}
        <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid var(--app-card-border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={{fontSize:12,fontWeight:700,color:'var(--app-text)',margin:0}}>🛒 Ventas del día</p>
            <span className="badge-blue" style={{fontSize:10}}>{ventasDelDia.length}</span>
          </div>
          <div style={{padding:'10px 14px',maxHeight:180,overflowY:'auto'}}>
            {ventasDelDia.length===0?(
              <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>Sin ventas aún</p>
            ):ventasDelDia.slice(0,8).map(v=>(
              <div key={v.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'4px 0',fontSize:12}}>
                <span style={{color:'var(--app-text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.clientes?.nombre||'Varios'} · {v.cantidad} bal.</span>
                <span style={{color:'var(--app-text)',fontWeight:600,flexShrink:0}}>S/{(v.cantidad*v.precio_unitario).toLocaleString('es-PE',{maximumFractionDigits:0})}</span>
              </div>
            ))}
            {ventasDelDia.length>8&&<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'4px 0 0'}}>+{ventasDelDia.length-8} más…</p>}
          </div>
        </div>

        {/* Bloque 2: Créditos otorgados hoy */}
        <div style={{background:'var(--app-card-bg)',border:`1px solid ${creditosHoy.length>0?'rgba(251,146,60,0.3)':'var(--app-card-border)'}`,borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid var(--app-card-border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={{fontSize:12,fontWeight:700,color:'#fb923c',margin:0}}>🟠 Créditos otorgados hoy</p>
            <span style={{fontSize:11,fontWeight:700,color:'#fb923c'}}>S/{totalCreditosHoy.toLocaleString('es-PE',{maximumFractionDigits:0})}</span>
          </div>
          <div style={{padding:'10px 14px',maxHeight:180,overflowY:'auto'}}>
            {creditosHoy.length===0?(
              <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>Nadie quedó a deber hoy</p>
            ):creditosHoy.slice(0,8).map(v=>(
              <div key={v.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'4px 0',fontSize:12}}>
                <span style={{color:'var(--app-text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.clientes?.nombre||'Varios'}{v.notas?.includes('manualmente')?' · manual':''}</span>
                <span style={{color:'#fb923c',fontWeight:600,flexShrink:0}}>S/{(v.cantidad*v.precio_unitario).toLocaleString('es-PE',{maximumFractionDigits:0})}</span>
              </div>
            ))}
            {creditosHoy.length>8&&<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'4px 0 0'}}>+{creditosHoy.length-8} más…</p>}
          </div>
        </div>

        {/* Bloque 3: Cobros y devoluciones recibidos hoy (de deudas de cualquier fecha) */}
        <div style={{background:'var(--app-card-bg)',border:`1px solid ${cobrosHoy.length>0?'rgba(34,197,94,0.3)':'var(--app-card-border)'}`,borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid var(--app-card-border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={{fontSize:12,fontWeight:700,color:'#22c55e',margin:0}}>✅ Cobros y devoluciones hoy</p>
            <span style={{fontSize:11,fontWeight:700,color:'#22c55e'}}>S/{totalCobrosHoy.toLocaleString('es-PE',{maximumFractionDigits:0})}</span>
          </div>
          <div style={{padding:'10px 14px',maxHeight:180,overflowY:'auto'}}>
            {cobrosHoy.length===0?(
              <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>Sin cobros de deudas hoy</p>
            ):cobrosHoy.slice(0,8).map(v=>(
              <div key={v.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'4px 0',fontSize:12}}>
                <span style={{color:'var(--app-text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(v.notas||'').replace('Cobro deuda — ','')}</span>
                <span style={{color:'#22c55e',fontWeight:600,flexShrink:0}}>{v.precio_unitario>0?`S/${(v.cantidad*v.precio_unitario).toLocaleString('es-PE',{maximumFractionDigits:0})}`:'balón'}</span>
              </div>
            ))}
            {balonesCobrosHoy>0&&<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'4px 0 0'}}>⚪ Incluye devolución de balones vacíos</p>}
          </div>
        </div>
      </div>

      {/* Filtros y acciones */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div className="relative flex-1" style={{minWidth:200}}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--app-text-secondary)',pointerEvents:'none'}}/>
          <input className="input" style={{paddingLeft:'36px'}} placeholder="Buscar por cliente o teléfono..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
        </div>
        <button onClick={imprimirReporte} className="btn-secondary" title="Imprimir reporte del día">
          <Printer className="w-4 h-4"/>Reporte
        </button>
        <button onClick={exportarExcelDia} className="btn-secondary" title="Exportar a Excel">
          <FileSpreadsheet className="w-4 h-4"/>Excel
        </button>
      </div>

      {/* Tabla ventas */}
      <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>
            Ventas del {format(new Date(filtroFecha+'T12:00:00'),'dd/MM/yyyy',{locale:es})}
          </h3>
          <span className="badge-blue">{ventasFiltradas.length} ventas</span>
        </div>

        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:120,color:'var(--app-text-secondary)',fontSize:13}}>Cargando...</div>
        ):ventasFiltradas.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:120,color:'var(--app-text-secondary)',gap:8}}>
            <ShoppingCart style={{width:32,height:32,opacity:0.3}}/>
            <p style={{fontSize:13,margin:0}}>Sin ventas registradas</p>
          </div>
        ):(<>
          {/* Móvil */}
          <div className="lg:hidden" style={{borderColor:'var(--app-card-border)'}}>
            {ventasFiltradas.map(v=>{
              const esCredito = v.metodo_pago==='credito'
              return(
                <div key={v.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--app-card-border)',background:esCredito?'rgba(251,146,60,0.04)':'transparent'}}>
                  {esCredito&&<div style={{fontSize:10,color:'#fb923c',fontWeight:600,marginBottom:4}}>⚠️ CRÉDITO PENDIENTE</div>}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <p style={{color:'var(--app-text)',fontWeight:600,fontSize:14,margin:0}}>{v.clientes?.nombre||'Cliente Varios'}</p>
                      <p style={{color:'var(--app-text-secondary)',fontSize:11,margin:0}}>{new Date(v.fecha).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'})} · {v.almacenes?.nombre}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{color:esCredito?'#fb923c':'#22c55e',fontWeight:700,fontSize:16,margin:0}}>S/{(v.cantidad*v.precio_unitario).toLocaleString()}</p>
                      <PagoBadge metodo={v.metodo_pago}/>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:6}}>
                    <span className="badge-blue">{v.tipo_balon||'10kg'}</span>
                    <span style={{color:'var(--app-text-secondary)',fontSize:12}}>x{v.cantidad} · S/{v.precio_unitario}c/u</span>
                    {v.precio_tipos?.nombre&&<span style={{color:'var(--app-text-secondary)',fontSize:11}}>{v.precio_tipos.nombre}</span>}
                    {v.notas&&<span style={{color:'var(--app-text-secondary)',fontSize:11,fontStyle:'italic'}}>"{v.notas}"</span>}
                    <div style={{marginLeft:'auto',display:'flex',gap:4,alignItems:'center'}}>
                      {confirmando===v.id ? (
                        <>
                          <button onPointerDown={()=>eliminarVenta(v)} style={{fontSize:12,padding:'4px 10px',borderRadius:6,background:'rgba(239,68,68,0.9)',border:'none',color:'#fff',cursor:'pointer',fontWeight:600}}>✓ Borrar</button>
                          <button onPointerDown={()=>setConfirmando(null)} style={{fontSize:12,padding:'4px 10px',borderRadius:6,background:'rgba(100,100,100,0.3)',border:'none',color:'var(--app-text)',cursor:'pointer'}}>✕</button>
                        </>
                      ) : (
                        <button onPointerDown={()=>setConfirmando(v.id)} style={{color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4}}>
                          <Trash2 style={{width:14,height:14}}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                {['Hora','Cliente','Almacén','Tipo cliente','Balón','Cant.','Precio','Total','Pago','Notas',''].map(h=>(
                  <th key={h} className="text-left text-xs font-semibold uppercase px-4 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ventasFiltradas.map(v=>{
                  const esCredito = v.metodo_pago==='credito'
                  return(
                    <tr key={v.id} className="table-row-hover" style={{background:esCredito?'rgba(251,146,60,0.04)':'transparent'}}>
                      <td className="px-4 py-3 text-xs" style={{color:'var(--app-text-secondary)'}}>{format(new Date(v.fecha),'HH:mm')}</td>
                      <td className="px-4 py-3 text-sm font-medium" style={{color:'var(--app-text)'}}>
                        {v.clientes?.nombre||'Cliente Varios'}
                        {esCredito&&<span style={{marginLeft:6,fontSize:10,color:'#fb923c'}}>⚠️ crédito</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{color:'var(--app-text-secondary)'}}>{v.almacenes?.nombre}</td>
                      <td className="px-4 py-3 text-xs" style={{color:'var(--app-text-secondary)'}}>{v.precio_tipos?.nombre||'-'}</td>
                      <td className="px-4 py-3"><span className="badge-blue">{v.tipo_balon||'10kg'}</span></td>
                      <td className="px-4 py-3 font-bold" style={{color:'var(--app-accent)'}}>{v.cantidad}</td>
                      <td className="px-4 py-3 text-sm" style={{color:'var(--app-text-secondary)'}}>S/{v.precio_unitario}</td>
                      <td className="px-4 py-3 font-bold" style={{color:esCredito?'#fb923c':'#22c55e'}}>S/{(v.cantidad*v.precio_unitario).toLocaleString()}</td>
                      <td className="px-4 py-3"><PagoBadge metodo={v.metodo_pago}/></td>
                      <td className="px-4 py-3 text-xs" style={{color:'var(--app-text-secondary)',maxWidth:220}}>{v.notas||<span style={{color:'var(--app-card-border)'}}>—</span>}</td>
                      <td className="px-4 py-3">
                        {confirmando===v.id ? (
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>eliminarVenta(v)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,background:'rgba(239,68,68,0.9)',border:'none',color:'#fff',cursor:'pointer',fontWeight:600}}>✓</button>
                            <button onClick={()=>setConfirmando(null)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,background:'rgba(100,100,100,0.3)',border:'none',color:'var(--app-text)',cursor:'pointer'}}>✕</button>
                          </div>
                        ) : (
                          <button onClick={()=>setConfirmando(v.id)} style={{color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:4}} title="Eliminar">
                            <Trash2 style={{width:14,height:14}}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>)}
        {/* Cargar más */}
        {hayMas && !loading && (
          <div style={{display:'flex',justifyContent:'center',padding:'16px'}}>
            <button onClick={cargarMas} disabled={cargandoMas} className="btn-secondary" style={{fontSize:13}}>
              {cargandoMas ? 'Cargando...' : `Ver más ventas`}
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL VENTA ── */}
      {modal&&(
        <Modal title="Registrar venta" onClose={()=>setModal(false)} wide maxHeight={720}>
          <div className="space-y-4">
            {error&&<div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16,flexShrink:0}}/>{error}</div>}

            {/* Alerta deuda existente */}
            {deudaExistente&&!form.es_varios&&(
              <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(251,146,60,0.1)',border:'1px solid rgba(251,146,60,0.3)',color:'#fb923c',borderRadius:8,padding:'10px 14px',fontSize:13}}>
                <AlertTriangle style={{width:16,height:16,flexShrink:0}}/>
                <div>
                  <p style={{margin:0,fontWeight:600}}>⚠️ Este cliente ya tiene deuda activa</p>
                  <p style={{margin:'2px 0 0',fontSize:12}}>
                    {deudaExistente.monto_pendiente>0&&`S/${parseFloat(deudaExistente.monto_pendiente).toLocaleString()} pendiente`}
                    {deudaExistente.balones_pendiente>0&&` · ${deudaExistente.balones_pendiente} balones a devolver`}
                  </p>
                </div>
              </div>
            )}

            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
            {/* ── Columna izquierda ── */}
            <div className="space-y-3">
              {/* Cliente */}
              <div className="relative">
                <label className="label">Cliente</label>
                <input className="input" placeholder="Buscar por nombre o teléfono..."
                  value={busquedaCliente}
                  onFocus={()=>setDropdownAbierto(true)}
                  onBlur={()=>setTimeout(()=>setDropdownAbierto(false),200)}
                  onChange={e=>{setBusquedaCliente(e.target.value);setDropdownAbierto(true);if(!e.target.value){const v=clientes.find(c=>c.es_varios);if(v)seleccionarCliente(v.id)}}}
                  autoFocus/>
                {busquedaCliente.length>=1 && dropdownAbierto &&(()=>{
                  const coincidencias = clientes.filter(c => !c.es_varios && (c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())||(c.telefono&&c.telefono.includes(busquedaCliente))))
                  const exacto = clientes.find(c => c.nombre.toLowerCase()===busquedaCliente.toLowerCase())
                  if(exacto&&!exacto.es_varios) return <div style={{marginTop:4,fontSize:12,color:'#22c55e',paddingLeft:4}}>✅ {exacto.nombre}</div>
                  return(
                    <div style={{position:'absolute',zIndex:9999,background:'var(--app-modal-bg)',border:'1px solid var(--app-card-border)',borderRadius:8,width:'100%',marginTop:2,overflow:'hidden'}}>
                      {coincidencias.slice(0,6).map(c=>(
                        <button key={c.id} type="button"
                          onClick={()=>{seleccionarCliente(c.id);setBusquedaCliente(c.nombre);setDropdownAbierto(false)}}
                          style={{width:'100%',textAlign:'left',padding:'8px 12px',fontSize:13,color:'var(--app-text)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--app-card-bg-alt)'}
                          onMouseLeave={e=>e.currentTarget.style.background='none'}>
                          <span style={{color:'var(--app-accent)'}}>👤</span>{c.nombre}
                          <span style={{marginLeft:'auto',fontSize:11,color:'var(--app-text-secondary)',textTransform:'capitalize'}}>{c.tipo}</span>
                          {c.telefono&&<span style={{fontSize:11,color:'var(--app-text-secondary)'}}>{c.telefono}</span>}
                        </button>
                      ))}
                      <div style={{padding:'8px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderTop:'1px solid var(--app-card-border)'}}>
                        <span style={{fontSize:12,color:'var(--app-text-secondary)'}}>{coincidencias.length===0?'No encontrado':`${coincidencias.length} resultado(s)`}</span>
                        <button type="button" onClick={()=>{setClienteRapidoForm({nombre:busquedaCliente,telefono:''});setSubModal('clienteRapido')}}
                          style={{fontSize:12,padding:'3px 8px',borderRadius:6,background:'color-mix(in srgb, var(--app-accent) 15%, transparent)',border:'1px solid color-mix(in srgb, var(--app-accent) 30%, transparent)',color:'var(--app-accent)',cursor:'pointer'}}>
                          + Registrar cliente
                        </button>
                      </div>
                    </div>
                  )
                })()}
                {!busquedaCliente&&<p style={{fontSize:11,color:'var(--app-text-secondary)',marginTop:4,paddingLeft:4}}>Sin buscar → Cliente Varios</p>}
              </div>

              {/* Almacén */}
              <div>
                <label className="label">Almacén</label>
                <select className="input" value={form.almacen_id} onChange={e=>{
                  const almId=e.target.value
                  const dist=getDistribuidor(almId)
                  if(dist){const fifo=getPrecioFIFO(dist.id,form.tipo_balon);setForm(f=>({...f,almacen_id:almId,es_distribuidor:true,distribuidor_id:dist.id,precio_unitario:fifo?fifo.precio:dist.precio_base,precio_tipo_id:''}))}
                  else setForm(f=>({...f,almacen_id:almId,es_distribuidor:false,distribuidor_id:null}))
                }}>
                  {almacenes.map(a=>{const dist=getDistribuidor(a.id);return<option key={a.id} value={a.id}>{dist?`🚛 ${a.nombre}`:a.nombre}</option>})}
                </select>
                {form.es_distribuidor&&(()=>{
                  const fifo=getPrecioFIFO(form.distribuidor_id,form.tipo_balon)
                  return(
                    <div style={{marginTop:6,padding:'8px 12px',borderRadius:8,background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.25)'}}>
                      <p style={{fontSize:11,color:'#fb923c',margin:0,fontWeight:600}}>🚛 Precio FIFO automático</p>
                      {fifo?.lote?<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Lote {fifo.lote.fecha} · S/{fifo.lote.precio_venta||fifo.lote.precio_unitario}/bal. · {fifo.lote.cantidad_restante} restantes</p>:<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Precio base · stock directo</p>}
                    </div>
                  )
                })()}
              </div>

              {/* Tipo balón */}
              <div>
                <label className="label">Tipo de balón</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS_BALON.map(tipo=>{
                    const stock=getStock(form.almacen_id,tipo)
                    return(
                      <button key={tipo} onClick={()=>seleccionarTipoBalon(tipo)} style={{
                        padding:'6px 6px', borderRadius:8, fontSize:11, fontWeight:500, cursor:'pointer', textAlign:'center', transition:'all 0.15s',
                        background:form.tipo_balon===tipo?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                        border:form.tipo_balon===tipo?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                        color:form.tipo_balon===tipo?'var(--app-accent)':'var(--app-text-secondary)'
                      }}>
                        🔵 {tipo}<br/>
                        <span style={{fontSize:11,color:stock===0?'#f87171':stock<5?'#eab308':'#22c55e'}}>{stock} bal.</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tipo precio */}
              {!form.es_distribuidor&&(
                <div>
                  <label className="label">Tipo de cliente / precio</label>
                  <div className="grid grid-cols-3 gap-2">
                    {precioTipos.map(t=>{
                      const precio=getPrecio(t.id,form.tipo_balon)||t.precio
                      return(
                        <button key={t.id} onClick={()=>seleccionarTipoPrecio(t.id)} style={{
                          padding:'6px', borderRadius:8, fontSize:11, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
                          background:form.precio_tipo_id===t.id?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                          border:form.precio_tipo_id===t.id?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                          color:form.precio_tipo_id===t.id?'var(--app-accent)':'var(--app-text-secondary)'
                        }}>
                          {t.nombre}<br/><span style={{fontWeight:700}}>S/{precio||'?'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Toggle + Fecha en misma fila */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,alignItems:'end'}}>
                <div style={{borderRadius:10,border:'1px solid var(--app-card-border)',padding:'8px 10px',cursor:'pointer',background:form.tipo_venta!=='gas'?'color-mix(in srgb, var(--app-accent) 8%, transparent)':'var(--app-card-bg-alt)',transition:'all 0.15s'}}
                  onClick={()=>setForm(f=>({...f,tipo_venta:f.tipo_venta==='gas'?'gas_balon':'gas',precio_balon:'100'}))}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <p style={{fontSize:11,fontWeight:500,color:form.tipo_venta!=='gas'?'var(--app-accent)':'var(--app-text-secondary)',margin:0}}>🔵 Balón vacío</p>
                    <div style={{width:36,height:18,borderRadius:9,background:form.tipo_venta!=='gas'?'var(--app-accent)':'var(--app-card-border)',position:'relative',transition:'background 0.15s',flexShrink:0}}>
                      <div style={{width:14,height:14,background:'white',borderRadius:'50%',position:'absolute',top:2,left:form.tipo_venta!=='gas'?20:2,transition:'left 0.15s'}}/>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label" style={{fontSize:11}}>Fecha</label>
                  <input type="date" className="input" style={{padding:'6px 10px',fontSize:13}} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
                </div>
              </div>
            </div>

            {/* ── Columna derecha ── */}
            <div className="space-y-3">
              {/* Precio balón si aplica */}
              {form.tipo_venta==='gas_balon'&&(
                <div>
                  <label className="label">Precio del balón vacío</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                    <input type="number" min="0" className="input" style={{paddingLeft:'2rem'}} value={form.precio_balon} onChange={e=>setForm(f=>({...f,precio_balon:e.target.value}))} placeholder="100"/>
                  </div>
                </div>
              )}

              {/* Cantidad */}
              <div>
                <label className="label">Cantidad de balones</label>
                <input type="number" min="1" className="input text-center text-xl font-bold" value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} placeholder="0"/>
              </div>

              {/* Precio unitario */}
              <div>
                <label className="label">
                  Precio por balón
                  {parseFloat(form.precio_unitario)<=0&&form.cantidad&&<span style={{fontSize:11,color:'#f87171',marginLeft:8}}>⚠️ Precio en cero</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)',pointerEvents:'none'}}>S/</span>
                  <input type="number" min="0" step="0.50" className="input" style={{paddingLeft:'2.2rem',fontWeight:700,fontSize:18}} value={form.precio_unitario} onChange={e=>setForm(f=>({...f,precio_unitario:e.target.value}))} placeholder="0"/>
                </div>
                {form.cantidad&&form.precio_unitario&&(
                  <p style={{fontSize:12,color:'var(--app-accent)',marginTop:4,fontWeight:600}}>
                    Total: S/{((parseInt(form.cantidad)||0)*(parseFloat(form.precio_unitario)||0)).toLocaleString('es-PE',{maximumFractionDigits:2})}
                    {form.tipo_venta==='gas_balon'&&` + S/${((parseInt(form.cantidad)||0)*(parseFloat(form.precio_balon)||0)).toLocaleString()} balón`}
                  </p>
                )}
              </div>

              {/* Método de pago */}
              <div>
                <label className="label">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {[['efectivo','💵 Efectivo'],['yape','📱 Yape'],['vale','🎫 Vale'],['mixto','🔀 Combinado'],['transferencia','🏦 Transfer.'],['cobro_credito','✅ Cobro deuda'],].map(([val,label])=>(
                    <button key={val} onClick={()=>setForm(f=>({...f,metodo_pago:val,es_credito:false}))} style={{
                      padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:500, cursor:'pointer', textAlign:'center', transition:'all 0.15s',
                      background:form.metodo_pago===val?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                      border:form.metodo_pago===val?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                      color:form.metodo_pago===val?'var(--app-accent)':'var(--app-text-secondary)'
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Desglose de pago: vale (denominación) o combinado (varios medios) */}
              {(form.metodo_pago==='vale'||form.metodo_pago==='mixto')&&(()=>{
                const totalVenta = (parseInt(form.cantidad)||0)*(parseFloat(form.precio_unitario)||0)
                const v20 = parseInt(form.pago_vale20)||0, v43 = parseInt(form.pago_vale43)||0
                const ef = form.metodo_pago==='mixto' ? (parseFloat(form.pago_efectivo_combo)||0) : 0
                const ya = form.metodo_pago==='mixto' ? (parseFloat(form.pago_yape_combo)||0) : 0
                const totalPagado = v20*20 + v43*43 + ef + ya
                const saldo = totalVenta - totalPagado
                return (
                  <div style={{background:'rgba(234,179,8,0.06)',border:'1px solid rgba(234,179,8,0.25)',borderRadius:10,padding:'12px 14px'}}>
                    <p style={{fontSize:12,fontWeight:700,color:'#eab308',margin:'0 0 10px'}}>
                      {form.metodo_pago==='mixto'?'🔀 Desglose del pago combinado':'🎫 Vales entregados'}
                    </p>
                    <div className="grid grid-cols-2 gap-2" style={{marginBottom:form.metodo_pago==='mixto'?8:0}}>
                      <div><label className="label" style={{fontSize:10}}>Vales S/20</label><input type="number" min="0" className="input text-center" placeholder="0" value={form.pago_vale20} onChange={e=>setForm(f=>({...f,pago_vale20:e.target.value}))}/></div>
                      <div><label className="label" style={{fontSize:10}}>Vales S/43</label><input type="number" min="0" className="input text-center" placeholder="0" value={form.pago_vale43} onChange={e=>setForm(f=>({...f,pago_vale43:e.target.value}))}/></div>
                    </div>
                    {form.metodo_pago==='mixto'&&(
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="label" style={{fontSize:10}}>💵 Efectivo</label><input type="number" min="0" step="0.50" className="input text-center" placeholder="0" value={form.pago_efectivo_combo} onChange={e=>setForm(f=>({...f,pago_efectivo_combo:e.target.value}))}/></div>
                        <div><label className="label" style={{fontSize:10}}>📱 Yape</label><input type="number" min="0" step="0.50" className="input text-center" placeholder="0" value={form.pago_yape_combo} onChange={e=>setForm(f=>({...f,pago_yape_combo:e.target.value}))}/></div>
                      </div>
                    )}
                    {totalVenta>0&&(
                      <div style={{display:'flex',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,marginTop:10,background:saldo===0?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${saldo===0?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`}}>
                        <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>Total: S/{totalVenta.toLocaleString()} · Cubierto: S/{totalPagado.toLocaleString()}</span>
                        <span style={{fontSize:12,fontWeight:700,color:saldo===0?'#22c55e':'#f87171'}}>{saldo===0?'✅ Cuadra':saldo>0?`Falta S/${saldo.toLocaleString()}`:`Sobra S/${Math.abs(saldo).toLocaleString()}`}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Toggle crédito */}
              {!['cobro_credito'].includes(form.metodo_pago)&&(
                <div style={{borderRadius:10,border:'1px solid var(--app-card-border)',padding:'10px 14px',cursor:'pointer',background:form.es_credito?'rgba(251,146,60,0.06)':'var(--app-card-bg-alt)'}}
                  onClick={()=>setForm(f=>({...f,es_credito:!f.es_credito}))}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <p style={{fontSize:13,fontWeight:500,color:form.es_credito?'#fb923c':'var(--app-text-secondary)',margin:0}}>⚠️ ¿Venta al crédito?</p>
                    <div style={{width:36,height:18,borderRadius:9,background:form.es_credito?'#fb923c':'var(--app-card-border)',position:'relative',transition:'background 0.15s'}}>
                      <div style={{width:14,height:14,background:'white',borderRadius:'50%',position:'absolute',top:2,left:form.es_credito?20:2,transition:'left 0.15s'}}/>
                    </div>
                  </div>
                </div>
              )}

              {/* Opciones de crédito */}
              {form.es_credito&&(
                <div style={{background:'rgba(251,146,60,0.06)',border:'1px solid rgba(251,146,60,0.25)',borderRadius:10,padding:'8px 12px'}} className="space-y-2">
                  <p style={{fontSize:11,fontWeight:600,color:'#fb923c',margin:0}}>⚠️ Tipo de deuda</p>
                  <div className="grid grid-cols-3 gap-1">
                    {[['dinero','💵 Dinero','monto'],['balon','🔵 Balón','bal.'],['ambos','💵+🔵 Ambos','ambos']].map(([val,label,desc])=>(
                      <button key={val} onClick={()=>setForm(f=>({...f,credito_tipo:val}))} style={{
                        padding:'5px 4px',borderRadius:7,border:form.credito_tipo===val?'1px solid rgba(251,146,60,0.6)':'1px solid var(--app-card-border)',
                        background:form.credito_tipo===val?'rgba(251,146,60,0.15)':'var(--app-card-bg-alt)',
                        color:form.credito_tipo===val?'#fb923c':'var(--app-text-secondary)',
                        fontSize:10,fontWeight:500,cursor:'pointer',textAlign:'center',lineHeight:1.3
                      }}>
                        <span style={{display:'block'}}>{label}</span>
                        <span style={{opacity:0.6,fontSize:9}}>{desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Balones a devolver */}
                  {(form.credito_tipo==='balon'||form.credito_tipo==='ambos')&&(
                    <div>
                      <label className="label" style={{fontSize:12}}>¿Cuántos balones debe devolver?</label>
                      <input type="number" min="0" max={form.cantidad} className="input text-center" placeholder={`Máx: ${form.cantidad||0}`} value={form.balones_credito} onChange={e=>setForm(f=>({...f,balones_credito:e.target.value}))}/>
                    </div>
                  )}

                  {/* PAGO AL MOMENTO ← nuevo */}
                  {(form.credito_tipo==='dinero'||form.credito_tipo==='ambos')&&(
                    <div>
                      <label className="label" style={{fontSize:12}}>💵 ¿Cuánto paga ahora? (opcional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                        <input type="number" min="0" step="0.50" className="input" style={{paddingLeft:'2rem'}} placeholder="0" value={form.pago_al_momento} onChange={e=>setForm(f=>({...f,pago_al_momento:e.target.value}))}/>
                      </div>
                    </div>
                  )}

                  {/* Resumen crédito */}
                  {(()=>{
                    const cant=parseInt(form.cantidad)||0
                    const precio=parseFloat(form.precio_unitario)||0
                    const total=cant*precio
                    const pago=parseFloat(form.pago_al_momento)||0
                    const saldo=Math.max(0,total-pago)
                    const balones=parseInt(form.balones_credito)||cant
                    return(
                      <div style={{background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:8,padding:'6px 10px',fontSize:11,display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
                        {total>0&&<span style={{color:'var(--app-text-secondary)'}}>Total: <b style={{color:'var(--app-text)'}}>S/{total.toLocaleString()}</b></span>}
                        {pago>0&&<span style={{color:'#22c55e'}}>Paga: <b>S/{pago.toLocaleString()}</b></span>}
                        {(form.credito_tipo==='dinero'||form.credito_tipo==='ambos')&&<span style={{color:'#fb923c',fontWeight:600}}>Debe: S/{saldo.toLocaleString()}</span>}
                        {(form.credito_tipo==='balon'||form.credito_tipo==='ambos')&&<span style={{color:'#fb923c',fontWeight:600}}>Dev: {balones} bal.</span>}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Vales distribuidor */}
              {form.es_distribuidor&&(()=>{
                const cant=parseInt(form.cantidad)||0, precio=parseFloat(form.precio_unitario)||0
                const totalVenta=cant*precio
                const v20=parseInt(form.vales20)||0, v30=parseInt(form.vales30)||0, v43=parseInt(form.vales43)||0
                const totalVales=v20*20+v30*30+v43*43
                const saldo=totalVenta-totalVales
                return(
                  <div style={{background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:10,padding:'12px 14px'}}>
                    <p style={{fontSize:12,fontWeight:700,color:'#818cf8',margin:'0 0 10px'}}>🎫 Vales entregados</p>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
                      {[['vales20','S/20',20],['vales30','S/30',30],['vales43','S/43',43]].map(([key,label,val])=>(
                        <div key={key}>
                          <label className="label" style={{fontSize:10}}>Vales {label}</label>
                          <input type="number" min="0" className="input text-center" placeholder="0" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
                          {parseInt(form[key])>0&&<p style={{fontSize:10,color:'#fde047',textAlign:'center',margin:'2px 0 0'}}>= S/{(parseInt(form[key])||0)*val}</p>}
                        </div>
                      ))}
                    </div>
                    {saldo>0&&(
                      <div>
                        <label className="label" style={{fontSize:10}}>💵 Efectivo adicional (saldo S/{saldo.toLocaleString()})</label>
                        <input type="number" min="0" step="0.50" className="input text-center" placeholder={`S/${saldo.toLocaleString()}`} value={form.efectivoDist||''} onChange={e=>setForm(f=>({...f,efectivoDist:e.target.value}))}/>
                      </div>
                    )}
                    {totalVales>0&&(()=>{
                      const efectivo=parseFloat(form.efectivoDist)||0
                      const totalPagado=totalVales+efectivo
                      const saldoFinal=totalVenta-totalPagado
                      return(
                        <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,marginTop:8,background:saldoFinal<=0?'rgba(34,197,94,0.08)':'rgba(251,146,60,0.08)',border:`1px solid ${saldoFinal<=0?'rgba(34,197,94,0.2)':'rgba(251,146,60,0.2)'}`}}>
                          <div style={{fontSize:11,color:'var(--app-text-secondary)'}}>
                            <p style={{margin:0}}>Vales: <span style={{color:'#fde047',fontWeight:700}}>S/{totalVales}</span></p>
                            {efectivo>0&&<p style={{margin:'2px 0 0'}}>Efectivo: <span style={{color:'#22c55e',fontWeight:700}}>S/{efectivo}</span></p>}
                            <p style={{margin:'2px 0 0'}}>Saldo: <span style={{color:saldoFinal>0?'#f87171':'#22c55e',fontWeight:700}}>S/{Math.max(0,saldoFinal).toLocaleString()}</span></p>
                          </div>
                          <p style={{fontSize:14,fontWeight:700,color:saldoFinal<=0?'#22c55e':'#f87171',margin:0,alignSelf:'center'}}>{saldoFinal<=0?'✅ Pagado':'⏳ Debe S/'+saldoFinal.toLocaleString()}</p>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* Notas */}
              <div>
                <label className="label" style={{fontSize:11}}>Notas (opcional)</label>
                <input className="input" style={{padding:'6px 10px',fontSize:13}} placeholder="Observaciones..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={saving||(!parseFloat(form.precio_unitario)&&form.tipo_venta!=='balon_vacio')} className="btn-primary flex-1 justify-center disabled:opacity-50">
                {saving?'Guardando...':'✓ Registrar venta'}
              </button>
            </div>
          </div>

          {/* Sub-modal cliente rápido */}
          {subModal==='clienteRapido'&&(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)'}}>
              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:14,width:'100%',maxWidth:360,boxShadow:'0 20px 40px rgba(0,0,0,0.4)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)'}}>
                  <h3 style={{color:'var(--app-text)',fontWeight:600,fontSize:14,margin:0}}>👤 Registrar cliente</h3>
                  <button onClick={()=>setSubModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}><X style={{width:16,height:16}}/></button>
                </div>
                <div style={{padding:'16px 20px'}} className="space-y-3">
                  <div><label className="label">Nombre *</label><input className="input" value={clienteRapidoForm.nombre} onChange={e=>setClienteRapidoForm(f=>({...f,nombre:e.target.value}))} autoFocus onKeyDown={e=>e.key==='Enter'&&guardarClienteRapido()}/></div>
                  <div><label className="label">Teléfono (opcional)</label><input className="input" value={clienteRapidoForm.telefono} onChange={e=>setClienteRapidoForm(f=>({...f,telefono:e.target.value}))}/></div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={()=>setSubModal(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={guardarClienteRapido} disabled={!clienteRapidoForm.nombre} className="btn-primary flex-1 justify-center disabled:opacity-50">✓ Registrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {modalRapido&&(<VentaRapida onClose={()=>setModalRapido(false)} onGuardado={()=>{cargar();}} onAbrirDetallado={()=>{setModalRapido(false);abrirModal()}} almacenes={almacenes} precioTipos={precioTipos} preciosPorTipo={preciosPorTipo} stockPorTipo={stockPorTipo} clientes={clientes} distribuidores={distribuidores} lotesDistribuidor={lotesDistribuidor}/>)}
      {/* Modal confirmación eliminar */}
      {modalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
          <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:16,width:'100%',maxWidth:380,padding:'28px 24px',boxShadow:'0 25px 50px rgba(0,0,0,0.4)',textAlign:'center'}}>
            <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:22}}>🗑️</div>
            <p style={{fontSize:15,fontWeight:600,color:'var(--app-text)',margin:'0 0 8px'}}>¿Eliminar venta?</p>
            <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'0 0 24px'}}>{modalConfirm.mensaje}</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setModalConfirm(null)} className="btn-secondary" style={{flex:1}}>Cancelar</button>
              <button onClick={modalConfirm.onConfirm}
                style={{flex:1,padding:'8px 16px',borderRadius:8,background:'rgba(239,68,68,0.9)',border:'none',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts}/>
    </div>
  )
}
