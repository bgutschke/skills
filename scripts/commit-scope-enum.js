const BUCKET_SCOPES = ['engineering', 'productivity'];
const MAINTENANCE_SCOPES = ['deps', 'config'];

function buildScopeEnum(skillNames) {
  return [...new Set([...skillNames, ...BUCKET_SCOPES, ...MAINTENANCE_SCOPES])];
}

module.exports = { buildScopeEnum };
