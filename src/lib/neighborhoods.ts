import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { NEIGHBORHOOD_GROUPS } from "@/lib/site";

export type NeighborhoodCatalogItem = {
  name: string;
  groupTitle: string;
};

const sortFa = (a: NeighborhoodCatalogItem, b: NeighborhoodCatalogItem) =>
  a.name.localeCompare(b.name, "fa", { sensitivity: "base", numeric: true });

export const listNeighborhoodCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<NeighborhoodCatalogItem[]> => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ name: string; group_title: string }>(
        "select name, group_title from neighborhoods where is_active = true order by group_title asc, name asc",
      );
      if (rows.length) {
        return rows.map((row) => ({
          name: String(row.name),
          groupTitle: String(row.group_title),
        }));
      }
    } catch (error) {
      console.warn("[neighborhoods] database catalog unavailable; using bundled catalog", error);
    }

    return NEIGHBORHOOD_GROUPS.flatMap((group) =>
      group.items.map((item) => ({ name: item.name, groupTitle: group.title })),
    ).sort(sortFa);
  },
);

export const listNeighborhoodNames = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const catalog = await listNeighborhoodCatalog();
    return [...new Set(catalog.map((item) => item.name))];
  },
);
