import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru, inicioDiaPeru, finDiaPeru, nowPeru } from '../lib/fechas'
import { ShoppingCart, Plus, X, AlertCircle, Trash2, Search, Printer, CheckCircle, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import VentaRapida from './VentaRapida'

const TIPOS_BALON = ['5kg', '10kg', '45kg']

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position:'fixed', bottom:80, right:20, zIndex:999, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:t.tipo==='error'?'rgba(239,68,68,0.95)':'rgba(34,197,94,0.95)', color:'#fff', fontSize:13, fontWeight:500, boxShadow:'0 4px 16px rgba(0,0,0,0.3)', animation:'fadeInUp 0.2s ease', minWidth:220 }}>
          {t.tipo==='error'?<AlertTriangle style={{width:16,height:16,flexShrink:0}}/>:<CheckCircle style={{width:16,height:16,flexShrink:0}}/>}
          {t.mensaje}
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const timerRef = useRef({})
  const toast = useCallback((mensaje, tipo='ok') => {
    const id = Date.now()
    setToasts(prev => [...prev, {id, mensaje, tipo}])
    timerRef.current[id] = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])
  useEffect(() => () => Object.values(timerRef.current).forEach(clearTimeout), [])
  return { toasts, toast }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
      <div style={{ background:'var(--app-card-bg)', border:'1px solid var(--app-card-border)', borderRadius:16, width:'100%', maxWidth:wide?780:480, boxShadow:'0 25px 50px rgba(0,0,0,0.4)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid var(--app-card-border)', position:'sticky', top:0, background:'var(--app-card-bg)' }}>
          <h3 style={{color:'var(--app-text)', fontWeight:600, margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', color:'var(--app-text-secondary)'}}><X className="w-5 h-5"/></button>
        </div>
        <div style={{padding:'20px 24px'}}>{children}</div>
      </div>
    </div>
  )
}

// ─── Badge método de pago ─────────────────────────────────────────────────────
function PagoBadge({ metodo }) {
  const map = {
    efectivo:      { bg:'rgba(34,197,94,0.12)',  color:'#22c55e',  label:'Efectivo' },
    yape:          { bg:'rgba(99,102,241,0.12)', color:'#818cf8',  label:'Yape' },
    vale:          { bg:'rgba(234,179,8,0.12)',  color:'#eab308',  label:'Vale' },
    credito:       { bg:'rgba(251,146,60,0.12)', color:'#fb923c',  label:'Crédito' },
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
  const [modal, setModal] = useState(false)
  const [modalRapido, setModalRapido] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [filtroFecha, setFiltroFecha] = useState(hoyPeru())
  const [tabActivo, setTabActivo] = useState('ventas')
  const [subModal, setSubModal] = useState(null)
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre:'', telefono:'' })
  const [deudaExistente, setDeudaExistente] = useState(null)
  const [loadingDeuda, setLoadingDeuda] = useState(false)
  const [modalReporte, setModalReporte] = useState(false)

  // Cierre/apertura
  const [filtroCierreAlmacen, setFiltroCierreAlmacen] = useState('')
  const [cierreHoy, setCierreHoy] = useState(null)
  const [loadingCierre, setLoadingCierre] = useState(false)
  const [savingCierre, setSavingCierre] = useState(false)
  const [errorCierre, setErrorCierre] = useState('')
  const [aperturaForm, setAperturaForm] = useState({ '5kg':'','10kg':'','45kg':'','v_5kg':'','v_10kg':'','v_45kg':'' })
  const [cierreForm, setCierreForm] = useState({ '5kg':'','10kg':'','45kg':'' })

  // Formulario venta
  const [form, setForm] = useState({
    cliente_id:'', cliente_nombre:'', es_varios:false,
    almacen_id:'', precio_tipo_id:'', tipo_balon:'10kg',
    cantidad:'', precio_unitario:'', metodo_pago:'efectivo', notas:'',
    fecha:hoyPeru(), es_credito:false, credito_tipo:'dinero',
    tipo_venta:'gas', precio_balon:'100', balones_credito:'',
    vales20:'', vales30:'', vales43:'', efectivoDist:'',
    pago_al_momento:'', // ← nuevo: pago parcial al registrar crédito
  })

  // ─── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data:v },{ data:a },{ data:pt },{ data:c },{ data:ptb },{ data:spt },{ data:dist },{ data:lotes }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre), almacenes(nombre), precio_tipos(nombre)')
        .gte('fecha', filtroFecha+'T00:00:00-05:00').lte('fecha', filtroFecha+'T23:59:59-05:00').order('fecha',{ascending:false}),
      supabase.from('almacenes').select('id,nombre,stock_actual').eq('activo',true).order('nombre'),
      supabase.from('precio_tipos').select('*').eq('activo',true),
      supabase.from('clientes').select('id,nombre,tipo,es_varios,telefono').order('nombre').limit(200),
      supabase.from('precio_tipo_balon').select('*'),
      supabase.from('stock_por_tipo').select('*'),
      supabase.from('distribuidores').select('id,nombre,almacen_id,precio_base').eq('activo',true),
      supabase.from('lotes_distribuidor').select('*').eq('cerrado',false).order('fecha',{ascending:true})
    ])
    setVentas(v||[]); setAlmacenes(a||[]); setPrecioTipos(pt||[])
    setClientes(c||[]); setPreciosPorTipo(ptb||[]); setStockPorTipo(spt||[])
    setDistribuidores(dist||[]); setLotesDistribuidor(lotes||[])
    setLoading(false)
  }, [filtroFecha])

  const cargarCierre = useCallback(async () => {
    if(!filtroCierreAlmacen) return
    setLoadingCierre(true)
    const { data } = await supabase.from('cierres_dia').select('*').eq('almacen_id',filtroCierreAlmacen).eq('fecha',hoyPeru()).maybeSingle()
    setCierreHoy(data||null)
    if(data?.llenos_apertura) {
      setAperturaForm({
        '5kg': data.llenos_apertura['5kg']||'',
        '10kg': data.llenos_apertura['10kg']||'',
        '45kg': data.llenos_apertura['45kg']||'',
        'v_5kg': data.llenos_apertura?.v_5kg||'',
        'v_10kg': data.llenos_apertura?.v_10kg||'',
        'v_45kg': data.llenos_apertura?.v_45kg||''
      })
    }
    setLoadingCierre(false)
  }, [filtroCierreAlmacen])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if(filtroCierreAlmacen) cargarCierre() }, [cargarCierre, filtroCierreAlmacen])

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getPrecio = useCallback((precioTipoId, tipoBalon) => {
    const p = preciosPorTipo.find(p => p.precio_tipo_id===precioTipoId && p.tipo_balon===tipoBalon)
    return p?.precio || ''
  }, [preciosPorTipo])

  const getDistribuidor = useCallback((almacenId) => {
    return distribuidores.find(d => d.almacen_id===almacenId) || null
  }, [distribuidores])

  const getPrecioFIFO = useCallback((distribuidorId, tipoBalon='10kg') => {
    const lote = lotesDistribuidor.find(l => l.distribuidor_id===distribuidorId && l.tipo_balon===tipoBalon && !l.cerrado && l.cantidad_restante>0)
    return lote ? { precio:lote.precio_unitario, lote } : null
  }, [lotesDistribuidor])

  const getStock = useCallback((almacenId, tipoBalon) => {
    const dist = getDistribuidor(almacenId)
    if(dist) {
      return lotesDistribuidor.filter(l => l.distribuidor_id===dist.id && l.tipo_balon===tipoBalon && !l.cerrado && l.cantidad_restante>0).reduce((s,l) => s+l.cantidad_restante, 0)
    }
    // Primero intenta stock_por_tipo
    const spt = stockPorTipo.find(s => s.almacen_id===almacenId && s.tipo_balon===tipoBalon)
    if(spt?.stock_actual > 0) return spt.stock_actual
    // Si no encuentra o es 0, usa almacenes.stock_actual como respaldo
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
    })
    setDeudaExistente(null); setError(''); setModal(true); setBusquedaCliente(''); setSubModal(null)
  }, [clientes, almacenes, precioTipos, perfil, getPrecio])

  const seleccionarTipoPrecio = useCallback((tipoId) => {
    const precio = getPrecio(tipoId, form.tipo_balon)
    setForm(f => ({...f, precio_tipo_id:tipoId, precio_unitario:precio}))
  }, [getPrecio, form.tipo_balon])

  const seleccionarTipoBalon = useCallback((tipoBalon) => {
    const precio = getPrecio(form.precio_tipo_id, tipoBalon)
    setForm(f => ({...f, tipo_balon:tipoBalon, precio_unitario:precio}))
  }, [getPrecio, form.precio_tipo_id])

  const seleccionarCliente = useCallback((clienteId) => {
    const c = clientes.find(c => c.id===clienteId)
    if(!c) return
    const tipoPrecio = precioTipos.find(t => t.nombre.toLowerCase().includes(c.tipo)) || precioTipos[0]
    const precio = getPrecio(tipoPrecio?.id, form.tipo_balon)
    setForm(f => ({...f, cliente_id:c.id, cliente_nombre:c.nombre, es_varios:c.es_varios, precio_tipo_id:tipoPrecio?.id||'', precio_unitario:precio||tipoPrecio?.precio||''}))
    buscarDeudaCliente(c.id, c.nombre)
  }, [clientes, precioTipos, getPrecio, form.tipo_balon, buscarDeudaCliente])

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
    if(!confirm(`¿Eliminar venta de ${venta.clientes?.nombre||'Cliente Varios'} — S/${(venta.cantidad*venta.precio_unitario).toFixed(2)}?`)) return
    const stockActual = getStock(venta.almacen_id, venta.tipo_balon||'10kg')
    const tipo = venta.tipo_balon||'10kg'
    const campoVacios = tipo==='5kg'?'vacios_5kg':tipo==='10kg'?'vacios_10kg':'vacios_45kg'
    const almacen = almacenes.find(a => a.id===venta.almacen_id)
    await Promise.all([
      supabase.from('stock_por_tipo').update({ stock_actual:stockActual+venta.cantidad, updated_at:new Date().toISOString() }).eq('almacen_id',venta.almacen_id).eq('tipo_balon',tipo),
      almacen ? supabase.from('almacenes').update({ stock_actual:(almacen.stock_actual||0)+venta.cantidad, balones_vacios:Math.max(0,(almacen.balones_vacios||0)-venta.cantidad), [campoVacios]:Math.max(0,(almacen[campoVacios]||0)-venta.cantidad) }).eq('id',venta.almacen_id) : Promise.resolve(),
      supabase.from('ventas').delete().eq('id',venta.id)
    ])
    toast('Venta eliminada'); cargar()
  }, [getStock, almacenes, cargar, toast])

  // ─── Guardar apertura ──────────────────────────────────────────────────────
  const guardarApertura = useCallback(async () => {
    if(!filtroCierreAlmacen) { setErrorCierre('Selecciona un almacén'); return }
    setSavingCierre(true); setErrorCierre('')
    const llenos = { '5kg':parseInt(aperturaForm['5kg'])||0, '10kg':parseInt(aperturaForm['10kg'])||0, '45kg':parseInt(aperturaForm['45kg'])||0 }
    const vacios5=parseInt(aperturaForm['v_5kg'])||0, vacios10=parseInt(aperturaForm['v_10kg'])||0, vacios45=parseInt(aperturaForm['v_45kg'])||0
    const vacios = vacios5+vacios10+vacios45
    const totalLlenos = llenos['5kg']+llenos['10kg']+llenos['45kg']
    // Actualizar almacén y stock_por_tipo en paralelo
    await Promise.all([
      supabase.from('almacenes').update({ stock_actual:totalLlenos, balones_vacios:vacios, vacios_5kg:vacios5, vacios_10kg:vacios10, vacios_45kg:vacios45, updated_at:new Date().toISOString() }).eq('id',filtroCierreAlmacen),
      ...TIPOS_BALON.map(tipo =>
        supabase.from('stock_por_tipo').update({ stock_actual:llenos[tipo] }).eq('almacen_id',filtroCierreAlmacen).eq('tipo_balon',tipo)
      )
    ])
    const { error:e } = await supabase.from('cierres_dia').upsert({
      almacen_id:filtroCierreAlmacen, fecha:hoyPeru(),
      llenos_apertura:llenos, vacios_apertura:vacios,
      apertura_registrada:true, usuario_id:perfil?.id||null,
      updated_at:new Date().toISOString()
    }, { onConflict:'almacen_id,fecha' })
    setSavingCierre(false)
    if(e) { setErrorCierre(e.message); return }
    toast('Apertura registrada'); await cargarCierre(); cargar()
  }, [filtroCierreAlmacen, aperturaForm, perfil, cargarCierre, cargar, toast])

  // ─── Guardar cierre ────────────────────────────────────────────────────────
  const guardarCierre = useCallback(async () => {
    if(!filtroCierreAlmacen) { setErrorCierre('Selecciona un almacén'); return }
    if(!cierreHoy?.apertura_registrada) { setErrorCierre('Primero registra la apertura del día'); return }
    setSavingCierre(true); setErrorCierre('')
    const llenos_cierre = { '5kg':parseInt(cierreForm['5kg'])||0, '10kg':parseInt(cierreForm['10kg'])||0, '45kg':parseInt(cierreForm['45kg'])||0 }
    const llenos_apertura = cierreHoy.llenos_apertura||{}
    const hoyInicio = hoyPeru()+'T00:00:00-05:00', hoyFin = hoyPeru()+'T23:59:59-05:00'
    // Cargar créditos y precios en paralelo
    const creditosDinero = { '5kg':0,'10kg':0,'45kg':0 }
    const { data:ventasHoy } = await supabase.from('ventas').select('cantidad,tipo_balon,metodo_pago,precio_unitario').eq('almacen_id',filtroCierreAlmacen).gte('fecha',hoyInicio).lte('fecha',hoyFin)
    ;(ventasHoy||[]).filter(v=>v.metodo_pago==='credito').forEach(v => { creditosDinero[v.tipo_balon||'10kg']=(creditosDinero[v.tipo_balon||'10kg']||0)+v.cantidad })
    // Calcular ventas efectivo
    const ventas_efectivo = {}, preciosPorTipoHoy = {}
    ;(ventasHoy||[]).filter(v=>v.metodo_pago==='efectivo').forEach(v => { preciosPorTipoHoy[v.tipo_balon||'10kg']=v.precio_unitario })
    let monto_efectivo = 0
    for(const tipo of TIPOS_BALON) {
      const vendido = Math.max(0,(llenos_apertura[tipo]||0)-(llenos_cierre[tipo]||0)-(creditosDinero[tipo]||0))
      ventas_efectivo[tipo] = vendido
      monto_efectivo += vendido*(preciosPorTipoHoy[tipo]||0)
    }
    // Registrar ventas efectivo y actualizar stock en paralelo
    const inserts = TIPOS_BALON.filter(tipo => ventas_efectivo[tipo]>0 && preciosPorTipoHoy[tipo]).map(tipo =>
      supabase.from('ventas').insert({ almacen_id:filtroCierreAlmacen, tipo_balon:tipo, fecha:hoyPeru()+'T20:00:00-05:00', cantidad:ventas_efectivo[tipo], precio_unitario:preciosPorTipoHoy[tipo], metodo_pago:'efectivo', notas:`Cierre del día — ${ventas_efectivo[tipo]} bal. ${tipo}`, usuario_id:perfil?.id||null })
    )
    const totalCierre = llenos_cierre['5kg']+llenos_cierre['10kg']+llenos_cierre['45kg']
    await Promise.all([
      ...inserts,
      supabase.from('almacenes').update({ stock_actual:totalCierre, updated_at:new Date().toISOString() }).eq('id',filtroCierreAlmacen),
      ...TIPOS_BALON.map(tipo => supabase.from('stock_por_tipo').update({ stock_actual:llenos_cierre[tipo] }).eq('almacen_id',filtroCierreAlmacen).eq('tipo_balon',tipo))
    ])
    const { error:e } = await supabase.from('cierres_dia').upsert({
      almacen_id:filtroCierreAlmacen, fecha:hoyPeru(),
      llenos_cierre, ventas_efectivo, ventas_credito_dinero:creditosDinero,
      monto_efectivo, cierre_registrado:true, updated_at:new Date().toISOString()
    }, { onConflict:'almacen_id,fecha' })
    setSavingCierre(false)
    if(e) { setErrorCierre(e.message); return }
    toast('Cierre del día registrado'); await cargarCierre(); cargar()
  }, [filtroCierreAlmacen, cierreHoy, cierreForm, perfil, cargarCierre, cargar, toast])

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
      const { error:e } = await supabase.from('ventas').insert({
        cliente_id:form.cliente_id||null, almacen_id:form.almacen_id,
        precio_tipo_id:form.precio_tipo_id||null, tipo_balon:form.tipo_balon,
        fecha:(form.fecha||hoyPeru())+'T12:00:00-05:00',
        cantidad:cant, precio_unitario:precioGas,
        metodo_pago:debeDinero?'credito':form.metodo_pago,
        notas:form.notas, usuario_id:perfil?.id||null,
        vales_20:form.es_distribuidor?(parseInt(form.vales20)||0):null,
        vales_30:form.es_distribuidor?(parseInt(form.vales30)||0):null,
        vales_43:form.es_distribuidor?(parseInt(form.vales43)||0):null,
        efectivo_dist:form.es_distribuidor?(parseFloat(form.efectivoDist)||0):null
      })
      if(e) { setError(e.message); setSaving(false); return }
      if(!form.es_distribuidor) {
        await supabase.from('stock_por_tipo').update({ stock_actual:Math.max(0,stockDisp-cant) }).eq('almacen_id',form.almacen_id).eq('tipo_balon',form.tipo_balon)
      }
      if(form.es_distribuidor&&form.distribuidor_id) {
        await aplicarFIFO(form.distribuidor_id, form.tipo_balon, cant)
        const { data:lotesActivos } = await supabase.from('lotes_distribuidor').select('cantidad_restante').eq('distribuidor_id',form.distribuidor_id).eq('cerrado',false)
        const totalRestante = (lotesActivos||[]).reduce((s,l) => s+(l.cantidad_restante||0),0)
        const { data:almDist } = await supabase.from('almacenes').select('balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',form.almacen_id).single()
        await supabase.from('almacenes').update({ stock_actual:totalRestante, balones_vacios:(almDist?.balones_vacios||0)+cant, [campoVacios]:(almDist?.[campoVacios]||0)+cant }).eq('id',form.almacen_id)
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
        fecha:(form.fecha||hoyPeru())+'T12:00:00-05:00',
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
        tipo_balon:form.tipo_balon, fecha:(form.fecha||hoyPeru())+'T12:00:00-05:00',
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
  }, [form, getStock, aplicarFIFO, perfil, cargar, toast])

  // ─── Cálculos del día ──────────────────────────────────────────────────────
  const ventasFiltradas = ventas.filter(v =>
    !busqueda || v.clientes?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || v.clientes?.telefono?.includes(busqueda)
  )
  const totalDia = ventas.reduce((s,v) => s+(v.cantidad*v.precio_unitario),0)
  const totalBalones = ventas.reduce((s,v) => s+v.cantidad,0)
  const totalEfectivo = ventas.filter(v=>v.metodo_pago==='efectivo').reduce((s,v) => s+(v.cantidad*v.precio_unitario),0)
  const totalCredito = ventas.filter(v=>v.metodo_pago==='credito').reduce((s,v) => s+(v.cantidad*v.precio_unitario),0)
  const totalCreditos = ventas.filter(v=>v.metodo_pago==='credito').length

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

  const csTab = (id) => ({
    padding:'8px 14px', fontSize:13, fontWeight:500,
    borderBottom:tabActivo===id?'2px solid var(--app-accent)':'2px solid transparent',
    color:tabActivo===id?'var(--app-accent)':'var(--app-text-secondary)',
    background:'none', border:'none',
    borderBottom:tabActivo===id?`2px solid var(--app-accent)`:'2px solid transparent',
    cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s'
  })

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

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto" style={{borderBottom:'1px solid var(--app-card-border)'}}>
        {[['ventas','📋 Ventas'],['cierre','🌙 Apertura / Cierre']].map(([id,label]) => (
          <button key={id} onClick={()=>setTabActivo(id)} style={csTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── TAB APERTURA/CIERRE ── */}
      {tabActivo==='cierre' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div>
              <label className="label">Almacén</label>
              <select className="input" value={filtroCierreAlmacen} onChange={e=>setFiltroCierreAlmacen(e.target.value)}>
                <option value="">— Selecciona almacén —</option>
                {almacenes.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            {filtroCierreAlmacen&&<button onClick={cargarCierre} className="btn-secondary mt-5 text-xs">🔄</button>}
          </div>
          {filtroCierreAlmacen&&(
            loadingCierre?<div style={{color:'var(--app-text-secondary)',fontSize:13}}>Cargando...</div>:(
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* APERTURA */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌅</span>
                  <h3 style={{color:'var(--app-text)',fontWeight:600,margin:0}}>Apertura del día</h3>
                  {cierreHoy?.apertura_registrada&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(34,197,94,0.12)',color:'#22c55e',border:'1px solid rgba(34,197,94,0.3)'}}>✅ Registrada</span>}
                </div>
                <p style={{fontSize:12,color:'var(--app-text-secondary)'}}>Cuenta físicamente los balones al inicio del día.</p>
                {errorCierre&&<div style={{color:'#f87171',fontSize:12,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'8px 12px'}}>{errorCierre}</div>}
                <div className="space-y-3">
                  {TIPOS_BALON.map(tipo=>(
                    <div key={tipo} className="flex items-center gap-3">
                      <span style={{fontSize:13,color:'var(--app-text-secondary)',width:36}}>{tipo}</span>
                      <input type="number" min="0" className="input flex-1" placeholder="0 llenos" value={aperturaForm[tipo]} onChange={e=>setAperturaForm(f=>({...f,[tipo]:e.target.value}))}/>
                      <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>llenos</span>
                    </div>
                  ))}
                  {[['v_5kg','5kg'],['v_10kg','10kg'],['v_45kg','45kg']].map(([key,tipo])=>(
                    <div key={key} className="flex items-center gap-3">
                      <span style={{fontSize:13,color:'var(--app-text-secondary)',width:36}}>{tipo}</span>
                      <input type="number" min="0" className="input flex-1" placeholder="0 vacíos" value={aperturaForm[key]} onChange={e=>setAperturaForm(f=>({...f,[key]:e.target.value}))}/>
                      <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>vacíos</span>
                    </div>
                  ))}
                </div>
                <button onClick={guardarApertura} disabled={savingCierre} className="btn-primary w-full justify-center">
                  {savingCierre?'Guardando...':'✓ Registrar apertura y ajustar stock'}
                </button>
              </div>
              {/* CIERRE */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌙</span>
                  <h3 style={{color:'var(--app-text)',fontWeight:600,margin:0}}>Cierre del día</h3>
                  {cierreHoy?.cierre_registrado&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(59,130,246,0.12)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.3)'}}>✅ Cerrado</span>}
                </div>
                <p style={{fontSize:12,color:'var(--app-text-secondary)'}}>Cuenta los llenos al final. Se calcularán las ventas en efectivo.</p>
                {cierreHoy?.apertura_registrada&&(
                  <div style={{background:'var(--app-card-bg-alt)',borderRadius:8,padding:'10px 12px',fontSize:12}}>
                    <p style={{color:'var(--app-text-secondary)',fontWeight:600,margin:'0 0 6px'}}>Apertura registrada:</p>
                    {TIPOS_BALON.map(t=>(cierreHoy.llenos_apertura?.[t]||0)>0&&<p key={t} style={{color:'var(--app-text-secondary)',margin:'2px 0'}}>{t}: <span style={{color:'var(--app-text)',fontWeight:700}}>{cierreHoy.llenos_apertura[t]}</span> llenos</p>)}
                  </div>
                )}
                {!cierreHoy?.apertura_registrada&&<div style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#eab308'}}>⚠️ Primero registra la apertura del día</div>}
                <div className="space-y-3">
                  {TIPOS_BALON.map(tipo=>(
                    <div key={tipo} className="flex items-center gap-3">
                      <span style={{fontSize:13,color:'var(--app-text-secondary)',width:36}}>{tipo}</span>
                      <input type="number" min="0" className="input flex-1" placeholder="0 llenos" value={cierreForm[tipo]} onChange={e=>setCierreForm(f=>({...f,[tipo]:e.target.value}))} disabled={!cierreHoy?.apertura_registrada}/>
                      <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>llenos</span>
                    </div>
                  ))}
                </div>
                {cierreHoy?.apertura_registrada&&(cierreForm['5kg']||cierreForm['10kg']||cierreForm['45kg'])&&(()=>{
                  const apertura=cierreHoy.llenos_apertura||{}
                  const credPorTipo={'5kg':0,'10kg':0,'45kg':0}
                  ventas.filter(v=>v.metodo_pago==='credito').forEach(v=>{credPorTipo[v.tipo_balon||'10kg']+=v.cantidad})
                  return(
                    <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:8,padding:'10px 12px',fontSize:12}}>
                      <p style={{color:'#22c55e',fontWeight:600,margin:'0 0 6px'}}>📊 Ventas efectivo estimadas:</p>
                      {TIPOS_BALON.map(tipo=>{const v=Math.max(0,(apertura[tipo]||0)-(parseInt(cierreForm[tipo])||0)-(credPorTipo[tipo]||0));return v>0?<p key={tipo} style={{color:'var(--app-text-secondary)',margin:'2px 0'}}>{tipo}: <span style={{color:'#22c55e',fontWeight:700}}>{v} bal.</span></p>:null})}
                    </div>
                  )
                })()}
                <button onClick={guardarCierre} disabled={savingCierre||!cierreHoy?.apertura_registrada} className="btn-primary w-full justify-center disabled:opacity-40">
                  {savingCierre?'Guardando...':'🌙 Registrar cierre del día'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB VENTAS ── */}
      {tabActivo==='ventas'&&(<>

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
      </div>

      {/* Filtros y acciones */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div className="relative flex-1" style={{minWidth:200}}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--app-text-secondary)'}}/>
          <input className="input pl-9" placeholder="Buscar por cliente o teléfono..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
        </div>
        <button onClick={imprimirReporte} className="btn-secondary" title="Imprimir reporte del día">
          <Printer className="w-4 h-4"/>Reporte
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
                    <button onClick={()=>eliminarVenta(v)} style={{marginLeft:'auto',color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4}}>
                      <Trash2 style={{width:14,height:14}}/>
                    </button>
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
                      <td className="px-4 py-3 text-xs max-w-32 truncate" style={{color:'var(--app-text-secondary)'}} title={v.notas||''}>{v.notas||<span style={{color:'var(--app-card-border)'}}>—</span>}</td>
                      <td className="px-4 py-3">
                        <button onClick={()=>eliminarVenta(v)} style={{color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:4}} title="Eliminar">
                          <Trash2 style={{width:14,height:14}}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>
      </>)}

      {/* ── MODAL VENTA ── */}
      {modal&&(
        <Modal title="Registrar venta" onClose={()=>setModal(false)} wide>
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
            <div className="space-y-4">
              {/* Cliente */}
              <div className="relative">
                <label className="label">Cliente</label>
                <input className="input" placeholder="Buscar por nombre o teléfono..."
                  value={busquedaCliente}
                  onChange={e=>{setBusquedaCliente(e.target.value);if(!e.target.value){const v=clientes.find(c=>c.es_varios);if(v)seleccionarCliente(v.id)}}}
                  autoFocus/>
                {busquedaCliente.length>=1&&(()=>{
                  const coincidencias = clientes.filter(c => !c.es_varios && (c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())||(c.telefono&&c.telefono.includes(busquedaCliente))))
                  const exacto = clientes.find(c => c.nombre.toLowerCase()===busquedaCliente.toLowerCase())
                  if(exacto&&!exacto.es_varios) return <div style={{marginTop:4,fontSize:12,color:'#22c55e',paddingLeft:4}}>✅ {exacto.nombre}</div>
                  return(
                    <div style={{position:'absolute',zIndex:9999,background:'var(--app-modal-bg)',border:'1px solid var(--app-card-border)',borderRadius:8,width:'100%',marginTop:2,overflow:'hidden'}}>
                      {coincidencias.slice(0,6).map(c=>(
                        <button key={c.id} type="button" onClick={()=>{seleccionarCliente(c.id);setBusquedaCliente(c.nombre)}}
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
                      {fifo?<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Lote {fifo.lote.fecha} · S/{fifo.lote.precio_unitario}/bal. · {fifo.lote.cantidad_restante} restantes</p>:<p style={{fontSize:11,color:'#f87171',margin:'2px 0 0'}}>⚠️ Sin lotes activos</p>}
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
                        padding:'10px 8px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', textAlign:'center', transition:'all 0.15s',
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
                          padding:'8px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
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

              {/* Toggle incluye balón */}
              <div style={{borderRadius:12,border:'1px solid var(--app-card-border)',padding:'12px',cursor:'pointer',background:form.tipo_venta!=='gas'?'color-mix(in srgb, var(--app-accent) 8%, transparent)':'var(--app-card-bg-alt)',transition:'all 0.15s'}}
                onClick={()=>setForm(f=>({...f,tipo_venta:f.tipo_venta==='gas'?'gas_balon':'gas',precio_balon:'100'}))}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:500,color:form.tipo_venta!=='gas'?'var(--app-accent)':'var(--app-text-secondary)',margin:0}}>🔵 ¿Incluye balón vacío?</p>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Activa si el cliente se lleva el envase</p>
                  </div>
                  <div style={{width:40,height:20,borderRadius:10,background:form.tipo_venta!=='gas'?'var(--app-accent)':'var(--app-card-border)',position:'relative',transition:'background 0.15s'}}>
                    <div style={{width:16,height:16,background:'white',borderRadius:'50%',position:'absolute',top:2,left:form.tipo_venta!=='gas'?22:2,transition:'left 0.15s'}}/>
                  </div>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
              </div>
            </div>

            {/* ── Columna derecha ── */}
            <div className="space-y-4">
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                  <input type="number" min="0" step="0.50" className="input" style={{paddingLeft:'2rem',fontWeight:700,fontSize:18}} value={form.precio_unitario} onChange={e=>setForm(f=>({...f,precio_unitario:e.target.value}))} placeholder="0"/>
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
                  {[['efectivo','💵 Efectivo'],['yape','📱 Yape'],['vale','🎫 Vale'],['transferencia','🏦 Transfer.'],['cobro_credito','✅ Cobro deuda'],].map(([val,label])=>(
                    <button key={val} onClick={()=>setForm(f=>({...f,metodo_pago:val,es_credito:false}))} style={{
                      padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:500, cursor:'pointer', textAlign:'center', transition:'all 0.15s',
                      background:form.metodo_pago===val?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                      border:form.metodo_pago===val?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                      color:form.metodo_pago===val?'var(--app-accent)':'var(--app-text-secondary)'
                    }}>{label}</button>
                  ))}
                </div>
              </div>

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
                <div style={{background:'rgba(251,146,60,0.06)',border:'1px solid rgba(251,146,60,0.25)',borderRadius:10,padding:'12px 14px'}} className="space-y-3">
                  <p style={{fontSize:12,fontWeight:600,color:'#fb923c',margin:0}}>⚠️ Tipo de deuda</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['dinero','💵 Dinero','Debe el monto'],['balon','🔵 Balón','Debe devolver bal.'],['ambos','💵+🔵 Ambos','Dinero + balón']].map(([val,label,desc])=>(
                      <button key={val} onClick={()=>setForm(f=>({...f,credito_tipo:val}))} style={{
                        padding:'8px',borderRadius:8,border:form.credito_tipo===val?'1px solid rgba(251,146,60,0.6)':'1px solid var(--app-card-border)',
                        background:form.credito_tipo===val?'rgba(251,146,60,0.15)':'var(--app-card-bg-alt)',
                        color:form.credito_tipo===val?'#fb923c':'var(--app-text-secondary)',
                        fontSize:11,fontWeight:500,cursor:'pointer',textAlign:'center'
                      }}>
                        <p style={{margin:0}}>{label}</p>
                        <p style={{margin:'2px 0 0',opacity:0.7,fontWeight:400}}>{desc}</p>
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
                      <div style={{background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:8,padding:'10px 12px',fontSize:12}}>
                        {total>0&&<p style={{color:'var(--app-text-secondary)',margin:'0 0 4px'}}>Total venta: <span style={{color:'var(--app-text)',fontWeight:600}}>S/{total.toLocaleString()}</span></p>}
                        {pago>0&&<p style={{color:'#22c55e',margin:'0 0 4px'}}>Paga ahora: <span style={{fontWeight:600}}>S/{pago.toLocaleString()}</span></p>}
                        {(form.credito_tipo==='dinero'||form.credito_tipo==='ambos')&&<p style={{color:'#fb923c',margin:'0 0 4px',fontWeight:600}}>Queda debiendo: S/{saldo.toLocaleString()}</p>}
                        {(form.credito_tipo==='balon'||form.credito_tipo==='ambos')&&<p style={{color:'#fb923c',margin:0,fontWeight:600}}>Debe devolver: {balones} balón(es)</p>}
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
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Observaciones..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/>
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
      <Toast toasts={toasts}/>
    </div>
  )
}
