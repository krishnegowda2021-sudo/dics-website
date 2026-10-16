/* DICS site behaviour: mobile menu, active nav, catalogue search, enquiry forms */
(function () {
  "use strict";

  // Mobile menu
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // Active nav link
  var path = location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll("[data-nav]").forEach(function (a) {
    var h = a.getAttribute("data-nav");
    if (h === path || (h !== "/" && path.indexOf(h) === 0)) a.setAttribute("aria-current", "page");
  });

  // Catalogue
  var grid = document.getElementById("catalogue-grid");
  if (grid) {
    var form = document.getElementById("catalogue-filters");
    var pager = document.getElementById("pager");
    var countEl = document.getElementById("result-count");
    var headCount = document.getElementById("count-head");
    var PAGE = 24, all = [], cats = {}, page = 1;

    var esc = function (s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };
    var params = new URLSearchParams(location.search);

    Promise.all([fetch("/data/products.json").then(function (r) { return r.json(); }), fetch("/data/categories.json").then(function (r) { return r.json(); })])
      .then(function (res) {
        all = res[0];
        res[1].forEach(function (c) { cats[c.slug] = c.name; });
        var brands = Array.from(new Set(all.map(function (p) { return p.brand; }))).sort();
        var sel = form.elements.brand;
        brands.forEach(function (b) { var o = document.createElement("option"); o.value = b; o.textContent = b; sel.appendChild(o); });
        form.elements.q.value = params.get("q") || "";
        form.elements.category.value = params.get("category") || "";
        form.elements.brand.value = params.get("brand") || "";
        page = parseInt(params.get("page") || "1", 10) || 1;
        if (headCount) headCount.textContent = all.length;
        render();
      })
      .catch(function () { grid.innerHTML = "<p>The catalogue could not be loaded. Please try again.</p>"; });

    form.addEventListener("submit", function (e) { e.preventDefault(); page = 1; render(true); });
    ["category", "brand"].forEach(function (n) { form.elements[n].addEventListener("change", function () { page = 1; render(true); }); });

    function card(p) {
      return '<article class="card product"><a class="thumb" href="/product/' + esc(p.slug) + '"><img loading="lazy" src="' + esc(p.image) + '" alt="' + esc(p.brand + " " + p.name) + '"></a>' +
        '<p class="brand-tag">' + esc(p.brand) + '</p><h3><a href="/product/' + esc(p.slug) + '">' + esc(p.name) + '</a></h3><p class="muted">' + esc(p.group) + "</p>" +
        '<div class="card-actions"><a class="btn btn-sm" href="/product/' + esc(p.slug) + '">View details</a><a class="btn btn-sm btn-outline" href="/request-a-quote?product=' + esc(p.slug) + '">Request a quote</a></div></article>';
    }

    function render(push) {
      var q = form.elements.q.value.trim().toLowerCase(), c = form.elements.category.value, b = form.elements.brand.value;
      var list = all.filter(function (p) {
        return (!c || p.category === c) && (!b || p.brand === b) &&
          (!q || (p.name + " " + p.brand + " " + p.group + " " + (cats[p.category] || "")).toLowerCase().indexOf(q) !== -1);
      });
      var pages = Math.max(1, Math.ceil(list.length / PAGE));
      if (page > pages) page = pages;
      var slice = list.slice((page - 1) * PAGE, page * PAGE);
      grid.innerHTML = slice.length ? slice.map(card).join("") : "<p>No products match your search. Try a different model or <a href=\"/request-a-quote\">request a quote</a>.</p>";
      countEl.textContent = list.length + " products";
      if (push) {
        var u = new URLSearchParams();
        if (q) u.set("q", form.elements.q.value.trim());
        if (c) u.set("category", c);
        if (b) u.set("brand", b);
        if (page > 1) u.set("page", page);
        history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : ""));
      }
      pager.innerHTML = "";
      if (pages > 1) {
        var mk = function (label, target, opts) {
          var btn = document.createElement("button");
          btn.type = "button"; btn.textContent = label;
          if (opts && opts.disabled) btn.disabled = true;
          if (opts && opts.current) btn.setAttribute("aria-current", "page");
          btn.addEventListener("click", function () { page = target; render(true); window.scrollTo({ top: 0, behavior: "smooth" }); });
          pager.appendChild(btn);
        };
        mk("Previous", page - 1, { disabled: page === 1 });
        var start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
        for (var i = start; i <= end; i++) mk(String(i), i, { current: i === page });
        mk("Next", page + 1, { disabled: page === pages });
      }
    }
  }

  // Enquiry forms
  var qp = new URLSearchParams(location.search).get("product");
  document.querySelectorAll("form[data-enquiry]").forEach(function (f) {
    if (qp && f.elements.product) f.elements.product.value = qp;
    var status = f.querySelector(".form-status");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = null;
      Array.prototype.forEach.call(f.querySelectorAll("[required]"), function (el) {
        var ok = el.type === "checkbox" ? el.checked : el.value.trim() !== "";
        if (ok && el.type === "email") ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim());
        el.setAttribute("aria-invalid", ok ? "false" : "true");
        if (!ok && !bad) bad = el;
      });
      if (bad) { status.className = "form-status err"; status.textContent = "Please complete the highlighted fields."; bad.focus(); return; }
      var data = {};
      new FormData(f).forEach(function (v, k) { data[k] = typeof v === "string" ? v.trim() : v; });
      data.source = f.getAttribute("data-source") || "";
      data.page = location.pathname;
      var btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; status.className = "form-status"; status.textContent = "Sending…";
      fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j && res.j.error || "failed");
          f.reset(); status.className = "form-status ok";
          status.textContent = "Thank you — your enquiry has been sent. Our team will respond shortly.";
        })
        .catch(function () {
          status.className = "form-status err";
          status.textContent = "Sorry, we could not send your enquiry. Please email us or call our head office.";
        })
        .then(function () { btn.disabled = false; });
    });
  });
})();
