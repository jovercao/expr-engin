/* eslint-disable no-new-func */
import * as helpers from './helpers'

export interface ExprEngineOptions {
  helpers?: {
    [key: string]: (...args) => any
  }
}

function mattchBrackets(str: string, startIndex: number) {
  let times = 0
  let nextIndex = startIndex
  let resultStart: number, resultEnd: number;
  while(true) {
    const pos = str.indexOf('(', nextIndex)
    if (resultStart === undefined && pos < 0) {
     return
    }
    if (pos > 0) {
      times ++
      resultStart = pos
    }
  
    nextIndex = str.indexOf(')', nextIndex)
    if (nextIndex < 0) {
      return
    }
    if (nextIndex > 0) {
      times--
    }

    if (times === 0) {
      return str.substring(resultStart, nextIndex)
    }
  }
  
}

export class ExprEnginError extends Error {
  constructor(message: string, sourceCode: string, targetCode: string) {
    super(message)
    this.sourceCode = sourceCode
    this.targetCode = targetCode
  }
  readonly sourceCode: string;
  readonly targetCode: string;
}


const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor

export class ExprEngine {
  constructor(options: ExprEngineOptions) {
    this._helpers = Object.assign({}, options.helpers || {})
  }

  private _helpers: Record<string, (...args: any) => any>
  
  addHelper(name: string, fn: (...args: any) => any, desc?: string): void
  addHelper(fn: (...args: any) => any, desc?: string): void
  addHelper(name: string | ((...args: any) => any), fn?: string | ((...args: any) => any), desc?: string) {
    if (typeof name === 'function') {
      fn = name
      name = fn.name
    }

    this._helpers[name] = fn as (...args: any) => any
  }

  compile<T>(exp: string): (ctx: T) => Promise<any> {
    let code = exp.replace(/(?<!\.)(?:_\.)?(\$[a-zA-Z]\w+\b)(?!\s*\()/g, '$1()')
    code = code.replace(/(?<!\.)(?:_\.)?(\$[a-zA-Z]\w+\b)(?=\s*\()/g, (matched, $1, offset) => {
        // 检查引用的函数是否存在
        if (!this._helpers[$1]) {
          throw new Error(`表达式中所使用的函数/变量${$1}不存在，请检查是否正确。`)
        }
        return `await _.${$1}.bind($)`
      })
    code = 'return ' + code

    let fn
    /**
     * $ 指向上下文对象
     * this 指向上下文对象
     * _ 指向helpers
     */
    // TODO: 语法检查，_不允许用户使用
    const argDefines = ['$', '_']
    try {
      // 编译表达式为异步函数
      fn = new AsyncFunction(argDefines, code)
      console.log(fn.toString())
    } catch (err) {
      throw new ExprEnginError('编译表达式失败，表达式语法错误：' + err.message, exp, code)
    }
    const _ = this._helpers
    return function (ctx) {
      try {
        return fn.apply(ctx, [ctx, _])
      } catch (err) {
        throw new Error('在执行表达式时遇到错误：' + err.message)
      }
    }
  }

 async exec<T>(exp: string, ctx: T): Promise<any> {
    const fn = this.compile(exp)
    return fn(ctx)
  }
}

/**
 * 创建一个表达式引擎
 * @param {*} options
 * @returns
 */
export function create(options?: ExprEngineOptions): ExprEngine {
  const _helpers = Object.assign({}, helpers)
  if (options?.helpers) {
    Object.assign(_helpers, options?.helpers ?? {})
  }
  return new ExprEngine({
    helpers: _helpers
  })
}

export default create()
