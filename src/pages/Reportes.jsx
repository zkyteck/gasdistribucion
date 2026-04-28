import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { TrendingUp, Package, Ticket, AlertCircle, Printer, RefreshCw, DollarSign, ShoppingCart, Store, Truck, BarChart2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, eachDayOfInterval, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

const COLORS = ['var(--app-accent)', '#22c55e', '#eab308', '#f87171', '#a78bfa', '#06b6d4']

// ─── Tooltip respeta el tema ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if(!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--app-card-bg)', border:'1px solid var(--app-card-border)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:'var(--app-text-secondary)', marginBottom:4, fontWeight:500 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, fontWeight:600, margin:'2px 0' }}>
          {p.name}: {typeof p.value==='number'&&p.name!=='Balones'?'S/':''}{p.value?.toLocaleString('es-PE')}
        </p>
      ))}
    </div>
  )
}

// ─── StatCard respeta el tema ─────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, Icon }) {
  return (
    <div style={{ background:'var(--app-card-bg)', border:`1px solid ${accent}33`, borderRadius:12, padding:'14px 16px' }}>
      {Icon && <Icon style={{ width:16, height:16, color:accent, marginBottom:8, opacity:0.8 }}/>}
      <p style={{ fontSize:22, fontWeight:700, color:'var(--app-text)', margin:0 }}>{value}</p>
      <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'3px 0 0', fontWeight:500 }}>{label}</p>
      {sub && <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0', opacity:0.7 }}>{sub}</p>}
    </div>
  )
}

export default function Reportes() {
  const [tab, setTab] = useState('resumen')
  const [filtroVista, setFiltroVista] = useState('todo')
  const [periodo, setPeriodo] = useState('mes')
  const [fechaDesde, setFechaDesde] = useState(hoyPeru())
  const [fechaHasta, setFechaHasta] = useState(hoyPeru())
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  // ─── Rango de fechas ────────────────────────────────────────────────────────
  const getRango = useCallback(() => {
    const hoy = hoyPeru()
    const ahora = new Date()
    if(periodo==='hoy') return { desdeDate:hoy, hastaDate:hoy }
    if(periodo==='semana') {
      const hace7 = new Date(ahora.getTime()-7*24*60*60*1000)
      return { desdeDate:hace7.toISOString().split('T')[0], hastaDate:hoy }
    }
    if(periodo==='mes') {
      const [y,m] = hoy.split('-').map(Number)
      return { desdeDate:`${y}-${String(m).padStart(2,'0')}-01`, hastaDate:new Date(y,m,0).toISOString().split('T')[0] }
    }
    return { desdeDate:fechaDesde, hastaDate:fechaHasta }
  }, [periodo, fechaDesde, fechaHasta])

  // ─── Calcular ───────────────────────────────────────────────────────────────
  const calcular = useCallback(async () => {
    setLoading(true)
    try {
      const { desdeDate, hastaDate } = getRango()

      // Rango mes anterior para comparación
      const desdeParsed = new Date(desdeDate+'T12:00:00')
      const anteriorDesde = format(subMonths(startOfMonth(desdeParsed),'0' === format(desdeParsed,'d')?1:1),'yyyy-MM-dd')
      const anteriorHasta = format(endOfMonth(subMonths(desdeParsed,1)),'yyyy-MM-dd')

      const [
        { data:ventas },
        { data:ventasDist },
        { data:costosCfg },
        { data:almacenes },
        { data:distribuidores },
        { data:valesFise },
        { data:deudas },
        { data:stockPorTipo },
        { data:ventasAnteriores },
        { data:ingCreditoData },
      ] = await Promise.all([
        // Ventas tienda (excluye credito pendiente)
        supabase.from('ventas').select('*, clientes(nombre), almacenes(nombre)')
          .gte('fecha',desdeDate+'T00:00:00-05:00').lte('fecha',hastaDate+'T23:59:59-05:00')
          .not('metodo_pago','in','("credito")'),
        // Ventas distribuidores
        supabase.from('ventas').select('*, almacenes(nombre)')
          .gte('fecha',desdeDate+'T00:00:00-05:00').lte('fecha',hastaDate+'T23:59:59-05:00')
          .in('metodo_pago',['efectivo','yape','vale','mixto','arreglo_distribuidor','cobro_credito']),
        // Costos
        supabase.from('configuracion').select('clave,valor').in('clave',['costo_5kg','costo_10kg','costo_45kg']),
        // Almacenes
        supabase.from('almacenes').select('*').eq('activo',true).order('nombre'),
        // Distribuidores
        supabase.from('distribuidores').select('*').eq('activo',true).order('nombre'),
        // Vales FISE
        supabase.from('vales_fise').select('*').gte('lote_dia',desdeDate).lte('lote_dia',hastaDate),
        // Deudas activas
        supabase.from('deudas').select('monto_pendiente,tipo_deuda').neq('estado','liquidada'),
        // Stock por tipo
        supabase.from('stock_por_tipo').select('*'),
        // Ventas mes anterior (para comparación)
        supabase.from('ventas').select('cantidad,precio_unitario,tipo_balon')
          .gte('fecha',anteriorDesde+'T00:00:00-05:00').lte('fecha',anteriorHasta+'T23:59:59-05:00')
          .not('metodo_pago','in','("credito")'),
        // Ventas al crédito pendiente del período
        supabase.from('ventas').select('cantidad,precio_unitario')
          .gte('fecha',desdeDate+'T00:00:00-05:00').lte('fecha',hastaDate+'T23:59:59-05:00')
          .eq('metodo_pago','credito'),
      ])

      // ── Costos ────────────────────────────────────────────────────────────
      const costos = { '5kg':0, '10kg':0, '45kg':0 }
      costosCfg?.forEach(r => {
        if(r.clave==='costo_5kg') costos['5kg']=parseFloat(r.valor)||0
        if(r.clave==='costo_10kg') costos['10kg']=parseFloat(r.valor)||0
        if(r.clave==='costo_45kg') costos['45kg']=parseFloat(r.valor)||0
      })
      const totalBalVendidos = ventas?.reduce((s,v)=>s+(v.cantidad||0),0)||1
      const costoTotalVentas = ventas?.reduce((s,v)=>s+(v.cantidad||0)*(costos[v.tipo_balon||'10kg']||0),0)||0
      const costoPromedio = totalBalVendidos>0 ? costoTotalVentas/totalBalVendidos : (costos['10kg']||0)

      // ── Tienda ────────────────────────────────────────────────────────────
      const ingTienda = ventas?.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)||0
      const balTienda = ventas?.reduce((s,v)=>s+(v.cantidad||0),0)||0
      const costoTienda = ventas?.reduce((s,v)=>s+(v.cantidad||0)*(costos[v.tipo_balon||'10kg']||costoPromedio),0)||0
      const ganTienda = ingTienda - costoTienda

      // ── Mes anterior ──────────────────────────────────────────────────────
      const ingAnterior = ventasAnteriores?.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)||0
      const variacionMes = ingAnterior>0 ? parseFloat(((ingTienda-ingAnterior)/ingAnterior*100).toFixed(1)) : null

      // ── Crédito del período ───────────────────────────────────────────────
      const ingCredito = ingCreditoData?.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)||0
      const ingCobroCredito = ventas?.filter(v=>v.metodo_pago==='cobro_credito').reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)||0

      // ── Por tipo balón ────────────────────────────────────────────────────
      const porBalon = {}
      ventas?.forEach(v => {
        const t = v.tipo_balon||'10kg'
        if(!porBalon[t]) porBalon[t]={ balones:0, ingreso:0, ganancia:0 }
        porBalon[t].balones += v.cantidad||0
        porBalon[t].ingreso += (v.cantidad||0)*(v.precio_unitario||0)
        porBalon[t].ganancia += (v.cantidad||0)*((v.precio_unitario||0)-(costos[t]||0))
      })

      // ── Por método de pago ────────────────────────────────────────────────
      const porPago = {}
      ventas?.forEach(v => {
        const t = v.metodo_pago||'efectivo'
        if(!porPago[t]) porPago[t]={ ingreso:0, count:0 }
        porPago[t].ingreso += (v.cantidad||0)*(v.precio_unitario||0)
        porPago[t].count += v.cantidad||0
      })

      // ── Top clientes ──────────────────────────────────────────────────────
      const porCliente = {}
      ventas?.forEach(v => {
        const n = v.clientes?.nombre||'Cliente Varios'
        if(!porCliente[n]) porCliente[n]={ total:0, balones:0 }
        porCliente[n].total += (v.cantidad||0)*(v.precio_unitario||0)
        porCliente[n].balones += v.cantidad||0
      })
      const topClientes = Object.entries(porCliente).sort((a,b)=>b[1].total-a[1].total).slice(0,5)

      // ── Top días ──────────────────────────────────────────────────────────
      const porDia = {}
      ventas?.forEach(v => {
        const d = (v.fecha||'').split('T')[0]
        if(!porDia[d]) porDia[d]={ ingreso:0, balones:0 }
        porDia[d].ingreso += (v.cantidad||0)*(v.precio_unitario||0)
        porDia[d].balones += v.cantidad||0
      })
      const topDias = Object.entries(porDia).sort((a,b)=>b[1].ingreso-a[1].ingreso).slice(0,5).map(([fecha,d])=>({ fecha:format(new Date(fecha+'T12:00:00'),'EEE dd/MM',{locale:es}), ...d }))

      // ── Distribuidores ────────────────────────────────────────────────────
      const distAlmacenMap = {}
      ;(distribuidores||[]).forEach(d => { if(d.almacen_id) distAlmacenMap[d.almacen_id]=d.nombre })
      const distAlmacenIds = Object.keys(distAlmacenMap)
      const porDist = {}
      ;(ventasDist||[]).filter(v=>distAlmacenIds.includes(v.almacen_id)).forEach(v => {
        const distNombre = distAlmacenMap[v.almacen_id]||v.almacenes?.nombre||'Sin nombre'
        if(!porDist[distNombre]) porDist[distNombre]={ ingreso:0, balones:0, ganancia:0, vales20:0, vales30:0, vales43:0, efectivo:0, saldo:0 }
        const monto=(v.cantidad||0)*(v.precio_unitario||0)
        const costo=(v.cantidad||0)*(costos[v.tipo_balon||'10kg']||costoPromedio) // usa el tipo correcto
        const v20=v.vales_20||0, v30=v.vales_30||0, v43=v.vales_43||0
        const ef=v.efectivo_dist||0
        const totalVales=v20*20+v30*30+v43*43
        porDist[distNombre].ingreso += monto
        porDist[distNombre].balones += v.cantidad||0
        porDist[distNombre].ganancia += monto-costo
        porDist[distNombre].vales20 += v20
        porDist[distNombre].vales30 += v30
        porDist[distNombre].vales43 += v43
        porDist[distNombre].efectivo += ef
        porDist[distNombre].saldo += monto-totalVales-ef
      })
      const ingDist=Object.values(porDist).reduce((s,d)=>s+d.ingreso,0)
      const balDist=Object.values(porDist).reduce((s,d)=>s+d.balones,0)
      const costoDist=Object.values(porDist).reduce((s,d)=>s+d.ingreso-d.ganancia,0)
      const ganDist=Object.values(porDist).reduce((s,d)=>s+d.ganancia,0)

      // ── Stock actual (con respaldo en almacenes.stock_actual) ─────────────
      const stockActual = (almacenes||[]).map(a => {
        const spt = (stockPorTipo||[]).filter(s=>s.almacen_id===a.id)
        const l5  = spt.find(s=>s.tipo_balon==='5kg')?.stock_actual||0
        const l10 = spt.find(s=>s.tipo_balon==='10kg')?.stock_actual||0
        const l45 = spt.find(s=>s.tipo_balon==='45kg')?.stock_actual||0
        const totalSpt = l5+l10+l45
        // Si stock_por_tipo está vacío, usar almacenes.stock_actual como respaldo
        const totalLlenos = totalSpt>0 ? totalSpt : (a.stock_actual||0)
        return {
          ...a,
          llenos5:l5, llenos10:l10, llenos45:l45,
          totalLlenos,
          totalVacios:a.balones_vacios||0,
          vacios5:a.vacios_5kg||0, vacios10:a.vacios_10kg||0, vacios45:a.vacios_45kg||0,
        }
      })

      // ── Gráfica diaria ────────────────────────────────────────────────────
      const dias = eachDayOfInterval({ start:parseISO(desdeDate), end:parseISO(hastaDate) })
      const diario = dias.map(dia => {
        const ds = format(dia,'yyyy-MM-dd')
        const vDia = (ventas||[]).filter(v=>v.fecha?.startsWith(ds))
        const iT = vDia.reduce((s,v)=>s+(v.cantidad||0)*(v.precio_unitario||0),0)
        const gT = vDia.reduce((s,v)=>s+(v.cantidad||0)*((v.precio_unitario||0)-(costos[v.tipo_balon||'10kg']||0)),0)
        const bT = vDia.reduce((s,v)=>s+(v.cantidad||0),0)
        return {
          dia: format(dia, dias.length>15?'dd/MM':'EEE dd',{locale:es}),
          Tienda:Math.round(iT),
          'Gan.Tienda':Math.round(gT),
          'Bal.Tienda':bT,
        }
      })

      setData({
        costos, costoPromedio,
        ingTienda, balTienda, costoTienda, ganTienda,
        ingDist, balDist, costoDist, ganDist,
        ingTotal:ingTienda+ingDist, ganTotal:ganTienda+ganDist,
        balTotal:balTienda+balDist, costoTotal:costoTienda+costoDist,
        margen:(ingTienda+ingDist)>0?(ganTienda+ganDist)/(ingTienda+ingDist)*100:0,
        ingAnterior, variacionMes,
        ingCredito, ingCobroCredito,
        porBalon, porPago, porDist, topClientes, topDias, diario, stockActual,
        totalValesFise:valesFise?.reduce((s,v)=>s+(v.monto||0),0)||0,
        totalDeudas:deudas?.filter(d=>d.tipo_deuda==='dinero').reduce((s,d)=>s+(parseFloat(d.monto_pendiente)||0),0)||0,
        distribuidores:distribuidores||[],
      })
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [getRango])

  useEffect(() => { calcular() }, [calcular])

  const lPago = { efectivo:'💵 Efectivo', yape:'📱 Yape', vale:'🎫 Vale', mixto:'🔀 Mixto', cobro_credito:'✅ Cobro', transferencia:'🏦 Transfer.' }
  const lBalon = { '5kg':'🔵 5kg', '10kg':'🟡 10kg', '45kg':'🔴 45kg' }

  const ing   = !data?0:filtroVista==='tienda'?data.ingTienda:filtroVista==='distribuidores'?data.ingDist:data.ingTotal
  const gan   = !data?0:filtroVista==='tienda'?data.ganTienda:filtroVista==='distribuidores'?data.ganDist:data.ganTotal
  const bal   = !data?0:filtroVista==='tienda'?data.balTienda:filtroVista==='distribuidores'?data.balDist:data.balTotal
  const costo = !data?0:filtroVista==='tienda'?data.costoTienda:filtroVista==='distribuidores'?data.costoDist:data.costoTotal

  const tabStyle = (id) => ({
    padding:'7px 16px', borderRadius:8, fontSize:13, fontWeight:500,
    background:tab===id?'var(--app-accent)':'transparent',
    color:tab===id?'#fff':'var(--app-text-secondary)',
    border:'none', cursor:'pointer', transition:'all 0.15s'
  })

  const filtroStyle = (active, accentColor) => ({
    display:'flex', alignItems:'center', gap:5,
    padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500,
    background:active?`color-mix(in srgb, ${accentColor} 15%, transparent)`:'transparent',
    color:active?accentColor:'var(--app-text-secondary)',
    border:active?`1px solid ${accentColor}44`:'1px solid transparent',
    cursor:'pointer', transition:'all 0.15s'
  })

  const periodoStyle = (id) => ({
    padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500,
    background:periodo===id?'color-mix(in srgb, #22c55e 15%, transparent)':'transparent',
    color:periodo===id?'#22c55e':'var(--app-text-secondary)',
    border:periodo===id?'1px solid rgba(34,197,94,0.4)':'1px solid transparent',
    cursor:'pointer', transition:'all 0.15s'
  })

  return (
    <div className="space-y-5" id="reporte-print">

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--app-text)',margin:0}}>Reportes</h2>
          <p style={{fontSize:13,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>
            Centro Gas Paucara — {format(new Date(),"dd 'de' MMMM, yyyy",{locale:es})}
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={calcular} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/>Actualizar
          </button>
          <button onClick={()=>window.print()} className="btn-secondary">
            <Printer className="w-3.5 h-3.5"/>Imprimir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,background:'var(--app-card-bg-alt)',borderRadius:10,padding:4,width:'fit-content',border:'1px solid var(--app-card-border)'}}>
        {[['resumen','📊 Resumen'],['ganancias','📈 Ganancias'],['stock','📦 Stock']].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={tabStyle(key)}>{label}</button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
        {/* Vista */}
        <div style={{display:'flex',gap:2,background:'var(--app-card-bg-alt)',borderRadius:10,padding:4,border:'1px solid var(--app-card-border)'}}>
          <button onClick={()=>setFiltroVista('todo')} style={filtroStyle(filtroVista==='todo','var(--app-text-secondary)')}><BarChart2 style={{width:12,height:12}}/>Todo</button>
          <button onClick={()=>setFiltroVista('tienda')} style={filtroStyle(filtroVista==='tienda','var(--app-accent)')}><Store style={{width:12,height:12}}/>Tienda</button>
          <button onClick={()=>setFiltroVista('distribuidores')} style={filtroStyle(filtroVista==='distribuidores','#fb923c')}><Truck style={{width:12,height:12}}/>Distribuidores</button>
        </div>

        {/* Período */}
        <div style={{display:'flex',gap:2,background:'var(--app-card-bg-alt)',borderRadius:10,padding:4,border:'1px solid var(--app-card-border)'}}>
          {[['hoy','Hoy'],['semana','Semana'],['mes','Mes'],['personalizado','Personalizado']].map(([key,label])=>(
            <button key={key} onClick={()=>setPeriodo(key)} style={periodoStyle(key)}>{label}</button>
          ))}
        </div>

        {periodo==='personalizado'&&(
          <div style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div><label className="label" style={{fontSize:11}}>Desde</label><input type="date" className="input" style={{fontSize:12,padding:'5px 8px'}} value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)}/></div>
            <div><label className="label" style={{fontSize:11}}>Hasta</label><input type="date" className="input" style={{fontSize:12,padding:'5px 8px'}} value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)}/></div>
            <button onClick={calcular} className="btn-primary" style={{fontSize:12,padding:'6px 12px'}}>Calcular</button>
          </div>
        )}
      </div>

      {loading?(
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:160,color:'var(--app-text-secondary)',gap:8}}>
          <RefreshCw style={{width:20,height:20,animation:'spin 1s linear infinite'}}/>Calculando...
        </div>
      ):!data?null:(<>

        {/* ── TAB RESUMEN ── */}
        {tab==='resumen'&&(
          <div className="space-y-5">

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Ingresos totales" value={`S/${ing.toLocaleString('es-PE')}`} accent="var(--app-accent)" Icon={DollarSign}
                sub={filtroVista==='todo'?`Tienda + Distribuidores`:filtroVista==='tienda'?`${data.balTienda} ventas`:`${data.balDist} balones`}/>
              <StatCard label="Balones vendidos" value={`${bal} bal.`} accent="#22c55e" Icon={Package}
                sub={filtroVista==='todo'?`Tienda: ${data.balTienda} · Dist: ${data.balDist}`:''}/>
              <StatCard label="Vales FISE" value={`S/${data.totalValesFise.toLocaleString('es-PE')}`} accent="#eab308" Icon={Ticket}/>
              <StatCard label="Deudas pendientes" value={`S/${data.totalDeudas.toLocaleString('es-PE')}`} accent="#f87171" Icon={AlertCircle}/>
            </div>

            {/* Comparación mes anterior */}
            {data.variacionMes!==null&&(
              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'14px 18px',display:'flex',gap:24,flexWrap:'wrap'}}>
                <div>
                  <p style={{fontSize:22,fontWeight:700,color:'var(--app-text)',margin:0}}>S/{data.ingTienda.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                  <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Este período</p>
                </div>
                <div style={{borderLeft:'1px solid var(--app-card-border)',paddingLeft:24}}>
                  <p style={{fontSize:18,fontWeight:600,color:'var(--app-text-secondary)',margin:0}}>S/{data.ingAnterior.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                  <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Período anterior</p>
                </div>
                <div style={{borderLeft:'1px solid var(--app-card-border)',paddingLeft:24,display:'flex',alignItems:'center'}}>
                  <span style={{fontSize:16,fontWeight:700,color:data.variacionMes>=0?'#22c55e':'#f87171'}}>
                    {data.variacionMes>=0?'↑':'↓'} {Math.abs(data.variacionMes)}%
                  </span>
                  <span style={{fontSize:11,color:'var(--app-text-secondary)',marginLeft:6}}>vs mes anterior</span>
                </div>
                {ingCredito>0&&(
                  <div style={{borderLeft:'1px solid var(--app-card-border)',paddingLeft:24}}>
                    <p style={{fontSize:18,fontWeight:600,color:'#fb923c',margin:0}}>S/{ingCredito.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Por cobrar (crédito)</p>
                  </div>
                )}
                {data.ingCobroCredito>0&&(
                  <div style={{borderLeft:'1px solid var(--app-card-border)',paddingLeft:24}}>
                    <p style={{fontSize:18,fontWeight:600,color:'#22c55e',margin:0}}>S/{data.ingCobroCredito.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'2px 0 0'}}>Cobrado en el período</p>
                  </div>
                )}
              </div>
            )}

            {/* Gráfica ingresos diarios */}
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>📈 Ingresos diarios</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.diario} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)"/>
                  <XAxis dataKey="dia" tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`S/${v}`} width={55}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="Tienda" fill="var(--app-accent)" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Balones por día */}
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>🔵 Balones vendidos por día</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.diario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)"/>
                  <XAxis dataKey="dia" tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="Bal.Tienda" name="Balones" fill="#22c55e" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Por método de pago */}
              {filtroVista!=='distribuidores'&&(
                <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>Por método de pago (tienda)</p>
                  {Object.keys(data.porPago).length===0
                    ?<p style={{color:'var(--app-text-secondary)',fontSize:13,textAlign:'center',padding:'20px 0'}}>Sin ventas</p>
                    :<div className="space-y-3">
                      {Object.entries(data.porPago).sort((a,b)=>b[1].ingreso-a[1].ingreso).map(([tipo,d],i)=>{
                        const max=Math.max(...Object.values(data.porPago).map(x=>x.ingreso))
                        return(
                          <div key={tipo}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                              <span style={{color:'var(--app-text)'}}>{lPago[tipo]||tipo}</span>
                              <span style={{color:'var(--app-text)',fontWeight:600}}>S/{d.ingreso.toLocaleString()} <span style={{color:'var(--app-text-secondary)',fontSize:11}}>({d.count} bal.)</span></span>
                            </div>
                            <div style={{height:6,background:'var(--app-card-bg-alt)',borderRadius:3,overflow:'hidden'}}>
                              <div style={{height:'100%',borderRadius:3,width:`${(d.ingreso/max)*100}%`,background:COLORS[i%COLORS.length],transition:'width 0.5s'}}/>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  }
                </div>
              )}

              {/* Por tipo de balón */}
              {filtroVista!=='distribuidores'&&(
                <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>Por tipo de balón</p>
                  {Object.keys(data.porBalon).length===0
                    ?<p style={{color:'var(--app-text-secondary)',fontSize:13,textAlign:'center',padding:'20px 0'}}>Sin ventas</p>
                    :<div className="space-y-3">
                      {Object.entries(data.porBalon).sort((a,b)=>b[1].balones-a[1].balones).map(([tipo,d],i)=>(
                        <div key={tipo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--app-card-bg-alt)',borderRadius:8}}>
                          <span style={{fontWeight:600,color:'var(--app-text)'}}>{lBalon[tipo]||tipo}</span>
                          <div style={{textAlign:'right'}}>
                            <p style={{fontSize:14,fontWeight:700,color:'var(--app-accent)',margin:0}}>{d.balones} bal. — S/{d.ingreso.toLocaleString()}</p>
                            <p style={{fontSize:11,color:'#22c55e',margin:0}}>+S/{d.ganancia.toLocaleString('es-PE',{maximumFractionDigits:0})} ganancia</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )}
            </div>

            {/* Top clientes + Top días */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>🏆 Top 5 clientes</p>
                {data.topClientes.length===0
                  ?<p style={{color:'var(--app-text-secondary)',fontSize:13,textAlign:'center',padding:'20px 0'}}>Sin ventas</p>
                  :<div className="space-y-2">
                    {data.topClientes.map(([nombre,d],i)=>(
                      <div key={nombre} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--app-card-bg-alt)',borderRadius:8}}>
                        <span style={{fontSize:13,fontWeight:700,color:i===0?'#eab308':i===1?'var(--app-text-secondary)':i===2?'#fb923c':'var(--app-text-secondary)',width:20,flexShrink:0}}>#{i+1}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:13,fontWeight:500,color:'var(--app-text)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nombre}</p>
                          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>{d.balones} balones</p>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:'var(--app-accent)',flexShrink:0}}>S/{d.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>

              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>📅 Top 5 días</p>
                {data.topDias.length===0
                  ?<p style={{color:'var(--app-text-secondary)',fontSize:13,textAlign:'center',padding:'20px 0'}}>Sin ventas</p>
                  :<div className="space-y-2">
                    {data.topDias.map(({fecha,ingreso,balones},i)=>(
                      <div key={fecha} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--app-card-bg-alt)',borderRadius:8}}>
                        <span style={{fontSize:13,fontWeight:700,color:i===0?'#eab308':'var(--app-text-secondary)',width:20,flexShrink:0}}>#{i+1}</span>
                        <div style={{flex:1}}>
                          <p style={{fontSize:13,fontWeight:500,color:'var(--app-text)',margin:0}}>{fecha}</p>
                          <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:0}}>{balones} balones</p>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:'var(--app-accent)',flexShrink:0}}>S/{ingreso.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>

            {/* Distribuidores */}
            {filtroVista!=='tienda'&&Object.keys(data.porDist).length>0&&(
              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>🚛 Resumen distribuidores</p>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table className="w-full">
                    <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                      {['Distribuidor','Balones','Ingreso','Ganancia','Vales S/20','Vales S/30','Vales S/43','Efectivo','Saldo'].map(h=>(
                        <th key={h} className="text-left text-xs font-semibold uppercase px-4 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {Object.entries(data.porDist).map(([nombre,d])=>(
                        <tr key={nombre} className="table-row-hover">
                          <td className="px-4 py-3 font-medium text-sm" style={{color:'var(--app-text)'}}>{nombre}</td>
                          <td className="px-4 py-3 font-bold" style={{color:'var(--app-accent)'}}>{d.balones}</td>
                          <td className="px-4 py-3 font-bold" style={{color:'#22c55e'}}>S/{d.ingreso.toLocaleString()}</td>
                          <td className="px-4 py-3 font-bold" style={{color:d.ganancia>=0?'#22c55e':'#f87171'}}>S/{d.ganancia.toLocaleString('es-PE',{maximumFractionDigits:0})}</td>
                          <td className="px-4 py-3 text-sm" style={{color:'var(--app-text-secondary)'}}>{d.vales20>0?d.vales20:'—'}</td>
                          <td className="px-4 py-3 text-sm" style={{color:'var(--app-text-secondary)'}}>{d.vales30>0?d.vales30:'—'}</td>
                          <td className="px-4 py-3 text-sm" style={{color:'var(--app-text-secondary)'}}>{d.vales43>0?d.vales43:'—'}</td>
                          <td className="px-4 py-3 font-medium" style={{color:'var(--app-text)'}}>{d.efectivo>0?`S/${d.efectivo.toLocaleString()}`:'—'}</td>
                          <td className="px-4 py-3 font-bold" style={{color:d.saldo<=0?'#22c55e':'#fb923c'}}>{d.saldo<=0?'✅ Al día':`S/${d.saldo.toLocaleString()}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB GANANCIAS ── */}
        {tab==='ganancias'&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Ingresos" value={`S/${ing.toLocaleString('es-PE')}`} accent="var(--app-accent)" Icon={TrendingUp}/>
              <StatCard label="Costo de compra" value={`S/${costo.toLocaleString('es-PE',{maximumFractionDigits:0})}`} accent="#f87171" Icon={ShoppingCart}/>
              <StatCard label="Ganancia neta" value={`S/${gan.toLocaleString('es-PE',{maximumFractionDigits:0})}`} accent="#22c55e" Icon={DollarSign}
                sub={`Margen: ${data.margen.toFixed(1)}%`}/>
              <StatCard label="Costo promedio/bal." value={`S/${data.costoPromedio.toFixed(2)}`} accent="#eab308"/>
            </div>

            {/* Gráfica ganancia diaria */}
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>📈 Ganancia diaria (tienda)</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.diario}>
                  <defs>
                    <linearGradient id="gradGan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)"/>
                  <XAxis dataKey="dia" tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`S/${v}`} width={55}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="Gan.Tienda" name="Ganancia" stroke="#22c55e" strokeWidth={2} fill="url(#gradGan)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Costos por tipo */}
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>Costos configurados</p>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(data.costos).map(([tipo,costo])=>(
                  <div key={tipo} style={{background:'var(--app-card-bg-alt)',borderRadius:8,padding:'12px',textAlign:'center'}}>
                    <p style={{fontSize:18,fontWeight:700,color:'var(--app-text)',margin:0}}>S/{costo}</p>
                    <p style={{fontSize:11,color:'var(--app-text-secondary)',margin:'3px 0 0'}}>Costo {tipo}/bal</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalle crédito */}
            {(data.ingCredito>0||data.ingCobroCredito>0)&&(
              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 12px'}}>Crédito del período</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <p style={{color:'var(--app-text-secondary)',fontSize:13,margin:0}}>Monto por cobrar (ventas al crédito)</p>
                  <p style={{color:'#fb923c',fontWeight:700,fontSize:16,margin:0}}>S/{data.ingCredito.toLocaleString()}</p>
                </div>
                {data.ingCobroCredito>0&&(
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8,borderTop:'1px solid var(--app-card-border)'}}>
                    <p style={{color:'var(--app-text-secondary)',fontSize:13,margin:0}}>✅ Cobrado en el período</p>
                    <p style={{color:'#22c55e',fontWeight:700,fontSize:16,margin:0}}>S/{data.ingCobroCredito.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB STOCK ── */}
        {tab==='stock'&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total llenos" value={`${data.stockActual.reduce((s,a)=>s+a.totalLlenos,0)} bal.`} accent="#22c55e" Icon={Package}/>
              <StatCard label="Total vacíos" value={`${data.stockActual.reduce((s,a)=>s+a.totalVacios,0)} bal.`} accent="var(--app-text-secondary)" Icon={Package}/>
              <StatCard label="Vendidos (período)" value={`${data.balTienda} bal.`} accent="var(--app-accent)" sub="Solo tienda"/>
              <StatCard label="En campo (dist.)" value={`${data.distribuidores.reduce((s,d)=>s+(d.stock_actual||0),0)} bal.`} accent="#fb923c"/>
            </div>

            {/* Tabla stock almacenes */}
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)'}}>
                <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>📦 Stock por almacén</p>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="w-full">
                  <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                    {['Almacén','Responsable','🟢 Llenos','⚪ Vacíos','Detalle llenos','Detalle vacíos','Estado'].map(h=>(
                      <th key={h} className="text-left text-xs font-semibold uppercase px-4 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {data.stockActual.map(a=>(
                      <tr key={a.id} className="table-row-hover">
                        <td className="px-4 py-4 font-medium text-sm" style={{color:'var(--app-text)'}}>{a.nombre}</td>
                        <td className="px-4 py-4 text-sm" style={{color:'var(--app-text-secondary)'}}>{a.responsable||'-'}</td>
                        <td className="px-4 py-4">
                          <span style={{fontSize:16,fontWeight:700,color:a.totalLlenos>50?'#22c55e':a.totalLlenos>10?'#eab308':'#f87171'}}>
                            {a.totalLlenos} bal.
                          </span>
                        </td>
                        <td className="px-4 py-4 font-bold text-lg" style={{color:'var(--app-text-secondary)'}}>{a.totalVacios} bal.</td>
                        <td className="px-4 py-4">
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {a.llenos5>0&&<span style={{fontSize:11,background:'rgba(59,130,246,0.12)',color:'#60a5fa',padding:'2px 6px',borderRadius:4}}>5kg:{a.llenos5}</span>}
                            {a.llenos10>0&&<span style={{fontSize:11,background:'rgba(234,179,8,0.12)',color:'#eab308',padding:'2px 6px',borderRadius:4}}>10kg:{a.llenos10}</span>}
                            {a.llenos45>0&&<span style={{fontSize:11,background:'rgba(239,68,68,0.12)',color:'#f87171',padding:'2px 6px',borderRadius:4}}>45kg:{a.llenos45}</span>}
                            {a.totalLlenos===0&&<span style={{color:'var(--app-text-secondary)',fontSize:11}}>—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {a.vacios5>0&&<span style={{fontSize:11,background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',padding:'2px 6px',borderRadius:4,border:'1px solid var(--app-card-border)'}}>5kg:{a.vacios5}</span>}
                            {a.vacios10>0&&<span style={{fontSize:11,background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',padding:'2px 6px',borderRadius:4,border:'1px solid var(--app-card-border)'}}>10kg:{a.vacios10}</span>}
                            {a.vacios45>0&&<span style={{fontSize:11,background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',padding:'2px 6px',borderRadius:4,border:'1px solid var(--app-card-border)'}}>45kg:{a.vacios45}</span>}
                            {a.totalVacios===0&&<span style={{color:'var(--app-text-secondary)',fontSize:11}}>—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={a.totalLlenos>50?'badge-green':a.totalLlenos>10?'badge-yellow':'badge-red'}>
                            {a.totalLlenos>50?'Bien':a.totalLlenos>10?'Bajo':'Crítico'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock distribuidores */}
            {data.distribuidores.length>0&&(
              <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid var(--app-card-border)'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:0}}>🚛 Stock distribuidores</p>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table className="w-full">
                    <thead><tr style={{borderBottom:'1px solid var(--app-card-border)'}}>
                      {['Distribuidor','🟢 En campo','⚪ Vacíos','Precio/bal.','Valor en campo','Estado'].map(h=>(
                        <th key={h} className="text-left text-xs font-semibold uppercase px-4 py-3" style={{color:'var(--app-text-secondary)'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.distribuidores.map(d=>(
                        <tr key={d.id} className="table-row-hover">
                          <td className="px-4 py-4 font-medium text-sm" style={{color:'var(--app-text)'}}>{d.nombre}</td>
                          <td className="px-4 py-4">
                            <span style={{fontSize:16,fontWeight:700,color:(d.stock_actual||0)>20?'#22c55e':(d.stock_actual||0)>0?'#eab308':'#f87171'}}>
                              {d.stock_actual||0} bal.
                            </span>
                          </td>
                          <td className="px-4 py-4 font-bold" style={{color:'var(--app-text-secondary)'}}>{d.balones_vacios||0} bal.</td>
                          <td className="px-4 py-4 font-semibold" style={{color:'var(--app-accent)'}}>S/{d.precio_base}</td>
                          <td className="px-4 py-4 font-bold" style={{color:'#eab308'}}>S/{((d.stock_actual||0)*d.precio_base).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className={(d.stock_actual||0)>0?'badge-green':'badge-red'}>
                              {(d.stock_actual||0)>0?'En campo':'Sin stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gráfica llenos vs vacíos */}
            <div style={{background:'var(--app-card-bg)',border:'1px solid var(--app-card-border)',borderRadius:12,padding:'16px'}}>
              <p style={{fontSize:13,fontWeight:600,color:'var(--app-text)',margin:'0 0 14px'}}>📊 Llenos vs Vacíos por almacén</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.stockActual.map(a=>({ nombre:a.nombre.replace('Almacén ','').substring(0,12), llenos:a.totalLlenos, vacios:a.totalVacios }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)"/>
                  <XAxis dataKey="nombre" tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--app-text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:12,color:'var(--app-text-secondary)'}}/>
                  <Bar dataKey="llenos" name="🟢 Llenos" fill="#22c55e" radius={[3,3,0,0]}/>
                  <Bar dataKey="vacios" name="⚪ Vacíos" fill="var(--app-text-secondary)" radius={[3,3,0,0]} opacity={0.5}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </>)}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @media print {
          body { background: white !important; color: black !important; }
          .btn-primary, .btn-secondary { display: none !important; }
        }
      `}</style>
    </div>
  )
}
