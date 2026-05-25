// src/components/Modal.jsx
import { X } from 'lucide-react'

/**
 * Modal compartido — usado en toda la app
 * Props:
 *   title    — texto del header
 *   onClose  — función al cerrar
 *   children — contenido
 *   wide     — booleano, amplía a 680px (default 480px)
 *   maxWidth — número en px, sobreescribe wide si se provee
 */
export default function Modal({ title, onClose, children, wide, maxWidth }) {
  const ancho = maxWidth || (wide ? 680 : 480)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
      <div style={{
        background:'var(--app-card-bg)',
        border:'1px solid var(--app-card-border)',
        borderRadius:16,
        width:'100%',
        maxWidth:ancho,
        boxShadow:'0 25px 50px rgba(0,0,0,0.4)',
        maxHeight:'90vh',
        display:'flex',
        flexDirection:'column',
      }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 24px', borderBottom:'1px solid var(--app-card-border)',
          flexShrink:0, position:'sticky', top:0, background:'var(--app-card-bg)',
        }}>
          <h3 style={{color:'var(--app-text)', fontWeight:600, margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', color:'var(--app-text-secondary)'}}>
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div style={{padding:'20px 24px', overflowY:'auto', flex:1}}>
          {children}
        </div>
      </div>
    </div>
  )
}
