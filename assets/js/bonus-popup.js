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

  function offerOf(href) { return href.indexOf('453697') > -1 ? 'bundle' : 'front-end'; }

  function openModal(href) {
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
    // Resolves when the lead request finishes or after 2 seconds, whichever comes first,
    // so the visitor is never held up and is always redirected.
    if (!LEAD_ENDPOINT) {
      if (window.console) console.warn('LEAD_ENDPOINT is empty in assets/main.js: the email was not saved.');
      return Promise.resolve();
    }
    var req;
    try {
      req = fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function () {});
    } catch (e) { req = Promise.resolve(); }
    return Promise.race([req, new Promise(function (r) { setTimeout(r, 2000); })]);
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

  // Option 2: continue with email -> save the lead in systeme.io, then redirect to the affiliate link
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // Honeypot: only bots fill this hidden field. Never leave a visitor stuck: skip saving, still send them on.
    var trap = form.elements['hp_check'];
    if (trap && trap.value) { goToOffer(pending); return; }
    var name = form.fname.value.trim(), email = form.email.value.trim();
    var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name) { errBox.textContent = 'Please enter your first name.'; errBox.hidden = false; form.fname.focus(); return; }
    if (!valid) { errBox.textContent = 'Please enter a valid email address.'; errBox.hidden = false; form.email.focus(); return; }
    if (!form.consent.checked) { errBox.textContent = 'Please tick the box to agree, or choose "Continue Without Bonuses".'; errBox.hidden = false; form.consent.focus(); return; }
    errBox.hidden = true;
    var target = pending;
    thanksLink.href = target;
    formView.hidden = true; thanksView.hidden = false;
    sendLead({ name: name, email: email, offer: offerOf(target), consent: 'yes', page: window.location.href, source: 'bonus-popup', product: modal.getAttribute('data-product') || '' })
      .then(function () { goToOffer(target); });
  });
})();
