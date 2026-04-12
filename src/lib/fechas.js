// Utilidades de fecha/hora para zona horaria de Perú (America/Lima, UTC-5)

// Retorna 'YYYY-MM-DD' en hora Perú
export function hoyPeru() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

// Retorna timestamp ISO completo en hora Perú (para guardar en BD)
// Ej: "2026-04-12T06:30:00-05:00"
export function nowPeru() {
  const now = new Date()
  // Formatea con offset de Lima
  return now.toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace(' ', 'T') + '-05:00'
}

// Inicio del día en Perú: 'YYYY-MM-DDT00:00:00-05:00'
export function inicioDiaPeru(fecha) {
  const f = fecha || hoyPeru()
  return `${f}T00:00:00-05:00`
}

// Fin del día en Perú: 'YYYY-MM-DDT23:59:59-05:00'
export function finDiaPeru(fecha) {
  const f = fecha || hoyPeru()
  return `${f}T23:59:59-05:00`
}
