import * as wildkarte from 'wildkarte';


for (const arg of process.argv.slice(2)) {
  for (const {path} of wildkarte.expand(arg)) {
    console.log(path)
  }
}

const re = wildkarte.toRegExp('**/*.ts', wildkarte.FOR_PATH);
