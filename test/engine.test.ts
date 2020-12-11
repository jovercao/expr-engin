import assert from 'assert'
import { create } from '../lib'

describe('engine', function () {
  it('compile', async () => {
    const engin = create()
    try {
      const fn = await engin.compile('$days($now, $.expiryDate).toFixed(2)')
      console.log(fn.source)
      console.log(fn.output)
    } catch (ex) {
      console.log(ex.sourceCode)
      console.log(ex.targetCode)
      throw ex
    }
  })

  it('compile 函数/变量名检查', async () => {
    const engin = create()
    try {
      const fn = await engin.compile('$days($now1, $.expiryDate)')
      assert.fail()
    } catch (ex) {
      console.log(ex)
    }
  })

  it('compile 关键字 _ 检查', async () => {
    const engin = create()
    try {
      const fn = await engin.compile('_.ctx.connector.user.remoteAll()')
      assert.fail()
    } catch (ex) {
      console.log(ex)
    }
  })

  it('exec', async () => {
    const engin = create()
    const fn = engin.compile('$days($.expiryDate, $now)')
    console.log(fn.source)
    console.log(fn.output)
    const txt = await fn({ expiryDate: new Date(2019, 12, 18) })
    console.log(txt)
  })
})
