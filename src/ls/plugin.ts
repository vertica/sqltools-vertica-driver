import { ILanguageServerPlugin } from '@sqltools/types';
import VerticaSQL from './driver';
import { DRIVER_ALIASES } from './../constants';

const VerticaDriverPlugin: ILanguageServerPlugin = {
  register(server) {
    DRIVER_ALIASES.forEach(({ value }) => {
      server.getContext().drivers.set(value, VerticaSQL);
    });
  }
}

export default VerticaDriverPlugin;