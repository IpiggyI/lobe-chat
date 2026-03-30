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
   */
  uninstalledBuiltinTools?: string[];
}
