import * as path from 'path';
import * as wildkarte from './index';

test('toRegExp', () => {
  expect(() => wildkarte.toRegExp('')).toThrowError("Unsupported wildcard: ''");
});
test('toRegExp', () => {
  expect(wildkarte.toRegExp('*')).toEqual(/^[^/]*$/i);
});
test('toRegExp', () => {
  expect(wildkarte.toRegExp('?')).toEqual(/^[^/]$/i);
});
test('toRegExp', () => {
  expect(wildkarte.toRegExp('{abc,def}')).toEqual(/^(?:abc|def)$/i);
});
test('toRegExp', () => {
  expect(wildkarte.toRegExp('{abc,def{123,456}}')).toEqual(
    /^(?:abc|def(?:123|456))$/i
  );
});
test('toRegExp escaped', () => {
  expect(wildkarte.toRegExp('<^$()[]{}+.,>')).toEqual(
    /^\^\$\(\)\[\]\{\}\+\.,$/i
  );
});
test('toRegExp escaped', () => {
  expect(wildkarte.toRegExp('^$()[]+.,')).toEqual(/^\^\$\(\)\[\]\+\.,$/i);
});

test('toRegExp escaped', () => {
  expect(wildkarte.toRegExp('<<>')).toEqual(
    /^<$/i
  );
});
test('toRegExp escaped', () => {
  expect(wildkarte.toRegExp('<>>')).toEqual(
    /^>$/i
  );
});
test('toRegExp escaped', () => {
  expect(wildkarte.toRegExp('>')).toEqual(
    /^>$/i
  );
});
test('toRegExp for path', () => {
  expect(wildkarte.toRegExp('**', wildkarte.FOR_PATH)).toEqual(
    /^(?:[^/]+\/)*[^/]+$/i
  );
});
test('toRegExp for path', () => {
  expect(wildkarte.toRegExp('**/', wildkarte.FOR_PATH)).toEqual(
    /^(?:[^/]+\/)*$/i
  );
});
test('toRegExp error', () => {
  expect(() => wildkarte.toRegExp('/')).toThrowError(
    "Unsupported wildcard: '/'"
  );
});
test('toRegExp error', () => {
  expect(() => wildkarte.toRegExp('**')).toThrowError(
    "Unsupported wildcard: '**'"
  );
});
test('toRegExp error', () => {
  expect(() => wildkarte.toRegExp('}')).toThrowError('Unmatched `}`');
});
test('toRegExp error', () => {
  expect(() => wildkarte.toRegExp('{')).toThrowError('Unmatched `{`');
});
test('expand#1', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/**/*.ts')].map(({path}) => path.slice(cwdlen))
  ).toEqual(['test/a/a2/a2-aac.ts', 'test/a/a3/a3-aaa.ts', 'test/b/config.ts']);
});
test('expand#2', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/**/{a,b}?/')].map(({path}) => path.slice(cwdlen))
  ).toEqual(['test/a/a1', 'test/a/a2', 'test/a/a3', 'test/b/b1', 'test/b/b2']);
});
test('expand#3', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/**/{a,b}?/*.txt')].map(({path}) =>
      path.slice(cwdlen)
    )
  ).toEqual([
    'test/a/a1/a1-aaa.txt',
    'test/a/a2/a2-aaa.txt',
    'test/a/a3/a3-aaa.txt',
    'test/b/b1/readme.txt',
  ]);
});
test('expand#4', () => {
  expect(() => [...wildkarte.expand('test/**/{a,b}?/\/*.txt')]).toThrowError(
    "Unsupported wildcard: 'test/**/{a,b}?/\/*.txt'"
  );
});
test('expand#5', () => {
  expect(() => [...wildkarte.expand('test/**/{a,b}?/{*.txt')]).toThrowError(
    'Unmatched `{`'
  );
});
test('expand#6', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/{a,b}/{a,b}?/**/*.txt')].map(({path}) =>
      path.slice(cwdlen)
    )
  ).toEqual([
    'test/a/a1/a1-aaa.txt',
    'test/a/a2/a2-aaa.txt',
    'test/a/a3/a3-aaa.txt',
    'test/b/b1/readme.txt',
  ]);
});
test('expand#7', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/{a,b}/{a,b}?/**/readme.txt')].map(({path}) =>
      path.slice(cwdlen)
    )
  ).toEqual(['test/b/b1/readme.txt']);
});
test('expand#8', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/a/a4/**/readme.txt')].map(({path}) =>
      path.slice(cwdlen)
    )
  ).toEqual([]);
});
test('expand#9', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('test/{a,b}/a4/**/readme.txt')].map(({path}) =>
      path.slice(cwdlen)
    )
  ).toEqual([]);
});
test('expand#10', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [
      ...wildkarte.expand(
        'test/{a,b}/a4/**/readme.txt',
        ({name}) => name === 'b'
      ),
    ].map(({path}) => path.slice(cwdlen))
  ).toEqual([]);
});
test('expand#11', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('**/*.ts', 'test')].map(({path}) => path.slice(cwdlen))
  ).toEqual(['test/a/a2/a2-aac.ts', 'test/a/a3/a3-aaa.ts', 'test/b/config.ts']);
});
test('expand#12', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [...wildkarte.expand('**/*.ts', {basedir: 'test'})].map(({path}) =>
      path.slice(cwdlen)
    )
  ).toEqual(['test/a/a2/a2-aac.ts', 'test/a/a3/a3-aaa.ts', 'test/b/config.ts']);
});
test('expand#13', () => {
  const cwdlen = path.resolve(process.cwd()).length + 1;
  expect(
    [
      ...wildkarte.expand('**/{*-aab.*,*-aac.*}', {basedir: 'test'}),
    ].map(({path}) => path.slice(cwdlen))
  ).toEqual([
    'test/a/a1/a1-aab.js',
    'test/a/a2/a2-aab.js',
    "test/a/a2/a2-aac.ts",
  ]);
});
