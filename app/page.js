"use client";

import { useState, useRef, useCallback } from "react";
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
  // Flow state: null = home, "reference" = copy reference, "scratch" = from scratch
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

  // Export
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const adPreviewRef = useRef(null);

  // Dropzone for reference image
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

  // Render HTML by substituting field tokens
  function renderAd() {
    if (!generatedHtml) return "";
    let html = generatedHtml;
    Object.entries(fields).forEach(([key, value]) => {
      html = html.replaceAll(`{{${key}}}`, value || "");
    });
    return html;
  }

  // Update color in the generated HTML via find-replace
  function handleColorChange(type, newColor) {
    const oldColor =
      type === "bg"
        ? backgroundColor
        : type === "text"
          ? textColor
          : accentColor;
    if (oldColor && generatedHtml) {
      const escaped = oldColor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "gi");
      setGeneratedHtml((prev) => prev.replace(regex, newColor));
    }
    if (type === "bg") setBackgroundColor(newColor);
    else if (type === "text") setTextColor(newColor);
    else setAccentColor(newColor);
  }

  // Flow 1: Recreate from reference image
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
          userNotes: referenceNotes || null,
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
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Flow 2: Generate from scratch
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
          description: adDescription,
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
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Regenerate with same inputs
  async function handleRegenerate() {
    if (flow === "reference") await handleRecreate();
    else await handleCreateFromScratch();
  }

  // Reset everything
  function resetFlow() {
    setFlow(null);
    setGeneratedHtml(null);
    setFields({});
    setReferenceImage(null);
    setReferencePreview(null);
    setReferenceNotes("");
    setAdDescription("");
    setError(null);
    setBackgroundColor("#fffbec");
    setTextColor("#4b1c10");
    setAccentColor("#f0615a");
  }

  // Go back to input form (keep settings, clear generated ad)
  function goBackToInput() {
    setGeneratedHtml(null);
    setFields({});
    setError(null);
  }

  // Export as PNG
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
        pixelRatio: 1,
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

  // Save to gallery
  async function handleSave() {
    setSaving(true);
    try {
      if (!supabase) {
        alert("Gallery saving requires Supabase to be configured.");
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

  // Preview dimensions
  const size = getAdSize(adSizeId);
  const maxPreviewWidth = 500;
  const scale = Math.min(maxPreviewWidth / size.width, 1);
  const adHtml = renderAd();

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
          {/* Flow 1: Copy Reference */}
          <button
            onClick={() => setFlow("reference")}
            className="group text-left p-8 bg-white rounded-2xl border-2 border-chocolate/10 hover:border-peach hover:shadow-lg transition-all"
          >
            <div className="w-14 h-14 bg-peach/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-peach/20 transition-colors">
              <svg
                className="w-7 h-7 text-peach"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
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

          {/* Flow 2: Create from Scratch */}
          <button
            onClick={() => setFlow("scratch")}
            className="group text-left p-8 bg-white rounded-2xl border-2 border-chocolate/10 hover:border-sky hover:shadow-lg transition-all"
          >
            <div className="w-14 h-14 bg-sky/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-sky/20 transition-colors">
              <svg
                className="w-7 h-7 text-sky"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
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

  // ==================== FLOW 1: COPY REFERENCE (input) ====================
  if (flow === "reference" && !generatedHtml) {
    return (
      <div className="max-w-2xl">
        <button
          onClick={resetFlow}
          className="flex items-center gap-1 text-sm text-chocolate/40 hover:text-chocolate mb-6 transition-colors"
        >
          &larr; Back
        </button>

        <h1 className="font-heading text-3xl text-chocolate mb-2">
          Copy a Reference Ad
        </h1>
        <p className="text-chocolate/60 mb-8">
          Upload an ad you like. We&apos;ll recreate the exact layout for ChiChi
          using your brand colors and fonts.
        </p>

        {/* Upload zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6 ${
            isDragActive
              ? "border-peach bg-peach/5"
              : referencePreview
                ? "border-peach/30 bg-peach/5"
                : "border-chocolate/20 hover:border-peach/50"
          }`}
        >
          <input {...getInputProps()} />
          {referencePreview ? (
            <div>
              <img
                src={referencePreview}
                alt="Reference"
                className="max-h-72 mx-auto rounded-lg mb-3"
              />
              <p className="text-sm text-chocolate/40">
                Click or drop to replace
              </p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-peach/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-peach"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>
              <p className="text-chocolate/80 font-medium text-lg">
                Drop your reference ad here
              </p>
              <p className="text-chocolate/40 text-sm mt-1">
                PNG, JPG, WebP — max 10MB
              </p>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">
              Ad Size
            </label>
            <select
              value={adSizeId}
              onChange={(e) => setAdSizeId(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
            >
              {adSizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">
              Flavor
            </label>
            <select
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
            >
              {FLAVORS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
            >
              <option value="social">Social Media</option>
              <option value="dtc">DTC / Website</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
        </div>

        {/* Optional direction */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-chocolate mb-1.5">
            Any direction for the ChiChi version?{" "}
            <span className="font-normal text-chocolate/40">(optional)</span>
          </label>
          <textarea
            value={referenceNotes}
            onChange={(e) => setReferenceNotes(e.target.value)}
            placeholder="e.g., Use the exact same 6-box grid. The text for each box should be: HIGH PROTEIN - 13g complete protein per serving, GLUTEN FREE - Zero gluten..."
            className="w-full border border-chocolate/20 rounded-xl px-4 py-3 bg-vanilla text-chocolate text-sm h-24 resize-none placeholder:text-chocolate/30"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleRecreate}
          disabled={!referencePreview || generating}
          className="w-full py-3.5 bg-peach text-white rounded-xl font-medium text-lg hover:bg-peach/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
              Recreating your ad...
            </span>
          ) : (
            "Recreate for ChiChi"
          )}
        </button>
      </div>
    );
  }

  // ==================== FLOW 2: CREATE FROM SCRATCH (input) ====================
  if (flow === "scratch" && !generatedHtml) {
    return (
      <div className="max-w-2xl">
        <button
          onClick={resetFlow}
          className="flex items-center gap-1 text-sm text-chocolate/40 hover:text-chocolate mb-6 transition-colors"
        >
          &larr; Back
        </button>

        <h1 className="font-heading text-3xl text-chocolate mb-2">
          Create from Scratch
        </h1>
        <p className="text-chocolate/60 mb-8">
          Describe what you want and AI will design the full ad — layout, copy,
          colors, everything.
        </p>

        {/* Description input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-chocolate mb-2">
            Describe your ad
          </label>
          <textarea
            value={adDescription}
            onChange={(e) => setAdDescription(e.target.value)}
            placeholder="e.g., A bold 2x3 grid showing 6 nutritional benefits of ChiChi, similar to an infographic. Use our teal and vanilla colors. Make it pop."
            className="w-full border border-chocolate/20 rounded-xl px-4 py-3 bg-vanilla text-chocolate text-sm h-32 resize-none placeholder:text-chocolate/30"
          />
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">
              Ad Size
            </label>
            <select
              value={adSizeId}
              onChange={(e) => setAdSizeId(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
            >
              {adSizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">
              Flavor
            </label>
            <select
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
            >
              {FLAVORS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-chocolate/50 mb-1">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
            >
              <option value="social">Social Media</option>
              <option value="dtc">DTC / Website</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
        </div>

        {/* Quick ideas */}
        <div className="mb-6">
          <p className="text-xs text-chocolate/40 mb-2">Quick ideas:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "6-box grid showing nutritional benefits",
              "Bold promo ad — 20% off first order",
              "Lifestyle ad — cozy morning routine vibes",
              "Protein-focused — gym & fitness angle",
              "Split layout — product benefits vs competitors",
            ].map((idea) => (
              <button
                key={idea}
                onClick={() => setAdDescription(idea)}
                className="text-xs px-3 py-1.5 bg-chocolate/5 text-chocolate/60 rounded-full hover:bg-chocolate/10 transition-colors"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleCreateFromScratch}
          disabled={!adDescription.trim() || generating}
          className="w-full py-3.5 bg-sky text-white rounded-xl font-medium text-lg hover:bg-sky/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
              Generating your ad...
            </span>
          ) : (
            "Generate Ad"
          )}
        </button>
      </div>
    );
  }

  // ==================== PREVIEW & EDIT (shared by both flows) ====================
  return (
    <div>
      <button
        onClick={goBackToInput}
        className="flex items-center gap-1 text-sm text-chocolate/40 hover:text-chocolate mb-6 transition-colors"
      >
        &larr; Back to {flow === "reference" ? "Reference" : "Description"}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-8">
        {/* Left: Ad Preview */}
        <div>
          <h2 className="font-heading text-2xl text-chocolate mb-4">
            Your Ad
          </h2>

          <div
            ref={adPreviewRef}
            className="bg-white rounded-xl border border-chocolate/10 overflow-hidden inline-block"
            style={{ width: size.width * scale, height: size.height * scale }}
          >
            <div
              className="ad-render-target"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: size.width,
                height: size.height,
              }}
              dangerouslySetInnerHTML={{ __html: adHtml }}
            />
          </div>
          <p className="text-xs text-chocolate/30 mt-2">
            {size.width} x {size.height}px — Preview at{" "}
            {Math.round(scale * 100)}%
          </p>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-3 bg-peach text-white rounded-xl font-medium hover:bg-peach/90 transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Download PNG"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-chocolate/5 text-chocolate rounded-xl font-medium hover:bg-chocolate/10 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save to Gallery"}
          </button>

          {/* Regenerate */}
          <button
            onClick={handleRegenerate}
            disabled={generating}
            className="w-full py-2.5 bg-sky/10 text-sky rounded-xl font-medium hover:bg-sky/20 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-75"
                  />
                </svg>
                Regenerating...
              </span>
            ) : (
              "Regenerate"
            )}
          </button>

          {/* Edit Copy — dynamic fields */}
          <div className="pt-3 border-t border-chocolate/10">
            <p className="text-xs font-medium text-chocolate/40 mb-2">
              Edit Copy
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {Object.entries(fields).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs text-chocolate/40 mb-0.5">
                    {formatFieldName(key)}
                  </label>
                  {(value || "").length > 50 ? (
                    <textarea
                      value={value}
                      onChange={(e) =>
                        setFields({ ...fields, [key]: e.target.value })
                      }
                      className="w-full border border-chocolate/20 rounded-lg px-3 py-2 text-sm bg-vanilla text-chocolate h-16 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setFields({ ...fields, [key]: e.target.value })
                      }
                      className="w-full border border-chocolate/20 rounded-lg px-3 py-2 text-sm bg-vanilla text-chocolate"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="pt-3 border-t border-chocolate/10">
            <p className="text-xs font-medium text-chocolate/40 mb-2">Colors</p>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-chocolate/30 mb-1">
                  BG
                </label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => handleColorChange("bg", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-chocolate/10"
                />
              </div>
              <div>
                <label className="block text-xs text-chocolate/30 mb-1">
                  Text
                </label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => handleColorChange("text", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-chocolate/10"
                />
              </div>
              <div>
                <label className="block text-xs text-chocolate/30 mb-1">
                  Accent
                </label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleColorChange("accent", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-chocolate/10"
                />
              </div>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {Object.values({
                ...brandContext.colors.primary,
                ...brandContext.colors.pairings,
              }).map((hex) => (
                <button
                  key={hex}
                  onClick={() => handleColorChange("accent", hex)}
                  className="w-5 h-5 rounded border border-chocolate/10"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>

          {/* Start Over */}
          <button
            onClick={resetFlow}
            className="w-full py-2.5 text-chocolate/40 text-sm hover:text-chocolate transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
