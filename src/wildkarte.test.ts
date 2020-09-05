import {resolve, sep} from 'path';
import * as wildkarte from './index';

test('toRegExp#1', () => {
  expect(() => wildkarte.toRegExp('')).toThrowError("Unsupported wildcard: ''");
});
test('toRegExp#2', () => {
  expect(wildkarte.toRegExp('*').source).toBe(/^[^/]*$/.source);
});
test('toRegExp#3', () => {
  expect(wildkarte.toRegExp('?').source).toBe(/^[^/]$/.source);
});
test('toRegExp#4', () => {
  expect(wildkarte.toRegExp('{abc,def}').source).toBe(/^(?:abc|def)$/.source);
});
test('toRegExp#5', () => {
  expect(wildkarte.toRegExp('{abc,def{123,456}}').source).toBe(
    /^(?:abc|def(?:123|456))$/.source
  );
});
test('toRegExp escaped#1', () => {
  expect(wildkarte.toRegExp('<^$()[]{}+.,>').source).toBe(
    /^\^\$\(\)\[\]\{\}\+\.,$/.source
  );
});
test('toRegExp escaped#2', () => {
  expect(wildkarte.toRegExp('^$()[]+.,').source).toBe(/^\^\$\(\)\[\]\+\.,$/.source);
});

test('toRegExp escaped#3', () => {
  expect(wildkarte.toRegExp('<<>').source).toBe(/^<$/.source);
});
test('toRegExp escaped#4', () => {
  expect(wildkarte.toRegExp('<>>').source).toBe(/^>$/.source);
});
test('toRegExp escaped#5', () => {
  expect(wildkarte.toRegExp('>').source).toBe(/^>$/.source);
});
test('toRegExp error#1', () => {
  expect(() => wildkarte.toRegExp('/')).toThrowError(
    "Unsupported wildcard: '/'"
  );
});
test('toRegExp error#2', () => {
  expect(() => wildkarte.toRegExp('**')).toThrowError(
    "Unsupported wildcard: '**'"
  );
});
test('toRegExp error#3', () => {
  expect(() => wildkarte.toRegExp('}')).toThrowError('Unmatched `}`');
});
test('toRegExp error#4', () => {
  expect(() => wildkarte.toRegExp('{')).toThrowError('Unmatched `{`');
});

async function collect(
  g: (path: string) => AsyncGenerator<string, void>,
  start: string
) {
  const result: string[] = [];
  for await (const path of g(start ?? '.')) {
    result.push(path);
  }
  return result;
}
test('expand#1', async () => {
  expect(await collect(wildkarte.expand('test/**/*.ts'), '.')).toEqual([
    'test/a/a2/a2-aac.ts',
    'test/a/a3/a3-aaa.ts',
    'test/b/config.ts',
  ]);
});
test('expand#2', async () => {
  expect(await collect(wildkarte.expand('test/**/{a,b}?/'), '.')).toEqual([
    'test/a/a1',
    'test/a/a2',
    'test/a/a3',
    'test/b/b1',
    'test/b/b2',
  ]);
});
test('expand#3', async () => {
  expect(await collect(wildkarte.expand('test/**/{a,b}?/*.txt'), '.')).toEqual([
    'test/a/a1/a1-aaa.txt',
    'test/a/a2/a2-aaa.txt',
    'test/a/a3/a3-aaa.txt',
    'test/b/b1/readme.txt',
  ]);
});
test('expand#4', () => {
  expect(() => wildkarte.expand('test/**/{a,b}?//*.txt')).toThrowError(
    `Unrecognized token:
  test/**/{a,b}?//*.txt
                 ^`
  );
});
test('expand#5', () => {
  expect(() => wildkarte.expand('test/**/{a,b}?/{*.txt')).toThrowError(
    'Unmatched `{`'
  );
});
test('expand#6', async () => {
  expect(
    await collect(wildkarte.expand('test/{a,b}/{a,b}?/**/*.txt'), '.')
  ).toEqual([
    'test/a/a1/a1-aaa.txt',
    'test/a/a2/a2-aaa.txt',
    'test/a/a3/a3-aaa.txt',
    'test/b/b1/readme.txt',
  ]);
});
test('expand#7', async () => {
  expect(
    await collect(wildkarte.expand('test/{a,b}/{a,b}?/**/readme.txt'), '.')
  ).toEqual(['test/b/b1/readme.txt']);
});
test('expand#8', async () => {
  expect(
    await collect(wildkarte.expand('test/a/a4/**/readme.txt'), '.')
  ).toEqual([]);
});
test('expand#9', async () => {
  expect(
    await collect(wildkarte.expand('test/{a,b}/a4/**/readme.txt'), '.')
  ).toEqual([]);
});
test('expand#10', async () => {
  expect(
    await collect(
      wildkarte.expand('test/{a,b}/a4/**/readme.txt', {
        ignoreFiles: ({path}) => /(?:^|\/)b(?:\/|$)/.test(path),
      }),
      '.'
    )
  ).toEqual([]);
});
test('expand#11', async () => {
  expect(await collect(wildkarte.expand('**/*.ts'), 'test')).toEqual([
    'a/a2/a2-aac.ts',
    'a/a3/a3-aaa.ts',
    'b/config.ts',
  ]);
});

test('wildkarte.toRegExp#1', () => {
  expect(wildkarte.toRegExp('*.ts?').source).toBe(/^[^/]*\.ts[^/]$/i);
});
test('wildkarte.toRegExp#2', () => {
  expect(wildkarte.toRegExp('*.{js,ts}').source).toBe(/^[^/]*\.(?:js|ts)$/i);
});
test('wildkarte.toRegExp#3', () => {
  expect(wildkarte.toRegExp('<{,}>*.{js,ts}').source).toBe(
    /^\{,\}[^/]*\.(?:js|ts)$/i
  );
});
test('wildkarte.toRegExp#4', () => {
  expect(() => wildkarte.toRegExp('{*.{js,ts}')).toThrow('Unmatched `{`');
});
test('wildkarte.toRegExp#5', () => {
  expect(() => wildkarte.toRegExp('}*.{js,ts}')).toThrow('Unmatched `}`');
});
test('wildkarte.toRegExp#7', () => {
  expect(() => wildkarte.toRegExp('}*.{js,ts}', {start: 14})).toThrow(
    'Unmatched `}`'
  );
});
test('wildkarte.toRegExp#8', () => {
  expect(() => wildkarte.toRegExp('{*.{js,ts}', {start: 14})).toThrow(
    'Unmatched `{`'
  );
});
test('wildkarte.toRegExp#9', () => {
  expect(wildkarte.toRegExp('*.js,ts').source).toBe(/^[^/]*\.js,ts$/i);
});
test('wildkarte.toRegExp#10', () => {
  expect(wildkarte.toRegExp('*.js,ts', {ignoreCase: false})).toEqual(
    /^[^/]*\.js,ts$/
  );
});
test('wildkarte.toRegExp#11', () => {
  expect(wildkarte.toRegExp('*.js,ts', {ignoreCase: true})).toEqual(
    /^[^/]*\.js,ts$/i
  );
});

test('wildkarte.toRegExp#12', () => {
  const isWin32 = ['win32', 'cygwin'].includes(process.platform)
  expect(wildkarte.toRegExp('*.js,ts').flags).toBe(isWin32 ? 'i' : '');
});

test('wildkarte.expand#1', () => {
  expect(wildkarte.expand('**/*.ts')).toBeDefined();
});
test('wildkarte.expand#2', () => {
  expect(wildkarte.expand('c:/**')).toBeDefined();
});
test('wildkarte.expand#3', () => {
  expect(wildkarte.expand('//server/folder/**')).toBeDefined();
});
test('wildkarte.expand#4', () => {
  expect(wildkarte.expand('test/**')).toBeDefined();
});
test('wildkarte.expand#5', () => {
  expect(wildkarte.expand('test.ts')).toBeDefined();
});
test('wildkarte.expand#6', () => {
  expect(() => wildkarte.expand('test/**.ts')).toThrow('** found in wildcard');
});

async function exists<T>(
  g: AsyncGenerator<T, unknown, unknown>,
  count?: number
): Promise<boolean> {
  count ??= 1;
  const arr: T[] = [];
  for await (const v of g) {
    if (--count === 0) {
      return true;
    }
  }
  return false;
}

test('wildkarte.expand traverse#1', async () => {
  expect(await exists(wildkarte.expand('/*')('.'))).toBe(true);
});
test('wildkarte.expand traverse#2', async () => {
  expect(await exists(wildkarte.expand('node_modules/**/*.js')('.'))).toBe(
    true
  );
});
test('wildkarte.expand traverse#4', async () => {
  expect(await exists(wildkarte.expand('package.json/**')('.'))).toBe(false);
});
test('wildkarte.expand traverse#5', async () => {
  expect(await exists(wildkarte.expand('**/*.js')('package.json'))).toBe(false);
});
test('wildkarte.expand traverse#6', async () => {
  expect(
    await exists(
      wildkarte.expand('**/*.js', {
        ignoreFiles({path}) {
          return /\\(?:\.git|node_modules)(?:\\|$)/.test(path);
        },
      })('.')
    )
  ).toBe(true);
});
test('wildkarte.expand traverse#7', async () => {
  expect(await exists(wildkarte.expand('*/**/*.js')('package.json'))).toBe(
    false
  );
});
test('wildkarte.expand traverse#8', async () => {
  expect(
    await exists(
      wildkarte.expand('*/**/*.js', {
        ignoreFiles: ({path}) =>
          /(?:^|\\)(?:\.git|node_modules)(?:\\|$)/.test(path),
      })('.')
    )
  ).toBe(true);
});
test('wildkarte.expand traverse#9', async () => {
  expect(await exists(wildkarte.expand('')('.'))).toBe(false);
});
test('wildkarte.expand traverse#10', async () => {
  expect(await exists(wildkarte.expand('**/*.js', {fileOnly: true})('.'))).toBe(
    true
  );
});
test('wildkarte.expand traverse#11', async () => {
  expect(
    await exists(
      wildkarte.expand('**/*.md/', {
        ignoreFiles: ({path}) =>
          /(?:^|\\)(?:\.git|node_modules)(?:\\|$)/.test(path),
      })('.')
    )
  ).toBe(false);
});
test('wildkarte.expand traverse#12', async () => {
  expect(
    await exists(wildkarte.expand(resolve('/*').replace(sep, '/'))('.'))
  ).toBe(true);
});
test('wildkarte.expand traverse#13', async () => {
  expect(
    await exists(
      wildkarte.expand('**', {
        ignoreFiles: ({stat}) => stat.isDirectory(),
      })('.'),
      2
    )
  ).toBe(true);
});
test('wildkarte.expand traverse#14', async () => {
  expect(await exists(wildkarte.expand('*.js')('not-exist'))).toBe(false);
});
test('wildkarte.expand traverse#15', async () => {
  expect(await exists(wildkarte.expand('**')('not-exist'))).toBe(false);
});
test('wildkarte.expand traverse#16', async () => {
  expect(
    await exists(
      wildkarte.expand('**/README.md/', {
        ignoreFiles: ({path}) =>
          /(?:^|\\)(?:\.git|node_modules)(?:\\|$)/.test(path),
      })('.')
    )
  ).toBe(false);
});
test('wildkarte.expand traverse#17', async () => {
  for await (const fpath of wildkarte.expand('**/*.js', {
    ignoreFiles: ({path}) =>
      /(?:^|\\)(?:\.git|node_modules)(?:\\|$)/.test(path),
  })('.')) {
    expect(fpath).toMatch(/^(?:[^/]+\/)*[^/]*\.js$/);
  }
});
test('wildkarte.expand traverse#18', async () => {
  expect(
    await exists(wildkarte.expand('node_modules/*.js', {fileOnly: true})('.'))
  ).toBe(false);
});
test('wildkarte.expand traverse#19', async () => {
  for (const drive of 'ABCDEFGHIJKLMNOPQRSTUVWXXYZ') {
    expect(await exists(wildkarte.expand('/*.js')(`${drive}:/`))).toBe(false);
  }
});
