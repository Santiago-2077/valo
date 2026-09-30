from datetime import date

import pytest

from app.services.billing import Statement, closing_date, cycle_for, statement_for


class TestClosingDate:
    def test_regular_day(self) -> None:
        assert closing_date(2026, 9, 20) == date(2026, 9, 20)

    @pytest.mark.parametrize(
        ("year", "month", "expected"),
        [
            (2026, 2, date(2026, 2, 28)),
            (2028, 2, date(2028, 2, 29)),  # leap year
            (2026, 4, date(2026, 4, 30)),
            (2026, 1, date(2026, 1, 31)),
        ],
    )
    def test_clamps_to_month_end(self, year: int, month: int, expected: date) -> None:
        assert closing_date(year, month, 31) == expected


class TestStatementFor:
    def test_purchase_before_closing_falls_in_current_cycle(self) -> None:
        st = statement_for(date(2026, 9, 15), closing_day=20, due_day=10)
        assert st == Statement(
            period_start=date(2026, 8, 21),
            closing_date=date(2026, 9, 20),
            due_date=date(2026, 10, 10),
        )

    def test_purchase_on_closing_day_is_included(self) -> None:
        st = statement_for(date(2026, 9, 20), closing_day=20, due_day=10)
        assert st.closing_date == date(2026, 9, 20)

    def test_purchase_after_closing_moves_to_next_cycle(self) -> None:
        st = statement_for(date(2026, 9, 21), closing_day=20, due_day=10)
        assert st.period_start == date(2026, 9, 21)
        assert st.closing_date == date(2026, 10, 20)
        assert st.due_date == date(2026, 11, 10)

    def test_year_rollover(self) -> None:
        st = statement_for(date(2026, 12, 28), closing_day=20, due_day=10)
        assert st.closing_date == date(2027, 1, 20)
        assert st.due_date == date(2027, 2, 10)

    def test_due_day_after_closing_day_is_same_month(self) -> None:
        st = statement_for(date(2026, 9, 3), closing_day=5, due_day=25)
        assert st.closing_date == date(2026, 9, 5)
        assert st.due_date == date(2026, 9, 25)

    def test_due_day_equal_to_closing_day_is_next_month(self) -> None:
        st = statement_for(date(2026, 9, 3), closing_day=10, due_day=10)
        assert st.due_date == date(2026, 10, 10)

    def test_closing_31_in_february(self) -> None:
        st = statement_for(date(2026, 2, 28), closing_day=31, due_day=20)
        assert st == Statement(
            period_start=date(2026, 2, 1),
            closing_date=date(2026, 2, 28),
            due_date=date(2026, 3, 20),
        )

    def test_closing_31_march_period_starts_after_feb_clamp(self) -> None:
        st = statement_for(date(2026, 3, 1), closing_day=31, due_day=20)
        assert st.period_start == date(2026, 3, 1)
        assert st.closing_date == date(2026, 3, 31)

    def test_closing_30_period_start_after_january_31st(self) -> None:
        # Jan closes on the 30th, so Jan 31 belongs to February's cycle.
        st = statement_for(date(2026, 1, 31), closing_day=30, due_day=15)
        assert st.period_start == date(2026, 1, 31)
        assert st.closing_date == date(2026, 2, 28)

    def test_due_day_clamped(self) -> None:
        st = statement_for(date(2026, 1, 10), closing_day=15, due_day=31)
        assert st.due_date == date(2026, 1, 31)
        st = statement_for(date(2026, 1, 20), closing_day=15, due_day=31)
        assert st.due_date == date(2026, 2, 28)

    def test_contains(self) -> None:
        st = statement_for(date(2026, 9, 15), closing_day=20, due_day=10)
        assert st.contains(date(2026, 8, 21))
        assert st.contains(date(2026, 9, 20))
        assert not st.contains(date(2026, 8, 20))
        assert not st.contains(date(2026, 9, 21))


class TestCycleFor:
    def test_cycle_key_is_closing_month(self) -> None:
        st = cycle_for(2026, 10, closing_day=20, due_day=10)
        assert st.closing_date == date(2026, 10, 20)
        assert st.period_start == date(2026, 9, 21)

    def test_next_and_previous(self) -> None:
        st = cycle_for(2026, 12, closing_day=20, due_day=10)
        assert st.next(closing_day=20, due_day=10).closing_date == date(2027, 1, 20)
        assert st.previous(closing_day=20, due_day=10).closing_date == date(2026, 11, 20)

    def test_every_day_of_year_belongs_to_exactly_one_cycle(self) -> None:
        for closing_day in (1, 15, 28, 29, 30, 31):
            cycles = [cycle_for(2026, m, closing_day, 10) for m in range(1, 13)]
            d = cycles[0].period_start
            while d <= cycles[-1].closing_date:
                assert sum(c.contains(d) for c in cycles) == 1, (closing_day, d)
                d = date.fromordinal(d.toordinal() + 1)
