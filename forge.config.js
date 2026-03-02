const { MakerZIP } = require('@electron-forge/maker-zip');

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
const config = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.leemoore.mdviewer',
    appCategoryType: 'public.app-category.productivity',
    executableName: 'MD Viewer',
    name: 'MD Viewer',
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeExtensions: ['md', 'markdown'],
          CFBundleTypeName: 'Markdown Document',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Owner'
        }
      ]
    }
  },
  makers: [new MakerZIP({}, ['darwin'])]
};

module.exports = config;
