export function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (
    attrs == null ||
    typeof attrs !== "object" ||
    Array.isArray(attrs) ||
    attrs.nodeType ||
    typeof attrs === "string"
  ) {
    children = attrs;
    attrs = {};
  }
  attrs = attrs ?? {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class" || k === "className") el.className = String(v);
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) el.style[sk] = sv;
    } else if (k.startsWith("on") && typeof v === "function")
      el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  const arr = Array.isArray(children)
    ? children
    : children != null
    ? [children]
    : [];
  for (const c of arr)
    el.append(c?.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

export function meter(v) {
  const m = h("div", { class: "risk-meter", style: `--val:${v}` });
  m.append(h("div", { class: "inner" }, String(v)));
  return m;
}

export function progress(label, v) {
  return h("div", { class: "progress-row" }, [
    h("div", { class: "progress-label" }, label),
    (() => {
      const p = h("div", { class: "progress" });
      p.append(h("div", { class: "bar", style: `width:${v}%` }));
      return p;
    })(),
    h("div", { class: "value" }, String(v)),
  ]);
}

export function toggle(ch, on) {
  const wrap = h(
    "div",
    { class: "switch" + (ch ? " on" : "") },
    h("div", { class: "knob" })
  );
  wrap.onclick = () => {
    wrap.classList.toggle("on");
    on(wrap.classList.contains("on"));
  };
  return wrap;
}
