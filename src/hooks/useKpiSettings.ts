"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_KPI_WEIGHTS } from "@/types";
import type { KpiUserSettings } from "@/types";

function rowToSettings(row: Record<string, unknown>): KpiUserSettings {
  return {
    id: row.user_id as string,
    resultWeight: (row.result_weight as number) ?? DEFAULT_KPI_WEIGHTS.result,
    activityWeight: (row.activity_weight as number) ?? DEFAULT_KPI_WEIGHTS.activity,
    qualityWeight: (row.quality_weight as number) ?? DEFAULT_KPI_WEIGHTS.quality,
    updatedAt: row.updated_at as KpiUserSettings["updatedAt"],
    updatedBy: "",
  };
}

export function useKpiSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<KpiUserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("kpi_settings")
        .select("*")
        .eq("user_id", userId!)
        .single();
      setSettings(data ? rowToSettings(data as Record<string, unknown>) : null);
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`kpi_settings_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kpi_settings", filter: `user_id=eq.${userId}` },
        fetch
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId]);

  const weights = settings
    ? { result: settings.resultWeight, activity: settings.activityWeight, quality: settings.qualityWeight }
    : { result: DEFAULT_KPI_WEIGHTS.result, activity: DEFAULT_KPI_WEIGHTS.activity, quality: DEFAULT_KPI_WEIGHTS.quality };

  return { settings, weights, isLoading };
}

export function useAllKpiSettings() {
  const [settingsMap, setSettingsMap] = useState<Record<string, KpiUserSettings>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase.from("kpi_settings").select("*");
      const map: Record<string, KpiUserSettings> = {};
      (data ?? []).forEach((row) => {
        const s = rowToSettings(row as Record<string, unknown>);
        map[s.id] = s;
      });
      setSettingsMap(map);
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel("kpi_settings_all")
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_settings" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  function getWeights(userId: string) {
    const s = settingsMap[userId];
    return s
      ? { result: s.resultWeight, activity: s.activityWeight, quality: s.qualityWeight }
      : { result: DEFAULT_KPI_WEIGHTS.result, activity: DEFAULT_KPI_WEIGHTS.activity, quality: DEFAULT_KPI_WEIGHTS.quality };
  }

  return { settingsMap, getWeights, isLoading };
}
