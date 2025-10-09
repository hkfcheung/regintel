"use client";

import { useState } from "react";

interface AppearanceEditorProps {
  initialConfig: Record<string, string>;
}

const BACKGROUND_PRESETS = [
  {
    name: "Custom Image",
    type: "image",
    gradient: "",
    circles: [],
  },
  {
    name: "Subtle Waves",
    type: "gradient",
    gradient: "from-gray-50 via-blue-50/30 to-teal-50/20",
    circles: [
      { size: "w-96 h-96", color: "bg-blue-100/20", position: "-top-40 -right-40" },
      { size: "w-80 h-80", color: "bg-teal-100/20", position: "top-1/2 -left-40" },
      { size: "w-96 h-96", color: "bg-indigo-100/20", position: "-bottom-40 right-1/3" },
    ],
  },
  {
    name: "Purple Dream",
    type: "gradient",
    gradient: "from-purple-50 via-pink-50/30 to-blue-50/20",
    circles: [
      { size: "w-[500px] h-[500px]", color: "bg-purple-200/30", position: "top-20 -right-40" },
      { size: "w-96 h-96", color: "bg-pink-200/25", position: "bottom-20 -left-40" },
      { size: "w-[400px] h-[400px]", color: "bg-blue-200/20", position: "top-1/2 right-1/4" },
    ],
  },
  {
    name: "Ocean Mist",
    type: "gradient",
    gradient: "from-cyan-50 via-blue-50/40 to-indigo-50/30",
    circles: [
      { size: "w-[450px] h-[450px]", color: "bg-cyan-200/25", position: "-top-32 right-1/4" },
      { size: "w-96 h-96", color: "bg-blue-200/30", position: "bottom-40 -left-32" },
      { size: "w-80 h-80", color: "bg-indigo-200/20", position: "top-2/3 right-1/3" },
    ],
  },
  {
    name: "Minimal",
    type: "gradient",
    gradient: "from-gray-50 to-gray-100",
    circles: [],
  },
  {
    name: "None",
    type: "gradient",
    gradient: "from-white to-white",
    circles: [],
  },
];

export function AppearanceEditor({ initialConfig }: AppearanceEditorProps) {
  const [config, setConfig] = useState({
    backgroundEnabled: initialConfig.backgroundEnabled || "true",
    backgroundType: initialConfig.backgroundType || "gradient",
    backgroundGradient: initialConfig.backgroundGradient || BACKGROUND_PRESETS[1].gradient,
    backgroundCircles: initialConfig.backgroundCircles || JSON.stringify(BACKGROUND_PRESETS[1].circles),
    backgroundImage: initialConfig.backgroundImage || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(1);

  const handlePresetSelect = (presetIndex: number) => {
    const preset = BACKGROUND_PRESETS[presetIndex];
    setSelectedPreset(presetIndex);
    setConfig({
      ...config,
      backgroundType: preset.type,
      backgroundGradient: preset.gradient,
      backgroundCircles: JSON.stringify(preset.circles),
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|gif|png)/)) {
      alert("Please upload a JPG, PNG, or GIF file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/appearance/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setConfig({
          ...config,
          backgroundType: "image",
          backgroundImage: data.url,
        });
        setSelectedPreset(0); // Select "Custom Image" preset
      } else {
        alert("Failed to upload image");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/appearance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        alert("Appearance settings saved! Refresh the page to see changes.");
        window.location.reload();
      } else {
        alert("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const circles = config.backgroundCircles ? JSON.parse(config.backgroundCircles) : [];

  return (
    <div className="space-y-8">
      {/* Background Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Home Page Background</h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.backgroundEnabled === "true"}
            onChange={(e) =>
              setConfig({ ...config, backgroundEnabled: e.target.checked ? "true" : "false" })
            }
            className="w-5 h-5"
          />
          <span className="text-gray-700">Enable decorative background</span>
        </label>
      </div>

      {config.backgroundEnabled === "true" && (
        <>
          {/* Image Upload */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Custom Background Image</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JPG, PNG, or GIF (max 5MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {uploading && (
                  <p className="mt-2 text-sm text-blue-600">Uploading...</p>
                )}
                {config.backgroundImage && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ Image uploaded successfully
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Preset Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Background Presets</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {BACKGROUND_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetSelect(index)}
                  disabled={preset.type === "image" && !config.backgroundImage}
                  className={`relative h-32 rounded-lg border-2 transition-all overflow-hidden ${
                    selectedPreset === index
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300"
                  } ${preset.type === "image" && !config.backgroundImage ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {preset.type === "image" && config.backgroundImage ? (
                    <img
                      src={config.backgroundImage}
                      alt="Custom background"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : preset.type === "image" ? (
                    <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400">Upload image first</span>
                    </div>
                  ) : (
                    <>
                      <div className={`absolute inset-0 bg-gradient-to-br ${preset.gradient}`} />
                      {preset.circles.map((circle, circleIndex) => (
                        <div
                          key={circleIndex}
                          className={`absolute ${circle.size} ${circle.color} ${circle.position} rounded-full blur-2xl`}
                        />
                      ))}
                    </>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-white/80 px-3 py-1 rounded-full text-sm font-medium">
                      {preset.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            <div className="relative h-64 rounded-lg border border-gray-200 overflow-hidden">
              {config.backgroundType === "image" && config.backgroundImage ? (
                <img
                  src={config.backgroundImage}
                  alt="Background preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  <div className={`absolute inset-0 bg-gradient-to-br ${config.backgroundGradient}`} />
                  {circles.map((circle: any, index: number) => (
                    <div
                      key={index}
                      className={`absolute ${circle.size} ${circle.color} ${circle.position} rounded-full blur-3xl`}
                    />
                  ))}
                </>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-lg">
                  <h3 className="text-2xl font-bold mb-2">Regulatory Intelligence Platform</h3>
                  <p className="text-gray-600">This is how your home page will look</p>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gradient Classes (Tailwind)
                </label>
                <input
                  type="text"
                  value={config.backgroundGradient}
                  onChange={(e) => setConfig({ ...config, backgroundGradient: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="from-gray-50 via-blue-50/30 to-teal-50/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decorative Circles (JSON)
                </label>
                <textarea
                  value={config.backgroundCircles}
                  onChange={(e) => setConfig({ ...config, backgroundCircles: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={6}
                  placeholder='[{"size":"w-96 h-96","color":"bg-blue-100/20","position":"-top-40 -right-40"}]'
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Appearance Settings"}
        </button>
      </div>
    </div>
  );
}
