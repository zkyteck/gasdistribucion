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

  // Vista Alazan — Sistema de períodos por reposición
  const TOTAL_BALONES = 500
  const [periodoActivo, setPeriodoActivo] = useState('actual')

  // Cargas ordenadas = límites de períodos
  const cargasOrd = [...(cargasDist||[])].sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''))

  // Agrupar ventas por día dentro de un rango de fechas
  const agruparDias = (ventas) => {
    const m = {}
    ventas.forEach(v => {
      const dia = new Date(v.fecha).toLocaleDateString('en-CA',{timeZone:'America/Lima'})
      if(!m[dia]) m[dia] = {cantidad:0,monto:0,v20:0,v30:0,v43:0,efectivo:0}
      m[dia].cantidad += v.cantidad||0
      m[dia].monto += (v.cantidad||0)*(v.precio_unitario||0)
      m[dia].v20 += v.vales_20||0; m[dia].v30 += v.vales_30||0
      m[dia].v43 += v.vales_43||0; m[dia].efectivo += v.efectivo_dist||0
    })
    return m
  }

  // Calcular todos los períodos
  const periodos = cargasOrd.map((carga, i) => {
    const sig = cargasOrd[i+1]
    const fi = (carga.fecha||'').substring(0,10)
    const ff = sig ? (sig.fecha||'').substring(0,10) : null
    const ventas = ventasDistribuidor.filter(v => {
      const fv = (v.fecha||'').substring(0,10)
      return ff ? fv >= fi && fv < ff : fv >= fi
    })
    // Balance inicial: período 1 = carga fresca, siguientes = acumulado
    let llenosIni, vaciosIni
    if(i===0) { llenosIni = carga.cantidad; vaciosIni = 0 }
    else {
      const prev = periodos[i-1] // ya calculado
      llenosIni = (prev?.llenos_fin||0) + carga.cantidad
      vaciosIni = Math.max(0, (prev?.vacios_fin||0) - (carga.descargados||0))
    }
    const dias = Object.keys(agruparDias(ventas)).sort()
    const porDia = agruparDias(ventas)
    let ll = llenosIni, vv = vaciosIni
    const bal = {}
    dias.forEach(d => { ll -= porDia[d].cantidad; vv += porDia[d].cantidad; bal[d] = {llenos:ll,vacios:vv,total:ll+vv} })
    return {
      numero:i+1, carga, es_actual:!sig,
      fecha_inicio:fi, fecha_fin:ff,
      llenosIni, vaciosIni, llenos_fin:ll, vacios_fin:vv,
      ventas, porDia, dias, bal,
      totalVendido: ventas.reduce((s,v)=>s+(v.cantidad||0),0),
      totalMonto: ventas.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0),
    }
  })

  // Ventas antes del primer período (historial previo)
  const primeraFecha = cargasOrd[0]?.fecha?.substring(0,10)
  const ventasPrevias = primeraFecha
    ? ventasDistribuidor.filter(v=>(v.fecha||'').substring(0,10)<primeraFecha)
    : ventasDistribuidor
  const porDiaPrevio = agruparDias(ventasPrevias)
  const diasPrevios = Object.keys(porDiaPrevio).sort()

  const periodoVisible = periodoActivo==='previo' ? null : periodos.find(p=>String(p.numero)===String(periodoActivo)) || periodos[periodos.length-1]
  const esPrevio = periodoActivo==='previo'

  const colGrid = '0.9fr 0.5fr 0.9fr 0.5fr 0.5fr 0.5fr 0.8fr 0.6fr 0.6fr 0.4fr'
  const hdrs = ['Fecha','Cant.','Monto','V.S/20','V.S/30','V.S/43','Ef.','🟢 Llenos','⚪ Vacíos','✅']

  const FilaVenta = ({dia, d, bal}) => (
    <div style={{display:'grid',gridTemplateColumns:colGrid,borderBottom:'1px solid var(--app-card-border)',minWidth:750}}>
      <div style={{padding:'10px 8px',fontSize:13,fontWeight:600,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{dia}</div>
      <div style={{padding:'10px 8px',fontSize:15,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.cantidad}</div>
      <div style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{d.monto.toLocaleString('es-PE')}</div>
      <div style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v20>0?d.v20:'—'}</div>
      <div style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v30>0?d.v30:'—'}</div>
      <div style={{padding:'10px 8px',fontSize:13,fontWeight:700,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v43>0?d.v43:'—'}</div>
      <div style={{padding:'10px 8px',fontSize:13,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.efectivo>0?`S/${d.efectivo}`:'—'}</div>
      {bal ? <>
        <div style={{padding:'10px 8px',fontSize:15,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{bal.llenos}</div>
        <div style={{padding:'10px 8px',fontSize:15,fontWeight:800,color:'#94a3b8',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{bal.vacios}</div>
        <div style={{padding:'10px 8px',textAlign:'center'}}>
          {bal.total===TOTAL_BALONES
            ? <span style={{fontSize:14,color:'#34d399'}}>✅</span>
            : <span style={{fontSize:11,color:'#f87171',fontWeight:700}}>⚠️<br/>{bal.total}</span>}
        </div>
      </> : <>
        <div style={{padding:'10px 8px',borderRight:'1px solid var(--app-card-border)'}}/>
        <div style={{padding:'10px 8px',borderRight:'1px solid var(--app-card-border)'}}/>
        <div style={{padding:'10px 8px'}}/>
      </>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{background:'var(--app-modal-bg)',border:'1px solid var(--app-modal-border)'}}>
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--app-card-border)'}}>
          <h3 style={{color:'var(--app-text)',fontWeight:700,fontSize:16,margin:0}}>📒 Libro de cuentas — {selected.nombre}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">

          {/* Stats actuales */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {[
              {label:'🟢 Llenos ahora', value:`${selected.stock_actual} bal.`, color:'#34d399'},
              {label:'⚪ Vacíos ahora', value:`${selected.balones_vacios||0} bal.`, color:'#94a3b8'},
              {label:'📊 Total', value:`${(selected.stock_actual||0)+(selected.balones_vacios||0)} bal.`, color:(selected.stock_actual||0)+(selected.balones_vacios||0)===TOTAL_BALONES?'#34d399':'#f87171'},
              {label:'📦 Períodos registrados', value:`${periodos.length}`, color:'#60a5fa'},
            ].map(({label,value,color})=>(
              <div key={label} style={{background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',borderRadius:10,padding:'10px',textAlign:'center'}}>
                <p style={{fontSize:9,color:'var(--app-text-secondary)',margin:'0 0 4px',textTransform:'uppercase'}}>{label}</p>
                <p style={{fontSize:16,fontWeight:700,color,margin:0}}>{value}</p>
              </div>
            ))}
          </div>

          {/* Selector de período — dropdown */}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <label style={{fontSize:12,color:'var(--app-text-secondary)',fontWeight:600,whiteSpace:'nowrap'}}>Ver período:</label>
            <select value={periodoActivo} onChange={e=>setPeriodoActivo(e.target.value)} className="input" style={{maxWidth:320,fontSize:13}}>
              {diasPrevios.length>0&&<option value="previo">📋 Historial previo</option>}
              {[...periodos].reverse().map(p=>(
                <option key={p.numero} value={String(p.numero)}>
                  {p.es_actual?'🟢 ':''}Período {p.numero}{p.es_actual?' (actual)':''} — {p.fecha_inicio}{p.fecha_fin?` → ${p.fecha_fin}`:' → hoy'} | {p.totalVendido} bal.
                </option>
              ))}
            </select>
          </div>

          {/* Contenido del período seleccionado */}
          <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden',overflowX:'auto'}}>

            {/* Header tabla */}
            <div style={{display:'grid',gridTemplateColumns:colGrid,background:'var(--app-accent)',minWidth:750}}>
              {hdrs.map(h=>(
                <div key={h} style={{padding:'10px 8px',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase',borderRight:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>{h}</div>
              ))}
            </div>

            {/* Historial previo */}
            {esPrevio && (
              <>
                <div style={{background:'rgba(148,163,184,0.06)',borderBottom:'1px solid var(--app-card-border)',padding:'8px 14px'}}>
                  <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>
                    📋 Historial previo al primer período — {ventasPrevias.reduce((s,v)=>s+(v.cantidad||0),0)} bal. vendidos
                  </p>
                </div>
                {diasPrevios.length===0
                  ? <div style={{padding:'20px',textAlign:'center',color:'var(--app-text-secondary)',fontSize:13}}>Sin ventas previas</div>
                  : diasPrevios.map((dia,i)=><FilaVenta key={dia} dia={dia} d={porDiaPrevio[dia]} bal={null}/>)
                }
              </>
            )}

            {/* Período con reposición y balance */}
            {!esPrevio && periodoVisible && (
              <>
                {/* Fila reposición */}
                <div style={{background:'rgba(96,165,250,0.10)',borderBottom:'2px solid rgba(96,165,250,0.4)',padding:'12px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:22}}>🔵</span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:13,fontWeight:800,color:'#60a5fa',margin:0}}>
                        REPOSICIÓN — {periodoVisible.carga.fecha}
                      </p>
                      <div style={{display:'flex',gap:20,marginTop:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:12,color:'#34d399',fontWeight:700}}>✅ Recibe: +{periodoVisible.carga.cantidad} llenos</span>
                        {periodoVisible.carga.descargados>0&&<span style={{fontSize:12,color:'#94a3b8',fontWeight:700}}>📤 Entrega: {periodoVisible.carga.descargados} vacíos al proveedor</span>}
                        {periodoVisible.carga.notas&&<span style={{fontSize:11,color:'var(--app-text-secondary)',fontStyle:'italic'}}>{periodoVisible.carga.notas}</span>}
                      </div>
                      <div style={{marginTop:6,display:'flex',gap:16,alignItems:'center'}}>
                        <span style={{fontSize:12,color:'var(--app-text-secondary)'}}>Inicio período:</span>
                        <span style={{fontSize:13,fontWeight:700,color:'#34d399'}}>{periodoVisible.llenosIni} 🟢 llenos</span>
                        <span style={{fontSize:13,fontWeight:700,color:'#94a3b8'}}>{periodoVisible.vaciosIni} ⚪ vacíos</span>
                        <span style={{fontSize:13,fontWeight:800,color:'#34d399'}}>
                          = {periodoVisible.llenosIni+periodoVisible.vaciosIni} balones
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filas de ventas con balance */}
                {periodoVisible.dias.length===0
                  ? <div style={{padding:'20px',textAlign:'center',color:'var(--app-text-secondary)',fontSize:13}}>Sin ventas registradas en este período</div>
                  : periodoVisible.dias.map(dia=><FilaVenta key={dia} dia={dia} d={periodoVisible.porDia[dia]} bal={periodoVisible.bal[dia]}/>)
                }

                {/* Total del período */}
                {periodoVisible.dias.length>0&&(
                  <div style={{display:'grid',gridTemplateColumns:colGrid,background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)',minWidth:750}}>
                    <div style={{padding:'12px 8px',fontWeight:800,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)',fontSize:12}}>TOTAL</div>
                    <div style={{padding:'12px 8px',fontSize:18,fontWeight:800,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.totalVendido}</div>
                    <div style={{padding:'12px 8px',fontSize:15,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{periodoVisible.totalMonto.toLocaleString('es-PE')}</div>
                    <div style={{padding:'12px 8px',fontSize:14,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.ventas.reduce((s,v)=>s+(v.vales_20||0),0)||'—'}</div>
                    <div style={{padding:'12px 8px',fontSize:14,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.ventas.reduce((s,v)=>s+(v.vales_30||0),0)||'—'}</div>
                    <div style={{padding:'12px 8px',fontSize:14,fontWeight:800,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.ventas.reduce((s,v)=>s+(v.vales_43||0),0)||'—'}</div>
                    <div style={{padding:'12px 8px',fontSize:13,fontWeight:700,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.ventas.reduce((s,v)=>s+(v.efectivo_dist||0),0)>0?`S/${periodoVisible.ventas.reduce((s,v)=>s+(v.efectivo_dist||0),0)}`:'—'}</div>
                    <div style={{padding:'12px 8px',fontSize:16,fontWeight:800,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.es_actual?selected.stock_actual:periodoVisible.llenos_fin}</div>
                    <div style={{padding:'12px 8px',fontSize:16,fontWeight:800,color:'#94a3b8',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{periodoVisible.es_actual?(selected.balones_vacios||0):periodoVisible.vacios_fin}</div>
                    <div style={{padding:'12px 8px',textAlign:'center',fontSize:16,fontWeight:800}}>
                      {(()=>{
                        const tot = periodoVisible.es_actual?(selected.stock_actual||0)+(selected.balones_vacios||0):periodoVisible.llenos_fin+periodoVisible.vacios_fin
                        return <span style={{color:tot===TOTAL_BALONES?'#34d399':'#f87171'}}>{tot===TOTAL_BALONES?'✅':'⚠️'}</span>
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Sin datos */}
            {!esPrevio && !periodoVisible && (
              <div style={{padding:'24px',textAlign:'center',color:'var(--app-text-secondary)',fontSize:13}}>
                Sin períodos registrados. Registra una reposición para iniciar el primer período.
              </div>
            )}
          </div>

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
