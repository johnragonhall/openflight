"""Standalone helpers for K-LD7 raw ADC (RADC) signal processing."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

RADC_PAYLOAD_BYTES = 3072
SAMPLES_PER_CHANNEL = 256
ADC_MIDPOINT = 32768  # uint16 midpoint for DC offset removal


def parse_radc_payload(payload: bytes) -> dict[str, np.ndarray]:
    """Parse a 3072-byte RADC payload into six uint16 channel arrays.

    Layout (each segment = 256 × uint16 = 512 bytes):
        [0:512]     F1 Freq A — I channel
        [512:1024]  F1 Freq A — Q channel
        [1024:1536] F2 Freq A — I channel
        [1536:2048] F2 Freq A — Q channel
        [2048:2560] F1 Freq B — I channel
        [2560:3072] F1 Freq B — Q channel
    """
    if len(payload) != RADC_PAYLOAD_BYTES:
        raise ValueError(
            f"RADC payload must be {RADC_PAYLOAD_BYTES} bytes, got {len(payload)}"
        )
    seg = 512  # bytes per segment
    return {
        "f1a_i": np.frombuffer(payload[0:seg], dtype=np.uint16).copy(),
        "f1a_q": np.frombuffer(payload[seg : 2 * seg], dtype=np.uint16).copy(),
        "f2a_i": np.frombuffer(payload[2 * seg : 3 * seg], dtype=np.uint16).copy(),
        "f2a_q": np.frombuffer(payload[3 * seg : 4 * seg], dtype=np.uint16).copy(),
        "f1b_i": np.frombuffer(payload[4 * seg : 5 * seg], dtype=np.uint16).copy(),
        "f1b_q": np.frombuffer(payload[5 * seg : 6 * seg], dtype=np.uint16).copy(),
    }


def to_complex_iq(i_channel: np.ndarray, q_channel: np.ndarray) -> np.ndarray:
    """Convert uint16 I/Q arrays to complex float, removing DC offset.

    Uses per-channel mean removal instead of a fixed midpoint, since the
    K-LD7 ADC bias varies across channels and units.
    """
    i_float = i_channel.astype(np.float64) - np.mean(i_channel.astype(np.float64))
    q_float = q_channel.astype(np.float64) - np.mean(q_channel.astype(np.float64))
    return i_float + 1j * q_float


DC_MASK_BINS = 8  # Zero out bins near DC to suppress residual leakage


def compute_spectrum(iq: np.ndarray, fft_size: int = 2048, dc_mask_bins: int = DC_MASK_BINS) -> np.ndarray:
    """Compute magnitude spectrum from complex I/Q with Hann window and zero-padding.

    Args:
        iq: Complex I/Q array (256 samples from RADC)
        fft_size: FFT length (zero-padded if > len(iq))
        dc_mask_bins: Number of bins around DC to zero out (both ends)

    Returns:
        Magnitude spectrum (linear scale), length = fft_size
    """
    windowed = iq * np.hanning(len(iq))
    padded = np.zeros(fft_size, dtype=np.complex128)
    padded[: len(windowed)] = windowed
    fft_result = np.fft.fft(padded)
    magnitude = np.abs(fft_result)
    # Mask DC leakage at both ends of the spectrum
    if dc_mask_bins > 0:
        magnitude[:dc_mask_bins] = 0.0
        magnitude[-dc_mask_bins:] = 0.0
    return magnitude


@dataclass(frozen=True)
class CFARDetection:
    bin_index: int
    magnitude: float
    snr_db: float


def cfar_detect(
    spectrum: np.ndarray,
    guard_cells: int = 4,
    training_cells: int = 16,
    threshold_factor: float = 8.0,
) -> list[CFARDetection]:
    """Ordered-statistic CFAR detection on a magnitude spectrum.

    For each bin, estimates the noise level from surrounding training cells
    (excluding guard cells) and declares a detection if the bin exceeds
    threshold_factor × noise_estimate.

    Args:
        spectrum: Magnitude spectrum (1D array)
        guard_cells: Number of guard cells on each side of the cell under test
        training_cells: Number of training cells on each side (outside guard)
        threshold_factor: Detection threshold as multiple of noise estimate

    Returns:
        List of detections sorted by magnitude (descending)
    """
    n = len(spectrum)
    margin = guard_cells + training_cells
    detections = []

    for i in range(margin, n - margin):
        left_train = spectrum[i - margin : i - guard_cells]
        right_train = spectrum[i + guard_cells + 1 : i + margin + 1]
        training = np.concatenate([left_train, right_train])
        # Use median (OS-CFAR) for robustness against interfering targets
        noise_estimate = np.median(training)

        if noise_estimate <= 0:
            continue

        if spectrum[i] > threshold_factor * noise_estimate:
            snr_db = 10.0 * np.log10(spectrum[i] / noise_estimate)
            detections.append(
                CFARDetection(
                    bin_index=i,
                    magnitude=float(spectrum[i]),
                    snr_db=float(snr_db),
                )
            )

    detections.sort(key=lambda d: d.magnitude, reverse=True)
    return detections


@dataclass(frozen=True)
class RADCDetection:
    frame_index: int
    timestamp: float
    distance_m: float
    velocity_kmh: float
    angle_deg: float
    magnitude: float
    snr_db: float
    bin_index: int


def bin_to_velocity_kmh(bin_index: int, fft_size: int, max_speed_kmh: float) -> float:
    """Convert FFT bin index to velocity in km/h.

    Bins 0..N/2 = 0..+max_speed (outbound).
    Bins N/2..N = -max_speed..0 (inbound, aliased).
    """
    if bin_index <= fft_size // 2:
        return bin_index * max_speed_kmh / (fft_size // 2)
    else:
        return (bin_index - fft_size) * max_speed_kmh / (fft_size // 2)


def estimate_angle_from_phase(
    f1_complex: np.ndarray,
    f2_complex: np.ndarray,
) -> float:
    """Estimate angle from phase difference between two frequency channels.

    Uses cross-correlation phase to estimate the angle of arrival.
    The exact angle-to-phase mapping depends on K-LD7 antenna geometry
    (spacing, wavelength). This returns a proportional estimate that
    needs empirical calibration against known angles.

    Returns:
        Angle estimate in degrees (uncalibrated — proportional to phase diff)
    """
    # Cross-spectral phase
    cross = np.sum(f1_complex * np.conj(f2_complex))
    phase_rad = np.angle(cross)
    # Convert to degrees — scale factor TBD from calibration
    # For K-LD7 at 24 GHz with ~6mm antenna spacing, rough estimate:
    # angle ≈ arcsin(phase / pi) * (180/pi)
    # For now return raw phase in degrees as a proportional estimate
    return float(np.degrees(phase_rad))


# --- Beamforming and spatial filtering ---

# K-LD7 antenna parameters (24 GHz)
WAVELENGTH_M = 3e8 / 24.125e9  # ~12.43 mm
ANTENNA_SPACING_M = 8.0e-3  # ~0.64λ, calibrated against PDAT reference data

# Aliased velocity ranges at RSPI=3 (100 km/h max, 200 km/h unambiguous).
# Golf ball speeds wrap into the negative velocity range:
#   Ball 100-120 mph (161-193 km/h) → aliases to -39 to -7 km/h
#   Club  70-85  mph (113-137 km/h) → aliases to -87 to -63 km/h
BALL_VELOCITY_ALIASED_MIN_KMH = -39.0
BALL_VELOCITY_ALIASED_MAX_KMH = -7.0
CLUB_VELOCITY_ALIASED_MIN_KMH = -87.0
CLUB_VELOCITY_ALIASED_MAX_KMH = -63.0

# At 2048-point FFT with 100 km/h max:
#   bin = (velocity / max_speed) * (fft_size / 2) for positive velocity
#   bin = fft_size + (velocity / max_speed) * (fft_size / 2) for negative velocity
def _velocity_to_bin(velocity_kmh: float, fft_size: int = 2048, max_speed_kmh: float = 100.0) -> int:
    """Convert velocity in km/h to FFT bin index."""
    if velocity_kmh >= 0:
        return int(velocity_kmh * (fft_size // 2) / max_speed_kmh)
    return int(fft_size + velocity_kmh * (fft_size // 2) / max_speed_kmh)


def ball_bin_range(fft_size: int = 2048, max_speed_kmh: float = 100.0) -> tuple[int, int]:
    """Return (lo, hi) FFT bin range for aliased ball velocities (broad default)."""
    return (
        _velocity_to_bin(BALL_VELOCITY_ALIASED_MIN_KMH, fft_size, max_speed_kmh),
        _velocity_to_bin(BALL_VELOCITY_ALIASED_MAX_KMH, fft_size, max_speed_kmh),
    )


def ball_bin_range_from_speed(
    ball_speed_mph: float,
    tolerance_mph: float = 10.0,
    fft_size: int = 2048,
    max_speed_kmh: float = 100.0,
) -> tuple[int, int]:
    """Return (lo, hi) FFT bin range for a specific ball speed.

    Uses the OPS243-measured ball speed to compute exactly where in the
    aliased spectrum the ball return should appear. Much more precise
    than the broad default range — eliminates club/multipath contamination.

    Args:
        ball_speed_mph: Measured ball speed from OPS243
        tolerance_mph: Search window around the expected velocity (±)
    """
    ball_speed_kmh = ball_speed_mph * 1.609
    unambiguous_range = max_speed_kmh * 2.0
    aliased_kmh = ball_speed_kmh % unambiguous_range
    if aliased_kmh > max_speed_kmh:
        aliased_kmh -= unambiguous_range  # wrap to negative

    lo_vel = aliased_kmh - tolerance_mph * 1.609
    hi_vel = aliased_kmh + tolerance_mph * 1.609

    lo_bin = _velocity_to_bin(lo_vel, fft_size, max_speed_kmh)
    hi_bin = _velocity_to_bin(hi_vel, fft_size, max_speed_kmh)

    # Ensure lo < hi
    if lo_bin > hi_bin:
        lo_bin, hi_bin = hi_bin, lo_bin

    return (lo_bin, hi_bin)


def club_bin_range(fft_size: int = 2048, max_speed_kmh: float = 100.0) -> tuple[int, int]:
    """Return (lo, hi) FFT bin range for aliased club velocities."""
    return (
        _velocity_to_bin(CLUB_VELOCITY_ALIASED_MIN_KMH, fft_size, max_speed_kmh),
        _velocity_to_bin(CLUB_VELOCITY_ALIASED_MAX_KMH, fft_size, max_speed_kmh),
    )


def compute_fft_complex(iq: np.ndarray, fft_size: int = 2048, dc_mask_bins: int = DC_MASK_BINS) -> np.ndarray:
    """Compute complex FFT output (not magnitude) for phase-based processing."""
    windowed = iq * np.hanning(len(iq))
    padded = np.zeros(fft_size, dtype=np.complex128)
    padded[: len(windowed)] = windowed
    result = np.fft.fft(padded)
    if dc_mask_bins > 0:
        result[:dc_mask_bins] = 0.0
        result[-dc_mask_bins:] = 0.0
    return result


def per_bin_angle_deg(
    f1a_fft: np.ndarray,
    f2a_fft: np.ndarray,
    antenna_spacing_m: float = ANTENNA_SPACING_M,
    wavelength_m: float = WAVELENGTH_M,
) -> np.ndarray:
    """Compute angle of arrival at each FFT bin from phase difference between Rx channels.

    Uses the interferometric formula: θ = arcsin(Δφ * λ / (2π * d))
    where Δφ is the phase difference, λ is wavelength, d is antenna spacing.

    Returns array of angles in degrees, one per bin. Bins with no signal return 0.
    """
    cross = f1a_fft * np.conj(f2a_fft)
    phase_diff = np.angle(cross)
    # arcsin argument must be in [-1, 1]
    sin_theta = phase_diff * wavelength_m / (2.0 * np.pi * antenna_spacing_m)
    sin_theta = np.clip(sin_theta, -1.0, 1.0)
    return np.degrees(np.arcsin(sin_theta))


def compute_angle_velocity_map(
    f1a_iq: np.ndarray,
    f2a_iq: np.ndarray,
    fft_size: int = 2048,
    steer_angles_deg: np.ndarray | None = None,
    antenna_spacing_m: float = ANTENNA_SPACING_M,
    wavelength_m: float = WAVELENGTH_M,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute angle-velocity power map via conventional beamforming.

    Steers a 2-element array across angles and computes beamformed power
    at each (angle, velocity_bin) pair.

    Returns:
        (power_map, steer_angles, velocity_bins)
        power_map shape: (n_angles, fft_size)
    """
    if steer_angles_deg is None:
        steer_angles_deg = np.arange(-90, 91, 1.0)

    f1a_fft = compute_fft_complex(f1a_iq, fft_size=fft_size)
    f2a_fft = compute_fft_complex(f2a_iq, fft_size=fft_size)

    power_map = np.zeros((len(steer_angles_deg), fft_size))

    for i, angle_deg in enumerate(steer_angles_deg):
        angle_rad = np.radians(angle_deg)
        # Phase shift to steer beam to this angle
        steering_phase = 2.0 * np.pi * antenna_spacing_m * np.sin(angle_rad) / wavelength_m
        # Apply steering vector to second channel and sum
        steered = f1a_fft + f2a_fft * np.exp(-1j * steering_phase)
        power_map[i, :] = np.abs(steered) ** 2

    return power_map, steer_angles_deg, np.arange(fft_size)


@dataclass(frozen=True)
class SpatialDetection:
    """Detection with per-bin angle from interferometry."""
    frame_index: int
    timestamp: float
    velocity_kmh: float
    angle_deg: float  # per-bin angle from phase difference
    magnitude: float
    snr_db: float
    bin_index: int


def find_impact_frames(
    frames: list[dict],
    fft_size: int = 2048,
    min_velocity_bin: int = 150,
    energy_threshold: float = 3.0,
    ball_bin_lo: int | None = None,
    ball_bin_hi: int | None = None,
) -> list[int]:
    """Find frames with sudden high-velocity energy (impact events).

    Looks for frames where the high-velocity portion of the spectrum
    has significantly more energy than the surrounding frames.

    Checks both positive-velocity bins (min_velocity_bin to N/2, for club)
    and the ball velocity band (ball_bin_lo:ball_bin_hi if provided,
    otherwise the full negative-velocity half N/2 to N). Golf ball speeds
    alias into the negative velocity range at RSPI=100 km/h, so checking
    only positive bins misses ball impacts.
    """
    energies = []
    for frame in frames:
        radc = frame.get("radc")
        if radc is None:
            energies.append(0.0)
            continue
        channels = parse_radc_payload(radc) if isinstance(radc, bytes) else radc
        iq = to_complex_iq(channels["f1a_i"], channels["f1a_q"])
        spec = compute_spectrum(iq, fft_size=fft_size)
        # Energy in positive high-velocity bins (club swing)
        pos_energy = float(np.sum(spec[min_velocity_bin: fft_size // 2] ** 2))
        # Energy in aliased negative-velocity bins (ball)
        if ball_bin_lo is not None and ball_bin_hi is not None:
            neg_energy = float(np.sum(spec[ball_bin_lo:ball_bin_hi] ** 2))
        else:
            neg_energy = float(np.sum(spec[fft_size // 2 + min_velocity_bin:] ** 2))
        energies.append(pos_energy + neg_energy)

    energies = np.array(energies)
    if np.median(energies) <= 0:
        return []

    # Frames where high-velocity energy exceeds median by threshold factor
    median_energy = np.median(energies[energies > 0])
    impact_indices = []
    for i, e in enumerate(energies):
        if e > energy_threshold * median_energy:
            impact_indices.append(i)
    return impact_indices


def process_radc_frame_spatial(
    frame: dict,
    frame_index: int,
    fft_size: int = 2048,
    max_speed_kmh: float = 100.0,
    cfar_threshold: float = 4.0,
    cfar_guard: int = 4,
    cfar_training: int = 16,
    bin_range: tuple[int, int] | None = None,
) -> list[SpatialDetection]:
    """Process one RADC frame with per-bin angle estimation.

    Args:
        bin_range: Optional (lo, hi) to restrict CFAR to a specific FFT bin
                   range (e.g. ball or club velocity band). If None, runs on
                   the full spectrum.
    """
    radc_raw = frame.get("radc")
    if radc_raw is None:
        return []

    channels = parse_radc_payload(radc_raw) if isinstance(radc_raw, bytes) else radc_raw

    f1a_iq = to_complex_iq(channels["f1a_i"], channels["f1a_q"])
    f2a_iq = to_complex_iq(channels["f2a_i"], channels["f2a_q"])

    spectrum = compute_spectrum(f1a_iq, fft_size=fft_size)

    # Band-limited CFAR: zero out everything outside the target bin range
    if bin_range is not None:
        masked = np.zeros_like(spectrum)
        lo, hi = bin_range
        masked[lo:hi] = spectrum[lo:hi]
        spectrum = masked

    cfar_hits = cfar_detect(
        spectrum,
        guard_cells=cfar_guard,
        training_cells=cfar_training,
        threshold_factor=cfar_threshold,
    )

    # Complex FFTs for per-bin angle
    f1a_fft = compute_fft_complex(f1a_iq, fft_size=fft_size)
    f2a_fft = compute_fft_complex(f2a_iq, fft_size=fft_size)
    angles = per_bin_angle_deg(f1a_fft, f2a_fft)

    timestamp = float(frame["timestamp"])
    detections = []
    for hit in cfar_hits:
        velocity = bin_to_velocity_kmh(hit.bin_index, fft_size, max_speed_kmh)
        detections.append(
            SpatialDetection(
                frame_index=frame_index,
                timestamp=timestamp,
                velocity_kmh=velocity,
                angle_deg=float(angles[hit.bin_index]),
                magnitude=hit.magnitude,
                snr_db=hit.snr_db,
                bin_index=hit.bin_index,
            )
        )
    return detections


def extract_launch_angle(
    frames: list[dict],
    fft_size: int = 2048,
    max_speed_kmh: float = 100.0,
    cfar_threshold: float = 2.5,
    impact_energy_threshold: float = 3.0,
    angle_offset_deg: float = 0.0,
    ops243_ball_speed_mph: float | None = None,
    speed_tolerance_mph: float = 10.0,
) -> list[dict]:
    """Extract vertical launch angle per shot from RADC frames.

    Pipeline:
    1. Find impact frames (high-velocity energy spikes)
    2. Group consecutive impacts into shot events
    3. For each shot, run band-limited CFAR in the ball velocity range
    4. Per-bin interferometric angle estimation on ball detections
    5. SNR²-weighted average angle (heavily favors strongest returns)
    6. Apply angle offset

    Args:
        ops243_ball_speed_mph: If provided (live path), narrows the velocity
            search to a tight band around this speed. This eliminates
            club/multipath contamination and works for any club/player.
            If None (offline analysis), uses the broad default ball range.
        speed_tolerance_mph: Search window ± around ops243_ball_speed_mph.

    Returns a list of shot dicts, one per detected shot. Each contains
    launch_angle_deg, ball_speed_mph, confidence, and supporting data.
    Returns empty list if no shots found.
    """
    # Velocity band: narrow (OPS243-anchored) or broad (offline default)
    if ops243_ball_speed_mph is not None:
        b_lo, b_hi = ball_bin_range_from_speed(
            ops243_ball_speed_mph, speed_tolerance_mph, fft_size, max_speed_kmh,
        )
    else:
        b_lo, b_hi = ball_bin_range(fft_size, max_speed_kmh)

    min_velocity_bin = 150  # skip low-velocity body/clutter
    impact_indices = find_impact_frames(
        frames, fft_size=fft_size,
        min_velocity_bin=min_velocity_bin,
        energy_threshold=impact_energy_threshold,
        ball_bin_lo=b_lo,
        ball_bin_hi=b_hi,
    )
    if not impact_indices:
        return []

    # Group consecutive impact frames into shot events
    shot_groups: list[list[int]] = []
    for idx in impact_indices:
        if not shot_groups or idx - shot_groups[-1][-1] > 5:
            shot_groups.append([idx])
        else:
            shot_groups[-1].append(idx)

    results = []
    for shot_idx, impact_group in enumerate(shot_groups):
        # Expand to impact -1 before, +2 after (ball appears slightly after)
        frame_set = set()
        for idx in impact_group:
            for offset in range(-1, 3):
                fi = idx + offset
                if 0 <= fi < len(frames):
                    frame_set.add(fi)

        # Peak-bin extraction: for each frame, find the single strongest
        # bin in the ball velocity band and take the angle at that bin only.
        # This avoids averaging across noisy weak detections.
        peak_angles = []
        peak_snrs = []
        peak_speeds_mph = []

        for fi in sorted(frame_set):
            radc_raw = frames[fi].get("radc")
            if radc_raw is None:
                continue
            channels = parse_radc_payload(radc_raw) if isinstance(radc_raw, bytes) else radc_raw

            f1a_iq = to_complex_iq(channels["f1a_i"], channels["f1a_q"])
            f2a_iq = to_complex_iq(channels["f2a_i"], channels["f2a_q"])

            spec = compute_spectrum(f1a_iq, fft_size=fft_size)
            ball_spec = spec[b_lo:b_hi]
            if ball_spec.max() <= 0:
                continue

            # SNR of the peak bin vs full-spectrum noise floor
            full_median = float(np.median(spec[spec > 0]))
            peak_val = float(ball_spec.max())
            snr = peak_val / full_median if full_median > 0 else 0.0
            if snr < 2.0:
                continue

            peak_bin = b_lo + int(np.argmax(ball_spec))

            # Per-bin angle at the peak
            f1a_fft = compute_fft_complex(f1a_iq, fft_size=fft_size)
            f2a_fft = compute_fft_complex(f2a_iq, fft_size=fft_size)
            angles = per_bin_angle_deg(f1a_fft, f2a_fft)

            peak_angles.append(float(angles[peak_bin]))
            peak_snrs.append(snr)
            vel = bin_to_velocity_kmh(peak_bin, fft_size, max_speed_kmh)
            peak_speeds_mph.append((200.0 + vel) / 1.609)

        if not peak_angles:
            continue

        angs = np.array(peak_angles)
        snrs = np.array(peak_snrs)

        if len(angs) == 1:
            # Single-frame detection — accept if SNR is strong.
            # Golf balls transit the K-LD7 beam in ~1 frame at 18 FPS,
            # so a single high-SNR frame is the expected case.
            if snrs[0] < 5.0:
                continue
            clean_angs = angs
            clean_snrs = snrs
        else:
            # Multi-frame: outlier rejection — drop the point furthest from median
            clean_mask = np.ones(len(angs), dtype=bool)
            if len(angs) >= 3:
                med = float(np.median(angs))
                worst = int(np.argmax(np.abs(angs - med)))
                clean_mask[worst] = False
            clean_angs = angs[clean_mask]
            clean_snrs = snrs[clean_mask]

        # SNR²-weighted average of surviving peaks
        w = clean_snrs ** 2
        total_w = float(np.sum(w))
        if total_w <= 0:
            continue
        weighted_angle = float(np.sum(clean_angs * w) / total_w)
        corrected_angle = weighted_angle + angle_offset_deg

        avg_speed_mph = float(np.mean(peak_speeds_mph))
        angle_std = float(np.std(clean_angs))
        avg_snr = float(np.mean(clean_snrs))

        # Confidence: tight angle spread + high SNR + multiple frames
        frame_count = len(clean_angs)
        std_score = max(0.0, 1.0 - angle_std / 15.0) if len(clean_angs) > 1 else 0.5
        snr_score = min(avg_snr / 10.0, 1.0)
        frame_score = min(frame_count / 3.0, 1.0)
        confidence = round(std_score * 0.4 + snr_score * 0.3 + frame_score * 0.3, 2)

        results.append({
            "shot_index": shot_idx,
            "launch_angle_deg": round(corrected_angle, 1),
            "raw_angle_deg": round(weighted_angle, 1),
            "angle_offset_deg": angle_offset_deg,
            "ball_speed_mph": round(avg_speed_mph, 1),
            "confidence": confidence,
            "detection_count": len(peak_angles),
            "frame_count": frame_count,
            "angle_std_deg": round(angle_std, 1),
            "avg_snr_db": round(avg_snr, 1),
            "impact_frames": impact_group,
        })

    return results


def analyze_capture(
    data: dict,
    angle_offset_deg: float = 0.0,
    speed_tolerance_mph: float = 10.0,
) -> list[dict]:
    """Analyze a full RADC capture with OPS243 shot anchoring.

    Reads the pkl data dict (frames + ops243_shots/ops243_captures) and
    returns one result per shot. If OPS243 data is present, each shot's
    ball speed narrows the K-LD7 velocity search. Otherwise falls back
    to the broad default ball velocity range.

    Pairing: K-LD7 impact events are paired with OPS243 shots by
    sequence order (1st K-LD7 impact = 1st OPS shot), NOT by timestamp.
    The OPS243 timestamp has ~1s latency from I/Q read time, making
    direct timestamp matching unreliable.

    Args:
        data: Dict from pickle.load() with keys: frames, ops243_shots (optional)
        angle_offset_deg: Angle offset to apply
        speed_tolerance_mph: Velocity search window ± around OPS243 speed

    Returns:
        List of shot dicts from extract_launch_angle, with ops243_ball_speed_mph
        added to each.
    """
    frames = data["frames"]
    ops243_shots = data.get("ops243_shots", [])
    ops243_captures = data.get("ops243_captures", [])

    # Use shots if available, fall back to captures
    ops_data = ops243_shots or ops243_captures

    if not ops_data:
        # No OPS243 — use broad velocity range
        return extract_launch_angle(
            frames, angle_offset_deg=angle_offset_deg,
            speed_tolerance_mph=speed_tolerance_mph,
        )

    # Run extract_launch_angle on the full capture, using the first
    # OPS243 ball speed to anchor the velocity search. This lets
    # find_impact_frames detect energy spikes across the whole timeline
    # and group them into shots, then we pair by sequence.
    #
    # For multi-shot captures with varying ball speeds, we'd need to
    # run per-shot with different speeds. For now use the first shot's
    # speed as the anchor (all shots in a session are typically similar).
    first_ball_speed = None
    for s in ops_data:
        speed = s.get("ball_speed_mph")
        if speed and speed > 0:
            first_ball_speed = speed
            break

    all_shots = extract_launch_angle(
        frames,
        ops243_ball_speed_mph=first_ball_speed,
        angle_offset_deg=angle_offset_deg,
        speed_tolerance_mph=speed_tolerance_mph,
    )

    # Pair K-LD7 shots with OPS243 by sequence
    for i, shot in enumerate(all_shots):
        if i < len(ops_data):
            ops = ops_data[i]
            shot["ops243_ball_speed_mph"] = ops.get("ball_speed_mph")
            shot["ops243_club_speed_mph"] = ops.get("club_speed_mph")
            shot["ops243_impact_timestamp"] = ops.get(
                "impact_timestamp", ops.get("timestamp")
            )

    return all_shots


def process_radc_frame(
    frame: dict,
    frame_index: int,
    fft_size: int = 2048,
    max_speed_kmh: float = 100.0,
    cfar_threshold: float = 8.0,
    cfar_guard: int = 4,
    cfar_training: int = 16,
) -> list[RADCDetection]:
    """Process one RADC frame: parse → FFT → CFAR → physical units.

    Uses F1A channel as primary, F2A for angle estimation.
    """
    radc_raw = frame.get("radc")
    if radc_raw is None:
        return []

    if isinstance(radc_raw, bytes):
        channels = parse_radc_payload(radc_raw)
    else:
        channels = radc_raw

    f1a = to_complex_iq(channels["f1a_i"], channels["f1a_q"])
    f2a = to_complex_iq(channels["f2a_i"], channels["f2a_q"])

    spectrum = compute_spectrum(f1a, fft_size=fft_size)
    cfar_hits = cfar_detect(
        spectrum,
        guard_cells=cfar_guard,
        training_cells=cfar_training,
        threshold_factor=cfar_threshold,
    )

    angle_deg = estimate_angle_from_phase(f1a, f2a)
    timestamp = float(frame["timestamp"])

    detections = []
    for hit in cfar_hits:
        velocity = bin_to_velocity_kmh(hit.bin_index, fft_size, max_speed_kmh)
        detections.append(
            RADCDetection(
                frame_index=frame_index,
                timestamp=timestamp,
                distance_m=0.0,  # RADC gives velocity, not range — set from FMCW chirp later
                velocity_kmh=velocity,
                angle_deg=angle_deg,
                magnitude=hit.magnitude,
                snr_db=hit.snr_db,
                bin_index=hit.bin_index,
            )
        )

    return detections


def compare_radc_vs_pdat(
    radc_detections: list[RADCDetection],
    pdat: list[dict],
) -> dict:
    """Compare our RADC FFT detections against the module's PDAT output.

    Returns a summary dict for logging / CSV export.
    """
    pdat_speeds = [abs(p.get("speed", 0)) for p in pdat if p]
    pdat_mags = [p.get("magnitude", 0) for p in pdat if p]
    radc_velocities = [abs(d.velocity_kmh) for d in radc_detections]
    radc_mags = [d.magnitude for d in radc_detections]

    return {
        "radc_count": len(radc_detections),
        "pdat_count": len(pdat),
        "radc_max_velocity_kmh": max(radc_velocities) if radc_velocities else 0.0,
        "pdat_max_speed_kmh": max(pdat_speeds) if pdat_speeds else 0.0,
        "radc_max_magnitude": max(radc_mags) if radc_mags else 0.0,
        "pdat_max_magnitude": max(pdat_mags) if pdat_mags else 0.0,
    }
