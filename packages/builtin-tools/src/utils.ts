/**
 * Filter tool IDs by removing any that are in the disabled set.
 * Shared between frontend and server to ensure consistent behavior.
 */
export const filterDisabledToolIds = (toolIds: string[], disabledIds: string[]): string[] => {
  if (!disabledIds.length) return toolIds;
  const disabledSet = new Set(disabledIds);
  return toolIds.filter((id) => !disabledSet.has(id));
};
