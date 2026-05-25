// src/lib/impresionDistribuidores.js
// Funciones de impresión de reportes para distribuidores

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
    const totalCargado = cargas.reduce((s,c)=>s+(c.cantidad||0),0)
    const totalDescargado = cargas.reduce((s,c)=>s+((c.descargados||0)||0),0)
    const montoTotal = cargas.reduce((s,c)=>s+(c.total||0),0) + (cuenta?.saldo_anterior||0)
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
        <td class="center">${c.cantidad}</td>
        <td class="center">${(c.descargados||0)}</td>
        <td class="center">${Math.max(0,c.cantidad-(c.descargados||0))}</td>
        <td class="center">S/${c.precio_por_balon}</td>
        <td class="right">S/${(c.total||0).toLocaleString('es-PE')}</td>
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

export { imprimirCuenta, imprimirCuentaActiva, generarHTMLReporte, abrirVentanaImpresion }
