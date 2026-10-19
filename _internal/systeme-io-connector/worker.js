/**
 * Lead connector: website pop-up form -> systeme.io contact
 *
 * Deploy as a Cloudflare Worker (free plan is enough). It keeps your systeme.io
 * API key secret (never put the key in the website's JavaScript) and adds the
 * contact to systeme.io, optionally with a tag.
 *
 * Settings (Worker > Settings > Variables and Secrets):
 *   SYSTEME_API_KEY  (Secret, required)  your systeme.io public API key
 *   TAG_NAME         (Text, optional)    fallback tag when the page sends no product name (default "Bonus Lead")
 *   ALLOWED_PRODUCTS (Text, optional)    e.g. "AiBizEngine,AIProspectGenie"; only these product names may create tags
 *   ALLOWED_ORIGIN   (Text, optional)    your site, e.g. https://yourdomain.com  (default: any)
 *   DEBUG            (Text, optional)    set to 1 only while troubleshooting; adds status codes to the reply
 */
const API = 'https://api.systeme.io/api';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405, cors);

    let body;
    try { body = JSON.parse(await request.text()); }
    catch (e) { return json({ ok: false, error: 'Invalid JSON' }, 400, cors); }

    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || body.first_name || '').trim().slice(0, 80);
    if (body.website) return json({ ok: true }, 200, cors);                 // honeypot
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok: false, error: 'Invalid email' }, 400, cors);
    if (body.consent !== 'yes') return json({ ok: false, error: 'Consent required' }, 400, cors);
    if (!env.SYSTEME_API_KEY) return json({ ok: false, error: 'Server not configured' }, 500, cors);

    const headers = { 'X-API-Key': env.SYSTEME_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    let contactId = null;
    const dbg = {};   // status codes only (no secrets) so a failed save can be diagnosed

    try {
      // 1) create the contact
      const create = await fetch(API + '/contacts', {
        method: 'POST', headers,
        body: JSON.stringify({ email, locale: 'en', fields: name ? [{ slug: 'first_name', value: name }] : [] })
      });
      dbg.create = create.status;
      if (create.ok) {
        const c = await create.json();
        contactId = c && c.id;
      } else {
        try { dbg.createError = (await create.text()).slice(0, 300); } catch (x) {}
        // already exists? look it up so we can still tag it
        const found = await fetch(API + '/contacts?email=' + encodeURIComponent(email), { headers });
        dbg.lookup = found.status;
        if (found.ok) {
          const d = await found.json();
          contactId = d && d.items && d.items[0] && d.items[0].id;
        }
      }

      // 2) tag it (so a systeme.io automation rule can react)
      // tag = "<product> Bonus" (e.g. "AIProspectGenie Bonus"); falls back to TAG_NAME
      const product = String(body.product || '').trim();
      const okProduct = /^[A-Za-z0-9 ._-]{2,40}$/.test(product) &&
        (!env.ALLOWED_PRODUCTS || env.ALLOWED_PRODUCTS.split(',').map(function (x) { return x.trim(); }).indexOf(product) > -1);
      const tagName = (okProduct ? product + ' Bonus' : (env.TAG_NAME || 'Bonus Lead')).trim();
      if (contactId && tagName) {
        let tagId = null;
        const list = await fetch(API + '/tags?limit=100', { headers });
        if (list.ok) {
          const d = await list.json();
          const hit = (d.items || []).find(function (t) { return t.name === tagName; });
          if (hit) tagId = hit.id;
        }
        if (!tagId) {
          const mk = await fetch(API + '/tags', { method: 'POST', headers, body: JSON.stringify({ name: tagName }) });
          if (mk.ok) { const t = await mk.json(); tagId = t && t.id; }
        }
        dbg.tag = tagName;
        if (tagId) { const tr = await fetch(API + '/contacts/' + contactId + '/tags', { method: 'POST', headers, body: JSON.stringify({ tagId }) }); dbg.tagStatus = tr.status; }
      }
    } catch (e) { dbg.exception = String(e && e.message || e).slice(0, 200); /* never block the visitor */ }

    // Diagnostics are off by default (they would reveal whether an email is already in your list).
    // To debug, add a Text variable DEBUG = 1 in the Worker settings, then remove it again.
    const out = { ok: true, saved: !!contactId };
    if (env.DEBUG === '1') out.debug = dbg;
    return json(out, 200, cors);
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '*').trim();
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : (origin === allowed ? origin : allowed),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
}
