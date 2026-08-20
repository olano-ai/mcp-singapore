export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requireEnv(name: string, help?: string): string {
  const value = getOptionalEnv(name);
  if (!value) {
    const suffix = help ? ` ${help}` : '';
    throw new Error(`Missing required environment variable ${name}.${suffix}`);
  }
  return value;
}
