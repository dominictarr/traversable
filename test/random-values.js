var u = require('./util')
var assert = require('assert')
var T = require('../')(require('../simple'))
//random value between -1 and 2
u.seed(1)
function R () {
  return u.randomNumber()*3 - 1
}
function testRandom (N, K, J, seed) {
  var g = u.random(N, K, R)
  var g2 = {}, _g2 = {}, hops = {}
  for(var i = 0; i < J; i++) {
    var g = u.random(N, K, R)
    ;(function () {
      for(var j in g)
        for(var k in g[j]) {
          var _hops = T.traverse(g2, _g2, 3, 'A')
          var v = g[j][k]
          console.log(g2)
          var update = T.update(g2, _g2, hops, 3, 'A',j, k, v)
          var post_hops = T.traverse(g2, _g2, 3, 'A')
          console.log({from:j,to:k,value:v})
          console.log('old',  _hops)
          console.log('new',  hops)
          console.log('update', update)
          console.log('brute', T.traverse(g2, _g2, 3, 'A'))
          assert.deepEqual(hops, post_hops)
          u.assertUpdate(update, _hops, hops)
        }
    })()
  }
}

testRandom(3, 2, 2, 1)
//
//testRandom(3, 2, 2, 2)

