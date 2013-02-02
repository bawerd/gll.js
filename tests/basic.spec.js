var gll = require('../index');

describe('Basic', function() {
    it('S := b | S S | S S S', function() {
        var S,
            input,
            result,
            i,
            j;

        S = gll.makeParser(function() {
            return gll.alt(
                gll.string('b'),
                gll.seq(S, S),
                gll.seq(S, S, S)
            );
        });

        for(i = 1; i < 15; i++) {
            input = '';
            for(j = 0; j < i; j++) {
                input += 'b';
            }

            result = S(input);
            expect(result.isEmpty).toBe(false);
            expect(result.val.isSuccess).toBe(true);
        }
    });

    it('S := ( S ) | ε', function() {
        var balancedParens,
            input,
            result,
            i,
            j;

        balancedParens = gll.makeParser(function() {
            return gll.alt(
                gll.seq(gll.string('('), balancedParens, gll.string(')')),
                gll.string('')
            );
        });

        for(i = 0; i < 50; i++) {
            input = '';
            for(j = 0; j < i; j++) {
                input += '(';
            }
            for(j = 0; j < i; j++) {
                input += ')';
            }

            result = balancedParens(input);
            expect(result.isEmpty).toBe(false);
            expect(result.val.isSuccess).toBe(true);
        }
    });
});
