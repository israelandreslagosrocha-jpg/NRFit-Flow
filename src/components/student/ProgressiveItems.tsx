'use client';

import { useId, useState, type ReactNode } from 'react';
import { visiblePortalItems } from '../../lib/portal-pagination';

/** Cada instancia mantiene su propia página: videos, repeticiones, recursos y avisos. */
export default function ProgressiveItems<T>({ items, renderItem, label, pageSize = 6 }: {
  items: T[]; renderItem: (item: T) => ReactNode; label: string; pageSize?: number;
}) {
  const [visible, setVisible] = useState(pageSize);
  const statusId = useId();
  return <>{visiblePortalItems(items, visible).map(renderItem)}
    {items.length > pageSize && <div className="portal-load-more">
      <p id={statusId} role="status" aria-live="polite">Mostrando {Math.min(visible, items.length)} de {items.length} {label}</p>
      {visible < items.length && <button type="button" aria-describedby={statusId} onClick={() => setVisible((count) => count + pageSize)}>Cargar más {label}</button>}
    </div>}
  </>;
}
