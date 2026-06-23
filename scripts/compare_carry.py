"""
Compare old table-based carry vs new physics simulator for a range of representative shots.
Run from repo root: uv run python scripts/compare_carry.py
"""
import math
from datetime import datetime
from openflight.ballistics import resolve_launch, simulate
from openflight.launch_monitor import ClubType, Shot
from openflight.rolling_buffer.monitor import estimate_carry_with_spin

SHOTS = [
    # (label, ball_speed_mph, launch_angle_v, spin_rpm, club)
    ("Driver (avg)",       160, 11.0,  2700, ClubType.DRIVER),
    ("Driver (high spin)", 160, 11.0,  3400, ClubType.DRIVER),
    ("Driver (low spin)",  160, 11.0,  1900, ClubType.DRIVER),
    ("3-wood",             150, 10.5,  3500, ClubType.WOOD_3),
    ("5-iron",             130, 15.0,  5400, ClubType.IRON_5),
    ("7-iron",             120, 17.0,  6500, ClubType.IRON_7),
    ("7-iron (high ball)", 120, 22.0,  7500, ClubType.IRON_7),
    ("9-iron",             105, 20.0,  8500, ClubType.IRON_9),
    ("PW",                  90, 24.0,  9000, ClubType.PW),
    ("SW (half)",           60, 30.0, 10000, ClubType.SW),
]


def empirical_apex(carry: float, launch_angle_v: float) -> float:
    """Replicates Shot.apex_height_yards fallback formula (no simulator)."""
    apex_frac = 0.10 * max(0.5, (launch_angle_v / 12.0) ** 0.7)
    return round(carry * apex_frac, 1)


print(f"{'Shot':<22} {'Carry':>18}  {'':>8}  {'Apex':>18}  {'Apex':>8}")
print(f"{'':.<22} {'Table':>8} {'Sim':>8}  {'Diff':>8}  {'Empirical':>9} {'Sim':>8}  {'Diff':>8}")
print("-" * 82)

for label, ball_speed, la_v, spin, club in SHOTS:
    shot = Shot(
        ball_speed_mph=ball_speed,
        timestamp=datetime.now(),
        club=club,
        launch_angle_vertical=la_v,
        spin_rpm=spin,
        spin_confidence=0.9,
    )

    table_carry = estimate_carry_with_spin(ball_speed, spin, club)
    apex_empirical = empirical_apex(table_carry, la_v)

    conditions = resolve_launch(shot)
    if conditions is None:
        print(f"{label:<22} {'N/A':>8}")
        continue

    traj = simulate(conditions)
    carry_diff = traj.carry_yards - table_carry
    apex_diff = traj.apex_yards - apex_empirical

    print(
        f"{label:<22} {table_carry:>7.1f}y {traj.carry_yards:>7.1f}y  {carry_diff:>+7.1f}y"
        f"  {apex_empirical:>8.1f}y {traj.apex_yards:>7.1f}y  {apex_diff:>+7.1f}y"
    )
