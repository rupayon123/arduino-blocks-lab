export function normalizePackUrl(input: string, baseUrl?: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a hardware pack URL.");

  const withScheme = trimmed.startsWith("github.com/") ? `https://${trimmed}` : trimmed;
  const url = new URL(withScheme, baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Hardware pack URLs must use http or https.");
  }

  if (url.hostname === "github.com") {
    const [owner, repo, marker, branch, ...pathParts] = url.pathname.split("/").filter(Boolean);
    if (owner && repo && marker === "blob" && branch && pathParts.length > 0) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathParts.join("/")}`;
    }
  }

  return url.toString();
}
