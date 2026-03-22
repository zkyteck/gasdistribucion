// Utilidades de fecha para zona horaria Perú (UTC-5)
// Usar estas funciones en toda la app en lugar de new Date().toISOString()

const OFFSET_PERU = -5 * 60 // minutos

/**
 * Retorna la fecha actual en Perú como string 'YYYY-MM-DD'
 * Reemplaza: new Date().toISOString().split('T')[0]
 */
export function hoyPeru() {
  const ahora = new Date()
  const peruTime = new Date(ahora.getTime() + OFFSET_PERU * 60 * 1000)
  return peruTime.toISOString().split('T')[0]
}

/**
 * Retorna la fecha y hora actual en Perú como ISO string
 * Reemplaza: new Date().toISOString() cuando necesitas timestamp
 */
export function ahoraPeru() {
  return new Date().toISOString() // El timestamp UTC está bien para updated_at
}

/**
 * Convierte una fecha 'YYYY-MM-DD' a inicio del día en Perú (para queries)
 * Ej: '2026-03-21' → '2026-03-21T05:00:00.000Z' (medianoche Perú en UTC)
 */
export function inicioDiaPeru(fechaStr) {
  return fechaStr + 'T05:00:00.000Z'
}

/**
 * Convierte una fecha 'YYYY-MM-DD' a fin del día en Perú (para queries)
 * Ej: '2026-03-21' → '2026-03-22T04:59:59.999Z' (fin del día Perú en UTC)
 */
export function finDiaPeru(fechaStr) {
  const fecha = new Date(fechaStr + 'T05:00:00.000Z')
  fecha.setDate(fecha.getDate() + 1)
  fecha.setMilliseconds(fecha.getMilliseconds() - 1)
  return fecha.toISOString()
}

/**
 * Retorna objeto Date ajustado a hora Perú
 */
export function nowPeru() {
  const ahora = new Date()
  return new Date(ahora.getTime() + OFFSET_PERU * 60 * 1000)
}
