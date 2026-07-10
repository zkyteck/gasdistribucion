// src/pages/Compras.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { hoyPeru } from '../lib/fechas'
import { ShoppingBag, Plus, X, AlertCircle, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Modal from '../components/Modal'

const TIPOS = ['10kg', '5kg', '45kg']


export default function Compras() {
  const { perfil } = useAuth()
  const [compras, setCompras] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(null)

  const emptyForm = {
    fecha: hoyPeru(),
    notas: '',
    precios: { '10kg': '', '5kg': '', '45kg': '' },
    distribucion: [],
    vaciosEntregados: [], // [{almacen_id, tipo_balon, cantidad}] — si no hay entrada, se asume = a lo comprado (1:1)
  }
  const [form, setForm] = useState(emptyForm)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('compras')
      .select('*, compra_detalles(*, almacenes(nombre))')
      .order('fecha', { ascending: false })
    setCompras(data || [])
    setLoading(false)
  }, [])

  const cargarAlmacenes = useCallback(async () => {
    const { data } = await supabase.from('almacenes').select('id,nombre').eq('activo', true).order('nombre')
    setAlmacenes(data || [])
  }, [])

  useEffect(() => { cargar(); cargarAlmacenes() }, [cargar, cargarAlmacenes])

  // ─── Distribución ──────────────────────────────────────────────────────────
  const setDistribucion = (almacenId, tipo, cantidad) => {
    setForm(f => {
      const dist = f.distribucion.filter(d => !(d.almacen_id === almacenId && d.tipo_balon === tipo))
      if (parseInt(cantidad) > 0) dist.push({ almacen_id: almacenId, tipo_balon: tipo, cantidad: parseInt(cantidad) })
      return { ...f, distribucion: dist }
    })
  }

  const getDistribucion = (almacenId, tipo) => {
    const found = form.distribucion.find(d => d.almacen_id === almacenId && d.tipo_balon === tipo)
    return found?.cantidad || ''
  }

  // ─── Vacíos entregados a cambio (por defecto 1:1 con lo comprado, editable) ─
  const setVaciosEntregados = (almacenId, tipo, cantidad) => {
    setForm(f => {
      const arr = f.vaciosEntregados.filter(v => !(v.almacen_id === almacenId && v.tipo_balon === tipo))
      if (cantidad !== '' && cantidad !== null) arr.push({ almacen_id: almacenId, tipo_balon: tipo, cantidad: parseInt(cantidad) || 0 })
      return { ...f, vaciosEntregados: arr }
    })
  }
  const getVaciosEntregados = (almacenId, tipo) => {
    const found = form.vaciosEntregados.find(v => v.almacen_id === almacenId && v.tipo_balon === tipo)
    if (found) return found.cantidad
    return getDistribucion(almacenId, tipo) // por defecto: trueque 1:1 con lo comprado
  }

  // ─── Totales ───────────────────────────────────────────────────────────────
  const calcularTotales = () => {
    let totalBalones = 0
    let totalInvertido = 0
    form.distribucion.forEach(d => {
      const precio = parseFloat(form.precios[d.tipo_balon]) || 0
      totalBalones += d.cantidad
      totalInvertido += d.cantidad * precio
    })
    return { totalBalones, totalInvertido }
  }

  // ─── Guardar compra ────────────────────────────────────────────────────────
  const guardarCompra = async () => {
    if (!form.fecha) { setError('Ingresa la fecha'); return }
    if (form.distribucion.length === 0) { setError('Agrega al menos un balón en la distribución'); return }

    const tiposUsados = [...new Set(form.distribucion.map(d => d.tipo_balon))]
    for (const tipo of tiposUsados) {
      if (!form.precios[tipo] || parseFloat(form.precios[tipo]) <= 0) {
        setError(`Ingresa el precio de compra para ${tipo}`); return
      }
    }

    setSaving(true); setError('')
    const { totalBalones, totalInvertido } = calcularTotales()

    // Insertar compra principal
    const { data: compra, error: e1 } = await supabase.from('compras').insert({
      fecha: form.fecha,
      cantidad_total: totalBalones,
      monto_total: totalInvertido,
      monto_amortizado: 0,
      monto_pendiente: totalInvertido,
      estado_pago: 'pendiente',
      notas: form.notas || null,
      usuario_id: perfil?.id || null,
      precio_unitario: totalBalones > 0 ? parseFloat((totalInvertido / totalBalones).toFixed(2)) : 0,
    }).select().single()

    if (e1) { setError(e1.message); setSaving(false); return }

    // Insertar detalles
    const detalles = form.distribucion.map(d => ({
      compra_id: compra.id,
      almacen_id: d.almacen_id,
      tipo_balon: d.tipo_balon,
      cantidad: d.cantidad,
      precio_unitario: parseFloat(form.precios[d.tipo_balon]) || 0,
      vacios_entregados: getVaciosEntregados(d.almacen_id, d.tipo_balon),
    }))

    const { error: e2 } = await supabase.from('compra_detalles').insert(detalles)
    if (e2) { setError(e2.message); setSaving(false); return }

    // Actualizar stock en almacenes
    const porAlmacen = {}
    form.distribucion.forEach(d => {
      if (!porAlmacen[d.almacen_id]) porAlmacen[d.almacen_id] = 0
      porAlmacen[d.almacen_id] += d.cantidad
    })

    await Promise.all(
      Object.entries(porAlmacen).map(async ([almId, cant]) => {
        const { data: alm } = await supabase.from('almacenes').select('stock_actual').eq('id', almId).single()
        await supabase.from('almacenes').update({
          stock_actual: (alm?.stock_actual || 0) + cant,
          updated_at: new Date().toISOString()
        }).eq('id', almId)
      })
    )

    // Actualizar stock_por_tipo
    await Promise.all(
      form.distribucion.map(async d => {
        const { data: spt } = await supabase.from('stock_por_tipo')
          .select('stock_actual').eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon).maybeSingle()
        if (spt) {
          await supabase.from('stock_por_tipo').update({
            stock_actual: (spt.stock_actual || 0) + d.cantidad,
            updated_at: new Date().toISOString()
          }).eq('almacen_id', d.almacen_id).eq('tipo_balon', d.tipo_balon)
        } else {
          await supabase.from('stock_por_tipo').insert({
            almacen_id: d.almacen_id, tipo_balon: d.tipo_balon,
            stock_actual: d.cantidad
          })
        }
      })
    )

    // Descontar los balones vacíos realmente entregados al proveedor a cambio
    // (no siempre es igual a la cantidad comprada — puede haber préstamo del proveedor)
    const campoVacios = (t) => t==='5kg'?'vacios_5kg':t==='45kg'?'vacios_45kg':'vacios_10kg'
    await Promise.all(
      form.distribucion.map(async d => {
        const vaciosEnt = getVaciosEntregados(d.almacen_id, d.tipo_balon)
        if (vaciosEnt <= 0) return
        const campo = campoVacios(d.tipo_balon)
        const { data: almFresco } = await supabase.from('almacenes')
          .select('balones_vacios,vacios_5kg,vacios_10kg,vacios_45kg').eq('id', d.almacen_id).single()
        if (!almFresco) return
        const nuevoTipo = Math.max(0, (almFresco[campo]||0) - vaciosEnt)
        const nuevoTotal = Math.max(0, (almFresco.balones_vacios||0) - vaciosEnt)
        await supabase.from('almacenes').update({
          [campo]: nuevoTipo, balones_vacios: nuevoTotal, updated_at: new Date().toISOString()
        }).eq('id', d.almacen_id)
      })
    )

    // ── Crear lotes FIFO para distribuidores ──────────────────────────────────
    // Se crea lote para CUALQUIER almacén que tenga un distribuidor vinculado
    // Sin depender del nombre — funciona con cualquier distribuidor futuro
    await Promise.all(
      form.distribucion.map(async d => {
        const dist = await supabase.from('distribuidores')
          .select('id,precio_base,usa_fifo').eq('almacen_id', d.almacen_id).eq('activo', true).maybeSingle()
        if (dist?.data && dist.data.usa_fifo) {
          const { data: pdt } = await supabase.from('precio_distribuidor_tipo')
            .select('precio')
            .eq('distribuidor_id', dist.data.id)
            .eq('tipo_balon', d.tipo_balon)
            .maybeSingle()
          const precioVenta = pdt?.precio || dist.data.precio_base || 0
          const { error: eLote } = await supabase.from('lotes_distribuidor').insert({
            distribuidor_id: dist.data.id,
            almacen_id: d.almacen_id,
            tipo_balon: d.tipo_balon,
            cantidad_inicial: d.cantidad,
            cantidad_restante: d.cantidad,
            cantidad_vendida: 0,
            precio_unitario: parseFloat(form.precios[d.tipo_balon]) || 0,
            precio_venta: precioVenta,
            cerrado: false,
            fecha: form.fecha,
          })
          if (eLote) console.error('Error creando lote FIFO:', eLote.message)
        } else if (dist?.data && !dist.data.usa_fifo) {
          // ── Distribuidor de stock directo (ej. Felix/Alazan) ──────────────
          // Cada asignación desde Compras = NUEVA reposición = NUEVO período.
          // La rendición arma los períodos desde cargas_distribuidor, así que
          // insertar una carga crea el período nuevo automáticamente.
          // descargados=0: no se asume devolución de vacíos al proveedor.
          // (Si el proveedor sí recoge vacíos en cada entrega, se captura aparte.)
          const { error: eCarga } = await supabase.from('cargas_distribuidor').insert({
            distribuidor_id: dist.data.id,
            fecha: form.fecha,
            cantidad: d.cantidad,
            descargados: 0,
            tipo_balon: d.tipo_balon,
            precio_por_balon: dist.data.precio_base || 0,
            notas: 'Reposición desde Compras'
          })
          if (eCarga) console.error('Error creando carga/período:', eCarga.message)
        }
      })
    )

    setSaving(false)
    setModal(false)
    setForm(emptyForm)
    cargar()
  }

  const { totalBalones, totalInvertido } = calcularTotales()

  const totalComprado = compras.reduce((s, c) => s + (parseFloat(c.monto_total) || 0), 0)
  const totalBalonesCom = compras.reduce((s, c) => s + (parseInt(c.cantidad_total) || 0), 0)
  // Deuda de vacíos con el proveedor: suma de (comprado − entregado) en todos los detalles.
  // Positivo = el proveedor te prestó balones que aún le debes en vacíos.
  // Negativo = ya entregaste de más (a favor tuyo).
  const deudaVacios = compras.reduce((s, c) => s + (c.compra_detalles||[]).reduce((s2,d) => {
    const entregado = d.vacios_entregados!=null ? d.vacios_entregados : d.cantidad
    return s2 + (d.cantidad - entregado)
  }, 0), 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--app-text)',margin:0}}>Compras</h2>
          <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Registro de compras al proveedor</p>
        </div>
        <button onClick={()=>{setForm(emptyForm);setError('');setModal(true)}} className="btn-primary">
          <Plus className="w-4 h-4"/> Nueva compra
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Total compras',value:compras.length,color:'var(--app-text)',icon:'📋'},
          {label:'Balones comprados',value:totalBalonesCom,color:'#60a5fa',icon:'🔵'},
          {label:'Total invertido',value:`S/${totalComprado.toLocaleString('es-PE',{maximumFractionDigits:0})}`,color:'#f87171',icon:'💰'},
          {label:deudaVacios>0?'Debes al proveedor (vacíos)':deudaVacios<0?'El proveedor te debe (vacíos)':'Vacíos con el proveedor',
           value:deudaVacios===0?'Al día ✅':Math.abs(deudaVacios),color:deudaVacios>0?'#f87171':deudaVacios<0?'#22c55e':'#94a3b8',icon:'⚪'},
        ].map(({label,value,color,icon})=>(
          <div key={label} style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'14px 16px'}}>
            <p style={{fontSize:10,margin:'0 0 4px'}}>{icon}</p>
            <p style={{fontSize:20,fontWeight:700,color,margin:0}}>{value}</p>
            <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>{label}</p>
          </div>
        ))}
      </div>

      {/* Lista compras */}
      <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)'}}>
          <h3 style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>Historial de compras</h3>
        </div>

        {loading ? (
          <div style={{padding:'40px',textAlign:'center',color:'var(--app-text-secondary)',fontSize:13}}>Cargando...</div>
        ) : compras.length === 0 ? (
          <div style={{padding:'40px',textAlign:'center',color:'var(--app-text-secondary)'}}>
            <ShoppingBag style={{width:32,height:32,opacity:0.2,margin:'0 auto 8px'}}/>
            <p style={{fontSize:13,margin:0}}>Sin compras registradas</p>
          </div>
        ) : (
          <div>
            {compras.map(c => {
              const isOpen = expandido === c.id
              const detalles = c.compra_detalles || []
              return (
                <div key={c.id} style={{borderBottom:'1px solid var(--app-card-border)'}}>
                  <div
                    onClick={()=>setExpandido(isOpen ? null : c.id)}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',cursor:'pointer',gap:12}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--app-card-bg-alt)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:36,height:36,borderRadius:8,background:'rgba(59,130,246,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Package style={{width:16,height:16,color:'#60a5fa'}}/>
                      </div>
                      <div>
                        <p style={{fontSize:14,fontWeight:600,color:'var(--app-text)',margin:0}}>
                          {c.fecha ? format(new Date(c.fecha+'T12:00:00'), "dd 'de' MMMM yyyy", {locale:es}) : '—'}
                        </p>
                        <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>
                          {c.cantidad_total} balones · {detalles.length} almacén{detalles.length!==1?'es':''}
                        </p>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{textAlign:'right'}}>
                        <p style={{fontSize:15,fontWeight:700,color:'#f87171',margin:0}}>
                          S/{parseFloat(c.monto_total||0).toLocaleString('es-PE',{maximumFractionDigits:0})}
                        </p>
                        <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>invertido</p>
                      </div>
                      {isOpen ? <ChevronUp style={{width:16,height:16,color:'var(--app-text-secondary)'}}/> : <ChevronDown style={{width:16,height:16,color:'var(--app-text-secondary)'}}/>}
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div style={{padding:'0 20px 16px',borderTop:'1px solid var(--app-card-border)'}}>
                      {c.notas && (
                        <p style={{fontSize:12,color:'#eab308',margin:'12px 0 10px',fontStyle:'italic'}}>📝 {c.notas}</p>
                      )}
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:12}}>
                        {detalles.map((d,i) => (
                          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <span style={{fontSize:12,fontWeight:600,color:'var(--app-text)'}}>{d.almacenes?.nombre||'—'}</span>
                              <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:'rgba(59,130,246,0.1)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.2)'}}>{d.tipo_balon}</span>
                            </div>
                            <div style={{textAlign:'right'}}>
                              <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>{d.cantidad} bal.</p>
                              <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'1px 0 0'}}>
                                S/{parseFloat(d.precio_unitario||0).toFixed(2)}/bal · Total: S/{(d.cantidad*(parseFloat(d.precio_unitario)||0)).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal nueva compra */}
      {modal && (
        <Modal title="Registrar nueva compra" onClose={()=>setModal(false)}>
          <div className="space-y-5">
            {error && (
              <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}>
                <AlertCircle style={{width:16,height:16}}/>{error}
              </div>
            )}

            {/* Fecha */}
            <div>
              <label className="label">Fecha de compra</label>
              <input type="date" className="input" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
            </div>

            {/* Precios por tipo */}
            <div>
              <label className="label">Precio de compra por tipo de balón (S/)</label>
              <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 8px'}}>
                💡 El precio que le cobras al distribuidor se carga automático desde Configuración.
              </p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {TIPOS.map(tipo => (
                  <div key={tipo}>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 4px'}}>{tipo}</p>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'var(--app-text-secondary)'}}>S/</span>
                      <input
                        type="number" min="0" step="0.5"
                        className="input" style={{paddingLeft:'2rem'}}
                        placeholder="0.00"
                        value={form.precios[tipo]}
                        onChange={e=>setForm(f=>({...f,precios:{...f.precios,[tipo]:e.target.value}}))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribución por almacén */}
            <div>
              <label className="label">Distribución por almacén</label>
              <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 8px'}}>
                💡 Por defecto se asume trueque 1:1 (entregas la misma cantidad de vacíos que recibes de llenos). Si el proveedor te prestó parte de los balones, ajusta "Vacíos entregados" abajo.
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {almacenes.map(alm => (
                  <div key={alm.id} style={{background:'var(--app-card-bg-alt)',borderRadius:10,padding:'12px',border:'1px solid var(--app-card-border)'}}>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 8px'}}>{alm.nombre}</p>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                      {TIPOS.map(tipo => (
                        <div key={tipo}>
                          <p style={{fontSize:10,color:'var(--app-text-secondary)',margin:'0 0 3px'}}>{tipo} comprado</p>
                          <input
                            type="number" min="0"
                            className="input" style={{padding:'6px 10px',fontSize:13}}
                            placeholder="0"
                            value={getDistribucion(alm.id, tipo)}
                            onChange={e=>setDistribucion(alm.id, tipo, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    {TIPOS.some(tipo=>parseInt(getDistribucion(alm.id,tipo))>0) && (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:8,paddingTop:8,borderTop:'1px solid var(--app-card-border)'}}>
                        {TIPOS.map(tipo => {
                          const comprado = parseInt(getDistribucion(alm.id,tipo))||0
                          if(comprado<=0) return <div key={tipo}/>
                          const entregado = parseInt(getVaciosEntregados(alm.id,tipo))||0
                          const prestamo = comprado - entregado
                          return (
                            <div key={tipo}>
                              <p style={{fontSize:10,color:'#eab308',margin:'0 0 3px'}}>Vacíos entregados</p>
                              <input
                                type="number" min="0"
                                className="input" style={{padding:'6px 10px',fontSize:13}}
                                placeholder="0"
                                value={getVaciosEntregados(alm.id, tipo)}
                                onChange={e=>setVaciosEntregados(alm.id, tipo, e.target.value)}
                              />
                              {prestamo!==0 && (
                                <p style={{fontSize:10,margin:'2px 0 0',color:prestamo>0?'#f87171':'#22c55e'}}>
                                  {prestamo>0?`🔴 Proveedor presta ${prestamo}`:`🟢 Devuelves ${Math.abs(prestamo)} de más`}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" placeholder="Observaciones de la compra..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/>
            </div>

            {/* Resumen */}
            {totalBalones > 0 && (
              <div style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:10,padding:'12px 14px'}}>
                <p style={{fontSize:12,fontWeight:600,color:'var(--app-text)',margin:'0 0 6px'}}>Resumen de la compra:</p>
                <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                  <div>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>Total balones</p>
                    <p style={{fontSize:16,fontWeight:700,color:'#60a5fa',margin:0}}>{totalBalones}</p>
                  </div>
                  <div>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>Total invertido</p>
                    <p style={{fontSize:16,fontWeight:700,color:'#f87171',margin:0}}>S/{totalInvertido.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                  </div>
                </div>
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:3}}>
                  {TIPOS.filter(t => form.distribucion.some(d=>d.tipo_balon===t)).map(tipo => {
                    const cant = form.distribucion.filter(d=>d.tipo_balon===tipo).reduce((s,d)=>s+d.cantidad,0)
                    const precio = parseFloat(form.precios[tipo])||0
                    return cant > 0 ? (
                      <p key={tipo} style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>
                        {tipo}: {cant} bal. × S/{precio.toFixed(2)} = <strong style={{color:'var(--app-text)'}}>S/{(cant*precio).toFixed(0)}</strong>
                      </p>
                    ) : null
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCompra} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Registrar compra'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
