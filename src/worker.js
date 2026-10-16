// Cloudflare Worker: serves the static site (via the ASSETS binding) and handles POST /api/enquiry.
// The form logic itself lives in src/enquiry.js (shared with the Vercel function in api/enquiry.js).
// Set FORM_WEBHOOK_URL, or RESEND_API_KEY + MAIL_TO, under Worker settings -> Variables and Secrets.
import { processEnquiry } from "./enquiry.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/enquiry") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const { status, body: out } = await processEnquiry(body, env);
      return json(out, status);
    }

    const res = await env.ASSETS.fetch(request);
    if (res.status === 404) {
      const nf = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
      return new Response(nf.body, { status: 404, headers: nf.headers });
    }
    return res;
  },
};
