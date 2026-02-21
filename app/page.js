"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";
import { templates, getTemplate } from "@/lib/templates";
import { adSizes, getAdSize } from "@/lib/ad-sizes";
import { brandContext } from "@/lib/brand-context";
import { supabase } from "@/lib/supabase";

const STEPS = [
  { id: 1, label: "Reference" },
  { id: 2, label: "Configure" },
  { id: 3, label: "Copy" },
  { id: 4, label: "Preview & Export" },
];

const FLAVORS = [
  "All / General",
  ...new Set(brandContext.products.map((p) => p.flavor)),
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [adSizeId, setAdSizeId] = useState("instagram-square");
  const [templateId, setTemplateId] = useState("hero-product");
  const [flavor, setFlavor] = useState("All / General");
  const [channel, setChannel] = useState("social");

  const [brandAssets, setBrandAssets] = useState([]);
  const [selectedProductImage, setSelectedProductImage] = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(null);

  const [copyVariations, setCopyVariations] = useState([]);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [selectedCopy, setSelectedCopy] = useState(null);
  const [customCopy, setCustomCopy] = useState({
    headline: "",
    subheadline: "",
    body: "",
    cta: "",
  });
  const [userPrompt, setUserPrompt] = useState("");

  const [backgroundColor, setBackgroundColor] = useState("#fffbec");
  const [textColor, setTextColor] = useState("#4b1c10");
  const [accentColor, setAccentColor] = useState("#f0615a");

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const adPreviewRef = useRef(null);

  // Fetch brand assets on mount
  useEffect(() => {
    fetch("/api/brand-assets")
      .then((res) => res.json())
      .then((data) => setBrandAssets(data.assets || []))
      .catch(console.error);
  }, []);

  // Handle reference image upload
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

  // Analyze reference image
  async function handleAnalyze() {
    if (!referencePreview) return;
    setAnalyzing(true);
    try {
      const base64 = referencePreview.split(",")[1];
      const mediaType = referenceImage.type || "image/png";
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        if (data.analysis.suggestedTemplate) {
          setTemplateId(data.analysis.suggestedTemplate);
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  }

  // Generate copy
  async function handleGenerateCopy() {
    setGeneratingCopy(true);
    try {
      const product = brandContext.products.find((p) => p.flavor === flavor);
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flavor: flavor === "All / General" ? null : flavor,
          sku: product?.sku || null,
          channel,
          tone: "playful, warm, energetic",
          userPrompt: userPrompt || null,
          referenceAnalysis: analysis || null,
        }),
      });
      const data = await res.json();
      if (data.variations) {
        setCopyVariations(data.variations);
        setSelectedCopy(0);
        setCustomCopy(data.variations[0]);
      }
    } catch (err) {
      console.error("Copy generation failed:", err);
    } finally {
      setGeneratingCopy(false);
    }
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

      const flavorSlug = flavor === "All / General" ? "general" : flavor.toLowerCase().replace(/\s+/g, "-");
      saveAs(dataUrl, `chichi-${flavorSlug}-${size.width}x${size.height}.png`);
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
      const size = getAdSize(adSizeId);
      const { error } = await supabase.from("generated_ads").insert({
        name: customCopy.headline || "Untitled Ad",
        ad_size: `${size.width}x${size.height}`,
        template_id: templateId,
        headline: customCopy.headline,
        subheadline: customCopy.subheadline,
        body_copy: customCopy.body,
        cta_text: customCopy.cta,
        reference_analysis: analysis,
        selected_assets: {
          productImage: selectedProductImage,
          background: selectedBackground,
          logo: selectedLogo,
        },
        template_vars: { backgroundColor, textColor, accentColor },
        flavor: flavor === "All / General" ? null : flavor,
        channel,
      });
      if (error) throw error;
      alert("Saved to gallery!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Build template variables
  const size = getAdSize(adSizeId);
  const templateVars = {
    width: size.width,
    height: size.height,
    headline: customCopy.headline || "Your Headline Here",
    subheadline: customCopy.subheadline || "",
    body: customCopy.body || "",
    cta: customCopy.cta || "",
    productImage: selectedProductImage || "",
    backgroundImage: selectedBackground || "",
    logo: selectedLogo || "",
    backgroundColor,
    textColor,
    accentColor,
    fontFamily: "Questa Sans, system-ui, sans-serif",
    headingFont: "Decoy, serif",
  };

  const currentTemplate = getTemplate(templateId);
  const adHtml = currentTemplate.render(templateVars);

  // Preview scale
  const maxPreviewWidth = 500;
  const scale = Math.min(maxPreviewWidth / size.width, 1);

  return (
    <div>
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              step === s.id
                ? "bg-peach text-white"
                : step > s.id
                  ? "bg-peach/20 text-peach"
                  : "bg-chocolate/5 text-chocolate/40"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
              {s.id}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Reference Upload */}
      {step === 1 && (
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl text-chocolate mb-2">
            Upload a Reference Ad
          </h2>
          <p className="text-chocolate/60 mb-6">
            Upload an ad you like and we&apos;ll analyze its layout and style to
            recreate something similar for ChiChi.
          </p>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-peach bg-peach/5"
                : "border-chocolate/20 hover:border-peach/50"
            }`}
          >
            <input {...getInputProps()} />
            {referencePreview ? (
              <img
                src={referencePreview}
                alt="Reference"
                className="max-h-80 mx-auto rounded-lg"
              />
            ) : (
              <div>
                <p className="text-chocolate/80 font-medium text-lg">
                  Drop your reference ad here
                </p>
                <p className="text-chocolate/40 text-sm mt-1">
                  PNG, JPG, WebP — max 10MB
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            {referencePreview && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="px-6 py-2.5 bg-peach text-white rounded-full font-medium hover:bg-peach/90 transition-colors disabled:opacity-50"
              >
                {analyzing ? "Analyzing..." : "Analyze Reference"}
              </button>
            )}
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-chocolate/5 text-chocolate rounded-full font-medium hover:bg-chocolate/10 transition-colors"
            >
              {referencePreview ? "Skip Analysis" : "Start from Scratch"}
            </button>
          </div>

          {analysis && (
            <div className="mt-6 p-4 bg-white rounded-xl border border-chocolate/10">
              <h3 className="font-medium text-chocolate mb-2">
                Analysis Result
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-chocolate/40 text-xs mb-1">Layout</p>
                  <p className="text-chocolate">
                    {analysis.layout?.structure || "—"}
                  </p>
                  <p className="text-chocolate/60 text-xs mt-0.5">
                    {analysis.layout?.description || ""}
                  </p>
                </div>
                <div>
                  <p className="text-chocolate/40 text-xs mb-1">
                    Suggested Template
                  </p>
                  <p className="text-chocolate capitalize">
                    {analysis.suggestedTemplate?.replace(/-/g, " ") || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-chocolate/40 text-xs mb-1">Style Notes</p>
                  <p className="text-chocolate/80 text-xs">
                    {analysis.styleNotes || "—"}
                  </p>
                </div>
                {analysis.colorPalette && (
                  <div className="col-span-2">
                    <p className="text-chocolate/40 text-xs mb-1">
                      Color Palette
                    </p>
                    <div className="flex gap-1">
                      {analysis.colorPalette.map((c, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-lg border border-chocolate/10"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setStep(2)}
                className="mt-4 px-6 py-2 bg-peach text-white rounded-full text-sm font-medium hover:bg-peach/90"
              >
                Continue with Analysis
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="font-heading text-2xl text-chocolate mb-6">
              Configure Your Ad
            </h2>

            {/* Ad Size */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-chocolate mb-1.5">
                Ad Size
              </label>
              <select
                value={adSizeId}
                onChange={(e) => setAdSizeId(e.target.value)}
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate"
              >
                {adSizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.width}x{s.height})
                  </option>
                ))}
              </select>
            </div>

            {/* Template */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-chocolate mb-1.5">
                Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      templateId === t.id
                        ? "border-peach bg-peach/5"
                        : "border-chocolate/10 hover:border-chocolate/20"
                    }`}
                  >
                    <p className="text-sm font-medium text-chocolate">
                      {t.name}
                    </p>
                    <p className="text-xs text-chocolate/40 mt-0.5">
                      {t.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Flavor */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-chocolate mb-1.5">
                Flavor / Product
              </label>
              <select
                value={flavor}
                onChange={(e) => setFlavor(e.target.value)}
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate"
              >
                {FLAVORS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Channel */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-chocolate mb-1.5">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate"
              >
                <option value="social">Social Media</option>
                <option value="dtc">DTC / Website</option>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </div>

            {/* Colors */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-chocolate mb-1.5">
                Colors
              </label>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs text-chocolate/40 mb-1">
                    Background
                  </label>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-chocolate/10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-chocolate/40 mb-1">
                    Text
                  </label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-chocolate/10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-chocolate/40 mb-1">
                    Accent
                  </label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-chocolate/10"
                  />
                </div>
              </div>
              {/* Quick color swatches */}
              <div className="flex gap-1 mt-2">
                {Object.values({
                  ...brandContext.colors.primary,
                  ...brandContext.colors.pairings,
                }).map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setAccentColor(hex)}
                    className="w-6 h-6 rounded-md border border-chocolate/10"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            {/* Brand Assets Selection */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-chocolate mb-1.5">
                Brand Assets
              </label>
              {brandAssets.length === 0 ? (
                <p className="text-sm text-chocolate/40">
                  No assets uploaded yet.{" "}
                  <a href="/brand-kit" className="text-peach underline">
                    Upload some
                  </a>
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Product Image */}
                  <div>
                    <p className="text-xs text-chocolate/50 mb-1">
                      Product Image
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setSelectedProductImage(null)}
                        className={`shrink-0 w-14 h-14 rounded-lg border-2 flex items-center justify-center text-xs text-chocolate/30 ${
                          !selectedProductImage
                            ? "border-peach"
                            : "border-chocolate/10"
                        }`}
                      >
                        None
                      </button>
                      {brandAssets
                        .filter(
                          (a) =>
                            a.category === "product_photo" ||
                            a.category === "packaging"
                        )
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() =>
                              setSelectedProductImage(a.public_url)
                            }
                            className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden ${
                              selectedProductImage === a.public_url
                                ? "border-peach"
                                : "border-chocolate/10"
                            }`}
                          >
                            <img
                              src={a.public_url}
                              alt={a.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  </div>
                  {/* Background */}
                  <div>
                    <p className="text-xs text-chocolate/50 mb-1">Background</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setSelectedBackground(null)}
                        className={`shrink-0 w-14 h-14 rounded-lg border-2 flex items-center justify-center text-xs text-chocolate/30 ${
                          !selectedBackground
                            ? "border-peach"
                            : "border-chocolate/10"
                        }`}
                      >
                        None
                      </button>
                      {brandAssets
                        .filter(
                          (a) =>
                            a.category === "lifestyle" ||
                            a.category === "background"
                        )
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelectedBackground(a.public_url)}
                            className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden ${
                              selectedBackground === a.public_url
                                ? "border-peach"
                                : "border-chocolate/10"
                            }`}
                          >
                            <img
                              src={a.public_url}
                              alt={a.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  </div>
                  {/* Logo */}
                  <div>
                    <p className="text-xs text-chocolate/50 mb-1">Logo</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setSelectedLogo(null)}
                        className={`shrink-0 w-14 h-14 rounded-lg border-2 flex items-center justify-center text-xs text-chocolate/30 ${
                          !selectedLogo
                            ? "border-peach"
                            : "border-chocolate/10"
                        }`}
                      >
                        None
                      </button>
                      {brandAssets
                        .filter(
                          (a) =>
                            a.category === "logo" || a.category === "mascot"
                        )
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelectedLogo(a.public_url)}
                            className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden ${
                              selectedLogo === a.public_url
                                ? "border-peach"
                                : "border-chocolate/10"
                            }`}
                          >
                            <img
                              src={a.public_url}
                              alt={a.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-peach text-white rounded-full font-medium hover:bg-peach/90 transition-colors"
            >
              Next: Generate Copy
            </button>
          </div>

          {/* Live Preview (small) */}
          <div>
            <h3 className="text-sm font-medium text-chocolate/40 mb-2">
              Preview
            </h3>
            <div
              className="bg-white rounded-xl border border-chocolate/10 overflow-hidden inline-block"
              style={{ width: size.width * scale, height: size.height * scale }}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: size.width,
                  height: size.height,
                }}
                dangerouslySetInnerHTML={{ __html: adHtml }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Copy */}
      {step === 3 && (
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl text-chocolate mb-2">
            Ad Copy
          </h2>
          <p className="text-chocolate/60 mb-6">
            Generate AI copy or write your own. The AI knows ChiChi&apos;s brand
            voice.
          </p>

          {/* AI generation */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-chocolate mb-1.5">
              Direction for AI (optional)
            </label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="e.g., Focus on the protein content, make it punchy and fun..."
              className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm h-20 resize-none"
            />
            <button
              onClick={handleGenerateCopy}
              disabled={generatingCopy}
              className="mt-2 px-6 py-2.5 bg-peach text-white rounded-full font-medium hover:bg-peach/90 transition-colors disabled:opacity-50"
            >
              {generatingCopy ? "Generating..." : "Generate Copy with AI"}
            </button>
          </div>

          {/* Copy variations */}
          {copyVariations.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-chocolate mb-2">
                Pick a variation:
              </p>
              <div className="space-y-2">
                {copyVariations.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedCopy(i);
                      setCustomCopy(v);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedCopy === i
                        ? "border-peach bg-peach/5"
                        : "border-chocolate/10 hover:border-chocolate/20"
                    }`}
                  >
                    <p className="font-medium text-chocolate text-sm">
                      {v.headline}
                    </p>
                    <p className="text-xs text-chocolate/60 mt-0.5">
                      {v.subheadline}
                    </p>
                    {v.body && (
                      <p className="text-xs text-chocolate/40 mt-0.5">
                        {v.body}
                      </p>
                    )}
                    <p className="text-xs text-peach mt-1">{v.cta}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Editable copy fields */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-chocolate">
              Edit copy (or write from scratch):
            </p>
            <div>
              <label className="block text-xs text-chocolate/40 mb-1">
                Headline
              </label>
              <input
                type="text"
                value={customCopy.headline}
                onChange={(e) =>
                  setCustomCopy({ ...customCopy, headline: e.target.value })
                }
                placeholder="Your headline"
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-chocolate/40 mb-1">
                Subheadline
              </label>
              <input
                type="text"
                value={customCopy.subheadline}
                onChange={(e) =>
                  setCustomCopy({ ...customCopy, subheadline: e.target.value })
                }
                placeholder="Supporting line"
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-chocolate/40 mb-1">
                Body (optional)
              </label>
              <textarea
                value={customCopy.body}
                onChange={(e) =>
                  setCustomCopy({ ...customCopy, body: e.target.value })
                }
                placeholder="Additional body copy"
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm h-16 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-chocolate/40 mb-1">
                CTA
              </label>
              <input
                type="text"
                value={customCopy.cta}
                onChange={(e) =>
                  setCustomCopy({ ...customCopy, cta: e.target.value })
                }
                placeholder="Shop Now"
                className="w-full border border-chocolate/20 rounded-lg px-3 py-2 bg-vanilla text-chocolate text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-chocolate/5 text-chocolate rounded-full font-medium hover:bg-chocolate/10 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-2.5 bg-peach text-white rounded-full font-medium hover:bg-peach/90 transition-colors"
            >
              Next: Preview & Export
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Preview & Export */}
      {step === 4 && (
        <div>
          <h2 className="font-heading text-2xl text-chocolate mb-6">
            Preview & Export
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-8">
            {/* Ad Preview */}
            <div>
              <div
                ref={adPreviewRef}
                className="bg-white rounded-xl border border-chocolate/10 overflow-hidden inline-block"
                style={{
                  width: size.width * scale,
                  height: size.height * scale,
                }}
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
                Actual size: {size.width} x {size.height}px — Preview scaled to{" "}
                {Math.round(scale * 100)}%
              </p>
            </div>

            {/* Export controls */}
            <div className="space-y-3">
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
                className="w-full py-3 bg-chocolate/5 text-chocolate rounded-xl font-medium hover:bg-chocolate/10 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save to Gallery"}
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 bg-chocolate/5 text-chocolate rounded-xl font-medium hover:bg-chocolate/10 transition-colors"
              >
                Back to Edit Copy
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 bg-chocolate/5 text-chocolate rounded-xl font-medium hover:bg-chocolate/10 transition-colors"
              >
                Back to Configure
              </button>

              {/* Quick edit fields */}
              <div className="pt-3 border-t border-chocolate/10">
                <p className="text-xs font-medium text-chocolate/40 mb-2">
                  Quick Edit
                </p>
                <input
                  type="text"
                  value={customCopy.headline}
                  onChange={(e) =>
                    setCustomCopy({ ...customCopy, headline: e.target.value })
                  }
                  className="w-full border border-chocolate/20 rounded-lg px-2 py-1.5 text-xs bg-vanilla text-chocolate mb-2"
                  placeholder="Headline"
                />
                <input
                  type="text"
                  value={customCopy.subheadline}
                  onChange={(e) =>
                    setCustomCopy({
                      ...customCopy,
                      subheadline: e.target.value,
                    })
                  }
                  className="w-full border border-chocolate/20 rounded-lg px-2 py-1.5 text-xs bg-vanilla text-chocolate mb-2"
                  placeholder="Subheadline"
                />
                <input
                  type="text"
                  value={customCopy.cta}
                  onChange={(e) =>
                    setCustomCopy({ ...customCopy, cta: e.target.value })
                  }
                  className="w-full border border-chocolate/20 rounded-lg px-2 py-1.5 text-xs bg-vanilla text-chocolate"
                  placeholder="CTA"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
