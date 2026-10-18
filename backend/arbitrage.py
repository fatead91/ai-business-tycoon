"""Pure back/lay arithmetic. Inputs below are invented fixtures, never live odds."""
from math import isfinite

FIXTURES = [
    dict(event='Northbridge v Southport', market='Match winner · Northbridge', back_exchange='Betfair',
         lay_exchange='Smarkets', back_odds=2.20, lay_odds=2.10, back_commission=0.02,
         lay_commission=0.02, back_liquidity=450.0, lay_liquidity=350.0),
    dict(event='Westhaven v Eastfield', market='Match winner · Westhaven', back_exchange='Matchbook',
         lay_exchange='Betfair', back_odds=1.85, lay_odds=1.90, back_commission=0.02,
         lay_commission=0.02, back_liquidity=120.0, lay_liquidity=200.0),
]


def evaluate(quote, back_stake=100.0, available_capital=10000.0):
    b, l = quote['back_odds'], quote['lay_odds']
    cb, cl = quote['back_commission'], quote['lay_commission']
    values = [b, l, cb, cl, back_stake, available_capital,
              quote['back_liquidity'], quote['lay_liquidity']]
    if not all(isfinite(v) for v in values) or b <= 1 or l <= 1 or not 0 <= cb < 1 or not 0 <= cl < 1:
        raise ValueError('Invalid odds, commissions or non-finite input')
    if back_stake <= 0 or available_capital < 0 or min(quote['back_liquidity'], quote['lay_liquidity']) < 0:
        raise ValueError('Stake must be positive; capital and liquidity cannot be negative')
    # Equalise the two net outcomes, including both exchange commissions.
    lay_stake = round(back_stake * (1 + (b - 1) * (1 - cb)) / (l - cl), 2)
    liability = round(lay_stake * (l - 1), 2)
    win = round(back_stake * (b - 1) * (1 - cb) - liability, 2)
    lose = round(lay_stake * (1 - cl) - back_stake, 2)
    required = round(back_stake + liability, 2)
    reasons = []
    if min(win, lose) <= 0:
        reasons.append('No positive edge after commissions')
    if back_stake > quote['back_liquidity'] or lay_stake > quote['lay_liquidity']:
        reasons.append('Insufficient fixture liquidity')
    if required > available_capital:
        reasons.append('Insufficient unallocated paper capital')
    return quote | dict(back_stake=back_stake, lay_stake=lay_stake, liability=liability,
                        capital_required=required, profit_if_win=win, profit_if_lose=lose,
                        estimated_profit=min(win, lose), roi=round(min(win, lose) / required * 100, 2),
                        approved=not reasons, reasons=reasons, simulated=True)
