import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { ClipboardList, Plus, X, AlertCircle, Search, Printer, CheckCircle, Clock } from 'lucide-react'
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

function Ticket({ data, onClose }) {
  const ticketRef = useRef()

  // Construir historial completo de movimientos
  const historial = data.historial_cambios || []
  const depositos = historial.filter(h => h.tipo === 'deposito')
  const entregas = historial.filter(h => h.tipo === 'entrega')

  function itemsTexto(h) {
    const arr = []
    if (h.vales_20 > 0) arr.push(`${h.vales_20}x S/20`)
    if (h.vales_43 > 0) arr.push(`${h.vales_43}x S/43`)
    if (h.balones > 0) arr.push(`${h.balones} bal.`)
    if (parseFloat(h.dinero) > 0) arr.push(`S/${parseFloat(h.dinero).toFixed(2)}`)
    return arr.join(' + ')
  }

  // Saldo actual en custodia
  const saldoItems = []
  if (data.vales_20 > 0) saldoItems.push(`${data.vales_20} vale(s) S/20`)
  if (data.vales_43 > 0) saldoItems.push(`${data.vales_43} vale(s) S/43`)
  if (data.balones > 0) saldoItems.push(`${data.balones} balón(es)`)
  if (parseFloat(data.dinero) > 0) saldoItems.push(`S/${parseFloat(data.dinero).toFixed(2)}`)

  function imprimir() {
    const contenido = ticketRef.current.innerHTML
    const ventana = window.open('', '_blank', 'width=226,height=900')
    ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket A Cuenta</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #000;
            background: #fff;
            width: 56mm;
            max-width: 56mm;
            padding: 2mm 3mm;
            margin: 0 auto;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .titulo { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 1px; letter-spacing: 0.5px; }
          .subtitulo { font-size: 10px; text-align: center; margin-bottom: 4px; }
          .linea { border-top: 1px dashed #000; margin: 4px 0; }
          .linea-corte { border-top: 2px dashed #000; margin: 8px 0; }
          .scissors { text-align: center; font-size: 13px; margin: 2px 0; }
          .fila { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
          .item { margin: 2px 0 2px 4px; font-size: 10px; }
          .grande { font-size: 12px; font-weight: bold; text-align: center; margin: 4px 0; letter-spacing: 1px; }
          .footer { text-align: center; font-size: 9px; margin-top: 6px; margin-bottom: 8px; line-height: 1.5; }
          .ticket-num { font-size: 16px; font-weight: bold; text-align: center; letter-spacing: 3px; margin: 3px 0; }
          .seccion-titulo { font-size: 10px; font-weight: bold; margin: 3px 0 2px 0; }
          .hist-fila { display: flex; justify-content: space-between; font-size: 9px; margin: 1px 0; }
          .deposito-color { color: #000; }
          .entrega-color { color: #000; }
          .saldo-box { border: 1px solid #000; padding: 3px 4px; margin: 4px 0; text-align: center; font-size: 11px; font-weight: bold; }
          .espacio-corte { height: 120mm; }
          @media print {
            @page { size: 57mm auto; margin: 0; }
            body { width: 56mm; max-width: 56mm; padding: 2mm 3mm; }
          }
        </style>
      </head>
      <body>${contenido}</body>
      </html>
    `)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => { ventana.print(); ventana.close() }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs max-h-[90vh] overflow-y-auto">
        {/* Preview del ticket */}
        <div ref={ticketRef} style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#000', padding: '10px', width: '56mm', margin: '0 auto' }}>

          {/* ENCABEZADO */}
          <div className="titulo">CENTRO GAS PAUCARA</div>
          <div className="subtitulo">Distribución de Gas</div>
          <div className="linea" />
          <div className="center bold" style={{ fontSize: '11px', marginBottom: '3px' }}>COMPROBANTE "A CUENTA"</div>
          <div className="ticket-num">#{String(data.numero).padStart(4, '0')}</div>
          <div className="linea" />
          <div className="fila"><span>Cliente:</span><span className="bold">{data.nombre_cliente}</span></div>
          <div className="fila"><span>Impreso:</span><span>{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</span></div>

          {/* SALDO ACTUAL */}
          <div className="linea" />
          <div className="seccion-titulo">SALDO EN CUSTODIA:</div>
          <div className="saldo-box">
            {saldoItems.length > 0 ? saldoItems.join(' + ') : 'Sin saldo'}
          </div>
          <div className="center" style={{ fontSize: '9px', marginBottom: '2px' }}>
            {data.estado === 'entregado' ? '✓ ENTREGADO' : 'PENDIENTE DE ENTREGA'}
          </div>

          {/* HISTORIAL DE DEPÓSITOS */}
          {depositos.length > 0 && (
            <>
              <div className="linea" />
              <div className="seccion-titulo">DEPOSITOS:</div>
              {depositos.map((h, i) => (
                <div key={i} className="hist-fila">
                  <span className="deposito-color">+ {h.fecha ? format(new Date(h.fecha + 'T12:00:00'), 'dd/MM/yy') : '—'}</span>
                  <span className="bold">{itemsTexto(h)}</span>
                </div>
              ))}
            </>
          )}

          {/* HISTORIAL DE ENTREGAS */}
          {entregas.length > 0 && (
            <>
              <div className="linea" />
              <div className="seccion-titulo">ENTREGAS REALIZADAS:</div>
              {entregas.map((h, i) => (
                <div key={i} className="hist-fila">
                  <span className="entrega-color">- {h.fecha ? format(new Date(h.fecha + 'T12:00:00'), 'dd/MM/yy') : '—'}{h.quien_recoge ? ` ${h.quien_recoge}` : ''}</span>
                  <span className="bold">{itemsTexto(h)}</span>
                </div>
              ))}
            </>
          )}

          {data.notas && (
            <>
              <div className="linea" />
              <div style={{ fontSize: '10px' }}>Nota: {data.notas}</div>
            </>
          )}

          {/* FOOTER */}
          <div className="linea" />
          <div className="footer">
            Guarde este comprobante<br />
            para recoger su pedido<br />
            Centro Gas Paucara
          </div>

          {/* ESPACIO DE CORTE — espacio en blanco para poder romper la hoja */}
          <div className="espacio-corte" />
        </div>

        {/* Botones */}
        <div className="flex gap-3 p-4 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cerrar</button>
          <button onClick={imprimir} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" />Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}

const emptyForm = {
  nombre_cliente: '', fecha: hoyPeru(), tipo_balon: '10kg',
  vales_20: 0, vales_43: 0, balones: 0, dinero: '', notas: ''
}

export default function ACuenta() {
  const { perfil } = useAuth()
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditFormAC] = useState({ vales_20: 0, vales_43: 0, balones: 0, dinero: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clienteRapidoForm, setClienteRapidoForm] = useState({ nombre: '', telefono: '' })
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('pendiente')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [entregaForm, setEntregaForm] = useState({ fecha_entrega: hoyPeru(), quien_recoge: '', vales_20: 0, vales_43: 0, balones: 0, dinero: '' })
  const [ticketData, setTicketData] = useState(null)
  const [clientes, setClientes] = useState([])
  const [depositoForm, setDepositoForm] = useState({ vales_20: 0, vales_43: 0, balones: 0, dinero: '', notas: '' })
  const [registroPendiente, setRegistroPendiente] = useState(null)

  useEffect(() => {
    cargar(); cargarClientes(); cargarPreciosAcuenta()
    const canal = supabase.channel('acuenta-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'a_cuenta' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [filtro])

  const [preciosAcuenta, setPreciosAcuenta] = useState({ '20': 20, '43': 43 })

  async function cargarPreciosAcuenta() {
    const { data } = await supabase.from('configuracion').select('*').in('clave', ['precio_acuenta_20','precio_acuenta_43'])
    if (data?.length) {
      const mapa = { '20': 20, '43': 43 }
      data.forEach(r => {
        if (r.clave === 'precio_acuenta_20') mapa['20'] = parseFloat(r.valor) || 20
        if (r.clave === 'precio_acuenta_43') mapa['43'] = parseFloat(r.valor) || 43
      })
      setPreciosAcuenta(mapa)
    }
  }

  async function cargarClientes() {
    const { data: cData } = await supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    const { data: aData } = await supabase.from('a_cuenta').select('nombre_cliente').eq('estado', 'pendiente')
    const clienteNames = cData || []
    const acuentaNames = (aData || []).map(d => ({ id: 'ac_' + d.nombre_cliente, nombre: d.nombre_cliente }))
    const allNames = [...clienteNames]
    acuentaNames.forEach(d => {
      if (!allNames.find(c => c.nombre.toLowerCase() === d.nombre.toLowerCase())) allNames.push(d)
    })
    setClientes(allNames)
  }

  async function cargarDistribuidores() {
    const { data } = await supabase.from('distribuidores').select('id, nombre').eq('activo', true).order('nombre')
    setDistribuidores(data || [])
  }

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('a_cuenta').select('*').order('created_at', { ascending: false })
    setRegistros(data || [])
    setLoading(false)
  }

  async function guardarRegistro(imprimir = false, forzarNuevo = false) {
    if (!form.nombre_cliente) { setError('Ingresa el nombre del cliente'); return }
    const tieneAlgo = parseInt(form.vales_20) > 0 || parseInt(form.vales_43) > 0 || parseInt(form.balones) > 0 || parseFloat(form.dinero) > 0
    if (!tieneAlgo) { setError('Registra al menos un ítem que dejó el cliente'); return }

    // Check if client already has a pending record
    if (!forzarNuevo) {
      const { data: pendientes } = await supabase.from('a_cuenta')
        .select('*').eq('estado', 'pendiente')
      const encontrado = (pendientes || []).find(r =>
        r.nombre_cliente.trim().toLowerCase() === form.nombre_cliente.trim().toLowerCase()
      )
      if (encontrado) {
        setRegistroPendiente(encontrado)
        return
      }
    }

    setSaving(true); setError('')
    const { count } = await supabase.from('a_cuenta').select('*', { count: 'exact', head: true })
    const numero = (count || 0) + 1
    const entradaHistorial = {
      fecha: form.fecha || hoyPeru(),
      vales_20: parseInt(form.vales_20) || 0,
      vales_43: parseInt(form.vales_43) || 0,
      balones: parseInt(form.balones) || 0,
      tipo_balon: parseInt(form.balones) > 0 ? (form.tipo_balon || '10kg') : null,
      dinero: parseFloat(form.dinero) || 0,
      notas: form.notas || null,
      tipo: 'deposito'
    }
    const { data, error: e } = await supabase.from('a_cuenta').insert({
      nombre_cliente: form.nombre_cliente,
      fecha: form.fecha,
      vales_20: parseInt(form.vales_20) || 0,
      vales_43: parseInt(form.vales_43) || 0,
      balones: parseInt(form.balones) || 0,
      dinero: parseFloat(form.dinero) || 0,
      notas: form.notas,
      estado: 'pendiente',
      numero,
      historial_cambios: [entradaHistorial],
      usuario_id: perfil?.id || null
    }).select().single()
    setSaving(false)
    if (e) { setError(e.message); return }
    if (imprimir) {
      setTicketData({ ...form, numero, vales_20: parseInt(form.vales_20)||0, vales_43: parseInt(form.vales_43)||0, balones: parseInt(form.balones)||0, dinero: parseFloat(form.dinero)||0 })
    }
    setRegistroPendiente(null)
    setModal(null)
    setForm(emptyForm)
    cargar()
  }

  async function agregarAlPendiente() {
    if (!registroPendiente) return
    const v20 = parseInt(form.vales_20) || 0
    const v43 = parseInt(form.vales_43) || 0
    const bal = parseInt(form.balones) || 0
    const din = parseFloat(form.dinero) || 0
    setSaving(true); setError('')
    const entradaHistorial = {
      fecha: form.fecha || hoyPeru(),
      vales_20: v20, vales_43: v43, balones: bal, dinero: din,
      notas: form.notas || null,
      tipo: 'deposito'
    }
    const historialAnterior = registroPendiente.historial_cambios || []
    const { error: e } = await supabase.from('a_cuenta').update({
      vales_20: (registroPendiente.vales_20 || 0) + v20,
      vales_43: (registroPendiente.vales_43 || 0) + v43,
      balones: (registroPendiente.balones || 0) + bal,
      dinero: (parseFloat(registroPendiente.dinero) || 0) + din,
      historial_cambios: [...historialAnterior, entradaHistorial],
      fecha_actualizacion: hoyPeru(),
      updated_at: new Date().toISOString()
    }).eq('id', registroPendiente.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setRegistroPendiente(null)
    setModal(null)
    setForm(emptyForm)
    cargar()
  }

  async function guardarClienteRapido() {
    if (!clienteRapidoForm.nombre?.trim()) return
    const { data, error: e } = await supabase.from('clientes').insert({
      nombre: clienteRapidoForm.nombre.trim(),
      telefono: clienteRapidoForm.telefono?.trim() || null,
      tipo: 'general',
      es_varios: false
    }).select().single()
    if (!e) {
      await cargarClientes()
      setForm(f => ({...f, nombre_cliente: clienteRapidoForm.nombre.trim(), cliente_id: data?.id || ''}))
      setClienteRapidoForm({ nombre: '', telefono: '' })
      setModal('nuevo')
    } else {
      alert('Error al registrar: ' + e.message)
    }
  }

  async function registrarEntrega() {
    setSaving(true); setError('')
    const v20 = parseInt(entregaForm.vales_20) || 0
    const v43 = parseInt(entregaForm.vales_43) || 0
    const bal = parseInt(entregaForm.balones) || 0
    const din = parseFloat(entregaForm.dinero) || 0

    if (v20 === 0 && v43 === 0 && bal === 0 && din === 0) {
      setError('Ingresa al menos un ítem a entregar'); setSaving(false); return
    }
    if (v20 > (selected.vales_20 || 0)) { setError('Máximo ' + selected.vales_20 + ' vale(s) S/20'); setSaving(false); return }
    if (v43 > (selected.vales_43 || 0)) { setError('Máximo ' + selected.vales_43 + ' vale(s) S/43'); setSaving(false); return }
    if (bal > (selected.balones || 0)) { setError('Máximo ' + selected.balones + ' balón(es)'); setSaving(false); return }
    if (din > (parseFloat(selected.dinero) || 0)) { setError('Máximo S/' + parseFloat(selected.dinero).toFixed(2)); setSaving(false); return }

    const nuevos = {
      vales_20: (selected.vales_20 || 0) - v20,
      vales_43: (selected.vales_43 || 0) - v43,
      balones: (selected.balones || 0) - bal,
      dinero: (parseFloat(selected.dinero) || 0) - din,
    }
    const entregaTotal = nuevos.vales_20 === 0 && nuevos.vales_43 === 0 && nuevos.balones === 0 && nuevos.dinero === 0

    const entradaHistorial = {
      fecha: entregaForm.fecha_entrega,
      quien_recoge: entregaForm.quien_recoge || null,
      vales_20: v20, vales_43: v43, balones: bal, dinero: din,
      tipo: 'entrega'
    }
    const historialAnterior = selected.historial_cambios || []

    const { error: e } = await supabase.from('a_cuenta').update({
      ...nuevos,
      estado: entregaTotal ? 'entregado' : 'pendiente',
      fecha_entrega: entregaTotal ? entregaForm.fecha_entrega : null,
      quien_recoge: entregaTotal ? (entregaForm.quien_recoge || null) : null,
      historial_cambios: [...historialAnterior, entradaHistorial],
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  function resumenItems(r) {
    const items = []
    if (r.vales_20 > 0) items.push(`${r.vales_20} vale(s) S/${preciosAcuenta['20']}`)
    if (r.vales_43 > 0) items.push(`${r.vales_43} vale(s) S/${preciosAcuenta['43']}`)
    if (r.balones > 0) items.push(`${r.balones} balón(es)`)
    if (r.dinero > 0) items.push(`S/${parseFloat(r.dinero).toFixed(2)}`)
    return items.join(' + ')
  }

  const filtrados = registros.filter(r => {
    const matchBusqueda = !busqueda || r.nombre_cliente?.toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtro === 'todos' || r.estado === filtro
    const matchDesde = !filtroFechaDesde || r.fecha >= filtroFechaDesde
    const matchHasta = !filtroFechaHasta || r.fecha <= filtroFechaHasta
    return matchBusqueda && matchEstado && matchDesde && matchHasta
  })
  const pendientes = registros.filter(r => r.estado === 'pendiente').length
  const entregados = registros.filter(r => r.estado === 'entregado').length

  async function guardarEdicionAC() {
    if (!selected) return
    setSaving(true); setError('')
    const hoy = hoyPeru()
    // Build historial entry
    const entradaHistorial = {
      fecha_cambio: hoy,
      fecha_original: selected.fecha,
      vales_20_antes: selected.vales_20 || 0,
      vales_43_antes: selected.vales_43 || 0,
      balones_antes: selected.balones || 0,
      dinero_antes: selected.dinero || 0,
      vales_20_nuevo: parseInt(editForm.vales_20) || 0,
      vales_43_nuevo: parseInt(editForm.vales_43) || 0,
      balones_nuevo: parseInt(editForm.balones) || 0,
      dinero_nuevo: parseFloat(editForm.dinero) || 0,
    }
    const historialAnterior = selected.historial_cambios || []
    const { error: e } = await supabase.from('a_cuenta').update({
      vales_20: parseInt(editForm.vales_20) || 0,
      vales_43: parseInt(editForm.vales_43) || 0,
      balones: parseInt(editForm.balones) || 0,
      dinero: parseFloat(editForm.dinero) || 0,
      notas: editForm.notas,
      fecha_actualizacion: hoy,
      historial_cambios: [...historialAnterior, entradaHistorial],
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null)
    cargar()
  }

  async function agregarDeposito() {
    const v20 = parseInt(depositoForm.vales_20) || 0
    const v43 = parseInt(depositoForm.vales_43) || 0
    const bal = parseInt(depositoForm.balones) || 0
    const din = parseFloat(depositoForm.dinero) || 0
    if (v20 === 0 && v43 === 0 && bal === 0 && din === 0) { setError('Ingresa al menos un ítem'); return }
    setSaving(true); setError('')
    const entradaHistorial = {
      fecha: hoyPeru(),
      vales_20: v20, vales_43: v43, balones: bal, dinero: din,
      notas: depositoForm.notas || null,
      tipo: 'deposito'
    }
    const historialAnterior = selected.historial_cambios || []
    const { error: e } = await supabase.from('a_cuenta').update({
      vales_20: (selected.vales_20 || 0) + v20,
      vales_43: (selected.vales_43 || 0) + v43,
      balones: (selected.balones || 0) + bal,
      dinero: (parseFloat(selected.dinero) || 0) + din,
      historial_cambios: [...historialAnterior, entradaHistorial],
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    // Reload selected
    const { data } = await supabase.from('a_cuenta').select('*').eq('id', selected.id).single()
    setSelected(data)
    setDepositoForm({ vales_20: 0, vales_43: 0, balones: 0, dinero: '', notas: '' })
    cargar()
  }

  async function eliminarRegistro(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('a_cuenta').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">A Cuenta</h2>
          <p className="text-gray-500 text-sm">Clientes que dejan depósito para recoger después</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(''); cargarClientes(); setModal('nuevo') }} className="btn-primary">
          <Plus className="w-4 h-4" />Nuevo registro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card border border-yellow-500/20">
          <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-yellow-400" /></div>
          <p className="text-2xl font-bold text-yellow-400">{pendientes}</p>
          <p className="text-xs text-gray-500">Pendientes de entrega</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><CheckCircle className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-emerald-400">{entregados}</p>
          <p className="text-xs text-gray-500">Entregados</p>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input pl-9" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[['pendiente','⏳ Pendientes'],['entregado','✅ Entregados'],['todos','Todos']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltro(val)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${filtro === val ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Filtro por fecha */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-xs">Desde</span>
        <input
          type="date"
          className="input py-1 text-xs w-36"
          value={filtroFechaDesde}
          onChange={e => setFiltroFechaDesde(e.target.value)}
        />
        <span className="text-gray-500 text-xs">Hasta</span>
        <input
          type="date"
          className="input py-1 text-xs w-36"
          value={filtroFechaHasta}
          onChange={e => setFiltroFechaHasta(e.target.value)}
        />
        {(filtroFechaDesde || filtroFechaHasta) && (
          <button
            onClick={() => { setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
            className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-600/40 px-2 py-1 rounded-lg transition-all"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Registros</h3>
          <span className="badge-blue">{filtrados.length} registros</span>
        </div>

        {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> :
          filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
              <ClipboardList className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin registros</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {filtrados.map(r => (
                <div key={r.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Número */}
                      <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 font-mono text-xs font-bold">#{String(r.numero).padStart(3,'0')}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{r.nombre_cliente}</p>
                        <p className="text-blue-400 text-xs font-medium mt-0.5">{resumenItems(r)}</p>
                        <p className="text-gray-400 text-xs mt-0.5">Registrado: {format(new Date(r.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</p>
                        {r.fecha_actualizacion && <p className="text-blue-400 text-xs">Editado: {format(new Date(r.fecha_actualizacion + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}</p>}
</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={r.estado === 'pendiente' ? 'badge-yellow' : 'badge-green'}>
                        {r.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Entregado'}
                      </span>
                      {r.estado === 'entregado' && r.fecha_entrega && (
                        <p className="text-gray-400 text-xs">
                          {format(new Date(r.fecha_entrega + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                          {r.quien_recoge && ` — ${r.quien_recoge}`}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setTicketData({ ...r })}
                          className="text-xs bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 px-2 py-1 rounded-lg flex items-center gap-1 transition-all">
                          <Printer className="w-3 h-3" />Ticket
                        </button>
                        <button onClick={() => { setSelected(r); setDepositoForm({ vales_20: 0, vales_43: 0, balones: 0, dinero: '', notas: '' }); setError(''); setModal('historialAC') }}
                          className="text-xs bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 text-purple-400 px-2 py-1 rounded-lg transition-all">
                          📋 Historial
                        </button>
                        <button onClick={() => { setSelected(r); setEditFormAC({ vales_20: r.vales_20||0, vales_43: r.vales_43||0, balones: r.balones||0, dinero: r.dinero||'', notas: r.notas||'' }); setError(''); setModal('editAC') }}
                          className="text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 px-2 py-1 rounded-lg transition-all">
                          ✏️
                        </button>
                        {perfil?.rol === 'admin' && (
                          <button onClick={() => eliminarRegistro(r.id)}
                            className="text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 px-2 py-1 rounded-lg transition-all">
                            🗑️
                          </button>
                        )}
                        {r.estado === 'pendiente' && (
                          <button onClick={() => { setSelected(r); setEntregaForm({ fecha_entrega: hoyPeru(), quien_recoge: '', vales_20: 0, vales_43: 0, balones: 0, dinero: '' }); setError(''); setModal('entrega') }}
                            className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg transition-all">
                            ✓ Entregar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {r.notas && <p className="text-amber-400/80 text-xs mt-2 italic">📝 {r.notas}</p>}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Modal nuevo registro */}
      {modal === 'nuevo' && (
        <Modal title="Nuevo registro — A Cuenta" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            <div className="relative">
              <label className="label">Nombre del cliente *</label>
              <input className="input" placeholder="Escribe el nombre..." value={form.nombre_cliente}
                onChange={e => setForm(f => ({...f, nombre_cliente: e.target.value}))} autoFocus />
              {form.nombre_cliente.length >= 2 && clientes.find(c => c.nombre.toLowerCase() === form.nombre_cliente.toLowerCase()) && (
                <div className="mt-1 flex items-center gap-2 text-xs text-emerald-400 px-1">
                  <span>✅ Cliente registrado</span>
                </div>
              )}
              {form.nombre_cliente.length >= 2 && !clientes.find(c => c.nombre.toLowerCase() === form.nombre_cliente.toLowerCase()) && (
                <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {clientes.filter(c => c.nombre.toLowerCase().includes(form.nombre_cliente.toLowerCase())).map(c => (
                    <button key={c.id} type="button"
                      onMouseDown={() => setForm(f => ({...f, nombre_cliente: c.nombre}))}
                      onTouchEnd={e => { e.preventDefault(); setForm(f => ({...f, nombre_cliente: c.nombre})) }}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors flex items-center gap-2 border-b border-gray-700/50 last:border-0">
                      <span className="text-blue-400">👤</span> {c.nombre}
                    </button>
                  ))}
                  <div className="px-3 py-2 flex items-center justify-between border-t border-gray-700/50">
                    <span className="text-xs text-gray-500">
                      {clientes.filter(c => c.nombre.toLowerCase().includes(form.nombre_cliente.toLowerCase())).length === 0 ? 'No encontrado' : 'o crear nuevo'}
                    </span>
                    <button type="button"
                      onMouseDown={() => { setClienteRapidoForm({ nombre: form.nombre_cliente, telefono: '' }); setModal('clienteRapido') }}
                      onTouchEnd={e => { e.preventDefault(); setClienteRapidoForm({ nombre: form.nombre_cliente, telefono: '' }); setModal('clienteRapido') }}
                      className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-600/50 transition-all">
                      + Registrar cliente
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))} />
            </div>

            <div>
              <label className="label">¿Qué dejó el cliente?</label>
              <div className="space-y-3 bg-gray-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">🎫 Vales de S/ 20</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setForm(f => ({...f, vales_20: Math.max(0, (f.vales_20||0)-1)}))}
                      className="w-7 h-7 rounded-lg bg-gray-700 text-white font-bold hover:bg-gray-600 transition-all">−</button>
                    <span className="w-8 text-center text-white font-bold">{form.vales_20}</span>
                    <button onClick={() => setForm(f => ({...f, vales_20: (f.vales_20||0)+1}))}
                      className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">🎫 Vales de S/ 43</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setForm(f => ({...f, vales_43: Math.max(0, (f.vales_43||0)-1)}))}
                      className="w-7 h-7 rounded-lg bg-gray-700 text-white font-bold hover:bg-gray-600 transition-all">−</button>
                    <span className="w-8 text-center text-white font-bold">{form.vales_43}</span>
                    <button onClick={() => setForm(f => ({...f, vales_43: (f.vales_43||0)+1}))}
                      className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+</button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">🔵 Balones vacíos</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setForm(f => ({...f, balones: Math.max(0, (f.balones||0)-1)}))} className="w-7 h-7 rounded-lg bg-gray-700 text-white font-bold hover:bg-gray-600 transition-all">−</button>
                      <span className="w-8 text-center text-white font-bold">{form.balones}</span>
                      <button onClick={() => setForm(f => ({...f, balones: (f.balones||0)+1}))} className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+</button>
                    </div>
                  </div>
                  {form.balones > 0 && (
                    <div className="flex gap-2 mt-2">
                      {['5kg','10kg','45kg'].map(t => (
                        <button key={t} type="button" onClick={() => setForm(f => ({...f, tipo_balon: t}))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${(form.tipo_balon||'10kg') === t ? 'bg-blue-600/40 border-blue-400 text-blue-200' : 'border-gray-600 text-gray-500 hover:border-gray-500'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-300 flex-shrink-0">💵 Dinero (S/)</span>
                  <input type="number" className="input w-28 text-center" placeholder="0.00" value={form.dinero}
                    onChange={e => setForm(f => ({...f, dinero: e.target.value}))} />
                </div>
              </div>
            </div>

            {/* Resumen */}
            {(form.vales_20 > 0 || form.vales_43 > 0 || form.balones > 0 || parseFloat(form.dinero) > 0) && (
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-3 text-sm">
                <p className="text-gray-400 text-xs mb-1">Resumen del depósito:</p>
                <p className="text-blue-300 font-medium">
                  {[
                    form.vales_20 > 0 && `${form.vales_20} vale(s) S/20`,
                    form.vales_43 > 0 && `${form.vales_43} vale(s) S/43`,
                    form.balones > 0 && `${form.balones} balón(es) ${form.tipo_balon || ''}`.trim(),
                    parseFloat(form.dinero) > 0 && `S/${parseFloat(form.dinero).toFixed(2)}`
                  ].filter(Boolean).join(' + ')}
                </p>
              </div>
            )}
            <div>
              <label className="label">Notas (opcional)</label>
              <textarea className="input" rows={2} placeholder="Observaciones adicionales..." value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={() => guardarRegistro(false)} disabled={saving} className="btn-secondary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Registrar'}
              </button>
              <button onClick={() => guardarRegistro(true)} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? '...' : '🖨️ Registrar e imprimir'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal entrega */}
      {modal === 'entrega' && selected && (
        <Modal title={`Registrar entrega — ${selected.nombre_cliente}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Pendiente en custodia:</p>
              <p className="text-blue-300 font-semibold">{resumenItems(selected)}</p>
            </div>
            <p className="text-xs text-gray-500">Ingresa cuánto está retirando ahora (puede ser parcial):</p>
            <div className="grid grid-cols-2 gap-3">
              {(selected.vales_20 > 0) && (
                <div>
                  <label className="label">Vales S/20 <span className="text-gray-600">(max {selected.vales_20})</span></label>
                  <input type="number" min="0" max={selected.vales_20} className="input" value={entregaForm.vales_20}
                    onChange={e => setEntregaForm(f => ({...f, vales_20: e.target.value}))} />
                </div>
              )}
              {(selected.vales_43 > 0) && (
                <div>
                  <label className="label">Vales S/43 <span className="text-gray-600">(max {selected.vales_43})</span></label>
                  <input type="number" min="0" max={selected.vales_43} className="input" value={entregaForm.vales_43}
                    onChange={e => setEntregaForm(f => ({...f, vales_43: e.target.value}))} />
                </div>
              )}
              {(selected.balones > 0) && (
                <div>
                  <label className="label">Balones <span className="text-gray-600">(max {selected.balones})</span></label>
                  <input type="number" min="0" max={selected.balones} className="input" value={entregaForm.balones}
                    onChange={e => setEntregaForm(f => ({...f, balones: e.target.value}))} />
                </div>
              )}
              {(parseFloat(selected.dinero) > 0) && (
                <div>
                  <label className="label">Dinero S/ <span className="text-gray-600">(max {parseFloat(selected.dinero).toFixed(2)})</span></label>
                  <input type="number" min="0" step="0.50" max={selected.dinero} className="input" value={entregaForm.dinero}
                    onChange={e => setEntregaForm(f => ({...f, dinero: e.target.value}))} />
                </div>
              )}
            </div>
            <div>
              <label className="label">Fecha de entrega</label>
              <input type="date" className="input" value={entregaForm.fecha_entrega} onChange={e => setEntregaForm(f => ({...f, fecha_entrega: e.target.value}))} />
            </div>
            <div>
              <label className="label">Quién recogió (opcional)</label>
              <input className="input" placeholder="Nombre de quien recoge" value={entregaForm.quien_recoge} onChange={e => setEntregaForm(f => ({...f, quien_recoge: e.target.value}))} />
            </div>
            {/* Historial de entregas anteriores */}
            {(selected.historial_cambios || []).filter(h => h.tipo === 'entrega').length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2 font-medium">📋 Entregas anteriores:</p>
                <div className="space-y-1">
                  {(selected.historial_cambios || []).filter(h => h.tipo === 'entrega').map((h, i) => {
                    const items = []
                    if (h.vales_20 > 0) items.push(h.vales_20 + ' vale(s) S/20')
                    if (h.vales_43 > 0) items.push(h.vales_43 + ' vale(s) S/43')
                    if (h.balones > 0) items.push(h.balones + ' balón(es)')
                    if (h.dinero > 0) items.push('S/' + parseFloat(h.dinero).toFixed(2))
                    return (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-400">{h.fecha} {h.quien_recoge ? '— ' + h.quien_recoge : ''}</span>
                        <span className="text-emerald-400">{items.join(' + ')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={registrarEntrega} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg flex-1 justify-center flex items-center gap-2 transition-all">
                {saving ? 'Guardando...' : '✓ Confirmar entrega'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: cliente ya tiene registro pendiente */}
      {registroPendiente && modal === 'nuevo' && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-white font-bold">Ya tiene un registro pendiente</h3>
                <p className="text-gray-400 text-sm mt-1">
                  <span className="text-yellow-400 font-medium">{registroPendiente.nombre_cliente}</span> ya tiene el registro <span className="text-white font-mono">#{String(registroPendiente.numero).padStart(3,'0')}</span> pendiente con:
                </p>
                <p className="text-blue-300 font-semibold mt-2">{resumenItems(registroPendiente)}</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">¿Qué quieres hacer?</p>
            <div className="space-y-2">
              <button onClick={agregarAlPendiente} disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all">
                {saving ? 'Guardando...' : '➕ Añadir al registro existente'}
              </button>
              <button onClick={() => guardarRegistro(false, true)} disabled={saving}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-xl transition-all text-sm">
                📄 Crear registro nuevo de todas formas
              </button>
              <button onClick={() => setRegistroPendiente(null)}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-1">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial + Añadir depósito */}
      {modal === 'historialAC' && selected && (
        <Modal title={`Historial — ${selected.nombre_cliente}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {/* Saldo actual */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Saldo en custodia</p>
                <p className="text-blue-300 font-bold">{resumenItems(selected)}</p>
              </div>
              <div className={`rounded-lg p-3 border ${selected.estado === 'pendiente' ? 'bg-yellow-900/20 border-yellow-800/50' : 'bg-emerald-900/20 border-emerald-800/50'}`}>
                <p className="text-xs text-gray-500 mb-1">Estado</p>
                <p className={`font-bold text-sm ${selected.estado === 'pendiente' ? 'text-yellow-300' : 'text-emerald-300'}`}>
                  {selected.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Entregado'}
                </p>
              </div>
            </div>
            {/* Historial detallado */}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-2">📋 Historial detallado de movimientos:</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(selected.historial_cambios || []).length === 0 ? (
                  <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-800/30 rounded-lg p-3">
                    <span className="text-base">📥</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-semibold text-blue-300">Depósito inicial</p>
                          <p className="text-xs text-gray-500">{format(new Date(selected.fecha + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })}</p>
                        </div>
                        <p className="text-blue-300 font-bold text-sm">{resumenItems(selected)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  (selected.historial_cambios || []).map((h, i) => {
                    const items = []
                    if (h.vales_20 > 0) items.push(h.vales_20 + ' vale(s) S/20')
                    if (h.vales_43 > 0) items.push(h.vales_43 + ' vale(s) S/43')
                    if (h.balones > 0) items.push(h.balones + ' balón(es)')
                    if (parseFloat(h.dinero) > 0) items.push('S/' + parseFloat(h.dinero).toFixed(2))
                    const esEntrega = h.tipo === 'entrega'
                    const esDeposito = h.tipo === 'deposito'
                    if (!esEntrega && !esDeposito) return null

                    async function borrarEntrada() {
                      if (!confirm(`¿Eliminar esta entrada del historial?`)) return
                      const nuevoHistorial = (selected.historial_cambios || []).filter((_, idx) => idx !== i)
                      // Recalcular totales desde el historial restante
                      let v20 = 0, v43 = 0, bal = 0, din = 0
                      nuevoHistorial.forEach(x => {
                        if (x.tipo === 'deposito') { v20 += x.vales_20||0; v43 += x.vales_43||0; bal += x.balones||0; din += parseFloat(x.dinero)||0 }
                        if (x.tipo === 'entrega')  { v20 -= x.vales_20||0; v43 -= x.vales_43||0; bal -= x.balones||0; din -= parseFloat(x.dinero)||0 }
                      })
                      const { error: e } = await supabase.from('a_cuenta').update({
                        historial_cambios: nuevoHistorial,
                        vales_20: Math.max(0, v20), vales_43: Math.max(0, v43),
                        balones: Math.max(0, bal), dinero: Math.max(0, din),
                        updated_at: new Date().toISOString()
                      }).eq('id', selected.id)
                      if (e) { alert('Error: ' + e.message); return }
                      const { data } = await supabase.from('a_cuenta').select('*').eq('id', selected.id).single()
                      setSelected(data)
                      cargar()
                    }

                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg p-3 border ${esEntrega ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-blue-900/20 border-blue-800/30'}`}>
                        <span className="text-base">{esEntrega ? '📤' : '📥'}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className={`text-xs font-semibold ${esEntrega ? 'text-emerald-300' : 'text-blue-300'}`}>
                                {esEntrega ? 'Entregó' : (i === 0 ? 'Depósito inicial' : 'Depósito adicional')}
                              </p>
                              <p className="text-xs text-gray-400">
                                {h.fecha ? format(new Date(h.fecha + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es }) : '—'}
                                {h.quien_recoge ? ' · ' + h.quien_recoge : ''}
                              </p>
                              {h.notas && <p className="text-amber-400/80 text-xs mt-0.5 italic">📝 "{h.notas}"</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <p className={`text-sm font-bold ${esEntrega ? 'text-emerald-300' : 'text-blue-300'}`}>
                                {esEntrega ? '-' : '+'}{items.join(' + ')}
                              </p>
                              {perfil?.rol === 'admin' && (
                                <button onClick={borrarEntrada}
                                  className="text-xs bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 px-1.5 py-0.5 rounded transition-all"
                                  title="Borrar esta entrada">
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <button onClick={() => setModal(null)} className="btn-secondary w-full">Cerrar</button>
          </div>
        </Modal>
      )}

      {/* Ticket de impresión */}
      {modal === 'clienteRapido' && (
        <Modal title="Registrar cliente rápido" onClose={() => setModal('nuevo')}>
          <div className="space-y-4">
            <div><label className="label">Nombre *</label>
              <input className="input" value={clienteRapidoForm.nombre}
                onChange={e => setClienteRapidoForm(f => ({...f, nombre: e.target.value}))}
                placeholder="Nombre completo" autoFocus />
            </div>
            <div><label className="label">Teléfono (opcional)</label>
              <input className="input" value={clienteRapidoForm.telefono}
                onChange={e => setClienteRapidoForm(f => ({...f, telefono: e.target.value}))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal('nuevo')} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarClienteRapido} className="btn-primary flex-1 justify-center">✓ Registrar cliente</button>
            </div>
          </div>
        </Modal>
      )}
      {ticketData && <Ticket data={ticketData} onClose={() => setTicketData(null)} />}
      {/* Modal editar registro */}
      {modal === 'editAC' && selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold">✏️ Editar registro</h3>
                <p className="text-gray-500 text-xs mt-0.5">{selected.nombre_cliente} — #{String(selected.numero).padStart(3,'0')}</p>
                <p className="text-gray-600 text-xs">Registro original: {selected.fecha}</p>
                {selected.fecha_actualizacion && (
                  <p className="text-blue-500 text-xs">Última edición: {selected.fecha_actualizacion}</p>
                )}
              </div>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-center">
                  <p className="text-yellow-400 text-xs font-semibold mb-2">🎫 Vales S/20</p>
                  <input type="number" min="0" className="input text-center font-bold"
                    value={editForm.vales_20}
                    onChange={e => setEditFormAC(f => ({...f, vales_20: e.target.value}))} />
                </div>
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3 text-center">
                  <p className="text-orange-400 text-xs font-semibold mb-2">🎫 Vales S/43</p>
                  <input type="number" min="0" className="input text-center font-bold"
                    value={editForm.vales_43}
                    onChange={e => setEditFormAC(f => ({...f, vales_43: e.target.value}))} />
                </div>
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-center">
                  <p className="text-blue-400 text-xs font-semibold mb-2">🔵 Balones</p>
                  <input type="number" min="0" className="input text-center font-bold"
                    value={editForm.balones}
                    onChange={e => setEditFormAC(f => ({...f, balones: e.target.value}))} />
                </div>
                <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-3 text-center">
                  <p className="text-emerald-400 text-xs font-semibold mb-2">💵 Dinero (S/)</p>
                  <input type="number" min="0" step="0.50" className="input text-center font-bold"
                    value={editForm.dinero}
                    onChange={e => setEditFormAC(f => ({...f, dinero: e.target.value}))} />
                </div>
              </div>

              <div>
                <label className="label">Notas</label>
                <input className="input" placeholder="Observaciones..." value={editForm.notas}
                  onChange={e => setEditFormAC(f => ({...f, notas: e.target.value}))} />
              </div>

              {selected.historial_cambios?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">📋 Historial de cambios</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selected.historial_cambios.map((h, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="text-blue-400 font-medium">📅 {h.fecha_cambio}</span>
                          <span className="text-gray-500">orig: {h.fecha_original}</span>
                        </div>
                        <div className="text-gray-400 space-y-0.5">
                          {h.vales_20_antes !== h.vales_20_nuevo && <p>🎫 S/20: {h.vales_20_antes} → <span className="text-yellow-400">{h.vales_20_nuevo}</span></p>}
                          {h.vales_43_antes !== h.vales_43_nuevo && <p>🎫 S/43: {h.vales_43_antes} → <span className="text-orange-400">{h.vales_43_nuevo}</span></p>}
                          {h.balones_antes !== h.balones_nuevo && <p>🔵 Balones: {h.balones_antes} → <span className="text-blue-400">{h.balones_nuevo}</span></p>}
                          {h.dinero_antes !== h.dinero_nuevo && <p>💵 Dinero: S/{h.dinero_antes} → <span className="text-emerald-400">S/{h.dinero_nuevo}</span></p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={guardarEdicionAC} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Guardando...' : '✓ Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}