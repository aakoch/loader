import { fileURLToPath } from 'url';
import fs from 'fs'
import path from 'path';
import chalk from 'chalk';
const __filename = fileURLToPath(import.meta.url);
import linker from './index.js'
import { parseArguments } from '@foo-dog/utils'
import {inspect} from "util";

function printUsage() {
  const help = [''];
  const p = str => help.push(str ?? '')
  const b = str => help.push(chalk.bold(str))
  b("Linker")
  p('Reads a Pug AST (of mine) and links includes and extends')
  p()
  b('Usage')
  p(chalk.blue('node ' + path.basename(__filename) + ' [-h] [inFile] [outFile]'))
  p('inFile and outFile are both optional and will default to stdin and stdout if omitted.')
  p('You can also use "-" for inFile and outFile for their respective streams.')
  p()
  console.log(help.join('\n'))
}

async function run() {
  let options;
  try {
    options = await parseArguments(process, printUsage)

    const obj = await linker.link(fs.readFileSync(options.in.name, {encoding: 'utf-8'}));

    // .then(obj => {
    //   console.log("then")
    if (options.out) {
      const jsonString = JSON.stringify(obj, null, '  ');
      if (options.out.name == 'stdout') {
        process.stdout.write(jsonString)
      } else {
        fs.writeFileSync(options.out.name, jsonString)
      }
    }
    // })
    // .catch(reason => {
    //   console.error(reason)
    // })

    // setTimeout(function () {}, 1000)

  } catch (e) {
    if (chalk.supportsColorStderr) {
      console.error(chalk.chalkStderr(chalk.red(e.message)))
      console.error(e)
    } else {
      console.error('*'.repeat(30) + '\n' + e.message)
      console.error(e)
    }
  }
}

run()