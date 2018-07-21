'use strict'
var _Heap = require('heap')
var Heap = function (cmp) { return new _Heap(cmp) }
var LOG = false

module.exports = function (opts) {
  var exports = {}

  function getNewValue(hops, j, k, v) {
    return opts.min(hops[k], opts.add(hops[j], v))
  }

  //take a graph, and return it's inverse
  exports.reverse = function (g) {
    var _g = {}
    for(var k in g) {
      for(var j in g[k]) {
        _g[j] = _g[j] || {}
        _g[j][k] = g[k][j]
      }
    }
    return _g
  }

  exports.traverse = function (g, _g, max, from) {
    return exports.brute(g, _g, max, from)
  }

  function _loop (g, max, hops, next) {
    while(!next.empty()) {
      var j = next.pop()
      if(opts.expand(hops[j], max))
        for(var k in g[j]) {
          var _h = getNewValue(hops, j, k, g[j][k])
          if(isNaN(_h)) throw new Error('NaN')
          if(_h != hops[k]) {
            hops[k] = _h
            next.push(k)
          }
        }
    }
    return hops
  }

  exports.brute = function (g, _g, max, from, C, LOG) {
    var hops = {}
    hops[from] = opts.initial()
    var next = Heap(function (a, b) {
      if(hops[a] == null || hops[b] == null)
        throw new Error('insert with null hops')
       return hops[a] - hops[b]
    }, function (k) { return hops[k] })
    next.push(from)
    return _loop(g, max, hops, next)
  }

  //find all nodes reachable via `from` with hops at > was
  exports.uncertain = function (g, hops, max, start) {
    var was = hops[start]
    var maybe = {}
    maybe[start] = true
    var next = Heap(function (a, b) {
      return hops[a] - hops[b]
    })
    next.push(start)
    while(!next.empty()) {
      var j = next.pop()
      for(var k in g[j])
        if(hops[k] === opts.add(hops[j], g[j][k])) {
          if(!maybe[k]) {
            maybe[k] = true
            next.push(k)
          }
        }
    }
    return maybe
  }

  exports.sources = function (_g, hops, maybe) {
    if(!_g) throw new Error('backlink graph must be provided')
    var update = {}
    for(var k in maybe)
      if(hops[k])
        for(var j in _g[k])
          if(!maybe[j] && hops[j] != null)
            update[j] = true
    return update
  }

  function update_graphs(g, _g, from, to, value) {
    g[from] = g[from] || {}
    _g[to] = _g[to] || {}
    g[from][to] = _g[to][from] = value
  }

  exports.update = function (g, _g, hops, max, start, from,to,value) {
    hops[start] = opts.initial()
    //added edge cannot be in traversal if it's starting point isn't

    if(value >= 0) {
      update_graphs(g, _g, from, to, value)

      if(hops[from] == null || from == to) return hops
      var h = getNewValue(hops, from, to, value)

      //if destination is max or more, do not add edge
      if(!opts.expand(hops[from], max)) return hops

      if(h != hops[to]) {
        var next = Heap(function (a, b) { return hops[a] - hops[b] })
        hops[to] = h
        next.push(to)

        _loop(g, max, hops, next)
        //we added the edge.
        //now check if this has brought other edges into the graph
      }

    } else {
      if(!value && !_g) throw new Error('expected increment:'+value)
      var j = from, k = to, v = value, _v = g[from] && g[from][to]
      if(
        to === start || //don't ever block self
        ( //already closer
          //if previous value was null, or previous didn't set the hops value anyway.
          (_v == null  || (opts.add(hops[j], _v) !== hops[k])) &&
          opts.min(hops[k], opts.add(hops[j], v)) === hops[k]
        ) || ( //unchanged hops
          //if the current value not beat this link (but this in an update to our old value)
          //quickly check that there is another link to beat it.
          //this catches the case when someone unfollows, but there is another path the same length.
            hops[k] == opts.add(hops[j], _v) && 
            hops[k] === opts.min(hops[k], opts.add(hops[j], v)) &&
            (function () {
              for(var _j in _g[k])
                if(_j !== j && opts.add(hops[_j], g[_j][k]) === hops[k]) {
                  return true
                }
            }())
        )
      ) {
        //won't change hops, so update graph and return
        update_graphs(g, _g, from, to, value)
        return hops

      } else if (null && hops[j] >= 0) {
        //only adds the new item, but won't expand since this is a block.
        update_graphs(g2, _g2, j,k,v)
        if(opts.expand(hops[j], 3))
          hops[k] = opts.add(hops[j], v)
      } else {

        var next = Heap(function (a, b) {
          return hops[a] - hops[b]
        }, function (k) { return hops[k] })

        //if the path removed is the edge keeping this node
        //in the graph, then the graph will totally change.

        var _value_from_us = opts.add(hops[from], g[from] && g[from][to])
        var value_from_us = opts.add(hops[from], value)
        if(
          to === start || //don't ever remove self from graph
          !opts.expand(hops[from], max) ||
          (
            //if the current value is the value from this branch
            g[from] && g[from][to] === null &&
            //this means we might be the one to bring this into the traversal
            (
              hops[to] !== opts.add(hops[from], value) &&
              hops[to] === opts.min(hops[to], opts.add(hops[from], value))
            )
          )
        ) {
          update_graphs(g, _g, from, to, value)
          return hops
        }

        var maybe = exports.uncertain(g, hops, max, to)

        var start = process.hrtime()
        var sources = exports.sources(_g, hops, maybe)

        update_graphs(g, _g, from, to, value)

        sources[from] = true
        for(var _k in maybe) delete hops[_k]

        exports.updateAll(g, hops, max, sources)
        return hops
      }
    }
    return hops

  }

  exports.updateAll = function (g, hops, max, sources) {
    var next = Heap(function (a, b) { return hops[a] - hops[b] })

    for(var k in sources) next.push(k)

    _loop(g, max, hops, next)
    return hops
  }

  return exports
}




