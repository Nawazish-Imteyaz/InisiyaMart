// POST /api/enquiry — wedding, haldi, mehndi and bulk / return-gift enquiries from the website.
import { emit } from "../_lib/providers";
import { currentCustomer } from "../_lib/shop";
import { clientIp, EMAIL_RE, HttpError, int, json, mobile, readJson, sameOrigin, str, type Ctx } from "../_lib/util";

export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  try {
    const { request: req, env } = ctx;
    sameOrigin(req);
    const db = env.DB;
    const ip = clientIp(req);
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE ip = ? AND created_at > datetime('now', '-1 hour')").bind(ip).first<{ n: number }>();
    if ((recent?.n ?? 0) >= 4) throw new HttpError(429, "We already have your enquiries. We'll reply on WhatsApp soon.");
    const body = await readJson(req);
    if (body.consent !== true) throw new HttpError(400, "Please accept the privacy policy so we can contact you");
    if (body.website) return json({ ok: true }); // hidden honeypot field filled → a bot
    const name = str(body.name, 100, "Name", true);
    const phone = mobile(body.phone);
    if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
    const email = str(body.email, 120, "Email");
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
    const eventDate = str(body.event_date, 10, "Event date");
    if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new HttpError(400, "Choose the event date");
    const occasion = str(body.occasion, 60, "Occasion");
    const quantity = int(body.quantity, "Number of gifts", { min: 1, max: 100_000, nullable: true });
    const budget = str(body.budget, 60, "Budget");
    const city = str(body.city, 60, "City");
    const message = str(body.message, 1500, "Message");
    const me = await currentCustomer(db, req);
    const r = await db
      .prepare(`INSERT INTO enquiries (name, phone, email, occasion, event_date, quantity, budget, city, message, customer_id, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(name, phone, email, occasion, eventDate, quantity, budget, city, message, me?.id ?? null, ip)
      .run();
    emit(ctx, "enquiry.created", { id: r.meta.last_row_id, name, occasion, event_date: eventDate, quantity, budget, city },
      [`✨ New enquiry from ${name}`, [occasion, eventDate, quantity ? `${quantity} gifts` : "", budget, city].filter(Boolean).join(" · "),
        message ? `“${message.slice(0, 200)}”` : "", `Reply: https://wa.me/91${phone}`].filter(Boolean).join("\n"));
    return json({ ok: true }, 201);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Please message us on WhatsApp." }, 500);
  }
};
