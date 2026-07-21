(function () {
  'use strict';

  var drawer = document.querySelector('[data-qv-drawer]');
  var overlay = document.querySelector('[data-qv-overlay]');
  var content = document.querySelector('[data-qv-content]');
  var loader = document.getElementById('loader');
  if (!drawer || !content) return;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function showLoader() { if (loader) { loader.classList.remove('hidden'); loader.classList.add('flex'); } }
  function hideLoader() { if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); } }

  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (overlay) { overlay.hidden = false; requestAnimationFrame(function () { overlay.classList.add('is-visible'); }); }
    document.body.classList.add('scroll-lock');
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) { overlay.classList.remove('is-visible'); setTimeout(function () { overlay.hidden = true; }, 300); }
    document.body.classList.remove('scroll-lock');
  }

  function refreshMiniCart() {
    return fetch(window.location.pathname + '?section_id=header')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var nc = doc.querySelector('[data-cart-drawer-content]');
        var c = document.querySelector('[data-cart-drawer-content]');
        if (nc && c) c.innerHTML = nc.innerHTML;
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

  function addToCart(id, quantity) {
    if (!id) return Promise.resolve();
    showLoader();
    return fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: id, quantity: quantity || 1 }] })
    })
      .then(function (r) { return r.json(); })
      .then(function () { return refreshMiniCart(); })
      .then(function () {
        hideLoader();
        var cartOpen = document.querySelector('[data-cart-open]');
        if (cartOpen) cartOpen.click();
      })
      .catch(function (e) { hideLoader(); console.error('Quick add error:', e); });
  }

  function loadQuickView(url) {
    showLoader();
    fetch(url + '?section_id=quick-view')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        content.innerHTML = html;
        hideLoader();
        openDrawer();
      })
      .catch(function (e) { hideLoader(); console.error('Quick view error:', e); });
  }

  document.addEventListener('click', function (e) {
    var qv = e.target.closest('[data-quick-view]');
    if (qv) { e.preventDefault(); loadQuickView(qv.getAttribute('data-quick-view')); return; }

    var qa = e.target.closest('[data-quick-add]');
    if (qa) { e.preventDefault(); addToCart(qa.getAttribute('data-quick-add'), 1); return; }

    if (e.target.closest('[data-qv-close]') || e.target.closest('[data-qv-overlay]')) { closeDrawer(); return; }

    if (e.target.closest('[data-qv-inc]') || e.target.closest('[data-qv-dec]')) {
      var qtyInput = content.querySelector('[data-qv-qty]');
      if (qtyInput) {
        var val = parseInt(qtyInput.value, 10) || 1;
        if (e.target.closest('[data-qv-inc]')) { val++; } else { val = Math.max(1, val - 1); }
        qtyInput.value = val;
      }
      return;
    }

    var qvAdd = e.target.closest('[data-qv-add-to-cart]');
    if (qvAdd) {
      e.preventDefault();
      var variantEl = content.querySelector('[data-qv-variant]');
      var qtyEl = content.querySelector('[data-qv-qty]');
      var id = variantEl ? variantEl.value : qvAdd.getAttribute('data-default-variant');
      var qty = qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1;
      addToCart(id, qty).then(function () { closeDrawer(); });
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
  });
})();
