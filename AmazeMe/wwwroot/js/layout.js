(() => {
    "use strict";

    /**
     * Marca el enlace activo en la barra de navegación comparando rutas limpias.
     */
    function highlightActiveNavLink() {
        const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
        const navLinks = document.querySelectorAll("header .nav-link[href]");

        navLinks.forEach((link) => {
            const href = link.getAttribute("href");
            if (!href) return;
            const normalizedHref = href.replace(/\/+$/, "") || "/";
            if (currentPath === normalizedHref) {
                link.classList.add("active", "fw-semibold", "text-primary");
                link.setAttribute("aria-current", "page");
            }
        });
    }

    /**
     * Actualiza el año del copyright en el footer.
     */
    function updateFooterYear() {
        const yearEl = document.getElementById("current-year");
        if (yearEl) {
            yearEl.textContent = String(new Date().getFullYear());
        }
    }

    /**
     * Normaliza texto eliminando tildes/diacríticos para búsquedas tolerantes.
     */
    function normalizeText(value) {
        return (value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    /**
     * Inicializa el filtro rápido del catálogo en la página principal.
     */
    function initCatalogFilter() {
        const searchInput = document.getElementById("tool-search");
        const cards = document.querySelectorAll("[data-tool-item]");
        const emptyState = document.getElementById("no-tools-found");

        if (!searchInput || cards.length === 0) return;

        searchInput.addEventListener("input", () => {
            const query = normalizeText(searchInput.value.trim());
            let visibleCount = 0;

            cards.forEach((card) => {
                const keywords = normalizeText(card.getAttribute("data-keywords"));
                const text = normalizeText(card.textContent);
                const matches = !query || keywords.includes(query) || text.includes(query);
                card.classList.toggle("d-none", !matches);
                if (matches) visibleCount++;
            });

            if (emptyState) {
                emptyState.classList.toggle("d-none", visibleCount > 0);
            }
        });
    }

    /**
     * Helper reutilizable para copiar texto al portapapeles con feedback visual en botón.
     */
    window.AmazeMeUI = {
        async copyText(text, buttonEl, defaultHtml) {
            if (!text) return false;
            try {
                await navigator.clipboard.writeText(text);
                if (buttonEl) {
                    const original = defaultHtml || buttonEl.innerHTML;
                    buttonEl.innerHTML = '<i class="bi bi-check2 me-1"></i>¡Copiado!';
                    buttonEl.classList.add("btn-success");
                    buttonEl.classList.remove("btn-outline-primary", "btn-primary");
                    setTimeout(() => {
                        buttonEl.innerHTML = original;
                        buttonEl.classList.remove("btn-success");
                        buttonEl.classList.add("btn-outline-primary");
                    }, 1800);
                }
                return true;
            } catch {
                return false;
            }
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        highlightActiveNavLink();
        updateFooterYear();
        initCatalogFilter();
    });
})();

