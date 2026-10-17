'use client';

export default function PortalError({ reset }: { reset: () => void }) {
  return <section role="alert" style={{ padding: 24 }}>
    <h2>No pudimos cargar tu portal</h2>
    <p>No significa que se hayan eliminado tus clases o avisos. Intenta cargar nuevamente.</p>
    <button type="button" onClick={reset}>Volver a intentar</button>
  </section>;
}
