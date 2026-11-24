(() => {
    "use strict";

    const dropZone = document.getElementById("img-pdf-drop-zone");
    const fileInput = document.getElementById("img-pdf-file-input");
    const listContainer = document.getElementById("img-pdf-list");
    const actionsWrap = document.getElementById("img-pdf-actions");
    const orientationSelect = document.getElementById("img-pdf-orientation");
    const summaryEl = document.getElementById("img-pdf-summary");
    const createBtn = document.getElementById("img-pdf-create-btn");
    const clearBtn = document.getElementById("img-pdf-clear-btn");
    const errorBox = document.getElementById("img-pdf-error");

    if (!dropZone || !fileInput || !listContainer) return;

    const imageItems = [];

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

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => resolve({ img, url });
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`No se pudo leer la imagen "${file.name}".`));
            };
            img.src = url;
        });
    }

    async function convertToPngBytes(img) {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
        if (!blob) throw new Error("No se pudo convertir la imagen.");
        return new Uint8Array(await blob.arrayBuffer());
    }

    function renderList() {
        listContainer.innerHTML = "";

        if (imageItems.length === 0) {
            actionsWrap.classList.add("d-none");
            createBtn.disabled = true;
            return;
        }

        actionsWrap.classList.remove("d-none");
        createBtn.disabled = false;

        imageItems.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2 py-2";

            const infoDiv = document.createElement("div");
            infoDiv.className = "d-flex align-items-center gap-3";

            const orderBadge = document.createElement("span");
            orderBadge.className = "step-badge";
            orderBadge.textContent = String(index + 1);

            const thumb = document.createElement("img");
            thumb.src = item.url;
            thumb.alt = item.name;
            thumb.width = 44;
            thumb.height = 44;
            thumb.className = "rounded border object-fit-cover flex-shrink-0";

            const textDiv = document.createElement("div");
            const nameEl = document.createElement("div");
            nameEl.className = "fw-semibold text-break small";
            nameEl.textContent = item.name;

            const metaEl = document.createElement("div");
            metaEl.className = "small text-secondary";
            metaEl.textContent = `${item.width} × ${item.height} px · ${formatBytes(item.size)}`;

            textDiv.appendChild(nameEl);
            textDiv.appendChild(metaEl);
            infoDiv.appendChild(orderBadge);
            infoDiv.appendChild(thumb);
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
                [imageItems[index - 1], imageItems[index]] = [imageItems[index], imageItems[index - 1]];
                renderList();
            });

            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "btn btn-outline-secondary";
            downBtn.title = "Bajar";
            downBtn.setAttribute("aria-label", `Bajar ${item.name}`);
            downBtn.disabled = index === imageItems.length - 1;
            downBtn.innerHTML = '<i class="bi bi-arrow-down"></i>';
            downBtn.addEventListener("click", () => {
                if (index === imageItems.length - 1) return;
                [imageItems[index + 1], imageItems[index]] = [imageItems[index], imageItems[index + 1]];
                renderList();
            });

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn btn-outline-danger";
            removeBtn.title = "Quitar";
            removeBtn.setAttribute("aria-label", `Quitar ${item.name}`);
            removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
            removeBtn.addEventListener("click", () => {
                const [removed] = imageItems.splice(index, 1);
                if (removed?.url) URL.revokeObjectURL(removed.url);
                renderList();
            });

            btnGroup.appendChild(upBtn);
            btnGroup.appendChild(downBtn);
            btnGroup.appendChild(removeBtn);

            li.appendChild(infoDiv);
            li.appendChild(btnGroup);
            listContainer.appendChild(li);
        });

        summaryEl.textContent = `${imageItems.length} ${imageItems.length === 1 ? "imagen lista" : "imágenes listas"} para convertir`;
    }

    async function addFiles(fileList) {
        showError("");
        const files = Array.from(fileList || []);
        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                showError(`El archivo "${file.name}" no es una imagen válida.`);
                continue;
            }
            try {
                const { img, url } = await loadImageFromFile(file);
                const mime = file.type.toLowerCase();
                let bytes;
                let format;

                if (mime === "image/jpeg" || mime === "image/jpg") {
                    bytes = new Uint8Array(await file.arrayBuffer());
                    format = "jpg";
                } else if (mime === "image/png") {
                    bytes = new Uint8Array(await file.arrayBuffer());
                    format = "png";
                } else {
                    bytes = await convertToPngBytes(img);
                    format = "png";
                }

                imageItems.push({
                    name: file.name,
                    size: file.size,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    url,
                    bytes,
                    format
                });
            } catch (err) {
                showError(err?.message || `No se pudo leer "${file.name}".`);
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
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        addFiles(e.dataTransfer?.files);
    });
    fileInput.addEventListener("change", () => {
        addFiles(fileInput.files);
        fileInput.value = "";
    });

    createBtn.addEventListener("click", async () => {
        if (imageItems.length === 0) return;
        if (!window.PDFLib) {
            showError("No se pudo cargar la librería pdf-lib. Recarga la página e inténtalo de nuevo.");
            return;
        }

        showError("");
        const originalHtml = createBtn.innerHTML;
        createBtn.disabled = true;
        createBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Creando PDF...';

        try {
            const pdfDoc = await window.PDFLib.PDFDocument.create();
            const orientation = orientationSelect.value;
            const A4_WIDTH = 595.28;
            const A4_HEIGHT = 841.89;
            const MARGIN = 24;

            for (const item of imageItems) {
                const embedded = item.format === "jpg"
                    ? await pdfDoc.embedJpg(item.bytes)
                    : await pdfDoc.embedPng(item.bytes);

                if (orientation === "auto") {
                    const page = pdfDoc.addPage([embedded.width, embedded.height]);
                    page.drawImage(embedded, {
                        x: 0,
                        y: 0,
                        width: embedded.width,
                        height: embedded.height
                    });
                } else {
                    const pageW = orientation === "landscape" ? A4_HEIGHT : A4_WIDTH;
                    const pageH = orientation === "landscape" ? A4_WIDTH : A4_HEIGHT;
                    const page = pdfDoc.addPage([pageW, pageH]);

                    const maxW = pageW - MARGIN * 2;
                    const maxH = pageH - MARGIN * 2;
                    const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
                    const drawW = embedded.width * scale;
                    const drawH = embedded.height * scale;

                    page.drawImage(embedded, {
                        x: (pageW - drawW) / 2,
                        y: (pageH - drawH) / 2,
                        width: drawW,
                        height: drawH
                    });
                }
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "imagenes-amazeme.pdf";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch {
            showError("Ocurrió un error al generar el PDF a partir de las imágenes.");
        } finally {
            createBtn.innerHTML = originalHtml;
            createBtn.disabled = imageItems.length === 0;
        }
    });

    clearBtn.addEventListener("click", () => {
        while (imageItems.length > 0) {
            const removed = imageItems.pop();
            if (removed?.url) URL.revokeObjectURL(removed.url);
        }
        showError("");
        renderList();
    });
})();

