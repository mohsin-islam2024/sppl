import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCurrentSeason, useSeasons } from "./useSeason.js";

/**
 * The season a page should display, resolved from the URL first.
 *
 * A visitor lands on the current season by default, but a shared link must keep its
 * season: `/fixtures?season=sppl-1-2026` has to stay on Season 1 after a refresh, or
 * a link to last year's result silently shows this year's empty fixtures.
 *
 * The hook returns everything a page needs to render a switcher and to fetch its own
 * data: the resolved season, the list of all seasons, and setters.
 */
export function useActiveSeason() {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("season");

  const {
    data: currentSeason,
    isLoading: currentLoading,
    error: currentError,
  } = useCurrentSeason();
  const { data: seasons = [], isLoading: seasonsLoading } = useSeasons();

  /**
   * Resolve the requested slug against the season list.
   *
   * If the URL names a season that does not exist we fall back to the current one
   * rather than throwing — a stale bookmark should still render something.
   */
  const activeSeason = useMemo(() => {
    if (!requested) return currentSeason ?? null;
    const match = seasons.find(
      (season) =>
        season.slug === requested || String(season.id) === String(requested),
    );
    return match ?? currentSeason ?? null;
  }, [requested, seasons, currentSeason]);

  /** The slug used in requests and in the URL. */
  const identifier = activeSeason?.slug ?? null;

  /** True when the URL named a season that could not be resolved. */
  const requestedSeasonMissing =
    Boolean(requested) &&
    !seasonsLoading &&
    !seasons.some(
      (season) =>
        season.slug === requested || String(season.id) === String(requested),
    );

  const setSeason = (slug) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (slug) next.set("season", slug);
        else next.delete("season");
        return next;
      },
      // Keep the other filters (status, stage) and do not stack history entries
      // for what is really one control.
      { replace: true },
    );
  };

  return {
    season: activeSeason,
    identifier,
    seasons,
    setSeason,
    isLoading: currentLoading || seasonsLoading,
    error: currentError,
    requestedSeasonMissing,
    /** True when the resolved season has dates and can therefore show a countdown. */
    hasSchedule: Boolean(activeSeason?.startDate && activeSeason?.endDate),
    /** True when the season is over — the archive view. */
    isArchived: activeSeason?.status === "COMPLETED",
  };
}

export default useActiveSeason;
