import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspaces,      setWorkspaces]      = useState([])
  const [activeId,        setActiveId]        = useState(null)
  const [loading,         setLoading]         = useState(true)

  // Load workspaces and restore active workspace on mount
  useEffect(() => {
    async function init() {
      const list = await window.nexus.workspace.list()

      if (list.length === 0) {
        // First launch — auto-create a default workspace
        const ws = await window.nexus.workspace.create('My Workspace')
        setWorkspaces([ws])
        setActiveId(ws.id)
        await window.nexus.setPref('activeWorkspaceId', ws.id)
      } else {
        setWorkspaces(list)
        const savedId = await window.nexus.getPref('activeWorkspaceId')
        const valid   = savedId && list.find(w => w.id === savedId)
        const id      = valid ? savedId : list[0].id
        setActiveId(id)
        if (!valid) await window.nexus.setPref('activeWorkspaceId', id)
      }
      setLoading(false)
    }
    init()
  }, [])

  const activeWorkspace = workspaces.find(w => w.id === activeId) ?? null

  const createWorkspace = useCallback(async (name) => {
    const ws = await window.nexus.workspace.create(name)
    setWorkspaces(p => [ws, ...p])
    setActiveId(ws.id)
    await window.nexus.setPref('activeWorkspaceId', ws.id)
    return ws
  }, [])

  const switchWorkspace = useCallback(async (id) => {
    setActiveId(id)
    await window.nexus.setPref('activeWorkspaceId', id)
    await window.nexus.workspace.touch(id)
    setWorkspaces(p => p.map(w => w.id === id ? { ...w, last_opened_at: Math.floor(Date.now() / 1000) } : w))
  }, [])

  const renameWorkspace = useCallback(async (id, name) => {
    await window.nexus.workspace.rename(id, name)
    setWorkspaces(p => p.map(w => w.id === id ? { ...w, name } : w))
  }, [])

  const deleteWorkspace = useCallback(async (id) => {
    await window.nexus.workspace.delete(id)
    const remaining = workspaces.filter(w => w.id !== id)
    setWorkspaces(remaining)
    if (activeId === id) {
      const next = remaining[0] ?? null
      const nextId = next?.id ?? null
      setActiveId(nextId)
      await window.nexus.setPref('activeWorkspaceId', nextId ?? '')
    }
  }, [workspaces, activeId])

  return (
    <WorkspaceContext.Provider value={{
      workspaces, activeId, activeWorkspace, loading,
      createWorkspace, switchWorkspace, renameWorkspace, deleteWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
