import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPeru } from '../lib/fechas'
import { Users, X, AlertCircle, Search, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
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

function resumenDeuda(d) {
  const items = []
  if (parseFloat(d.monto_pendiente) > 0) items.push(`S/ ${Number(d.monto_pendiente).toLocaleString('es-PE')}`)
  if (parseInt(d.balones_pendiente) > 0) items.push(`${d.balones_pendiente} balón(es)`)
  if (parseInt(d.vales_20_pendiente) > 0) items.push(`${d.vales_20_pendiente} vale(s) S/20`)
  if (parseInt(d.vales_43_pendiente) > 0) items.push(`${d.vales_43_pendiente} vale(s) S/43`)
  return items.join(' + ') || 'Sin deuda'
}

const emptyDeudaForm = {
  nombre_deudor: '', cliente_id: '',
  monto: '', balones: '', tipo_balon: '10kg', vales_20: '', vales_43: '',
  precio_balon: '',
  fecha: hoyPeru(), notas: ''
}

const emptyPagoForm = {
  monto: '', balones: '', vales_20: '', vales_43: '',
  metodo_pago: 'efectivo', fecha: hoyPeru(), notas: ''
}

export default function Deudas() {
  const { perfil } = useAuth()
  const [deudas, setDeudas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activas')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [deudaForm, setDeudaForm] = useState(emptyDeudaForm)
  const [pagoForm, setPagoForm] = useState(emptyPagoForm)
  const [deudaPendiente, setDeudaPendiente] = useState(null)
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [editForm, setEditForm] = useState({ monto_pendiente: '', balones_pendiente: '', vales_20_pendiente: '', vales_43_pendiente: '', fecha_deuda: '', notas: '' })
  const [historialCompleto, setHistorialCompleto] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  useEffect(() => {
    cargar(); cargarClientes()
    const canal = supabase.channel('deudas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deudas' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [filtroEstado])

  async function cargar() {
    setLoading(true)
    let query = supabase.from('deudas').select('*').order('fecha_deuda', { ascending: false })
    if (filtroEstado === 'activas') query = query.in('estado', ['activa', 'pagada_parcial'])
    else if (filtroEstado === 'liquidadas') query = query.eq('estado', 'liquidada')
    const { data } = await query
    setDeudas(data || [])
    setLoading(false)
  }

  async function cargarHistorialCompleto(nombreDeudor) {
    setLoadingHistorial(true)
    // Buscar todas las deudas del cliente (por nombre)
    const { data } = await supabase.from('deudas')
      .select('*')
      .ilike('nombre_deudor', nombreDeudor)
      .order('fecha_deuda', { ascending: false })
    
    // Combinar todos los movimientos de todas las deudas
    const todosMovimientos = []
    ;(data || []).forEach(deuda => {
      const movimientos = deuda.historial || []
      movimientos.forEach(m => {
        todosMovimientos.push({
          ...m,
          deuda_id: deuda.id,
          deuda_estado: deuda.estado,
          deuda_fecha: deuda.fecha_deuda
        })
      })
    })
    
    // Ordenar por fecha descendente
    todosMovimientos.sort((a, b) => {
      const fa = new Date(a.fecha || a.deuda_fecha || '2000-01-01')
      const fb = new Date(b.fecha || b.deuda_fecha || '2000-01-01')
      return fb - fa
    })
    
    setHistorialCompleto({ deudas: data || [], movimientos: todosMovimientos })
    setLoadingHistorial(false)
  }

  async function cargarClientes() {
    const { data: cData } = await supabase.from('clientes').select('id, nombre').eq('es_varios', false).order('nombre')
    // Also include existing deudors as suggestions
    const { data: dData } = await supabase.from('deudas').select('nombre_deudor').in('estado', ['activa','pagada_parcial'])
    const deudorNames = (dData || []).map(d => ({ id: 'deudor_' + d.nombre_deudor, nombre: d.nombre_deudor }))
    const clienteNames = cData || []
    // Merge, deduplicate by name
    const allNames = [...clienteNames]
    deudorNames.forEach(d => {
      if (!allNames.find(c => c.nombre.toLowerCase() === d.nombre.toLowerCase())) {
        allNames.push(d)
      }
    })
    setClientes(allNames)
  }

  async function guardarDeuda(forzarNuevo = false) {
    if (!deudaForm.nombre_deudor.trim()) { setError('Ingresa el nombre del deudor'); return }
    const monto = parseFloat(deudaForm.monto) || 0
    const balones = parseInt(deudaForm.balones) || 0
    const vales20 = parseInt(deudaForm.vales_20) || 0
    const vales43 = parseInt(deudaForm.vales_43) || 0
    if (monto === 0 && balones === 0 && vales20 === 0 && vales43 === 0) {
      setError('Ingresa al menos un tipo de deuda'); return
    }
    if (!forzarNuevo) {
      const { data: activas } = await supabase.from('deudas')
        .select('*').in('estado', ['activa', 'pagada_parcial'])
      const encontrada = (activas || []).find(d =>
        d.nombre_deudor.trim().toLowerCase() === deudaForm.nombre_deudor.trim().toLowerCase()
      )
      if (encontrada) { setDeudaPendiente(encontrada); return }
    }
    setSaving(true); setError('')
    const tipoBalonDeuda = deudaForm.tipo_balon || '10kg'
    const entradaHistorial = { tipo: 'deuda', fecha: deudaForm.fecha, monto, balones, tipo_balon: balones > 0 ? tipoBalonDeuda : null, vales_20: vales20, vales_43: vales43, notas: deudaForm.notas || null }

    // Buscar almacén del usuario o tienda principal
    let almacenId = null
    if (balones > 0) {
      const { data: alms } = await supabase.from('almacenes').select('id, nombre, stock_actual').eq('activo', true)
      const almPerfil = perfil?.almacen_id ? alms?.find(a => a.id === perfil.almacen_id) : null
      const tienda = almPerfil || alms?.find(a => a.nombre?.toLowerCase().includes('tienda')) || alms?.[0]
      if (tienda) {
        almacenId = tienda.id
        // Descontar llenos
        await supabase.from('almacenes').update({
          stock_actual: Math.max(0, (tienda.stock_actual || 0) - balones),
          updated_at: new Date().toISOString()
        }).eq('id', tienda.id)
        // Descontar stock_por_tipo
        const { data: spt } = await supabase.from('stock_por_tipo')
          .select('stock_actual').eq('almacen_id', tienda.id).eq('tipo_balon', tipoBalonDeuda).single()
        if (spt) {
          await supabase.from('stock_por_tipo')
            .update({ stock_actual: Math.max(0, spt.stock_actual - balones) })
            .eq('almacen_id', tienda.id).eq('tipo_balon', tipoBalonDeuda)
        }
      }
    }

    const { error: e } = await supabase.from('deudas').insert({
      cliente_id: deudaForm.cliente_id || null,
      nombre_deudor: deudaForm.nombre_deudor.trim(),
      tipo_deuda: 'mixto',
      monto_original: monto, monto_pendiente: monto,
      cantidad_original: balones, cantidad_pendiente: balones,
      balones_pendiente: balones, vales_20_pendiente: vales20, vales_43_pendiente: vales43,
      fecha_deuda: deudaForm.fecha, estado: 'activa', notas: deudaForm.notas,
      historial: [entradaHistorial], usuario_id: perfil?.id || null,
      almacen_id: almacenId
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setDeudaPendiente(null); setModal(null); setDeudaForm(emptyDeudaForm); cargar()
  }

  async function agregarAlaPendiente() {
    if (!deudaPendiente) return
    const monto = parseFloat(deudaForm.monto) || 0
    const balones = parseInt(deudaForm.balones) || 0
    const vales20 = parseInt(deudaForm.vales_20) || 0
    const vales43 = parseInt(deudaForm.vales_43) || 0
    setSaving(true); setError('')
    const tipoBalonAdd = deudaForm.tipo_balon || '10kg'
    const entradaHistorial = { tipo: 'deuda', fecha: deudaForm.fecha, monto, balones, tipo_balon: balones > 0 ? tipoBalonAdd : null, vales_20: vales20, vales_43: vales43, notas: deudaForm.notas || null }
    const historialAnterior = deudaPendiente.historial || []

    // Descontar llenos si agrega balones
    if (balones > 0) {
      const almacenId = deudaPendiente.almacen_id || perfil?.almacen_id
      const { data: alms } = await supabase.from('almacenes').select('id, nombre, stock_actual').eq('activo', true)
      const almPerfil = almacenId ? alms?.find(a => a.id === almacenId) : null
      const tienda = almPerfil || alms?.find(a => a.nombre?.toLowerCase().includes('tienda')) || alms?.[0]
      if (tienda) {
        await supabase.from('almacenes').update({
          stock_actual: Math.max(0, (tienda.stock_actual || 0) - balones),
          updated_at: new Date().toISOString()
        }).eq('id', tienda.id)
        const { data: spt } = await supabase.from('stock_por_tipo')
          .select('stock_actual').eq('almacen_id', tienda.id).eq('tipo_balon', tipoBalonAdd).single()
        if (spt) {
          await supabase.from('stock_por_tipo')
            .update({ stock_actual: Math.max(0, spt.stock_actual - balones) })
            .eq('almacen_id', tienda.id).eq('tipo_balon', tipoBalonAdd)
        }
      }
    }
    const { error: e } = await supabase.from('deudas').update({
      monto_pendiente: (parseFloat(deudaPendiente.monto_pendiente) || 0) + monto,
      monto_original: (parseFloat(deudaPendiente.monto_original) || 0) + monto,
      balones_pendiente: (parseInt(deudaPendiente.balones_pendiente) || 0) + balones,
      vales_20_pendiente: (parseInt(deudaPendiente.vales_20_pendiente) || 0) + vales20,
      vales_43_pendiente: (parseInt(deudaPendiente.vales_43_pendiente) || 0) + vales43,
      estado: 'activa', historial: [...historialAnterior, entradaHistorial],
      fecha_deuda: deudaForm.fecha,
      updated_at: new Date().toISOString()
    }).eq('id', deudaPendiente.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setDeudaPendiente(null); setModal(null); setDeudaForm(emptyDeudaForm); cargar()
  }

  async function registrarPago() {
    if (!selected) return
    const monto = parseFloat(pagoForm.monto) || 0
    const balones = parseInt(pagoForm.balones) || 0
    const vales20 = parseInt(pagoForm.vales_20) || 0
    const vales43 = parseInt(pagoForm.vales_43) || 0
    if (monto === 0 && balones === 0 && vales20 === 0 && vales43 === 0) { setError('Ingresa al menos un pago'); return }
    const montoPendiente = parseFloat(selected.monto_pendiente) || 0
    const vales20Pendiente = parseInt(selected.vales_20_pendiente) || 0
    const vales43Pendiente = parseInt(selected.vales_43_pendiente) || 0
    // Validar: si la deuda es en dinero, el pago en dinero+vales no debe superar el monto
    const totalValesEnDinero = (vales20 * 20) + (vales43 * 43)
    const totalPago = monto + (montoPendiente > 0 ? totalValesEnDinero : 0)
    if (montoPendiente > 0 && totalPago > montoPendiente) { setError(`El total (S/${totalPago}) supera la deuda (S/${montoPendiente})`); return }
    // Validar vales en especie
    if (vales20Pendiente > 0 && vales20 > vales20Pendiente) { setError(`Máximo ${vales20Pendiente} vales S/20`); return }
    if (vales43Pendiente > 0 && vales43 > vales43Pendiente) { setError(`Máximo ${vales43Pendiente} vales S/43`); return }
    if (balones > (parseInt(selected.balones_pendiente) || 0)) { setError(`Máximo ${selected.balones_pendiente} balones`); return }
    setSaving(true); setError('')
    const nuevoMonto = Math.max(0, montoPendiente - totalPago)
    const nuevoBal = Math.max(0, (parseInt(selected.balones_pendiente) || 0) - balones)
    const nuevoV20 = Math.max(0, vales20Pendiente - vales20)
    const nuevoV43 = Math.max(0, vales43Pendiente - vales43)
    const liquidada = nuevoMonto === 0 && nuevoBal === 0 && nuevoV20 === 0 && nuevoV43 === 0
    const metodo = vales20 > 0 || vales43 > 0 ? (monto > 0 ? 'mixto' : 'vale') : pagoForm.metodo_pago
    const entradaHistorial = { tipo: 'pago', fecha: pagoForm.fecha, monto: totalPago, balones, vales_20: vales20, vales_43: vales43, metodo_pago: metodo, notas: pagoForm.notas || null }
    const historialAnterior = selected.historial || []
    const { error: e } = await supabase.from('deudas').update({
      monto_pendiente: nuevoMonto, balones_pendiente: nuevoBal,
      vales_20_pendiente: nuevoV20, vales_43_pendiente: nuevoV43,
      cantidad_pendiente: nuevoBal,
      estado: liquidada ? 'liquidada' : 'pagada_parcial',
      historial: [...historialAnterior, entradaHistorial],
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    if (e) { setSaving(false); setError(e.message); return }

    // Si pagó con balones vacíos → sumarlos al almacén del usuario o al principal
    if (balones > 0) {
      const { data: almacenes } = await supabase.from('almacenes')
        .select('id, balones_vacios, vacios_10kg, nombre').eq('activo', true)
      // Usar almacén del perfil si tiene, sino buscar tienda
      const almacenPerfil = perfil?.almacen_id ? almacenes?.find(a => a.id === perfil.almacen_id) : null
      const tienda = almacenPerfil || almacenes?.find(a => a.nombre?.toLowerCase().includes('tienda')) || almacenes?.[0]
      if (tienda) {
        await supabase.from('almacenes').update({
          balones_vacios: (tienda.balones_vacios || 0) + balones,
          vacios_10kg: (tienda.vacios_10kg || 0) + balones,
          updated_at: new Date().toISOString()
        }).eq('id', tienda.id)
      }
    }

    setSaving(false)
    setModal(null); cargar()
  }

  async function editarDeuda() {
    if (!selected) return
    setSaving(true); setError('')
    const { error: e } = await supabase.from('deudas').update({
      monto_pendiente: parseFloat(editForm.monto_pendiente) || 0,
      monto_original: parseFloat(editForm.monto_pendiente) || 0,
      balones_pendiente: parseInt(editForm.balones_pendiente) || 0,
      cantidad_pendiente: parseInt(editForm.balones_pendiente) || 0,
      vales_20_pendiente: parseInt(editForm.vales_20_pendiente) || 0,
      vales_43_pendiente: parseInt(editForm.vales_43_pendiente) || 0,
      fecha_deuda: editForm.fecha_deuda,
      notas: editForm.notas,
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function eliminarDeuda(id) {
    if (!confirm('¿Eliminar esta deuda?')) return
    await supabase.from('pagos_deuda').delete().eq('deuda_id', id)
    await supabase.from('deudas').delete().eq('id', id)
    cargar()
  }

  const deudasFiltradas = deudas.filter(d => {
    const matchBusqueda = !busqueda || d.nombre_deudor?.toLowerCase().includes(busqueda.toLowerCase())
    const matchDesde = !filtroFechaDesde || d.fecha_deuda >= filtroFechaDesde
    const matchHasta = !filtroFechaHasta || d.fecha_deuda <= filtroFechaHasta
    return matchBusqueda && matchDesde && matchHasta
  })
  const totalDinero = deudas.filter(d => d.estado !== 'liquidada').reduce((a, d) => a + (parseFloat(d.monto_pendiente) || 0), 0)
  const totalBalones = deudas.filter(d => d.estado !== 'liquidada').reduce((a, d) => a + (parseInt(d.balones_pendiente) || 0), 0)
  const totalVales20 = deudas.filter(d => d.estado !== 'liquidada').reduce((a, d) => a + (parseInt(d.vales_20_pendiente) || 0), 0)
  const totalVales43 = deudas.filter(d => d.estado !== 'liquidada').reduce((a, d) => a + (parseInt(d.vales_43_pendiente) || 0), 0)
  const totalDeudores = new Set(deudas.filter(d => d.estado !== 'liquidada').map(d => d.nombre_deudor)).size

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Deudas</h2>
          <p className="text-gray-500 text-sm">Control de deudas en dinero, balones y vales</p>
        </div>
        <button onClick={() => { setDeudaForm(emptyDeudaForm); setDeudaPendiente(null); setSelected(null); setError(''); cargarClientes(); setModal('deuda') }} className="btn-primary">
          + Registrar deuda
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input className="input pl-9" placeholder="Buscar deudor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {totalDinero > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-red-400 text-xl font-bold">S/ {totalDinero.toLocaleString('es-PE')}</p>
            <p className="text-gray-500 text-xs mt-1">Deudas en dinero</p>
          </div>
        )}
        {totalBalones > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-orange-400 text-xl font-bold">{totalBalones} bal.</p>
            <p className="text-gray-500 text-xs mt-1">Balones prestados</p>
          </div>
        )}
        {totalVales20 > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-yellow-400 text-xl font-bold">{totalVales20} vales</p>
            <p className="text-gray-500 text-xs mt-1">Vales S/20</p>
          </div>
        )}
        {totalVales43 > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-yellow-400 text-xl font-bold">{totalVales43} vales</p>
            <p className="text-gray-500 text-xs mt-1">Vales S/43</p>
          </div>
        )}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-white text-xl font-bold">{totalDeudores}</p>
          <p className="text-gray-500 text-xs mt-1">Deudores activos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {[['activas','🔴 Con deuda'],['liquidadas','✅ Sin deuda'],['todas','Todas']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltroEstado(val)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filtroEstado === val ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            {label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
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
      </div>

      {/* Lista */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-white font-semibold text-sm">
            {filtroEstado === 'activas' ? 'Deudas activas' : filtroEstado === 'liquidadas' ? 'Liquidadas' : 'Todas'}
          </h3>
          <span className="text-xs bg-red-600/20 text-red-400 border border-red-600/30 px-2 py-0.5 rounded-full">{deudasFiltradas.length} registros</span>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Cargando...</div>
        ) : deudasFiltradas.length === 0 ? (
          <div className="text-center py-8 text-gray-600 flex flex-col items-center gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">Sin deudas registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {deudasFiltradas.map(d => {
              const dias = differenceInDays(new Date(), new Date(d.fecha_deuda))
              return (
                <div key={d.id} className="px-4 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">👤</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white font-semibold text-sm">{d.nombre_deudor}</p>
                        <p className="text-red-300 font-bold text-sm flex-shrink-0 text-right">{resumenDeuda(d)}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={d.estado === 'liquidada' ? 'badge-green' : d.estado === 'pagada_parcial' ? 'badge-yellow' : 'badge-red'}>
                          {d.estado === 'liquidada' ? '✅ Liquidada' : d.estado === 'pagada_parcial' ? 'Parcial' : 'Activa'}
                        </span>
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(d.fecha_deuda + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })} ({dias} días)
                        </span>
                      </div>
                      {d.notas && <p className="text-amber-400/80 text-xs mt-1 italic">📝 "{d.notas}"</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => { setSelected(d); setError(''); cargarHistorialCompleto(d.nombre_deudor); setModal('historial') }}
                          className="text-xs bg-blue-600/20 border border-blue-600/30 text-blue-400 px-2 py-1 rounded-lg">📋 Historial</button>
                        {d.estado !== 'liquidada' && (
                          <button onClick={() => { setSelected(d); setPagoForm(emptyPagoForm); setError(''); setModal('pago') }}
                            className="text-xs bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 px-2 py-1 rounded-lg">✓ Registrar pago</button>
                        )}
                        <button onClick={() => { setSelected(d); setEditForm({ monto_pendiente: d.monto_pendiente || '', balones_pendiente: d.balones_pendiente || '', vales_20_pendiente: d.vales_20_pendiente || '', vales_43_pendiente: d.vales_43_pendiente || '', fecha_deuda: d.fecha_deuda, notas: d.notas || '' }); setError(''); setModal('editar') }}
                          className="text-xs bg-gray-600/20 border border-gray-600/30 text-gray-300 px-2 py-1 rounded-lg">✏️ Editar</button>
                        {perfil?.rol === 'admin' && (
                          <button onClick={() => eliminarDeuda(d.id)}
                            className="text-xs bg-red-600/20 border border-red-600/30 text-red-400 px-2 py-1 rounded-lg">🗑️ Borrar</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Aviso cliente con deuda activa */}
      {deudaPendiente && modal === 'deuda' && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-white font-bold">Ya tiene deuda activa</h3>
                <p className="text-gray-400 text-sm mt-1"><span className="text-yellow-400 font-medium">{deudaPendiente.nombre_deudor}</span> ya debe:</p>
                <p className="text-red-300 font-bold mt-2">{resumenDeuda(deudaPendiente)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={agregarAlaPendiente} disabled={saving}
                className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl transition-all">
                {saving ? 'Guardando...' : '➕ Añadir a la deuda existente'}
              </button>
              <button onClick={() => guardarDeuda(true)} disabled={saving}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-xl transition-all text-sm">
                📄 Crear registro separado
              </button>
              <button onClick={() => setDeudaPendiente(null)} className="w-full text-gray-500 hover:text-gray-300 text-sm py-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar/añadir deuda */}
      {modal === 'deuda' && !deudaPendiente && (
        <Modal title={deudaPendiente ? `Añadir deuda — ${deudaPendiente.nombre_deudor}` : 'Registrar deuda'} onClose={() => { setModal(null); setDeudaPendiente(null); setSelected(null) }}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {!deudaPendiente && (
              <div>
                <label className="label">Nombre del deudor *</label>
                <div className="relative">
                  <input className="input" value={deudaForm.nombre_deudor}
                    onChange={e => {
                      const val = e.target.value
                      setDeudaForm(f => ({...f, nombre_deudor: val, cliente_id: ''}))
                      const filtrados = clientes.filter(c => c.nombre.toLowerCase().includes(val.toLowerCase()))
                      setSugerencias(filtrados)
                      setMostrarSugerencias(val.length > 0 && filtrados.length > 0)
                    }}
                    onBlur={() => setTimeout(() => setMostrarSugerencias(false), 300)}
                    onFocus={() => {
                      if (deudaForm.nombre_deudor.length > 0) {
                        const filtrados = clientes.filter(c => c.nombre.toLowerCase().includes(deudaForm.nombre_deudor.toLowerCase()))
                        setSugerencias(filtrados); setMostrarSugerencias(filtrados.length > 0)
                      }
                    }}
                    placeholder="Nombre completo" autoComplete="off" />
                  {deudaForm.nombre_deudor.length >= 2 && clientes.find(c => c.nombre.toLowerCase() === deudaForm.nombre_deudor.toLowerCase()) && (
                    <p className="text-xs text-emerald-400 mt-1 px-1">✅ Cliente registrado</p>
                  )}
                  {deudaForm.nombre_deudor.length >= 2 && !clientes.find(c => c.nombre.toLowerCase() === deudaForm.nombre_deudor.toLowerCase()) && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {clientes.filter(c => c.nombre.toLowerCase().includes(deudaForm.nombre_deudor.toLowerCase())).map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => { setDeudaForm(f => ({...f, nombre_deudor: c.nombre, cliente_id: c.id})); setMostrarSugerencias(false) }}
                          onTouchEnd={e => { e.preventDefault(); setDeudaForm(f => ({...f, nombre_deudor: c.nombre, cliente_id: c.id})); setMostrarSugerencias(false) }}
                          className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0">
                          👤 {c.nombre}
                        </button>
                      ))}
                      <div className="px-3 py-2 flex items-center justify-between border-t border-gray-700/50">
                        <span className="text-xs text-gray-500">
                          {clientes.filter(c => c.nombre.toLowerCase().includes(deudaForm.nombre_deudor.toLowerCase())).length === 0 ? 'No encontrado' : 'o crear nuevo'}
                        </span>
                        <button type="button"
                          onMouseDown={() => { setMostrarSugerencias(false); setModal('clienteRapidoDeuda') }}
                          onTouchEnd={e => { e.preventDefault(); setMostrarSugerencias(false); setModal('clienteRapidoDeuda') }}
                          className="text-xs bg-blue-600/30 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-lg">
                          + Registrar cliente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500">¿Qué debe? (puede ser varios tipos a la vez):</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">💰 Dinero S/</label>
                <input type="number" min="0" step="0.50" className="input" placeholder="0.00"
                  value={deudaForm.monto} onChange={e => setDeudaForm(f => ({...f, monto: e.target.value}))} /></div>
              <div><label className="label">🔵 Balones</label>
                <input type="number" min="0" className="input" placeholder="0"
                  value={deudaForm.balones} onChange={e => setDeudaForm(f => ({...f, balones: e.target.value}))} />
                {parseInt(deudaForm.balones) > 0 && (
                  <div className="flex gap-1 mt-1">
                    {['5kg','10kg','45kg'].map(t => (
                      <button key={t} type="button" onClick={() => setDeudaForm(f => ({...f, tipo_balon: t}))}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-all ${deudaForm.tipo_balon === t ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><label className="label">🎫 Vales S/20</label>
                <input type="number" min="0" className="input" placeholder="0"
                  value={deudaForm.vales_20} onChange={e => setDeudaForm(f => ({...f, vales_20: e.target.value}))} /></div>
              <div><label className="label">🎫 Vales S/43</label>
                <input type="number" min="0" className="input" placeholder="0"
                  value={deudaForm.vales_43} onChange={e => setDeudaForm(f => ({...f, vales_43: e.target.value}))} /></div>
            </div>

            {/* Precio por balón — solo si hay balones */}
            {parseInt(deudaForm.balones) > 0 && (
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 space-y-2">
                <p className="text-xs text-blue-300 font-medium">💡 ¿El cliente debe pagar los balones también?</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="label">Precio por balón S/</label>
                    <input type="number" min="0" step="0.50" className="input" placeholder="45"
                      value={deudaForm.precio_balon || ''}
                      onChange={e => {
                        const precio = parseFloat(e.target.value) || 0
                        const cant = parseInt(deudaForm.balones) || 0
                        setDeudaForm(f => ({
                          ...f,
                          precio_balon: e.target.value,
                          monto: precio > 0 ? (precio * cant).toFixed(2) : f.monto
                        }))
                      }} />
                  </div>
                  {parseFloat(deudaForm.precio_balon) > 0 && parseInt(deudaForm.balones) > 0 && (
                    <div className="flex-1 bg-gray-800 rounded-xl p-3 text-center mt-5">
                      <p className="text-xs text-gray-500">Total balones</p>
                      <p className="text-emerald-400 font-bold text-lg">
                        S/ {(parseFloat(deudaForm.precio_balon) * parseInt(deudaForm.balones)).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-600">→ sumado al dinero</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600">Deja en blanco si solo debe los balones físicos sin monto</p>
              </div>
            )}
            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={deudaForm.fecha} onChange={e => setDeudaForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div><label className="label">Notas (opcional)</label>
              <textarea className="input" rows={2} value={deudaForm.notas} onChange={e => setDeudaForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModal(null); setDeudaPendiente(null); setSelected(null) }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => deudaPendiente ? agregarAlaPendiente() : guardarDeuda()} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Registrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal pago */}
      {modal === 'pago' && selected && (
        <Modal title={`Registrar pago — ${selected.nombre_deudor}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Deuda pendiente:</p>
              <p className="text-red-300 font-bold">{resumenDeuda(selected)}</p>
            </div>
            <p className="text-xs text-gray-500">¿Cuánto paga ahora? (puede ser parcial):</p>
            <div className="grid grid-cols-2 gap-3">
              {parseFloat(selected.monto_pendiente) > 0 && (
                <div><label className="label">💰 Efectivo S/ <span className="text-gray-600 text-xs">(max {Number(selected.monto_pendiente).toLocaleString()})</span></label>
                  <input type="number" min="0" step="0.50" className="input" placeholder="0"
                    value={pagoForm.monto} onChange={e => setPagoForm(f => ({...f, monto: e.target.value}))} /></div>
              )}
              {parseInt(selected.balones_pendiente) > 0 && (
                <div><label className="label">🔵 Balones <span className="text-gray-600 text-xs">(max {selected.balones_pendiente})</span></label>
                  <input type="number" min="0" className="input" placeholder="0"
                    value={pagoForm.balones} onChange={e => setPagoForm(f => ({...f, balones: e.target.value}))} /></div>
              )}
              {(parseFloat(selected.monto_pendiente) > 0 || parseInt(selected.vales_20_pendiente) > 0) && (
                <div>
                  <label className="label">🎫 Vales S/20
                    {parseInt(selected.vales_20_pendiente) > 0 && <span className="text-orange-400 text-xs ml-1">(debe {selected.vales_20_pendiente})</span>}
                  </label>
                  <input type="number" min="0" className="input" placeholder="0"
                    value={pagoForm.vales_20} onChange={e => setPagoForm(f => ({...f, vales_20: e.target.value}))} />
                </div>
              )}
              {(parseFloat(selected.monto_pendiente) > 0 || parseInt(selected.vales_43_pendiente) > 0) && (
                <div>
                  <label className="label">🎫 Vales S/43
                    {parseInt(selected.vales_43_pendiente) > 0 && <span className="text-orange-400 text-xs ml-1">(debe {selected.vales_43_pendiente})</span>}
                  </label>
                  <input type="number" min="0" className="input" placeholder="0"
                    value={pagoForm.vales_43} onChange={e => setPagoForm(f => ({...f, vales_43: e.target.value}))} />
                </div>
              )}
            </div>
            {/* Preview del pago */}
            {((parseFloat(pagoForm.monto)||0) + (parseInt(pagoForm.vales_20)||0) + (parseInt(pagoForm.vales_43)||0) + (parseInt(pagoForm.balones)||0)) > 0 && (
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3 text-sm space-y-1">
                {(parseFloat(pagoForm.monto)||0) > 0 && <div className="flex justify-between"><span className="text-gray-400">💵 Efectivo:</span><span className="text-white">S/ {(parseFloat(pagoForm.monto)||0).toLocaleString()}</span></div>}
                {(parseInt(pagoForm.vales_20)||0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">🎫 {pagoForm.vales_20} vale(s) S/20:</span>
                    <span className="text-white">{parseInt(selected.vales_20_pendiente) > 0 ? `${pagoForm.vales_20} de ${selected.vales_20_pendiente} vales` : `S/ ${((parseInt(pagoForm.vales_20)||0)*20).toLocaleString()}`}</span>
                  </div>
                )}
                {(parseInt(pagoForm.vales_43)||0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">🎫 {pagoForm.vales_43} vale(s) S/43:</span>
                    <span className="text-white">{parseInt(selected.vales_43_pendiente) > 0 ? `${pagoForm.vales_43} de ${selected.vales_43_pendiente} vales` : `S/ ${((parseInt(pagoForm.vales_43)||0)*43).toLocaleString()}`}</span>
                  </div>
                )}
                {(parseInt(pagoForm.balones)||0) > 0 && <div className="flex justify-between"><span className="text-gray-400">🔵 Balones:</span><span className="text-white">{pagoForm.balones}</span></div>}
                {/* Saldo restante según tipo de deuda */}
                {parseFloat(selected.monto_pendiente) > 0 && (
                  <div className="flex justify-between border-t border-gray-700 pt-1">
                    <span className="text-gray-400">Saldo dinero restante:</span>
                    <span className="text-yellow-400 font-bold">S/ {Math.max(0, (parseFloat(selected.monto_pendiente)||0) - (parseFloat(pagoForm.monto)||0) - (parseInt(pagoForm.vales_20)||0)*20 - (parseInt(pagoForm.vales_43)||0)*43).toLocaleString()}</span>
                  </div>
                )}
                {parseInt(selected.vales_20_pendiente) > 0 && (
                  <div className="flex justify-between border-t border-gray-700 pt-1">
                    <span className="text-gray-400">Vales S/20 restantes:</span>
                    <span className="text-yellow-400 font-bold">{Math.max(0, (parseInt(selected.vales_20_pendiente)||0) - (parseInt(pagoForm.vales_20)||0))} vales</span>
                  </div>
                )}
                {parseInt(selected.vales_43_pendiente) > 0 && (
                  <div className="flex justify-between border-t border-gray-700 pt-1">
                    <span className="text-gray-400">Vales S/43 restantes:</span>
                    <span className="text-yellow-400 font-bold">{Math.max(0, (parseInt(selected.vales_43_pendiente)||0) - (parseInt(pagoForm.vales_43)||0))} vales</span>
                  </div>
                )}
              </div>
            )}
            {parseFloat(selected.monto_pendiente) > 0 && (
              <div>
                <label className="label">Método de pago (efectivo)</label>
                <div className="grid grid-cols-3 gap-2">
                  {['efectivo','yape','mixto'].map(m => (
                    <button key={m} onClick={() => setPagoForm(f => ({...f, metodo_pago: m}))}
                      className={`py-2 rounded-lg border text-xs font-medium capitalize transition-all ${pagoForm.metodo_pago === m ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                      {m === 'mixto' ? 'Mixto' : m}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div><label className="label">Fecha del pago</label>
              <input type="date" className="input" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({...f, fecha: e.target.value}))} /></div>
            <div><label className="label">Notas (opcional)</label>
              <input className="input" value={pagoForm.notas} onChange={e => setPagoForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={registrarPago} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg flex-1 justify-center flex items-center gap-2 transition-all">
                {saving ? 'Guardando...' : '✓ Registrar pago'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal editar deuda */}
      {modal === 'editar' && selected && (
        <Modal title={`Editar deuda — ${selected.nombre_deudor}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <p className="text-xs text-gray-500">Corrige los valores pendientes actuales:</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">💰 Dinero S/</label>
                <input type="number" min="0" step="0.50" className="input"
                  value={editForm.monto_pendiente} onChange={e => setEditForm(f => ({...f, monto_pendiente: e.target.value}))} /></div>
              <div><label className="label">🔵 Balones</label>
                <input type="number" min="0" className="input"
                  value={editForm.balones_pendiente} onChange={e => setEditForm(f => ({...f, balones_pendiente: e.target.value}))} /></div>
              <div><label className="label">🎫 Vales S/20</label>
                <input type="number" min="0" className="input"
                  value={editForm.vales_20_pendiente} onChange={e => setEditForm(f => ({...f, vales_20_pendiente: e.target.value}))} /></div>
              <div><label className="label">🎫 Vales S/43</label>
                <input type="number" min="0" className="input"
                  value={editForm.vales_43_pendiente} onChange={e => setEditForm(f => ({...f, vales_43_pendiente: e.target.value}))} /></div>
            </div>
            <div><label className="label">Fecha</label>
              <input type="date" className="input" value={editForm.fecha_deuda}
                onChange={e => setEditForm(f => ({...f, fecha_deuda: e.target.value}))} /></div>
            <div><label className="label">Notas</label>
              <textarea className="input" rows={2} value={editForm.notas}
                onChange={e => setEditForm(f => ({...f, notas: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={editarDeuda} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Guardando...' : '✓ Guardar cambios'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal historial completo */}
      {modal === 'historial' && selected && (
        <Modal title={`📋 Historial completo — ${selected.nombre_deudor}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">

            {/* Estado actual */}
            <div className={`rounded-xl p-4 border ${selected.estado === 'liquidada' ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-red-900/20 border-red-800/40'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Estado actual de la deuda</p>
                  <span className={`text-sm font-bold ${selected.estado === 'liquidada' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {selected.estado === 'liquidada' ? '✅ Liquidada' : selected.estado === 'pagada_parcial' ? '⚠️ Pagada parcialmente' : '🔴 Activa'}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {parseFloat(selected.monto_pendiente) > 0 && <span className="text-sm bg-red-900/40 text-red-300 px-3 py-1 rounded-lg font-bold">💰 S/ {Number(selected.monto_pendiente).toLocaleString('es-PE')}</span>}
                  {parseInt(selected.balones_pendiente) > 0 && <span className="text-sm bg-orange-900/40 text-orange-300 px-3 py-1 rounded-lg font-bold">🔵 {selected.balones_pendiente} bal.</span>}
                  {parseInt(selected.vales_20_pendiente) > 0 && <span className="text-sm bg-yellow-900/40 text-yellow-300 px-3 py-1 rounded-lg font-bold">🎫 {selected.vales_20_pendiente}×S/20</span>}
                  {parseInt(selected.vales_43_pendiente) > 0 && <span className="text-sm bg-yellow-900/40 text-yellow-300 px-3 py-1 rounded-lg font-bold">🎫 {selected.vales_43_pendiente}×S/43</span>}
                  {selected.estado === 'liquidada' && <span className="text-emerald-400 font-bold">Sin deuda pendiente</span>}
                </div>
              </div>
            </div>

            {/* Resumen estadístico */}
            {historialCompleto?.deudas && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{historialCompleto.deudas.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Deudas totales</p>
                </div>
                <div className="bg-emerald-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{historialCompleto.deudas.filter(d => d.estado === 'liquidada').length}</p>
                  <p className="text-xs text-gray-500 mt-1">Liquidadas</p>
                </div>
                <div className="bg-red-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{historialCompleto.deudas.filter(d => d.estado !== 'liquidada').length}</p>
                  <p className="text-xs text-gray-500 mt-1">Activas</p>
                </div>
              </div>
            )}

            {/* Timeline de movimientos */}
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase mb-3">📅 Todos los movimientos</p>
              {loadingHistorial ? (
                <div className="text-center text-gray-500 py-6">Cargando historial...</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {/* Agrupar por deuda */}
                  {(historialCompleto?.deudas || [selected]).map((deuda, di) => (
                    <div key={deuda.id} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${deuda.estado === 'liquidada' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                          {deuda.estado === 'liquidada' ? '✅ Liquidada' : '🔴 Activa'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Deuda del {deuda.fecha_deuda ? format(new Date(deuda.fecha_deuda + 'T12:00:00'), 'dd/MM/yyyy', { locale: es }) : '—'}
                        </span>
                      </div>
                      <div className="space-y-1.5 ml-2 border-l-2 border-gray-700 pl-3">
                        {(deuda.historial || []).length === 0 ? (
                          <p className="text-xs text-gray-600 py-2">Sin movimientos</p>
                        ) : (
                          (deuda.historial || []).map((h, i) => {
                            const esPago = h.tipo === 'pago'
                            const items = []
                            if (parseFloat(h.monto) > 0) items.push(`S/ ${Number(h.monto).toLocaleString('es-PE')}`)
                            if (parseInt(h.balones) > 0) items.push(`${h.balones} bal. ${h.tipo_balon || ''}`.trim())
                            if (parseInt(h.vales_20) > 0) items.push(`${h.vales_20}×S/20`)
                            if (parseInt(h.vales_43) > 0) items.push(`${h.vales_43}×S/43`)
                            return (
                              <div key={i} className={`flex items-start gap-2 rounded-lg p-2.5 border text-xs ${esPago ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-red-900/20 border-red-800/30'}`}>
                                <span>{esPago ? '💚' : '🔴'}</span>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className={`font-semibold ${esPago ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {esPago ? `Pagó${h.metodo_pago ? ' · ' + h.metodo_pago : ''}` : (i === 0 ? 'Deuda inicial' : 'Cargo adicional')}
                                      </span>
                                      <span className="text-gray-500 ml-2">
                                        {h.fecha ? format(new Date(h.fecha + 'T12:00:00'), 'dd/MM/yyyy', { locale: es }) : '—'}
                                      </span>
                                    </div>
                                    <span className={`font-bold ${esPago ? 'text-emerald-300' : 'text-red-300'}`}>
                                      {esPago ? '−' : '+'}{items.join(' + ')}
                                    </span>
                                  </div>
                                  {h.notas && <p className="text-amber-400/70 italic mt-0.5">📝 {h.notas}</p>}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setModal(null)} className="btn-secondary w-full">Cerrar</button>
          </div>
        </Modal>
      )}
      {/* Modal registrar cliente rápido desde Deudas */}
      {modal === 'clienteRapidoDeuda' && (
        <Modal title="Registrar cliente" onClose={() => setModal('deuda')}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Se registrará como cliente y podrá usarse en futuras búsquedas.</p>
            <div><label className="label">Nombre *</label>
              <input className="input" autoFocus value={deudaForm.nombre_deudor}
                onChange={e => setDeudaForm(f => ({...f, nombre_deudor: e.target.value}))} /></div>
            <div className="flex gap-3">
              <button onClick={() => setModal('deuda')} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={async () => {
                if (!deudaForm.nombre_deudor.trim()) return
                const { data, error: eIns } = await supabase.from('clientes').insert({
                  nombre: deudaForm.nombre_deudor.trim(), tipo: 'general', es_varios: false
                }).select().single()
                if (!eIns) { 
                  await cargarClientes()
                  if (data) setDeudaForm(f => ({...f, cliente_id: data.id}))
                } else { alert('Error: ' + eIns.message) }
                setModal('deuda')
              }} className="btn-primary flex-1">✓ Registrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
