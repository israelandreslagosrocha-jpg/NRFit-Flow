/** Recorre rangos de la API sin un límite total que oculte publicaciones. */
export async function readAllPortalRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  batchSize = 100,
): Promise<T[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('INVALID_PAGE_SIZE');
  const records = new Map<string, T>();
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + batchSize - 1);
    if (error || !Array.isArray(data)) throw new Error('PORTAL_DATA_UNAVAILABLE');
    if (!data.length) return [...records.values()];
    const before = records.size;
    for (const row of data) records.set(row.id, row);
    if (records.size === before) throw new Error('PORTAL_PAGINATION_DID_NOT_ADVANCE');
    // Avanza por filas recibidas, incluso si la API impone un tamaño menor.
    offset += data.length;
  }
}

export function visiblePortalItems<T>(items: T[], count: number) {
  return items.slice(0, count);
}
