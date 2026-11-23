(() => {
    "use strict";

    const dropZone = document.getElementById("img-drop-zone");
    const fileInput = document.getElementById("img-file-input");
    const controlsPanel = document.getElementById("img-controls");
    const formatSelect = document.getElementById("img-format");
    const qualityRange = document.getElementById("img-quality");
    const qualityValue = document.getElementById("img-quality-value");
    const qualityHint = document.getElementById("img-quality-hint");
    const maxWidthInput = document.getElementById("img-max-width");
    const originalPreview = document.getElementById("img-original-preview");
    const compressedPreview = document.getElementById("img-compressed-preview");
    const originalStats = document.getElementById("img-original-stats");
    const compressedStats = document.getElementById("img-compressed-stats");
    const savingsBadge = document.getElementById("img-savings-badge");
    const downloadBtn = document.getElementById("img-download-btn");
    const resetBtn = document.getElementById("img-reset-btn");
    const errorBox = document.getElementById("img-error");

    if (!dropZone || !fileInput) return;

    let currentFile = null;
    let currentImage = null;
    let compressedBlob = null;
    let originalUrl = null;
    let compressedUrl = null;

    function formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
    }

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.classList.toggle("d-none", !msg);
    }

    function getExtensionForMime(mime) {
        if (mime === "image/png") return "png";
        if (mime === "image/webp") return "webp";
        return "jpg";
    }

    function updateQualityAvailability() {
        const isPng = formatSelect.value === "image/png";
        qualityRange.disabled = isPng;
        if (qualityHint) {
            qualityHint.textContent = isPng
                ? "PNG usa compresión sin pérdida; el control de calidad aplica a JPG y WebP."
                : "Ajusta el equilibrio entre peso y nitidez visual.";
        }
    }

    function processImage() {
        if (!currentImage || !currentFile) return;

        const mime = formatSelect.value;
        const quality = Number(qualityRange.value) / 100;
        const maxWidth = parseInt(maxWidthInput.value, 10);

        let targetWidth = currentImage.naturalWidth;
        let targetHeight = currentImage.naturalHeight;

        if (!Number.isNaN(maxWidth) && maxWidth > 0 && targetWidth > maxWidth) {
            const ratio = maxWidth / targetWidth;
            targetWidth = maxWidth;
            targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (mime === "image/jpeg") {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
        }
        ctx.drawImage(currentImage, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    showError("No se pudo procesar la imagen en este formato.");
                    return;
                }
                compressedBlob = blob;
                if (compressedUrl) URL.revokeObjectURL(compressedUrl);
                compressedUrl = URL.createObjectURL(blob);

                compressedPreview.src = compressedUrl;
                compressedStats.textContent = `${formatBytes(blob.size)} · ${targetWidth} × ${targetHeight} px`;

                const diff = currentFile.size - blob.size;
                const pct = currentFile.size > 0 ? Math.round((diff / currentFile.size) * 100) : 0;

                if (pct > 0) {
                    savingsBadge.textContent = `-${pct}% (${formatBytes(diff)} ahorrados)`;
                    savingsBadge.className = "badge bg-success-subtle text-success border border-success-subtle";
                } else if (pct === 0) {
                    savingsBadge.textContent = "Mismo peso";
                    savingsBadge.className = "badge bg-light text-secondary border";
                } else {
                    savingsBadge.textContent = `+${Math.abs(pct)}% (prueba JPG o WebP)`;
                    savingsBadge.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle";
                }

                downloadBtn.disabled = false;
            },
            mime,
            mime === "image/png" ? undefined : quality
        );
    }

    function loadFile(file) {
        showError("");
        if (!file || !file.type.startsWith("image/")) {
            showError("Selecciona un archivo de imagen válido (JPG, PNG o WebP).");
            return;
        }

        currentFile = file;
        if (originalUrl) URL.revokeObjectURL(originalUrl);
        originalUrl = URL.createObjectURL(file);

        const img = new Image();
        img.onload = () => {
            currentImage = img;
            originalPreview.src = originalUrl;
            originalStats.textContent = `${formatBytes(file.size)} · ${img.naturalWidth} × ${img.naturalHeight} px`;
            controlsPanel.classList.remove("d-none");
            updateQualityAvailability();
            processImage();
        };
        img.onerror = () => {
            showError("No se pudo leer la imagen seleccionada.");
        };
        img.src = originalUrl;
    }

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.click();
        }
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file) loadFile(file);
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) loadFile(file);
    });

    formatSelect.addEventListener("change", () => {
        updateQualityAvailability();
        processImage();
    });

    qualityRange.addEventListener("input", () => {
        qualityValue.textContent = `${qualityRange.value}%`;
        processImage();
    });

    maxWidthInput.addEventListener("input", () => {
        processImage();
    });

    downloadBtn.addEventListener("click", () => {
        if (!compressedBlob || !currentFile) return;
        const baseName = currentFile.name.replace(/\.[^/.]+$/, "");
        const ext = getExtensionForMime(formatSelect.value);
        const link = document.createElement("a");
        link.href = compressedUrl;
        link.download = `${baseName}-amazeme.${ext}`;
        link.click();
    });

    resetBtn.addEventListener("click", () => {
        currentFile = null;
        currentImage = null;
        compressedBlob = null;
        fileInput.value = "";
        maxWidthInput.value = "";
        controlsPanel.classList.add("d-none");
        showError("");
    });
})();

