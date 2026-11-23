(() => {
    "use strict";

    const container = document.getElementById("qr-preview");
    const textInput = document.getElementById("qr-text");
    const dotsColorInput = document.getElementById("qr-color");
    const bgColorInput = document.getElementById("qr-bg-color");
    const dotStyleSelect = document.getElementById("qr-dot-style");
    const sizeSelect = document.getElementById("qr-size");
    const eccSelect = document.getElementById("qr-ecc");
    const downloadPngBtn = document.getElementById("qr-download-png");
    const downloadSvgBtn = document.getElementById("qr-download-svg");
    const errorBox = document.getElementById("qr-error");

    if (!container || !textInput) return;

    if (typeof window.QRCodeStyling !== "function") {
        if (errorBox) {
            errorBox.textContent = "No se pudo cargar el motor de códigos QR. Recarga la página e inténtalo de nuevo.";
            errorBox.classList.remove("d-none");
        }
        return;
    }

    function getConfig() {
        const size = parseInt(sizeSelect.value, 10) || 320;
        const data = textInput.value.trim() || "https://amazeme.site";
        return {
            width: size,
            height: size,
            type: "svg",
            data,
            margin: 10,
            qrOptions: {
                errorCorrectionLevel: eccSelect.value || "M"
            },
            dotsOptions: {
                color: dotsColorInput.value || "#111827",
                type: dotStyleSelect.value || "square"
            },
            backgroundOptions: {
                color: bgColorInput.value || "#FFFFFF"
            },
            cornersSquareOptions: {
                color: dotsColorInput.value || "#111827",
                type: dotStyleSelect.value === "dots" ? "dot" : "square"
            },
            cornersDotOptions: {
                color: dotsColorInput.value || "#111827"
            }
        };
    }

    const qrCode = new window.QRCodeStyling(getConfig());
    qrCode.append(container);

    function updateQR() {
        const hasText = textInput.value.trim().length > 0;
        if (errorBox) {
            errorBox.classList.toggle("d-none", hasText);
            if (!hasText) {
                errorBox.textContent = "Escribe un enlace o texto para generar tu código QR personalizado.";
            }
        }
        qrCode.update(getConfig());
    }

    [textInput, dotsColorInput, bgColorInput, dotStyleSelect, sizeSelect, eccSelect].forEach((el) => {
        el.addEventListener("input", updateQR);
        el.addEventListener("change", updateQR);
    });

    downloadPngBtn.addEventListener("click", () => {
        qrCode.download({ name: "codigo-qr-amazeme", extension: "png" });
    });

    downloadSvgBtn.addEventListener("click", () => {
        qrCode.download({ name: "codigo-qr-amazeme", extension: "svg" });
    });
})();

