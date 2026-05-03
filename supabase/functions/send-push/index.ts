// supabase/functions/send-push/index.ts
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC  = 'BFuYMcf6IK0qQWQhvIk1F5nY8GP9WDLBCc-sRTa0yOrqFnxty-fxgUhNs7Ga93yIHXFPgIkJBdsz6q2VWtQ5REE'
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

webpush.setVapidDetails('mailto:centrogas@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { titulo, cuerpo, url, tag, actor } = await req.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data: suscripciones } = await supabase
      .from('push_subscriptions')
      .select('subscription')

    if (!suscripciones?.length) {
      return new Response(JSON.stringify({ ok: true, enviadas: 0 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const payload = JSON.stringify({ titulo, cuerpo, url, tag, actor })
    const resultados = await Promise.allSettled(
      suscripciones.map(s => webpush.sendNotification(s.subscription, payload))
    )

    const enviadas = resultados.filter(r => r.status === 'fulfilled').length
    const fallidas = resultados.filter(r => r.status === 'rejected').length

    return new Response(JSON.stringify({ ok: true, enviadas, fallidas }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
