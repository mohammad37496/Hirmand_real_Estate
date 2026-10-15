export type DivarCatalogEntry = {
  id: string | number;
  name: string;
  slug: string;
  second_slug?: string | null;
  default_location: { latitude: number; longitude: number };
  bbox?: readonly number[];
};

export type DirectoryNeighborhood = {
  name: string;
  address?: string;
  searchQuery?: string;
  lat?: number;
  lng?: number;
  label?: string;
  divarDistrictId?: string;
  divarSlug?: string;
  divarBbox?: [number, number, number, number];
};

export const DIVAR_EXTRA_AREA_GROUP = "سایر محدوده‌های ثبت‌شده از دیوار";

export function normalizeAreaDirectoryKey(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e]/g, "")
    .toLocaleLowerCase("fa")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function nameKeys(value: string): string[] {
  return [...new Set(String(value ?? "").split(/[\/،؛|]/).map(normalizeAreaDirectoryKey).filter(Boolean))];
}

function safeBbox(value: readonly number[] | undefined): [number, number, number, number] | undefined {
  if (!value || value.length !== 4 || !value.every(Number.isFinite)) return undefined;
  const [west, south, east, north] = value;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return undefined;
  return [west, south, east, north];
}

/** Enrich curated items, preserve every unmatched curated place, and add all remaining Divar records. */
export function mergeNeighborhoodGroups(
  curatedGroups: readonly { title: string; items: readonly DirectoryNeighborhood[] }[],
  catalog: readonly DivarCatalogEntry[],
): Array<{ title: string; items: DirectoryNeighborhood[] }> {
  const byName = new Map<string, DivarCatalogEntry[]>();
  for (const district of catalog) {
    for (const key of nameKeys(district.name)) byName.set(key, [...(byName.get(key) ?? []), district]);
  }
  const usedIds = new Set<string>();
  const result = curatedGroups.map(group => ({
    title: group.title,
    items: group.items.map(item => {
      const matches = nameKeys(item.name).flatMap(key => byName.get(key) ?? []);
      const uniqueMatches = [...new Map(matches.map(match => [String(match.id), match])).values()];
      const match = uniqueMatches.length === 1 && !usedIds.has(String(uniqueMatches[0].id))
        ? uniqueMatches[0] : undefined;
      if (!match) return { ...item };
      usedIds.add(String(match.id));
      const lat = Number(match.default_location?.latitude);
      const lng = Number(match.default_location?.longitude);
      const bbox = safeBbox(match.bbox);
      const hasCoordinates = Number.isFinite(lat) && Math.abs(lat) <= 90 &&
        Number.isFinite(lng) && Math.abs(lng) <= 180;
      return {
        ...item,
        ...(hasCoordinates ? { lat, lng } : {}),
        divarDistrictId: String(match.id),
        divarSlug: match.slug,
        ...(bbox ? { divarBbox: bbox } : {}),
      };
    }),
  }));

  const slugs = new Set(result.flatMap(group => group.items.map(item => item.divarSlug).filter((v): v is string => Boolean(v))));
  const extras = catalog.filter(district => !usedIds.has(String(district.id)))
    .sort((a,b) => a.name.localeCompare(b.name, "fa", { sensitivity: "base", numeric: true }))
    .map((district): DirectoryNeighborhood => {
      const lat = Number(district.default_location?.latitude);
      const lng = Number(district.default_location?.longitude);
      const bbox = safeBbox(district.bbox);
      const hasCoordinates = Number.isFinite(lat) && Math.abs(lat) <= 90 &&
        Number.isFinite(lng) && Math.abs(lng) <= 180;
      let slug = district.slug || normalizeAreaDirectoryKey(district.name);
      if (slugs.has(slug)) slug = slug + "-" + district.id;
      slugs.add(slug);
      return {
        name: district.name,
        address: district.name + "، اصفهان",
        searchQuery: district.name + "، اصفهان، ایران",
        label: district.name,
        ...(hasCoordinates ? { lat, lng } : {}),
        divarDistrictId: String(district.id),
        divarSlug: district.slug,
        ...(bbox ? { divarBbox: bbox } : {}),
      };
    });
  if (extras.length) result.push({ title: DIVAR_EXTRA_AREA_GROUP, items: extras });
  return result;
}
