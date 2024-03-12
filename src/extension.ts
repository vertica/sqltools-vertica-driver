import * as vscode from 'vscode';
import { IExtension, IExtensionPlugin, IDriverExtensionApi } from '@sqltools/types';
import { ExtensionContext, authentication } from 'vscode';
import { DRIVER_ALIASES } from './constants';
const { publisher, name, displayName } = require('../package.json');
const AUTHENTICATION_PROVIDER = 'sqltools-driver-credentials';

export async function activate(extContext: ExtensionContext): Promise<IDriverExtensionApi> {
  const sqltools = vscode.extensions.getExtension<IExtension>('mtxr.sqltools');
  if (!sqltools) {
    throw new Error('SQLTools not installed');
  }
  await sqltools.activate();

  const api = sqltools.exports;

  const extensionId = `${publisher}.${name}`;
  const plugin: IExtensionPlugin = {
    extensionId,
    name: `${displayName} Plugin`,
    type: 'driver',
    async register(extension) {
      // register ext part here
      extension.resourcesMap().set(`driver/${DRIVER_ALIASES[0].value}/icons`, {
        active: extContext.asAbsolutePath('icons/active.png'),
        default: extContext.asAbsolutePath('icons/default.png'),
        inactive: extContext.asAbsolutePath('icons/inactive.png'),
      });
      DRIVER_ALIASES.forEach(({ value }) => {
        extension.resourcesMap().set(`driver/${value}/extension-id`, extensionId);
        extension
          .resourcesMap()
          .set(`driver/${value}/connection-schema`, extContext.asAbsolutePath('connection.schema.json'));
        extension.resourcesMap().set(`driver/${value}/ui-schema`, extContext.asAbsolutePath('ui.schema.json'));
      });
      await extension.client.sendRequest('ls/RegisterPlugin', { path: extContext.asAbsolutePath('out/ls/plugin.js') });
    },
  };
  api.registerPlugin(plugin);
  return {
    driverName: displayName,
    parseBeforeSaveConnection: ({ connInfo }) => {
      /**
       * This hook is called before saving the connection using the assistant
       * so you can do any transformations before saving it to disk.active
       * EG: relative file path transformation, string manipulation etc
       */
      const propsToRemove = ['connectionMethod', 'id', 'usePassword'];
      if (connInfo.usePassword) {
        if (connInfo.usePassword.toString().toLowerCase().includes('ask')) {
          connInfo.askForPassword = true;
          propsToRemove.push('password');
        } else if (connInfo.usePassword.toString().toLowerCase().includes('empty')) {
          connInfo.password = '';
          propsToRemove.push('askForPassword');
        } else if (connInfo.usePassword.toString().toLowerCase().includes('save')) {
          propsToRemove.push('askForPassword');
        } else if (connInfo.usePassword.toString().toLowerCase().includes('secure')) {
          propsToRemove.push('password');
          propsToRemove.push('askForPassword');
        }
      }
      propsToRemove.forEach(p => delete connInfo[p]);

      return connInfo;
    },
    parseBeforeEditConnection: ({ connInfo }) => {
      /**
       * This hook is called before editing the connection using the assistant
       * so you can do any transformations before editing it.
       * EG: absolute file path transformation, string manipulation etc
       */
      const formData: typeof connInfo = {
        ...connInfo,
      };

      if (connInfo.askForPassword) {
        formData.usePassword = 'Ask on connect';
        delete formData.password;
      } else if (typeof connInfo.password === 'string') {
        delete formData.askForPassword;
        formData.usePassword = connInfo.password ? 'Save as plaintext in settings' : 'Use empty password';
      } else {
        formData.usePassword = 'SQLTools Driver Credentials';
      }

      formData.tls = formData.tls || {};

      return formData;
    },
    resolveConnection: async ({ connInfo }) => {
      /**
       * This hook is called after a connection definition has been fetched
       * from settings and is about to be used to connect.
       */
      if (connInfo.password === undefined && !connInfo.askForPassword) {
        const scopes = [connInfo.name, (connInfo.username || "")];
        let session = await authentication.getSession(
          AUTHENTICATION_PROVIDER,
          scopes,
          { silent: true }
        );
        if (!session) {
          session = await authentication.getSession(
            AUTHENTICATION_PROVIDER,
            scopes,
            { createIfNone: true }
          );
        }
        if (session) {
          connInfo.password = session.accessToken;
        }
      }

      return connInfo;
    },
    driverAliases: DRIVER_ALIASES,
  };
}

export function deactivate() {}
