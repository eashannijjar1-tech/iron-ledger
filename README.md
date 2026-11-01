# Iron Ledger

A personal strength-training tracker. Fast logging, last-time numbers in front of you,
progressive-overload prompts, and progress charts (Best set / Est. 1RM / Volume).
Each person signs up with an email and gets their own private log, synced across devices.

## Stack
- **Front end:** plain HTML/CSS/JS (no build step). `index.html`, `app.js`, `config.js`.
- **Backend:** Supabase (Postgres database + accounts). Free tier.
- **Hosting:** any static host (Cloudflare Pages / Vercel / Netlify). Free tier.

## Setup (one time)

1. **Create a Supabase project** at supabase.com (free).
2. **Create the tables:** Supabase dashboard → SQL Editor → paste `schema.sql` → Run.
3. **Connect the app:** open `config.js` and paste your Project URL and anon/public key
   (dashboard → Project Settings → API).
4. **Smoother signups (optional):** Authentication → Providers → Email → turn off
   "Confirm email" so friends can log in immediately without an email round-trip.
5. **Run locally to test:** from this folder, `python3 -m http.server 5173`, then open
   http://localhost:5173 . Sign up, log a set, reload — it should persist.

## Deploy (make it live for friends)

Easiest route, no command line:
1. Put this folder in a GitHub repo.
2. In Cloudflare Pages (or Vercel / Netlify), "Import" that repo. No build command;
   output directory is the repo root. Deploy → you get a public URL.
3. Back in Supabase → Authentication → URL Configuration, add your live URL to
   **Site URL** and **Redirect URLs**.
4. Share the URL. Each friend signs up with their own email; row-level security keeps
   every person's data private to them.

## Notes
- `config.js` holds the anon key, which is *meant* to be public — security is enforced
  by the row-level security policies in `schema.sql`, not by hiding the key.
- Never put the `service_role` key or database password in the front end.
- Data model: `app_meta` (one row per user: exercises, templates, bodyweight, settings)
  and `workouts` (one row per session). Both are JSON, both locked to their owner.
