type DiscordUserLike = {
  globalName?: string | null;
  username?: string | null;
  id?: string | null;
};

type DiscordNameSource = {
  displayName?: string | null;
  nickname?: string | null;
  nick?: string | null;
  user?: DiscordUserLike | null;
  globalName?: string | null;
  username?: string | null;
  id?: string | null;
};

const getPreferredDiscordName = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate;
    }
  }

  return null;
};

const resolveDiscordDisplayName = (source: DiscordNameSource) =>
  getPreferredDiscordName(
    source.displayName,
    source.nickname,
    source.nick,
    source.user?.globalName,
    source.globalName,
    source.user?.username,
    source.username,
    source.user?.id,
    source.id,
  ) ?? 'unknown';

const hasDiscordDisplayNameChanged = (previous: DiscordNameSource, next: DiscordNameSource) =>
  resolveDiscordDisplayName(previous) !== resolveDiscordDisplayName(next);

export { hasDiscordDisplayNameChanged, resolveDiscordDisplayName };
