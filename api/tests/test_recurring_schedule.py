from datetime import date

import pytest

from app.services.recurring import Frequency, next_occurrence, occurrences


class TestNextOccurrence:
    def test_monthly_same_month_when_day_not_passed(self) -> None:
        assert next_occurrence(date(2026, 9, 10), Frequency.MONTHLY, 15) == date(2026, 9, 15)

    def test_monthly_on_the_day_is_inclusive(self) -> None:
        assert next_occurrence(date(2026, 9, 15), Frequency.MONTHLY, 15) == date(2026, 9, 15)

    def test_monthly_rolls_to_next_month(self) -> None:
        assert next_occurrence(date(2026, 9, 16), Frequency.MONTHLY, 15) == date(2026, 10, 15)

    def test_monthly_rolls_over_year(self) -> None:
        assert next_occurrence(date(2026, 12, 20), Frequency.MONTHLY, 5) == date(2027, 1, 5)

    @pytest.mark.parametrize(
        ("start", "expected"),
        [
            (date(2026, 2, 1), date(2026, 2, 28)),
            (date(2026, 3, 1), date(2026, 3, 31)),
            (date(2026, 4, 1), date(2026, 4, 30)),
        ],
    )
    def test_monthly_day_31_clamps(self, start: date, expected: date) -> None:
        assert next_occurrence(start, Frequency.MONTHLY, 31) == expected

    def test_yearly(self) -> None:
        assert next_occurrence(date(2026, 9, 30), Frequency.YEARLY, 12, month=3) == date(
            2027, 3, 12
        )
        assert next_occurrence(date(2026, 1, 1), Frequency.YEARLY, 12, month=3) == date(2026, 3, 12)

    def test_yearly_feb_29_clamps_on_non_leap(self) -> None:
        assert next_occurrence(date(2026, 1, 1), Frequency.YEARLY, 29, month=2) == date(2026, 2, 28)
        assert next_occurrence(date(2028, 1, 1), Frequency.YEARLY, 29, month=2) == date(2028, 2, 29)

    def test_yearly_requires_month(self) -> None:
        with pytest.raises(ValueError):
            next_occurrence(date(2026, 1, 1), Frequency.YEARLY, 1)


class TestOccurrences:
    def test_range_inclusive(self) -> None:
        got = occurrences(date(2026, 7, 15), date(2026, 9, 15), Frequency.MONTHLY, 15)
        assert got == [date(2026, 7, 15), date(2026, 8, 15), date(2026, 9, 15)]

    def test_empty_when_none_in_range(self) -> None:
        assert occurrences(date(2026, 9, 16), date(2026, 10, 14), Frequency.MONTHLY, 15) == []

    def test_day_31_sequence_does_not_drift(self) -> None:
        got = occurrences(date(2026, 1, 1), date(2026, 4, 30), Frequency.MONTHLY, 31)
        assert got == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]


class TestSemimonthly:
    def test_quincena_15_and_month_end(self) -> None:
        got = occurrences(
            date(2026, 1, 1), date(2026, 3, 31), Frequency.SEMIMONTHLY, 15, second_day=31
        )
        assert got == [
            date(2026, 1, 15),
            date(2026, 1, 31),
            date(2026, 2, 15),
            date(2026, 2, 28),
            date(2026, 3, 15),
            date(2026, 3, 31),
        ]

    def test_next_between_the_two_days(self) -> None:
        assert next_occurrence(date(2026, 9, 16), Frequency.SEMIMONTHLY, 15, second_day=30) == date(
            2026, 9, 30
        )
        assert next_occurrence(date(2026, 10, 1), Frequency.SEMIMONTHLY, 15, second_day=30) == date(
            2026, 10, 15
        )

    def test_order_of_days_does_not_matter(self) -> None:
        assert next_occurrence(date(2026, 9, 2), Frequency.SEMIMONTHLY, 20, second_day=5) == date(
            2026, 9, 5
        )

    def test_requires_distinct_second_day(self) -> None:
        with pytest.raises(ValueError):
            next_occurrence(date(2026, 9, 1), Frequency.SEMIMONTHLY, 15)
        with pytest.raises(ValueError):
            next_occurrence(date(2026, 9, 1), Frequency.SEMIMONTHLY, 15, second_day=15)

    def test_clamped_days_colliding_in_short_months_yield_one_date(self) -> None:
        # 30 and 31 both clamp to Feb 28: one payment, not two.
        got = occurrences(
            date(2026, 2, 1), date(2026, 2, 28), Frequency.SEMIMONTHLY, 30, second_day=31
        )
        assert got == [date(2026, 2, 28)]
