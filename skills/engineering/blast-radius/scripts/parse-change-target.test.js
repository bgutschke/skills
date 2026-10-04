// @ts-check
const { describe, expect, it } = require('@jest/globals');
const { parseChangeTarget } = require('./parse-change-target');

describe('parseChangeTarget', () => {
  it('reads no argument as the current branch', () => {
    expect(parseChangeTarget(undefined)).toEqual({ kind: 'branch' });
  });

  it.each(['', '  '])('reads the blank argument %j as the current branch', (argument) => {
    expect(parseChangeTarget(argument)).toEqual({ kind: 'branch' });
  });

  it('trims the space around an argument', () => {
    expect(parseChangeTarget(' #42\n')).toEqual({ kind: 'pullRequest', pullRequest: '42' });
  });

  it.each(['feature', '..', 'main..feature extra', 'https://github.com/acme/shop/issues/42', '#0'])(
    'rejects %j with the three forms it accepts',
    (argument) => {
      expect(() => parseChangeTarget(argument)).toThrow(
        `Expected a pull request number or URL, a ref range such as main..feature, or nothing, got "${argument.trim()}".`,
      );
    },
  );

  it.each(['42', '#42'])('reads %s as a pull request number', (argument) => {
    expect(parseChangeTarget(argument)).toEqual({ kind: 'pullRequest', pullRequest: '42' });
  });

  it.each([
    'https://github.com/acme/shop/pull/42',
    'https://github.com/acme/shop/pull/42/files',
    'https://github.com/acme/shop/pull/42#discussion_r1',
    'https://git.acme.dev/acme/shop/pull/42?w=1',
  ])('reads the pull request URL %s down to the pull request itself', (argument) => {
    const host = new URL(argument).host;

    expect(parseChangeTarget(argument)).toEqual({ kind: 'pullRequest', pullRequest: `https://${host}/acme/shop/pull/42` });
  });

  it('reads a two-dot range as the commits from the first ref to the second', () => {
    expect(parseChangeTarget('v1.4.0..release/1.5')).toEqual({ kind: 'range', from: 'v1.4.0', to: 'release/1.5', mergeBase: false });
  });

  it('reads a three-dot range as the commits from the merge base of both refs', () => {
    expect(parseChangeTarget('main...feature')).toEqual({ kind: 'range', from: 'main', to: 'feature', mergeBase: true });
  });

  it('reads an empty side of a range as HEAD, the way git does', () => {
    expect(parseChangeTarget('a1b2c3d..')).toEqual({ kind: 'range', from: 'a1b2c3d', to: 'HEAD', mergeBase: false });
    expect(parseChangeTarget('...feature')).toEqual({ kind: 'range', from: 'HEAD', to: 'feature', mergeBase: true });
  });
});
