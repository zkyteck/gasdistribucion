import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, Package, Ticket, AlertCircle, Printer, RefreshCw, DollarSign, ShoppingCart } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.name !== 'Balones' ? 'S/ ' : ''}{p.value?.toLocaleString('es-PE')}
        </p>
      ))}
    </div>
  )
}

export default function Reportes() {
  const [tabReporte, setTabReporte] = useState('panel')
  // Vista financiera
  const [vistaFin, setVistaFin] = useState('ingreso') // 'ingreso' | 'ganancia'
  // Ganancias detalladas
  const [periodoGanancia, setPeriodoGanancia] = useState('mes')
  const [fechaGanDesde, setFechaGanDesde] = useState(new Date().toISOString().split('T')[0])
  const [fechaGanHasta, setFechaGanHasta] = useState(new Date().toISOString().split('T')[0])
  const [gananciasData, setGananciasData] = useState(null)
  const [loadingGanancias, setLoadingGanancias] = useState(false)
  const [vistaDist, setVistaDist] = useState('juntos')
  const [periodoFin, setPeriodoFin] = useState('mes')
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0])
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
  const [finData, setFinData] = useState(null)
  const [loadingFin, setLoadingFin] = useState(false)

  // Vista general
  const [periodo, setPeriodo] = useState('mes')
  const [loading, setLoading] = useState(true)
  const [ventasDiarias, setVentasDiarias] = useState([])
  const [ventasPorTipo, setVentasPorTipo] = useState([])
  const [ventasPorPago, setVentasPorPago] = useState([])
  const [resumen, setResumen] = useState({ totalVentas: 0, totalBalones: 0, totalValesMonto: 0, totalDeudas: 0 })
  const [stockActual, setStockActual] = useState([])
  const [topClientes, setTopClientes] = useState([])

  useEffect(() => { cargar() }, [periodo])
  useEffect(() => { calcularFinanciero() }, [vistaFin, periodoFin, fechaDesde, fechaHasta])
  useEffect(() => { if (tabReporte === 'ganancias') calcularGanancias() }, [tabReporte, periodoGanancia, fechaGanDesde, fechaGanHasta])

  function getRango() {
    const hoy = new Date()
    if (periodoFin === 'hoy')    return { desde: startOfDay(hoy),              hasta: endOfDay(hoy) }
    if (periodoFin === 'semana') return { desde: startOfWeek(hoy,{weekStartsOn:1}), hasta: endOfWeek(hoy,{weekStartsOn:1}) }
    if (periodoFin === 'mes')    return { desde: startOfMonth(hoy),             hasta: endOfMonth(hoy) }
    return { desde: startOfDay(parseISO(fechaDesde)), hasta: endOfDay(parseISO(fechaHasta)) }
  }

  async function calcularFinanciero() {
    setLoadingFin(true)
    try {
      const { desde, hasta } = getRango()
      const desdeISO = desde.toISOString()
      const hastaISO = hasta.toISOString()
      const desdeDate = desdeISO.split('T')[0]
      const hastaDate = hastaISO.split('T')[0]

      const [{ data: vp }, { data: cd }, { data: costosCfg }] = await Promise.all([
        supabase.from('ventas').select('cantidad, precio_unitario, tipo_balon, fecha, metodo_pago, created_at').gte('created_at', desdeISO).lte('created_at', hastaISO),
        supabase.from('cuentas_distribuidor').select('*, distribuidores(nombre)').gte('periodo_fin', desdeDate).lte('periodo_fin', hastaDate),
        supabase.from('configuracion').select('clave, valor').in('clave', ['costo_5kg','costo_10kg','costo_45kg'])
      ])

      // Costos por tipo desde configuracion
      const costos = { '5kg': 0, '10kg': 0, '45kg': 0 }
      costosCfg?.forEach(r => {
        if (r.clave === 'costo_5kg') costos['5kg'] = parseFloat(r.valor) || 0
        if (r.clave === 'costo_10kg') costos['10kg'] = parseFloat(r.valor) || 0
        if (r.clave === 'costo_45kg') costos['45kg'] = parseFloat(r.valor) || 0
      })
      const costoPromedio = (costos['5kg'] + costos['10kg'] + costos['45kg']) / 3

      // Tienda — ingreso y ganancia por tipo de balón
      const ingTienda = vp?.reduce((s,v) => s + (v.cantidad||1) * (v.precio_unitario||0), 0) || 0
      const ganTienda = vp?.reduce((s,v) => {
        const costo = costos[v.tipo_balon || '10kg'] || costoPromedio
        return s + ((v.cantidad||1) * ((v.precio_unitario||0) - costo))
      }, 0) || 0
      const balTienda = vp?.reduce((s,v) => s + (v.cantidad||1), 0) || 0

      // Distribuidores
      const ingDist = cd?.reduce((s,c) => s + (c.total_esperado||0), 0) || 0
      const balDist = cd?.reduce((s,c) => s + (c.balones_vendidos||0), 0) || 0
      const costoDist = balDist * costoPromedio
      const ganDist = ingDist - costoDist

      // Por distribuidor
      const porDist = {}
      cd?.forEach(c => {
        const n = c.distribuidores?.nombre || 'Sin nombre'
        if (!porDist[n]) porDist[n] = { ingreso: 0, balones: 0, rendiciones: 0 }
        porDist[n].ingreso += c.total_esperado || 0
        porDist[n].balones += c.balones_vendidos || 0
        porDist[n].rendiciones++
      })

      // Por pago
      const porPago = {}
      vp?.forEach(v => {
        const t = v.metodo_pago || 'efectivo'
        if (!porPago[t]) porPago[t] = { ingreso: 0, count: 0 }
        porPago[t].ingreso += (v.cantidad||1) * (v.precio_unitario||0)
        porPago[t].count++
      })

      // Por balón con ganancia
      const porBalon = {}
      vp?.forEach(v => {
        const t = v.tipo_balon || '10kg'
        if (!porBalon[t]) porBalon[t] = { ingreso: 0, ganancia: 0, count: 0 }
        const ing = (v.cantidad||1) * (v.precio_unitario||0)
        const gan = (v.cantidad||1) * ((v.precio_unitario||0) - (costos[t]||0))
        porBalon[t].ingreso += ing
        porBalon[t].ganancia += gan
        porBalon[t].count += (v.cantidad||1)
      })

      // Gráfica diaria
      const dias = eachDayOfInterval({ start: desde, end: hasta })
      const diario = dias.map(dia => {
        const ds = dia.toISOString().split('T')[0]
        const vDia = vp?.filter(v => (v.fecha || v.created_at?.split('T')[0]) === ds) || []
        const cDia = cd?.filter(c => c.periodo_fin === ds) || []
        const iT = vDia.reduce((s,v) => s+(v.cantidad||1)*(v.precio_unitario||0), 0)
        const iD = cDia.reduce((s,c) => s+(c.total_esperado||0), 0)
        const gT = vDia.reduce((s,v) => s+(v.cantidad||1)*((v.precio_unitario||0)-(costos[v.tipo_balon||'10kg']||0)), 0)
        const gD = iD - cDia.reduce((s,c) => s+(c.balones_vendidos||0),0) * costoPromedio
        return {
          dia: format(dia, dias.length > 15 ? 'dd/MM' : 'EEE dd', { locale: es }),
          Tienda: Math.round(iT), Distribuidores: Math.round(iD),
          'Gan.Tienda': Math.round(gT), 'Gan.Dist': Math.round(gD),
          Total: Math.round(iT + iD), 'Gan.Total': Math.round(gT + gD)
        }
      })

      setFinData({
        costos, costoPromedio, ingTienda, ganTienda, balTienda,
        ingDist, ganDist, balDist,
        ingTotal: ingTienda + ingDist,
        ganTotal: ganTienda + ganDist,
        margen: (ingTienda+ingDist) > 0 ? ((ganTienda+ganDist)/(ingTienda+ingDist))*100 : 0,
        porDist, porPago, porBalon, diario
      })
    } catch(e) { console.error(e) }
    setLoadingFin(false)
  }

  async function cargar() {
    setLoading(true)
    try {
      const hoy = new Date()
      let fi = periodo === 'semana' ? subDays(hoy,7) : periodo === 'mes' ? startOfMonth(hoy) : subDays(hoy,1)
      const fiStr = fi.toISOString().split('T')[0]

      const [{ data: ventas }, { data: vales }, { data: deudas }, { data: stock }] = await Promise.all([
        supabase.from('ventas').select('*, precio_tipos(nombre), clientes(nombre)').gte('fecha', fiStr).order('fecha'),
        supabase.from('vales_fise').select('*').gte('lote_dia', fiStr),
        supabase.from('deudas').select('*').neq('estado', 'liquidada'),
        supabase.from('vista_stock_total').select('*')
      ])

      const dias = eachDayOfInterval({ start: fi, end: hoy })
      setVentasDiarias(dias.map(dia => {
        const ds = dia.toISOString().split('T')[0]
        const vd = ventas?.filter(v => v.fecha?.startsWith(ds)) || []
        return {
          dia: format(dia, periodo === 'mes' ? 'dd/MM' : 'EEE dd', { locale: es }),
          ingresos: vd.reduce((s,v) => s + v.cantidad * v.precio_unitario, 0),
          balones: vd.reduce((s,v) => s + v.cantidad, 0)
        }
      }))

      const tiposMap = {}
      ventas?.forEach(v => {
        const t = v.precio_tipos?.nombre || 'Sin tipo'
        if (!tiposMap[t]) tiposMap[t] = { name: t, value: 0, balones: 0 }
        tiposMap[t].value += v.cantidad * v.precio_unitario
        tiposMap[t].balones += v.cantidad
      })
      setVentasPorTipo(Object.values(tiposMap))

      const pagosMap = {}
      ventas?.forEach(v => {
        const p = v.metodo_pago || 'efectivo'
        if (!pagosMap[p]) pagosMap[p] = { name: p, value: 0 }
        pagosMap[p].value += v.cantidad * v.precio_unitario
      })
      setVentasPorPago(Object.values(pagosMap))

      const cliMap = {}
      ventas?.forEach(v => {
        const n = v.clientes?.nombre || 'Cliente Varios'
        if (!cliMap[n]) cliMap[n] = { nombre: n, total: 0, balones: 0 }
        cliMap[n].total += v.cantidad * v.precio_unitario
        cliMap[n].balones += v.cantidad
      })
      setTopClientes(Object.values(cliMap).sort((a,b) => b.total - a.total).slice(0,5))

      setResumen({
        totalVentas: ventas?.reduce((s,v) => s + v.cantidad * v.precio_unitario, 0) || 0,
        totalBalones: ventas?.reduce((s,v) => s + v.cantidad, 0) || 0,
        totalValesMonto: vales?.reduce((s,v) => s + v.monto, 0) || 0,
        totalDeudas: deudas?.filter(d => d.tipo_deuda === 'dinero').reduce((s,d) => s + (d.monto_pendiente||0), 0) || 0
      })
      setStockActual(stock || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const lPago = { efectivo: '💵 Efectivo', yape: '📱 Yape', vale: '🎫 Vale', mixto: '🔀 Mixto' }
  const lBalon = { '5kg': '🔵 5kg', '10kg': '🟡 10kg', '45kg': '🔴 45kg' }

async function calcularGanancias() {
    setLoadingGanancias(true)
    const hoy = new Date()
    let desde, hasta
    if (periodoGanancia === 'hoy') { desde = new Date(hoy.setHours(0,0,0,0)); hasta = new Date(new Date().setHours(23,59,59,999)) }
    else if (periodoGanancia === 'semana') { desde = new Date(new Date().setDate(new Date().getDate()-7)); hasta = new Date(new Date().setHours(23,59,59,999)) }
    else if (periodoGanancia === 'mes') { desde = new Date(new Date().getFullYear(), new Date().getMonth(), 1); hasta = new Date(new Date().setHours(23,59,59,999)) }
    else { desde = new Date(fechaGanDesde + 'T00:00:00'); hasta = new Date(fechaGanHasta + 'T23:59:59') }
    const desdeISO = desde.toISOString()
    const hastaISO = hasta.toISOString()

    const [{ data: ventasPeriodo }, { data: costosCfg }, { data: cuentasDist }] = await Promise.all([
      supabase.from('ventas').select('cantidad, precio_unitario, metodo_pago, tipo_balon, fecha, created_at').gte('created_at', desdeISO).lte('created_at', hastaISO),
      supabase.from('configuracion').select('clave, valor').in('clave', ['costo_5kg','costo_10kg','costo_45kg']),
      supabase.from('cuentas_distribuidor').select('*, distribuidores(nombre)').gte('periodo_fin', desdeISO.split('T')[0]).lte('periodo_fin', hastaISO.split('T')[0])
    ])

    // Costos por tipo
    const costos = { '5kg': 0, '10kg': 0, '45kg': 0 }
    costosCfg?.forEach(r => {
      if (r.clave === 'costo_5kg') costos['5kg'] = parseFloat(r.valor) || 0
      if (r.clave === 'costo_10kg') costos['10kg'] = parseFloat(r.valor) || 0
      if (r.clave === 'costo_45kg') costos['45kg'] = parseFloat(r.valor) || 0
    })
    const costoPromedio = Object.values(costos).filter(v=>v>0).reduce((s,v,_,a)=>s+v/a.length, 0) || 0

    // Totales tienda
    const totalVentas = ventasPeriodo?.reduce((s,v) => s + (v.cantidad||1)*(v.precio_unitario||0), 0) || 0
    const totalBalonesVendidos = ventasPeriodo?.reduce((s,v) => s + (v.cantidad||1), 0) || 0
    const costoEstimado = ventasPeriodo?.reduce((s,v) => s + (v.cantidad||1)*(costos[v.tipo_balon||'10kg']||costoPromedio), 0) || 0
    const gananciaBruta = totalVentas - costoEstimado
    const margen = totalVentas > 0 ? (gananciaBruta / totalVentas) * 100 : 0

    // Por pago
    const porPago = {}
    ventasPeriodo?.forEach(v => {
      const t = v.metodo_pago || 'efectivo'
      if (!porPago[t]) porPago[t] = { count: 0, total: 0 }
      porPago[t].count += (v.cantidad||1)
      porPago[t].total += (v.cantidad||1)*(v.precio_unitario||0)
    })

    // Por tipo de balón con ganancia detallada
    const porBalon = {}
    ventasPeriodo?.forEach(v => {
      const t = v.tipo_balon || '10kg'
      if (!porBalon[t]) porBalon[t] = { count: 0, total: 0, ganancia: 0, costoUnit: costos[t]||0 }
      const ing = (v.cantidad||1)*(v.precio_unitario||0)
      const gan = (v.cantidad||1)*((v.precio_unitario||0)-(costos[t]||0))
      porBalon[t].count += (v.cantidad||1)
      porBalon[t].total += ing
      porBalon[t].ganancia += gan
    })

    // Distribuidores
    const totalRecaudadoDist = cuentasDist?.reduce((s,c) => s+(c.total_esperado||0), 0) || 0
    const balonesDistribuidos = cuentasDist?.reduce((s,c) => s+(c.balones_vendidos||0), 0) || 0
    const costoBalonesDistribuidos = balonesDistribuidos * costoPromedio
    const gananciaDist = totalRecaudadoDist - costoBalonesDistribuidos

    const porDistribuidor = {}
    cuentasDist?.forEach(c => {
      const nombre = c.distribuidores?.nombre || 'Sin nombre'
      if (!porDistribuidor[nombre]) porDistribuidor[nombre] = { totalEsperado: 0, balones: 0, rendiciones: 0 }
      porDistribuidor[nombre].totalEsperado += c.total_esperado || 0
      porDistribuidor[nombre].balones += c.balones_vendidos || 0
      porDistribuidor[nombre].rendiciones++
    })

    const totalGeneral = totalVentas + totalRecaudadoDist
    const costoTotal = costoEstimado + costoBalonesDistribuidos
    const gananciaTotalBruta = totalGeneral - costoTotal
    const margenTotal = totalGeneral > 0 ? (gananciaTotalBruta / totalGeneral) * 100 : 0

    setGananciasData({
      costos, costoPromedio,
      totalVentas, totalBalonesVendidos, costoEstimado, gananciaBruta, margen,
      porPago, porBalon,
      totalRecaudadoDist, gananciaDist, balonesDistribuidos, porDistribuidor,
      cantRendiciones: cuentasDist?.length || 0,
      totalGeneral, costoTotal, gananciaTotalBruta, margenTotal
    })
    setLoadingGanancias(false)
  }

  async function guardarQuick() {
    if (!quickNombre.trim()) return
    setSavingQuick(true)
    if (quickModal === 'marca') {
      const { data } = await supabase.from('marcas_gas').insert({ nombre: quickNombre.trim() }).select().single()
      if (data) {
        setMarcas(m => [...m, data].sort((a,b) => a.nombre.localeCompare(b.nombre)))
        setCompraForm(f => ({...f, marca_id: data.id}))
      }
    } else {
      const { data } = await supabase.from('proveedores').insert({ nombre: quickNombre.trim(), telefono: quickTel.trim(), activo: true }).select().single()
      if (data) {
        setProveedores(p => [...p, data].sort((a,b) => a.nombre.localeCompare(b.nombre)))
        setCompraForm(f => ({...f, proveedor_id: data.id}))
      }
    }
    setSavingQuick(false)
    setQuickModal(null)
    setQuickNombre('')
    setQuickTel('')
  }


  const labelPago = { efectivo: '💵 Efectivo', yape: '📱 Yape', vale: '🎫 Vale', mixto: '🔀 Mixto' }
  const labelBalon = { '5kg': '🔵 5kg', '10kg': '🟡 10kg', '45kg': '🔴 45kg' }

  return (
    <div className="space-y-6" id="reporte-print">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Reportes</h2>
          <p className="text-gray-500 text-sm">Centro Gas Paucara — {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="w-3.5 h-3.5" />Imprimir
          </button>
        </div>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {[['panel','📊 Panel Financiero'],['ganancias','📈 Análisis de Ganancias']].map(([key, label]) => (
          <button key={key} onClick={() => setTabReporte(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${tabReporte === key ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {tabReporte === 'panel' && <>

      {/* ══════════════════════════════════════════════
          PANEL FINANCIERO — INGRESOS / GANANCIAS
      ══════════════════════════════════════════════ */}
      <div className="card border border-gray-700">
        {/* Título + toggle ingreso/ganancia */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-white">📊 Panel Financiero</h3>
            <p className="text-gray-500 text-xs mt-0.5">Tienda + Distribuidores combinados</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl p-1">
            <button onClick={() => setVistaFin('ingreso')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${vistaFin === 'ingreso' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              💰 Ingresos
            </button>
            <button onClick={() => setVistaFin('ganancia')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${vistaFin === 'ganancia' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              📈 Ganancias
            </button>
          </div>
        </div>

        {/* Selector período */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[['hoy','📅 Hoy'],['semana','📆 Semana'],['mes','🗓️ Mes'],['personalizado','🔍 Personalizado']].map(([v,l]) => (
            <button key={v} onClick={() => setPeriodoFin(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${periodoFin === v ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
        {periodoFin === 'personalizado' && (
          <div className="flex gap-3 items-end flex-wrap mb-4">
            <div><label className="label">Desde</label><input type="date" className="input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></div>
            <div><label className="label">Hasta</label><input type="date" className="input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} /></div>
            <button onClick={calcularFinanciero} className="btn-primary">Calcular</button>
          </div>
        )}

        {loadingFin ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Calculando...</div>
        ) : finData && (
          <div className="space-y-5">

            {/* Tarjeta grande total */}
            <div className={`rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${vistaFin === 'ingreso' ? 'bg-blue-900/20 border border-blue-700/40' : 'bg-emerald-900/20 border border-emerald-700/40'}`}>
              <div>
                <p className="text-gray-400 text-sm">{vistaFin === 'ingreso' ? 'Total ingresos' : 'Ganancia bruta total'} (tienda + distribuidores)</p>
                <p className={`text-4xl font-bold mt-1 ${vistaFin === 'ingreso' ? 'text-blue-400' : 'text-emerald-400'}`}>
                  S/ {(vistaFin === 'ingreso' ? finData.ingTotal : finData.ganTotal).toFixed(2)}
                </p>
                {vistaFin === 'ganancia' && (
                  <p className="text-emerald-400/70 text-sm mt-1">{finData.margen.toFixed(1)}% margen · costo prom. S/{finData.costoPromedio.toFixed(2)}/bal.</p>
                )}
              </div>
              <div className="flex gap-8 text-center">
                <div>
                  <p className={`font-bold text-xl ${vistaFin === 'ingreso' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    S/ {(vistaFin === 'ingreso' ? finData.ingTienda : finData.ganTienda).toFixed(2)}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">🏪 Tienda</p>
                  <p className="text-gray-600 text-xs">{finData.balTienda} ventas</p>
                </div>
                <div className="w-px bg-gray-700" />
                <div>
                  <p className={`font-bold text-xl ${vistaFin === 'ingreso' ? 'text-orange-400' : 'text-orange-400'}`}>
                    S/ {(vistaFin === 'ingreso' ? finData.ingDist : finData.ganDist).toFixed(2)}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">🚛 Distribuidores</p>
                  <p className="text-gray-600 text-xs">{finData.balDist} balones</p>
                </div>
              </div>
            </div>

            {/* Gráfica diaria */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">
                {vistaFin === 'ingreso' ? 'Ingresos diarios' : 'Ganancia diaria'} — tienda vs distribuidores
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={finData.diario} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `S/${v}`} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  {vistaFin === 'ingreso' ? <>
                    <Bar dataKey="Tienda" fill="#3b82f6" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="Distribuidores" fill="#f97316" radius={[3,3,0,0]} stackId="a" />
                  </> : <>
                    <Bar dataKey="Gan.Tienda" fill="#10b981" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="Gan.Dist" fill="#f97316" radius={[3,3,0,0]} stackId="a" />
                  </>}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2">
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Tienda</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />Distribuidores</span>
              </div>
            </div>

            {/* Desglose distribuidores */}
            {Object.keys(finData.porDist).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Por distribuidor</p>
                <div className="space-y-2">
                  {Object.entries(finData.porDist).map(([nombre, d]) => {
                    const val = vistaFin === 'ingreso' ? d.ingreso : d.ingreso - d.balones * finData.costoPromedio
                    const pct = finData.ingDist > 0 ? (d.ingreso / finData.ingDist) * 100 : 0
                    return (
                      <div key={nombre} className="bg-gray-800/40 rounded-xl px-4 py-3">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-white text-sm font-medium">🚛 {nombre}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-xs">{d.balones} bal. · {d.rendiciones} rend.</span>
                            <span className={`font-bold text-sm ${vistaFin === 'ganancia' && val < 0 ? 'text-red-400' : 'text-orange-400'}`}>
                              S/ {val.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Desglose método pago y tipo balón */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Por método de pago (tienda)</p>
                {Object.keys(finData.porPago).length === 0
                  ? <p className="text-gray-600 text-sm text-center py-4">Sin ventas</p>
                  : <div className="space-y-2">
                    {Object.entries(finData.porPago).sort((a,b) => b[1].ingreso - a[1].ingreso).map(([tipo, d], i) => {
                      const val = vistaFin === 'ingreso' ? d.ingreso : d.ingreso - d.count * finData.costoPromedio
                      const maxVal = Math.max(...Object.values(finData.porPago).map(x => x.ingreso))
                      const pct = maxVal > 0 ? (d.ingreso / maxVal) * 100 : 0
                      return (
                        <div key={tipo}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300">{lPago[tipo] || tipo}</span>
                            <span className="text-white font-semibold">S/ {val.toFixed(2)} <span className="text-gray-500 font-normal text-xs">({d.count})</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                }
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Por tipo de balón (tienda)</p>
                {Object.keys(finData.porBalon).length === 0
                  ? <p className="text-gray-600 text-sm text-center py-4">Sin ventas</p>
                  : <div className="space-y-2">
                    {Object.entries(finData.porBalon).sort((a,b) => b[1].ingreso - a[1].ingreso).map(([tipo, d], i) => {
                      const val = vistaFin === 'ingreso' ? d.ingreso : d.ingreso - d.count * finData.costoPromedio
                      const maxVal = Math.max(...Object.values(finData.porBalon).map(x => x.ingreso))
                      const pct = maxVal > 0 ? (d.ingreso / maxVal) * 100 : 0
                      return (
                        <div key={tipo}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300">{lBalon[tipo] || tipo}</span>
                            <span className="text-white font-semibold">S/ {val.toFixed(2)} <span className="text-gray-500 font-normal text-xs">({d.count})</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                }
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          RESUMEN GENERAL (ventas tienda)
      ══════════════════════════════════════════════ */}
      <div className="flex gap-2 flex-wrap">
        {[['hoy','Hoy'],['semana','7 días'],['mes','Este mes']].map(([v,l]) => (
          <button key={v} onClick={() => setPeriodo(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${periodo === v ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos por ventas', value: `S/ ${resumen.totalVentas.toLocaleString('es-PE')}`, color: 'emerald', Icon: TrendingUp },
          { label: 'Balones vendidos', value: `${resumen.totalBalones} bal.`, color: 'blue', Icon: Package },
          { label: 'Vales FISE recibidos', value: `S/ ${resumen.totalValesMonto.toLocaleString('es-PE')}`, color: 'yellow', Icon: Ticket },
          { label: 'Deudas pendientes', value: `S/ ${resumen.totalDeudas.toLocaleString('es-PE')}`, color: 'red', Icon: AlertCircle },
        ].map(({ label, value, color, Icon }) => {
          const c = { emerald: ['bg-emerald-500/10','text-emerald-400','border-emerald-500/20'], blue: ['bg-blue-500/10','text-blue-400','border-blue-500/20'], yellow: ['bg-yellow-500/10','text-yellow-400','border-yellow-500/20'], red: ['bg-red-500/10','text-red-400','border-red-500/20'] }[color]
          return (
            <div key={label} className={`stat-card border ${c[2]}`}>
              <div className={`w-8 h-8 ${c[0]} rounded-lg flex items-center justify-center`}><Icon className={`w-4 h-4 ${c[1]}`} /></div>
              <p className={`text-2xl font-bold ${c[1]}`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          )
        })}
      </div>

      {/* Gráfica ingresos diarios */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Ingresos diarios (tienda)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={ventasDiarias}>
            <defs>
              <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `S/${v}`} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#3b82f6" strokeWidth={2} fill="url(#gradIngresos)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Balones vendidos por día</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ventasDiarias}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="balones" name="Balones" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Ventas por tipo de cliente</h3>
          {ventasPorTipo.length === 0
            ? <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Sin datos</div>
            : <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={ventasPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {ventasPorTipo.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [`S/ ${v.toLocaleString('es-PE')}`, 'Ingresos']} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Por método de pago</h3>
          {ventasPorPago.length === 0
            ? <div className="flex items-center justify-center h-40 text-gray-600 text-sm">Sin datos</div>
            : <div className="space-y-3">
              {ventasPorPago.sort((a,b) => b.value - a.value).map((p,i) => {
                const max = ventasPorPago.reduce((s,x) => Math.max(s,x.value), 0)
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 text-sm capitalize">{p.name}</span>
                      <span className="text-white font-semibold text-sm">S/ {p.value.toLocaleString('es-PE')}</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(p.value/max)*100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          }
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Top clientes del período</h3>
          {topClientes.length === 0
            ? <div className="flex items-center justify-center h-40 text-gray-600 text-sm">Sin datos</div>
            : <div className="space-y-3">
              {topClientes.map((c,i) => (
                <div key={c.nombre} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: COLORS[i%COLORS.length]+'30', color: COLORS[i%COLORS.length] }}>{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{c.nombre}</p>
                    <p className="text-gray-500 text-xs">{c.balones} balones</p>
                  </div>
                  <p className="text-emerald-400 font-bold text-sm flex-shrink-0">S/ {c.total.toLocaleString('es-PE')}</p>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      {/* Stock actual */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Stock actual por ubicación</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-800">
              {['Ubicación','Tipo','Stock actual','Estado'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-800/50">
              {stockActual.map((s,i) => (
                <tr key={i} className="table-row-hover">
                  <td className="px-6 py-3 text-white font-medium text-sm">{s.nombre}</td>
                  <td className="px-6 py-3"><span className="badge-blue capitalize">{s.origen}</span></td>
                  <td className="px-6 py-3"><span className={`font-bold text-sm ${s.stock_actual > 100 ? 'text-emerald-400' : s.stock_actual > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{s.stock_actual} bal.</span></td>
                  <td className="px-6 py-3"><span className={s.stock_actual > 50 ? 'badge-green' : s.stock_actual > 10 ? 'badge-yellow' : 'badge-red'}>{s.stock_actual > 50 ? 'Bien' : s.stock_actual > 10 ? 'Bajo' : 'Crítico'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .btn-primary, .btn-secondary { display: none !important; }
          #reporte-print { padding: 20px; }
        }
      `}</style>
    </>}

      {tabReporte === 'ganancias' && (
        <div className="space-y-5">
          <div className="card">
            <div className="flex flex-wrap gap-2 mb-4">
              {[['hoy','📅 Hoy'],['semana','📆 Esta semana'],['mes','🗓️ Este mes'],['personalizado','🔍 Personalizado']].map(([val, label]) => (
                <button key={val} onClick={() => setPeriodoGanancia(val)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${periodoGanancia === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>
            {periodoGanancia === 'personalizado' && (
              <div className="flex gap-4 items-end flex-wrap">
                <div><label className="label">Desde</label><input type="date" className="input" value={fechaGanDesde} onChange={e => setFechaGanDesde(e.target.value)} /></div>
                <div><label className="label">Hasta</label><input type="date" className="input" value={fechaGanHasta} onChange={e => setFechaGanHasta(e.target.value)} /></div>
                <button onClick={calcularGanancias} className="btn-primary">Calcular</button>
              </div>
            )}
          </div>

          {loadingGanancias ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Calculando...</div>
          ) : !gananciasData ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Selecciona un período para calcular</div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Ganancia bruta total (tienda + distribuidores)</p>
                  <p className="text-4xl font-bold text-emerald-400 mt-1">S/ {gananciasData.gananciaTotalBruta.toFixed(2)}</p>
                  <p className="text-emerald-400/70 text-sm mt-1">{gananciasData.margenTotal.toFixed(1)}% margen sobre S/ {gananciasData.totalGeneral.toFixed(2)} vendido</p>
                </div>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-blue-400 font-bold text-lg">S/ {gananciasData.gananciaBruta.toFixed(2)}</p>
                    <p className="text-gray-500 text-xs">Tienda</p>
                  </div>
                  <div className="w-px bg-gray-700" />
                  <div>
                    <p className="text-orange-400 font-bold text-lg">S/ {gananciasData.gananciaDist.toFixed(2)}</p>
                    <p className="text-gray-500 text-xs">Distribuidores</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card border border-blue-500/30">
                  <p className="text-2xl font-bold text-blue-400">S/ {gananciasData.totalVentas.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Ventas tienda</p>
                </div>
                <div className="stat-card border border-orange-500/30">
                  <p className="text-2xl font-bold text-orange-400">S/ {gananciasData.totalRecaudadoDist.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Rendido distribuidores</p>
                </div>
                <div className="stat-card border border-red-500/30">
                  <p className="text-2xl font-bold text-red-400">S/ {gananciasData.costoTotal.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Costo total</p>
                  <p className="text-xs text-gray-600 mt-0.5">S/{gananciasData.costoPromedio.toFixed(2)}/bal.</p>
                </div>
                <div className="stat-card border border-yellow-500/30">
                  <p className="text-2xl font-bold text-yellow-400">S/ {gananciasData.totalInvertido.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Invertido en compras</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card">
                  <h4 className="text-sm font-semibold text-white mb-4">Por método de pago</h4>
                  {Object.keys(gananciasData.porPago).length === 0
                    ? <p className="text-gray-600 text-sm text-center py-4">Sin ventas en este período</p>
                    : <div className="space-y-3">
                      {Object.entries(gananciasData.porPago).map(([tipo, d]) => {
                        const pct = gananciasData.totalVentas > 0 ? (d.total / gananciasData.totalVentas) * 100 : 0
                        return (
                          <div key={tipo}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300">{labelPago[tipo] || tipo}</span>
                              <span className="text-white font-semibold">S/ {d.total.toFixed(2)} <span className="text-gray-500 font-normal">({d.count} ventas)</span></span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  }
                </div>
                <div className="card">
                  <h4 className="text-sm font-semibold text-white mb-4">Por tipo de balón</h4>
                  {Object.keys(gananciasData.porBalon).length === 0
                    ? <p className="text-gray-600 text-sm text-center py-4">Sin ventas en este período</p>
                    : <div className="space-y-3">
                      {Object.entries(gananciasData.porBalon).sort((a,b) => b[1].total - a[1].total).map(([tipo, d]) => {
                        const pct = gananciasData.totalVentas > 0 ? (d.total / gananciasData.totalVentas) * 100 : 0
                        return (
                          <div key={tipo}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300">{labelBalon[tipo] || tipo}</span>
                              <span className="text-white font-semibold">S/ {d.total.toFixed(2)} <span className="text-gray-500 font-normal">({d.count} ventas)</span></span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  }
                </div>
              </div>

              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h4 className="text-sm font-semibold text-white">🚛 Distribuidores</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setVistaDist('juntos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${vistaDist === 'juntos' ? 'bg-orange-600/30 border-orange-500 text-orange-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                      📊 Todos juntos
                    </button>
                    {Object.keys(gananciasData.porDistribuidor).map(nombre => (
                      <button key={nombre} onClick={() => setVistaDist(nombre)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${vistaDist === nombre ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                        🚛 {nombre}
                      </button>
                    ))}
                  </div>
                </div>
                {Object.keys(gananciasData.porDistribuidor).length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-6">Sin rendiciones en este período</p>
                ) : vistaDist === 'juntos' ? (
                  <div className="space-y-3">
                    {Object.entries(gananciasData.porDistribuidor).map(([nombre, d]) => {
                      const ganancia = d.totalEsperado - (d.balones * gananciasData.costoPromedio)
                      const pct = gananciasData.totalRecaudadoDist > 0 ? (d.totalEsperado / gananciasData.totalRecaudadoDist) * 100 : 0
                      return (
                        <div key={nombre} className="bg-gray-800/40 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <p className="text-white font-semibold text-sm">{nombre}</p>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-orange-400 font-bold text-sm">S/ {d.totalEsperado.toFixed(2)}</p>
                                <p className="text-gray-600 text-xs">{d.balones} bal. · {d.rendiciones} rend.</p>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold text-sm ${ganancia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>+S/ {ganancia.toFixed(2)}</p>
                                <p className="text-gray-600 text-xs">ganancia est.</p>
                              </div>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                      <span className="text-white font-semibold text-sm">Total distribuidores</span>
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-orange-400 font-bold">S/ {gananciasData.totalRecaudadoDist.toFixed(2)}</p>
                          <p className="text-gray-600 text-xs">recaudado</p>
                        </div>
                        <div>
                          <p className="text-emerald-400 font-bold">S/ {gananciasData.gananciaDist.toFixed(2)}</p>
                          <p className="text-gray-600 text-xs">ganancia est.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (() => {
                    const d = gananciasData.porDistribuidor[vistaDist]
                    if (!d) return <p className="text-gray-600 text-sm text-center py-6">Sin datos</p>
                    const ganancia = d.totalEsperado - (d.balones * gananciasData.costoPromedio)
                    const costo = d.balones * gananciasData.costoPromedio
                    const margenD = d.totalEsperado > 0 ? (ganancia / d.totalEsperado) * 100 : 0
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-orange-400">S/ {d.totalEsperado.toFixed(2)}</p>
                            <p className="text-xs text-gray-500 mt-1">Total rendido</p>
                          </div>
                          <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-400">S/ {ganancia.toFixed(2)}</p>
                            <p className="text-xs text-gray-500 mt-1">Ganancia est.</p>
                            <p className="text-xs text-emerald-400/70">{margenD.toFixed(1)}% margen</p>
                          </div>
                          <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-red-400">S/ {costo.toFixed(2)}</p>
                            <p className="text-xs text-gray-500 mt-1">Costo estimado</p>
                          </div>
                          <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-blue-400">{d.balones}</p>
                            <p className="text-xs text-gray-500 mt-1">Balones vendidos</p>
                          </div>
                        </div>
                        <div className="bg-gray-800/40 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-2">Distribución de ingresos</p>
                          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                            {d.totalEsperado > 0 && <>
                              <div className="bg-emerald-500 rounded-l-full" style={{ width: `${(ganancia/d.totalEsperado)*100}%` }} />
                              <div className="bg-red-500 rounded-r-full" style={{ width: `${(costo/d.totalEsperado)*100}%` }} />
                            </>}
                          </div>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="text-emerald-400">🟢 Ganancia {((ganancia/d.totalEsperado||1)*100).toFixed(0)}%</span>
                            <span className="text-red-400">🔴 Costo {((costo/d.totalEsperado||1)*100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()
                }
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}