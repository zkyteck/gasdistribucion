import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru, inicioDiaPeru, finDiaPeru, nowPeru } from '../lib/fechas'
import { Truck, Plus, Edit2, Package, X, AlertCircle, History, ChevronDown, ChevronUp, DollarSign, RefreshCw, Ticket, Clock, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { useAuth } from '../context/AuthContext'

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Distribuidores() {
  const { perfil } = useAuth()
  const [distribuidores, setDistribuidores] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'nuevo'|'editar'|'reponer'|'historial'|'cuenta'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', almacen_id: '', precio_base: '' })
  const [repoForm, setRepoForm] = useState({ cantidad: '', notas: '' })
  const [cuentaForm, setCuentaForm] = useState({ vales20: '', vales43: '', adelantos: '', balones_devueltos: '', balones_vendidos: '', notas: '', fecha: hoyPeru() })
  const [historial, setHistorial] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [valesDist, setValesDist] = useState([])
  const [rendiciones, setRendiciones] = useState([])
  const [abonoModal, setAbonoModal] = useState(null)
  const [abonoForm, setAbonoForm] = useState({ efectivo: '', vales20: '', vales43: '', balones_devueltos: '', notas: '' })
  const [savingAbono, setSavingAbono] = useState(false)
  const [clientes, setClientes] = useState([])
  const [valeForm, setValeForm] = useState({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre: '', telefono: '' })
  const [subModal, setSubModal] = useState(null) // 'clienteRapido'

  useEffect(() => { cargar() }, [])

  async function cargarValesDist(distId) {
    const { data } = await supabase.from('vales_distribuidor')
      .select('*').eq('distribuidor_id', distId).order('fecha', { ascending: false })
    setValesDist(data || [])
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    setClientes(data || [])
  }

  async function cargar() {
    setLoading(true)
    const [{ data: d }, { data: a }, { data: vp }, { data: rp }] = await Promise.all([
      supabase.from('distribuidores').select('*, almacenes(nombre, stock_actual, balones_vacios, vacios_5kg, vacios_10kg, vacios_45kg)').eq('activo', true).order('nombre'),
      supabase.from('almacenes').select('id, nombre, stock_actual, balones_vacios').eq('activo', true),
      supabase.from('vales_distribuidor').select('distribuidor_id').eq('estado', 'pendiente'),
      supabase.from('cuentas_distribuidor').select('distribuidor_id, balones_faltantes').neq('estado', 'cancelado')
    ])
    const distConVales = (d || []).map(dist => ({
      ...dist,
      vales_pendientes: (vp || []).filter(v => v.distribuidor_id === dist.id).length,
      balones_por_cobrar: (rp || []).filter(r => r.distribuidor_id === dist.id).reduce((s, r) => s + (r.balones_faltantes || 0), 0)
    }))
    // Enriquecer distribuidores con stock real del almacén asignado
    const distEnriquecidos = (distConVales).map(dist => {
      const almacenAsignado = (a || []).find(alm => alm.id === dist.almacen_id)
      return {
        ...dist,
        stock_actual: almacenAsignado?.stock_actual || 0,
        balones_vacios: almacenAsignado?.balones_vacios || 0,
        balones_pendientes_devolucion: almacenAsignado?.balones_pendientes_devolucion || 0,
      }
    })
    setDistribuidores(distEnriquecidos)
    setAlmacenes(a || [])
    setLoading(false)
  }

  async function cargarHistorial(distId) {
    // Obtener almacen_id del distribuidor seleccionado
    const dist = distribuidores.find(d => d.id === distId)
    const almacenId = dist?.almacen_id

    const [{ data: repos }, { data: rends }, { data: movs }] = await Promise.all([
      supabase.from('reposiciones_distribuidor')
        .select('*, almacenes(nombre)').eq('distribuidor_id', distId).order('fecha', { ascending: false }).limit(20),
      supabase.from('cuentas_distribuidor')
        .select('*').eq('distribuidor_id', distId).order('periodo_fin', { ascending: false }).limit(30),
      almacenId ? supabase.from('movimientos_stock')
        .select('*').eq('almacen_id', almacenId)
        .in('tipo', ['traslado', 'entrada', 'compra', 'ajuste_manual'])
        .order('created_at', { ascending: false }).limit(20) : { data: [] }
    ])
    setHistorial(repos || [])
    setRendiciones(rends || [])
    setMovimientos(movs || [])
  }

  async function cargarMovimientos(distId) {
    const { data } = await supabase.from('movimientos_stock')
      .select('*').eq('distribuidor_id', distId).order('created_at', { ascending: false }).limit(30)
    setMovimientos(data || [])
  }

  async function abrirVales(d) {
    setSelected(d)
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
    setError('')
    await cargarValesDist(d.id)
    await cargarClientes()
    setModal('vales')
  }

  async function guardarVale() {
    if (!form_vale_nombre) { setError('Ingresa el nombre del cliente'); return }
    setSaving(true); setError('')
    const monto = valeForm.tipo_vale === '20' ? 20 : 43
    const { error: e } = await supabase.from('vales_distribuidor').insert({
      distribuidor_id: selected.id,
      nombre_cliente: valeForm.nombre_cliente,
      cliente_id: valeForm.cliente_id || null,
      tipo_vale: valeForm.tipo_vale,
      monto,
      fecha: valeForm.fecha,
      notas: valeForm.notas,
      estado: 'pendiente'
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setValeForm({ nombre_cliente: '', cliente_id: '', tipo_vale: '20', fecha: hoyPeru(), notas: '' })
    await cargarValesDist(selected.id)
  }

  async function marcarValeCobrado(vale) {
    await supabase.from('vales_distribuidor').update({ estado: 'cobrado', fecha_cobro: hoyPeru(), updated_at: new Date().toISOString() }).eq('id', vale.id)
    await cargarValesDist(selected.id)
  }

  async function anularVale(vale) {
    if (!confirm('¿Anular este vale?')) return
    await supabase.from('vales_distribuidor').update({ estado: 'anulado', updated_at: new Date().toISOString() }).eq('id', vale.id)
    await cargarValesDist(selected.id)
  }

  async function guardarClienteRapido() {
    if (!clienteRapidoForm.nombre) return
    const { data: nc } = await supabase.from('clientes').insert({
      nombre: clienteRapidoForm.nombre, telefono: clienteRapidoForm.telefono, tipo: 'general'
    }).select().single()
    await cargarClientes()
    if (nc) setValeForm(f => ({...f, nombre_cliente: nc.nombre, cliente_id: nc.id}))
    setClienteRapidoForm({ nombre: '', telefono: '' })
    setSubModal(null)
  }

  const form_vale_nombre = valeForm.nombre_cliente

  async function guardarAbono() {
    if (!selected) return
    const modo = abonoForm.modo || 'abono'
    const efectivo = parseFloat(abonoForm.efectivo) || 0
    const vales20 = parseInt(abonoForm.vales20) || 0
    const vales43 = parseInt(abonoForm.vales43) || 0
    const vaciosDevueltos = parseInt(abonoForm.vacios_extra) || 0
    const balonesVendidos = parseInt(abonoForm.balones_devueltos) || 0
    const totalAbono = efectivo + (vales20 * 20) + (vales43 * 43)

    // Validar según modo
    if (modo === 'abono' && totalAbono === 0 && vaciosDevueltos === 0) {
      return // abono parcial: necesita al menos algo
    }
    if (modo === 'totalizar' && !balonesVendidos) {
      return // totalizar: necesita balones vendidos
    }

    setSavingAbono(true)

    // Registrar en abonos_distribuidor
    await supabase.from('abonos_distribuidor').insert({
      distribuidor_id: selected.id,
      fecha: hoyPeru(),
      efectivo,
      vales_20: vales20,
      vales_43: vales43,
      balones_devueltos: vaciosDevueltos,
      total_abonado: totalAbono,
      notas: `[${modo === 'totalizar' ? 'Totalización' : 'Abono'}] ${abonoForm.notas || ''}`
    })

    // Actualizar almacén según modo
    if (selected.almacen_id) {
      const { data: almFresco } = await supabase.from('almacenes')
        .select('stock_actual, balones_vacios, vacios_10kg, balones_pendientes_devolucion')
        .eq('id', selected.almacen_id).single()
      if (almFresco) {
        if (modo === 'totalizar') {
          // Totalizar: descuenta llenos vendidos, suma vacíos devueltos, marca pendientes
          const balonesSinDevolver = Math.max(0, balonesVendidos - vaciosDevueltos)
          await supabase.from('almacenes').update({
            stock_actual: Math.max(0, (almFresco.stock_actual || 0) - vaciosDevueltos),
            balones_vacios: (almFresco.balones_vacios || 0) + vaciosDevueltos,
            vacios_10kg: (almFresco.vacios_10kg || 0) + vaciosDevueltos,
            balones_pendientes_devolucion: Math.max(0, (almFresco.balones_pendientes_devolucion || 0) + balonesSinDevolver),
            updated_at: new Date().toISOString()
          }).eq('id', selected.almacen_id)
          // Actualizar stock_por_tipo
          const { data: spt } = await supabase.from('stock_por_tipo')
            .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
          if (spt) {
            await supabase.from('stock_por_tipo')
              .update({ stock_actual: Math.max(0, spt.stock_actual - vaciosDevueltos) })
              .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
          }
        } else {
          // Abono parcial: solo suma vacíos si devolvió, sin tocar llenos
          if (vaciosDevueltos > 0) {
            await supabase.from('almacenes').update({
              stock_actual: Math.max(0, (almFresco.stock_actual || 0) - vaciosDevueltos),
              balones_vacios: (almFresco.balones_vacios || 0) + vaciosDevueltos,
              vacios_10kg: (almFresco.vacios_10kg || 0) + vaciosDevueltos,
              updated_at: new Date().toISOString()
            }).eq('id', selected.almacen_id)
            const { data: spt } = await supabase.from('stock_por_tipo')
              .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
            if (spt) {
              await supabase.from('stock_por_tipo')
                .update({ stock_actual: Math.max(0, spt.stock_actual - vaciosDevueltos) })
                .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
            }
          }
        }
      }
    }

    // Registrar ingreso en ventas para reportes
    if (totalAbono > 0 && selected.almacen_id) {
      await supabase.from('ventas').insert({
        almacen_id: selected.almacen_id,
        tipo_balon: '10kg',
        fecha: new Date().toISOString(),
        cantidad: modo === 'totalizar' ? balonesVendidos : 0,
        precio_unitario: modo === 'totalizar' ? (selected.precio_base || 0) : totalAbono,
        metodo_pago: modo === 'totalizar' ? 'cobro_distribuidor' : 'abono_distribuidor',
        notas: `${modo === 'totalizar' ? 'Totalización' : 'Abono'} — ${selected.nombre}${abonoForm.notas ? ' · ' + abonoForm.notas : ''}`,
        usuario_id: perfil?.id || null
      })
    }

    setSavingAbono(false)
    setAbonoModal(null)
    setAbonoForm({ efectivo: '', vales20: '', vales43: '', balones_devueltos: '', vacios_extra: '', notas: '', modo: 'abono' })
    cargar()
  }

  async function guardarDistribuidor() {
    if (!form.nombre || !form.precio_base) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    const data = { nombre: form.nombre, telefono: form.telefono, almacen_id: form.almacen_id || null, precio_base: parseFloat(form.precio_base) }
    const op = selected
      ? supabase.from('distribuidores').update({ ...data, updated_at: new Date().toISOString() }).eq('id', selected.id)
      : supabase.from('distribuidores').insert({ ...data, stock_actual: 0 })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function guardarReposicion() {
    const cant = parseInt(repoForm.cantidad)
    if (!cant || cant <= 0) { setError('Ingresa una cantidad válida'); return }
    const almacen = almacenes.find(a => a.id === selected.almacen_id)
    if (!almacen || almacen.stock_actual < cant) { setError(`Stock insuficiente en almacén. Disponible: ${almacen?.stock_actual || 0}`); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('reposiciones_distribuidor').insert({
      distribuidor_id: selected.id,
      almacen_origen_id: selected.almacen_id,
      cantidad: cant,
      stock_antes_dist: selected.stock_actual,
      stock_despues_dist: selected.stock_actual + cant,
      notas: repoForm.notas,
      fecha: new Date().toISOString()
    })
    if (e) { setError(e.message); setSaving(false); return }
    // Descontar del almacén
    await supabase.from('almacenes')
      .update({ stock_actual: almacen.stock_actual - cant })
      .eq('id', selected.almacen_id)
    // Descontar stock_por_tipo
    const { data: spt } = await supabase.from('stock_por_tipo')
      .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
    if (spt) {
      await supabase.from('stock_por_tipo')
        .update({ stock_actual: Math.max(0, spt.stock_actual - cant) })
        .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
    }
    // Registrar en ventas como crédito al distribuidor (para reportes)
    await supabase.from('ventas').insert({
      almacen_id: selected.almacen_id,
      tipo_balon: '10kg',
      fecha: new Date().toISOString(),
      cantidad: cant,
      precio_unitario: selected.precio_base || 0,
      metodo_pago: 'credito_distribuidor',
      notas: `Reposición a ${selected.nombre}${repoForm.notas ? ' — ' + repoForm.notas : ''}`,
      usuario_id: perfil?.id || null
    })
    setSaving(false)
    setModal(null); setRepoForm({ cantidad: '', notas: '' }); cargar()
  }

  async function abrirHistorial(d) {
    setSelected(d); await cargarHistorial(d.id); await cargarMovimientos(d.id); setModal('historial')
  }

  async function abrirCuenta(d) {
    setSelected(d); setCuentaForm({ vales20: '', vales43: '', adelantos: '', balones_devueltos: '', balones_vendidos: '', notas: '', fecha: hoyPeru() }); setError(''); setModal('cuenta')
  }

  async function guardarCuenta() {
    const v20 = parseInt(cuentaForm.vales20) || 0
    const v43 = parseInt(cuentaForm.vales43) || 0
    const adelantos = parseFloat(cuentaForm.adelantos) || 0
    const balonesDevueltos = parseInt(cuentaForm.balones_devueltos) || 0
    const balonesVendidos = parseInt(cuentaForm.balones_vendidos) || 0
    const balonesFaltantes = balonesVendidos - balonesDevueltos
    const totalVales = (v20 * 20) + (v43 * 43)
    const totalEsperado = balonesVendidos * selected.precio_base
    const saldoEfectivo = totalEsperado - totalVales - adelantos
    const estadoCuenta = saldoEfectivo <= 0 && balonesFaltantes <= 0 ? 'cancelado' : 'por_cobrar'
    setSaving(true); setError('')
    const fechaRendicion = cuentaForm.fecha || hoyPeru()
    const { data: cuenta, error: e1 } = await supabase.from('cuentas_distribuidor').insert({
      distribuidor_id: selected.id,
      periodo_inicio: fechaRendicion, periodo_fin: fechaRendicion,
      balones_entregados: selected.stock_actual,
      balones_vendidos: balonesVendidos,
      precio_por_balon: selected.precio_base,
      total_esperado: totalEsperado,
      total_vales: totalVales,
      total_adelantos: adelantos,
      balones_devueltos: balonesDevueltos,
      balones_faltantes: balonesFaltantes,
      estado: estadoCuenta, notas: cuentaForm.notas
    }).select().single()
    if (e1) { setError(e1.message); setSaving(false); return }
    const detalles = []
    if (v20 > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'vale_20', cantidad: v20, monto: v20 * 20, fecha: fechaRendicion })
    if (v43 > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'vale_43', cantidad: v43, monto: v43 * 43, fecha: fechaRendicion })
    if (adelantos > 0) detalles.push({ cuenta_id: cuenta.id, tipo: 'adelanto', monto: adelantos, fecha: fechaRendicion })
    if (detalles.length > 0) await supabase.from('cuenta_distribuidor_detalles').insert(detalles)
    // Actualizar solo vacíos en distribuidor (stock_actual viene del almacén)
    await supabase.from('distribuidores')
      .update({ 
        balones_vacios: (selected.balones_vacios || 0) + balonesVendidos,
        updated_at: new Date().toISOString() 
      })
      .eq('id', selected.id)
    // Actualizar almacén: descontar llenos vendidos, sumar vacíos, agregar devueltos
    if (selected.almacen_id) {
      const almacen = almacenes.find(a => a.id === selected.almacen_id)
      if (almacen) {
        // Llenos = stock actual - balones que salieron a vender (los devueltos son VACÍOS, no llenos)
        const nuevosLlenos = Math.max(0, (almacen.stock_actual || 0) - balonesVendidos)
        // Vacíos = los que devolvió físicamente
        const nuevosVacios = Math.max(0, (almacen.balones_vacios || 0) + balonesDevueltos)
        const nuevosVacios10 = Math.max(0, (almacen.vacios_10kg || 0) + balonesDevueltos)
        // Pendientes = balones vendidos que aún no devuelve como vacíos
        const nuevosPendientes = Math.max(0, (almacen.balones_pendientes_devolucion || 0) + balonesFaltantes)
        await supabase.from('almacenes')
          .update({
            stock_actual: nuevosLlenos,
            balones_vacios: nuevosVacios,
            vacios_10kg: nuevosVacios10,
            balones_pendientes_devolucion: nuevosPendientes
          })
          .eq('id', selected.almacen_id)
        // También actualizar stock_por_tipo
        const { data: spt } = await supabase.from('stock_por_tipo')
          .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
        if (spt) {
          await supabase.from('stock_por_tipo')
            .update({ stock_actual: Math.max(0, spt.stock_actual - balonesVendidos) })
            .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
        }
      }
    }
    setSaving(false); setModal(null); cargar()
    // Registrar el cobro como ingreso en ventas (para reportes)
    const montoEfectivoCobrado = Math.max(0, saldoEfectivo)
    if (montoEfectivoCobrado > 0 && selected.almacen_id) {
      await supabase.from('ventas').insert({
        almacen_id: selected.almacen_id,
        tipo_balon: '10kg',
        fecha: (cuentaForm.fecha || hoyPeru()) + 'T12:00:00-05:00',
        cantidad: balonesVendidos,
        precio_unitario: selected.precio_base || 0,
        metodo_pago: 'cobro_distribuidor',
        notas: `Rendición ${selected.nombre} — ${balonesVendidos} bal. vendidos`,
        usuario_id: perfil?.id || null
      })
    }
    const icono = estadoCuenta === 'cancelado' ? '✅ CANCELADO' : '⏳ POR COBRAR'
    const msgBalones = balonesFaltantes > 0 ? `\n⚠️ Balones faltantes: ${balonesFaltantes}` : '\n✅ Balones completos'
    alert(`${icono}\nTotal esperado: S/ ${totalEsperado}\nVales: S/ ${totalVales}\nAdelantos: S/ ${adelantos}\n💰 Saldo: S/ ${saldoEfectivo.toFixed(2)}${msgBalones}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Distribuidores</h2>
          <p className="text-gray-500 text-sm">Control de stock, reposiciones y cuentas</p>
        </div>
        <button onClick={() => { setSelected(null); setForm({ nombre: '', telefono: '', almacen_id: '', precio_base: '' }); setError(''); setModal('nuevo') }} className="btn-primary">
          <Plus className="w-4 h-4" />Nuevo distribuidor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card border border-indigo-500/20">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center"><Truck className="w-4 h-4 text-indigo-400" /></div>
          <p className="text-2xl font-bold text-white">{distribuidores.length}</p>
          <p className="text-xs text-gray-500">Distribuidores activos</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-white">{distribuidores.reduce((s, d) => s + d.stock_actual, 0)}</p>
          <p className="text-xs text-gray-500">Balones en distribución</p>
        </div>
        <div className="stat-card border border-yellow-500/20">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-yellow-400" /></div>
          <p className="text-2xl font-bold text-white">S/ {distribuidores.reduce((s, d) => s + (d.stock_actual * d.precio_base), 0).toLocaleString('es-PE')}</p>
          <p className="text-xs text-gray-500">Valor en campo</p>
        </div>
      </div>

      {/* Cards distribuidores */}
      {loading ? <div className="text-center text-gray-500 py-10">Cargando...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {distribuidores.map(d => (
            <div key={d.id} className="card border border-gray-700/50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{d.nombre}</p>
                    <p className="text-gray-500 text-xs">{d.telefono || 'Sin teléfono'} · {d.almacenes?.nombre || 'Sin almacén'}</p>
                  </div>
                </div>
                <button onClick={() => { setSelected(d); setForm({ nombre: d.nombre, telefono: d.telefono || '', almacen_id: d.almacen_id || '', precio_base: d.precio_base }); setError(''); setModal('editar') }}
                  className="text-gray-600 hover:text-blue-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>

              {/* Stock y precio */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${d.stock_actual > 50 ? 'text-emerald-400' : d.stock_actual > 10 ? 'text-yellow-400' : 'text-red-400'}`}>{d.stock_actual}</p>
                  <p className="text-xs text-gray-500 mt-0.5">🟢 Llenos</p>
                </div>
                <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-300">{d.balones_vacios || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">⚪ Vacíos devueltos</p>
                </div>
              </div>
              {(d.balones_por_cobrar || 0) > 0 && (
                <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg p-2 mb-2 flex items-center justify-between">
                  <span className="text-xs text-orange-300 font-medium">⏳ Balones pendientes de devolución</span>
                  <span className="text-orange-400 font-bold text-sm">{d.balones_por_cobrar} bal.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-400">S/{d.precio_base}</p>
                  <p className="text-xs text-gray-500">Precio/bal.</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">S/{(d.stock_actual * d.precio_base).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total campo</p>
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => abrirHistorial(d)}
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <History className="w-3 h-3" />Historial
                </button>
                <button onClick={() => { setSelected(d); setAbonoModal(true); setAbonoForm({ efectivo: '', vales20: '', vales43: '', balones_devueltos: '', notas: '' }) }}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                  <DollarSign className="w-3 h-3" />💰 Arreglar cuentas
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo/editar distribuidor */}
      {(modal === 'nuevo' || modal === 'editar') && (
        <Modal title={modal === 'nuevo' ? 'Nuevo distribuidor' : 'Editar distribuidor'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre</label><input className="input" placeholder="Nombre del distribuidor" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
            <div><label className="label">Teléfono</label><input className="input" placeholder="999 888 777" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /></div>
            <div>
              <label className="label">Almacén asignado</label>
              <select className="input" value={form.almacen_id} onChange={e => setForm({...form, almacen_id: e.target.value})}>
                <option value="">Sin almacén</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.stock_actual} bal.)</option>)}
              </select>
            </div>
            <div><label className="label">Precio por balón (S/)</label><input type="number" className="input" placeholder="100" value={form.precio_base} onChange={e => setForm({...form, precio_base: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarDistribuidor} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal reponer */}
      {modal === 'reponer' && selected && (
        <Modal title={`Reponer stock — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {/* Resumen distribuidor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-400 mb-1">🟢 Llenos (distribuidor)</p>
                <p className="text-2xl font-bold text-emerald-400">{selected.stock_actual}</p>
                <p className="text-xs text-gray-500">balones listos para vender</p>
              </div>
              <div className="bg-gray-700/30 border border-gray-600/40 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">⚪ Vacíos (distribuidor)</p>
                <p className="text-2xl font-bold text-gray-300">{almacenes.find(a => a.id === selected.almacen_id)?.balones_vacios || 0}</p>
                <p className="text-xs text-gray-500">balones vacíos para devolver</p>
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400 mb-1">📦 Stock llenos en almacén disponible</p>
              <p className="text-2xl font-bold text-blue-400">{almacenes.find(a => a.id === selected.almacen_id)?.stock_actual || 0} bal.</p>
            </div>
            <div><label className="label">Cantidad a entregar (llenos)</label><input type="number" className="input" placeholder="50" value={repoForm.cantidad} onChange={e => setRepoForm({...repoForm, cantidad: e.target.value})} /></div>
            {repoForm.cantidad && (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 text-sm">
                <p className="text-emerald-400">🟢 Llenos nuevos del distribuidor: <span className="font-bold">{selected.stock_actual + (parseInt(repoForm.cantidad) || 0)} balones</span></p>
              </div>
            )}
            <div><label className="label">Notas (opcional)</label><textarea className="input" rows={2} placeholder="Observaciones..." value={repoForm.notas} onChange={e => setRepoForm({...repoForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarReposicion} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all flex-1 justify-center flex items-center gap-2">{saving ? 'Guardando...' : '✓ Confirmar reposición'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal rendición de cuentas */}
      {modal === 'cuenta' && selected && (
        <Modal title={`Rendición de cuentas — ${selected.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Precio por balón · Balones en campo: {selected.stock_actual}</p>
              <p className="text-lg font-bold text-white">S/{selected.precio_base}/bal. · <span className="text-blue-400">Ingresa los balones vendidos abajo ↓</span></p>
            </div>
            <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Balones vendidos</label><input type="number" className="input" placeholder={`Máx: ${selected.stock_actual}`} value={cuentaForm.balones_vendidos || ""} onChange={e => setCuentaForm({...cuentaForm, balones_vendidos: e.target.value})} /><p className="text-xs text-gray-500 mt-1">Balones que salieron a vender ({selected.stock_actual} en campo)</p></div>
              <div><label className="label">Vales de S/ 20</label><input type="number" className="input" placeholder="0" value={cuentaForm.vales20} onChange={e => setCuentaForm({...cuentaForm, vales20: e.target.value})} /></div>
              <div><label className="label">Vales de S/ 43</label><input type="number" className="input" placeholder="0" value={cuentaForm.vales43} onChange={e => setCuentaForm({...cuentaForm, vales43: e.target.value})} /></div>
            </div>
            <div><label className="label">Adelantos en efectivo (S/)</label><input type="number" className="input" placeholder="0" value={cuentaForm.adelantos} onChange={e => setCuentaForm({...cuentaForm, adelantos: e.target.value})} /></div>

            {/* Balones devueltos */}
            <div>
              <label className="label">Balones vacíos devueltos</label>
              <div className="flex items-center gap-3">
                <input type="number" className="input flex-1" placeholder="0"
                  value={cuentaForm.balones_devueltos}
                  onChange={e => setCuentaForm({...cuentaForm, balones_devueltos: e.target.value})} />
                <div className="text-right flex-shrink-0">
                  {(() => {
                    const devueltos = parseInt(cuentaForm.balones_devueltos) || 0
                    const vendidos = parseInt(cuentaForm.balones_vendidos) || selected.stock_actual
                    const faltantes = vendidos - devueltos
                    if (!cuentaForm.balones_devueltos) return <span className="text-gray-500 text-xs">de {vendidos} bal. vendidos</span>
                    if (faltantes > 0) return <span className="text-red-400 text-sm font-bold">⚠️ Faltan {faltantes}</span>
                    if (faltantes < 0) return <span className="text-yellow-400 text-sm font-bold">+{Math.abs(faltantes)} extra</span>
                    return <span className="text-emerald-400 text-sm font-bold">✅ Completo</span>
                  })()}
                </div>
              </div>
            </div>

            {/* Cálculo automático */}
            {(cuentaForm.balones_vendidos || cuentaForm.vales20 || cuentaForm.vales43 || cuentaForm.adelantos || cuentaForm.balones_devueltos) && (() => {
              const vendidos = parseInt(cuentaForm.balones_vendidos) || 0
              if (vendidos === 0 && !cuentaForm.balones_vendidos) return null
              const v20 = (parseInt(cuentaForm.vales20) || 0) * 20
              const v43 = (parseInt(cuentaForm.vales43) || 0) * 43
              const adel = parseFloat(cuentaForm.adelantos) || 0
              const devueltos = parseInt(cuentaForm.balones_devueltos) || 0
              const faltantes = vendidos - devueltos
              const total = vendidos * selected.precio_base
              const saldo = total - v20 - v43 - adel
              return (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Total esperado</span><span className="text-white font-semibold">S/ {total.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vales S/20 ({cuentaForm.vales20||0} × 20)</span><span className="text-yellow-400">- S/ {v20}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vales S/43 ({cuentaForm.vales43||0} × 43)</span><span className="text-yellow-400">- S/ {v43}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Adelantos</span><span className="text-yellow-400">- S/ {adel}</span></div>
                  {faltantes !== 0 && cuentaForm.balones_devueltos && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Balones faltantes</span>
                      <span className={faltantes > 0 ? 'text-red-400 font-semibold' : 'text-yellow-400'}>
                        {faltantes > 0 ? `⚠️ ${faltantes} sin devolver` : `+${Math.abs(faltantes)} extra`}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                    <span className="text-white font-semibold">💰 Saldo en efectivo</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>S/ {saldo.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${saldo <= 0 && faltantes <= 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/50' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-600/50'}`}>
                        {saldo <= 0 && faltantes <= 0 ? '✅ CANCELADO' : '⏳ POR COBRAR'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div><label className="label">Fecha de la rendición</label><input type="date" className="input" value={cuentaForm.fecha} onChange={e => setCuentaForm({...cuentaForm, fecha: e.target.value})} /></div>
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={cuentaForm.notas} onChange={e => setCuentaForm({...cuentaForm, notas: e.target.value})} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarCuenta} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Registrar rendición'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Vales A Cuenta distribuidor */}
      {modal === 'vales' && selected && (
        <Modal title={`🎫 Vales A Cuenta — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/20</p>
                <p className="text-xs text-yellow-400/70 font-semibold">S/ {valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '20').length * 20}</p>
              </div>
              <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length}</p>
                <p className="text-xs text-gray-500 mt-1">Vales S/43</p>
                <p className="text-xs text-orange-400/70 font-semibold">S/ {valesDist.filter(v => v.estado === 'pendiente' && v.tipo_vale === '43').length * 43}</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">S/ {valesDist.filter(v => v.estado === 'pendiente').reduce((s, v) => s + v.monto, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total pendiente</p>
                <p className="text-xs text-emerald-400/70">{valesDist.filter(v => v.estado === 'cobrado').length} cobrados</p>
              </div>
            </div>

            {/* Formulario nuevo vale */}
            <div className="bg-gray-800/40 rounded-xl p-4 space-y-3 border border-gray-700/50">
              <p className="text-sm font-semibold text-white">Registrar nuevo vale</p>
              <div className="relative">
                <label className="label">Cliente *</label>
                <input className="input" placeholder="Escribe el nombre..." value={valeForm.nombre_cliente}
                  onChange={e => setValeForm(f => ({...f, nombre_cliente: e.target.value, cliente_id: ''}))} />
                {valeForm.nombre_cliente.length >= 2 && (() => {
                  const coincidencias = clientes.filter(c => c.nombre.toLowerCase().includes(valeForm.nombre_cliente.toLowerCase()))
                  const exacto = clientes.find(c => c.nombre.toLowerCase() === valeForm.nombre_cliente.toLowerCase())
                  if (exacto) return <div className="mt-1 text-xs text-emerald-400 px-1">✅ Cliente registrado</div>
                  return (
                    <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                      {coincidencias.map(c => (
                        <button key={c.id} type="button" onClick={() => setValeForm(f => ({...f, nombre_cliente: c.nombre, cliente_id: c.id}))}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2">
                          <span className="text-blue-400">👤</span>{c.nombre}
                        </button>
                      ))}
                      {coincidencias.length === 0 && (
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">No encontrado</span>
                          <button type="button"
                            onClick={() => { setClienteRapidoForm({ nombre: valeForm.nombre_cliente, telefono: '' }); setSubModal('clienteRapido') }}
                            className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-600/50 transition-all">
                            + Registrar cliente
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setValeForm(f => ({...f, tipo_vale: '20'}))}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${valeForm.tipo_vale === '20' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 20
                </button>
                <button onClick={() => setValeForm(f => ({...f, tipo_vale: '43'}))}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${valeForm.tipo_vale === '43' ? 'bg-orange-900/30 border-orange-500 text-orange-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  🎫 Vale S/ 43
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Fecha</label>
                  <input type="date" className="input" value={valeForm.fecha} onChange={e => setValeForm(f => ({...f, fecha: e.target.value}))} />
                </div>
                <div><label className="label">Notas</label>
                  <input className="input" placeholder="Ej: Km 12" value={valeForm.notas} onChange={e => setValeForm(f => ({...f, notas: e.target.value}))} />
                </div>
              </div>
              <button onClick={guardarVale} disabled={saving || !valeForm.nombre_cliente}
                className="w-full btn-primary justify-center">{saving ? 'Guardando...' : '+ Registrar vale'}</button>
            </div>

            {/* Historial de vales */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Historial de vales</p>
              {valesDist.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-6">Sin vales registrados</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {valesDist.map(v => (
                    <div key={v.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${v.tipo_vale === '20' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-orange-900/40 text-orange-400'}`}>
                          S/{v.tipo_vale}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{v.nombre_cliente}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            📅 {format(new Date(v.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                            {v.notas && ` · ${v.notas}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={v.estado === 'pendiente' ? 'badge-yellow' : v.estado === 'cobrado' ? 'badge-green' : 'text-xs text-gray-500'}>
                          {v.estado === 'pendiente' ? '⏳ Pendiente' : v.estado === 'cobrado' ? '✅ Cobrado' : '❌ Anulado'}
                        </span>
                        {v.estado === 'pendiente' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => anularVale(v)} className="text-xs text-gray-600 hover:text-red-400 px-2 py-0.5 rounded border border-gray-700">Anular</button>
                            <button onClick={() => marcarValeCobrado(v)} className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-0.5 rounded">✓ Cobrado</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sub-modal cliente rápido */}
          {subModal === 'clienteRapido' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">Registrar cliente</h3>
                  <button onClick={() => setSubModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 py-4 space-y-3">
                  <div>
                    <label className="label">Nombre *</label>
                    <input className="input" value={clienteRapidoForm.nombre}
                      onChange={e => setClienteRapidoForm(f => ({...f, nombre: e.target.value}))} autoFocus />
                  </div>
                  <div>
                    <label className="label">Teléfono (opcional)</label>
                    <input className="input" value={clienteRapidoForm.telefono}
                      onChange={e => setClienteRapidoForm(f => ({...f, telefono: e.target.value}))} />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setSubModal(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={guardarClienteRapido} className="btn-primary flex-1 justify-center">✓ Registrar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal historial */}
      {modal === 'historial' && selected && (
        <Modal title={`Historial — ${selected.nombre}`} onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            {/* Resumen actual */}
            {(() => {
              const totalVendidos = rendiciones.reduce((s,r) => s + (r.balones_vendidos||0), 0)
              const stockInicial = selected.stock_actual + totalVendidos
              return (
                <div className="space-y-2">
                  {/* Stock inicial vs actual */}
                  <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3 flex items-center justify-between">
                    <div className="text-center px-4">
                      <p className="text-xs text-gray-500 mb-1">📦 Stock inicial</p>
                      <p className="text-2xl font-bold text-gray-300">{stockInicial} bal.</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2 text-gray-600">
                      <div className="h-px flex-1 bg-gray-700" />
                      <span className="text-xs">→ {totalVendidos} vendidos</span>
                      <div className="h-px flex-1 bg-gray-700" />
                    </div>
                    <div className="text-center px-4">
                      <p className="text-xs text-gray-500 mb-1">🟢 Llenos actuales</p>
                      <p className="text-2xl font-bold text-emerald-400">{selected.stock_actual} bal.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-700/30 border border-gray-600/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-300">{selected.balones_vacios || 0}</p>
                      <p className="text-xs text-gray-500 mt-1">⚪ Vacíos devueltos</p>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">S/{selected.precio_base}</p>
                      <p className="text-xs text-gray-500 mt-1">Precio/bal.</p>
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-yellow-400">S/{(selected.stock_actual * selected.precio_base).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Valor campo</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Resumen de movimientos */}
            {rendiciones.length > 0 && (() => {
              const totalVendidos = rendiciones.reduce((s,r) => s + (r.balones_vendidos||0), 0)
              const totalDevueltos = rendiciones.reduce((s,r) => s + (r.balones_devueltos||0), 0)
              const totalPendientes = rendiciones.reduce((s,r) => s + (r.balones_faltantes||0), 0)
              // Total esperado solo de rendiciones con balones
              const totalEsperado = rendiciones.reduce((s,r) => s + (r.total_esperado||0), 0)
              // Total abonado en TODAS las rendiciones (vales + adelantos)
              const totalAbonado = rendiciones.reduce((s,r) => s + (r.total_vales||0) + (r.total_adelantos||0), 0)
              const totalCobrar = Math.max(0, totalEsperado - totalAbonado)
              return (
                <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
                  <p className="text-xs text-blue-300 font-semibold mb-3">📊 Resumen total de rendiciones</p>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div><p className="text-white font-bold">{totalVendidos}</p><p className="text-xs text-gray-500">Vendidos</p></div>
                    <div><p className="text-gray-300 font-bold">{totalDevueltos}</p><p className="text-xs text-gray-500">Devueltos</p></div>
                    <div><p className="text-orange-400 font-bold">{totalPendientes}</p><p className="text-xs text-gray-500">⏳ Pendientes</p></div>
                    <div><p className="text-emerald-400 font-bold">S/{totalCobrar.toLocaleString()}</p><p className="text-xs text-gray-500">💰 Por cobrar</p></div>
                  </div>
                </div>
              )
            })()}

            {/* Rendiciones */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">📋 Historial de rendiciones</h4>
              {rendiciones.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">Sin rendiciones registradas</p>
              ) : (
                <div className="space-y-3">
                  {rendiciones.map(r => {
                    const v20count = r.total_vales > 0 ? Math.round((r.total_vales * 20/63) / 20) : 0
                    const saldo = (r.total_esperado||0) - (r.total_vales||0) - (r.total_adelantos||0)
                    return (
                      <div key={r.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-semibold text-sm">📅 {format(new Date(r.periodo_fin + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{r.balones_vendidos || r.balones_entregados} balones vendidos · S/{r.precio_por_balon}/bal.</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${r.estado === 'cancelado' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/50' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-600/50'}`}>
                            {r.estado === 'cancelado' ? '✅ CANCELADO' : '⏳ POR COBRAR'}
                          </span>
                        </div>
                        {/* Balones */}
                        <div className="grid grid-cols-3 gap-2 text-center mb-2">
                          <div className="bg-gray-800/50 rounded-lg p-2">
                            <p className="text-white font-bold text-sm">{r.balones_vendidos || 0}</p>
                            <p className="text-xs text-gray-500">🔵 Vendidos</p>
                          </div>
                          <div className="bg-gray-700/50 rounded-lg p-2">
                            <p className="text-gray-300 font-bold text-sm">{r.balones_devueltos || 0}</p>
                            <p className="text-xs text-gray-500">⚪ Devueltos</p>
                          </div>
                          <div className={`rounded-lg p-2 ${(r.balones_faltantes||0) > 0 ? 'bg-orange-900/20' : 'bg-emerald-900/20'}`}>
                            <p className={`font-bold text-sm ${(r.balones_faltantes||0) > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                              {r.balones_faltantes || 0}
                            </p>
                            <p className="text-xs text-gray-500">⏳ Pendientes</p>
                          </div>
                        </div>
                        {/* Dinero */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="bg-blue-900/20 rounded-lg p-2">
                            <p className="text-blue-400 font-bold text-sm">S/ {(r.total_esperado||0).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Total esperado</p>
                          </div>
                          <div className="bg-yellow-900/20 rounded-lg p-2">
                            <p className="text-yellow-400 font-bold text-sm">S/ {(r.total_vales||0).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Vales</p>
                          </div>
                          <div className="bg-orange-900/20 rounded-lg p-2">
                            <p className="text-orange-400 font-bold text-sm">S/ {(r.total_adelantos||0).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Adelantos</p>
                          </div>
                          <div className={`rounded-lg p-2 ${saldo > 0 ? 'bg-emerald-900/20' : 'bg-gray-800/50'}`}>
                            <p className={`font-bold text-sm ${saldo > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>S/ {saldo.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">💰 Saldo efectivo</p>
                          </div>
                        </div>
                        {r.notas && <p className="text-xs text-gray-500 mt-2">📝 {r.notas}</p>}
                        {/* Botones abono/borrar */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700/50">
                          {r.estado !== 'cancelado' && (
                            <button onClick={() => { setAbonoModal(r); setAbonoForm({ efectivo: '', vales20: '', vales43: '', balones_devueltos: '', notas: '' }) }}
                              className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 px-3 py-1.5 rounded-lg transition-all flex-1 text-center">
                              💰 Registrar abono
                            </button>
                          )}
                          <button onClick={async () => {
                            if (!confirm(`¿Borrar esta rendición del ${r.periodo_fin}? Esto restaurará el stock del almacén.`)) return
                            // Restaurar stock: devolver llenos, quitar vacíos devueltos
                            const almacen = almacenes.find(a => a.id === selected.almacen_id)
                            if (almacen) {
                              const vendidos = r.balones_vendidos || 0
                              const devueltos = r.balones_devueltos || 0
                              // Restaurar: devolver llenos vendidos, quitar vacíos devueltos
                              await supabase.from('almacenes').update({
                                stock_actual: (almacen.stock_actual || 0) + vendidos,
                                balones_vacios: Math.max(0, (almacen.balones_vacios || 0) - devueltos),
                                vacios_10kg: Math.max(0, (almacen.vacios_10kg || 0) - devueltos),
                                balones_pendientes_devolucion: Math.max(0, (almacen.balones_pendientes_devolucion || 0) - (r.balones_faltantes || 0))
                              }).eq('id', selected.almacen_id)
                              // Restaurar stock_por_tipo
                              const { data: spt } = await supabase.from('stock_por_tipo')
                                .select('stock_actual').eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg').single()
                              if (spt) await supabase.from('stock_por_tipo')
                                .update({ stock_actual: spt.stock_actual + vendidos })
                                .eq('almacen_id', selected.almacen_id).eq('tipo_balon', '10kg')
                            }
                            // Borrar rendición
                            await supabase.from('cuenta_distribuidor_detalles').delete().eq('cuenta_id', r.id)
                            await supabase.from('cuentas_distribuidor').delete().eq('id', r.id)
                            await cargarHistorial(selected.id)
                            cargar()
                          }}
                            className="text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 px-3 py-1.5 rounded-lg transition-all flex-1 text-center">
                            🗑️ Borrar rendición
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Movimientos del almacén */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">📦 Historial de stock del almacén</h4>
              {historial.length === 0 && movimientos.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {/* Reposiciones desde distribuidores */}
                  {historial.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-emerald-900/20 border border-emerald-800/30 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 text-lg">📥</span>
                        <div>
                          <p className="text-white text-sm font-medium">Reposición +{r.cantidad} balones</p>
                          <p className="text-gray-500 text-xs">{format(new Date(r.fecha), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                          {r.notas && <p className="text-gray-600 text-xs italic">{r.notas}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{r.stock_antes_dist} → <span className="text-emerald-400 font-semibold">{r.stock_despues_dist}</span> bal.</p>
                      </div>
                    </div>
                  ))}
                  {/* Movimientos del almacén (traslados, compras) */}
                  {movimientos.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-blue-900/20 border border-blue-800/30 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 text-lg">
                          {m.tipo === 'traslado' ? '🔄' : m.tipo === 'ajuste_manual' ? '✏️' : '📦'}
                        </span>
                        <div>
                          <p className="text-white text-sm font-medium capitalize">
                            {m.tipo === 'traslado' ? 'Traslado' : m.tipo === 'ajuste_manual' ? 'Ajuste manual' : m.tipo}
                            {m.cantidad > 0 ? ` +${m.cantidad}` : ` ${m.cantidad}`} bal.
                          </p>
                          <p className="text-gray-500 text-xs">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                          {m.notas && <p className="text-gray-600 text-xs italic">{m.notas}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal arreglar cuentas */}
      {abonoModal !== null && selected && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <div>
                <h3 className="text-white font-semibold">💰 {selected.nombre}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{selected.almacenes?.nombre} · S/{selected.precio_base}/bal. · {selected.stock_actual || 0} llenos en campo</p>
              </div>
              <button onClick={() => setAbonoModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Toggle modo */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAbonoForm(f => ({...f, modo: 'abono'}))}
                  className={`py-3 px-3 rounded-xl border text-xs font-medium transition-all text-center ${(!abonoForm.modo || abonoForm.modo === 'abono') ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  💵 Abono parcial
                  <p className="text-gray-500 font-normal mt-0.5">Solo lo que trae ahora</p>
                </button>
                <button onClick={() => setAbonoForm(f => ({...f, modo: 'totalizar'}))}
                  className={`py-3 px-3 rounded-xl border text-xs font-medium transition-all text-center ${abonoForm.modo === 'totalizar' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  📊 Totalizar cuentas
                  <p className="text-gray-500 font-normal mt-0.5">Cuántos vendió + lo que paga</p>
                </button>
              </div>

              {/* MODO ABONO PARCIAL */}
              {(!abonoForm.modo || abonoForm.modo === 'abono') && (
                <div className="space-y-3">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-lg font-bold text-emerald-400">{selected.stock_actual || 0}</p><p className="text-xs text-gray-500">🟢 Llenos</p></div>
                    <div><p className="text-lg font-bold text-gray-300">{selected.balones_vacios || 0}</p><p className="text-xs text-gray-500">⚪ Vacíos</p></div>
                    <div><p className="text-lg font-bold text-yellow-400">S/{((selected.stock_actual||0)*(selected.precio_base||0)).toLocaleString()}</p><p className="text-xs text-gray-500">💰 Debe</p></div>
                  </div>
                  <p className="text-xs text-gray-500">¿Qué trae ahora?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">⚪ Vacíos que devuelve</label>
                      <input type="number" min="0" className="input text-center" placeholder="0"
                        value={abonoForm.vacios_extra || ''}
                        onChange={e => setAbonoForm(f => ({...f, vacios_extra: e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">💵 Efectivo S/</label>
                      <input type="number" min="0" step="0.50" className="input text-center" placeholder="0"
                        value={abonoForm.efectivo}
                        onChange={e => setAbonoForm(f => ({...f, efectivo: e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">🎫 Vales S/20</label>
                      <input type="number" min="0" className="input text-center" placeholder="0"
                        value={abonoForm.vales20}
                        onChange={e => setAbonoForm(f => ({...f, vales20: e.target.value}))} />
                      {(parseInt(abonoForm.vales20)||0) > 0 && <p className="text-xs text-yellow-400 text-center mt-1">= S/{((parseInt(abonoForm.vales20)||0)*20).toLocaleString()}</p>}
                    </div>
                    <div>
                      <label className="label">🎫 Vales S/43</label>
                      <input type="number" min="0" className="input text-center" placeholder="0"
                        value={abonoForm.vales43}
                        onChange={e => setAbonoForm(f => ({...f, vales43: e.target.value}))} />
                      {(parseInt(abonoForm.vales43)||0) > 0 && <p className="text-xs text-yellow-400 text-center mt-1">= S/{((parseInt(abonoForm.vales43)||0)*43).toLocaleString()}</p>}
                    </div>
                  </div>
                  {((parseFloat(abonoForm.efectivo)||0)+(parseInt(abonoForm.vales20)||0)*20+(parseInt(abonoForm.vales43)||0)*43+(parseInt(abonoForm.vacios_extra)||0)) > 0 && (
                    <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 space-y-1 text-sm">
                      {(parseInt(abonoForm.vacios_extra)||0) > 0 && <div className="flex justify-between"><span className="text-gray-400">⚪ Vacíos al almacén:</span><span className="text-gray-300">+{abonoForm.vacios_extra} bal.</span></div>}
                      {(parseInt(abonoForm.vales20)||0) > 0 && <div className="flex justify-between"><span className="text-gray-400">🎫 {abonoForm.vales20}×S/20:</span><span className="text-yellow-400">S/ {((parseInt(abonoForm.vales20)||0)*20).toLocaleString()}</span></div>}
                      {(parseInt(abonoForm.vales43)||0) > 0 && <div className="flex justify-between"><span className="text-gray-400">🎫 {abonoForm.vales43}×S/43:</span><span className="text-yellow-400">S/ {((parseInt(abonoForm.vales43)||0)*43).toLocaleString()}</span></div>}
                      {(parseFloat(abonoForm.efectivo)||0) > 0 && <div className="flex justify-between"><span className="text-gray-400">💵 Efectivo:</span><span className="text-emerald-400">S/ {(parseFloat(abonoForm.efectivo)||0).toLocaleString()}</span></div>}
                      <div className="border-t border-gray-700 pt-1 flex justify-between font-semibold">
                        <span className="text-gray-300">Total abono:</span>
                        <span className="text-blue-300">S/ {((parseFloat(abonoForm.efectivo)||0)+(parseInt(abonoForm.vales20)||0)*20+(parseInt(abonoForm.vales43)||0)*43).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODO TOTALIZAR */}
              {abonoForm.modo === 'totalizar' && (
                <div className="space-y-4">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase">1. Balones</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">🟢 Balones que vendió</label>
                        <input type="number" min="0" className="input text-center text-lg font-bold" placeholder="0"
                          value={abonoForm.balones_devueltos}
                          onChange={e => setAbonoForm(f => ({...f, balones_devueltos: e.target.value}))} />
                        <p className="text-xs text-gray-600 mt-1 text-center">Tiene {selected.stock_actual || 0} en campo</p>
                      </div>
                      <div>
                        <label className="label">⚪ Vacíos que devuelve</label>
                        <input type="number" min="0" className="input text-center text-lg font-bold" placeholder="0"
                          value={abonoForm.vacios_extra || ''}
                          onChange={e => setAbonoForm(f => ({...f, vacios_extra: e.target.value}))} />
                        <p className="text-xs text-gray-600 mt-1 text-center">pueden ser menos</p>
                      </div>
                    </div>
                    {(parseInt(abonoForm.balones_devueltos)||0) > 0 && (
                      <div className="bg-gray-900 rounded-lg p-2 flex justify-between">
                        <span className="text-gray-400 text-sm">{abonoForm.balones_devueltos} bal. × S/{selected.precio_base}</span>
                        <span className="text-white font-bold">S/ {((parseInt(abonoForm.balones_devueltos)||0)*(selected.precio_base||0)).toLocaleString('es-PE')}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase">2. Lo que entrega</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label">🎫 Vales S/20</label>
                        <input type="number" min="0" className="input text-center" placeholder="0"
                          value={abonoForm.vales20} onChange={e => setAbonoForm(f => ({...f, vales20: e.target.value}))} />
                        {(parseInt(abonoForm.vales20)||0) > 0 && <p className="text-xs text-yellow-400 text-center mt-1">= S/{((parseInt(abonoForm.vales20)||0)*20).toLocaleString()}</p>}
                      </div>
                      <div>
                        <label className="label">🎫 Vales S/43</label>
                        <input type="number" min="0" className="input text-center" placeholder="0"
                          value={abonoForm.vales43} onChange={e => setAbonoForm(f => ({...f, vales43: e.target.value}))} />
                        {(parseInt(abonoForm.vales43)||0) > 0 && <p className="text-xs text-yellow-400 text-center mt-1">= S/{((parseInt(abonoForm.vales43)||0)*43).toLocaleString()}</p>}
                      </div>
                      <div>
                        <label className="label">💵 Efectivo S/</label>
                        <input type="number" min="0" step="0.50" className="input text-center" placeholder="0"
                          value={abonoForm.efectivo} onChange={e => setAbonoForm(f => ({...f, efectivo: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                  {(parseInt(abonoForm.balones_devueltos)||0) > 0 && (() => {
                    const vendidos = parseInt(abonoForm.balones_devueltos) || 0
                    const vaciosDevueltos = parseInt(abonoForm.vacios_extra) || 0
                    const precio = selected.precio_base || 0
                    const v20 = parseInt(abonoForm.vales20) || 0
                    const v43 = parseInt(abonoForm.vales43) || 0
                    const efectivo = parseFloat(abonoForm.efectivo) || 0
                    const totalBruto = vendidos * precio
                    const totalDescuentos = v20*20 + v43*43 + efectivo
                    const saldo = totalBruto - totalDescuentos
                    const llenosRestantes = Math.max(0, (selected.stock_actual||0) - vaciosDevueltos)
                    const cancelado = saldo <= 0
                    return (
                      <div className="border border-gray-600 rounded-xl overflow-hidden">
                        <div className="bg-gray-800 px-4 py-2"><p className="text-xs text-gray-400 font-semibold uppercase">3. Resultado</p></div>
                        <div className="px-4 py-3 space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-gray-400">{vendidos} bal. × S/{precio}</span><span className="text-white font-semibold">S/ {totalBruto.toLocaleString('es-PE')}</span></div>
                          {v20 > 0 && <div className="flex justify-between"><span className="text-gray-400">{v20} vales S/20</span><span className="text-yellow-400">− S/ {(v20*20).toLocaleString()}</span></div>}
                          {v43 > 0 && <div className="flex justify-between"><span className="text-gray-400">{v43} vales S/43</span><span className="text-yellow-400">− S/ {(v43*43).toLocaleString()}</span></div>}
                          {efectivo > 0 && <div className="flex justify-between"><span className="text-gray-400">Efectivo</span><span className="text-yellow-400">− S/ {efectivo.toLocaleString()}</span></div>}
                          <div className="border-t border-gray-600 pt-2 flex justify-between items-center">
                            <span className="text-white font-bold">Saldo</span>
                            <span className={`font-bold text-xl ${cancelado ? 'text-emerald-400' : 'text-red-400'}`}>S/ {Math.abs(saldo).toLocaleString('es-PE')} {cancelado ? '✅' : '⏳'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div className="bg-emerald-900/20 rounded-lg p-2 text-center">
                              <p className="text-emerald-400 font-bold text-base">{llenosRestantes}</p>
                              <p className="text-gray-500">🟢 Llenos restantes</p>
                            </div>
                            <div className="bg-gray-700/30 rounded-lg p-2 text-center">
                              <p className="text-gray-300 font-bold text-base">+{vaciosDevueltos}</p>
                              <p className="text-gray-500">⚪ Vacíos al almacén</p>
                            </div>
                          </div>
                          {cancelado ? (
                            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-2 text-center">
                              <p className="text-emerald-300 font-bold">✅ CANCELADO</p>
                              {saldo < 0 && <p className="text-xs text-gray-400 mt-0.5">Adelanto S/{Math.abs(saldo).toLocaleString()} para próxima</p>}
                            </div>
                          ) : (
                            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-2 text-center">
                              <p className="text-red-300 font-bold">⏳ Queda debiendo S/ {saldo.toLocaleString('es-PE')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div>
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Ej: Próxima semana el resto..."
                  value={abonoForm.notas} onChange={e => setAbonoForm(f => ({...f, notas: e.target.value}))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setAbonoModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={guardarAbono} disabled={savingAbono} className="btn-primary flex-1 justify-center">
                  {savingAbono ? 'Guardando...' : '✓ Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
