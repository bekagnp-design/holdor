i = s.find('/* =========================== HUB (v1.0.40)'); j = s.find('window.HOLDOR={', i); assert 0 < i < j
s = s[:i] + hub + s[j:]
