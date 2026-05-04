// src/components/EscanerVales.jsx
import { useState, useRef, useCallback } from 'react'
import { Camera, X, Send, RefreshCw, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react'

export default function EscanerVales({ onClose, onValesRegistrados }) {
  const [valesEscaneados, setValesEscaneados] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [errorActual, setErrorActual] = useState('')
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef()

  // ─── Procesar imagen con Claude ──────────────────────────────────────────────
  const procesarImagen = useCallback(async (file) => {
    setProcesando(true)
    setErrorActual('')

    try {
      // Convertir imagen a base64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'image/jpeg'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              },
              {
                type: 'text',
                text: `Analiza este vale FISE peruano y extrae los siguientes datos. 
                
El DNI tiene 8 dígitos. En vales pequeños aparece como ****XXXX (últimos 4 dígitos impresos) y los primeros 4 están escritos a mano al costado. Combínalos para formar el DNI completo de 8 dígitos.

El código del vale/cupón FISE tiene el formato: XXXXXXXXXXXX (serie de números, puede aparecer como "Vale Digital FISE:" o "CUPON:").

Responde SOLO con JSON válido, sin texto adicional:
{
  "dni": "12345678",
  "codigo": "0804267233992", 
  "valor": 30,
  "vence": "31/05/2026",
  "beneficiario": "NOMBRE APELLIDO",
  "error": null
}

Si no puedes leer algún dato, ponlo como null. Si la imagen no es un vale FISE, pon error: "No es un vale FISE válido".`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const texto = data.content?.[0]?.text || ''

      // Parsear JSON de la respuesta
      const jsonMatch = texto.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No se pudo leer el vale')

      const resultado = JSON.parse(jsonMatch[0])

      if (resultado.error) {
        setErrorActual(resultado.error)
        setProcesando(false)
        return
      }

      if (!resultado.dni || !resultado.codigo) {
        setErrorActual('No se pudo detectar el DNI o código del vale. Intenta con mejor iluminación.')
        setProcesando(false)
        return
      }

      // Agregar a la lista
      const nuevoVale = {
        id: Date.now(),
        dni: resultado.dni,
        codigo: resultado.codigo,
        valor: resultado.valor || 30,
        vence: resultado.vence || '',
        beneficiario: resultado.beneficiario || '',
        imagen: URL.createObjectURL(file),
        estado: 'listo' // listo | enviado | error
      }

      setValesEscaneados(prev => [...prev, nuevoVale])
    } catch (err) {
      setErrorActual('Error al procesar la imagen. Intenta de nuevo.')
      console.error(err)
    }

    setProcesando(false)
  }, [])

  const handleFoto = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) procesarImagen(file)
    e.target.value = '' // reset para poder escanear otro
  }, [procesarImagen])

  const eliminarVale = useCallback((id) => {
    setValesEscaneados(prev => prev.filter(v => v.id !== id))
  }, [])

  // ─── Generar SMS para un vale ─────────────────────────────────────────────────
  const generarSMS = useCallback((vale) => {
    const texto = `Fise ah01 ${vale.dni} ${vale.codigo}`
    const url = `sms:58996?body=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
    // Marcar como enviado
    setValesEscaneados(prev => prev.map(v => v.id === vale.id ? {...v, estado:'enviado'} : v))
  }, [])

  // ─── Enviar todos los SMS en secuencia ───────────────────────────────────────
  const enviarTodos = useCallback(async () => {
    const listos = valesEscaneados.filter(v => v.estado === 'listo')
    if (!listos.length) return
    setEnviando(true)
    for (let i = 0; i < listos.length; i++) {
      const vale = listos[i]
      const texto = `Fise ah01 ${vale.dni} ${vale.codigo}`
      const url = `sms:58996?body=${encodeURIComponent(texto)}`
      window.open(url, '_blank')
      setValesEscaneados(prev => prev.map(v => v.id === vale.id ? {...v, estado:'enviado'} : v))
      // Esperar 1.5s entre cada SMS para que el usuario pueda enviar
      if (i < listos.length - 1) await new Promise(r => setTimeout(r, 1500))
    }
    setEnviando(false)
  }, [valesEscaneados])

  // ─── Marcar resultado del SMS ─────────────────────────────────────────────────
  const marcarResultado = useCallback((id, exito) => {
    setValesEscaneados(prev => prev.map(v =>
      v.id === id ? {...v, estado: exito ? 'procesado' : 'error_sms'} : v
    ))
  }, [])

  const valesListos = valesEscaneados.filter(v => v.estado === 'listo').length
  const valesProcesados = valesEscaneados.filter(v => v.estado === 'procesado').length

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{background:'var(--app-card-bg)'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--app-card-border)',background:'var(--app-card-bg)',position:'sticky',top:0,zIndex:10}}>
        <div>
          <p style={{fontSize:16,fontWeight:700,color:'var(--app-text)',margin:0}}>📷 Escanear vales FISE</p>
          <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>
            {valesEscaneados.length} escaneados · {valesListos} listos · {valesProcesados} procesados
          </p>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)'}}><X style={{width:22,height:22}}/></button>
      </div>

      {/* Contenido */}
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}} className="space-y-4">

        {/* Botón escanear */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{display:'none'}}/>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={procesando}
            style={{
              display:'flex',alignItems:'center',gap:8,padding:'14px 20px',
              borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
              background:'var(--app-accent)',color:'#fff',border:'none',
              opacity:procesando?0.6:1,flex:1,justifyContent:'center'
            }}
          >
            {procesando
              ? <><RefreshCw style={{width:16,height:16,animation:'spin 1s linear infinite'}}/> Procesando...</>
              : <><Camera style={{width:16,height:16}}/> Escanear vale</>
            }
          </button>

          {valesListos > 0 && (
            <button
              onClick={enviarTodos}
              disabled={enviando}
              style={{
                display:'flex',alignItems:'center',gap:8,padding:'14px 20px',
                borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
                background:'#22c55e',color:'#fff',border:'none',
                opacity:enviando?0.6:1,flex:1,justifyContent:'center'
              }}
            >
              <Send style={{width:16,height:16}}/>
              Enviar {valesListos} SMS
            </button>
          )}
        </div>

        {/* Error actual */}
        {errorActual && (
          <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'12px 14px',fontSize:13,color:'#f87171'}}>
            <AlertTriangle style={{width:16,height:16,flexShrink:0}}/>
            <div>
              <p style={{margin:0,fontWeight:600}}>{errorActual}</p>
              <button onClick={()=>setErrorActual('')} style={{fontSize:11,color:'#f87171',background:'none',border:'none',cursor:'pointer',padding:0,marginTop:2}}>Cerrar</button>
            </div>
          </div>
        )}

        {/* Lista de vales escaneados */}
        {valesEscaneados.length === 0 && !procesando && (
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--app-text-secondary)'}}>
            <Camera style={{width:48,height:48,opacity:0.2,margin:'0 auto 12px'}}/>
            <p style={{fontSize:14,margin:0}}>Presiona "Escanear vale" para comenzar</p>
            <p style={{fontSize:12,margin:'4px 0 0',opacity:0.7}}>Puedes escanear varios vales antes de enviar</p>
          </div>
        )}

        {valesEscaneados.map((vale, idx) => (
          <div key={vale.id} style={{
            borderRadius:12,border:'1px solid var(--app-card-border)',
            overflow:'hidden',
            background: vale.estado==='procesado'?'rgba(34,197,94,0.06)':vale.estado==='error_sms'?'rgba(239,68,68,0.06)':'var(--app-card-bg-alt)'
          }}>
            <div style={{display:'flex',gap:12,padding:'12px 14px',alignItems:'flex-start'}}>
              {/* Miniatura */}
              {vale.imagen && (
                <img src={vale.imagen} alt="vale" style={{width:56,height:56,objectFit:'cover',borderRadius:8,flexShrink:0,border:'1px solid var(--app-card-border)'}}/>
              )}

              {/* Datos */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--app-text-secondary)'}}>Vale {idx+1}</span>
                  <span style={{
                    fontSize:11,padding:'2px 7px',borderRadius:20,fontWeight:500,
                    background:vale.estado==='procesado'?'rgba(34,197,94,0.12)':vale.estado==='error_sms'?'rgba(239,68,68,0.12)':vale.estado==='enviado'?'rgba(59,130,246,0.12)':'rgba(234,179,8,0.12)',
                    color:vale.estado==='procesado'?'#22c55e':vale.estado==='error_sms'?'#f87171':vale.estado==='enviado'?'#60a5fa':'#eab308'
                  }}>
                    {vale.estado==='procesado'?'✅ Procesado':vale.estado==='error_sms'?'❌ Error':vale.estado==='enviado'?'📱 SMS enviado':'⏳ Listo'}
                  </span>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 12px',fontSize:12}}>
                  <div><span style={{color:'var(--app-text-secondary)'}}>DNI: </span><span style={{color:'var(--app-text)',fontWeight:600}}>{vale.dni}</span></div>
                  <div><span style={{color:'var(--app-text-secondary)'}}>Valor: </span><span style={{color:'#22c55e',fontWeight:600}}>S/{vale.valor}</span></div>
                  <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--app-text-secondary)'}}>Código: </span><span style={{color:'var(--app-text)',fontWeight:500,fontSize:11}}>{vale.codigo}</span></div>
                  {vale.beneficiario && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--app-text-secondary)'}}>Benef.: </span><span style={{color:'var(--app-text)',fontSize:11}}>{vale.beneficiario}</span></div>}
                  {vale.vence && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--app-text-secondary)'}}>Vence: </span><span style={{color:'#eab308',fontSize:11}}>{vale.vence}</span></div>}
                </div>

                {/* SMS preview */}
                <div style={{marginTop:6,padding:'5px 8px',background:'var(--app-card-bg)',borderRadius:6,fontSize:11,fontFamily:'monospace',color:'var(--app-text-secondary)',border:'1px solid var(--app-card-border)'}}>
                  Fise ah01 {vale.dni} {vale.codigo}
                </div>
              </div>

              {/* Acciones */}
              <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
                <button onClick={()=>eliminarVale(vale.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--app-text-secondary)',padding:4}}>
                  <Trash2 style={{width:14,height:14}}/>
                </button>
              </div>
            </div>

            {/* Botones de resultado — solo cuando está enviado */}
            {vale.estado === 'enviado' && (
              <div style={{display:'flex',borderTop:'1px solid var(--app-card-border)'}}>
                <button onClick={()=>marcarResultado(vale.id, false)} style={{flex:1,padding:'10px',fontSize:12,fontWeight:500,background:'rgba(239,68,68,0.08)',color:'#f87171',border:'none',cursor:'pointer',borderRight:'1px solid var(--app-card-border)'}}>
                  ❌ Error / No procesado
                </button>
                <button onClick={()=>marcarResultado(vale.id, true)} style={{flex:1,padding:'10px',fontSize:12,fontWeight:500,background:'rgba(34,197,94,0.08)',color:'#22c55e',border:'none',cursor:'pointer'}}>
                  ✅ Procesado correctamente
                </button>
              </div>
            )}

            {/* Reenviar si hubo error */}
            {vale.estado === 'error_sms' && (
              <div style={{padding:'8px 14px',borderTop:'1px solid var(--app-card-border)'}}>
                <button onClick={()=>generarSMS(vale)} style={{width:'100%',padding:'8px',fontSize:12,fontWeight:500,background:'rgba(251,146,60,0.1)',color:'#fb923c',border:'1px solid rgba(251,146,60,0.3)',borderRadius:8,cursor:'pointer'}}>
                  🔄 Reintentar SMS
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Botón individual enviar (si ya escaneó pero quiere enviar uno por uno) */}
        {valesEscaneados.filter(v=>v.estado==='listo').map(vale => (
          <div key={`sms-${vale.id}`} style={{display:'none'}}>
            {/* Referencia para envio individual desde la tarjeta */}
          </div>
        ))}

      </div>

      {/* Footer con resumen */}
      {valesEscaneados.length > 0 && (
        <div style={{padding:'14px 20px',borderTop:'1px solid var(--app-card-border)',background:'var(--app-card-bg)',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1}}>
            <p style={{fontSize:12,color:'var(--app-text-secondary)',margin:0}}>
              Total: <strong style={{color:'#22c55e'}}>S/{valesEscaneados.reduce((s,v)=>s+(v.valor||0),0)}</strong>
              {' · '}{valesEscaneados.length} vale(s)
              {valesProcesados > 0 && <> · <span style={{color:'#22c55e'}}>{valesProcesados} procesados</span></>}
            </p>
          </div>
          {valesListos > 0 && (
            <button onClick={enviarTodos} disabled={enviando} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 18px',borderRadius:10,background:'#22c55e',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>
              <Send style={{width:14,height:14}}/>
              {enviando ? 'Enviando...' : `Enviar ${valesListos} SMS`}
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
