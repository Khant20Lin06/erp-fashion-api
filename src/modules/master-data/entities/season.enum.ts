/**
 * Deliberately NOT a standalone entity/table (Phase 09 §7, LOCKED) — no
 * Season admin page, API, or standalone-entity evidence exists in the
 * frontend; Collection is the only place season classification is used.
 */
export enum Season {
  SpringSummer = 'SPRING_SUMMER',
  AutumnWinter = 'AUTUMN_WINTER',
  AllSeason = 'ALL_SEASON',
}
