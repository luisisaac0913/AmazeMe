(() => {
    "use strict";

    const dropZone = document.getElementById("cmp-pdf-drop-zone");
    const fileInput = document.getElementById("cmp-pdf-file-input");
    const errorBox = document.getElementById("cmp-pdf-error");
    const noticeBox = document.getElementById("cmp-pdf-notice");
    const controlsWrap = document.getElementById("cmp-pdf-controls");
    const fileNameEl = document.getElementById("cmp-pdf-file-name");
    const fileMetaEl = document.getElementById("cmp-pdf-file-meta");
    const resetBtn = document.getElementById("cmp-pdf-reset-btn");
    const levelSelect = document.getElementById("cmp-pdf-level");
    const progressWrap = document.getElementById("cmp-pdf-progress-wrap");
    const progressLabel = document.getElementById("cmp-pdf-progress-label");
    const progressPercent = document.getElementById("cmp-pdf-progress-percent");
    const progressBar = document.getElementById("cmp-pdf-progress-bar");
    const resultWrap = document.getElementById("cmp-pdf-result");
    const origSizeEl = document.getElementById("cmp-pdf-orig-size");
    const newSizeEl = document.getElementById("cmp-pdf-new-size");
    const diffEl = document.getElementById("cmp-pdf-diff");
    const startBtn = document.getElementById("cmp-pdf-start-btn");
    const downloadBtn = document.getElementById("cmp-pdf-download-btn");

    if (!dropZone || !fileInput) return;

    const PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const PRESETS = {
        low: { scale: 1.5, quality: 0.85, maxImgDim: 1800 },
        medium: { scale: 1.2, quality: 0.65, maxImgDim: 1300 },
        high: { scale: 0.95, quality: 0.45, maxImgDim: 900 }
    };

    let workerBlobUrl = null;
    let workerInitPromise = null;
    let currentFile = null;
    let currentBuffer = null;
    let compressedBytes = null;
    let isBusy = false;

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg || "";
        errorBox.classList.toggle("d-none", !msg);
    }

    function showNotice(msg) {
        if (!noticeBox) return;
        noticeBox.textContent = msg || "";
        noticeBox.classList.toggle("d-none", !msg);
    }

    function formatBytes(bytes) {
        if (!bytes) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
    }

    function resetProgress() {
        if (!progressBar) return;
        progressBar.style.transition = "none";
        progressBar.style.width = "0%";
        progressBar.setAttribute("aria-valuenow", "0");
        void progressBar.offsetWidth;
        progressBar.style.transition = "";
        progressLabel.textContent = "Comprimiendo...";
        progressPercent.textContent = "0%";
    }

    function setProgress(label, pct) {
        progressWrap.classList.remove("d-none");
        const clamped = Math.max(0, Math.min(100, Math.round(pct)));
        progressLabel.textContent = label;
        progressPercent.textContent = `${clamped}%`;
        progressBar.style.width = `${clamped}%`;
        progressBar.setAttribute("aria-valuenow", String(clamped));
    }

    async function ensurePdfWorker() {
        if (!window.pdfjsLib) return false;
        if (workerBlobUrl) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
            return true;
        }
        if (!workerInitPromise) {
            workerInitPromise = fetch(PDF_WORKER_URL)
                .then((res) => {
                    if (!res.ok) throw new Error("Worker fetch failed");
                    return res.blob();
                })
                .then((blob) => {
                    workerBlobUrl = URL.createObjectURL(blob);
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
                    return true;
                })
                .catch(() => false);
        }
        return workerInitPromise;
    }

    function recompressJpegBytes(jpegBytes, maxDim, quality) {
        return new Promise((resolve) => {
            const blob = new Blob([jpegBytes], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                const scale = Math.min(1, maxDim / Math.max(w, h));
                const targetW = Math.max(1, Math.round(w * scale));
                const targetH = Math.max(1, Math.round(h * scale));

                const canvas = document.createElement("canvas");
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, targetW, targetH);

                canvas.toBlob(
                    async (outBlob) => {
                        canvas.width = 0;
                        canvas.height = 0;
                        if (!outBlob) {
                            resolve(null);
                            return;
                        }
                        const arr = new Uint8Array(await outBlob.arrayBuffer());
                        resolve({ bytes: arr, width: targetW, height: targetH });
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        });
    }

    /**
     * Optimiza imágenes JPEG incrustadas y flujos de objetos manteniendo el texto vectorial intacto.
     */
    async function optimizeEmbeddedPdf(buffer, preset) {
        const { PDFDocument, PDFName, PDFRawStream, PDFNumber } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(buffer);
        const indirectObjects = pdfDoc.context.enumerateIndirectObjects();

        const subtypeKey = PDFName.of("Subtype");
        const imageVal = PDFName.of("Image");
        const filterKey = PDFName.of("Filter");
        const dctVal = PDFName.of("DCTDecode");
        const colorSpaceKey = PDFName.of("ColorSpace");
        const rgbVal = PDFName.of("DeviceRGB");
        const grayVal = PDFName.of("DeviceGray");
        const smaskKey = PDFName.of("SMask");
        const maskKey = PDFName.of("ImageMask");
        const decodeKey = PDFName.of("Decode");

        for (const [ref, obj] of indirectObjects) {
            if (!(obj instanceof PDFRawStream)) continue;
            const dict = obj.dict;
            if (dict.get(subtypeKey) !== imageVal) continue;
            if (dict.get(filterKey) !== dctVal) continue;
            if (dict.get(smaskKey) || dict.get(maskKey) || dict.get(decodeKey)) continue;

            const cs = dict.get(colorSpaceKey);
            if (cs !== rgbVal && cs !== grayVal) continue;
            if (obj.contents.length < 4096) continue;

            const recompressed = await recompressJpegBytes(obj.contents, preset.maxImgDim, preset.quality);
            if (!recompressed || recompressed.bytes.length >= obj.contents.length) continue;

            const newDict = dict.clone(pdfDoc.context);
            newDict.set(PDFName.of("Width"), PDFNumber.of(recompressed.width));
            newDict.set(PDFName.of("Height"), PDFNumber.of(recompressed.height));
            newDict.set(colorSpaceKey, rgbVal);
            newDict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
            newDict.set(PDFName.of("Length"), PDFNumber.of(recompressed.bytes.length));
            newDict.delete(PDFName.of("DecodeParms"));

            pdfDoc.context.assign(ref, PDFRawStream.of(newDict, recompressed.bytes));
        }

        return pdfDoc.save({ useObjectStreams: true });
    }

    async function renderPageAsJpeg(pdf, pageNum, preset) {
        const page = await pdf.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const renderViewport = page.getViewport({ scale: preset.scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(renderViewport.width));
        canvas.height = Math.max(1, Math.round(renderViewport.height));
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

        const jpgBlob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/jpeg", preset.quality);
        });

        canvas.width = 0;
        canvas.height = 0;

        if (!jpgBlob) throw new Error("No se pudo comprimir una de las páginas.");
        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
        return { jpgBytes, width: baseViewport.width, height: baseViewport.height };
    }

    async function loadPdfFile(file) {
        if (isBusy) return;
        showError("");
        showNotice("");

        if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
            showError("Selecciona un archivo PDF válido.");
            return;
        }
        if (!window.pdfjsLib || !window.PDFLib) {
            showError("No se pudieron cargar las librerías de PDF. Recarga la página e inténtalo de nuevo.");
            return;
        }

        try {
            currentFile = file;
            currentBuffer = await file.arrayBuffer();
            compressedBytes = null;

            const hasWorker = await ensurePdfWorker();
            const pdf = await window.pdfjsLib.getDocument({
                data: currentBuffer.slice(0),
                disableWorker: !hasWorker
            }).promise;

            fileNameEl.textContent = file.name;
            fileMetaEl.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? "página" : "páginas"} · ${formatBytes(file.size)}`;
            await pdf.destroy();

            resultWrap.classList.add("d-none");
            progressWrap.classList.add("d-none");
            downloadBtn.classList.add("d-none");
            startBtn.classList.remove("d-none");
            startBtn.className = "btn btn-primary";
            dropZone.classList.add("d-none");
            controlsWrap.classList.remove("d-none");
        } catch {
            currentFile = null;
            currentBuffer = null;
            showError("No se pudo abrir el PDF. Comprueba que no esté dañado ni protegido con contraseña.");
        }
    }

    async function compressCurrentPdf() {
        if (isBusy || !currentBuffer || !currentFile || !window.pdfjsLib || !window.PDFLib) return;

        isBusy = true;
        showError("");
        showNotice("");
        compressedBytes = null;
        downloadBtn.classList.add("d-none");
        resultWrap.classList.add("d-none");
        startBtn.disabled = true;
        resetBtn.disabled = true;
        levelSelect.disabled = true;
        resetProgress();

        const preset = PRESETS[levelSelect.value] || PRESETS.medium;
        const origSize = currentFile.size;

        try {
            setProgress("Optimizando estructura e imágenes del PDF...", 12);
            const vectorBytes = await optimizeEmbeddedPdf(currentBuffer.slice(0), preset);
            let bestBytes = vectorBytes.byteLength < origSize ? vectorBytes : new Uint8Array(currentBuffer);

            const vectorSavedRatio = (origSize - vectorBytes.byteLength) / Math.max(1, origSize);

            // Solo evalúa rasterización por página si el paso vectorial no redujo >= 15%
            if (vectorSavedRatio < 0.15) {
                const hasWorker = await ensurePdfWorker();
                const pdf = await window.pdfjsLib.getDocument({
                    data: currentBuffer.slice(0),
                    disableWorker: !hasWorker
                }).promise;

                const total = pdf.numPages;
                setProgress("Evaluando compresión por página...", 25);
                const firstRendered = await renderPageAsJpeg(pdf, 1, preset);
                const estimatedRasterSize = firstRendered.jpgBytes.byteLength * total;

                // Si la primera página ya supera el promedio por página del mejor resultado, evita inflar un PDF de texto/vectores
                if (estimatedRasterSize < bestBytes.byteLength * 0.95) {
                    const outPdf = await window.PDFLib.PDFDocument.create();
                    const firstImg = await outPdf.embedJpg(firstRendered.jpgBytes);
                    const p1 = outPdf.addPage([firstRendered.width, firstRendered.height]);
                    p1.drawImage(firstImg, { x: 0, y: 0, width: firstRendered.width, height: firstRendered.height });

                    for (let pageNum = 2; pageNum <= total; pageNum++) {
                        const pct = 25 + Math.round(((pageNum - 1) / total) * 65);
                        setProgress(`Procesando página ${pageNum} de ${total}...`, pct);

                        const rendered = await renderPageAsJpeg(pdf, pageNum, preset);
                        const embeddedJpg = await outPdf.embedJpg(rendered.jpgBytes);
                        const outPage = outPdf.addPage([rendered.width, rendered.height]);
                        outPage.drawImage(embeddedJpg, {
                            x: 0,
                            y: 0,
                            width: rendered.width,
                            height: rendered.height
                        });
                    }

                    setProgress("Generando PDF comprimido...", 95);
                    const rasterBytes = await outPdf.save({ useObjectStreams: true });
                    if (rasterBytes.byteLength < bestBytes.byteLength) {
                        bestBytes = rasterBytes;
                    }
                }

                await pdf.destroy();
            }

            setProgress("Completado", 100);
            compressedBytes = bestBytes;

            const newSize = bestBytes.byteLength;
            const diff = origSize - newSize;
            const pctSaved = origSize > 0 ? Math.round((diff / origSize) * 100) : 0;

            origSizeEl.textContent = formatBytes(origSize);
            newSizeEl.textContent = formatBytes(newSize);

            if (diff > 0 && pctSaved > 0) {
                newSizeEl.className = "fs-5 fw-bold text-primary";
                diffEl.textContent = `-${pctSaved}% (${formatBytes(diff)})`;
                diffEl.className = "fs-5 fw-bold text-primary";
                downloadBtn.classList.remove("d-none");
                startBtn.className = "btn btn-outline-secondary";
                startBtn.textContent = "Volver a comprimir";
            } else {
                newSizeEl.className = "fs-5 fw-bold";
                diffEl.textContent = "Ya optimizado (0%)";
                diffEl.className = "fs-5 fw-bold text-secondary";
                showNotice("Este PDF contiene principalmente texto o vectores ligeros y ya está optimizado; comprimirlo más aumentaría su tamaño.");
                downloadBtn.classList.add("d-none");
                startBtn.className = "btn btn-primary";
                startBtn.innerHTML = '<i class="bi bi-arrows-collapse me-1" aria-hidden="true"></i> Comprimir PDF';
            }

            setTimeout(() => progressWrap.classList.add("d-none"), 220);
            resultWrap.classList.remove("d-none");
        } catch (err) {
            progressWrap.classList.add("d-none");
            showError(err?.message || "Ocurrió un error al comprimir el PDF.");
        } finally {
            startBtn.disabled = false;
            resetBtn.disabled = false;
            levelSelect.disabled = false;
            isBusy = false;
        }
    }

    function resetTool() {
        if (isBusy) return;
        currentFile = null;
        currentBuffer = null;
        compressedBytes = null;
        fileInput.value = "";
        showError("");
        showNotice("");
        resultWrap.classList.add("d-none");
        progressWrap.classList.add("d-none");
        downloadBtn.classList.add("d-none");
        startBtn.className = "btn btn-primary";
        startBtn.innerHTML = '<i class="bi bi-arrows-collapse me-1" aria-hidden="true"></i> Comprimir PDF';
        controlsWrap.classList.add("d-none");
        dropZone.classList.remove("d-none");
    }

    dropZone.addEventListener("click", () => { if (!isBusy) fileInput.click(); });
    dropZone.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !isBusy) {
            e.preventDefault();
            fileInput.click();
        }
    });
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!isBusy) dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file) loadPdfFile(file);
    });
    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) loadPdfFile(file);
        fileInput.value = "";
    });

    levelSelect.addEventListener("change", () => {
        if (!isBusy && compressedBytes) {
            startBtn.className = "btn btn-outline-primary";
            startBtn.innerHTML = '<i class="bi bi-arrows-collapse me-1" aria-hidden="true"></i> Aplicar nuevo nivel';
        }
    });

    startBtn.addEventListener("click", compressCurrentPdf);
    resetBtn.addEventListener("click", resetTool);

    downloadBtn.addEventListener("click", () => {
        if (!compressedBytes || !currentFile) return;
        const baseName = currentFile.name.replace(/\.pdf$/i, "") || "documento";
        const blob = new Blob([compressedBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseName}-comprimido-amazeme.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
})();
