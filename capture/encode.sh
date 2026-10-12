#!/usr/bin/env bash
set -euo pipefail
capture_output="${CAPTURE_OUTPUT:-capture/output}"
mkdir -p public/features
for feature in lighting background tabs; do
  if [ "$feature" = lighting ]; then
    capture_start=2.4
    capture_end=9.4
  else
    capture_start=1.8
    capture_end=9.8
  fi
  # A return pass retraces the original animation and rejoins the initial still frame.
  ffmpeg -y -loglevel error -i "$capture_output/$feature-forward.mp4" \
    -filter_complex "[0:v]trim=start=$capture_start:end=$capture_end,setpts=PTS-STARTPTS,split=2[f][r];[r]reverse,setpts=PTS-STARTPTS[back];[f][back]concat=n=2:v=1:a=0[v]" \
    -map '[v]' -an -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "public/features/$feature.mp4"
  ffmpeg -y -loglevel error -i "public/features/$feature.mp4" -frames:v 1 -c:v libwebp -quality 92 "public/features/$feature-poster.webp"
done
