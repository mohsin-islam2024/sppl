import { useQuery } from "@tanstack/react-query";
import contentService from "../services/contentService.js";

/** Content query keys. */
export const contentKeys = {
  news: (season, page) => ["news", season ?? "all", page ?? 1],
  article: (slug) => ["news", "article", slug],
  gallery: (season, filters) => ["gallery", season ?? "all", filters ?? {}],
  videos: (season, page) => ["videos", season ?? "all", page ?? 1],
  sponsors: (season) => ["sponsors", season ?? "all"],
  awards: (season) => ["awards", season ?? "all"],
  announcements: (season) => ["announcements", season ?? "all"],
  stats: (season) => ["stats", season ?? "all"],
};

export function useNews({ season, page = 1, limit = 12 } = {}) {
  return useQuery({
    queryKey: contentKeys.news(season, page),
    queryFn: () => contentService.news({ season, page, limit }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useArticle(slug) {
  return useQuery({
    queryKey: contentKeys.article(slug),
    queryFn: () => contentService.article(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGallery({
  season,
  matchId,
  type,
  page = 1,
  limit = 24,
} = {}) {
  const filters = { matchId, type };
  return useQuery({
    queryKey: contentKeys.gallery(season, filters),
    queryFn: () =>
      contentService.gallery({ season, matchId, type, page, limit }),
    staleTime: 10 * 60 * 1000,
  });
}

export function useVideos({ season, page = 1, limit = 12 } = {}) {
  return useQuery({
    queryKey: contentKeys.videos(season, page),
    queryFn: () => contentService.videos({ season, page, limit }),
    staleTime: 10 * 60 * 1000,
  });
}

/** Sponsors, already grouped and ordered by tier on the server. */
export function useSponsors({ season } = {}) {
  return useQuery({
    queryKey: contentKeys.sponsors(season),
    queryFn: () => contentService.sponsors({ season }),
    staleTime: 30 * 60 * 1000,
  });
}

/** Awards, champion first. */
export function useAwards({ season } = {}) {
  return useQuery({
    queryKey: contentKeys.awards(season),
    queryFn: () => contentService.awards({ season }),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Live announcements for the ticker.
 */
export function useAnnouncements({ season } = {}) {
  return useQuery({
    queryKey: contentKeys.announcements(season),
    queryFn: () => contentService.announcements({ season }),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

/** Season leaderboards: most runs, most wickets, best rates, fielding. */
export function useSeasonStats({ season } = {}) {
  return useQuery({
    queryKey: contentKeys.stats(season),
    queryFn: () => contentService.stats({ season }),
    staleTime: 5 * 60 * 1000,
  });
}

export default useNews;
