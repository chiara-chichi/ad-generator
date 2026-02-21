"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { brandContext } from "@/lib/brand-context";

const CATEGORIES = [
  { id: "logo", label: "Logos" },
  { id: "product_photo", label: "Product Photos" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "packaging", label: "Packaging" },
  { id: "mascot", label: "Peazy / Mascot" },
  { id: "background", label: "Backgrounds" },
  { id: "other", label: "Other" },
];

export default function BrandKitPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("product_photo");

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

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setUploading(true);
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", uploadCategory);
        formData.append("name", file.name.replace(/\.[^/.]+$/, ""));
        try {
          await fetch("/api/brand-assets", { method: "POST", body: formData });
        } catch (err) {
          console.error("Upload failed:", err);
        }
      }
      setUploading(false);
      fetchAssets();
    },
    [uploadCategory, fetchAssets]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".svg"] },
    maxSize: 10 * 1024 * 1024,
  });

  const handleDelete = async (asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    try {
      await fetch("/api/brand-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, storagePath: asset.storage_path }),
      });
      fetchAssets();
    } catch (err) {
      console.error("Delete failed:", err);
    }
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
          <h2 className="font-heading text-xl text-chocolate">Upload Assets</h2>
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
            <p className="text-chocolate/60">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-peach font-medium">Drop files here</p>
          ) : (
            <div>
              <p className="text-chocolate/80 font-medium">
                Drag & drop images here, or click to browse
              </p>
              <p className="text-chocolate/40 text-sm mt-1">
                PNG, JPG, WebP, SVG — max 10MB
              </p>
            </div>
          )}
        </div>
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
              <div className="aspect-square bg-chocolate/5 flex items-center justify-center overflow-hidden">
                <img
                  src={asset.public_url}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-chocolate truncate">
                  {asset.name}
                </p>
                <p className="text-xs text-chocolate/40 capitalize">
                  {asset.category?.replace("_", " ")}
                </p>
              </div>
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
