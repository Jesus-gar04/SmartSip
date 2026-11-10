/**
 * Íconos de línea del manual (§6): trazo de 2 px, extremos redondeados,
 * cuadrícula de 24 px. Toman el color del texto (`currentColor`).
 */
import type { ReactNode, SVGProps } from 'react';

function Icono({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoGota = () => (
  <Icono>
    <path d="M12 3.5c-3.2 4.1-5.5 7.4-5.5 10.2a5.5 5.5 0 0 0 11 0c0-2.8-2.3-6.1-5.5-10.2z" />
  </Icono>
);

export const IconoTermometro = () => (
  <Icono>
    <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" />
    <path d="M12 9v6" />
  </Icono>
);

export const IconoBateria = () => (
  <Icono>
    <rect x="2.5" y="7" width="17" height="10" rx="2.5" />
    <path d="M22 10.5v3" />
  </Icono>
);

export const IconoRayo = () => (
  <Icono>
    <path d="M13 3 6 13.5h5L10 21l7-10.5h-5z" />
  </Icono>
);

export const IconoBluetooth = () => (
  <Icono>
    <path d="m7 7 10 10-5 4V3l5 4L7 17" />
  </Icono>
);

export const IconoReloj = () => (
  <Icono>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icono>
);

export const IconoTapa = () => (
  <Icono>
    <path d="M7 10h10v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20z" />
    <path d="M6.5 6.5 16 3.5l1 2.6-9.6 3z" />
  </Icono>
);

export const IconoCampana = () => (
  <Icono>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
  </Icono>
);

export const IconoTelefono = () => (
  <Icono>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icono>
);

export const IconoTermo = () => (
  <Icono>
    <rect x="8" y="2.5" width="8" height="4" rx="1" />
    <path d="M8 8h8v12a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20z" />
  </Icono>
);

export const IconoUbicacion = () => (
  <Icono>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icono>
);

export const IconoFlecha = ({ hacia }: { hacia: 'derecha' | 'izquierda' }) => (
  <Icono width="16" height="16" style={{ transform: hacia === 'izquierda' ? 'scaleX(-1)' : undefined }}>
    <path d="M4 12h15M14 7l5 5-5 5" />
  </Icono>
);
