(() => {
    "use strict";

    const dropZone = document.getElementById("palette-drop-zone");
    const fileInput = document.getElementById("palette-file-input");
    const errorBox = document.getElementById("palette-error");
    const controlsWrap = document.getElementById("palette-controls");
    const canvas = document.getElementById("palette-canvas");
    const resetBtn = document.getElementById("palette-reset-btn");
    const paletteList = document.getElementById("palette-list");
    const eyedropperSwatch = document.getElementById("eyedropper-swatch");
    const eyedropperHex = document.getElementById("eyedropper-hex");
    const eyedropperRgb = document.getElementById("eyedropper-rgb");
    const copyHexBtn = document.getElementById("eyedropper-copy-hex");
    const copyRgbBtn = document.getElementById("eyedropper-copy-rgb");

    if (!dropZone || !fileInput || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let pickedHex = "#000000";
    let pickedRgb = "rgb(0, 0, 0)";

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg || "";
        errorBox.classList.toggle("d-none", !msg);
    }

    function toHex(r, g, b) {
        return (
            "#" +
            [r, g, b]
                .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
                .join("")
                .toUpperCase()
        );
    }

    function colorDistanceSq(a, b) {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return dr * dr + dg * dg + db * db;
    }

    function setEyedropperColor(r, g, b) {
        pickedHex = toHex(r, g, b);
        pickedRgb = `rgb(${r}, ${g}, ${b})`;
        eyedropperSwatch.style.backgroundColor = pickedHex;
        eyedropperHex.textContent = pickedHex;
        eyedropperRgb.textContent = pickedRgb;
    }

    function extractDominantColors(img, maxColors = 6) {
        const sampleMax = 140;
        const scale = Math.min(1, sampleMax / Math.max(img.naturalWidth, img.naturalHeight));
        const sw = Math.max(1, Math.round(img.naturalWidth * scale));
        const sh = Math.max(1, Math.round(img.naturalHeight * scale));

        const offscreen = document.createElement("canvas");
        offscreen.width = sw;
        offscreen.height = sh;
        const octx = offscreen.getContext("2d", { willReadFrequently: true });
        octx.drawImage(img, 0, 0, sw, sh);

        const data = octx.getImageData(0, 0, sw, sh).data;
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 128) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Cuantización en cubos de 24 niveles por canal para agrupar tonos cercanos
            const qr = Math.round(r / 24) * 24;
            const qg = Math.round(g / 24) * 24;
            const qb = Math.round(b / 24) * 24;
            const key = `${qr},${qg},${qb}`;

            let entry = buckets.get(key);
            if (!entry) {
                entry = { sumR: 0, sumG: 0, sumB: 0, count: 0 };
                buckets.set(key, entry);
            }
            entry.sumR += r;
            entry.sumG += g;
            entry.sumB += b;
            entry.count += 1;
        }

        const sorted = Array.from(buckets.values())
            .sort((a, b) => b.count - a.count)
            .map((b) => [
                Math.round(b.sumR / b.count),
                Math.round(b.sumG / b.count),
                Math.round(b.sumB / b.count)
            ]);

        const selected = [];
        const minDistSq = 48 * 48;

        for (const rgb of sorted) {
            if (selected.every((existing) => colorDistanceSq(existing, rgb) >= minDistSq)) {
                selected.push(rgb);
                if (selected.length >= maxColors) break;
            }
        }

        // Si la imagen es casi monocromática, rellena con los siguientes más frecuentes
        if (selected.length < maxColors) {
            for (const rgb of sorted) {
                if (!selected.some((existing) => colorDistanceSq(existing, rgb) < 12 * 12)) {
                    selected.push(rgb);
                    if (selected.length >= maxColors) break;
                }
            }
        }

        return selected;
    }

    function renderPalette(colors) {
        paletteList.innerHTML = "";
        if (colors.length === 0) return;

        setEyedropperColor(colors[0][0], colors[0][1], colors[0][2]);

        colors.forEach(([r, g, b]) => {
            const hex = toHex(r, g, b);
            const rgbStr = `rgb(${r}, ${g}, ${b})`;

            const row = document.createElement("div");
            row.className = "border rounded p-2 px-3 bg-body-tertiary d-flex align-items-center gap-3 flex-wrap";

            const swatch = document.createElement("div");
            swatch.className = "color-swatch-box";
            swatch.style.backgroundColor = hex;

            const info = document.createElement("div");
            info.className = "flex-grow-1";
            const hexEl = document.createElement("div");
            hexEl.className = "fw-semibold font-monospace small";
            hexEl.textContent = hex;
            const rgbEl = document.createElement("div");
            rgbEl.className = "small text-secondary font-monospace";
            rgbEl.textContent = rgbStr;
            info.appendChild(hexEl);
            info.appendChild(rgbEl);

            const btnWrap = document.createElement("div");
            btnWrap.className = "d-flex gap-2";

            const btnHex = document.createElement("button");
            btnHex.type = "button";
            btnHex.className = "btn btn-outline-primary btn-sm";
            btnHex.textContent = "HEX";
            const hexDefault = btnHex.innerHTML;
            btnHex.addEventListener("click", () => {
                if (window.AmazeMeUI) window.AmazeMeUI.copyText(hex, btnHex, hexDefault);
            });

            const btnRgb = document.createElement("button");
            btnRgb.type = "button";
            btnRgb.className = "btn btn-outline-secondary btn-sm";
            btnRgb.textContent = "RGB";
            const rgbDefault = btnRgb.innerHTML;
            btnRgb.addEventListener("click", () => {
                if (window.AmazeMeUI) window.AmazeMeUI.copyText(rgbStr, btnRgb, rgbDefault);
            });

            btnWrap.appendChild(btnHex);
            btnWrap.appendChild(btnRgb);
            row.appendChild(swatch);
            row.appendChild(info);
            row.appendChild(btnWrap);
            paletteList.appendChild(row);
        });
    }

    function loadFile(file) {
        showError("");
        if (!file || !file.type.startsWith("image/")) {
            showError("Selecciona una imagen válida (JPG, PNG o WebP).");
            return;
        }

        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(tempUrl);

            const maxCanvasSide = 900;
            const scale = Math.min(1, maxCanvasSide / Math.max(img.naturalWidth, img.naturalHeight));
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const colors = extractDominantColors(img, 6);
            renderPalette(colors);

            dropZone.classList.add("d-none");
            controlsWrap.classList.remove("d-none");
        };
        img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            showError("No se pudo leer la imagen seleccionada.");
        };
        img.src = tempUrl;
    }

    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))));
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        setEyedropperColor(pixel[0], pixel[1], pixel[2]);
    });

    if (copyHexBtn) {
        const hexDefault = copyHexBtn.innerHTML;
        copyHexBtn.addEventListener("click", () => {
            if (window.AmazeMeUI) window.AmazeMeUI.copyText(pickedHex, copyHexBtn, hexDefault);
        });
    }

    if (copyRgbBtn) {
        const rgbDefault = copyRgbBtn.innerHTML;
        copyRgbBtn.addEventListener("click", () => {
            if (window.AmazeMeUI) window.AmazeMeUI.copyText(pickedRgb, copyRgbBtn, rgbDefault);
        });
    }

    resetBtn.addEventListener("click", () => {
        fileInput.value = "";
        paletteList.innerHTML = "";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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

