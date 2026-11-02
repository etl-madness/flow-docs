(function () {
  const EXTRA_THEME_CSS = `
    :host, svg {
      font-size: 15px !important;
      line-height: 1.35 !important;
    }
    .label foreignObject {
      overflow: visible !important;
      line-height: 1.35 !important;
    }
    .label foreignObject > div {
      line-height: 1.35 !important;
    }
    .nodeLabel, .edgeLabel, .cluster-label, .label {
      font-size: 15px !important;
      line-height: 1.35 !important;
    }
    .nodeLabel p, .edgeLabel p, .cluster-label p {
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1.35 !important;
    }
    .nodeLabel b, .nodeLabel strong, .cluster-label b, .cluster-label strong {
      font-weight: 700;
    }
  `;

  function patchMermaid(m) {
    if (!m || m.__flowPatched) return;
    m.__flowPatched = true;

    const origInit = m.initialize.bind(m);
    m.initialize = function (config = {}) {
      return origInit({
        ...config,
        themeCSS: (config.themeCSS || "") + "\n" + EXTRA_THEME_CSS,
        flowchart: {
          htmlLabels: true,
          wrappingWidth: 320,
          padding: 16,
          nodeSpacing: 45,
          rankSpacing: 50,
          subGraphTitleMargin: { top: 10, bottom: 10 },
          ...(config.flowchart || {}),
        },
      });
    };

    const origRender = m.render.bind(m);
    m.render = async function (id, text, svgContainingElement) {
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (_) {}
      }

      if (svgContainingElement) {
        return origRender(id, text, svgContainingElement);
      }

      const measureHost = document.createElement("div");
      measureHost.className = "md-typeset mermaid";
      measureHost.style.cssText =
        "position:fixed;left:-10000px;top:0;width:1200px;visibility:hidden;pointer-events:none;z-index:-1;";
      document.body.appendChild(measureHost);

      try {
        return await origRender(id, text, measureHost);
      } finally {
        measureHost.remove();
      }
    };
  }

  let _mermaid = window.mermaid;
  if (_mermaid && !(_mermaid instanceof Element)) {
    patchMermaid(_mermaid);
  } else {
    Object.defineProperty(window, "mermaid", {
      configurable: true,
      enumerable: true,
      get() {
        return _mermaid;
      },
      set(val) {
        _mermaid = val;
        if (val && !(val instanceof Element)) {
          patchMermaid(val);
        }
      },
    });
  }
})();
