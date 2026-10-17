SYSTEME.IO LEAD CONNECTOR
=========================
Why this exists: systeme.io only accepts leads through its own forms or its
Public API. The API needs a secret key, which must never sit inside website
code (anyone could copy it). This tiny Cloudflare Worker holds the key and
adds each lead to systeme.io for you.

Setup (about 10 minutes)
------------------------
1. systeme.io: click your profile picture > Settings > Public API keys >
   Create. Copy the token right away (it is shown only once).
2. Cloudflare (free account): Workers & Pages > Create > "Hello World" Worker >
   Deploy > Edit code > delete everything > paste the contents of worker.js >
   Deploy.
3. In the Worker: Settings > Variables and Secrets > add
      SYSTEME_API_KEY   (type: Secret)  = the token from step 1
      TAG_NAME          (optional)      = Bonus Lead   (fallback tag)
      ALLOWED_PRODUCTS  (optional)      = AiBizEngine,AIProspectGenie
      ALLOWED_ORIGIN    (optional)      = https://aireveiw.com
4. Copy the Worker URL (https://something.workers.dev) and paste it between the
   quotes in assets/js/bonus-popup.js:   var LEAD_ENDPOINT = "";
   (One file serves every product page.)
5. Re-deploy the site. Test it with your own email: the contact should appear in
   systeme.io > Contacts with the tag you set.
6. Optional: systeme.io > Automations > new rule "Tag added: AIProspectGenie Bonus"
   > action of your choice (for example add to a campaign). Do NOT auto-send the
   bonus files if you want to send them only after a purchase is confirmed.

One Worker serves several landing pages: each lead is tagged "<product> Bonus"
(for example "AIProspectGenie Bonus" or "AiBizEngine Bonus") so you can run a
separate automation per product. The product name comes from data-product on the
#bonus-modal element of each page.

What gets sent: first name, email, product, which offer was clicked, consent = yes.
Visitors who choose "Continue Without Bonuses" send nothing.

Note: written against systeme.io's public API (contacts and tags endpoints) but
not run against a live account, so do the test in step 5 before running ads.
