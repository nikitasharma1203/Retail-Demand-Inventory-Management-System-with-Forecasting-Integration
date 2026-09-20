"""
RetailIQ unit tests
Tests EOQ, ROP, holiday uplift, and data quality logic
from notebooks/final.ipynb
"""
import pytest
import pandas as pd
import numpy as np


# ── Functions mirroring notebooks/final.ipynb ─────────────────────────────

def compute_eoq(annual_demand, order_cost, holding_cost):
    """EOQ = sqrt(2DS/H)"""
    if holding_cost <= 0:
        raise ValueError("Holding cost must be > 0")
    return float(np.sqrt((2 * annual_demand * order_cost) / holding_cost))


def compute_rop(avg_daily_demand, lead_time_days, safety_stock):
    """ROP = demand during lead time + safety stock"""
    return float(avg_daily_demand * lead_time_days + safety_stock)


def holiday_uplift(df):
    return df.groupby("is_holiday")["weekly_sales"].mean()


def no_negative_sales(df):
    return bool((df["weekly_sales"] >= 0).all())


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def sales_df():
    return pd.DataFrame({
        "weekly_sales": [24924.5, 46039.5, 41595.5, 19403.5, 21827.5],
        "is_holiday":   [False, True, False, False, True],
    })


# ── EOQ ───────────────────────────────────────────────────────────────────

class TestEOQ:
    def test_retailiq_example(self):
        # Your notebook: D=1M, S=100, H=0.826 → ~49,251
        result = compute_eoq(1_000_000, 100, 0.826)
        assert 48_000 < result < 51_000

    def test_known_value(self):
        assert abs(compute_eoq(1000, 50, 2) - 223.6) < 0.5

    def test_positive_output(self):
        assert compute_eoq(1000, 50, 2) > 0

    def test_zero_holding_cost_raises(self):
        with pytest.raises(ValueError):
            compute_eoq(1000, 50, 0)

    def test_larger_demand_bigger_eoq(self):
        assert compute_eoq(5000, 50, 2) > compute_eoq(1000, 50, 2)


# ── ROP ───────────────────────────────────────────────────────────────────

class TestROP:
    def test_retailiq_example(self):
        result = compute_rop(avg_daily_demand=92000, lead_time_days=35, safety_stock=50_000)
        assert result > 3_000_000

    def test_basic(self):
        assert compute_rop(100, 5, 200) == 700.0

    def test_zero_safety_stock(self):
        assert compute_rop(50, 10, 0) == 500.0


# ── Holiday uplift ────────────────────────────────────────────────────────

class TestHolidayUplift:
    def test_holiday_higher(self, sales_df):
        up = holiday_uplift(sales_df)
        assert up[True] > up[False]

    def test_uplift_over_10pct(self, sales_df):
        up = holiday_uplift(sales_df)
        pct = (up[True] - up[False]) / up[False] * 100
        assert pct > 10


# ── Data quality ──────────────────────────────────────────────────────────

class TestDataQuality:
    def test_no_negatives_passes(self, sales_df):
        assert no_negative_sales(sales_df) is True

    def test_negatives_fails(self):
        df = pd.DataFrame({
            "weekly_sales": [100.0, -50.0, 200.0],
            "is_holiday":   [False, False, True],
        })
        assert no_negative_sales(df) is False

    def test_no_nulls(self, sales_df):
        assert sales_df["weekly_sales"].isna().sum() == 0
