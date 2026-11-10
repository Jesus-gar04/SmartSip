# NivelDelDia

La pieza central de la app: el agua `azul` sube desde abajo hasta el porcentaje de la meta, con la ola de dos capas (`bruma` detrás y `azul` delante) como frontera con el `papel`.

- Altura del agua = consumo ÷ meta. Al 100 % la pantalla es azul entera.
- La `cifra` va en blanco dentro del agua. Si el agua aún no la alcanza, flota encima de la ola en `tinta`.
- Con cada sorbo: la ola sube con un resorte (600 ms), suben de una a tres burbujas y la cifra rueda.
- La ola se mece en un ciclo de 6 s; con "Reducir movimiento", queda quieta.
- Quien la usa aporta: consumo, meta y la frase de estado.
