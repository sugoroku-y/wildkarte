# wildkarte

`wildkarte`はワイルドカードを展開するためのライブラリです。

wildcardだとすでに別のモジュールが存在するようでしたので、cardをドイツ語に変えてみました。ドイツ語にした理由は「何となく格好いいから」以外にはありません。

[![NPM version](https://img.shields.io/npm/v/wildkarte.svg?style=flat)](https://www.npmjs.com/package/wildkarte)
[![NPM monthly download](https://img.shields.io/npm/dm/wildkarte.svg?style=flat)](https://www.npmjs.com/package/wildkarte)
[![NPM total download](https://img.shields.io/npm/dt/wildkarte.svg?style=flat)](https://www.npmjs.com/package/wildkarte)
[![Build Status](https://travis-ci.org/sugoroku-y/wildkarte.svg?branch=master)](https://travis-ci.org/sugoroku-y/wildkarte)
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

## 使い方

```ts
import * as wildkarte from 'wildkarte';

const traverser = wildkarte.expand('**\/*.js');
for await (const path of traverser(cwd)) {
  console.log(path);
}

const re = wildkarte.toRegExp('*.ts');

```

### `wildkarte.expand`

引数`start`に指定されたディレクトリから、パターンにマッチするすべてのファイル/ディレクトリを、startからの相対パスで返す、非同期ジェネレーターを返します。

```ts
export function expand(pattern: string, options?: {ignoreCase?: boolean, ignoreFiles?: IgnoreCallback}): (start: string) => AysncGenerator<string, void>;
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

`options: object` 検索に関するオプション。`ignoreCase`と`ignoreFiles`が指定できます。

- `ignoreCase: boolean` 検索時のファイル名で大文字小文字を区別する場合には真を指定します。  

ただし、`**`やワイルドカードが指定されている場所でのみ有効で、ファイル名やディレクトリ名が完全に指定されている箇所についてはファイルシステムの扱いに依存します。

省略時には`process.platform`が`win32`か`cygwin`であれば真を、その他の場合には偽を指定したものとします。

- `ignoreFiles: ({path: string, stat: fs.Stat}) => boolean` そのファイル、ディレクトリを無視するかどうかを決定する関数。

この関数がtrueを返したとき、そのファイル、もしくはそのディレクトリ以下のすべてのファイル、ディレクトリは`pattern`にマッチしてもスキップされます。

省略時はすべてのファイル・ディレクトリをスキップしません。

ただし、この関数で無視するかどうかを指定できるのは`**`やワイルドカードが指定されている場所でのみ有効で、ファイル名やディレクトリ名が完全に指定されている箇所については無視されません。

- `fileOnly: boolean` ファイルだけにマッチさせる場合には真を指定します。

たとえば、`**/*.js`というパターンには`node_modules/vue.js/`というディレクトリもマッチしてしまいますが、ファイルにだけマッチさせたい場合に真を指定します。

逆にディレクトリだけにマッチさせたい場合には`**/*.js/`のように末尾に`/`を追加してください。

#### 返値

引数`start`に指定されたディレクトリから、パターンにマッチするすべてのファイル/ディレクトリを、startからの相対パスで返す、非同期ジェネレーターを返します。

### `wildkarte.toRegExp`

ワイルドカードを正規表現に変換します。

#### 引数

`pattern: string` 検索するファイル/ディレクトリ名のパターン。

- `*` 0文字以上の`/`以外のすべての文字にマッチします。
- `?` 1文字の`/`以外のすべての文字にマッチします。
- `{パターン1,パターン2}` 複数のパターンにマッチします。  
  ネストも可です。  
  `/`は含められません。
- `<文字列>` ワイルドカードでの特殊文字を含んだファイル名にマッチさせるとき使用します。
  `<{*}?,>`のように複数で指定可能ですが、`>`だけは`<>>`のように単独で指定します。
  `/`は含められません。

`options: object` ワイルドカードを正規表現に変換するときのオプション。それぞれ省略可です。

- `start` ワイルドカードを開始したインデックス。
  変換時にエラーが発生したときのインデックス計算に使用します。
  省略時には0が指定されたものとします。
- `ignoreCase` ファイル名の大文字小文字を無視する場合に真を指定します。
  省略時にはprocess.platformが'win32'か'cygwin'であれば真、それ以外では偽が指定されたものとします。

#### 返値

指定したワイルドカード文字列を正規表現に変換したものを返します。
