export type DeploymentKind = "local" | "unknown";

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }
  if (normalized === "::1") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return normalized
      .split(".")
      .every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
  }
  return false;
}

export function resolveDeploymentKind(hostname: string): DeploymentKind {
  return isLoopbackHostname(hostname) ? "local" : "unknown";
}
