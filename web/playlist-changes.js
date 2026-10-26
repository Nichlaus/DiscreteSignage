const timing = schedule => schedule ? JSON.stringify({ days: [...schedule.days].sort(), start: schedule.start,
  end: schedule.end, startDate: schedule.startDate ?? null, endDate: schedule.endDate ?? null }) : '';

export function playlistChanges(before, after) {
  const remaining = before.map((item, index) => ({ item, index }));
  const added = [], matched = [];
  after.forEach((item, index) => {
    const found = remaining.findIndex(entry => entry.item.mediaId === item.mediaId);
    if (found < 0) added.push({ item, index });
    else matched.push({ before: remaining.splice(found, 1)[0], after: { item, index } });
  });
  const originalOrder = matched.map(entry => entry.before.index).sort((a, b) => a - b);
  return { added, removed: remaining,
    reordered: matched.some((entry, index) => entry.before.index !== originalOrder[index]),
    changed: matched.filter(entry => timing(entry.before.item.schedule) !== timing(entry.after.item.schedule)
      || entry.before.item.duration !== entry.after.item.duration).map(entry => ({ ...entry,
        scheduleChanged: timing(entry.before.item.schedule) !== timing(entry.after.item.schedule),
        durationChanged: entry.before.item.duration !== entry.after.item.duration })) };
}
