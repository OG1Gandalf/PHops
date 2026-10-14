"use client";

import { useTranslations } from "next-intl";

import { useApp } from "@/components/AppProvider";
import { useToast } from "@/components/ToastProvider";
import { Icon } from "@/components/ui/Icon";

/** Heart toggle for saving a pandal on this device. */
export function SaveButton({
  pandalId,
  name,
  className = "",
}: {
  pandalId: string;
  name: string;
  className?: string;
}) {
  const t = useTranslations("saved");
  const { saved, toggleSaved } = useApp();
  const toast = useToast();
  const on = saved.has(pandalId);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t("removeLabel", { name }) : t("saveLabel", { name })}
      onClick={(e) => {
        e.stopPropagation();
        const nowSaved = toggleSaved(pandalId);
        toast(
          nowSaved
            ? { emoji: "❤️", text: t("toastSaved", { name }), tone: "good" }
            : { emoji: "👋", text: t("toastRemoved", { name }) },
        );
      }}
      className={`grid shrink-0 place-items-center rounded-full border border-line bg-surface-2 hover:bg-surface-3 size-11 ${
        on ? "text-brand" : "text-muted"
      } ${className}`}
    >
      <Icon
        name="heart"
        className={`size-5 ${on ? "heart-on" : ""}`}
        fill={on ? "currentColor" : "none"}
        key={on ? "on" : "off"}
      />
    </button>
  );
}
