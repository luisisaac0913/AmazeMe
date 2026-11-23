(() => {
    "use strict";

    const dropZone = document.getElementById("pdf-drop-zone");
    const fileInput = document.getElementById("pdf-file-input");
    const listContainer = document.getElementById("pdf-file-list");
    const actionsBar = document.getElementById("pdf-actions");
    const summaryEl = document.getElementById("pdf-summary");
    const mergeBtn = document.getElementById("pdf-merge-btn");
    const clearBtn = document.getElementById("pdf-clear-btn");
    const errorBox = document.getElementById("pdf-error");

    if (!dropZone || !fileInput || !listContainer) return;

    const pdfItems = [];

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

    function renderList() {
        listContainer.innerHTML = "";

        if (pdfItems.length === 0) {
            actionsBar.classList.add("d-none");
            return;
        }

        actionsBar.classList.remove("d-none");

        let totalPages = 0;
        pdfItems.forEach((item, index) => {
            totalPages += item.pageCount;

            const li = document.createElement("li");
            li.className = "list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2 py-3";

            const infoDiv = document.createElement("div");
            infoDiv.className = "d-flex align-items-center gap-3";

            const orderBadge = document.createElement("span");
            orderBadge.className = "step-badge";
            orderBadge.textContent = String(index + 1);

            const textDiv = document.createElement("div");
            const nameEl = document.createElement("div");
            nameEl.className = "fw-semibold text-break";
            nameEl.textContent = item.name;

            const metaEl = document.createElement("div");
            metaEl.className = "small text-secondary";
            metaEl.textContent = `${item.pageCount} ${item.pageCount === 1 ? "página" : "páginas"} · ${formatBytes(item.size)}`;

            textDiv.appendChild(nameEl);
            textDiv.appendChild(metaEl);
            infoDiv.appendChild(orderBadge);
            infoDiv.appendChild(textDiv);

            const btnGroup = document.createElement("div");
            btnGroup.className = "btn-group btn-group-sm";

            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "btn btn-outline-secondary";
            upBtn.title = "Subir";
            upBtn.setAttribute("aria-label", `Subir ${item.name}`);
            upBtn.disabled = index === 0;
            upBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
            upBtn.addEventListener("click", () => {
                if (index === 0) return;
                [pdfItems[index - 1], pdfItems[index]] = [pdfItems[index], pdfItems[index - 1]];
                renderList();
            });

            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "btn btn-outline-secondary";
            downBtn.title = "Bajar";
            downBtn.setAttribute("aria-label", `Bajar ${item.name}`);
            downBtn.disabled = index === pdfItems.length - 1;
            downBtn.innerHTML = '<i class="bi bi-arrow-down"></i>';
            downBtn.addEventListener("click", () => {
                if (index === pdfItems.length - 1) return;
                [pdfItems[index + 1], pdfItems[index]] = [pdfItems[index], pdfItems[index + 1]];
                renderList();
            });

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn btn-outline-danger";
            removeBtn.title = "Quitar";
            removeBtn.setAttribute("aria-label", `Quitar ${item.name}`);
            removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
            removeBtn.addEventListener("click", () => {
                pdfItems.splice(index, 1);
                renderList();
            });

            btnGroup.appendChild(upBtn);
            btnGroup.appendChild(downBtn);
            btnGroup.appendChild(removeBtn);

            li.appendChild(infoDiv);
            li.appendChild(btnGroup);
            listContainer.appendChild(li);
        });

        summaryEl.textContent = `${pdfItems.length} ${pdfItems.length === 1 ? "archivo" : "archivos"} · ${totalPages} ${totalPages === 1 ? "página" : "páginas"} en total`;
        mergeBtn.disabled = pdfItems.length < 2;
    }

    async function addFiles(fileList) {
        showError("");
        if (!window.PDFLib) {
            showError("No se pudo cargar la librería pdf-lib. Recarga la página e inténtalo de nuevo.");
            return;
        }

        const files = Array.from(fileList || []);
        for (const file of files) {
            if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                showError(`El archivo "${file.name}" no es un PDF válido.`);
                continue;
            }
            try {
                const buffer = await file.arrayBuffer();
                const doc = await window.PDFLib.PDFDocument.load(buffer);
                pdfItems.push({
                    name: file.name,
                    size: file.size,
                    buffer,
                    pageCount: doc.getPageCount()
                });
            } catch {
                showError(`No se pudo leer "${file.name}". Verifica que no esté dañado ni protegido con contraseña.`);
            }
        }
        renderList();
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
        addFiles(e.dataTransfer?.files);
    });

    fileInput.addEventListener("change", () => {
        addFiles(fileInput.files);
        fileInput.value = "";
    });

    mergeBtn.addEventListener("click", async () => {
        if (pdfItems.length < 2 || !window.PDFLib) return;

        showError("");
        const originalHtml = mergeBtn.innerHTML;
        mergeBtn.disabled = true;
        mergeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Uniendo PDFs...';

        try {
            const mergedPdf = await window.PDFLib.PDFDocument.create();
            for (const item of pdfItems) {
                const srcDoc = await window.PDFLib.PDFDocument.load(item.buffer);
                const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "documento-unido-amazeme.pdf";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch {
            showError("Ocurrió un error al combinar los archivos PDF.");
        } finally {
            mergeBtn.innerHTML = originalHtml;
            mergeBtn.disabled = pdfItems.length < 2;
        }
    });

    clearBtn.addEventListener("click", () => {
        pdfItems.length = 0;
        showError("");
        renderList();
    });
})();

