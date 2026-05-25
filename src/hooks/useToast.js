// src/hooks/useToast.js
import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Hook compartido para notificaciones toast
 * Uso:
 *   const { toasts, toast } = useToast()
 *   toast('Mensaje')               — toast verde (ok)
 *   toast('Error', 'error')        — toast rojo
 */
export function useToast() {
  const [toasts, setToasts] = useState([])
  const timerRef = useRef({})

  const toast = useCallback((mensaje, tipo = 'ok') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, mensaje, tipo }])
    timerRef.current[id] = setTimeout(
      () => setToasts(prev => prev.filter(t => t.id !== id)),
      3500
    )
  }, [])

  useEffect(() => () => Object.values(timerRef.current).forEach(clearTimeout), [])

  return { toasts, toast }
}
