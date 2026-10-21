/**
 * Lead connector: website pop-up form -> systeme.io contact
 *
 * Deploy as a Cloudflare Worker (free plan is enough). It keeps your systeme.io
 * API key secret (never put the key in the website's JavaScript) and adds the
 * contact to systeme.io, optionally with a tag.
 *
 * The Worker answers the visitor immediately and finishes the systeme.io work in the
 * background (ctx.waitUntil), so a visitor leaving the page cannot cancel the save.
 *
 * Settings (Worker > Settings > Variables and Secrets):
 *   SYSTEME_API_KEY  (Secret, required)  your systeme.io public API key
 *   TAG_NAME         (Text, optional)    fallback tag when the page sends no product name (default "Bonus Lead")
 *   ALLOWED_PRODUCTS (Text, optional)    e.g. "AiBizEngine,AIProspectGenie"; only these product names may create tags
 *   PRODUCT_FIELD    (Text, optional)    contact field that stores the product name (default 'product';
 *                                        if it cannot be created, the standard field 'company_name' is used)
 *   ALLOWED_ORIGIN   (Text, optional)    your site, e.g. https://www.aireveiw.com  (default: any)
 *   DEBUG            (Text, optional)    set to 1 only while troubleshooting; the reply then waits for systeme.io
 *                                        and includes status codes (do not leave it on: it can reveal whether an
 *                                        email is already in your list)
 */
const API = 'https://api.systeme.io/api';

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405, cors);

    // The browser may send JSON as text/plain (sendBeacon), so always read the raw text.
    let body;
    try { body = JSON.parse(await request.text()); }
    catch (e) { return json({ ok: false, error: 'Invalid JSON' }, 400, cors); }

    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || body.first_name || '').trim().slice(0, 80);
    if (body.website || body.hp_check) return json({ ok: true }, 200, cors);   // honeypot
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok: false, error: 'Invalid email' }, 400, cors);
    if (body.consent !== 'yes') return json({ ok: false, error: 'Consent required' }, 400, cors);
    if (!env.SYSTEME_API_KEY) return json({ ok: false, error: 'Server not configured' }, 500, cors);

    const job = saveLead(env, email, name, String(body.product || '').trim());

    if (env.DEBUG === '1') {                       // troubleshooting mode: wait and report
      const r = await job;
      return json({ ok: true, saved: !!r.contactId, debug: r.dbg }, 200, cors);
    }
    ctx.waitUntil(job.catch(function () {}));      // normal mode: reply now, finish in the background
    return json({ ok: true, queued: true }, 200, cors);
  }
};

async function saveLead(env, email, name, product) {
  const headers = { 'X-API-Key': env.SYSTEME_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const dbg = {};
  let contactId = null;
  try {
    // 1) create the contact (only the first name here, so a field problem can never lose the lead)
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
      // already exists? look it up so we can still update it
      const found = await fetch(API + '/contacts?email=' + encodeURIComponent(email), { headers });
      dbg.lookup = found.status;
      if (found.ok) {
        const d = await found.json();
        contactId = d && d.items && d.items[0] && d.items[0].id;
      }
    }
    if (!contactId) return { contactId, dbg };

    const okProduct = /^[A-Za-z0-9 ._-]{2,40}$/.test(product) &&
      (!env.ALLOWED_PRODUCTS || env.ALLOWED_PRODUCTS.split(',').map(function (x) { return x.trim(); }).indexOf(product) > -1);
    const productName = okProduct ? product : '';

    // 2) record WHICH PRODUCT the lead came from in a contact field (works on plans with a tag limit)
    if (productName) {
      try {
        let slug = (env.PRODUCT_FIELD || 'product').trim();
        const fl = await fetch(API + '/contact_fields?limit=100', { headers });
        dbg.fieldList = fl.status;
        let have = false;
        if (fl.ok) {
          const d = await fl.json();
          have = (d.items || []).some(function (f) { return f.slug === slug; });
        }
        if (!have) {
          const mkf = await fetch(API + '/contact_fields', { method: 'POST', headers, body: JSON.stringify({ fieldName: 'Product', slug: slug, type: 'text' }) });
          dbg.fieldCreate = mkf.status;
          if (mkf.ok) have = true;
          else { try { dbg.fieldCreateError = (await mkf.text()).slice(0, 250); } catch (x) {} }
        }
        if (!have) slug = 'company_name';        // fallback: a standard field every account has
        dbg.fieldUsed = slug;
        const pt = await fetch(API + '/contacts/' + contactId, {
          method: 'PATCH',
          headers: Object.assign({}, headers, { 'Content-Type': 'application/merge-patch+json' }),
          body: JSON.stringify({ fields: [{ slug: slug, value: productName }] })
        });
        dbg.fieldSet = pt.status;
        if (!pt.ok) { try { dbg.fieldSetError = (await pt.text()).slice(0, 250); } catch (x) {} }
      } catch (e) { dbg.fieldException = String(e && e.message || e).slice(0, 150); }
    }

    // 3) tag it when the tag exists (never required: some plans only allow a few tags)
    //    tag = "<product> Bonus" (e.g. "BookSeries AI Bonus"); falls back to TAG_NAME
    const tagName = (productName ? productName + ' Bonus' : (env.TAG_NAME || 'Bonus Lead')).trim();
    if (tagName) {
      try {
        let tagId = null;
        const list = await fetch(API + '/tags?limit=100', { headers });
        dbg.tagList = list.status;
        if (list.ok) {
          const d = await list.json();
          dbg.tagsInAccount = (d.items || []).map(function (t) { return t.name; });
          const hit = (d.items || []).find(function (t) { return t.name === tagName; });
          if (hit) tagId = hit.id;
        }
        dbg.tagFound = !!tagId;
        if (!tagId) {
          const mk = await fetch(API + '/tags', { method: 'POST', headers, body: JSON.stringify({ name: tagName }) });
          dbg.tagCreate = mk.status;
          if (mk.ok) { const t = await mk.json(); tagId = t && t.id; }
        }
        dbg.tag = tagName;
        if (tagId) {
          const tr = await fetch(API + '/contacts/' + contactId + '/tags', { method: 'POST', headers, body: JSON.stringify({ tagId }) });
          dbg.tagStatus = tr.status;
        }
      } catch (e) { dbg.tagException = String(e && e.message || e).slice(0, 150); }
    }
  } catch (e) { dbg.exception = String(e && e.message || e).slice(0, 200); }
  return { contactId, dbg };
}

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
