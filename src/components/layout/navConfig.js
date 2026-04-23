// src/components/layout/navConfig.js
// Fuente única de verdad para navegación — usada por Sidebar y Layout

import {
  LayoutDashboard, ShoppingCart, Ticket, ClipboardList, Users,
  CreditCard, Package, Truck, Warehouse, BarChart3, Settings, Palette,
} from 'lucide-react'
import { useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'

export const ALL_ITEMS = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      permiso: null },
  { to: '/ventas',         icon: ShoppingCart,    label: 'Ventas',         permiso: 'ventas' },
  { to: '/vales',          icon: Ticket,          label: 'Vales FISE',     permiso: 'vales' },
  { to: '/acuenta',        icon: ClipboardList,   label: 'A Cuenta',       permiso: 'acuenta' },
  { to: '/clientes',       icon: Users,           label: 'Clientes',       permiso: 'clientes' },
  { to: '/deudas',         icon: CreditCard,      label: 'Deudas',         permiso: 'deudas' },
  { to: '/inventario',     icon: Package,         label: 'Inventario',     permiso: 'inventario',     adminOnly: true },
  { to: '/distribuidores', icon: Truck,           label: 'Distribuidores', permiso: 'distribuidores', adminOnly: true },
  { to: '/almacenes',      icon: Warehouse,       label: 'Almacenes',      permiso: 'almacenes',      adminOnly: true },
  { to: '/reportes',       icon: BarChart3,       label: 'Reportes',       permiso: 'reportes',       adminOnly: true },
  { to: '/configuracion',  icon: Settings,        label: 'Configuración',  permiso: 'configuracion',  adminOnly: true },
  { to: '/apariencia',     icon: Palette,         label: 'Apariencia',     permiso: null },
]

// Items fijos en la barra inferior móvil
export const BOTTOM_FIXED = ['/dashboard', '/ventas', '/deudas', '/acuenta', '/clientes']

// Hook compartido — filtra items según rol y permisos
export function useItemsVisibles() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.rol === 'admin'
  const permisos = perfil?.permisos || {}

  return useMemo(() =>
    ALL_ITEMS.filter(item => {
      if (isAdmin) return true
      if (item.adminOnly) return false
      if (item.permiso === null) return true
      return permisos[item.permiso] === true
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, JSON.stringify(permisos)]
  )
}
