import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  TrendingUp, Package, Ticket, AlertCircle, Truck,
  ShoppingCart, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

function StatCard({ icon: Icon, label, value, sub, color = 'blue', trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
    green:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    yellow: { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  border: 'border-yellow-500/20' },
    red:    { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20' },
    indigo: { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'border-indigo-500/20' },
  }
  const c = colors[color]

  return (
    <div className={`stat-card border ${c.border}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="border border-[var(--app-card-border)] rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: S/ {p.value?.toLocaleString('es-PE')}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const [stats, setStats] = useState({
    ventasHoy: 0, montoHoy: 0,
    stockTotal: 0, stockVacios: 0, balonesEnDeuda: 0,
    valesMes: 0, deudasActivas: 0, distribuidores: 0,
  })
  const [ventasSemana, setVentasSemana] = useState([])
  const [stockAlmacenes, setStockAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => { 
    if (perfil !== null) cargarDatos() 
  }, [perfil])

  async function cargarDatos() {
    setLoading(true)
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const almacenId = perfil?.almacen_id // null = admin ve todo

      // Ventas de hoy
      let ventasQuery = supabase.from('ventas').select('cantidad, precio_unitario').gte('fecha', hoy)
      if (almacenId) ventasQuery = ventasQuery.eq('almacen_id', almacenId)
      const { data: ventasHoy } = await ventasQuery
      const montoHoy = ventasHoy?.reduce((s, v) => s + (v.cantidad * v.precio_unitario), 0) || 0

      // Stock total llenos
      let stockQuery = supabase.from('almacenes').select('stock_actual, balones_vacios, nombre').eq('activo', true)
      if (almacenId) stockQuery = stockQuery.eq('id', almacenId)
      const { data: almacenesData } = await stockQuery
      const stockTotal = almacenesData?.reduce((s, a) => s + (a.stock_actual || 0), 0) || 0
      const stockVacios = almacenesData?.reduce((s, a) => s + (a.balones_vacios || 0), 0) || 0

      // Balones en deuda
      let deudasQuery = supabase.from('deudas').select('balones_pendiente').neq('estado', 'liquidada')
      if (almacenId) deudasQuery = deudasQuery.eq('almacen_id', almacenId)
      const { data: deudasBal } = await deudasQuery
      const balonesEnDeuda = deudasBal?.reduce((s, d) => s + (parseInt(d.balones_pendiente) || 0), 0) || 0

      // Vales del mes
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const finMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
      const { count: valesMes } = await supabase.from('vales_fise').select('*', { count: 'exact', head: true })
        .gte('lote_dia', inicioMes).lte('lote_dia', finMes)

      // Deudas activas
      let deudasCountQuery = supabase.from('deudas').select('*', { count: 'exact', head: true }).neq('estado', 'liquidada')
      if (almacenId) deudasCountQuery = deudasCountQuery.eq('almacen_id', almacenId)
      const { count: deudasActivas } = await deudasCountQuery

      // Distribuidores activos — solo admin ve
      const { count: distribuidores } = !almacenId
        ? await supabase.from('distribuidores').select('*', { count: 'exact', head: true }).eq('activo', true)
        : { count: 0 }

      setStats({
        ventasHoy: ventasHoy?.length || 0,
        montoHoy, stockTotal, stockVacios, balonesEnDeuda,
        valesMes: valesMes || 0,
        deudasActivas: deudasActivas || 0,
        distribuidores: distribuidores || 0,
      })

      // Ventas últimos 7 días
      const dias = []
      for (let i = 6; i >= 0; i--) {
        const fecha = subDays(new Date(), i)
        const fechaStr = fecha.toISOString().split('T')[0]
        let diaQuery = supabase.from('ventas').select('cantidad, precio_unitario')
          .gte('fecha', fechaStr).lt('fecha', subDays(fecha, -1).toISOString().split('T')[0])
        if (almacenId) diaQuery = diaQuery.eq('almacen_id', almacenId)
        const { data } = await diaQuery
        dias.push({
          dia: format(fecha, 'EEE', { locale: es }),
          ventas: data?.reduce((s, v) => s + (v.cantidad * v.precio_unitario), 0) || 0,
          balones: data?.reduce((s, v) => s + v.cantidad, 0) || 0,
        })
      }
      setVentasSemana(dias)

      // Stock por almacén
      setStockAlmacenes((almacenesData || []).map(a => ({
        nombre: a.nombre.length > 15 ? a.nombre.substring(0, 15) + '…' : a.nombre,
        stock: a.stock_actual || 0,
        tipo: 'almacen',
      })))

      setLastUpdate(new Date())
    } catch (e) {
      console.error('Error cargando dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {saludo}, {perfil?.nombre?.split(' ')[0] || 'Admin'} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <button
          onClick={cargarDatos}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Acciones rápidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Nueva venta',      icon: ShoppingCart, color: 'text-blue-400',    bg: 'bg-blue-500/10',    href: '/ventas' },
            { label: 'Registrar vale',   icon: Ticket,       color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  href: '/vales' },
            { label: 'Ver deudas',       icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-500/10',     href: '/clientes' },
            { label: 'Ver stock',        icon: Package,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', href: '/inventario' },
          ].map(({ label, icon: Icon, color, bg, href }) => (
            <a
              key={label}
              href={href}
              style={{background:"var(--app-card-bg)",border:"1px solid var(--app-card-border)"}} className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all group"
            >
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <span className="text-xs text-gray-400 font-medium text-center">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart}  label="Ventas hoy"          value={stats.ventasHoy}                                          color="blue"   />
        <StatCard icon={TrendingUp}    label="Ingresos hoy"        value={`S/ ${stats.montoHoy.toLocaleString('es-PE')}`}           color="green"  />
        <StatCard icon={Ticket}        label="Vales del mes"       value={stats.valesMes}                                           color="yellow" />
        <StatCard icon={AlertCircle}   label="Deudas activas"      value={stats.deudasActivas}                                      color="red"    />
      </div>

      {/* Balones */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center text-lg">🟢</div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{stats.stockTotal}</p>
              <p className="text-xs text-gray-500">Balones llenos</p>
            </div>
          </div>
        </div>
        <div className="card border border-gray-600/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-500/10 rounded-lg flex items-center justify-center text-lg">⚪</div>
            <div>
              <p className="text-2xl font-bold text-gray-300">{stats.stockVacios}</p>
              <p className="text-xs text-gray-500">Balones vacíos</p>
            </div>
          </div>
        </div>
        <div className="card border border-orange-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500/10 rounded-lg flex items-center justify-center text-lg">🔵</div>
            <div>
              <p className="text-2xl font-bold text-orange-400">{stats.balonesEnDeuda}</p>
              <p className="text-xs text-gray-500">En deuda (calle)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas semana */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Ingresos — Últimos 7 días</h3>
            <span className="badge-blue">Esta semana</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ventasSemana}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)" />
              <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={50}
                tickFormatter={v => `S/${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ventas" name="Ingresos" stroke="#3b82f6"
                strokeWidth={2} fill="url(#colorVentas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stock por ubicación */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Stock por ubicación</h3>
            <span className="badge-green">Actual</span>
          </div>
          {stockAlmacenes.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              Sin datos de stock aún
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stockAlmacenes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nombre" tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ background: "var(--app-card-bg)", border: "1px solid var(--app-card-border)", borderRadius: "8px" }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={v => [`${v} balones`, 'Stock']}
                />
                <Bar dataKey="stock" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-700 text-right">
        Última actualización: {format(lastUpdate, 'HH:mm:ss')}
      </p>
    </div>
  )
}
