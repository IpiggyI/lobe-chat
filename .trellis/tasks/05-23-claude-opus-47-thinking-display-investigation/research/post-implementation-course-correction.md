# Post-implementation course correction

> Date: 2026-06-04
> Evidence baseline: commit `a199d6a30f` (`fix: restore thinking display for Opus 4.6/4.7 and GPT-5.5`) plus current HEAD source inspection.

## Summary

This task's early research direction had a serious bias: it over-centered the problem on "GPT-5.5 does not send `reasoning_effort` unless the slider is manually changed". That observation was real but incomplete, and it led the investigation toward the slider/default-value layer too early.

The implemented fix proves the broader root cause was not a single GPT-5.5 `reasoning_effort` omission. The main repair surface was Anthropic:

- Opus 4.6/4.7 adaptive-only models now default to `thinking: { type: 'adaptive' }` when unset.
- Anthropic and Bedrock adaptive payloads now send `thinking.display: 'summarized'`.
- Opus 4.7 now gets `output_config.effort` through the `opus47Effort || 'high'` resolver default.
- GPT-5.5 regular only got `gpt5_2ReasoningEffort || 'medium'`, which is an explicit-default fix, not the dominant root cause.

Therefore "only GPT-5.5 was fixed" is false. A more precise statement is: only the `reasoning_effort` defaulting path was limited to regular GPT-5.5; the overall task fix primarily covered Opus 4.6/4.7 thinking enablement and display.

## Where the early direction went wrong

1. It treated absence of top-level `reasoning_effort` as a universal proxy for "no thinking". That is not valid across providers. OpenAI Responses can carry reasoning through `reasoning`, while Anthropic uses `thinking` plus `output_config.effort`.
2. It generalized the slider default-value bug too aggressively. `createLevelSlider` not writing defaults to store is a real mechanism, but it is not equally causal for every model. For Opus 4.7, the blocking bugs were adaptive thinking default-off and missing `display: 'summarized'`; `opus47Effort` was a strength/default issue layered on top.
3. It underestimated provider-layer post-processing. GPT-5.5 Pro is forced to `reasoning.effort = 'high'` in the OpenAI provider, so adding a resolver default of `medium` would have been a regression.
4. It framed the Trellis task as "research only, no implementation", but commit `a199d6a30f` implemented the repair directly. The task artifact state should be read as historical planning plus later implementation evidence, not as a still-pure research plan.

## Corrected interpretation by model path

| Model path | Correct default behavior after `a199d6a30f` | Notes |
|---|---|---|
| Opus 4.7 | Sends adaptive thinking by default, includes `display: 'summarized'`, and sends `output_config.effort: 'high'` unless user chooses another `opus47Effort`. | This is the main fix surface. |
| Opus 4.6 | Sends adaptive thinking by default. `display: 'summarized'` is now explicit and matches its expected visible-thinking behavior. | H2 affected 4.6 too. |
| GPT-5.5 regular | Sends `reasoning_effort: 'medium'` from resolver when unset; downstream Responses payload maps this into reasoning effort. | This only explicitizes the regular GPT-5.5 default. |
| GPT-5.5 Pro | Does not get resolver-default `reasoning_effort`; provider keeps force-high behavior. | Do not add resolver `medium` here. |
| Generic `reasoningEffort` models | Still require user config before `reasoning_effort` is emitted. | This was intentionally not globally changed. |

## Evidence anchors

- `src/services/chat/mecha/modelParamsResolver.ts`
  - `enableAdaptiveThinking`: adaptive-only models use `chatConfig.enableAdaptiveThinking ?? adaptiveOnly`.
  - `gpt5_2ReasoningEffort`: unset falls back to `'medium'`.
  - `opus47Effort`: unset falls back to `'high'`.
- `packages/model-runtime/src/core/anthropicCompatibleFactory/index.ts`
  - adaptive thinking payload now includes `display: 'summarized'`.
- `packages/model-runtime/src/providers/bedrock/index.ts`
  - Bedrock adaptive thinking payload now mirrors `display: 'summarized'`.
- `src/features/ModelSwitchPanel/components/ControlsForm/ControlsForm.tsx`
  - adaptive-only UI default is ON without persisting a store write.
- `packages/model-runtime/src/providers/openai/index.ts`
  - GPT-5 Pro-family chat path forces `reasoning.effort = 'high'`.

## Process lesson

For future thinking/reasoning regressions, do not start from a single field name. First build the provider-specific parameter chain:

1. model-bank `extendParams`
2. UI default display vs persisted `chatConfig`
3. `modelParamsResolver` output
4. provider/factory post-processing
5. final raw request body
6. stream parser/rendering path

The early task skipped too quickly from UI slider state to final behavior. That made the GPT-5.5 symptom look like the primary cause, while the Opus 4.6/4.7 Anthropic chain contained the heavier regression.
