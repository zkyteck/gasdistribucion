import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Warehouse, Plus, Edit2, Trash2, Package, X, AlertCircle, FlaskConical } from 'lucide-react'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', responsable: '', ubicacion: '', es_prueba: false })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [limpiandoPrueba, setLimpiandoPrueba] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('almacenes').select('*').eq('activo', true).order('created_at')
    setAlmacenes(data || [])
    setLoading(false)
  }

  function abrirNuevo() { setForm({ nombre: '', responsable: '', ubicacion: '', es_prueba: false }); setEditId(null); setError(''); setModal(true) }
  function abrirEditar(a) { setForm({ nombre: a.nombre, responsable: a.responsable, ubicacion: a.ubicacion, es_prueba: a.es_prueba || false }); setEditId(a.id); setError(''); setModal(true) }

  async function guardar() {
    if (!form.nombre || !form.responsable || !form.ubicacion) { setError('Completa todos los campos'); return }
    setSaving(true); setError('')
    const op = editId
      ? supabase.from('almacenes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId)
      : supabase.from('almacenes').insert({ ...form, stock_actual: 0 })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(false); cargar()
  }

  async function eliminar(id) {
    await supabase.from('almacenes').update({ activo: false }).eq('id', id)
    setDeleteConfirm(null); cargar()
  }

  async function limpiarPrueba(almacen) {
    if (!confirm(`¿Borrar TODOS los datos de prueba de "${almacen.nombre}"?\n\nEsto eliminará:\n• Ventas\n• Deudas\n• Movimientos de stock\n• Compras y detalles\n• Stock por tipo\n• Reposiciones y abonos de distribuidores\n\nEsta acción NO se puede deshacer.`)) return
    setLimpiandoPrueba(true)
    const id = almacen.id
    // Borrar en orden para respetar foreign keys
    await supabase.from('ventas').delete().eq('almacen_id', id)
    await supabase.from('deudas').delete().eq('almacen_id', id)
    await supabase.from('movimientos_stock').delete().eq('almacen_id', id)
    await supabase.from('movimientos_stock').delete().eq('almacen_destino_id', id)
    // compra_detalles → compras
    const { data: detalles } = await supabase.from('compra_detalles').select('id, compra_id').eq('almacen_id', id)
    if (detalles?.length) {
      await supabase.from('compra_detalles').delete().eq('almacen_id', id)
      // borrar compras que solo tenían detalles de este almacén
      const compraIds = [...new Set(detalles.map(d => d.compra_id))]
      for (const cid of compraIds) {
        const { count } = await supabase.from('compra_detalles').select('*', { count: 'exact', head: true }).eq('compra_id', cid)
        if (count === 0) await supabase.from('compras').delete().eq('id', cid)
      }
    }
    await supabase.from('stock_por_tipo').delete().eq('almacen_id', id)
    await supabase.from('reposiciones_distribuidor').delete().eq('almacen_origen_id', id)
    await supabase.from('abonos_distribuidor').delete().eq('distribuidor_id',
      // borrar abonos de distribuidores asignados a este almacén
      supabase.from('distribuidores').select('id').eq('almacen_id', id)
    )
    // Resetear stock del almacén
    await supabase.from('almacenes').update({
      stock_actual: 0, balones_vacios: 0,
      vacios_5kg: 0, vacios_10kg: 0, vacios_45kg: 0,
      balones_pendientes_devolucion: 0,
      updated_at: new Date().toISOString()
    }).eq('id', id)
    setLimpiandoPrueba(false)
    setDeleteConfirm(null)
    alert(`✅ Datos de prueba de "${almacen.nombre}" eliminados correctamente.\nEl almacén sigue activo con stock en 0.`)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Almacenes</h2>
          <p className="text-gray-500 text-sm">Gestión de almacenes y stock</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary"><Plus className="w-4 h-4" />Nuevo almacén</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card border border-blue-500/20">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><Warehouse className="w-4 h-4 text-blue-400" /></div>
          <p className="text-2xl font-bold text-white">{almacenes.length}</p>
          <p className="text-xs text-gray-500">Almacenes activos</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-white">{almacenes.reduce((s, a) => s + a.stock_actual, 0)}</p>
          <p className="text-xs text-gray-500">Balones en total</p>
        </div>
      </div>

      {/* Banner almacenes de prueba */}
      {almacenes.some(a => a.es_prueba) && (
        <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <FlaskConical className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <p className="text-xs text-purple-300">
            Tienes almacenes en <span className="font-semibold">modo prueba</span>. Úsalos para probar ventas, deudas e inventario sin afectar datos reales. Al terminar, usa el botón <span className="font-semibold">🧹 Limpiar prueba</span> para borrar todo lo generado.
          </p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Lista de almacenes</h3></div>
        {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                {['Nombre','Responsable','Ubicación','Stock','Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3 last:text-right">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {almacenes.map(a => (
                  <tr key={a.id} className={`table-row-hover ${a.es_prueba ? 'bg-purple-900/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.es_prueba ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
                          {a.es_prueba ? <FlaskConical className="w-4 h-4 text-purple-400" /> : <Warehouse className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div>
                          <span className="text-white font-medium text-sm">{a.nombre}</span>
                          {a.es_prueba && <span className="ml-2 text-xs bg-purple-900/40 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full">🧪 Prueba</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{a.responsable}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{a.ubicacion}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-sm ${a.stock_actual > 50 ? 'text-emerald-400' : a.stock_actual > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {a.stock_actual} bal.
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {a.es_prueba && (
                          <button onClick={() => setDeleteConfirm({ ...a, modo: 'limpiar' })}
                            className="text-xs bg-purple-600/20 border border-purple-600/30 text-purple-400 px-2 py-1 rounded-lg hover:bg-purple-600/30 transition-all">
                            🧹 Limpiar prueba
                          </button>
                        )}
                        <button onClick={() => abrirEditar(a)} className="text-gray-500 hover:text-blue-400 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm({ ...a, modo: 'eliminar' })} className="text-gray-500 hover:text-red-400 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editId ? 'Editar almacén' : 'Nuevo almacén'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {[['nombre','Nombre del almacén','text','Ej: Tienda PRUEBA'],['responsable','Responsable','text','Nombre del encargado'],['ubicacion','Ubicación','text','Dirección o zona']].map(([key,label,type,ph]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type={type} className="input" placeholder={ph} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} />
              </div>
            ))}
            {/* Toggle modo prueba */}
            <div
              onClick={() => setForm(f => ({...f, es_prueba: !f.es_prueba}))}
              className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${form.es_prueba ? 'bg-purple-900/30 border-purple-600/50' : 'bg-gray-800/50 border-gray-700'}`}>
              <div>
                <p className={`text-sm font-semibold ${form.es_prueba ? 'text-purple-300' : 'text-gray-300'}`}>🧪 Almacén de prueba</p>
                <p className="text-xs text-gray-500 mt-0.5">Permite limpiar todos sus datos con un solo botón</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-all relative ${form.es_prueba ? 'bg-purple-500' : 'bg-gray-600'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.es_prueba ? 'left-5' : 'left-1'}`} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title={deleteConfirm.modo === 'limpiar' ? '🧹 Limpiar datos de prueba' : 'Eliminar almacén'} onClose={() => setDeleteConfirm(null)}>
          {deleteConfirm.modo === 'limpiar' ? (
            <div className="space-y-4">
              <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-4">
                <p className="text-white font-semibold mb-2">🧪 {deleteConfirm.nombre}</p>
                <p className="text-xs text-gray-400 mb-3">Se eliminarán todos los registros generados con este almacén:</p>
                <div className="space-y-1 text-xs text-gray-500">
                  {['Ventas registradas','Deudas creadas','Movimientos de stock','Compras y distribución','Stock por tipo','Reposiciones y abonos'].map(item => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
                <p className="text-xs text-emerald-400 mt-3">✅ El almacén seguirá activo con stock en 0</p>
              </div>
              <p className="text-xs text-red-400">⚠️ Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={() => limpiarPrueba(deleteConfirm)} disabled={limpiandoPrueba}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-all">
                  {limpiandoPrueba ? 'Limpiando...' : '🧹 Confirmar limpieza'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-4">¿Eliminar <span className="text-white font-semibold">{deleteConfirm.nombre}</span>?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={() => eliminar(deleteConfirm.id)} className="btn-danger flex-1 justify-center">Eliminar</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}


function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', responsable: '', ubicacion: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('almacenes').select('*').eq('activo', true).order('created_at')
    setAlmacenes(data || [])
    setLoading(false)
  }

  function abrirNuevo() { setForm({ nombre: '', responsable: '', ubicacion: '' }); setEditId(null); setError(''); setModal(true) }
  function abrirEditar(a) { setForm({ nombre: a.nombre, responsable: a.responsable, ubicacion: a.ubicacion }); setEditId(a.id); setError(''); setModal(true) }

  async function guardar() {
    if (!form.nombre || !form.responsable || !form.ubicacion) { setError('Completa todos los campos'); return }
    setSaving(true); setError('')
    const op = editId
      ? supabase.from('almacenes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId)
      : supabase.from('almacenes').insert({ ...form, stock_actual: 0 })
    const { error: e } = await op
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(false); cargar()
  }

  async function eliminar(id) {
    await supabase.from('almacenes').update({ activo: false }).eq('id', id)
    setDeleteConfirm(null); cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Almacenes</h2>
          <p className="text-gray-500 text-sm">Gestión de almacenes y stock</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary"><Plus className="w-4 h-4" />Nuevo almacén</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card border border-blue-500/20">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><Warehouse className="w-4 h-4 text-blue-400" /></div>
          <p className="text-2xl font-bold text-white">{almacenes.length}</p>
          <p className="text-xs text-gray-500">Almacenes activos</p>
        </div>
        <div className="stat-card border border-emerald-500/20">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><Package className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-white">{almacenes.reduce((s, a) => s + a.stock_actual, 0)}</p>
          <p className="text-xs text-gray-500">Balones en total</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Lista de almacenes</h3></div>
        {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                {['Nombre','Responsable','Ubicación','Stock','Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3 last:text-right">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {almacenes.map(a => (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><Warehouse className="w-4 h-4 text-blue-400" /></div>
                        <span className="text-white font-medium text-sm">{a.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{a.responsable}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{a.ubicacion}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-sm ${a.stock_actual > 50 ? 'text-emerald-400' : a.stock_actual > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {a.stock_actual} bal.
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => abrirEditar(a)} className="text-gray-500 hover:text-blue-400 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(a)} className="text-gray-500 hover:text-red-400 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editId ? 'Editar almacén' : 'Nuevo almacén'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            {[['nombre','Nombre del almacén','text','Ej: Tienda Principal'],['responsable','Responsable','text','Nombre del encargado'],['ubicacion','Ubicación','text','Dirección o zona']].map(([key,label,type,ph]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type={type} className="input" placeholder={ph} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Eliminar almacén" onClose={() => setDeleteConfirm(null)}>
          <p className="text-gray-400 text-sm mb-4">¿Estás seguro que deseas eliminar <span className="text-white font-semibold">{deleteConfirm.nombre}</span>?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => eliminar(deleteConfirm.id)} className="btn-danger flex-1 justify-center">Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
