

# Fix "Alternate page with proper canonical tag" SEO Error

## Overview
Create a dynamic `SEOHead` component that sets canonical URLs and meta tags per route, replacing the hardcoded meta tags in `index.html`.

## Changes

### 1. Create `src/components/seo/SEOHead.tsx`
- Props: `title`, `description`, `canonicalUrl`, `ogImage`, `ogType`, `noIndex` (all optional)
- Sets canonical link: uses `canonicalUrl` prop if provided, otherwise `window.location.origin + window.location.pathname`
- Sets `document.title`, meta description, OG tags, Twitter Card tags
- If `noIndex` is true, adds `<meta name="robots" content="noindex, nofollow">`
- Cleans up/updates tags on route change and unmount

### 2. Update `index.html`
- Remove hardcoded OG and Twitter meta tags (lines for `og:title`, `og:description`, `og:type`, `og:image`, `twitter:card`, `twitter:site`, `twitter:image`)
- Keep only the base `<title>` and `<meta name="description">` as fallbacks

### 3. Add `SEOHead` to all pages

**Public (indexed):**
- `/` -- "Gravilo - Your AI Assistant for Discord"
- `/features` -- "Features - Gravilo"
- `/pricing` -- "Pricing - Gravilo"
- `/privacy` -- "Privacy Policy - Gravilo"
- `/terms` -- "Terms of Service - Gravilo"
- `/cookies` -- "Cookie Policy - Gravilo"

**Private (noIndex):**
- `/dashboard`, `/usage`, `/admin`, `/settings`, `/knowledge-base`, `/billing/success`, 404 page

### Files summary
- **Create:** `src/components/seo/SEOHead.tsx`
- **Update:** `index.html` + 13 page components
