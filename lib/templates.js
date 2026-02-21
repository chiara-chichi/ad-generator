export const templates = [
  {
    id: "hero-product",
    name: "Hero Product",
    description: "Product image centered prominently with headline and CTA below",
    category: "product",
    thumbnail: null,
    render: (vars) => `
      <div style="width:${vars.width}px;height:${vars.height}px;position:relative;overflow:hidden;background:${vars.backgroundColor || "#fffbec"};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${vars.fontFamily || "Questa Sans, sans-serif"};">
        ${vars.logo ? `<img src="${vars.logo}" style="position:absolute;top:${vars.height * 0.04}px;left:${vars.width * 0.04}px;height:${vars.height * 0.06}px;object-fit:contain;" crossorigin="anonymous" />` : ""}
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:${vars.width * 0.05}px;">
          ${vars.productImage ? `<img src="${vars.productImage}" style="max-width:${vars.width * 0.7}px;max-height:${vars.height * 0.5}px;object-fit:contain;" crossorigin="anonymous" />` : `<div style="width:${vars.width * 0.5}px;height:${vars.height * 0.35}px;background:${vars.accentColor || "#f0615a"}22;border-radius:16px;display:flex;align-items:center;justify-content:center;color:${vars.accentColor || "#f0615a"};font-size:${vars.width * 0.03}px;">Product Image</div>`}
        </div>
        <div style="padding:${vars.width * 0.06}px;text-align:center;width:100%;">
          <h1 style="font-family:${vars.headingFont || "Decoy, serif"};font-size:${vars.width * 0.07}px;color:${vars.textColor || "#4b1c10"};margin:0 0 ${vars.height * 0.015}px 0;line-height:1.1;">${vars.headline || "Your Headline Here"}</h1>
          ${vars.subheadline ? `<p style="font-size:${vars.width * 0.035}px;color:${vars.textColor || "#4b1c10"}cc;margin:0 0 ${vars.height * 0.02}px 0;line-height:1.3;">${vars.subheadline}</p>` : ""}
          ${vars.cta ? `<div style="display:inline-block;background:${vars.accentColor || "#f0615a"};color:white;padding:${vars.height * 0.015}px ${vars.width * 0.06}px;border-radius:100px;font-size:${vars.width * 0.03}px;font-weight:600;">${vars.cta}</div>` : ""}
        </div>
      </div>
    `,
  },
  {
    id: "lifestyle-overlay",
    name: "Lifestyle Overlay",
    description: "Full lifestyle background image with text overlay and semi-transparent backdrop",
    category: "lifestyle",
    thumbnail: null,
    render: (vars) => `
      <div style="width:${vars.width}px;height:${vars.height}px;position:relative;overflow:hidden;font-family:${vars.fontFamily || "Questa Sans, sans-serif"};">
        ${vars.backgroundImage ? `<img src="${vars.backgroundImage}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" />` : `<div style="position:absolute;inset:0;background:linear-gradient(135deg, ${vars.accentColor || "#f0615a"}, ${vars.backgroundColor || "#4b1c10"});"></div>`}
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0) 100%);"></div>
        ${vars.logo ? `<img src="${vars.logo}" style="position:absolute;top:${vars.height * 0.04}px;left:${vars.width * 0.04}px;height:${vars.height * 0.06}px;object-fit:contain;" crossorigin="anonymous" />` : ""}
        <div style="position:absolute;bottom:0;left:0;right:0;padding:${vars.width * 0.08}px;color:white;">
          <h1 style="font-family:${vars.headingFont || "Decoy, serif"};font-size:${vars.width * 0.08}px;margin:0 0 ${vars.height * 0.01}px 0;line-height:1.1;text-shadow:0 2px 8px rgba(0,0,0,0.3);">${vars.headline || "Your Headline Here"}</h1>
          ${vars.subheadline ? `<p style="font-size:${vars.width * 0.035}px;margin:0 0 ${vars.height * 0.02}px 0;line-height:1.3;opacity:0.9;text-shadow:0 1px 4px rgba(0,0,0,0.3);">${vars.subheadline}</p>` : ""}
          ${vars.cta ? `<div style="display:inline-block;background:${vars.accentColor || "#f0615a"};color:white;padding:${vars.height * 0.015}px ${vars.width * 0.06}px;border-radius:100px;font-size:${vars.width * 0.03}px;font-weight:600;">${vars.cta}</div>` : ""}
        </div>
      </div>
    `,
  },
  {
    id: "split-layout",
    name: "Split Layout",
    description: "50/50 split with image on one side and text on the other",
    category: "product",
    thumbnail: null,
    render: (vars) => {
      const isVertical = vars.height > vars.width;
      if (isVertical) {
        return `
          <div style="width:${vars.width}px;height:${vars.height}px;position:relative;overflow:hidden;background:${vars.backgroundColor || "#fffbec"};display:flex;flex-direction:column;font-family:${vars.fontFamily || "Questa Sans, sans-serif"};">
            <div style="flex:1;display:flex;align-items:center;justify-content:center;background:${vars.accentColor || "#f0615a"}11;position:relative;overflow:hidden;">
              ${vars.productImage ? `<img src="${vars.productImage}" style="max-width:90%;max-height:90%;object-fit:contain;" crossorigin="anonymous" />` : `<div style="width:60%;height:60%;background:${vars.accentColor || "#f0615a"}22;border-radius:16px;display:flex;align-items:center;justify-content:center;color:${vars.accentColor || "#f0615a"};font-size:${vars.width * 0.04}px;">Product Image</div>`}
            </div>
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:${vars.width * 0.08}px;">
              ${vars.logo ? `<img src="${vars.logo}" style="height:${vars.height * 0.04}px;object-fit:contain;margin-bottom:${vars.height * 0.02}px;align-self:flex-start;" crossorigin="anonymous" />` : ""}
              <h1 style="font-family:${vars.headingFont || "Decoy, serif"};font-size:${vars.width * 0.09}px;color:${vars.textColor || "#4b1c10"};margin:0 0 ${vars.height * 0.01}px 0;line-height:1.1;">${vars.headline || "Your Headline Here"}</h1>
              ${vars.subheadline ? `<p style="font-size:${vars.width * 0.04}px;color:${vars.textColor || "#4b1c10"}cc;margin:0 0 ${vars.height * 0.015}px 0;line-height:1.3;">${vars.subheadline}</p>` : ""}
              ${vars.body ? `<p style="font-size:${vars.width * 0.032}px;color:${vars.textColor || "#4b1c10"}99;margin:0 0 ${vars.height * 0.02}px 0;line-height:1.4;">${vars.body}</p>` : ""}
              ${vars.cta ? `<div style="display:inline-block;align-self:flex-start;background:${vars.accentColor || "#f0615a"};color:white;padding:${vars.height * 0.012}px ${vars.width * 0.08}px;border-radius:100px;font-size:${vars.width * 0.035}px;font-weight:600;">${vars.cta}</div>` : ""}
            </div>
          </div>
        `;
      }
      return `
        <div style="width:${vars.width}px;height:${vars.height}px;position:relative;overflow:hidden;background:${vars.backgroundColor || "#fffbec"};display:flex;font-family:${vars.fontFamily || "Questa Sans, sans-serif"};">
          <div style="flex:1;display:flex;align-items:center;justify-content:center;background:${vars.accentColor || "#f0615a"}11;position:relative;overflow:hidden;">
            ${vars.productImage ? `<img src="${vars.productImage}" style="max-width:85%;max-height:85%;object-fit:contain;" crossorigin="anonymous" />` : `<div style="width:60%;height:60%;background:${vars.accentColor || "#f0615a"}22;border-radius:16px;display:flex;align-items:center;justify-content:center;color:${vars.accentColor || "#f0615a"};font-size:${vars.width * 0.03}px;">Product Image</div>`}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:${vars.width * 0.06}px;">
            ${vars.logo ? `<img src="${vars.logo}" style="height:${vars.height * 0.08}px;object-fit:contain;margin-bottom:${vars.height * 0.04}px;align-self:flex-start;" crossorigin="anonymous" />` : ""}
            <h1 style="font-family:${vars.headingFont || "Decoy, serif"};font-size:${vars.width * 0.05}px;color:${vars.textColor || "#4b1c10"};margin:0 0 ${vars.height * 0.02}px 0;line-height:1.1;">${vars.headline || "Your Headline Here"}</h1>
            ${vars.subheadline ? `<p style="font-size:${vars.width * 0.025}px;color:${vars.textColor || "#4b1c10"}cc;margin:0 0 ${vars.height * 0.03}px 0;line-height:1.3;">${vars.subheadline}</p>` : ""}
            ${vars.body ? `<p style="font-size:${vars.width * 0.02}px;color:${vars.textColor || "#4b1c10"}99;margin:0 0 ${vars.height * 0.04}px 0;line-height:1.4;">${vars.body}</p>` : ""}
            ${vars.cta ? `<div style="display:inline-block;align-self:flex-start;background:${vars.accentColor || "#f0615a"};color:white;padding:${vars.height * 0.025}px ${vars.width * 0.05}px;border-radius:100px;font-size:${vars.width * 0.022}px;font-weight:600;">${vars.cta}</div>` : ""}
          </div>
        </div>
      `;
    },
  },
  {
    id: "bold-typography",
    name: "Bold Typography",
    description: "Minimal, large headline-focused layout with small product shot",
    category: "announcement",
    thumbnail: null,
    render: (vars) => `
      <div style="width:${vars.width}px;height:${vars.height}px;position:relative;overflow:hidden;background:${vars.backgroundColor || "#f0615a"};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${vars.fontFamily || "Questa Sans, sans-serif"};text-align:center;padding:${vars.width * 0.08}px;">
        ${vars.logo ? `<img src="${vars.logo}" style="position:absolute;top:${vars.height * 0.04}px;left:50%;transform:translateX(-50%);height:${vars.height * 0.06}px;object-fit:contain;" crossorigin="anonymous" />` : ""}
        <h1 style="font-family:${vars.headingFont || "Decoy, serif"};font-size:${vars.width * 0.12}px;color:${vars.textColor || "#fffbec"};margin:0 0 ${vars.height * 0.02}px 0;line-height:1.0;max-width:90%;">${vars.headline || "BIG HEADLINE"}</h1>
        ${vars.subheadline ? `<p style="font-size:${vars.width * 0.04}px;color:${vars.textColor || "#fffbec"}dd;margin:0 0 ${vars.height * 0.03}px 0;line-height:1.3;max-width:80%;">${vars.subheadline}</p>` : ""}
        ${vars.productImage ? `<img src="${vars.productImage}" style="max-width:${vars.width * 0.35}px;max-height:${vars.height * 0.2}px;object-fit:contain;margin-bottom:${vars.height * 0.02}px;" crossorigin="anonymous" />` : ""}
        ${vars.cta ? `<div style="display:inline-block;background:${vars.textColor || "#fffbec"};color:${vars.backgroundColor || "#f0615a"};padding:${vars.height * 0.015}px ${vars.width * 0.08}px;border-radius:100px;font-size:${vars.width * 0.035}px;font-weight:700;">${vars.cta}</div>` : ""}
      </div>
    `,
  },
];

export function getTemplate(id) {
  return templates.find((t) => t.id === id) || templates[0];
}
