import path from "path";

export function resolveServiceAccountPath(): string {
    const fallbackPath = path.join(process.cwd(), "serviceAccountKey.json");
    const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

    // Keep the default path static so Turbopack can resolve it without broad dynamic globs.
    if (!configuredPath) {
        return fallbackPath;
    }

    if (
        configuredPath === "serviceAccountKey.json" ||
        configuredPath === "./serviceAccountKey.json"
    ) {
        return fallbackPath;
    }

    if (path.isAbsolute(configuredPath)) {
        return configuredPath;
    }

    // Preserve backward compatibility for arbitrary relative paths.
    return path.resolve(process.cwd(), configuredPath);
}
