// ===========================
// Guard global para evitar doble cableado
// ===========================
if (!window.__ppmUploadWired) window.__ppmUploadWired = false;

// ===========================
// ANIMACIONES (INDEX)
// ===========================
const sections = document.querySelectorAll(".fade-in, .slide-in-right");
if (sections.length > 0) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.2 });
  sections.forEach(sec => observer.observe(sec));
}

// ===========================
// Config local
// ===========================
const API_BASE = "http://127.0.0.1:8000"; // Ajusta si tu FastAPI corre en otro host/puerto
const MAX_FILES = 3;

const $ = (s) => document.querySelector(s);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

// ===========================
// Utilidades: hashing & fingerprint "temp ingenioso"
// ===========================
async function sha256Hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Genera un fingerprint determinista de los archivos seleccionados.
 * Ordena por nombre, concatena "name:size" y saca SHA-256.
 * Devuelve { fp, bucket } donde bucket = primeros 8 hex (para sharding).
 */
async function buildClientFP(fileList) {
  const arr = Array.from(fileList).map(f => `${f.name}:${f.size}`).sort();
  const joined = arr.join("|");
  const fp = await sha256Hex(joined);
  const bucket = fp.slice(0, 8);
  return { fp, bucket };
}

// ===========================
// Utilidades: API helpers
// ===========================
/**
 * Pre-chequeo en servidor (por nombre + tamaño). Si el endpoint no existe, retorna null (fallback).
 * request: { items:[{name,size}], client_fp? }
 * response esperado:
 *  {
 *    items:[{name,size,exists,ruta_relativa,cache,analysis?}],
 *    ruta_relativa:"...",                // si aplica
 *    combined_cache:{...} | null         // si hay caché para la combinación
 *  }
 */
async function preflightCheck(files, clientFp) {
  const meta = Array.from(files).map(f => ({ name: f.name, size: f.size }));
  try {
    const res = await fetch(`${API_BASE}/api/files/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: meta, client_fp: clientFp || null })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Intenta obtener caché para una ruta.
 * GET /api/cache/get?ruta_relativa=...
 * response: { exists:true, analysis:{...} } o { exists:false }
 */
async function getCacheByRoute(rutaRelativa) {
  try {
    const res = await fetch(`${API_BASE}/api/cache/get?ruta_relativa=${encodeURIComponent(rutaRelativa)}`);
    if (!res.ok) return { exists: false };
    const data = await res.json();
    return { exists: !!data?.exists, analysis: data?.analysis || null };
  } catch {
    return { exists: false };
  }
}

/**
 * Analiza por ruta usando el endpoint preferido y un fallback compatible.
 * Devuelve el payload de análisis (objeto).
 */
async function fetchAnalysisByRoute(rutaRelativa) {
  let res, data;
  // Preferido: by-path
  try {
    res = await fetch(`${API_BASE}/api/analizar/by-path?ruta_relativa=${encodeURIComponent(rutaRelativa)}`);
    if (res.ok) {
      data = await res.json();
      return data?.resultado || data;
    }
  } catch {}

  // Fallback: segmentado
  try {
    const safe = rutaRelativa.replace(/^\/+/, "");
    res = await fetch(`${API_BASE}/api/analizar/${safe}`);
    if (res.ok) {
      data = await res.json();
      return data?.resultado || data;
    }
  } catch {}

  // Opcional: si tienes un "start" que dispara y devuelve analysis
  try {
    res = await fetch(`${API_BASE}/api/analyze/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruta_relativa: rutaRelativa })
    });
    if (res.ok) {
      data = await res.json();
      return data?.resultado || data?.analysis || data;
    }
  } catch {}

  throw new Error("No se pudo obtener el análisis por ruta.");
}

function rememberRouteAndMaybeCache(rutaRelativa, cacheAnalysis) {
  if (rutaRelativa) sessionStorage.setItem("ppm_saved_route", rutaRelativa);
  if (cacheAnalysis) sessionStorage.setItem("ppm_cached_analysis", JSON.stringify(cacheAnalysis));
}

// ===========================
// Render de análisis (reusado en visor y sector privado)
// ===========================
function renderAnalysis(intoEl, data) {
  if (!intoEl) return;
  if (!data || !data.resumen_general) {
    intoEl.innerHTML = "<p>No se encontró información del análisis.</p>";
    return;
  }

  const resumen = data.resumen_general;
  const alertas = data.alertas || [];
  const recomendaciones = data.recomendaciones || [];
  const partidas = data.partidas || [];

  intoEl.innerHTML = `
    <div class="summary-card">
      <h3>Resumen General</h3>
      <ul>
        <li><strong>Costo en contrato:</strong> $${(resumen.costo_en_contrato ?? 0).toLocaleString()}</li>
        <li><strong>Precio estimado de mercado:</strong> $${(resumen.precio_estimado_mercado ?? 0).toLocaleString()}</li>
        <li><strong>Diferencia total:</strong> $${(resumen.diferencia_total ?? 0).toLocaleString()} (${resumen.diferencia_porcentaje ?? 0}%)</li>
        <li><strong>Credibilidad:</strong> ${(resumen.credibilidad ?? 0)}%</li>
      </ul>
    </div>

    <div class="alerts-card">
      <h3>Alertas</h3>
      <ul>${alertas.map(a => `<li>⚠️ ${a}</li>`).join("") || "<li>Sin alertas</li>"}</ul>
    </div>

    <div class="recs-card">
      <h3>Recomendaciones</h3>
      <ul>${recomendaciones.map(r => `<li>💡 ${r}</li>`).join("") || "<li>Sin recomendaciones</li>"}</ul>
    </div>

    <button id="toggleDetails" class="details-btn">Ver Detalles</button>
    <div id="detailsSection" class="details hidden">
      <h3>Partidas Detalladas</h3>
      <table class="partidas-table">
        <thead>
          <tr>
            <th>Concepto</th><th>Unidad</th><th>Cantidad</th>
            <th>Costo Contrato</th><th>Precio Mercado</th><th>Diferencia</th><th>%</th>
          </tr>
        </thead>
        <tbody>
          ${partidas.map(p => `
            <tr>
              <td>${p.concepto ?? ""}</td>
              <td>${p.unidad ?? ""}</td>
              <td>${p.cantidad ?? ""}</td>
              <td>$${(p.costo_en_contrato ?? 0).toLocaleString()}</td>
              <td>$${(p.precio_estimado_mercado ?? 0).toLocaleString()}</td>
              <td>$${(p.diferencia ?? 0).toLocaleString()}</td>
              <td>${(p["diferencia_%"] ?? 0).toFixed ? p["diferencia_%"].toFixed(2) : (p["diferencia_%"] ?? "0")}%</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  const toggleBtn = document.getElementById("toggleDetails");
  const details = document.getElementById("detailsSection");
  on(toggleBtn, "click", () => {
    details.classList.toggle("hidden");
    toggleBtn.textContent = details.classList.contains("hidden") ? "Ver Detalles" : "Ocultar Detalles";
  });
}

// ===========================
// Página: Sector Privado (subida + dedupe + cache + análisis)
// ===========================
(function wireSectorPrivado() {
  if (window.__ppmUploadWired) return;
  window.__ppmUploadWired = true;

  const uploadForm    = $("#uploadForm");
  const uploadBox     = $(".upload-box");
  const fileInput     = $("#fileInput");
  const fileSelected  = $("#fileSelected");
  const fileNameSpan  = $("#fileName");
  const analyzeBtn    = $("#analyzeBtn");
  const changeFileBtn = $("#changeFileBtn");

  if (!uploadForm || !uploadBox || !fileInput) return; // no estamos en esta página

  let selectedFiles = [];
  fileInput.multiple = true;

  function setFiles(files) {
    const pdfs = Array.from(files).filter(f =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) { alert("Selecciona al menos un PDF."); return; }
    if (pdfs.length > MAX_FILES) alert(`Máximo ${MAX_FILES} archivos. Se tomarán los primeros ${MAX_FILES}.`);
    selectedFiles = pdfs.slice(0, MAX_FILES);

    // Previsualización opcional del primero
    const first = selectedFiles[0];
    if (first) {
      const reader = new FileReader();
      reader.onload = function (e) {
        sessionStorage.setItem("fileData", e.target.result);
        sessionStorage.setItem("fileName", first.name);
      };
      reader.readAsDataURL(first);
    }

    fileNameSpan.textContent = selectedFiles.map(f => f.name).join(", ");
    show(fileSelected);
    show(changeFileBtn);

    // Oculta textos de la caja
    const upBtn = uploadBox.querySelector(".upload-btn");
    const dragText = uploadBox.querySelector(".drag-text");
    if (upBtn) upBtn.style.display = "none";
    if (dragText) dragText.style.display = "none";
  }

  // Botón seleccionar
  const pickBtn = uploadBox ? uploadBox.querySelector(".upload-btn") : null;
  on(pickBtn, "click", (e) => {
    e.preventDefault(); e.stopPropagation();
    fileInput.click();
  });

  // Input change
  on(fileInput, "change", () => setFiles(fileInput.files));

  // Drag & Drop
  let suppressNextClick = false;
  ["dragenter","dragover","dragleave","drop"].forEach(ev => {
    on(uploadBox, ev, (e) => {
      e.preventDefault(); e.stopPropagation();

      if (ev === "dragenter" || ev === "dragover") {
        uploadBox.classList.add("drag-active");
      } else {
        uploadBox.classList.remove("drag-active");
      }

      if (ev === "drop") {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
          setFiles(dt.files);
          suppressNextClick = true;
          setTimeout(() => suppressNextClick = false, 0);
        }
      }
    });
  });

  on(uploadBox, "click", (e) => {
    if (suppressNextClick) { e.preventDefault(); e.stopPropagation(); return; }
    // Si quieres que cualquier click abra el selector, descomenta:
    // fileInput.click();
  });

  // Cambiar archivo(s)
  on(changeFileBtn, "click", () => {
    selectedFiles = [];
    fileInput.value = "";
    fileNameSpan.textContent = "";
    hide(fileSelected);
    hide(changeFileBtn);

    const upBtn = uploadBox.querySelector(".upload-btn");
    const dragText = uploadBox.querySelector(".drag-text");
    if (upBtn) upBtn.style.display = "inline-block";
    if (dragText) dragText.style.display = "block";

    if (analyzeBtn) {
      analyzeBtn.textContent = "Analizar documento";
      analyzeBtn.disabled = false;
      analyzeBtn.style.opacity = "";
      analyzeBtn.style.background = "";
      analyzeBtn.style.color = "";
    }
  });

  // Subir / cache / analizar / visor
  on(analyzeBtn, "click", async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) {
      alert("Primero selecciona archivos.");
      return;
    }

    analyzeBtn.textContent = "🔎 Revisando duplicados...";
    analyzeBtn.disabled = true;
    analyzeBtn.style.opacity = "0.7";

    try {
      // TEMP ingenioso: fingerprint determinista
      const { fp, bucket } = await buildClientFP(selectedFiles);
      const clientTemp = `temp/${bucket}/${fp}`;

      // 1) Pre-chequeo en servidor (por nombre y tamaño)
      const pre = await preflightCheck(selectedFiles, fp);

      // 1.a) Si el endpoint no existe o falló → fallback al flujo antiguo
      if (!pre) {
        analyzeBtn.textContent = "⬆️ Subiendo...";
        const fd = new FormData();
        selectedFiles.forEach(f => fd.append("files", f, f.name));
        const upRes = await fetch(`${API_BASE}/api/upload/temp?client_fp=${encodeURIComponent(fp)}`, {
          method: "POST", body: fd
        });
        if (!upRes.ok) {
          const err = await upRes.json().catch(() => ({}));
          throw new Error(err.detail || `Error al subir (${upRes.status})`);
        }
        const upData = await upRes.json();
        rememberRouteAndMaybeCache(upData.ruta_relativa || clientTemp, upData.analysis);
        analyzeBtn.textContent = "✅ Análisis iniciado";
        analyzeBtn.style.background = "#77c36b";
        analyzeBtn.style.color = "white";
        analyzeBtn.style.opacity = "1";
        setTimeout(() => { window.location.href = "abrir-archivo.html"; }, 600);
        return;
      }

      // 2) Hay pre-check; inspeccionamos resultados
      const items = pre.items || [];
      const allExist = items.length && items.every(it => it.exists);
      const someCache = !!(pre.combined_cache || items.find(it => it.cache && (it.analysis || pre.combined_cache)));

      const rutaRelativa =
        pre.ruta_relativa ||
        (items.map(i => i.ruta_relativa).filter(Boolean)[0]) ||
        clientTemp;

      // 2.a) Todos existen y hay caché → usar caché
      if (allExist && someCache) {
        const cacheAnalysis = pre.combined_cache || items.find(i => i.analysis)?.analysis;
        rememberRouteAndMaybeCache(rutaRelativa, cacheAnalysis);
        analyzeBtn.textContent = "✅ Usando caché";
        analyzeBtn.style.background = "#77c36b";
        analyzeBtn.style.color = "white";
        analyzeBtn.style.opacity = "1";
        setTimeout(() => { window.location.href = "abrir-archivo.html"; }, 400);
        return;
      }

      // 2.b) Existen pero sin caché → analizar por ruta
      if (allExist && !someCache) {
        analyzeBtn.textContent = "🧠 Analizando en servidor...";
        const analysis = await fetchAnalysisByRoute(rutaRelativa);
        rememberRouteAndMaybeCache(rutaRelativa, analysis);
        analyzeBtn.textContent = "✅ Análisis listo";
        analyzeBtn.style.background = "#77c36b";
        analyzeBtn.style.color = "white";
        analyzeBtn.style.opacity = "1";
        setTimeout(() => { window.location.href = "abrir-archivo.html"; }, 400);
        return;
      }

      // 2.c) Hay archivos nuevos → subir
      analyzeBtn.textContent = "⬆️ Subiendo nuevos...";
      const fd = new FormData();
      selectedFiles.forEach(f => fd.append("files", f, f.name));
      const upRes = await fetch(`${API_BASE}/api/upload/temp?client_fp=${encodeURIComponent(fp)}`, {
        method: "POST", body: fd
      });
      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({}));
        throw new Error(err.detail || `Error al subir (${upRes.status})`);
      }
      const upData = await upRes.json();
      rememberRouteAndMaybeCache(upData.ruta_relativa || rutaRelativa, upData.analysis);

      analyzeBtn.textContent = "✅ Análisis iniciado";
      analyzeBtn.style.background = "#77c36b";
      analyzeBtn.style.color = "white";
      analyzeBtn.style.opacity = "1";
      setTimeout(() => { window.location.href = "abrir-archivo.html"; }, 600);

    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
      analyzeBtn.textContent = "Analizar documento";
      analyzeBtn.disabled = false;
      analyzeBtn.style.opacity = "1";
    }
  });
})();

// ===========================
// VISOR DE DOCUMENTO (usa caché si existe; si no, analiza por ruta)
// ===========================
(function wireVisor() {
  if (!window.location.pathname.includes("abrir-archivo.html")) return;

  const frame   = document.getElementById("docFrame");
  const summary = document.getElementById("analysis-summary");

  // PDF local rápido del primero (opcional)
  const fileDataB64 = sessionStorage.getItem("fileData");
  const fileName    = sessionStorage.getItem("fileName");
  if (fileDataB64 && frame && fileName && fileName.toLowerCase().endsWith(".pdf")) {
    frame.src = fileDataB64;
    document.title = `Visor - ${fileName}`;
  }

  // 1) Si hay análisis cacheado en sessionStorage, úsalo
  const cached = sessionStorage.getItem("ppm_cached_analysis");
  if (cached) {
    try {
      const json = JSON.parse(cached);
      renderAnalysis(summary, json);
      return;
    } catch {}
  }

  // 2) Si no hay caché, analiza por ruta guardada (o temp calculado)
  const ruta = sessionStorage.getItem("ppm_saved_route") || "temp/__fallback__/unknown";
  getCacheByRoute(ruta)
    .then(async (r) => {
      if (r.exists && r.analysis) {
        renderAnalysis(summary, r.analysis);
        return;
      }
      // No hubo caché: analiza
      const payload = await fetchAnalysisByRoute(ruta);
      renderAnalysis(summary, payload);
    })
    .catch((err) => {
      console.error(err);
      if (summary) summary.innerHTML = `<p class="placeholder">Error al analizar: ${err.message}</p>`;
    });
})();

// ===========================
// (Opcional) Listado Estado → Ciudad → Obras (con indicador de caché)
// Útil si quieres que el privado también navegue por ciudades y obras.
// ===========================
(function wireCiudadesObras() {
  const cont = $("#ciudades-obras"); // contenedor (si existe en tu HTML)
  if (!cont) return;

  async function listObras(estado, ciudad) {
    cont.innerHTML = `<p>Cargando obras de <strong>${estado} / ${ciudad}</strong>...</p>`;
    try {
      const res = await fetch(`${API_BASE}/api/listar/${encodeURIComponent(estado)}/${encodeURIComponent(ciudad)}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const obras = data?.carpetas || [];
      if (!obras.length) { cont.innerHTML = `<p>No hay obras en esta ciudad.</p>`; return; }

      // Para cada obra, revisa si hay caché en su ruta
      const items = await Promise.all(obras.map(async (obra) => {
        const ruta = data.ruta_base ? `${data.ruta_base}/${obra}` : `${estado}/${ciudad}/${obra}`;
        const cache = await getCacheByRoute(ruta);
        return { obra, ruta, cache: cache.exists };
      }));

      cont.innerHTML = `
        <h3>Obras en ${ciudad}</h3>
        <ul class="obras-list">
          ${items.map(it => `
            <li>
              <button class="folder-btn" data-ruta="${it.ruta}">
                ${it.obra} ${it.cache ? '🟢 (cache)' : '⚪ (sin cache)'}
              </button>
            </li>
          `).join("")}
        </ul>
      `;

      cont.querySelectorAll("button.folder-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const ruta = btn.getAttribute("data-ruta");
          sessionStorage.setItem("ppm_saved_route", ruta);
          const c = await getCacheByRoute(ruta);
          if (c.exists && c.analysis) {
            sessionStorage.setItem("ppm_cached_analysis", JSON.stringify(c.analysis));
          } else {
            sessionStorage.removeItem("ppm_cached_analysis");
          }
          window.location.href = "abrir-archivo.html";
        });
      });

    } catch (e) {
      cont.innerHTML = `<p style="color:red;">${e.message}</p>`;
    }
  }

  // Si quieres, puedes exponer para que otro script lo use:
  window.__ppmListObras = listObras;
})();
