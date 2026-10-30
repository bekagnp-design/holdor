#!/bin/bash
# 8 s TikTok cut: make_trailer_8s.js frames (arg 1, default /tmp/tf8) + audio_8s.py -> holdor_tiktok_8s.mp4 (720x1280, 30 fps)
set -e; cd "$(dirname "$0")"; python3 audio_8s.py
ffmpeg -loglevel error -y -framerate 30 -i "${1:-/tmp/tf8}/f%04d.jpg" -i trailer_audio_8s.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -c:a aac -b:a 160k -shortest -vf "fade=t=out:st=7.75:d=0.25" holdor_tiktok_8s.mp4
