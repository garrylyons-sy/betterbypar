export function applyAffiliateCodeToAdvertUrl(linkUrl: string, affiliateCode: string | null | undefined) {
  const trimmedUrl = linkUrl.trim();
  const trimmedCode = String(affiliateCode ?? "").trim();
  if (!trimmedCode) return trimmedUrl;

  const url = new URL(trimmedUrl);
  if (isAmazonHost(url.hostname)) {
    url.searchParams.set("tag", trimmedCode);
  }
  return url.toString();
}

function isAmazonHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "amazon.com" || normalized.endsWith(".amazon.com") || /^amazon\.[a-z.]+$/.test(normalized) || /\.amazon\.[a-z.]+$/.test(normalized);
}
