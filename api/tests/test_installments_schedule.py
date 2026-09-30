from datetime import date
from decimal import Decimal

import pytest

from app.services.installments import Installment, schedule, split_amount


class TestSplitAmount:
    def test_even_split(self) -> None:
        assert split_amount(Decimal("12000"), 12) == [Decimal("1000.00")] * 12

    def test_remainder_goes_to_last(self) -> None:
        parts = split_amount(Decimal("1000"), 3)
        assert parts == [Decimal("333.33"), Decimal("333.33"), Decimal("333.34")]

    @pytest.mark.parametrize(
        ("total", "n"),
        [("0.05", 3), ("9999.99", 7), ("12345.67", 24), ("100", 18), ("1", 2)],
    )
    def test_parts_always_sum_to_total(self, total: str, n: int) -> None:
        parts = split_amount(Decimal(total), n)
        assert len(parts) == n
        assert sum(parts) == Decimal(total)
        assert all(p >= 0 for p in parts)

    def test_rejects_bad_input(self) -> None:
        with pytest.raises(ValueError):
            split_amount(Decimal("100"), 0)


class TestSchedule:
    def test_one_charge_per_consecutive_cycle(self) -> None:
        charges = schedule(Decimal("6000"), 6, date(2026, 9, 15), closing_day=20, due_day=10)
        assert [c.statement.cycle for c in charges] == [
            "2026-09",
            "2026-10",
            "2026-11",
            "2026-12",
            "2027-01",
            "2027-02",
        ]
        assert [c.number for c in charges] == [1, 2, 3, 4, 5, 6]
        assert all(c.amount == Decimal("1000.00") for c in charges)

    def test_first_charge_dated_on_purchase_rest_on_closing(self) -> None:
        charges = schedule(Decimal("300"), 3, date(2026, 9, 25), closing_day=20, due_day=10)
        assert charges[0] == Installment(
            number=1,
            date=date(2026, 9, 25),
            amount=Decimal("100.00"),
            statement=charges[0].statement,
        )
        assert charges[0].statement.cycle == "2026-10"  # bought after closing
        assert [c.date for c in charges[1:]] == [date(2026, 11, 20), date(2026, 12, 20)]

    def test_every_charge_falls_in_its_own_statement(self) -> None:
        for closing_day in (1, 15, 28, 30, 31):
            charges = schedule(
                Decimal("1000"), 24, date(2026, 1, 31), closing_day=closing_day, due_day=10
            )
            cycles = [c.statement.cycle for c in charges]
            assert len(set(cycles)) == 24, closing_day
            assert all(c.statement.contains(c.date) for c in charges), closing_day
