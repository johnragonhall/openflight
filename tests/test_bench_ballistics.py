"""CodSpeed performance benchmarks for the ballistics flight simulator.

These benchmarks exercise the CPU-bound hot path of OpenFlight: the RK4
trajectory integrator in `simulate` and the launch-condition resolution in
`resolve_launch`. They use realistic launch parameters spanning a driver, a
mid-iron, and a wedge so that regressions across the full speed/spin range are
caught.
"""

from datetime import datetime

from openflight.ballistics import LaunchConditions, resolve_launch, simulate
from openflight.launch_monitor import ClubType, Shot


def _driver_conditions() -> LaunchConditions:
    return LaunchConditions(
        ball_speed_mph=165.0,
        launch_angle_v=11.0,
        launch_angle_h=0.0,
        spin_rpm=2700,
        spin_axis_deg=0.0,
        spin_source="measured",
    )


def _iron_conditions() -> LaunchConditions:
    return LaunchConditions(
        ball_speed_mph=120.0,
        launch_angle_v=17.0,
        launch_angle_h=2.0,
        spin_rpm=6500,
        spin_axis_deg=-8.0,
        spin_source="measured",
    )


def _wedge_conditions() -> LaunchConditions:
    return LaunchConditions(
        ball_speed_mph=85.0,
        launch_angle_v=28.0,
        launch_angle_h=0.0,
        spin_rpm=9500,
        spin_axis_deg=5.0,
        spin_source="measured",
    )


def test_simulate_driver(benchmark):
    cond = _driver_conditions()
    traj = benchmark(simulate, cond)
    assert traj.carry_yards > 0


def test_simulate_iron(benchmark):
    cond = _iron_conditions()
    traj = benchmark(simulate, cond)
    assert traj.carry_yards > 0


def test_simulate_wedge(benchmark):
    cond = _wedge_conditions()
    traj = benchmark(simulate, cond)
    assert traj.carry_yards > 0


def test_resolve_launch_measured(benchmark):
    shot = Shot(
        ball_speed_mph=160.0,
        timestamp=datetime.now(),
        club=ClubType.DRIVER,
        launch_angle_vertical=12.0,
        spin_rpm=2500,
        spin_confidence=0.85,
    )
    cond = benchmark(resolve_launch, shot)
    assert cond is not None
