# wildkarte

`wildkarte`はワイルドカードを展開するためのライブラリです。

wildcardだとすでに別のモジュールが存在するようでしたので、cardをドイツ語に変えてみました。ドイツ語にした理由は「何となく格好いいから」以外にはありません。

## 使い方

```ts
import * as wildkarte from 'wildkarte';

for (const arg of process.argv.slice(2)) {
  for (const {path} of wildkarte.expand(arg)) {
    console.log(path)
  }
}

const re = wildkarte.toRegExp('**/*.ts', wildkarte.FOR_PATH);

```

### `wildkarte.IItem`

ファイル/ディレクトリの情報を持つinterfaceです。

```ts
interface IItem {
  path: string;
  name: string;
  stat: fs.Stats;
}
```

- `path: string` ファイル/ディレクトリのフルパス。  
  ただし、パスのセパレーターはOSにかかわらず、`/`となります。
- `name: string` ファイル/ディレクトリの名前。
- `stat: fs.Stats` ファイル/ディレクトリのfs.statの返値。

### `wildkarte.expand`

指定されたパターンにマッチするすべてのファイル/ディレクトリの`IItem`を順次返すIterableを返します。

```ts
export function expand(pattern: string, basedir?: string, ignore?: IgnoreCallback): Iterable<IItem>;
export function expand(pattern: string, ignore: IgnoreCallback): Iterable<IItem>;
export function expand(pattern: string, options: {basedir?: string; ignore?: IgnoreCallback}): Iterable<IItem>;
```

#### 引数

`pattern: string` 検索するファイル/ディレクトリ名のパターン。パスのセパレーターはOSにかかわらず`/`を使用してください。

- `**`はそれ以下のすべてのパス
- `?`はファイル/ディレクトリの名前に使用されるすべての1文字
- `*`はファイル/ディレクトリの名前に使用されるすべての0個以上の文字
- `{AAA,BBB}`は`AAA`か`BBB`のいずれか。  
  ※ `AAA`や`BBB`の部分は
  - `*`や`?`のワイルドカードを含めることができます。
  - `{xxx,yyy{AAA,BBB}}`のようにネストできます。
  - `/`を含めることはできません。
- `<～>`は`<`と`>`で囲まれた間の文字をワイルドカードとしてではなく、その文字として扱います。ただし、`/`を含めることはできません。

`options: object` 検索に関するオプション。`basedir`と`ignore`が指定できます。

`basedir: string` 検索を開始するディレクトリへのパス。  

省略時にはカレントディレクトリを指定したものとします。

`ignore: IgnoreCallback` そのファイル、ディレクトリを無視するかどうかを決定する関数。

この関数がtrueを返したとき、そのファイル、もしくはそのディレクトリ以下のすべてのファイル、ディレクトリは`pattern`にマッチしてもスキップされます。

省略時はすべてのファイル・ディレクトリをスキップしません。

#### 返値

`IItem`を順次返すItearbleを返します。

### `wildkarte.toRegExp`

ワイルドカードを正規表現に変換します。

#### 引数

`pattern: string` 検索するファイル/ディレクトリ名のパターン。

 `regExpFor RegExpFor` 複数階層に渡るワイルドカードをサポートする場合はwildcard.FOR_PATHを指定します。

#### 返値

指定したワイルドカード文字列を正規表現に変換したものを返します。


