// src/components/ModalHistorial.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { imprimirCuenta, imprimirCuentaActiva } from '../lib/impresionDistribuidores'

// ── Componente ModalHistorial ─────────────────────────────────────────────
export default function ModalHistorial({ selected, cargasDist, abonosParciales, cuentaActiva, cuentasCerradas, lotesDistribuidor, ventasDistribuidor, ventaLoteDetalles, rendiciones, onClose, cargarHistorial }) {
  const esCuentaCorriente = selected.modalidad === 'cuenta_corriente'
  const [loteFiltro, setLoteFiltro] = useState(null)

  if (esCuentaCorriente) {
    // Vista cuenta corriente (Cristian)
    const totalCargado = cargasDist.reduce((s,c) => s+(c.cantidad||0), 0)
    const totalDescargado = cargasDist.reduce((s,c) => s+((c.descargados||0)||0), 0)
    const montoTotal = cargasDist.reduce((s,c) => s+(c.total||0), 0)
    const totalAbonado = abonosParciales.reduce((s,a) => s+(a.total||0), 0)
    const saldoAnterior = cuentaActiva?.saldo_anterior || 0
    const faltantesAnterior = cuentaActiva?.faltantes_anterior || 0
    const faltantesBal = Math.max(0, totalCargado - totalDescargado) + faltantesAnterior
    const montoConSaldo = montoTotal + saldoAnterior
    const saldoPendiente = Math.max(0, montoConSaldo - totalAbonado)
    const lotesActivos = lotesDistribuidor.filter(l => !l.cerrado && l.cantidad_restante > 0)
    const valorCampo = lotesActivos.reduce((s,l) => s + l.cantidad_restante * (l.precio_venta || l.precio_unitario), 0)
    const loteActivo = lotesActivos[0]

    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          style={{background:'var(--app-modal-bg)',border:'1px solid var(--app-modal-border)'}}>
          <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--app-card-border)'}}>
            <h3 style={{color:'var(--app-text)',fontWeight:700,fontSize:16,margin:0}}>
              📦 Cuenta corriente — {selected.nombre}
            </h3>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}>✕</button>
          </div>
          <div className="px-6 py-5 space-y-5">

            {/* Resumen */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {[
                {label:'🟢 Llenos', value:`${selected.stock_actual} bal.`, color:'#34d399'},
                {label:'⚪ Vacíos', value:`${selected.balones_vacios||0} bal.`, color:'var(--app-text)'},
                {label:'💰 Precio/bal.', value:`S/${selected.precio_base}`, color:'#fb923c'},
                {label:'📦 Valor campo', value:`S/${valorCampo.toLocaleString('es-PE')}`, color:'#60a5fa'},
              ].map(({label,value,color}) => (
                <div key={label} style={{background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',borderRadius:10,padding:'10px',textAlign:'center'}}>
                  <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:'0 0 6px',textTransform:'uppercase'}}>{label}</p>
                  <p style={{fontSize:22,fontWeight:800,color,margin:0}}>{value}</p>
                </div>
              ))}
            </div>

            {/* Pendientes anteriores */}
            {(saldoAnterior > 0 || faltantesAnterior > 0) && (
              <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,padding:'10px 14px'}}>
                <p style={{fontSize:12,color:'#f87171',fontWeight:700,margin:'0 0 4px'}}>Pendientes de cuenta anterior:</p>
                <div style={{display:'flex',gap:16}}>
                  {saldoAnterior > 0 && <span style={{fontSize:12,color:'#f87171'}}>S/{saldoAnterior.toLocaleString('es-PE')} en dinero</span>}
                  {faltantesAnterior > 0 && <span style={{fontSize:12,color:'#fb923c'}}>{faltantesAnterior} vacíos</span>}
                </div>
              </div>
            )}

            {/* Tabla cargas */}
            <div>
              <h4 style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:'0 0 10px'}}>Cargas de la cuenta actual</h4>
              {cargasDist.length === 0 ? (
                <div style={{textAlign:'center',padding:'20px',color:'var(--app-text-secondary)',fontSize:13,border:'1px solid var(--app-card-border)',borderRadius:10}}>
                  Sin cargas — usa "Registrar carga"
                </div>
              ) : (
                <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden',overflowX:'auto'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 0.7fr 0.7fr 0.6fr 0.7fr 0.9fr 1.3fr',background:'var(--app-accent)',minWidth:720}}>
                    {['Fecha','Cargados','Descargados','P. Venta','Faltantes','Monto','Notas'].map(h => (
                      <div key={h} style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#fff',textTransform:'uppercase',borderRight:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>{h}</div>
                    ))}
                  </div>
                  {cargasDist.map((c,i) => (
                    <div key={c.id} style={{display:'grid',gridTemplateColumns:'1fr 0.7fr 0.7fr 0.6fr 0.7fr 0.9fr 1.3fr',borderBottom:i<cargasDist.length-1?'1px solid var(--app-card-border)':'none',minWidth:750,background:i%2===0?'transparent':'var(--app-row-alt)'}}>
                      <div style={{padding:'14px 10px',fontSize:15,fontWeight:700,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{c.fecha}</div>
                      <div style={{padding:'14px 10px',fontSize:20,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{c.cantidad}</div>
                      <div style={{padding:'14px 10px',fontSize:16,fontWeight:600,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{(c.descargados||0)}</div>
                      <div style={{padding:'14px 10px',fontSize:15,fontWeight:700,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{selected.precio_base||0}</div>
                      <div style={{padding:'14px 10px',fontSize:16,fontWeight:700,color:'#fb923c',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{Math.max(0,c.cantidad-(c.descargados||0))}</div>
                      <div style={{padding:'14px 10px',fontSize:18,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{(c.total||0).toLocaleString('es-PE')}</div>
                      <div style={{padding:'14px 10px',fontSize:13,color:'var(--app-text-secondary)',textAlign:'center',fontStyle:'italic'}}>{c.notas || '—'}</div>
                    </div>
                  ))}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 0.7fr 0.7fr 0.6fr 0.7fr 0.9fr 1.3fr',background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)',minWidth:720}}>
                    <div style={{padding:'14px 10px',fontSize:15,fontWeight:800,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)'}}>TOTAL</div>
                    <div style={{padding:'14px 10px',fontSize:20,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{totalCargado}</div>
                    <div style={{padding:'14px 10px',fontSize:16,fontWeight:700,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{totalDescargado}</div>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'14px 10px',fontSize:16,fontWeight:700,color:'#fb923c',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{faltantesBal}</div>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'14px 10px',fontSize:18,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{montoConSaldo.toLocaleString('es-PE')}</div>
                    <div style={{padding:'8px'}}/>
                  </div>
                </div>
              )}
            </div>

            {/* Abonos */}
            {abonosParciales.length > 0 && (
              <div>
                <h4 style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:'0 0 8px'}}>Abonos parciales</h4>
                {abonosParciales.map(a => (
                  <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',marginBottom:6,borderRadius:8,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)'}}>
                    <div>
                      <p style={{color:'var(--app-text)',fontSize:12,fontWeight:600,margin:0}}>{a.fecha}</p>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:2}}>
                        {a.vales_20>0 && <span style={{fontSize:10,color:'#fde047'}}>{a.vales_20}×S/20=S/{a.vales_20*20}</span>}
                        {a.vales_30>0 && <span style={{fontSize:10,color:'#fde047'}}>{a.vales_30}×S/30=S/{a.vales_30*30}</span>}
                        {a.vales_43>0 && <span style={{fontSize:10,color:'#fde047'}}>{a.vales_43}×S/43=S/{a.vales_43*43}</span>}
                        {a.efectivo>0 && <span style={{fontSize:10,color:'#34d399'}}>Efectivo S/{a.efectivo}</span>}
                        {a.yape>0 && <span style={{fontSize:10,color:'#818cf8'}}>Yape S/{a.yape}</span>}
                      </div>
                    </div>
                    <p style={{color:'#34d399',fontWeight:700,fontSize:14,margin:0}}>S/{(a.total||0).toLocaleString()}</p>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--app-text-secondary)'}}>Total abonado:</span>
                  <span style={{fontSize:14,fontWeight:700,color:'#34d399'}}>S/{totalAbonado.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Abonos parciales */}
            {abonosParciales.length > 0 && (
              <div>
                <h4 style={{fontSize:14,fontWeight:700,color:'var(--app-text)',margin:'0 0 10px'}}>Abonos registrados</h4>
                <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden',overflowX:'auto'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.6fr 0.6fr 0.8fr 0.6fr 0.8fr',background:'var(--app-accent)',minWidth:650}}>
                    {['Fecha','V.S/20','V.S/30','V.S/43','Efectivo','Yape','Total'].map(h => (
                      <div key={h} style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#fff',textTransform:'uppercase',borderRight:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>{h}</div>
                    ))}
                  </div>
                  {abonosParciales.map((a,i) => (
                    <div key={a.id} style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.6fr 0.6fr 0.8fr 0.6fr 0.8fr',borderBottom:i<abonosParciales.length-1?'1px solid var(--app-card-border)':'none',minWidth:650,background:i%2===0?'transparent':'var(--app-row-alt)'}}>
                      <div style={{padding:'12px 10px',fontSize:14,fontWeight:700,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{a.fecha}</div>
                      <div style={{padding:'12px 10px',fontSize:16,fontWeight:700,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{(a.vales_20||0)>0?a.vales_20:'—'}</div>
                      <div style={{padding:'12px 10px',fontSize:16,fontWeight:700,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{(a.vales_30||0)>0?a.vales_30:'—'}</div>
                      <div style={{padding:'12px 10px',fontSize:16,fontWeight:700,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{(a.vales_43||0)>0?a.vales_43:'—'}</div>
                      <div style={{padding:'12px 10px',fontSize:16,fontWeight:700,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{(a.efectivo||0)>0?`S/${parseFloat(a.efectivo).toLocaleString('es-PE')}`:'—'}</div>
                      <div style={{padding:'12px 10px',fontSize:16,fontWeight:700,color:'#818cf8',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{(a.yape||0)>0?`S/${parseFloat(a.yape).toLocaleString('es-PE')}`:'—'}</div>
                      <div style={{padding:'12px 10px',fontSize:18,fontWeight:800,color:'#34d399',textAlign:'center'}}>S/{(a.total||0).toLocaleString('es-PE')}</div>
                    </div>
                  ))}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.6fr 0.6fr 0.8fr 0.6fr 0.8fr',background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)',minWidth:650}}>
                    <div style={{padding:'12px 10px',fontSize:14,fontWeight:800,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)'}}>TOTAL ABONADO</div>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'12px 10px',fontSize:18,fontWeight:800,color:'#34d399',textAlign:'center'}}>S/{abonosParciales.reduce((s,a)=>s+(a.total||0),0).toLocaleString('es-PE')}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Saldo */}
            {cargasDist.length > 0 && (
              <div style={{border:`2px solid ${saldoPendiente>0?'rgba(239,68,68,0.4)':'rgba(52,211,153,0.4)'}`,borderRadius:12,padding:'14px 16px',background:saldoPendiente>0?'rgba(239,68,68,0.06)':'rgba(52,211,153,0.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:0}}>Saldo pendiente</p>
                    {faltantesBal > 0 && <p style={{fontSize:11,color:'#fb923c',margin:'4px 0 0'}}>{faltantesBal} vacíos pendientes</p>}
                  </div>
                  <p style={{fontSize:22,fontWeight:700,color:saldoPendiente>0?'#f87171':'#34d399',margin:0}}>
                    S/{saldoPendiente.toLocaleString()} {saldoPendiente<=0?'✅':'⏳'}
                  </p>
                </div>
              </div>
            )}

            {/* Cuentas cerradas */}
            {cuentasCerradas.length > 0 && (
              <div>
                <h4 style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:'0 0 10px'}}>Arreglos anteriores</h4>
                {cuentasCerradas.map(c => {
                  const tv20 = (c.abonos||[]).reduce((s,a)=>s+(a.vales_20||0),0)
                  const tv30 = (c.abonos||[]).reduce((s,a)=>s+(a.vales_30||0),0)
                  const tv43 = (c.abonos||[]).reduce((s,a)=>s+(a.vales_43||0),0)
                  const tEfectivo = (c.abonos||[]).reduce((s,a)=>s+(parseFloat(a.efectivo)||0),0)
                  const tYape = (c.abonos||[]).reduce((s,a)=>s+(parseFloat(a.yape)||0),0)
                  return (
                    <div key={c.id} style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden',marginBottom:10}}>
                      <div style={{background:'var(--app-card-bg-alt)',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <p style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:0}}>{c.fecha_inicio} → {c.fecha_cierre}</p>
                          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>{c.total_cargado} cargados · {c.faltantes_bal} faltantes</p>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <p style={{fontSize:14,fontWeight:700,color:c.saldo_pendiente>0?'#f87171':'#34d399',margin:0}}>
                            {c.saldo_pendiente>0?`Pendiente S/${c.saldo_pendiente.toLocaleString()}`:'Cancelado ✅'}
                          </p>
                          <button onClick={() => imprimirCuenta(c, selected)}
                            style={{fontSize:10,padding:'2px 8px',borderRadius:4,border:'1px solid var(--app-card-border)',background:'var(--app-card-bg)',color:'var(--app-text-secondary)',cursor:'pointer',marginTop:4}}>
                            Imprimir
                          </button>
                        </div>
                      </div>
                      <div style={{padding:'8px 14px',display:'flex',flexWrap:'wrap',gap:8}}>
                        {tv20>0 && <span style={{fontSize:11,color:'#fde047'}}>{tv20}×S/20=S/{tv20*20}</span>}
                        {tv30>0 && <span style={{fontSize:11,color:'#fde047'}}>{tv30}×S/30=S/{tv30*30}</span>}
                        {tv43>0 && <span style={{fontSize:11,color:'#fde047'}}>{tv43}×S/43=S/{tv43*43}</span>}
                        {tEfectivo>0 && <span style={{fontSize:11,color:'#34d399'}}>Efectivo S/{tEfectivo}</span>}
                        {tYape>0 && <span style={{fontSize:11,color:'#818cf8'}}>Yape S/{tYape}</span>}
                        <span style={{marginLeft:'auto',fontSize:11,color:'var(--app-text-secondary)'}}>Total pagado: S/{(c.total_pagado||0).toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {cargasDist.length > 0 && (
              <button onClick={() => imprimirCuentaActiva(selected, cargasDist, abonosParciales, cuentaActiva)}
                style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid var(--app-card-border)',background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                Imprimir cuenta actual
              </button>
            )}

          </div>
        </div>
      </div>
    )
  }

  // Vista Alazan (ventas autónomas)

  // ── Filtrado por lote ──────────────────────────────────────────────────────
  const ventasFiltradas = loteFiltro
    ? (() => {
        const idx = lotesDistribuidor.findIndex(l => l.id === loteFiltro.id)
        const fechaInicio = loteFiltro.fecha
        const loteMasReciente = lotesDistribuidor[idx - 1]
        const fechaFin = loteMasReciente ? loteMasReciente.fecha : null
        return ventasDistribuidor.filter(v => {
          const fv = (v.fecha || '').substring(0, 10)
          if (fechaFin) return fv >= fechaInicio && fv < fechaFin
          return fv >= fechaInicio
        })
      })()
    : ventasDistribuidor

  const ventasPorDia = {}
  ventasFiltradas.forEach(v => {
    const dia = new Date(v.fecha).toLocaleDateString('en-CA', {timeZone:'America/Lima'})
    if (!ventasPorDia[dia]) ventasPorDia[dia] = { cantidad: 0, monto: 0, v20: 0, v30: 0, v43: 0, efectivo: 0 }
    ventasPorDia[dia].cantidad += v.cantidad || 0
    ventasPorDia[dia].monto += (v.cantidad||0) * (v.precio_unitario||0)
    ventasPorDia[dia].v20 += v.vales_20 || 0
    ventasPorDia[dia].v30 += v.vales_30 || 0
    ventasPorDia[dia].v43 += v.vales_43 || 0
    ventasPorDia[dia].efectivo += v.efectivo_dist || 0
  })
  const diasOrdenados = Object.keys(ventasPorDia).sort((a,b) => b.localeCompare(a))
  const lotesActivos = lotesDistribuidor.filter(l => !l.cerrado && l.cantidad_restante > 0)
  const valorCampo = lotesActivos.reduce((s,l) => s + l.cantidad_restante * (l.precio_venta || l.precio_unitario), 0)
  const loteActivo = lotesActivos[0]
  const cantVentasFiltradas = ventasFiltradas.reduce((s,v) => s + (v.cantidad||0), 0)
  const cuadra = loteFiltro ? cantVentasFiltradas === loteFiltro.cantidad_vendida : false

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{background:'var(--app-modal-bg)',border:'1px solid var(--app-modal-border)'}}>
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--app-card-border)'}}>
          <h3 style={{color:'var(--app-text)',fontWeight:700,fontSize:16,margin:0}}>📊 {selected.nombre}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-5">

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {[
              {label:'🟢 Llenos', value:`${selected.stock_actual} bal.`, color:'#34d399'},
              {label:'⚪ Vacíos', value:`${selected.balones_vacios||0} bal.`, color:'var(--app-text)'},
              {label:'💰 Precio FIFO', value:loteActivo?`S/${loteActivo.precio_venta||loteActivo.precio_unitario}`:`S/${selected.precio_base}`, color:'#fb923c'},
              {label:'📦 Valor campo', value:`S/${valorCampo.toLocaleString('es-PE')}`, color:'#60a5fa'},
            ].map(({label,value,color}) => (
              <div key={label} style={{background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',borderRadius:10,padding:'10px',textAlign:'center'}}>
                <p style={{fontSize:9,color:'var(--app-text-secondary)',margin:'0 0 4px',textTransform:'uppercase'}}>{label}</p>
                <p style={{fontSize:16,fontWeight:700,color,margin:0}}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <h4 style={{fontSize:15,fontWeight:700,color:'var(--app-text)',margin:0}}>
                Rendición de ventas
                {loteFiltro && <span style={{fontSize:12,color:'var(--app-text-secondary)',fontWeight:400,marginLeft:8}}>— Lote {loteFiltro.fecha}</span>}
              </h4>
              {loteFiltro && (
                <button onClick={()=>setLoteFiltro(null)}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:5,border:'1px solid var(--app-card-border)',background:'none',color:'var(--app-text-secondary)',cursor:'pointer'}}>
                  ✕ Quitar filtro
                </button>
              )}
            </div>
            {loteFiltro && (
              <div style={{
                background: cuadra ? 'rgba(52,211,153,0.08)' : 'rgba(251,146,60,0.08)',
                border: `1px solid ${cuadra ? 'rgba(52,211,153,0.3)' : 'rgba(251,146,60,0.3)'}`,
                borderRadius:10, padding:'12px 16px', marginBottom:12,
                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8
              }}>
                <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                  {[
                    {label:'Entregados',value:loteFiltro.cantidad_inicial,color:'#60a5fa'},
                    {label:'Vendidos (lote)',value:loteFiltro.cantidad_vendida,color:'#a78bfa'},
                    {label:'Ventas registradas',value:cantVentasFiltradas,color:cuadra?'#34d399':'#fb923c'},
                    {label:'Restantes lote',value:loteFiltro.cantidad_restante,color:'#34d399'},
                  ].map(({label,value,color})=>(
                    <div key={label} style={{textAlign:'center'}}>
                      <p style={{fontSize:10,color:'var(--app-text-secondary)',margin:'0 0 2px',textTransform:'uppercase'}}>{label}</p>
                      <p style={{fontSize:18,fontWeight:800,color,margin:0}}>{value}</p>
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'center'}}>
                    {cuadra
                      ? <span style={{fontSize:13,fontWeight:700,color:'#34d399',padding:'4px 12px',borderRadius:6,background:'rgba(52,211,153,0.1)'}}>✅ Cuadra</span>
                      : <span style={{fontSize:13,fontWeight:700,color:'#fb923c',padding:'4px 12px',borderRadius:6,background:'rgba(251,146,60,0.1)'}}>
                          ⚠️ Diferencia: {Math.abs(cantVentasFiltradas - loteFiltro.cantidad_vendida)} bal.
                        </span>
                    }
                  </div>
                </div>
                <button onClick={()=>setLoteFiltro(null)}
                  style={{fontSize:12,padding:'5px 12px',borderRadius:6,border:'1px solid var(--app-card-border)',background:'var(--app-card-bg)',color:'var(--app-text-secondary)',cursor:'pointer'}}>
                  Ver todo
                </button>
              </div>
            )}
            {diasOrdenados.length === 0 ? (
              <div style={{textAlign:'center',padding:'24px',color:'var(--app-text-secondary)',fontSize:13,border:'1px solid var(--app-card-border)',borderRadius:10}}>
                {loteFiltro
                  ? `Sin ventas registradas en el período de este lote`
                  : `Sin ventas registradas — registra ventas desde Ventas seleccionando el almacén de ${selected.nombre}`}
              </div>
            ) : (
              <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden',overflowX:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.8fr',background:'var(--app-accent)',minWidth:800}}>
                  {['Fecha','Cant.','Monto total','V.S/20','V.S/30','V.S/43','Saldo/Efectivo','Estado'].map(h => (
                    <div key={h} style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#fff',textTransform:'uppercase',borderRight:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>{h}</div>
                  ))}
                </div>
                {diasOrdenados.map((dia,i) => {
                  const d = ventasPorDia[dia]
                  const totalVales = d.v20*20 + d.v30*30 + d.v43*43
                  const totalPagado = totalVales + d.efectivo
                  const saldo = d.monto - totalPagado
                  const cancelado = saldo <= 0
                  // Buscar desglose FIFO para ventas de ese día
                  const ventasDelDia = ventasFiltradas.filter(v=>(v.fecha||'').substring(0,10)===dia)
                  const ventaIdsDelDia = ventasDelDia.map(v=>v.id)
                  const desgloseDelDia = (ventaLoteDetalles||[]).filter(vld=>ventaIdsDelDia.includes(vld.venta_id))
                  // Agrupar desglose por lote
                  const desglosePorLote = {}
                  desgloseDelDia.forEach(vld => {
                    const key = vld.lote_id
                    if(!desglosePorLote[key]) desglosePorLote[key] = { fecha:vld.lotes_distribuidor?.fecha||'?', precio:vld.precio_venta, cantidad:0, subtotal:0 }
                    desglosePorLote[key].cantidad += vld.cantidad
                    desglosePorLote[key].subtotal += vld.cantidad * vld.precio_venta
                  })
                  const desgloseArr = Object.values(desglosePorLote)
                  const tieneDesglose = desgloseArr.length > 1
                  return (
                    <div key={dia}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.8fr',borderBottom:tieneDesglose?'none':i<diasOrdenados.length-1?'1px solid var(--app-card-border)':'none',minWidth:900,background:i%2===0?'transparent':'var(--app-row-alt)'}}>
                        <div style={{padding:'14px 10px',fontSize:15,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center',fontWeight:700}}>{dia}</div>
                        <div style={{padding:'14px 10px',fontSize:20,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.cantidad}</div>
                        <div style={{padding:'14px 10px',fontSize:18,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{d.monto.toLocaleString('es-PE')}</div>
                        <div style={{padding:'14px 10px',fontSize:18,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v20>0?d.v20:'—'}</div>
                        <div style={{padding:'14px 10px',fontSize:18,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v30>0?d.v30:'—'}</div>
                        <div style={{padding:'14px 10px',fontSize:18,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v43>0?d.v43:'—'}</div>
                        <div style={{padding:'14px 10px',fontSize:16,borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>
                          {cancelado
                            ? <span style={{color:'#34d399',fontWeight:700}}>✅ Pagado</span>
                            : <span style={{color:'#f87171',fontWeight:700}}>S/{saldo.toLocaleString('es-PE')}</span>
                          }
                          {d.efectivo > 0 && <p style={{fontSize:13,color:'#34d399',margin:'2px 0 0'}}>ef. S/{d.efectivo}</p>}
                        </div>
                        <div style={{padding:'8px 5px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontSize:13,fontWeight:700,padding:'5px 12px',borderRadius:5,background:cancelado?'rgba(52,211,153,0.15)':'rgba(251,146,60,0.15)',color:cancelado?'#34d399':'#fb923c'}}>
                            {cancelado?'Pagado':'Pendiente'}
                          </span>
                        </div>
                      </div>
                      {/* Desglose por lote si cruza múltiples */}
                      {tieneDesglose && (
                        <div style={{background:'rgba(99,102,241,0.04)',borderBottom:i<diasOrdenados.length-1?'1px solid var(--app-card-border)':'none',padding:'6px 16px 10px 24px'}}>
                          <p style={{fontSize:10,color:'#818cf8',fontWeight:600,margin:'0 0 4px',textTransform:'uppercase'}}>📦 Desglose FIFO</p>
                          {desgloseArr.map((dl,j)=>(
                            <p key={j} style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0'}}>
                              {j===desgloseArr.length-1?'└':'├'} {dl.cantidad} bal × S/{dl.precio} (Lote {dl.fecha}) = <strong style={{color:'var(--app-text)'}}>S/{dl.subtotal.toFixed(2)}</strong>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Fila totales */}
                {diasOrdenados.length > 1 && (() => {
                  const tCant = ventasFiltradas.reduce((s,v)=>s+(v.cantidad||0),0)
                  const tMonto = ventasFiltradas.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)
                  const tv20 = ventasFiltradas.reduce((s,v)=>s+(v.vales_20||0),0)
                  const tv30 = ventasFiltradas.reduce((s,v)=>s+(v.vales_30||0),0)
                  const tv43 = ventasFiltradas.reduce((s,v)=>s+(v.vales_43||0),0)
                  const tEf = ventasFiltradas.reduce((s,v)=>s+(v.efectivo_dist||0),0)
                  const tVales = tv20*20+tv30*30+tv43*43
                  const tSaldo = tMonto - tVales - tEf
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.8fr',background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)',minWidth:720}}>
                      <div style={{padding:'14px 10px',fontSize:16,fontWeight:800,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)'}}>TOTAL</div>
                      <div style={{padding:'14px 10px',fontSize:20,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tCant}</div>
                      <div style={{padding:'14px 10px',fontSize:20,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{tMonto.toLocaleString('es-PE')}</div>
                      <div style={{padding:'8px 5px',fontSize:17,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tv20||'—'}</div>
                      <div style={{padding:'8px 5px',fontSize:17,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tv30||'—'}</div>
                      <div style={{padding:'8px 5px',fontSize:17,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tv43||'—'}</div>
                      <div style={{padding:'8px 5px',fontSize:12,fontWeight:700,color:tSaldo<=0?'#34d399':'#f87171',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>
                        {tSaldo<=0?'✅':'S/'+tSaldo.toLocaleString('es-PE')}
                      </div>
                      <div style={{padding:'8px 5px'}}/>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
          {/* Lotes FIFO — clickeables para filtrar */}
          {lotesDistribuidor.length > 0 && (
            <div>
              <h4 style={{fontSize:15,fontWeight:700,color:'var(--app-text)',margin:'0 0 6px'}}>Lotes de precio (FIFO)</h4>
              <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'0 0 10px'}}>
                💡 Haz clic en un lote para filtrar la rendición a ese período
              </p>
              <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr',background:'var(--app-card-bg-alt)',borderBottom:'1px solid var(--app-card-border)'}}>
                  {['Fecha','P. Venta','Inicial','Vendidos','Restantes','¿Cuadra?','Estado'].map(h => (
                    <div key={h} style={{padding:'13px 12px',fontSize:13,fontWeight:800,color:'var(--app-text-secondary)',textTransform:'uppercase',borderRight:'1px solid var(--app-card-border)'}}>{h}</div>
                  ))}
                </div>
                {lotesDistribuidor.map((lote,i) => {
                  const ag = lote.cerrado || lote.cantidad_restante <= 0
                  const seleccionado = loteFiltro?.id === lote.id
                  const idxL = i
                  const lotePrevio = lotesDistribuidor[idxL - 1]
                  const fInicio = lote.fecha
                  const fFin = lotePrevio ? lotePrevio.fecha : null
                  const ventasLote = ventasDistribuidor.filter(v => {
                    const fv = (v.fecha||'').substring(0,10)
                    if (fFin) return fv >= fInicio && fv < fFin
                    return fv >= fInicio
                  })
                  const cantRegistradas = ventasLote.reduce((s,v)=>s+(v.cantidad||0),0)
                  const loteCuadra = cantRegistradas === lote.cantidad_vendida
                  return (
                    <div key={lote.id}
                      onClick={()=>setLoteFiltro(seleccionado ? null : lote)}
                      style={{
                        display:'grid', gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr',
                        borderBottom:i<lotesDistribuidor.length-1?'1px solid var(--app-card-border)':'none',
                        cursor:'pointer',
                        background: seleccionado ? 'color-mix(in srgb, var(--app-accent) 8%, transparent)' : 'transparent',
                        outline: seleccionado ? '2px solid var(--app-accent)' : 'none',
                        transition:'background 0.15s'
                      }}
                      onMouseEnter={e=>{ if(!seleccionado) e.currentTarget.style.background='var(--app-card-bg-alt)' }}
                      onMouseLeave={e=>{ if(!seleccionado) e.currentTarget.style.background='transparent' }}
                    >
                      <div style={{padding:'13px 12px',fontSize:15,fontWeight:600,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)'}}>
                        {lote.fecha}
                        {seleccionado && <span style={{fontSize:10,color:'var(--app-accent)',marginLeft:6}}>● filtrado</span>}
                      </div>
                      <div style={{padding:'13px 12px',fontSize:17,fontWeight:800,color:'#fb923c',borderRight:'1px solid var(--app-card-border)'}}>
                        {lote.precio_venta ? `S/${lote.precio_venta}` : <span style={{color:'#f87171',fontSize:12}}>Sin precio</span>}
                      </div>
                      <div style={{padding:'13px 12px',fontSize:16,fontWeight:600,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{lote.cantidad_inicial}</div>
                      <div style={{padding:'13px 12px',fontSize:17,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{lote.cantidad_vendida}</div>
                      <div style={{padding:'13px 12px',fontSize:19,fontWeight:800,color:ag?'#9ca3af':'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{lote.cantidad_restante}</div>
                      <div style={{padding:'13px 12px',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>
                        {lote.cantidad_vendida === 0
                          ? <span style={{fontSize:11,color:'var(--app-text-secondary)'}}>—</span>
                          : loteCuadra
                            ? <span style={{fontSize:13,color:'#34d399',fontWeight:700}}>✅</span>
                            : <span style={{fontSize:11,color:'#fb923c',fontWeight:700}}>⚠️ {cantRegistradas} reg.</span>
                        }
                      </div>
                      <div style={{padding:'8px',textAlign:'center'}}>
                        <span style={{fontSize:13,fontWeight:700,padding:'5px 12px',borderRadius:5,background:ag?'rgba(107,114,128,0.15)':'rgba(52,211,153,0.15)',color:ag?'#9ca3af':'#34d399'}}>
                          {ag?'Agotado':lote.cantidad_vendida===0?'Nuevo':'Activo'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Botón imprimir Alazan */}
          {ventasDistribuidor.length > 0 && (
            <button
              onClick={() => {
                const ventasImprimir = loteFiltro ? ventasFiltradas : ventasDistribuidor
                const tituloPeriodo = loteFiltro
                  ? `Lote ${loteFiltro.fecha} — ${loteFiltro.cantidad_inicial} entregados / ${loteFiltro.cantidad_vendida} vendidos / ${loteFiltro.cantidad_restante} restantes`
                  : 'Todas las ventas'
                const totalCant = ventasImprimir.reduce((s,v)=>s+(v.cantidad||0),0)
                const totalMonto = ventasImprimir.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)
                const tv20 = ventasImprimir.reduce((s,v)=>s+(v.vales_20||0),0)
                const tv30 = ventasImprimir.reduce((s,v)=>s+(v.vales_30||0),0)
                const tv43 = ventasImprimir.reduce((s,v)=>s+(v.vales_43||0),0)
                const tEf = ventasImprimir.reduce((s,v)=>s+(v.efectivo_dist||0),0)
                const tVales = tv20*20+tv30*30+tv43*43
                const tSaldo = totalMonto - tVales - tEf

                // Agrupar por día para la tabla
                const porDia = {}
                ventasImprimir.forEach(v => {
                  const dia = new Date(v.fecha).toLocaleDateString('en-CA', {timeZone:'America/Lima'})
                  if (!porDia[dia]) porDia[dia] = { cantidad:0, monto:0, v20:0, v30:0, v43:0, ef:0 }
                  porDia[dia].cantidad += v.cantidad||0
                  porDia[dia].monto += (v.cantidad||0)*(v.precio_unitario||0)
                  porDia[dia].v20 += v.vales_20||0
                  porDia[dia].v30 += v.vales_30||0
                  porDia[dia].v43 += v.vales_43||0
                  porDia[dia].ef += v.efectivo_dist||0
                })

                const filas = Object.entries(porDia).sort((a,b)=>a[0].localeCompare(b[0])).map(([dia,d]) => {
                  const vales = d.v20*20+d.v30*30+d.v43*43
                  const saldo = d.monto - vales - d.ef
                  return `<tr>
                    <td>${dia}</td><td class="center">${d.cantidad}</td>
                    <td class="right">S/${d.monto.toLocaleString('es-PE')}</td>
                    <td class="center">${d.v20||'—'}</td><td class="center">${d.v30||'—'}</td><td class="center">${d.v43||'—'}</td>
                    <td class="right">${d.ef>0?'S/'+d.ef.toLocaleString('es-PE'):'—'}</td>
                    <td class="right" style="color:${saldo<=0?'green':'red'}">${saldo<=0?'✅ Pagado':'S/'+saldo.toLocaleString('es-PE')}</td>
                  </tr>`
                }).join('')

                // Filas de lotes FIFO
                const filasLotes = lotesDistribuidor.map(l => {
                  const ag = l.cerrado || l.cantidad_restante <= 0
                  return `<tr>
                    <td>${l.fecha}</td>
                    <td class="center">S/${l.precio_venta||l.precio_unitario}</td>
                    <td class="center">${l.cantidad_inicial}</td>
                    <td class="center">${l.cantidad_vendida}</td>
                    <td class="center"><b>${l.cantidad_restante}</b></td>
                    <td class="center" style="color:${ag?'#999':'green'}">${ag?'Agotado':l.cantidad_vendida===0?'Sin ventas':'Activo'}</td>
                    <td class="right">S/${(l.cantidad_restante * (l.precio_venta||l.precio_unitario)).toLocaleString('es-PE')}</td>
                  </tr>`
                }).join('')

                const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
                  <title>Rendición ${selected.nombre}</title>
                  <style>
                    *{margin:0;padding:0;box-sizing:border-box}
                    body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#000}
                    h1{text-align:center;font-size:18px;font-weight:900;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px}
                    .sub{text-align:center;color:#555;font-size:11px;margin-bottom:20px}
                    .seccion{margin-bottom:20px}
                    .seccion h2{font-size:13px;font-weight:700;text-transform:uppercase;border-bottom:2px solid #333;padding-bottom:4px;margin-bottom:10px}
                    table{width:100%;border-collapse:collapse;margin-bottom:4px;border:1px solid #999}
                    th{background:#222;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;border:1px solid #444;text-align:left}
                    td{padding:7px 10px;border:1px solid #ccc;font-size:12px}
                    .center{text-align:center}.right{text-align:right}
                    tr:nth-child(even){background:#f5f5f5}
                    .total-row{background:#ddd !important;font-weight:900;font-size:13px}
                    .resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
                    .res-item{border:2px solid #333;border-radius:6px;padding:10px;text-align:center}
                    .res-item .label{font-size:10px;color:#555;text-transform:uppercase;font-weight:600;margin-bottom:4px}
                    .res-item .valor{font-size:16px;font-weight:900}
                    .firma-area{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:50px}
                    .firma{border-top:2px solid #000;padding-top:8px;text-align:center;font-size:11px;color:#333;font-weight:600}
                    @media print{button{display:none}body{padding:10px}}
                  </style></head><body>
                  <button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 16px;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">🖨️ Imprimir</button>

                  <h1>Rendición de ventas — ${selected.nombre}</h1>
                  <p class="sub">${tituloPeriodo}</p>
                  <p class="sub">Centro Gas Paucara · Generado el ${new Date().toLocaleDateString('es-PE', {day:'2-digit',month:'long',year:'numeric'})}</p>

                  <div class="seccion">
                    <h2>Detalle de ventas por día</h2>
                    <table>
                      <thead><tr>
                        <th>Fecha</th><th class="center">Cant.</th><th class="right">Monto</th>
                        <th class="center">V.S/20</th><th class="center">V.S/30</th><th class="center">V.S/43</th>
                        <th class="right">Efectivo</th><th class="right">Saldo día</th>
                      </tr></thead>
                      <tbody>${filas}
                        <tr class="total-row">
                          <td>TOTAL</td><td class="center">${totalCant}</td>
                          <td class="right">S/${totalMonto.toLocaleString('es-PE')}</td>
                          <td class="center">${tv20||'—'}</td><td class="center">${tv30||'—'}</td><td class="center">${tv43||'—'}</td>
                          <td class="right">${tEf>0?'S/'+tEf.toLocaleString('es-PE'):'—'}</td>
                          <td class="right" style="color:${tSaldo<=0?'green':'red'}">${tSaldo<=0?'✅ Pagado':'S/'+tSaldo.toLocaleString('es-PE')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div class="seccion">
                    <h2>Lotes de precio (FIFO)</h2>
                    <table>
                      <thead><tr>
                        <th>Fecha lote</th><th class="center">Precio/bal.</th>
                        <th class="center">Inicial</th><th class="center">Vendidos</th>
                        <th class="center">Restantes</th><th class="center">Estado</th>
                        <th class="right">Valor restante</th>
                      </tr></thead>
                      <tbody>${filasLotes}</tbody>
                    </table>
                  </div>

                  <div class="firma-area">
                    <div class="firma">Firma del distribuidor</div>
                    <div class="firma">Firma del administrador</div>
                  </div>
                  <p style="text-align:center;margin-top:24px;font-size:10px;color:#777">Centro Gas Paucara — ${new Date().toLocaleDateString('es-PE')}</p>
                </body></html>`

                const ventana = window.open('', '_blank', 'width=900,height=700')
                ventana.document.write(html)
                ventana.document.close()
                ventana.focus()
              }}
              style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid var(--app-card-border)',background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontWeight:500,marginTop:8}}>
              🖨️ Imprimir rendición
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
