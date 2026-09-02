// @ts-check

/**
 * @param {string} pluginJsonContent
 * @param {string} newVersion
 * @returns {string}
 */
function syncPluginVersion(pluginJsonContent, newVersion) {
  const plugin = JSON.parse(pluginJsonContent);

  if (!('version' in plugin)) {
    throw new Error('plugin.json has no "version" field to sync');
  }

  return `${JSON.stringify({ ...plugin, version: newVersion }, null, 2)}\n`;
}

module.exports = { syncPluginVersion };
