import fs from 'fs'
import path from 'path'
import debugFunc from 'debug'
import {inspect} from 'util'
import LexingTransformer from '@foo-dog/lexing-transformer'
import {fileURLToPath} from 'url'
import indentTransformer from '@foo-dog/indent-transformer'
import WrapLine from '@jaredpalmer/wrapline'
import {exists, isSupportedFileExtension} from '@foo-dog/utils'
import crypto from 'crypto'

const debug = debugFunc('loader')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
debug('__dirname=' + __dirname)

const buildDir = __dirname

const promises = []

function visitWithDepth(options) {
  return async el => {
    return await walk(el, Object.assign({depth: (options.depth ?? 0) + 1}));
  };
}

async function walk(obj, options = {depth: 0}) {
  console.log("options.depth=" + options.depth)
  if (Array.isArray(obj)) {
    //   console.log("Found array")
    //   obj = await obj.map(await visitWithDepth(options))
    for (let i = 0; i < obj.length; i++) {
      obj[i] = await walk(obj[i], Object.assign({depth: (options.depth ?? 0) + 1}));
    }
    //   // let arrayPromises = obj.map(item => walk(item, options))
    //   // return Promise.all(arrayPromises) //.then(value => obj = value)
  } else {
    //   // const visitPromise = visit(obj, options);
    //   // return visitPromise.then(value => obj = value)
    //   // return visit(obj, options);
    //   console.log("Found object: ", inspect(obj, false, 4))
    obj.depth = options.depth

    if (obj.children) {
      // obj.children = await obj.children.map(await visitWithDepth(options))

      for (let i = 0; i < obj.children.length; i++) {
        obj.children[i] = await walk(obj.children[i], Object.assign({depth: (options.depth ?? 0) + 1}));
      }
    } else {
      obj = await visit(obj, options)
    }
  }
  return obj
}

function findMatchingBase(directory1, directory2) {
  let index = 0
  let matches = true
  for (; index < directory1.length && index < directory2.length && matches; index++) {
    const char1 = directory1[index]
    const char2 = directory2[index]
    matches = char1 === char2
  }

  return directory1.substring(0, index - 1)
}

function fileInCache(filename) {
  return false
}

async function load(filename) {
  const lexingTransformer = new LexingTransformer({inFile: filename})
  return JSON.parse(await streamToString(fs.createReadStream(filename, {encoding: 'utf-8'})
    .pipe(WrapLine('|'))
    .pipe(
      WrapLine(function (pre, line) {
        // add 'line numbers' to each line
        pre = pre || 0
        return pre + 1
      })
    )
    .pipe(indentTransformer())
    .pipe(lexingTransformer)))
}

async function streamToString(stream) {
  // lets have a ReadableStream as a stream variable
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function visit(obj, options) {
  let retPromise;
  if (obj.hasOwnProperty('type') && (obj.type === 'include' || obj.type === 'extends')) {
    if (obj.hasOwnProperty('resolvedVal')) {
      let linkedFile = obj.resolvedVal
      debug('linkedFile=', linkedFile)

      if (exists(linkedFile)) {
        let id = process.hrtime.bigint() + crypto.randomUUID()
        obj.id = id
        if (isSupportedFileExtension(path.parse(obj.resolvedVal ?? obj.file).ext)) {
          let fileContents = await load(linkedFile);

          if (Array.isArray(fileContents)) {
            fileContents = Object.assign({history: obj}, {children: fileContents})
          } else {

            fileContents = Object.assign({}, {history: obj}, await load(linkedFile))
          }

          return fileContents
        } else {
          let text = fs.readFileSync(linkedFile, {encoding: 'utf-8'})
          return Object.assign({}, {type: 'text', val: text, history: obj, source: obj.resolvedVal})
        }
      } else {
        console.error('Could not load ' + linkedFile)
      }
    } else {
      throw new Error(
        'Missing path (file field) of file field in AST. Make sure you are using the latest version of lexing-transformer. Offending object=' +
        inspect(obj)
      )
    }
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
    return await walk(ast, options)
  },
}

export default linker
