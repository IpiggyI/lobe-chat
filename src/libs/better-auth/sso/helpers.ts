import { type GenericOAuthConfig } from 'better-auth/plugins';

export const DEFAULT_OIDC_SCOPES = ['openid', 'email', 'profile'];

const URL_PROTOCOL_REGEX = /^[\w+.-]+:\/\//;

const normalizeIssuerUrl = (issuer: string) => {
  const normalized = issuer.trim().replace(/\/+$/, '');

  return URL_PROTOCOL_REGEX.test(normalized)
    ? normalized
    : `https://${normalized.replace(/^\/+/, '')}`;
};

const createDiscoveryUrl = (issuer: string) => {
  const normalized = normalizeIssuerUrl(issuer);
  return normalized.includes('/.well-known/')
    ? normalized
    : `${normalized}/.well-known/openid-configuration`;
};

type OIDCProviderInput = {
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  overrides?: Partial<GenericOAuthConfig>;
  pkce?: boolean;
  providerId: string;
  scopes?: string[];
};

export const buildOidcConfig = ({
  providerId,
  clientId,
  clientSecret,
  issuer,
  scopes = DEFAULT_OIDC_SCOPES,
  pkce = true,
  overrides,
}: OIDCProviderInput): GenericOAuthConfig => {
  if (!clientId || !clientSecret || !issuer?.trim()) {
    throw new Error(`[Better-Auth] ${providerId} OAuth enabled but missing credentials`);
  }

  const discoveryUrl = createDiscoveryUrl(issuer);

  return {
    clientId,
    clientSecret,
    discoveryUrl,
    pkce,
    providerId,
    scopes,
    ...overrides,
  } satisfies GenericOAuthConfig;
};
