"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { brandContext } from "@/lib/brand-context";
import { processImage } from "@/lib/image-utils";

const CATEGORIES = [
  { id: "logo", label: "Logos" },
  { id: "product_photo", label: "Product Photos" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "packaging", label: "Packaging" },
  { id: "mascot", label: "Peazy / Mascot" },
  { id: "background", label: "Backgrounds" },
  { id: "other", label: "Other" },
];

/**
 * Clean up a filename for use as the asset name.
 * Strips the extension, then removes common junk suffixes like
 * " (1)", "-min", "_min", trailing number-only segments, etc.
 */
function cleanFileName(rawName) {
  let name = rawName.replace(/\.[^/.]+$/, ""); // strip extension
  name = name.replace(/\s*\(\d+\)\s*$/, "");   // " (1)", " (2)" etc.
  name = name.replace(/[-_]min$/i, "");          // "-min", "_min"
  name = name.replace(/[-_ ]\d+$/, "");          // trailing "-123", "_45"
  return name.trim() || rawName;
}

export default function BrandKitPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("product_photo");

  // Inline-rename state: which asset id is currently being edited
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const renameInputRef = useRef(null);

  // Track broken images so we can show a placeholder
  const [brokenImages, setBrokenImages] = useState(new Set());

  const fetchAssets = useCallback(async () => {
    try {
      const url =
        filterCategory === "all"
          ? "/api/brand-assets"
          : `/api/brand-assets?category=${filterCategory}`;
      const res = await fetch(url);
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Focus the rename input whenever editingNameId changes
  useEffect(() => {
    if (editingNameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingNameId]);

  // ------- Rename handler -------
  const handleRename = async (asset) => {
    const newName = editingNameValue.trim();
    setEditingNameId(null);

    if (!newName || newName === asset.name) return;

    // Optimistic update
    setAssets((prev) =>
      prev.map((a) => (a.id === asset.id ? { ...a, name: newName } : a))
    );

    try {
      const res = await fetch("/api/brand-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, name: newName }),
      });
      if (!res.ok) {
        console.error("Rename failed, reverting");
        fetchAssets();
      }
    } catch (err) {
      console.error("Rename failed:", err);
      fetchAssets();
    }
  };

  // ------- Re-categorize handler -------
  const handleRecategorize = async (asset, newCategory) => {
    if (newCategory === asset.category) return;

    // Optimistic update
    setAssets((prev) =>
      prev.map((a) =>
        a.id === asset.id ? { ...a, category: newCategory } : a
      )
    );

    try {
      const res = await fetch("/api/brand-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, category: newCategory }),
      });
      if (!res.ok) {
        console.error("Re-categorize failed, reverting");
        fetchAssets();
      }
    } catch (err) {
      console.error("Re-categorize failed:", err);
      fetchAssets();
    }
  };

  // ------- Upload via drop -------
  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      setUploadError(null);
      setUploadSuccess(null);

      if (rejectedFiles?.length > 0) {
        setUploadError(
          `Some files were rejected: ${rejectedFiles.map((f) => f.file.name).join(", ")}. Make sure they are images under 10MB.`
        );
        return;
      }

      if (acceptedFiles.length === 0) return;

      setUploading(true);
      let successCount = 0;
      let errors = [];

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        setUploadProgress(
          `Uploading ${i + 1}/${acceptedFiles.length}: ${file.name}...`
        );

        try {
          // Convert HEIC + compress if needed
          setUploadProgress(
            `Processing ${i + 1}/${acceptedFiles.length}: ${file.name}...`
          );
          let processedFile = await processImage(file);

          const formData = new FormData();
          formData.append("file", processedFile);
          formData.append("category", uploadCategory);
          formData.append("name", cleanFileName(file.name));

          const res = await fetch("/api/brand-assets", {
            method: "POST",
            body: formData,
          });

          // Handle non-JSON responses (like "Request Entity Too Large")
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            throw new Error(
              res.status === 413
                ? `File too large even after compression (${(processedFile.size / 1024 / 1024).toFixed(1)}MB). Try a smaller image.`
                : `Server error: ${text.slice(0, 100)}`
            );
          }

          const data = await res.json();
          if (!res.ok) {
            errors.push(`${file.name}: ${data.error || "Upload failed"}`);
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }

      setUploading(false);
      setUploadProgress("");

      if (errors.length > 0) {
        setUploadError(errors.join("\n"));
      }
      if (successCount > 0) {
        setUploadSuccess(
          `${successCount} file${successCount > 1 ? "s" : ""} uploaded!`
        );
        setTimeout(() => setUploadSuccess(null), 3000);
      }

      fetchAssets();
    },
    [uploadCategory, fetchAssets]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".svg", ".heic", ".heif"] },
    maxSize: 50 * 1024 * 1024, // allow big files — we compress client-side
  });

  const handleDelete = async (asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    try {
      await fetch("/api/brand-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: asset.id,
          storagePath: asset.storage_path,
        }),
      });
      fetchAssets();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleImageError = (assetId) => {
    setBrokenImages((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
  };

  return (
    <div>
      <h1 className="font-heading text-3xl text-chocolate mb-2">Brand Kit</h1>
      <p className="text-chocolate/60 mb-8">
        Upload and manage your brand assets — logos, product photos, lifestyle
        images, and more.
      </p>

      {/* Brand Colors */}
      <div className="mb-8">
        <h2 className="font-heading text-xl text-chocolate mb-3">
          Brand Colors
        </h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries({
            ...brandContext.colors.primary,
            ...brandContext.colors.pairings,
          }).map(([name, hex]) => (
            <div key={name} className="text-center">
              <div
                className="w-16 h-16 rounded-xl shadow-sm border border-chocolate/10"
                style={{ backgroundColor: hex }}
              />
              <p className="text-xs text-chocolate/60 mt-1 capitalize">
                {name}
              </p>
              <p className="text-xs text-chocolate/40">{hex}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Zone */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <h2 className="font-heading text-xl text-chocolate">
            Upload Assets
          </h2>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="text-sm border border-chocolate/20 rounded-lg px-3 py-1.5 bg-vanilla text-chocolate"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-peach bg-peach/5"
              : "border-chocolate/20 hover:border-peach/50 hover:bg-peach/5"
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div>
              <p className="text-peach font-medium">{uploadProgress || "Uploading..."}</p>
              <div className="mt-2 w-48 h-1.5 bg-chocolate/10 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-peach rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          ) : isDragActive ? (
            <p className="text-peach font-medium">Drop files here</p>
          ) : (
            <div>
              <p className="text-chocolate/80 font-medium">
                Drag & drop images here, or click to browse
              </p>
              <p className="text-chocolate/40 text-sm mt-1">
                PNG, JPG, WebP, SVG, HEIC — any size, auto-compressed
              </p>
            </div>
          )}
        </div>
        {uploadError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-wrap">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterCategory === "all"
              ? "bg-peach text-white"
              : "bg-chocolate/5 text-chocolate/70 hover:bg-chocolate/10"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCategory(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterCategory === c.id
                ? "bg-peach text-white"
                : "bg-chocolate/5 text-chocolate/70 hover:bg-chocolate/10"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      {loading ? (
        <p className="text-chocolate/40">Loading assets...</p>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-chocolate/40">
          <p className="text-lg mb-1">No assets yet</p>
          <p className="text-sm">
            Upload your brand images above to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-chocolate/5 hover:shadow-md transition-shadow"
            >
              {/* Image / Broken-image fallback */}
              <div className="aspect-square bg-chocolate/5 flex items-center justify-center overflow-hidden">
                {brokenImages.has(asset.id) ? (
                  <div className="flex flex-col items-center justify-center text-chocolate/30 px-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-8 h-8 mb-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                      />
                    </svg>
                    <span className="text-xs text-center leading-tight">
                      Image not found
                    </span>
                  </div>
                ) : (
                  <img
                    src={asset.public_url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(asset.id)}
                  />
                )}
              </div>

              {/* Info area */}
              <div className="p-2">
                {/* Editable name */}
                {editingNameId === asset.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={() => handleRename(asset)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(asset);
                      if (e.key === "Escape") setEditingNameId(null);
                    }}
                    className="w-full text-xs font-medium text-chocolate bg-vanilla border border-chocolate/20 rounded px-1 py-0.5 outline-none focus:border-peach"
                  />
                ) : (
                  <p
                    className="text-xs font-medium text-chocolate truncate cursor-pointer hover:text-peach transition-colors"
                    title="Click to rename"
                    onClick={() => {
                      setEditingNameId(asset.id);
                      setEditingNameValue(asset.name);
                    }}
                  >
                    {asset.name}
                  </p>
                )}

                {/* Category dropdown (re-categorize) */}
                <select
                  value={asset.category || "other"}
                  onChange={(e) => handleRecategorize(asset, e.target.value)}
                  className="mt-0.5 w-full text-xs text-chocolate/50 bg-transparent border-none outline-none cursor-pointer hover:text-chocolate transition-colors p-0 appearance-none"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23999' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0 center",
                    paddingRight: "12px",
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(asset)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
