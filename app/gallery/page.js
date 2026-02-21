"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";

/* ------------------------------------------------------------------ */
/*  Helper: replace {{token}} placeholders in AI-generated HTML       */
/* ------------------------------------------------------------------ */
function renderAdHtml(ad) {
  const html = ad.reference_analysis?.generatedHtml;
  const fields = ad.reference_analysis?.fields || {};
  if (!html) return null;
  let rendered = html;
  Object.entries(fields).forEach(([key, value]) => {
    rendered = rendered.replaceAll(`{{${key}}}`, value || "");
  });
  return rendered;
}

/* ------------------------------------------------------------------ */
/*  Helper: parse "1080x1080" → { width, height }                     */
/* ------------------------------------------------------------------ */
function parseAdSize(adSize) {
  if (!adSize) return { width: 1080, height: 1080 };
  const parts = adSize.split("x");
  return {
    width: parseInt(parts[0], 10) || 1080,
    height: parseInt(parts[1], 10) || 1080,
  };
}

/* ------------------------------------------------------------------ */
/*  Inline-rendered ad preview component (scaled to fit card)          */
/* ------------------------------------------------------------------ */
function AdPreview({ ad, maxWidth = 300 }) {
  const html = renderAdHtml(ad);
  const { width, height } = parseAdSize(ad.ad_size);
  const scale = maxWidth / width;
  const scaledHeight = height * scale;

  if (!html) {
    return (
      <div className="w-full h-full flex items-center justify-center text-chocolate/30 text-sm">
        No preview
      </div>
    );
  }

  return (
    <div
      style={{
        width: maxWidth,
        height: scaledHeight,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Channel filter options                                             */
/* ------------------------------------------------------------------ */
const CHANNELS = ["all", "social", "dtc", "retail", "wholesale"];

/* ================================================================== */
/*  Gallery Page                                                       */
/* ================================================================== */
export default function GalleryPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState("all");
  const [downloadingId, setDownloadingId] = useState(null);

  /* ---- Fetch ads on mount ---- */
  useEffect(() => {
    fetchAds();
  }, []);

  async function fetchAds() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("generated_ads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (err) {
      console.error("Failed to fetch ads:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ---- Delete ---- */
  async function handleDelete(ad) {
    if (!supabase || !confirm(`Delete "${ad.name || "this ad"}"?`)) return;
    try {
      if (ad.output_storage_path) {
        await supabase.storage
          .from("generated-ads")
          .remove([ad.output_storage_path]);
      }
      await supabase.from("generated_ads").delete().eq("id", ad.id);
      fetchAds();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  /* ---- Download: render at full size, capture as PNG ---- */
  async function handleDownload(ad) {
    const html = renderAdHtml(ad);

    // If there's an existing output image and no HTML to render, use the URL
    if (!html && ad.output_image_url) {
      const link = document.createElement("a");
      link.href = ad.output_image_url;
      link.download = `chichi-ad-${ad.flavor || "untitled"}-${ad.ad_size}.png`;
      link.click();
      return;
    }

    if (!html) return;

    setDownloadingId(ad.id);

    const { width, height } = parseAdSize(ad.ad_size);

    // Create a temporary hidden container at full ad dimensions
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.overflow = "hidden";
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      // Wait a tick so any images / fonts can load
      await new Promise((r) => setTimeout(r, 200));

      const dataUrl = await toPng(container, {
        width,
        height,
        pixelRatio: 2,
      });

      saveAs(
        dataUrl,
        `chichi-ad-${ad.flavor || "untitled"}-${ad.ad_size}.png`
      );
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      document.body.removeChild(container);
      setDownloadingId(null);
    }
  }

  /* ---- Re-edit: store ad data in localStorage, navigate ---- */
  function handleReEdit(ad) {
    localStorage.setItem(
      "editAd",
      JSON.stringify({
        generatedHtml: ad.reference_analysis?.generatedHtml,
        fields: ad.reference_analysis?.fields || {},
        adSize: ad.ad_size,
        flavor: ad.flavor,
        channel: ad.channel,
        backgroundColor: ad.template_vars?.backgroundColor,
        textColor: ad.template_vars?.textColor,
        accentColor: ad.template_vars?.accentColor,
      })
    );
    window.location.href = "/?edit=true";
  }

  /* ---- Duplicate: copy in Supabase, then open for re-edit ---- */
  async function handleDuplicate(ad) {
    if (!supabase) return;
    const { id, created_at, ...rest } = ad;
    rest.name = (rest.name || "Ad") + " (copy)";
    const { data, error } = await supabase
      .from("generated_ads")
      .insert(rest)
      .select()
      .single();
    if (!error && data) {
      handleReEdit(data);
    }
  }

  /* ---- Filtering ---- */
  const filteredAds =
    filterChannel === "all"
      ? ads
      : ads.filter((a) => a.channel === filterChannel);

  /* ---- No Supabase configured ---- */
  if (!supabase) {
    return (
      <div className="text-center py-16">
        <h1 className="font-heading text-3xl text-chocolate mb-4">Gallery</h1>
        <p className="text-chocolate/60">
          Supabase is not configured. Please add your Supabase credentials to
          view saved ads.
        </p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div>
      <h1 className="font-heading text-3xl text-chocolate mb-2">Gallery</h1>
      <p className="text-chocolate/60 mb-8">
        View and manage your generated ads.
      </p>

      {/* Channel filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => setFilterChannel(ch)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filterChannel === ch
                ? "bg-peach text-white"
                : "bg-chocolate/5 text-chocolate/70 hover:bg-chocolate/10"
            }`}
          >
            {ch}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-chocolate/40">Loading ads...</p>
      ) : filteredAds.length === 0 ? (
        <div className="text-center py-16 text-chocolate/40">
          <p className="text-lg mb-1">No ads generated yet</p>
          <p className="text-sm">
            Go to the{" "}
            <a href="/" className="text-peach underline">
              generator
            </a>{" "}
            to create your first ad
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredAds.map((ad) => (
            <div
              key={ad.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-chocolate/5 hover:shadow-md transition-shadow"
            >
              {/* Thumbnail: rendered HTML or fallback image */}
              <div className="bg-chocolate/5 flex items-center justify-center overflow-hidden">
                {ad.output_image_url && !renderAdHtml(ad) ? (
                  <img
                    src={ad.output_image_url}
                    alt={ad.name || "Generated ad"}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <AdPreview ad={ad} maxWidth={300} />
                )}
              </div>

              {/* Card info */}
              <div className="p-4">
                <h3 className="font-medium text-chocolate truncate">
                  {ad.name || ad.headline || "Untitled Ad"}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-chocolate/40">
                  <span>{ad.ad_size}</span>
                  {ad.flavor && (
                    <>
                      <span>-</span>
                      <span>{ad.flavor}</span>
                    </>
                  )}
                  {ad.channel && (
                    <>
                      <span>-</span>
                      <span className="capitalize">{ad.channel}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-chocolate/30 mt-1">
                  {new Date(ad.created_at).toLocaleDateString()}
                </p>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleDownload(ad)}
                    disabled={
                      downloadingId === ad.id ||
                      (!ad.output_image_url && !renderAdHtml(ad))
                    }
                    className="flex-1 text-xs py-1.5 px-3 bg-peach text-white rounded-lg hover:bg-peach/90 transition-colors disabled:opacity-30"
                  >
                    {downloadingId === ad.id ? "Exporting..." : "Download"}
                  </button>
                  <button
                    onClick={() => handleReEdit(ad)}
                    className="flex-1 text-xs py-1.5 px-3 bg-chocolate/5 text-chocolate rounded-lg hover:bg-chocolate/10 transition-colors text-center"
                  >
                    Re-edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(ad)}
                    className="text-xs py-1.5 px-3 bg-sky/10 text-sky rounded-lg hover:bg-sky/20 transition-colors"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => handleDelete(ad)}
                    className="text-xs py-1.5 px-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
