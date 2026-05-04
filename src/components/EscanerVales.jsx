import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Send, RefreshCw, AlertTriangle, Trash2, Camera, Image } from 'lucide-react'

export default function EscanerVales({ onClose }) {
  const [valesEscaneados, setValesEscaneados] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [errorActual, setErrorActual] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modoCamara, setModoCamara] = useState(false)
  const [streamActivo, setStreamActivo] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // ─── Abrir cámara ─────────────────────────────────────────────────────────
  const abrirCamara = useCallback(async () => {
    setErrorActual('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setStreamActivo(true)
      setModoCamara(true)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setErrorActual('Permiso de cámara denegado. Ve a Ajustes → Chrome → Permisos → Cámara y actívalo.')
      } else if (err.name === 'NotFoundError') {
        setErrorActual('No se encontró cámara en este dispositivo.')
      } else {
        setErrorActual('No se pudo acceder a la cámara: ' + err.message)
      }
    }
  }, [])

  // ─── Cerrar cámara ────────────────────────────────────────────────────────
  const cerrarCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStreamActivo(false)
    setModoCamara(false)
  }, [])

  useEffect(() => () => cerrarCamara(), [cerrarCamara])

  // ─── Tomar foto ───────────────────────────────────────────────────────────
  const tomarFoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      cerrarCamara()
      await procesarImagen(blob, 'image/jpeg')
    }, 'image/jpeg', 0.9)
  }, [cerrarCamara])

  // ─── Procesar imagen con IA ───────────────────────────────────────────────
  const procesarImagen = useCallback(async (blob, mimeType = 'image/jpeg') => {
    setProcesando(true)
    setErrorActual('')
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(blob)
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
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
              { type: 'text', text: `Analiza este vale FISE peruano y extrae:
- DNI: 8 dígitos. En vales pequeños aparece ****XXXX (últimos 4 impresos) y los primeros 4 escritos a mano al costado. Combínalos para formar los 8 dígitos completos.
- Código vale: serie numérica larga (aparece como CUPON, Vale Digital FISE, o código de barras en números)
- Valor: monto en soles (30 o 43)
- Fecha vencimiento
- Nombre beneficiario si aparece

Responde SOLO JSON sin texto adicional:
{"dni":"12345678","codigo":"0804267233992","valor":30,"vence":"31/05/2026","beneficiario":"NOMBRE","error":null}

Si no es vale FISE: {"error":"No es un vale FISE"}
Si no puedes leer algún dato ponlo null.` }
            ]
          }]
        })
      })

      const data = await response.json()
      const texto = data.content?.[0]?.text || ''
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Respuesta inválida')

      const r = JSON.parse(jsonMatch[0])
      if (r.error) { setErrorActual(r.error); setProcesando(false); return }
      if (!r.dni && !r.codigo) { setErrorActual('No se detectaron datos. Intenta con mejor iluminación y enfoque.'); setProcesando(false); return }

      const imgUrl = URL.createObjectURL(blob)
      setValesEscaneados(prev => [...prev, {
        id: Date.now(), dni: r.dni || '?', codigo: r.codigo || '?',
        valor: r.valor || 30, vence: r.vence || '',
        beneficiario: r.beneficiario || '', imagen: imgUrl, estado: 'listo'
      }])
    } catch (err) {
      setErrorActual('Error al procesar la imagen: ' + err.message)
    }
    setProcesando(false)
  }, [])

  // ─── Desde galería ────────────────────────────────────────────────────────
  const handleGaleria = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) procesarImagen(file, file.type)
    e.target.value = ''
  }, [procesarImagen])

  const eliminarVale = useCallback((id) => {
    setValesEscaneados(prev => prev.filter(v => v.id !== id))
  }, [])

  const enviarSMS = useCallback((vale) => {
    const texto = `Fise ah01 ${vale.dni} ${vale.codigo}`
    window.location.href = `sms:58996?body=${encodeURIComponent(texto)}`
    setValesEscaneados(prev => prev.map(v => v.id === vale.id ? {...v, estado:'enviado'} : v))
  }, [])

  const enviarTodos = useCallback(async () => {
    const listos = valesEscaneados.filter(v => v.estado === 'listo')
    setEnviando(true)
    for (let i = 0; i < listos.length; i++) {
      const texto = `Fise ah01 ${listos[i].dni} ${listos[i].codigo}`
      window.location.href = `sms:58996?body=${encodeURIComponent(texto)}`
      setValesEscaneados(prev => prev.map(v => v.id === listos[i].id ? {...v, estado:'enviado'} : v))
      if (i < listos.length - 1) await new Promise(r => setTimeout(r, 2500))
    }
    setEnviando(false)
  }, [valesEscaneados])

  const marcarResultado = useCallback((id, exito) => {
    setValesEscaneados(prev => prev.map(v => v.id === id ? {...v, estado: exito ? 'procesado' : 'error_sms'} : v))
  }, [])

  const valesListos = valesEscaneados.filter(v => v.estado === 'listo').length
  const valesProcesados = valesEscaneados.filter(v => v.estado === 'procesado').length

  // ─── Vista cámara ─────────────────────────────────────────────────────────
  if (modoCamara) return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{background:'#000'}}>
      <video ref={videoRef} autoPlay playsInline muted style={{flex:1,objectFit:'cover',width:'100%'}}/>
      <canvas ref={canvasRef} style={{display:'none'}}/>

      {/* Guía de encuadre */}
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
        <div style={{width:'80%',maxWidth:340,aspectRatio:'1.6',border:'2px solid rgba(255,255,255,0.6)',borderRadius:12,boxShadow:'0 0 0 9999px rgba(0,0,0,0.4)'}}>
          <div style={{position:'absolute',top:8,left:0,right:0,textAlign:'center',color:'rgba(255,255,255,0.8)',fontSize:12}}>
            Centra el vale dentro del recuadro
          </div>
        </div>
      </div>

      {/* Controles */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'linear-gradient(transparent,rgba(0,0,0,0.7))'}}>
        <button onClick={cerrarCamara} style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <X style={{width:20,height:20}}/>
        </button>
        <button onClick={tomarFoto} style={{width:72,height:72,borderRadius:'50%',background:'#fff',border:'4px solid rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:'#fff',border:'2px solid #ccc'}}/>
        </button>
        <div style={{width:48}}/>
      </div>
    </div>
  )

  // ─── Vista principal ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{background:'var(--app-main-bg)'}}>
      <canvas ref={canvasRef} style={{display:'none'}}/>

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

      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>

        {/* Botones */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <button onClick={abrirCamara} disabled={procesando} style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            padding:'18px',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
            background:procesando?'var(--app-card-bg-alt)':'var(--app-accent)',
            color:procesando?'var(--app-text-secondary)':'#fff',border:'none'
          }}>
            {procesando
              ? <><RefreshCw style={{width:16,height:16,animation:'spin 1s linear infinite'}}/> Procesando...</>
              : <><Camera style={{width:18,height:18}}/> Cámara</>
            }
          </button>

          <label style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            padding:'18px',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
            background:'var(--app-card-bg)',color:'var(--app-text)',
            border:'1px solid var(--app-card-border)',userSelect:'none'
          }}>
            <input type="file" accept="image/*" onChange={handleGaleria} style={{display:'none'}} disabled={procesando}/>
            <Image style={{width:18,height:18}}/> Galería
          </label>
        </div>

        {/* Error */}
        {errorActual && (
          <div style={{display:'flex',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'12px',fontSize:13,color:'#f87171',marginBottom:12}}>
            <AlertTriangle style={{width:16,height:16,flexShrink:0,marginTop:1}}/>
            <div style={{flex:1}}>{errorActual}</div>
            <button onClick={()=>setErrorActual('')} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',fontSize:16,lineHeight:1}}>✕</button>
          </div>
        )}

        {/* Vacío */}
        {valesEscaneados.length === 0 && !procesando && (
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--app-text-secondary)'}}>
            <Camera style={{width:48,height:48,opacity:0.2,margin:'0 auto 12px'}}/>
            <p style={{fontSize:14,margin:0}}>Presiona "Cámara" para escanear</p>
            <p style={{fontSize:12,margin:'4px 0 0',opacity:0.7}}>O selecciona una foto de la galería</p>
          </div>
        )}

        {/* Lista */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {valesEscaneados.map((vale, idx) => (
            <div key={vale.id} style={{
              borderRadius:12,border:'1px solid var(--app-card-border)',overflow:'hidden',
              background:vale.estado==='procesado'?'rgba(34,197,94,0.06)':vale.estado==='error_sms'?'rgba(239,68,68,0.06)':'var(--app-card-bg)'
            }}>
              <div style={{display:'flex',gap:10,padding:'12px'}}>
                {vale.imagen && <img src={vale.imagen} alt="vale" style={{width:52,height:52,objectFit:'cover',borderRadius:8,flexShrink:0,border:'1px solid var(--app-card-border)'}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
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
                  <div style={{fontSize:13,color:'var(--app-text)'}}>
                    <span style={{color:'var(--app-text-secondary)'}}>DNI: </span><strong>{vale.dni}</strong>
                    <span style={{color:'#22c55e',fontWeight:600,marginLeft:10}}>S/{vale.valor}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--app-text-secondary)',marginTop:2,wordBreak:'break-all'}}>{vale.codigo}</div>
                  {vale.beneficiario && <div style={{fontSize:11,color:'var(--app-text-secondary)'}}>{vale.beneficiario}</div>}
                  {vale.vence && <div style={{fontSize:11,color:'#eab308'}}>Vence: {vale.vence}</div>}
                  <div style={{marginTop:6,padding:'4px 8px',background:'var(--app-card-bg-alt)',borderRadius:6,fontSize:10,fontFamily:'monospace',color:'var(--app-text-secondary)',wordBreak:'break-all'}}>
                    Fise ah01 {vale.dni} {vale.codigo}
                  </div>
                  {vale.estado === 'listo' && (
                    <button onClick={()=>enviarSMS(vale)} style={{marginTop:6,width:'100%',padding:'7px',fontSize:12,fontWeight:500,background:'rgba(59,130,246,0.1)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.3)',borderRadius:8,cursor:'pointer'}}>
                      📱 Enviar este SMS
                    </button>
                  )}
                </div>
              </div>

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

              {vale.estado === 'error_sms' && (
                <div style={{padding:'8px 12px',borderTop:'1px solid var(--app-card-border)'}}>
                  <button onClick={()=>enviarSMS(vale)} style={{width:'100%',padding:'8px',fontSize:12,fontWeight:500,background:'rgba(251,146,60,0.1)',color:'#fb923c',border:'1px solid rgba(251,146,60,0.3)',borderRadius:8,cursor:'pointer'}}>
                    🔄 Reintentar SMS
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
        {valesListos > 1 && (
          <button onClick={enviarTodos} disabled={enviando} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:10,background:'#22c55e',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>
            <Send style={{width:14,height:14}}/>
            {enviando ? 'Enviando...' : `Enviar ${valesListos} SMS`}
          </button>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
