(function(global) {
    var Stream, succeed, string, regexp, seq, alt, red;

    function constant(value) {
        return function() {
            return value;
        };
    }

    Stream = {
        Cons: function(val, rest) {
            if(!(this instanceof Stream.Cons)) return new Stream.Cons(val, rest);
            this.val = val;
            this.rest = rest;
        },
        Empty: {
            isEmpty: true,
            toArray: constant([])
        },
        fromArray: function(a) {
            var s, i;
            if(!a.length) return Stream.Empty;

            s = function() { return Stream.Empty; };
            for(i = 0; i < a.length; i++) {
                s = Stream.Cons(a[i], s);
            }
            return s;
        },
        append: function(a, b) {
            var r = b, vals, i;
            if(a.isEmpty) return b;
            if(b.isEmpty) return a;

            vals = [a.val];
            while((a = a.rest()) && !a.isEmpty) {
                vals.push(a.val);
            }

            for(i = vals.length - 1; i >= 0; i--) {
                r = Stream.Cons(vals[i], constant(r));
            }

            return r;
        }
    };
    Stream.Cons.prototype.isEmpty = false;
    Stream.Cons.prototype.toArray = function() {
        var vals = [this.val], stream = this;
        while((stream = stream.rest()) && !stream.isEmpty) {
            vals.push(stream.val);
        }
        return vals;
    };

    function Success(val, rest) {
        if(!(this instanceof Success)) return new Success(val, rest);

        this.val = val;
        this.rest = rest;
    }
    Success.prototype.isSuccess = true;
    Success.prototype.isFailure = false;

    function Failure(rest) {
        if(!(this instanceof Failure)) return new Failure(rest);

        this.rest = rest;
    }
    Failure.prototype.isSuccess = false;
    Failure.prototype.isFailure = true;

    function makeParser(delayedParser) {
        var parser;
        return function(str, tramp, cont) {
            if(!parser)
                parser = delayedParser();
            if(tramp && cont) {
                return parser(str, tramp, cont);
            }
            return runParser(parser, str);
        };
    }

    function runParser(parser, str) {
        var tramp = new Trampoline(),
            results = [];

        function compute() {
            while(!results.length && tramp.hasNext()) {
                tramp.step();
            }
            return stream();
        }

        function stream() {
            var result = Stream.fromArray(results);
            results = [];
            if(tramp.hasNext()) {
                return Stream.append(result, compute());
            }
            return result;
        }

        parser(str, tramp, function(result) {
            if(result.isFailure || result.rest) return;
            results.push(result);
        });

        return compute();
    }

    function isEqual(a, b) {
        var all, i;
        if(typeof a != typeof b) {
            return false;
        } else if(a instanceof Array) {
            if(a.length != b.length) return false;
            all = true;
            for(i = 0; i < a.length; i++) {
                all = all && isEqual(a[i], b[i]);
            }
            return all;
        }
        return a == b;
    }

    function memo(fn) {
        var memoized = [];
        return function() {
            var i, j, all, result, entry;

            for(i = 0; i < memoized.length; i++) {
                if(memoized[i].key.length != arguments.length)
                    continue;

                all = true;
                for(j = 0; j < arguments.length; j++) {
                    all = all && isEqual(memoized[i].key[j], arguments[j]);
                    if(!all) break;
                }

                if(all)
                    return memoized[i].value;
            }

            result = fn.apply(null, arguments);
            entry = {
                key: arguments,
                value: result
            };
            memoized.push(entry);

            return result;
        };
    }

    function Trampoline() {
        var table = [];

        this.stack = [];
        this.table = table;

        this.hasNext = function() {
            return this.stack.length > 0;
        };

        this.step = function() {
            var head;
            if(!this.hasNext()) return;

            head = this.stack.shift();
            head.fn.apply(null, head.args);
        };

        this.push = function(fn, str, cont) {
            var entry, isEmpty, i, result;

            function resultSubsumed(entry, result) {
                var i, current;
                for(i = 0; i < entry.results.length; i++) {
                    current = entry.results[i];
                    if(current.isSuccess != result.isSuccess)
                        continue;
                    else if(current.isSuccess && isEqual(current.val, result.val) && current.rest == result.rest)
                        return true;
                    else if(current.rest == result.rest)
                        return true;
                }
                return false;
            }

            function tableRef(fn, str) {
                var memo, entry, i;

                for(i = 0; i < table.length; i++) {
                    if(table[i].key == fn) {
                        memo = table[i].value;
                        break;
                    }
                }

                if(memo && memo[str]) {
                    entry = memo[str];
                } else if(memo) {
                    entry = {
                        conts: [],
                        results: []
                    };
                    memo[str] = entry;
                } else {
                    entry = {
                        conts: [],
                        results: []
                    };
                    table.push({
                        key: fn,
                        value: entry
                    });
                }
                return entry;
            }

            entry = tableRef(fn, str);
            isEmpty = !entry.conts.length && !entry.results.length;
            entry.conts.push(cont);

            if(isEmpty) {
                this.stack.push({
                    fn: fn,
                    args: [
                        str,
                        this,
                        function(result) {
                            var i;

                            if(resultSubsumed(entry, result))
                                return;

                            entry.results.push(result);
                            for(i = 0; i < entry.conts.length; i++) {
                                entry.conts[i](result);
                            }
                        }
                    ]
                });
                return;
            }

            entry.conts.push(cont);
            for(i = 0; i < entry.results.length; i++) {
                cont(entry.results[i]);
            }
        };
    }

    succeed = memo(function(val) {
        return function(str, tramp, cont) {
            return cont(Success(val, str));
        };
    });

    string = memo(function(match) {
        return function(str, tramp, cont) {
            var len = Math.min(str.length, match.length),
                head = str.substr(0, len),
                tail = str.substr(len);

            if(head == match) {
                return cont(Success(head, tail));
            }
            return cont(Failure(tail));
        };
    });

    regexp = memo(function(pattern) {
        return function(str, tramp, cont) {
            var match = str.match(pattern),
                head,
                tail;

            if(!match || match.index)
                return cont(Failure(str));

            head = match[0];
            tail = str.substr(head.length);

            return cont(Success(head, tail));
        };
    });

    function bind(p, fn) {
        return function(str, tramp, cont) {
            return p(str, tramp, function(result) {
                if(result.isSuccess) {
                    return fn(result.val)(result.rest, tramp, cont);
                }
                return cont(result);
            });
        };
    }

    seq = memo(function() {
        var result = succeed([]), i;

        function seq2(b, a) {
            return bind(a, function(x) {
                return bind(b, function(y) {
                    return succeed(x.concat([y]));
                });
            });
        }

        for(i = 0; i < arguments.length; i++) {
            result = seq2(arguments[i], result);
        }

        return result;
    });

    alt = memo(function() {
        var parsers = arguments;
        return function(str, tramp, cont) {
            var i;
            for(i = 0; i < parsers.length; i++) {
                tramp.push(parsers[i], str, cont);
            }
        };
    });

    red = memo(function(p, fn) {
        return bind(p, function(val) {
            var args = val instanceof Array ? val : [val];
            return succeed(fn.apply(null, args));
        });
    });

    global.Success = Success;
    global.Failure = Failure;
    global.makeParser = makeParser;
    global.runParser = runParser;
    global.memo = memo;
    global.Stream = Stream;
    global.success = succeed;
    global.string = string;
    global.regexp = regexp;
    global.bind = bind;
    global.seq = seq;
    global.alt = alt;
    global.red = red;
})(typeof exports == 'undefined' ? this.gll = {} : exports);
