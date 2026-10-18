import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

const DEFAULT = {
  name: "Mark",
  title: "Photography,\nquietly observed.",
  sub: "MY PORTFOLIO",
  about: "Hi, I’m Mark, a student who loves capturing everyday moments.",
  email: "you@example.com",
  ig: "@yourname",
  photos: [],
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSCODE || "";
const sign = (exp) => crypto.createHmac("sha256", secret()).update(String(exp)).digest("hex");

function makeToken() {
  const exp = Date.now() + 12 * 3600 * 1000;
  return exp + "." + sign(exp);
}
function validToken(tok) {
  if (!secret()) return false;
  const [exp, sig] = String(tok || "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
function authed(req) {
  const h = req.headers.get("authorization") || "";
  return validToken(h.replace(/^Bearer\s+/i, ""));
}

// Best-effort brute-force limiter (per function instance).
const tries = new Map();
function limited(ip) {
  const t = tries.get(ip);
  return !!t && t.until > Date.now();
}
function fail(ip) {
  const t = tries.get(ip) || { n: 0, until: 0 };
  t.n += 1;
  if (t.n >= 5) { t.until = Date.now() + 10 * 60 * 1000; t.n = 0; }
  tries.set(ip, t);
}

const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
const ID = /^[a-f0-9-]{36}$/;

function clean(b) {
  const photos = Array.isArray(b.photos) ? b.photos : [];
  return {
    name: clip(b.name, 60),
    title: clip(b.title, 200),
    sub: clip(b.sub, 200),
    about: clip(b.about, 3000),
    email: clip(b.email, 120),
    ig: clip(b.ig, 80),
    photos: photos
      .filter((p) => p && ID.test(String(p.id)))
      .slice(0, 500)
      .map((p) => ({ id: String(p.id), c: clip(p.c, 40) })),
  };
}

export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = parts[0] || "";
  const site = getStore("site");
  const images = getStore("images");
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "unknown";

  try {
    if (route === "site" && req.method === "GET") {
      const data = await site.get("data", { type: "json" });
      return json(data || DEFAULT);
    }

    if (route === "img" && req.method === "GET" && ID.test(parts[1] || "")) {
      const r = await images.getWithMetadata(parts[1], { type: "arrayBuffer" });
      if (!r || !r.data) return new Response("Not found", { status: 404 });
      return new Response(r.data, {
        headers: {
          "Content-Type": (r.metadata && r.metadata.type) || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (route === "login" && req.method === "POST") {
      if (!process.env.ADMIN_PASSCODE) return json({ error: "ADMIN_PASSCODE is not set on the server" }, 500);
      if (limited(ip)) return json({ error: "Too many attempts. Try again later." }, 429);
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const ok = crypto.timingSafeEqual(sha(body.passcode || ""), sha(process.env.ADMIN_PASSCODE));
      if (!ok) { fail(ip); return json({ error: "Incorrect passcode" }, 401); }
      tries.delete(ip);
      return json({ token: makeToken() });
    }

    if (route === "site" && req.method === "POST") {
      if (!authed(req)) return json({ error: "Unauthorized" }, 401);
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: "Bad JSON" }, 400); }
      const data = clean(body);
      await site.setJSON("data", data);
      // remove images no longer used
      const keep = new Set(data.photos.map((p) => p.id));
      const { blobs } = await images.list();
      await Promise.all(blobs.filter((b) => !keep.has(b.key)).map((b) => images.delete(b.key)));
      return json({ ok: true });
    }

    if (route === "upload" && req.method === "POST") {
      if (!authed(req)) return json({ error: "Unauthorized" }, 401);
      const type = (req.headers.get("content-type") || "").split(";")[0].trim();
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return json({ error: "Unsupported image type" }, 415);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength) return json({ error: "Empty file" }, 400);
      if (buf.byteLength > 5.5 * 1024 * 1024) return json({ error: "Image too large" }, 413);
      const id = crypto.randomUUID();
      await images.set(id, buf, { metadata: { type } });
      return json({ id });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: "Server error" }, 500);
  }
};
