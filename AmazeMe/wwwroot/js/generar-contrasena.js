(() => {
    "use strict";

    const outputInput = document.getElementById("pw-output");
    const lengthRange = document.getElementById("pw-length");
    const lengthValue = document.getElementById("pw-length-value");
    const optUpper = document.getElementById("pw-upper");
    const optLower = document.getElementById("pw-lower");
    const optNumbers = document.getElementById("pw-numbers");
    const optSymbols = document.getElementById("pw-symbols");
    const optNoAmbiguous = document.getElementById("pw-no-ambiguous");
    const generateBtn = document.getElementById("pw-generate-btn");
    const copyBtn = document.getElementById("pw-copy-btn");
    const strengthBar = document.getElementById("pw-strength-bar");
    const strengthLabel = document.getElementById("pw-strength-label");
    const errorBox = document.getElementById("pw-error");

    if (!outputInput || !lengthRange) return;

    const SETS = {
        upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        lower: "abcdefghijklmnopqrstuvwxyz",
        numbers: "0123456789",
        symbols: "!@#$%^&*()-_=+[]{};:,.<>?"
    };

    const AMBIGUOUS = /[0O1lI]/g;

    function secureRandomIndex(max) {
        const array = new Uint32Array(1);
        const limit = Math.floor(0xffffffff / max) * max;
        let rand;
        do {
            window.crypto.getRandomValues(array);
            rand = array[0];
        } while (rand >= limit);
        return rand % max;
    }

    function updateStrength(length, poolSize) {
        const entropy = length * Math.log2(Math.max(poolSize, 1));
        let pct = Math.min(100, Math.round((entropy / 128) * 100));
        let label = "Débil";
        let barClass = "bg-danger";

        if (entropy >= 90) {
            label = "Muy fuerte";
            barClass = "bg-success";
        } else if (entropy >= 65) {
            label = "Fuerte";
            barClass = "bg-primary";
        } else if (entropy >= 45) {
            label = "Media";
            barClass = "bg-warning";
        }

        strengthBar.style.width = `${pct}%`;
        strengthBar.className = `progress-bar ${barClass}`;
        strengthBar.setAttribute("aria-valuenow", String(pct));
        strengthLabel.textContent = `${label} (${Math.round(entropy)} bits de entropía)`;
    }

    function generatePassword() {
        const length = parseInt(lengthRange.value, 10) || 16;
        const activeSets = [];

        if (optUpper.checked) activeSets.push(SETS.upper);
        if (optLower.checked) activeSets.push(SETS.lower);
        if (optNumbers.checked) activeSets.push(SETS.numbers);
        if (optSymbols.checked) activeSets.push(SETS.symbols);

        const cleanedSets = activeSets
            .map((set) => (optNoAmbiguous.checked ? set.replace(AMBIGUOUS, "") : set))
            .filter((set) => set.length > 0);

        if (cleanedSets.length === 0) {
            if (errorBox) {
                errorBox.textContent = "Activa al menos un tipo de carácter para generar la contraseña.";
                errorBox.classList.remove("d-none");
            }
            outputInput.value = "";
            return;
        }

        if (errorBox) errorBox.classList.add("d-none");

        const fullPool = cleanedSets.join("");
        const chars = [];

        // Garantiza al menos un carácter de cada conjunto seleccionado
        cleanedSets.forEach((set) => {
            if (chars.length < length) {
                chars.push(set[secureRandomIndex(set.length)]);
            }
        });

        while (chars.length < length) {
            chars.push(fullPool[secureRandomIndex(fullPool.length)]);
        }

        // Mezcla Fisher-Yates con entropía criptográfica
        for (let i = chars.length - 1; i > 0; i--) {
            const j = secureRandomIndex(i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        outputInput.value = chars.join("");
        updateStrength(length, fullPool.length);
    }

    lengthRange.addEventListener("input", () => {
        lengthValue.textContent = lengthRange.value;
        generatePassword();
    });

    [optUpper, optLower, optNumbers, optSymbols, optNoAmbiguous].forEach((el) => {
        el.addEventListener("change", generatePassword);
    });

    generateBtn.addEventListener("click", generatePassword);

    if (copyBtn) {
        const defaultHtml = copyBtn.innerHTML;
        copyBtn.addEventListener("click", () => {
            if (window.AmazeMeUI) {
                window.AmazeMeUI.copyText(outputInput.value, copyBtn, defaultHtml);
            }
        });
    }

    generatePassword();
})();

