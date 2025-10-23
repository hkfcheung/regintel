"use client";

import { useState, useEffect } from "react";

interface LlmConfig {
  id: string;
  name: string;
  provider: "OLLAMA" | "OPENAI" | "ANTHROPIC" | "CUSTOM";
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
  temperature: number;
  maxTokens: number;
  active: boolean;
  isDefault: boolean;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export function LlmConfigManager() {
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaHealthy, setOllamaHealthy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    provider: "OLLAMA" as const,
    model: "",
    baseUrl: "http://localhost:11434",
    apiKey: "",
    temperature: 0.7,
    maxTokens: 2000,
    active: true,
    isDefault: false,
    capabilities: ["graph", "postgres", "general"],
  });

  useEffect(() => {
    loadConfigs();
    checkOllamaHealth();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch("/api/proxy?endpoint=/llm/configs");
      const data = await response.json();

      if (data.error) {
        console.error("API error:", data.error);
        setApiError(data.error);
        setConfigs([]);
      } else {
        setApiError(null);
        setConfigs(data);
      }
    } catch (error) {
      console.error("Failed to load configs:", error);
      setApiError("Failed to connect to API server");
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const checkOllamaHealth = async () => {
    try {
      const response = await fetch("/api/proxy?endpoint=/llm/ollama/health");
      const data = await response.json();

      if (data.error) {
        console.error("API error:", data.error);
        setOllamaHealthy(false);
      } else {
        setOllamaHealthy(data.healthy);

        if (data.healthy) {
          loadOllamaModels();
        }
      }
    } catch (error) {
      console.error("Failed to check Ollama health:", error);
      setOllamaHealthy(false);
    }
  };

  const loadOllamaModels = async () => {
    try {
      const response = await fetch("/api/proxy?endpoint=/llm/ollama/models");
      const data = await response.json();
      setOllamaModels(data.models || []);
    } catch (error) {
      console.error("Failed to load Ollama models:", error);
    }
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      alert("Please enter a name for the configuration");
      return;
    }
    if (!formData.model.trim()) {
      alert("Please select a model");
      return;
    }

    try {
      const response = await fetch("/api/proxy?endpoint=/llm/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create config");
      }

      await loadConfigs();
      setShowDialog(false);
      resetForm();
    } catch (error: any) {
      console.error("Failed to create config:", error);
      alert(`Failed to create configuration: ${error.message}`);
    }
  };

  const handleUpdate = async () => {
    if (!editingConfig) return;

    // Validate required fields
    if (!formData.name.trim()) {
      alert("Please enter a name for the configuration");
      return;
    }
    if (!formData.model.trim()) {
      alert("Please select a model");
      return;
    }

    try {
      const response = await fetch(
        `/api/proxy?endpoint=/llm/configs/${editingConfig.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update config");
      }

      await loadConfigs();
      setShowDialog(false);
      setEditingConfig(null);
      resetForm();
    } catch (error: any) {
      console.error("Failed to update config:", error);
      alert(`Failed to update configuration: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;

    try {
      const response = await fetch(`/api/proxy?endpoint=/llm/configs/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete config");

      await loadConfigs();
    } catch (error) {
      console.error("Failed to delete config:", error);
      alert("Failed to delete configuration");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      provider: "OLLAMA",
      model: "",
      baseUrl: "http://localhost:11434",
      apiKey: "",
      temperature: 0.7,
      maxTokens: 2000,
      active: true,
      isDefault: false,
      capabilities: ["graph", "postgres", "general"],
    });
  };

  const openEditDialog = (config: LlmConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl || "http://localhost:11434",
      apiKey: config.apiKey || "",
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      active: config.active,
      isDefault: config.isDefault,
      capabilities: config.capabilities,
    });
    setShowDialog(true);
  };

  const openCreateDialog = () => {
    setEditingConfig(null);
    resetForm();
    setShowDialog(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* API Error */}
      {apiError && (
        <div className="p-4 rounded-lg border bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <div className="text-red-600 text-xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">API Connection Error</h3>
              <p className="text-sm text-red-700 mt-1">{apiError}</p>
              <p className="text-sm text-red-600 mt-2">
                Please ensure the API server is running on port 3001:
              </p>
              <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-900">
                cd apps/api && npm run dev
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Ollama Status */}
      <div className={`p-4 rounded-lg border ${ollamaHealthy ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold">Ollama Status</h3>
            <p className="text-sm text-gray-600 mt-1">
              {ollamaHealthy ? '✅ Connected to http://localhost:11434' : '⚠️ Not connected'}
            </p>
            {ollamaHealthy && ollamaModels.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Available Models ({ollamaModels.length}):
                </p>
                <div className="space-y-1">
                  {ollamaModels.map((model) => (
                    <div key={model.name} className="flex items-center gap-2 text-xs">
                      <span className="font-mono bg-white px-2 py-1 rounded border border-gray-300">
                        {model.name}
                      </span>
                      {configs.some(c => c.model === model.name && c.active) && (
                        <span className="text-green-600 font-medium">✓ Configured</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!ollamaHealthy && (
              <div className="mt-2 text-xs text-gray-600">
                <p className="mb-1">To use Ollama:</p>
                <pre className="bg-yellow-100 p-2 rounded">
                  ollama serve
                  <br />
                  ollama pull llama3.2
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Config Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Configured LLMs</h2>
        <button
          onClick={openCreateDialog}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
        >
          + Add Configuration
        </button>
      </div>

      {/* Configs List */}
      <div className="grid gap-4">
        {configs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No LLM configurations yet. Add one to get started!
          </div>
        ) : (
          configs.map((config) => (
            <div
              key={config.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{config.name}</h3>
                    {config.isDefault && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                        Default
                      </span>
                    )}
                    {!config.active && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Provider:</span> {config.provider}
                    </div>
                    <div>
                      <span className="font-medium">Model:</span> {config.model}
                    </div>
                    {config.baseUrl && (
                      <div>
                        <span className="font-medium">Base URL:</span> {config.baseUrl}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Temperature:</span> {config.temperature}
                    </div>
                    <div>
                      <span className="font-medium">Max Tokens:</span> {config.maxTokens}
                    </div>
                    <div>
                      <span className="font-medium">Capabilities:</span>{" "}
                      {config.capabilities.join(", ")}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditDialog(config)}
                    className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded border border-blue-600 hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="text-red-600 hover:text-red-800 px-3 py-1 rounded border border-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold mb-4">
              {editingConfig ? "Edit" : "Add"} LLM Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Local Llama 3.2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      provider: e.target.value as any,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="OLLAMA">Ollama (Local)</option>
                  <option value="OPENAI">OpenAI</option>
                  <option value="ANTHROPIC">Anthropic</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>

              {formData.provider === "OLLAMA" && ollamaModels.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Model (from Ollama)
                  </label>
                  <select
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select a model</option>
                    {ollamaModels.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="e.g., llama3.2, gpt-4, claude-3-5-sonnet"
                  />
                </div>
              )}

              {formData.provider === "OLLAMA" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formData.baseUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, baseUrl: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}

              {(formData.provider === "OPENAI" ||
                formData.provider === "ANTHROPIC") && (
                <div>
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter API key"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Temperature ({formData.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxTokens: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                  />
                  <span className="text-sm">Active</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) =>
                      setFormData({ ...formData, isDefault: e.target.checked })
                    }
                  />
                  <span className="text-sm">Set as Default</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setEditingConfig(null);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingConfig ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                {editingConfig ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
