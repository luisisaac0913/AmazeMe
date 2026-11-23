(() => {
    "use strict";

    const textarea = document.getElementById("text-input");
    const charsCount = document.getElementById("stat-chars");
    const charsNoSpaceCount = document.getElementById("stat-chars-no-space");
    const wordsCount = document.getElementById("stat-words");
    const linesCount = document.getElementById("stat-lines");
    const copyBtn = document.getElementById("btn-copy-text");
    const clearBtn = document.getElementById("btn-clear-text");
    const actionButtons = document.querySelectorAll("[data-text-action]");

    if (!textarea) return;

    function updateStats() {
        const text = textarea.value;
        const chars = text.length;
        const charsNoSpace = text.replace(/\s/g, "").length;
        const trimmed = text.trim();
        const words = trimmed ? trimmed.split(/\s+/).length : 0;
        const lines = text ? text.split(/\r\n|\r|\n/).length : 0;

        charsCount.textContent = String(chars);
        charsNoSpaceCount.textContent = String(charsNoSpace);
        wordsCount.textContent = String(words);
        linesCount.textContent = String(lines);
    }

    function applyTransform(action) {
        let text = textarea.value;
        switch (action) {
            case "trim-spaces":
                text = text
                    .split(/\r?\n/)
                    .map((line) => line.replace(/[ \t]+/g, " ").trim())
                    .join("\n");
                break;
            case "remove-line-breaks":
                text = text.replace(/\r?\n+/g, " ").replace(/[ \t]+/g, " ").trim();
                break;
            case "remove-empty-lines":
                text = text
                    .split(/\r?\n/)
                    .filter((line) => line.trim().length > 0)
                    .join("\n");
                break;
            case "uppercase":
                text = text.toUpperCase();
                break;
            case "lowercase":
                text = text.toLowerCase();
                break;
            case "titlecase":
                text = text.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());
                break;
            case "sentencecase":
                text = text
                    .toLowerCase()
                    .replace(/(^\s*[a-záéíóúüñ]|[.!?]\s+[a-záéíóúüñ])/g, (match) => match.toUpperCase());
                break;
            case "dedupe-lines": {
                const seen = new Set();
                text = text
                    .split(/\r?\n/)
                    .filter((line) => {
                        if (seen.has(line)) return false;
                        seen.add(line);
                        return true;
                    })
                    .join("\n");
                break;
            }
            default:
                return;
        }
        textarea.value = text;
        updateStats();
    }

    actionButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            applyTransform(btn.getAttribute("data-text-action"));
        });
    });

    textarea.addEventListener("input", updateStats);

    if (copyBtn) {
        const defaultHtml = copyBtn.innerHTML;
        copyBtn.addEventListener("click", () => {
            if (window.AmazeMeUI) {
                window.AmazeMeUI.copyText(textarea.value, copyBtn, defaultHtml);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            textarea.value = "";
            updateStats();
            textarea.focus();
        });
    }

    updateStats();
})();

