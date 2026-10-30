#!/bin/bash
# 1080x1080 X-feed cut from the 20 s frames (default /tmp/mk/frames): the 9:16 picture centred over its own blurred copy
set -e; cd "$(dirname "$0")"
ffmpeg -loglevel error -y -framerate 30 -i "${1:-/tmp/mk/frames}/f%04d.jpg" -i trailer_audio.wav -filter_complex "[0:v]split=2[a][b];[a]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=30:5,eq=brightness=-0.15[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,fade=t=out:st=19.7:d=0.3,format=yuv420p[v]" -map "[v]" -map 1:a -c:v libx264 -crf 21 -preset medium -c:a aac -b:a 160k -shortest holdor_x_square_20s.mp4
