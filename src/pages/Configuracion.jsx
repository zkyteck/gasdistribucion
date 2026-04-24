import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, X, AlertCircle, Edit2, Eye, EyeOff, Save, CheckCircle, AlertTriangle, Clock, TrendingDown } from 'lucide-react'

const TIPOS_BALON = ['5kg', '10kg', '45kg']
const TABS = [
  ['precios','💰 Precios tienda'],
  ['distribuidores_precios','🚛 Precios distribuidores'],
  ['costos','💲 Costos compra'],
  ['vales','🎫 Vales FISE'],
  ['proveedores','🚚 Proveedores'],
  ['usuarios','👤 Usuarios'],
  ['historial','📋 Historial'],
]
const MODULOS_LABELS = [
  ['ventas','🛒 Ventas'],['vales','🎫 Vales FISE'],['acuenta','📋 A Cuenta'],
  ['clientes','👥 Clientes'],['deudas','⚠️ Deudas'],['inventario','📦 Inventario'],
  ['distribuidores','🚛 Distribuidores'],['almacenes','🏪 Almacenes'],
  ['reportes','📊 Reportes'],['configuracion','⚙️ Configuración'],['correo','📧 Correo'],
]
const PERMISOS_DEFAULT = { ventas:false,vales:false,acuenta:false,clientes:false,deudas:false,inventario:false,distribuidores:false,almacenes:false,reportes:false,configuracion:false,correo:false }
const PERMISOS_TODOS   = { ventas:true,vales:true,acuenta:true,clientes:true,deudas:true,inventario:true,distribuidores:true,almacenes:true,reportes:true,configuracion:false,correo:true }

function Toast({ toasts }) {
  return (
    <div style={{ position:'fixed',bottom:80,right:20,zIndex:999,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderRadius:10,background:t.tipo==='error'?'rgba(239,68,68,0.95)':'rgba(34,197,94,0.95)',color:'#fff',fontSize:13,fontWeight:500,boxShadow:'0 4px 16px rgba(0,0,0,0.3)',animation:'fadeInUp 0.2s ease',minWidth:220 }}>
          {t.tipo==='error'?<AlertTriangle style={{width:16,height:16,flexShrink:0}}/>:<CheckCircle style={{width:16,height:16,flexShrink:0}}/>}
          {t.mensaje}
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts,setToasts] = useState([])
  const timerRef = useRef({})
  const toast = useCallback((mensaje,tipo='ok') => {
    const id = Date.now()
    setToasts(prev => [...prev,{id,mensaje,tipo}])
    timerRef.current[id] = setTimeout(() => setToasts(prev => prev.filter(t => t.id!==id)),3000)
  },[])
  useEffect(() => () => Object.values(timerRef.current).forEach(clearTimeout),[])
  return { toasts, toast }
}

function validarPrecio(val,nombre) {
  if(val===''||val===null) return null
  const n = parseFloat(val)
  if(isNaN(n)) return `${nombre}: debe ser un número`
  if(n<0) return `${nombre}: no puede ser negativo`
  return null
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
      <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:16,width:'100%',maxWidth:520,boxShadow:'0 25px 50px rgba(0,0,0,0.4)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--app-card-border)',position:'sticky',top:0,background:'var(--app-card-bg)'}}>
          <h3 style={{color:'var(--app-text)',fontWeight:600,margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}><X className="w-5 h-5"/></button>
        </div>
        <div style={{padding:'20px 24px'}}>{children}</div>
      </div>
    </div>
  )
}

function PermisoBtn({ activo, onClick, children }) {
  return (
    <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,border:activo?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',background:activo?'color-mix(in srgb, var(--app-accent) 12%, transparent)':'var(--app-card-bg-alt)',color:activo?'var(--app-accent)':'var(--app-text-secondary)',fontSize:13,cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
      <span style={{width:12,height:12,borderRadius:3,flexShrink:0,border:activo?'1px solid var(--app-accent)':'1px solid var(--app-text-secondary)',background:activo?'var(--app-accent)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff'}}>{activo?'✓':''}</span>
      {children}
    </button>
  )
}

function AlertaPerdida({ costoCompra, precioVenta, nombre }) {
  if(!costoCompra||!precioVenta) return null
  const costo = parseFloat(costoCompra), venta = parseFloat(precioVenta)
  if(isNaN(costo)||isNaN(venta)||costo<=0||venta>=costo) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:6,marginTop:3,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',fontSize:11,color:'#f87171'}}>
      <TrendingDown style={{width:11,height:11}}/>
      {nombre} — pérdida de S/{(costo-venta).toFixed(2)} por balón
    </div>
  )
}

export default function Configuracion() {
  const { perfil } = useAuth()
  const [searchParams,setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab')||'precios'
  const setTab = useCallback(t => setSearchParams({tab:t}),[setSearchParams])
  const { toasts, toast } = useToast()

  const [precios,setPrecios] = useState([])
  const [preciosPorTipo,setPreciosPorTipo] = useState([])
  const [proveedores,setProveedores] = useState([])
  const [usuarios,setUsuarios] = useState([])
  const [distribuidores,setDistribuidores] = useState([])
  const [preciosDistTipo,setPreciosDistTipo] = useState([])
  const [almacenesLista,setAlmacenesLista] = useState([])
  const [historial,setHistorial] = useState([])
  const [loading,setLoading] = useState(true)
  const [modal,setModal] = useState(null)
  const [selected,setSelected] = useState(null)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [editandoPrecios,setEditandoPrecios] = useState({})
  const [precioVentaBalon,setPrecioVentaBalon] = useState({'5kg':'100','10kg':'100','45kg':'100'})
  const [editandoDistPrecios,setEditandoDistPrecios] = useState({})
  const [costosCompra,setCostosCompra] = useState({'5kg':'','10kg':'','45kg':''})
  const [costoBalon,setCostoBalon] = useState({'5kg':'','10kg':'','45kg':''})
  const [savingCostos,setSavingCostos] = useState(false)
  const [valorVales,setValorVales] = useState({pequeno:'20',grande:'43'})
  const [savingVales,setSavingVales] = useState(false)
  const [provForm,setProvForm] = useState({nombre:'',telefono:'',direccion:'',ruc:''})
  const [usuarioForm,setUsuarioForm] = useState({nombre:'',email:'',password:'',rol:'trabajador',almacen_id:''})
  const [permisos,setPermisos] = useState(PERMISOS_DEFAULT)
  const [showPass,setShowPass] = useState(false)
  const [editUsuarioSelected,setEditUsuarioSelected] = useState(null)
  const [editPermisos,setEditPermisos] = useState({})
  const [editPassword,setEditPassword] = useState('')
  const [showEditPass,setShowEditPass] = useState(false)

  const logHistorial = useCallback(async (entries) => {
    if(!entries.length) return
    await supabase.from('historial_precios').insert(entries.map(e => ({
      tipo:e.tipo, entidad:e.entidad, tipo_balon:e.tipo_balon||null,
      precio_anterior:e.precio_anterior??null, precio_nuevo:e.precio_nuevo??null,
      usuario_nombre:perfil?.nombre||'Desconocido'
    })))
  },[perfil])

  const cargar = useCallback(async () => {
    setLoading(true)
    if(tab==='precios') {
      const [{data:pt},{data:ptb}] = await Promise.all([supabase.from('precio_tipos').select('*').order('precio'),supabase.from('precio_tipo_balon').select('*')])
      setPrecios(pt||[]); setPreciosPorTipo(ptb||[])
      const mapa={}
      pt?.forEach(p => { mapa[p.id]={}; TIPOS_BALON.forEach(tipo => { const f=ptb?.find(x=>x.precio_tipo_id===p.id&&x.tipo_balon===tipo); mapa[p.id][tipo]=f?.precio??'' }) })
      setEditandoPrecios(mapa)
    } else if(tab==='distribuidores_precios') {
      const [{data:d},{data:pdt}] = await Promise.all([supabase.from('distribuidores').select('*').eq('activo',true).order('nombre'),supabase.from('precio_distribuidor_tipo').select('*')])
      setDistribuidores(d||[]); setPreciosDistTipo(pdt||[])
      const mapa={}
      d?.forEach(dist => { mapa[dist.id]={}; TIPOS_BALON.forEach(tipo => { const f=pdt?.find(x=>x.distribuidor_id===dist.id&&x.tipo_balon===tipo); mapa[dist.id][tipo]=f?.precio??'' }) })
      setEditandoDistPrecios(mapa)
    } else if(tab==='costos') {
      const [{data:pt},{data:ptb},{data:cfg},{data:dists},{data:pdt}] = await Promise.all([
        supabase.from('precio_tipos').select('*').order('precio'),supabase.from('precio_tipo_balon').select('*'),
        supabase.from('configuracion').select('*').in('clave',['costo_5kg','costo_10kg','costo_45kg','costo_balon_5kg','costo_balon_10kg','costo_balon_45kg']),
        supabase.from('distribuidores').select('id,nombre,precio_base').eq('activo',true).order('nombre'),
        supabase.from('precio_distribuidor_tipo').select('*')
      ])
      setPrecios(pt||[]); setPreciosPorTipo(ptb||[]); setDistribuidores(dists||[]); setPreciosDistTipo(pdt||[])
      const mapa={'5kg':'','10kg':'','45kg':''},mapaBalon={'5kg':'','10kg':'','45kg':''}
      cfg?.forEach(r => {
        if(r.clave==='costo_5kg') mapa['5kg']=r.valor||''
        if(r.clave==='costo_10kg') mapa['10kg']=r.valor||''
        if(r.clave==='costo_45kg') mapa['45kg']=r.valor||''
        if(r.clave==='costo_balon_5kg') mapaBalon['5kg']=r.valor||''
        if(r.clave==='costo_balon_10kg') mapaBalon['10kg']=r.valor||''
        if(r.clave==='costo_balon_45kg') mapaBalon['45kg']=r.valor||''
      })
      setCostosCompra(mapa); setCostoBalon(mapaBalon)
    } else if(tab==='vales') {
      const {data} = await supabase.from('configuracion').select('*').in('clave',['valor_vale_pequeno','valor_vale_grande'])
      const mapa={pequeno:'20',grande:'43'}
      data?.forEach(r => { if(r.clave==='valor_vale_pequeno') mapa.pequeno=r.valor||'20'; if(r.clave==='valor_vale_grande') mapa.grande=r.valor||'43' })
      setValorVales(mapa)
    } else if(tab==='proveedores') {
      const {data} = await supabase.from('proveedores').select('*').eq('activo',true).order('nombre')
      setProveedores(data||[])
    } else if(tab==='usuarios') {
      const [{data},{data:alms}] = await Promise.all([supabase.from('usuarios').select('*,almacenes(nombre)').order('nombre'),supabase.from('almacenes').select('id,nombre').eq('activo',true).order('nombre')])
      setUsuarios(data||[]); setAlmacenesLista(alms||[])
    } else if(tab==='historial') {
      const {data} = await supabase.from('historial_precios').select('*').order('created_at',{ascending:false}).limit(100)
      setHistorial(data||[])
    }
    setLoading(false)
  },[tab])

  useEffect(() => { cargar() },[cargar])

  const guardarPreciosTienda = useCallback(async () => {
    for(const id of Object.keys(editandoPrecios)) for(const tipo of TIPOS_BALON) { const err=validarPrecio(editandoPrecios[id][tipo],`Precio ${tipo}`); if(err){toast(err,'error');return} }
    setSaving(true)
    const rows=[],logs=[]
    for(const precioTipoId of Object.keys(editandoPrecios)) {
      const nombreTipo=precios.find(p=>p.id===precioTipoId)?.nombre||precioTipoId
      for(const tipo of TIPOS_BALON) {
        const val=editandoPrecios[precioTipoId][tipo]; if(val===''||val===null) continue
        const existing=preciosPorTipo.find(p=>p.precio_tipo_id===precioTipoId&&p.tipo_balon===tipo)
        rows.push(existing?{id:existing.id,precio_tipo_id:precioTipoId,tipo_balon:tipo,precio:parseFloat(val),updated_at:new Date().toISOString()}:{precio_tipo_id:precioTipoId,tipo_balon:tipo,precio:parseFloat(val)})
        if(existing&&existing.precio!==parseFloat(val)) logs.push({tipo:'tienda',entidad:nombreTipo,tipo_balon:tipo,precio_anterior:existing.precio,precio_nuevo:parseFloat(val)})
      }
    }
    if(rows.length>0) await supabase.from('precio_tipo_balon').upsert(rows,{onConflict:'id'})
    await logHistorial(logs); setSaving(false); toast('Precios guardados'); cargar()
  },[editandoPrecios,preciosPorTipo,precios,cargar,toast,logHistorial])

  const guardarPreciosDistribuidor = useCallback(async () => {
    for(const distId of Object.keys(editandoDistPrecios)) for(const tipo of TIPOS_BALON) { const err=validarPrecio(editandoDistPrecios[distId][tipo],`Precio ${tipo}`); if(err){toast(err,'error');return} }
    setSaving(true)
    const rows=[],distUpdates=[],logs=[]
    for(const distId of Object.keys(editandoDistPrecios)) {
      const nombreDist=distribuidores.find(d=>d.id===distId)?.nombre||distId
      for(const tipo of TIPOS_BALON) {
        const val=editandoDistPrecios[distId][tipo]; if(val===''||val===null) continue
        const existing=preciosDistTipo.find(p=>p.distribuidor_id===distId&&p.tipo_balon===tipo)
        rows.push(existing?{id:existing.id,distribuidor_id:distId,tipo_balon:tipo,precio:parseFloat(val),updated_at:new Date().toISOString()}:{distribuidor_id:distId,tipo_balon:tipo,precio:parseFloat(val)})
        if(existing&&existing.precio!==parseFloat(val)) logs.push({tipo:'distribuidor',entidad:nombreDist,tipo_balon:tipo,precio_anterior:existing.precio,precio_nuevo:parseFloat(val)})
      }
      const p10=editandoDistPrecios[distId]['10kg']
      if(p10!==''&&p10!==null) distUpdates.push(supabase.from('distribuidores').update({precio_base:parseFloat(p10),updated_at:new Date().toISOString()}).eq('id',distId))
    }
    const ops=[]; if(rows.length>0) ops.push(supabase.from('precio_distribuidor_tipo').upsert(rows,{onConflict:'id'}))
    await Promise.all([...ops,...distUpdates]); await logHistorial(logs); setSaving(false); toast('Precios de distribuidores guardados'); cargar()
  },[editandoDistPrecios,preciosDistTipo,distribuidores,cargar,toast,logHistorial])

  const guardarCostos = useCallback(async () => {
    for(const tipo of TIPOS_BALON) { const e1=validarPrecio(costosCompra[tipo],`Costo ${tipo}`),e2=validarPrecio(costoBalon[tipo],`Balón ${tipo}`); if(e1){toast(e1,'error');return} if(e2){toast(e2,'error');return} }
    setSavingCostos(true); const now=new Date().toISOString()
    await Promise.all([
      supabase.from('configuracion').upsert({clave:'costo_5kg',valor:costosCompra['5kg']?.toString()||'0',updated_at:now},{onConflict:'clave'}),
      supabase.from('configuracion').upsert({clave:'costo_10kg',valor:costosCompra['10kg']?.toString()||'0',updated_at:now},{onConflict:'clave'}),
      supabase.from('configuracion').upsert({clave:'costo_45kg',valor:costosCompra['45kg']?.toString()||'0',updated_at:now},{onConflict:'clave'}),
      supabase.from('configuracion').upsert({clave:'costo_balon_5kg',valor:costoBalon['5kg']?.toString()||'0',updated_at:now},{onConflict:'clave'}),
      supabase.from('configuracion').upsert({clave:'costo_balon_10kg',valor:costoBalon['10kg']?.toString()||'0',updated_at:now},{onConflict:'clave'}),
      supabase.from('configuracion').upsert({clave:'costo_balon_45kg',valor:costoBalon['45kg']?.toString()||'0',updated_at:now},{onConflict:'clave'}),
    ])
    await logHistorial(TIPOS_BALON.map(tipo=>({tipo:'costo',entidad:`Gas ${tipo}`,tipo_balon:tipo,precio_nuevo:parseFloat(costosCompra[tipo])||0})))
    setSavingCostos(false); toast('Costos guardados'); cargar()
  },[costosCompra,costoBalon,cargar,toast,logHistorial])

  const guardarVales = useCallback(async () => {
    const e1=validarPrecio(valorVales.pequeno,'Vale pequeño'),e2=validarPrecio(valorVales.grande,'Vale grande')
    if(e1){toast(e1,'error');return} if(e2){toast(e2,'error');return}
    setSavingVales(true); const now=new Date().toISOString()
    await Promise.all([
      supabase.from('configuracion').upsert({clave:'valor_vale_pequeno',valor:valorVales.pequeno?.toString()||'20',updated_at:now},{onConflict:'clave'}),
      supabase.from('configuracion').upsert({clave:'valor_vale_grande',valor:valorVales.grande?.toString()||'43',updated_at:now},{onConflict:'clave'}),
    ])
    await logHistorial([{tipo:'vale',entidad:'Vale pequeño',precio_nuevo:parseFloat(valorVales.pequeno)},{tipo:'vale',entidad:'Vale grande',precio_nuevo:parseFloat(valorVales.grande)}])
    setSavingVales(false); toast('Valores de vales guardados')
  },[valorVales,toast,logHistorial])

  const guardarProveedor = useCallback(async () => {
    if(!provForm.nombre.trim()){setError('El nombre es obligatorio');return}
    setSaving(true); setError('')
    const op=selected?supabase.from('proveedores').update({...provForm,updated_at:new Date().toISOString()}).eq('id',selected.id):supabase.from('proveedores').insert(provForm)
    const {error:e}=await op; setSaving(false)
    if(e){setError(e.message);return}
    setModal(null); toast(selected?'Proveedor actualizado':'Proveedor creado'); cargar()
  },[provForm,selected,cargar,toast])

  const eliminarProveedor = useCallback(async () => {
    if(!selected) return
    if(!confirm(`¿Eliminar al proveedor "${selected.nombre}"?`)) return
    setSaving(true)
    await supabase.from('proveedores').update({activo:false}).eq('id',selected.id)
    setSaving(false); setModal(null); toast('Proveedor eliminado'); cargar()
  },[selected,cargar,toast])

  const guardarUsuario = useCallback(async () => {
    if(!usuarioForm.nombre.trim()||!usuarioForm.email.trim()||!usuarioForm.password){setError('Completa nombre, email y contraseña');return}
    if(usuarioForm.password.length<6){setError('La contraseña debe tener al menos 6 caracteres');return}
    setSaving(true); setError('')
    try {
      const serviceKey=import.meta.env.VITE_SUPABASE_SERVICE_KEY
      if(!serviceKey){setError('Service key no configurada');setSaving(false);return}
      const permisosToSave=usuarioForm.rol==='admin'?null:permisos
      const resp=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users`,{method:'POST',headers:{'Content-Type':'application/json','apikey':serviceKey,'Authorization':`Bearer ${serviceKey}`},body:JSON.stringify({email:usuarioForm.email,password:usuarioForm.password,email_confirm:true,user_metadata:{nombre:usuarioForm.nombre,rol:usuarioForm.rol,permisos:permisosToSave?JSON.stringify(permisosToSave):null}})})
      const authData=await resp.json()
      if(!resp.ok){setError(authData.msg||authData.message||JSON.stringify(authData));setSaving(false);return}
      const newAuthId=(authData.user||authData).id
      await new Promise(r=>setTimeout(r,1000))
      await supabase.from('usuarios').upsert({auth_id:newAuthId,email:usuarioForm.email,nombre:usuarioForm.nombre,rol:usuarioForm.rol,permisos:permisosToSave,almacen_id:usuarioForm.almacen_id||null,activo:true},{onConflict:'auth_id'})
      setModal(null); toast(`Usuario ${usuarioForm.nombre} creado`); cargar()
    } catch(e){setError(e.message)}
    setSaving(false)
  },[usuarioForm,permisos,cargar,toast])

  const eliminarUsuario = useCallback(async () => {
    if(!editUsuarioSelected) return
    if(editUsuarioSelected.rol==='admin'){setError('No puedes eliminar un administrador');return}
    if(!confirm(`¿Eliminar al usuario ${editUsuarioSelected.nombre}?`)) return
    setSaving(true); setError('')
    const {error:e}=await supabase.from('usuarios').delete().eq('id',editUsuarioSelected.id)
    if(e){setError(e.message);setSaving(false);return}
    const serviceKey=import.meta.env.VITE_SUPABASE_SERVICE_KEY
    if(serviceKey&&editUsuarioSelected.auth_id) await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${editUsuarioSelected.auth_id}`,{method:'DELETE',headers:{'apikey':serviceKey,'Authorization':`Bearer ${serviceKey}`}})
    setSaving(false); setModal(null); toast(`Usuario ${editUsuarioSelected.nombre} eliminado`); cargar()
  },[editUsuarioSelected,cargar,toast])

  const toggleActivoUsuario = useCallback(async () => {
    if(!editUsuarioSelected) return
    if(editUsuarioSelected.rol==='admin'){setError('No puedes suspender un administrador');return}
    const nuevoEstado=!editUsuarioSelected.activo
    setSaving(true)
    await supabase.from('usuarios').update({activo:nuevoEstado}).eq('id',editUsuarioSelected.id)
    setSaving(false); setModal(null); toast(`Usuario ${nuevoEstado?'activado':'suspendido'}`); cargar()
  },[editUsuarioSelected,cargar,toast])

  const guardarEditUsuario = useCallback(async () => {
    if(!editUsuarioSelected) return
    setSaving(true); setError('')
    const permisosToSave=editUsuarioSelected.rol==='admin'?null:editPermisos
    const {error:e}=await supabase.from('usuarios').update({nombre:editUsuarioSelected.nombre,rol:editUsuarioSelected.rol,permisos:permisosToSave,almacen_id:editUsuarioSelected.almacen_id||null}).eq('id',editUsuarioSelected.id)
    if(e){setError(e.message);setSaving(false);return}
    if(editPassword&&editPassword.length>=6&&editUsuarioSelected.auth_id) {
      const serviceKey=import.meta.env.VITE_SUPABASE_SERVICE_KEY
      if(serviceKey) await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${editUsuarioSelected.auth_id}`,{method:'PUT',headers:{'Content-Type':'application/json','apikey':serviceKey,'Authorization':`Bearer ${serviceKey}`},body:JSON.stringify({password:editPassword})})
    }
    setSaving(false); setEditPassword(''); setModal(null); toast(`Usuario ${editUsuarioSelected.nombre} actualizado`); cargar()
  },[editUsuarioSelected,editPermisos,editPassword,cargar,toast])

  const tabStyle = (key) => ({
    padding:'8px 14px',fontSize:13,fontWeight:500,
    borderBottom:tab===key?'2px solid var(--app-accent)':'2px solid transparent',
    color:tab===key?'var(--app-accent)':'var(--app-text-secondary)',
    background:'none',border:'none',
    borderBottom:tab===key?`2px solid var(--app-accent)`:'2px solid transparent',
    cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.15s'
  })

  return (
    <div className="space-y-6">
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div>
        <h2 className="text-xl font-bold" style={{color:'var(--app-text)'}}>Configuración</h2>
        <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Precios, proveedores y usuarios del sistema</p>
      </div>

      <div className="flex gap-1 overflow-x-auto" style={{borderBottom:'1px solid var(--app-card-border)'}}>
        {TABS.map(([key,label]) => <button key={key} onClick={()=>setTab(key)} style={tabStyle(key)}>{label}</button>)}
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--app-text-secondary)'}}>Cargando...</div>
      ) : (<>

        {/* PRECIOS TIENDA */}
        {tab==='precios' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Precio por tipo de cliente y tamaño de balón</p>
              <button onClick={guardarPreciosTienda} disabled={saving} className="btn-primary"><Save className="w-4 h-4"/>{saving?'Guardando...':'Guardar cambios'}</button>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                  <th className="text-left text-xs font-semibold uppercase px-6 py-3" style={{color:'var(--app-text-secondary)'}}>Tipo de cliente</th>
                  {TIPOS_BALON.map(t=><th key={t} className="text-left text-xs font-semibold uppercase px-4 py-3" style={{color:'var(--app-text-secondary)'}}>🔵 {t}</th>)}
                </tr></thead>
                <tbody>
                  {precios.map(p=>(
                    <tr key={p.id} className="table-row-hover">
                      <td className="px-6 py-4"><p className="font-semibold text-sm" style={{color:'var(--app-text)'}}>{p.nombre}</p><p className="text-xs" style={{color:'var(--app-text-secondary)'}}>Base: S/{p.precio}</p></td>
                      {TIPOS_BALON.map(tipo=>(
                        <td key={tipo} className="px-4 py-4">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                            <input type="number" min="0" className="input w-28 text-sm" style={{paddingLeft:"2rem"}} value={editandoPrecios[p.id]?.[tipo]??''} onChange={e=>setEditandoPrecios(prev=>({...prev,[p.id]:{...prev[p.id],[tipo]:e.target.value}}))} placeholder="0"/>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-3" style={{borderBottom:'1px solid var(--app-card-border)'}}><p className="font-semibold text-sm" style={{color:'var(--app-text)'}}>🔵 Precio venta balón vacío</p></div>
              <div className="flex gap-8 px-6 py-4">
                {TIPOS_BALON.map(tipo=>(
                  <div key={tipo} className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{color:'var(--app-text-secondary)'}}>{tipo}:</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                      <input type="number" min="0" className="input w-24 text-sm" style={{paddingLeft:"2rem"}} value={precioVentaBalon[tipo]} onChange={e=>setPrecioVentaBalon(c=>({...c,[tipo]:e.target.value}))} placeholder="100"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PRECIOS DISTRIBUIDORES */}
        {tab==='distribuidores_precios' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Precio por distribuidor y tamaño de balón</p>
              <button onClick={guardarPreciosDistribuidor} disabled={saving} className="btn-primary"><Save className="w-4 h-4"/>{saving?'Guardando...':'Guardar cambios'}</button>
            </div>
            <div className="space-y-4">
              {distribuidores.map(d=>(
                <div key={d.id} className="card" style={{border:'1px solid var(--app-card-border)'}}>
                  <div className="flex items-center gap-3 mb-4" style={{paddingBottom:12,borderBottom:'1px solid var(--app-card-border)'}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:'color-mix(in srgb, var(--app-accent) 15%, transparent)',border:'1px solid color-mix(in srgb, var(--app-accent) 30%, transparent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--app-accent)',fontWeight:700,fontSize:14}}>
                      {d.nombre?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{color:'var(--app-text)'}}>{d.nombre}</p>
                      <div className="flex gap-3 mt-0.5">
                        {d.modalidad&&<span className="text-xs" style={{color:'var(--app-text-secondary)'}}>📋 {d.modalidad}</span>}
                        {d.telefono&&<span className="text-xs" style={{color:'var(--app-text-secondary)'}}>📞 {d.telefono}</span>}
                        {d.precio_base&&<span className="text-xs" style={{color:'var(--app-accent)'}}>Base: S/{d.precio_base}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {TIPOS_BALON.map(tipo=>(
                      <div key={tipo} className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{color:'var(--app-text-secondary)'}}>{tipo}:</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'var(--app-text-secondary)'}}>S/</span>
                          <input type="number" min="0" className="input w-24 text-sm" style={{paddingLeft:"2rem"}} value={editandoDistPrecios[d.id]?.[tipo]??''} onChange={e=>setEditandoDistPrecios(prev=>({...prev,[d.id]:{...prev[d.id],[tipo]:e.target.value}}))} placeholder="0"/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COSTOS */}
        {tab==='costos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Precio de compra por tipo de balón</p>
              <button onClick={guardarCostos} disabled={savingCostos} className="btn-primary"><Save className="w-4 h-4"/>{savingCostos?'Guardando...':'Guardar costos'}</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[['5kg','🔵','blue'],['10kg','🟡','yellow'],['45kg','🔴','red']].map(([tipo,icon,color])=>(
                <div key={tipo} className={`card border border-${color}-800/40`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{icon}</span>
                    <div><p className="font-bold" style={{color:'var(--app-text)'}}>{tipo}</p><p className="text-xs" style={{color:'var(--app-text-secondary)'}}>Precio de compra</p></div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-sm" style={{color:'var(--app-text-secondary)'}}>S/</span>
                    <input type="number" min="0" step="0.50" className="input text-xl font-bold text-center" style={{paddingLeft:"2.5rem"}} value={costosCompra[tipo]} onChange={e=>setCostosCompra(c=>({...c,[tipo]:e.target.value}))} placeholder="0.00"/>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs mb-1" style={{color:'var(--app-text-secondary)'}}>Costo balón (envase)</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-sm" style={{color:'var(--app-text-secondary)'}}>S/</span>
                      <input type="number" min="0" step="1" className="input text-sm text-center" style={{paddingLeft:"2.5rem"}} value={costoBalon[tipo]} onChange={e=>setCostoBalon(c=>({...c,[tipo]:e.target.value}))} placeholder="0.00"/>
                    </div>
                  </div>
                  {parseFloat(costosCompra[tipo])>0&&(
                    <div className="mt-3 rounded-lg p-3 text-xs space-y-1" style={{background:'var(--app-card-bg-alt)'}}>
                      <p className="font-medium mb-2" style={{color:'var(--app-text-secondary)'}}>🏪 Ganancia por cliente:</p>
                      {precios.map(p=>{
                        const found=preciosPorTipo.find(x=>x.precio_tipo_id===p.id&&x.tipo_balon===tipo)
                        const pv=found?.precio||0; if(!pv) return null
                        const gan=pv-parseFloat(costosCompra[tipo])
                        return (<div key={p.id}>
                          <div className="flex justify-between items-center">
                            <span style={{color:'var(--app-text-secondary)'}}>{p.nombre}</span>
                            <span className={`font-bold ${gan>0?'text-emerald-400':'text-red-400'}`}>S/{pv} → {gan>0?'+':''}S/{gan.toFixed(2)}</span>
                          </div>
                          <AlertaPerdida costoCompra={costosCompra[tipo]} precioVenta={pv} nombre={p.nombre}/>
                        </div>)
                      })}
                      {distribuidores.length>0&&(<>
                        <p className="font-medium mt-2 pt-2" style={{borderTop:'1px solid var(--app-card-border)',color:'var(--app-text-secondary)'}}>🚛 Distribuidores:</p>
                        {distribuidores.map(d=>{
                          const pdt=preciosDistTipo?.find(x=>x.distribuidor_id===d.id&&x.tipo_balon===tipo)?.precio||0
                          if(!pdt) return null
                          const gan=pdt-parseFloat(costosCompra[tipo])
                          return (<div key={d.id}>
                            <div className="flex justify-between items-center">
                              <span style={{color:'var(--app-text-secondary)'}}>{d.nombre}</span>
                              <span className={`font-bold ${gan>0?'text-emerald-400':'text-red-400'}`}>S/{pdt} → {gan>0?'+':''}S/{gan.toFixed(2)}</span>
                            </div>
                            <AlertaPerdida costoCompra={costosCompra[tipo]} precioVenta={pdt} nombre={d.nombre}/>
                          </div>)
                        })}
                      </>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VALES */}
        {tab==='vales'&&(
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Valor actual de los vales FISE</p>
              <button onClick={guardarVales} disabled={savingVales} className="btn-primary"><Save className="w-4 h-4"/>{savingVales?'Guardando...':'Guardar valores'}</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[{key:'pequeno',label:'Vale pequeño',sub:'Antes S/20, ahora puede ser S/30',color:'yellow'},{key:'grande',label:'Vale grande',sub:'Normalmente S/43',color:'orange'}].map(({key,label,sub,color})=>(
                <div key={key} className={`card border border-${color}-800/40`}>
                  <div className="flex items-center gap-3 mb-4"><span className="text-2xl">🎫</span><div><p className="font-bold" style={{color:'var(--app-text)'}}>{label}</p><p className="text-xs" style={{color:'var(--app-text-secondary)'}}>{sub}</p></div></div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium" style={{color:'var(--app-text-secondary)'}}>S/</span>
                    <input type="number" min="1" className={`input text-3xl font-bold text-center text-${color}-300`} style={{paddingLeft:"2.5rem"}} value={valorVales[key]} onChange={e=>setValorVales(v=>({...v,[key]:e.target.value}))}/>
                  </div>
                  <div className={`mt-3 bg-${color}-900/20 rounded-lg p-3 text-xs text-${color}-300`}>💡 Cada vale {key==='pequeno'?'pequeño':'grande'} valdrá S/{valorVales[key]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROVEEDORES */}
        {tab==='proveedores'&&(
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Empresas proveedoras de balones</p>
              <button onClick={()=>{setSelected(null);setProvForm({nombre:'',telefono:'',direccion:'',ruc:''});setError('');setModal('proveedor')}} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo proveedor</button>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                  {['Proveedor','Teléfono','RUC','Dirección',''].map(h=><th key={h} className="text-left text-xs font-semibold uppercase px-6 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {proveedores.map(p=>(
                    <tr key={p.id} className="table-row-hover">
                      <td className="px-6 py-4 font-medium text-sm" style={{color:'var(--app-text)'}}>{p.nombre}</td>
                      <td className="px-6 py-4 text-sm" style={{color:'var(--app-text-secondary)'}}>{p.telefono||'-'}</td>
                      <td className="px-6 py-4 text-sm font-mono" style={{color:'var(--app-text-secondary)'}}>{p.ruc||'-'}</td>
                      <td className="px-6 py-4 text-sm" style={{color:'var(--app-text-secondary)'}}>{p.direccion||'-'}</td>
                      <td className="px-6 py-4">
                        <button onClick={()=>{setSelected(p);setProvForm({nombre:p.nombre,telefono:p.telefono||'',direccion:p.direccion||'',ruc:p.ruc||''});setError('');setModal('proveedor')}} style={{color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer'}}><Edit2 className="w-4 h-4"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USUARIOS */}
        {tab==='usuarios'&&(
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Personas con acceso al sistema</p>
              <button onClick={()=>{setUsuarioForm({nombre:'',email:'',password:'',rol:'trabajador',almacen_id:''});setPermisos(PERMISOS_DEFAULT);setError('');setModal('usuario')}} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo usuario</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {usuarios.map(u=>(
                <div key={u.id} className="card" style={{border:`1px solid ${u.activo===false?'rgba(239,68,68,0.3)':'var(--app-card-border)'}`,opacity:u.activo===false?0.7:1}}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${u.rol==='admin'?'bg-gradient-to-br from-blue-500 to-indigo-600':u.activo===false?'bg-gray-600':'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>{u.nombre?.charAt(0)?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm" style={{color:'var(--app-text)'}}>{u.nombre}</p>
                        {u.activo===false&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:'rgba(239,68,68,0.15)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)'}}>Suspendido</span>}
                      </div>
                      <p className="text-xs truncate" style={{color:'var(--app-text-secondary)'}}>{u.email}</p>
                      {u.almacen_id&&<p className="text-xs mt-0.5" style={{color:'var(--app-accent)'}}>🏪 {u.almacenes?.nombre}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={u.rol==='admin'?'badge-blue':'badge-green'}>{u.rol==='admin'?'👑 Admin':'👷 Trabajador'}</span>
                      <button onClick={async()=>{setEditUsuarioSelected({...u});setEditPermisos(u.permisos||{});setError('');setEditPassword('');if(almacenesLista.length===0){const{data:alms}=await supabase.from('almacenes').select('id,nombre').eq('activo',true).order('nombre');setAlmacenesLista(alms||[])};setModal('editUsuario')}} className="text-xs bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 px-2 py-1 rounded-lg transition-all">✏️</button>
                    </div>
                  </div>
                  {u.rol!=='admin'&&(<div className="flex flex-wrap gap-1">{MODULOS_LABELS.map(([key,label])=>(<span key={key} style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:u.permisos?.[key]?'color-mix(in srgb, var(--app-accent) 12%, transparent)':'var(--app-card-bg-alt)',border:u.permisos?.[key]?'1px solid color-mix(in srgb, var(--app-accent) 40%, transparent)':'1px solid var(--app-card-border)',color:u.permisos?.[key]?'var(--app-accent)':'var(--app-text-secondary)',textDecoration:u.permisos?.[key]?'none':'line-through'}}>{label}</span>))}</div>)}
                  {u.rol==='admin'&&<p className="text-xs" style={{color:'var(--app-text-secondary)'}}>Acceso completo a todos los módulos</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTORIAL */}
        {tab==='historial'&&(
          <div className="space-y-4">
            <p className="text-sm" style={{color:'var(--app-text-secondary)'}}>Últimos 100 cambios de precios y configuración</p>
            {historial.length===0?(
              <div style={{textAlign:'center',padding:'40px 0',color:'var(--app-text-secondary)'}}>
                <Clock style={{width:32,height:32,margin:'0 auto 8px',opacity:0.4}}/>
                <p>No hay cambios registrados aún</p>
              </div>
            ):(
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                    {['Fecha','Tipo','Detalle','Anterior','Nuevo','Usuario'].map(h=><th key={h} className="text-left text-xs font-semibold uppercase px-4 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {historial.map(h=>(
                      <tr key={h.id} className="table-row-hover">
                        <td className="px-4 py-3 text-xs" style={{color:'var(--app-text-secondary)'}}>{new Date(h.created_at).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="px-4 py-3"><span style={{fontSize:11,padding:'2px 8px',borderRadius:4,fontWeight:500,background:h.tipo==='tienda'?'rgba(59,130,246,0.15)':h.tipo==='distribuidor'?'rgba(168,85,247,0.15)':h.tipo==='costo'?'rgba(245,158,11,0.15)':'rgba(34,197,94,0.15)',color:h.tipo==='tienda'?'#60a5fa':h.tipo==='distribuidor'?'#c084fc':h.tipo==='costo'?'#fbbf24':'#4ade80'}}>{h.tipo}</span></td>
                        <td className="px-4 py-3 text-sm" style={{color:'var(--app-text)'}}>{h.entidad}{h.tipo_balon?` · ${h.tipo_balon}`:''}</td>
                        <td className="px-4 py-3 text-sm" style={{color:'var(--app-text-secondary)'}}>{h.precio_anterior!=null?`S/${h.precio_anterior}`:'-'}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{color:'var(--app-accent)'}}>{h.precio_nuevo!=null?`S/${h.precio_nuevo}`:'-'}</td>
                        <td className="px-4 py-3 text-sm" style={{color:'var(--app-text-secondary)'}}>{h.usuario_nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </>)}

      {/* MODAL NUEVO USUARIO */}
      {modal==='usuario'&&(
        <Modal title="Nuevo usuario" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            {error&&<div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4"/>{error}</div>}
            <div><label className="label">Nombre completo *</label><input className="input" value={usuarioForm.nombre} onChange={e=>setUsuarioForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Juan Pérez"/></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={usuarioForm.email} onChange={e=>setUsuarioForm(f=>({...f,email:e.target.value}))} placeholder="correo@ejemplo.com"/></div>
            <div>
              <label className="label">Contraseña *</label>
              <div className="relative">
                <input type={showPass?'text':'password'} className="input pr-10" value={usuarioForm.password} onChange={e=>setUsuarioForm(f=>({...f,password:e.target.value}))} placeholder="Mínimo 6 caracteres"/>
                <button type="button" onClick={()=>setShowPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPass?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
              </div>
            </div>
            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-2 gap-3">
                {[['trabajador','👷 Trabajador','Registra ventas y operaciones','emerald'],['admin','👑 Admin','Acceso completo','blue']].map(([rol,titulo,desc,color])=>(
                  <button key={rol} onClick={()=>setUsuarioForm(f=>({...f,rol}))} className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left ${usuarioForm.rol===rol?`bg-${color}-600/20 border-${color}-500 text-${color}-300`:'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                    <p className="font-bold">{titulo}</p><p className="text-xs mt-1 opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {usuarioForm.rol==='trabajador'&&<>
              <div><label className="label">🏪 Almacén asignado</label><select className="input" value={usuarioForm.almacen_id} onChange={e=>setUsuarioForm(f=>({...f,almacen_id:e.target.value}))}><option value="">Sin almacén específico</option>{almacenesLista.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Módulos con acceso</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setPermisos(PERMISOS_TODOS)} style={{fontSize:12,color:'var(--app-accent)',background:'none',border:'none',cursor:'pointer'}}>✓ Todos</button>
                    <button type="button" onClick={()=>setPermisos(PERMISOS_DEFAULT)} style={{fontSize:12,color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer'}}>✗ Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">{MODULOS_LABELS.map(([key,label])=><PermisoBtn key={key} activo={permisos[key]} onClick={()=>setPermisos(p=>({...p,[key]:!p[key]}))}>{label}</PermisoBtn>)}</div>
              </div>
            </>}
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarUsuario} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Creando...':'✓ Crear usuario'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL EDITAR USUARIO */}
      {modal==='editUsuario'&&editUsuarioSelected&&(
        <Modal title="Editar usuario" onClose={()=>{setModal(null);setEditPassword('')}}>
          <div className="space-y-4">
            {error&&<div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4"/>{error}</div>}
            <div><label className="label">Email</label><input className="input opacity-60 cursor-not-allowed" value={editUsuarioSelected.email||''} readOnly/></div>
            <div><label className="label">Nombre</label><input className="input" value={editUsuarioSelected.nombre} onChange={e=>setEditUsuarioSelected(u=>({...u,nombre:e.target.value}))}/></div>
            <div>
              <label className="label">Nueva contraseña <span style={{color:'var(--app-text-secondary)',fontWeight:400}}>(dejar vacío para no cambiar)</span></label>
              <div className="relative">
                <input type={showEditPass?'text':'password'} className="input pr-10" placeholder="Mínimo 6 caracteres" value={editPassword} onChange={e=>setEditPassword(e.target.value)}/>
                <button type="button" onClick={()=>setShowEditPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showEditPass?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
              </div>
              {editPassword&&editPassword.length<6&&<p className="text-xs text-red-400 mt-1">Mínimo 6 caracteres</p>}
            </div>
            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-2 gap-3">
                {[['trabajador','👷 Trabajador','Solo módulos asignados','emerald'],['admin','👑 Admin','Acceso completo','blue']].map(([rol,titulo,desc,color])=>(
                  <button key={rol} onClick={()=>setEditUsuarioSelected(u=>({...u,rol}))} className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left ${editUsuarioSelected.rol===rol?`bg-${color}-600/20 border-${color}-500 text-${color}-300`:'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                    <p className="font-bold">{titulo}</p><p className="text-xs mt-1 opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {editUsuarioSelected.rol==='trabajador'&&<>
              <div><label className="label">🏪 Almacén asignado</label><select className="input" value={editUsuarioSelected.almacen_id||''} onChange={e=>setEditUsuarioSelected(u=>({...u,almacen_id:e.target.value||null}))}><option value="">Sin almacén específico</option>{almacenesLista.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Módulos con acceso</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setEditPermisos(PERMISOS_TODOS)} style={{fontSize:12,color:'var(--app-accent)',background:'none',border:'none',cursor:'pointer'}}>✓ Todos</button>
                    <button type="button" onClick={()=>setEditPermisos(PERMISOS_DEFAULT)} style={{fontSize:12,color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer'}}>✗ Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">{MODULOS_LABELS.map(([key,label])=><PermisoBtn key={key} activo={editPermisos[key]} onClick={()=>setEditPermisos(p=>({...p,[key]:!p[key]}))}>{label}</PermisoBtn>)}</div>
              </div>
            </>}
            <div className="flex gap-3 pt-2">
              <button onClick={()=>{setModal(null);setEditPassword('')}} className="btn-secondary">Cancelar</button>
              {editUsuarioSelected.rol!=='admin'&&(
                <button onClick={toggleActivoUsuario} disabled={saving} style={{padding:'8px 14px',borderRadius:12,fontSize:13,fontWeight:500,cursor:'pointer',border:editUsuarioSelected.activo===false?'1px solid rgba(34,197,94,0.4)':'1px solid rgba(245,158,11,0.4)',background:editUsuarioSelected.activo===false?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)',color:editUsuarioSelected.activo===false?'#4ade80':'#fbbf24'}}>
                  {editUsuarioSelected.activo===false?'✓ Activar':'⏸ Suspender'}
                </button>
              )}
              <button onClick={eliminarUsuario} disabled={saving||editUsuarioSelected?.rol==='admin'} className="px-4 py-2 rounded-xl border border-red-600/40 bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/30 transition-all disabled:opacity-30">🗑️ Eliminar</button>
              <button onClick={guardarEditUsuario} disabled={saving||(editPassword&&editPassword.length<6)} className="btn-primary flex-1 justify-center disabled:opacity-50">{saving?'Guardando...':'✓ Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PROVEEDOR */}
      {modal==='proveedor'&&(
        <Modal title={selected?'Editar proveedor':'Nuevo proveedor'} onClose={()=>setModal(null)}>
          <div className="space-y-4">
            {error&&<div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4"/>{error}</div>}
            <div><label className="label">Nombre *</label><input className="input" value={provForm.nombre} onChange={e=>setProvForm(f=>({...f,nombre:e.target.value}))}/></div>
            <div><label className="label">Teléfono</label><input className="input" value={provForm.telefono} onChange={e=>setProvForm(f=>({...f,telefono:e.target.value}))}/></div>
            <div><label className="label">RUC</label><input className="input" value={provForm.ruc} onChange={e=>setProvForm(f=>({...f,ruc:e.target.value}))}/></div>
            <div><label className="label">Dirección</label><input className="input" value={provForm.direccion} onChange={e=>setProvForm(f=>({...f,direccion:e.target.value}))}/></div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              {selected&&<button onClick={eliminarProveedor} disabled={saving} className="px-4 py-2 rounded-xl border border-red-600/40 bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/30 transition-all disabled:opacity-30">🗑️ Eliminar</button>}
              <button onClick={guardarProveedor} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      <Toast toasts={toasts}/>
    </div>
  )
}
