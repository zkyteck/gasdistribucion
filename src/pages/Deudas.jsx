import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { Users, X, AlertCircle, Search, Clock, CheckCircle, AlertTriangle, TrendingDown } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'

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
    timerRef.current[id] = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  useEffect(() => () => Object.values(timerRef.current).forEach(clearTimeout), [])
  return { toasts, toast }
}

// ─── Modal con tema ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
      <div style={{ background:'var(--app-card-bg)', border:'1px solid var(--app-card-border)', borderRadius:16, width:'100%', maxWidth:wide?680:480, boxShadow:'0 25px 50px rgba(0,0,0,0.4)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid var(--app-card-border)', flexShrink:0 }}>
          <h3 style={{color:'var(--app-text)', fontWeight:600, margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', color:'var(--app-text-secondary)'}}><X className="w-5 h-5"/></button>
        </div>
        <div style={{padding:'20px 24px', overflowY:'auto', flex:1}}>{children}</div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resumenDeuda(d) {
  const items = []
  if(parseFloat(d.monto_pendiente)>0) items.push(`S/${Number(d.monto_pendiente).toLocaleString('es-PE')}`)
  if(parseInt(d.balones_pendiente)>0) items.push(`${d.balones_pendiente} balón(es)`)
  if(parseInt(d.vales_20_pendiente)>0) items.push(`${d.vales_20_pendiente}×S/20`)
  if(parseInt(d.vales_43_pendiente)>0) items.push(`${d.vales_43_pendiente}×S/43`)
  return items.join(' + ') || 'Sin deuda'
}

function urgenciaStyle(dias, estado) {
  if(estado === 'liquidada') return { bg:'rgba(34,197,94,0.04)', border:'rgba(34,197,94,0.2)', color:'#22c55e', label:'' }
  if(dias >= 60) return { bg:'rgba(239,68,68,0.06)', border:'rgba(239,68,68,0.25)', color:'#f87171', label:`⚠️ ${dias}d — Urgente` }
  if(dias >= 30) return { bg:'rgba(251,146,60,0.06)', border:'rgba(251,146,60,0.25)', color:'#fb923c', label:`${dias}d — Atrasado` }
  if(dias >= 7)  return { bg:'rgba(234,179,8,0.04)',  border:'rgba(234,179,8,0.2)',   color:'#eab308', label:`${dias}d` }
  return { bg:'transparent', border:'var(--app-card-border)', color:'var(--app-text-secondary)', label:`${dias}d` }
}

const emptyDeudaForm = { nombre_deudor:'', cliente_id:'', monto:'', balones:'', tipo_balon:'10kg', vales_20:'', vales_43:'', fecha:hoyPeru(), notas:'' }
const emptyPagoForm  = { monto:'', balones:'', vales_20:'', vales_43:'', metodo_pago:'efectivo', fecha:hoyPeru(), notas:'' }

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Deudas() {
  const { perfil } = useAuth()
  const { toasts, toast } = useToast()
  const isAdmin = perfil?.rol === 'admin'

  const [deudas, setDeudas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activas')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [ordenar, setOrdenar] = useState('dias_desc')
  const [deudaForm, setDeudaForm] = useState(emptyDeudaForm)
  const [pagoForm, setPagoForm] = useState(emptyPagoForm)
  const [deudaPendiente, setDeudaPendiente] = useState(null)
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [editForm, setEditForm] = useState({ monto_pendiente:'', balones_pendiente:'', vales_20_pendiente:'', vales_43_pendiente:'', fecha_deuda:'', notas:'' })
  const [historialCompleto, setHistorialCompleto] = useState(null)
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // ─── Carga ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('deudas').select('*').order('fecha_deuda', {ascending:false})
    if(filtroEstado==='activas') query = query.in('estado',['activa','pagada_parcial'])
    else if(filtroEstado==='liquidadas') query = query.eq('estado','liquidada')
    const { data } = await query
    setDeudas(data||[])
    setLoading(false)
  }, [filtroEstado])

  const cargarClientes = useCallback(async () => {
    const [{ data:cData },{ data:dData }] = await Promise.all([
      supabase.from('clientes').select('id,nombre').eq('es_varios',false).order('nombre'),
      supabase.from('deudas').select('nombre_deudor').in('estado',['activa','pagada_parcial'])
    ])
    const deudorNames = (dData||[]).map(d => ({ id:'deudor_'+d.nombre_deudor, nombre:d.nombre_deudor }))
    const allNames = [...(cData||[])]
    deudorNames.forEach(d => { if(!allNames.find(c => c.nombre.toLowerCase()===d.nombre.toLowerCase())) allNames.push(d) })
    setClientes(allNames)
  }, [])

  const cargarHistorialCompleto = useCallback(async (nombreDeudor) => {
    setLoadingHistorial(true)
    const { data } = await supabase.from('deudas').select('*').ilike('nombre_deudor', nombreDeudor).order('fecha_deuda',{ascending:false})
    const todosMovimientos = []
    ;(data||[]).forEach(deuda => {
      ;(deuda.historial||[]).forEach(m => todosMovimientos.push({ ...m, deuda_id:deuda.id, deuda_estado:deuda.estado, deuda_fecha:deuda.fecha_deuda }))
    })
    todosMovimientos.sort((a,b) => new Date(b.fecha||b.deuda_fecha||'2000-01-01') - new Date(a.fecha||a.deuda_fecha||'2000-01-01'))
    setHistorialCompleto({ deudas:data||[], movimientos:todosMovimientos })
    setLoadingHistorial(false)
  }, [])

  useEffect(() => {
    cargar(); cargarClientes()
    const canal = supabase.channel('deudas-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'deudas' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [cargar, cargarClientes])

  // ─── Buscar sugerencias ──────────────────────────────────────────────────────
  const buscarSugerencias = useCallback((val) => {
    if(!val.trim()) { setSugerencias([]); setMostrarSugerencias(false); return }
    const found = clientes.filter(c => c.nombre.toLowerCase().includes(val.toLowerCase())).slice(0,5)
    setSugerencias(found)
    setMostrarSugerencias(found.length > 0)
  }, [clientes])

  // ─── Guardar deuda manual (solo admin, sin venta ficticia) ───────────────────
  const guardarDeuda = useCallback(async (forzarNuevo=false) => {
    if(!deudaForm.nombre_deudor.trim()) { setError('Ingresa el nombre del deudor'); return }
    const monto = parseFloat(deudaForm.monto)||0
    const balones = parseInt(deudaForm.balones)||0
    const vales20 = parseInt(deudaForm.vales_20)||0
    const vales43 = parseInt(deudaForm.vales_43)||0
    if(monto===0&&balones===0&&vales20===0&&vales43===0) { setError('Ingresa al menos un tipo de deuda'); return }

    if(!forzarNuevo) {
      const { data:activas } = await supabase.from('deudas').select('*').in('estado',['activa','pagada_parcial'])
      const encontrada = (activas||[]).find(d => d.nombre_deudor.trim().toLowerCase()===deudaForm.nombre_deudor.trim().toLowerCase())
      if(encontrada) { setDeudaPendiente(encontrada); return }
    }

    setSaving(true); setError('')
    const tipoBalonDeuda = deudaForm.tipo_balon||'10kg'
    const entradaHistorial = { tipo:'deuda', fecha:deudaForm.fecha, monto, balones, tipo_balon:balones>0?tipoBalonDeuda:null, vales_20:vales20, vales_43:vales43, notas:deudaForm.notas||null }

    // Solo descontar stock si hay balones — sin crear venta ficticia
    if(balones > 0) {
      const { data:alms } = await supabase.from('almacenes').select('id,nombre,stock_actual').eq('activo',true)
      const almId = perfil?.almacen_id
      const tienda = almId ? alms?.find(a=>a.id===almId) : alms?.find(a=>a.nombre?.toLowerCase().includes('tienda'))||alms?.[0]
      if(tienda) {
        const { data:almFresco } = await supabase.from('almacenes').select('stock_actual').eq('id',tienda.id).single()
        await Promise.all([
          supabase.from('almacenes').update({ stock_actual:Math.max(0,(almFresco?.stock_actual||0)-balones), updated_at:new Date().toISOString() }).eq('id',tienda.id),
          supabase.from('stock_por_tipo').update({ stock_actual:0 }).eq('almacen_id',tienda.id).eq('tipo_balon',tipoBalonDeuda)
        ])
      }
    }

    const { error:e } = await supabase.from('deudas').insert({
      cliente_id: deudaForm.cliente_id||null,
      nombre_deudor: deudaForm.nombre_deudor.trim(),
      tipo_deuda: 'mixto',
      monto_original:monto, monto_pendiente:monto,
      cantidad_original:balones, cantidad_pendiente:balones,
      balones_pendiente:balones, vales_20_pendiente:vales20, vales_43_pendiente:vales43,
      fecha_deuda:deudaForm.fecha, estado:'activa', notas:deudaForm.notas,
      historial:[entradaHistorial], usuario_id:perfil?.id||null,
      almacen_id: perfil?.almacen_id||null
    })
    setSaving(false)
    if(e) { setError(e.message); return }
    setDeudaPendiente(null); setModal(null); setDeudaForm(emptyDeudaForm)
    toast('Deuda registrada'); cargar()
  }, [deudaForm, perfil, cargar, toast])

  // ─── Agregar a deuda pendiente ───────────────────────────────────────────────
  const agregarAlaPendiente = useCallback(async () => {
    if(!deudaPendiente) return
    const monto = parseFloat(deudaForm.monto)||0
    const balones = parseInt(deudaForm.balones)||0
    const vales20 = parseInt(deudaForm.vales_20)||0
    const vales43 = parseInt(deudaForm.vales_43)||0
    setSaving(true); setError('')
    const tipoBalonAdd = deudaForm.tipo_balon||'10kg'
    const entradaHistorial = { tipo:'deuda', fecha:deudaForm.fecha, monto, balones, tipo_balon:balones>0?tipoBalonAdd:null, vales_20:vales20, vales_43:vales43, notas:deudaForm.notas||null }

    if(balones > 0) {
      const { data:alms } = await supabase.from('almacenes').select('id,nombre,stock_actual').eq('activo',true)
      const almAdd = perfil?.almacen_id ? alms?.find(a=>a.id===perfil.almacen_id) : alms?.find(a=>a.nombre?.toLowerCase().includes('tienda'))||alms?.[0]
      if(almAdd) {
        await supabase.from('almacenes').update({ stock_actual:Math.max(0,(almAdd.stock_actual||0)-balones), updated_at:new Date().toISOString() }).eq('id',almAdd.id)
        await supabase.from('stock_por_tipo').update({ stock_actual:0 }).eq('almacen_id',almAdd.id).eq('tipo_balon',tipoBalonAdd)
      }
    }

    const { error:e } = await supabase.from('deudas').update({
      monto_pendiente:(parseFloat(deudaPendiente.monto_pendiente)||0)+monto,
      monto_original:(parseFloat(deudaPendiente.monto_original)||0)+monto,
      balones_pendiente:(parseInt(deudaPendiente.balones_pendiente)||0)+balones,
      vales_20_pendiente:(parseInt(deudaPendiente.vales_20_pendiente)||0)+vales20,
      vales_43_pendiente:(parseInt(deudaPendiente.vales_43_pendiente)||0)+vales43,
      estado:'activa',
      historial:[...(deudaPendiente.historial||[]), entradaHistorial],
      fecha_deuda:deudaForm.fecha,
      updated_at:new Date().toISOString()
    }).eq('id',deudaPendiente.id)
    setSaving(false)
    if(e) { setError(e.message); return }
    setDeudaPendiente(null); setModal(null); setDeudaForm(emptyDeudaForm)
    toast('Deuda actualizada'); cargar()
  }, [deudaPendiente, deudaForm, perfil, cargar, toast])

  // ─── Registrar pago ──────────────────────────────────────────────────────────
  const registrarPago = useCallback(async () => {
    if(!selected) return
    const monto = parseFloat(pagoForm.monto)||0
    const balones = parseInt(pagoForm.balones)||0
    const vales20 = parseInt(pagoForm.vales_20)||0
    const vales43 = parseInt(pagoForm.vales_43)||0
    if(monto===0&&balones===0&&vales20===0&&vales43===0) { setError('Ingresa al menos un pago'); return }

    const montoPendiente = parseFloat(selected.monto_pendiente)||0
    const vales20Pend = parseInt(selected.vales_20_pendiente)||0
    const vales43Pend = parseInt(selected.vales_43_pendiente)||0
    const totalValesEnDinero = (vales20*20)+(vales43*43)
    const totalPago = monto+(montoPendiente>0?totalValesEnDinero:0)
    if(montoPendiente>0&&totalPago>montoPendiente) { setError(`El total (S/${totalPago}) supera la deuda (S/${montoPendiente})`); return }
    if(vales20Pend>0&&vales20>vales20Pend) { setError(`Máximo ${vales20Pend} vales S/20`); return }
    if(vales43Pend>0&&vales43>vales43Pend) { setError(`Máximo ${vales43Pend} vales S/43`); return }
    if(balones>(parseInt(selected.balones_pendiente)||0)) { setError(`Máximo ${selected.balones_pendiente} balones`); return }

    setSaving(true); setError('')
    const nuevoMonto = Math.max(0,montoPendiente-totalPago)
    const nuevoBal = Math.max(0,(parseInt(selected.balones_pendiente)||0)-balones)
    const nuevoV20 = Math.max(0,vales20Pend-vales20)
    const nuevoV43 = Math.max(0,vales43Pend-vales43)
    const liquidada = nuevoMonto===0&&nuevoBal===0&&nuevoV20===0&&nuevoV43===0
    const metodo = vales20>0||vales43>0?(monto>0?'mixto':'vale'):pagoForm.metodo_pago
    const entradaHistorial = { tipo:'pago', fecha:pagoForm.fecha, monto:totalPago, balones, vales_20:vales20, vales_43:vales43, metodo_pago:metodo, notas:pagoForm.notas||null }

    // Si pagó con balones → sumarlos al almacén
    const ops = [
      supabase.from('deudas').update({
        monto_pendiente:nuevoMonto, balones_pendiente:nuevoBal,
        vales_20_pendiente:nuevoV20, vales_43_pendiente:nuevoV43,
        cantidad_pendiente:nuevoBal,
        estado:liquidada?'liquidada':'pagada_parcial',
        historial:[...(selected.historial||[]), entradaHistorial],
        updated_at:new Date().toISOString()
      }).eq('id',selected.id)
    ]

    if(balones > 0) {
      const tipoBalonDeuda = selected.historial?.[0]?.tipo_balon||'10kg'
      const campoVacios = tipoBalonDeuda==='5kg'?'vacios_5kg':tipoBalonDeuda==='45kg'?'vacios_45kg':'vacios_10kg'
      const almacenId = selected.almacen_id||perfil?.almacen_id
      if(almacenId) {
        const { data:almFresco } = await supabase.from('almacenes').select('balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',almacenId).single()
        if(almFresco) {
          ops.push(supabase.from('almacenes').update({
            balones_vacios:(almFresco.balones_vacios||0)+balones,
            [campoVacios]:(almFresco[campoVacios]||0)+balones,
            updated_at:new Date().toISOString()
          }).eq('id',almacenId))
        }
      }
    }

    // Registrar cobro en ventas para reportes
    if(totalPago > 0) {
      const almacenIngreso = selected.almacen_id||perfil?.almacen_id
      if(almacenIngreso) {
        ops.push(supabase.from('ventas').insert({
          almacen_id:almacenIngreso,
          tipo_balon:selected.historial?.[0]?.tipo_balon||'10kg',
          fecha:new Date().toISOString(),
          cantidad:1, precio_unitario:totalPago,
          metodo_pago:'cobro_credito',
          notas:`Cobro deuda — ${selected.nombre_deudor}${balones>0?` (${balones} bal. devuelto${balones>1?'s':''})`:''} `,
          usuario_id:perfil?.id||null
        }))
      }
    }

    await Promise.all(ops)
    setSaving(false)
    setModal(null)
    toast(liquidada?`Deuda de ${selected.nombre_deudor} liquidada completamente`:`Pago registrado para ${selected.nombre_deudor}`)
    cargar()
  }, [selected, pagoForm, perfil, cargar, toast])

  // ─── Editar deuda ─────────────────────────────────────────────────────────────
  const editarDeuda = useCallback(async () => {
    if(!selected) return
    setSaving(true); setError('')
    const { error:e } = await supabase.from('deudas').update({
      monto_pendiente:parseFloat(editForm.monto_pendiente)||0,
      monto_original:parseFloat(editForm.monto_pendiente)||0,
      balones_pendiente:parseInt(editForm.balones_pendiente)||0,
      cantidad_pendiente:parseInt(editForm.balones_pendiente)||0,
      vales_20_pendiente:parseInt(editForm.vales_20_pendiente)||0,
      vales_43_pendiente:parseInt(editForm.vales_43_pendiente)||0,
      fecha_deuda:editForm.fecha_deuda,
      notas:editForm.notas,
      updated_at:new Date().toISOString()
    }).eq('id',selected.id)
    setSaving(false)
    if(e) { setError(e.message); return }
    setModal(null); toast('Deuda actualizada'); cargar()
  }, [selected, editForm, cargar, toast])

  // ─── Eliminar deuda ───────────────────────────────────────────────────────────
  const eliminarDeuda = useCallback(async (id) => {
    if(!confirm('¿Eliminar esta deuda? Esta acción no se puede deshacer.')) return
    await Promise.all([
      supabase.from('pagos_deuda').delete().eq('deuda_id',id),
      supabase.from('deudas').delete().eq('id',id)
    ])
    toast('Deuda eliminada'); cargar()
  }, [cargar, toast])

  // ─── Filtros y ordenamiento ───────────────────────────────────────────────────
  const deudasFiltradas = useMemo(() => {
    let result = deudas.filter(d => {
      const matchBusqueda = !busqueda || d.nombre_deudor?.toLowerCase().includes(busqueda.toLowerCase())
      const matchDesde = !filtroFechaDesde || d.fecha_deuda >= filtroFechaDesde
      const matchHasta = !filtroFechaHasta || d.fecha_deuda <= filtroFechaHasta
      return matchBusqueda && matchDesde && matchHasta
    })
    return result.sort((a,b) => {
      if(ordenar==='dias_desc') return differenceInDays(new Date(),new Date(b.fecha_deuda)) - differenceInDays(new Date(),new Date(a.fecha_deuda))
      if(ordenar==='monto_desc') return (parseFloat(b.monto_pendiente)||0) - (parseFloat(a.monto_pendiente)||0)
      if(ordenar==='nombre') return a.nombre_deudor.localeCompare(b.nombre_deudor)
      return new Date(b.fecha_deuda) - new Date(a.fecha_deuda)
    })
  }, [deudas, busqueda, filtroFechaDesde, filtroFechaHasta, ordenar])

  const totalDinero   = useMemo(() => deudas.filter(d=>d.estado!=='liquidada').reduce((a,d)=>a+(parseFloat(d.monto_pendiente)||0),0), [deudas])
  const totalBalones  = useMemo(() => deudas.filter(d=>d.estado!=='liquidada').reduce((a,d)=>a+(parseInt(d.balones_pendiente)||0),0), [deudas])
  const totalVales20  = useMemo(() => deudas.filter(d=>d.estado!=='liquidada').reduce((a,d)=>a+(parseInt(d.vales_20_pendiente)||0),0), [deudas])
  const totalVales43  = useMemo(() => deudas.filter(d=>d.estado!=='liquidada').reduce((a,d)=>a+(parseInt(d.vales_43_pendiente)||0),0), [deudas])
  const totalDeudores = useMemo(() => new Set(deudas.filter(d=>d.estado!=='liquidada').map(d=>d.nombre_deudor)).size, [deudas])
  const urgentes      = useMemo(() => deudas.filter(d=>d.estado!=='liquidada'&&differenceInDays(new Date(),new Date(d.fecha_deuda))>=30).length, [deudas])

  const cardStyle = { background:'var(--app-card-bg)', border:'1px solid var(--app-card-border)', borderRadius:12, padding:'14px 16px' }

  return (
    <div className="space-y-5">
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--app-text)',margin:0}}>Deudas</h2>
          <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Control de deudas en dinero, balones y vales</p>
        </div>
        {isAdmin && (
          <button onClick={()=>{setDeudaForm(emptyDeudaForm);setDeudaPendiente(null);setSelected(null);setError('');cargarClientes();setModal('deuda')}} className="btn-secondary" style={{fontSize:12}}>
            + Registrar deuda manual
          </button>
        )}
      </div>

      {/* Alerta urgentes */}
      {urgentes > 0 && (
        <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'12px 16px'}}>
          <TrendingDown style={{width:18,height:18,color:'#f87171',flexShrink:0}}/>
          <div>
            <p style={{fontSize:13,fontWeight:600,color:'#f87171',margin:0}}>{urgentes} deuda{urgentes>1?'s':''} con más de 30 días sin pagar</p>
            <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Prioriza cobrar estas primero</p>
          </div>
        </div>
      )}

      {/* Totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {totalDinero > 0 && (
          <div style={cardStyle}>
            <p style={{fontSize:22,fontWeight:700,color:'#f87171',margin:0}}>S/{totalDinero.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
            <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Deudas en dinero</p>
          </div>
        )}
        {totalBalones > 0 && (
          <div style={cardStyle}>
            <p style={{fontSize:22,fontWeight:700,color:'#fb923c',margin:0}}>{totalBalones} bal.</p>
            <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Balones prestados</p>
          </div>
        )}
        {(totalVales20 > 0 || totalVales43 > 0) && (
          <div style={cardStyle}>
            <p style={{fontSize:22,fontWeight:700,color:'#eab308',margin:0}}>{totalVales20+totalVales43}</p>
            <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Vales pendientes</p>
          </div>
        )}
        <div style={cardStyle}>
          <p style={{fontSize:22,fontWeight:700,color:'var(--app-text)',margin:0}}>{totalDeudores}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Deudores activos</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--app-text-secondary)'}}/>
        <input className="input pl-9" placeholder="Buscar deudor..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
        {[['activas','🔴 Con deuda'],['liquidadas','✅ Sin deuda'],['todas','Todas']].map(([val,label])=>(
          <button key={val} onClick={()=>setFiltroEstado(val)} style={{
            padding:'6px 14px',borderRadius:20,fontSize:13,fontWeight:500,cursor:'pointer',transition:'all 0.15s',
            background:filtroEstado===val?'color-mix(in srgb, var(--app-accent) 12%, transparent)':'transparent',
            border:filtroEstado===val?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
            color:filtroEstado===val?'var(--app-accent)':'var(--app-text-secondary)'
          }}>{label}</button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select className="input" style={{width:'auto',fontSize:12,padding:'5px 10px'}} value={ordenar} onChange={e=>setOrdenar(e.target.value)}>
            <option value="dias_desc">Más días primero</option>
            <option value="monto_desc">Mayor monto</option>
            <option value="nombre">Por nombre</option>
            <option value="fecha_desc">Más reciente</option>
          </select>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="date" className="input" style={{width:130,fontSize:12,padding:'5px 8px'}} value={filtroFechaDesde} onChange={e=>setFiltroFechaDesde(e.target.value)} placeholder="Desde"/>
            <input type="date" className="input" style={{width:130,fontSize:12,padding:'5px 8px'}} value={filtroFechaHasta} onChange={e=>setFiltroFechaHasta(e.target.value)} placeholder="Hasta"/>
            {(filtroFechaDesde||filtroFechaHasta)&&(
              <button onClick={()=>{setFiltroFechaDesde('');setFiltroFechaHasta('')}} style={{fontSize:11,padding:'5px 8px',borderRadius:6,background:'none',border:'1px solid var(--app-card-border)',color:'var(--app-text-secondary)',cursor:'pointer'}}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--app-card-border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>
            {filtroEstado==='activas'?'Deudas activas':filtroEstado==='liquidadas'?'Liquidadas':'Todas'}
          </h3>
          <span className="badge-blue" style={{fontSize:11}}>{deudasFiltradas.length} registros</span>
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--app-text-secondary)',fontSize:13}}>Cargando...</div>
        ):deudasFiltradas.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 0',gap:8,color:'var(--app-text-secondary)'}}>
            <Users style={{width:32,height:32,opacity:0.3}}/>
            <p style={{fontSize:13,margin:0}}>Sin deudas registradas</p>
          </div>
        ):(
          <div>
            {deudasFiltradas.map(d => {
              const dias = differenceInDays(new Date(), new Date(d.fecha_deuda))
              const u = urgenciaStyle(dias, d.estado)
              return (
                <div key={d.id} style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)',background:u.bg,transition:'background 0.15s'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                    {/* Avatar */}
                    <div style={{width:38,height:38,borderRadius:'50%',background:`color-mix(in srgb, ${u.color} 12%, transparent)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:u.color,flexShrink:0}}>
                      {d.nombre_deudor?.charAt(0)?.toUpperCase()}
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      {/* Nombre + monto */}
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:4}}>
                        <p style={{fontSize:14,fontWeight:600,color:'var(--app-text)',margin:0}}>{d.nombre_deudor}</p>
                        <p style={{fontSize:14,fontWeight:700,color:d.estado==='liquidada'?'#22c55e':'#f87171',margin:0,flexShrink:0,textAlign:'right'}}>{resumenDeuda(d)}</p>
                      </div>

                      {/* Estado + días */}
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{
                          fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:500,
                          background:d.estado==='liquidada'?'rgba(34,197,94,0.12)':d.estado==='pagada_parcial'?'rgba(234,179,8,0.12)':'rgba(239,68,68,0.12)',
                          color:d.estado==='liquidada'?'#22c55e':d.estado==='pagada_parcial'?'#eab308':'#f87171',
                          border:`1px solid ${d.estado==='liquidada'?'rgba(34,197,94,0.3)':d.estado==='pagada_parcial'?'rgba(234,179,8,0.3)':'rgba(239,68,68,0.3)'}`
                        }}>
                          {d.estado==='liquidada'?'✅ Liquidada':d.estado==='pagada_parcial'?'⚠️ Parcial':'🔴 Activa'}
                        </span>
                        {u.label&&(
                          <span style={{fontSize:11,color:u.color,display:'flex',alignItems:'center',gap:3}}>
                            <Clock style={{width:11,height:11}}/>{u.label}
                          </span>
                        )}
                        <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>
                          {format(new Date(d.fecha_deuda+'T12:00:00'),'dd/MM/yyyy',{locale:es})}
                        </span>
                      </div>

                      {d.notas&&<p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 6px',fontStyle:'italic'}}>📝 "{d.notas}"</p>}

                      {/* Acciones */}
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        <button onClick={()=>{setSelected(d);setError('');cargarHistorialCompleto(d.nombre_deudor);setModal('historial')}}
                          style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',color:'#60a5fa',cursor:'pointer'}}>
                          📋 Historial
                        </button>
                        {d.estado!=='liquidada'&&(
                          <button onClick={()=>{setSelected(d);setPagoForm(emptyPagoForm);setError('');setModal('pago')}}
                            style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',color:'#22c55e',cursor:'pointer'}}>
                            ✓ Registrar pago
                          </button>
                        )}
                        {isAdmin&&(
                          <button onClick={()=>{setSelected(d);setEditForm({monto_pendiente:d.monto_pendiente||'',balones_pendiente:d.balones_pendiente||'',vales_20_pendiente:d.vales_20_pendiente||'',vales_43_pendiente:d.vales_43_pendiente||'',fecha_deuda:d.fecha_deuda,notas:d.notas||''});setError('');setModal('editar')}}
                            style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',color:'var(--app-text-secondary)',cursor:'pointer'}}>
                            ✏️ Editar
                          </button>
                        )}
                        {isAdmin&&(
                          <button onClick={()=>eliminarDeuda(d.id)}
                            style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#f87171',cursor:'pointer'}}>
                            🗑️ Borrar
                          </button>
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

      {/* ── Modal registrar pago ── */}
      {modal==='pago'&&selected&&(
        <Modal title={`Registrar pago — ${selected.nombre_deudor}`} onClose={()=>setModal(null)}>
          <div className="space-y-4">
            {/* Resumen deuda */}
            <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,padding:'12px 14px'}}>
              <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:'0 0 4px'}}>Deuda pendiente:</p>
              <p style={{fontSize:15,fontWeight:700,color:'#f87171',margin:0}}>{resumenDeuda(selected)}</p>
              <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'4px 0 0'}}>
                {differenceInDays(new Date(),new Date(selected.fecha_deuda))} días sin pagar
              </p>
            </div>

            {error&&<div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16}}/>{error}</div>}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {parseFloat(selected.monto_pendiente)>0&&(
                <div>
                  <label className="label">Monto S/ que paga</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                    <input type="number" min="0" max={selected.monto_pendiente} className="input" style={{paddingLeft:'2rem'}} value={pagoForm.monto} onChange={e=>setPagoForm(f=>({...f,monto:e.target.value}))} placeholder={`Máx: S/${selected.monto_pendiente}`}/>
                  </div>
                </div>
              )}
              {parseInt(selected.balones_pendiente)>0&&(
                <div>
                  <label className="label">Balones que devuelve</label>
                  <input type="number" min="0" max={selected.balones_pendiente} className="input" value={pagoForm.balones} onChange={e=>setPagoForm(f=>({...f,balones:e.target.value}))} placeholder={`Máx: ${selected.balones_pendiente}`}/>
                </div>
              )}
              {parseInt(selected.vales_20_pendiente)>0&&(
                <div>
                  <label className="label">Vales S/20 que entrega</label>
                  <input type="number" min="0" max={selected.vales_20_pendiente} className="input" value={pagoForm.vales_20} onChange={e=>setPagoForm(f=>({...f,vales_20:e.target.value}))} placeholder={`Máx: ${selected.vales_20_pendiente}`}/>
                </div>
              )}
              {parseInt(selected.vales_43_pendiente)>0&&(
                <div>
                  <label className="label">Vales S/43 que entrega</label>
                  <input type="number" min="0" max={selected.vales_43_pendiente} className="input" value={pagoForm.vales_43} onChange={e=>setPagoForm(f=>({...f,vales_43:e.target.value}))} placeholder={`Máx: ${selected.vales_43_pendiente}`}/>
                </div>
              )}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label className="label">Método de pago</label>
                <select className="input" value={pagoForm.metodo_pago} onChange={e=>setPagoForm(f=>({...f,metodo_pago:e.target.value}))}>
                  {['efectivo','yape','transferencia','vale','mixto'].map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha del pago</label>
                <input type="date" className="input" value={pagoForm.fecha} onChange={e=>setPagoForm(f=>({...f,fecha:e.target.value}))}/>
              </div>
            </div>

            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" value={pagoForm.notas} onChange={e=>setPagoForm(f=>({...f,notas:e.target.value}))} placeholder="Observaciones del pago..."/>
            </div>

            {/* Preview pago */}
            {(parseFloat(pagoForm.monto)||parseInt(pagoForm.balones)||parseInt(pagoForm.vales_20)||parseInt(pagoForm.vales_43))>0&&(()=>{
              const m=parseFloat(pagoForm.monto)||0
              const b=parseInt(pagoForm.balones)||0
              const v20=parseInt(pagoForm.vales_20)||0
              const v43=parseInt(pagoForm.vales_43)||0
              const totalV=(v20*20)+(v43*43)
              const totalPago=m+totalV
              const quedaMonto=Math.max(0,(parseFloat(selected.monto_pendiente)||0)-totalPago)
              const quedaBal=Math.max(0,(parseInt(selected.balones_pendiente)||0)-b)
              const liquidada=quedaMonto===0&&quedaBal===0&&Math.max(0,(parseInt(selected.vales_20_pendiente)||0)-v20)===0&&Math.max(0,(parseInt(selected.vales_43_pendiente)||0)-v43)===0
              return(
                <div style={{background:liquidada?'rgba(34,197,94,0.08)':'rgba(59,130,246,0.08)',border:`1px solid ${liquidada?'rgba(34,197,94,0.3)':'rgba(59,130,246,0.3)'}`,borderRadius:8,padding:'10px 14px',fontSize:12}}>
                  {liquidada
                    ? <p style={{color:'#22c55e',fontWeight:600,margin:0}}>✅ Con este pago la deuda queda liquidada completamente</p>
                    : <>
                        <p style={{color:'var(--app-text-secondary)',margin:'0 0 4px'}}>Después del pago queda debiendo:</p>
                        {quedaMonto>0&&<p style={{color:'#f87171',fontWeight:600,margin:'0 0 2px'}}>S/{quedaMonto.toLocaleString('es-PE')}</p>}
                        {quedaBal>0&&<p style={{color:'#fb923c',fontWeight:600,margin:0}}>{quedaBal} balón(es) a devolver</p>}
                      </>
                  }
                </div>
              )
            })()}

            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={registrarPago} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'✓ Registrar pago'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal historial ── */}
      {modal==='historial'&&selected&&(
        <Modal title={`📋 Historial — ${selected.nombre_deudor}`} onClose={()=>setModal(null)} wide>
          <div className="space-y-4">
            <div style={{background:selected.estado==='liquidada'?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${selected.estado==='liquidada'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,borderRadius:10,padding:'12px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <span style={{fontSize:13,fontWeight:600,color:selected.estado==='liquidada'?'#22c55e':'#f87171'}}>
                  {selected.estado==='liquidada'?'✅ Liquidada':selected.estado==='pagada_parcial'?'⚠️ Pagada parcialmente':'🔴 Activa'}
                </span>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {parseFloat(selected.monto_pendiente)>0&&<span style={{fontSize:12,background:'rgba(239,68,68,0.12)',color:'#f87171',padding:'3px 10px',borderRadius:20,fontWeight:600}}>S/{Number(selected.monto_pendiente).toLocaleString('es-PE')}</span>}
                  {parseInt(selected.balones_pendiente)>0&&<span style={{fontSize:12,background:'rgba(251,146,60,0.12)',color:'#fb923c',padding:'3px 10px',borderRadius:20,fontWeight:600}}>{selected.balones_pendiente} bal.</span>}
                </div>
              </div>
            </div>

            {historialCompleto?.deudas&&(
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'Deudas totales',value:historialCompleto.deudas.length,color:'var(--app-text)'},
                  {label:'Liquidadas',value:historialCompleto.deudas.filter(d=>d.estado==='liquidada').length,color:'#22c55e'},
                  {label:'Activas',value:historialCompleto.deudas.filter(d=>d.estado!=='liquidada').length,color:'#f87171'},
                ].map(({label,value,color})=>(
                  <div key={label} style={{background:'var(--app-card-bg-alt)',borderRadius:8,padding:'10px',textAlign:'center'}}>
                    <p style={{fontSize:22,fontWeight:700,color,margin:0}}>{value}</p>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p style={{fontSize:12,color:'var(--app-text-secondary)',fontWeight:600,textTransform:'uppercase',marginBottom:12}}>Movimientos</p>
              {loadingHistorial?(
                <div style={{textAlign:'center',color:'var(--app-text-secondary)',padding:'20px 0'}}>Cargando historial...</div>
              ):(
                <div style={{maxHeight:380,overflowY:'auto'}} className="space-y-3 pr-1">
                  {(historialCompleto?.deudas||[selected]).map(deuda=>(
                    <div key={deuda.id} style={{marginBottom:16}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,background:deuda.estado==='liquidada'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',color:deuda.estado==='liquidada'?'#22c55e':'#f87171'}}>
                          {deuda.estado==='liquidada'?'✅ Liquidada':'🔴 Activa'}
                        </span>
                        <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>
                          {deuda.fecha_deuda?format(new Date(deuda.fecha_deuda+'T12:00:00'),'dd/MM/yyyy',{locale:es}):'—'}
                        </span>
                      </div>
                      <div style={{marginLeft:8,borderLeft:'2px solid var(--app-card-border)',paddingLeft:12}} className="space-y-2">
                        {!(deuda.historial||[]).length&&<p style={{fontSize:12,color:'var(--app-text-secondary)',padding:'8px 0'}}>Sin movimientos</p>}
                        {(deuda.historial||[]).map((h,i)=>{
                          const esPago = h.tipo==='pago'
                          const items=[]
                          if(parseFloat(h.monto)>0) items.push(`S/${Number(h.monto).toLocaleString('es-PE')}`)
                          if(parseInt(h.balones)>0) items.push(`${h.balones} bal.`)
                          if(parseInt(h.vales_20)>0) items.push(`${h.vales_20}×S/20`)
                          if(parseInt(h.vales_43)>0) items.push(`${h.vales_43}×S/43`)
                          return(
                            <div key={i} style={{display:'flex',gap:10,padding:'10px 12px',borderRadius:8,background:esPago?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.06)',border:`1px solid ${esPago?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.15)'}`,fontSize:12}}>
                              <span style={{fontSize:14,flexShrink:0}}>{esPago?'💚':'🔴'}</span>
                              <div style={{flex:1}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                                  <div>
                                    <span style={{fontWeight:600,color:esPago?'#22c55e':'#f87171'}}>
                                      {esPago?`Pagó${h.metodo_pago?' · '+h.metodo_pago:''}`:i===0?'Deuda inicial':'Cargo adicional'}
                                    </span>
                                    <span style={{color:'var(--app-text-secondary)',marginLeft:8}}>
                                      {h.fecha?format(new Date(h.fecha+'T12:00:00'),'dd/MM/yyyy',{locale:es}):'—'}
                                    </span>
                                  </div>
                                  <span style={{fontWeight:700,color:esPago?'#22c55e':'#f87171'}}>
                                    {esPago?'−':'+' }{items.join(' + ')}
                                  </span>
                                </div>
                                {h.notas&&<p style={{color:'#eab308',fontStyle:'italic',margin:'3px 0 0'}}>📝 {h.notas}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={()=>setModal(null)} className="btn-secondary w-full">Cerrar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal editar (solo admin) ── */}
      {modal==='editar'&&selected&&isAdmin&&(
        <Modal title="Editar deuda" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            {error&&<div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16}}/>{error}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label className="label">Monto pendiente S/</label><input type="number" min="0" className="input" value={editForm.monto_pendiente} onChange={e=>setEditForm(f=>({...f,monto_pendiente:e.target.value}))}/></div>
              <div><label className="label">Balones pendientes</label><input type="number" min="0" className="input" value={editForm.balones_pendiente} onChange={e=>setEditForm(f=>({...f,balones_pendiente:e.target.value}))}/></div>
              <div><label className="label">Vales S/20 pendientes</label><input type="number" min="0" className="input" value={editForm.vales_20_pendiente} onChange={e=>setEditForm(f=>({...f,vales_20_pendiente:e.target.value}))}/></div>
              <div><label className="label">Vales S/43 pendientes</label><input type="number" min="0" className="input" value={editForm.vales_43_pendiente} onChange={e=>setEditForm(f=>({...f,vales_43_pendiente:e.target.value}))}/></div>
            </div>
            <div><label className="label">Fecha</label><input type="date" className="input" value={editForm.fecha_deuda} onChange={e=>setEditForm(f=>({...f,fecha_deuda:e.target.value}))}/></div>
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={editForm.notas} onChange={e=>setEditForm(f=>({...f,notas:e.target.value}))}/></div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={editarDeuda} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'✓ Guardar cambios'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal registrar deuda manual (solo admin) ── */}
      {modal==='deuda'&&isAdmin&&(
        <Modal title="Registrar deuda manual" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            <div style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.25)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--app-text-secondary)'}}>
              ⚠️ Solo para correcciones o casos especiales. Las ventas al crédito crean deudas automáticamente desde Ventas.
            </div>

            {error&&<div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16}}/>{error}</div>}

            {deudaPendiente&&(
              <div style={{background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.3)',borderRadius:10,padding:'12px 14px'}}>
                <p style={{fontSize:13,fontWeight:600,color:'#fb923c',margin:'0 0 6px'}}>⚠️ {deudaPendiente.nombre_deudor} ya tiene una deuda activa</p>
                <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:'0 0 10px'}}>Pendiente: {resumenDeuda(deudaPendiente)}</p>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={agregarAlaPendiente} disabled={saving} style={{flex:1,padding:'8px',borderRadius:8,background:'rgba(251,146,60,0.15)',border:'1px solid rgba(251,146,60,0.4)',color:'#fb923c',cursor:'pointer',fontSize:13,fontWeight:500}}>
                    {saving?'Guardando...':'+ Sumar a la deuda existente'}
                  </button>
                  <button onClick={()=>guardarDeuda(true)} disabled={saving} style={{flex:1,padding:'8px',borderRadius:8,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',color:'var(--app-text-secondary)',cursor:'pointer',fontSize:13}}>
                    Crear nueva deuda aparte
                  </button>
                </div>
              </div>
            )}

            <div style={{position:'relative'}}>
              <label className="label">Nombre del deudor *</label>
              <input className="input" value={deudaForm.nombre_deudor}
                onChange={e=>{setDeudaForm(f=>({...f,nombre_deudor:e.target.value}));buscarSugerencias(e.target.value)}}
                onFocus={()=>deudaForm.nombre_deudor&&buscarSugerencias(deudaForm.nombre_deudor)}
                onBlur={()=>setTimeout(()=>setMostrarSugerencias(false),150)}
                placeholder="Nombre completo"/>
              {mostrarSugerencias&&sugerencias.length>0&&(
                <div style={{position:'absolute',zIndex:99,background:'var(--app-modal-bg)',border:'1px solid var(--app-card-border)',borderRadius:8,width:'100%',top:'calc(100% + 4px)',overflow:'hidden'}}>
                  {sugerencias.map(s=>(
                    <button key={s.id} type="button" onClick={()=>{setDeudaForm(f=>({...f,nombre_deudor:s.nombre,cliente_id:s.id.startsWith('deudor_')?'':s.id}));setMostrarSugerencias(false)}}
                      style={{width:'100%',textAlign:'left',padding:'9px 12px',fontSize:13,color:'var(--app-text)',background:'none',border:'none',cursor:'pointer'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--app-card-bg-alt)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      {s.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label className="label">Monto S/ (dinero)</label><input type="number" min="0" className="input" value={deudaForm.monto} onChange={e=>setDeudaForm(f=>({...f,monto:e.target.value}))} placeholder="0"/></div>
              <div><label className="label">Balones a devolver</label><input type="number" min="0" className="input" value={deudaForm.balones} onChange={e=>setDeudaForm(f=>({...f,balones:e.target.value}))} placeholder="0"/></div>
              <div><label className="label">Vales S/20</label><input type="number" min="0" className="input" value={deudaForm.vales_20} onChange={e=>setDeudaForm(f=>({...f,vales_20:e.target.value}))} placeholder="0"/></div>
              <div><label className="label">Vales S/43</label><input type="number" min="0" className="input" value={deudaForm.vales_43} onChange={e=>setDeudaForm(f=>({...f,vales_43:e.target.value}))} placeholder="0"/></div>
            </div>
            <div><label className="label">Fecha</label><input type="date" className="input" value={deudaForm.fecha} onChange={e=>setDeudaForm(f=>({...f,fecha:e.target.value}))}/></div>
            <div><label className="label">Notas</label><input className="input" value={deudaForm.notas} onChange={e=>setDeudaForm(f=>({...f,notas:e.target.value}))} placeholder="Contexto de la deuda..."/></div>

            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={()=>guardarDeuda(false)} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'✓ Registrar'}</button>
            </div>
          </div>
        </Modal>
      )}

      <Toast toasts={toasts}/>
    </div>
  )
}
