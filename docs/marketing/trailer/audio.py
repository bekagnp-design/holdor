# The trailer's sound, synthesised from nothing: wind, a door, drums, a horn, thuds, chimes, fire, a fanfare. Pure Python, no samples.
import math, random, struct, wave
SR = 44100; DUR = 20.0; N = int(SR * DUR); random.seed(7)
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
# wind bed for the whole length, swelling
wind = noise(DUR, lp=0.02, a=1.0, d=1e9)
add(0, [w * (0.8 + 0.4 * math.sin(i / SR * 0.9)) for i, w in enumerate(wind)], 1.6)
# 1.9 the door: a creak (a falling squeal + grit) and a boom
add(1.55, mix(sine(520, 0.7, 180, a=0.1, d=1.2, vib=25), noise(0.7, lp=0.4, a=0.1, d=0.5)), 0.22)
add(1.9, mix(sine(70, 1.0, 38, a=0.003, d=0.35), noise(0.3, lp=0.1, a=0.002, d=0.1)), 1.0)
# 3.3 the horn: two low saws
add(3.3, mix(saw(98, 1.3, f2=92, d=0.9), saw(147, 1.3, f2=138, d=0.9)), 0.35)
# the drum line from 3.3 to 17.0, every half second, building
t = 3.3; k = 0
while t < 17.0:
    g = 0.5 + 0.5 * min(1, (t - 3.3) / 8); add(t, sine(95, 0.25, 48, a=0.002, d=0.07), g * 0.9)
    if k % 2 == 1: add(t + 0.25, noise(0.08, lp=0.5, a=0.001, d=0.03), 0.18 * g)
    t += 0.5; k += 1
# 5.2.. the builds: a thunk and a clink
for i in range(6):
    t = 5.2 + i * 0.5; add(t, sine(180, 0.12, 70, a=0.001, d=0.05), 0.8); add(t, noise(0.06, lp=0.7, a=0.001, d=0.02), 0.5); add(t + 0.04, sine(1900, 0.1, 1300, a=0.001, d=0.04), 0.12)
# 9.6 the offer: a rising chime; 11.9 the pick: a bright arpeggio
for j, f in enumerate([660, 880, 1320]): add(9.6 + j * 0.09, sine(f, 0.9, a=0.003, d=0.4), 0.3)
for j, f in enumerate([523, 659, 784, 1047]): add(11.9 + j * 0.07, sine(f, 0.7, a=0.003, d=0.25), 0.34)
# 12.7 a sad trombone for the guard: two falling notes
add(12.75, saw(196, 0.35, a=0.02, d=0.5, f2=185), 0.25); add(13.12, saw(175, 0.6, a=0.02, d=0.7, f2=130), 0.28)
# 14.2 / 15.4 the jars: glass, then a whoomp; 14.9 the beacon: a rising swell and a crack
for t in (14.2, 15.4): add(t, noise(0.12, lp=0.8, a=0.001, d=0.05), 0.6); add(t + 0.05, mix(noise(0.7, lp=0.06, a=0.01, d=0.3), sine(60, 0.6, 30, a=0.005, d=0.25)), 0.9)
add(14.9, mix(sine(300, 0.6, 1200, a=0.4, d=1e9), noise(0.6, lp=0.3, a=0.4, d=1e9)), 0.16); add(15.5, noise(0.1, lp=0.9, a=0.001, d=0.04), 0.4)
# 17.0 the fanfare: three rising brass notes and a shimmer
for j, (f, d) in enumerate([(392, 0.2), (523, 0.2), (784, 0.9)]): add(17.0 + j * 0.2, mix(saw(f, d + 0.4, a=0.02, d=d), saw(f * 1.5, d + 0.4, a=0.02, d=d)), 0.22)
for j in range(14): add(17.1 + j * 0.05, sine(2000 + 150 * j, 0.25, a=0.002, d=0.08), 0.07)
# 18.5 the end: a chord and one clear bell
for f in (196, 247, 294, 392): add(18.5, saw(f, 1.5, a=0.05, d=1.0), 0.16)
add(18.55, sine(1568, 1.4, a=0.002, d=0.6), 0.26)
# the end of the sound fades out
peak = max(abs(x) for x in L) or 1; out = bytearray()
for i, x in enumerate(L):
    f = min(1, (DUR - i / SR) / 0.5); v = max(-1, min(1, x / peak * 0.85 * f)); out += struct.pack('<hh', int(v * 32767), int(v * 32767))
w = wave.open('trailer_audio.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(out)); w.close(); print('ok')
