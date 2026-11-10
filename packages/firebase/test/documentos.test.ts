import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { configDesdeEntorno } from '../src/index.ts';
import { aDocTermo, deDia, deTermo } from '../src/documentos.ts';

describe('configDesdeEntorno', () => {
  const completo = {
    VITE_FIREBASE_API_KEY: 'k',
    VITE_FIREBASE_AUTH_DOMAIN: 'p.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'p',
    VITE_FIREBASE_APP_ID: 'a',
  };

  it('lee las variables y omite las opcionales vacías', () => {
    expect(configDesdeEntorno({ ...completo, VITE_FIREBASE_STORAGE_BUCKET: ' ' })).toEqual({
      apiKey: 'k',
      authDomain: 'p.firebaseapp.com',
      projectId: 'p',
      appId: 'a',
    });
    expect(
      configDesdeEntorno({ ...completo, VITE_FIREBASE_STORAGE_BUCKET: 'b', VITE_FIREBASE_MESSAGING_SENDER_ID: '1' }),
    ).toMatchObject({ storageBucket: 'b', messagingSenderId: '1' });
  });

  it('dice qué variables faltan', () => {
    expect(() => configDesdeEntorno({ VITE_FIREBASE_API_KEY: 'k' })).toThrow(
      /VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID/,
    );
  });
});

describe('documentos', () => {
  it('un día a medio escribir se completa con ceros', () => {
    const d = deDia('2026-11-09', { fecha: '2026-11-09', metaMl: 2600, porHora: { '08': 40 } });
    expect(d).toMatchObject({ totalMl: 0, sorbos: 0, metaMl: 2600, climaC: null });
    expect(d.porHora[8]).toBe(40);
    expect(d.porHora).toHaveLength(24);
  });

  it('el termo sin datos queda en nulos', () => {
    expect(deTermo('SS-1', {})).toEqual({
      termoId: 'SS-1',
      nombre: null,
      capacidadMl: null,
      firmware: null,
      bateria: null,
      temperaturaC: null,
      ultimoVisto: null,
    });
    expect(deTermo('SS-1', { ultimoVisto: { en: Timestamp.fromMillis(5) } }).ultimoVisto).toEqual({ enMs: 5, lugar: null });
  });

  it('solo escribe del termo los campos presentes', () => {
    const d = aDocTermo({ termoId: 'SS-1', bateria: 0.5 });
    expect(Object.keys(d).sort()).toEqual(['actualizadoEn', 'bateria']);
    expect(aDocTermo({ termoId: 'SS-1', ultimoVisto: null })['ultimoVisto']).toBeNull();
  });
});
