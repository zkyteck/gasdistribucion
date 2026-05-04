import { useState, useCallback } from 'react'
import { X, Send, RefreshCw, CheckCircle, AlertTriangle, Trash2, Camera } from 'lucide-react'

export default function EscanerVales({ onClose }) {
  const [valesEscaneados, setValesEscaneados] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [errorActual, setErrorActual] = useState('')
  const [enviando, setEnviando] = useState(false)

  const procesarImagen = useCallback(async (file) => {
    setProcesando(true)
    setErrorActual('')
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 } },
              { type: 'text', text: `Analiza este vale FISE peruano y extrae:
- DNI: 8 dígitos. En vales pequeños aparece ****XXXX (últimos 4 impresos) y los primeros 4 escritos a mano. Combínalos.
- Código vale: serie numérica larga (CUPON, Vale Digital FISE, etc)
- Valor: monto en soles (S/30 o S/43)
- Fecha vencimiento
- Nombre beneficiario si aparece

Responde SOLO JSON:
{"dni":"12345678","codigo":"0804267233992","valor":30,"vence":"31/05/2026","beneficiario":"NOMBRE","error":null}

Si no es un vale FISE: {"error":"No es un vale FISE"}` }
            ]
          }]
        })
      })

      const data = await response.json()
      const texto = data.content?.[0]?.text || ''
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No se pudo leer')

      const r = JSON.parse(jsonMatch[0])
      if (r.error) { setErrorActual(r.error); setProcesando(false); return }
      if (!r.dni || !r.codigo) { setErrorActual('No se detectó DNI o código. Intenta con mejor iluminación.'); setProcesando(false); return }

      setValesEscaneados(prev => [...prev, {
        id: Date.now(), dni: r.dni, codigo: r.codigo,
        valor: r.valor || 30, vence: r.vence || '',
        beneficiario: r.beneficiario || '',
        imagen: URL.createObjectURL(file), estado: 'listo'
      }])
    } catch (err) {
      setErrorActual('Error al procesar. Intenta de nuevo.')
    }
    setProcesando(false)
  }, [])

  const handleFoto = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) procesarImagen(file)
    e.target.value = ''
  }, [procesarImagen])

  const eliminarVale = useCallback((id) => {
    setValesEscaneados(prev => prev.filter(v => v.id !== id))
  }, [])

  const generarSMS = useCallback((vale) => {
    const texto = `Fise ah01 ${vale.dni} ${vale.codigo}`
    window.location.href = `sms:58996?body=${encodeURIComponent(texto)}`
    setValesEscaneados(prev => prev.map(v => v.id === vale.id ? {...v, estado:'enviado'} : v))
  }, [])

  const enviarTodos = useCallback(async () => {
    const listos = valesEscaneados.filter(v => v.estado === 'listo')
    setEnviando(true)
    for (let i = 0; i < listos.length; i++) {
      const vale = listos[i]
      const texto = `Fise ah01 ${vale.dni} ${vale.codigo}`
      window.location.href = `sms:58996?body=${encodeURIComponent(texto)}`
      setValesEscaneados(prev => prev.map(v => v.id === vale.id ? {...v, estado:'enviado'} : v))
      if (i < listos.length - 1) await new Promise(r => setTimeout(r, 2000))
    }
    setEnviando(false)
  }, [valesEscaneados])

  const marcarResultado = useCallback((id, exito) => {
    setValesEscaneados(prev => prev.map(v =>
      v.id === id ? {...v, estado: exito ? 'procesado' : 'error_sms'} : v
    ))
  }, [])

  const valesListos = valesEscaneados.filter(v => v.estado === 'listo').length
  const valesProcesados = valesEscaneados.filter(v => v.estado === 'procesado').length

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{background:'var(--app-main-bg)'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--app-card-border)',background:'var(--app-card-bg)'}}>
        <div>
          <p style={{fontSize:16,fontWeight:700,color:'var(--app-text)',margin:0}}>📷 Escanear vales FISE</p>
          <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>
            {valesEscaneados.length} escaneados · {valesListos} listos · {valesProcesados} procesados
          </p>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}><X style={{width:22,height:22}}/></button>
      </div>

      {/* Contenido */}
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>

        {/* Botones escanear */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {/* Botón cámara — el label actúa como botón */}
          <label style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            padding:'16px',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
            background: procesando ? 'var(--app-card-bg-alt)' : 'var(--app-accent)',
            color: procesando ? 'var(--app-text-secondary)' : '#fff',
            border:'none', textAlign:'center', userSelect:'none'
          }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{display:'none'}} disabled={procesando}/>
            {procesando
              ? <><RefreshCw style={{width:16,height:16,animation:'spin 1s linear infinite'}}/> Procesando...</>
              : <><Camera style={{width:16,height:16}}/> Cámara</>
            }
          </label>

          {/* Botón galería */}
          <label style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            padding:'16px',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
            background:'var(--app-card-bg)',color:'var(--app-text)',
            border:'1px solid var(--app-card-border)', textAlign:'center', userSelect:'none'
          }}>
            <input type="file" accept="image/*" onChange={handleFoto} style={{display:'none'}} disabled={procesando}/>
            📁 Galería
          </label>
        </div>

        {/* Error */}
        {errorActual && (
          <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'12px',fontSize:13,color:'#f87171',marginBottom:12}}>
            <AlertTriangle style={{width:16,height:16,flexShrink:0}}/>
            <div style={{flex:1}}>{errorActual}</div>
            <button onClick={()=>setErrorActual('')} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',fontSize:16}}>✕</button>
          </div>
        )}

        {/* Lista vacía */}
        {valesEscaneados.length === 0 && !procesando && (
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--app-text-secondary)'}}>
            <Camera style={{width:48,height:48,opacity:0.2,margin:'0 auto 12px'}}/>
            <p style={{fontSize:14,margin:0}}>Presiona "Cámara" para escanear un vale</p>
            <p style={{fontSize:12,margin:'4px 0 0',opacity:0.7}}>Puedes escanear varios antes de enviar</p>
          </div>
        )}

        {/* Lista vales */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {valesEscaneados.map((vale, idx) => (
            <div key={vale.id} style={{
              borderRadius:12,border:'1px solid var(--app-card-border)',overflow:'hidden',
              background: vale.estado==='procesado'?'rgba(34,197,94,0.06)':vale.estado==='error_sms'?'rgba(239,68,68,0.06)':'var(--app-card-bg)'
            }}>
              <div style={{display:'flex',gap:10,padding:'12px'}}>
                {vale.imagen && <img src={vale.imagen} alt="vale" style={{width:52,height:52,objectFit:'cover',borderRadius:8,flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--app-text-secondary)'}}>Vale {idx+1}</span>
                    <span style={{
                      fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500,
                      background:vale.estado==='procesado'?'rgba(34,197,94,0.12)':vale.estado==='error_sms'?'rgba(239,68,68,0.12)':vale.estado==='enviado'?'rgba(59,130,246,0.12)':'rgba(234,179,8,0.12)',
                      color:vale.estado==='procesado'?'#22c55e':vale.estado==='error_sms'?'#f87171':vale.estado==='enviado'?'#60a5fa':'#eab308'
                    }}>
                      {vale.estado==='procesado'?'✅ OK':vale.estado==='error_sms'?'❌ Error':vale.estado==='enviado'?'📱 Enviado':'⏳ Listo'}
                    </span>
                    <button onClick={()=>eliminarVale(vale.id)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)',padding:2}}>
                      <Trash2 style={{width:13,height:13}}/>
                    </button>
                  </div>
                  <div style={{fontSize:12,color:'var(--app-text)',lineHeight:1.6}}>
                    <span style={{color:'var(--app-text-secondary)'}}>DNI: </span><strong>{vale.dni}</strong>
                    <span style={{color:'var(--app-text-secondary)',marginLeft:10}}>S/{vale.valor}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--app-text-secondary)',marginTop:2}}>{vale.codigo}</div>
                  {vale.beneficiario && <div style={{fontSize:11,color:'var(--app-text-secondary)'}}>{vale.beneficiario}</div>}
                  {vale.vence && <div style={{fontSize:11,color:'#eab308'}}>Vence: {vale.vence}</div>}
                  <div style={{marginTop:6,padding:'4px 8px',background:'var(--app-card-bg-alt)',borderRadius:6,fontSize:10,fontFamily:'monospace',color:'var(--app-text-secondary)'}}>
                    Fise ah01 {vale.dni} {vale.codigo}
                  </div>
                </div>
              </div>

              {/* Confirmar resultado */}
              {vale.estado === 'enviado' && (
                <div style={{display:'flex',borderTop:'1px solid var(--app-card-border)'}}>
                  <button onClick={()=>marcarResultado(vale.id,false)} style={{flex:1,padding:'10px',fontSize:12,fontWeight:500,background:'rgba(239,68,68,0.08)',color:'#f87171',border:'none',cursor:'pointer',borderRight:'1px solid var(--app-card-border)'}}>
                    ❌ Error
                  </button>
                  <button onClick={()=>marcarResultado(vale.id,true)} style={{flex:1,padding:'10px',fontSize:12,fontWeight:500,background:'rgba(34,197,94,0.08)',color:'#22c55e',border:'none',cursor:'pointer'}}>
                    ✅ Procesado
                  </button>
                </div>
              )}

              {/* Reenviar */}
              {vale.estado === 'error_sms' && (
                <div style={{padding:'8px 12px',borderTop:'1px solid var(--app-card-border)'}}>
                  <button onClick={()=>generarSMS(vale)} style={{width:'100%',padding:'8px',fontSize:12,fontWeight:500,background:'rgba(251,146,60,0.1)',color:'#fb923c',border:'1px solid rgba(251,146,60,0.3)',borderRadius:8,cursor:'pointer'}}>
                    🔄 Reintentar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:'12px 16px',borderTop:'1px solid var(--app-card-border)',background:'var(--app-card-bg)',display:'flex',gap:10,alignItems:'center'}}>
        <div style={{flex:1,fontSize:12,color:'var(--app-text-secondary)'}}>
          Total: <strong style={{color:'#22c55e'}}>S/{valesEscaneados.reduce((s,v)=>s+(v.valor||0),0)}</strong>
          {' · '}{valesEscaneados.length} vale(s)
        </div>
        {valesListos > 0 && (
          <button onClick={enviarTodos} disabled={enviando} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:10,background:'#22c55e',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,flexShrink:0}}>
            <Send style={{width:14,height:14}}/>
            {enviando ? 'Enviando...' : `Enviar ${valesListos} SMS`}
          </button>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
