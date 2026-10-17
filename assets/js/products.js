/* Loads /data/products.json and fills the product areas on the page.
   Put one of these attributes on an empty element:
     data-products="featured"    featured, published products (homepage)
     data-products="all"         every published product, filterable by ?category= (/products/)
     data-products="latest"      newest published products as a simple list (homepage)
     data-products="categories"  category links, only for categories that have published products
   Only products with "status": "published" are ever shown. */
(function () {
  var d = document;
  var targets = d.querySelectorAll('[data-products]');
  if (!targets.length) return;

  function el(tag, cls, text) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function showError(target) {
    target.textContent = '';
    var p = el('p', 'status-msg', 'The product list could not be loaded right now. Please refresh the page, or open our ');
    var a = el('a', '', 'AiBizEngine review');
    a.href = '/ai-biz-engine/';
    p.appendChild(a);
    p.appendChild(d.createTextNode(' directly.'));
    target.appendChild(p);
  }

  function card(p) {
    var art = el('article', 'product-card');
    if (p.accentColor) art.style.setProperty('--card-accent', p.accentColor);

    var thumb = el('a', 'card-thumb');
    thumb.href = p.pageUrl;
    thumb.setAttribute('aria-label', 'Read the ' + p.name + ' review');
    var img = d.createElement('img');
    img.src = p.image;
    img.alt = p.imageAlt || p.name;
    if (p.imageWidth) img.width = p.imageWidth;
    if (p.imageHeight) img.height = p.imageHeight;
    img.loading = 'lazy';
    thumb.appendChild(img);
    art.appendChild(thumb);

    var body = el('div', 'card-body');
    body.appendChild(el('span', 'card-cat', p.category));
    var h = el('h3');
    var hl = el('a', '', p.name);
    hl.href = p.pageUrl;
    h.appendChild(hl);
    body.appendChild(h);
    body.appendChild(el('p', '', p.shortDescription));
    if (p.tags && p.tags.length) {
      var ul = el('ul', 'tags');
      p.tags.forEach(function (t) { ul.appendChild(el('li', '', t)); });
      body.appendChild(ul);
    }
    var actions = el('div', 'card-actions');
    var review = el('a', 'btn btn-primary btn-sm', 'View Review');
    review.href = p.pageUrl;
    review.setAttribute('aria-label', 'View the ' + p.name + ' review');
    actions.appendChild(review);
    if (p.affiliateUrl) {
      var site = el('a', 'btn btn-secondary btn-sm', 'Visit Official Website');
      site.href = p.affiliateUrl;
      site.target = '_blank';
      site.rel = 'sponsored noopener';
      site.setAttribute('aria-label', 'Visit the official ' + p.name + ' website (affiliate link, opens in a new tab)');
      actions.appendChild(site);
    }
    body.appendChild(actions);
    art.appendChild(body);
    return art;
  }

  function categoriesOf(list) {
    var seen = [];
    list.forEach(function (p) { if (p.category && seen.indexOf(p.category) < 0) seen.push(p.category); });
    return seen;
  }

  function renderGrid(target, list, emptyText) {
    target.textContent = '';
    if (!list.length) { target.appendChild(el('p', 'status-msg', emptyText)); return; }
    var grid = el('div', 'product-grid');
    list.forEach(function (p) { grid.appendChild(card(p)); });
    target.appendChild(grid);
  }

  function render(all) {
    var published = all.filter(function (p) { return p.status === 'published'; });
    [].forEach.call(targets, function (target) {
      var mode = target.getAttribute('data-products');

      if (mode === 'featured') {
        var f = published.filter(function (p) { return p.featured; });
        renderGrid(target, f.length ? f : published, 'Products are coming soon.');

      } else if (mode === 'all') {
        var wanted = new URLSearchParams(window.location.search).get('category');
        var cats = categoriesOf(published);
        if (cats.indexOf(wanted) < 0) wanted = null;
        var holder = el('div');
        var bar = target.parentNode.querySelector('[data-category-bar]');
        function draw() {
          renderGrid(holder, published.filter(function (p) { return !wanted || p.category === wanted; }), 'No products in this category yet.');
        }
        if (bar && cats.length > 1) {
          var chips = el('ul', 'chips');
          ['All'].concat(cats).forEach(function (c) {
            var li = el('li');
            var b = el('a', (c === 'All' ? !wanted : c === wanted) ? 'active' : '', c);
            b.href = c === 'All' ? '/products/' : '/products/?category=' + encodeURIComponent(c);
            b.addEventListener('click', function (e) {
              e.preventDefault();
              wanted = c === 'All' ? null : c;
              [].forEach.call(chips.querySelectorAll('a'), function (x) { x.className = ''; });
              b.className = 'active';
              history.replaceState(null, '', b.href);
              draw();
            });
            li.appendChild(b);
            chips.appendChild(li);
          });
          bar.appendChild(chips);
        }
        target.textContent = '';
        target.appendChild(holder);
        draw();

      } else if (mode === 'latest') {
        var sorted = published.slice().sort(function (a, b) { return String(b.updated || '').localeCompare(String(a.updated || '')); });
        target.textContent = '';
        var ul = el('ul', 'latest-list');
        sorted.slice(0, 5).forEach(function (p) {
          var li = el('li');
          var a = el('a', '', p.name + ' review');
          a.href = p.pageUrl;
          li.appendChild(a);
          li.appendChild(el('span', '', p.category + (p.updated ? ' · Updated ' + p.updated : '')));
          ul.appendChild(li);
        });
        target.appendChild(ul);

      } else if (mode === 'categories') {
        target.textContent = '';
        var list = el('ul', 'chips');
        categoriesOf(published).forEach(function (c) {
          var li = el('li');
          var a = el('a', '', c);
          a.href = '/products/?category=' + encodeURIComponent(c);
          li.appendChild(a);
          list.appendChild(li);
        });
        target.appendChild(list);
      }
    });
  }

  fetch('/data/products.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(render)
    .catch(function (err) {
      if (window.console) console.warn('products.json failed to load:', err);
      [].forEach.call(targets, showError);
    });
})();
