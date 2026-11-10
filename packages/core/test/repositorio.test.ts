import { contratoRepositorio } from './contrato-repositorio.ts';
import { RepositorioEnMemoria } from '../src/index.ts';

contratoRepositorio('en memoria', async () => ({ repo: new RepositorioEnMemoria() }));
