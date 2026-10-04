import type { Country } from "../lib/types";

/**
 * A country flag at a fixed height (3:2), outlined like everything else.
 * With no country it's a dashed placeholder of the same size.
 */
export default function Flag({ country, height = 20 }: { country: Country | null | undefined; height?: number }) {
  const width = Math.round(height * 1.5);
  if (!country) {
    return (
      <span
        aria-hidden="true"
        className="block shrink-0 border-2 border-dashed border-black"
        style={{ width, height }}
      />
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w80/${country.code}.png`}
      srcSet={`https://flagcdn.com/w160/${country.code}.png 2x`}
      alt={country.name}
      title={country.name}
      loading="lazy"
      style={{ width, height }}
      className="block shrink-0 border-2 border-black object-cover bg-white"
    />
  );
}
