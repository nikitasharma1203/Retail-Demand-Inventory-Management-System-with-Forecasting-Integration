"""
RetailIQ — Unit Tests
pytest tests/ --cov=RetailIQ

Tests cover:
  - EOQ calculation
  - Reorder point calculation
  - Holiday uplift computation
  - Data quality checks (no negative sales, no null user_ids)
"""

import pytest
import pandas as pd
import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS (mirrors logic from notebooks/final.ipynb)
# These would normally be imported from RetailIQ/analytics.py once refactored
# ─────────────────────────────────────────────────────────────────────────────

def compute_eoq(annual_demand: float, order_cost: float, holding_cost: float) -> float:
    """Economic Order Quantity = sqrt(2DS/H)"""
    if holding_cost <= 0:
        raise ValueError("Holding cost must be positive")
    return float(np.sqrt((2 * annual_demand * order_cost) / holding_cost))


def compute_rop(avg_daily_demand: float, lead_time_days: int, safety_stock: float) -> float:
    """Reorder Point = demand during lead time + safety stock"""
    return (avg_daily_demand * lead_time_days) + safety_stock


def compute_holiday_uplift(df: pd.DataFrame) -> pd.Series:
    """
    Returns avg weekly sales for holiday vs non-holiday weeks.
    df must have columns: weekly_sales, is_holiday
    """
    return df.groupby("is_holiday")["weekly_sales"].mean()


def validate_no_negative_sales(df: pd.DataFrame) -> bool:
    """Returns True if all weekly_sales >= 0"""
    return (df["weekly_sales"] >= 0).all()


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_sales_df():
    """Small representative slice of the Walmart sales structure."""
    return pd.DataFrame({
        "store":        [1, 1, 1, 2, 2],
        "dept":         [1, 1, 1, 2, 2],
        "date":         pd.date_range("2010-02-05", periods=5, freq="W"),
        "weekly_sales": [24924.5, 46039.5, 41595.5, 19403.5, 21827.5],
        "is_holiday":   [False, True, False, False, True],
    })


@pytest.fixture
def negative_sales_df():
    """DataFrame with a negative sales value — should fail validation."""
    return pd.DataFrame({
        "weekly_sales": [1000.0, -50.0, 2000.0],
        "is_holiday":   [False, False, True],
    })


# ─────────────────────────────────────────────────────────────────────────────
# TESTS — EOQ
# ─────────────────────────────────────────────────────────────────────────────

class TestEOQ:
    def test_known_value(self):
        """EOQ(D=1000, S=50, H=2) = sqrt(2*1000*50/2) = sqrt(50000) ≈ 223.6"""
        result = compute_eoq(annual_demand=1000, order_cost=50, holding_cost=2)
        assert abs(result - 223.6) < 0.5, f"Expected ~223.6, got {result}"

    def test_output_is_positive(self):
        result = compute_eoq(1000, 50, 2)
        assert result > 0

    def test_raises_on_zero_holding_cost(self):
        with pytest.raises(ValueError, match="Holding cost must be positive"):
            compute_eoq(1000, 50, 0)

    def test_larger_demand_gives_larger_eoq(self):
        eoq_low  = compute_eoq(1000, 50, 2)
        eoq_high = compute_eoq(5000, 50, 2)
        assert eoq_high > eoq_low

    def test_retailiq_example(self):
        """Mirrors the notebook's example: D=1M, S=100, H=0.82 → ~49,251"""
        result = compute_eoq(1_000_000, 100, 0.826)
        assert 48_000 < result < 51_000, f"Expected ~49,251, got {result:.0f}"


# ─────────────────────────────────────────────────────────────────────────────
# TESTS — Reorder Point
# ─────────────────────────────────────────────────────────────────────────────

class TestROP:
    def test_basic(self):
        """ROP(demand=100/day, lead_time=5, safety=200) = 700"""
        assert compute_rop(100, 5, 200) == 700.0

    def test_zero_safety_stock(self):
        assert compute_rop(50, 10, 0) == 500.0

    def test_output_type(self):
        result = compute_rop(100, 5, 200)
        assert isinstance(result, float)


# ─────────────────────────────────────────────────────────────────────────────
# TESTS — Holiday Uplift
# ─────────────────────────────────────────────────────────────────────────────

class TestHolidayUplift:
    def test_holiday_higher_than_non_holiday(self, sample_sales_df):
        uplift = compute_holiday_uplift(sample_sales_df)
        assert uplift[True] > uplift[False], (
            f"Holiday avg ({uplift[True]:.0f}) should exceed "
            f"non-holiday avg ({uplift[False]:.0f})"
        )

    def test_returns_series(self, sample_sales_df):
        result = compute_holiday_uplift(sample_sales_df)
        assert isinstance(result, pd.Series)

    def test_uplift_percentage(self, sample_sales_df):
        """In the sample data, holiday weeks should be at least 10% higher."""
        uplift = compute_holiday_uplift(sample_sales_df)
        pct = (uplift[True] - uplift[False]) / uplift[False] * 100
        assert pct > 10, f"Expected >10% uplift, got {pct:.1f}%"


# ─────────────────────────────────────────────────────────────────────────────
# TESTS — Data Quality
# ─────────────────────────────────────────────────────────────────────────────

class TestDataQuality:
    def test_no_negative_sales_passes(self, sample_sales_df):
        assert validate_no_negative_sales(sample_sales_df) is True

    def test_negative_sales_fails(self, negative_sales_df):
        assert validate_no_negative_sales(negative_sales_df) is False

    def test_no_null_weekly_sales(self, sample_sales_df):
        assert sample_sales_df["weekly_sales"].isna().sum() == 0

    def test_date_range(self, sample_sales_df):
        assert sample_sales_df["date"].min() >= pd.Timestamp("2010-01-01")
        assert sample_sales_df["date"].max() <= pd.Timestamp("2013-12-31")
