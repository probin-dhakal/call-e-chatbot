import os

# gthread (not the default sync worker) is required for --threads to have
# any effect at all — the sync worker silently ignores it and handles one
# request per process regardless.
worker_class = "gthread"
workers = 2
threads = 4

# Gemini replies can take several seconds, and a request holds its worker
# thread the whole time — 120s gives real headroom above that without
# masking a genuinely hung request for too long.
timeout = 120

bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"

# Keep connections warm through brief network hiccups without holding a
# worker open indefinitely.
keepalive = 5

accesslog = "-"
errorlog = "-"
