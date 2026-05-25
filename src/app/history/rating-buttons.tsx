"use client";

// Three little rating buttons per draft row. Click toggles — clicking an
// active rating clears it back to unrated.

import { useState, useTransition } from "react";
import { Star, ThumbsDown, Minus, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { setRatingAction } from "./actions";
import type { DraftRating } from "@/lib/history";

type Props = {
  draftId: number;
  currentRating: DraftRating | null;
};

export function RatingButtons({ draftId, currentRating }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Optimistic local rating so the UI flips instantly while the server action runs.
  const [optimistic, setOptimistic] = useState<DraftRating | null>(currentRating);

  const handleClick = (rating: DraftRating) => {
    // Toggle behaviour: clicking the active rating clears it.
    const next: DraftRating | null = optimistic === rating ? null : rating;
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      const r = await setRatingAction(draftId, next);
      if (!r.ok) {
        setError(r.error);
        setOptimistic(currentRating); // revert
      }
    });
  };

  return (
    <div className="flex items-center gap-0.5">
      <RatingButton
        active={optimistic === "star"}
        onClick={() => handleClick("star")}
        disabled={pending}
        ariaLabel="Star — this worked"
        activeClass="text-wyco-lime"
      >
        <Star className={cn("size-4", optimistic === "star" && "fill-current")} />
      </RatingButton>
      <RatingButton
        active={optimistic === "neutral"}
        onClick={() => handleClick("neutral")}
        disabled={pending}
        ariaLabel="Neutral — fine but not noteworthy"
        activeClass="text-foreground"
      >
        <Minus className="size-4" />
      </RatingButton>
      <RatingButton
        active={optimistic === "flop"}
        onClick={() => handleClick("flop")}
        disabled={pending}
        ariaLabel="Flop — this didn't work"
        activeClass="text-destructive"
      >
        <ThumbsDown className="size-4" />
      </RatingButton>

      {pending && (
        <Loader2 className="size-3 animate-spin text-muted-foreground ml-1" />
      )}
      {error && (
        <span className="text-xs text-destructive ml-2" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}

type RatingButtonProps = {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  activeClass: string;
  children: React.ReactNode;
};

function RatingButton({
  active,
  onClick,
  disabled,
  ariaLabel,
  activeClass,
  children,
}: RatingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 transition-colors disabled:opacity-50",
        active
          ? activeClass
          : "text-muted-foreground/40 hover:text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
