import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ui/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Ventas from './pages/Ventas'
import Vales from './pages/Vales'
import Clientes from './pages/Clientes'
import Deudas from './pages/Deudas'
import ValesDistribuidor from './pages/ValesDistribuidor'
import Distribuidores from './pages/Distribuidores'
import Almacenes from './pages/Almacenes'
import ACuenta from './pages/ACuenta'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"      element={<Dashboard />} />
            <Route path="ventas"         element={<Ventas />} />
            <Route path="vales"          element={<Vales />} />
            <Route path="acuenta"        element={<ACuenta />} />
            <Route path="clientes"       element={<Clientes />} />
            <Route path="deudas"         element={<Deudas />} />
            <Route path="vales-distribuidor" element={<ProtectedRoute adminOnly><ValesDistribuidor /></ProtectedRoute>} />
            <Route path="inventario"     element={<ProtectedRoute adminOnly><Inventario /></ProtectedRoute>} />
            <Route path="distribuidores" element={<ProtectedRoute adminOnly><Distribuidores /></ProtectedRoute>} />
            <Route path="almacenes"      element={<ProtectedRoute adminOnly><Almacenes /></ProtectedRoute>} />
            <Route path="reportes"       element={<ProtectedRoute adminOnly><Reportes /></ProtectedRoute>} />
            <Route path="configuracion"  element={<ProtectedRoute adminOnly><Configuracion /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}