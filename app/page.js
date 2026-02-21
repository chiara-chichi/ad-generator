"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";
import { adSizes, getAdSize } from "@/lib/ad-sizes";
import { brandContext } from "@/lib/brand-context";
import { supabase } from "@/lib/supabase";

const FLAVORS = [
  "All / General",
  ...new Set(brandContext.products.map((p) => p.flavor)),
];

function formatFieldName(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Home() {
  // Flow: null=home, "reference", "scratch"
  const [flow, setFlow] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Reference flow
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [referenceNotes, setReferenceNotes] = useState("");

  // Scratch flow
  const [adDescription, setAdDescription] = useState("");

  // Shared settings
  const [adSizeId, setAdSizeId] = useState("instagram-square");
  const [flavor, setFlavor] = useState("All / General");
  const [channel, setChannel] = useState("social");

  // AI-generated ad
  const [generatedHtml, setGeneratedHtml] = useState(null);
  const [fields, setFields] = useState({});
  const [backgroundColor, setBackgroundColor] = useState("#fffbec");
  const [textColor, setTextColor] = useState("#4b1c10");
  const [accentColor, setAccentColor] = useState("#f0615a");

  // NL editing
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);

  // Meta ads review
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  // Brand assets
  const [brandAssets, setBrandAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);

  // Export
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const adPreviewRef = useRef(null);

  // Load brand assets
  useEffect(() => {
    fetch("/api/brand-assets")
      .then((res) => res.json())
      .then((data) => setBrandAssets(data.assets || []))
      .catch(console.error);
  }, []);

  // Load ad from gallery (via localStorage)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") === "true") {
      try {
        const raw = localStorage.getItem("editAd");
        if (raw) {
          const ad = JSON.parse(raw);
          localStorage.removeItem("editAd");
          if (ad.generatedHtml) {
            setGeneratedHtml(ad.generatedHtml);
            setFields(ad.fields || {});
            if (ad.backgroundColor) setBackgroundColor(ad.backgroundColor);
            if (ad.textColor) setTextColor(ad.textColor);
            if (ad.accentColor) setAccentColor(ad.accentColor);
            if (ad.flavor) setFlavor(ad.flavor);
            if (ad.channel) setChannel(ad.channel);
            // Parse ad size
            if (ad.adSize) {
              const match = ad.adSize.match(/(\d+)x(\d+)/);
              if (match) {
                const found = adSizes.find(
                  (s) =>
                    s.width === parseInt(match[1]) &&
                    s.height === parseInt(match[2])
                );
                if (found) setAdSizeId(found.id);
              }
            }
            setFlow("edit");
            // Clean URL
            window.history.replaceState({}, "", "/");
          }
        }
      } catch (err) {
        console.error("Failed to load ad from gallery:", err);
      }
    }
  }, []);

  // Dropzone
  const onDropReference = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    setReferenceImage(file);
    const reader = new FileReader();
    reader.onload = () => setReferencePreview(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropReference,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // Render HTML with tokens substituted
  function renderAd() {
    if (!generatedHtml) return "";
    let html = generatedHtml;
    Object.entries(fields).forEach(([key, value]) => {
      html = html.replaceAll(`{{${key}}}`, value || "");
    });
    return html;
  }

  // Toggle asset selection
  function toggleAsset(asset) {
    setSelectedAssets((prev) => {
      const exists = prev.find((a) => a.id === asset.id);
      if (exists) return prev.filter((a) => a.id !== asset.id);
      return [...prev, asset];
    });
  }

  // Build asset prompt for AI
  function buildAssetPrompt() {
    if (selectedAssets.length === 0) return "";
    const lines = selectedAssets.map(
      (a) =>
        `- ${a.category?.replace("_", " ") || "image"}: ${a.public_url} (name: "${a.name}") — use <img src="${a.public_url}" crossorigin="anonymous" /> in the HTML`
    );
    return `\n\nBRAND ASSETS TO INCLUDE IN THE AD (use these actual image URLs with <img> tags):\n${lines.join("\n")}`;
  }

  // ============ FLOW 1: Recreate from reference ============
  async function handleRecreate() {
    if (!referencePreview) return;
    setGenerating(true);
    setError(null);

    try {
      const base64 = referencePreview.split(",")[1];
      const mediaType = referenceImage.type || "image/png";
      const size = getAdSize(adSizeId);

      const res = await fetch("/api/recreate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType,
          adWidth: size.width,
          adHeight: size.height,
          userNotes: (referenceNotes || "") + buildAssetPrompt(),
          flavor: flavor === "All / General" ? null : flavor,
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to recreate ad");

      setGeneratedHtml(data.html);
      setFields(data.fields || {});
      if (data.backgroundColor) setBackgroundColor(data.backgroundColor);
      if (data.textColor) setTextColor(data.textColor);
      if (data.accentColor) setAccentColor(data.accentColor);
    } catch (err) {
      console.error("Recreate failed:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  // ============ FLOW 2: Generate from scratch ============
  async function handleCreateFromScratch() {
    if (!adDescription.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const size = getAdSize(adSizeId);
      const res = await fetch("/api/generate-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: adDescription + buildAssetPrompt(),
          adWidth: size.width,
          adHeight: size.height,
          flavor: flavor === "All / General" ? null : flavor,
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate ad");

      setGeneratedHtml(data.html);
      setFields(data.fields || {});
      if (data.backgroundColor) setBackgroundColor(data.backgroundColor);
      if (data.textColor) setTextColor(data.textColor);
      if (data.accentColor) setAccentColor(data.accentColor);
    } catch (err) {
      console.error("Create failed:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  // ============ NL Editing ============
  async function handleEditWithAI() {
    if (!editInstruction.trim() || !generatedHtml) return;
    setEditing(true);
    setError(null);

    try {
      const size = getAdSize(adSizeId);
      const res = await fetch("/api/edit-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentHtml: renderAd(),
          instruction: editInstruction,
          adWidth: size.width,
          adHeight: size.height,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Edit failed");

      setGeneratedHtml(data.html);
      setFields(data.fields || {});
      setEditInstruction("");
      setReview(null); // clear old review
    } catch (err) {
      console.error("Edit failed:", err);
      setError(err.message || "Edit failed.");
    } finally {
      setEditing(false);
    }
  }

  // ============ Meta Ads Review ============
  async function handleReviewAd() {
    setReviewing(true);
    try {
      const size = getAdSize(adSizeId);
      const res = await fetch("/api/review-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adHtml: renderAd(),
          channel,
          adSize: `${size.width}x${size.height}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReview(data);
    } catch (err) {
      console.error("Review failed:", err);
    } finally {
      setReviewing(false);
    }
  }

  // ============ Regenerate ============
  async function handleRegenerate() {
    setReview(null);
    if (flow === "reference") await handleRecreate();
    else if (flow === "scratch") await handleCreateFromScratch();
    else {
      // Re-edit from gallery — use NL edit with "regenerate" instruction
      setEditInstruction("Regenerate this ad with a fresh creative take, keeping the same general concept and brand style.");
      await handleEditWithAI();
    }
  }

  // ============ Reset ============
  function resetFlow() {
    setFlow(null);
    setGeneratedHtml(null);
    setFields({});
    setReferenceImage(null);
    setReferencePreview(null);
    setReferenceNotes("");
    setAdDescription("");
    setError(null);
    setReview(null);
    setEditInstruction("");
    setSelectedAssets([]);
    setBackgroundColor("#fffbec");
    setTextColor("#4b1c10");
    setAccentColor("#f0615a");
  }

  function goBackToInput() {
    setGeneratedHtml(null);
    setFields({});
    setError(null);
    setReview(null);
  }

  // ============ Export PNG ============
  async function handleExport() {
    if (!adPreviewRef.current) return;
    setExporting(true);
    try {
      const size = getAdSize(adSizeId);
      const el = adPreviewRef.current.querySelector(".ad-render-target");
      if (!el) return;

      const dataUrl = await toPng(el, {
        width: size.width,
        height: size.height,
        pixelRatio: 2,
        quality: 1.0,
        skipAutoScale: true,
      });

      const flavorSlug =
        flavor === "All / General"
          ? "general"
          : flavor.toLowerCase().replace(/\s+/g, "-");
      saveAs(
        dataUrl,
        `chichi-${flavorSlug}-${size.width}x${size.height}.png`
      );
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  // ============ Save to Gallery ============
  async function handleSave() {
    setSaving(true);
    try {
      if (!supabase) {
        alert("Gallery saving requires Supabase.");
        return;
      }

      const size = getAdSize(adSizeId);
      const headlineField =
        fields.headline || Object.values(fields)[0] || "Untitled Ad";

      const { error: dbError } = await supabase.from("generated_ads").insert({
        name: headlineField,
        ad_size: `${size.width}x${size.height}`,
        template_id: "ai-generated",
        headline: fields.headline || headlineField,
        subheadline: fields.subheadline || "",
        body_copy: fields.body || fields.description || "",
        cta_text: fields.cta || "",
        reference_analysis: { generatedHtml, fields },
        template_vars: { backgroundColor, textColor, accentColor },
        flavor: flavor === "All / General" ? null : flavor,
        channel,
      });
      if (dbError) throw dbError;
      alert("Saved to gallery!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ============ Preview ============
  const size = getAdSize(adSizeId);
  const maxPreviewWidth = 500;
  const scale = Math.min(maxPreviewWidth / size.width, 1);
  const adHtml = renderAd();
  const hasGenerated = !!generatedHtml;

  // ============ Brand Asset Picker Component ============
  function AssetPicker() {
    if (brandAssets.length === 0) return null;
    const grouped = {
      packaging: brandAssets.filter((a) => a.category === "packaging"),
      product_photo: brandAssets.filter((a) => a.category === "product_photo"),
      logo: brandAssets.filter((a) => a.category === "logo" || a.category === "mascot"),
      lifestyle: brandAssets.filter((a) => a.category === "lifestyle" || a.category === "background"),
    };
    const nonEmpty = Object.entries(grouped).filter(([, v]) => v.length > 0);
    if (nonEmpty.length === 0) return null;

    return (
      <div className="mb-6">
        <label className="block text-sm font-medium text-chocolate mb-2">
          Include brand assets{" "}
          <span className="font-normal text-chocolate/40">(optional)</span>
        </label>
        {nonEmpty.map(([cat, assets]) => (
          <div key={cat} className="mb-2">
            <p className="text-xs text-chocolate/40 mb-1 capitalize">
              {cat.replace("_", " ")}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {assets.map((a) => {
                const isSelected = selectedAssets.find((s) => s.id === a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAsset(a)}
                    className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                      isSelected
                        ? "border-peach ring-2 ring-peach/30"
                        : "border-chocolate/10 hover:border-chocolate/20"
                    }`}
                    title={a.name}
                  >
                    <img
                      src={a.public_url}
                      alt={a.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {selectedAssets.length > 0 && (
          <p className="text-xs text-peach mt-1">
            {selectedAssets.length} asset{selectedAssets.length > 1 ? "s" : ""}{" "}
            selected — AI will include{" "}
            {selectedAssets.length === 1 ? "it" : "them"} in the ad
          </p>
        )}
      </div>
    );
  }

  // ==================== HOME ====================
  if (!flow) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl text-chocolate mb-3">
            Create ChiChi Ads
          </h1>
          <p className="text-chocolate/60 text-lg">
            Generate on-brand ads in seconds. Pick a flow to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => setFlow("reference")}
            className="group text-left p-8 bg-white rounded-2xl border-2 border-chocolate/10 hover:border-peach hover:shadow-lg transition-all"
          >
            <div className="w-14 h-14 bg-peach/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-peach/20 transition-colors">
              <svg className="w-7 h-7 text-peach" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl text-chocolate mb-2">
              Copy a Reference Ad
            </h2>
            <p className="text-sm text-chocolate/50">
              Upload an ad you like and we&apos;ll recreate it for ChiChi —
              same layout, your brand.
            </p>
          </button>

          <button
            onClick={() => setFlow("scratch")}
            className="group text-left p-8 bg-white rounded-2xl border-2 border-chocolate/10 hover:border-sky hover:shadow-lg transition-all"
          >
            <div className="w-14 h-14 bg-sky/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-sky/20 transition-colors">
              <svg className="w-7 h-7 text-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl text-chocolate mb-2">
              Create from Scratch
            </h2>
            <p className="text-sm text-chocolate/50">
              Describe your ad in plain English and AI will generate everything
              — copy, layout, colors.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ==================== FLOW 1: COPY REFERENCE ====================
  if (flow === "reference" && !hasGenerated) {
    return (
      <div className="max-w-2xl">
        <button onClick={resetFlow} className="flex items-center gap-1 text-sm text-chocolate/40 hover:text-chocolate mb-6 transition-colors">
          &larr; Back
        </button>
        <h1 className="font-heading text-3xl text-chocolate mb-2">Copy a Reference Ad</h1>
        <p className="text-chocolate/60 mb-8">
          Upload an ad you like. We&apos;ll recreate the exact layout for ChiChi.
        </p>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6 ${
            isDragActive ? "border-peach bg-peach/5" : referencePreview ? "border-peach/30 bg-peach/5" : "border-chocolate/20 hover:border-peach/50"
          }`}
        >
          <input {...getInputProps()} />
          {referencePreview ? (
            <div>
              <img src={referencePreview} alt="Reference" className="max-h-72 mx-auto rounded-lg mb-3" />
              <p className="text-sm text-chocolate/40">Click or drop to replace</p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-peach/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-peach" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-chocolate/80 font-medium text-lg">Drop your reference ad here</p>
              <p className="text-chocolate/40 text-sm mt-1">PNG, JPG, WebP — max 10MB</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">Ad Size</label>
            <select value={adSizeId} onChange={(e) => setAdSizeId(e.target.value)} className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              {adSizes.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">Flavor</label>
            <select value={flavor} onChange={(e) => setFlavor(e.target.value)} className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              {FLAVORS.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              <option value="social">Social Media</option>
              <option value="dtc">DTC / Website</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-chocolate mb-1.5">
            Direction for the ChiChi version <span className="font-normal text-chocolate/40">(optional)</span>
          </label>
          <textarea
            value={referenceNotes} onChange={(e) => setReferenceNotes(e.target.value)}
            placeholder="e.g., Use the exact same 6-box grid. Text for each box: HIGH PROTEIN - 13g complete protein..."
            className="w-full border border-chocolate/20 rounded-xl px-4 py-3 bg-vanilla text-chocolate text-sm h-24 resize-none placeholder:text-chocolate/30"
          />
        </div>

        <AssetPicker />

        {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>)}

        <button onClick={handleRecreate} disabled={!referencePreview || generating}
          className="w-full py-3.5 bg-peach text-white rounded-xl font-medium text-lg hover:bg-peach/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>Recreating your ad...
            </span>
          ) : "Recreate for ChiChi"}
        </button>
      </div>
    );
  }

  // ==================== FLOW 2: CREATE FROM SCRATCH ====================
  if (flow === "scratch" && !hasGenerated) {
    return (
      <div className="max-w-2xl">
        <button onClick={resetFlow} className="flex items-center gap-1 text-sm text-chocolate/40 hover:text-chocolate mb-6 transition-colors">
          &larr; Back
        </button>
        <h1 className="font-heading text-3xl text-chocolate mb-2">Create from Scratch</h1>
        <p className="text-chocolate/60 mb-8">Describe what you want and AI will design the full ad.</p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-chocolate mb-2">Describe your ad</label>
          <textarea value={adDescription} onChange={(e) => setAdDescription(e.target.value)}
            placeholder="e.g., A bold 2x3 grid showing 6 nutritional benefits. Use teal and vanilla colors. Make it pop."
            className="w-full border border-chocolate/20 rounded-xl px-4 py-3 bg-vanilla text-chocolate text-sm h-32 resize-none placeholder:text-chocolate/30" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">Ad Size</label>
            <select value={adSizeId} onChange={(e) => setAdSizeId(e.target.value)} className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              {adSizes.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">Flavor</label>
            <select value={flavor} onChange={(e) => setFlavor(e.target.value)} className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              {FLAVORS.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              <option value="social">Social Media</option>
              <option value="dtc">DTC / Website</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-chocolate/40 mb-2">Quick ideas:</p>
          <div className="flex flex-wrap gap-2">
            {["6-box grid showing nutritional benefits", "Bold promo — 20% off first order", "Lifestyle — cozy morning routine", "Protein-focused — gym & fitness angle", "Split layout — us vs regular oatmeal"].map((idea) => (
              <button key={idea} onClick={() => setAdDescription(idea)} className="text-xs px-3 py-1.5 bg-chocolate/5 text-chocolate/60 rounded-full hover:bg-chocolate/10 transition-colors">{idea}</button>
            ))}
          </div>
        </div>

        <AssetPicker />

        {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>)}

        <button onClick={handleCreateFromScratch} disabled={!adDescription.trim() || generating}
          className="w-full py-3.5 bg-sky text-white rounded-xl font-medium text-lg hover:bg-sky/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>Generating your ad...
            </span>
          ) : "Generate Ad"}
        </button>
      </div>
    );
  }

  // ==================== PREVIEW & EDIT ====================
  return (
    <div>
      {flow !== "edit" && (
        <button onClick={goBackToInput} className="flex items-center gap-1 text-sm text-chocolate/40 hover:text-chocolate mb-6 transition-colors">
          &larr; Back to {flow === "reference" ? "Reference" : "Description"}
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-8">
        {/* Left: Ad Preview */}
        <div>
          <h2 className="font-heading text-2xl text-chocolate mb-4">Your Ad</h2>
          <div ref={adPreviewRef} className="bg-white rounded-xl border border-chocolate/10 overflow-hidden inline-block"
            style={{ width: size.width * scale, height: size.height * scale }}>
            <div className="ad-render-target"
              style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: size.width, height: size.height }}
              dangerouslySetInnerHTML={{ __html: adHtml }} />
          </div>
          <p className="text-xs text-chocolate/30 mt-2">{size.width} x {size.height}px — Preview at {Math.round(scale * 100)}%</p>

          {/* Meta Ads Review Results */}
          {review && (
            <div className="mt-6 p-4 bg-white rounded-xl border border-chocolate/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl font-bold text-chocolate">{review.score}<span className="text-lg text-chocolate/40">/10</span></div>
                <p className="text-sm text-chocolate/70 flex-1">{review.verdict}</p>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[["Hook", review.hookScore], ["CTA", review.ctaScore], ["Clarity", review.clarityScore], ["Visual", review.visualScore]].map(([label, score]) => (
                  <div key={label} className="text-center p-2 bg-chocolate/5 rounded-lg">
                    <p className="text-xs text-chocolate/40">{label}</p>
                    <p className={`text-lg font-bold ${score >= 7 ? "text-green-600" : score >= 4 ? "text-yellow-600" : "text-red-500"}`}>{score}</p>
                  </div>
                ))}
              </div>

              {review.strengths?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
                  {review.strengths.map((s, i) => (
                    <p key={i} className="text-xs text-chocolate/70 pl-3 border-l-2 border-green-300 mb-1">{s}</p>
                  ))}
                </div>
              )}

              {review.improvements?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Improvements</p>
                  {review.improvements.map((imp, i) => (
                    <div key={i} className="mb-2 pl-3 border-l-2 border-red-300">
                      <p className="text-xs font-medium text-chocolate">{imp.issue}</p>
                      <p className="text-xs text-chocolate/60">{imp.fix}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${imp.priority === "high" ? "bg-red-100 text-red-700" : imp.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{imp.priority}</span>
                    </div>
                  ))}
                </div>
              )}

              {review.tips?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-sky mb-1">Platform Tips</p>
                  {review.tips.map((t, i) => (<p key={i} className="text-xs text-chocolate/60 mb-1">💡 {t}</p>))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          <button onClick={handleExport} disabled={exporting}
            className="w-full py-3 bg-peach text-white rounded-xl font-medium hover:bg-peach/90 transition-colors disabled:opacity-50">
            {exporting ? "Exporting..." : "Download PNG (2x)"}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 bg-chocolate/5 text-chocolate rounded-xl font-medium hover:bg-chocolate/10 transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save to Gallery"}
          </button>

          {/* AI Edit */}
          <div className="pt-3 border-t border-chocolate/10">
            <p className="text-xs font-medium text-chocolate/40 mb-2">Ask AI to Edit</p>
            <div className="flex gap-2">
              <input type="text" value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !editing && handleEditWithAI()}
                placeholder="e.g., Make headline bigger, change CTA to Shop Now, use teal background..."
                className="flex-1 border border-chocolate/20 rounded-lg px-3 py-2 text-sm bg-vanilla text-chocolate placeholder:text-chocolate/25" />
              <button onClick={handleEditWithAI} disabled={!editInstruction.trim() || editing}
                className="px-4 py-2 bg-sky text-white rounded-lg text-sm font-medium hover:bg-sky/90 transition-colors disabled:opacity-50 shrink-0">
                {editing ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                ) : "Apply"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {["Make headline bigger", "Change background to teal", "Add more whitespace", "Make CTA more urgent", "Simplify the layout"].map((q) => (
                <button key={q} onClick={() => setEditInstruction(q)}
                  className="text-xs px-2 py-0.5 bg-sky/5 text-sky/70 rounded hover:bg-sky/10 transition-colors">{q}</button>
              ))}
            </div>
          </div>

          {/* Regenerate */}
          <button onClick={handleRegenerate} disabled={generating}
            className="w-full py-2.5 bg-chocolate/5 text-chocolate rounded-xl font-medium hover:bg-chocolate/10 transition-colors disabled:opacity-50">
            {generating ? "Regenerating..." : "Regenerate"}
          </button>

          {/* Review for Conversions */}
          <button onClick={handleReviewAd} disabled={reviewing}
            className="w-full py-2.5 bg-dragon-fruit/10 text-dragon-fruit rounded-xl font-medium hover:bg-dragon-fruit/20 transition-colors disabled:opacity-50">
            {reviewing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>Reviewing...
              </span>
            ) : "Review for Conversions"}
          </button>

          {/* Edit Copy — dynamic fields */}
          <div className="pt-3 border-t border-chocolate/10">
            <p className="text-xs font-medium text-chocolate/40 mb-2">Edit Copy</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {Object.entries(fields).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs text-chocolate/40 mb-0.5">{formatFieldName(key)}</label>
                  {(value || "").length > 50 ? (
                    <textarea value={value}
                      onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                      className="w-full border border-chocolate/20 rounded-lg px-3 py-2 text-sm bg-vanilla text-chocolate h-16 resize-none" />
                  ) : (
                    <input type="text" value={value}
                      onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                      className="w-full border border-chocolate/20 rounded-lg px-3 py-2 text-sm bg-vanilla text-chocolate" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="pt-3 border-t border-chocolate/10">
            <p className="text-xs font-medium text-chocolate/40 mb-2">
              Colors <span className="font-normal">(use AI edit for best results)</span>
            </p>
            <div className="flex gap-1 flex-wrap">
              {Object.entries({ ...brandContext.colors.primary, ...brandContext.colors.pairings }).map(([name, hex]) => (
                <button key={hex}
                  onClick={() => setEditInstruction(`Change the main background color to ${name} (${hex})`)}
                  className="w-6 h-6 rounded border border-chocolate/10 hover:ring-2 hover:ring-peach/30 transition-all"
                  style={{ backgroundColor: hex }} title={`${name}: ${hex}`} />
              ))}
            </div>
          </div>

          {/* Ad Size */}
          <div className="pt-3 border-t border-chocolate/10">
            <p className="text-xs font-medium text-chocolate/40 mb-2">Ad Size</p>
            <select value={adSizeId} onChange={(e) => setAdSizeId(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm">
              {adSizes.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.width}x{s.height})</option>))}
            </select>
          </div>

          <button onClick={resetFlow} className="w-full py-2.5 text-chocolate/40 text-sm hover:text-chocolate transition-colors">
            Start Over
          </button>
        </div>
      </div>

      {error && (<div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>)}
    </div>
  );
}
