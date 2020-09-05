import * as fs from 'fs';
import {resolve, relative, join, sep} from 'path';
import {replace} from 'rexscan';
import {Parser, throwIndexedError} from 'rexparse';

const isWin32 = ['win32', 'cygwin'].includes(process.platform);
// 環境によって変化する値が条件式に含まれるため、同一環境では変化しない
/* istanbul ignore next */
const rePathSep = sep !== '/' ? new RegExp('\\' + sep, 'g') : /(?!)/;

/**
 * ワイルドカードのパターン文字列を正規表現に変換する。
 * @export
 * @param {string} pattern ワイルドカードのパターン文字列。
 * - `*` 0文字以上の`/`以外のすべての文字にマッチする。
 * - `?` 1文字の`/`以外のすべての文字にマッチする。
 * - `{パターン1,パターン2}` 複数のパターンにマッチする。ネスト可。
 * `/`は含められない。
 * - `<文字列>` ワイルドカードに使用する文字を含んだファイル名にマッチさせるときに使用する。
 * `<{*}?,>`のように複数で指定可能だが、`>`だけは`<>>`のように単独で指定する。
 * `/`は含められない。
 * @param {object} [options] ワイルドカードを正規表現に変換するときのオプション。
 * - `start` ワイルドカードを開始したインデックス。
 * エラー発生時のインデックス計算に使用する。
 * 省略時には0が指定されたものとする
 * - `ignoreCase` ファイル名の大文字小文字を無視するかどうか。
 * 省略時にはprocess.platformが'win32'か'cygwin'であれば無視する。
 * それ以外であれば無視しない。
 * @returns {RegExp} ワイルドカードから変換した正規表現。
 */
export function toRegExp(
  pattern: string,
  options?: {
    start?: number;
    ignoreCase?: boolean;
  }
): RegExp {
  if (!pattern) {
    throw new Error(`Unsupported wildcard: ''`);
  }
  if (pattern.includes('/') || pattern.includes('**')) {
    throw new Error(`Unsupported wildcard: '${pattern}'`);
  }
  // `{`の開始位置を管理する配列
  const depth: number[] = [];
  const regexp = replace(
    pattern,
    /<([^\/]+?)>|[*?{,}.+()$|\^\\[\]]/g,
    ({index, 0: ch, 1: escaped}) => {
      if (escaped) {
        // エスケープ文字列は正規表現で使用する文字列をエスケープしてから追加
        return escaped.replace(/[*?.+()$|\^\\[\]{}]/g, '\\$&');
      }
      switch (ch) {
        case '*':
          return '[^/]*';
        case '?':
          return '[^/]';
        case '{':
          depth.push(index);
          return '(?:';
        case '}':
          if (depth.length === 0) {
            throwIndexedError((options?.start ?? 0) + index, 'Unmatched `}`');
          }
          depth.pop();
          return ')';
        case ',':
          // `{}`の外側にある`,`はそのまま`,`として使用
          return depth.length > 0 ? '|' : ',';
        default:
          // その他の正規表現で使用される文字はエスケープ
          return '\\' + ch;
      }
    }
  );
  if (depth.length > 0) {
    throwIndexedError((options?.start ?? 0) + depth[0], 'Unmatched `{`');
  }
  const flags = options?.ignoreCase ?? isWin32 ? 'i' : '';
  return new RegExp(`^${regexp}$`, flags);
}

type Item = {path: string; stat: fs.Stats};
type WildcardGenerator = (start: Item) => AsyncGenerator<Item, void>;
type IgnoreFiles = (item: Item) => unknown;

class WildcardContext {
  main?: WildcardGenerator;
  constructor(
    readonly ignoreCase: boolean | undefined,
    readonly ignoreFiles: IgnoreFiles | undefined
  ) {}
  add(sub: WildcardGenerator): this {
    if (!this.main) {
      this.main = sub;
    } else {
      const main = this.main;
      this.main = async function* (item: Item) {
        for await (const subitem of main(item)) {
          yield* sub(subitem);
        }
      };
    }
    return this;
  }
}

async function makeItem(path: string): Promise<Item | undefined> {
  const stat = await fs.promises.stat(path).catch(_ => undefined);
  return stat ? {path, stat} : undefined;
}

const parser = new Parser<WildcardContext>([
  [
    // UNCパスの共有フォルダ、ドライブ
    /^(?:\/\/[^\/]+\/[^\/]+|[a-zA-Z]:)\//,
    (path, context) =>
      context.add(
        isWin32 // isWin32は環境によって決まる値なので常に一定
          ? /* istanbul ignore next */
            async function* () {
              const item = await makeItem(path);
              if (item?.stat.isDirectory()) {
                // ディレクトリとして存在しているときだけ返す。
                yield item;
              }
            }
          : /* istanbul ignore next */
            async function* () {} // Win32以外では何も返さないジェネレーターを返す
      ),
  ],
  [
    // ルートディレクトリ
    /^\//,
    (_, context) =>
      context.add(async function* ({path}) {
        // Windowsの場合はpathで指定されたドライブによって変わるのでresolveを使う
        const item = await makeItem(resolve(path, '/'));
        // この関数が呼ばれた時点でstartは存在していて、そのルートディレクトリもまた存在している
        assertIsNotUndefined(item);
        yield item;
      }),
  ],
  [
    // ワイルドカードを含まないパス
    /(?:[^\/*?{<]+\/)+(?:[^\/*?{<]+$)?/,
    (matched, context) => {
      // 末尾に/が付いていたらディレクトリだけ
      const onlyDirectory = matched.slice(-1) === '/';
      return context.add(async function* ({path}) {
        const item = await makeItem(resolve(path, matched));
        // statの取得に失敗したら何も返さない。
        if (!item) {
          return;
        }
        // ディレクトリだけの場合でディレクトリでなければ何も返さない。
        if (onlyDirectory && !item.stat.isDirectory()) {
          return;
        }
        // パスをつなげたものを返す。
        yield item;
      });
    },
  ],
  [
    // 任意の複数階層
    /\*\*(?:\/|$)/,
    (matched, context) => {
      // 末尾に/が付いていたらディレクトリだけ
      const onlyDirectory = matched === '**/';
      return context.add(async function* recursive({
        path,
        stat,
      }): AsyncGenerator<Item, void> {
        // 指定のパスがディレクトリでなければ空
        if (!stat.isDirectory()) {
          return;
        }
        // まず現在位置を返す
        yield {path, stat};
        for (const name of await fs.promises.readdir(path)) {
          const item = await makeItem(join(path, name));
          // readdirで名前が取得できてstatの取得に失敗するのはアクセス権の設定によるものなのでテストでは用意できない
          /* istanbul ignore next */
          if (!item) {
            // stat取得に失敗したらスキップ(上記によりテスト下ではここには来ないはず)
            /* istanbul ignore next */
            continue;
          }
          // ディレクトリだけの場合でディレクトリでなければスキップ
          if (onlyDirectory && !item.stat.isDirectory()) {
            continue;
          }
          // 無視するファイル/ディレクトリであればスキップ
          if (context.ignoreFiles?.(item)) {
            continue;
          }
          // ディレクトリの場合は再帰的に
          if (item.stat.isDirectory()) {
            yield* recursive(item);
          } else {
            yield item;
          }
        }
      });
    },
  ],
  [
    // ワイルドカードを含む1階層
    /[^\/]+(?:\/|$)/,
    (matched, context, index) => {
      // 末尾に/が付いていたらディレクトリだけ
      const onlyDirectory = matched.slice(-1) === '/';
      if (onlyDirectory) matched = matched.slice(0, -1);
      if (matched.includes('**')) {
        throwIndexedError(
          index + matched.indexOf('**'),
          '** found in wildcard'
        );
      }
      // ワイルドカードを正規表現に変換
      const pattern = toRegExp(matched, {
        start: index,
        ignoreCase: context.ignoreCase,
      });
      return context.add(async function* ({path, stat}) {
        // 指定のパスがディレクトリでなければ空
        if (!stat.isDirectory()) {
          return;
        }
        // ディレクトリのファイル、ディレクトリ一覧を取得
        for (const fname of await fs.promises.readdir(path)) {
          // ワイルドカードにマッチしなければスキップ
          if (!pattern.test(fname)) {
            continue;
          }
          const item = await makeItem(join(path, fname));
          // readdirで名前が取得できてstatの取得に失敗するのはアクセス権の設定によるものなのでテストでは用意できない
          /* istanbul ignore next */
          if (!item) {
            // stat取得に失敗したらスキップ(上記によりテスト下ではここには来ないはず)
            /* istanbul ignore next */
            continue;
          }
          // ディレクトリだけの場合でディレクトリでなければスキップ
          if (onlyDirectory && !item.stat.isDirectory()) {
            continue;
          }
          // 無視するファイル/ディレクトリであればスキップ
          if (context.ignoreFiles?.(item)) {
            continue;
          }
          yield item;
        }
      });
    },
  ],
]);

function assertIsNotUndefined<T>(target: T | undefined): asserts target is T {
  // この関数が呼び出されるときはtargetがundefinedではないときだけなので以下の条件は常に偽
  /* istanbul ignore next */
  if (target === undefined) {
    // 上記によりここには来ないはず
    /* istanbul ignore next */
    throw new Error('target is not undefined');
  }
}

/**
 * ワイルドカードを展開して、マッチしたファイル、ディレクトリのフルパスを返す非同期ジェネレーターを返す。
 * for-await-ofで使用する。
 * ex.
 * ```ts
 * const traverser = wildkarte.expand('**\/*.js');
 * for await (const path of traverser(cwd)) {
 *   console.log(path);
 * }
 * ```
 * @export
 * @param {string} pattern ワイルドカードを使ったファイルやディレクトリのパターン。
 * - `**` その階層以下にある全てのファイル、もしくはディレクトリにマッチする。
 * ファイル名やディレクトリ名の一部としては使用できない。
 * - `*` 0文字以上の`/`以外のすべての文字にマッチする。
 * - `?` 1文字の`/`以外のすべての文字にマッチする。
 * - `{パターン1,パターン2}` 複数のパターンにマッチする。ネスト可。`/`は含められない。
 * - `<文字列>` ワイルドカードに使用する文字を含んだファイル名にマッチさせるときに使用する。
 * `<{*}?,>`のように複数で指定可能だが、`>`だけは`<>>`のように単独で指定する。
 * @param {{
 *     ignoreCase?: boolean;
 *     ignoreFiles?: IgnoreFiles;
 *     fileOnly?: boolean;
 *   }} [options] ワイルドカード展開時のオプションを指定する。
 * - `ignoreCase` ワイルドカード展開時、ファイル名/ディレクトリ名の大文字小文字を無視するかどうかを指定する。
 * 省略時にはprocess.platformがwin32もしくはcygwinのときは真、それ以外は偽。
 * ただし、ワイルドカードを含んでいない階層についてはファイルシステムの仕様に依存する。
 * - `ignoreFiles` ファイル/ディレクトリを無視するかどうかを判定する関数を指定する。
 * 省略時には全てのファイル/ディレクトリを無視しない。
 * - `fileOnly` ワイルドカードにマッチするディレクトリを無視するかどうかを指定する。
 * 省略時にはディレクトリを無視しない。
 * @returns {(start: string) => AsyncGenerator<string, void>} 指定したディレクトリから、ワイルドカードにマッチしたファイル、ディレクトリの、
 * 引数に指定したディレクトリからの相対パスを返す非同期ジェネレーターを返す。
 */
export function expand(
  pattern: string,
  options?: {
    ignoreCase?: boolean;
    ignoreFiles?: IgnoreFiles;
    fileOnly?: boolean;
  }
): (start: string) => AsyncGenerator<string, void> {
  if (!pattern) {
    return async function* () {};
  }
  const {ignoreCase, ignoreFiles, fileOnly} = options ?? {};
  const main = parser.parse(
    pattern,
    new WildcardContext(ignoreCase, ignoreFiles)
  ).main;
  // mainがundefinedのままになる場合は、ここに来るまでに例外が投げられているはず
  assertIsNotUndefined(main);
  const filtered = fileOnly
    ? async function* (start: Item) {
        for await (const item of main(start)) {
          if (!item.stat.isFile()) {
            continue;
          }
          yield item;
        }
      }
    : main;
  return async function* (start: string) {
    const item = await makeItem(start);
    if (!item) {
      return;
    }
    for await (const {path} of filtered(item)) {
      yield relative(start, path).replace(rePathSep, '/');
    }
  };
}
