const dropZone = document.getElementById("bg-drop-zone");
const fileInput = document.getElementById("bg-file-input");
const errorBox = document.getElementById("bg-error");
const progressWrap = document.getElementById("bg-progress-wrap");
const progressLabel = document.getElementById("bg-progress-label");
const progressPercent = document.getElementById("bg-progress-percent");
const progressBar = document.getElementById("bg-progress-bar");
const resultWrap = document.getElementById("bg-result-wrap");
const originalPreview = document.getElementById("bg-original-preview");
const resultPreview = document.getElementById("bg-result-preview");
const originalStats = document.getElementById("bg-original-stats");
const resultStats = document.getElementById("bg-result-stats");
const downloadBtn = document.getElementById("bg-download-btn");
const resetBtn = document.getElementById("bg-reset-btn");

const MAX_SIDE_PX = 2000;
const CDN_ENDPOINTS = [
    "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm",
    "https://esm.sh/@imgly/background-removal@1.5.5"
];

let removeBackgroundFn = null;
let originalUrl = null;
let resultUrl = null;
let resultBlob = null;
let currentFileName = "imagen";
let isProcessing = false;

function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg || "";
    errorBox.classList.toggle("d-none", !msg);
}

function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function setProgress(label, pct, indeterminate = false) {
    if (!progressWrap) return;
    progressWrap.classList.remove("d-none");
    progressLabel.textContent = label;

    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    progressPercent.textContent = indeterminate ? "Procesando" : `${clamped}%`;
    progressBar.style.width = `${indeterminate ? 100 : clamped}%`;
    progressBar.setAttribute("aria-valuenow", String(indeterminate ? 100 : clamped));
    progressBar.classList.toggle("progress-bar-striped", indeterminate);
    progressBar.classList.toggle("progress-bar-animated", indeterminate);
}

function hideProgress() {
    if (!progressWrap) return;
    progressWrap.classList.add("d-none");
}

async function loadBgRemovalModule() {
    if (removeBackgroundFn) return removeBackgroundFn;

    let lastError = null;
    for (const url of CDN_ENDPOINTS) {
        try {
            const mod = await import(url);
            const fn = mod?.removeBackground || mod?.default;
            if (typeof fn === "function") {
                removeBackgroundFn = fn;
                return fn;
            }
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error("No se pudo cargar el motor de recorte local.");
}

function loadImageElement(file) {
    return new Promise((resolve, reject) => {
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(tempUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            reject(new Error("No se pudo leer el archivo de imagen."));
        };
        img.src = tempUrl;
    });
}

/**
 * Redimensiona la imagen en un canvas oculto si supera 2000 px en su lado mayor
 * para proteger la memoria en dispositivos móviles.
 */
async function prepareImageForMobileSafety(file) {
    const img = await loadImageElement(file);
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const maxSide = Math.max(origW, origH);

    if (maxSide <= MAX_SIDE_PX) {
        return {
            inputBlob: file,
            width: origW,
            height: origH,
            origWidth: origW,
            origHeight: origH,
            wasResized: false
        };
    }

    const scale = MAX_SIDE_PX / maxSide;
    const targetW = Math.round(origW * scale);
    const targetH = Math.round(origH * scale);

    const hiddenCanvas = document.createElement("canvas");
    hiddenCanvas.width = targetW;
    hiddenCanvas.height = targetH;
    const ctx = hiddenCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const resizedBlob = await new Promise((resolve) => {
        hiddenCanvas.toBlob((b) => resolve(b), "image/png");
    });

    if (!resizedBlob) {
        throw new Error("No se pudo preparar la imagen para procesarla.");
    }

    return {
        inputBlob: resizedBlob,
        width: targetW,
        height: targetH,
        origWidth: origW,
        origHeight: origH,
        wasResized: true
    };
}

async function processFile(file) {
    if (isProcessing) return;
    showError("");

    if (!file || !file.type.startsWith("image/")) {
        showError("Selecciona una imagen válida en formato JPG, PNG o WebP.");
        return;
    }

    isProcessing = true;
    resultBlob = null;
    downloadBtn.disabled = true;
    resultWrap.classList.add("d-none");
    dropZone.classList.add("d-none");

    currentFileName = file.name.replace(/\.[^/.]+$/, "") || "imagen";

    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = URL.createObjectURL(file);
    originalPreview.src = originalUrl;

    try {
        setProgress("Preparando imagen...", 5);
        const prepared = await prepareImageForMobileSafety(file);

        originalStats.textContent = prepared.wasResized
            ? `${formatBytes(file.size)} · ${prepared.origWidth} × ${prepared.origHeight} px (ajustada a ${prepared.width} × ${prepared.height} px)`
            : `${formatBytes(file.size)} · ${prepared.origWidth} × ${prepared.origHeight} px`;

        setProgress("Cargando motor local...", 10);
        const removeBackground = await loadBgRemovalModule();

        let lastDownloadPct = 0;
        let inInference = false;

        const outputBlob = await removeBackground(prepared.inputBlob, {
            output: {
                format: "image/png",
                quality: 1
            },
            progress: (key, current, total) => {
                const keyStr = String(key || "").toLowerCase();
                if (keyStr.includes("compute")) {
                    inInference = true;
                    const pct = total > 0 ? Math.round((current / total) * 100) : 100;
                    setProgress("Recortando fondo...", pct, total <= 0);
                    return;
                }

                if (!inInference) {
                    if (total > 0) {
                        const pct = Math.min(100, Math.round((current / total) * 100));
                        lastDownloadPct = Math.max(lastDownloadPct, pct);
                        setProgress(`Descargando modelo local (solo la primera vez)... ${lastDownloadPct}%`, lastDownloadPct);
                    } else {
                        setProgress("Descargando modelo local (solo la primera vez)...", lastDownloadPct || 15, true);
                    }
                }
            }
        });

        setProgress("Recortando fondo...", 100);

        resultBlob = outputBlob;
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultUrl = URL.createObjectURL(outputBlob);
        resultPreview.src = resultUrl;
        resultStats.textContent = `${formatBytes(outputBlob.size)} · ${prepared.width} × ${prepared.height} px (PNG transparente)`;

        hideProgress();
        resultWrap.classList.remove("d-none");
        downloadBtn.disabled = false;
    } catch (err) {
        hideProgress();
        dropZone.classList.remove("d-none");
        showError(err?.message || "Ocurrió un error al quitar el fondo de la imagen. Intenta con otra imagen.");
    } finally {
        isProcessing = false;
    }
}

function resetTool() {
    if (isProcessing) return;
    if (originalUrl) {
        URL.revokeObjectURL(originalUrl);
        originalUrl = null;
    }
    if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
        resultUrl = null;
    }
    resultBlob = null;
    fileInput.value = "";
    downloadBtn.disabled = true;
    resultWrap.classList.add("d-none");
    hideProgress();
    dropZone.classList.remove("d-none");
    showError("");
}

if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => {
        if (!isProcessing) fileInput.click();
    });

    dropZone.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
            e.preventDefault();
            fileInput.click();
        }
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!isProcessing) dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file) processFile(file);
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) processFile(file);
    });
}

if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
        if (!resultBlob) return;
        const url = URL.createObjectURL(resultBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${currentFileName}-sin-fondo-amazeme.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
}

if (resetBtn) {
    resetBtn.addEventListener("click", resetTool);
}

