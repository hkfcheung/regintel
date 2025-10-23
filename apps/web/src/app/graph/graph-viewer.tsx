"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphNode {
  id: string;
  label: string;
  name: string;
  group: string;
  labels: string[];
  [key: string]: any;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  label: string;
  [key: string]: any;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function GraphViewer() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<"STAGING" | "PRODUCTION">("STAGING");
  const [limit, setLimit] = useState(100);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [scope, setScope] = useState<"pediatric_oncology" | "oncology" | "all">("pediatric_oncology");
  const graphRef = useRef<any>(null);

  // Color scheme for different node types
  const getNodeColor = (node: any) => {
    const colorMap: Record<string, string> = {
      Drug: "#3B82F6", // Blue
      Agency: "#EC4899", // Pink
      TherapeuticArea: "#8B5CF6", // Purple
      Decision: "#10B981", // Green
      Trial: "#F59E0B", // Amber
      SafetyAlert: "#EF4444", // Red
      Guidance: "#6366F1", // Indigo
      NewsItem: "#06B6D4", // Cyan
      // Staging variants
      _stg_Drug: "#93C5FD",
      _stg_Agency: "#F9A8D4",
      _stg_TherapeuticArea: "#C4B5FD",
      _stg_Decision: "#6EE7B7",
      _stg_Trial: "#FCD34D",
      _stg_SafetyAlert: "#FCA5A5",
      _stg_Guidance: "#A5B4FC",
      _stg_NewsItem: "#67E8F9",
    };

    return colorMap[node.group] || "#6B7280"; // Gray default
  };

  const fetchGraphData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Clear existing data to prevent stale object references
      setGraphData({ nodes: [], links: [] });

      const response = await fetch(
        `http://localhost:3001/graph/visualize?environment=${environment}&limit=${limit}&scope=${scope}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      // Deep sanitize all node properties to ensure no objects slip through
      const sanitizedNodes = (data.nodes || []).map((node: any) => {
        const sanitized: any = {};
        Object.keys(node).forEach(key => {
          const value = node[key];

          // Skip internal properties used by force-graph
          if (['__indexColor', 'x', 'y', 'vx', 'vy', 'index'].includes(key)) {
            sanitized[key] = value;
            return;
          }

          if (value === null || value === undefined) {
            sanitized[key] = value;
          } else if (Array.isArray(value)) {
            // Arrays are ok, but sanitize their contents
            sanitized[key] = value.map(v =>
              typeof v === 'object' && v !== null ? JSON.stringify(v) : v
            );
          } else if (typeof value === 'object') {
            // Special case for labels - ensure it's always an array
            if (key === 'labels') {
              console.error(`Labels should be an array but got object:`, value);
              sanitized[key] = [sanitized.label || 'Unknown'];
            } else {
              // Convert any objects to JSON strings
              console.warn(`Found object in node.${key}, converting to string:`, value);
              sanitized[key] = JSON.stringify(value);
            }
          } else {
            sanitized[key] = value;
          }
        });
        return sanitized;
      });

      // Also sanitize links
      const sanitizedLinks = (data.links || []).map((link: any) => {
        const sanitized: any = {};
        Object.keys(link).forEach(key => {
          const value = link[key];
          if (value === null || value === undefined) {
            sanitized[key] = value;
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            console.warn(`Found object in link.${key}, converting to string:`, value);
            sanitized[key] = JSON.stringify(value);
          } else {
            sanitized[key] = value;
          }
        });
        return sanitized;
      });

      console.log('Setting graph data:', { nodeCount: sanitizedNodes.length, linkCount: sanitizedLinks.length });
      setGraphData({
        nodes: sanitizedNodes,
        links: sanitizedLinks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Failed to fetch graph data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [environment, limit, scope]);

  // Configure D3 forces for better node spacing
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const fg = graphRef.current;

      try {
        // Configure forces for better spacing
        // Stronger repulsion between nodes
        fg.d3Force('charge')?.strength(-800);

        // Longer desired link distance
        fg.d3Force('link')?.distance(100);

        // Weaker center force (prevent tight clustering)
        fg.d3Force('center')?.strength(0.05);

        // Reheat simulation to apply new forces
        fg.d3ReheatSimulation?.();
      } catch (e) {
        console.warn('Failed to configure forces:', e);
      }
    }
  }, [graphData]);

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
  };

  const handleNodeDrag = (node: any) => {
    // Fix node position during drag
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleNodeDragEnd = (node: any) => {
    // Always keep node where you drop it - nodes stick when dragged
    // This prevents them from snapping back into the cluster
    node.fx = node.x;
    node.fy = node.y;
  };

  const toggleFreeze = () => {
    const newFrozenState = !isFrozen;
    setIsFrozen(newFrozenState);

    if (graphRef.current) {
      if (newFrozenState) {
        // Freeze: stop simulation and fix all nodes in current position
        graphRef.current.pauseAnimation();
        graphData.nodes.forEach((node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        });
      } else {
        // Unfreeze: release all nodes and resume simulation
        graphData.nodes.forEach((node: any) => {
          node.fx = undefined;
          node.fy = undefined;
        });
        graphRef.current.resumeAnimation();
      }
    }
  };

  const resetLayout = () => {
    // Release all pinned nodes and restart physics simulation
    graphData.nodes.forEach((node: any) => {
      node.fx = undefined;
      node.fy = undefined;
    });

    if (graphRef.current) {
      setIsFrozen(false);
      graphRef.current.resumeAnimation();
      // Reheat the simulation to recalculate positions
      graphRef.current.d3ReheatSimulation();
    }
  };

  return (
    <div className="space-y-4">
      {/* Graph Container */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Controls */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as "STAGING" | "PRODUCTION")}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="STAGING">Staging</option>
                  <option value="PRODUCTION">Production</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "pediatric_oncology" | "oncology" | "all")}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="pediatric_oncology">Pediatric Oncology</option>
                  <option value="oncology">All Oncology</option>
                  <option value="all">All Data</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Nodes
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>

              <button
                onClick={fetchGraphData}
                disabled={loading}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                onClick={toggleFreeze}
                disabled={graphData.nodes.length === 0}
                className={`mt-6 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isFrozen
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                } disabled:bg-gray-100 disabled:text-gray-400`}
                title={isFrozen ? "Unfreeze all nodes and resume physics" : "Freeze all nodes in current positions"}
              >
                {isFrozen ? "🔒 Frozen" : "❄️ Freeze All"}
              </button>

              <button
                onClick={resetLayout}
                disabled={graphData.nodes.length === 0}
                className="mt-6 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-sm font-medium"
                title="Unpin all nodes and recalculate layout"
              >
                🔄 Reset Layout
              </button>
            </div>

            <div className="text-sm text-gray-600">
              <span className="font-medium">{graphData.nodes.length}</span> nodes,{" "}
              <span className="font-medium">{graphData.links.length}</span> relationships
            </div>
          </div>
        </div>

        {/* Graph Visualization */}
        <div className="relative">
          {error ? (
            <div className="h-[700px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-600 font-medium mb-2">Error loading graph</p>
                <p className="text-gray-600 text-sm">{error}</p>
                <button
                  onClick={fetchGraphData}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : graphData.nodes.length === 0 && !loading ? (
            <div className="h-[700px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-600 font-medium mb-2">No data in graph database</p>
                <p className="text-gray-500 text-sm">
                  Run a backfill to sync approved data from PostgreSQL to Neo4j
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[700px]">
              {!loading && (
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  nodeLabel={(node: any) => {
                    // Safely extract label - ensure it's always a string
                    const name = node.name || node.title || node.id;
                    return typeof name === 'string' ? name : String(name);
                  }}
                  nodeColor={getNodeColor}
                  nodeRelSize={6}
                  enableNodeDrag={true}
                  onNodeDrag={handleNodeDrag}
                  onNodeDragEnd={handleNodeDragEnd}
                  nodePointerAreaPaint={(node: any, color, ctx) => {
                    // Define the clickable/draggable area
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
                    ctx.fill();
                  }}
                  nodeCanvasObject={(node: any, ctx, globalScale) => {
                    // Force string conversion to prevent object rendering
                    let label = node.name || node.title || node.id;
                    if (typeof label === 'object') {
                      console.error('Object label detected in nodeCanvasObject:', label);
                      label = JSON.stringify(label);
                    }
                    label = String(label);

                    const fontSize = 12/globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                    // Draw background rectangle
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(
                      node.x - bckgDimensions[0] / 2,
                      node.y - bckgDimensions[1] / 2,
                      bckgDimensions[0],
                      bckgDimensions[1]
                    );

                    // Draw border
                    ctx.strokeStyle = getNodeColor(node);
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(
                      node.x - bckgDimensions[0] / 2,
                      node.y - bckgDimensions[1] / 2,
                      bckgDimensions[0],
                      bckgDimensions[1]
                    );

                    // Draw text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#1f2937';
                    ctx.fillText(label, node.x, node.y);

                    // Draw node circle
                    ctx.beginPath();
                    ctx.arc(node.x, node.y - bckgDimensions[1]/2 - 8, 6, 0, 2 * Math.PI, false);
                    ctx.fillStyle = getNodeColor(node);
                    ctx.fill();
                  }}
                  linkLabel={(link: any) => link.type || link.label || ''}
                  linkDirectionalArrowLength={3.5}
                  linkDirectionalArrowRelPos={1}
                  linkCanvasObjectMode={() => 'after'}
                  linkCanvasObject={(link: any, ctx, globalScale) => {
                    // Force string conversion for link labels
                    let label = link.type || link.label || '';
                    if (typeof label === 'object') {
                      console.error('Object label detected in linkCanvasObject:', label);
                      label = JSON.stringify(label);
                    }
                    label = String(label);
                    if (!label) return;

                    const start = link.source;
                    const end = link.target;

                    // Calculate link midpoint
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;

                    const fontSize = 10/globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                    // Draw background
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.fillRect(
                      midX - bckgDimensions[0] / 2,
                      midY - bckgDimensions[1] / 2,
                      bckgDimensions[0],
                      bckgDimensions[1]
                    );

                    // Draw text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText(label, midX, midY);
                  }}
                  onNodeClick={handleNodeClick}
                  onBackgroundClick={handleBackgroundClick}
                  cooldownTicks={100}
                  d3AlphaDecay={0.02}
                  d3VelocityDecay={0.3}
                  linkColor={() => "#94a3b8"}
                  backgroundColor="#ffffff"
                />
              )}
            </div>
          )}

          {/* Node Details Panel */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-[680px] overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedNode.title || selectedNode.name}
                </h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Type</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedNode.labels?.join(", ") || selectedNode.label}
                  </p>
                </div>

                {/* Special handling for Trial nodes */}
                {(selectedNode.labels?.includes('Trial') || selectedNode.labels?.includes('_stg_Trial')) && (
                  <>
                    {selectedNode.location && selectedNode.location !== 'Location Unknown' && typeof selectedNode.location === 'string' && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Location</p>
                        <p className="text-sm text-gray-900 mt-1 font-semibold">
                          📍 {selectedNode.location}
                        </p>
                      </div>
                    )}
                    {selectedNode.phase && selectedNode.phase !== 'Unknown' && typeof selectedNode.phase === 'string' && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Phase</p>
                        <p className="text-sm text-gray-900 mt-1 font-semibold">
                          🧪 {selectedNode.phase}
                        </p>
                      </div>
                    )}
                    {selectedNode.status && selectedNode.status !== 'Unknown' && typeof selectedNode.status === 'string' && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                        <p className="text-sm text-gray-900 mt-1">
                          {selectedNode.status}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {Object.entries(selectedNode)
                  .filter(([key]) => !["id", "label", "labels", "group", "name", "title", "location", "phase", "status", "x", "y", "vx", "vy", "index", "fx", "fy"].includes(key))
                  .map(([key, value]) => {
                    // Safely render value - handle objects, arrays, null, undefined
                    let displayValue: string;
                    if (value === null || value === undefined) {
                      displayValue = "N/A";
                    } else if (typeof value === "object") {
                      displayValue = JSON.stringify(value, null, 2);
                    } else {
                      displayValue = String(value);
                    }

                    return (
                      <div key={key}>
                        <p className="text-xs font-medium text-gray-500 uppercase">{key}</p>
                        <pre className="text-sm text-gray-900 mt-1 break-words whitespace-pre-wrap font-sans">
                          {displayValue}
                        </pre>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Legend - Separate Container Always Visible */}
      <div className="bg-white rounded-lg shadow-lg px-6 py-5">
        {/* Node Types */}
        <div className="mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Node Types (Colors)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Drug</div>
                <div className="text-gray-500">Products</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-pink-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Agency</div>
                <div className="text-gray-500">FDA, EMA</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Area</div>
                <div className="text-gray-500">Disease</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Decision</div>
                <div className="text-gray-500">Approval</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Trial</div>
                <div className="text-gray-500">Study</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Alert</div>
                <div className="text-gray-500">Warning</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-indigo-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">Guidance</div>
                <div className="text-gray-500">Rules</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-cyan-500 border border-gray-300" />
              <div className="text-xs">
                <div className="font-semibold text-gray-800">News</div>
                <div className="text-gray-500">Press</div>
              </div>
            </div>
          </div>
        </div>

        {/* Relationship Types */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Relationship Types (Arrows)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-100 rounded px-2 py-1 border border-gray-300">
              <span className="font-mono font-bold text-gray-700">APPROVED_BY</span>
              <span className="text-gray-500 ml-1">Drug → Agency</span>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 border border-gray-300">
              <span className="font-mono font-bold text-gray-700">HAS_ALERT</span>
              <span className="text-gray-500 ml-1">Drug → Alert</span>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 border border-gray-300">
              <span className="font-mono font-bold text-gray-700">SUBJECT_OF</span>
              <span className="text-gray-500 ml-1">Drug → Decision</span>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 border border-gray-300">
              <span className="font-mono font-bold text-gray-700">ISSUED_BY</span>
              <span className="text-gray-500 ml-1">Decision → Agency</span>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 border border-gray-300">
              <span className="font-mono font-bold text-gray-700">MENTIONED_IN</span>
              <span className="text-gray-500 ml-1">Drug → News</span>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 border border-gray-300">
              <span className="font-mono font-bold text-gray-700">TREATS</span>
              <span className="text-gray-500 ml-1">Drug → Area</span>
            </div>
          </div>
        </div>

        {/* Usage Tips */}
        <div className="pt-3 border-t border-gray-300">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">💡 Tips:</span> Click nodes for details • Drag nodes (they stick where you drop them!) • Use "Freeze All" to stop all movement • Use "Reset Layout" to unpin all nodes • Scroll to zoom • Drag background to pan
          </p>
        </div>
      </div>
    </div>
  );
}
