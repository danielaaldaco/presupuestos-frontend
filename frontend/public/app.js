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
// Utilidades comunes
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
              <td>${(p["diferencia_%"] ?? 0).toFixed ? p["diferencia_%"].toFixed(2) : p["diferencia_%"] ?? "0"}%</td>
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
// Página: Sector Privado (subida)
// ===========================
(function wireSectorPrivado() {
  // Evita doble cableado
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

  function handleFileSelectFromInput() {
    if (fileInput.files.length > 0) {
      setFiles(fileInput.files);
    }
  }

  function setFiles(files) {
    const pdfs = Array.from(files).filter(f =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      alert("Selecciona al menos un PDF.");
      return;
    }
    if (pdfs.length > MAX_FILES) {
      alert(`Máximo ${MAX_FILES} archivos. Se tomarán los primeros ${MAX_FILES}.`);
    }
    selectedFiles = pdfs.slice(0, MAX_FILES);

    // (Opcional) Guarda base64 del primero para previsualización local si lo deseas
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

  // Solo el botón abre el selector (evita click fantasma tras drop)
  const pickBtn = uploadBox ? uploadBox.querySelector(".upload-btn") : null;
  on(pickBtn, "click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  // Input change
  on(fileInput, "change", handleFileSelectFromInput);

  // Drag & Drop sin disparar diálogo
  let suppressNextClick = false;
  ["dragenter","dragover","dragleave","drop"].forEach(ev => {
    on(uploadBox, ev, (e) => {
      e.preventDefault();
      e.stopPropagation();

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

  // (Opcional) Si quieres permitir click en toda la caja, protégelo:
  on(uploadBox, "click", (e) => {
    if (suppressNextClick) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Si quieres que cualquier click en la caja abra el selector, descomenta:
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

  // Subir a API y pasar al visor
  on(analyzeBtn, "click", async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) {
      alert("Primero selecciona archivos.");
      return;
    }

    analyzeBtn.textContent = "🔍 Analizando...";
    analyzeBtn.disabled = true;
    analyzeBtn.style.opacity = "0.7";

    const fd = new FormData();
    selectedFiles.forEach(f => fd.append("files", f, f.name));

    try {
      const upRes = await fetch(`${API_BASE}/api/upload/temp`, { method: "POST", body: fd });
      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({}));
        throw new Error(err.detail || `Error al subir (${upRes.status})`);
      }
      const upData = await upRes.json();

      analyzeBtn.textContent = "✅ Análisis iniciado";
      analyzeBtn.style.background = "#77c36b";
      analyzeBtn.style.color = "white";
      analyzeBtn.style.opacity = "1";

      // Guardar info para el visor
      sessionStorage.setItem("ppm_saved_files", JSON.stringify(upData.saved || []));
      sessionStorage.setItem("ppm_saved_route", upData.ruta_relativa || "temp/temp");

      setTimeout(() => {
        window.location.href = "abrir-archivo.html";
      }, 800);
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
// VISOR DE DOCUMENTO
// ===========================
(function wireVisor() {
  if (!window.location.pathname.includes("abrir-archivo.html")) return;

  const frame   = document.getElementById("docFrame");
  const summary = document.getElementById("analysis-summary");

  // Si guardaste base64 del primero, puedes mostrarlo localmente:
  const fileDataB64 = sessionStorage.getItem("fileData");
  const fileName    = sessionStorage.getItem("fileName");

  if (fileDataB64 && frame && fileName && fileName.toLowerCase().endsWith(".pdf")) {
    frame.src = fileDataB64;
    document.title = `Visor - ${fileName}`;
  }

  // Llama a TU endpoint existente de análisis (no modificado)
  fetch(`${API_BASE}/api/analizar/temp/temp/temp`)
    .then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Error análisis (${r.status})`);
      }
      return r.json();
    })
    .then((data) => {
      const payload = data?.resultado || data;
      renderAnalysis(summary, payload);
    })
    .catch((err) => {
      console.error(err);
      if (summary) summary.innerHTML = `<p class="placeholder">Error al analizar: ${err.message}</p>`;
    });
})();

// ===========================
// CARGA DINÁMICA DE JSON (si usas archivos públicos precargados)
// ===========================
(function wirePublicJson() {
  const summaryContainer = document.getElementById("analysis-summary");
  if (!summaryContainer) return;

  // Si vienes de sector privado, ya se llenará con el análisis arriba.
  // Si no, puedes cargar un JSON público (opcional):
  const storedData = sessionStorage.getItem("analysisData");
  const publicFile = sessionStorage.getItem("selectedPublicJson"); // e.g. "data/ejemplo_analisis.json"

  if (storedData) {
    try {
      const jsonData = JSON.parse(storedData);
      renderAnalysis(summaryContainer, jsonData);
      return;
    } catch {}
  }

  if (publicFile) {
    fetch(publicFile)
      .then(res => res.json())
      .then(data => renderAnalysis(summaryContainer, data))
      .catch(err => {
        summaryContainer.innerHTML = `<p style="color:red;">Error al cargar JSON público: ${err}</p>`;
      });
  }
})();
