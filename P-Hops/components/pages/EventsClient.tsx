"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useApp } from "@/components/AppProvider";
import { PlacesMap } from "@/components/map/PlacesMap";
import { Away, DirectionLinks, Unverified } from "@/components/PlaceBits";
import { Chip, ChipRow, SelectField, Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { PUJA_DATE_BY_DAY, PUJA_DATES_APPROXIMATE, PUJA_DAYS, TIMEZONE } from "@/config/puja";
import { EVENTS, PANDAL_BY_ID } from "@/lib/data";
import { kolkataToday } from "@/lib/timeSlot";
import type { PujaDay, PujaEvent } from "@/lib/types";

const DAY_KEYS = PUJA_DAYS.map((d) => d.key) as PujaDay[];
const AREAS = [...new Set(EVENTS.map((e) => e.area))].sort((a, b) => a.localeCompare(b));
const FIRST_DATE = PUJA_DAYS[0].date;
const LAST_DATE = PUJA_DAYS[PUJA_DAYS.length - 1].date;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export function EventsClient() {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const format = useFormatter();
  const [day, setDay] = useState<"all" | PujaDay>("all");
  const [area, setArea] = useState("all");
  const [view, setView] = useState<"list" | "map">("list");

  // "today" in Asia/Kolkata, known only after mount (the page is prerendered, so the server cannot know it)
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the clock once after hydration
    setToday(kolkataToday());
  }, []);
  const phase = today === null ? null : today < FIRST_DATE ? "before" : today > LAST_DATE ? "after" : "during";

  const filtered = useMemo(
    () =>
      EVENTS.filter((e) => (day === "all" || e.day === day) && (area === "all" || e.area === area)).sort(
        (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
      ),
    [day, area],
  );

  // timeline grouped by Puja day (Dashami and Bhasan share a date but are separate headings)
  const groups = useMemo(() => {
    const m = new Map<PujaDay, PujaEvent[]>();
    for (const e of filtered) m.set(e.day, [...(m.get(e.day) ?? []), e]);
    return [...m.entries()];
  }, [filtered]);

  const fmtDate = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00+05:30`), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: TIMEZONE,
    });
  const fmtShort = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00+05:30`), { day: "numeric", month: "short", timeZone: TIMEZONE });

  return (
    <>
      {PUJA_DATES_APPROXIMATE && (
        <p className="flex gap-2 rounded-2xl border border-[var(--gold)] bg-[var(--gold-soft)] p-3 text-sm font-medium text-ink">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" />
          {t("datesBanner", { start: fmtShort(FIRST_DATE), end: fmtShort(PUJA_DATE_BY_DAY.dashami) })}
        </p>
      )}
      {phase === "before" && today && (
        <p role="status" className="rounded-2xl bg-brand-soft p-3 text-sm font-medium text-ink">
          {t("beforeWindow", { days: dayNumber(FIRST_DATE) - dayNumber(today) })}
        </p>
      )}
      {phase === "after" && (
        <p role="status" className="rounded-2xl bg-surface-3 p-3 text-sm font-medium text-ink">
          {t("afterWindow")}
        </p>
      )}

      <ChipRow label={t("dayFilter")}>
        <Chip pressed={day === "all"} onClick={() => setDay("all")}>
          {t("allDays")}
        </Chip>
        {DAY_KEYS.map((d) => (
          <Chip key={d} pressed={day === d} onClick={() => setDay(d)}>
            {t(`days.${d}`)}
            {today === PUJA_DATE_BY_DAY[d] ? ` · ${t("today")}` : ""}
          </Chip>
        ))}
      </ChipRow>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <SelectField
          className="min-w-44 flex-1 sm:max-w-xs"
          label={t("areaFilter")}
          value={area}
          onChange={setArea}
          options={[{ value: "all", label: t("allAreas") }, ...AREAS.map((a) => ({ value: a, label: a }))]}
        />
        <Segmented
          label={tc("view")}
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: tc("list"), icon: "list" },
            { value: "map", label: tc("map"), icon: "map" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink">{t("empty")}</p>
      ) : view === "map" ? (
        <>
          <p className="text-sm text-muted">{t("pinnedOnMap")}</p>
          <PlacesMap events={filtered} />
        </>
      ) : (
        <ol className="space-y-6">
          {groups.map(([dayKey, list]) => (
            <li key={dayKey}>
              <h2 className="sticky top-[var(--header-h)] z-10 -mx-4 border-b border-line bg-[var(--surface)]/95 px-4 py-2 backdrop-blur">
                <span className="text-lg font-extrabold text-ink">{t(`days.${dayKey}`)}</span>{" "}
                <span className="text-sm font-medium text-muted">
                  {PUJA_DATES_APPROXIMATE ? t("dateApprox", { date: fmtDate(list[0].date) }) : fmtDate(list[0].date)}
                </span>
                {today === list[0].date && (
                  <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink">{t("today")}</span>
                )}
              </h2>
              <ul className="relative mt-3 space-y-3 border-l-2 border-line pl-4">
                {list.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <Unverified />
    </>
  );
}

function EventCard({ e }: { e: PujaEvent }) {
  const t = useTranslations("events");
  const { selectPandal } = useApp();
  const pandal = e.pandalId ? PANDAL_BY_ID.get(e.pandalId) : undefined;
  return (
    <li className="relative rounded-2xl border border-line bg-surface p-3.5">
      <span className="absolute -left-[1.4rem] top-4 size-3 rounded-full border-2 border-surface bg-brand" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold text-ink">
          <Icon name="clock" className="size-3.5" />
          {t("timeRange", { start: e.startTime, end: e.endTime })}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            e.confirmed ? "bg-[var(--crowd-low-bg)] text-[var(--crowd-low)]" : "bg-[var(--gold-soft)] text-[var(--gold)]"
          }`}
        >
          {e.confirmed ? t("confirmed") : t("toConfirm")}
        </span>
        <Away to={e} className="ml-auto" />
      </div>
      <h3 className="mt-2 text-base font-bold leading-snug text-ink">{e.title}</h3>
      <p className="mt-1 text-sm leading-snug text-muted">{e.description}</p>
      <p className="mt-2 text-sm text-ink">
        <span className="font-semibold">{t("location")}:</span> {e.locationName}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pandal && (
          <button
            type="button"
            onClick={() => selectPandal(pandal.id)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
          >
            <Icon name="temple" className="size-4" />
            {t("linkedPandal")}: {pandal.name}
          </button>
        )}
        <DirectionLinks name={e.locationName} lat={e.lat} lng={e.lng} />
      </div>
    </li>
  );
}
