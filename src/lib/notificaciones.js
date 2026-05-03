// src/lib/notificaciones.js
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = 'BFuYMcf6IK0qQWQhvIk1F5nY8GP9WDLBCc-sRTa0yOrqFnxty-fxgUhNs7Ga93yIHXFPgIkJBdsz6q2VWtQ5REE'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Registrar el service worker y suscribirse a notificaciones
export async function inicializarNotificaciones(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    // Registrar SW
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Pedir permiso
    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') return false

    // Suscribirse al push
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    // Guardar suscripción en Supabase
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: JSON.parse(JSON.stringify(subscription)),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

    console.log('Notificaciones activadas')
    return true
  } catch (err) {
    console.error('Error al inicializar notificaciones:', err)
    return false
  }
}

// Enviar notificación a todos los usuarios
export async function notificar({ titulo, cuerpo, url = '/', tag = 'default', actor = '' }) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { titulo, cuerpo, url, tag, actor }
    })
  } catch (err) {
    console.error('Error al enviar notificación:', err)
  }
}

// Helpers para cada evento del negocio
export const Notif = {
  nuevaDeuda: (nombreCliente, monto, actor) =>
    notificar({ titulo: '🔴 Nueva deuda registrada', cuerpo: `${actor} registró deuda de ${nombreCliente} — S/${monto}`, url: '/deudas', tag: 'deuda' }),

  pagoDeuda: (nombreCliente, montoPagado, montoRestante, actor) =>
    notificar({ titulo: '💰 Pago registrado', cuerpo: `${actor} registró pago de ${nombreCliente} — S/${montoPagado}${montoRestante > 0 ? ` (quedan S/${montoRestante})` : ' — Liquidada'}`, url: '/deudas', tag: 'pago' }),

  deudaLiquidada: (nombreCliente, actor) =>
    notificar({ titulo: '✅ Deuda liquidada', cuerpo: `${actor} liquidó la deuda de ${nombreCliente}`, url: '/deudas', tag: 'liquidada' }),

  nuevaVentaCredito: (nombreCliente, monto, actor) =>
    notificar({ titulo: '🛒 Venta al crédito', cuerpo: `${actor} registró venta a crédito para ${nombreCliente} — S/${monto}`, url: '/ventas', tag: 'venta-credito' }),

  nuevaACuenta: (nombreCliente, monto, actor) =>
    notificar({ titulo: '📦 A cuenta registrada', cuerpo: `${actor} registró a cuenta para ${nombreCliente} — S/${monto}`, url: '/a-cuenta', tag: 'acuenta' }),

  recojoACuenta: (nombreCliente, actor) =>
    notificar({ titulo: '✅ A cuenta recogida', cuerpo: `${actor} registró recojo de ${nombreCliente}`, url: '/a-cuenta', tag: 'recojo' }),

  valeRecogido: (nombreCliente, actor) =>
    notificar({ titulo: '🎫 Vale FISE recogido', cuerpo: `${actor} registró recojo de vale de ${nombreCliente}`, url: '/vales', tag: 'vale' }),

  stockBajo: (almacenNombre, cantidad) =>
    notificar({ titulo: '⚠️ Stock bajo', cuerpo: `${almacenNombre}: solo ${cantidad} balones disponibles`, url: '/almacenes', tag: 'stock' }),
}
