/**
 * El termo escribe el código que muestra la app y queda unido a esa cuenta.
 * Así el celular con la app y el que hace de termo pueden ser dos distintos.
 */
import { useState, type FormEvent } from 'react';
import { ErrorEmparejamiento, esCodigoValido, formatoCodigo, limpiarCodigo } from 'smartsip-core';
import {
  emparejarTermo,
  leerEmparejamiento,
  olvidarEmparejamiento,
  type EmparejamientoTermo,
} from '../simulacion/emparejar.ts';
import { Boton, Tarjeta } from '../ui/controles.tsx';
import { IconoTelefono } from '../ui/iconos.tsx';

export function TarjetaEmparejar() {
  const [actual, setActual] = useState<EmparejamientoTermo | null>(leerEmparejamiento);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      setActual(await emparejarTermo(codigo));
      setCodigo('');
      // El termo se reinicia unido a la app: ahora ella sincroniza.
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      setError(err instanceof ErrorEmparejamiento ? err.message : 'No se pudo emparejar. Revisa la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta
      icono={<IconoTelefono />}
      titulo="Emparejar"
      explica="Escribe el código de 6 números que muestra la app en el celular. El termo queda unido a esa cuenta."
      lectura={<span className="lectura-estado">{actual ? 'Unido' : 'Sin app'}</span>}
    >
      {actual ? (
        <>
          <p className="consola-nota cifras">Unido con el código {formatoCodigo(actual.codigo)}.</p>
          <Boton
            onClick={() => {
              olvidarEmparejamiento();
              setActual(null);
              location.reload();
            }}
          >
            Desemparejar
          </Boton>
        </>
      ) : (
        <form className="emparejar-form" onSubmit={(e) => void enviar(e)}>
          <label className="visualmente-oculto" htmlFor="codigo-termo">
            Código de la app
          </label>
          <input
            id="codigo-termo"
            className="codigo-entrada cifras"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            value={formatoCodigo(codigo)}
            onChange={(e) => setCodigo(limpiarCodigo(e.target.value))}
          />
          <Boton type="submit" disabled={enviando || !esCodigoValido(codigo)}>
            {enviando ? 'Emparejando…' : 'Emparejar'}
          </Boton>
          {error && (
            <p className="consola-nota consola-nota-aviso" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </Tarjeta>
  );
}
