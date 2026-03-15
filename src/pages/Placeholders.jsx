import { Package, ShoppingCart, Ticket, Users, Truck, Warehouse, BarChart3, Settings, Construction } from 'lucide-react'

function ComingSoon({ icon: Icon, title, description, color = 'blue' }) {
  const colors = {
    blue:   'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
    green:  'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400',
    red:    'from-red-500/20 to-red-600/5 border-red-500/30 text-red-400',
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
  }
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className={`text-center p-12 rounded-2xl bg-gradient-to-b border ${colors[color]} max-w-md`}>
        <Icon className="w-12 h-12 mx-auto mb-4 opacity-60" />
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-500 text-sm mb-4">{description}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <Construction className="w-3.5 h-3.5" />
          Módulo en construcción — Fase 4
        </div>
      </div>
    </div>
  )
}

export function Inventario() {
  return <ComingSoon icon={Package} title="Inventario" description="Gestión de compras, distribución de balones y control de stock por almacén." color="green" />
}
export function Ventas() {
  return <ComingSoon icon={ShoppingCart} title="Ventas" description="Registro de ventas por tipo de cliente con precios automáticos y métodos de pago." color="blue" />
}
export function Vales() {
  return <ComingSoon icon={Ticket} title="Vales FISE" description="Control diario de vales de S/20 y S/43, historial y retiros del fondo." color="yellow" />
}
export function Clientes() {
  return <ComingSoon icon={Users} title="Clientes y Deudas" description="Registro de clientes, deudas en dinero, balones o vales, con historial de pagos." color="red" />
}
export function Distribuidores() {
  return <ComingSoon icon={Truck} title="Distribuidores" description="Panel de distribuidores: stock, reposiciones, cuentas y rendición mensual." color="indigo" />
}
export function Almacenes() {
  return <ComingSoon icon={Warehouse} title="Almacenes" description="Administración de almacenes, responsables, ubicaciones y movimientos de stock." color="purple" />
}
export function Reportes() {
  return <ComingSoon icon={BarChart3} title="Reportes" description="Reportes de ventas, ganancias, vales, deudas e inventario con opción de impresión." color="blue" />
}
export function Configuracion() {
  return <ComingSoon icon={Settings} title="Configuración" description="Gestión de usuarios, precios, tipos de cliente y configuración del sistema." color="green" />
}
