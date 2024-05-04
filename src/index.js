import fs from 'fs'
import path from 'path'
import stream from 'stream'
import debugFunc from 'debug'
import {inspect} from 'util'
import LexingTransformer from '@foo-dog/lexing-transformer'
import {exists, isSupportedFileExtension, withCreateStreams} from '@foo-dog/utils'
import crypto from 'crypto'

const debug = debugFunc('loader')

async function walk(obj, options = {depth: 0}) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = await walk(obj[i], Object.assign({depth: (options.depth ?? 0) + 1}));
    }
  } else {
    obj.depth = options.depth

    if (obj.children) {
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
  let aStream = new stream.PassThrough();
  const options = withCreateStreams({in: {name: filename}, out: {createStream: () => aStream}});

  const lexingTransformer = new LexingTransformer(options)
  const fullLexingTransformer = new lexingTransformer.FullLexingTransformer(options)
  await fullLexingTransformer.processFile(options)

  let processedOutput = await streamToString(aStream);
  
  return JSON.parse(processedOutput)
}

async function streamToString(aStream) {
  // lets have a ReadableStream as a stream variable
  const chunks = [];

  for await (const chunk of aStream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function visit(obj, options) {
  if (obj.hasOwnProperty('type') && (obj.type === 'include' || obj.type === 'extends')) {
    if (obj.hasOwnProperty('resolvedVal')) {
      let linkedFile = obj.resolvedVal
      debug('linkedFile=', linkedFile)

      if (exists(linkedFile)) {
        obj.id = process.hrtime.bigint() + crypto.randomUUID()
        if (isSupportedFileExtension(path.parse(obj.resolvedVal ?? obj.file).ext)) {
          let fileContents = await load(linkedFile);

          if (Array.isArray(fileContents)) {
            if (fileContents.length === 1) {
              fileContents = Object.assign({}, {history: obj}, fileContents[0])
            } else {
              fileContents = Object.assign({}, {history: obj}, {children: fileContents})
            }
          } else {
            fileContents = Object.assign({}, {history: obj}, fileContents)
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
  link: async function (str, options = {}) {
    debug('Entering load...')
    debug('options=' + inspect(options))
    const ast = JSON.parse(str)
    debug('starting ast=', inspect(ast, false, 10))
    return await walk(ast, Object.assign(options, {depth: 0}))
  },
}

export default linker
