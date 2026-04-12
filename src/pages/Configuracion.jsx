import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, AlertCircle, Edit2, Eye, EyeOff, Save } from 'lucide-react'

const TIPOS_BALON = ['5kg', '10kg', '45kg']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const [tab, setTab] = useState('precios')
  const [precios, setPrecios] = useState([])
  const [preciosPorTipo, setPreciosPorTipo] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [distribuidores, setDistribuidores] = useState([])
  const [preciosDistTipo, setPreciosDistTipo] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [editandoPrecios, setEditandoPrecios] = useState({})
  const [editandoDistPrecios, setEditandoDistPrecios] = useState({})
  const [costosCompra, setCostosCompra] = useState({ '5kg': '', '10kg': '', '45kg': '' })
  const [savingCostos, setSavingCostos] = useState(false)
  const [costoBalon, setCostoBalon] = useState({ '5kg': '', '10kg': '', '45kg': '' })
  const [precioVentaBalon, setPrecioVentaBalon] = useState({ '5kg': '100', '10kg': '100', '45kg': '100' })
  const [valorVales, setValorVales] = useState({ pequeno: '20', grande: '43' })
  const [savingVales, setSavingVales] = useState(false)
  const [almacenesLista, setAlmacenesLista] = useState([])

  const [provForm, setProvForm] = useState({ nombre: '', telefono: '', direccion: '', ruc: '' })
  const [usuarioForm, setUsuarioForm] = useState({ nombre: '', email: '', password: '', rol: 'trabajador', almacen_id: '' })
  const [permisos, setPermisos] = useState({ ventas:false, vales:false, acuenta:false, clientes:false, deudas:false, inventario:false, distribuidores:false, almacenes:false, reportes:false, configuracion:false })
  const [editUsuarioSelected, setEditUsuarioSelected] = useState(null)
  const [editPermisos, setEditPermisos] = useState({})
  const [editPassword, setEditPassword] = useState('')
  const [showEditPass, setShowEditPass] = useState(false)

  useEffect(() => { cargar() }, [tab])

  const MODULOS_LABELS = [
    ['ventas','🛒 Ventas'], ['vales','🎫 Vales FISE'], ['acuenta','📋 A Cuenta'],
    ['clientes','👥 Clientes'], ['deudas','⚠️ Deudas'], ['inventario','📦 Inventario'],
    ['distribuidores','🚛 Distribuidores'], ['almacenes','🏪 Almacenes'],
    ['reportes','📊 Reportes'], ['configuracion','⚙️ Configuración']
  ]

  async function cargar() {
    setLoading(true)
    // Siempre cargar precios base (necesarios para calcular ganancias en costos)
    const [{ data: pt }, { data: ptb }] = await Promise.all([
      supabase.from('precio_tipos').select('*').order('precio'),
      supabase.from('precio_tipo_balon').select('*')
    ])
    setPrecios(pt || [])
    setPreciosPorTipo(ptb || [])
    const mapa = {}
    pt?.forEach(p => {
      mapa[p.id] = {}
      TIPOS_BALON.forEach(tipo => {
        const found = ptb?.find(x => x.precio_tipo_id === p.id && x.tipo_balon === tipo)
        mapa[p.id][tipo] = found?.precio ?? ''
      })
    })
    setEditandoPrecios(mapa)

    if (tab === 'precios') {
      // ya cargado arriba
    } else if (tab === 'distribuidores_precios') {
      const [{ data: d }, { data: pdt }] = await Promise.all([
        supabase.from('distribuidores').select('*').eq('activo', true).order('nombre'),
        supabase.from('precio_distribuidor_tipo').select('*')
      ])
      setDistribuidores(d || [])
      const mapa = {}
      d?.forEach(dist => {
        mapa[dist.id] = {}
        TIPOS_BALON.forEach(tipo => {
          const found = pdt?.find(x => x.distribuidor_id === dist.id && x.tipo_balon === tipo)
          mapa[dist.id][tipo] = found?.precio ?? ''
        })
      })
      setEditandoDistPrecios(mapa)
      setPreciosDistTipo(pdt || [])
    } else if (tab === 'costos') {
      const [{ data }, { data: dists }, { data: pdt }] = await Promise.all([
        supabase.from('configuracion').select('*').in('clave', ['costo_5kg','costo_10kg','costo_45kg','costo_balon_5kg','costo_balon_10kg','costo_balon_45kg']),
        supabase.from('distribuidores').select('id, nombre, precio_base').eq('activo', true).order('nombre'),
        supabase.from('precio_distribuidor_tipo').select('*')
      ])
      const mapa = { '5kg': '', '10kg': '', '45kg': '' }
      const mapaBalon = { '5kg': '', '10kg': '', '45kg': '' }
      data?.forEach(r => {
        if (r.clave === 'costo_5kg') mapa['5kg'] = r.valor || ''
        if (r.clave === 'costo_10kg') mapa['10kg'] = r.valor || ''
        if (r.clave === 'costo_45kg') mapa['45kg'] = r.valor || ''
        if (r.clave === 'costo_balon_5kg') mapaBalon['5kg'] = r.valor || ''
        if (r.clave === 'costo_balon_10kg') mapaBalon['10kg'] = r.valor || ''
        if (r.clave === 'costo_balon_45kg') mapaBalon['45kg'] = r.valor || ''
      })
      setCostosCompra(mapa)
      setCostoBalon(mapaBalon)
      setDistribuidores(dists || [])
      setPreciosDistTipo(pdt || [])
    } else if (tab === 'vales') {
      const { data } = await supabase.from('configuracion').select('*')
        .in('clave', ['valor_vale_pequeno', 'valor_vale_grande'])
      const mapa = { pequeno: '20', grande: '43' }
      data?.forEach(r => {
        if (r.clave === 'valor_vale_pequeno') mapa.pequeno = r.valor || '20'
        if (r.clave === 'valor_vale_grande') mapa.grande = r.valor || '43'
      })
      setValorVales(mapa)
    } else if (tab === 'proveedores') {
      const { data } = await supabase.from('proveedores').select('*').eq('activo', true).order('nombre')
      setProveedores(data || [])
    } else if (tab === 'usuarios') {
      const [{ data }, { data: alms }] = await Promise.all([
        supabase.from('usuarios').select('*, almacenes(nombre)').order('nombre'),
        supabase.from('almacenes').select('id, nombre').eq('activo', true).order('nombre')
      ])
      setUsuarios(data || [])
      setAlmacenesLista(alms || [])
    }    setLoading(false)
  }

  async function guardarVales() {
    setSavingVales(true)
    await Promise.all([
      supabase.from('configuracion').upsert({ clave: 'valor_vale_pequeno', valor: valorVales.pequeno?.toString() || '20', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'valor_vale_grande', valor: valorVales.grande?.toString() || '43', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
    ])
    setSavingVales(false)
    alert('✅ Valores de vales guardados')
  }

  async function guardarCostos() {
    setSavingCostos(true)
    await Promise.all([
      supabase.from('configuracion').upsert({ clave: 'costo_5kg', valor: costosCompra['5kg']?.toString() || '0', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'costo_10kg', valor: costosCompra['10kg']?.toString() || '0', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'costo_45kg', valor: costosCompra['45kg']?.toString() || '0', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'costo_balon_5kg', valor: costoBalon['5kg']?.toString() || '0', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'costo_balon_10kg', valor: costoBalon['10kg']?.toString() || '0', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
      supabase.from('configuracion').upsert({ clave: 'costo_balon_45kg', valor: costoBalon['45kg']?.toString() || '0', updated_at: new Date().toISOString() }, { onConflict: 'clave' }),
    ])
    setSavingCostos(false)
    alert('✅ Costos guardados correctamente')
    cargar()
  }

  async function guardarPreciosTienda() {
    setSaving(true); setError('')
    for (const precioTipoId of Object.keys(editandoPrecios)) {
      for (const tipo of TIPOS_BALON) {
        const val = editandoPrecios[precioTipoId][tipo]
        if (val === '' || val === null) continue
        const existing = preciosPorTipo.find(p => p.precio_tipo_id === precioTipoId && p.tipo_balon === tipo)
        if (existing) {
          await supabase.from('precio_tipo_balon').update({ precio: parseFloat(val), updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('precio_tipo_balon').insert({ precio_tipo_id: precioTipoId, tipo_balon: tipo, precio: parseFloat(val) })
        }
      }
    }
    setSaving(false)
    alert('✅ Precios guardados correctamente')
    cargar()
  }

  async function guardarPreciosDistribuidor() {
    setSaving(true); setError('')
    for (const distId of Object.keys(editandoDistPrecios)) {
      // Guardar en tabla precio_distribuidor_tipo
      for (const tipo of TIPOS_BALON) {
        const val = editandoDistPrecios[distId][tipo]
        if (val === '' || val === null) continue
        const existing = preciosDistTipo.find(p => p.distribuidor_id === distId && p.tipo_balon === tipo)
        if (existing) {
          await supabase.from('precio_distribuidor_tipo').update({ precio: parseFloat(val), updated_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('precio_distribuidor_tipo').insert({ distribuidor_id: distId, tipo_balon: tipo, precio: parseFloat(val) })
        }
      }
      // Actualizar precio_base en distribuidores usando el precio de 10kg (principal)
      const precio10kg = editandoDistPrecios[distId]['10kg']
      if (precio10kg !== '' && precio10kg !== null) {
        await supabase.from('distribuidores')
          .update({ precio_base: parseFloat(precio10kg), updated_at: new Date().toISOString() })
          .eq('id', distId)
      }
    }
    setSaving(false)
    alert('✅ Precios de distribuidores guardados y actualizados')
    cargar()
  }

  async function guardarProveedor() {
    if (!provForm.nombre) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const op = selected
      ? supabase.from('proveedores').update({ ...provForm, updated_at: new Date().toISOString() }).eq('id', selected.id)
      : supabase.from('proveedores').insert(provForm)
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  async function guardarUsuario() {
    if (!usuarioForm.nombre || !usuarioForm.email || !usuarioForm.password) { setError('Completa nombre, email y contraseña'); return }
    if (usuarioForm.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setSaving(true); setError('')
    try {
      // Crear auth user — el trigger fn_crear_perfil_usuario inserta en usuarios automáticamente
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
      if (!serviceKey) { setError('Service key no configurada'); setSaving(false); return }
      const permisosToSave = usuarioForm.rol === 'admin' ? null : permisos
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({
          email: usuarioForm.email,
          password: usuarioForm.password,
          email_confirm: true,
          user_metadata: {
            nombre: usuarioForm.nombre,
            rol: usuarioForm.rol,
            permisos: permisosToSave ? JSON.stringify(permisosToSave) : null
          }
        })
      })
      const authData = await resp.json()
      if (!resp.ok) { setError(authData.msg || authData.message || JSON.stringify(authData)); setSaving(false); return }
      // El trigger ya creó el perfil — solo actualizamos por si acaso
      const newAuthId = (authData.user || authData).id
      // Esperar un momento para que el trigger cree el perfil
      await new Promise(r => setTimeout(r, 1000))
      // Upsert — por si el trigger ya lo creó o no
      await supabase.from('usuarios').upsert({
        auth_id: newAuthId,
        email: usuarioForm.email,
        nombre: usuarioForm.nombre,
        rol: usuarioForm.rol,
        permisos: permisosToSave,
        almacen_id: usuarioForm.almacen_id || null,
        activo: true
      }, { onConflict: 'auth_id' })
      setModal(null); cargar()
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function eliminarUsuario() {
    if (!editUsuarioSelected) return
    if (editUsuarioSelected.rol === 'admin') { setError('No puedes eliminar un administrador'); return }
    if (!confirm(`¿Eliminar al usuario ${editUsuarioSelected.nombre}? No podrá iniciar sesión.`)) return
    setSaving(true); setError('')
    // Delete from public.usuarios
    const { error: e } = await supabase.from('usuarios').delete().eq('id', editUsuarioSelected.id)
    if (e) { setError(e.message); setSaving(false); return }
    // Delete from auth via REST
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
    if (serviceKey && editUsuarioSelected.auth_id) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${editUsuarioSelected.auth_id}`, {
        method: 'DELETE',
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      })
    }
    setSaving(false)
    setModal(null)
    cargar()
  }

  async function guardarEditUsuario() {
    if (!editUsuarioSelected) return
    setSaving(true); setError('')
    const permisosToSave = editUsuarioSelected.rol === 'admin' ? null : editPermisos
    const { error: e } = await supabase.from('usuarios').update({
      nombre: editUsuarioSelected.nombre,
      rol: editUsuarioSelected.rol,
      permisos: permisosToSave,
      almacen_id: editUsuarioSelected.almacen_id || null
    }).eq('id', editUsuarioSelected.id)
    if (e) { setError(e.message); setSaving(false); return }
    // Cambiar contraseña si se ingresó una nueva
    if (editPassword && editPassword.length >= 6 && editUsuarioSelected.auth_id) {
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
      if (serviceKey) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${editUsuarioSelected.auth_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ password: editPassword })
        })
      }
    }
    setSaving(false)
    setEditPassword('')
    setModal(null)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Configuración</h2>
        <p className="text-gray-500 text-sm">Precios, proveedores y usuarios del sistema</p>
      </div>

      <div className="flex gap-2 border-b border-gray-800 overflow-x-auto">
        {[
          ['precios','💰 Precios tienda'],
          ['distribuidores_precios','🚛 Precios distribuidores'],
          ['costos','💲 Costos compra'],
          ['vales','🎫 Vales FISE'],
          ['proveedores','🚚 Proveedores'],
          ['usuarios','👤 Usuarios']
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Precios tienda */}
      {tab === 'precios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Precio por tipo de cliente y tamaño de balón</p>
            <button onClick={guardarPreciosTienda} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Tipo de cliente</th>
                {TIPOS_BALON.map(t => <th key={t} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">🔵 {t}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {precios.map(p => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <p className="text-white font-semibold text-sm">{p.nombre}</p>
                      <p className="text-gray-500 text-xs">Base: S/{p.precio}</p>
                    </td>
                    {TIPOS_BALON.map(tipo => (
                      <td key={tipo} className="px-4 py-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">S/</span>
                          <input type="number" className="input pl-7 w-28 text-sm"
                            value={editandoPrecios[p.id]?.[tipo] ?? ''}
                            onChange={e => setEditandoPrecios(prev => ({
                              ...prev, [p.id]: { ...prev[p.id], [tipo]: e.target.value }
                            }))}
                            placeholder="0" />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs">💡 Los precios se usarán automáticamente al registrar ventas según el tipo de cliente y tamaño de balón.</p>

          {/* Precio venta balón vacío */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-800">
              <p className="text-white font-semibold text-sm">🔵 Precio venta balón vacío</p>
              <p className="text-gray-500 text-xs">Precio al que vendes el envase solo (sin gas)</p>
            </div>
            <div className="flex gap-8 px-6 py-4">
              {TIPOS_BALON.map(tipo => (
                <div key={tipo} className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm font-medium">{tipo}:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">S/</span>
                    <input type="number" className="input pl-7 w-24 text-sm"
                      value={precioVentaBalon[tipo]}
                      onChange={e => setPrecioVentaBalon(c => ({...c, [tipo]: e.target.value}))}
                      placeholder="100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Precios distribuidores */}
      {tab === 'distribuidores_precios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Precio por distribuidor y tamaño de balón</p>
            <button onClick={guardarPreciosDistribuidor} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Distribuidor</th>
                {TIPOS_BALON.map(t => <th key={t} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">🔵 {t}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {distribuidores.map(d => (
                  <tr key={d.id} className="table-row-hover">
                    <td className="px-6 py-4 text-white font-semibold text-sm">{d.nombre}</td>
                    {TIPOS_BALON.map(tipo => (
                      <td key={tipo} className="px-4 py-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">S/</span>
                          <input type="number" className="input pl-7 w-28 text-sm"
                            value={editandoDistPrecios[d.id]?.[tipo] ?? ''}
                            onChange={e => setEditandoDistPrecios(prev => ({
                              ...prev, [d.id]: { ...prev[d.id], [tipo]: e.target.value }
                            }))}
                            placeholder="0" />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs">💡 Estos precios se usarán al registrar reposiciones y rendiciones de distribuidores.</p>
        </div>
      )}

      {/* Tab Costos compra */}
      {tab === 'costos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Precio de compra por tipo de balón — usado para calcular ganancias</p>
            <button onClick={guardarCostos} disabled={savingCostos} className="btn-primary">
              <Save className="w-4 h-4" />{savingCostos ? 'Guardando...' : 'Guardar costos'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[['5kg','🔵','blue'],['10kg','🟡','yellow'],['45kg','🔴','red']].map(([tipo, icon, color]) => (
              <div key={tipo} className={`card border border-${color}-800/40`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-white font-bold">{tipo}</p>
                    <p className="text-gray-500 text-xs">Precio de compra</p>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">S/</span>
                  <input type="number" min="0" step="0.50" className="input pl-9 text-xl font-bold text-center"
                    value={costosCompra[tipo]}
                    onChange={e => setCostosCompra(c => ({...c, [tipo]: e.target.value}))}
                    placeholder="0.00" />
                </div>
                <div className="mt-3">
                  <p className="text-gray-500 text-xs mb-1">Costo balón (envase)</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">S/</span>
                    <input type="number" min="0" step="1" className="input pl-9 text-sm text-center"
                      value={costoBalon[tipo]}
                      onChange={e => setCostoBalon(c => ({...c, [tipo]: e.target.value}))}
                      placeholder="0.00" />
                  </div>
                </div>
                {parseFloat(costosCompra[tipo]) > 0 && (
                  <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
                    <p className="text-gray-400 font-medium mb-2">🏪 Ganancia venta gas:</p>
                    {precios.map(p => {
                      const found = preciosPorTipo.find(x => x.precio_tipo_id === p.id && x.tipo_balon === tipo)
                      const precioVenta = found?.precio || 0
                      if (!precioVenta || precioVenta === 0) return null
                      const gan = precioVenta - parseFloat(costosCompra[tipo])
                      return (
                        <div key={p.id} className="flex justify-between items-center">
                          <span className="text-gray-500">{p.nombre}</span>
                          <span className={`font-bold ${gan > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            S/{precioVenta} → +S/{gan.toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                    {parseFloat(costoBalon[tipo]) > 0 && (
                      <div className="pt-2 mt-1 border-t border-gray-700 space-y-2">
                        <p className="text-gray-400 font-medium">🔵 Ganancia venta balón vacío:</p>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Precio venta - costo envase</span>
                          <span className={`font-bold ${(parseFloat(precioVentaBalon[tipo]||0) - parseFloat(costoBalon[tipo])) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            S/{precioVentaBalon[tipo]||0} - S/{costoBalon[tipo]} = +S/{(parseFloat(precioVentaBalon[tipo]||0) - parseFloat(costoBalon[tipo])).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-gray-400 font-medium">⛽🔵 Ganancia gas + balón:</p>
                        {precios.map(p => {
                          const found = preciosPorTipo.find(x => x.precio_tipo_id === p.id && x.tipo_balon === tipo)
                          const precioGas = found?.precio || 0
                          if (!precioGas || precioGas === 0) return null
                          const ganGas = precioGas - parseFloat(costosCompra[tipo])
                          const ganBalon = parseFloat(precioVentaBalon[tipo]||0) - parseFloat(costoBalon[tipo])
                          return (
                            <div key={p.id} className="flex justify-between items-center">
                              <span className="text-gray-500">{p.nombre}</span>
                              <span className={`font-bold ${(ganGas + ganBalon) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                gas S/{ganGas.toFixed(0)} + bal S/{ganBalon.toFixed(0)} = S/{(ganGas + ganBalon).toFixed(0)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {distribuidores.length > 0 && (
                      <>
                        <p className="text-gray-400 font-medium mt-3 mb-1 pt-2 border-t border-gray-700">🚛 Distribuidores:</p>
                        {distribuidores.map(d => {
                          const precioDistTipo = preciosDistTipo?.find(x => x.distribuidor_id === d.id && x.tipo_balon === tipo)?.precio || 0
                          if (!precioDistTipo || precioDistTipo === 0) return null
                          const gan = precioDistTipo - parseFloat(costosCompra[tipo])
                          return (
                            <div key={d.id} className="flex justify-between items-center">
                              <span className="text-gray-500">{d.nombre}</span>
                              <span className={`font-bold ${gan > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                S/{precioDistTipo} → +S/{gan.toFixed(2)}
                              </span>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-gray-400">
            <p className="text-blue-300 font-medium mb-1">💡 ¿Cómo funciona?</p>
            <p>• Cuando registras una <strong className="text-white">compra nueva</strong>, estos precios se actualizan automáticamente.</p>
            <p className="mt-1">• El reporte de <strong className="text-white">Ganancias</strong> usa estos precios para calcular cuánto ganaste por cada balón vendido.</p>
            <p className="mt-1">• Se calcula por separado para <strong className="text-white">Tienda</strong> y <strong className="text-white">Distribuidores</strong>.</p>
          </div>
        </div>
      )}

      {/* Tab Vales FISE */}
      {tab === 'vales' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Valor actual de los vales FISE — cambia aquí antes de registrar</p>
            <button onClick={guardarVales} disabled={savingVales} className="btn-primary">
              <Save className="w-4 h-4" />{savingVales ? 'Guardando...' : 'Guardar valores'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="card border border-yellow-800/40">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🎫</span>
                <div>
                  <p className="text-white font-bold">Vale pequeño</p>
                  <p className="text-gray-500 text-xs">Antes S/20, ahora puede ser S/30 u otro</p>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">S/</span>
                <input type="number" min="1" className="input pl-9 text-3xl font-bold text-center text-yellow-300"
                  value={valorVales.pequeno}
                  onChange={e => setValorVales(v => ({...v, pequeno: e.target.value}))} />
              </div>
              <div className="mt-3 bg-yellow-900/20 rounded-lg p-3 text-xs text-yellow-300">
                💡 Cuando registres vales, cada vale pequeño valdrá S/{valorVales.pequeno}
              </div>
            </div>
            <div className="card border border-orange-800/40">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🎫</span>
                <div>
                  <p className="text-white font-bold">Vale grande</p>
                  <p className="text-gray-500 text-xs">Normalmente S/43</p>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">S/</span>
                <input type="number" min="1" className="input pl-9 text-3xl font-bold text-center text-orange-300"
                  value={valorVales.grande}
                  onChange={e => setValorVales(v => ({...v, grande: e.target.value}))} />
              </div>
              <div className="mt-3 bg-orange-900/20 rounded-lg p-3 text-xs text-orange-300">
                💡 Cuando registres vales, cada vale grande valdrá S/{valorVales.grande}
              </div>
            </div>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-gray-400">
            <p className="text-blue-300 font-medium mb-2">📋 ¿Cómo usarlo?</p>
            <p>• Si hoy tienes <strong className="text-white">90 vales de S/30</strong>: cambia el vale pequeño a S/30, guarda y registra los 90 vales.</p>
            <p className="mt-1">• Si mañana tienes <strong className="text-white">50 vales viejos de S/20</strong>: cambia el vale pequeño a S/20, guarda y registra los 50 vales.</p>
            <p className="mt-1">• El historial mostrará cada registro con su valor correcto.</p>
          </div>
        </div>
      )}

      {/* Tab Proveedores */}
      {tab === 'proveedores' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Empresas proveedoras de balones</p>
            <button onClick={() => { setSelected(null); setProvForm({ nombre: '', telefono: '', direccion: '', ruc: '' }); setError(''); setModal('proveedor') }} className="btn-primary">
              <Plus className="w-4 h-4" />Nuevo proveedor
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                {['Proveedor','Teléfono','RUC','Dirección',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {proveedores.map(p => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="px-6 py-4 text-white font-medium text-sm">{p.nombre}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{p.telefono || '-'}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm font-mono">{p.ruc || '-'}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{p.direccion || '-'}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => { setSelected(p); setProvForm({ nombre: p.nombre, telefono: p.telefono||'', direccion: p.direccion||'', ruc: p.ruc||'' }); setError(''); setModal('proveedor') }}
                        className="text-gray-500 hover:text-blue-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Usuarios */}
      {tab === 'usuarios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Personas con acceso al sistema</p>
            <button onClick={() => { setUsuarioForm({ nombre: '', email: '', password: '', rol: 'trabajador' }); setPermisos({ ventas:false, vales:false, acuenta:false, clientes:false, deudas:false, inventario:false, distribuidores:false, almacenes:false, reportes:false, configuracion:false }); setError(''); setModal('usuario') }} className="btn-primary">
              <Plus className="w-4 h-4" />Nuevo usuario
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {usuarios.map(u => (
              <div key={u.id} className="card border border-gray-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${u.rol === 'admin' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                    {u.nombre?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{u.nombre}</p>
                    <p className="text-gray-500 text-xs truncate">{u.email}</p>
                    {u.almacen_id && (
                      <p className="text-blue-400 text-xs mt-0.5">🏪 {u.almacenes?.nombre || 'Almacén asignado'}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={u.rol === 'admin' ? 'badge-blue' : 'badge-green'}>{u.rol === 'admin' ? '👑 Admin' : '👷 Trabajador'}</span>
                    <button onClick={async () => {
                      setEditUsuarioSelected({...u}); setEditPermisos(u.permisos || {}); setError(''); setEditPassword('')
                      // Cargar almacenes si no están cargados
                      if (almacenesLista.length === 0) {
                        const { data: alms } = await supabase.from('almacenes').select('id, nombre').eq('activo', true).order('nombre')
                        setAlmacenesLista(alms || [])
                      }
                      setModal('editUsuario')
                    }}
                      className="text-xs bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 px-2 py-1 rounded-lg transition-all">
                      ✏️
                    </button>
                  </div>
                </div>
                {u.rol !== 'admin' && (
                  <div className="flex flex-wrap gap-1">
                    {MODULOS_LABELS.map(([key, label]) => (
                      <span key={key} className={`text-xs px-2 py-0.5 rounded-full border ${u.permisos?.[key] ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400' : 'bg-gray-800/50 border-gray-700/50 text-gray-600 line-through'}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {u.rol === 'admin' && <p className="text-xs text-gray-500">Acceso completo a todos los módulos</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === 'usuario' && (
        <Modal title="Nuevo usuario" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre completo *</label><input className="input" value={usuarioForm.nombre} onChange={e => setUsuarioForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Juan Pérez" /></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={usuarioForm.email} onChange={e => setUsuarioForm(f => ({...f, email: e.target.value}))} placeholder="correo@ejemplo.com" /></div>
            <div>
              <label className="label">Contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" value={usuarioForm.password}
                  onChange={e => setUsuarioForm(f => ({...f, password: e.target.value}))} placeholder="Mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setUsuarioForm(f => ({...f, rol: 'trabajador'}))}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left ${usuarioForm.rol === 'trabajador' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  <p className="font-bold">👷 Trabajador</p>
                  <p className="text-xs mt-1 opacity-70">Registra ventas, vales y operaciones diarias</p>
                </button>
                <button onClick={() => setUsuarioForm(f => ({...f, rol: 'admin'}))}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left ${usuarioForm.rol === 'admin' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  <p className="font-bold">👑 Admin</p>
                  <p className="text-xs mt-1 opacity-70">Acceso completo: precios, reportes y configuración</p>
                </button>
              </div>
            </div>
            {usuarioForm.rol === 'trabajador' && (
              <div>
                <label className="label">🏪 Almacén asignado</label>
                <select className="input" value={usuarioForm.almacen_id}
                  onChange={e => setUsuarioForm(f => ({...f, almacen_id: e.target.value}))}>
                  <option value="">Sin almacén específico (ve todos)</option>
                  {almacenesLista.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Si asignas un almacén, el usuario solo operará en ese almacén.</p>
              </div>
            )}
            {usuarioForm.rol === 'trabajador' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Módulos con acceso</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPermisos({ ventas:true, vales:true, acuenta:true, clientes:true, deudas:true, inventario:true, distribuidores:true, almacenes:true, reportes:true, configuracion:false })}
                      className="text-xs text-blue-400 hover:text-blue-300">✓ Todos</button>
                    <button type="button" onClick={() => setPermisos({ ventas:false, vales:false, acuenta:false, clientes:false, deudas:false, inventario:false, distribuidores:false, almacenes:false, reportes:false, configuracion:false })}
                      className="text-xs text-gray-500 hover:text-gray-400">✗ Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODULOS_LABELS.map(([key, label]) => (
                    <button key={key} onClick={() => setPermisos(p => ({...p, [key]: !p[key]}))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${permisos[key] ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300' : 'bg-gray-800/50 border-gray-700 text-gray-500'}`}>
                      <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-xs ${permisos[key] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
                        {permisos[key] ? '✓' : ''}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarUsuario} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Creando...' : '✓ Crear usuario'}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'editUsuario' && editUsuarioSelected && (
        <Modal title="Editar usuario" onClose={() => { setModal(null); setEditPassword('') }}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            {/* Email (solo lectura) */}
            <div>
              <label className="label">Email</label>
              <input className="input opacity-60 cursor-not-allowed" value={editUsuarioSelected.email || ''} readOnly />
            </div>

            <div><label className="label">Nombre</label>
              <input className="input" value={editUsuarioSelected.nombre} onChange={e => setEditUsuarioSelected(u => ({...u, nombre: e.target.value}))} />
            </div>

            {/* Cambiar contraseña */}
            <div>
              <label className="label">Nueva contraseña <span className="text-gray-600 font-normal">(dejar vacío para no cambiar)</span></label>
              <div className="relative">
                <input type={showEditPass ? 'text' : 'password'} className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)} />
                <button type="button" onClick={() => setShowEditPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showEditPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {editPassword && editPassword.length < 6 && (
                <p className="text-xs text-red-400 mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            <div>
              <label className="label">Rol</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setEditUsuarioSelected(u => ({...u, rol: 'trabajador'}))}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left ${editUsuarioSelected.rol === 'trabajador' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  <p className="font-bold">👷 Trabajador</p>
                  <p className="text-xs mt-1 opacity-70">Solo módulos asignados</p>
                </button>
                <button onClick={() => setEditUsuarioSelected(u => ({...u, rol: 'admin'}))}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left ${editUsuarioSelected.rol === 'admin' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}>
                  <p className="font-bold">👑 Admin</p>
                  <p className="text-xs mt-1 opacity-70">Acceso completo</p>
                </button>
              </div>
            </div>

            {/* Almacén asignado */}
            {editUsuarioSelected.rol === 'trabajador' && (
              <div>
                <label className="label">🏪 Almacén asignado</label>
                <select className="input" value={editUsuarioSelected.almacen_id || ''}
                  onChange={e => setEditUsuarioSelected(u => ({...u, almacen_id: e.target.value || null}))}>
                  <option value="">Sin almacén específico (ve todos)</option>
                  {almacenesLista.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Si asignas un almacén, el usuario solo operará en ese almacén.</p>
              </div>
            )}

            {/* Módulos */}
            {editUsuarioSelected.rol === 'trabajador' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Módulos con acceso</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditPermisos({ ventas:true, vales:true, acuenta:true, clientes:true, deudas:true, inventario:true, distribuidores:true, almacenes:true, reportes:true, configuracion:false })}
                      className="text-xs text-blue-400 hover:text-blue-300">✓ Todos</button>
                    <button type="button" onClick={() => setEditPermisos({ ventas:false, vales:false, acuenta:false, clientes:false, deudas:false, inventario:false, distribuidores:false, almacenes:false, reportes:false, configuracion:false })}
                      className="text-xs text-gray-500 hover:text-gray-400">✗ Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODULOS_LABELS.map(([key, label]) => (
                    <button key={key} onClick={() => setEditPermisos(p => ({...p, [key]: !p[key]}))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${editPermisos[key] ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300' : 'bg-gray-800/50 border-gray-700 text-gray-500'}`}>
                      <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-xs ${editPermisos[key] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
                        {editPermisos[key] ? '✓' : ''}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModal(null); setEditPassword('') }} className="btn-secondary">Cancelar</button>
              <button onClick={eliminarUsuario} disabled={saving || editUsuarioSelected?.rol === 'admin'}
                className="px-4 py-2 rounded-xl border border-red-600/40 bg-red-900/20 text-red-400 text-sm font-medium hover:bg-red-900/30 transition-all disabled:opacity-30">
                🗑️ Eliminar
              </button>
              <button onClick={guardarEditUsuario} disabled={saving || (editPassword && editPassword.length < 6)}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {saving ? 'Guardando...' : '✓ Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'proveedor' && (
        <Modal title={selected ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div><label className="label">Nombre *</label><input className="input" value={provForm.nombre} onChange={e => setProvForm(f => ({...f, nombre: e.target.value}))} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={provForm.telefono} onChange={e => setProvForm(f => ({...f, telefono: e.target.value}))} /></div>
            <div><label className="label">RUC</label><input className="input" value={provForm.ruc} onChange={e => setProvForm(f => ({...f, ruc: e.target.value}))} /></div>
            <div><label className="label">Dirección</label><input className="input" value={provForm.direccion} onChange={e => setProvForm(f => ({...f, direccion: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarProveedor} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
