#!/usr/bin/env python3
"""Copies the shared header and footer into every page, so they stay identical.

Each page marks where they go:
    <!-- layout:header:start --> ... <!-- layout:header:end -->
    <!-- layout:footer:start --> ... <!-- layout:footer:end -->
Edit templates/partials/header.html or footer.html, then run:
    python tools/sync-layout.py
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"templates", "_internal", "node_modules", ".git"}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def pages():
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for name in files:
            if name.endswith(".html"):
                yield os.path.join(folder, name)


def url_of(path):
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    if rel.endswith("index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def main():
    header = read(os.path.join(ROOT, "templates", "partials", "header.html")).strip()
    footer = read(os.path.join(ROOT, "templates", "partials", "footer.html")).strip()
    changed = 0
    for path in pages():
        html = read(path)
        if "layout:header:start" not in html:
            continue
        own = url_of(path)
        # mark the current page's nav link
        page_header = header
        target = own if own in ("/", "/products/", "/about/", "/contact/") else None
        if target:
            page_header = page_header.replace(
                '<li><a href="%s">' % target, '<li><a href="%s" aria-current="page">' % target, 1)
        new = re.sub(r"<!-- layout:header:start -->.*?<!-- layout:header:end -->",
                     lambda m: "<!-- layout:header:start -->\n" + page_header + "\n<!-- layout:header:end -->", html, flags=re.S)
        new = re.sub(r"<!-- layout:footer:start -->.*?<!-- layout:footer:end -->",
                     lambda m: "<!-- layout:footer:start -->\n" + footer + "\n<!-- layout:footer:end -->", new, flags=re.S)
        if new != html:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(new)
            changed += 1
            print("updated", os.path.relpath(path, ROOT))
    print("done,", changed, "page(s) changed")


if __name__ == "__main__":
    sys.exit(main())
