// lib/exportar.js
// Utilidad compartida para exportar resúmenes a Excel desde cualquier página.
// Requiere la librería "xlsx" (SheetJS). Instalar una sola vez con:
//   npm install xlsx

import * as XLSX from 'xlsx'

/**
 * Exporta un arreglo de objetos a un archivo .xlsx descargable.
 *
 * @param {Array<Object>} filas       - Cada objeto es una fila. Las llaves del primer objeto definen las columnas.
 * @param {string} nombreArchivo      - Nombre del archivo sin extensión, ej: "ventas_2026-07-05"
 * @param {string} [nombreHoja]       - Nombre de la hoja dentro del Excel (máx 31 caracteres)
 *
 * Ejemplo:
 *   exportarExcel(
 *     ventas.map(v => ({
 *       Fecha: v.fecha, Cliente: v.clientes?.nombre || 'Varios',
 *       Cantidad: v.cantidad, 'Precio unit.': v.precio_unitario,
 *       Total: v.cantidad * v.precio_unitario, 'Método de pago': v.metodo_pago,
 *     })),
 *     `ventas_${filtroFecha}`,
 *     'Ventas'
 *   )
 */
export function exportarExcel(filas, nombreArchivo = 'reporte', nombreHoja = 'Datos') {
  if (!filas || filas.length === 0) {
    console.warn('exportarExcel: no hay filas para exportar')
    return false
  }
  const hoja = XLSX.utils.json_to_sheet(filas)

  // Autoajustar ancho de columnas según el contenido más largo de cada una
  const anchos = Object.keys(filas[0]).map(key => {
    const maxContenido = filas.reduce((max, fila) => {
      const val = fila[key] == null ? '' : String(fila[key])
      return Math.max(max, val.length)
    }, key.length)
    return { wch: Math.min(Math.max(maxContenido + 2, 10), 40) }
  })
  hoja['!cols'] = anchos

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja.slice(0, 31))
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`)
  return true
}

/**
 * Exporta varias tablas como hojas separadas del mismo archivo Excel.
 *
 * @param {Array<{nombre:string, filas:Array<Object>}>} hojas
 * @param {string} nombreArchivo
 *
 * Ejemplo:
 *   exportarExcelMultiHoja([
 *     { nombre:'Resumen', filas: resumenFilas },
 *     { nombre:'Detalle', filas: detalleFilas },
 *   ], 'reporte_mensual')
 */
export function exportarExcelMultiHoja(hojas, nombreArchivo = 'reporte') {
  const hojasConDatos = (hojas || []).filter(h => h.filas && h.filas.length > 0)
  if (hojasConDatos.length === 0) {
    console.warn('exportarExcelMultiHoja: no hay datos para exportar')
    return false
  }
  const libro = XLSX.utils.book_new()
  hojasConDatos.forEach(({ nombre, filas }) => {
    const hoja = XLSX.utils.json_to_sheet(filas)
    const anchos = Object.keys(filas[0]).map(key => {
      const maxContenido = filas.reduce((max, fila) => {
        const val = fila[key] == null ? '' : String(fila[key])
        return Math.max(max, val.length)
      }, key.length)
      return { wch: Math.min(Math.max(maxContenido + 2, 10), 40) }
    })
    hoja['!cols'] = anchos
    XLSX.utils.book_append_sheet(libro, hoja, nombre.slice(0, 31))
  })
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`)
  return true
}
