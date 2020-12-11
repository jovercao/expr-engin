/* eslint-disable no-new-func */
import * as helpers from './helpers'
import * as acorn from 'acorn'
import { Expression, Program, BaseExpression, SimpleCallExpression, Property } from 'estree'
import assert from 'assert'
import { ExprHelpers } from '.'
export interface ExprEngineOptions {
  helpers?: {
    [key: string]: any
  }
}

// type Mattched = {
//   result: string
//   startIndex: number
//   endIndex: number
// }

// function mattchBrackets(str: string, startIndex: number): Mattched {
//   const resultStart = str.indexOf('(', startIndex)
//   if (!resultStart) {
//     return null
//   }

//   let resultEnd: number;
//   let pairs = 1
//   let nextIndex = resultStart

//   while(true) {
//     let pos = str.indexOf('(', nextIndex)
//     if (pos > 0) {
//       pairs++
//       nextIndex = pos
//     }

//     pos = str.indexOf(')', nextIndex)

//     if (pos < 0) {
//       break
//     }
//     pairs--
//     nextIndex = pos
//     if (pairs === 0) {
//       resultEnd = pos
//       break
//     }
//   }

//   if (pairs !== 0) {
//     return  null
//   }

//   return {
//     result: str.substr(resultStart, resultEnd),
//     startIndex: resultStart,
//     endIndex: resultEnd
//   }
// }

/**
 * helper成员函数声明
 */
export type ExprFunction = (this: ExprHelpers, ...args: any) => any | Promise<any>

export class ExprEnginError extends Error {
  constructor(message: string, sourceCode?: string, targetCode?: string, location?: [line: number, column: number]) {
    super(message)
    this.sourceCode = sourceCode
    this.targetCode = targetCode
  }
  readonly sourceCode?: string;
  readonly targetCode?: string;
  readonly location?: [line: number, column: number]
}

function assertSyntax(value: any, msg: string, expr: BaseExpression): asserts value {
  if (!value) {
    throw makeError(msg, expr)
  }
}
function makeError(msg: string, expr: BaseExpression) {
  return new ExprEnginError(msg, expr.loc?.source, null, expr.loc && [expr.loc.start.line, expr.loc.start.column])
}

export type CompiledFunction<T = any, R = any> = {
  (ctx: T): Promise<R>
  /**
   * 编译前的源表达式
   */
  source: string
  /**
   * 编译后的目标表达式
   */
  output: string
}

const AsyncFunction = (async function () { }).constructor as {
  new(args: string, code: string): (...args: any[]) => Promise<any>
}

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

  private _compile(source: string): string {
    const doc: Program = acorn.parse(source, {
      ecmaVersion: 5
    }) as unknown as Program
    assert(doc.body.length === 1, '表达式引擎仅支持单条表达式运算。')
    assert(doc.body[0].type === 'ExpressionStatement', '语法错误，不是有效的表达式。')
    return this._print(doc.body[0].expression)
  }

  private _print(expr: Expression): string {
    switch (expr.type) {
      case 'Literal':
        return expr.raw
      case 'Identifier':
        assertSyntax(expr.name !== '_', `不允许使用 _ 关键字`, expr)
        // 仅独立的标识符在此编译,其它应在内部处理
        if (expr.name.startsWith('$') && expr.name.length > 1) {
          assertSyntax(this._helpers[expr.name], `未找到函数或变量${expr.name}.`, expr)
          return `(await _.${expr.name}.bind(_)())`
        }
        return expr.name
      case 'LogicalExpression':
        return `${this._print(expr.left)} ${expr.operator} ${expr.right}`
      case 'UnaryExpression':
        assertSyntax(["-", "+", "!", "~"].includes(expr.operator), '不支持的运算符：' + expr.operator, expr)
        return `${expr.operator}${expr.argument}`
      case 'BinaryExpression':
        assertSyntax(!["in", "instanceof"].includes(expr.operator), '不支持的运算符：' + expr.operator, expr)
        return `${this._print(expr.left)} ${expr.operator} ${expr.right}`
      case 'CallExpression':
        // assertSyntax(!call.arguments.find(arg => arg.type === 'SpreadElement'), `不支持展开语法`, expr)
        if (expr.callee.type === 'Identifier') {
          return `(await _.${expr.callee.name}.bind(_)(${expr.arguments.map((arg: Expression) => this._print(arg)).join(', ')}))`
        }
        assertSyntax(expr.callee.type !== 'Super', `不受支持的语法 super `, expr)
        return `${this._print(expr.callee)}(${expr.arguments.map((arg: Expression) => this._print(arg)).join(', ')})`
      case 'ConditionalExpression':
        return `${this._print(expr.test)} ? ${this._print(expr.consequent)} : ${this._print(expr.alternate)}`
      case 'MemberExpression':
        assertSyntax(expr.object.type !== 'Super', `不受支持的语法 super `, expr)
        const prop = expr.property.type === "Identifier" ? expr.property.name : this._print(expr.property)
        if (expr.computed) {
          return `(${this._print(expr.object)})[${prop}]`
        }
        return `(${this._print(expr.object)}).${prop}`
      case 'ArrayExpression':
        return `[${expr.elements.map((el: Expression) => this._print(el))}]`
      //     case 'ObjectExpression':
      //       return `{
      //   ${expr.properties.map((prop: Property) => `${prop.computed ? `[${this._compile(prop.key)}]` : ``}: ${this._compile(prop.value)}`)}
      // }`
      default:
        throw makeError(`不受支持的语法：${expr.loc.source}`, expr)
    }
  }

  // _compile(source: string) {
  //   let output: string[] = []
  //   const reg = /(?<!\.)(?:_\.)?(\$[a-zA-Z]\w+\b)(\s*\()?/g
  //   let arr: RegExpExecArray
  //   let index: number = 0
  //   while (arr = reg.exec(source)) {
  //     const [matched, identity, leftBracket] = arr
  //     // 检查引用的函数是否存在
  //     if (!this._helpers[identity]) {
  //       throw new Error(`表达式中所使用的函数/变量${identity}不存在，请检查是否正确。`)
  //     }
  //     output.push(source.substring(index, arr.index))
  //     index = arr.index + matched.length

  //     output.push('(await _.')
  //     output.push(identity)
  //     output.push('.bind($)')
  //     if (leftBracket) {
  //       const startIndex = arr.index + matched.length - 1
  //       const bracket = mattchBrackets(source, startIndex)
  //       if (!bracket) {
  //         throw new Error(`表达式语法错误：函数调用${identity}${leftBracket}未找到匹配的括号，位置${arr.index}`)
  //       }
  //       output.push('(')
  //       output.push(...this._compile(bracket.result.substring(1, bracket.result.length - 1)))
  //       output.push(')')
  //       reg.lastIndex = index = bracket.endIndex
  //     } else {
  //       output.push('()')
  //     }
  //   }
  //   output.push(source.substring(index, source.length))
  //   return output
  // }

  compile<T = any, R = any>(source: string): CompiledFunction<T, R> {

    const output = this._compile(source)
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
      fn = new AsyncFunction(argDefines.join(','), 'return ' + output)
    } catch (err) {
      throw new ExprEnginError('编译表达式失败，表达式语法错误：' + err.message, source, output)
    }
    const _ = this._helpers
    const result: CompiledFunction<T, R> = function (ctx) {
      try {
        return fn.apply(ctx, [ctx, _])
      } catch (err) {
        throw new Error('在执行表达式时遇到错误：' + err.message)
      }
    }
    result.source = source
    result.output = output
    return result
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
