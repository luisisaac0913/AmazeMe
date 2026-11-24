(() => {
    "use strict";

    const dropZone = document.getElementById("cmp-pdf-drop-zone");
    const fileInput = document.getElementById("cmp-pdf-file-input");
    const errorBox = document.getElementById("cmp-pdf-error");
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
        low: { scale: 1.5, quality: 0.85 },
        medium: { scale: 1.2, quality: 0.65 },
        high: { scale: 0.95, quality: 0.45 }
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

    async function loadPdfFile(file) {
        if (isBusy) return;
        showError("");
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
            const loadingTask = window.pdfjsLib.getDocument({
                data: currentBuffer.slice(0),
                disableWorker: !hasWorker
            });
            const pdf = await loadingTask.promise;

            fileNameEl.textContent = file.name;
            fileMetaEl.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? "página" : "páginas"} · ${formatBytes(file.size)}`;
            await pdf.destroy();

            resultWrap.classList.add("d-none");
            progressWrap.classList.add("d-none");
            downloadBtn.classList.add("d-none");
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
        compressedBytes = null;
        downloadBtn.classList.add("d-none");
        resultWrap.classList.add("d-none");
        startBtn.disabled = true;
        resetBtn.disabled = true;
        levelSelect.disabled = true;
        resetProgress();

        const preset = PRESETS[levelSelect.value] || PRESETS.medium;

        try {
            setProgress("Preparando documento...", 5);
            const hasWorker = await ensurePdfWorker();
            const pdf = await window.pdfjsLib.getDocument({
                data: currentBuffer.slice(0),
                disableWorker: !hasWorker
            }).promise;

            const outPdf = await window.PDFLib.PDFDocument.create();
            const total = pdf.numPages;

            for (let pageNum = 1; pageNum <= total; pageNum++) {
                const pct = 10 + Math.round(((pageNum - 1) / total) * 80);
                setProgress(`Procesando página ${pageNum} de ${total}...`, pct);

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
                if (!jpgBlob) throw new Error("No se pudo comprimir una de las páginas.");

                const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
                const embeddedJpg = await outPdf.embedJpg(jpgBytes);
                const outPage = outPdf.addPage([baseViewport.width, baseViewport.height]);
                outPage.drawImage(embeddedJpg, {
                    x: 0,
                    y: 0,
                    width: baseViewport.width,
                    height: baseViewport.height
                });

                canvas.width = 0;
                canvas.height = 0;
            }

            setProgress("Generando PDF comprimido...", 95);
            compressedBytes = await outPdf.save({ useObjectStreams: true });
            await pdf.destroy();

            setProgress("Completado", 100);

            const origSize = currentFile.size;
            const newSize = compressedBytes.byteLength;
            const diff = origSize - newSize;
            const pctSaved = origSize > 0 ? Math.round((diff / origSize) * 100) : 0;

            origSizeEl.textContent = formatBytes(origSize);
            newSizeEl.textContent = formatBytes(newSize);
            if (pctSaved > 0) {
                diffEl.textContent = `-${pctSaved}% (${formatBytes(diff)})`;
                diffEl.className = "fs-5 fw-bold text-primary";
            } else if (pctSaved === 0) {
                diffEl.textContent = "Sin cambios";
                diffEl.className = "fs-5 fw-bold text-secondary";
            } else {
                diffEl.textContent = `+${Math.abs(pctSaved)}%`;
                diffEl.className = "fs-5 fw-bold text-warning";
            }

            setTimeout(() => progressWrap.classList.add("d-none"), 250);
            resultWrap.classList.remove("d-none");
            downloadBtn.classList.remove("d-none");
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
        resultWrap.classList.add("d-none");
        progressWrap.classList.add("d-none");
        downloadBtn.classList.add("d-none");
        controlsWrap.classList.add("d-none");
        dropZone.classList.remove("d-none");
        showError("");
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

