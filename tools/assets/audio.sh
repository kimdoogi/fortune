#!/usr/bin/env bash
# 사운드 가공 (docs/08 §5, D-078). ElevenLabs에서 받은 원본 mp3를 앱에 넣을 파일로 만든다.
#   사용: tools/assets/audio.sh <원본 폴더>   → apps/web/public/audio/*.mp3
# - 배경음: 앞 3초를 끝 3초에 겹쳐(크로스페이드) 이음새 없이 반복되게 → 소리 크기 -20 LUFS → 스테레오 96kbps
# - 효과음: 앞 무음 자르기 → 소리 크기 -18 LUFS(최대 -1.5dB) → 끝 30ms 줄이기 → 모노 64kbps
set -euo pipefail
SRC="${1:?원본 폴더를 넣어 주세요}"
OUT="$(cd "$(dirname "$0")/../.." && pwd)/apps/web/public/audio"
mkdir -p "$OUT"
XF=3

for f in "$SRC"/bgm-*.mp3; do
  name="$(basename "$f")"
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
  ffmpeg -hide_banner -loglevel error -y -i "$f" -filter_complex "
    [0:a]atrim=start=${XF},asetpts=PTS-STARTPTS[main];
    [0:a]atrim=end=${XF},asetpts=PTS-STARTPTS[head];
    [main][head]acrossfade=d=${XF}:c1=qsin:c2=qsin,loudnorm=I=-20:TP=-1.5:LRA=11[out]" \
    -map "[out]" -ar 44100 -ac 2 -b:a 96k "$OUT/$name"
  echo "$name: ${dur}s → $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name")s"
done

for f in "$SRC"/sfx-*.mp3; do
  name="$(basename "$f")"
  ffmpeg -hide_banner -loglevel error -y -i "$f" -af "
    silenceremove=start_periods=1:start_threshold=-45dB,
    loudnorm=I=-18:TP=-1.5,
    areverse,afade=t=in:d=0.03,areverse" \
    -ar 44100 -ac 1 -b:a 64k "$OUT/$name"
  echo "$name"
done
ls -l "$OUT"
