GLL.js
======

Generalised Parser Combinators in JavaScript

This library is an JavaScript implementation of Vegard Øye's brilliant
tutorial on implementing a GLL framework in Racket:

[https://github.com/epsil/gll](https://github.com/epsil/gll)

About
-----

Generalised parsers are special because they can handle any ambiguous
context-free grammar. They work by performing a breadth-first search
on all possible transitions.

This library provides combinators for creating and composing
generalised parsers. Any combination of parsers can be composed
together to form a valid parser.

This implementation uses memoisation and a streaming API for
performance improvements. Best case performance is O(n) according to
input size, if the grammar is LL(1). The worse case performance is
O(n^3), if the grammar is highly ambiguous.

Examples
--------

### Highly-ambiguous grammar

S := b | S S | S S S

    val input = 'bbbbbbb';
    var S = gll.makeParser(function() {
        return gll.alt(
            gll.string('b'),
            gll.seq(S, S),
            gll.seq(S, S, S)
        );
    });
    var result = S(input);

    if(!result.isEmpty && result.val.isSuccess) {
        console.log('Got a sequence of b characters');
    }


### Balanced parentheses

S := ( S ) | ε

    var input = '(())';
    var balancedParens = gll.makeParser(function() {
        return gll.alt(
            gll.seq(gll.string('('), balancedParens, gll.string(')')),
            gll.string('')
        );
    });
    var result = balancedParens(input);

    if(!result.isEmpty && result.val.isSuccess) {
        console.log('Input had balanced parenthesis');
    }

Combinators
-----------

### succeed(val)

Always succeeds with the given value, without consuming the input
string.

### string(match)

Succeeds if the input string equals the match string.

### regexp(pattern)

Succeeds if the input string matches the RegExp pattern.

### seq(...)

Succeeds if the input string succeeds for all supplied parsers, in
order.

### alt(...)

Succeeds if the input string succeeds for any supplied parsers, in
order.

### red(p, fn)

Runs the supplied function over a successful result, if the supplied
parser succeeds.

Resources
---------

* [General Parser Combinators in Racket](https://github.com/epsil/gll),
  Vegard Øye, 2012
* [Generalized Parser Combinators](http://www.cs.uwm.edu/~dspiewak/papers/generalized-parser-combinators.pdf),
  Daniel Spiewak, 2010
