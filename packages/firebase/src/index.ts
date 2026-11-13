/**
 * smartsip-firebase: implementaciones del núcleo sobre Firebase.
 * La app usa las interfaces de smartsip-core; este paquete solo se conecta
 * al arrancar.
 */
export { CuentaFirebase, traducirErrorAuth } from './cuenta-firebase.ts';
export { AvisosFirebase, deRitmo, idDispositivo, type SuscripcionPush } from './avisos-firebase.ts';
export { PuenteTermoFirestore, TransporteFirestore } from './canal-firestore.ts';
export { COLECCION } from './documentos.ts';
export { COLECCION_CANALES, COLECCION_EMPAREJAMIENTOS, EmparejamientoFirebase } from './emparejamiento-firebase.ts';
export {
  configDesdeEntorno,
  EMULADOR_LOCAL,
  iniciarFirebase,
  type ConfigFirebase,
  type Emulador,
  type OpcionesFirebase,
  type ServiciosFirebase,
} from './iniciar.ts';
export { RepositorioFirestore } from './repositorio-firestore.ts';
export { COLECCION_PREVENTA, COLECCION_RESERVAS, ReservasFirebase } from './reservas-firebase.ts';
