// La misma batería de contrato que corre contra el repositorio en memoria.
import { contratoRepositorio } from '../../core/test/contrato-repositorio.ts';
import { RepositorioFirestore } from '../src/index.ts';
import { usuarioDePrueba } from './apoyo.ts';

contratoRepositorio('Firestore en el emulador', async () => {
  const { servicios, uid } = await usuarioDePrueba();
  return { repo: new RepositorioFirestore(servicios.db, uid), limpiar: () => servicios.cerrar() };
});
