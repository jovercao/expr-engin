import assert from 'assert'
import { create } from '../lib'

describe('engine', function () {
  it('compile', async () => {
    const engin = create()
    try {
      const fn = await engin.compile('$days($now, $.expiryDate)')
    } catch (ex) {
      console.log(ex.sourceCode)
      console.log(ex.targetCode)
      throw ex
    }
  })

  it('compile 应该报错', async () => {
    const engin = create()
    try {
      const fn = await engin.compile('$days($now1, $.expiryDate)')
      assert.fail('应该报错的！')
    } catch (ex) {
      assert.strictEqual(ex.message, '表达式中所使用的函数/变量$now1不存在，请检查是否正确。')
    }
  })

  it('exec', async () => {
    const engin = create()
    const txt = await engin.exec('$days($.expiryDate, $now)', { expiryDate: new Date(2019, 12, 18) })
    console.log(txt)
  })
})
