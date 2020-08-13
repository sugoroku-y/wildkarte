import * as fs from 'fs';
import * as path from 'path';

/**
 * ワイルドカードを正規表現に変換する際に、複数階層を対象にするかどうかを指定するためのenum。
 */
const enum RegExpFor {
  /**
   * ファイル名だけを対象にする場合はこちらを指定する。
   */
  FILENAME = 1,
  /**
   * 複数階層を対象にする場合はこちらを指定する。
   */
  PATH = 2,
}

/**
 * ワイルドカードを正規表現に変換する際に、ファイル名だけを対象にする場合はこちらを指定する。
 */
export const FOR_FILENAME = RegExpFor.FILENAME;

/**
 * ワイルドカードを正規表現に変換する際に、複数階層を対象にする場合はこちらを指定する。
 */
export const FOR_PATH = RegExpFor.PATH;

/**
 * ワイルドカードのパターン文字列を正規表現に変換する。
 *
 * @param pattern {string} ワイルドカードのパターン文字列。
 * @param regExpFor {RegExpFor} 複数階層に渡るワイルドカードをサポートする場合はwildcard.FOR_PATHを指定する。
 * @return {RegExp} ワイルドカードのパターンから変換した正規表現。
 */
export function toRegExp(
  pattern: string,
  regExpFor: RegExpFor = FOR_FILENAME
): RegExp {
  if (!pattern) {
    throw new Error(`Unsupported wildcard: ''`);
  }
  if (regExpFor === FOR_FILENAME && pattern.includes('/')) {
    throw new Error(`Unsupported wildcard: '${pattern}'`);
  }
  let depth = 0;
  const regex =
    '^' +
    pattern.replace(
      /<([^/]+?)>|(\*\*\/?)|[\^$|()[\]{}+.*?,]/g,
      (ch, escaped, recursive) => {
        // <～>は中の文字列をそのままファイル名もしくはディレクトリ名として使う
        if (escaped) {
          return escaped.replace(/[\^$()[\]{}+.]/g, '\\$&');
        }
        if (recursive) {
          if (regExpFor === FOR_FILENAME) {
            throw new Error(`Unsupported wildcard: '${pattern}'`);
          }
          return recursive === '**' ? '(?:[^/]+/)*[^/]+' : '(?:[^/]+/)*';
        }
        switch (ch) {
          // *は0個以上のすべての文字にマッチ
          case '*':
            return '[^/]*';
          // ?は1つのすべての文字にマッチ
          case '?':
            return '[^/]';
          // {AAA,BBB}はAAAとBBBにマッチ(ネストも可))
          case '{':
            ++depth;
            return '(?:';
          case '}':
            if (depth <= 0) {
              throw new Error('Unmatched `}`');
            }
            --depth;
            return ')';
          // {}の中にない,はただの,として扱う
          case ',':
            return depth > 0 ? '|' : ',';
          // その他の正規表現で使われる文字は\でエスケープ
          default:
            return '\\' + ch;
        }
      }
    ) +
    '$';
  if (depth > 0) {
    throw new Error('Unmatched `{`');
  }
  return new RegExp(regex, 'i');
}

/**
 * ファイルやディレクトリの情報を扱うインターフェイス
 */
export interface IItem {
  /** ファイル/ディレクトリのフルパス */
  path: string;
  /** ファイル/ディレクトリの名前 */
  name: string;
  /** ファイル/ディレクトリのfs.statSyncの返値。 */
  stat: fs.Stats;
}

/**
 * `expand`で無視するファイル/ディレクトリを判定する関数の型。
 * @param item {IItem} 無視するかどうかを決めるファイル/ディレクトリ。
 * @return {boolean} 無視する場合にはtrueを返す。
 */
type IgnoreCallback = (item: IItem) => boolean;

/**
 * OSでの表記になっているパスを`/`区切りに変換する。
 * @param fpath {string} OSでの表記のパス
 * @return {string} `/`区切りのパス
 */
function normalizeSep(fpath: string): string {
  return path.sep === '/' ? fpath : fpath.split(path.sep).join('/');
}

/** IItemに変換する。 */
function makeItem(
  dirpath: string,
  name: string,
  directoryOnly: boolean
): IItem | undefined {
  const fpath = path.join(dirpath, name);
  const stat = fs.statSync(fpath);
  if (directoryOnly && !stat.isDirectory()) {
    return undefined;
  }
  return {path: normalizeSep(fpath), name, stat};
}

/**
 * 指定されたパターンにマッチする全てのファイル/フォルダを順次返すイテレータを返す。
 * @param pattern {string} 検索するファイル/フォルダ名のパターン。
 *
 * - `**`はそれ以下の全てのパス
 * - `?`はファイル/フォルダの名前に使用される全ての1文字
 * - `*`はファイル/フォルダの名前に使用される全ての0個以上の文字
 *
 * にマッチする。
 * @param basedir {string} 検索を開始するディレクトリへのパス。
 *
 * 省略時にはカレントディレクトリ。
 * @param ignore {(item: IItem) => boolean} そのファイル、フォルダを無視するかどうかを決定する関数を指定する。
 *
 * 無視されたファイル・フォルダは`pattern`にマッチしてもイテレータには返されない。
 */
export function expand(
  pattern: string,
  basedir?: string,
  ignore?: IgnoreCallback
): Iterable<IItem>;
/**
 * 指定されたパターンにマッチする全てのファイル/フォルダを順次返すイテレータを返す。
 * @param pattern {string} 検索するファイル/フォルダ名のパターン。
 *
 * - `**`はそれ以下の全てのパス
 * - `?`はファイル/フォルダの名前に使用される全ての1文字
 * - `*`はファイル/フォルダの名前に使用される全ての0個以上の文字
 *
 * にマッチする。
 * @param ignore {(item: IItem) => boolean} そのファイル、フォルダを無視するかどうかを決定する関数を指定する。
 *
 * 無視されたファイル・フォルダは`pattern`にマッチしてもイテレータには返されない。
 */
export function expand(
  pattern: string,
  ignore: IgnoreCallback
): Iterable<IItem>;
/**
 * 指定されたパターンにマッチする全てのファイル/フォルダを順次返すイテレータを返す。
 * @param pattern {string} 検索するファイル/フォルダ名のパターン。
 *
 * - `**`はそれ以下の全てのパス
 * - `?`はファイル/フォルダの名前に使用される全ての1文字
 * - `*`はファイル/フォルダの名前に使用される全ての0個以上の文字
 *
 * にマッチする。
 * @param options 検索に関するオプション
 * @param options.basedir {string} 検索を開始するディレクトリへのパス。
 *
 * 省略時にはカレントディレクトリ。
 * @param options.ignore {(item: IItem) => boolean} そのファイル、フォルダを無視するかどうかを決定する関数を指定する。
 *
 * 無視されたファイル・フォルダは`pattern`にマッチしてもイテレータには返されない。
 */
export function expand(
  pattern: string,
  options: {basedir?: string; ignore?: IgnoreCallback}
): Iterable<IItem>;
export function* expand(
  pattern: string,
  options?:
    | {basedir?: string; ignore?: IgnoreCallback}
    | string
    | IgnoreCallback,
  ignore?: IgnoreCallback
) {
  const basedir = path.resolve(
    (options &&
      ((typeof options === 'string' && options) ||
        (typeof options === 'object' && options.basedir))) ||
      '.'
  );
  ignore =
    ignore ||
    (options &&
      ((typeof options === 'function' && options) ||
        (typeof options === 'object' && options.ignore))) ||
    undefined;

  const [patternRoot] = pattern.match(/^(?:[a-z]:|\/\/[^a-z0-9.\-_]+\/[^/]+)?\//i) || [];

  // 検索開始位置と次のパターン
  let {start, next} = patternRoot
    ? {start: patternRoot, next: pattern.slice(patternRoot.length)}
    : {start: basedir, next: pattern};
  // wildcardを使用していない場所までは先に進める
  const match = next.match(/^(?:[^/*?{}]+\/)*(?:[^/*?{}]+$)?/i);
  if (match) {
    start = path.join(start, match[0]);
    next = pattern.slice(match[0].length);
  }
  const pathes: Array<(item: IItem) => Iterable<IItem>> = [];
  while (next) {
    const match = next.match(
      /^(?:(\*\*(?:\/|$))|((?:[^/*?{}]+(?:\/|$))+)|([^/]+(?:\/|$)))/
    );
    if (!match) {
      throw new Error(`Unsupported wildcard: '${pattern}'`);
    }
    const directoryOnly = match[0].slice(-1) === '/';
    next = next.slice(match[0].length);

    if (match[0].slice(0, 2) === '**') {
      pathes.push(function* recursive(item: IItem): Iterable<IItem> {
        yield item;
        if (!item.stat.isDirectory()) {
          return;
        }
        for (const name of fs.readdirSync(item.path)) {
          const child = makeItem(item.path, name, directoryOnly);
          if (child) {
            yield* recursive(child);
          }
        }
      });
    } else if (/[*?{}<>]/.test(match[0])) {
      // ワイルドカードを含む場合はそのパターンにあったファイルかフォルダを返す
      const patternRe = toRegExp(match[0].replace(/\/$/, ''));
      pathes.push(function* (item: IItem) {
        for (const name of fs.readdirSync(item.path)) {
          if (!patternRe.test(name)) {
            continue;
          }
          // 途中のパターンはディレクトリだけを返す
          const child = makeItem(item.path, name, directoryOnly);
          if (child) {
            yield child;
          }
        }
      });
    } else {
      // ワイルドカードを含まない場合はそのパスをつなげて存在していればそのファイル、もしくはフォルダを返す
      const nextpath = match[2];
      pathes.push(function* (item: IItem) {
        const fpath = path.resolve(item.path, nextpath);
        // 存在していなければ返さない
        if (!fs.existsSync(fpath)) {
          return;
        }
        const stat = fs.statSync(fpath);
        // このパターンが途中にあって、見つかったのがファイルなら返さない
        if (directoryOnly && !stat.isDirectory()) {
          return;
        }
        yield {path: normalizeSep(fpath), name: path.basename(fpath), stat};
      });
    }
  }

  yield* (function* traverse(
    item: IItem,
    index: number
  ): Iterable<IItem> {
    if (ignore && ignore(item)) {
      return;
    }
    // 最後のパターンなら見つかったファイル、フォルダをすべて返す
    if (index + 1 === pathes.length) {
      yield* pathes[index](item);
      return;
    }
    for (const child of pathes[index](item)) {
      // パターンの途中なのでディレクトリ以外は無視
      if (!child.stat.isDirectory()) {
        continue;
      }
      // このディレクトリを基点にして検索
      yield* traverse(child, index + 1);
    }
  })({path: normalizeSep(start), name: path.basename(start) || start, stat: fs.statSync(start.replace(/\/$/, ''))}, 0); // ルートだけは名前がないことがあるのでパスそのものを名前とする
}
