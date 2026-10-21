/* Bonus pop-up for the affiliate review pages (opens when a buy button is clicked).
   Carried over from the original landing page main.js. The product name comes from
   data-product on the #bonus-modal element, so one script serves every product. */
(function () {
  var d = document;

  /* ------------------------------------------------------------------
     BONUS FORM SETTINGS
     Paste your systeme.io connector URL here (the Cloudflare Worker URL
     from the systeme-io-connector folder, e.g. https://xxx.workers.dev).
     When a visitor chooses "Continue With Email", their name, email and
     offer are sent there as JSON, which creates the contact in systeme.io.
     Leave empty and nothing is saved (visitors are still redirected).
  ------------------------------------------------------------------ */
  var LEAD_ENDPOINT = "https://aireview.mohammednizamuddin78654.workers.dev";


  /* ---------------- Bonus pop-up (opens only when a buy button is clicked) ---------------- */
  var modal = d.getElementById('bonus-modal');
  if (!modal) return;
  var formView = d.getElementById('modal-form-view'), thanksView = d.getElementById('modal-thanks-view');
  var form = d.getElementById('lead-form'), errBox = d.getElementById('form-err');
  var skipBtn = d.getElementById('skip-btn'), thanksLink = d.getElementById('thanks-link'), thanksName = d.getElementById('thanks-name');
  var pending = '', lastFocus = null;
  // Test mode: add ?leaddebug=1 to the page address. The pop-up then shows what happened instead of redirecting.
  var DEBUG_MODE = /[?&]leaddebug=1/.test(window.location.search);
  var dbgBox = null;
  function dbgLine(text) {
    if (!DEBUG_MODE) return;
    if (!dbgBox) {
      dbgBox = d.createElement('pre'); dbgBox.id = 'lead-debug';
      dbgBox.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:45vh;overflow:auto;z-index:99999;white-space:pre-wrap;word-break:break-word;background:#111;color:#7CFC9A;padding:10px;border-radius:8px;font:13px/1.4 monospace;text-align:left;margin:0';
      d.body.appendChild(dbgBox);
    }
    dbgBox.textContent += (dbgBox.textContent ? '\n' : '') + text;
  }
  dbgLine('TEST MODE ON. Script v9 loaded. Product: ' + (modal && modal.getAttribute('data-product')));

  function offerOf(href) { return href.indexOf('453697') > -1 ? 'bundle' : 'front-end'; }

  function openModal(href) {
    dbgLine('Pop-up opened. Buy link: ' + href);
    pending = href;
    lastFocus = d.activeElement;
    form.reset();
    errBox.hidden = true;
    formView.hidden = false; thanksView.hidden = true;
    modal.hidden = false;
    d.body.classList.add('modal-open');
    setTimeout(function () { var f = d.getElementById('lead-name'); if (f) f.focus(); }, 30);
  }
  function closeModal() {
    modal.hidden = true;
    d.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function goToOffer(href) { window.location.href = href; }
  function sendLead(data) {
    // 1) Normal fetch with keepalive (the browser finishes it even if the page is left). It is sent as plain text,
    //    so no extra "pre-check" request is needed. 2) If that is blocked (some privacy extensions block requests),
    //    fall back to sendBeacon. The Worker saves in the background, so we never wait long before redirecting.
    if (!LEAD_ENDPOINT) {
      if (window.console) console.warn('LEAD_ENDPOINT is empty in assets/js/bonus-popup.js: the email was not saved.');
      return Promise.resolve({ via: 'none', error: 'LEAD_ENDPOINT is empty' });
    }
    var payload = JSON.stringify(data), t0 = Date.now();
    function beacon() { try { return !!(navigator.sendBeacon && navigator.sendBeacon(LEAD_ENDPOINT, payload)); } catch (e) { return false; } }
    var viaFetch;
    try {
      viaFetch = fetch(LEAD_ENDPOINT, { method: 'POST', body: payload, keepalive: true })
        .then(function (r) { return { via: 'fetch', ok: r.ok, status: r.status, ms: Date.now() - t0 }; },
              function (e) { return { via: 'fetch', ok: false, error: String(e), ms: Date.now() - t0 }; });
    } catch (e) { viaFetch = Promise.resolve({ via: 'fetch', ok: false, error: String(e) }); }
    var limit = new Promise(function (r) { setTimeout(function () { r({ via: 'fetch', ok: null, slow: true, ms: 1500 }); }, 1500); });
    return Promise.race([viaFetch, limit]).then(function (res) {
      if (res.ok === false) { res.beaconTried = true; res.beaconAccepted = beacon(); }   // fetch was blocked: try the beacon
      return res;
    });
  }

  // Intercept plain clicks on buy links. Modified clicks (new tab etc.) go straight through.
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[rel~="sponsored"]');
    if (!a || a.id === 'thanks-link') return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openModal(a.href);
  });

  // Close controls
  modal.addEventListener('click', function (e) {
    if (e.target.getAttribute && e.target.getAttribute('data-close')) closeModal();
  });
  d.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      var f = [].filter.call(modal.querySelectorAll('a[href],button,input:not(.hp),select,textarea'), function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Option 1: continue without bonuses (nothing is collected) -> redirect to the affiliate link
  skipBtn.addEventListener('click', function () {
    skipBtn.disabled = true;
    goToOffer(pending);
  });

  var emailBtn = form.querySelector('button[type=submit]');
  if (emailBtn) emailBtn.addEventListener('click', function () { dbgLine('Clicked: Continue With Email button'); });
  form.addEventListener('submit', function () { dbgLine('Form submit event fired'); }, true);

  // Option 2: continue with email -> save the lead in systeme.io, then redirect to the affiliate link
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    try {
      var el = form.elements;
      // (No hidden spam-trap field any more: browsers and extensions can auto-fill it and silently block real visitors.)
      if (DEBUG_MODE) { var inv = []; for (var i = 0; i < el.length; i++) { if (el[i].name) inv.push(el[i].name + (el[i].value ? '=filled' : '=empty')); } dbgLine('Fields: ' + inv.join(', ')); }
      var name = (el['fname'] ? el['fname'].value : '').trim(), email = (el['email'] ? el['email'].value : '').trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name) { errBox.textContent = 'Please enter your first name.'; dbgLine('Stopped: first name empty'); errBox.hidden = false; el['fname'].focus(); return; }
      if (!valid) { errBox.textContent = 'Please enter a valid email address.'; dbgLine('Stopped: email not valid'); errBox.hidden = false; el['email'].focus(); return; }
      if (!el['consent'].checked) { errBox.textContent = 'Please tick the box to agree, or skip this step.'; dbgLine('Stopped: consent box not ticked'); errBox.hidden = false; el['consent'].focus(); return; }
      errBox.hidden = true;
      var target = pending;
      thanksLink.href = target;
      formView.hidden = true; thanksView.hidden = false;
      dbgLine('Form submitted. Sending ' + email + ' for product "' + (modal.getAttribute('data-product') || '') + '"...');
      sendLead({ name: name, email: email, offer: offerOf(target), consent: 'yes', page: window.location.href, source: 'bonus-popup', product: modal.getAttribute('data-product') || '' })
        .then(function (res) {
          if (DEBUG_MODE) {
            dbgLine('RESULT: ' + JSON.stringify(res) + '\n' +
              (res.ok ? 'Your browser reached the Worker. Check systeme.io Contacts in about 30 seconds.'
               : res.slow ? 'No answer within 1.5 s (a slow connection, or the request is being held up).'
               : 'Your browser could NOT reach the Worker. Something on your side is blocking requests to workers.dev.') +
              '\nDebug mode: not redirecting. Use the button below to continue.');
            return;
          }
          goToOffer(target);
        });
    } catch (err) {
      // Safety net: if anything unexpected fails, never leave the visitor stuck on the pop-up.
      if (window.console) console.error('bonus pop-up error', err); dbgLine('ERROR in form code: ' + err);
      goToOffer(pending);
    }
  });
})();
