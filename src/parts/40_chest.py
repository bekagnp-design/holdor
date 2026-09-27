# ---- richer chests (4 tiers × closed/open); CHEST_ART images still override when they arrive ----
i = hub.find('function chestSVG(t,open){'); j = hub.find('\nfunction ', i + 10); assert 0 < i < j
hub = hub[:i] + mod('chest.js').rstrip('\n') + hub[j:]
