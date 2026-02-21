"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function GalleryPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState("all");

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

  function handleDownload(ad) {
    if (!ad.output_image_url) return;
    const link = document.createElement("a");
    link.href = ad.output_image_url;
    link.download = `chichi-ad-${ad.flavor || "untitled"}-${ad.ad_size}.png`;
    link.click();
  }

  const filteredAds =
    filterChannel === "all"
      ? ads
      : ads.filter((a) => a.channel === filterChannel);

  return (
    <div>
      <h1 className="font-heading text-3xl text-chocolate mb-2">Gallery</h1>
      <p className="text-chocolate/60 mb-8">
        View and manage your generated ads.
      </p>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {["all", "instagram", "facebook", "pinterest", "other"].map((ch) => (
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
              <div className="aspect-square bg-chocolate/5 flex items-center justify-center overflow-hidden">
                {ad.output_image_url ? (
                  <img
                    src={ad.output_image_url}
                    alt={ad.name || "Generated ad"}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-chocolate/30 text-sm">No preview</div>
                )}
              </div>
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
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleDownload(ad)}
                    disabled={!ad.output_image_url}
                    className="flex-1 text-xs py-1.5 px-3 bg-peach text-white rounded-lg hover:bg-peach/90 transition-colors disabled:opacity-30"
                  >
                    Download
                  </button>
                  <a
                    href={`/?edit=${ad.id}`}
                    className="flex-1 text-xs py-1.5 px-3 bg-chocolate/5 text-chocolate rounded-lg hover:bg-chocolate/10 transition-colors text-center"
                  >
                    Re-edit
                  </a>
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
