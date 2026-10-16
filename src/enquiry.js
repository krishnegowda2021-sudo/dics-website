// Shared enquiry handler used by both hosts:
//   Cloudflare Worker  -> src/worker.js
//   Vercel Function    -> api/enquiry.js
//
// Configure delivery with ONE of these environment variables:
//   FORM_WEBHOOK_URL  - any HTTPS endpoint that accepts JSON (Zapier, Make, Slack/Teams webhook, your CRM)
//   RESEND_API_KEY + MAIL_TO (+ optional MAIL_FROM) - sends an email through Resend (https://resend.com)
// If neither is set, submissions are rejected with a clear error so enquiries are never silently lost.

const FIELD_LIMITS = { name: 120, company: 160, email: 200, phone: 40, requirement: 120, details: 5000, product: 200, source: 80, page: 200, experience: 40, position: 200, skills: 2000 };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** @returns {Promise<{status:number, body:object}>} */
export async function processEnquiry(body, env) {
  if (!body || typeof body !== "object") return { status: 400, body: { error: "Invalid request" } };
  if (body.website) return { status: 200, body: { ok: true } }; // honeypot: pretend success to bots

  const d = {};
  for (const [k, max] of Object.entries(FIELD_LIMITS)) d[k] = String(body[k] ?? "").trim().slice(0, max);
  if (!d.name || !EMAIL_RE.test(d.email) || !d.phone) return { status: 400, body: { error: "Missing or invalid fields" } };
  if (d.source !== "careers" && !d.details) return { status: 400, body: { error: "Missing details" } };

  const subject = `[DICS website] ${d.source || "enquiry"} from ${d.name}`;
  const text = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");

  try {
    if (env.FORM_WEBHOOK_URL) {
      const r = await fetch(env.FORM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, text, fields: d, receivedAt: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error("webhook " + r.status);
    } else if (env.RESEND_API_KEY && env.MAIL_TO) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM || "DICS Website <onboarding@resend.dev>",
          to: env.MAIL_TO.split(",").map((s) => s.trim()),
          reply_to: d.email,
          subject,
          text,
        }),
      });
      if (!r.ok) throw new Error("resend " + r.status);
    } else {
      return { status: 503, body: { error: "Enquiry delivery is not configured" } };
    }
  } catch {
    return { status: 502, body: { error: "Delivery failed" } };
  }
  return { status: 200, body: { ok: true } };
}
