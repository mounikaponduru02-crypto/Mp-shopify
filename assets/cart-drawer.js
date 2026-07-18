/* Header interactions: cart drawer, search panel, mobile menu + AJAX cart */
(function () {
  'use strict';

  var configEl = document.querySelector('[data-cart-drawer-config]');
  var config = { sectionId: 'header', cartDrawer: true, routes: { root_url: '/', cart_url: '/cart' } };
  if (configEl) {
    try { config = Object.assign(config, JSON.parse(configEl.textContent)); } catch (e) {}
  }

  // Build AJAX endpoints from the (possibly localized) root url.
  var root = (config.routes.root_url || '/').replace(/\/$/, '');
  var CHANGE_URL = root + '/cart/change.js';
  var ADD_URL = root + '/cart/add.js';

  var body = document.body;
  var overlay = document.querySelector('[data-overlay]');
  var cartDrawer = document.querySelector('[data-cart-drawer]');
  var mobileMenu = document.querySelector('[data-mobile-menu]');
  var searchPanel = document.querySelector('[data-search-panel]');

  var openPanel = null;
  var lastFocused = null;

  function lockScroll() { body.classList.add('scroll-lock'); }
  function unlockScroll() { body.classList.remove('scroll-lock'); }

  function showOverlay() {
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
  }
  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    setTimeout(function () { overlay.hidden = true; }, 300);
  }

  function open(panel) {
    if (!panel) return;
    if (openPanel && openPanel !== panel) close(openPanel, true);
    lastFocused = document.activeElement;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    showOverlay();
    lockScroll();
    openPanel = panel;
    var focusable = panel.querySelector('input, button, a[href]');
    if (focusable) setTimeout(function () { focusable.focus(); }, 50);
  }

  function close(panel, keepOverlay) {
    panel = panel || openPanel;
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (!keepOverlay) hideOverlay();
    unlockScroll();
    if (openPanel === panel) openPanel = null;
    if (lastFocused && !keepOverlay) { lastFocused.focus(); lastFocused = null; }
  }

  function toggleSearch() {
    if (!searchPanel) return;
    var isOpen = searchPanel.classList.contains('is-open');
    if (isOpen) {
      searchPanel.classList.remove('is-open');
      searchPanel.setAttribute('aria-expanded', 'false');
      setTimeout(function () { searchPanel.hidden = true; }, 300);
      hideOverlay();
      unlockScroll();
      openPanel = null;
    } else {
      searchPanel.hidden = false;
      requestAnimationFrame(function () { searchPanel.classList.add('is-open'); });
      showOverlay();
      openPanel = searchPanel;
      var input = searchPanel.querySelector('input[type="search"]');
      if (input) setTimeout(function () { input.focus(); }, 50);
    }
  }

  // ----- Event delegation for open/close controls -----
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-cart-open]')) {
      e.preventDefault();
      open(cartDrawer);
    } else if (e.target.closest('[data-cart-close]')) {
      close(cartDrawer);
    } else if (e.target.closest('[data-menu-open]')) {
      open(mobileMenu);
    } else if (e.target.closest('[data-menu-close]')) {
      close(mobileMenu);
    } else if (e.target.closest('[data-search-toggle]')) {
      e.preventDefault();
      toggleSearch();
    } else if (e.target.closest('[data-overlay]')) {
      if (searchPanel && searchPanel.classList.contains('is-open')) { toggleSearch(); }
      else { close(); }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (searchPanel && searchPanel.classList.contains('is-open')) { toggleSearch(); }
      else if (openPanel) { close(); }
    }
  });

  // ----- AJAX cart -----
  function setLoading(state) {
    if (!cartDrawer) return;
    cartDrawer.classList.toggle('is-loading', state);
  }

  function changeLine(line, quantity) {
    setLoading(true);
    return fetch(CHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity })
    })
      .then(function (r) { return r.json(); })
      .then(function () { return refreshCart(); })
      .catch(function () {})
      .finally(function () { setLoading(false); });
  }

  function refreshCart() {
    var url = window.location.pathname + '?section_id=' + encodeURIComponent(config.sectionId);
    return fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        var newContent = doc.querySelector('[data-cart-drawer-content]');
        var content = document.querySelector('[data-cart-drawer-content]');
        if (newContent && content) content.innerHTML = newContent.innerHTML;

        var newCount = doc.querySelector('[data-cart-count]');
        var count = newCount ? newCount.textContent.trim() : '0';
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
          el.textContent = count;
          el.classList.toggle('is-empty', count === '0');
        });
        var label = document.querySelector('[data-cart-count-label]');
        if (label) label.textContent = '(' + count + ')';
      });
  }

  document.addEventListener('click', function (e) {
    var item = e.target.closest('[data-cart-item]');
    if (!item) return;
    var line = parseInt(item.getAttribute('data-line'), 10);
    var input = item.querySelector('[data-qty-input]');
    var qty = input ? parseInt(input.value, 10) : 1;

    if (e.target.closest('[data-qty-increase]')) {
      changeLine(line, qty + 1);
    } else if (e.target.closest('[data-qty-decrease]')) {
      changeLine(line, Math.max(0, qty - 1));
    } else if (e.target.closest('[data-cart-remove]')) {
      changeLine(line, 0);
    }
  });

  // ----- Intercept add-to-cart forms to open the drawer -----
  if (config.cartDrawer) {
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      var action = form.getAttribute('action') || '';
      if (action.indexOf('/cart/add') === -1) return;

      e.preventDefault();
      var formData = new FormData(form);
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.setAttribute('disabled', 'disabled');

      fetch(ADD_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(function (r) { return r.json(); })
        .then(function () { return refreshCart(); })
        .then(function () { open(cartDrawer); })
        .catch(function () { form.submit(); })
        .finally(function () { if (submitBtn) submitBtn.removeAttribute('disabled'); });
    });
  }
})();
