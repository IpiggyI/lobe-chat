import type { IconType } from '@lobehub/icons';
import { Apple, Aws, Cloudflare, Github, Google, Microsoft } from '@lobehub/icons';
import * as Auth0MonoModule from '@lobehub/ui/es/icons/Auth0/components/Mono';
import * as AutheliaColorModule from '@lobehub/ui/es/icons/Authelia/components/Color';
import * as AuthentikColorModule from '@lobehub/ui/es/icons/Authentik/components/Color';
import * as CasdoorColorModule from '@lobehub/ui/es/icons/Casdoor/components/Color';
import * as LogtoColorModule from '@lobehub/ui/es/icons/Logto/components/Color';
import * as MicrosoftEntraColorModule from '@lobehub/ui/es/icons/MicrosoftEntra/components/Color';
import * as ZitadelColorModule from '@lobehub/ui/es/icons/Zitadel/components/Color';
import { User } from 'lucide-react';

const getDefaultIcon = <T extends { Icon: IconType }>(module: T & { default: T['Icon'] }) => module.default;

const Auth0 = getDefaultIcon(Auth0MonoModule as typeof Auth0MonoModule & { default: typeof Auth0MonoModule.Icon });
const AutheliaColor = getDefaultIcon(
  AutheliaColorModule as typeof AutheliaColorModule & { default: typeof AutheliaColorModule.Icon },
);
const AuthentikColor = getDefaultIcon(
  AuthentikColorModule as typeof AuthentikColorModule & { default: typeof AuthentikColorModule.Icon },
);
const CasdoorColor = getDefaultIcon(
  CasdoorColorModule as typeof CasdoorColorModule & { default: typeof CasdoorColorModule.Icon },
);
const LogtoColor = getDefaultIcon(
  LogtoColorModule as typeof LogtoColorModule & { default: typeof LogtoColorModule.Icon },
);
const MicrosoftEntraColor = getDefaultIcon(
  MicrosoftEntraColorModule as typeof MicrosoftEntraColorModule & {
    default: typeof MicrosoftEntraColorModule.Icon;
  },
);
const ZitadelColor = getDefaultIcon(
  ZitadelColorModule as typeof ZitadelColorModule & { default: typeof ZitadelColorModule.Icon },
);

const iconComponents: Record<string, IconType> = {
  'apple': Apple,
  'auth0': Auth0,
  'authelia': AutheliaColor,
  'authentik': AuthentikColor,
  'casdoor': CasdoorColor,
  'cloudflare': Cloudflare,
  'cognito': Aws.Color,
  'github': Github,
  'google': Google.Color,
  'logto': LogtoColor,
  'microsoft': Microsoft.Color,
  'microsoft-entra-id': MicrosoftEntraColor,
  'zitadel': ZitadelColor,
};

/**
 * Get the auth icons component for the given provider id
 */
const AuthIcons = (id: string, size = 36) => {
  const IconComponent = iconComponents[id];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // Fallback to generic user icon for unknown providers
  return <User size={size} />;
};

export default AuthIcons;
