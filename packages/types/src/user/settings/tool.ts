import type { UserInterventionConfig } from '../../tool';

export interface UserToolConfig {
  humanIntervention?: UserInterventionConfig;
  /**
   * User-level default for skill activate mode.
   * Per-agent chatConfig.skillActivateMode overrides this when explicitly set.
   * - 'auto': runtime helpers always injected (default)
   * - 'manual': runtime helpers excluded unless user selects skills
   */
  skillActivateMode?: 'auto' | 'manual';
  /**
   * List of builtin tool identifiers that have been uninstalled by the user.
   * By default, all builtin tools are enabled. Users can explicitly
   * uninstall tools they don't want to use.
   *
   * This is the personal-context list (no active workspace). Workspace-scoped
   * lists are kept separately in `uninstalledBuiltinToolsByWorkspace` so a
   * workspace never inherits the user's personal customization.
   */
  uninstalledBuiltinTools?: string[];
  /**
   * Per-workspace uninstalled builtin tool lists, keyed by workspace id.
   * A workspace with no entry falls back to the default seed (i.e. a clean
   * default state), not the user's personal `uninstalledBuiltinTools`.
   */
  uninstalledBuiltinToolsByWorkspace?: Record<string, string[]>;
}
