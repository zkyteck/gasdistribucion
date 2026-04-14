import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru, inicioDiaPeru, finDiaPeru, nowPeru } from '../lib/fechas'
import { Truck, Plus, Edit2, Package, X, AlertCircle, History, ChevronDown, ChevronUp, DollarSign, RefreshCw, Ticket, Clock, CheckCircle, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { useAuth } from '../context/AuthContext'

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`} style={{background:'var(--app-modal-bg)',border:'1px solid var(--app-modal-border)'}}>
        <div className="flex items-center justify-between px-6 py-4  sticky top-0">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Funciones de impresión ──────────────────────────────────────────────
function imprimirCuenta(cuenta, dist) {
    const totalV20 = (cuenta.abonos||[]).reduce((s,a)=>s+(a.vales_20||0),0)
    const totalV30 = (cuenta.abonos||[]).reduce((s,a)=>s+(a.vales_30||0),0)
    const totalV43 = (cuenta.abonos||[]).reduce((s,a)=>s+(a.vales_43||0),0)
    const totalEfectivo = (cuenta.abonos||[]).reduce((s,a)=>s+(parseFloat(a.efectivo)||0),0)
    const totalYape = (cuenta.abonos||[]).reduce((s,a)=>s+(parseFloat(a.yape)||0),0)

    const html = generarHTMLReporte({
      titulo: `ARREGLO CON ${dist.nombre.toUpperCase()}`,
      periodo: `${cuenta.fecha_inicio} — ${cuenta.fecha_cierre}`,
      cargas: cuenta.cargas || [],
      totalCargado: cuenta.total_cargado,
      totalDescargado: cuenta.total_descargado,
      faltantesBal: cuenta.faltantes_bal,
      montoTotal: cuenta.monto_total,
      saldoAnterior: cuenta.saldo_anterior,
      totalV20, totalV30, totalV43,
      totalEfectivo, totalYape,
      totalPagado: cuenta.total_pagado,
      saldoPendiente: cuenta.saldo_pendiente,
    })
    abrirVentanaImpresion(html)
  }

function imprimirCuentaActiva(dist, cargas, abonos, cuenta) {
    const totalV20 = abonos.reduce((s,a)=>s+(a.vales_20||0),0)
    const totalV30 = abonos.reduce((s,a)=>s+(a.vales_30||0),0)
    const totalV43 = abonos.reduce((s,a)=>s+(a.vales_43||0),0)
    const totalEfectivo = abonos.reduce((s,a)=>s+(parseFloat(a.efectivo)||0),0)
    const totalYape = abonos.reduce((s,a)=>s+(parseFloat(a.yape)||0),0)
    const totalCargado = cargas.reduce((s,c)=>s+(c.cargados||0),0)
    const totalDescargado = cargas.reduce((s,c)=>s+(c.descargados||0),0)
    const montoTotal = cargas.reduce((s,c)=>s+(c.monto||0),0) + (cuenta?.saldo_anterior||0)
    const totalPagado = abonos.reduce((s,a)=>s+(a.total||0),0)
    const saldoPendiente = Math.max(0, montoTotal - totalPagado)
    const faltantesBal = Math.max(0, totalCargado - totalDescargado) + (cuenta?.faltantes_anterior||0)

    const html = generarHTMLReporte({
      titulo: `CUENTA ACTUAL — ${dist.nombre.toUpperCase()}`,
      periodo: `${cuenta?.fecha_inicio || 'Inicio'} — ${new Date().toLocaleDateString('es-PE')}`,
      cargas,
      totalCargado, totalDescargado, faltantesBal,
      montoTotal,
      saldoAnterior: cuenta?.saldo_anterior || 0,
      totalV20, totalV30, totalV43,
      totalEfectivo, totalYape,
      totalPagado, saldoPendiente,
    })
    abrirVentanaImpresion(html)
  }

function generarHTMLReporte({ titulo, periodo, cargas, totalCargado, totalDescargado, faltantesBal, montoTotal, saldoAnterior, totalV20, totalV30, totalV43, totalEfectivo, totalYape, totalPagado, saldoPendiente }) {
    const filasCargas = cargas.map(c => `
      <tr>
        <td>${c.fecha}</td>
        <td class="center">${c.cargados}</td>
        <td class="center">${c.descargados}</td>
        <td class="center">${Math.max(0,c.cargados-c.descargados)}</td>
        <td class="center">S/${c.precio_unitario}</td>
        <td class="right">S/${(c.monto||0).toLocaleString('es-PE')}</td>
      </tr>`).join('')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; color: #000; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
    .periodo { text-align: center; color: #555; margin-bottom: 16px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #333; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
    .center { text-align: center; }
    .right { text-align: right; }
    tr:nth-child(even) { background: #f9f9f9; }
    .total-row { background: #eee !important; font-weight: bold; }
    .seccion { margin-bottom: 14px; }
    .seccion h2 { font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 6px; }
    .pagos-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 12px; }
    .pago-item { border: 1px solid #ddd; border-radius: 4px; padding: 8px; text-align: center; }
    .pago-item .label { font-size: 10px; color: #666; text-transform: uppercase; }
    .pago-item .valor { font-size: 14px; font-weight: bold; margin-top: 2px; }
    .resultado { border: 2px solid #333; border-radius: 6px; padding: 12px; margin-top: 12px; }
    .resultado-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .resultado-total { display: flex; justify-content: space-between; border-top: 1px solid #333; padding-top: 8px; margin-top: 6px; font-size: 15px; font-weight: bold; }
    .firma-area { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .firma { border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 10px; color: #555; }
    @media print { body { padding: 10px; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 16px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">🖨️ Imprimir</button>

  <h1>${titulo}</h1>
  <p class="periodo">${periodo}</p>

  <div class="seccion">
    <h2>Detalle de cargas y descargas</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th class="center">Cargados</th>
          <th class="center">Descargados</th>
          <th class="center">Faltantes</th>
          <th class="center">Precio</th>
          <th class="right">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${filasCargas}
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="center">${totalCargado}</td>
          <td class="center">${totalDescargado}</td>
          <td class="center">${faltantesBal}</td>
          <td></td>
          <td class="right">S/${montoTotal.toLocaleString('es-PE')}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="seccion">
    <h2>Pagos recibidos</h2>
    <div class="pagos-grid">
      <div class="pago-item"><div class="label">Vales S/20</div><div class="valor">${totalV20} vales</div><div style="font-size:11px;color:#666">=S/${(totalV20*20).toLocaleString('es-PE')}</div></div>
      <div class="pago-item"><div class="label">Vales S/30</div><div class="valor">${totalV30} vales</div><div style="font-size:11px;color:#666">=S/${(totalV30*30).toLocaleString('es-PE')}</div></div>
      <div class="pago-item"><div class="label">Vales S/43</div><div class="valor">${totalV43} vales</div><div style="font-size:11px;color:#666">=S/${(totalV43*43).toLocaleString('es-PE')}</div></div>
      <div class="pago-item"><div class="label">Efectivo</div><div class="valor">S/${totalEfectivo.toLocaleString('es-PE')}</div></div>
      <div class="pago-item"><div class="label">Yape</div><div class="valor">S/${totalYape.toLocaleString('es-PE')}</div></div>
      <div class="pago-item" style="background:#f0f0f0"><div class="label">Total pagado</div><div class="valor">S/${totalPagado.toLocaleString('es-PE')}</div></div>
    </div>
  </div>

  <div class="resultado">
    ${saldoAnterior > 0 ? `<div class="resultado-row"><span>Saldo pendiente anterior:</span><span>+ S/${saldoAnterior.toLocaleString('es-PE')}</span></div>` : ''}
    <div class="resultado-row"><span>Monto total a pagar:</span><span>S/${montoTotal.toLocaleString('es-PE')}</span></div>
    <div class="resultado-row"><span>Total pagado:</span><span>- S/${totalPagado.toLocaleString('es-PE')}</span></div>
    <div class="resultado-total">
      <span>${saldoPendiente > 0 ? '⏳ Saldo pendiente:' : '✅ CANCELADO'}</span>
      <span>S/${saldoPendiente.toLocaleString('es-PE')}</span>
    </div>
    ${faltantesBal > 0 ? `<div class="resultado-row" style="margin-top:6px"><span>⚪ Vacíos pendientes de devolución:</span><span>${faltantesBal} balones</span></div>` : ''}
  </div>

  <div class="firma-area">
    <div class="firma">Firma del distribuidor</div>
    <div class="firma">Firma del administrador</div>
  </div>

  <p style="text-align:center;margin-top:20px;font-size:10px;color:#999">Centro Gas Paucara — Generado el ${new Date().toLocaleDateString('es-PE')}</p>
</body>
</html>`
  }

function abrirVentanaImpresion(html) {
    const ventana = window.open('', '_blank', 'width=800,height=600')
    ventana.document.write(html)
    ventana.document.close()
    ventana.focus()
  }
// ── Fin funciones de impresión ───────────────────────────────────────────


// ── Componente ModalHistorial ─────────────────────────────────────────────
function ModalHistorial({ selected, cargasDist, abonosParciales, cuentaActiva, cuentasCerradas, lotesDistribuidor, ventasDistribuidor, rendiciones, supabase, onClose, cargarHistorial, format, es, hoyPeru }) {
  const esCuentaCorriente = selected.modalidad === 'cuenta_corriente'

  if (esCuentaCorriente) {
    // Vista cuenta corriente (Cristian)
    const totalCargado = cargasDist.reduce((s,c) => s+(c.cargados||0), 0)
    const totalDescargado = cargasDist.reduce((s,c) => s+(c.descargados||0), 0)
    const montoTotal = cargasDist.reduce((s,c) => s+(c.monto||0), 0)
    const totalAbonado = abonosParciales.reduce((s,a) => s+(a.total||0), 0)
    const saldoAnterior = cuentaActiva?.saldo_anterior || 0
    const faltantesAnterior = cuentaActiva?.faltantes_anterior || 0
    const faltantesBal = Math.max(0, totalCargado - totalDescargado) + faltantesAnterior
    const montoConSaldo = montoTotal + saldoAnterior
    const saldoPendiente = Math.max(0, montoConSaldo - totalAbonado)
    const lotesActivos = lotesDistribuidor.filter(l => !l.cerrado && l.cantidad_restante > 0)
    const valorCampo = lotesActivos.reduce((s,l) => s + l.cantidad_restante * l.precio_unitario, 0)
    const loteActivo = lotesActivos[0]

    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
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
                {label:'💰 Precio FIFO', value: loteActivo ? `S/${loteActivo.precio_unitario}` : `S/${selected.precio_base}`, color:'#fb923c'},
                {label:'📦 Valor campo', value:`S/${valorCampo.toLocaleString('es-PE')}`, color:'#60a5fa'},
              ].map(({label,value,color}) => (
                <div key={label} style={{background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',borderRadius:10,padding:'10px',textAlign:'center'}}>
                  <p style={{fontSize:9,color:'var(--app-text-secondary)',margin:'0 0 4px',textTransform:'uppercase'}}>{label}</p>
                  <p style={{fontSize:16,fontWeight:700,color,margin:0}}>{value}</p>
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
                <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',background:'var(--app-accent)'}}>
                    {['Fecha','Cargados','Descargados','Faltantes','Precio','Monto'].map(h => (
                      <div key={h} style={{padding:'7px 8px',fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase',borderRight:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>{h}</div>
                    ))}
                  </div>
                  {cargasDist.map((c,i) => (
                    <div key={c.id} style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',borderBottom:i<cargasDist.length-1?'1px solid var(--app-card-border)':'none'}}>
                      <div style={{padding:'8px',fontSize:11,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{c.fecha}</div>
                      <div style={{padding:'8px',fontSize:12,fontWeight:700,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{c.cargados}</div>
                      <div style={{padding:'8px',fontSize:11,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{c.descargados}</div>
                      <div style={{padding:'8px',fontSize:11,color:'#fb923c',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{Math.max(0,c.cargados-c.descargados)}</div>
                      <div style={{padding:'8px',fontSize:11,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{c.precio_unitario}</div>
                      <div style={{padding:'8px',fontSize:12,fontWeight:700,color:'#34d399',textAlign:'center'}}>S/{(c.monto||0).toLocaleString('es-PE')}</div>
                    </div>
                  ))}
                  <div style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)'}}>
                    <div style={{padding:'8px',fontSize:11,fontWeight:700,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)'}}>TOTAL</div>
                    <div style={{padding:'8px',fontSize:13,fontWeight:700,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{totalCargado}</div>
                    <div style={{padding:'8px',fontSize:13,fontWeight:700,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{totalDescargado}</div>
                    <div style={{padding:'8px',fontSize:13,fontWeight:700,color:'#fb923c',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{faltantesBal}</div>
                    <div style={{padding:'8px',borderRight:'1px solid var(--app-card-border)'}}/>
                    <div style={{padding:'8px',fontSize:13,fontWeight:700,color:'#34d399',textAlign:'center'}}>S/{montoConSaldo.toLocaleString('es-PE')}</div>
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
  const ventasPorDia = {}
  ventasDistribuidor.forEach(v => {
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
  const valorCampo = lotesActivos.reduce((s,l) => s + l.cantidad_restante * l.precio_unitario, 0)
  const loteActivo = lotesActivos[0]

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
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
              {label:'💰 Precio FIFO', value:loteActivo?`S/${loteActivo.precio_unitario}`:`S/${selected.precio_base}`, color:'#fb923c'},
              {label:'📦 Valor campo', value:`S/${valorCampo.toLocaleString('es-PE')}`, color:'#60a5fa'},
            ].map(({label,value,color}) => (
              <div key={label} style={{background:'var(--app-card-bg-alt)',border:'1px solid var(--app-card-border)',borderRadius:10,padding:'10px',textAlign:'center'}}>
                <p style={{fontSize:9,color:'var(--app-text-secondary)',margin:'0 0 4px',textTransform:'uppercase'}}>{label}</p>
                <p style={{fontSize:16,fontWeight:700,color,margin:0}}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:'0 0 10px'}}>Rendición de ventas</h4>
            {diasOrdenados.length === 0 ? (
              <div style={{textAlign:'center',padding:'24px',color:'var(--app-text-secondary)',fontSize:13,border:'1px solid var(--app-card-border)',borderRadius:10}}>
                Sin ventas registradas — registra ventas desde Ventas seleccionando el almacén de {selected.nombre}
              </div>
            ) : (
              <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden',overflowX:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.7fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.8fr',background:'var(--app-accent)',minWidth:720}}>
                  {['Fecha','Cant.','Precio','Monto total','V.S/20','V.S/30','V.S/43','Saldo/Efectivo','Estado'].map(h => (
                    <div key={h} style={{padding:'7px 5px',fontSize:9,fontWeight:700,color:'#fff',textTransform:'uppercase',borderRight:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>{h}</div>
                  ))}
                </div>
                {diasOrdenados.map((dia,i) => {
                  const d = ventasPorDia[dia]
                  const precio = d.cantidad > 0 ? d.monto/d.cantidad : 0
                  const totalVales = d.v20*20 + d.v30*30 + d.v43*43
                  const totalPagado = totalVales + d.efectivo
                  const saldo = d.monto - totalPagado
                  const cancelado = saldo <= 0
                  return (
                    <div key={dia} style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.7fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.8fr',borderBottom:i<diasOrdenados.length-1?'1px solid var(--app-card-border)':'none',minWidth:720,background:i%2===0?'transparent':'var(--app-row-alt)'}}>
                      <div style={{padding:'11px 8px',fontSize:13,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center',fontWeight:500}}>{dia}</div>
                      <div style={{padding:'11px 8px',fontSize:14,fontWeight:700,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.cantidad}</div>
                      <div style={{padding:'11px 8px',fontSize:13,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{precio.toFixed(2)}</div>
                      <div style={{padding:'11px 8px',fontSize:14,fontWeight:700,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{d.monto.toLocaleString('es-PE')}</div>
                      <div style={{padding:'11px 8px',fontSize:13,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v20>0?d.v20:'—'}</div>
                      <div style={{padding:'11px 8px',fontSize:13,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v30>0?d.v30:'—'}</div>
                      <div style={{padding:'11px 8px',fontSize:13,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{d.v43>0?d.v43:'—'}</div>
                      <div style={{padding:'11px 8px',fontSize:13,borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>
                        {cancelado
                          ? <span style={{color:'#34d399',fontWeight:700}}>✅ Pagado</span>
                          : <span style={{color:'#f87171',fontWeight:700}}>S/{saldo.toLocaleString('es-PE')}</span>
                        }
                        {d.efectivo > 0 && <p style={{fontSize:9,color:'#34d399',margin:'2px 0 0'}}>ef. S/{d.efectivo}</p>}
                      </div>
                      <div style={{padding:'8px 5px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:4,background:cancelado?'rgba(52,211,153,0.15)':'rgba(251,146,60,0.15)',color:cancelado?'#34d399':'#fb923c'}}>
                          {cancelado?'Pagado':'Pendiente'}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {/* Fila totales */}
                {diasOrdenados.length > 1 && (() => {
                  const tCant = ventasDistribuidor.reduce((s,v)=>s+(v.cantidad||0),0)
                  const tMonto = ventasDistribuidor.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)
                  const tv20 = ventasDistribuidor.reduce((s,v)=>s+(v.vales_20||0),0)
                  const tv30 = ventasDistribuidor.reduce((s,v)=>s+(v.vales_30||0),0)
                  const tv43 = ventasDistribuidor.reduce((s,v)=>s+(v.vales_43||0),0)
                  const tEf = ventasDistribuidor.reduce((s,v)=>s+(v.efectivo_dist||0),0)
                  const tVales = tv20*20+tv30*30+tv43*43
                  const tSaldo = tMonto - tVales - tEf
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 0.6fr 0.7fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.8fr',background:'var(--app-card-bg-alt)',borderTop:'2px solid var(--app-accent)',minWidth:720}}>
                      <div style={{padding:'10px 8px',fontSize:12,fontWeight:700,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)'}}>TOTAL</div>
                      <div style={{padding:'10px 8px',fontSize:14,fontWeight:700,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tCant}</div>
                      <div style={{padding:'8px 5px',borderRight:'1px solid var(--app-card-border)'}}/>
                      <div style={{padding:'10px 8px',fontSize:14,fontWeight:700,color:'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>S/{tMonto.toLocaleString('es-PE')}</div>
                      <div style={{padding:'8px 5px',fontSize:11,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tv20||'—'}</div>
                      <div style={{padding:'8px 5px',fontSize:11,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tv30||'—'}</div>
                      <div style={{padding:'8px 5px',fontSize:11,color:'#fde047',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{tv43||'—'}</div>
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
          {/* Lotes FIFO */}
          {lotesDistribuidor.length > 0 && (
            <div>
              <h4 style={{fontSize:13,fontWeight:700,color:'var(--app-text)',margin:'0 0 10px'}}>Lotes de precio (FIFO)</h4>
              <div style={{border:'1px solid var(--app-card-border)',borderRadius:10,overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr',background:'var(--app-card-bg-alt)',borderBottom:'1px solid var(--app-card-border)'}}>
                  {['Fecha','Precio','Inicial','Vendidos','Restantes','Estado'].map(h => (
                    <div key={h} style={{padding:'7px 8px',fontSize:9,fontWeight:700,color:'var(--app-text-secondary)',textTransform:'uppercase',borderRight:'1px solid var(--app-card-border)'}}>{h}</div>
                  ))}
                </div>
                {lotesDistribuidor.map((lote,i) => {
                  const ag = lote.cerrado||lote.cantidad_restante<=0
                  return (
                    <div key={lote.id} style={{display:'grid',gridTemplateColumns:'1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr',borderBottom:i<lotesDistribuidor.length-1?'1px solid var(--app-card-border)':'none'}}>
                      <div style={{padding:'8px',fontSize:11,color:'var(--app-text)',borderRight:'1px solid var(--app-card-border)'}}>{lote.fecha}</div>
                      <div style={{padding:'8px',fontSize:12,fontWeight:700,color:'#fb923c',borderRight:'1px solid var(--app-card-border)'}}>{lote.precio_unitario}</div>
                      <div style={{padding:'8px',fontSize:11,color:'var(--app-text-secondary)',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{lote.cantidad_inicial}</div>
                      <div style={{padding:'8px',fontSize:11,color:'#60a5fa',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{lote.cantidad_vendida}</div>
                      <div style={{padding:'8px',fontSize:12,fontWeight:700,color:ag?'#9ca3af':'#34d399',borderRight:'1px solid var(--app-card-border)',textAlign:'center'}}>{lote.cantidad_restante}</div>
                      <div style={{padding:'8px',textAlign:'center'}}>
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:ag?'rgba(107,114,128,0.15)':'rgba(52,211,153,0.15)',color:ag?'#9ca3af':'#34d399'}}>
                          {ag?'Agotado':lote.cantidad_vendida===0?'Nuevo':'Activo'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function Distribuidores() {
  const { perfil } = useAuth()
  const [distribuidores, setDistribuidores] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'nuevo'|'editar'|'reponer'|'historial'|'cuenta'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', almacen_id: '', precio_base: '' })
  const [repoForm, setRepoForm] = useState({ cantidad: '', notas: '' })
  const [cuentaForm, setCuentaForm] = useState({ vales20: '', vales43: '', adelantos: '', balones_devueltos: '', balones_vendidos: '', notas: '', fecha: hoyPeru() })
  const [historial, setHistorial] = useState([])
  const [lotesDistribuidor, setLotesDistribuidor] = useState([])
  const [ventasDistribuidor, setVentasDistribuidor] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [valesDist, setValesDist] = useState([])
  const [rendiciones, setRendiciones] = useState([])
  const [abonoModal, setAbonoModal] = useState(null)
  const [abonoForm, setAbonoForm] = useState({ efectivo: '', vales20: '', vales43: '', balones_devueltos: '', vacios_extra: '', notas: '', modo: 'abono', fecha: hoyPeru() })
  const [savingAbono, setSavingAbono] = useState(false)
  // Estados para cuenta corriente (Cristian)
  const [cargaModal, setCargaModal] = useState(false)
  const [cargaForm, setCargaForm] = useState({ cargados: '', descargados: '', notas: '', fecha: hoyPeru() })
  const [abonoParciModal, setAbonoParciModal] = useState(false)
  const [abonoParciForm, setAbonoParciForm] = useState({ vales20: '', vales30: '', vales43: '', efectivo: '', yape: '', notas: '', fecha: hoyPeru() })
  const [arregloModal, setArregloModal] = useState(false)
  const [arregloForm, setArregloForm] = useState({ vales20: '', vales30: '', vales43: '', efectivo: '', yape: '', notas: '', fecha: hoyPeru() })
  const [cuentaActiva, setCuentaActiva] = useState(null)
  const [cuentasCerradas, setCuentasCerradas] = useState([])
  const [cargasDist, setCargasDist] = useState([])
  const [abonosParciales, setAbonosParciales] = useState([])
  const [acuentaDist, setAcuentaDist] = useState([]) // registros a cuenta del distribuidor seleccionado
  const [acuentaModal, setAcuentaModal] = useState(false)
  const [acuentaForm, setAcuentaForm] = useState({ nombre_cliente: '', vales_20: '', vales_43: '', balones: '', notas: '', fecha: hoyPeru() })
  const [savingAcuenta, setSavingAcuenta] = useState(false)
  const [loadingAcuenta, setLoadingAcuenta] = useState(false)
  const [clientes, setClientes] = useState([])
  const [valeForm, setValeForm] = useState({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre: '', telefono: '' })
  const [subModal, setSubModal] = useState(null) // 'clienteRapido'

  useEffect(() => { cargar() }, [])

  async function cargarValesDist(distId) {
    const { data } = await supabase.from('vales_distribuidor')
      .select('*').eq('distribuidor_id', distId).order('fecha', { ascending: false })
    setValesDist(data || [])
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    setClientes(data || [])
  }

  // ── Funciones cuenta corriente (Cristian) ──────────────────────────────
  async function cargarCuentaCorriente(distId) {
    const [{ data: cuenta }, { data: cargas }, { data: abonos }, { data: cerradas }] = await Promise.all([
      supabase.from('cuentas_corrientes_distribuidor')
        .select('*').eq('distribuidor_id', distId).eq('estado', 'abierta').single(),
      supabase.from('cargas_distribuidor')
        .select('*').eq('distribuidor_id', distId).order('fecha', { ascending: true }),
      supabase.from('abonos_distribuidor_parcial')
        .select('*').eq('distribuidor_id', distId).order('fecha', { ascending: true }),
      supabase.from('cuentas_corrientes_distribuidor')
        .select('*').eq('distribuidor_id', distId).eq('estado', 'cerrada')
        .order('fecha_cierre', { ascending: false }).limit(20)
    ])
    setCuentaActiva(cuenta || null)
    setCargasDist(cargas || [])
    setAbonosParciales(abonos || [])
    // Para cada cuenta cerrada, cargar sus cargas y abonos
    const cerradasConDetalle = await Promise.all((cerradas || []).map(async c => {
      const [{ data: crgsCuenta }, { data: abonosCuenta }] = await Promise.all([
        supabase.from('cargas_distribuidor').select('*').eq('cuenta_id', c.id).order('fecha', { ascending: true }),
        supabase.from('abonos_distribuidor_parcial').select('*').eq('cuenta_id', c.id).order('fecha', { ascending: true })
      ])
      return { ...c, cargas: crgsCuenta || [], abonos: abonosCuenta || [] }
    }))
    setCuentasCerradas(cerradasConDetalle)
  }

  async function guardarCarga() {
    const cant = parseInt(cargaForm.cargados) || 0
    const desc = parseInt(cargaForm.descargados) || 0
    if (cant <= 0) { setError('Ingresa la cantidad a cargar'); return }
    setSaving(true); setError('')
    // Obtener precio FIFO activo
    const { data: loteActivo } = await supabase.from('lotes_distribuidor')
      .select('*').eq('distribuidor_id', selected.id).eq('cerrado', false)
      .gt('cantidad_restante', 0).order('fecha', { ascending: true }).limit(1).single()
    const precio = loteActivo?.precio_unitario || selected.precio_base || 0
    const monto = cant * precio

    // Obtener o crear cuenta activa
    let cuentaId = cuentaActiva?.id
    if (!cuentaId) {
      const { data: nuevaCuenta } = await supabase.from('cuentas_corrientes_distribuidor').insert({
        distribuidor_id: selected.id,
        fecha_inicio: cargaForm.fecha || hoyPeru(),
        saldo_anterior: 0, faltantes_anterior: 0,
        estado: 'abierta'
      }).select().single()
      cuentaId = nuevaCuenta?.id
    }

    // Registrar carga
    await supabase.from('cargas_distribuidor').insert({
      distribuidor_id: selected.id,
      cuenta_id: cuentaId,
      fecha: cargaForm.fecha || hoyPeru(),
      cargados: cant,
      descargados: desc,
      precio_unitario: precio,
      monto,
      notas: cargaForm.notas || null
    })

    // Actualizar almacén: descuenta llenos, suma vacíos
    const almacen = almacenes.find(a => a.id === selected.almacen_id)
    if (almacen) {
      await supabase.from('almacenes').update({
        stock_actual: Math.max(0, (almacen.stock_actual || 0) - cant),
        balones_vacios: (almacen.balones_vacios || 0) + desc,
        vacios_10kg: (almacen.vacios_10kg || 0) + desc,
        updated_at: new Date().toISOString()
      }).eq('id', selected.almacen_id)
      // stock_por_tipo
      const { data: spt } = await supabase.from('stock_por_tipo')
        .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
      if (spt) await supabase.from('stock_por_tipo')
        .update({ stock_actual: Math.max(0, spt.stock_actual - cant) })
        .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
    }

    // Aplicar FIFO al lote
    if (cant > 0 && loteActivo) {
      const nuevaVendida = (loteActivo.cantidad_vendida || 0) + cant
      const nuevaRestante = Math.max(0, loteActivo.cantidad_restante - cant)
      await supabase.from('lotes_distribuidor').update({
        cantidad_vendida: nuevaVendida,
        cantidad_restante: nuevaRestante,
        cerrado: nuevaRestante <= 0
      }).eq('id', loteActivo.id)
    }

    setSaving(false)
    setCargaModal(false)
    setCargaForm({ cargados: '', descargados: '', notas: '', fecha: hoyPeru() })
    await cargarCuentaCorriente(selected.id)
    cargar()
  }

  async function guardarAbonoParcial() {
    const v20 = parseInt(abonoParciForm.vales20) || 0
    const v30 = parseInt(abonoParciForm.vales30) || 0
    const v43 = parseInt(abonoParciForm.vales43) || 0
    const efectivo = parseFloat(abonoParciForm.efectivo) || 0
    const yape = parseFloat(abonoParciForm.yape) || 0
    const total = v20*20 + v30*30 + v43*43 + efectivo + yape
    if (total <= 0) { setError('Ingresa al menos un pago'); return }
    setSaving(true); setError('')

    await supabase.from('abonos_distribuidor_parcial').insert({
      distribuidor_id: selected.id,
      cuenta_id: cuentaActiva?.id || null,
      fecha: abonoParciForm.fecha || hoyPeru(),
      vales_20: v20, vales_30: v30, vales_43: v43,
      efectivo, yape, total,
      notas: abonoParciForm.notas || null
    })

    setSaving(false)
    setAbonoParciModal(false)
    setAbonoParciForm({ vales20: '', vales30: '', vales43: '', efectivo: '', yape: '', notas: '', fecha: hoyPeru() })
    await cargarCuentaCorriente(selected.id)
  }

  async function guardarArreglo() {
    const v20 = parseInt(arregloForm.vales20) || 0
    const v30 = parseInt(arregloForm.vales30) || 0
    const v43 = parseInt(arregloForm.vales43) || 0
    const efectivo = parseFloat(arregloForm.efectivo) || 0
    const yape = parseFloat(arregloForm.yape) || 0
    const pagoHoy = v20*20 + v30*30 + v43*43 + efectivo + yape

    // Calcular totales de la cuenta
    const totalCargado = cargasDist.reduce((s,c) => s+(c.cargados||0), 0)
    const totalDescargado = cargasDist.reduce((s,c) => s+(c.descargados||0), 0)
    const montoTotal = cargasDist.reduce((s,c) => s+(c.monto||0), 0)
    const saldoAnterior = cuentaActiva?.saldo_anterior || 0
    const faltantesAnterior = cuentaActiva?.faltantes_anterior || 0
    const totalAbonado = abonosParciales.reduce((s,a) => s+(a.total||0), 0)
    const totalPagado = totalAbonado + pagoHoy
    const montoConSaldo = montoTotal + saldoAnterior
    const saldoPendiente = Math.max(0, montoConSaldo - totalPagado)
    const faltantesBal = Math.max(0, totalCargado - totalDescargado)
    const cancelado = saldoPendiente <= 0

    setSaving(true); setError('')

    // Registrar pago de hoy como abono parcial
    if (pagoHoy > 0) {
      await supabase.from('abonos_distribuidor_parcial').insert({
        distribuidor_id: selected.id,
        cuenta_id: cuentaActiva?.id || null,
        fecha: arregloForm.fecha || hoyPeru(),
        vales_20: v20, vales_30: v30, vales_43: v43,
        efectivo, yape, total: pagoHoy,
        notas: 'Pago en arreglo'
      })
    }

    // Cerrar cuenta actual
    if (cuentaActiva?.id) {
      await supabase.from('cuentas_corrientes_distribuidor').update({
        fecha_cierre: arregloForm.fecha || hoyPeru(),
        total_cargado: totalCargado,
        total_descargado: totalDescargado,
        faltantes_bal: faltantesBal + faltantesAnterior,
        monto_total: montoConSaldo,
        total_pagado: totalPagado,
        saldo_pendiente: saldoPendiente,
        estado: 'cerrada'
      }).eq('id', cuentaActiva.id)
    }

    // Registrar ingreso en ventas para reportes
    if (totalPagado > 0 && selected.almacen_id) {
      await supabase.from('ventas').insert({
        almacen_id: selected.almacen_id,
        tipo_balon: '10kg',
        fecha: new Date().toISOString(),
        cantidad: totalCargado,
        precio_unitario: totalCargado > 0 ? montoTotal/totalCargado : 0,
        metodo_pago: 'arreglo_distribuidor',
        notas: `Arreglo ${selected.nombre} — pagado S/${totalPagado.toLocaleString()}${saldoPendiente>0?' — pendiente S/'+saldoPendiente.toLocaleString():''}`,
        usuario_id: perfil?.id || null
      })
    }

    // Abrir nueva cuenta con pendientes
    await supabase.from('cuentas_corrientes_distribuidor').insert({
      distribuidor_id: selected.id,
      fecha_inicio: arregloForm.fecha || hoyPeru(),
      saldo_anterior: saldoPendiente,
      faltantes_anterior: faltantesBal + faltantesAnterior,
      estado: 'abierta'
    })

    setSaving(false)
    setArregloModal(false)
    setArregloForm({ vales20: '', vales30: '', vales43: '', efectivo: '', yape: '', notas: '', fecha: hoyPeru() })
    await cargarCuentaCorriente(selected.id)
    cargar()
  }
  // Funciones de impresión definidas fuera del componente
  // imprimirCuenta, imprimirCuentaActiva, generarHTMLReporte, abrirVentanaImpresion

  // ── Fin funciones cuenta corriente ─────────────────────────────────────

  async function cargar() {
    setLoading(true)
    const [{ data: d }, { data: a }, { data: vp }, { data: rp }] = await Promise.all([
      supabase.from('distribuidores').select('*, almacenes(nombre, stock_actual, balones_vacios, vacios_5kg, vacios_10kg, vacios_45kg)').eq('activo', true).order('nombre'),
      supabase.from('almacenes').select('id, nombre, stock_actual, balones_vacios').eq('activo', true),
      supabase.from('vales_distribuidor').select('distribuidor_id').eq('estado', 'pendiente'),
      supabase.from('cuentas_distribuidor').select('distribuidor_id, balones_faltantes').neq('estado', 'cancelado')
    ])
    const distConVales = (d || []).map(dist => ({
      ...dist,
      vales_pendientes: (vp || []).filter(v => v.distribuidor_id === dist.id).length,
      balones_por_cobrar: (rp || []).filter(r => r.distribuidor_id === dist.id).reduce((s, r) => s + (r.balones_faltantes || 0), 0)
    }))
    // Enriquecer distribuidores con stock real del almacén asignado
    const distEnriquecidos = (distConVales).map(dist => {
      const almacenAsignado = (a || []).find(alm => alm.id === dist.almacen_id)
      return {
        ...dist,
        stock_actual: almacenAsignado?.stock_actual || 0,
        balones_vacios: almacenAsignado?.balones_vacios || 0,
        balones_pendientes_devolucion: almacenAsignado?.balones_pendientes_devolucion || 0,
      }
    })
    setDistribuidores(distEnriquecidos)
    setAlmacenes(a || [])
    setLoading(false)
  }

  async function cargarHistorial(distId) {
    // Obtener almacen_id del distribuidor seleccionado
    const dist = distribuidores.find(d => d.id === distId)
    const almacenId = dist?.almacen_id

    // Si es cuenta corriente, cargar también sus datos
    if (dist?.modalidad === 'cuenta_corriente') {
      await cargarCuentaCorriente(distId)
    }

    const [{ data: repos }, { data: rends }, { data: movs }, { data: lotes }, { data: ventas }] = await Promise.all([
      supabase.from('reposiciones_distribuidor')
        .select('*, almacenes(nombre)').eq('distribuidor_id', distId).order('fecha', { ascending: false }).limit(20),
      supabase.from('cuentas_distribuidor')
        .select('*').eq('distribuidor_id', distId).order('periodo_fin', { ascending: false }).limit(30),
      almacenId ? supabase.from('movimientos_stock')
        .select('*').eq('almacen_id', almacenId)
        .in('tipo', ['traslado', 'entrada', 'compra', 'ajuste_manual'])
        .order('created_at', { ascending: false }).limit(20) : { data: [] },
      supabase.from('lotes_distribuidor')
        .select('*').eq('distribuidor_id', distId).order('fecha', { ascending: false }).limit(30),
      almacenId ? supabase.from('ventas')
        .select('*')
        .eq('almacen_id', almacenId)
        .not('metodo_pago', 'eq', 'credito_distribuidor')
        .order('fecha', { ascending: false }).limit(200) : { data: [] }
    ])
    setHistorial(repos || [])
    setRendiciones(rends || [])
    setMovimientos(movs || [])
    setLotesDistribuidor(lotes || [])
    setVentasDistribuidor(ventas || [])
  }

  async function cargarMovimientos(distId) {
    const { data } = await supabase.from('movimientos_stock')
      .select('*').eq('distribuidor_id', distId).order('created_at', { ascending: false }).limit(30)
    setMovimientos(data || [])
  }

  async function abrirVales(d) {
    setSelected(d)
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
    setError('')
    await cargarValesDist(d.id)
    await cargarClientes()
    setModal('vales')
  }

  async function guardarVale() {
    if (!form_vale_nombre) { setError('Ingresa el nombre del cliente'); return }
    setSaving(true); setError('')
    const monto = valeForm.tipo_vale === '20' ? 20 : 43
    const { error: e } = await supabase.from('vales_distribuidor').insert({
      distribuidor_id: selected.id,
      nombre_cliente: valeForm.nombre_cliente,
      cliente_id: valeForm.cliente_id || null,
      tipo_vale: valeForm.tipo_vale,
      monto,
      fecha: valeForm.fecha,
      notas: valeForm.notas,
      estado: 'pendiente'
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
    await cargarValesDist(selected.id)
  }

  async function marcarValeCobrado(vale) {
    await supabase.from('vales_distribuidor').update({ estado: 'cobrado', fecha_cobro: hoyPeru(), updated_at: new Date().toISOString() }).eq('id', vale.id)
    await cargarValesDist(selected.id)
  }

  async function anularVale(vale) {
    if (!confirm('¿Anular este vale?')) return
    await supabase.from('vales_distribuidor').update({ estado: 'anulado', updated_at: new Date().toISOString() }).eq('id', vale.id)
    await cargarValesDist(selected.id)
  }

  async function guardarClienteRapido() {
    if (!clienteRapidoForm.nombre) return
    const { data: nc } = await supabase.from('clientes').insert({
      nombre: clienteRapidoForm.nombre, telefono: clienteRapidoForm.telefono, tipo: 'general'
    }).select().single()
    await cargarClientes()
    if (nc) setValeForm(f => ({...f, nombre_cliente: nc.nombre, cliente_id: nc.id}))
    setClienteRapidoForm({ nombre: '', telefono: '' })
    setSubModal(null)
  }

  const form_vale_nombre = valeForm.nombre_cliente

  async function guardarAbono() {
    if (!selected) return
    const modo = abonoForm.modo || 'abono'
    const efectivo = parseFloat(abonoForm.efectivo) || 0
    const vales20 = parseInt(abonoForm.vales20) || 0
    const vales43 = parseInt(abonoForm.vales43) || 0
    const vaciosDevueltos = parseInt(abonoForm.vacios_extra) || 0
    const balonesVendidos = parseInt(abonoForm.balones_devueltos) || 0
    const totalAbono = efectivo + (vales20 * 20) + (vales43 * 43)

    // Validar según modo
    if (modo === 'abono' && totalAbono === 0 && vaciosDevueltos === 0) {
      return // abono parcial: necesita al menos algo
    }
    if (modo === 'totalizar' && !balonesVendidos) {
      return // totalizar: necesita balones vendidos
    }

    setSavingAbono(true)

    // Registrar en abonos_distribuidor
    await supabase.from('abonos_distribuidor').insert({
      distribuidor_id: selected.id,
      fecha: hoyPeru(),
      efectivo,
      vales_20: vales20,
      vales_43: vales43,
      balones_devueltos: vaciosDevueltos,
      total_abonado: totalAbono,
      notas: `[${modo === 'totalizar' ? 'Totalización' : 'Abono'}] ${abonoForm.notas || ''}`
    })

    // Actualizar almacén según modo
    if (selected.almacen_id) {
      const { data: almFresco } = await supabase.from('almacenes')
        .select('stock_actual, balones_vacios, vacios_10kg, balones_pendientes_devolucion')
        .eq('id', selected.almacen_id).single()
      if (almFresco) {
        if (modo === 'totalizar') {
          // Totalizar: descuenta llenos vendidos, suma vacíos devueltos, marca pendientes
          const balonesSinDevolver = Math.max(0, balonesVendidos - vaciosDevueltos)
          await supabase.from('almacenes').update({
            stock_actual: Math.max(0, (almFresco.stock_actual || 0) - vaciosDevueltos),
            balones_vacios: (almFresco.balones_vacios || 0) + vaciosDevueltos,
            vacios_10kg: (almFresco.vacios_10kg || 0) + vaciosDevueltos,
            balones_pendientes_devolucion: Math.max(0, (almFresco.balones_pendientes_devolucion || 0) + balonesSinDevolver),
            updated_at: new Date().toISOString()
          }).eq('id', selected.almacen_id)
          // Actualizar stock_por_tipo
          const { data: spt } = await supabase.from('stock_por_tipo')
            .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
          if (spt) {
            await supabase.from('stock_por_tipo')
              .update({ stock_actual: Math.max(0, spt.stock_actual - vaciosDevueltos) })
              .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
          }
        } else {
          // Abono parcial: solo suma vacíos si devolvió, sin tocar llenos
          if (vaciosDevueltos > 0) {
            await supabase.from('almacenes').update({
              stock_actual: Math.max(0, (almFresco.stock_actual || 0) - vaciosDevueltos),
              balones_vacios: (almFresco.balones_vacios || 0) + vaciosDevueltos,
              vacios_10kg: (almFresco.vacios_10kg || 0) + vaciosDevueltos,
              updated_at: new Date().toISOString()
            }).eq('id', selected.almacen_id)
            const { data: spt } = await supabase.from('stock_por_tipo')
              .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
            if (spt) {
              await supabase.from('stock_por_tipo')
                .update({ stock_actual: Math.max(0, spt.stock_actual - vaciosDevueltos) })
                .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
            }
          }
        }
      }
    }

    // Registrar ingreso en ventas para reportes
    if (totalAbono > 0 && selected.almacen_id) {
      await supabase.from('ventas').insert({
        almacen_id: selected.almacen_id,
        tipo_balon: '10kg',
        fecha: new Date().toISOString(),
        cantidad: modo === 'totalizar' ? balonesVendidos : 0,
        precio_unitario: modo === 'totalizar' ? (selected.precio_base || 0) : totalAbono,
        metodo_pago: modo === 'totalizar' ? 'cobro_distribuidor' : 'abono_distribuidor',
        notas: `${modo === 'totalizar' ? 'Totalización' : 'Abono'} — ${selected.nombre}${abonoForm.notas ? ' · ' + abonoForm.notas : ''}`,
        usuario_id: perfil?.id || null
      })
    }

    // Registrar en cuentas_distribuidor para que aparezca en historial (ambos modos)
    if (modo === 'totalizar') {
      const vendidos = parseInt(abonoForm.balones_devueltos) || 0
      const precio = selected.precio_base || 0
      const totalEsperado = vendidos * precio
      const saldoEfectivo = totalEsperado - totalAbono
      const estado = saldoEfectivo <= 0 ? 'cancelado' : 'por_cobrar'
      await supabase.from('cuentas_distribuidor').insert({
        distribuidor_id: selected.id,
        periodo_inicio: abonoForm.fecha || hoyPeru(),
        periodo_fin: abonoForm.fecha || hoyPeru(),
        balones_entregados: vendidos,
        balones_vendidos: vendidos,
        balones_devueltos: vaciosDevueltos,
        balones_faltantes: Math.max(0, vendidos - vaciosDevueltos),
        precio_por_balon: precio,
        total_esperado: totalEsperado,
        total_vales: (vales20 * 20) + (vales43 * 43),
        total_adelantos: efectivo,
        estado,
        notas: abonoForm.notas || null
      })
    } else {
      // Abono parcial → registrar como abono en historial
      await supabase.from('cuentas_distribuidor').insert({
        distribuidor_id: selected.id,
        periodo_inicio: abonoForm.fecha || hoyPeru(),
        periodo_fin: abonoForm.fecha || hoyPeru(),
        balones_entregados: 0,
        balones_vendidos: 0,
        balones_devueltos: vaciosDevueltos,
        balones_faltantes: 0,
        precio_por_balon: selected.precio_base || 0,
        total_esperado: 0,
        total_vales: (vales20 * 20) + (vales43 * 43),
        total_adelantos: efectivo,
        estado: 'cancelado',
        notas: `Abono parcial${abonoForm.notas ? ' — ' + abonoForm.notas : ''}`
      })
    }

    setSavingAbono(false)
    setAbonoModal(null)
    setAbonoForm({ efectivo: '', vales20: '', vales43: '', balones_devueltos: '', vacios_extra: '', notas: '', modo: 'abono', fecha: hoyPeru() })
    cargar()
  }

  async function guardarDistribuidor() {
    if (!form.nombre || !form.precio_base) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    const data = { nombre: form.nombre, telefono: form.telefono, almacen_id: form.almacen_id || null, precio_base: parseFloat(form.precio_base) }
    const op = selected
      ? supabase.from('distribuidores').update({ ...data, updated_at: new Date().toISOString() }).eq('id', selected.id)
      : supabase.from('distribuidores').insert({ ...data, stock_actual: 0 })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function guardarReposicion() {
    const cant = parseInt(repoForm.cantidad)
    if (!cant || cant <= 0) { setError('Ingresa una cantidad válida'); return }
    const almacen = almacenes.find(a => a.id === selected.almacen_id)
    if (!almacen || almacen.stock_actual < cant) { setError(`Stock insuficiente en almacén. Disponible: ${almacen?.stock_actual || 0}`); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('reposiciones_distribuidor').insert({
      distribuidor_id: selected.id,
      almacen_origen_id: selected.almacen_id,
      cantidad: cant,
      stock_antes_dist: selected.stock_actual,
      stock_despues_dist: selected.stock_actual + cant,
      notas: repoForm.notas,
      fecha: new Date().toISOString()
    })
    if (e) { setError(e.message); setSaving(false); return }
    // Descontar del almacén
    await supabase.from('almacenes')
      .update({ stock_actual: almacen.stock_actual - cant })
      .eq('id', selected.almacen_id)
    // Descontar stock_por_tipo
    const { data: spt } = await supabase.from('stock_por_tipo')
      .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
    if (spt) {
      await supabase.from('stock_por_tipo')
        .update({ stock_actual: Math.max(0, spt.stock_actual - cant) })
        .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
    }
    // Registrar en ventas como crédito al distribuidor (para reportes)
    await supabase.from('ventas').insert({
      almacen_id: selected.almacen_id,
      tipo_balon: '10kg',
      fecha: new Date().toISOString(),
      cantidad: cant,
      precio_unitario: selected.precio_base || 0,
      metodo_pago: 'credito_distribuidor',
      notas: `Reposición a ${selected.nombre}${repoForm.notas ? ' — ' + repoForm.notas : ''}`,
      usuario_id: perfil?.id || null
    })
    setSaving(false)
    setModal(null); setRepoForm({ cantidad: '', notas: '' }); cargar()
  }

  async function abrirHistorial(d) {
    setSelected(d); await cargarHistorial(d.id); await cargarMovimientos(d.id); setModal('historial')
  }

  async function abrirCuenta(d) {
    setSelected(d); setCuentaForm({ vales20: '', vales43: '', adelantos: '', balones_devueltos: '', balones_vendidos: '', notas: '', fecha: hoyPeru() }); setError(''); setModal('cuenta')
  }

  async function guardarCuenta() {
    const v20 = parseInt(cuentaForm.vales20) || 0
    const v43 = parseInt(cuentaForm.vales43) || 0
    const adelantos = parseFloat(cuentaForm.adelantos) || 0
    const balonesDevueltos = parseInt(cuentaForm.balones_devueltos) || 0
    const balonesVendidos = parseInt(cuentaForm.balones_vendidos) || 0
    const balonesFaltantes = balonesVendidos - balonesDevueltos
    const totalVales = (v20 * 20) + (v43 * 43)
    const totalEsperado = balonesVendidos * selected.precio_base
    const saldoEfectivo = totalEsperado - totalVales - adelantos
    const estadoCuenta = saldoEfectivo <= 0 && balonesFaltantes <= 0 ? 'cancelado' : 'por_cobrar'
    setSaving(true); setError('')
    const fechaRendicion = cuentaForm.fecha || hoyPeru()
    const { data: cuenta, error: e1 } = await supabase.from('cuentas_distribuidor').insert({
      distribuidor_id: selected.id,
      periodo_inicio: fechaRendicion, periodo_fin: fechaRendicion,
      balones_entregados: selected.stock_actual,
      balones_vendidos: balonesVendidos,
      precio_por_balon: selected.precio_base,
      total_esperado: totalEsperado,
      total_vales: totalVales,
      total_adelantos: adelantos,
      balones_devueltos: balonesDevueltos,
      balones_faltantes: balonesFaltantes,
      estado: estadoCuenta, notas: cuentaForm.notas
    }).select().single()
    if (e1) { setError(e1.message); setSaving(false); return }
    const detalles = []
    if (v20 > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'vale_20', cantidad: v20, monto: v20 * 20, fecha: fechaRendicion })
    if (v43 > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'vale_43', cantidad: v43, monto: v43 * 43, fecha: fechaRendicion })
    if (adelantos > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'adelanto', monto: adelantos, fecha: fechaRendicion })
    if (detalles.length > 0) await supabase.from('cuenta_distribuidor_detalles').insert(detalles)
    // Actualizar solo vacíos en distribuidor (stock_actual viene del almacén)
    await supabase.from('distribuidores')
      .update({ 
        balones_vacios: (selected.balones_vacios || 0) + balonesVendidos,
        updated_at: new Date().toISOString() 
      })
      .eq('id', selected.id)
    // Actualizar almacén: descontar llenos vendidos, sumar vacíos, agregar devueltos
    if (selected.almacen_id) {
      const almacen = almacenes.find(a => a.id === selected.almacen_id)
      if (almacen) {
        // Llenos = stock actual - balones que salieron a vender (los devueltos son VACÍOS, no llenos)
        const nuevosLlenos = Math.max(0, (almacen.stock_actual || 0) - balonesVendidos)
        // Vacíos = los que devolvió físicamente
        const nuevosVacios = Math.max(0, (almacen.balones_vacios || 0) + balonesDevueltos)
        const nuevosVacios10 = Math.max(0, (almacen.vacios_10kg || 0) + balonesDevueltos)
        // Pendientes = balones vendidos que aún no devuelve como vacíos
        const nuevosPendientes = Math.max(0, (almacen.balones_pendientes_devolucion || 0) + balonesFaltantes)
        await supabase.from('almacenes')
          .update({
            stock_actual: nuevosLlenos,
            balones_vacios: nuevosVacios,
            vacios_10kg: nuevosVacios10,
            balones_pendientes_devolucion: nuevosPendientes
          })
          .eq('id', selected.almacen_id)
        // También actualizar stock_por_tipo
        const { data: spt } = await supabase.from('stock_por_tipo')
          .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
        if (spt) {
          await supabase.from('stock_por_tipo')
            .update({ stock_actual: Math.max(0, spt.stock_actual - balonesVendidos) })
            .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
        }
      }
    }
    setSaving(false); setModal(null); cargar()
    // Registrar el cobro como ingreso en ventas (para reportes)
    const montoEfectivoCobrado = Math.max(0, saldoEfectivo)
    if (montoEfectivoCobrado > 0 && selected.almacen_id) {
      await supabase.from('ventas').insert({
        almacen_id: selected.almacen_id,
        tipo_balon: '10kg',
        fecha: (cuentaForm.fecha || hoyPeru()) + 'T12:00:00-05:00',
        cantidad: balonesVendidos,
        precio_unitario: selected.precio_base || 0,
        metodo_pago: 'cobro_distribuidor',
        notas: `Rendición ${selected.nombre} — ${balonesVendidos} bal. vendidos`,
        usuario_id: perfil?.id || null
      })
    }
    const icono = estadoCuenta === 'cancelado' ? '✅ CANCELADO' : '⏳ POR COBRAR'
    const msgBalones = balonesFaltantes > 0 ? `\n⚠️ Balones faltantes: ${balonesFaltantes}` : '\n✅ Balones completos'
    alert(`${icono}\nTotal esperado: S/ ${totalEsperado}\nVales: S/ ${totalVales}\nAdelantos: S/ ${adelantos}\n💰 Saldo: S/ ${saldoEfectivo.toFixed(2)}${msgBalones}`)
  }

  async function cargarAcuentaDist(distId) {
    setLoadingAcuenta(true)
    const { data } = await supabase.from('a_cuenta')
      .select('*').eq('distribuidor_id', distId).eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
    setAcuentaDist(data || [])
    setLoadingAcuenta(false)
  }

  async function guardarAcuentaDist() {
    if (!selected || !acuentaForm.nombre_cliente.trim()) return
    const v20 = parseInt(acuentaForm.vales_20) || 0
    const v43 = parseInt(acuentaForm.vales_43) || 0
    const bal = parseInt(acuentaForm.balones) || 0
    if (!v20 && !v43 && !bal) return
    setSavingAcuenta(true)
    const { count } = await supabase.from('a_cuenta').select('*', { count: 'exact', head: true })
    await supabase.from('a_cuenta').insert({
      nombre_cliente: acuentaForm.nombre_cliente.trim(),
      fecha: acuentaForm.fecha || hoyPeru(),
      vales_20: v20, vales_43: v43, balones: bal, dinero: 0,
      estado: 'pendiente', numero: (count || 0) + 1,
      distribuidor_id: selected.id,
      notas: acuentaForm.notas || null,
      historial_cambios: [{ tipo: 'deposito', fecha: acuentaForm.fecha || hoyPeru(), vales_20: v20, vales_43: v43, balones: bal }]
    })
    setSavingAcuenta(false)
    setAcuentaForm({ nombre_cliente: '', vales_20: '', vales_43: '', balones: '', notas: '', fecha: hoyPeru() })
    cargarAcuentaDist(selected.id)
  }

  async function entregarAcuentaDist(registro) {
    if (!confirm(`Marcar como entregado a ${registro.nombre_cliente}?`)) return
    await supabase.from('a_cuenta').update({
      estado: 'entregado', fecha_entrega: hoyPeru(), updated_at: new Date().toISOString()
    }).eq('id', registro.id)
    cargarAcuentaDist(selected.id)
  }

  async function borrarAcuentaDist(id) {
    if (!confirm('Borrar este registro?')) return
    await supabase.from('a_cuenta').delete().eq('id', id)
    cargarAcuentaDist(selected.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Distribuidores</h2>
          <p className="text-gray-500 text-sm">Control de stock, reposiciones y cuentas</p>
        </div>
        <button onClick={() => { setSelected(null); setForm({ nombre: '', telefono: '', almacen_id: '', precio_base: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
          <Plus className="w-4 h-4" />Nuevo distribuidor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border border-indigo-500/20">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-indigo-400" /></div>
          <p className="text-2xl font-bold text-white">{distribuidores.length}</p>
          <p className="text-xs text-gray-500">Distribuidores activos</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-white">{distribuidores.reduce((s, d) => s + d.stock_actual, 0)}</p>
          <p className="text-xs text-gray-500">Balones en distribución</p>
        </div>
        <div className="stat-card border border-yellow-500/20">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-yellow-400" /></div>
          <p className="text-2xl font-bold text-white">S/ {distribuidores.reduce((s, d) => s + (d.stock_actual * d.precio_base), 0).toLocaleString('es-PE')}</p>
          <p className="text-xs text-gray-500">Valor en campo</p>
        </div>
      </div>

      {/* Cards distribuidores */}
      {loading ? <div className="text-center text-gray-500 py-10">Cargando...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {distribuidores.map(d => (
            <div key={d.id} className="card border border-[var(--app-card-border)]">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{d.nombre}</p>
                    <p className="text-gray-500 text-xs">{d.telefono || 'Sin teléfono'} · {d.almacenes?.nombre || 'Sin almacén'}</p>
                  </div>
                </div>
                <button onClick={() => { setSelected(d); setForm({ nombre: d.nombre, telefono: d.telefono || '', almacen_id: d.almacen_id || '', precio_base: d.precio_base }); setError(''); setModal('editar') }}
                  className="text-gray-600 hover:text-blue-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>

              {/* Stock y precio */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${d.stock_actual > 50 ? 'text-emerald-400' : d.stock_actual > 10 ? 'text-yellow-400' : 'text-red-400'}`}>{d.stock_actual}</p>
                  <p className="text-xs text-gray-500 mt-0.5">🟢 Llenos</p>
                </div>
                <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-300">{d.balones_vacios || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">⚪ Vacíos devueltos</p>
                </div>
              </div>
              {(d.balones_por_cobrar || 0) > 0 && (
                <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg p-2 mb-2 flex items-center justify-between">
                  <span className="text-xs text-orange-300 font-medium">⏳ Balones pendientes de devolución</span>
                  <span className="text-orange-400 font-bold text-sm">{d.balones_por_cobrar} bal.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-transparent rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-400">S/{d.precio_base}</p>
                  <p className="text-xs text-gray-500">Precio/bal.</p>
                </div>
                <div className="bg-transparent rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">S/{(d.stock_actual * d.precio_base).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total campo</p>
                </div>
              </div>

              {/* Acciones según modalidad */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => abrirHistorial(d)}
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <History className="w-3 h-3" />Historial
                </button>

                {d.modalidad === 'cuenta_corriente' ? (
                  <>
                    <button onClick={() => { setSelected(d); setCargaModal(true); setCargaForm({ cargados:'', descargados:'', notas:'', fecha:hoyPeru() }); cargarCuentaCorriente(d.id) }}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                      📦 Registrar carga
                    </button>
                    <button onClick={() => { setSelected(d); setAbonoParciModal(true); setAbonoParciForm({ vales20:'', vales30:'', vales43:'', efectivo:'', yape:'', notas:'', fecha:hoyPeru() }); cargarCuentaCorriente(d.id) }}
                      className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                      💵 Registrar abono
                    </button>
                    <button onClick={() => { setSelected(d); setArregloModal(true); setArregloForm({ vales20:'', vales30:'', vales43:'', efectivo:'', yape:'', notas:'', fecha:hoyPeru() }); cargarCuentaCorriente(d.id) }}
                      className="col-span-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 text-orange-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                      🧾 Arreglar cuentas
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setSelected(d); setAcuentaModal(true); setAcuentaForm({ nombre_cliente: '', vales_20: '', vales_43: '', balones: '', notas: '', fecha: hoyPeru() }); cargarAcuentaDist(d.id) }}
                    className="col-span-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 text-yellow-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                    <ClipboardList className="w-3 h-3" />📋 A Cuenta ({d.vales_pendientes || 0} pendientes)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo/editar distribuidor */}
      {(modal === 'nuevo' || modal === 'editar') && (
        <Modal title={modal === 'nuevo' ? 'Nuevo distribuidor' : 'Editar distribuidor'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre</label><input className="input" placeholder="Nombre del distribuidor" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
            <div><label className="label">Teléfono</label><input className="input" placeholder="999 888 777" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /></div>
            <div>
              <label className="label">Almacén asignado</label>
              <select className="input" value={form.almacen_id} onChange={e => setForm({...form, almacen_id: e.target.value})}>
                <option value="">Sin almacén</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.stock_actual} bal.)</option>)}
              </select>
            </div>
            <div><label className="label">Precio por balón (S/)</label><input type="number" className="input" placeholder="100" value={form.precio_base} onChange={e => setForm({...form, precio_base: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarDistribuidor} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal reponer */}
      {modal === 'reponer' && selected && (
        <Modal title={`Reponer stock — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {/* Resumen distribuidor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-400 mb-1">🟢 Llenos (distribuidor)</p>
                <p className="text-2xl font-bold text-emerald-400">{selected.stock_actual}</p>
                <p className="text-xs text-gray-500">balones listos para vender</p>
              </div>
              <div className="bg-gray-700/30 border border-gray-600/40 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">⚪ Vacíos (distribuidor)</p>
                <p className="text-2xl font-bold text-gray-300">{almacenes.find(a => a.id === selected.almacen_id)?.balones_vacios || 0}</p>
                <p className="text-xs text-gray-500">balones vacíos para devolver</p>
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400 mb-1">📦 Stock llenos en almacén disponible</p>
              <p className="text-2xl font-bold text-blue-400">{almacenes.find(a => a.id === selected.almacen_id)?.stock_actual || 0} bal.</p>
            </div>
            <div><label className="label">Cantidad a entregar (llenos)</label><input type="number" className="input" placeholder="50" value={repoForm.cantidad} onChange={e => setRepoForm({...repoForm, cantidad: e.target.value})} /></div>
            {repoForm.cantidad && (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 text-sm">
                <p className="text-emerald-400">🟢 Llenos nuevos del distribuidor: <span className="font-bold">{selected.stock_actual + (parseInt(repoForm.cantidad) || 0)} balones</span></p>
              </div>
            )}
            <div><label className="label">Notas (opcional)</label><textarea className="input" rows={2} placeholder="Observaciones..." value={repoForm.notas} onChange={e => setRepoForm({...repoForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarReposicion} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all flex-1 justify-center flex items-center gap-2">{saving ? 'Guardando...' : '✓ Confirmar reposición'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal rendición de cuentas */}
      {modal === 'cuenta' && selected && (
        <Modal title={`Rendición de cuentas — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-transparent rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Precio por balón · Balones en campo: {selected.stock_actual}</p>
              <p className="text-lg font-bold text-white">S/{selected.precio_base}/bal. · <span className="text-blue-400">Ingresa los balones vendidos abajo ↓</span></p>
            </div>
            <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Balones vendidos</label><input type="number" className="input" placeholder={`Máx: ${selected.stock_actual}`} value={cuentaForm.balones_vendidos || ""} onChange={e => setCuentaForm({...cuentaForm, balones_vendidos: e.target.value})} /><p className="text-xs text-gray-500 mt-1">Balones que salieron a vender ({selected.stock_actual} en campo)</p></div>
              <div><label className="label">Vales de S/ 20</label><input type="number" className="input" placeholder="0" value={cuentaForm.vales20} onChange={e => setCuentaForm({...cuentaForm, vales20: e.target.value})} /></div>
              <div><label className="label">Vales de S/ 43</label><input type="number" className="input" placeholder="0" value={cuentaForm.vales43} onChange={e => setCuentaForm({...cuentaForm, vales43: e.target.value})} /></div>
            </div>
            <div><label className="label">Adelantos en efectivo (S/)</label><input type="number" className="input" placeholder="0" value={cuentaForm.adelantos} onChange={e => setCuentaForm({...cuentaForm, adelantos: e.target.value})} /></div>

            {/* Balones devueltos */}
            <div>
              <label className="label">Balones vacíos devueltos</label>
              <div className="flex items-center gap-3">
                <input type="number" className="input flex-1" placeholder="0"
                  value={cuentaForm.balones_devueltos}
                  onChange={e => setCuentaForm({...cuentaForm, balones_devueltos: e.target.value})} />
                <div className="text-right flex-shrink-0">
                  {(() => {
                    const devueltos = parseInt(cuentaForm.balones_devueltos) || 0
                    const vendidos = parseInt(cuentaForm.balones_vendidos) || selected.stock_actual
                    const faltantes = vendidos - devueltos
                    if (!cuentaForm.balones_devueltos) return <span className="text-gray-500 text-xs">de {vendidos} bal. vendidos</span>
                    if (faltantes > 0) return <span className="text-red-400 text-sm font-bold">⚠️ Faltan {faltantes}</span>
                    if (faltantes < 0) return <span className="text-yellow-400 text-sm font-bold">+{Math.abs(faltantes)} extra</span>
                    return <span className="text-emerald-400 text-sm font-bold">✅ Completo</span>
                  })()}
                </div>
              </div>
            </div>

            {/* Cálculo automático */}
            {(cuentaForm.balones_vendidos || cuentaForm.vales20 || cuentaForm.vales43 || cuentaForm.adelantos || cuentaForm.balones_devueltos) && (() => {
              const vendidos = parseInt(cuentaForm.balones_vendidos) || 0
              if (vendidos === 0 && !cuentaForm.balones_vendidos) return null
              const v20 = (parseInt(cuentaForm.vales20) || 0) * 20
              const v43 = (parseInt(cuentaForm.vales43) || 0) * 43
              const adel = parseFloat(cuentaForm.adelantos) || 0
              const devueltos = parseInt(cuentaForm.balones_devueltos) || 0
              const faltantes = vendidos - devueltos
              const total = vendidos * selected.precio_base
              const saldo = total - v20 - v43 - adel
              return (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Total esperado</span><span className="text-white font-semibold">S/ {total.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vales S/20 ({cuentaForm.vales20||0} × 20)</span><span className="text-yellow-400">- S/ {v20}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vales S/43 ({cuentaForm.vales43||0} × 43)</span><span className="text-yellow-400">- S/ {v43}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Adelantos</span><span className="text-yellow-400">- S/ {adel}</span></div>
                  {faltantes !== 0 && cuentaForm.balones_devueltos && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Balones faltantes</span>
                      <span className={faltantes > 0 ? 'text-red-400 font-semibold' : 'text-yellow-400'}>
                        {faltantes > 0 ? `⚠️ ${faltantes} sin devolver` : `+${Math.abs(faltantes)} extra`}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[var(--app-card-border)] pt-2 flex justify-between items-center">
                    <span className="text-white font-semibold">💰 Saldo en efectivo</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>S/ {saldo.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${saldo <= 0 && faltantes <= 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/50' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-600/50'}`}>
                        {saldo <= 0 && faltantes <= 0 ? '✅ CANCELADO' : '⏳ POR COBRAR'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div><label className="label">Fecha de la rendición</label><input type="date" className="input" value={cuentaForm.fecha} onChange={e => setCuentaForm({...cuentaForm, fecha: e.target.value})} /></div>
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={cuentaForm.notas} onChange={e => setCuentaForm({...cuentaForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCuenta} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Registrar rendición'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Vales A Cuenta distribuidor */}
      {modal === 'vales' && selected && (
        <Modal title={`🎫 Vales A Cuenta — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/20</p>
                <p className="text-xs text-yellow-400/70 font-semibold">S/ {valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length * 20}</p>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/43</p>
                <p className="text-xs text-orange-400/70 font-semibold">S/ {valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length * 43}</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">S/ {valesDist.filter(v => v.estado === 'pendiente').reduce((s, v) => s + v.monto, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total pendiente</p>
                <p className="text-xs text-emerald-400/70">{valesDist.filter(v => v.estado === 'cobrado').length} cobrados</p>
              </div>
            </div>

            {/* Formulario nuevo vale */}
            <div style={{background:"var(--app-card-bg)"}} className="rounded-xl p-4 space-y-3" style2={{border:"1px solid var(--app-card-border)"}}>
              <p className="text-sm font-semibold text-white">Registrar nuevo vale</p>
              <div className="relative">
                <label className="label">Cliente *</label>
                <input className="input" placeholder="Escribe el nombre..." value={valeForm.nombre_cliente}
                  onChange={e => setValeForm(f => ({...f, nombre_cliente: e.target.value, cliente_id: ''}))} />
                {valeForm.nombre_cliente.length >= 2 && (() => {
                  const coincidencias = clientes.filter(c => c.nombre.toLowerCase().includes(valeForm.nombre_cliente.toLowerCase()))
                  const exacto = clientes.find(c => c.nombre.toLowerCase() === valeForm.nombre_cliente.toLowerCase())
                  if (exacto) return <div className="mt-1 text-xs text-emerald-400 px-1">✅ Cliente registrado</div>
                  return (
                    <div className="mt-1  border border-[var(--app-card-border)] rounded-lg overflow-hidden">
                      {coincidencias.map(c => (
                        <button key={c.id} type="button" onClick={() => setValeForm(f => ({...f, nombre_cliente: c.nombre, cliente_id: c.id}))}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2">
                          <span className="text-blue-400">👤</span>{c.nombre}
                        </button>
                      ))}
                      {coincidencias.length === 0 && (
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">No encontrado</span>
                          <button type="button"
                            onClick={() => { setClienteRapidoForm({ nombre: valeForm.nombre_cliente, telefono: '' }); setSubModal('clienteRapido') }}
                            className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-600/50 transition-all">
                            + Registrar cliente
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setValeForm(f => ({...f, tipo_vale: '20'}))}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${valeForm.tipo_vale === '20' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' : 'bg-transparent border-[var(--app-card-border)] text-gray-400'}`}>
                  🎫 Vale S/ 20
                </button>
                <button onClick={() => setValeForm(f => ({...f, tipo_vale: '43'}))}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${valeForm.tipo_vale === '43' ? 'bg-orange-900/30 border-orange-500 text-orange-300' : 'bg-transparent border-[var(--app-card-border)] text-gray-400'}`}>
                  🎫 Vale S/ 43
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Fecha</label>
                  <input type="date" className="input" value={valeForm.fecha} onChange={e => setValeForm(f => ({...f, fecha: e.target.value}))} />
                </div>
                <div><label className="label">Notas</label>
                  <input className="input" placeholder="Ej: Km 12" value={valeForm.notas} onChange={e => setValeForm(f => ({...f, notas: e.target.value}))} />
                </div>
              </div>
              <button onClick={guardarVale} disabled={saving || !valeForm.nombre_cliente}
                className="w-full btn-primary justify-center">{saving ? 'Guardando...' : '+ Registrar vale'}</button>
            </div>

            {/* Historial de vales */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Historial de vales</p>
              {valesDist.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-6">Sin vales registrados</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {valesDist.map(v => (
                    <div key={v.id} className="flex items-center justify-between /40 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${v.tipo_vale === '20' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-orange-900/40 text-orange-400'}`}>
                          S/{v.tipo_vale}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{v.nombre_cliente}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            📅 {format(new Date(v.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                            {v.notas && ` · ${v.notas}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={v.estado === 'pendiente' ? 'badge-yellow' : v.estado === 'cobrado' ? 'badge-green' : 'text-xs text-gray-500'}>
                          {v.estado === 'pendiente' ? '⏳ Pendiente' : v.estado === 'cobrado' ? '✅ Cobrado' : '❌ Anulado'}
                        </span>
                        {v.estado === 'pendiente' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => anularVale(v)} className="text-xs text-gray-600 hover:text-red-400 px-2 py-0.5 rounded border border-[var(--app-card-border)]">Anular</button>
                            <button onClick={() => marcarValeCobrado(v)} className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-0.5 rounded">✓ Cobrado</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sub-modal cliente rápido */}
          {subModal === 'clienteRapido' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl shadow-2xl" style={{background:'var(--app-modal-bg)',border:'1px solid var(--app-modal-border)'}}>
                <div className="flex items-center justify-between px-6 py-4 ">
                  <h3 className="text-white font-semibold text-sm">Registrar cliente</h3>
                  <button onClick={() => setSubModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 py-4 space-y-3">
                  <div>
                    <label className="label">Nombre *</label>
                    <input className="input" value={clienteRapidoForm.nombre}
                      onChange={e => setClienteRapidoForm(f => ({...f, nombre: e.target.value}))} autoFocus />
                  </div>
                  <div>
                    <label className="label">Teléfono (opcional)</label>
                    <input className="input" value={clienteRapidoForm.telefono}
                      onChange={e => setClienteRapidoForm(f => ({...f, telefono: e.target.value}))} />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setSubModal(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={guardarClienteRapido} className="btn-primary flex-1 justify-center">✓ Registrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal historial */}
      {modal === 'historial' && selected && (
        <ModalHistorial
          selected={selected}
          cargasDist={cargasDist}
          abonosParciales={abonosParciales}
          cuentaActiva={cuentaActiva}
          cuentasCerradas={cuentasCerradas}
          lotesDistribuidor={lotesDistribuidor}
          ventasDistribuidor={ventasDistribuidor}
          rendiciones={rendiciones}
          supabase={supabase}
          onClose={() => setModal(null)}
          cargarHistorial={cargarHistorial}
          format={format}
          es={es}
          hoyPeru={hoyPeru}
        />
      )}


      {/* Modal A Cuenta del distribuidor */}
      {acuentaModal && selected && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{background:'var(--app-modal-bg)',border:'1px solid var(--app-modal-border)'}}>
            <div className="flex items-center justify-between px-6 py-4  sticky top-0">
              <div>
                <h3 className="text-white font-semibold">📋 A Cuenta — {selected.nombre}</h3>
                <p className="text-gray-500 text-xs mt-0.5">Clientes que dejaron vales o balones</p>
              </div>
              <button onClick={() => setAcuentaModal(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Formulario nuevo registro */}
              <div className="bg-transparent border border-[var(--app-card-border)] rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Nuevo registro</p>
                <div>
                  <label className="label">Nombre del cliente *</label>
                  <input className="input" placeholder="Nombre completo"
                    value={acuentaForm.nombre_cliente}
                    onChange={e => setAcuentaForm(f => ({...f, nombre_cliente: e.target.value}))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">🎫 Vales S/20</label>
                    <input type="number" min="0" className="input text-center" placeholder="0"
                      value={acuentaForm.vales_20}
                      onChange={e => setAcuentaForm(f => ({...f, vales_20: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">🎫 Vales S/43</label>
                    <input type="number" min="0" className="input text-center" placeholder="0"
                      value={acuentaForm.vales_43}
                      onChange={e => setAcuentaForm(f => ({...f, vales_43: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">🔵 Balones</label>
                    <input type="number" min="0" className="input text-center" placeholder="0"
                      value={acuentaForm.balones}
                      onChange={e => setAcuentaForm(f => ({...f, balones: e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label className="label">Notas (opcional)</label>
                  <input className="input" placeholder="Ej: para mañana..."
                    value={acuentaForm.notas}
                    onChange={e => setAcuentaForm(f => ({...f, notas: e.target.value}))} />
                </div>
                <button onClick={guardarAcuentaDist} disabled={savingAcuenta || !acuentaForm.nombre_cliente.trim()}
                  className="btn-primary w-full justify-center disabled:opacity-40">
                  {savingAcuenta ? 'Guardando...' : '+ Registrar'}
                </button>
              </div>

              {/* Lista pendientes */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase mb-2">
                  Pendientes ({acuentaDist.length})
                </p>
                {loadingAcuenta ? (
                  <p className="text-center text-gray-600 text-sm py-4">Cargando...</p>
                ) : acuentaDist.length === 0 ? (
                  <p className="text-center text-gray-600 text-sm py-4">Sin registros pendientes</p>
                ) : (
                  <div className="space-y-2">
                    {acuentaDist.map(r => (
                      <div key={r.id} className="bg-transparent border border-[var(--app-card-border)] rounded-xl p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-semibold text-sm">{r.nombre_cliente}</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {r.vales_20 > 0 && <span className="text-xs bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded-lg">{r.vales_20}×S/20</span>}
                              {r.vales_43 > 0 && <span className="text-xs bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded-lg">{r.vales_43}×S/43</span>}
                              {r.balones > 0 && <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-lg">{r.balones} bal.</span>}
                            </div>
                            {r.notas && <p className="text-xs text-gray-500 mt-1 italic">{r.notas}</p>}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => entregarAcuentaDist(r)}
                              className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg">
                              ✓ Entregado
                            </button>
                            <button onClick={() => borrarAcuentaDist(r.id)}
                              className="text-xs bg-red-600/20 border border-red-600/30 text-red-400 px-2 py-1 rounded-lg">
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setAcuentaModal(false)} className="btn-secondary w-full">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
