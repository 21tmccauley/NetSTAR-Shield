import { h, meter, progress, toggle } from "./ui.js";
import { getSettings, saveSettings, scanUrl } from "./api.js";


const root = document.getElementById("root");
function Tabs(names, onChange) {
  const wrap = h("div", { class: "tabs" });
  const state = { active: names[0], buttons: {} };
  names.forEach((n) => {
    const b = h(
      "button",
      {
        class: "tab" + (n === state.active ? " active" : ""),
        onclick: () => {
          for (const [k, btn] of Object.entries(state.buttons))
            btn.classList.toggle("active", k === n);
          state.active = n;
          onChange(n);
        },
      },
      n
    );
    state.buttons[n] = b;
    wrap.append(b);
  });
  return {
    el: wrap,
    get active() {
      return state.active;
    },
  };
}
function SummarySection(state) {
  const card = h("div", { class: "card" }, [
    h("div", { class: "row" }, [
      h("div", { class: "left" }, [
        h("div", { class: "small" }, state.domain || "example.com"),
        h("div", { class: "warning" }, "Caution"),
      ]),
      h("div", { class: "right" }, meter(state.overall || 0)),
    ]),
    h("div", { class: "hr" }),
    h("div", {}, [
      h("div", { style: "font-weight:700;margin-bottom:4px" }, "Risk Score"),
      h(
        "div",
        { class: "small", style: "margin-bottom:6px" },
        "Overall Security"
      ),
    ]),
  ]);
  const analysis = h("div", {}, [
    h("div", { class: "section-title" }, "Security Analysis"),
    progress("Domain Reputation", state.metrics.domainReputation),
    progress("Domain Signals", state.metrics.domainSignals),
    progress("Certificate Trust", state.metrics.certificateTrust),
    progress("Connection Security", state.metrics.connectionSecurity),
    progress("Credential Safety", state.metrics.credentialSafety),
    progress("Page Content", state.metrics.pageContent),
  ]);
  return h("div", {}, [
    card,
    h("div", { style: "height:8px" }),
    h(
      "button",
      { class: "btn primary", onclick: () => alert("Details coming soon") },
      "Show Details"
    ),
    analysis,
  ]);
}
function DetailsSection() {
  return h("div", { class: "panel" }, [
    h("div", { class: "section-title" }, "Details"),
    h("ul", { class: "list" }, [
      h("li", {}, "Signals and evidence items here…"),
    ]),
  ]);
}
function BuildSection() {
  return h("div", { class: "panel" }, [
    h("div", { class: "section-title" }, "Build"),
    h("ul", { class: "list" }, [h("li", {}, "Version info & changelog…")]),
  ]);
}
function HistorySection() {
  return h("div", { class: "panel" }, [
    h("div", { class: "section-title" }, "History"),
    h("ul", { class: "list" }, [h("li", {}, "Recent scans…")]),
  ]);
}
function SettingsSection(s) {
  const prot = toggle(s.enabled, async (v) => {
    await saveSettings({ enabled: v });
    label.textContent = v ? "On" : "Off";
  });
  const label = h("span", {}, s.enabled ? "On" : "Off");
  return h("div", { class: "panel" }, [
    h("div", { class: "section-title" }, "Settings"),
    h("div", { class: "toggle" }, [label, prot]),
  ]);
}
async function main() {
  const s = await getSettings();
  const tabs = Tabs(
    ["Summary", "Details", "Build", "History", "Settings"],
    render
  );
  const header = h("div", { class: "header" }, [
    h("div", {}, [
      h("div", { class: "title" }, "NetStarShield"),
      h("div", { class: "version" }, "Security Extension v1.36.0"),
    ]),
    h("div", { class: "toggle" }, [
      h("span", {}, s.enabled ? "On" : "Off"),
      toggle(s.enabled, (v) => saveSettings({ enabled: v })),
    ]),
  ]);
  const scanBtn = h(
    "button",
    { class: "btn", onclick: onScan },
    "Scan current tab"
  );
  const container = h("div", {}, [
    header,
    tabs.el,
    h("div", { id: "content" }),
    h("div", { style: "height:8px" }),
    scanBtn,
  ]);
  root.append(container);
  let latest = await scanUrl(
    (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url ||
      ""
  );
  latest.domain = new URL(
    (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url ||
      "https://example.com"
  ).hostname;
  render(tabs.active);
  async function onScan() {
    scanBtn.textContent = "Scanning…";
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const res = await scanUrl(tab?.url || "");
      latest = {
        ...res,
        domain: tab?.url ? new URL(tab.url).hostname : "example.com",
      };
      render(tabs.active);
    } finally {
      scanBtn.textContent = "Scan current tab";
    }
  }
  function render(active) {
    const mount = document.getElementById("content");
    mount.innerHTML = "";
    if (active === "Summary") mount.append(SummarySection(latest));
    if (active === "Details") mount.append(DetailsSection());
    if (active === "Build") mount.append(BuildSection());
    if (active === "History") mount.append(HistorySection());
    if (active === "Settings") mount.append(SettingsSection(s));
  }
}
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", main)
  : main();
