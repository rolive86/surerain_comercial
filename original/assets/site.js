/* Sure Rain Web v1 — JavaScript compartido */

document.addEventListener('DOMContentLoaded', function () {

  // Scroll to top button
  const scrollBtn = document.querySelector('.scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', function () {
      scrollBtn.classList.toggle('visible', window.scrollY > 300);
    
  // Theme toggle (default dark, user puede pasar a light)
  function injectThemeToggle() {
    var nav = document.querySelector('header nav');
    if (!nav) return;
    if (nav.querySelector('#theme-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Cambiar entre modo claro y oscuro');
    btn.innerHTML =
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.addEventListener('click', function () {
      var html = document.documentElement;
      var nowDark = !html.classList.contains('dark');
      html.classList.toggle('dark', nowDark);
      try { localStorage.setItem('sr-theme', nowDark ? 'dark' : 'light'); } catch (e) {}
    });
    nav.appendChild(btn);
  }
  injectThemeToggle();

});
    scrollBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Fade-in on scroll
  const fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length) {
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    fadeEls.forEach(function (el) { obs.observe(el); });
  }

  // Mobile menu toggle
  const menuBtn = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Catalog filters — soporta múltiples ejes con AND. Usa dropdown <select> compactos + búsqueda de texto.
  const productCards = document.querySelectorAll('.product-card');
  const filterSelects = document.querySelectorAll('[data-filter-select]');
  const activeFilters = {};
  let searchQuery = '';

  function tokensOf(value) {
    if (!value) return [];
    return String(value).split(/\s+/).filter(Boolean);
  }

  function normalizeText(s) {
    return String(s || '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  // Precalcular el texto buscable de cada card (lazy: en idle time, no bloquea el load)
  let searchTextReady = false;
  function buildSearchTextForCard(card) {
    if (card._searchText !== undefined) return;
    const h4 = card.querySelector('h4');
    const name = h4 ? h4.textContent : '';
    const marca = card.dataset.marca || '';
    const cat = card.dataset.category || '';
    const onclick = card.getAttribute('onclick') || '';
    const descMatch = onclick.match(/openProductModal\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
    const desc = descMatch ? descMatch[2] : '';
    card._searchText = normalizeText([name, marca, cat, desc].join(' '));
  }
  function buildAllSearchTextInBackground() {
    if (searchTextReady) return;
    const chunkSize = 50;
    let idx = 0;
    function processChunk(deadline) {
      while (idx < productCards.length && (!deadline || deadline.timeRemaining() > 1)) {
        buildSearchTextForCard(productCards[idx]);
        idx++;
      }
      if (idx < productCards.length) {
        if ('requestIdleCallback' in window) requestIdleCallback(processChunk);
        else setTimeout(function () { processChunk(); }, 16);
      } else {
        searchTextReady = true;
      }
    }
    if ('requestIdleCallback' in window) requestIdleCallback(processChunk, { timeout: 3000 });
    else setTimeout(function () { processChunk(); }, 200);
  }
  // Lanzar el cálculo en background sin bloquear el render inicial
  if (productCards.length) buildAllSearchTextInBackground();

  function applyFilters() {
    let visibleCount = 0;
    const q = normalizeText(searchQuery).trim();
    const qTokens = q ? q.split(/\s+/).filter(Boolean) : [];
    productCards.forEach(function (card) {
      let visible = true;
      for (const key in activeFilters) {
        const want = activeFilters[key];
        if (!want || want === 'all') continue;
        const cardValue = card.dataset[key];
        if (key === 'vertical') {
          if (!tokensOf(cardValue).includes(want)) { visible = false; break; }
        } else {
          if (String(cardValue || '').trim() !== want) { visible = false; break; }
        }
      }
      if (visible && qTokens.length) {
        // Calcular searchText on-demand si todavía no está pre-cacheado
        if (card._searchText === undefined) buildSearchTextForCard(card);
        for (let i = 0; i < qTokens.length; i++) {
          if (card._searchText.indexOf(qTokens[i]) === -1) { visible = false; break; }
        }
      }
      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });
    const counter = document.getElementById('filter-result-count');
    if (counter) counter.textContent = visibleCount;
  }

  // Buscador de texto
  const searchInput = document.getElementById('catalog-search');
  const searchClear = document.getElementById('catalog-search-clear');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value;
      if (searchClear) searchClear.style.display = searchQuery ? 'flex' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 120);
    });
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        applyFilters();
        searchInput.focus();
      });
    }
  }

  filterSelects.forEach(function (sel) {
    const key = sel.dataset.filterSelect;
    activeFilters[key] = sel.value || 'all';
    sel.addEventListener('change', function () {
      activeFilters[key] = sel.value || 'all';
      applyFilters();
    });
  });

  // Botón "Limpiar filtros"
  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      filterSelects.forEach(function (sel) {
        sel.value = 'all';
        activeFilters[sel.dataset.filterSelect] = 'all';
      });
      if (searchInput) {
        searchInput.value = '';
        searchQuery = '';
        if (searchClear) searchClear.style.display = 'none';
      }
      applyFilters();
    });
  }

  // Aplicar pre-filter inicial (en caso de URL params seteando .value antes de este JS)
  if (filterSelects.length) applyFilters();

  // Backward-compat: páginas viejas con .filter-btn (no dropdown)
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      productCards.forEach(function (card) {
        if (filter === 'all' || card.dataset.vertical === filter || tokensOf(card.dataset.vertical).includes(filter) || card.dataset.category === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Distribuidor search simulation
  var searchForm = document.getElementById('dist-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var query = document.getElementById('dist-query').value.trim();
      if (!query) return;
      showDistResults(query);
    });
    var geoBtn = document.getElementById('geo-btn');
    if (geoBtn) {
      geoBtn.addEventListener('click', function () {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function () {
            showDistResults('tu zona');
          }, function () {
            showDistResults('Buenos Aires');
          });
        } else {
          showDistResults('Buenos Aires');
        }
      });
    }
  }

  function showDistResults(zona) {
    var results = document.getElementById('dist-results');
    var noResults = document.getElementById('dist-no-results');
    var placeholder = document.getElementById('dist-placeholder');
    if (!results) return;
    if (placeholder) placeholder.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    results.style.display = '';
    results.innerHTML = buildResultsHTML(zona);
    // Mostrar mapa
    var mapFrame = document.getElementById('dist-map');
    if (mapFrame) mapFrame.style.display = '';
  }

  function buildResultsHTML(zona) {
    var dist = [
      { nombre: 'Ferretería Agropecuaria del Norte', dir: 'Av. San Martín 1240, Pilar, Buenos Aires', tel: '(02322) 450-XXX', tipo: 'Agro', dist: '2.1 km' },
      { nombre: 'Vivero y Casa de Riego El Manantial', dir: 'Ruta 8 Km 62, Del Viso, Buenos Aires', tel: '(011) 4462-XXXX', tipo: 'Áreas Verdes / Hogar', dist: '5.8 km' },
      { nombre: 'Distribuidora Agro Sur', dir: 'Belgrano 780, Luján, Buenos Aires', tel: '(02323) 420-XXX', tipo: 'Agro / Infraestructura', dist: '12.4 km' },
      { nombre: 'Corralón y Materiales La Pampa', dir: 'Mitre 340, Campana, Buenos Aires', tel: '(03489) 425-XXX', tipo: 'Infraestructura', dist: '18.1 km' },
      { nombre: 'Casa de Riego Profesional Agua Viva', dir: 'Corrientes 2340, CABA', tel: '(011) 4963-XXXX', tipo: 'Agro / Áreas Verdes', dist: '24.6 km' },
    ];
    return '<p class="text-sm text-gray-500 mb-4">Mostrando distribuidores cercanos a <strong>' + zona + '</strong></p>' +
      dist.map(function (d) {
        return '<div class="card p-4 mb-3">' +
          '<div class="flex justify-between items-start">' +
          '<div>' +
          '<h4 class="font-semibold text-gray-900">' + d.nombre + '</h4>' +
          '<p class="text-sm text-gray-500 mt-1">' + d.dir + '</p>' +
          '<p class="text-sm text-green-700 mt-1">' + d.tel + '</p>' +
          '<span class="chip chip-agro mt-2 inline-block">' + d.tipo + '</span>' +
          '</div>' +
          '<div class="text-right ml-4">' +
          '<span class="text-xs text-gray-400">' + d.dist + '</span>' +
          '<div class="mt-2"><a href="https://maps.google.com" target="_blank" class="btn-secondary text-xs" style="padding:6px 12px;">Cómo llegar</a></div>' +
          '</div>' +
          '</div>' +
          '</div>';
      }).join('');
  }

  // ============================================================
  // Modal de producto — versión 2 (con imagen + chips + specs ricos)
  // ============================================================

  // Mapeos de vertical/categoría a etiqueta legible y clase de chip.
  var VERTICAL_LABELS = {
    'agro':  { label: 'Agro',           chip: 'chip-agro' },
    'av':    { label: 'Áreas Verdes',   chip: 'chip-av' },
    'infra': { label: 'Infraestructura', chip: 'chip-infra' },
    'hogar': { label: 'Hogar',          chip: 'chip-hogar' }
  };
  var CATEGORY_LABELS = {
    'goteo':         'Goteo',
    'aspersores':    'Aspersores',
    'microaspersores': 'Microaspersores',
    'valvulas':      'Válvulas',
    'filtros':       'Filtros',
    'programadores': 'Programadores',
    'accesorios':    'Accesorios',
    'mangueras':     'Mangueras'
  };

  // Capturamos la card clickeada en fase de captura para que esté disponible
  // antes de que dispare el onclick inline que llama a openProductModal.
  var _lastClickedCard = null;
  document.addEventListener('click', function (e) {
    if (!e.target) return;
    var card = e.target.closest && e.target.closest('.product-card');
    if (card) _lastClickedCard = card;
  }, true);

  function parseSpecsToDl(specsHtml) {
    var temp = document.createElement('table');
    temp.innerHTML = '<tbody>' + (specsHtml || '') + '</tbody>';
    var rows = temp.querySelectorAll('tr');
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var tds = rows[i].querySelectorAll('td');
      if (tds.length < 2) continue;
      var label = tds[0].textContent.trim();
      var value = tds[1].textContent.trim();
      html += '<div class="flex items-baseline justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">' +
                '<dt class="text-gray-500 text-sm">' + label + '</dt>' +
                '<dd class="text-gray-900 text-sm font-medium text-right">' + value + '</dd>' +
              '</div>';
    }
    return html;
  }

  function renderChips(card) {
    if (!card) return '';
    var html = '';
    var verticals = (card.getAttribute('data-vertical') || '').split(/\s+/).filter(Boolean);
    for (var i = 0; i < verticals.length; i++) {
      var v = VERTICAL_LABELS[verticals[i]];
      if (v) html += '<span class="chip ' + v.chip + '">' + v.label + '</span>';
    }
    var cat = card.getAttribute('data-category');
    if (cat) {
      var catLabel = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
      html += '<span class="chip" style="background:#f3f4f6; color:#374151;">' + catLabel + '</span>';
    }
    return html;
  }

  function lastFocusedBeforeModal() { return _lastClickedCard; }

  // Convierte un nombre de producto en slug url-safe.
  // "VYR-80 Circular" → "vyr-80-circular"
  window.slugify = function (s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Actualiza la URL del browser para reflejar el producto abierto (sin recargar)
  function _setProductoEnURL(slug) {
    try {
      var url = new URL(window.location.href);
      if (slug) url.searchParams.set('producto', slug);
      else url.searchParams.delete('producto');
      history.replaceState({ producto: slug || null }, '', url.toString());
    } catch (e) {}
  }

  window.openProductModal = function (name, desc, specs) {
    var modal = document.getElementById('product-modal');
    if (!modal) return;

    // Buscar la card correcta por el nombre del producto (defensivo).
    // _lastClickedCard puede estar stale si hubo navegación entre productos
    // o el modal se abrió por otra vía. Esto garantiza consistencia.
    var card = _lastClickedCard;
    var nameMatchesCard = card && (card.getAttribute('onclick') || '').indexOf("openProductModal('" + name + "'") >= 0;
    if (!nameMatchesCard) {
      var allCards = document.querySelectorAll('.product-card');
      for (var i = 0; i < allCards.length; i++) {
        var oc = allCards[i].getAttribute('onclick') || '';
        if (oc.indexOf("openProductModal('" + name + "'") === 0) {
          card = allCards[i];
          break;
        }
      }
    }

    // Deep linking: agregar el slug del producto a la URL
    _setProductoEnURL(window.slugify(name));

    // Imagen: la sacamos directamente de la card clickeada
    var imgEl = card ? card.querySelector('img') : null;
    var modalImg = document.getElementById('modal-image');
    if (modalImg) {
      modalImg.src = imgEl ? imgEl.getAttribute('src') : '';
      modalImg.alt = imgEl ? (imgEl.getAttribute('alt') || name) : name;
    }

    // Chips de vertical + categoría
    var chipsEl = document.getElementById('modal-chips');
    if (chipsEl) chipsEl.innerHTML = renderChips(card);

    document.getElementById('modal-title').textContent = name;
    document.getElementById('modal-desc').textContent = desc;
    document.getElementById('modal-specs').innerHTML = parseSpecsToDl(specs);

    // Ficha técnica: si la card tiene data-ficha apuntando a un JPG, mostrar el botón
    var fichaBtn = document.getElementById('modal-ficha-btn');
    var fichaUrl = card ? card.getAttribute('data-ficha') : '';
    if (fichaBtn) {
      if (fichaUrl) {
        fichaBtn.classList.remove('hidden');
        fichaBtn.dataset.fichaUrl = fichaUrl;
        fichaBtn.dataset.fichaTitle = name;
      } else {
        fichaBtn.classList.add('hidden');
        fichaBtn.removeAttribute('data-ficha-url');
      }
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // foco en el botón de cerrar para accesibilidad
    var closeBtn = modal.querySelector('button[aria-label="Cerrar"]');
    if (closeBtn) { try { closeBtn.focus(); } catch (e) {} }
  };

  // Sub-modal: ficha técnica (imagen JPG en grande)
  window.openFichaTecnica = function () {
    var btn = document.getElementById('modal-ficha-btn');
    if (!btn) return;
    var url = btn.dataset.fichaUrl;
    if (!url) {
      alert('Ficha técnica próximamente disponible. Consultá al equipo para más info.');
      return;
    }
    var title = btn.dataset.fichaTitle || 'Ficha técnica';
    // Construir lightbox al vuelo si no existe
    var lb = document.getElementById('ficha-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'ficha-lightbox';
      lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:60;display:flex;flex-direction:column;padding:0;';
      lb.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;">' +
          '<h4 id="ficha-lightbox-title" style="color:#fff;font-weight:700;margin:0;font-size:15px;line-height:1.3;flex:1;padding-right:16px;"></h4>' +
          '<button id="ficha-zoom-toggle" type="button" aria-label="Zoom" style="background:rgba(255,255,255,.1);border:none;color:#fff;font-size:13px;line-height:1;cursor:pointer;padding:9px 14px;border-radius:6px;margin-right:8px;font-weight:600;">Zoom</button>' +
          '<button id="ficha-close" type="button" aria-label="Cerrar" style="background:transparent;border:none;color:#fff;font-size:30px;line-height:1;cursor:pointer;padding:4px 10px;">×</button>' +
        '</div>' +
        '<div id="ficha-scroll" style="flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;">' +
          '<img id="ficha-lightbox-img" src="" alt="" style="width:100%;max-width:1100px;height:auto;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);background:#fff;display:block;cursor:zoom-in;image-rendering:auto;" />' +
        '</div>';
      document.body.appendChild(lb);
      lb.querySelector('#ficha-close').addEventListener('click', window.closeFichaTecnica);
      // Click en backdrop para cerrar (no en imagen ni controles)
      lb.addEventListener('click', function (e) {
        if (e.target === lb || e.target.id === 'ficha-scroll') window.closeFichaTecnica();
      });
      // Toggle zoom: alterna entre fit-to-width y tamaño natural (con scroll)
      var img = lb.querySelector('#ficha-lightbox-img');
      var zoomBtn = lb.querySelector('#ficha-zoom-toggle');
      var zoomed = false;
      function applyZoom() {
        if (zoomed) {
          img.style.maxWidth = 'none';
          img.style.width = 'auto';
          img.style.cursor = 'zoom-out';
          zoomBtn.textContent = 'Ajustar';
        } else {
          img.style.width = '100%';
          img.style.maxWidth = '1100px';
          img.style.cursor = 'zoom-in';
          zoomBtn.textContent = 'Zoom';
        }
      }
      zoomBtn.addEventListener('click', function (e) { e.stopPropagation(); zoomed = !zoomed; applyZoom(); });
      img.addEventListener('click', function (e) { e.stopPropagation(); zoomed = !zoomed; applyZoom(); });
    }
    document.getElementById('ficha-lightbox-title').textContent = title;
    document.getElementById('ficha-lightbox-img').src = url;
    document.getElementById('ficha-lightbox-img').alt = title;
    lb.style.display = 'flex';
  };
  window.closeFichaTecnica = function () {
    var lb = document.getElementById('ficha-lightbox');
    if (lb) lb.style.display = 'none';
  };
  // Compartir producto por WhatsApp — usa la URL completa con ?producto=slug
  window.shareProductWhatsApp = function () {
    const title = (document.getElementById('modal-title') || {}).textContent || '';
    const url = window.location.href; // URL completa incluyendo ?producto=...
    const msg = `Hola, te paso este producto de Sure Rain:\n\n*${title}*\n${url}`;
    const wa = 'https://wa.me/?text=' + encodeURIComponent(msg);
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  window.closeProductModal = function () {
    var modal = document.getElementById('product-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    // Sacar el producto de la URL al cerrar el modal
    _setProductoEnURL(null);
    // devolver foco a la card que originó el modal
    var card = lastFocusedBeforeModal();
    if (card && typeof card.focus === 'function') { try { card.focus(); } catch (e) {} }
  };
  var modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('click', closeProductModal);

  // Esc para cerrar
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var modal = document.getElementById('product-modal');
    if (modal && !modal.classList.contains('hidden')) closeProductModal();
  });

  // Marca de nav activa
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(function (link) {
    var href = link.getAttribute('href') || '';
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // ============================================================
  // SLIDER horizontal para secciones de equipo (y reusable)
  // ============================================================
  document.querySelectorAll('.team-slider').forEach(function (slider) {
    var viewport = slider.querySelector('.slider-viewport');
    var prev = slider.querySelector('.slider-btn.prev');
    var next = slider.querySelector('.slider-btn.next');
    if (!viewport || !prev || !next) return;

    function step() {
      var first = viewport.querySelector('.slider-track > *');
      if (!first) return 200;
      var style = window.getComputedStyle(first.parentNode);
      var gap = parseFloat(style.gap) || 18;
      return first.offsetWidth + gap;
    }

    function updateButtons() {
      var max = viewport.scrollWidth - viewport.clientWidth - 2;
      prev.disabled = viewport.scrollLeft <= 2;
      next.disabled = viewport.scrollLeft >= max;
    }

    prev.addEventListener('click', function () {
      viewport.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    next.addEventListener('click', function () {
      viewport.scrollBy({ left: step(), behavior: 'smooth' });
    });
    viewport.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    // Si el track entra entero, deshabilitar ambas flechas
    setTimeout(updateButtons, 50);
  });

});
