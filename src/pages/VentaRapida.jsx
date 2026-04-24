import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { X, ChevronDown, ChevronUp, Search, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ─── Teclado numérico ─────────────────────────────────────────────────────────
function NumPad({ value, onChange }) {
  const teclas = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']
  const handleTecla = (t) => {
    if(t === '⌫') { onChange(value.length > 1 ? value.slice(0,-1) : '0'); return }
    if(t === '✓') return
    if(value === '0') { onChange(t); return }
    if(value.length >= 3) return
    onChange(value + t)
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
      {teclas.map((t,i) => (
        <button key={i} onClick={() => handleTecla(t)} style={{
          padding:'14px', borderRadius:10, fontSize:18, fontWeight:600,
          background: t==='✓' ? 'var(--app-accent)' : t==='⌫' ? 'rgba(239,68,68,0.1)' : 'var(--app-card-bg-alt)',
          color: t==='✓' ? '#fff' : t==='⌫' ? '#f87171' : 'var(--app-text)',
          border: '1px solid var(--app-card-border)',
          cursor:'pointer', transition:'all 0.1s',
        }}>{t}</button>
      ))}
    </div>
  )
}

// ─── VentaRapida ──────────────────────────────────────────────────────────────
export default function VentaRapida({ onClose, onGuardado, almacenes, precioTipos, preciosPorTipo, stockPorTipo, clientes: clientesProp, distribuidores, lotesDistribuidor, onAbrirDetallado }) {
  const { perfil } = useAuth()

  // Estado del formulario
  const [precioTipoId, setPrecioTipoId] = useState('')
  const [tipoBalon, setTipoBalon] = useState('10kg')
  const [cantidad, setCantidad] = useState('1')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('Varios')
  const [almacenId, setAlmacenId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [modoCliente, setModoCliente] = useState('rapido') // 'rapido' | 'buscar'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [precioManual, setPrecioManual] = useState('')
  const [mostrarAlmacen, setMostrarAlmacen] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({ nombre:'', telefono:'' })
  const [modoNuevo, setModoNuevo] = useState(false)
  const [deudaCliente, setDeudaCliente] = useState(null)

  // Inicializar almacén y tipo precio
  useEffect(() => {
    const almDefault = perfil?.almacen_id
      ? almacenes.find(a => a.id === perfil.almacen_id)
      : almacenes.find(a => a.nombre?.toLowerCase().includes('tienda')) || almacenes[0]
    if(almDefault) setAlmacenId(almDefault.id)
    const primerTipo = precioTipos.find(t => t.nombre.toLowerCase().includes('general')) || precioTipos[0]
    if(primerTipo) setPrecioTipoId(primerTipo.id)
  }, [almacenes, precioTipos, perfil])

  // Precio automático según tipo cliente y balón
  const precioAuto = useMemo(() => {
    const p = preciosPorTipo.find(p => p.precio_tipo_id === precioTipoId && p.tipo_balon === tipoBalon)
    return p?.precio || ''
  }, [preciosPorTipo, precioTipoId, tipoBalon])

  const precioFinal = precioManual || precioAuto

  // Stock del almacén/tipo
  const getStock = useCallback((tipo) => {
    const dist = distribuidores.find(d => d.almacen_id === almacenId)
    if(dist) {
      return lotesDistribuidor.filter(l => l.distribuidor_id===dist.id && l.tipo_balon===tipo && !l.cerrado && l.cantidad_restante>0).reduce((s,l)=>s+l.cantidad_restante,0)
    }
    return stockPorTipo.find(s => s.almacen_id===almacenId && s.tipo_balon===tipo)?.stock_actual || 0
  }, [almacenId, distribuidores, lotesDistribuidor, stockPorTipo])

  const stockActual = getStock(tipoBalon)
  const total = (parseInt(cantidad)||0) * (parseFloat(precioFinal)||0)

  // Buscar clientes
  const clientesFiltrados = useMemo(() => {
    if(!busqueda) return []
    return clientesProp.filter(c => !c.es_varios && (
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.telefono && c.telefono.includes(busqueda))
    )).slice(0,5)
  }, [clientesProp, busqueda])

  // Clientes frecuentes (no varios, ordenados)
  const clientesFrecuentes = useMemo(() =>
    clientesProp.filter(c => !c.es_varios && c.tipo !== 'general').slice(0,6)
  , [clientesProp])

  // Buscar deuda cuando se selecciona cliente
  const verificarDeuda = useCallback(async (cliId, cliNombre) => {
    if(!cliId || cliNombre === 'Varios') { setDeudaCliente(null); return }
    const { data } = await supabase.from('deudas').select('monto_pendiente,balones_pendiente').in('estado',['activa','pagada_parcial']).eq('cliente_id', cliId).maybeSingle()
    setDeudaCliente(data || null)
  }, [])

  const selCliente = useCallback((id, nombre) => {
    setClienteId(id); setClienteNombre(nombre)
    setBusqueda(''); setModoCliente('rapido')
    verificarDeuda(id, nombre)
  }, [verificarDeuda])

  const selVarios = useCallback(() => {
    const v = clientesProp.find(c => c.es_varios)
    setClienteId(v?.id || ''); setClienteNombre('Varios')
    setDeudaCliente(null); setModoCliente('rapido')
  }, [clientesProp])

  // Registrar cliente nuevo rápido
  const registrarNuevo = useCallback(async () => {
    if(!nuevoCli.nombre.trim()) return
    const { data:nc } = await supabase.from('clientes').insert({ nombre:nuevoCli.nombre, telefono:nuevoCli.telefono, tipo:'general' }).select().maybeSingle()
    if(nc) { selCliente(nc.id, nc.nombre) }
    setNuevoCli({nombre:'',telefono:''}); setModoNuevo(false)
  }, [nuevoCli, selCliente])

  // FIFO para distribuidores
  const aplicarFIFO = useCallback(async (distId, tipo, cant) => {
    const { data:lotes } = await supabase.from('lotes_distribuidor').select('*').eq('distribuidor_id',distId).eq('tipo_balon',tipo).eq('cerrado',false).gt('cantidad_restante',0).order('fecha',{ascending:true})
    if(!lotes?.length) return
    let rest = cant
    for(const lote of lotes) {
      if(rest<=0) break
      const desc = Math.min(rest, lote.cantidad_restante)
      await supabase.from('lotes_distribuidor').update({ cantidad_vendida:lote.cantidad_vendida+desc, cantidad_restante:lote.cantidad_restante-desc, cerrado:lote.cantidad_restante-desc<=0 }).eq('id',lote.id)
      rest -= desc
    }
  }, [])

  // GUARDAR
  const guardar = useCallback(async () => {
    const cant = parseInt(cantidad)
    const precio = parseFloat(precioFinal)
    if(!cant || cant <= 0) { setError('Ingresa la cantidad'); return }
    if(!precio || precio <= 0) { setError('El precio no puede ser cero'); return }
    if(!almacenId) { setError('Selecciona un almacén'); return }
    if(stockActual < cant) { setError(`Stock insuficiente. Disponible: ${stockActual}`); return }

    setSaving(true); setError('')
    const campoVacios = tipoBalon==='5kg'?'vacios_5kg':tipoBalon==='45kg'?'vacios_45kg':'vacios_10kg'
    const dist = distribuidores.find(d => d.almacen_id === almacenId)

    const { error:e } = await supabase.from('ventas').insert({
      cliente_id: clienteId || null,
      almacen_id: almacenId,
      precio_tipo_id: precioTipoId || null,
      tipo_balon: tipoBalon,
      fecha: hoyPeru() + 'T12:00:00-05:00',
      cantidad: cant,
      precio_unitario: precio,
      metodo_pago: metodoPago,
      usuario_id: perfil?.id || null,
    })
    if(e) { setError(e.message); setSaving(false); return }

    // Actualizar stock
    if(dist) {
      await aplicarFIFO(dist.id, tipoBalon, cant)
      const { data:lotesActivos } = await supabase.from('lotes_distribuidor').select('cantidad_restante').eq('distribuidor_id',dist.id).eq('cerrado',false)
      const totalRest = (lotesActivos||[]).reduce((s,l)=>s+(l.cantidad_restante||0),0)
      const { data:almDist } = await supabase.from('almacenes').select('balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',almacenId).single()
      await supabase.from('almacenes').update({ stock_actual:totalRest, balones_vacios:(almDist?.balones_vacios||0)+cant, [campoVacios]:(almDist?.[campoVacios]||0)+cant }).eq('id',almacenId)
    } else {
      const spt = stockPorTipo.find(s => s.almacen_id===almacenId && s.tipo_balon===tipoBalon)
      const { data:alm } = await supabase.from('almacenes').select('stock_actual,balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id',almacenId).single()
      await Promise.all([
        spt ? supabase.from('stock_por_tipo').update({ stock_actual:Math.max(0,(spt.stock_actual||0)-cant) }).eq('almacen_id',almacenId).eq('tipo_balon',tipoBalon) : Promise.resolve(),
        alm ? supabase.from('almacenes').update({ stock_actual:Math.max(0,(alm.stock_actual||0)-cant), balones_vacios:(alm.balones_vacios||0)+cant, [campoVacios]:(alm[campoVacios]||0)+cant }).eq('id',almacenId) : Promise.resolve()
      ])
    }

    setSaving(false)
    // Resetear para siguiente venta rápida — no cerrar
    setCantidad('1'); setMetodoPago('efectivo')
    selVarios(); setPrecioManual('')
    onGuardado()
  }, [cantidad, precioFinal, almacenId, stockActual, tipoBalon, clienteId, precioTipoId, metodoPago, perfil, distribuidores, stockPorTipo, aplicarFIFO, selVarios, onGuardado])

  const TIPOS_BALON = ['5kg','10kg','45kg']
  const METODOS = [['efectivo','💵'],['yape','📱'],['vale','🎫'],['transferencia','🏦']]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:'rgba(0,0,0,0.75)'}}>
      <div style={{
        background:'var(--app-card-bg)', border:'1px solid var(--app-card-border)',
        borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480,
        borderRadius: window.innerWidth >= 640 ? 16 : '20px 20px 0 0',
        maxHeight:'95vh', overflowY:'auto',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.4)'
      }}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--app-card-border)',position:'sticky',top:0,background:'var(--app-card-bg)',zIndex:10}}>
          <div>
            <p style={{fontSize:15,fontWeight:700,color:'var(--app-text)',margin:0}}>⚡ Venta rápida</p>
            <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>
              {clienteNombre} · {tipoBalon} · S/{precioFinal||'?'}/bal
            </p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onAbrirDetallado} style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',color:'var(--app-text-secondary)',cursor:'pointer'}}>
              Modo detallado
            </button>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}><X style={{width:20,height:20}}/></button>
          </div>
        </div>

        <div style={{padding:'16px 20px'}} className="space-y-4">

          {/* Error */}
          {error && (
            <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#f87171'}}>
              {error}
            </div>
          )}

          {/* Alerta deuda */}
          {deudaCliente && (
            <div style={{background:'rgba(251,146,60,0.08)',border:'1px solid rgba(251,146,60,0.3)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#fb923c'}}>
              ⚠️ {clienteNombre} tiene deuda activa — {deudaCliente.monto_pendiente>0?`S/${parseFloat(deudaCliente.monto_pendiente).toLocaleString()} pendiente`:''}
              {deudaCliente.balones_pendiente>0?` · ${deudaCliente.balones_pendiente} bal. a devolver`:''}
            </div>
          )}

          {/* CLIENTE */}
          <div>
            <p style={{fontSize:12,fontWeight:600,color:'var(--app-text-secondary)',marginBottom:8}}>CLIENTE</p>

            {/* Botones rápidos */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
              {/* Varios */}
              <button onClick={selVarios} style={{
                padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',transition:'all 0.15s',
                background:clienteNombre==='Varios'?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                border:clienteNombre==='Varios'?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                color:clienteNombre==='Varios'?'var(--app-accent)':'var(--app-text-secondary)'
              }}>Varios</button>
              {/* Clientes frecuentes (mayoristas, restaurantes) */}
              {clientesFrecuentes.map(c => (
                <button key={c.id} onClick={()=>selCliente(c.id,c.nombre)} style={{
                  padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',transition:'all 0.15s',
                  background:clienteId===c.id?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                  border:clienteId===c.id?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                  color:clienteId===c.id?'var(--app-accent)':'var(--app-text-secondary)'
                }}>{c.nombre}</button>
              ))}
              {/* Buscar */}
              <button onClick={()=>setModoCliente(modoCliente==='buscar'?'rapido':'buscar')} style={{
                padding:'7px 12px',borderRadius:20,fontSize:12,cursor:'pointer',
                background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',
                color:'var(--app-text-secondary)',display:'flex',alignItems:'center',gap:4
              }}>
                <Search style={{width:12,height:12}}/>Buscar
              </button>
            </div>

            {/* Buscador */}
            {modoCliente==='buscar' && (
              <div style={{position:'relative'}}>
                <input className="input" placeholder="Nombre o teléfono..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} autoFocus style={{fontSize:13}}/>
                {clientesFiltrados.length>0 && (
                  <div style={{position:'absolute',zIndex:99,background:'var(--app-modal-bg)',border:'1px solid var(--app-card-border)',borderRadius:8,width:'100%',top:'calc(100% + 4px)',overflow:'hidden'}}>
                    {clientesFiltrados.map(c=>(
                      <button key={c.id} onClick={()=>selCliente(c.id,c.nombre)} style={{width:'100%',textAlign:'left',padding:'9px 12px',fontSize:13,color:'var(--app-text)',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--app-card-bg-alt)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <span>{c.nombre}</span>
                        <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>{c.tipo}{c.telefono?` · ${c.telefono}`:''}</span>
                      </button>
                    ))}
                    <button onClick={()=>setModoNuevo(true)} style={{width:'100%',textAlign:'left',padding:'9px 12px',fontSize:12,color:'var(--app-accent)',background:'color-mix(in srgb, var(--app-accent) 5%, transparent)',border:'none',borderTop:'1px solid var(--app-card-border)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                      <Plus style={{width:12,height:12}}/>Registrar "{busqueda}" como nuevo cliente
                    </button>
                  </div>
                )}
                {busqueda && clientesFiltrados.length===0 && (
                  <button onClick={()=>setModoNuevo(true)} style={{marginTop:4,width:'100%',textAlign:'left',padding:'9px 12px',fontSize:12,color:'var(--app-accent)',background:'color-mix(in srgb, var(--app-accent) 5%, transparent)',border:'1px solid color-mix(in srgb, var(--app-accent) 20%, transparent)',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                    <Plus style={{width:12,height:12}}/>Registrar "{busqueda}" como nuevo cliente
                  </button>
                )}
              </div>
            )}

            {/* Registro rápido nuevo cliente */}
            {modoNuevo && (
              <div style={{background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',borderRadius:10,padding:'12px',marginTop:8}} className="space-y-2">
                <p style={{fontSize:12,fontWeight:600,color:'var(--app-text)',margin:'0 0 8px'}}>Nuevo cliente</p>
                <input className="input" placeholder="Nombre *" value={nuevoCli.nombre} onChange={e=>setNuevoCli(f=>({...f,nombre:e.target.value}))} style={{fontSize:13}} autoFocus/>
                <input className="input" placeholder="Teléfono (opcional)" value={nuevoCli.telefono} onChange={e=>setNuevoCli(f=>({...f,telefono:e.target.value}))} style={{fontSize:13}}/>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setModoNuevo(false)} className="btn-secondary flex-1" style={{fontSize:12}}>Cancelar</button>
                  <button onClick={registrarNuevo} disabled={!nuevoCli.nombre} className="btn-primary flex-1 justify-center" style={{fontSize:12}}>✓ Registrar</button>
                </div>
              </div>
            )}
          </div>

          {/* TIPO BALÓN */}
          <div>
            <p style={{fontSize:12,fontWeight:600,color:'var(--app-text-secondary)',marginBottom:8}}>TIPO DE BALÓN</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {TIPOS_BALON.map(tipo => {
                const stock = getStock(tipo)
                return (
                  <button key={tipo} onClick={()=>{setTipoBalon(tipo);setPrecioManual('')}} style={{
                    padding:'12px 8px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',transition:'all 0.15s',
                    background:tipoBalon===tipo?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                    border:tipoBalon===tipo?'2px solid var(--app-accent)':'1px solid var(--app-card-border)',
                    color:tipoBalon===tipo?'var(--app-accent)':'var(--app-text-secondary)'
                  }}>
                    🔵 {tipo}
                    <br/>
                    <span style={{fontSize:11,color:stock===0?'#f87171':stock<5?'#eab308':'#22c55e',fontWeight:400}}>{stock} bal.</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* TIPO PRECIO / CLIENTE */}
          <div>
            <p style={{fontSize:12,fontWeight:600,color:'var(--app-text-secondary)',marginBottom:8}}>TIPO DE PRECIO</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {precioTipos.map(t => {
                const precio = preciosPorTipo.find(p=>p.precio_tipo_id===t.id&&p.tipo_balon===tipoBalon)?.precio || t.precio
                return (
                  <button key={t.id} onClick={()=>{setPrecioTipoId(t.id);setPrecioManual('')}} style={{
                    padding:'8px 14px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',transition:'all 0.15s',
                    background:precioTipoId===t.id?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                    border:precioTipoId===t.id?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                    color:precioTipoId===t.id?'var(--app-accent)':'var(--app-text-secondary)'
                  }}>
                    {t.nombre} · <span style={{fontWeight:700}}>S/{precio}</span>
                  </button>
                )
              })}
              {/* Precio manual */}
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>S/</span>
                <input type="number" min="0" step="0.5" className="input" style={{width:70,padding:'6px 8px',fontSize:13,textAlign:'center'}} placeholder="Otro" value={precioManual} onChange={e=>setPrecioManual(e.target.value)}/>
              </div>
            </div>
          </div>

          {/* CANTIDAD */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <p style={{fontSize:12,fontWeight:600,color:'var(--app-text-secondary)',margin:0}}>CANTIDAD</p>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button onClick={()=>setCantidad(c=>String(Math.max(1,parseInt(c)-1)))} style={{width:32,height:32,borderRadius:8,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',color:'var(--app-text)',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                <span style={{fontSize:28,fontWeight:700,color:'var(--app-text)',minWidth:40,textAlign:'center'}}>{cantidad}</span>
                <button onClick={()=>setCantidad(c=>String(Math.min(stockActual,parseInt(c)+1)))} style={{width:32,height:32,borderRadius:8,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',color:'var(--app-text)',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
              </div>
            </div>
            {/* Botones rápidos cantidad */}
            <div style={{display:'flex',gap:6,marginBottom:8}}>
              {[1,2,3,5,10].map(n=>(
                <button key={n} onClick={()=>setCantidad(String(n))} style={{
                  flex:1,padding:'8px 4px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.1s',
                  background:cantidad===String(n)?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                  border:cantidad===String(n)?'1px solid var(--app-accent)':'1px solid var(--app-card-border)',
                  color:cantidad===String(n)?'var(--app-accent)':'var(--app-text-secondary)'
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* MÉTODO DE PAGO */}
          <div>
            <p style={{fontSize:12,fontWeight:600,color:'var(--app-text-secondary)',marginBottom:8}}>MÉTODO DE PAGO</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {METODOS.map(([val,icon])=>(
                <button key={val} onClick={()=>setMetodoPago(val)} style={{
                  padding:'10px 4px',borderRadius:10,fontSize:11,fontWeight:500,cursor:'pointer',textAlign:'center',transition:'all 0.15s',
                  background:metodoPago===val?'color-mix(in srgb, var(--app-accent) 15%, transparent)':'var(--app-card-bg-alt)',
                  border:metodoPago===val?'2px solid var(--app-accent)':'1px solid var(--app-card-border)',
                  color:metodoPago===val?'var(--app-accent)':'var(--app-text-secondary)'
                }}>
                  <div style={{fontSize:18,marginBottom:2}}>{icon}</div>
                  <span style={{textTransform:'capitalize'}}>{val}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Almacén (colapsable) */}
          <div>
            <button onClick={()=>setMostrarAlmacen(!mostrarAlmacen)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)',fontSize:12,padding:0}}>
              {mostrarAlmacen?<ChevronUp style={{width:14,height:14}}/>:<ChevronDown style={{width:14,height:14}}/>}
              Almacén: {almacenes.find(a=>a.id===almacenId)?.nombre||'—'}
            </button>
            {mostrarAlmacen&&(
              <select className="input mt-2" value={almacenId} onChange={e=>setAlmacenId(e.target.value)} style={{fontSize:13}}>
                {almacenes.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            )}
          </div>

          {/* BOTÓN REGISTRAR */}
          <div style={{position:'sticky',bottom:0,background:'var(--app-card-bg)',paddingTop:12,marginTop:4}}>
            {total>0&&<p style={{fontSize:13,color:'var(--app-text-secondary)',textAlign:'center',margin:'0 0 8px'}}>Total: <span style={{fontWeight:700,color:'var(--app-text)',fontSize:16}}>S/{total.toLocaleString('es-PE',{maximumFractionDigits:2})}</span></p>}
            <button onClick={guardar} disabled={saving||stockActual<(parseInt(cantidad)||0)} style={{
              width:'100%',padding:'16px',borderRadius:12,fontSize:16,fontWeight:700,
              background:saving||stockActual<(parseInt(cantidad)||0)?'var(--app-card-bg-alt)':'var(--app-accent)',
              color:saving||stockActual<(parseInt(cantidad)||0)?'var(--app-text-secondary)':'#fff',
              border:'none',cursor:saving?'wait':'pointer',transition:'all 0.15s',
              boxShadow:saving?'none':'0 4px 12px color-mix(in srgb, var(--app-accent) 30%, transparent)'
            }}>
              {saving?'Registrando...':`✓ Registrar · ${parseInt(cantidad)||0} bal. · S/${total.toLocaleString('es-PE',{maximumFractionDigits:0})}`}
            </button>
            {stockActual<(parseInt(cantidad)||0)&&<p style={{fontSize:11,color:'#f87171',textAlign:'center',margin:'6px 0 0'}}>Stock insuficiente — solo hay {stockActual} balones</p>}
          </div>

        </div>
      </div>
    </div>
  )
}
