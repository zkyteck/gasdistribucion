// src/pages/Inventario.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { Package, X, AlertCircle, ArrowRight, Edit2, Layers } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Modal from '../components/Modal'

const TIPOS = ['10kg', '5kg', '45kg']


export default function Inventario() {
  const [almacenes, setAlmacenes] = useState([])
  const [stockPorTipo, setStockPorTipo] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modales
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [modalVacios, setModalVacios] = useState(false)
  const [modalEditStock, setModalEditStock] = useState(null) // almacen object
  const [modalLotes, setModalLotes] = useState(null)
  const [lotesData, setLotesData] = useState([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  // Forms
  const [movForm, setMovForm] = useState({ origen_id: '', destino_id: '', tipo_balon: '10kg', cantidad: '', notas: '', fecha: hoyPeru() })
  const [vaciosForm, setVaciosForm] = useState({ almacen_id: '', cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, notas: '', fecha: hoyPeru() })
  // ← CAMBIO 1: editStockVal ahora incluye los 3 tipos
  const [editStockVal, setEditStockVal] = useState({ '5kg': 0, '10kg': 0, '45kg': 0, vacios: 0 })

  // ─── Cargar datos ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: alms }, { data: spt }, { data: movs }] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo', true).order('nombre'),
      supabase.from('stock_por_tipo').select('*'),
      supabase.from('movimientos_stock').select('*, origen:almacenes!almacen_id(nombre), destino:almacenes!almacen_destino_id(nombre)')
        .order('fecha', { ascending: false }).limit(50),
    ])
    setAlmacenes(alms || [])
    setStockPorTipo(spt || [])
    setMovimientos(movs || [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const getStock = (almacenId, tipo) =>
    stockPorTipo.find(s => s.almacen_id === almacenId && s.tipo_balon === tipo)?.stock_actual || 0

  // ─── Cargar lotes distribuidor ─────────────────────────────────────────────
  const cargarLotes = useCallback(async (almacen) => {
    setLoadingLotes(true)
    setModalLotes(almacen)
    const dist = await supabase.from('distribuidores').select('id,nombre').eq('almacen_id', almacen.id).maybeSingle()
    if (dist?.data) {
      const { data } = await supabase.from('lotes_distribuidor').select('*')
        .eq('distribuidor_id', dist.data.id).eq('cerrado', false).order('fecha', { ascending: true })
      setLotesData(data || [])
    } else setLotesData([])
    setLoadingLotes(false)
  }, [])

  // ─── Registrar movimiento ──────────────────────────────────────────────────
  const guardarMovimiento = useCallback(async () => {
    if (!movForm.origen_id || !movForm.destino_id) { setError('Selecciona origen y destino'); return }
    if (movForm.origen_id === movForm.destino_id) { setError('Origen y destino deben ser diferentes'); return }
    if (!movForm.cantidad || parseInt(movForm.cantidad) <= 0) { setError('Ingresa una cantidad válida'); return }

    const cant = parseInt(movForm.cantidad)
    const stockOrigen = getStock(movForm.origen_id, movForm.tipo_balon)
    if (cant > stockOrigen) { setError(`Stock insuficiente en origen (${stockOrigen} disponibles)`); return }

    setSaving(true); setError('')

    const almOrigen = almacenes.find(a => a.id === movForm.origen_id)
    const almDestino = almacenes.find(a => a.id === movForm.destino_id)

    await Promise.all([
      // Descontar origen
      supabase.from('stock_por_tipo').update({ stock_actual: stockOrigen - cant, updated_at: new Date().toISOString() })
        .eq('almacen_id', movForm.origen_id).eq('tipo_balon', movForm.tipo_balon),
      supabase.from('almacenes').update({ stock_actual: Math.max(0, (almOrigen?.stock_actual || 0) - cant), updated_at: new Date().toISOString() })
        .eq('id', movForm.origen_id),
      // Sumar destino
      supabase.from('stock_por_tipo').upsert({
        almacen_id: movForm.destino_id, tipo_balon: movForm.tipo_balon,
        stock_actual: getStock(movForm.destino_id, movForm.tipo_balon) + cant,
        updated_at: new Date().toISOString()
      }, { onConflict: 'almacen_id,tipo_balon' }),
      supabase.from('almacenes').update({ stock_actual: (almDestino?.stock_actual || 0) + cant, updated_at: new Date().toISOString() })
        .eq('id', movForm.destino_id),
      // Registrar movimiento
      supabase.from('movimientos_stock').insert({
        almacen_id: movForm.origen_id, almacen_destino_id: movForm.destino_id,
        tipo_balon: movForm.tipo_balon, cantidad: cant,
        notas: movForm.notas || null, fecha: movForm.fecha,
        tipo_movimiento: 'transferencia'
      })
    ])

    setSaving(false); setModalMovimiento(false)
    setMovForm({ origen_id: '', destino_id: '', tipo_balon: '10kg', cantidad: '', notas: '', fecha: hoyPeru() })
    cargar()
  }, [movForm, almacenes, stockPorTipo, cargar])

  // ─── Registrar vacíos ──────────────────────────────────────────────────────
  const guardarVacios = useCallback(async () => {
    if (!vaciosForm.almacen_id) { setError('Selecciona el almacén'); return }
    const totalVacios = Object.values(vaciosForm.cantidades).reduce((s, v) => s + (parseInt(v) || 0), 0)
    if (totalVacios === 0) { setError('Ingresa al menos un vacío'); return }

    setSaving(true); setError('')
    const alm = almacenes.find(a => a.id === vaciosForm.almacen_id)
    await supabase.from('almacenes').update({
      balones_vacios: (alm?.balones_vacios || 0) + totalVacios,
      vacios_5kg: (alm?.vacios_5kg || 0) + (parseInt(vaciosForm.cantidades['5kg']) || 0),
      vacios_10kg: (alm?.vacios_10kg || 0) + (parseInt(vaciosForm.cantidades['10kg']) || 0),
      vacios_45kg: (alm?.vacios_45kg || 0) + (parseInt(vaciosForm.cantidades['45kg']) || 0),
      updated_at: new Date().toISOString()
    }).eq('id', vaciosForm.almacen_id)

    setSaving(false); setModalVacios(false)
    setVaciosForm({ almacen_id: '', cantidades: { '5kg': 0, '10kg': 0, '45kg': 0 }, notas: '', fecha: hoyPeru() })
    cargar()
  }, [vaciosForm, almacenes, cargar])

  // ─── Editar stock directamente ─────────────────────────────────────────────
  // CAMBIO 2: ahora actualiza almacenes + stock_por_tipo por cada tipo
  const guardarEditStock = useCallback(async () => {
    if (!modalEditStock) return
    setSaving(true)

    const v5  = parseInt(editStockVal['5kg'])  || 0
    const v10 = parseInt(editStockVal['10kg']) || 0
    const v45 = parseInt(editStockVal['45kg']) || 0
    const totalLlenos = v5 + v10 + v45

    await Promise.all([
      // Actualiza total en almacenes
      supabase.from('almacenes').update({
        stock_actual: totalLlenos,
        balones_vacios: parseInt(editStockVal.vacios) || 0,
        updated_at: new Date().toISOString()
      }).eq('id', modalEditStock.id),

      // Upsert por cada tipo en stock_por_tipo
      supabase.from('stock_por_tipo').upsert({
        almacen_id: modalEditStock.id, tipo_balon: '5kg',
        stock_actual: v5, updated_at: new Date().toISOString()
      }, { onConflict: 'almacen_id,tipo_balon' }),
      supabase.from('stock_por_tipo').upsert({
        almacen_id: modalEditStock.id, tipo_balon: '10kg',
        stock_actual: v10, updated_at: new Date().toISOString()
      }, { onConflict: 'almacen_id,tipo_balon' }),
      supabase.from('stock_por_tipo').upsert({
        almacen_id: modalEditStock.id, tipo_balon: '45kg',
        stock_actual: v45, updated_at: new Date().toISOString()
      }, { onConflict: 'almacen_id,tipo_balon' }),
    ])

    setSaving(false); setModalEditStock(null); cargar()
  }, [modalEditStock, editStockVal, cargar])

  const totalBalones = almacenes.reduce((s, a) => s + (a.stock_actual || 0), 0)
  const totalVacios = almacenes.reduce((s, a) => s + (a.balones_vacios || 0), 0)

  const csTab = (id) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottom: tab === id ? '2px solid var(--app-accent)' : '2px solid transparent',
    color: tab === id ? 'var(--app-accent)' : 'var(--app-text-secondary)',
    whiteSpace: 'nowrap', transition: 'all 0.15s'
  })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--app-text)',margin:0}}>Inventario</h2>
          <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Stock actual y movimientos entre almacenes</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>{setError('');setModalVacios(true)}} className="btn-secondary" style={{fontSize:12}}>
            ⚪ Registrar vacíos
          </button>
          <button onClick={()=>{setError('');setModalMovimiento(true)}} className="btn-primary" style={{fontSize:12}}>
            <ArrowRight className="w-4 h-4"/> Mover stock
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'14px 16px'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#22c55e',margin:0}}>{totalBalones}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>🟢 Balones llenos total</p>
        </div>
        <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'14px 16px'}}>
          <p style={{fontSize:24,fontWeight:700,color:'var(--app-text-secondary)',margin:0}}>{totalVacios}</p>
          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>⚪ Balones vacíos total</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{borderBottom:'1px solid var(--app-card-border)',display:'flex',gap:0,overflowX:'auto'}}>
        <button style={csTab('stock')} onClick={()=>setTab('stock')}>📦 Stock por almacén</button>
        <button style={csTab('movimientos')} onClick={()=>setTab('movimientos')}>🔄 Movimientos</button>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--app-text-secondary)',fontSize:13}}>Cargando...</div>
      ) : (
        <>
          {/* ── TAB STOCK ── */}
          {tab === 'stock' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {almacenes.map(alm => {
                const s5 = getStock(alm.id, '5kg')
                const s10 = getStock(alm.id, '10kg')
                const s45 = getStock(alm.id, '45kg')
                const bajo = (alm.stock_actual || 0) < 10
                return (
                  <div key={alm.id} style={{background:'var(--app-card-bg)',border:`1px solid ${bajo?'rgba(239,68,68,0.3)':'var(--app-card-border)'}`,borderRadius:12,overflow:'hidden'}}>
                    {/* Header almacén */}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid var(--app-card-border)',background:bajo?'rgba(239,68,68,0.04)':'transparent'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:34,height:34,borderRadius:8,background:'color-mix(in srgb, var(--app-accent) 12%, transparent)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Package style={{width:16,height:16,color:'var(--app-accent)'}}/>
                        </div>
                        <div>
                          <p style={{fontSize:14,fontWeight:600,color:'var(--app-text)',margin:0}}>{alm.nombre}</p>
                          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>{alm.responsable}</p>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {bajo && <span style={{fontSize:11,color:'#f87171'}}>⚠️ Stock bajo</span>}
                        {/* CAMBIO 3: al abrir el modal, pre-carga los valores por tipo desde stock_por_tipo */}
                        <button
                          onClick={()=>{
                            setModalEditStock(alm)
                            setEditStockVal({
                              '5kg':  getStock(alm.id, '5kg'),
                              '10kg': getStock(alm.id, '10kg'),
                              '45kg': getStock(alm.id, '45kg'),
                              vacios: alm.balones_vacios || 0
                            })
                          }}
                          style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)',padding:4}}>
                          <Edit2 style={{width:14,height:14}}/>
                        </button>
                        <button onClick={()=>cargarLotes(alm)}
                          style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)',padding:4}}
                          title="Ver lotes FIFO">
                          <Layers style={{width:14,height:14}}/>
                        </button>
                      </div>
                    </div>

                    {/* Stock por tipo */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:0}}>
                      {[
                        {label:'Total llenos',value:alm.stock_actual||0,color:'#22c55e'},
                        {label:'5kg',value:s5,color:'#60a5fa'},
                        {label:'10kg',value:s10,color:'#a78bfa'},
                        {label:'45kg',value:s45,color:'#fb923c'},
                      ].map(({label,value,color})=>(
                        <div key={label} style={{padding:'12px',textAlign:'center',borderRight:'1px solid var(--app-card-border)'}}>
                          <p style={{fontSize:20,fontWeight:700,color,margin:0}}>{value}</p>
                          <p style={{fontSize:10,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Vacíos */}
                    {(alm.balones_vacios || 0) > 0 && (
                      <div style={{padding:'8px 16px',borderTop:'1px solid var(--app-card-border)',background:'var(--app-card-bg-alt)'}}>
                        <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>
                          ⚪ Vacíos: {alm.balones_vacios}
                          {alm.vacios_5kg > 0 && ` (5kg:${alm.vacios_5kg}`}
                          {alm.vacios_10kg > 0 && ` 10kg:${alm.vacios_10kg}`}
                          {alm.vacios_45kg > 0 && ` 45kg:${alm.vacios_45kg}`}
                          {(alm.vacios_5kg||alm.vacios_10kg||alm.vacios_45kg) ? ')' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── TAB MOVIMIENTOS ── */}
          {tab === 'movimientos' && (
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid var(--app-card-border)'}}>
                <h3 style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>Historial de movimientos</h3>
              </div>
              {movimientos.length === 0 ? (
                <div style={{padding:'40px',textAlign:'center',color:'var(--app-text-secondary)',fontSize:13}}>
                  Sin movimientos registrados
                </div>
              ) : (
                <div>
                  {movimientos.map(m => (
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid var(--app-card-border)'}}>
                      <div style={{width:34,height:34,borderRadius:8,background:'rgba(99,102,241,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <ArrowRight style={{width:16,height:16,color:'#818cf8'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:500,color:'var(--app-text)',margin:0}}>
                          {m.origen?.nombre||'—'} → {m.destino?.nombre||'—'}
                        </p>
                        <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>
                          {m.tipo_balon} · {m.cantidad} balones
                          {m.notas ? ` · ${m.notas}` : ''}
                        </p>
                      </div>
                      <p style={{fontSize:11,color:'var(--app-text-secondary)',flexShrink:0}}>
                        {m.fecha ? format(new Date(m.fecha+'T12:00:00'),'dd/MM/yyyy',{locale:es}) : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal mover stock */}
      {modalMovimiento && (
        <Modal title="Mover stock entre almacenes" onClose={()=>setModalMovimiento(false)}>
          <div className="space-y-4">
            {error && <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16}}/>{error}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label className="label">Origen</label>
                <select className="input" value={movForm.origen_id} onChange={e=>setMovForm(f=>({...f,origen_id:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {almacenes.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Destino</label>
                <select className="input" value={movForm.destino_id} onChange={e=>setMovForm(f=>({...f,destino_id:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {almacenes.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label className="label">Tipo de balón</label>
                <select className="input" value={movForm.tipo_balon} onChange={e=>setMovForm(f=>({...f,tipo_balon:e.target.value}))}>
                  {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cantidad</label>
                <input type="number" min="1" className="input" value={movForm.cantidad}
                  onChange={e=>setMovForm(f=>({...f,cantidad:e.target.value}))} placeholder="0"/>
              </div>
            </div>
            {movForm.origen_id && movForm.tipo_balon && (
              <p style={{fontSize:12,color:'var(--app-text-secondary)'}}>
                Disponible en origen: <strong style={{color:'var(--app-text)'}}>{getStock(movForm.origen_id, movForm.tipo_balon)} balones</strong>
              </p>
            )}
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={movForm.fecha} onChange={e=>setMovForm(f=>({...f,fecha:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input" value={movForm.notas} onChange={e=>setMovForm(f=>({...f,notas:e.target.value}))} placeholder="Motivo del movimiento..."/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModalMovimiento(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarMovimiento} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'✓ Mover stock'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal registrar vacíos */}
      {modalVacios && (
        <Modal title="Registrar balones vacíos" onClose={()=>setModalVacios(false)}>
          <div className="space-y-4">
            {error && <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',borderRadius:8,padding:'8px 12px',fontSize:13}}><AlertCircle style={{width:16,height:16}}/>{error}</div>}
            <div>
              <label className="label">Almacén</label>
              <select className="input" value={vaciosForm.almacen_id} onChange={e=>setVaciosForm(f=>({...f,almacen_id:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {almacenes.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad por tipo</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {TIPOS.map(tipo=>(
                  <div key={tipo}>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 4px'}}>{tipo}</p>
                    <input type="number" min="0" className="input" style={{padding:'6px 10px'}}
                      value={vaciosForm.cantidades[tipo]}
                      onChange={e=>setVaciosForm(f=>({...f,cantidades:{...f.cantidades,[tipo]:e.target.value}}))}
                      placeholder="0"/>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModalVacios(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarVacios} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Guardando...':'✓ Registrar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal editar stock — CAMBIO 3: inputs por tipo + total automático */}
      {modalEditStock && (
        <Modal title={`Editar stock — ${modalEditStock.nombre}`} onClose={()=>setModalEditStock(null)}>
          <div className="space-y-4">
            <div style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.25)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--app-text-secondary)'}}>
              ⚠️ Esto ajusta el stock directamente. El total se calcula automáticamente sumando los tres tipos.
            </div>

            <div>
              <label className="label">Balones llenos por tipo</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {TIPOS.map(tipo => (
                  <div key={tipo}>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 4px'}}>{tipo}</p>
                    <input type="number" min="0" className="input" style={{padding:'6px 10px'}}
                      value={editStockVal[tipo]}
                      onChange={e=>setEditStockVal(f=>({...f,[tipo]:e.target.value}))}
                      placeholder="0"/>
                  </div>
                ))}
              </div>
              <p style={{fontSize:12,color:'var(--app-text-secondary)',marginTop:6}}>
                Total llenos:{' '}
                <strong style={{color:'#22c55e'}}>
                  {(parseInt(editStockVal['5kg'])||0) + (parseInt(editStockVal['10kg'])||0) + (parseInt(editStockVal['45kg'])||0)} balones
                </strong>
              </p>
            </div>

            <div>
              <label className="label">Balones vacíos (total)</label>
              <input type="number" min="0" className="input" value={editStockVal.vacios}
                onChange={e=>setEditStockVal(f=>({...f,vacios:e.target.value}))}
                placeholder="0"/>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={()=>setModalEditStock(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarEditStock} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving?'Guardando...':'✓ Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal lotes FIFO */}
      {modalLotes && (
        <Modal title={`Lotes FIFO — ${modalLotes.nombre}`} onClose={()=>setModalLotes(null)} wide>
          <div>
            {loadingLotes ? (
              <p style={{textAlign:'center',color:'var(--app-text-secondary)',fontSize:13,padding:'20px 0'}}>Cargando lotes...</p>
            ) : lotesData.length === 0 ? (
              <p style={{textAlign:'center',color:'var(--app-text-secondary)',fontSize:13,padding:'20px 0'}}>Sin lotes activos</p>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {lotesData.map((l,i)=>(
                  <div key={l.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:8,background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)'}}>
                    <div>
                      <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>Lote {i+1} — {l.tipo_balon}</p>
                      <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>
                        Inicial: {l.cantidad_inicial} · Restante: {l.cantidad_restante}
                      </p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{fontSize:13,fontWeight:700,color:'#22c55e',margin:0}}>{l.cantidad_restante} bal.</p>
                      <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>
                        S/{parseFloat(l.precio_unitario||0).toFixed(2)}/bal
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
