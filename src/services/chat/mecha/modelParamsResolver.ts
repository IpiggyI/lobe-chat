import type { LobeAgentChatConfig } from '@lobechat/types';
import type { ExtendParamsType } from 'model-bank';

import { aiModelSelectors, getAiInfraStoreState } from '@/store/aiInfra';

/**
 * Context for resolving model parameters
 */
export interface ModelParamsContext {
  chatConfig: LobeAgentChatConfig;
  model: string;
  provider: string;
}

/**
 * Extended parameters for model runtime
 */
export interface ModelExtendParams {
  deepseekV4ReasoningEffort?: string;
  effort?: string;
  enabledContextCaching?: boolean;
  imageAspectRatio?: string;
  imageResolution?: string;
  reasoning_effort?: string;
  thinking?: {
    budget_tokens?: number;
    type?: string;
  };
  thinkingBudget?: number;
  thinkingLevel?: string;
  urlContext?: boolean;
  verbosity?: string;
}

type ThinkingLevelExtendParam =
  | 'thinkingLevel'
  | 'thinkingLevel2'
  | 'thinkingLevel3'
  | 'thinkingLevel4';

type ThinkingLevelValue = NonNullable<LobeAgentChatConfig['thinkingLevel']>;

const DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM = {
  thinkingLevel: 'high',
  thinkingLevel2: 'high',
  thinkingLevel3: 'high',
  thinkingLevel4: 'minimal',
} as const satisfies Record<ThinkingLevelExtendParam, ThinkingLevelValue>;

const MODEL_THINKING_LEVEL_DEFAULTS: Partial<
  Record<string, Partial<Record<ThinkingLevelExtendParam, ThinkingLevelValue>>>
> = {
  'gemini-3.5-flash': {
    thinkingLevel: 'medium',
  },
  'gemini-3.1-flash-lite': {
    thinkingLevel: 'minimal',
  },
  'gemini-3.1-flash-lite-preview': {
    thinkingLevel: 'minimal',
  },
} as const;

/**
 * Preserves legacy `thinking` preferences for users created before `enableReasoning`.
 * Without this fallback, an old `thinking: 'enabled'` or `thinking: 'disabled'`
 * setting would be treated as unset by models that now expose the `enableReasoning` switch.
 */
const resolveEnableReasoningValue = (chatConfig: LobeAgentChatConfig): boolean | undefined => {
  if (Object.hasOwn(chatConfig, 'enableReasoning')) return chatConfig.enableReasoning;

  if (chatConfig.thinking === 'enabled') return true;
  if (chatConfig.thinking === 'disabled') return false;

  return undefined;
};

const resolveThinkingLevelDefault = (
  model: string,
  extendParam: ThinkingLevelExtendParam,
): ThinkingLevelValue => {
  return (
    MODEL_THINKING_LEVEL_DEFAULTS[model]?.[extendParam] ??
    DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM[extendParam]
  );
};

const isThinkingLevelExtendParam = (
  extendParam: ExtendParamsType,
): extendParam is ThinkingLevelExtendParam => extendParam in DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM;

export const resolveDefaultThinkingLevelForModel = (model?: string): ThinkingLevelValue => {
  if (!model) return DEFAULT_THINKING_LEVEL_BY_EXTEND_PARAM.thinkingLevel;

  return resolveThinkingLevelDefault(model, 'thinkingLevel');
};

/**
 * Resolves extended parameters for model runtime based on model capabilities and chat config
 *
 * This function checks what extended parameters the model supports and applies
 * the corresponding values from chat config.
 */
export const resolveModelExtendParams = (ctx: ModelParamsContext): ModelExtendParams => {
  const { model, provider, chatConfig } = ctx;
  const extendParams: ModelExtendParams = {};

  const aiInfraStoreState = getAiInfraStoreState();

  const isModelHasExtendParams = aiModelSelectors.isModelHasExtendParams(
    model,
    provider,
  )(aiInfraStoreState);

  if (!isModelHasExtendParams) {
    return extendParams;
  }

  const modelExtendParams = aiModelSelectors.modelExtendParams(model, provider)(aiInfraStoreState);

  if (!modelExtendParams) {
    return extendParams;
  }

  // Reasoning configuration
  if (modelExtendParams.includes('enableReasoning')) {
    const enableReasoning = resolveEnableReasoningValue(chatConfig);

    if (enableReasoning) {
      const thinking: NonNullable<ModelExtendParams['thinking']> = {
        type: 'enabled',
      };

      // Determine which budget field to use based on model support
      let budgetTokens: number | undefined;
      if (modelExtendParams.includes('reasoningBudgetToken32k')) {
        budgetTokens = chatConfig.reasoningBudgetToken32k || 1024;
      } else if (modelExtendParams.includes('reasoningBudgetToken80k')) {
        budgetTokens = chatConfig.reasoningBudgetToken80k || 1024;
      } else {
        budgetTokens = chatConfig.reasoningBudgetToken || 1024;
      }

      thinking.budget_tokens = budgetTokens;
      extendParams.thinking = thinking;
    } else {
      extendParams.thinking = {
        budget_tokens: 0,
        type: 'disabled',
      };
    }
  } else if (modelExtendParams.includes('reasoningBudgetToken32k')) {
    // For models that only have reasoningBudgetToken32k without enableReasoning
    extendParams.thinking = {
      budget_tokens: chatConfig.reasoningBudgetToken32k || 1024,
      type: 'enabled',
    };
  } else if (modelExtendParams.includes('reasoningBudgetToken80k')) {
    // For models that only have reasoningBudgetToken80k without enableReasoning
    extendParams.thinking = {
      budget_tokens: chatConfig.reasoningBudgetToken80k || 1024,
      type: 'enabled',
    };
  } else if (modelExtendParams.includes('reasoningBudgetToken')) {
    // For models that only have reasoningBudgetToken without enableReasoning
    extendParams.thinking = {
      budget_tokens: chatConfig.reasoningBudgetToken || 1024,
    };
  }

  // Adaptive thinking (Claude Opus/Sonnet 4.6/4.7)
  if (modelExtendParams.includes('enableAdaptiveThinking')) {
    // Adaptive-only models (Opus 4.6/4.7, no enableReasoning fallback) default to ON so
    // out-of-the-box requests still think. `?? adaptiveOnly` keeps an explicit `false`
    // (user opted out) distinct from an unset config (default ON).
    const adaptiveOnly = !modelExtendParams.includes('enableReasoning');
    const adaptiveEnabled = chatConfig.enableAdaptiveThinking ?? adaptiveOnly;

    if (adaptiveEnabled) {
      extendParams.thinking = {
        type: 'adaptive',
      };
    } else if (adaptiveOnly) {
      // Explicitly opted out on an adaptive-only model → disable
      extendParams.thinking = {
        type: 'disabled',
      };
    }
    // When adaptive is off and model also has enableReasoning, let enableReasoning result stand
  }

  // Context caching
  if (modelExtendParams.includes('disableContextCaching') && chatConfig.disableContextCaching) {
    extendParams.enabledContextCaching = false;
  }

  // Reasoning effort variants
  if (modelExtendParams.includes('reasoningEffort')) {
    extendParams.reasoning_effort = chatConfig.reasoningEffort || 'medium';
  }

  if (modelExtendParams.includes('gpt5ReasoningEffort')) {
    extendParams.reasoning_effort = chatConfig.gpt5ReasoningEffort || 'medium';
  }

  if (modelExtendParams.includes('gpt5_1ReasoningEffort') && chatConfig.gpt5_1ReasoningEffort) {
    extendParams.reasoning_effort = chatConfig.gpt5_1ReasoningEffort;
  }

  if (modelExtendParams.includes('gpt5_2ReasoningEffort')) {
    // See-what-you-send: mirror the model-aware UI default in ControlsForm — only the
    // native `gpt-5.5` slider shows medium; gpt-5.2 and openrouter gpt-5.x show none.
    // Defaulting unset configs to medium for the latter would send medium while the UI
    // shows none.
    extendParams.reasoning_effort =
      chatConfig.gpt5_2ReasoningEffort || (model === 'gpt-5.5' ? 'medium' : 'none');
  }

  if (modelExtendParams.includes('gpt5_2ProReasoningEffort')) {
    extendParams.reasoning_effort = 'high';
  }

  if (modelExtendParams.includes('grok4_20ReasoningEffort')) {
    extendParams.reasoning_effort = chatConfig.grok4_20ReasoningEffort || 'medium';
  }

  if (modelExtendParams.includes('grok4_3ReasoningEffort')) {
    extendParams.reasoning_effort = chatConfig.grok4_3ReasoningEffort || 'low';
  }

  if (modelExtendParams.includes('hy3ReasoningEffort')) {
    extendParams.reasoning_effort = chatConfig.hy3ReasoningEffort || 'high';
  }

  if (modelExtendParams.includes('codexMaxReasoningEffort')) {
    extendParams.reasoning_effort = chatConfig.codexMaxReasoningEffort || 'medium';
  }

  // DeepSeek reasoning effort is reconciled last to avoid invalid combinations.
  if (modelExtendParams.includes('deepseekV4ReasoningEffort')) {
    const deepseekV4ReasoningEffort = chatConfig.deepseekV4ReasoningEffort;

    if (typeof deepseekV4ReasoningEffort === 'string') {
      if (deepseekV4ReasoningEffort === 'none') {
        delete extendParams.reasoning_effort;
        extendParams.thinking = {
          type: 'disabled',
        };
      } else {
        extendParams.reasoning_effort = deepseekV4ReasoningEffort;
        extendParams.thinking = {
          type: 'enabled',
        };
      }
    }
  }

  if (modelExtendParams.includes('effort')) {
    extendParams.effort = chatConfig.effort || 'high';
  }

  if (modelExtendParams.includes('opus47Effort')) {
    extendParams.effort = chatConfig.opus47Effort || 'high';
  }

  // Text verbosity
  if (modelExtendParams.includes('textVerbosity') && chatConfig.textVerbosity) {
    extendParams.verbosity = chatConfig.textVerbosity;
  }

  // Thinking configuration
  if (modelExtendParams.includes('thinking') && chatConfig.thinking) {
    extendParams.thinking = { type: chatConfig.thinking };
  }

  if (modelExtendParams.includes('thinkingBudget') && chatConfig.thinkingBudget !== undefined) {
    extendParams.thinkingBudget = chatConfig.thinkingBudget;
  }

  const supportedThinkingLevelParams = modelExtendParams.filter(isThinkingLevelExtendParam);

  for (const supportedThinkingLevelParam of supportedThinkingLevelParams) {
    const value = chatConfig[supportedThinkingLevelParam];

    if (typeof value === 'string') {
      extendParams.thinkingLevel = value;
      break;
    }
  }

  if (!extendParams.thinkingLevel && supportedThinkingLevelParams.length > 0) {
    extendParams.thinkingLevel = resolveThinkingLevelDefault(
      model,
      supportedThinkingLevelParams[0],
    );
  }

  // URL context
  if (modelExtendParams.includes('urlContext') && chatConfig.urlContext) {
    extendParams.urlContext = chatConfig.urlContext;
  }

  // Image generation params
  if (modelExtendParams.includes('imageAspectRatio') && chatConfig.imageAspectRatio) {
    extendParams.imageAspectRatio = chatConfig.imageAspectRatio;
  }

  if (modelExtendParams.includes('imageAspectRatio2') && chatConfig.imageAspectRatio2) {
    extendParams.imageAspectRatio = chatConfig.imageAspectRatio2;
  }

  if (modelExtendParams.includes('imageResolution') && chatConfig.imageResolution) {
    extendParams.imageResolution = chatConfig.imageResolution;
  }

  if (modelExtendParams.includes('imageResolution2') && chatConfig.imageResolution2) {
    extendParams.imageResolution = chatConfig.imageResolution2;
  }

  return extendParams;
};
