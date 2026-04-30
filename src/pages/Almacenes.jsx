import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Warehouse, Plus, Edit2, Trash2, Package, X, AlertCircle, TestTube, AlertTriangle } from 'lucide-react'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
      <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:16,width:'100%',maxWidth:480,boxShadow:'0 25px 50px rgba(0,0,0,0.4)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--app-card-border)',position:'sticky',top:0,background:'var(--app-card-bg)'}}>
          <h3 style={{color:'var(--app-text)',fontWeight:600,margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}><X className="w-5 h-5"/></button>
        </div>
        <div style={{padding:'20px 24px'}}>{children}</div>
      </div>
    </div>
  )
}

const UMBRAL_BAJO = 10

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([])
  const [stockPorTipo, setStockPorTipo] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre:'', responsable:'', ubicacion:'', es_prueba:false })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [limpiandoPrueba, setLimpiandoPrueba] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data:spt }] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo',true).order('created_at'),
      supabase.from('stock_por_tipo').select('*')
    ])
    setAlmacenes(data||[])
    setStockPorTipo(spt||[])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const getStockTipo = useCallback((almacenId, tipo) => {
    return stockPorTipo.find(s => s.almacen_id===almacenId && s.tipo_balon===tipo)?.stock_actual || 0
  }, [stockPorTipo])

  const abrirNuevo = useCallback(() => {
    setForm({ nombre:'', responsable:'', ubicacion:'', es_prueba:false })
    setEditId(null); setError(''); setModal(true)
  }, [])

  const abrirEditar = useCallback((a) => {
    setForm({ nombre:a.nombre, responsable:a.responsable, ubicacion:a.ubicacion, es_prueba:a.es_prueba||false })
    setEditId(a.id); setError(''); setModal(true)
  }, [])

  const guardar = useCallback(async () => {
    if(!form.nombre||!form.responsable||!form.ubicacion) { setError('Completa todos los campos'); return }
    setSaving(true); setError('')
    const op = editId
      ? supabase.from('almacenes').update({...form, updated_at:new Date().toISOString()}).eq('id',editId)
      : supabase.from('almacenes').insert({...form, stock_actual:0})
    const { error:e } = await op
    setSaving(false)
    if(e) { setError(e.message); return }
    setModal(false); cargar()
  }, [form, editId, cargar])

  const eliminar = useCallback(async (id) => {
    await supabase.from('almacenes').update({activo:false}).eq('id',id)
    setDeleteConfirm(null); cargar()
  }, [cargar])

  const limpiarPrueba = useCallback(async (almacen) => {
    if(!confirm('Borrar TODOS los datos de prueba de '+almacen.nombre+'? Esta accion NO se puede deshacer.')) return
    setLimpiandoPrueba(true)
    const id = almacen.id

    // Obtener distribuidores y compras en paralelo
    const [{ data:distsPrueba }, { data:detalles }] = await Promise.all([
      supabase.from('distribuidores').select('id').eq('almacen_id',id),
      supabase.from('compra_detalles').select('id,compra_id').eq('almacen_id',id)
    ])

    // Armar todas las operaciones paralelas
    const ops = [
      supabase.from('ventas').delete().eq('almacen_id',id),
      supabase.from('deudas').delete().eq('almacen_id',id),
      supabase.from('movimientos_stock').delete().eq('almacen_id',id),
      supabase.from('movimientos_stock').delete().eq('almacen_destino_id',id),
      supabase.from('stock_por_tipo').delete().eq('almacen_id',id),
      supabase.from('reposiciones_distribuidor').delete().eq('almacen_origen_id',id),
    ]

    // Compras
    if(detalles && detalles.length>0) {
      ops.push(supabase.from('compra_detalles').delete().eq('almacen_id',id))
      const compraIds = [...new Set(detalles.map(d=>d.compra_id))]
      compraIds.forEach(cid => ops.push(supabase.from('compras').delete().eq('id',cid)))
    }

    // Distribuidores
    if(distsPrueba && distsPrueba.length>0) {
      distsPrueba.forEach(dist => {
        ops.push(supabase.from('cuentas_distribuidor').delete().eq('distribuidor_id',dist.id))
        ops.push(supabase.from('abonos_distribuidor').delete().eq('distribuidor_id',dist.id))
        ops.push(supabase.from('a_cuenta').delete().eq('distribuidor_id',dist.id))
      })
    }

    await Promise.all(ops)

    await supabase.from('almacenes').update({
      stock_actual:0, balones_vacios:0,
      vacios_5kg:0, vacios_10kg:0, vacios_45kg:0,
      balones_pendientes_devolucion:0,
      updated_at:new Date().toISOString()
    }).eq('id',id)

    setLimpiandoPrueba(false); setDeleteConfirm(null)
    alert('Datos de prueba de '+almacen.nombre+' eliminados.')
    cargar()
  }, [cargar])

  const stockBajos = almacenes.filter(a => (a.stock_actual||0) < UMBRAL_BAJO && !a.es_prueba)
  const totalBalones = almacenes.reduce((s,a) => s+(a.stock_actual||0), 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--app-text)',margin:0}}>Almacenes</h2>
          <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Gestión de almacenes y stock</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary"><Plus className="w-4 h-4"/>Nuevo almacén</button>
      </div>

      {/* Alerta stock bajo */}
      {stockBajos.length>0 && (
        <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'12px 16px'}}>
          <AlertTriangle style={{width:18,height:18,color:'#f87171',flexShrink:0}}/>
          <div>
            <p style={{fontSize:13,fontWeight:600,color:'#f87171',margin:0}}>Stock bajo en {stockBajos.length} almacén{stockBajos.length>1?'es':''}</p>
            <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>
              {stockBajos.map(a=>`${a.nombre}: ${a.stock_actual} bal.`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'14px 16px'}}>
          <div style={{width:36,height:36,background:'color-mix(in srgb, var(--app-accent) 12%, transparent)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
            <Warehouse style={{width:16,height:16,color:'var(--app-accent)'}}/>
          </div>
          <p style={{fontSize:22,fontWeight:700,color:'var(--app-text)',margin:0}}>{almacenes.length}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Almacenes activos</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:12,padding:'14px 16px'}}>
          <div style={{width:36,height:36,background:'rgba(34,197,94,0.12)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
            <Package style={{width:16,height:16,color:'#22c55e'}}/>
          </div>
          <p style={{fontSize:22,fontWeight:700,color:'var(--app-text)',margin:0}}>{totalBalones}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Balones en total</p>
        </div>
      </div>

      {/* Aviso prueba */}
      {almacenes.some(a=>a.es_prueba)&&(
        <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(168,85,247,0.08)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:10,padding:'12px 16px'}}>
          <TestTube style={{width:16,height:16,color:'#a855f7',flexShrink:0}}/>
          <p style={{fontSize:12,color:'#a855f7',margin:0}}>
            Tienes almacenes en <span style={{fontWeight:600}}>modo prueba</span>. Usa el botón Limpiar cuando termines.
          </p>
        </div>
      )}

      {/* Lista */}
      <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)'}}>
          <h3 style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>Lista de almacenes</h3>
        </div>

        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:120,color:'var(--app-text-secondary)',fontSize:13}}>Cargando...</div>
        ):(
          <>
          {/* Móvil */}
          <div className="lg:hidden">
            {almacenes.map(a => {
              const s5=getStockTipo(a.id,'5kg'), s10=getStockTipo(a.id,'10kg'), s45=getStockTipo(a.id,'45kg')
              const bajo = (a.stock_actual||0) < UMBRAL_BAJO
              return(
                <div key={a.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--app-card-border)',background:bajo?'rgba(239,68,68,0.04)':'transparent'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:34,height:34,borderRadius:8,background:a.es_prueba?'rgba(168,85,247,0.12)':'color-mix(in srgb, var(--app-accent) 12%, transparent)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {a.es_prueba?<TestTube style={{width:16,height:16,color:'#a855f7'}}/>:<Warehouse style={{width:16,height:16,color:'var(--app-accent)'}}/>}
                      </div>
                      <div>
                        <p style={{color:'var(--app-text)',fontWeight:600,fontSize:14,margin:0}}>{a.nombre}</p>
                        <p style={{color:'var(--app-text-secondary)',fontSize:11,margin:0}}>{a.responsable} · {a.ubicacion}</p>
                      </div>
                    </div>
                    <span style={{fontSize:14,fontWeight:700,color:(a.stock_actual||0)>50?'#22c55e':(a.stock_actual||0)>10?'#eab308':'#f87171'}}>
                      {a.stock_actual||0} bal.
                    </span>
                  </div>
                  {/* Stock por tipo */}
                  <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
                    {s5>0&&<span style={{fontSize:11,background:'rgba(59,130,246,0.1)',color:'#60a5fa',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(59,130,246,0.25)'}}>5kg: {s5}</span>}
                    {s10>0&&<span style={{fontSize:11,background:'rgba(234,179,8,0.1)',color:'#eab308',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(234,179,8,0.25)'}}>10kg: {s10}</span>}
                    {s45>0&&<span style={{fontSize:11,background:'rgba(239,68,68,0.1)',color:'#f87171',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(239,68,68,0.25)'}}>45kg: {s45}</span>}
                    {bajo&&<span style={{fontSize:11,background:'rgba(239,68,68,0.1)',color:'#f87171',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(239,68,68,0.25)'}}>⚠️ Stock bajo</span>}
                  </div>
                  {/* Vacíos */}
                  {(a.balones_vacios||0)>0&&(
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 8px'}}>⚪ Vacíos: {a.balones_vacios}</p>
                  )}
                  <div style={{display:'flex',gap:6}}>
                    {a.es_prueba&&(
                      <button onClick={()=>setDeleteConfirm({...a,modo:'limpiar'})} style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid rgba(168,85,247,0.3)',background:'rgba(168,85,247,0.1)',color:'#a855f7',fontSize:11,cursor:'pointer'}}>
                        Limpiar datos
                      </button>
                    )}
                    <button onClick={()=>abrirEditar(a)} style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid var(--app-card-border)',background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',fontSize:11,cursor:'pointer'}}>
                      ✏️ Editar
                    </button>
                    <button onClick={()=>setDeleteConfirm({...a,modo:'eliminar'})} style={{padding:'7px 12px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:11,cursor:'pointer'}}>
                      🗑️
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
                {['Almacén','Responsable','Ubicación','🟢 Stock total','📦 Por tipo','⚪ Vacíos','Acciones'].map(h=>(
                  <th key={h} className="text-left text-xs font-semibold uppercase px-5 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {almacenes.map(a=>{
                  const s5=getStockTipo(a.id,'5kg'), s10=getStockTipo(a.id,'10kg'), s45=getStockTipo(a.id,'45kg')
                  const bajo=(a.stock_actual||0)<UMBRAL_BAJO
                  return(
                    <tr key={a.id} className="table-row-hover" style={{background:bajo?'rgba(239,68,68,0.03)':a.es_prueba?'rgba(168,85,247,0.03)':'transparent'}}>
                      <td className="px-5 py-4">
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:32,height:32,borderRadius:8,background:a.es_prueba?'rgba(168,85,247,0.12)':'color-mix(in srgb, var(--app-accent) 12%, transparent)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {a.es_prueba?<TestTube style={{width:14,height:14,color:'#a855f7'}}/>:<Warehouse style={{width:14,height:14,color:'var(--app-accent)'}}/>}
                          </div>
                          <div>
                            <p style={{color:'var(--app-text)',fontWeight:500,fontSize:13,margin:0}}>{a.nombre}</p>
                            {a.es_prueba&&<span style={{fontSize:10,background:'rgba(168,85,247,0.12)',color:'#a855f7',padding:'1px 6px',borderRadius:20,border:'1px solid rgba(168,85,247,0.3)'}}>Prueba</span>}
                            {bajo&&<span style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#f87171',padding:'1px 6px',borderRadius:20,border:'1px solid rgba(239,68,68,0.3)',marginLeft:4}}>⚠️ Stock bajo</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{color:'var(--app-text-secondary)'}}>{a.responsable}</td>
                      <td className="px-5 py-4 text-sm" style={{color:'var(--app-text-secondary)'}}>{a.ubicacion}</td>
                      <td className="px-5 py-4">
                        <span style={{fontSize:16,fontWeight:700,color:(a.stock_actual||0)>50?'#22c55e':(a.stock_actual||0)>10?'#eab308':'#f87171'}}>
                          {a.stock_actual||0} bal.
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {s5>0&&<span style={{fontSize:11,background:'rgba(59,130,246,0.1)',color:'#60a5fa',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(59,130,246,0.25)'}}>5kg:{s5}</span>}
                          {s10>0&&<span style={{fontSize:11,background:'rgba(234,179,8,0.1)',color:'#eab308',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(234,179,8,0.25)'}}>10kg:{s10}</span>}
                          {s45>0&&<span style={{fontSize:11,background:'rgba(239,68,68,0.1)',color:'#f87171',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(239,68,68,0.25)'}}>45kg:{s45}</span>}
                          {s5===0&&s10===0&&s45===0&&<span style={{color:'var(--app-text-secondary)',fontSize:11}}>—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold" style={{color:'var(--app-text-secondary)'}}>{a.balones_vacios||0}</td>
                      <td className="px-5 py-4">
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          {a.es_prueba&&(
                            <button onClick={()=>setDeleteConfirm({...a,modo:'limpiar'})} style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid rgba(168,85,247,0.3)',background:'rgba(168,85,247,0.1)',color:'#a855f7',cursor:'pointer'}}>
                              Limpiar
                            </button>
                          )}
                          <button onClick={()=>abrirEditar(a)} style={{color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4}}><Edit2 style={{width:15,height:15}}/></button>
                          <button onClick={()=>setDeleteConfirm({...a,modo:'eliminar'})} style={{color:'var(--app-text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4}}><Trash2 style={{width:15,height:15}}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Modal nuevo/editar */}
      {modal&&(
        <Modal title={editId?'Editar almacén':'Nuevo almacén'} onClose={()=>setModal(false)}>
          <div className="space-y-4">
            {error&&<div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16}}/>{error}</div>}
            {[['nombre','Nombre del almacén','Ej: Tienda Principal'],['responsable','Responsable','Nombre del encargado'],['ubicacion','Ubicación','Dirección o zona']].map(([key,label,ph])=>(
              <div key={key}>
                <label className="label">{label}</label>
                <input className="input" placeholder={ph} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>
              </div>
            ))}
            <div onClick={()=>setForm(f=>({...f,es_prueba:!f.es_prueba}))} style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderRadius:10,border:form.es_prueba?'1px solid rgba(168,85,247,0.5)':'1px solid var(--app-card-border)',background:form.es_prueba?'rgba(168,85,247,0.08)':'var(--app-card-bg-alt)',padding:'12px 14px',cursor:'pointer',transition:'all 0.15s'}}>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:form.es_prueba?'#a855f7':'var(--app-text)',margin:0}}>Almacén de prueba</p>
                <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Permite limpiar todos sus datos con un solo botón</p>
              </div>
              <div style={{width:36,height:20,borderRadius:10,background:form.es_prueba?'#a855f7':'var(--app-card-border)',position:'relative',transition:'background 0.15s',flexShrink:0}}>
                <div style={{width:14,height:14,background:'white',borderRadius:'50%',position:'absolute',top:3,left:form.es_prueba?19:3,transition:'left 0.15s'}}/>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmar */}
      {deleteConfirm&&(
        <Modal title={deleteConfirm.modo==='limpiar'?'Limpiar datos de prueba':'Eliminar almacén'} onClose={()=>setDeleteConfirm(null)}>
          {deleteConfirm.modo==='limpiar'?(
            <div className="space-y-4">
              <div style={{background:'rgba(168,85,247,0.08)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:10,padding:'14px'}}>
                <p style={{color:'var(--app-text)',fontWeight:600,margin:'0 0 6px'}}>{deleteConfirm.nombre}</p>
                <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:'0 0 6px'}}>Se eliminarán todos los registros generados con este almacén.</p>
                <p style={{fontSize:12,color:'#22c55e',margin:0}}>El almacén seguirá activo con stock en 0.</p>
              </div>
              <p style={{fontSize:12,color:'#f87171'}}>Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={()=>limpiarPrueba(deleteConfirm)} disabled={limpiandoPrueba} style={{flex:1,background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'8px',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                  {limpiandoPrueba?'Limpiando...':'Confirmar limpieza'}
                </button>
              </div>
            </div>
          ):(
            <div className="space-y-4">
              <p style={{fontSize:13,color:'var(--app-text-secondary)'}}>¿Eliminar <span style={{color:'var(--app-text)',fontWeight:600}}>{deleteConfirm.nombre}</span>?</p>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={()=>eliminar(deleteConfirm.id)} className="btn-danger flex-1 justify-center">Eliminar</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
