#!/bin/bash
# frames (make_trailer.js) + sound (audio.py) -> holdor_trailer_20s.mp4 (720x1280, 30 fps)
set -e
cd "$(dirname "$0")"
python3 audio.py
ffmpeg -loglevel error -y -framerate 30 -i "${1:-/tmp/tf}/f%04d.jpg" -i trailer_audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -c:a aac -b:a 160k -shortest -vf "crop=648:1152:36:120,scale=720:1280:flags=lanczos,eq=contrast=1.06:saturation=1.12,unsharp=3:3:0.5,vignette=PI/6,fade=t=out:st=19.7:d=0.3" holdor_trailer_20s.mp4
ls -la holdor_trailer_20s.mp4
