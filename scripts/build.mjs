// Static site generator for the DICS website. No dependencies: `node scripts/build.mjs`
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const site = JSON.parse(readFileSync(join(root, "data/site.json"), "utf8"));
const products = JSON.parse(readFileSync(join(root, "data/products.json"), "utf8"));
const ORIGIN = process.env.SITE_ORIGIN || ""; // e.g. https://www.dicsglobal.com (used for canonical/OG URLs)

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const catBySlug = Object.fromEntries(site.categories.map((c) => [c.slug, c]));
const flatCats = [];
for (const c of site.categories) {
  flatCats.push({ ...c, path: c.slug });
  for (const ch of c.children || []) flatCats.push({ ...ch, path: `${c.slug}/${ch.slug}`, parent: c });
}
const catByPath = Object.fromEntries(flatCats.map((c) => [c.path, c]));

const pages = []; // { url, html }
const addPage = (url, html) => pages.push({ url, html });

/* ---------- shared pieces ---------- */
const socialLinks = () =>
  site.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`).join("");

function header() {
  const nav = [
    ["/", "Home"],
    ["/products", "Products"],
    ["/services", "Services"],
    ["/industries", "Industries"],
    ["/about-us", "About Us"],
    ["/careers", "Careers"],
    ["/contact-us", "Contact"],
  ];
  return `<a class="skip" href="#main">Skip to content</a>
<div class="topbar"><div class="wrap topbar-in"><p>${esc(site.tagline)}</p><nav class="social" aria-label="Social media">${socialLinks()}</nav></div></div>
<header class="site-header"><div class="wrap head-in">
  <a class="logo" href="/" aria-label="${esc(site.name)} — home"><img src="/assets/dics-logo.svg" alt="${esc(site.short)} — ${esc(site.name)}" width="180" height="48"></a>
  <ul class="head-contact">
    <li><span>Call our head office</span><a href="tel:${site.phones[0].tel}">${esc(site.phones[0].label)}</a></li>
    <li><span>Email</span><a href="mailto:${site.email}">${esc(site.email)}</a></li>
    <li><span>Head office</span><b>Peenya Industrial Estate, Bangalore</b></li>
  </ul>
  <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav">Menu</button>
</div>
<nav id="primary-nav" class="primary-nav" aria-label="Primary"><div class="wrap"><ul>
  ${nav.map(([h, l]) => `<li><a href="${h}" data-nav="${h}">${l}</a></li>`).join("")}
  <li class="cta"><a class="btn btn-accent" href="/request-a-quote">Request a Quote</a></li>
</ul></div></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="wrap foot-grid">
  <div><img class="foot-logo" src="/assets/dics-logo.svg" alt="${esc(site.short)}" width="160" height="42">
    <p>${esc(site.name)} has supplied industrial automation products and engineering services from Bangalore since ${site.founded}, with offices across India.</p>
    <ul class="plain"><li><a href="${esc(site.mapsLink)}" target="_blank" rel="noopener noreferrer">${esc(site.address)}</a></li>
    <li>${site.phones.map((p) => `<a href="tel:${p.tel}">${esc(p.label)}</a>`).join(", ")}</li>
    <li><a href="mailto:${site.email}">${esc(site.email)}</a></li></ul></div>
  <div><h2>Products</h2><ul class="plain">${site.categories.map((c) => `<li><a href="/product-category/${c.slug}">${esc(c.name)}</a></li>`).join("")}</ul></div>
  <div><h2>Services</h2><ul class="plain">${site.services.map((s) => `<li><a href="/services/${s.slug}">${esc(s.name)}</a></li>`).join("")}</ul></div>
  <div><h2>Brands</h2><ul class="plain">${site.brands.map((b) => `<li><a href="/our-brands/${b.slug}">${esc(b.name)}</a></li>`).join("")}</ul>
    <h2 class="mt">Company</h2><ul class="plain"><li><a href="/about-us">About Us</a></li><li><a href="/careers">Careers</a></li><li><a href="/industries">Industries</a></li><li><a href="/contact-us">Contact &amp; Offices</a></li><li><a href="/request-a-quote">Request a Quote</a></li></ul></div>
</div>
<div class="foot-bar"><div class="wrap foot-bar-in"><p>© ${new Date().getFullYear()} ${esc(site.name)}. All rights reserved.</p>
<nav class="social" aria-label="Social media">${socialLinks()}<a href="/privacy-policy">Privacy Policy</a></nav></div></div></footer>`;
}

function layout({ title, description, url, body, crumbs, ogImage }) {
  const canon = ORIGIN ? `<link rel="canonical" href="${ORIGIN}${url}">` : "";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    alternateName: site.short,
    foundingDate: String(site.founded),
    email: site.email,
    telephone: site.phones[0].tel,
    address: { "@type": "PostalAddress", streetAddress: "B-261, 6th Main, 2nd Stage, Peenya Industrial Estate", addressLocality: "Bangalore", addressRegion: "Karnataka", postalCode: "560058", addressCountry: "IN" },
    sameAs: site.social.map((s) => s.url),
  };
  const crumbHtml = crumbs
    ? `<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap"><ol>${crumbs
        .map(([h, l]) => (h ? `<li><a href="${h}">${esc(l)}</a></li>` : `<li aria-current="page">${esc(l)}</li>`))
        .join("")}</ol></div></nav>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="DICS Global">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
${canon}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body>
${header()}
${crumbHtml}
<main id="main">${body}</main>
${footer()}
<script src="/app.js" defer></script>
</body></html>`;
}

const ctaBand = `<section class="cta-band"><div class="wrap cta-in"><div><p class="eyebrow light">Talk to an engineer</p><h2>Planning an automation upgrade or need a specific part?</h2>
<p>Share your application, model numbers or drawings and our team will respond with product information or a quotation.</p></div>
<div class="cta-btns"><a class="btn btn-accent" href="/request-a-quote">Request a quote</a><a class="btn btn-ghost" href="/contact-us">Contact our offices</a></div></div></section>`;

const productCard = (p) => `<article class="card product">
  <a class="thumb" href="/product/${p.slug}"><img loading="lazy" src="${esc(p.image)}" alt="${esc(p.brand + " " + p.name)}"></a>
  <p class="brand-tag">${esc(p.brand)}</p><h3><a href="/product/${p.slug}">${esc(p.name)}</a></h3><p class="muted">${esc(p.group)}</p>
  <div class="card-actions"><a class="btn btn-sm" href="/product/${p.slug}">View details</a><a class="btn btn-sm btn-outline" href="/request-a-quote?product=${p.slug}">Request a quote</a></div></article>`;

function enquiryForm({ id, detailsLabel, button, source }) {
  return `<form class="form" data-enquiry data-source="${esc(source)}" id="${id}" novalidate>
  <div class="grid-2">
    <label>Full name *<input name="name" required autocomplete="name"></label>
    <label>Company<input name="company" autocomplete="organization"></label>
    <label>Business email *<input name="email" type="email" required autocomplete="email"></label>
    <label>Phone *<input name="phone" type="tel" required autocomplete="tel"></label>
  </div>
  <label>Product / service requirement<select name="requirement"><option value="">Select your requirement</option>${site.requirements.map((r) => `<option>${esc(r)}</option>`).join("")}</select></label>
  <label>${esc(detailsLabel)} *<textarea name="details" rows="5" required></textarea></label>
  <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
  <input type="hidden" name="product" value="">
  <button class="btn btn-accent" type="submit">${esc(button)}</button>
  <p class="form-note">We use your details only to respond to this enquiry.</p>
  <p class="form-status" role="status" aria-live="polite"></p>
</form>`;
}

/* ---------- pages ---------- */
// Home
{
  const featured = products.filter((p) => p.featured);
  const body = `
<section class="hero" style="--hero:url('/assets/hero-plant.jpg')"><div class="wrap hero-in">
  <div><p class="eyebrow light">${esc(site.name)} · Since ${site.founded}</p>
  <h1>Intelligent Automation.<br>Reliable Industrial Performance.</h1>
  <p class="lead">Discover industrial automation products, control technologies and engineering services that help manufacturers connect processes, improve operational visibility and build dependable production systems.</p>
  <div class="btn-row"><a class="btn btn-accent" href="/products">Explore Our Products</a><a class="btn btn-ghost" href="/contact-us">Discuss Your Application</a></div></div>
</div></section>
<section class="stats"><div class="wrap stats-in">${site.stats.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div></section>

<section class="section"><div class="wrap split">
  <div class="media" style="--img:url('/assets/control-panel.jpg')" role="img" aria-label="Engineer commissioning a PLC control panel with a laptop"></div>
  <div><p class="eyebrow">About DICS</p><h2>An industrial automation partner built on three decades of field experience</h2>
  <p>Founded in ${site.founded} in Bangalore, Digital Instruments &amp; Control Systems (DICS) was established to meet growing demand for robust automation and control solutions in manufacturing and process industries. The company initially represented Toshiba in India before associating with OMRON, Fuji Electric, Pro-face, Autonics, CKD, IDEC, Wöhner and PATLITE.</p>
  <p>Our head office operates from a 20,000 sq ft facility in Peenya, Bangalore, with manufacturing and testing capability. Alongside product supply, our engineers support PLC, HMI, SCADA, motion control and instrumentation projects — from retrofits to greenfield installations.</p>
  <a class="btn" href="/about-us">More about DICS</a></div>
</div></section>

<section class="section alt"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Product portfolio</p><h2>Product categories</h2><p class="muted">Automation, drives, sensing, power and signalling products from established manufacturers.</p></div><a class="btn btn-outline" href="/products">View full catalogue</a></div>
<div class="grid-3">${site.categories.map((c) => `<a class="card cat" href="/product-category/${c.slug}"><h3>${esc(c.name)}</h3><p>${esc(c.blurb.length > 150 ? c.blurb.slice(0, 147).trimEnd() + "…" : c.blurb)}</p><span class="more">Explore range →</span></a>`).join("")}</div></div></section>

<section class="section"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Automation solutions</p><h2>Engineering capabilities for connected, dependable production</h2><p class="muted">Each capability is delivered by DICS engineers and supported by products we supply — so specification, programming and commissioning stay in one place.</p></div></div>
<div class="grid-3">${site.services.slice(0, 6).map((s) => `<a class="card svc" href="/services/${s.slug}"><h3>${esc(s.card)}</h3><p>${esc(s.cardText)}</p><span class="more">Learn more →</span></a>`).join("")}</div></div></section>

<section class="section alt"><div class="wrap"><p class="eyebrow">Technology brands</p><h2>Associated with leading automation manufacturers</h2>
<ul class="brand-row">${site.brands.map((b) => `<li><a href="/our-brands/${b.slug}"><b>${esc(b.name)}</b><span>${esc(b.country)}</span></a></li>`).join("")}</ul></div></section>

<section class="section"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Industries served</p><h2>Sectors that rely on DICS</h2></div><a class="btn btn-outline" href="/industries">All industries</a></div>
<div class="grid-4">${site.industries.slice(0, 4).map((i) => `<a class="card ind" href="/industries#${i.id}"><div class="ind-img" style="--img:url('/assets/${i.img}')"></div><h3>${esc(i.name)}</h3><p>${esc(i.text)}</p></a>`).join("")}</div></div></section>

<section class="section alt"><div class="wrap split">
  <div><p class="eyebrow">Engineering &amp; service</p><h2>From specification to lifecycle support</h2>
  <p>DICS provides end-to-end project execution — electrical design, panel fabrication, software development, field commissioning and lifecycle support — backed by testing stations at our Bangalore facility for investigating product-related issues.</p>
  <a class="btn" href="/services">Explore services</a></div>
  <ol class="svc-list">${site.services.map((s, i) => `<li><a href="/services/${s.slug}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span><b>${esc(s.name)}</b><br>${esc(s.short)}</span></a></li>`).join("")}</ol>
</div></section>

<section class="section"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">From the catalogue</p><h2>Featured products</h2><p class="muted">A selection of products listed in the DICS catalogue. Request a quote for pricing and availability.</p></div><a class="btn btn-outline" href="/products">Search all products</a></div>
<div class="grid-4">${featured.map(productCard).join("")}</div></div></section>

<section class="section alt"><div class="wrap"><p class="eyebrow">Why DICS</p><h2>What customers can expect from us</h2>
<div class="grid-4">${site.why.map((w) => `<div class="card why"><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join("")}</div>
<p><a class="btn btn-outline" href="/about-us">Read our story</a></p></div></section>
${ctaBand}`;
  addPage("/", layout({ title: "DICS — Industrial Automation Products & Engineering Services, Bangalore", description: "Digital Instruments & Control Systems (DICS), est. 1996: PLCs, HMIs, AC drives, servo systems, sensors, instrumentation and automation engineering services across India.", url: "/", body }));
}

// About
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">About us</p><h1>About Digital Instruments &amp; Control Systems</h1><p class="lead">For three decades DICS has offered information-driven, high-end products and innovative automation solutions to Indian industry.</p></div></section>
<section class="section"><div class="wrap split"><div><p class="eyebrow">Our story</p><h2>Engineering-led since ${site.founded}</h2>
<p>Since its establishment in ${site.founded}, DICS has advanced through innovation-driven strategies and a strong commitment to customer satisfaction. Our ability to offer complete, end-to-end automation solutions has helped the company grow into a multidimensional organisation.</p>
<p>Our head office is based in a 20,000 sq ft independently owned, state-of-the-art manufacturing and test facility in Bangalore. Well-equipped testing stations supported by technology-driven test equipment help us go deep into product-related issues and come out with working solutions.</p>
<p>Our product service support team works to ensure customers stay connected with us long after commissioning.</p></div>
<div class="media" style="--img:url('/assets/control-panel.jpg')" role="img" aria-label="Engineer working on an automation control panel"></div></div></section>
<section class="section alt"><div class="wrap"><p class="eyebrow">Milestones</p><h2>How DICS grew</h2><ol class="timeline">
<li><span class="when">1996</span><h3>Founded in Bangalore</h3><p>DICS is established with its head office in Bangalore. In the same year the company joins hands with Toshiba and opens its Chennai office.</p></li>
<li><span class="when">Growth</span><h3>Global automation brands</h3><p>DICS associates with OMRON Automation, Fuji Electric, Pro-face, Autonics, CKD, IDEC, Wöhner and PATLITE.</p></li>
<li><span class="when">Expansion</span><h3>Pan-India presence</h3><p>Offices across major cities including Chennai, Mumbai, Hyderabad, Coimbatore, Pune, Noida, Lucknow and Vizag, with presence in Hubli, Mysore and Pondicherry.</p></li>
<li><span class="when">Today</span><h3>Bangalore facility</h3><p>Head office in a 20,000 sq ft independently owned manufacturing and test facility in Bangalore.</p></li></ol></div></section>
<section class="section"><div class="wrap grid-3">
<div class="card"><h2 class="h3">Our mission</h2><p>To build lasting partnerships by understanding each client's challenges and operational goals, and delivering exceptional service backed by high-quality, technologically advanced automation solutions.</p></div>
<div class="card"><h2 class="h3">Our vision</h2><p>To set the benchmark in the design, development and implementation of industrial automation systems, delivering innovative, energy-efficient solutions.</p></div>
<div class="card"><h2 class="h3">Our values</h2><p>Integrity, responsibility, excellence, pioneering spirit and unity — fair and transparent conduct, high standards and collaborative relationships built on trust.</p></div></div></section>
<section class="section alt"><div class="wrap grid-2"><div><h2 class="h3">Brands we work with</h2><p>${site.brands.map((b) => esc(b.name)).join(" · ")}</p></div>
<div><h2 class="h3">Sectors we serve</h2><p>${site.industries.map((i) => esc(i.name)).join(" · ")}</p></div></div></section>
${ctaBand}`;
  addPage("/about-us", layout({ title: "About DICS — Since 1996", description: "Founded in 1996 in Bangalore, Digital Instruments & Control Systems supplies automation products and engineering services with a pan-India presence.", url: "/about-us", body, crumbs: [["/", "Home"], [null, "About Us"]] }));
}

// Contact
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Get in touch</p><h1>Contact us</h1><p class="lead">Discuss your automation requirement, request product information or ask for service support.</p></div></section>
<section class="section"><div class="wrap split top">
<div><h2>Send us an enquiry</h2><p class="muted">Fields marked * are required.</p>${enquiryForm({ id: "contact-form", detailsLabel: "Project details", button: "Send enquiry", source: "contact" })}</div>
<div><h2>Head office — Bangalore</h2><ul class="plain big"><li><a href="${esc(site.mapsLink)}" target="_blank" rel="noopener noreferrer">${esc(site.address)}</a></li><li>${site.phones.map((p) => `<a href="tel:${p.tel}">${esc(p.label)}</a>`).join(", ")}</li><li><a href="mailto:${site.email}">${esc(site.email)}</a></li></ul>
<iframe class="map" title="Map of the DICS head office, Peenya, Bangalore" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(site.mapsEmbed)}"></iframe></div></div></section>
<section class="section alt"><div class="wrap"><h2>Regional offices</h2><div class="grid-3">${site.offices
    .map((o) => `<article class="card office"><h3>${esc(o.city)}</h3>${o.note ? `<p class="tag">${esc(o.note)}</p>` : ""}<p>${esc(o.address)}</p><p><a href="tel:${o.tel}">${esc(o.phone)}</a><br><a href="mailto:${o.email}">${esc(o.email)}</a></p></article>`)
    .join("")}</div></div></section>`;
  addPage("/contact-us", layout({ title: "Contact DICS — Offices Across India", description: "Contact Digital Instruments & Control Systems. Head office in Peenya, Bangalore, with offices in Chennai, Coimbatore, Lucknow, Belagavi, Mysore, Hyderabad, Mumbai, Pune and more.", url: "/contact-us", body, crumbs: [["/", "Home"], [null, "Contact Us"]] }));
}

// Request a quote
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Enquiry</p><h1>Request a quote</h1><p class="lead">Tell us what you need — model numbers, quantities, application or drawings. Our team will respond with pricing and availability.</p></div></section>
<section class="section"><div class="wrap split top"><div>${enquiryForm({ id: "quote-form", detailsLabel: "Quantity, application and details", button: "Request a quote", source: "quote" })}</div>
<aside class="card"><h2 class="h3">Prefer to call?</h2><p>Bangalore head office: ${site.phones.map((p) => `<a href="tel:${p.tel}">${esc(p.label)}</a>`).join(", ")}</p><p>Email: <a href="mailto:${site.email}">${esc(site.email)}</a></p><p>Regional office contacts are on the <a href="/contact-us">contact page</a>.</p></aside></div></section>`;
  addPage("/request-a-quote", layout({ title: "Request a Quote | DICS", description: "Request a quotation for industrial automation products or engineering services from DICS. Share model numbers, quantities and application details.", url: "/request-a-quote", body, crumbs: [["/", "Home"], [null, "Request a Quote"]] }));
}

// Industries
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Sectors</p><h1>Industries served</h1><p class="lead">Prominent sectors DICS continues to serve include automobile, food &amp; pharma, material handling, printing &amp; packaging, hoist &amp; crane, power, solar, textile, steel, semiconductor and elevator.</p></div></section>
<section class="section"><div class="wrap grid-3">${site.industries
    .map((i) => `<article class="card ind" id="${i.id}">${i.img ? `<div class="ind-img" style="--img:url('/assets/${i.img}')" role="img" aria-label="${esc(i.name)} production environment"></div>` : ""}<h2 class="h3">${esc(i.name)}</h2><p>${esc(i.text)}</p></article>`)
    .join("")}</div></section>${ctaBand}`;
  addPage("/industries", layout({ title: "Industries Served | DICS", description: "DICS serves automobile, food & pharma, material handling, printing & packaging, hoist & crane, power, solar, textile, steel, semiconductor and elevator sectors.", url: "/industries", body, crumbs: [["/", "Home"], [null, "Industries"]] }));
}

// Careers
{
  const body = `<section class="hero small" style="--hero:url('/assets/control-panel.jpg')"><div class="wrap hero-in"><div><p class="eyebrow light">Careers · ${esc(site.name)}</p><h1>Build Your Future with DICS</h1><p class="lead">Be part of a team working with industrial automation, control systems and engineering technologies that power modern industries.</p><a class="btn btn-accent" href="#openings">View openings</a></div></div></section>
<section class="section"><div class="wrap"><p class="eyebrow">Why work with us</p><h2>Practical engineering. Shared expertise.</h2><p class="muted">Contribute to industrial automation projects, collaborate on engineering challenges and build your knowledge of control technologies.</p>
<div class="grid-3"><div class="card"><h3>Learn through real applications</h3><p>Explore how controllers, sensors and software work together in industrial systems.</p></div><div class="card"><h3>Collaborate on solutions</h3><p>Bring your technical perspective to programming, application design and troubleshooting.</p></div><div class="card"><h3>Contribute to industry</h3><p>Apply your skills to the engineering and support needs of machines and production processes.</p></div></div></div></section>
<section class="section alt"><div class="wrap split"><div><p class="eyebrow">Our work</p><h2>Connected controls. Real-world applications.</h2><p>DICS works across PLC programming, HMI and SCADA applications, industrial controls, instrumentation and system integration. Engineering work includes application development, commissioning and technical troubleshooting.</p></div>
<ul class="chips"><li>PLC programming</li><li>HMI &amp; SCADA</li><li>Industrial controls</li><li>Instrumentation</li><li>Motion &amp; drives</li><li>Automation engineering</li></ul></div></section>
<section class="section" id="openings"><div class="wrap"><p class="eyebrow">Current openings</p><h2>Find your next engineering role</h2>
<article class="card job"><p class="tag">Industrial Automation</p><h3>PLC Programmer / Application Engineer / Technical Support Engineer</h3><p>Engineering roles focused on industrial automation programming, application engineering and technical support.</p>
<dl><div><dt>Experience</dt><dd>1–5 years</dd></div><div><dt>Job locations</dt><dd>Bangalore, Coimbatore, Chennai, Mumbai, Hyderabad, Pune and Noida</dd></div><div><dt>Education</dt><dd>Diploma or B.E. in Electrical &amp; Electronics, Electronics &amp; Communication, or a related field.</dd></div><div><dt>Employment type</dt><dd>Please enquire with our team</dd></div></dl>
<a class="btn" href="#apply">Apply Now</a></article></div></section>
<section class="section alt"><div class="wrap"><p class="eyebrow">How to apply</p><h2>Share your experience with us</h2><ol class="steps">
<li><span class="num">01</span><h3>Choose your role</h3><p>Review the role, locations and qualifications, or express interest in future opportunities.</p></li>
<li><span class="num">02</span><h3>Submit your details</h3><p>Include your contact details, years of experience and relevant technical skills.</p></li>
<li><span class="num">03</span><h3>Email your résumé</h3><p>Attach your résumé and send it to ${site.careersEmails.map((e) => esc(e)).join(" and ")}.</p></li></ol></div></section>
<section class="section" id="apply"><div class="wrap narrow"><p class="eyebrow">Careers enquiry</p><h2>Your next chapter starts here</h2><p class="muted">Apply for a listed role or send your résumé for future opportunities.</p>
<form class="form" data-enquiry data-source="careers" novalidate>
<div class="grid-2"><label>Full name *<input name="name" required autocomplete="name"></label><label>Email address *<input name="email" type="email" required autocomplete="email"></label>
<label>Phone number *<input name="phone" type="tel" required autocomplete="tel"></label><label>Years of experience *<input name="experience" required></label></div>
<label>Position applied for *<input name="position" required></label><label>Relevant skills *<textarea name="skills" rows="3" required></textarea></label>
<label>Cover letter or message (optional)<textarea name="details" rows="4"></textarea></label>
<label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
<p class="form-note">Attach your résumé in your email before sending. No files are uploaded to this website.</p>
<label class="check"><input type="checkbox" name="consent" required> I consent to DICS processing my details and résumé for recruitment. <a href="/privacy-policy">Privacy Policy</a></label>
<button class="btn btn-accent" type="submit">Submit application</button><p class="form-status" role="status" aria-live="polite"></p></form>
<p>Prefer to email directly? Send your details and résumé to <a href="mailto:${site.careersEmails.join(",")}?subject=Career%20Application">${site.careersEmails.join(" and ")}</a>.</p></div></section>`;
  addPage("/careers", layout({ title: "Careers at DICS — Industrial Automation & Engineering", description: "Explore PLC programming, application engineering and technical support opportunities at DICS. Submit your application details and email your résumé to our team.", url: "/careers", body, crumbs: [["/", "Home"], [null, "Careers"]] }));
}

// Services index + detail
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Engineering &amp; service</p><h1>Services</h1><p class="lead">End-to-end project execution — electrical design, panel fabrication, software development, field commissioning and lifecycle support.</p></div></section>
<section class="section"><div class="wrap grid-2">${site.services.map((s, i) => `<a class="card svc" href="/services/${s.slug}"><span class="num">${String(i + 1).padStart(2, "0")}</span><h2 class="h3">${esc(s.name)}</h2><p>${esc(s.short)}</p><span class="more">Learn more →</span></a>`).join("")}</div></section>${ctaBand}`;
  addPage("/services", layout({ title: "Automation Engineering Services | DICS", description: "PLC, HMI, VFD, servo, factory automation, robotics, SMPS and operator panel services from DICS engineers.", url: "/services", body, crumbs: [["/", "Home"], [null, "Services"]] }));

  for (const s of site.services) {
    const related = s.related.map((p) => catByPath[p]).filter(Boolean);
    const body2 = `<section class="page-head"><div class="wrap"><p class="eyebrow">Service</p><h1>${esc(s.name)}</h1><p class="lead">${esc(s.short)}</p></div></section>
<section class="section"><div class="wrap split top"><div>${s.body.map((t) => `<p>${esc(t)}</p>`).join("")}<h2 class="h3">Challenges we help solve</h2><ul class="ticks">${s.challenges.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
<div class="card"><h2 class="h3">Enquire about ${esc(s.name)}</h2><p class="muted">Tell us about your machine or process. See all <a href="/services">services</a>.</p>${enquiryForm({ id: "svc-form", detailsLabel: "Project details", button: "Send enquiry", source: "service:" + s.slug })}</div></div></section>
<section class="section alt"><div class="wrap"><h2>Related products</h2><div class="grid-3">${related.map((c) => `<a class="card cat" href="/product-category/${c.path}"><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p><span class="more">Explore range →</span></a>`).join("")}</div></div></section>`;
    addPage(`/services/${s.slug}`, layout({ title: `${s.name} | DICS`, description: `${s.short} ${s.body[0]}`.slice(0, 300), url: `/services/${s.slug}`, body: body2, crumbs: [["/", "Home"], ["/services", "Services"], [null, s.name]] }));
  }
}

// Brands
for (const b of site.brands) {
  const list = products.filter((p) => p.brand.toLowerCase() === b.name.toLowerCase());
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Technology brand · ${esc(b.country)}</p><h1>${esc(b.name)}</h1><p class="lead">DICS supplies and supports ${esc(b.name)} automation products in India.</p></div></section>
<section class="section"><div class="wrap">${list.length ? `<div class="grid-4">${list.map(productCard).join("")}</div>` : `<p>Browse ${esc(b.name)} products in the <a href="/products?brand=${encodeURIComponent(b.name)}">catalogue</a>.</p>`}
<p><a class="btn btn-outline" href="/products?brand=${encodeURIComponent(b.name)}">View all ${esc(b.name)} products</a></p></div></section>${ctaBand}`;
  addPage(`/our-brands/${b.slug}`, layout({ title: `${b.name} Products in India | DICS`, description: `${b.name} (${b.country}) automation products supplied and supported by DICS, Bangalore.`, url: `/our-brands/${b.slug}`, body, crumbs: [["/", "Home"], [null, b.name]] }));
}

// Catalogue (client-side search over /data/products.json)
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow"><span id="count-head">${products.length}</span> products</p><h1>Product catalogue</h1><p class="lead">Search by model or series, or filter by category and manufacturer. Every product page has a Request a Quote option.</p></div></section>
<section class="section"><div class="wrap">
<form class="filters" id="catalogue-filters" role="search"><label>Search products<input type="search" name="q" placeholder="Model or series"></label>
<label>Category<select name="category"><option value="">All categories</option>${[...site.categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join("")}</select></label>
<label>Manufacturer<select name="brand"><option value="">All manufacturers</option></select></label><button class="btn" type="submit">Search</button></form>
<p class="muted" id="result-count" aria-live="polite"></p>
<div class="grid-4" id="catalogue-grid"></div>
<nav class="pager" id="pager" aria-label="Pagination"></nav>
<noscript><div class="grid-4">${products.map(productCard).join("")}</div></noscript></div></section>`;
  addPage("/products", layout({ title: "Industrial Automation Product Catalogue | DICS", description: "Search automation products by model, series, category or manufacturer — PLCs, drives, sensors, controllers, robotics and more.", url: "/products", body, crumbs: [["/", "Home"], [null, "Products"]] }));
}

// Category pages
for (const c of flatCats) {
  const slugs = new Set([c.slug]);
  const list = products.filter((p) => p.category === (c.parent ? c.parent.slug : c.slug));
  const children = (c.children || []).map((ch) => `<a class="card cat" href="/product-category/${c.slug}/${ch.slug}"><h3>${esc(ch.name)}</h3><p>${esc(ch.blurb)}</p><span class="more">Explore range →</span></a>`).join("");
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Product category</p><h1>${esc(c.name)}</h1><p class="lead">${esc(c.blurb)}</p></div></section>
<section class="section"><div class="wrap">${children ? `<div class="grid-2">${children}</div>` : ""}
${list.length ? `<div class="grid-4">${list.map(productCard).join("")}</div>` : `<p>Search the full <a href="/products?category=${c.parent ? c.parent.slug : c.slug}">catalogue for ${esc(c.name)}</a> or <a href="/request-a-quote">request a quote</a>.</p>`}
<p><a class="btn btn-outline" href="/products?category=${c.parent ? c.parent.slug : c.slug}">Browse in catalogue</a></p></div></section>${ctaBand}`;
  addPage(`/product-category/${c.path}`, layout({ title: `${c.name} | DICS`, description: c.blurb.slice(0, 300), url: `/product-category/${c.path}`, body, crumbs: [["/", "Home"], ["/products", "Products"], ...(c.parent ? [[`/product-category/${c.parent.slug}`, c.parent.name]] : []), [null, c.name]] }));
}

// Product detail pages
for (const p of products) {
  const c = catBySlug[p.category];
  const related = products.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 4);
  const body = `<section class="section"><div class="wrap split top"><div class="card pimg"><img src="${esc(p.image)}" alt="${esc(p.brand + " " + p.name)}"></div>
<div><p class="brand-tag">${esc(p.brand)}</p><h1>${esc(p.name)}</h1><p class="muted">${esc(p.group)}</p>
<dl class="specs"><div><dt>Manufacturer</dt><dd><a href="/products?brand=${encodeURIComponent(p.brand)}">${esc(p.brand)}</a></dd></div><div><dt>Category</dt><dd><a href="/product-category/${c.slug}">${esc(c.name)}</a></dd></div></dl>
<p>Contact DICS for specifications, pricing and availability for ${esc(p.brand)} ${esc(p.name)}.</p>
<div class="btn-row"><a class="btn btn-accent" href="/request-a-quote?product=${p.slug}">Request a quote</a><a class="btn btn-outline" href="/contact-us">Contact our offices</a></div></div></div></section>
${related.length ? `<section class="section alt"><div class="wrap"><h2>Related products</h2><div class="grid-4">${related.map(productCard).join("")}</div></div></section>` : ""}`;
  addPage(`/product/${p.slug}`, layout({ title: `${p.brand} ${p.name} | DICS`, description: `${p.brand} ${p.name}${p.group ? " — " + p.group : ""}. Request a quote from DICS, Bangalore.`, url: `/product/${p.slug}`, body, ogImage: p.image, crumbs: [["/", "Home"], ["/products", "Products"], [`/product-category/${c.slug}`, c.name], [null, p.name]] }));
}

// Privacy policy (draft — replace with your approved text)
{
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">Legal</p><h1>Privacy Policy</h1></div></section>
<section class="section"><div class="wrap narrow prose">
<p><strong>Draft notice:</strong> this policy is a starting template. Replace it with the text approved by ${esc(site.name)} before launch.</p>
<h2>Information we collect</h2><p>When you submit an enquiry, quote request or careers form, we collect the details you provide: your name, company, email, phone number, requirement and message.</p>
<h2>How we use it</h2><p>We use your details only to respond to your enquiry, provide quotations or product information, and — for careers submissions — to consider your application.</p>
<h2>Sharing</h2><p>We do not sell your personal information. Enquiries may be shared with the relevant DICS regional office so that the right team can respond.</p>
<h2>Retention and your choices</h2><p>We keep enquiry records for as long as needed to respond and for ordinary business records. To ask us to correct or delete your details, email <a href="mailto:${site.email}">${esc(site.email)}</a>.</p>
<h2>Contact</h2><p>${esc(site.name)}, ${esc(site.address)}. Phone: ${site.phones.map((x) => esc(x.label)).join(", ")}.</p></div></section>`;
  addPage("/privacy-policy", layout({ title: "Privacy Policy | DICS", description: "How Digital Instruments & Control Systems handles enquiry and careers form data.", url: "/privacy-policy", body, crumbs: [["/", "Home"], [null, "Privacy Policy"]] }));
}

// 404
addPage("/404", layout({ title: "Page not found | DICS", description: "Page not found.", url: "/404", body: `<section class="page-head"><div class="wrap"><h1>Page not found</h1><p class="lead">The page you are looking for does not exist. Try the <a href="/products">product catalogue</a> or <a href="/contact-us">contact us</a>.</p></div></section>` }));

/* ---------- write ---------- */
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const { url, html } of pages) {
  const out = url === "/" ? join(dist, "index.html") : url === "/404" ? join(dist, "404.html") : join(dist, url, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}
cpSync(join(root, "src/style.css"), join(dist, "style.css"));
cpSync(join(root, "src/app.js"), join(dist, "app.js"));
if (existsSync(join(root, "public"))) cpSync(join(root, "public"), dist, { recursive: true });
mkdirSync(join(dist, "data"), { recursive: true });
writeFileSync(join(dist, "data/products.json"), JSON.stringify(products));
writeFileSync(join(dist, "data/categories.json"), JSON.stringify(site.categories.map(({ slug, name }) => ({ slug, name }))));
const base = ORIGIN || "https://YOUR-DOMAIN";
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p.url !== "/404").map((p) => `<url><loc>${base}${p.url}</loc></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages into dist/`);
