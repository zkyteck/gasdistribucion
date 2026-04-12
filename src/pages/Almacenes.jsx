import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Warehouse, Plus, Edit2, Trash2, Package, X, AlertCircle, TestTube } from 'lucide-react'

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
    if (!confirm('Borrar TODOS los datos de prueba de ' + almacen.nombre + '? Esta accion NO se puede deshacer.')) return
    setLimpiandoPrueba(true)
    const id = almacen.id
    await supabase.from('ventas').delete().eq('almacen_id', id)
    await supabase.from('deudas').delete().eq('almacen_id', id)
    await supabase.from('movimientos_stock').delete().eq('almacen_id', id)
    await supabase.from('movimientos_stock').delete().eq('almacen_destino_id', id)
    const { data: detalles } = await supabase.from('compra_detalles').select('id, compra_id').eq('almacen_id', id)
    if (detalles && detalles.length > 0) {
      await supabase.from('compra_detalles').delete().eq('almacen_id', id)
      const compraIds = [...new Set(detalles.map(d => d.compra_id))]
      for (const cid of compraIds) {
        const { count } = await supabase.from('compra_detalles').select('*', { count: 'exact', head: true }).eq('compra_id', cid)
        if (count === 0) await supabase.from('compras').delete().eq('id', cid)
      }
    }
    await supabase.from('stock_por_tipo').delete().eq('almacen_id', id)
    await supabase.from('reposiciones_distribuidor').delete().eq('almacen_origen_id', id)
    // Borrar cuentas y abonos de distribuidores asignados a este almacén
    const { data: distsPrueba } = await supabase.from('distribuidores').select('id').eq('almacen_id', id)
    if (distsPrueba && distsPrueba.length > 0) {
      for (const dist of distsPrueba) {
        await supabase.from('cuentas_distribuidor').delete().eq('distribuidor_id', dist.id)
        await supabase.from('abonos_distribuidor').delete().eq('distribuidor_id', dist.id)
        await supabase.from('a_cuenta').delete().eq('distribuidor_id', dist.id)
      }
    }
    await supabase.from('almacenes').update({
      stock_actual: 0, balones_vacios: 0,
      vacios_5kg: 0, vacios_10kg: 0, vacios_45kg: 0,
      balones_pendientes_devolucion: 0,
      updated_at: new Date().toISOString()
    }).eq('id', id)
    setLimpiandoPrueba(false)
    setDeleteConfirm(null)
    alert('Datos de prueba de ' + almacen.nombre + ' eliminados. El almacen sigue activo con stock en 0.')
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Almacenes</h2>
          <p className="text-gray-500 text-sm">Gestion de almacenes y stock</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary"><Plus className="w-4 h-4" />Nuevo almacen</button>
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

      {almacenes.some(a => a.es_prueba) && (
        <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <TestTube className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <p className="text-xs text-purple-300">
            Tienes almacenes en <span className="font-semibold">modo prueba</span>. Usa el boton Limpiar cuando termines.
          </p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800"><h3 className="text-sm font-semibold text-white">Lista de almacenes</h3></div>
        {loading ? <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div> : (
          {/* Móvil — cards */}
        <div className="lg:hidden divide-y" style={{borderColor:'var(--app-card-border)'}}>
          {almacenes.map(a => (
            <div key={a.id} style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:8}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:a.es_prueba?'rgba(168,85,247,0.1)':'rgba(59,130,246,0.1)'}}>
                    {a.es_prueba ? <TestTube style={{width:16,height:16,color:'#a855f7'}} /> : <Warehouse style={{width:16,height:16,color:'#60a5fa'}} />}
                  </div>
                  <div>
                    <p style={{color:'var(--app-text)',fontWeight:600,fontSize:14,margin:0}}>{a.nombre}</p>
                    <p style={{color:'var(--app-text-secondary)',fontSize:11,margin:0}}>{a.responsable} · {a.ubicacion}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${a.stock_actual > 50 ? 'text-emerald-400' : a.stock_actual > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {a.stock_actual} bal.
                </span>
              </div>
              <div style={{display:'flex', gap:6}}>
                {a.es_prueba && (
                  <button onClick={() => setDeleteConfirm({...a, modo:'limpiar'})} style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid rgba(168,85,247,0.3)',background:'rgba(168,85,247,0.1)',color:'#a855f7',fontSize:11,cursor:'pointer'}}>
                    Limpiar datos
                  </button>
                )}
                <button onClick={() => abrirEditar(a)} style={{flex:1,padding:'7px',borderRadius:8,border:'1px solid var(--app-card-border)',background:'var(--app-card-bg-alt)',color:'var(--app-text-secondary)',fontSize:11,cursor:'pointer'}}>
                  ✏️ Editar
                </button>
                <button onClick={() => setDeleteConfirm({...a, modo:'eliminar'})} style={{padding:'7px 12px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:11,cursor:'pointer'}}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop — tabla */}
        <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                {['Nombre','Responsable','Ubicacion','Stock','Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3 last:text-right">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-800/50">
                {almacenes.map(a => (
                  <tr key={a.id} className={`table-row-hover ${a.es_prueba ? 'bg-purple-900/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.es_prueba ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
                          {a.es_prueba ? <TestTube className="w-4 h-4 text-purple-400" /> : <Warehouse className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div>
                          <span className="text-white font-medium text-sm">{a.nombre}</span>
                          {a.es_prueba && <span className="ml-2 text-xs bg-purple-900/40 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full">Prueba</span>}
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
                            Limpiar
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
        )}