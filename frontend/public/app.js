// ===========================
// 🌟 ANIMACIONES (INDEX)
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
// 📁 SECTOR PRIVADO - SUBIDA DE ARCHIVOS
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
// 🧭 REDIRECCIÓN AL VISOR
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
// 🖥️ VISOR DE DOCUMENTO
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

