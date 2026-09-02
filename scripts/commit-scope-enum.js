// @ts-check

/** @type {readonly string[]} */
const BUCKET_SCOPES = ['engineering', 'productivity'];
/** @type {readonly string[]} */
const MAINTENANCE_SCOPES = ['deps', 'config'];

/**
 * @param {readonly string[]} skillNames
 * @returns {string[]}
 */
function buildScopeEnum(skillNames) {
  return [...new Set([...skillNames, ...BUCKET_SCOPES, ...MAINTENANCE_SCOPES])];
}

module.exports = { buildScopeEnum };
