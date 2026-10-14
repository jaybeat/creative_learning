"""配音盲听对比：同一批难句交给几家 TTS 合成，生成盲听页。

用法：python -P scripts/tts_ab.py [只跑的配置名 ...]
      python -P scripts/tts_ab.py screen-cut   第0屏整屏合成→对齐切拍→和逐拍做法对比
输出 docs/course/tts-ab/（已加进 .gitignore）：audio/<配置>/<条目>.mp3、manifest.json、index.html。
key 从仓库根目录的 .env 读：FISH_API_KEY、VOLCENGINE_API_KEY、MINIMAX_API_KEY。
已合成的文件直接复用；某一家失败只记下原因，不影响别家。
"""

import base64
import html
import json
import random
import subprocess
import sys
import uuid
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/course/tts-ab"
YUNXI = ROOT / "docs/course/player/2-1/audio"

# 旁白取播放器实际念的文本（manifest 里记着），和云希基线一字不差
TEXTS = {int(k): v["text"] for k, v in json.loads((YUNXI / "manifest.json").read_text("utf-8")).items()}

# 难点：半句、逐字母、cat/act、a零、n减1、多音字
SAMPLES = [1, 2, 3, 5, 10, 11, 20, 26, 27, 40, 41, 42, 45, 47, 50, 52, 71]
DRIFT_BEAT, DRIFT_RUNS = 11, 3
SCREEN0 = range(1, 21)

# 多音字注音表：词、整词拼音、要钉住的那个字在词里的位置
ANNOT = [
    ("一行", ["yi4", "hang2"], 1),
    ("两行", ["liang3", "hang2"], 1),
    ("长度", ["chang2", "du4"], 0),
    ("重复", ["chong2", "fu4"], 0),
    ("空表", ["kong1", "biao3"], 0),
    ("得一直", ["dei3", "yi4", "zhi2"], 0),
    ("还得", ["hai2", "dei3"], 1),
    ("单行", ["dan1", "hang2"], 1),
]

CONFIGS = {
    "fish-s2.1": {"provider": "fish", "model": "s2.1-pro", "voice": "83bc284d2a3848c8a37f6d9a9ab11cd8", "label": "fish 科普 · s2.1-pro"},
    "fish-s1": {"provider": "fish", "model": "s1", "voice": "83bc284d2a3848c8a37f6d9a9ab11cd8", "label": "fish 科普 · s1"},
    "doubao-yunzhou": {"provider": "doubao", "voice": "zh_male_m191_uranus_bigtts", "label": "豆包2.0 云舟"},
    "doubao-liufei": {"provider": "doubao", "voice": "zh_male_liufei_uranus_bigtts", "label": "豆包2.0 刘飞"},
    "minimax-sincere": {"provider": "minimax", "voice": "Chinese (Mandarin)_Sincere_Adult", "label": "MiniMax 2.8-hd 真诚青年"},
    "minimax-gentleman": {"provider": "minimax", "voice": "Chinese (Mandarin)_Gentleman", "label": "MiniMax 2.8-hd 温润男声"},
    "yunxi": {"provider": "yunxi", "label": "edge-tts 云希（现用）"},
}


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env").read_text("utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env


ENV = load_env()


def annot_hits(text: str) -> list:
    return [a for a in ANNOT if a[0] in text]


# ───────── 各家接口 ─────────

def fish(cfg: dict, text: str, annotate: bool) -> tuple[bytes, dict]:
    if annotate:
        for word, py, i in annot_hits(text):
            tagged = word[:i] + f"<|phoneme_start|>{py[i]}<|phoneme_end|>" + word[i + 1:]
            text = text.replace(word, tagged)
    r = requests.post(
        "https://api.fish.audio/v1/tts",
        headers={"Authorization": f"Bearer {ENV['FISH_API_KEY']}", "model": cfg["model"]},
        json={"text": text, "reference_id": cfg["voice"], "format": "mp3"},
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code} {r.text[:200]}")
    return r.content, {}


def doubao(cfg: dict, text: str, annotate: bool) -> tuple[bytes, dict]:
    params = {"speaker": cfg["voice"], "audio_params": {"format": "mp3", "sample_rate": 24000, "enable_subtitle": True}}
    if annotate:
        s = html.escape(text)
        for word, py, i in annot_hits(text):
            s = s.replace(word, f'<phoneme alphabet="py" ph="{" ".join(py)}">{word}</phoneme>')
        params["ssml"] = f"<speak>{s}</speak>"
    else:
        params["text"] = text
    r = requests.post(
        "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
        headers={"X-Api-Key": ENV["VOLCENGINE_API_KEY"], "X-Api-Resource-Id": "seed-tts-2.0", "X-Api-Request-Id": str(uuid.uuid4())},
        json={"req_params": params},
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code} {r.text[:200]}")
    audio, words = b"", []
    for line in r.content.decode("utf-8").splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        if d.get("data"):
            audio += base64.b64decode(d["data"])
        if d.get("sentence"):
            words += d["sentence"].get("words") or []
        if d.get("code") not in (None, 0, 20000000):
            raise RuntimeError(f"code {d.get('code')} {d.get('message')}")
    if not audio:
        raise RuntimeError("没有返回音频")
    return audio, {"words": words} if words else {}


def minimax(cfg: dict, text: str, annotate: bool) -> tuple[bytes, dict]:
    body = {
        "model": "speech-2.8-hd",
        "text": text,
        "stream": False,
        "subtitle_enable": True,
        "voice_setting": {"voice_id": cfg["voice"], "speed": 1, "vol": 1, "pitch": 0},
        "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1},
    }
    if annotate:
        body["pronunciation_dict"] = {"tone": [w + "/" + "".join(f"({p})" for p in py) for w, py, _ in annot_hits(text)]}
    r = requests.post(
        "https://api.minimaxi.com/v1/t2a_v2",
        headers={"Authorization": f"Bearer {ENV['MINIMAX_API_KEY']}"},
        json=body,
        timeout=180,
    )
    d = r.json()
    base = d.get("base_resp") or {}
    if base.get("status_code") != 0:
        raise RuntimeError(f"{base.get('status_code')} {base.get('status_msg')}")
    extra = {}
    sub = (d.get("data") or {}).get("subtitle_file")
    if sub:
        try:
            extra["subtitle"] = requests.get(sub, timeout=60).json()
        except Exception as e:  # 字幕只是附带信息，取不到不算失败
            extra["subtitle_error"] = str(e)
    return bytes.fromhex(d["data"]["audio"]), extra


PROVIDERS = {"fish": fish, "doubao": doubao, "minimax": minimax}


# ───────── 条目 ─────────

def items() -> list[dict]:
    out = []
    for n in SAMPLES:
        out.append({"id": f"b{n:03d}", "group": f"第{n}拍", "text": TEXTS[n], "beat": n, "annotate": False})
        if annot_hits(TEXTS[n]):
            out.append({"id": f"b{n:03d}-py", "group": f"第{n}拍", "text": TEXTS[n], "beat": n, "annotate": True, "note": "加注音"})
    for k in range(2, DRIFT_RUNS + 1):
        out.append({"id": f"b{DRIFT_BEAT:03d}-r{k}", "group": f"第{DRIFT_BEAT}拍", "text": TEXTS[DRIFT_BEAT], "beat": DRIFT_BEAT, "annotate": False, "note": f"第{k}次（测漂移）"})
    out.append({"id": "screen0", "group": "第0屏整段（第1–20拍一次合成）", "text": "".join(TEXTS[n] for n in SCREEN0), "annotate": False, "screen": True})
    out.append({"id": "screen0-py", "group": "第0屏整段（第1–20拍一次合成）", "text": "".join(TEXTS[n] for n in SCREEN0), "annotate": True, "screen": True, "note": "加注音"})
    for k, note in [("s0-perbeat", "逐拍合成，按播放器停顿拼接"), ("s0-cut", "整屏合成→切拍→按播放器停顿拼回"), ("s0-raw", "整屏原声，不切")]:
        out.append({"id": k, "group": "第0屏三种做法（都是 fish s2.1 加注音）", "text": "".join(TEXTS[n] for n in SCREEN0), "local": True, "method": note})
    return out


def duration(p: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    try:
        return round(float(r.stdout.strip()), 3)
    except ValueError:
        return 0.0


def concat_yunxi(dst: Path) -> None:
    lst = OUT / "yunxi-screen0.txt"
    lst.write_text("".join(f"file '{(YUNXI / f'b{n:03d}.mp3').as_posix()}'\n" for n in SCREEN0), "utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(dst)], check=True)
    lst.unlink()


def run(only: list[str]) -> dict:
    mf_path = OUT / "manifest.json"
    manifest = json.loads(mf_path.read_text("utf-8")) if mf_path.exists() else {"configs": {}, "items": [], "results": {}}
    manifest["configs"] = {k: v["label"] for k, v in CONFIGS.items()}
    manifest["items"] = items()
    for name, cfg in CONFIGS.items():
        if only and name not in only:
            continue
        res = manifest["results"].setdefault(name, {})
        d = OUT / "audio" / name
        d.mkdir(parents=True, exist_ok=True)
        failed = None
        for it in manifest["items"]:
            out = d / f"{it['id']}.mp3"
            if res.get(it["id"], {}).get("dur") and out.exists():
                continue
            if it.get("local"):
                continue
            if cfg["provider"] == "yunxi":
                # 云希只有现成的逐拍文件：注音和漂移变体都没有，整段用逐拍拼接
                if it.get("annotate") or "-r" in it["id"]:
                    continue
                if it.get("screen"):
                    concat_yunxi(out)
                else:
                    out.write_bytes((YUNXI / f"b{it['beat']:03d}.mp3").read_bytes())
                res[it["id"]] = {"dur": duration(out)}
                continue
            if failed:
                res[it["id"]] = {"error": failed}
                continue
            try:
                audio, extra = PROVIDERS[cfg["provider"]](cfg, it["text"], it.get("annotate", False))
            except Exception as e:
                msg = str(e)
                res[it["id"]] = {"error": msg}
                print(f"  ✗ {name} {it['id']}: {msg}", flush=True)
                # 鉴权、余额、未开通这类错误换句子也一样，直接跳过这一家剩下的条目
                if any(s in msg for s in ("not granted", "insufficient balance", "invalid api key", "HTTP 401", "HTTP 402", "HTTP 403")):
                    failed = msg
                continue
            out.write_bytes(audio)
            res[it["id"]] = {"dur": duration(out), **extra}
            print(f"  ok {name} {it['id']} {res[it['id']]['dur']}s", flush=True)
        mf_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
    return manifest


# ───────── 整屏合成再切拍（实验） ─────────

PLAYER_HTML = ROOT / "docs/course/player/2-1/index.html"
PUNCT = set("，。、：；？！,.:;?!“”\"'（）() 　")


def norm(t: str) -> str:
    return "".join(c.lower() for c in t if c not in PUNCT)


def pcm(p: Path):
    import numpy as np

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def player_gaps() -> dict[int, float]:
    """播放器时间轴里每拍结束后的停顿（下一拍开始 − 本拍开始 − 本拍时长）。"""
    import re

    beats = {int(m[0]): (float(m[1]), float(m[2])) for m in re.findall(r'"k":"beat","n":(\d+),[^}]*?"start":([\d.]+),"dur":([\d.]+)', PLAYER_HTML.read_text("utf-8"))}
    return {n: round(beats[n + 1][0] - beats[n][0] - beats[n][1], 3) for n in SCREEN0 if n + 1 in beats}


def join_with_gaps(parts: list[Path], gaps: list[float], dst: Path) -> None:
    """按停顿把若干段拼成一条：中间插静音，统一转成 24kHz 单声道 mp3。"""
    args, filt = [], ""
    for i, p in enumerate(parts):
        args += ["-i", str(p)]
        filt += f"[{i}:a]aformat=sample_rates=24000:channel_layouts=mono,apad=pad_dur={gaps[i] if i < len(gaps) else 0}[a{i}];"
    filt += "".join(f"[a{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[out]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args, "-filter_complex", filt, "-map", "[out]", "-b:a", "128k", str(dst)], check=True)


def screen_cut() -> None:
    import difflib

    import numpy as np
    from faster_whisper import WhisperModel

    src = OUT / "audio/fish-s2.1/screen0-py.mp3"
    if not src.exists():
        raise SystemExit("先运行 python -P scripts/tts_ab.py fish-s2.1 合成 screen0-py")
    model = WhisperModel("small", device="cpu", compute_type="int8")
    audio = pcm(src)
    segs, _ = model.transcribe(audio, language="zh", word_timestamps=True, initial_prompt="以下是普通话的句子。")
    # 转写结果拆成单字，一个词里的字平分这个词的时间
    hyp = []
    for seg in segs:
        for w in seg.words:
            cs = norm(w.word)
            for i, c in enumerate(cs):
                d = (w.end - w.start) / len(cs)
                hyp.append((c, w.start + i * d, w.start + (i + 1) * d))
    ref, owner = [], []
    for n in SCREEN0:
        for c in norm(TEXTS[n]):
            ref.append(c)
            owner.append(n)
    t_of: dict[int, tuple[float, float]] = {}
    for blk in difflib.SequenceMatcher(None, ref, [h[0] for h in hyp], autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            t_of[blk.a + k] = hyp[blk.b + k][1:]
    print(f"  对齐：原文 {len(ref)} 字，转写 {len(hyp)} 字，对上 {len(t_of)} 字", flush=True)

    # 每拍的最后一个对上的字结束、下一拍第一个对上的字开始，在这段里找最安静的 10ms 下刀
    win = 160
    rms = np.sqrt(np.convolve(audio**2, np.ones(win) / win, mode="same"))
    cuts = [0.0]
    for n in list(SCREEN0)[:-1]:
        last = max((i for i, o in enumerate(owner) if o == n and i in t_of), default=None)
        first = min((i for i, o in enumerate(owner) if o == n + 1 and i in t_of), default=None)
        if last is None or first is None:
            raise SystemExit(f"第{n}拍或第{n + 1}拍一个字也没对上，没法切")
        lo, hi = t_of[last][1] - 0.15, t_of[first][0] + 0.15
        a, b = int(max(lo, cuts[-1] + 0.1) * 16000), int(hi * 16000)
        cuts.append((a + int(np.argmin(rms[a:b]))) / 16000 if b > a else (lo + hi) / 2)
    cuts.append(len(audio) / 16000)

    cut_dir = OUT / "audio/screen0-cut"
    cut_dir.mkdir(parents=True, exist_ok=True)
    pieces, report = [], []
    for k, n in enumerate(SCREEN0):
        p = cut_dir / f"b{n:03d}.mp3"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ss", f"{cuts[k]:.3f}", "-to", f"{cuts[k + 1]:.3f}", "-b:a", "128k", str(p)], check=True)
        pieces.append(p)
        got = norm("".join(s.text for s in model.transcribe(pcm(p), language="zh", initial_prompt="以下是普通话的句子。")[0]))
        want = norm(TEXTS[n])
        cer = 1 - difflib.SequenceMatcher(None, want, got, autojunk=False).ratio()
        report.append({"beat": n, "start": round(cuts[k], 3), "end": round(cuts[k + 1], 3), "cer": round(cer, 2), "asr": got})
        print(f"  第{n:2d}拍 {cuts[k]:6.2f}–{cuts[k + 1]:6.2f}s 差异 {cer:.2f}  {got}", flush=True)

    gaps = player_gaps()
    g = [gaps.get(n, 0.25) for n in SCREEN0]
    per_beat = [YUNXI / f"b{n:03d}.mp3" for n in SCREEN0]  # 播放器现在的逐拍配音（fish + 词表）
    res = {}
    join_with_gaps(per_beat, g, OUT / "audio/fish-s2.1/s0-perbeat.mp3")
    join_with_gaps(pieces, g, OUT / "audio/fish-s2.1/s0-cut.mp3")
    (OUT / "audio/fish-s2.1/s0-raw.mp3").write_bytes(src.read_bytes())
    for k in ("s0-perbeat", "s0-cut", "s0-raw"):
        res[k] = {"dur": duration(OUT / f"audio/fish-s2.1/{k}.mp3")}
    mf_path = OUT / "manifest.json"
    manifest = json.loads(mf_path.read_text("utf-8"))
    manifest["items"] = items()
    manifest["results"]["fish-s2.1"].update(res)
    manifest["screen_cut"] = report
    mf_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
    page(manifest)
    print({k: v["dur"] for k, v in res.items()})


# ───────── 盲听页 ─────────

PAGE = """<!doctype html><html lang="zh"><meta charset="utf-8"><title>配音盲听对比</title>
<style>
body{font:15px/1.6 system-ui,'Microsoft YaHei',sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#222}
h1{font-size:22px}h2{font-size:17px;margin:28px 0 6px;border-top:1px solid #ddd;padding-top:14px}
.text{background:#f5f5f2;padding:6px 10px;border-radius:6px}.pin{color:#b5462b;font-size:13px}
table{border-collapse:collapse;width:100%;margin-top:6px}td,th{padding:4px 6px;border-bottom:1px solid #eee;text-align:left;font-size:13px}
audio{height:30px;width:260px}select{font-size:13px}.who{display:none;color:#555}.reveal .who{display:inline}
.bar{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #ddd;z-index:1}
button{font-size:14px;padding:4px 12px;margin-right:8px}.err{color:#999}
</style>
<h1>配音盲听对比（2.1 难句）</h1>
<p>同一句下面的 A、B、C… 每组顺序都打乱了。先盲听打分再点"揭晓"。分数存在本机浏览器里。
重点听：<b>多音字</b>（红字标出）、<b>c、a、t 是否逐个字母念</b>、<b>半句结尾的语调</b>（逗号、冒号结尾的句子不该读成收尾）、<b>漂移组三次是不是同一个人</b>。</p>
<div class="bar"><button onclick="document.body.classList.toggle('reveal')">揭晓 / 隐藏</button>
<button onclick="exportScores()">导出评分 json</button><button onclick="summary()">按配置汇总平均分</button><span id="sum"></span></div>
<div id="root"></div>
<script>
const DATA = __DATA__;
const KEY = 'tts-ab-scores';
const scores = JSON.parse(localStorage.getItem(KEY) || '{}');
const DIMS = ['清晰', '读音', '语调', '喜好'];
const root = document.getElementById('root');
for (const g of DATA.groups) {
  const h = document.createElement('h2'); h.textContent = g.title; root.append(h);
  for (const it of g.items) {
    const p = document.createElement('div');
    p.innerHTML = `<div class="text">${it.note ? '<b>' + it.note + '</b>　' : ''}${it.text}</div>` + (it.pin ? `<div class="pin">注意读音：${it.pin}</div>` : '');
    const t = document.createElement('table');
    t.innerHTML = '<tr><th>版本</th><th>音频</th><th>时长</th>' + DIMS.map(d => `<th>${d}</th>`).join('') + '</tr>';
    it.takes.forEach((tk, i) => {
      const tr = document.createElement('tr');
      const letter = String.fromCharCode(65 + i);
      let cells = `<td>${letter} <span class="who">${tk.label}</span></td>`;
      if (tk.error) cells += `<td colspan="${2 + DIMS.length}" class="err">失败：${tk.error}</td>`;
      else {
        cells += `<td><audio controls preload="none" src="${tk.src}"></audio></td><td>${tk.dur.toFixed(1)}s</td>`;
        for (const d of DIMS) {
          const k = `${it.id}|${tk.cfg}|${d}`;
          cells += `<td><select data-k="${k}"><option></option>${[1,2,3,4,5].map(v => `<option${scores[k] == v ? ' selected' : ''}>${v}</option>`).join('')}</select></td>`;
        }
      }
      tr.innerHTML = cells; t.append(tr);
    });
    p.append(t); root.append(p);
  }
}
root.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; scores[k] = +e.target.value || undefined; localStorage.setItem(KEY, JSON.stringify(scores)); });
function exportScores() {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(scores, null, 1)], {type: 'application/json'}));
  a.download = 'tts-ab-scores.json'; a.click();
}
function summary() {
  const acc = {};
  for (const [k, v] of Object.entries(scores)) { if (!v) continue; const [, cfg, d] = k.split('|'); (acc[cfg] ??= {}); (acc[cfg][d] ??= []).push(v); }
  document.getElementById('sum').textContent = Object.entries(acc).map(([c, ds]) =>
    DATA.labels[c] + '：' + Object.entries(ds).map(([d, a]) => d + (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)).join(' ')).join('　|　') || '还没有打分';
}
</script></html>
"""


def page(manifest: dict) -> None:
    rng = random.Random(20261013)  # 固定种子：重新生成时顺序不变，打过的分仍对得上
    groups: dict[str, list] = {}
    for it in manifest["items"]:
        takes = []
        for cfg in CONFIGS:
            r = manifest["results"].get(cfg, {}).get(it["id"])
            if not r:
                continue
            if r.get("error"):
                takes.append({"cfg": cfg, "label": CONFIGS[cfg]["label"], "error": r["error"][:120]})
            else:
                takes.append({"cfg": cfg, "label": r.get("label", CONFIGS[cfg]["label"]), "src": f"audio/{cfg}/{it['id']}.mp3", "dur": r["dur"]})
        rng.shuffle(takes)
        pins = "、".join(f"{w}（{' '.join(py)}）" for w, py, _ in annot_hits(it["text"]))
        if it.get("local") and takes:
            # 三种做法放进同一组里盲听：揭晓时显示做法
            g = groups.setdefault(it["group"], [])
            if not g:
                g.append({"id": "s0-methods", "text": html.escape(it["text"]), "note": "", "pin": pins, "takes": []})
            g[0]["takes"] += [{**t, "cfg": it["id"], "label": it["method"]} for t in takes]
            rng.shuffle(g[0]["takes"])
            continue
        groups.setdefault(it["group"], []).append({"id": it["id"], "text": html.escape(it["text"]), "note": it.get("note", ""), "pin": pins, "takes": takes})
    data = {"labels": manifest["configs"], "groups": [{"title": k, "items": v} for k, v in groups.items()]}
    (OUT / "index.html").write_text(PAGE.replace("__DATA__", json.dumps(data, ensure_ascii=False)), "utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    if sys.argv[1:2] == ["screen-cut"]:
        screen_cut()
        raise SystemExit
    m = run(sys.argv[1:])
    page(m)
    print(f"盲听页：{(OUT / 'index.html').as_posix()}")
