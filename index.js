(function(global) {
    var Stream, succeed, string, seq;

    Stream = {
        Cons: function(val, rest) {
            if(!(this instanceof Stream.Cons)) return new Stream.Cons(val, rest);
            this.val = val;
            this.rest = rest;
        },
        Empty: {
            isEmpty: true
        },
        fromArray: function(a) {
            var s = Stream.Empty, i;
            for(i = 0; i < a.length; i++) {
                s = Stream.Cons(a[i], s);
            }
            return s;
        },
        append: function(s) {
            throw new Error("TODO");
        }
    };
    Stream.Cons.prototype.isEmpty = false;

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

    function makeParser(parser) {
        return function(str, tramp, cont) {
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
                return Stream.append(result, makeStream(compute()));
            }
            return result;
        }

        parser(str, tramp, function(result) {
            if(result.isFailure || result.rest) return;
            results.push(result);
        });

        return compute();
    }

    function memo(fn) {
        var memoized = [];
        return function() {
            var i, result, entry;

            for(i = 0; i < memoized.length; i++) {
                if(memoized[i].key == arguments) {
                    return memoized[i].value;
                }
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
        this.stack = [];
        this.table = [];

        this.hasNext = function() {
            return this.stack.length > 0;
        };

        this.step = function() {
            var head;
            if(!this.hasNext()) return;

            head = this.stack[0];
            this.stack.splice(0, 1);
            head.fn.apply(null, head.args);
        };

        this.push = function() {
            throw new Error("TODO");
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
        var result = succeed(''), i;

        function seq2(b, a) {
            return bind(a, function(x) {
                return bind(b, function(y) {
                    return succeed(x.concat(y));
                });
            });
        }

        for(i = 0; i < arguments.length; i++) {
            result = seq2(arguments[i], result);
        }

        return result;
    });

    global.Success = Success;
    global.Failure = Failure;
    global.makeParser = makeParser;
    global.runParser = runParser;
    global.memo = memo;
    global.Stream = Stream;
    global.success = succeed;
    global.string = string;
    global.bind = bind;
    global.seq = seq;
})(typeof exports == 'undefined' ? this.gll = {} : exports);
