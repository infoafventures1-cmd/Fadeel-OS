# FADEEL OS

Fadeel's private command center, built on the same base as AVI OS.

- **Home**: the day at a glance, what needs attention, workload, quick links to his Google account
- **Today**: Plan My Day builds a schedule around the timetable
- **Tasks**, **Calendar**
- **Assistant**: an AI chat that can see open tasks, plans and documents. Also opens from the round button in the corner of every page
- **Documents**: an autosaving writing space with an **AI help** panel (Improve, Shorten, Expand, Fix grammar, More formal, Simpler, Continue writing, Give feedback, or any instruction)
- **University Plans**: one business plan doc per idea, with an AI co-writer beside it that writes straight into the plan, with undo
- **Settings**: the weekly timetable and the AI models, with a Test button for each

Every AI panel has a model picker: **Claude** (Sonnet, Opus, Haiku), **ChatGPT**, **Gemini** and **Perplexity** (which searches the web and cites sources). All of it happens on this site. The API keys stay on the server and never reach the browser.

## Put it online (about 15 minutes)

1. **GitHub**: create a new *private* repository and upload this folder to it (everything except `node_modules`).
2. **Vercel**: at vercel.com choose *Add New › Project*, import the repository and press *Deploy*. The site opens on a setup page.
3. **Database**: in the Vercel project open *Storage › Create Database › Neon* (free plan) and connect it to the project. This adds `DATABASE_URL`. The tables create themselves the first time the dashboard runs.
4. **Password**: in *Settings › Environment Variables* add `DASHBOARD_PASSCODE` with a long password.
5. **AI**: in the same place add `OPENROUTER_API_KEY` (one key from openrouter.ai/keys runs every model; you add credit and pay per use). You can add each company's own key instead or as well: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`.
6. **Redeploy**: *Deployments › ⋯ › Redeploy*, open the site, sign in, then go to *Settings › AI models* and press **Test** on each model.

## Make it yours

Start with `src/config.ts`: the dashboard name, Fadeel's name and Google account, timezone, weather city, projects, quick links, the assistant's name (`ASSISTANT_NAME`) and the AI model list (`AI_MODELS`).

AI model ids change every few months. If a model fails its test in Settings, look up the current id (anthropic.com, platform.openai.com, ai.google.dev, docs.perplexity.ai, or openrouter.ai/models) and update `model` / `openrouter` for it in `AI_MODELS`.

| To change… | Edit |
| --- | --- |
| Colours and fonts | `src/app/globals.css` (`--accent` re-skins everything), fonts in `src/app/layout.tsx` |
| Logo | `src/components/brand/mark.tsx` and `public/mark.svg` |
| The pages in the sidebar | `src/components/layout/nav.ts`, pages live in `src/app/(shell)/<name>/page.tsx` |
| What the AI is told | `src/app/api/ai/route.ts` (the assistant, Documents AI help and the plan co-writer) |
| How models are called | `src/lib/server/ai.ts` |
| The sections a new plan starts with | `src/lib/plan-template.ts` |
| Database tables | `src/lib/server/schema.ts` |

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, DASHBOARD_PASSCODE and an AI key
npm run dev                  # http://localhost:3000
```

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · Neon Postgres · Framer Motion · Lucide icons.
