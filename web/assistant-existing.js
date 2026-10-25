// Guided timing is shared by every item; never silently flatten a mixed playlist.
export function existingPlaylistPlan(screen, readyIds) {
  const items = screen?.playlist ?? (screen?.mediaId ? [{ mediaId: screen.mediaId, duration: 10 }] : []);
  if (!items.length) return { error: 'This screen has no Playlist 1 yet. Choose media below to create one.' };
  const ids = items.map(item => item.mediaId);
  if (ids.length > 20 || new Set(ids).size !== ids.length)
    return { error: 'This playlist has repeated media or too many items for guided planning. Use the screen’s playlist editor to keep every slot.' };
  if (ids.some(id => !readyIds.includes(id)))
    return { error: 'Some playlist media is unavailable in this library. Refresh the library and screen status before trying again. Nothing was selected.' };
  const first = items[0], schedule = first.schedule ?? null;
  const timing = item => JSON.stringify({ duration: item.duration, schedule: item.schedule
    ? { ...item.schedule, days: [...item.schedule.days].sort() } : null });
  if (schedule?.startDate || schedule?.endDate || items.some(item => timing(item) !== timing(first)))
    return { error: 'This playlist uses different item timings or campaign dates. Use the screen’s playlist editor to preserve those details.' };
  return { ids, duration: first.duration, schedule };
}
