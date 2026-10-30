# The trailer's sound, synthesised from nothing: wind, a door, drums, a horn, thuds, chimes, fire, a fanfare. Pure Python, no samples.
import math, random, struct, wave
SR = 44100; DUR = 8.0; N = int(SR * DUR); random.seed(7)
L = [0.0] * N
def add(t0, samples, gain=1.0):
    i0 = int(t0 * SR)
    for i, v in enumerate(samples):
        j = i0 + i
        if 0 <= j < N: L[j] += v * gain
def env(n, a=0.005, d=0.2):  # attack + exponential decay
    return [min(1, i / (a * SR + 1)) * math.exp(-i / (d * SR)) for i in range(n)]
def sine(f, dur, f2=None, a=0.005, d=0.2, vib=0):
    n = int(dur * SR); e = env(n, a, d); out = []; ph = 0.0
    for i in range(n):
        ff = f + ((f2 if f2 else f) - f) * i / n + (vib * math.sin(i / SR * 40) if vib else 0)
        ph += 2 * math.pi * ff / SR; out.append(math.sin(ph) * e[i])
    return out
def noise(dur, lp=0.2, a=0.01, d=0.2):
    n = int(dur * SR); e = env(n, a, d); out = []; y = 0.0
    for i in range(n):
        y += (random.uniform(-1, 1) - y) * lp; out.append(y * e[i])
    return out
def saw(f, dur, a=0.03, d=0.5, f2=None):
    n = int(dur * SR); e = env(n, a, d); out = []; ph = 0.0
    for i in range(n):
        ff = f + ((f2 if f2 else f) - f) * i / n; ph = (ph + ff / SR) % 1; out.append((2 * ph - 1) * e[i] * 0.5)
    return out
def mix(*ls):
    n = max(len(x) for x in ls); return [sum(x[i] for x in ls if i < len(x)) for i in range(n)]
# wind bed
wind = noise(DUR, lp=0.02, a=0.5, d=1e9)
add(0, [w * (0.8 + 0.4 * math.sin(i / SR * 0.9)) for i, w in enumerate(wind)], 1.6)
# door creak + boom at 0.9
add(0.5, mix(sine(520, 0.4, 180, a=0.05, d=1.2, vib=25), noise(0.4, lp=0.4, a=0.05, d=0.5)), 0.22)
add(0.9, mix(sine(70, 0.8, 38, a=0.003, d=0.3), noise(0.3, lp=0.1, a=0.002, d=0.1)), 1.0)
# horn
add(1.6, mix(saw(98, 1.0, f2=92, d=0.7), saw(147, 1.0, f2=138, d=0.7)), 0.35)
t = 1.6; k = 0
while t < 5.8:
    g = 0.6 + 0.4 * min(1, (t - 1.6) / 3); add(t, sine(95, 0.2, 48, a=0.002, d=0.06), g * 0.9)
    if k % 2 == 1: add(t + 0.15, noise(0.06, lp=0.5, a=0.001, d=0.03), 0.18 * g)
    t += 0.3; k += 1
for i in range(6):
    t = 1.7 + i * 0.25; add(t, sine(180, 0.12, 70, a=0.001, d=0.05), 0.8); add(t, noise(0.06, lp=0.7, a=0.001, d=0.02), 0.5); add(t + 0.04, sine(1900, 0.1, 1300, a=0.001, d=0.04), 0.12)
for j, f in enumerate([660, 880, 1320]): add(3.4 + j * 0.09, sine(f, 0.9, a=0.003, d=0.4), 0.3)
for j, f in enumerate([523, 659, 784, 1047]): add(4.4 + j * 0.07, sine(f, 0.7, a=0.003, d=0.25), 0.34)
for t in (5.0,): add(t, noise(0.12, lp=0.8, a=0.001, d=0.05), 0.6); add(t + 0.05, mix(noise(0.6, lp=0.06, a=0.01, d=0.3), sine(60, 0.6, 30, a=0.005, d=0.25)), 0.9)
add(5.4, mix(sine(300, 0.4, 1200, a=0.3, d=1e9), noise(0.4, lp=0.3, a=0.3, d=1e9)), 0.16)
for j, (f, d) in enumerate([(392, 0.12), (523, 0.12), (784, 0.7)]): add(5.8 + j * 0.12, mix(saw(f, d + 0.3, a=0.02, d=d), saw(f * 1.5, d + 0.3, a=0.02, d=d)), 0.22)
for f in (196, 247, 294, 392): add(6.7, saw(f, 1.3, a=0.05, d=0.9), 0.16)
add(6.75, sine(1568, 1.2, a=0.002, d=0.6), 0.26)
# the end of the sound fades out
peak = max(abs(x) for x in L) or 1; out = bytearray()
for i, x in enumerate(L):
    f = min(1, (DUR - i / SR) / 0.5); v = max(-1, min(1, x / peak * 0.85 * f)); out += struct.pack('<hh', int(v * 32767), int(v * 32767))
w = wave.open('trailer_audio_8s.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(out)); w.close(); print('ok')
