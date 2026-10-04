import type { Country } from "../lib/types";
import Flag from "./Flag";

/** Your flag and name in the menu header; opens the editor. */
export default function PlayerCard({
  name,
  country,
  onEdit,
}: {
  name: string;
  country: Country | null;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      title="Edit your name and flag"
      aria-label={name ? `Playing as ${name}. Edit` : "Set your name"}
      className="brut h-11 min-w-0 flex items-stretch bg-white hover:bg-accent transition-colors"
    >
      <span className="flex items-center px-2.5 border-r-3 border-black">
        <Flag country={country} height={20} />
      </span>
      <span className="flex items-center px-3 min-w-0">
        {name ? (
          <span className="font-display text-base tracking-tight uppercase truncate max-w-[9rem] sm:max-w-[14rem]">
            {name}
          </span>
        ) : (
          <span className="text-[11px] font-bold tracking-[0.12em]">SET YOUR NAME</span>
        )}
      </span>
      <span className="flex items-center px-2.5 border-l-3 border-black font-bold" aria-hidden="true">
        ✎
      </span>
    </button>
  );
}
