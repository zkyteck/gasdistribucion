// src/components/BotonNotificaciones.jsx
import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { inicializarNotificaciones } from '../lib/notificaciones'
import { useAuth } from '../context/AuthContext'

export default function BotonNotificaciones() {
  const { perfil } = useAuth()
  const [activadas, setActivadas] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setActivadas(Notification.permission === 'granted')
    }
  }, [])

  const toggleNotificaciones = async () => {
    if (activadas) {
      setActivadas(false)
      return
    }
    setCargando(true)
    const ok = await inicializarNotificaciones(perfil?.id)
    setActivadas(ok)
    setCargando(false)
  }

  if (!('Notification' in window)) return null

  return (
    <button
      onClick={toggleNotificaciones}
      disabled={cargando}
      title={activadas ? 'Notificaciones activadas' : 'Activar notificaciones'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, fontSize: 12,
        background: activadas ? 'rgba(34,197,94,0.1)' : 'var(--app-card-bg-alt)',
        border: activadas ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--app-card-border)',
        color: activadas ? '#22c55e' : 'var(--app-text-secondary)',
        cursor: 'pointer', transition: 'all 0.15s'
      }}
    >
      {cargando ? '...' : activadas
        ? <><Bell style={{width:14,height:14}}/> Notificaciones ON</>
        : <><BellOff style={{width:14,height:14}}/> Activar notifs</>
      }
    </button>
  )
}
