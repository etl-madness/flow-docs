function initHandbookNav() {
  const primaryNav = document.querySelector(".md-sidebar--primary .md-nav--primary");
  if (!primaryNav || primaryNav.dataset.hbInitialized === "true") return;
  primaryNav.dataset.hbInitialized = "true";

  const sections = Array.from(
    primaryNav.querySelectorAll(":scope > .md-nav__list > .md-nav__item--section")
  );
  if (sections.length === 0) return;

  const STORAGE_KEY_COLLAPSED = "hb_collapsed_categories";
  const STORAGE_KEY_HIDE_SUB = "hb_hide_subheadings";
  const STORAGE_KEY_FILTER = "hb_filter_query";
  const STORAGE_KEY_EXPAND_ACTIVE = "hb_expand_active_on_load";

  let collapsedSet = new Set();
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (saved) {
      JSON.parse(saved).forEach((k) => collapsedSet.add(k));
    }
  } catch (_) {}

  let hideSubheadings = sessionStorage.getItem(STORAGE_KEY_HIDE_SUB) === "true";
  let savedQuery = sessionStorage.getItem(STORAGE_KEY_FILTER) || "";
  const expandActiveOnLoad = sessionStorage.getItem(STORAGE_KEY_EXPAND_ACTIVE) === "true";
  if (expandActiveOnLoad) {
    sessionStorage.removeItem(STORAGE_KEY_EXPAND_ACTIVE);
  }

  const saveCollapsedState = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(Array.from(collapsedSet)));
    } catch (_) {}
  };

  let totalItems = 0;
  let collapseBtn = null;

  const updateCollapseButtonLabel = () => {
    if (!collapseBtn) return;
    const isCollapsedMode = collapsedSet.size > 0;
    collapseBtn.textContent = isCollapsedMode ? "Expand" : "Collapse";
    collapseBtn.classList.toggle("hb-btn-active", isCollapsedMode);
  };

  const setSectionCollapsed = (section, isCollapsed) => {
    section.classList.toggle("hb-collapsed", isCollapsed);
    const childNav = section.querySelector(":scope > .md-nav");
    if (childNav) {
      childNav.style.display = isCollapsed ? "none" : "block";
      childNav.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }
  };

  // First pass: assign category keys and remove Material's hidden toggle inputs
  sections.forEach((section, idx) => {
    const header = section.querySelector(":scope > .md-nav__link, :scope > label.md-nav__link");
    const toggleInput = section.querySelector(":scope > input.md-nav__toggle");
    if (toggleInput) {
      toggleInput.remove();
    }
    const rawTitle = header ? header.textContent.trim() : `section-${idx}`;
    const categoryKey = rawTitle.toLowerCase();
    section.dataset.hbCategoryKey = categoryKey;
    section.dataset.hbRawTitle = rawTitle;
  });

  // Remove mobile TOC duplicate label/input inside primary nav so it never blocks the active <a> link
  primaryNav.querySelectorAll('label.md-nav__link[for="__toc"], input#__toc').forEach((el) => {
    el.remove();
  });

  // When navigating to a page while in collapsed mode, keep only the active section expanded
  if (expandActiveOnLoad && collapsedSet.size > 0) {
    const activeSection = sections.find(
      (s) =>
        s.classList.contains("md-nav__item--active") ||
        Boolean(s.querySelector(".md-nav__link--active"))
    );
    if (activeSection) {
      const activeKey = activeSection.dataset.hbCategoryKey;
      collapsedSet.clear();
      sections.forEach((s) => {
        const k = s.dataset.hbCategoryKey;
        if (k && k !== activeKey) {
          collapsedSet.add(k);
        }
      });
      saveCollapsedState();
    }
  }

  sections.forEach((section) => {
    const oldHeader = section.querySelector(":scope > .md-nav__link, :scope > label.md-nav__link");
    const childList = section.querySelector(":scope > .md-nav > .md-nav__list");
    const items = childList ? Array.from(childList.querySelectorAll(":scope > .md-nav__item")) : [];
    totalItems += items.length;

    const categoryKey = section.dataset.hbCategoryKey;
    const rawTitle = section.dataset.hbRawTitle;

    setSectionCollapsed(section, collapsedSet.has(categoryKey));

    if (oldHeader && !oldHeader.dataset.hbEnhanced) {
      // Replace Material's <label> with a fresh <div> and include md-nav__container so Material CSS does not set pointer-events: none
      const header = document.createElement("div");
      header.className = "md-nav__link md-nav__container hb-category-header";
      header.style.pointerEvents = "auto";
      header.style.cursor = "pointer";
      header.dataset.hbEnhanced = "true";

      const leftSpan = document.createElement("span");
      const caret = document.createElement("span");
      caret.className = "hb-caret";
      caret.textContent = "▾";
      leftSpan.appendChild(caret);
      leftSpan.appendChild(document.createTextNode(rawTitle));

      const badge = document.createElement("span");
      badge.className = "hb-section-badge";
      badge.textContent = String(items.length);

      header.appendChild(leftSpan);
      header.appendChild(badge);
      oldHeader.replaceWith(header);

      header.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const wasCollapsed = section.classList.contains("hb-collapsed");

        if (collapsedSet.size > 0) {
          // Single-expand accordion behavior when Collapse is active:
          // Close all other sections and expand ONLY the clicked section (if it was collapsed)
          collapsedSet.clear();
          sections.forEach((s) => {
            const k = s.dataset.hbCategoryKey;
            if (wasCollapsed && s === section) {
              setSectionCollapsed(s, false);
            } else {
              setSectionCollapsed(s, true);
              if (k) collapsedSet.add(k);
            }
          });
          saveCollapsedState();
          updateCollapseButtonLabel();
          if (wasCollapsed) {
            requestAnimationFrame(() => {
              section.scrollIntoView({ block: "nearest" });
            });
          }
        } else {
          // All sections were expanded; collapse just this section
          setSectionCollapsed(section, true);
          collapsedSet.add(categoryKey);
          saveCollapsedState();
          updateCollapseButtonLabel();
        }
      });
    }

    items.forEach((item) => {
      const link = item.querySelector(":scope > a.md-nav__link");
      if (!link || link.dataset.hbEnhanced) return;
      link.dataset.hbEnhanced = "true";

      const fullText = link.textContent.trim();
      link.setAttribute("title", fullText);
      item.dataset.hbSearchText = fullText.toLowerCase();

      const sepIndex = fullText.indexOf(" — ");
      if (sepIndex !== -1) {
        const tagText = fullText.slice(0, sepIndex).trim();
        const titleText = fullText.slice(sepIndex + 3).trim();
        link.innerHTML = "";

        const tagSpan = document.createElement("span");
        tagSpan.className = "hb-item-tag";
        tagSpan.textContent = tagText;

        const titleSpan = document.createElement("span");
        titleSpan.className = "hb-item-title";
        titleSpan.textContent = titleText;

        link.appendChild(tagSpan);
        link.appendChild(titleSpan);
      }

      link.addEventListener("click", () => {
        if (collapsedSet.size > 0) {
          collapsedSet.clear();
          sections.forEach((s) => {
            const k = s.dataset.hbCategoryKey;
            if (k && k !== categoryKey) {
              collapsedSet.add(k);
            }
          });
          saveCollapsedState();
        }
        sessionStorage.setItem(STORAGE_KEY_EXPAND_ACTIVE, "true");
      });
    });
  });

  // Ensure any in-page content links that navigate to another handbook page expand the target's category on load
  document.querySelectorAll(".md-content a[href]").forEach((a) => {
    a.addEventListener("click", () => {
      sessionStorage.setItem(STORAGE_KEY_EXPAND_ACTIVE, "true");
    });
  });

  // Insert top filter + toolbar matching http://localhost:5185/handbook
  if (!primaryNav.querySelector(".hb-sidebar-controls")) {
    const controls = document.createElement("div");
    controls.className = "hb-sidebar-controls";
    controls.innerHTML = `
      <div class="hb-search-wrapper">
        <span class="hb-search-icon">🔍</span>
        <input type="text" class="hb-search-input" placeholder="Filter tree & guides..." aria-label="Filter tree and guides" />
        <button type="button" class="hb-search-clear" title="Clear filter">✕</button>
      </div>
      <div class="hb-tree-toolbar">
        <span class="hb-toolbar-count">${sections.length} Categories · ${totalItems} Items</span>
        <div class="hb-toolbar-actions">
          <button type="button" class="hb-toolbar-btn hb-btn-subheadings" title="Toggle section subheadings in tree">Hide §</button>
          <button type="button" class="hb-toolbar-btn hb-btn-collapse" title="Collapse all categories (single-section accordion mode) or Expand all">Collapse</button>
        </div>
      </div>
    `;

    primaryNav.insertBefore(controls, primaryNav.firstChild);

    const searchInput = controls.querySelector(".hb-search-input");
    const clearBtn = controls.querySelector(".hb-search-clear");
    const countLabel = controls.querySelector(".hb-toolbar-count");
    const subBtn = controls.querySelector(".hb-btn-subheadings");
    collapseBtn = controls.querySelector(".hb-btn-collapse");

    primaryNav.classList.toggle("hb-hide-subheadings", hideSubheadings);
    subBtn.classList.toggle("hb-btn-active", hideSubheadings);
    subBtn.textContent = hideSubheadings ? "Show §" : "Hide §";
    updateCollapseButtonLabel();

    const applyFilter = () => {
      const q = searchInput.value.trim().toLowerCase();
      sessionStorage.setItem(STORAGE_KEY_FILTER, searchInput.value);
      clearBtn.style.display = q ? "block" : "none";
      let visibleCategories = 0;
      let visibleItems = 0;

      sections.forEach((section) => {
        const categoryKey = section.dataset.hbCategoryKey || "";
        const items = Array.from(
          section.querySelectorAll(":scope > .md-nav > .md-nav__list > .md-nav__item")
        );
        let sectionMatches = 0;

        items.forEach((item) => {
          const text = item.dataset.hbSearchText || item.textContent.toLowerCase();
          const match = !q || text.includes(q) || categoryKey.includes(q);
          item.style.display = match ? "" : "none";
          if (match) {
            sectionMatches++;
            visibleItems++;
          }
        });

        const badge = section.querySelector(".hb-section-badge");
        if (badge) badge.textContent = String(sectionMatches);

        if (sectionMatches > 0) {
          section.style.display = "";
          if (q) {
            setSectionCollapsed(section, false);
          } else {
            setSectionCollapsed(section, collapsedSet.has(categoryKey));
          }
          visibleCategories++;
        } else {
          section.style.display = "none";
        }
      });

      countLabel.textContent = `${visibleCategories} Categories · ${visibleItems} Items`;
    };

    if (savedQuery) {
      searchInput.value = savedQuery;
      applyFilter();
    }

    searchInput.addEventListener("input", applyFilter);
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      applyFilter();
      searchInput.focus();
    });

    subBtn.addEventListener("click", () => {
      hideSubheadings = !hideSubheadings;
      sessionStorage.setItem(STORAGE_KEY_HIDE_SUB, String(hideSubheadings));
      primaryNav.classList.toggle("hb-hide-subheadings", hideSubheadings);
      subBtn.classList.toggle("hb-btn-active", hideSubheadings);
      subBtn.textContent = hideSubheadings ? "Show §" : "Hide §";
    });

    collapseBtn.addEventListener("click", () => {
      if (collapsedSet.size === 0) {
        // Collapse all categories and enter single-expand accordion mode
        collapsedSet.clear();
        sections.forEach((s) => {
          const key = s.dataset.hbCategoryKey;
          setSectionCollapsed(s, true);
          if (key) collapsedSet.add(key);
        });
      } else {
        // Expand all categories
        collapsedSet.clear();
        sections.forEach((s) => {
          setSectionCollapsed(s, false);
        });
      }
      saveCollapsedState();
      updateCollapseButtonLabel();
    });
  }

  // Draggable resize handle for the left sidebar
  const primarySidebar = document.querySelector(".md-sidebar--primary");
  if (primarySidebar && !primarySidebar.querySelector(".hb-sidebar-resizer")) {
    const STORAGE_KEY_WIDTH = "hb_sidebar_width";
    const DEFAULT_WIDTH = 340;
    const MIN_WIDTH = 220;
    const MAX_WIDTH = 680;

    const applySidebarWidth = (px) => {
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(px)));
      document.documentElement.style.setProperty("--hb-sidebar-width", `${clamped}px`);
      return clamped;
    };

    const savedWidth = parseInt(localStorage.getItem(STORAGE_KEY_WIDTH) || "", 10);
    if (!Number.isNaN(savedWidth)) {
      applySidebarWidth(savedWidth);
    }

    const resizer = document.createElement("div");
    resizer.className = "hb-sidebar-resizer";
    resizer.title = "Drag to resize sidebar (double-click to reset)";
    primarySidebar.appendChild(resizer);

    let startX = 0;
    let startWidth = DEFAULT_WIDTH;

    const onMouseMove = (e) => {
      const delta = e.clientX - startX;
      const newWidth = applySidebarWidth(startWidth + delta);
      try {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(newWidth));
      } catch (_) {}
    };

    const onMouseUp = () => {
      resizer.classList.remove("hb-resizing");
      document.body.classList.remove("hb-is-resizing");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    resizer.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startWidth = primarySidebar.getBoundingClientRect().width || DEFAULT_WIDTH;
      resizer.classList.add("hb-resizing");
      document.body.classList.add("hb-is-resizing");
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    resizer.addEventListener("dblclick", () => {
      applySidebarWidth(DEFAULT_WIDTH);
      try {
        localStorage.removeItem(STORAGE_KEY_WIDTH);
      } catch (_) {}
    });
  }

  // Ensure the active link in the left sidebar is scrolled into view
  const activeLink = primaryNav.querySelector("a.md-nav__link--active");
  if (activeLink) {
    requestAnimationFrame(() => {
      activeLink.scrollIntoView({ block: "nearest" });
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHandbookNav);
} else {
  initHandbookNav();
}
