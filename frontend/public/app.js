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
// ECTOR PRIVADO - SUBIDA DE ARCHIVOS
// ===========================
const fileInput = document.getElementById('fileInput');
const uploadBox = document.querySelector('.upload-box');
const fileSelected = document.getElementById('fileSelected');
const fileName = document.getElementById('fileName');
const analyzeBtn = document.getElementById('analyzeBtn');
const changeFileBtn = document.getElementById('changeFileBtn');

if (fileInput && uploadBox) {
  fileInput.addEventListener('change', handleFileSelect);

  uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('drag-active');
  });
  uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag-active'));
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag-active');
    fileInput.files = e.dataTransfer.files;
    handleFileSelect();
  });

  function handleFileSelect() {
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
      sessionStorage.setItem("fileData", e.target.result);
      sessionStorage.setItem("fileName", file.name);
    };

    reader.readAsDataURL(file); // convierte el archivo a base64

    fileName.textContent = file.name;
    fileSelected.classList.remove("hidden");
    changeFileBtn.classList.remove("hidden");
    uploadBox.querySelector(".upload-btn").style.display = "none";
    uploadBox.querySelector(".drag-text").style.display = "none";
  }
}


  changeFileBtn.addEventListener('click', () => {
    fileInput.value = "";
    fileSelected.classList.add('hidden');
    changeFileBtn.classList.add('hidden');
    uploadBox.querySelector('.upload-btn').style.display = 'inline-block';
    uploadBox.querySelector('.drag-text').style.display = 'block';
    analyzeBtn.textContent = "Analizar documento";
    analyzeBtn.disabled = false;
    analyzeBtn.style = "";
  });
}

// ===========================
// REDIRECCIÓN AL VISOR
// ===========================
if (analyzeBtn) {
  analyzeBtn.addEventListener('click', () => {
    analyzeBtn.textContent = "🔍 Analizando...";
    analyzeBtn.disabled = true;
    analyzeBtn.style.opacity = "0.7";

    setTimeout(() => {
      analyzeBtn.textContent = "✅ Análisis completado";
      analyzeBtn.style.background = "#77c36b";
      analyzeBtn.style.color = "white";
      analyzeBtn.style.opacity = "1";

      const file = fileInput.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        sessionStorage.setItem("fileUrl", url);
        sessionStorage.setItem("fileName", file.name);
      }

      setTimeout(() => {
        window.location.href = "abrir-archivo.html";
      }, 1000);
    }, 2000);
  });
}

// ===========================
// VISOR DE DOCUMENTO
// ===========================
if (window.location.pathname.includes("abrir-archivo.html")) {
  const frame = document.getElementById("docFrame");
  const fileData = sessionStorage.getItem("fileData");
  const fileName = sessionStorage.getItem("fileName");

  if (fileData && frame) {
    const viewerContainer = document.querySelector(".doc-viewer");

    // Si es PDF → mostrarlo normalmente en el iframe
    if (fileName.toLowerCase().endsWith(".pdf")) {
      frame.src = fileData;
    } 
    // Si NO es PDF → reemplazamos SOLO el contenido del visor, no toda la estructura
    else {
      viewerContainer.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
          text-align: center;
          background: #fff;
        ">
          <h2 style="color:#333;">👀 No se puede mostrar este tipo de archivo</h2>
          <p style="margin-top:10px;">Descarga el documento para revisarlo:</p>
          <a href="${fileData}" download="${fileName}" 
            style="margin-top: 20px; background:#d4af37; color:#1f3c4d;
            padding:12px 24px; border-radius:8px; font-weight:700;
            text-decoration:none; box-shadow:0 3px 8px rgba(0,0,0,0.1);">
            📎 Descargar ${fileName}
          </a>
        </div>`;
    }

    document.title = `Visor - ${fileName}`;
  }
}

// ===========================
// 📊 CARGA DINÁMICA DE JSON PARA AMBOS SECTORES
// ===========================
if (document.getElementById("analysis-summary")) {
  const summaryContainer = document.getElementById("analysis-summary");

  // 1️⃣ Verifica si viene desde el sector privado (sessionStorage)
  const storedData = sessionStorage.getItem("analysisData");

  // 2️⃣ Si no, intenta cargar un JSON precargado del sector público
  // (esto puede adaptarse según la selección de estado/ciudad)
  const publicFile = sessionStorage.getItem("selectedPublicJson"); // ejemplo

  if (storedData) {
    const jsonData = JSON.parse(storedData);
    renderAnalysis(jsonData);
  } else if (publicFile) {
    fetch(publicFile)
      .then(res => res.json())
      .then(data => renderAnalysis(data))
      .catch(err => {
        summaryContainer.innerHTML = `<p style="color:red;">Error al cargar JSON público: ${err}</p>`;
      });
  } else {
    summaryContainer.innerHTML = "<p>No hay análisis cargado aún.</p>";
  }

  // 🔹 Función de renderización (común para ambos)
  function renderAnalysis(data) {
    if (!data || !data.resumen_general) {
      summaryContainer.innerHTML = "<p>No se encontró información del análisis.</p>";
      return;
    }

    const resumen = data.resumen_general;
    const alertas = data.alertas || [];
    const recomendaciones = data.recomendaciones || [];
    const partidas = data.partidas || [];

    summaryContainer.innerHTML = `
      <div class="summary-card">
        <h3>Resumen General</h3>
        <ul>
          <li><strong>Costo en contrato:</strong> $${resumen.costo_en_contrato.toLocaleString()}</li>
          <li><strong>Precio estimado de mercado:</strong> $${resumen.precio_estimado_mercado.toLocaleString()}</li>
          <li><strong>Diferencia total:</strong> $${resumen.diferencia_total.toLocaleString()} (${resumen.diferencia_porcentaje}%)</li>
          <li><strong>Credibilidad:</strong> ${resumen.credibilidad}%</li>
        </ul>
      </div>

      <div class="alerts-card">
        <h3>Alertas</h3>
        <ul>${alertas.map(a => `<li>⚠️ ${a}</li>`).join("")}</ul>
      </div>

      <div class="recs-card">
        <h3>Recomendaciones</h3>
        <ul>${recomendaciones.map(r => `<li>💡 ${r}</li>`).join("")}</ul>
      </div>

      <button id="toggleDetails" class="details-btn">Ver Detalles</button>
      <div id="detailsSection" class="details hidden">
        <h3>Partidas Detalladas</h3>
        <table class="partidas-table">
          <thead>
            <tr>
              <th>Concepto</th><th>Unidad</th><th>Cantidad</th><th>Costo Contrato</th><th>Precio Mercado</th><th>Diferencia</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            ${partidas.map(p => `
              <tr>
                <td>${p.concepto}</td>
                <td>${p.unidad}</td>
                <td>${p.cantidad}</td>
                <td>$${p.costo_en_contrato.toLocaleString()}</td>
                <td>$${p.precio_estimado_mercado.toLocaleString()}</td>
                <td>$${p.diferencia.toLocaleString()}</td>
                <td>${p["diferencia_%"].toFixed(2)}%</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;

    // 🔸 Toggle “Ver Detalles”
    const toggleBtn = document.getElementById("toggleDetails");
    const details = document.getElementById("detailsSection");
    toggleBtn.addEventListener("click", () => {
      details.classList.toggle("hidden");
      toggleBtn.textContent = details.classList.contains("hidden") ? "Ver Detalles" : "Ocultar Detalles";
    });
  }
}

// ===========================
// 📊 SIMULACIÓN DEL FLUJO JSON
// ===========================
if (document.getElementById("analysis-summary")) {
  const summaryContainer = document.getElementById("analysis-summary");

  // Simulación: seleccionamos el archivo público (sector público)
  const publicJson = "data/ejemplo_analisis.json";

  // Guardar la ruta (simulando una selección de estado/ciudad)
  sessionStorage.setItem("selectedPublicJson", publicJson);

  // Cargar el archivo
  const file = sessionStorage.getItem("selectedPublicJson");

  if (file) {
    fetch(file)
      .then(res => res.json())
      .then(data => renderAnalysis(data))
      .catch(err => {
        summaryContainer.innerHTML = `<p style="color:red;">Error al cargar JSON: ${err}</p>`;
      });
  }

  // Función común para mostrar el análisis
  function renderAnalysis(data) {
    if (!data || !data.resumen_general) {
      summaryContainer.innerHTML = "<p>No se encontró información del análisis.</p>";
      return;
    }

    const resumen = data.resumen_general;
    const alertas = data.alertas || [];
    const recomendaciones = data.recomendaciones || [];
    const partidas = data.partidas || [];

    summaryContainer.innerHTML = `
      <div class="summary-card">
        <h3>Resumen General</h3>
        <ul>
          <li><strong>Costo en contrato:</strong> $${resumen.costo_en_contrato.toLocaleString()}</li>
          <li><strong>Precio estimado de mercado:</strong> $${resumen.precio_estimado_mercado.toLocaleString()}</li>
          <li><strong>Diferencia total:</strong> $${resumen.diferencia_total.toLocaleString()} (${resumen.diferencia_porcentaje}%)</li>
          <li><strong>Credibilidad:</strong> ${resumen.credibilidad}%</li>
        </ul>
      </div>

      <div class="alerts-card">
        <h3>Alertas</h3>
        <ul>${alertas.map(a => `<li>⚠️ ${a}</li>`).join("")}</ul>
      </div>

      <div class="recs-card">
        <h3>Recomendaciones</h3>
        <ul>${recomendaciones.map(r => `<li>💡 ${r}</li>`).join("")}</ul>
      </div>

      <button id="toggleDetails" class="details-btn">Ver Detalles</button>
      <div id="detailsSection" class="details hidden">
        <h3>Partidas Detalladas</h3>
        <table class="partidas-table">
          <thead>
            <tr>
              <th>Concepto</th><th>Unidad</th><th>Cantidad</th><th>Costo Contrato</th><th>Precio Mercado</th><th>Diferencia</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            ${partidas.map(p => `
              <tr>
                <td>${p.concepto}</td>
                <td>${p.unidad}</td>
                <td>${p.cantidad}</td>
                <td>$${p.costo_en_contrato.toLocaleString()}</td>
                <td>$${p.precio_estimado_mercado.toLocaleString()}</td>
                <td>$${p.diferencia.toLocaleString()}</td>
                <td>${p["diferencia_%"].toFixed(2)}%</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;

    const toggleBtn = document.getElementById("toggleDetails");
    const details = document.getElementById("detailsSection");
    toggleBtn.addEventListener("click", () => {
      details.classList.toggle("hidden");
      toggleBtn.textContent = details.classList.contains("hidden") ? "Ver Detalles" : "Ocultar Detalles";
    });
  }
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
// Página: Sector Privado (subida)
// ===========================
(function wireSectorPrivado() {
  const uploadForm   = $("#uploadForm");
  const uploadBox    = $(".upload-box");
  const fileInput    = $("#fileInput");
  const fileSelected = $("#fileSelected");
  const fileNameSpan = $("#fileName");
  const analyzeBtn   = $("#analyzeBtn");
  const changeFileBtn = $("#changeFileBtn");

  if (!uploadForm || !uploadBox || !fileInput) return; // no estamos en esta página

  let selectedFiles = [];
  fileInput.multiple = true;

  function setFiles(files) {
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { alert("Selecciona al menos un PDF."); return; }
    if (pdfs.length > MAX_FILES) {
      alert(`Máximo ${MAX_FILES} archivos. Se tomarán los primeros ${MAX_FILES}.`);
    }
    selectedFiles = pdfs.slice(0, MAX_FILES);
    fileNameSpan.textContent = selectedFiles.map(f => f.name).join(", ");
    show(fileSelected);
    show(changeFileBtn);
  }

  // click abre selector
  on(uploadBox, "click", () => fileInput.click());
  on(fileInput, "change", (e) => setFiles(e.target.files));

  // drag & drop
  ["dragenter", "dragover", "dragleave", "drop"].forEach(ev => {
    on(uploadBox, ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ev === "dragenter" || ev === "dragover") uploadBox.classList.add("dragover");
      else uploadBox.classList.remove("dragover");
    });
  });
  on(uploadBox, "drop", (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) setFiles(dt.files);
  });

  // cambiar
  on(changeFileBtn, "click", () => {
    selectedFiles = [];
    fileInput.value = "";
    fileNameSpan.textContent = "";
    hide(fileSelected);
    hide(changeFileBtn);
  });

  // subir y pasar al visor (o quedarse y solo analizar; aquí guardamos info en sessionStorage)
  on(analyzeBtn, "click", async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) { alert("Primero selecciona archivos."); return; }

    const fd = new FormData();
    selectedFiles.forEach(f => fd.append("files", f, f.name));

    try {
      const upRes = await fetch(`${API_BASE}/api/upload/temp`, { method: "POST", body: fd });
      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({}));
        throw new Error(err.detail || `Error al subir (${upRes.status})`);
      }
      const upData = await upRes.json();

      // Guardar lo que necesitamos para el visor
      sessionStorage.setItem("ppm_saved_files", JSON.stringify(upData.saved || []));
      sessionStorage.setItem("ppm_saved_route", upData.ruta_relativa || "temp/temp");

      // Redirigir al visor (el otro HTML)
      // Ajusta el nombre de archivo si tu visor se llama distinto (p.ej. "visor.html")
      window.location.href = "visor.html";
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  });
})();



