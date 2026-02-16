import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

const DEFAULT_TITLE = "Gravilo - Your AI Assistant for Discord";
const DEFAULT_DESCRIPTION =
  "Gravilo is your helpful, fast AI assistant for Discord. Smart moderation, instant answers, and custom commands for your community.";
const DEFAULT_OG_IMAGE = "https://gravilo.lovable.app/og-image.png";

function setMeta(name: string, content: string, attribute = "name") {
  let el = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeRobotsMeta() {
  const el = document.querySelector('meta[name="robots"]');
  if (el) el.remove();
}

const SEOHead = ({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = "website",
  noIndex = false,
}: SEOHeadProps) => {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = title || DEFAULT_TITLE;
    const pageDescription = description || DEFAULT_DESCRIPTION;
    const canonical = canonicalUrl || `${window.location.origin}${location.pathname}`;
    const image = ogImage || DEFAULT_OG_IMAGE;

    // Title
    document.title = pageTitle;

    // Canonical
    setCanonical(canonical);

    // Meta description
    setMeta("description", pageDescription);

    // Open Graph
    setMeta("og:title", pageTitle, "property");
    setMeta("og:description", pageDescription, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:image", image, "property");
    setMeta("og:url", canonical, "property");

    // Twitter Card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", pageTitle);
    setMeta("twitter:description", pageDescription);
    setMeta("twitter:image", image);

    // Robots
    if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      removeRobotsMeta();
    }
  }, [title, description, canonicalUrl, ogImage, ogType, noIndex, location.pathname]);

  return null;
};

export default SEOHead;
