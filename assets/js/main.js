/* Shared site script: footer year, mobile menu, cookie notice. */
(function () {
  var d = document;

  var yr = d.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // Mobile menu
  var t = d.getElementById('menu-toggle'), nav = d.getElementById('main-nav');
  if (t && nav) {
    t.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    [].forEach.call(nav.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); });
    });
  }

  // Cookie notice. Load your Google tag / analytics ONLY after the 'cookie-consent'
  // event fires with detail.choice === 'accept' if you target the EEA/UK.
  var KEY = 'cookie-choice', banner = d.getElementById('cookie');
  function showCookie() { if (banner) banner.hidden = false; }
  try { if (!localStorage.getItem(KEY)) showCookie(); } catch (err) { showCookie(); }
  if (banner) {
    [].forEach.call(banner.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var choice = b.getAttribute('data-choice');
        try { localStorage.setItem(KEY, choice); } catch (err) {}
        banner.hidden = true;
        d.dispatchEvent(new CustomEvent('cookie-consent', { detail: { choice: choice } }));
      });
    });
  }
})();
