(() => {
    "use strict";

    const dropZone = document.getElementById("resize-drop-zone");
    const fileInput = document.getElementById("resize-file-input");
    const errorBox = document.getElementById("resize-error");
    const controlsWrap = document.getElementById("resize-controls");
    const widthInput = document.getElementById("resize-width");
    const heightInput = document.getElementById("resize-height");
    const lockRatioCheck = document.getElementById("resize-lock-ratio");
    const formatSelect = document.getElementById("resize-format");
    const qualityRange = document.getElementById("resize-quality");
    const qualityValue = document.getElementById("resize-quality-value");
    const presetButtons = document.querySelectorAll("[data-resize-preset]");
    const originalPresetBtn = document.getElementById("resize-original-btn");
    const previewImg = document.getElementById("resize-preview");
    const outputStats = document.getElementById("resize-output-stats");
    const originalStats = document.getElementById("resize-original-stats");
    const downloadBtn = document.getElementById("resize-download-btn");
    const resetBtn = document.getElementById("resize-reset-btn");

    if (!dropZone || !fileInput) return;

    let currentFile = null;
    let currentImage = null;
    let outputBlob = null;
    let previewUrl = null;
    let aspectRatio = 1;

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

    function getExt(mime) {
        if (mime === "image/jpeg") return "jpg";
        if (mime === "image/webp") return "webp";
        return "png";
    }

    function syncQualityControl() {
        const isPng = formatSelect.value === "image/png";
        qualityRange.disabled = isPng;
    }

    function renderResized() {
        if (!currentImage || !currentFile) return;

        const w = Math.max(1, Math.min(8000, parseInt(widthInput.value, 10) || currentImage.naturalWidth));
        const h = Math.max(1, Math.min(8000, parseInt(heightInput.value, 10) || currentImage.naturalHeight));
        const mime = formatSelect.value;
        const quality = Number(qualityRange.value) / 100;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        if (mime === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(currentImage, 0, 0, w, h);

        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    showError("No se pudo generar la imagen redimensionada.");
                    return;
                }
                outputBlob = blob;
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                previewUrl = URL.createObjectURL(blob);
                previewImg.src = previewUrl;
                outputStats.textContent = `${w} × ${h} px · ${formatBytes(blob.size)}`;
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

        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(tempUrl);
            currentFile = file;
            currentImage = img;
            aspectRatio = img.naturalWidth / Math.max(1, img.naturalHeight);

            widthInput.value = String(img.naturalWidth);
            heightInput.value = String(img.naturalHeight);
            lockRatioCheck.checked = true;
            originalStats.textContent = `Original: ${img.naturalWidth} × ${img.naturalHeight} px · ${formatBytes(file.size)}`;

            dropZone.classList.add("d-none");
            controlsWrap.classList.remove("d-none");
            syncQualityControl();
            renderResized();
        };
        img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            showError("No se pudo leer la imagen seleccionada.");
        };
        img.src = tempUrl;
    }

    widthInput.addEventListener("input", () => {
        const w = parseInt(widthInput.value, 10);
        if (lockRatioCheck.checked && !Number.isNaN(w) && w > 0) {
            heightInput.value = String(Math.max(1, Math.round(w / aspectRatio)));
        }
        renderResized();
    });

    heightInput.addEventListener("input", () => {
        const h = parseInt(heightInput.value, 10);
        if (lockRatioCheck.checked && !Number.isNaN(h) && h > 0) {
            widthInput.value = String(Math.max(1, Math.round(h * aspectRatio)));
        }
        renderResized();
    });

    presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const [pw, ph] = btn.getAttribute("data-resize-preset").split("x").map(Number);
            if (!pw || !ph) return;
            lockRatioCheck.checked = false;
            widthInput.value = String(pw);
            heightInput.value = String(ph);
            renderResized();
        });
    });

    if (originalPresetBtn) {
        originalPresetBtn.addEventListener("click", () => {
            if (!currentImage) return;
            lockRatioCheck.checked = true;
            widthInput.value = String(currentImage.naturalWidth);
            heightInput.value = String(currentImage.naturalHeight);
            renderResized();
        });
    }

    formatSelect.addEventListener("change", () => {
        syncQualityControl();
        renderResized();
    });

    qualityRange.addEventListener("input", () => {
        qualityValue.textContent = `${qualityRange.value}%`;
        renderResized();
    });

    downloadBtn.addEventListener("click", () => {
        if (!outputBlob || !currentFile) return;
        const baseName = currentFile.name.replace(/\.[^/.]+$/, "") || "imagen";
        const ext = getExt(formatSelect.value);
        const url = URL.createObjectURL(outputBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseName}-${widthInput.value}x${heightInput.value}.${ext}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    });

    resetBtn.addEventListener("click", () => {
        currentFile = null;
        currentImage = null;
        outputBlob = null;
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        previewImg.removeAttribute("src");
        fileInput.value = "";
        downloadBtn.disabled = true;
        controlsWrap.classList.add("d-none");
        dropZone.classList.remove("d-none");
        showError("");
    });

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
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
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
})();

