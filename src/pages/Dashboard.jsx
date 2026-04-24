import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  TrendingUp, Package, Ticket, AlertCircle, ShoppingCart,
  RefreshCw, ArrowUpRight, ArrowDownRight, Truck, AlertTriangle,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

const UMBRAL_STOCK_BAJO = 10

// ─── StatCard con tema ────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent, trend }) {
  return (
    <div style={{
      background: 'var(--app-card-bg)', border: '1px solid var(--app-card-border)',
      borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 16, height: 16, color: accent }} />
        </div>
        {trend !== undefined && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 500,
            color: trend >= 0 ? '#22c55e' : '#f87171',
          }}>
            {trend >= 0 ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--app-text)', margin: 0 }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--app-text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>{label}</p>
      </div>
      {sub && <p style={{ fontSize: 11, color: 'var(--app-text-secondary)', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ─── Tooltip del gráfico ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-card-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--app-text-secondary)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600, margin: 0 }}>
          {p.name}: {p.name === 'Balones' ? p.value : `S/${p.value?.toLocaleString('es-PE')}`}
        </p>
      ))}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { perfil } = useAuth()
  const [stats, setStats] = useState({
    ventasHoy: 0, montoHoy: 0, gananciaNeta: 0,
    stockTotal: 0, stockVacios: 0, balonesEnDeuda: 0,
    valesMes: 0, deudasActivas: 0,
    montoMes: 0, montoMesAnterior: 0,
  })
  const [ventasSemana, setVentasSemana] = useState([])
  const [stockAlmacenes, setStockAlmacenes] = useState([])
  const [almacenesStockBajo, setAlmacenesStockBajo] = useState([])
  const [distribuidores, setDistribuidores] = useState([])
  const [topDeudas, setTopDeudas] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const cargarDatos = useCallback(async () => {
    if (!perfil) return
    setLoading(true)
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const hace7dias = subDays(new Date(), 6).toISOString().split('T')[0]
      const now = new Date()
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const finMesAnt = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      const almacenId = perfil?.almacen_id || null

      // ── Todas las queries en paralelo ──────────────────────────────────────
      const [
        { data: ventasHoyData },
        { data: almacenesData },
        { data: deudasBalData },
        { data: costosData },
        { data: ventasMesData },
        { data: ventasMesAntData },
        { data: ventasSemanaData },
        { data: distribuidoresData },
        { data: topDeudasData },
        { data: lotesDistData },
        { data: cargasDistData },
        { count: valesMes },
        { count: deudasActivas },
      ] = await Promise.all([
        // Ventas hoy con tipo_balon para calcular ganancia
        (() => { let q = supabase.from('ventas').select('cantidad, precio_unitario, tipo_balon').gte('fecha', hoy); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
        // Almacenes
        (() => { let q = supabase.from('almacenes').select('id, stock_actual, balones_vacios, nombre').eq('activo',true); if(almacenId) q=q.eq('id',almacenId); return q })(),
        // Balones en deuda
        (() => { let q = supabase.from('deudas').select('balones_pendiente').neq('estado','liquidada'); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
        // Costos de compra
        supabase.from('configuracion').select('clave,valor').in('clave',['costo_5kg','costo_10kg','costo_45kg']),
        // Ventas mes actual
        (() => { let q = supabase.from('ventas').select('cantidad,precio_unitario').gte('fecha',inicioMes).lte('fecha',finMes); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
        // Ventas mes anterior
        (() => { let q = supabase.from('ventas').select('cantidad,precio_unitario').gte('fecha',inicioMesAnt).lte('fecha',finMesAnt); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
        // Ventas últimos 7 días — 1 sola query
        (() => { let q = supabase.from('ventas').select('fecha,cantidad,precio_unitario').gte('fecha',hace7dias); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
        // Distribuidores
        supabase.from('distribuidores').select('id,nombre,modalidad,precio_base').eq('activo',true).order('nombre'),
        // Top 3 deudas por monto
        (() => { let q = supabase.from('deudas').select('id,nombre_cliente,monto_total,monto_pagado,fecha').neq('estado','liquidada').order('monto_total',{ascending:false}).limit(3); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
        // Lotes distribuidor (stock autónomos como Alazan)
        supabase.from('lotes_distribuidor').select('distribuidor_id,cantidad_actual').gt('cantidad_actual',0),
        // Cargas distribuidor (cuenta corriente como Cristian)
        supabase.from('cargas_distribuidor').select('distribuidor_id,cantidad,descargados,precio_unitario'),
        // Vales del mes
        supabase.from('vales_fise').select('*',{count:'exact',head:true}).gte('lote_dia',inicioMes).lte('lote_dia',finMes),
        // Deudas activas
        (() => { let q = supabase.from('deudas').select('*',{count:'exact',head:true}).neq('estado','liquidada'); if(almacenId) q=q.eq('almacen_id',almacenId); return q })(),
      ])

      // ── Costos por tipo ────────────────────────────────────────────────────
      const costos = { '5kg': 0, '10kg': 0, '45kg': 0 }
      costosData?.forEach(r => { if(r.clave==='costo_5kg') costos['5kg']=parseFloat(r.valor)||0; if(r.clave==='costo_10kg') costos['10kg']=parseFloat(r.valor)||0; if(r.clave==='costo_45kg') costos['45kg']=parseFloat(r.valor)||0 })

      // ── Stats ventas hoy ───────────────────────────────────────────────────
      const montoHoy = ventasHoyData?.reduce((s,v) => s + v.cantidad * v.precio_unitario, 0) || 0
      const gananciaNeta = ventasHoyData?.reduce((s,v) => { const c=costos[v.tipo_balon]||0; return s + v.cantidad*(v.precio_unitario-c) }, 0) || 0

      // ── Stock ──────────────────────────────────────────────────────────────
      const stockTotal = almacenesData?.reduce((s,a) => s+(a.stock_actual||0), 0) || 0
      const stockVacios = almacenesData?.reduce((s,a) => s+(a.balones_vacios||0), 0) || 0
      const balonesEnDeuda = deudasBalData?.reduce((s,d) => s+(parseInt(d.balones_pendiente)||0), 0) || 0

      // ── Alertas stock bajo ─────────────────────────────────────────────────
      setAlmacenesStockBajo((almacenesData||[]).filter(a => (a.stock_actual||0) < UMBRAL_STOCK_BAJO))

      // ── Meses ──────────────────────────────────────────────────────────────
      const montoMes = ventasMesData?.reduce((s,v) => s+v.cantidad*v.precio_unitario, 0) || 0
      const montoMesAnterior = ventasMesAntData?.reduce((s,v) => s+v.cantidad*v.precio_unitario, 0) || 0

      // ── Ventas semana (1 query → agrupar por día en JS) ───────────────────
      const porDia = {}
      ventasSemanaData?.forEach(v => {
        const d = v.fecha?.split('T')[0] || v.fecha
        if(!porDia[d]) porDia[d] = { ventas: 0, balones: 0 }
        porDia[d].ventas += v.cantidad * v.precio_unitario
        porDia[d].balones += v.cantidad
      })
      const dias = []
      for(let i=6; i>=0; i--) {
        const fecha = subDays(new Date(), i)
        const fechaStr = fecha.toISOString().split('T')[0]
        dias.push({ dia: format(fecha,'EEE',{locale:es}), ventas: porDia[fechaStr]?.ventas||0, balones: porDia[fechaStr]?.balones||0 })
      }
      setVentasSemana(dias)

      // ── Stock por almacén ──────────────────────────────────────────────────
      setStockAlmacenes((almacenesData||[]).map(a => ({
        nombre: a.nombre.length>14 ? a.nombre.substring(0,14)+'…' : a.nombre,
        stock: a.stock_actual || 0,
      })))

      // ── Distribuidores con stock ───────────────────────────────────────────
      const distConStock = (distribuidoresData||[]).map(d => {
        const esAutonomo = d.modalidad?.toLowerCase().includes('autón') || d.modalidad?.toLowerCase().includes('auton')
        let stockDist = 0, deudaDist = 0
        if(esAutonomo) {
          stockDist = (lotesDistData||[]).filter(l=>l.distribuidor_id===d.id).reduce((s,l)=>s+(l.cantidad_actual||0),0)
        } else {
          const cargas = (cargasDistData||[]).filter(c=>c.distribuidor_id===d.id)
          const totalCargado = cargas.reduce((s,c)=>s+c.cantidad,0)
          const totalDescargado = cargas.reduce((s,c)=>s+(c.descargados||0),0)
          stockDist = totalCargado - totalDescargado
          deudaDist = cargas.filter(c=>(c.descargados||0)<c.cantidad).reduce((s,c)=>s+(c.cantidad-(c.descargados||0))*c.precio_unitario,0)
        }
        return { ...d, stockDist, deudaDist, esAutonomo }
      })
      setDistribuidores(distConStock)

      // ── Top deudas ─────────────────────────────────────────────────────────
      setTopDeudas((topDeudasData||[]).map(d => ({
        ...d,
        pendiente: (d.monto_total||0) - (d.monto_pagado||0),
        diasSinPagar: Math.floor((new Date()-new Date(d.fecha))/(1000*60*60*24)),
      })))

      setStats({
        ventasHoy: ventasHoyData?.length||0, montoHoy, gananciaNeta,
        stockTotal, stockVacios, balonesEnDeuda,
        valesMes: valesMes||0, deudasActivas: deudasActivas||0,
        montoMes, montoMesAnterior,
      })
      setLastUpdate(new Date())
    } catch(e) {
      console.error('Error cargando dashboard:', e)
    } finally {
      setLoading(false)
    }
  }, [perfil])

  useEffect(() => { if(perfil) cargarDatos() }, [perfil, cargarDatos])

  const hora = new Date().getHours()
  const saludo = hora<12 ? 'Buenos días' : hora<18 ? 'Buenas tardes' : 'Buenas noches'
  const variacionMes = stats.montoMesAnterior > 0
    ? parseFloat(((stats.montoMes - stats.montoMesAnterior) / stats.montoMesAnterior * 100).toFixed(1))
    : null

  const cardStyle = { background:'var(--app-card-bg)', border:'1px solid var(--app-card-border)', borderRadius:12, padding:16 }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--app-text)', margin:0 }}>
            {saludo}, {perfil?.nombre?.split(' ')[0] || 'Admin'} 👋
          </h2>
          <p style={{ fontSize:13, color:'var(--app-text-secondary)', margin:'2px 0 0' }}>
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale:es })}
          </p>
        </div>
        <button onClick={cargarDatos} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/>
          Actualizar
        </button>
      </div>

      {/* ── Alerta stock bajo ── */}
      {almacenesStockBajo.length > 0 && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <AlertTriangle style={{ width:18, height:18, color:'#f87171', flexShrink:0 }}/>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:'#f87171', margin:0 }}>Stock bajo en {almacenesStockBajo.length} almacén{almacenesStockBajo.length>1?'es':''}</p>
            <p style={{ fontSize:12, color:'var(--app-text-secondary)', margin:'2px 0 0' }}>
              {almacenesStockBajo.map(a=>`${a.nombre}: ${a.stock_actual} balones`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShoppingCart} label="Ventas hoy"    value={stats.ventasHoy}                                      accent="var(--app-accent)" />
        <StatCard icon={TrendingUp}   label="Ingresos hoy"  value={`S/${stats.montoHoy.toLocaleString('es-PE')}`}        accent="#22c55e" />
        <StatCard icon={TrendingUp}   label="Ganancia neta" value={`S/${stats.gananciaNeta.toLocaleString('es-PE',{maximumFractionDigits:0})}`} accent="#a78bfa" sub="Ingresos - costos de compra" />
        <StatCard icon={AlertCircle}  label="Deudas activas" value={stats.deudasActivas}                                 accent="#f87171" />
      </div>

      {/* ── Balones ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Balones llenos', value:stats.stockTotal,     color:'#22c55e', emoji:'🟢' },
          { label:'Balones vacíos', value:stats.stockVacios,    color:'var(--app-text-secondary)', emoji:'⚪' },
          { label:'En deuda (calle)', value:stats.balonesEnDeuda, color:'#fb923c', emoji:'🔵' },
        ].map(({ label, value, color, emoji }) => (
          <div key={label} style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:`color-mix(in srgb, ${color} 10%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{emoji}</div>
              <div>
                <p style={{ fontSize:22, fontWeight:700, color, margin:0 }}>{value}</p>
                <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:0 }}>{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Comparación mes ── */}
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--app-text)', margin:0 }}>Ingresos del mes</p>
          {variacionMes !== null && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:500, color: variacionMes>=0?'#22c55e':'#f87171' }}>
              {variacionMes>=0 ? <ArrowUpRight style={{width:14,height:14}}/> : <ArrowDownRight style={{width:14,height:14}}/>}
              {Math.abs(variacionMes)}% vs mes anterior
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:24 }}>
          <div>
            <p style={{ fontSize:24, fontWeight:700, color:'var(--app-text)', margin:0 }}>S/{stats.montoMes.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
            <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0' }}>Este mes</p>
          </div>
          <div style={{ borderLeft:'1px solid var(--app-card-border)', paddingLeft:24 }}>
            <p style={{ fontSize:18, fontWeight:600, color:'var(--app-text-secondary)', margin:0 }}>S/{stats.montoMesAnterior.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
            <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0' }}>Mes anterior</p>
          </div>
          <div style={{ borderLeft:'1px solid var(--app-card-border)', paddingLeft:24 }}>
            <p style={{ fontSize:18, fontWeight:600, color:'#fbbf24', margin:0 }}>{stats.valesMes}</p>
            <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:'2px 0 0' }}>Vales FISE</p>
          </div>
        </div>
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--app-text)', margin:0 }}>Ingresos — últimos 7 días</p>
            <span className="badge-blue">Esta semana</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ventasSemana}>
              <defs>
                <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--app-accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--app-accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)"/>
              <XAxis dataKey="dia" tick={{fill:'var(--app-text-secondary)',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'var(--app-text-secondary)',fontSize:11}} axisLine={false} tickLine={false} width={50} tickFormatter={v=>`S/${v}`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="ventas" name="Ingresos" stroke="var(--app-accent)" strokeWidth={2} fill="url(#gradVentas)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--app-text)', margin:0 }}>Balones vendidos — 7 días</p>
            <span className="badge-green">Unidades</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ventasSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)"/>
              <XAxis dataKey="dia" tick={{fill:'var(--app-text-secondary)',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'var(--app-text-secondary)',fontSize:11}} axisLine={false} tickLine={false} width={30}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="balones" name="Balones" fill="var(--app-accent)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Distribuidores + Top deudas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Distribuidores */}
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--app-text)', margin:0 }}>Distribuidores</p>
            <Link to="/distribuidores" style={{ fontSize:12, color:'var(--app-accent)', textDecoration:'none' }}>Ver todos →</Link>
          </div>
          {distribuidores.length === 0 ? (
            <p style={{ fontSize:13, color:'var(--app-text-secondary)', textAlign:'center', padding:'20px 0' }}>Sin distribuidores activos</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {distribuidores.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--app-card-bg-alt)', borderRadius:8, border:'1px solid var(--app-card-border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'color-mix(in srgb, var(--app-accent) 15%, transparent)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--app-accent)', fontWeight:700, fontSize:13 }}>
                      {d.nombre?.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:500, color:'var(--app-text)', margin:0 }}>{d.nombre}</p>
                      <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:0 }}>{d.modalidad||'—'}</p>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:13, fontWeight:600, color:'#22c55e', margin:0 }}>{d.stockDist} bal</p>
                    {d.deudaDist > 0 && <p style={{ fontSize:11, color:'#f87171', margin:0 }}>S/{d.deudaDist.toLocaleString('es-PE',{maximumFractionDigits:0})} pend.</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top deudas */}
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--app-text)', margin:0 }}>Deudas más grandes</p>
            <Link to="/deudas" style={{ fontSize:12, color:'var(--app-accent)', textDecoration:'none' }}>Ver todas →</Link>
          </div>
          {topDeudas.length === 0 ? (
            <p style={{ fontSize:13, color:'#22c55e', textAlign:'center', padding:'20px 0' }}>✓ Sin deudas activas</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {topDeudas.map((d, i) => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--app-card-bg-alt)', borderRadius:8, border:`1px solid ${d.diasSinPagar>30?'rgba(239,68,68,0.3)':'var(--app-card-border)'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background: i===0?'rgba(239,68,68,0.2)':i===1?'rgba(251,146,60,0.2)':'rgba(250,204,21,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: i===0?'#f87171':i===1?'#fb923c':'#fbbf24' }}>
                      {i+1}
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:500, color:'var(--app-text)', margin:0 }}>{d.nombre_cliente}</p>
                      <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:0 }}>{d.diasSinPagar}d sin pagar</p>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#f87171', margin:0 }}>S/{d.pendiente.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                    <p style={{ fontSize:11, color:'var(--app-text-secondary)', margin:0 }}>de S/{d.monto_total?.toLocaleString('es-PE',{maximumFractionDigits:0})}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Acciones rápidas ── */}
      <div style={cardStyle}>
        <p style={{ fontSize:13, fontWeight:600, color:'var(--app-text)', margin:'0 0 12px' }}>Acciones rápidas</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Nueva venta',    icon:ShoppingCart, color:'var(--app-accent)',  href:'/ventas' },
            { label:'Registrar vale', icon:Ticket,       color:'#fbbf24',            href:'/vales' },
            { label:'Ver deudas',     icon:AlertCircle,  color:'#f87171',            href:'/deudas' },
            { label:'Ver stock',      icon:Package,      color:'#22c55e',            href:'/inventario' },
          ].map(({ label, icon:Icon, color, href }) => (
            <Link key={label} to={href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:16, borderRadius:12, background:'var(--app-card-bg-alt)', border:'1px solid var(--app-card-border)', textDecoration:'none', transition:'all 0.15s' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`color-mix(in srgb, ${color} 12%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon style={{ width:20, height:20, color }}/>
              </div>
              <span style={{ fontSize:12, color:'var(--app-text-secondary)', fontWeight:500, textAlign:'center' }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <p style={{ fontSize:11, color:'var(--app-text-secondary)', textAlign:'right', opacity:0.6 }}>
        Actualizado: {format(lastUpdate,'HH:mm:ss')}
      </p>
    </div>
  )
}
