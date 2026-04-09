"""OpenFlight - DIY Golf Launch Monitor using OPS243-A Radar."""

__version__ = "0.2.0"

from .ops243 import OPS243Radar, SpeedUnit, Direction, SpeedReading
from .launch_monitor import Shot, ClubType, estimate_carry_distance

__all__ = [
    "OPS243Radar",
    "Shot",
    "ClubType",
    "SpeedUnit",
    "Direction",
    "SpeedReading",
    "estimate_carry_distance",
]
