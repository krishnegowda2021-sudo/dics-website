// Vercel Function: POST /api/enquiry  (the Cloudflare equivalent is src/worker.js)
import { processEnquiry } from "../src/enquiry.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  const { status, body: out } = await processEnquiry(body, process.env);
  return res.status(status).json(out);
}
