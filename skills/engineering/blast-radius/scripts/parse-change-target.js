// @ts-check

const PULL_REQUEST_NUMBER_RE = /^#?([1-9]\d*)$/;
const PULL_REQUEST_URL_RE = /^https?:\/\/([^/\s]+\/[^/\s]+\/[^/\s]+\/pull\/[1-9]\d*)(?:[/?#]\S*)?$/;
const REF_RANGE_RE = /^(\S*?)(\.\.\.?)(\S*)$/;

/**
 * @typedef {(
 *   | { kind: 'branch' }
 *   | { kind: 'pullRequest', pullRequest: string }
 *   | { kind: 'range', from: string, to: string, mergeBase: boolean }
 * )} ChangeTarget
 */

/**
 * Reads the one optional `blast-radius` argument into the change to
 * analyze. Nothing means the current branch against the default branch.
 * A pull request number or URL means that pull request, with a URL cut
 * down to the pull request itself, so that `gh` reads the pull request and
 * not the tab or the comment the URL pointed at. A ref range means that set
 * of commits: two dots start at the first ref, three dots at the merge base
 * of both, and an empty side is HEAD, the way git reads a range.
 *
 * @param {string | undefined} argument
 * @returns {ChangeTarget}
 */
function parseChangeTarget(argument) {
  const trimmed = argument?.trim() ?? '';
  if (trimmed === '') return { kind: 'branch' };

  const number = trimmed.match(PULL_REQUEST_NUMBER_RE);
  if (number) return { kind: 'pullRequest', pullRequest: number[1] };

  const url = trimmed.match(PULL_REQUEST_URL_RE);
  if (url) return { kind: 'pullRequest', pullRequest: `https://${url[1]}` };

  const range = trimmed.match(REF_RANGE_RE);
  if (range && (range[1] !== '' || range[3] !== '')) {
    // `||` and not `??`: the regex yields '' for an empty side, and '' must become HEAD.
    return { kind: 'range', from: range[1] || 'HEAD', to: range[3] || 'HEAD', mergeBase: range[2] === '...' };
  }

  throw new Error(`Expected a pull request number or URL, a ref range such as main..feature, or nothing, got "${trimmed}".`);
}

module.exports = { parseChangeTarget };
