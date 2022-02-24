import fs, { link, readFileSync } from 'fs'
import path from 'path'
import debugFunc from 'debug'
import { inspect } from 'util'
const debug = debugFunc('loader')
import stream from 'stream'
import LexingTransformer from 'pug-lexing-transformer'
import concat from 'concat-stream'
import { fileURLToPath } from 'url';
import { loadavg } from 'os'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
debug("__dirname=" + __dirname)
import indentTransformer from 'indent-transformer';
import WrapLine from '@jaredpalmer/wrapline'
import { exists, isSupportedFileExtension } from '@foo-dog/utils'
import crypto from 'crypto'

const buildDir = __dirname

const promises = []

async function walk(obj, options) {
  if (Array.isArray(obj)) {
    obj.forEach(item => walk(item, options))
  }
  else {
    visit(obj, options)
  }
  return obj
}

function findMatchingBase(directory1, directory2) {
  let index = 0
  let matches = true
  for (; index < directory1.length && index < directory2.length && matches; index++) {
    const char1 = directory1[index];
    const char2 = directory2[index];
    matches = char1 === char2
  }

  return directory1.substring(0, index - 1)
}

function fileInCache(filename) {
  return false;
}

var loadingFilenames = []
async function load(filename) {
  return new Promise((resolve, reject) => {
    try {
      // debug('load(): filename=' + filename)
      if (loadingFilenames.includes(filename)) {
      }
      else {
        loadingFilenames.push(filename)

        if (fileInCache(filename)) {
          reject('Not supported yet')
        }
        else {
          const dir = path.dirname(filename);
          const dir2 = path.join(buildDir, dir)
          fs.mkdirSync(dir2, { recursive: true })
          const newFile = path.join(filename + '.json');
          // debug('Writing to ' + path.resolve(newFile))
          const pugLexingTransformer = new LexingTransformer({ inFile: filename })
          return Promise.resolve(fs.createReadStream(filename)
            .pipe(WrapLine('|'))
            .pipe(WrapLine(function (pre, line) {
              // add 'line numbers' to each line
              pre = pre || 0
              return pre + 1
            }))
            .pipe(indentTransformer())
            .pipe(pugLexingTransformer)
            .pipe(concat({}, body => {
              const obj = JSON.parse(body.toString('utf-8'))
              debug('after concat, obj=', inspect(obj, false, 10));
              resolve(obj)
              // // debug(`concat(): newFile=${newFile}, body=${body.substring(0, 100)}...`)
              // fs.writeFile(newFile, body, 'utf-8', (err) => {
              //   if (err) throw err;
              //   console.log(`${newFile} written`);
              // })
            }))
            .on('error', e => {
              reject(e.message)
            }))
        }

      }
    }
    catch (e) {
      reject(e.message)
    }
  })
}

function visit(obj, options) {
  // debug("visit: obj=", obj)
  // debug("visit: options=", options)
  if (obj.hasOwnProperty('type') && (obj.type === 'include' || obj.type === 'extends')) {
    if (obj.hasOwnProperty('resolvedVal')) {

      debug('process.env=', process.env)
      debug('obj.resolvedVal=', obj.resolvedVal)
      debug('parsed path=', path.parse(obj.resolvedVal))
      const resolvedDir = path.parse(obj.resolvedVal).dir
      debug('resolvedDir=', resolvedDir)
      let linkedFile = path.resolve(process.env.PWD, resolvedDir, obj.file ?? obj.source)

      if (exists(linkedFile)) {

        let id = process.hrtime.bigint() + crypto.randomUUID()
        obj.id = id
        if (isSupportedFileExtension(path.parse(obj.file ?? obj.source).ext)) {
          promises.push(load(linkedFile).then(data => {
            debug("after reading file, data=", data)
            const history = obj.history ?? []
            history.push(Object.assign({}, obj))
            delete obj.file
            obj = Object.assign(obj, data[0], { history: history })
            return data
          }))
        }
        else {
          promises.push(fs.promises.readFile(linkedFile).then(data => {
            
            const history = obj.history ?? []
            history.push(Object.assign({}, obj))
            obj.source = obj.file
            delete obj.file
            delete obj.lineNumber
            obj = Object.assign(obj, { type: 'text', val: data.toString('utf-8')}, { history: history })

            // obj.type_old = obj.type
            // 
            // obj.source_old = obj.source
            // obj.type = 'text'
            // obj.val = data.toString('utf-8')
            // obj.id = id
            // delete obj.file
            debug('after setting obj, obj=', obj)
            return obj
          }))
        }
      }
      else {
        console.error("Could not load " + linkedFile);
      }
    }
    else {
      throw new Error('Missing path (file field) of file field in AST. Make sure you are using the latest version of pug-lexing-transformer. Offending object=' + inspect(obj))
    }
  }
  //   else if (obj.hasOwnProperty('name') && obj.name === 'extend') {

  //     if (obj.hasOwnProperty('source')) {
  //       let linkedFile = findFile(obj)

  //       obj.type = 'include'
  //       obj.name = linkedFile

  //       debug('linkedFile=' + linkedFile)
  //     }
  //     else {
  //       throw new Error('Missing "source" or "val"  field in AST. Make sure you are using the latest version of pug-lex-transformer')
  //     }
  //   }
  // }

  if (obj.hasOwnProperty('children')) {
    debug('children options=' + inspect(options))
    obj.children.forEach(item => walk(item, options))
  }

  return obj
}

function findFile(obj) {
  debug('obj.source=' + obj.source)
  debug('obj.val=' + obj.val)
  debug('path.dirname(obj.source)=' + path.dirname(obj.source))
  let linkedFile = path.resolve(path.normalize(path.join(path.dirname(obj.source), obj.val)))
  debug('linkedFile=' + linkedFile)
  return linkedFile
}

const linker = {
  link: async function (str, options) {
    debug('Entering load...')
    debug('options=' + inspect(options))

    const ast = JSON.parse(str)

    debug('starting ast=', inspect(ast, false, 10))

    const obj = walk(ast, options)

    await Promise.allSettled(promises).then(results => {
      debug('all settled. results=', inspect(results, false, 10))
    })

    debug('all finished. obj=', inspect(obj, false, 10))

    debug('Finished')

    return obj
  }
}

export default linker;