"""按任务清单合成配音：fish（默认）或 edge-tts（云希，兜底）。

用法：python -P scripts/course_tts.py jobs.json
jobs.json 是段的列表，由 scripts/course-player.ts 生成，只含需要（重新）合成的段：
  [{"engine": "fish"|"edge", "model": ..., "voice": ..., "rate": "+0%",
    "beats": [{"n": 1, "text": 原文, "spoken": 按多音字词表处理过的文字, "out": "绝对路径.mp3"}, ...]}, ...]
一段只有一拍时直接合成；一段有多拍时（fish 整屏模式）把整段一次合成，
再用 faster-whisper 把转写和原文逐字对齐，在拍与拍之间最安静的位置切开，切成每拍一个文件。
这样同一段里语调连贯、音色一致。对不齐时退回逐拍合成，并打印提示。
fish 的 key 从仓库根目录 .env 的 FISH_API_KEY 读。

2026-10 起 speech.platform.bing.com 的合成接口返回 403（rany2/edge-tts#490）。
上游修复（#491）未发布前，这里把合成地址换成 Edge 现在用的 api.msedgeservices.com，
令牌和签名照旧。edge-tts 发布修复版后可以删掉 patch_endpoint。
"""

import asyncio
import difflib
import json
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

import edge_tts
import edge_tts.communicate as communicate
import edge_tts.constants as constants

ROOT = Path(__file__).resolve().parent.parent


def patch_endpoint() -> None:
    url = (
        "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1"
        f"?Ocp-Apim-Subscription-Key={constants.TRUSTED_CLIENT_TOKEN}"
    )
    constants.WSS_URL = url
    communicate.WSS_URL = url


def fish_key() -> str:
    for line in (ROOT / ".env").read_text("utf-8").splitlines():
        k, _, v = line.partition("=")
        if k.strip() == "FISH_API_KEY":
            return v.strip().strip("'\"")
    raise RuntimeError(".env 里没有 FISH_API_KEY")


def fish(text: str, model: str, voice: str, out: Path) -> None:
    import requests

    r = requests.post(
        "https://api.fish.audio/v1/tts",
        headers={"Authorization": f"Bearer {fish_key()}", "model": model},
        json={"text": text, "reference_id": voice, "format": "mp3"},
        timeout=300,
    )
    if r.status_code != 200:
        raise RuntimeError(f"fish HTTP {r.status_code} {r.text[:200]}")
    out.write_bytes(r.content)


async def speak(seg: dict, text: str, out: Path) -> None:
    """合成一段文字，网络偶尔断开就稍等重试。"""
    for attempt in range(4):
        try:
            if seg["engine"] == "fish":
                await asyncio.to_thread(fish, text, seg["model"], seg["voice"], out)
            else:
                await edge_tts.Communicate(text, seg["voice"], rate=seg.get("rate", "+0%")).save(str(out))
            return
        except Exception as e:
            if attempt == 3:
                raise RuntimeError(f"合成失败：{text[:40]}") from e
            await asyncio.sleep(1.5 * (attempt + 1))


# ───────── 整段切拍 ─────────

PUNCT = set("，。、：；？！,.:;?!“”\"'（）() 　…—")
_model = None
_model_lock = threading.Lock()


def norm(t: str) -> str:
    return "".join(c.lower() for c in t if c not in PUNCT)


def pcm(p: Path):
    import numpy as np

    # 本机 faster-whisper 和 av 版本不兼容，自己用 ffmpeg 解码成 16k 单声道
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def transcribe(audio, words: bool):
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel

            _model = WhisperModel("small", device="cpu", compute_type="int8")
        segs, _ = _model.transcribe(audio, language="zh", word_timestamps=words, initial_prompt="以下是普通话的句子。")
        return list(segs)


def align_cut(src: Path, texts: list[str], outs: list[Path]) -> list[dict]:
    """把一整段录音按原文切成每拍一段。返回每拍的起止秒数、重新转写的文字和差异率（0 表示完全一致）。"""
    import numpy as np

    audio = pcm(src)
    # 转写拆成单字，一个词里的字平分这个词的时间
    hyp = []
    for seg in transcribe(audio, True):
        for w in seg.words:
            cs = norm(w.word)
            for i, c in enumerate(cs):
                d = (w.end - w.start) / len(cs)
                hyp.append((c, w.start + i * d, w.start + (i + 1) * d))
    ref, owner = [], []
    for k, t in enumerate(texts):
        for c in norm(t):
            ref.append(c)
            owner.append(k)
    t_of: dict[int, tuple[float, float]] = {}
    for blk in difflib.SequenceMatcher(None, ref, [h[0] for h in hyp], autojunk=False).get_matching_blocks():
        for i in range(blk.size):
            t_of[blk.a + i] = hyp[blk.b + i][1:]

    # 本拍最后一个对上的字结束、下一拍第一个对上的字开始，在这段里找最安静的 10ms 下刀
    rms = np.sqrt(np.convolve(audio**2, np.ones(160) / 160, mode="same"))
    cuts = [0.0]
    for k in range(len(texts) - 1):
        last = max((i for i, o in enumerate(owner) if o == k and i in t_of), default=None)
        first = min((i for i, o in enumerate(owner) if o == k + 1 and i in t_of), default=None)
        if last is None or first is None:
            raise RuntimeError(f"第{k + 1}、{k + 2}句之间对不齐")
        lo, hi = t_of[last][1] - 0.15, t_of[first][0] + 0.15
        a, b = int(max(lo, cuts[-1] + 0.1) * 16000), int(hi * 16000)
        if b <= a:
            raise RuntimeError(f"第{k + 1}、{k + 2}句的切点重叠")
        cuts.append((a + int(np.argmin(rms[a:b]))) / 16000)
    cuts.append(len(audio) / 16000)

    report = []
    for k, out in enumerate(outs):
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ss", f"{cuts[k]:.3f}", "-to", f"{cuts[k + 1]:.3f}", "-b:a", "128k", str(out)], check=True)
        got = norm("".join(s.text for s in transcribe(pcm(out), False)))
        diff = 1 - difflib.SequenceMatcher(None, norm(texts[k]), got, autojunk=False).ratio()
        report.append({"start": round(cuts[k], 3), "end": round(cuts[k + 1], 3), "asr": got, "diff": round(diff, 2)})
    return report


async def run_segment(seg: dict, sem: asyncio.Semaphore) -> None:
    beats = seg["beats"]
    async with sem:
        if len(beats) > 1:
            with tempfile.TemporaryDirectory() as tmp:
                whole = Path(tmp) / "whole.mp3"
                await speak(seg, "".join(b["spoken"] for b in beats), whole)
                try:
                    report = await asyncio.to_thread(align_cut, whole, [b["text"] for b in beats], [Path(b["out"]) for b in beats])
                except Exception as e:
                    print(f"  ! 第{beats[0]['n']}–{beats[-1]['n']}拍整段切不开（{e}），改为逐拍合成", flush=True)
                else:
                    for b, r in zip(beats, report):
                        flag = "  ← 切片和原文差异较大，请听一下" if r["diff"] > 0.3 else ""
                        print(f"  ok  b{b['n']:03d}  {r['start']:6.2f}–{r['end']:6.2f}s  {b['text']}{flag}", flush=True)
                    return
        for b in beats:
            await speak(seg, b["spoken"], Path(b["out"]))
            print(f"  ok  b{b['n']:03d}  {b['text']}", flush=True)


async def main() -> None:
    with open(sys.argv[1], encoding="utf-8") as f:
        segs = json.load(f)
    if any(s["engine"] == "edge" for s in segs):
        patch_endpoint()
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(run_segment(s, sem) for s in segs))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
