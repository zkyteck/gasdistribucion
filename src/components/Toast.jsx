// src/components/Toast.jsx
import { CheckCircle, AlertTriangle } from 'lucide-react'

/**
 * Toast compartido — notificaciones flotantes
 * Props:
 *   toasts — array de { id, mensaje, tipo } generado por useToast
 */
export default function Toast({ toasts }) {
  return (
    <div style={{
      position:'fixed', bottom:80, right:20, zIndex:999,
      display:'flex', flexDirection:'column', gap:8, pointerEvents:'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'12px 16px', borderRadius:10,
          background: t.tipo==='error' ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.95)',
          color:'#fff', fontSize:13, fontWeight:500,
          boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
          animation:'fadeInUp 0.2s ease', minWidth:220,
        }}>
          {t.tipo==='error'
            ? <AlertTriangle style={{width:16, height:16, flexShrink:0}}/>
            : <CheckCircle style={{width:16, height:16, flexShrink:0}}/>
          }
          {t.mensaje}
        </div>
      ))}
    </div>
  )
}
