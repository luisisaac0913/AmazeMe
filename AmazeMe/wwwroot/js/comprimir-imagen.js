(() => {
    "use strict";

    const dropZone = document.getElementById("img-drop-zone");
    const fileInput = document.getElementById("img-file-input");
    const controlsPanel = document.getElementById("img-controls");
    const formatSelect = document.getElementById("img-format");
    const qualityRange = document.getElementById("img-quality");
    const qualityValue = document.getElementById("img-quality-value");
    const qualityHint = document.getElementById("img-quality-hint");
    const maxWidthWrap = document.getElementById("img-max-width-wrap");
    const maxWidthInput = document.getElementById("img-max-width");
    const icoSizeWrap = document.getElementById("img-ico-size-wrap");
    const icoSizeSelect = document.getElementById("img-ico-size");
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
        if (mime === "image/x-icon") return "ico";
        return "jpg";
    }

    /**
     * Empaqueta un Blob PNG cuadrado dentro de un contenedor .ico estándar (ICONDIR + ICONDIRENTRY).
     */
    async function buildIcoFromPngBlob(pngBlob, size) {
        const pngBuffer = await pngBlob.arrayBuffer();
        const headerSize = 22; // 6 bytes ICONDIR + 16 bytes ICONDIRENTRY
        const icoBuffer = new ArrayBuffer(headerSize + pngBuffer.byteLength);
        const view = new DataView(icoBuffer);

        // ICONDIR
        view.setUint16(0, 0, true); // Reservado
        view.setUint16(2, 1, true); // Tipo: 1 = ICO
        view.setUint16(4, 1, true); // Cantidad de imágenes: 1

        // ICONDIRENTRY (0 representa 256 px en el formato ICO)
        const dimByte = size >= 256 ? 0 : size;
        view.setUint8(6, dimByte);
        view.setUint8(7, dimByte);
        view.setUint8(8, 0); // Paleta (0 = sin paleta)
        view.setUint8(9, 0); // Reservado
        view.setUint16(10, 1, true); // Planos de color
        view.setUint16(12, 32, true); // Bits por píxel
        view.setUint32(14, pngBuffer.byteLength, true); // Tamaño del PNG
        view.setUint32(18, headerSize, true); // Offset del PNG

        new Uint8Array(icoBuffer, headerSize).set(new Uint8Array(pngBuffer));
        return new Blob([icoBuffer], { type: "image/x-icon" });
    }

    function updateFormatControls() {
        const mime = formatSelect.value;
        const isPng = mime === "image/png";
        const isIco = mime === "image/x-icon";

        qualityRange.disabled = isPng || isIco;
        if (qualityHint) {
            if (isIco) {
                qualityHint.textContent = "ICO genera un icono cuadrado sin pérdida listo para Windows o favicon.";
            } else if (isPng) {
                qualityHint.textContent = "PNG usa compresión sin pérdida; el control de calidad aplica a JPG y WebP.";
            } else {
                qualityHint.textContent = "Ajusta el equilibrio entre peso y nitidez visual.";
            }
        }

        if (maxWidthWrap) maxWidthWrap.classList.toggle("d-none", isIco);
        if (icoSizeWrap) icoSizeWrap.classList.toggle("d-none", !isIco);
    }

    function updateOutputUI(outputBlob, previewBlob, width, height) {
        compressedBlob = outputBlob;
        if (compressedUrl) URL.revokeObjectURL(compressedUrl);
        compressedUrl = URL.createObjectURL(previewBlob);

        compressedPreview.src = compressedUrl;
        compressedStats.textContent = `${formatBytes(outputBlob.size)} · ${width} × ${height} px`;

        const diff = currentFile.size - outputBlob.size;
        const pct = currentFile.size > 0 ? Math.round((diff / currentFile.size) * 100) : 0;

        if (pct > 0) {
            savingsBadge.textContent = `-${pct}% (${formatBytes(diff)} ahorrados)`;
            savingsBadge.className = "badge bg-success-subtle text-success border border-success-subtle";
        } else if (pct === 0) {
            savingsBadge.textContent = "Mismo peso";
            savingsBadge.className = "badge bg-light text-secondary border";
        } else {
            savingsBadge.textContent = `+${Math.abs(pct)}%`;
            savingsBadge.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle";
        }

        downloadBtn.disabled = false;
    }

    function processImage() {
        if (!currentImage || !currentFile) return;

        const mime = formatSelect.value;
        const quality = Number(qualityRange.value) / 100;

        if (mime === "image/x-icon") {
            const icoSize = parseInt(icoSizeSelect?.value || "256", 10) || 256;
            const canvas = document.createElement("canvas");
            canvas.width = icoSize;
            canvas.height = icoSize;
            const ctx = canvas.getContext("2d");

            // Centrar y escalar manteniendo proporción (contain) sobre fondo transparente
            const scale = Math.min(icoSize / currentImage.naturalWidth, icoSize / currentImage.naturalHeight);
            const drawW = Math.round(currentImage.naturalWidth * scale);
            const drawH = Math.round(currentImage.naturalHeight * scale);
            const offsetX = Math.floor((icoSize - drawW) / 2);
            const offsetY = Math.floor((icoSize - drawH) / 2);
            ctx.drawImage(currentImage, offsetX, offsetY, drawW, drawH);

            canvas.toBlob(async (pngBlob) => {
                if (!pngBlob) {
                    showError("No se pudo generar el archivo ICO.");
                    return;
                }
                const icoBlob = await buildIcoFromPngBlob(pngBlob, icoSize);
                updateOutputUI(icoBlob, pngBlob, icoSize, icoSize);
            }, "image/png");
            return;
        }

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
                updateOutputUI(blob, blob, targetWidth, targetHeight);
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
            updateFormatControls();
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
        updateFormatControls();
        processImage();
    });

    if (icoSizeSelect) {
        icoSizeSelect.addEventListener("change", processImage);
    }

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
        const downloadUrl = URL.createObjectURL(compressedBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `${baseName}-amazeme.${ext}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 3000);
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
