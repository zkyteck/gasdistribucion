import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru, inicioDiaPeru, finDiaPeru, nowPeru } from '../lib/fechas'
import { TrendingUp, Package, Ticket, AlertCircle, Printer, RefreshCw, DollarSign, ShoppingCart, Store, Truck, BarChart2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.name !== 'Balones' ? 'S/ ' : ''}{p.value?.toLocaleString('es-PE')}
        </p>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'blue', Icon }) {
  const colors = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    orange: 'border-orange-500/20 bg-orange-500/5 text-orange-400',
    gray: 'border-gray-600/30 bg-gray-700/20 text-gray-300',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      {Icon && <Icon className="w-4 h-4 mb-2 opacity-70" />}
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Reportes() {
  const [tab, setTab] = useState('resumen')
  const [filtroVista, setFiltroVista] = useState('todo') // 'todo' | 'tienda' | 'distribuidores'
  const [periodo, setPeriodo] = useState('mes')
  const [fechaDesde, setFechaDesde] = useState(hoyPeru())
  const [fechaHasta, setFechaHasta] = useState(hoyPeru())
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  useEffect(() => { calcular() }, [periodo, tab, filtroVista])

  function getRango() {
    // Siempre trabajar con fechas locales Peru (YYYY-MM-DD)
    const hoy = hoyPeru()
    const ahora = new Date()
    if (periodo === 'hoy') return { desdeDate: hoy, hastaDate: hoy }
    if (periodo === 'semana') {
      const hace7 = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)
      const d7 = hace7.toISOString().split('T')[0]
      return { desdeDate: d7, hastaDate: hoy }
    }
    if (periodo === 'mes') {
      const [y, m] = hoy.split('-').map(Number)
      const inicioMes = `${y}-${String(m).padStart(2,'0')}-01`
      const finMes = new Date(y, m, 0).toISOString().split('T')[0]
      return { desdeDate: inicioMes, hastaDate: finMes }
    }
    return { desdeDate: fechaDesde, hastaDate: fechaHasta }
  }

  async function calcular() {
    setLoading(true)
    try {
      const { desdeDate, hastaDate } = getRango()
      const desdeISO = desdeDate + 'T00:00:00'
      const hastaISO = hastaDate + 'T23:59:59'

      const [
        { data: ventas },
        { data: cuentasDist },
        { data: costosCfg },
        { data: almacenes },
        { data: distribuidores },
        { data: valesFise },
        { data: deudas },
        { data: stockPorTipo },
      ] = await Promise.all([
        supabase.from('ventas').select('*, clientes(nombre), almacenes(nombre)').gte('fecha', desdeDate + 'T00:00:00').lte('fecha', hastaDate + 'T23:59:59'),
        supabase.from('cuentas_distribuidor').select('*, distribuidores(nombre)').gte('periodo_fin', desdeDate).lte('periodo_fin', hastaDate),
        supabase.from('configuracion').select('clave, valor').in('clave', ['costo_5kg', 'costo_10kg', 'costo_45kg']),
        supabase.from('almacenes').select('*').eq('activo', true).order('nombre'),
        supabase.from('distribuidores').select('*').eq('activo', true).order('nombre'),
        supabase.from('vales_fise').select('*').gte('lote_dia', desdeDate),
        supabase.from('deudas').select('*').neq('estado', 'liquidada'),
        supabase.from('stock_por_tipo').select('*'),
      ])

      // Costos
      const costos = { '5kg': 0, '10kg': 0, '45kg': 0 }
      costosCfg?.forEach(r => {
        if (r.clave === 'costo_5kg') costos['5kg'] = parseFloat(r.valor) || 0
        if (r.clave === 'costo_10kg') costos['10kg'] = parseFloat(r.valor) || 0
        if (r.clave === 'costo_45kg') costos['45kg'] = parseFloat(r.valor) || 0
      })
      const costoPromedio = Object.values(costos).filter(v => v > 0).reduce((s, v, _, a) => s + v / a.length, 0) || 0

      // TIENDA
      const ingTienda = ventas?.reduce((s, v) => s + (v.cantidad || 0) * (v.precio_unitario || 0), 0) || 0
      const balTienda = ventas?.reduce((s, v) => s + (v.cantidad || 0), 0) || 0
      const costoTienda = ventas?.reduce((s, v) => s + (v.cantidad || 0) * (costos[v.tipo_balon || '10kg'] || costoPromedio), 0) || 0
      const ganTienda = ingTienda - costoTienda

      // Vacíos tienda (balones vendidos = vacíos generados)
      const vaciosTienda = balTienda

      // Por tipo balón tienda
      const porBalon = {}
      ventas?.forEach(v => {
        const t = v.tipo_balon || '10kg'
        if (!porBalon[t]) porBalon[t] = { balones: 0, ingreso: 0, ganancia: 0 }
        porBalon[t].balones += v.cantidad || 0
        porBalon[t].ingreso += (v.cantidad || 0) * (v.precio_unitario || 0)
        porBalon[t].ganancia += (v.cantidad || 0) * ((v.precio_unitario || 0) - (costos[t] || 0))
      })

      // Por pago
      const porPago = {}
      ventas?.forEach(v => {
        const t = v.metodo_pago || 'efectivo'
        if (!porPago[t]) porPago[t] = { ingreso: 0, count: 0 }
        porPago[t].ingreso += (v.cantidad || 0) * (v.precio_unitario || 0)
        porPago[t].count += v.cantidad || 0
      })

      // Top clientes
      const porCliente = {}
      ventas?.forEach(v => {
        const n = v.clientes?.nombre || 'Cliente Varios'
        if (!porCliente[n]) porCliente[n] = { total: 0, balones: 0 }
        porCliente[n].total += (v.cantidad || 0) * (v.precio_unitario || 0)
        porCliente[n].balones += v.cantidad || 0
      })
      const topClientes = Object.entries(porCliente).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

      // DISTRIBUIDORES
      const ingDist = cuentasDist?.reduce((s, c) => s + (c.total_esperado || 0), 0) || 0
      const balDist = cuentasDist?.reduce((s, c) => s + (c.balones_vendidos || 0), 0) || 0
      const costoDist = balDist * costoPromedio
      const ganDist = ingDist - costoDist

      const porDist = {}
      cuentasDist?.forEach(c => {
        const n = c.distribuidores?.nombre || 'Sin nombre'
        if (!porDist[n]) porDist[n] = { ingreso: 0, balones: 0, rendiciones: 0, ganancia: 0 }
        porDist[n].ingreso += c.total_esperado || 0
        porDist[n].balones += c.balones_vendidos || 0
        porDist[n].rendiciones++
        porDist[n].ganancia += (c.total_esperado || 0) - (c.balones_vendidos || 0) * costoPromedio
      })

      // STOCK ACTUAL
      const stockActual = almacenes?.map(a => {
        const spt = stockPorTipo?.filter(s => s.almacen_id === a.id) || []
        const llenos5 = spt.find(s => s.tipo_balon === '5kg')?.stock_actual || 0
        const llenos10 = spt.find(s => s.tipo_balon === '10kg')?.stock_actual || 0
        const llenos45 = spt.find(s => s.tipo_balon === '45kg')?.stock_actual || 0
        return {
          ...a,
          llenos5, llenos10, llenos45,
          totalLlenos: llenos5 + llenos10 + llenos45,
          totalVacios: a.balones_vacios || 0,
          vacios5: a.vacios_5kg || 0,
          vacios10: a.vacios_10kg || 0,
          vacios45: a.vacios_45kg || 0,
        }
      }) || []

      // GRÁFICA DIARIA
      const dias = eachDayOfInterval({ start: parseISO(desdeDate), end: parseISO(hastaDate) })
      const diario = dias.map(dia => {
        const ds = format(dia, 'yyyy-MM-dd')
        const vDia = ventas?.filter(v => v.fecha?.startsWith(ds)) || []
        const cDia = cuentasDist?.filter(c => c.periodo_fin === ds) || []
        const iT = vDia.reduce((s, v) => s + (v.cantidad || 0) * (v.precio_unitario || 0), 0)
        const iD = cDia.reduce((s, c) => s + (c.total_esperado || 0), 0)
        const gT = vDia.reduce((s, v) => s + (v.cantidad || 0) * ((v.precio_unitario || 0) - (costos[v.tipo_balon || '10kg'] || 0)), 0)
        const bT = vDia.reduce((s, v) => s + (v.cantidad || 0), 0)
        const bD = cDia.reduce((s, c) => s + (c.balones_vendidos || 0), 0)
        return {
          dia: format(dia, dias.length > 15 ? 'dd/MM' : 'EEE dd', { locale: es }),
          Tienda: Math.round(iT), Distribuidores: Math.round(iD),
          'Gan.Tienda': Math.round(gT),
          'Bal.Tienda': bT, 'Bal.Dist': bD,
        }
      })

      // TOTALES
      const ingTotal = ingTienda + ingDist
      const ganTotal = ganTienda + ganDist
      const balTotal = balTienda + balDist
      const costoTotal = costoTienda + costoDist

      setData({
        costos, costoPromedio,
        ingTienda, balTienda, costoTienda, ganTienda, vaciosTienda,
        ingDist, balDist, costoDist, ganDist,
        ingTotal, ganTotal, balTotal, costoTotal,
        margen: ingTotal > 0 ? (ganTotal / ingTotal) * 100 : 0,
        porBalon, porPago, porDist, topClientes, diario, stockActual,
        totalValesFise: valesFise?.reduce((s, v) => s + (v.monto || 0), 0) || 0,
        totalDeudas: deudas?.filter(d => d.tipo_deuda === 'dinero').reduce((s, d) => s + (d.monto_pendiente || 0), 0) || 0,
        distribuidores: distribuidores || [],
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const lPago = { efectivo: '💵 Efectivo', yape: '📱 Yape', vale: '🎫 Vale', mixto: '🔀 Mixto' }
  const lBalon = { '5kg': '🔵 5kg', '10kg': '🟡 10kg', '45kg': '🔴 45kg' }

  // Datos según filtro
  const ing = !data ? 0 : filtroVista === 'tienda' ? data.ingTienda : filtroVista === 'distribuidores' ? data.ingDist : data.ingTotal
  const gan = !data ? 0 : filtroVista === 'tienda' ? data.ganTienda : filtroVista === 'distribuidores' ? data.ganDist : data.ganTotal
  const bal = !data ? 0 : filtroVista === 'tienda' ? data.balTienda : filtroVista === 'distribuidores' ? data.balDist : data.balTotal
  const costo = !data ? 0 : filtroVista === 'tienda' ? data.costoTienda : filtroVista === 'distribuidores' ? data.costoDist : data.costoTotal

  return (
    <div className="space-y-6" id="reporte-print">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Reportes</h2>
          <p className="text-gray-500 text-sm">Centro Gas Paucara — {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={calcular} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="w-3.5 h-3.5" />Imprimir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 w-fit">
        {[['resumen', '📊 Resumen'], ['ganancias', '📈 Ganancias'], ['stock', '📦 Stock']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Vista */}
        <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1">
          {[['todo', <><BarChart2 className="w-3 h-3" />Todo</>, 'gray'],
            ['tienda', <><Store className="w-3 h-3" />Tienda</>, 'blue'],
            ['distribuidores', <><Truck className="w-3 h-3" />Distribuidores</>, 'orange']
          ].map(([key, label, c]) => (
            <button key={key} onClick={() => setFiltroVista(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroVista === key
                ? c === 'orange' ? 'bg-orange-600 text-white' : c === 'blue' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Período */}
        <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1">
          {[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['personalizado', 'Personalizado']].map(([key, label]) => (
            <button key={key} onClick={() => setPeriodo(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodo === key ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="flex gap-2 items-end">
            <div><label className="label text-xs">Desde</label><input type="date" className="input text-xs py-1.5" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></div>
            <div><label className="label text-xs">Hasta</label><input type="date" className="input text-xs py-1.5" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} /></div>
            <button onClick={calcular} className="btn-primary py-1.5 text-xs">Calcular</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />Calculando...
        </div>
      ) : !data ? null : (
        <>
          {/* ══════════ TAB RESUMEN ══════════ */}
          {tab === 'resumen' && (
            <div className="space-y-6">

              {/* KPIs principales */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Ingresos totales" value={`S/ ${ing.toLocaleString('es-PE')}`} color="blue" Icon={DollarSign}
                  sub={filtroVista === 'todo' ? `Tienda + Distribuidores` : filtroVista === 'tienda' ? `${data.balTienda} ventas` : `${data.balDist} balones`} />
                <StatCard label="Balones vendidos" value={`${bal} bal.`} color="emerald" Icon={Package}
                  sub={filtroVista === 'todo' ? `Tienda: ${data.balTienda} · Dist: ${data.balDist}` : ''} />
                <StatCard label="Vales FISE" value={`S/ ${data.totalValesFise.toLocaleString('es-PE')}`} color="yellow" Icon={Ticket} />
                <StatCard label="Deudas pendientes" value={`S/ ${data.totalDeudas.toLocaleString('es-PE')}`} color="red" Icon={AlertCircle} />
              </div>

              {/* Gráfica ingresos diarios */}
              {(filtroVista === 'todo' || filtroVista === 'tienda') && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-white mb-4">📈 Ingresos diarios</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.diario} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `S/${v}`} width={55} />
                      <Tooltip content={<CustomTooltip />} />
                      {filtroVista !== 'distribuidores' && <Bar dataKey="Tienda" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />}
                      {filtroVista !== 'tienda' && <Bar dataKey="Distribuidores" fill="#f97316" radius={[3, 3, 0, 0]} stackId="a" />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Balones vendidos por día */}
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4">🔵 Balones vendidos por día</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.diario}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {filtroVista !== 'distribuidores' && <Bar dataKey="Bal.Tienda" name="Tienda" fill="#10b981" radius={[3, 3, 0, 0]} stackId="b" />}
                    {filtroVista !== 'tienda' && <Bar dataKey="Bal.Dist" name="Distribuidores" fill="#f97316" radius={[3, 3, 0, 0]} stackId="b" />}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por método de pago */}
                {filtroVista !== 'distribuidores' && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-white mb-4">Por método de pago (tienda)</h3>
                    {Object.keys(data.porPago).length === 0
                      ? <p className="text-gray-600 text-sm text-center py-6">Sin ventas</p>
                      : <div className="space-y-3">
                        {Object.entries(data.porPago).sort((a, b) => b[1].ingreso - a[1].ingreso).map(([tipo, d], i) => {
                          const max = Math.max(...Object.values(data.porPago).map(x => x.ingreso))
                          return (
                            <div key={tipo}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300">{lPago[tipo] || tipo}</span>
                                <span className="text-white font-semibold">S/ {d.ingreso.toLocaleString()} <span className="text-gray-500 text-xs">({d.count} bal.)</span></span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(d.ingreso / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    }
                  </div>
                )}

                {/* Por tipo de balón */}
                {filtroVista !== 'distribuidores' && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-white mb-4">Por tipo de balón (tienda)</h3>
                    {Object.keys(data.porBalon).length === 0
                      ? <p className="text-gray-600 text-sm text-center py-6">Sin ventas</p>
                      : <div className="space-y-3">
                        {Object.entries(data.porBalon).sort((a, b) => b[1].ingreso - a[1].ingreso).map(([tipo, d], i) => {
                          const max = Math.max(...Object.values(data.porBalon).map(x => x.ingreso))
                          return (
                            <div key={tipo}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300">{lBalon[tipo] || tipo}</span>
                                <span className="text-white font-semibold">S/ {d.ingreso.toLocaleString()} <span className="text-gray-500 text-xs">({d.balones} bal.)</span></span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(d.ingreso / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    }
                  </div>
                )}

                {/* Top clientes */}
                {filtroVista !== 'distribuidores' && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-white mb-4">🏆 Top clientes</h3>
                    {data.topClientes.length === 0
                      ? <p className="text-gray-600 text-sm text-center py-6">Sin datos</p>
                      : <div className="space-y-3">
                        {data.topClientes.map(([nombre, d], i) => (
                          <div key={nombre} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: COLORS[i % COLORS.length] + '30', color: COLORS[i % COLORS.length] }}>{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{nombre}</p>
                              <p className="text-gray-500 text-xs">{d.balones} balones</p>
                            </div>
                            <p className="text-emerald-400 font-bold text-sm flex-shrink-0">S/ {d.total.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    }
                  </div>
                )}

                {/* Por distribuidor */}
                {filtroVista !== 'tienda' && Object.keys(data.porDist).length > 0 && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-white mb-4">🚛 Por distribuidor</h3>
                    <div className="space-y-3">
                      {Object.entries(data.porDist).map(([nombre, d], i) => {
                        const max = Math.max(...Object.values(data.porDist).map(x => x.ingreso))
                        return (
                          <div key={nombre}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300">{nombre}</span>
                              <span className="text-white font-semibold">S/ {d.ingreso.toLocaleString()} <span className="text-gray-500 text-xs">({d.balones} bal.)</span></span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(d.ingreso / max) * 100}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ TAB GANANCIAS ══════════ */}
          {tab === 'ganancias' && (
            <div className="space-y-6">

              {/* Banner principal */}
              <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/20 border border-emerald-600/30 rounded-2xl p-6">
                <p className="text-gray-400 text-sm mb-1">Ganancia bruta — {filtroVista === 'todo' ? 'Tienda + Distribuidores' : filtroVista === 'tienda' ? 'Solo Tienda' : 'Solo Distribuidores'}</p>
                <p className="text-5xl font-bold text-emerald-400">S/ {gan.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                <p className="text-emerald-400/60 text-sm mt-2">
                  {(ing > 0 ? (gan / ing * 100) : 0).toFixed(1)}% margen · costo prom. S/{data.costoPromedio.toFixed(2)}/bal.
                </p>
                {filtroVista === 'todo' && (
                  <div className="flex gap-8 mt-4">
                    <div><p className="text-blue-400 font-bold text-lg">S/ {data.ganTienda.toLocaleString()}</p><p className="text-gray-500 text-xs">🏪 Tienda</p></div>
                    <div className="w-px bg-gray-700" />
                    <div><p className="text-orange-400 font-bold text-lg">S/ {data.ganDist.toLocaleString()}</p><p className="text-gray-500 text-xs">🚛 Distribuidores</p></div>
                  </div>
                )}
              </div>

              {/* KPIs ganancias */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Ingresos" value={`S/ ${ing.toLocaleString()}`} color="blue" />
                <StatCard label="Costo estimado" value={`S/ ${costo.toLocaleString()}`} color="red" sub={`S/${data.costoPromedio.toFixed(2)}/bal.`} />
                <StatCard label="Ganancia bruta" value={`S/ ${gan.toLocaleString()}`} color="emerald" />
                <StatCard label="Balones vendidos" value={`${bal} bal.`} color="gray" />
              </div>

              {/* Gráfica ganancia diaria */}
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4">📈 Ganancia diaria (tienda)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.diario}>
                    <defs>
                      <linearGradient id="gradGan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `S/${v}`} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Gan.Tienda" name="Ganancia" stroke="#10b981" strokeWidth={2} fill="url(#gradGan)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Ganancia por tipo balón */}
              {filtroVista !== 'distribuidores' && Object.keys(data.porBalon).length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-white mb-4">Ganancia por tipo de balón</h3>
                  <div className="space-y-3">
                    {Object.entries(data.porBalon).sort((a, b) => b[1].ganancia - a[1].ganancia).map(([tipo, d], i) => (
                      <div key={tipo} className="bg-gray-800/40 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{lBalon[tipo] || tipo}</span>
                          <div className="flex gap-4 text-right">
                            <div><p className="text-gray-400 text-xs">Ingresos</p><p className="text-blue-400 font-bold">S/ {d.ingreso.toLocaleString()}</p></div>
                            <div><p className="text-gray-400 text-xs">Costo</p><p className="text-red-400 font-bold">S/ {(d.ingreso - d.ganancia).toLocaleString()}</p></div>
                            <div><p className="text-gray-400 text-xs">Ganancia</p><p className="text-emerald-400 font-bold">S/ {d.ganancia.toLocaleString()}</p></div>
                            <div><p className="text-gray-400 text-xs">Balones</p><p className="text-gray-300 font-bold">{d.balones}</p></div>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.ingreso > 0 ? (d.ganancia / d.ingreso) * 100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{d.ingreso > 0 ? ((d.ganancia / d.ingreso) * 100).toFixed(1) : 0}% margen</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distribuidores */}
              {filtroVista !== 'tienda' && Object.keys(data.porDist).length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-white mb-4">🚛 Ganancia por distribuidor</h3>
                  <div className="space-y-3">
                    {Object.entries(data.porDist).map(([nombre, d]) => (
                      <div key={nombre} className="bg-gray-800/40 rounded-xl p-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-white font-semibold">{nombre}</p>
                          <div className="flex gap-4 text-right">
                            <div><p className="text-gray-400 text-xs">Rendido</p><p className="text-orange-400 font-bold">S/ {d.ingreso.toLocaleString()}</p></div>
                            <div><p className="text-gray-400 text-xs">Ganancia est.</p><p className="text-emerald-400 font-bold">S/ {d.ganancia.toLocaleString()}</p></div>
                            <div><p className="text-gray-400 text-xs">Balones</p><p className="text-gray-300 font-bold">{d.balones}</p></div>
                            <div><p className="text-gray-400 text-xs">Rendiciones</p><p className="text-gray-300 font-bold">{d.rendiciones}</p></div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-gray-700 pt-3 flex justify-between">
                      <span className="text-white font-semibold">Total distribuidores</span>
                      <div className="flex gap-6 text-right">
                        <div><p className="text-orange-400 font-bold">S/ {data.ingDist.toLocaleString()}</p><p className="text-gray-600 text-xs">recaudado</p></div>
                        <div><p className="text-emerald-400 font-bold">S/ {data.ganDist.toLocaleString()}</p><p className="text-gray-600 text-xs">ganancia</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB STOCK ══════════ */}
          {tab === 'stock' && (
            <div className="space-y-6">

              {/* Resumen stock total */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total llenos" value={`${data.stockActual.reduce((s, a) => s + a.totalLlenos, 0)} bal.`} color="emerald" Icon={Package} />
                <StatCard label="Total vacíos" value={`${data.stockActual.reduce((s, a) => s + a.totalVacios, 0)} bal.`} color="gray" Icon={Package} />
                <StatCard label="Balones vendidos (período)" value={`${data.balTienda} bal.`} color="blue" sub="Solo tienda" />
                <StatCard label="En campo (dist.)" value={`${data.distribuidores.reduce((s, d) => s + (d.stock_actual || 0), 0)} bal.`} color="orange" />
              </div>

              {/* Tabla stock por almacén */}
              <div className="card p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-white">📦 Stock por almacén</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-gray-800">
                      {['Almacén', 'Responsable', '🟢 Llenos', '⚪ Vacíos', 'Detalle llenos', 'Detalle vacíos', 'Estado'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {data.stockActual.map(a => (
                        <tr key={a.id} className="table-row-hover">
                          <td className="px-4 py-4 text-white font-medium text-sm">{a.nombre}</td>
                          <td className="px-4 py-4 text-gray-400 text-sm">{a.responsable || '-'}</td>
                          <td className="px-4 py-4">
                            <span className={`text-lg font-bold ${a.totalLlenos > 50 ? 'text-emerald-400' : a.totalLlenos > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {a.totalLlenos} bal.
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-300 font-bold text-lg">{a.totalVacios} bal.</td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1 flex-wrap">
                              {a.llenos5 > 0 && <span className="text-xs bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">5kg: {a.llenos5}</span>}
                              {a.llenos10 > 0 && <span className="text-xs bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">10kg: {a.llenos10}</span>}
                              {a.llenos45 > 0 && <span className="text-xs bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">45kg: {a.llenos45}</span>}
                              {a.totalLlenos === 0 && <span className="text-gray-600 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1 flex-wrap">
                              {a.vacios5 > 0 && <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">5kg: {a.vacios5}</span>}
                              {a.vacios10 > 0 && <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">10kg: {a.vacios10}</span>}
                              {a.vacios45 > 0 && <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">45kg: {a.vacios45}</span>}
                              {a.totalVacios === 0 && <span className="text-gray-600 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={a.totalLlenos > 50 ? 'badge-green' : a.totalLlenos > 10 ? 'badge-yellow' : 'badge-red'}>
                              {a.totalLlenos > 50 ? 'Bien' : a.totalLlenos > 10 ? 'Bajo' : 'Crítico'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Distribuidores stock */}
              {data.distribuidores.length > 0 && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h3 className="text-sm font-semibold text-white">🚛 Stock distribuidores</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b border-gray-800">
                        {['Distribuidor', '🟢 Llenos (en campo)', '⚪ Vacíos', 'Precio/bal.', 'Valor en campo', 'Estado'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {data.distribuidores.map(d => (
                          <tr key={d.id} className="table-row-hover">
                            <td className="px-4 py-4 text-white font-medium text-sm">{d.nombre}</td>
                            <td className="px-4 py-4">
                              <span className={`text-lg font-bold ${d.stock_actual > 20 ? 'text-emerald-400' : d.stock_actual > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {d.stock_actual || 0} bal.
                              </span>
                            </td>
                            <td className="px-4 py-4 text-gray-300 font-bold">{d.balones_vacios || 0} bal.</td>
                            <td className="px-4 py-4 text-blue-400 font-semibold">S/ {d.precio_base}</td>
                            <td className="px-4 py-4 text-yellow-400 font-bold">S/ {((d.stock_actual || 0) * d.precio_base).toLocaleString()}</td>
                            <td className="px-4 py-4">
                              <span className={(d.stock_actual || 0) > 0 ? 'badge-green' : 'badge-red'}>
                                {(d.stock_actual || 0) > 0 ? 'En campo' : 'Sin stock'}
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
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4">📊 Llenos vs Vacíos por almacén</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.stockActual.map(a => ({ nombre: a.nombre.replace('Almacén ', '').replace('Tienda Principal ', 'Tienda'), llenos: a.totalLlenos, vacios: a.totalVacios }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="nombre" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                    <Bar dataKey="llenos" name="🟢 Llenos" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="vacios" name="⚪ Vacíos" fill="#4b5563" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .btn-primary, .btn-secondary { display: none !important; }
        }
      `}</style>
    </div>
  )
}
