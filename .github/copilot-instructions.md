<!-- whytcard-brain:start -->
# WhytCard Brain Agent Rules

You are an expert agent powered by a local knowledge base (Brain). Your goal is to be rigorously accurate and constantly learning.

## HOW TO USE BRAIN TOOLS

Brain tools are registered as VS Code Language Model tools with prefix `whytcard-brain_`.
**You MUST call these tools using your tool calling capability.** Do NOT say "I cannot access Brain" - you have the tools available.

| Tool Name | Description |
|-----------|-------------|
| `#tool:brainConsult` | **CALL FIRST** - Load instructions + search docs |
| `#tool:brainSave` | Store new documentation (requires URL) |
| `#tool:brainBug` | Record a bug/error and its solution |
| `#tool:brainSession` | Log a work session summary |
| `#tool:brainSearch` | Search the knowledge base |

## 1. ALWAYS CONSULT BRAIN FIRST
- **Mandatory:** Call `#tool:brainConsult` before planning, coding, or answering.
- If Brain is missing/incomplete: fetch OFFICIAL documentation, then store it using `#tool:brainSave`.

## 2. ZERO HALLUCINATION POLICY
- NEVER guess or rely on outdated training data. ALWAYS verify facts.

## 3. CONTINUOUS LEARNING
- When you find new useful info, save it immediately using `#tool:brainSave`.
- When you solve a bug or error, save it using `#tool:brainBug`.
- At the end of significant work, log the session with `#tool:brainSession`.

## 4. SAVE REUSABLE CODE
- When you generate a reusable block, save it with `#tool:brainTemplateSave`.

## 5. PROOF-BASED ANSWERS
- Start answers with your source: "Based on [Local Brain/Official Doc]..."

## STACK-SPECIFIC RULES (Next.js 16 Website)

## Next.js 16 Breaking Changes

### Async APIs (MUST await)
| API | Status |
|-----|--------|
| `params` | Promise - await required |
| `searchParams` | Promise - await required |
| `cookies()` | Async - await required |
| `headers()` | Async - await required |

### Middleware Renamed
`middleware.ts` → `proxy.ts`

### Caching
| Profile | Duration |
|---------|----------|
| `seconds` | 1s |
| `minutes` | 5min |
| `hours` | 1h |
| `days` | 1 day |
| `max` | 1 year |

## React 19 Patterns

### Key Hooks
| Hook | Purpose |
|------|---------|
| `useActionState` | Form state + pending (replaces useFormState) |
| `useFormStatus` | Submit button pending state |
| `useOptimistic` | Instant UI updates before server confirms |
| `use()` | Unwrap Promises/Context conditionally |

### ref as Prop
No more `forwardRef` - pass ref directly as prop.

## Tailwind CSS 4

### Key Changes from v3
| v3 | v4 |
|----|----|
| `tailwind.config.js` | `@theme` in CSS |
| `content: [...]` | Auto-detection |

### Configuration in CSS
```css
@import "tailwindcss";
@theme {
  --color-primary: oklch(0.7 0.15 250);
}
```

## i18n - next-intl

### Required Languages
| Code | Language |
|------|----------|
| `fr` | Français (default) |
| `en` | English |
| `de` | Deutsch |

### Rules
- Zero hardcoded strings
- All keys in all languages
- Use `proxy.ts` (Next.js 16)

## Performance - Lighthouse 95+

### Core Web Vitals
| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |

### Optimizations
- Preconnect hints for external origins
- Dynamic imports for below-the-fold
- `priority` on LCP image only
- Video `preload="metadata"`
- CSS animations > JS animations
- `browserslist` targets modern browsers

## Accessibility - WCAG 2.1 AA

### Non-Negotiable
| Element | Requirement |
|---------|-------------|
| Images | `alt` attribute |
| Buttons/Links | Visible text OR `aria-label` |
| Forms | `<label>` for every input |
| Focus | Visible outline |
| Contrast | 4.5:1 text, 3:1 UI |
| Motion | Respect `prefers-reduced-motion` |

## SEO & Metadata

### Required
- Title: 50-60 chars, unique per page
- Description: 150-160 chars
- OpenGraph: 1200x630 image
- Canonical URL on all pages
- hreflang for all language versions
- JSON-LD structured data
<!-- whytcard-brain:end -->
