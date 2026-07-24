import { useEffect, useMemo, useState } from 'react'
import { Shield, Zap, Eye, Lock, Terminal, AlertTriangle, Cpu, Activity, Radio, CheckCircle2, XCircle, PanelRightOpen } from 'lucide-react'

interface LogEntry {
  timestamp: string;
  event: string;
  hash?: string;
  type: 'info' | 'warning' | 'danger';
}

interface SystemState {
  HARDWARE_ALIGNED?: boolean;
  LAST_EVIDENCE_HASH?: string;
  CONNECTION_AUDIT?: Record<string, string>;
  last_update?: number;
}

interface GraphNode {
  id: string;
  type?: string;
  intent?: string;
  biome?: string;
  raw?: string;
  lastEvent?: string;
}

interface NodeEvent {
  timestamp: number;
  node?: string;
  raw?: string;
  type?: string;
  intent?: string;
  biome?: string;
  steward?: {
    status?: string;
    decision?: string;
    destination?: string;
    classification?: StewardReview['classification'];
  };
}

interface GraphEdge {
  from: string;
  to: string;
  relation?: string;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups?: string[];
}

interface ProjectRecord {
  name: string;
  path?: string;
  status?: string;
  notes?: string;
}

type QueueFilter = 'all' | 'open' | 'approved' | 'rejected' | 'handled';
type TimelineFilter = 'all' | 'graph' | 'steward' | 'system';
type HubTab = 'hub' | 'dashboards' | 'projects' | 'layouts';

interface StewardReview {
  node: string;
  status: string;
  decision?: string;
  destination?: string;
  classification?: {
    intent?: string;
    biome?: string;
    confidence?: number;
    reasoning?: string;
    source?: string;
  };
}

function App() {
  const biomeColors: Record<string, string> = {
    cognition: '#00ff9d',
    infra: '#b78cff',
    governance: '#ffb347',
    memory: '#7dd3fc',
    execution: '#f97316',
    archive: '#4dabf7',
    folder: '#4dabf7',
    unknown: '#9ca3af',
  }

  const [isHardwareSynced, setIsHardwareSynced] = useState(false)
  const [isVisionLive, setIsVisionLive] = useState(false)
  const [isVaultLocked, setIsVaultLocked] = useState(false)
  const [systemState, setSystemState] = useState<SystemState | null>(null)
  const [graph, setGraph] = useState<GraphState>({ nodes: [], edges: [] })
  const [busLive, setBusLive] = useState(false)
  const [reviewQueue, setReviewQueue] = useState<StewardReview[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [nodeHistory, setNodeHistory] = useState<NodeEvent[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<HubTab>('hub')
  const [collapsedBiomes, setCollapsedBiomes] = useState<Set<string>>(new Set())
  const [dragNodeId, setDragNodeId] = useState<string | null>(null)
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [projectPositions, setProjectPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [projectRegistry, setProjectRegistry] = useState<ProjectRecord[]>([])
  const [projectGraph, setProjectGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })
  const [layoutRegistry, setLayoutRegistry] = useState<Array<{ name: string; label?: string; activeTab?: string; duplicatedFrom?: string; duplicatedAt?: string | null }>>([])
  const [projectNameInput, setProjectNameInput] = useState('')
  const [selectedLayoutName, setSelectedLayoutName] = useState('')
  const [compareLayoutName, setCompareLayoutName] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: 'STARTUP', event: 'Dashboard Initialized. Waiting for Orchestrator...', type: 'info' }
  ])
  const apiBase = import.meta.env.VITE_PARA_API_BASE || 'http://127.0.0.1:7444'
  const graphApiBase = import.meta.env.VITE_PARA_GRAPH_API_BASE || 'http://127.0.0.1:7445'

  useEffect(() => {
    try {
      fetch(`${graphApiBase}/ui-state`)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.uiState?.collapsedBiomes) {
            setCollapsedBiomes(new Set(data.uiState.collapsedBiomes))
          }
          if (data?.uiState?.manualPositions) {
            setManualPositions(data.uiState.manualPositions)
          }
          if (data?.uiState?.projectPositions) {
            setProjectPositions(data.uiState.projectPositions)
          }
          if (data?.uiState?.activeTab) {
            setActiveTab(data.uiState.activeTab as HubTab)
          }
        })
        .catch((err) => console.error('Failed to hydrate UI state', err))
    } catch (err) {
      console.error('Failed to hydrate UI state', err)
    }
  }, [])

  useEffect(() => {
    fetch(`${graphApiBase}/ui-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collapsedBiomes: Array.from(collapsedBiomes),
        manualPositions,
        projectPositions,
        activeTab,
      }),
    }).catch((err) => console.error('Persist UI state failed', err))
  }, [collapsedBiomes, manualPositions, projectPositions, activeTab, graphApiBase])

  useEffect(() => {
    const url = import.meta.env.VITE_PARA_BUS_URL || 'ws://localhost:7331'
    const ws = new WebSocket(url)

    ws.onopen = () => setBusLive(true)
    ws.onclose = () => setBusLive(false)
    ws.onerror = () => setBusLive(false)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'INIT' && msg.data) {
          setGraph(msg.data)
          addLog('Connected to Parakletos Graph Bus', 'info')
        }
        if (msg.type === 'GRAPH_EVENT' && msg.data?.graph) {
          setGraph(msg.data.graph)
          addLog(`Graph event: ${msg.data.type} :: ${msg.data.node}`, 'info')
          setNodeHistory((prev) => [
            {
              timestamp: Date.now(),
              node: msg.data.node,
              raw: msg.data.raw,
              type: msg.data.type,
              intent: msg.data.intent,
              biome: msg.data.biome,
              steward: msg.data.steward,
            },
            ...prev,
          ].slice(0, 80))
          const steward = msg.data.steward
          if (steward) {
            if (steward.status === 'review' || steward.status === 'dry_run' || steward.status === 'approved' || steward.status === 'rejected') {
              setReviewQueue((prev) => {
                const next = {
                  node: msg.data.node,
                  status: steward.status,
                  decision: steward.decision,
                  destination: steward.destination,
                  classification: steward.classification,
                }
                const withoutNode = prev.filter((item) => item.node !== msg.data.node)
                return [next, ...withoutNode].slice(0, 20)
              })
            }
            if (steward.status === 'moved') {
              addLog(`Moved: ${msg.data.node} → ${steward.destination}`, 'warning')
            }
          }
        }
      } catch (err) {
        console.error('Bus parse failed', err)
      }
    }

    return () => ws.close()
  }, [])

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [snapshotResponse, historyResponse] = await Promise.all([
          fetch(`${graphApiBase}/snapshot`),
          fetch(`${graphApiBase}/history`),
        ])

        if (snapshotResponse.ok) {
          const data = await snapshotResponse.json()
          if (data?.graph) {
            setGraph(data.graph)
          }
          if (data?.projectGraph) {
            setProjectGraph({
              nodes: Array.isArray(data.projectGraph.nodes) ? data.projectGraph.nodes : [],
              edges: Array.isArray(data.projectGraph.edges) ? data.projectGraph.edges : [],
            })
          }
        }

        if (historyResponse.ok) {
          const data = await historyResponse.json()
          const items = Array.isArray(data?.items) ? data.items : []
          const hydrated = items
            .filter((entry) => entry?.type === 'GRAPH_EVENT' && entry?.payload)
            .map((entry) => ({
              timestamp: entry.timestamp || Date.now(),
              node: entry.payload.node,
              raw: entry.payload.raw,
              type: entry.payload.type,
              intent: entry.payload.intent,
              biome: entry.payload.biome,
              steward: entry.payload.steward,
            }))
          setNodeHistory(hydrated.slice(0, 80))
        }

        const projectsResponse = await fetch(`${graphApiBase}/projects`)
        const layoutsResponse = await fetch(`${graphApiBase}/layouts`)
        const projectStateResponse = await fetch(`${graphApiBase}/ui-state`)
        if (projectsResponse.ok) {
          const data = await projectsResponse.json()
          setProjectRegistry(Array.isArray(data?.projects) ? data.projects : [])
        }
        if (projectStateResponse.ok) {
          const data = await projectStateResponse.json()
          if (data?.uiState?.projectPositions) {
            setProjectPositions(data.uiState.projectPositions)
          }
        }
        if (layoutsResponse.ok) {
          const data = await layoutsResponse.json()
          setLayoutRegistry(Array.isArray(data?.layouts) ? data.layouts : [])
          if (!selectedLayoutName && Array.isArray(data?.layouts) && data.layouts[0]?.name) {
            setSelectedLayoutName(data.layouts[0].name)
          }
        }
      } catch (err) {
        console.error('Graph hydration failed', err)
      }
    }

    void hydrate()
  }, [graphApiBase])

  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch('/state.json')
        if (response.ok) {
          const data: SystemState = await response.json()
          
          // Update hardware status
          if (data.HARDWARE_ALIGNED !== undefined) {
            setIsHardwareSynced(data.HARDWARE_ALIGNED)
          }

          // Update connection audit (Vision status)
          if (data.CONNECTION_AUDIT) {
            setIsVisionLive(data.CONNECTION_AUDIT['Vision']?.includes('LIVE') || false)
          }

          // Detect new hash events
          if (data.LAST_EVIDENCE_HASH && data.LAST_EVIDENCE_HASH !== systemState?.LAST_EVIDENCE_HASH) {
            addLog('New Evidence Anchored to Truth Vault', 'info', data.LAST_EVIDENCE_HASH)
          }

          setSystemState(data)
        }
      } catch (e) {
        console.error('State fetch failed:', e)
      }
    }

    const interval = setInterval(fetchState, 2000)
    return () => clearInterval(interval)
  }, [systemState])

  const addLog = (event: string, type: 'info' | 'warning' | 'danger' = 'info', hash?: string) => {
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false })
    setLogs(prev => {
      // Don't duplicate logs if the event and hash are the same
      if (prev.length > 0 && prev[0].event === event && prev[0].hash === hash) return prev
      return [{ timestamp, event, type, hash }, ...prev].slice(0, 50)
    })
  }

  const handleShutdown = () => {
    if (confirm('CRITICAL: Execute Cease & Shut Down Protocol? This will wipe session keys and lock the ShardRegistry.')) {
      setIsVaultLocked(true)
      addLog('CEASE & SHUT DOWN TRIGGERED BY USER', 'danger')
      // Note: In real setup, this would call an API endpoint on the orchestrator
    }
  }

  const persistReviewDecision = async (item: StewardReview, outcome: 'approve' | 'reject') => {
    try {
      await fetch(`${apiBase}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: item.node,
          outcome,
          decision: item.decision,
          destination: item.destination,
          classification: item.classification,
        }),
      })
    } catch (err) {
      console.error('Review ledger write failed', err)
    }
  }

  const handleReviewAction = async (node: StewardReview, outcome: 'approve' | 'reject') => {
    const status = outcome === 'approve' ? 'approved' : 'rejected'
    await persistReviewDecision(node, outcome)
    setReviewQueue((prev) => prev.map((item) => item.node === node.node ? { ...item, status } : item))
    addLog(`${outcome.toUpperCase()} review: ${node.node}`, outcome === 'approve' ? 'warning' : 'danger')
  }

  const handleMarkHandled = async (node: StewardReview) => {
    await fetch(`${apiBase}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node: node.node,
        outcome: 'handled',
        decision: node.decision,
        destination: node.destination,
        classification: node.classification,
      }),
    }).catch((err) => console.error('Handled write failed', err))

    setReviewQueue((prev) => prev.map((item) => item.node === node.node ? { ...item, status: 'handled' } : item))
    addLog(`HANDLED: ${node.node}`, 'info')
  }

  const refreshProjects = async () => {
    const [response, snapshotResponse] = await Promise.all([
      fetch(`${graphApiBase}/projects`),
      fetch(`${graphApiBase}/snapshot`),
    ])
    if (response.ok) {
      const data = await response.json()
      setProjectRegistry(Array.isArray(data?.projects) ? data.projects : [])
    }
    if (snapshotResponse.ok) {
      const data = await snapshotResponse.json()
      if (data?.projectGraph) {
        setProjectGraph({
          nodes: Array.isArray(data.projectGraph.nodes) ? data.projectGraph.nodes : [],
          edges: Array.isArray(data.projectGraph.edges) ? data.projectGraph.edges : [],
        })
      }
    }
  }

  const refreshLayouts = async () => {
    const response = await fetch(`${graphApiBase}/layouts`)
    if (response.ok) {
      const data = await response.json()
      setLayoutRegistry(Array.isArray(data?.layouts) ? data.layouts : [])
    }
  }

  const renameLayout = async (name: string) => {
    const nextName = window.prompt('Rename layout to:', name)
    if (!nextName || nextName === name) return
    const response = await fetch(`${graphApiBase}/layouts/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: name, to: nextName }),
    })
    if (response.ok) {
      await refreshLayouts()
      if (selectedLayoutName === name) setSelectedLayoutName(nextName)
      if (compareLayoutName === name) setCompareLayoutName(nextName)
      addLog(`Layout renamed: ${name} → ${nextName}`, 'info')
    }
  }

  const deleteLayout = async (name: string) => {
    if (!window.confirm(`Delete layout "${name}"?`)) return
    const response = await fetch(`${graphApiBase}/layouts/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (response.ok) {
      await refreshLayouts()
      if (selectedLayoutName === name) setSelectedLayoutName('')
      if (compareLayoutName === name) setCompareLayoutName('')
      addLog(`Layout deleted: ${name}`, 'warning')
    }
  }

  const addProject = async () => {
    const name = projectNameInput.trim()
    if (!name) return
    await fetch(`${graphApiBase}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', name, status: 'active' }),
    })
    setProjectNameInput('')
    await refreshProjects()
  }

  const removeProject = async (name: string) => {
    await fetch(`${graphApiBase}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', name }),
    })
    await refreshProjects()
  }

  const queueChips: QueueFilter[] = ['all', 'open', 'approved', 'rejected', 'handled']

  const filteredReviewQueue = useMemo(() => {
    return reviewQueue.filter((item) => {
      if (queueFilter === 'all') return true
      if (queueFilter === 'open') return item.status === 'review' || item.status === 'dry_run'
      if (queueFilter === 'approved') return item.status === 'approved' || item.status === 'handled'
      return item.status === queueFilter
    })
  }, [reviewQueue, queueFilter])

  const nodeCounts = useMemo(() => {
    return graph.nodes.reduce<Record<string, number>>((acc, node) => {
      const key = node.biome || node.type || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [graph.nodes])

  const graphLayout = useMemo(() => {
    const width = 760
    const height = 360
    const nodes = graph.nodes.slice(0, 28).filter((node) => !collapsedBiomes.has((node.biome || node.type || 'unknown').toLowerCase()))
    const groups = ['cognition', 'infra', 'governance', 'memory', 'execution', 'archive']
    const groupIndex = (node: GraphNode) => {
      const key = (node.biome || node.type || 'archive').toLowerCase()
      const idx = groups.indexOf(key)
      return idx >= 0 ? idx : groups.length - 1
    }

    const positioned = nodes.map((node, index) => {
      const column = groupIndex(node)
      const groupNodes = nodes.filter((candidate) => groupIndex(candidate) === column)
      const row = groupNodes.findIndex((candidate) => candidate.id === node.id)
      const x = 100 + column * 105 + (index % 2) * 12
      const y = 55 + row * 42 + (column % 2) * 8
      const override = manualPositions[node.id]
      return {
        ...node,
        x: override?.x ?? x,
        y: override?.y ?? y,
      }
    })

    const lookup = new Map(positioned.map((node) => [node.id, node]))
    const edges = graph.edges
      .map((edge) => {
        const from = lookup.get(edge.from)
        const to = lookup.get(edge.to)
        if (!from || !to) return null
        return { ...edge, fromNode: from, toNode: to }
      })
      .filter(Boolean)

    return { width, height, nodes: positioned, edges, groups }
  }, [graph.nodes, graph.edges, collapsedBiomes, manualPositions])

  const mergedProjectGraph = useMemo(() => {
    const projectNodeLookup = new Map<string, GraphNode>()
    const nodes = projectGraph.nodes.map((node, index) => {
      const rendered = {
        ...node,
        x: projectPositions[node.id]?.x ?? (node as GraphNode & { x?: number }).x ?? 70 + (index % 3) * 110,
        y: projectPositions[node.id]?.y ?? (node as GraphNode & { y?: number }).y ?? 42 + Math.floor(index / 3) * 42,
      }
      projectNodeLookup.set(rendered.id, rendered)
      return rendered
    })
    const edges = projectGraph.edges
      .map((edge) => {
        const fromNode = projectNodeLookup.get(edge.from) || graphLayout.nodes.find((node) => node.id === edge.from)
        const toNode = projectNodeLookup.get(edge.to) || graphLayout.nodes.find((node) => node.id === edge.to)
        if (!fromNode || !toNode) return null
        return { ...edge, fromNode, toNode }
      })
      .filter(Boolean)
    return { nodes, edges }
  }, [projectGraph, projectPositions, graphLayout.nodes])

  const projectNodePositions = useMemo(() => (
    Object.fromEntries(
      mergedProjectGraph.nodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])
    )
  ), [mergedProjectGraph.nodes])

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null
    return graph.nodes.find((node) => node.id === selectedNode.id) || selectedNode
  }, [graph.nodes, selectedNode])

  const selectedNodeHistory = useMemo(() => {
    if (!selectedNodeDetails) return []
    const filtered = nodeHistory.filter((event) => {
      const matchesNode = event.node === selectedNodeDetails.id || event.raw?.includes(selectedNodeDetails.id)
      if (!matchesNode) return false
      if (timelineFilter !== 'all') {
        if (timelineFilter === 'graph' && !(event.type?.includes('GRAPH') || event.type?.includes('file') || event.type?.includes('dir'))) return false
        if (timelineFilter === 'steward' && !event.steward) return false
        if (timelineFilter === 'system' && event.steward) return false
      }
      if (!historyQuery.trim()) return true
      const haystack = [
        event.type,
        event.intent,
        event.biome,
        event.node,
        event.raw,
        event.steward?.status,
        event.steward?.decision,
        event.steward?.destination,
        event.steward?.classification?.reasoning,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(historyQuery.toLowerCase())
    })
    return filtered.slice(0, 12)
  }, [nodeHistory, selectedNodeDetails, historyQuery, timelineFilter])

  const selectAdjacentNode = (direction: -1 | 1) => {
    if (graph.nodes.length === 0) return
    const currentIndex = selectedNodeDetails
      ? graph.nodes.findIndex((node) => node.id === selectedNodeDetails.id)
      : -1
    const nextIndex = currentIndex >= 0
      ? (currentIndex + direction + graph.nodes.length) % graph.nodes.length
      : 0
    setSelectedNode(graph.nodes[nextIndex])
  }

  const toggleBiome = (biome: string) => {
    setCollapsedBiomes((prev) => {
      const next = new Set(prev)
      if (next.has(biome)) next.delete(biome)
      else next.add(biome)
      return next
    })
  }

  const resetLayout = () => {
    setCollapsedBiomes(new Set())
    setManualPositions({})
    setProjectPositions({})
    setSelectedNode(null)
    addLog('Layout reset', 'info')
  }

  const simulateAction = () => {
    fetch(`${graphApiBase}/synthetic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'synthetic_pulse',
        intent: 'simulation',
        biome: 'memory',
        raw: 'synthetic://parakletos/pulse',
      }),
    }).catch((err) => console.error('Synthetic event failed', err))
    addLog('Synthetic graph event requested', 'info')
  }

  const duplicateLayout = async () => {
    const name = window.prompt('Duplicate layout as:', `lotus-${new Date().getTime()}`)
    if (!name) return
    const response = await fetch(`${graphApiBase}/ui-state/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, from: activeTab }),
    })
    if (response.ok) {
      addLog(`Layout duplicated: ${name}`, 'info')
      await refreshLayouts()
    }
  }

  const applyLayout = async (name: string) => {
    if (!name) return
    const response = await fetch(`${graphApiBase}/ui-state/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (response.ok) {
      const data = await response.json()
      if (data?.uiState?.collapsedBiomes) {
        setCollapsedBiomes(new Set(data.uiState.collapsedBiomes))
      }
      if (data?.uiState?.manualPositions) {
        setManualPositions(data.uiState.manualPositions)
      }
      if (data?.uiState?.activeTab) {
        setActiveTab(data.uiState.activeTab as HubTab)
      }
      addLog(`Layout applied: ${name}`, 'info')
    }
  }

  const copyCurrentToNewLayout = async () => {
    const name = window.prompt('Copy current layout as:', `copy-${new Date().getTime()}`)
    if (!name) return
    const response = await fetch(`${graphApiBase}/ui-state/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, from: 'current' }),
    })
    if (response.ok) {
      await refreshLayouts()
      setSelectedLayoutName(name)
      setCompareLayoutName(name)
      addLog(`Copied current layout as ${name}`, 'info')
    }
  }

  const [compareLayoutData, setCompareLayoutData] = useState<{ collapsedBiomes?: string[]; manualPositions?: Record<string, { x: number; y: number }>; projectPositions?: Record<string, { x: number; y: number }>; activeTab?: HubTab } | null>(null)
  const [projectLayoutHistory, setProjectLayoutHistory] = useState<Array<{ timestamp: string; manualPositions?: Record<string, { x: number; y: number }>; projectPositions?: Record<string, { x: number; y: number }>; activeTab?: string }>>([])

  useEffect(() => {
    const loadCompareLayout = async () => {
      if (!compareLayoutName) {
        setCompareLayoutData(null)
        return
      }
      const response = await fetch(`${graphApiBase}/layout?name=${encodeURIComponent(compareLayoutName)}`)
      if (response.ok) {
        const data = await response.json()
        setCompareLayoutData(data?.layout || null)
      }
    }
    void loadCompareLayout()
  }, [compareLayoutName, graphApiBase])

  useEffect(() => {
    const loadProjectLayoutHistory = async () => {
      const response = await fetch(`${graphApiBase}/ui-state/history`)
      if (response.ok) {
        const data = await response.json()
        setProjectLayoutHistory(Array.isArray(data?.history) ? data.history : [])
      }
    }
    void loadProjectLayoutHistory()
  }, [graphApiBase, projectPositions, manualPositions, activeTab])

  const compareSummary = useMemo(() => {
    if (!compareLayoutData) return null
    const savedCollapsed = new Set(compareLayoutData.collapsedBiomes || [])
    const currentCollapsed = new Set(collapsedBiomes)
    const savedManual = compareLayoutData.manualPositions || {}
    const currentManual = manualPositions
    const savedProject = compareLayoutData.projectPositions || {}
    const currentProject = projectPositions

    return {
      tab: {
        saved: compareLayoutData.activeTab || 'hub',
        current: activeTab,
      },
      collapsed: {
        saved: Array.from(savedCollapsed),
        current: Array.from(currentCollapsed),
      },
      manual: {
        saved: Object.keys(savedManual),
        current: Object.keys(currentManual),
      },
      project: {
        saved: Object.keys(savedProject),
        current: Object.keys(currentProject),
      },
    }
  }, [compareLayoutData, activeTab, collapsedBiomes, manualPositions, projectPositions])

  const layoutDeltaBars = useMemo(() => {
    if (!compareSummary) return null
    const rows = [
      {
        label: 'Collapsed biomes',
        saved: compareSummary.collapsed.saved.length,
        current: compareSummary.collapsed.current.length,
      },
      {
        label: 'Manual nodes',
        saved: compareSummary.manual.saved.length,
        current: compareSummary.manual.current.length,
      },
      {
        label: 'Project nodes',
        saved: compareSummary.project.saved.length,
        current: compareSummary.project.current.length,
      },
    ]
    const max = Math.max(...rows.flatMap((row) => [row.saved, row.current]), 1)
    return rows.map((row) => ({
      ...row,
      savedPct: Math.max(6, (row.saved / max) * 100),
      currentPct: Math.max(6, (row.current / max) * 100),
    }))
  }, [compareSummary])

  const exportLayout = async () => {
    const payload = {
      collapsedBiomes: Array.from(collapsedBiomes),
      manualPositions,
      projectPositions,
      activeTab,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'parakletos-layout.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importLayout = async (file: File) => {
    const text = await file.text()
    const payload = JSON.parse(text)
    if (Array.isArray(payload.collapsedBiomes)) {
      setCollapsedBiomes(new Set(payload.collapsedBiomes))
    }
    if (payload.manualPositions) {
      setManualPositions(payload.manualPositions)
    }
    if (payload.projectPositions) {
      setProjectPositions(payload.projectPositions)
    }
    if (payload.activeTab) {
      setActiveTab(payload.activeTab)
    }
  }

  const startDrag = (nodeId: string) => {
    setDragNodeId(nodeId)
  }

  const updateDrag = (event: React.PointerEvent<SVGGElement>, node: GraphNode) => {
    if (dragNodeId !== node.id) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const coords = point.matrixTransform(ctm.inverse())
    const update = { x: coords.x, y: coords.y }
    if (node.id.startsWith('project/')) {
      setProjectPositions((prev) => ({ ...prev, [node.id]: update }))
      return
    }
    setManualPositions((prev) => ({
      ...prev,
      [node.id]: update,
    }))
  }

  const endDrag = () => {
    setDragNodeId(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

      if (event.key === 'Escape') {
        setSelectedNode(null)
        setCommandPaletteOpen(false)
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen((open) => !open)
        return
      }

      if (event.key.toLowerCase() === 'l') {
        event.preventDefault()
        resetLayout()
        return
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        simulateAction()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        selectAdjacentNode(-1)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        selectAdjacentNode(1)
        return
      }

      if ((event.key === 'j' || event.key === 'ArrowDown') && reviewQueue.length > 0) {
        event.preventDefault()
        setReviewQueue((prev) => prev.slice(1).concat(prev[0]).slice(0, prev.length))
        return
      }

      if ((event.key === 'k' || event.key === 'ArrowUp') && reviewQueue.length > 0) {
        event.preventDefault()
        setReviewQueue((prev) => {
          const copy = [...prev]
          const last = copy.pop()
          return last ? [last, ...copy] : copy
        })
        return
      }

      if ((event.key === 'a' || event.key === 'A') && reviewQueue[0]) {
        event.preventDefault()
        void handleReviewAction(reviewQueue[0], 'approve')
        return
      }

      if ((event.key === 'r' || event.key === 'R') && reviewQueue[0]) {
        event.preventDefault()
        void handleReviewAction(reviewQueue[0], 'reject')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reviewQueue, graph.nodes, selectedNodeDetails])

  return (
    <div className="grid-layout">
      {/* Header */}
      <header style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="glow-text" style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={28} /> PARAKLETOS-SHARD :: COMMAND CENTER
        </h1>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={`status-indicator ${!isHardwareSynced ? 'offline' : ''}`}></span>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              HARDWARE QUORUM: {isHardwareSynced ? '2/2 ALIGNED' : 'DISCONNECTED'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={`status-indicator ${!isVisionLive ? 'offline' : ''}`}></span>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              VISION TETHER: {isVisionLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} color={busLive ? '#00ff9d' : '#888'} />
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              GRAPH BUS: {busLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <button onClick={resetLayout} style={{ fontSize: '0.72rem' }}>Reset Layout</button>
          <button onClick={duplicateLayout} style={{ fontSize: '0.72rem' }}>Duplicate Layout</button>
          <button onClick={exportLayout} style={{ fontSize: '0.72rem' }}>Export Layout</button>
          <label style={{ fontSize: '0.72rem', cursor: 'pointer' }}>
            Import Layout
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importLayout(file)
              }}
            />
          </label>
          <button onClick={simulateAction} style={{ fontSize: '0.72rem' }}>Simulate</button>
        </div>
      </header>

      <section style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
        {(['hub', 'dashboards', 'projects', 'layouts'] as HubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontSize: '0.75rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.14)',
              background: activeTab === tab ? 'rgba(0,209,255,0.22)' : 'rgba(255,255,255,0.04)',
            }}
          >
            {tab}
          </button>
        ))}
      </section>

      <section style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.5rem' }}>
        {activeTab === 'hub' ? (
          <>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>NODE COUNT</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{graph.nodes.length}</div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>ACTIVE QUEUE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{filteredReviewQueue.length}</div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>LAYOUT MODE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Lotus</div>
            </div>
          </>
        ) : null}
        {activeTab === 'dashboards' ? (
          <>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>LIVE VIEW</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Command Center</div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>SIMULATION</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Enabled</div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>ACTIONS</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Review / Drag / Fold</div>
            </div>
          </>
        ) : null}
        {activeTab === 'projects' ? (
          <>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>PROJECT</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Project Registry</div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.5rem' }}>REGISTERED PROJECTS</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  placeholder="New project name"
                  style={{ flex: 1 }}
                />
                <button onClick={addProject}>Add</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                {projectRegistry.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '0.85rem' }}>No registry entries yet.</div>
                ) : (
                  projectRegistry.map((project, index) => (
                    <div key={`${project.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontFamily: 'monospace' }}>{project.name}</span>
                      <span style={{ color: '#888', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {project.status || 'active'}
                        <button onClick={() => removeProject(project.name)} style={{ fontSize: '0.68rem' }}>Remove</button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>SOURCE</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Backend-synced</div>
            </div>
          </>
        ) : null}
        {activeTab === 'layouts' ? (
          <>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>LAYOUT</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Saved Layouts</div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.5rem' }}>REGISTRY</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <select
                  value={selectedLayoutName}
                  onChange={(e) => setSelectedLayoutName(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Select layout</option>
                  {layoutRegistry.map((layout) => (
                    <option key={layout.name} value={layout.name}>
                      {layout.label || layout.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => void applyLayout(selectedLayoutName)} disabled={!selectedLayoutName}>Apply</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto', fontSize: '0.82rem' }}>
                {layoutRegistry.length === 0 ? (
                  <div style={{ color: '#666' }}>No saved layouts yet.</div>
                ) : (
                  layoutRegistry.map((layout) => (
                    <div
                      key={layout.name}
                      style={{
                        textAlign: 'left',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '8px',
                        border: selectedLayoutName === layout.name ? '1px solid rgba(0,255,157,0.45)' : '1px solid rgba(255,255,255,0.08)',
                        background: selectedLayoutName === layout.name ? 'rgba(0,255,157,0.08)' : 'rgba(0,0,0,0.18)',
                      }}
                    >
                      <button onClick={() => setSelectedLayoutName(layout.name)} style={{ width: '100%', textAlign: 'left', padding: 0, background: 'transparent', border: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace' }}>{layout.label || layout.name}</span>
                        <span style={{ color: '#888' }}>{layout.activeTab || 'hub'}</span>
                      </div>
                      <div style={{ color: '#666', fontSize: '0.72rem' }}>
                        {layout.duplicatedFrom ? `from ${layout.duplicatedFrom}` : 'current'}
                        {layout.duplicatedAt ? ` · ${new Date(layout.duplicatedAt).toLocaleString()}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                        <button onClick={() => void applyLayout(layout.name)} style={{ fontSize: '0.68rem' }}>Apply</button>
                        <button onClick={() => void renameLayout(layout.name)} style={{ fontSize: '0.68rem' }}>Rename</button>
                        <button onClick={() => void deleteLayout(layout.name)} style={{ fontSize: '0.68rem' }}>Delete</button>
                        <button onClick={() => setCompareLayoutName(layout.name)} style={{ fontSize: '0.68rem' }}>Compare</button>
                      </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>ACTIONS</div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Duplicate / Restore</div>
              <button onClick={() => void copyCurrentToNewLayout()} style={{ marginTop: '0.5rem', fontSize: '0.72rem' }}>Copy current to new layout</button>
            </div>
            <div className="terminal-panel" style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.5rem' }}>COMPARE</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select value={compareLayoutName} onChange={(e) => setCompareLayoutName(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Choose layout to compare</option>
                  {layoutRegistry.map((layout) => (
                    <option key={layout.name} value={layout.name}>{layout.label || layout.name}</option>
                  ))}
                </select>
                <button onClick={() => void refreshLayouts()}>Refresh</button>
              </div>
              {compareSummary && layoutDeltaBars ? (
                <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.78rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.6rem', background: 'rgba(0,0,0,0.18)' }}>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>SAVED</div>
                      <div style={{ color: '#fff' }}>{compareSummary.tab.saved}</div>
                    </div>
                    <div style={{ border: '1px solid rgba(0,255,157,0.18)', borderRadius: '10px', padding: '0.6rem', background: 'rgba(0,255,157,0.05)' }}>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>CURRENT</div>
                      <div style={{ color: '#fff' }}>{compareSummary.tab.current}</div>
                    </div>
                  </div>

                  {layoutDeltaBars.map((row) => (
                    <div key={row.label} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.65rem', background: 'rgba(0,0,0,0.16)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '0.4rem' }}>
                        <div style={{ color: '#00d1ff' }}>{row.label}</div>
                        <div style={{ color: '#888' }}>{row.saved} → {row.current}</div>
                      </div>
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px', alignItems: 'center', gap: '0.45rem' }}>
                          <div style={{ color: '#888' }}>Saved</div>
                          <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${row.savedPct}%`, height: '100%', background: 'linear-gradient(90deg, rgba(255,179,71,0.95), rgba(255,255,255,0.2))' }} />
                          </div>
                          <div style={{ textAlign: 'right', color: '#ddd' }}>{row.saved}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px', alignItems: 'center', gap: '0.45rem' }}>
                          <div style={{ color: '#888' }}>Current</div>
                          <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${row.currentPct}%`, height: '100%', background: 'linear-gradient(90deg, rgba(0,255,157,0.95), rgba(125,211,252,0.4))' }} />
                          </div>
                          <div style={{ textAlign: 'right', color: '#ddd' }}>{row.current}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {row.current > row.saved ? <span style={{ color: '#00ff9d' }}>expanded</span> : null}
                        {row.current < row.saved ? <span style={{ color: '#ffb347' }}>reduced</span> : null}
                        {row.current === row.saved ? <span style={{ color: '#888' }}>stable</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: '0.78rem' }}>Pick a saved layout to compare state.</div>
              )}
            </div>
          </>
        ) : null}
      </section>

      {/* Sidebar: System Controls */}
      <aside className="terminal-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#00d1ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} /> INFRASTRUCTURE
          </h2>
          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>MBP (Node Alpha)</span>
              <span style={{ color: isHardwareSynced ? '#00ff9d' : '#888' }}>{isHardwareSynced ? 'MASTER' : 'OFFLINE'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>MBA (Node Beta)</span>
              <span style={{ color: isHardwareSynced ? '#00ff9d' : '#888' }}>{isHardwareSynced ? 'SIGNER' : 'OFFLINE'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Thunderbolt Bridge</span>
              <span style={{ color: isHardwareSynced ? '#00ff9d' : '#888' }}>{isHardwareSynced ? 'ACTIVE' : 'PENDING'}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#00d1ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={16} /> CONTEXT MODE
          </h2>
          <div style={{ fontSize: '0.8rem', backgroundColor: '#111', padding: '0.5rem', borderRadius: '4px' }}>
            <div style={{ color: '#888', marginBottom: '4px' }}>MODE:</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Context-only operation</div>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <button 
            className="danger-btn" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={handleShutdown}
            disabled={isVaultLocked}
          >
            <AlertTriangle size={16} /> {isVaultLocked ? 'SYSTEM LOCKED' : 'CEASE & SHUT DOWN'}
          </button>
        </div>
      </aside>

      {/* Main Content: Live Feed & Map */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="terminal-panel" style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '400px' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Eye size={12} color="#00ff9d" /> SENTRY FEED :: HICKORY_GROVE_01
            </div>
          </div>

          <svg viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} style={{ width: '100%', height: '100%', backgroundColor: '#111' }}>
            <defs>
              <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00d1ff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#00ff9d" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {graphLayout.groups.map((group, index) => (
              <text
                key={group}
                x={92 + index * 105}
                y={18}
                fill={biomeColors[group] || biomeColors.unknown}
                fontSize="10"
                fontFamily="monospace"
                opacity={0.95}
              >
                {group.toUpperCase()}
              </text>
            ))}
            {[...graphLayout.edges, ...mergedProjectGraph.edges].map((edge, index) => (
              <line
                key={`${edge.from}-${edge.to}-${index}`}
                x1={edge.fromNode?.x ?? 0}
                y1={edge.fromNode?.y ?? 0}
                x2={edge.toNode?.x ?? 0}
                y2={edge.toNode?.y ?? 0}
                stroke="url(#edgeGlow)"
                strokeWidth={1.5}
                opacity={0.7}
              />
            ))}
            {[...graphLayout.nodes, ...mergedProjectGraph.nodes].map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedNode(node)}
                onPointerDown={() => startDrag(node.id)}
                onPointerMove={(event) => updateDrag(event, node)}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
              >
                <circle
                  r={node.type === 'folder' ? 16 : 11}
                  fill={biomeColors[node.biome || node.type || 'unknown'] || biomeColors.unknown}
                  opacity={0.95}
                />
                {selectedNodeDetails?.id === node.id ? (
                  <circle r={20} fill="none" stroke="#00ff9d" strokeWidth={1.5} strokeOpacity={0.95} />
                ) : null}
                <text
                  x={16}
                  y={4}
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="monospace"
                  paintOrder="stroke"
                  stroke="#111"
                  strokeWidth="2"
                >
                  {node.id.split('/').pop()}
                </text>
              </g>
            ))}
            <circle cx={graphLayout.width / 2} cy={graphLayout.height / 2} r={32} fill="none" stroke="#00d1ff" strokeOpacity="0.18" />
            <circle cx={graphLayout.width / 2} cy={graphLayout.height / 2} r={6} fill="#00d1ff" opacity={busLive ? 1 : 0.3} />
          </svg>
        </div>

        <div className="terminal-panel" style={{ height: '200px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#00ff9d', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} /> TRUTH VAULT LOGS
          </h2>
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', color: '#aaa' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px', borderLeft: `2px solid ${log.type === 'danger' ? '#ff3e3e' : log.type === 'warning' ? '#ffcc00' : '#00ff9d'}`, paddingLeft: '8px' }}>
                <span style={{ color: '#555' }}>[{log.timestamp}]</span> {log.event}
                {log.hash && <div style={{ color: '#00d1ff', fontSize: '0.7rem' }}>HASH: {log.hash}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.75rem', fontSize: '0.7rem' }}>
            {Object.entries(biomeColors).slice(0, 6).map(([key, color]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', background: color, display: 'inline-block', borderRadius: '999px' }} />
                <span style={{ color: '#aaa' }}>{key}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Right Sidebar: Agent Registry */}
      <aside className="terminal-panel">
        <h2 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#00d1ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} /> WORKFORCE (120)
        </h2>
        <div style={{ marginBottom: '1rem', fontSize: '0.75rem', color: '#aaa' }}>
          {Object.entries(nodeCounts).map(([key, count]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => toggleBiome(key)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: biomeColors[key] || biomeColors.unknown, fontSize: '0.72rem' }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: biomeColors[key] || biomeColors.unknown, display: 'inline-block' }} />
                <span>{collapsedBiomes.has(key) ? '+' : '−'} {key}</span>
              </button>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.75rem', color: '#00d1ff', marginBottom: '0.5rem' }}>REVIEW QUEUE</h3>
          <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.5rem' }}>
            Shortcuts: <span style={{ color: '#aaa' }}>A</span> approve, <span style={{ color: '#aaa' }}>R</span> reject, <span style={{ color: '#aaa' }}>J/K</span> queue, <span style={{ color: '#aaa' }}>←/→</span> nodes, <span style={{ color: '#aaa' }}>Cmd/Ctrl+K</span> palette, <span style={{ color: '#aaa' }}>Esc</span> close
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {queueChips.map((item) => (
              <button
                key={item}
                onClick={() => setQueueFilter(item)}
                style={{
                  fontSize: '0.68rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: queueFilter === item ? 'rgba(0,209,255,0.22)' : 'rgba(255,255,255,0.04)',
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
            {filteredReviewQueue.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: '#666' }}>No steward reviews pending.</div>
            ) : (
              filteredReviewQueue.map((item, index) => (
                <div key={`${item.node}-${index}`} style={{ fontSize: '0.72rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.5rem', background: 'rgba(0,0,0,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: '#fff' }}>{item.node}</span>
                    <span style={{ color: item.status === 'review' || item.status === 'dry_run' ? '#ffcc00' : item.status === 'approved' ? '#00ff9d' : '#ff6b6b' }}>{item.status}</span>
                  </div>
                  <div style={{ color: '#888' }}>
                    {item.classification?.biome || 'unknown'} · {Math.round((item.classification?.confidence || 0) * 100)}%
                  </div>
                  <div style={{ color: '#666' }}>{item.classification?.reasoning}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                    <button onClick={() => handleReviewAction(item, 'approve')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button onClick={() => handleReviewAction(item, 'reject')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={14} /> Reject
                    </button>
                    <button onClick={() => handleMarkHandled(item)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Handled
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
          {Array.from({ length: 120 }).map((_, i) => (
            <div 
              key={i} 
              style={{ 
                aspectRatio: '1/1', 
                backgroundColor: i < (isHardwareSynced ? 4 : 0) ? 'rgba(0, 255, 157, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '2px'
              }}
              title={`Agent #${i} Status: ${i < 4 ? 'AUTHORIZED' : 'PENDING'}`}
            ></div>
          ))}
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#888' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: 'rgba(0, 255, 157, 0.4)' }}></div>
            <span>AUTHORIZED SHARD NODES</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}></div>
            <span>PENDING REGISTRATION</span>
          </div>
        </div>
      </aside>

      {selectedNodeDetails ? (
        <aside style={{ gridColumn: '1 / -1', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', background: 'rgba(0,0,0,0.35)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#00d1ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PanelRightOpen size={16} /> NODE DETAILS
            </h2>
            <button onClick={() => setSelectedNode(null)}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', fontSize: '0.82rem' }}>
            <div>
              <div style={{ color: '#888' }}>ID</div>
              <div style={{ fontFamily: 'monospace' }}>{selectedNodeDetails.id}</div>
            </div>
            <div>
              <div style={{ color: '#888' }}>TYPE</div>
              <div>{selectedNodeDetails.type || 'unknown'}</div>
            </div>
            <div>
              <div style={{ color: '#888' }}>BIOME</div>
              <div>{selectedNodeDetails.biome || 'unknown'}</div>
            </div>
            <div>
              <div style={{ color: '#888' }}>INTENT</div>
              <div>{selectedNodeDetails.intent || 'unknown'}</div>
            </div>
            <div>
              <div style={{ color: '#888' }}>LAST EVENT</div>
              <div>{selectedNodeDetails.lastEvent || 'unknown'}</div>
            </div>
            <div>
              <div style={{ color: '#888' }}>RAW PATH</div>
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedNodeDetails.raw || selectedNodeDetails.id}</div>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#00ff9d' }}>HISTORY</h3>
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search history..."
                style={{ maxWidth: '220px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {(['all', 'graph', 'steward', 'system'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setTimelineFilter(item)}
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: timelineFilter === item ? 'rgba(0,255,157,0.22)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto', fontSize: '0.75rem' }}>
              {selectedNodeHistory.length === 0 ? (
                <div style={{ color: '#666' }}>No history yet.</div>
              ) : (
                selectedNodeHistory.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} style={{ borderLeft: '2px solid rgba(0,209,255,0.4)', paddingLeft: '0.5rem' }}>
                    <div style={{ color: '#888' }}>{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    <div>{entry.type} {entry.intent ? `· ${entry.intent}` : ''} {entry.biome ? `· ${entry.biome}` : ''}</div>
                    {entry.steward?.status ? <div style={{ color: '#888' }}>steward: {entry.steward.status}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      ) : null}

      {commandPaletteOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div style={{ width: 'min(680px, 92vw)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: '#0b0f14', padding: '1rem', boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong>Command Palette</strong>
              <button onClick={() => setCommandPaletteOpen(false)}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
              <button onClick={() => reviewQueue[0] && void handleReviewAction(reviewQueue[0], 'approve')}>Approve top review</button>
              <button onClick={() => reviewQueue[0] && void handleReviewAction(reviewQueue[0], 'reject')}>Reject top review</button>
              <button onClick={() => reviewQueue[0] && void handleMarkHandled(reviewQueue[0])}>Mark top handled</button>
              <button onClick={() => selectAdjacentNode(-1)}>Previous node</button>
              <button onClick={() => selectAdjacentNode(1)}>Next node</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
