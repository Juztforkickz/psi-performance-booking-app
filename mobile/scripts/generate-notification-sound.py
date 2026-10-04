"""Generate the original PSI cash receipt notification sound."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 44_100
DURATION_SECONDS = 1.35
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "sounds" / "psi-cash-receipt.wav"


def envelope(time: float, start: float, attack: float, decay: float) -> float:
    elapsed = time - start
    if elapsed < 0 or elapsed > attack + decay:
        return 0.0
    if elapsed < attack:
        return elapsed / attack
    return math.exp(-5.2 * (elapsed - attack) / decay)


def tone(time: float, start: float, frequency: float, amplitude: float, decay: float) -> float:
    level = envelope(time, start, 0.004, decay)
    elapsed = max(0.0, time - start)
    fundamental = math.sin(2 * math.pi * frequency * elapsed)
    overtone = 0.26 * math.sin(2 * math.pi * frequency * 2.01 * elapsed)
    shimmer = 0.10 * math.sin(2 * math.pi * frequency * 3.98 * elapsed)
    return amplitude * level * (fundamental + overtone + shimmer)


def main() -> None:
    randomizer = random.Random(431_781)
    samples: list[float] = []

    for index in range(round(SAMPLE_RATE * DURATION_SECONDS)):
        time = index / SAMPLE_RATE
        sample = 0.0

        # A short drawer click and low body give the alert its cash receipt shape.
        click_level = envelope(time, 0.0, 0.0015, 0.055)
        sample += click_level * randomizer.uniform(-0.24, 0.24)
        sample += tone(time, 0.012, 118.0, 0.24, 0.16)

        # The four note signature is composed specifically for PSI.
        sample += tone(time, 0.075, 987.77, 0.34, 0.29)
        sample += tone(time, 0.205, 1479.98, 0.32, 0.32)
        sample += tone(time, 0.355, 1975.53, 0.36, 0.43)
        sample += tone(time, 0.535, 2637.02, 0.28, 0.48)

        # A quiet paper movement keeps the result warm without masking the chime.
        paper_level = envelope(time, 0.10, 0.018, 0.34)
        paper_pulse = 0.5 + 0.5 * math.sin(2 * math.pi * 34 * time)
        sample += paper_level * paper_pulse * randomizer.uniform(-0.025, 0.025)
        samples.append(sample)

    peak = max(abs(sample) for sample in samples) or 1.0
    scale = 0.88 / peak
    pcm = b"".join(struct.pack("<h", round(max(-1.0, min(1.0, sample * scale)) * 32767)) for sample in samples)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm)

    print(f"Generated {OUTPUT} ({DURATION_SECONDS:.2f} seconds, mono PCM, {SAMPLE_RATE} Hz)")


if __name__ == "__main__":
    main()
