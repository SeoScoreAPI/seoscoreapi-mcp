# SEO Score API

SEO Score API audits web pages for SEO, GEO (how visible a page is to AI assistants and AI search), ADA / WCAG 2.1 AA accessibility and conversion, and tracks how often AI engines mention and cite a brand.

Good first calls:
- audit: score (0-100), grade and a prioritized fix list for one URL. Start here for "how is my SEO?" questions.
- usage: the plan in use and what is left this month.
- ai_readability, geo_audit: whether AI assistants can read, quote and cite a page.
- accessibility_audit: WCAG 2.1 AA violations with plain-English fixes (paid plans).
- crawl_site or deep_audit: a whole site, or a thorough single-URL audit (longer-running; start_* + get_* to poll).

Every tool needs a SEO Score API account. A free key takes a minute at https://seoscoreapi.com/#signup (no card); paid plans unlock batch, GEO, accessibility, crawl, history and citation tracking (see https://seoscoreapi.com/#pricing). When a tool answers that a plan is needed, say which plan and share the link the error gives.

URLs must include the protocol (https://...). Scores come from the live page at call time.

First use: run `/mcp auth seoscoreapi` to sign in (or create a free account) in the browser.
