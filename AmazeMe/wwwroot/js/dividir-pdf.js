(() => {
    "use strict";

    const dropZone = document.getElementById("split-drop-zone");
    const fileInput = document.getElementById("split-file-input");
    const errorBox = document.getElementById("split-error");
    const controlsWrap = document.getElementById("split-controls");
    const fileNameEl = document.getElementById("split-file-name");
    const pageCountEl = document.getElementById("split-page-count");
    const resetBtn = document.getElementById("split-reset-btn");
    const modeRangeRadio = document.getElementById("split-mode-range");
    const modeAllRadio = document.getElementById("split-mode-all");
    const rangeWrap = document.getElementById("split-range-wrap");
    const rangeInput = document.getElementById("split-range-input");
    const rangeActions = document.getElementById("split-range-actions");
    const extractBtn = document.getElementById("split-extract-btn");
    const allWrap = document.getElementById("split-all-wrap");
    const allSummaryEl = document.getElementById("split-all-summary");
    const downloadAllBtn = document.getElementById("split-download-all-btn");
    const individualList = document.getElementById("split-individual-list");

    if (!dropZone || !fileInput) return;

    let currentDoc = null;
    let currentBaseName = "documento";
    let totalPages = 0;

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

    function triggerDownload(bytes, filename) {
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function parsePageRanges(raw, maxPage) {
        const input = (raw || "").trim();
        if (!input) {
            throw new Error("Escribe al menos una página o rango (por ejemplo: 1-3, 5).");
        }

        const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
        const indices = [];
        const seen = new Set();

        for (const part of parts) {
            if (/^\d+$/.test(part)) {
                const pageNum = parseInt(part, 10);
                if (pageNum < 1 || pageNum > maxPage) {
                    throw new Error(`La página ${pageNum} está fuera de rango (1 a ${maxPage}).`);
                }
                const idx = pageNum - 1;
                if (!seen.has(idx)) {
                    seen.add(idx);
                    indices.push(idx);
                }
            } else if (/^(\d+)\s*-\s*(\d+)$/.test(part)) {
                const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
                const start = parseInt(match[1], 10);
                const end = parseInt(match[2], 10);
                if (start < 1 || end < 1 || start > maxPage || end > maxPage) {
                    throw new Error(`El rango "${part}" excede el total de páginas (${maxPage}).`);
                }
                const step = start <= end ? 1 : -1;
                for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
                    const idx = p - 1;
                    if (!seen.has(idx)) {
                        seen.add(idx);
                        indices.push(idx);
                    }
                }
            } else {
                throw new Error(`Formato de rango no válido: "${part}". Usa números y guiones como 1-3, 5.`);
            }
        }

        if (indices.length === 0) {
            throw new Error("No se seleccionó ninguna página válida.");
        }
        return indices;
    }

    async function downloadSinglePage(pageIndex) {
        if (!currentDoc || !window.PDFLib) return;
        const outDoc = await window.PDFLib.PDFDocument.create();
        const [copied] = await outDoc.copyPages(currentDoc, [pageIndex]);
        outDoc.addPage(copied);
        const bytes = await outDoc.save();
        triggerDownload(bytes, `${currentBaseName}-pagina-${pageIndex + 1}.pdf`);
    }

    function renderIndividualPages() {
        individualList.innerHTML = "";
        allSummaryEl.textContent = `${totalPages} ${totalPages === 1 ? "página lista" : "páginas listas"} para descargar por separado`;

        for (let i = 0; i < totalPages; i++) {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex align-items-center justify-content-between gap-2";

            const label = document.createElement("div");
            label.className = "d-flex align-items-center gap-2";
            const badge = document.createElement("span");
            badge.className = "step-badge";
            badge.textContent = String(i + 1);
            const text = document.createElement("span");
            text.className = "fw-medium";
            text.textContent = `Página ${i + 1} de ${totalPages}`;
            label.appendChild(badge);
            label.appendChild(text);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-outline-primary btn-sm";
            btn.innerHTML = '<i class="bi bi-download me-1" aria-hidden="true"></i>Descargar';
            btn.addEventListener("click", async () => {
                btn.disabled = true;
                try {
                    await downloadSinglePage(i);
                } catch {
                    showError(`No se pudo extraer la página ${i + 1}.`);
                } finally {
                    btn.disabled = false;
                }
            });

            li.appendChild(label);
            li.appendChild(btn);
            individualList.appendChild(li);
        }
    }

    function syncModeUI() {
        const isRange = modeRangeRadio.checked;
        rangeWrap.classList.toggle("d-none", !isRange);
        rangeActions.classList.toggle("d-none", !isRange);
        allWrap.classList.toggle("d-none", isRange);
    }

    async function loadPdfFile(file) {
        showError("");
        if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
            showError("Selecciona un archivo PDF válido.");
            return;
        }
        if (!window.PDFLib) {
            showError("No se pudo cargar la librería pdf-lib. Recarga la página e inténtalo de nuevo.");
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            currentDoc = await window.PDFLib.PDFDocument.load(buffer);
            totalPages = currentDoc.getPageCount();
            currentBaseName = file.name.replace(/\.pdf$/i, "") || "documento";

            fileNameEl.textContent = file.name;
            pageCountEl.textContent = `${totalPages} ${totalPages === 1 ? "página" : "páginas"} · ${formatBytes(file.size)}`;
            rangeInput.value = totalPages > 1 ? `1-${Math.min(3, totalPages)}` : "1";

            renderIndividualPages();
            syncModeUI();
            dropZone.classList.add("d-none");
            controlsWrap.classList.remove("d-none");
        } catch {
            showError("No se pudo abrir el PDF. Comprueba que no esté dañado ni protegido con contraseña.");
        }
    }

    function resetTool() {
        currentDoc = null;
        totalPages = 0;
        fileInput.value = "";
        individualList.innerHTML = "";
        controlsWrap.classList.add("d-none");
        dropZone.classList.remove("d-none");
        showError("");
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
    });

    modeRangeRadio.addEventListener("change", syncModeUI);
    modeAllRadio.addEventListener("change", syncModeUI);
    resetBtn.addEventListener("click", resetTool);

    extractBtn.addEventListener("click", async () => {
        if (!currentDoc || !window.PDFLib) return;
        showError("");
        const originalHtml = extractBtn.innerHTML;
        extractBtn.disabled = true;

        try {
            const pageIndices = parsePageRanges(rangeInput.value, totalPages);
            extractBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Extrayendo...';

            const outDoc = await window.PDFLib.PDFDocument.create();
            const copiedPages = await outDoc.copyPages(currentDoc, pageIndices);
            copiedPages.forEach((p) => outDoc.addPage(p));
            const bytes = await outDoc.save();
            triggerDownload(bytes, `${currentBaseName}-seleccion-amazeme.pdf`);
        } catch (err) {
            showError(err?.message || "No se pudo extraer el rango seleccionado.");
        } finally {
            extractBtn.innerHTML = originalHtml;
            extractBtn.disabled = false;
        }
    });

    downloadAllBtn.addEventListener("click", async () => {
        if (!currentDoc || totalPages === 0) return;
        showError("");
        const originalHtml = downloadAllBtn.innerHTML;
        downloadAllBtn.disabled = true;

        try {
            for (let i = 0; i < totalPages; i++) {
                downloadAllBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Descargando ${i + 1} de ${totalPages}...`;
                await downloadSinglePage(i);
                await new Promise((r) => setTimeout(r, 180));
            }
        } catch {
            showError("Ocurrió un error al descargar las páginas individuales.");
        } finally {
            downloadAllBtn.innerHTML = originalHtml;
            downloadAllBtn.disabled = false;
        }
    });
})();

