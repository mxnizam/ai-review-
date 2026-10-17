#!/usr/bin/env python3
"""Static checks for the AiReview site. Run from anywhere:  python tools/check-site.py

Checks every page for: missing local files (links, images, CSS, JS), broken #anchors,
title / description / canonical / og tags, one h1, images without alt text, affiliate
links missing rel="sponsored", published products without a page, and sitemap entries.
Exits with code 1 if anything is wrong.
"""
import json, os, re, sys
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = "https://aireveiw.com"
SKIP = {"templates", "_internal", "tools", "node_modules", ".git"}
errors = []


def err(page, msg):
    errors.append("%s: %s" % (page, msg))


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids, self.meta, self.h1, self.imgs = [], set(), {}, 0, []
        self.title, self._in_title, self.canonical, self.affiliates = "", False, None, []

    def handle_starttag(self, tag, a):
        a = dict(a)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "title":
            self._in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "link" and a.get("href"):
            self.refs.append(a["href"])
        if tag in ("script", "img", "iframe") and a.get("src"):
            self.refs.append(a["src"])
        if tag == "img":
            self.imgs.append(a)
        if tag == "a" and a.get("href"):
            self.refs.append(a["href"])
            if "jvz" in a["href"] or "rel" in a and "sponsored" in a.get("rel", ""):
                self.affiliates.append(a)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def url_to_file(url):
    path = unquote(urlparse(url).path)
    full = os.path.join(ROOT, path.lstrip("/"))
    if path.endswith("/"):
        full = os.path.join(full, "index.html")
    return full


def page_url(path):
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    return "/" + (rel[:-len("index.html")] if rel.endswith("index.html") else rel)


pages = {}
for folder, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for f in files:
        if f.endswith(".html"):
            p = os.path.join(folder, f)
            with open(p, encoding="utf-8") as fh:
                parser = Page()
                parser.feed(fh.read())
            pages[p] = parser

titles, descs = {}, {}
for path, pg in pages.items():
    name = page_url(path)
    noindex = "noindex" in pg.meta.get("robots", "")
    if not pg.title.strip():
        err(name, "missing <title>")
    if not pg.meta.get("description"):
        err(name, "missing meta description")
    if pg.h1 != 1:
        err(name, "expected exactly one h1, found %d" % pg.h1)
    if not noindex:
        if pg.canonical != DOMAIN + name:
            err(name, "canonical is %r, expected %r" % (pg.canonical, DOMAIN + name))
        for k in ("og:title", "og:description", "og:image", "og:url", "twitter:card"):
            if not pg.meta.get(k):
                err(name, "missing " + k)
        titles.setdefault(pg.title, []).append(name)
        descs.setdefault(pg.meta.get("description"), []).append(name)
    for img in pg.imgs:
        if "alt" not in img:
            err(name, "image without alt: %s" % img.get("src"))
        if not img.get("width") or not img.get("height"):
            err(name, "image without width/height: %s" % img.get("src"))
    for a in pg.affiliates:
        if "sponsored" not in a.get("rel", ""):
            err(name, "affiliate link without rel=sponsored: %s" % a["href"])
    for ref in pg.refs:
        if ref.startswith(("mailto:", "data:", "javascript:")):
            continue
        u = urlparse(ref)
        if u.scheme in ("http", "https"):
            if u.netloc == "aireveiw.com":
                ref = u.path
                u = urlparse(ref)
            else:
                continue
        if ref.startswith("#"):
            if ref[1:] and ref[1:] not in pg.ids:
                err(name, "broken anchor " + ref)
            continue
        if not ref.startswith("/"):
            err(name, "relative reference (use root-relative paths): " + ref)
            continue
        target = url_to_file(ref)
        if not os.path.isfile(target):
            err(name, "missing file for %s" % ref)
        elif u.fragment and target.endswith(".html"):
            tp = pages.get(target)
            if tp and u.fragment not in tp.ids:
                err(name, "broken anchor %s in %s" % (u.fragment, u.path))

for label, d in (("title", titles), ("description", descs)):
    for text, where in d.items():
        if len(where) > 1:
            err(", ".join(where), "duplicate " + label)

# product registry
with open(os.path.join(ROOT, "data", "products.json"), encoding="utf-8") as fh:
    products = json.load(fh)
sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
for p in products:
    if p.get("status") != "published":
        if p.get("slug") and DOMAIN + "/%s/" % p["slug"] in sitemap:
            err("sitemap.xml", "lists unpublished product " + p["slug"])
        continue
    for k in ("name", "slug", "category", "shortDescription", "image", "pageUrl", "affiliateUrl"):
        if not p.get(k):
            err("products.json", "%s is missing %s" % (p.get("id"), k))
    if not os.path.isfile(url_to_file(p["pageUrl"])):
        err("products.json", "%s has no page at %s" % (p["id"], p["pageUrl"]))
    if not os.path.isfile(url_to_file(p["image"])):
        err("products.json", "%s image missing: %s" % (p["id"], p["image"]))
    if DOMAIN + p["pageUrl"] not in sitemap:
        err("sitemap.xml", "missing " + p["pageUrl"])

for loc in re.findall(r"<loc>(.*?)</loc>", sitemap):
    if not loc.startswith(DOMAIN) or not os.path.isfile(url_to_file(loc[len(DOMAIN):])):
        err("sitemap.xml", "entry has no page: " + loc)

print("%d pages checked" % len(pages))
if errors:
    print("\n".join(errors))
    print("%d problem(s)" % len(errors))
    sys.exit(1)
print("all checks passed")
