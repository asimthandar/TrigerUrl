#!/usr/bin/env python3
"""
BERLIN X PANEL — Telegram Pro Control Bot (v8, category-aware).

MODES
─────
🎲 Random   — generates pattern-based Firebase project names
🧬 Mutation — takes seed URLs, mutates them (category-aware)
📄 Upload   — send .txt to queue bulk job
🤖 Live     — follow jobs with live-editing messages

FEATURES
────────
• Multi-user safe (per-user locks + callback dedup)
• Category-aware random/mutation (7 real-world patterns)
• Auto-persist (survives restart)
• Instant valid-URL alerts + 30-min .txt reports
• Full inline-keyboard UI
• 8 background workers
• Secrets never logged, never echoed to Telegram
"""
from __future__ import annotations

import io
import json
import os
import random
import re
import shutil
import signal
import string
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import deque, OrderedDict
from dataclasses import dataclass, field
from typing import Any, Callable, Deque, Dict, List, Optional, Tuple

# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════

BOT_TOKEN      = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
ADMIN_CHAT_ID  = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
PANEL_BASE     = os.environ.get("TELEGRAM_PANEL_BASE", "http://127.0.0.1:10000").rstrip("/")

# Extra allowed chats (comma-separated, optional)
_EXTRA_CHATS = os.environ.get("TELEGRAM_EXTRA_CHAT_IDS", "").strip()
ALLOWED_CHATS = {ADMIN_CHAT_ID} | {c.strip() for c in _EXTRA_CHATS.split(",") if c.strip()}
ALLOWED_CHATS.discard("")

# Timing
REPORT_INTERVAL    = max(60, int(os.environ.get("TELEGRAM_REPORT_INTERVAL", "1800")))
POLL_TIMEOUT       = max(5, min(50, int(os.environ.get("TELEGRAM_POLL_TIMEOUT", "25"))))
LIVE_REFRESH_SEC   = max(3, int(os.environ.get("TELEGRAM_LIVE_REFRESH", "6")))
AUTOSAVE_SEC       = max(15, int(os.environ.get("TELEGRAM_AUTOSAVE_SEC", "30")))

# Limits
MAX_UPLOAD_BYTES   = int(os.environ.get("TELEGRAM_MAX_UPLOAD", "2000000"))
LOG_LEVEL          = os.environ.get("TELEGRAM_LOG_LEVEL", "INFO").upper()

# URL notifier
NOTIFY_ACTIVE_URLS = os.environ.get("TELEGRAM_NOTIFY_ACTIVE_URLS", "1") == "1"
NOTIFY_INSTANT     = os.environ.get("TELEGRAM_URL_INSTANT", "1") == "1"
NOTIFY_BATCH_WIN   = max(0, int(os.environ.get("TELEGRAM_URL_BATCH_WINDOW", "3")))
NOTIFY_MAX_BATCH   = max(1, int(os.environ.get("TELEGRAM_URL_BATCH_MAX", "10")))
NOTIFY_DEDUP_TTL   = max(60, int(os.environ.get("TELEGRAM_URL_DEDUP_TTL", "86400")))
NOTIFY_INC_META    = os.environ.get("TELEGRAM_URL_INCLUDE_META", "1") == "1"

# Variant expansion
AUTO_VARIANTS      = os.environ.get("TELEGRAM_AUTO_VARIANTS", "1") == "1"
VARIANTS_MAX       = max(1, min(20, int(os.environ.get("TELEGRAM_VARIANTS_MAX", "6"))))

# Loop timing
LOOP_DELAY         = max(3, int(os.environ.get("TELEGRAM_LOOP_DELAY", "6")))
LOOP_BATCH_SIZE    = max(5, min(100, int(os.environ.get("TELEGRAM_LOOP_BATCH", "20"))))

# 30-min report
URL_REPORT_ENABLED = os.environ.get("TELEGRAM_URL_REPORT_ENABLED", "1") == "1"
URL_REPORT_MAX     = max(100, int(os.environ.get("TELEGRAM_URL_REPORT_MAX", "20000")))
URL_REPORT_WINDOW  = max(60, int(os.environ.get("TELEGRAM_URL_REPORT_WINDOW", "1800")))

# ═══════════════════════════════════════════════════════════════════
# DIRECTORY SETUP (robust — falls back to /tmp)
# ═══════════════════════════════════════════════════════════════════

def _ensure_dir(path: str) -> str:
    try:
        os.makedirs(path, exist_ok=True)
        test = os.path.join(path, ".wtest")
        with open(test, "w") as f: f.write("ok")
        os.remove(test)
        return path
    except Exception as exc:
        fallback = os.path.join(tempfile.gettempdir(), "berlinx-tg")
        try:
            os.makedirs(fallback, exist_ok=True)
            print(f"[TG/WARN] cannot use {path} ({type(exc).__name__}); using {fallback}",
                  flush=True)
            return fallback
        except Exception:
            return tempfile.gettempdir()

STATE_DIR  = _ensure_dir(os.environ.get("TELEGRAM_STATE_DIR",
                        os.path.join(tempfile.gettempdir(), "berlinx-tg")))
REPORT_DIR = _ensure_dir(os.environ.get("TELEGRAM_URL_REPORT_DIR",
                        os.path.join(STATE_DIR, "reports")))

STATE_FILE   = os.path.join(STATE_DIR, "state.json")
DEDUP_FILE   = os.path.join(STATE_DIR, "dedup.json")
HISTORY_FILE = os.path.join(STATE_DIR, "url_history.json")
AUTO_FILE    = os.path.join(STATE_DIR, "auto_session.json")
MUT_FILE     = os.path.join(STATE_DIR, "mut_session.json")
# ═══════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════

_LEVELS = {"DEBUG": 10, "INFO": 20, "WARN": 30, "ERROR": 40}
_log_buffer: Deque[str] = deque(maxlen=300)

def log(message: str, level: str = "INFO") -> None:
    if _LEVELS.get(level, 20) < _LEVELS.get(LOG_LEVEL, 20):
        return
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [TG/{level}] {message}"
    print(line, flush=True)
    _log_buffer.append(line)

def log_exc(prefix: str) -> None:
    log(f"{prefix}: {traceback.format_exc().splitlines()[-1]}", "ERROR")

# ═══════════════════════════════════════════════════════════════════
# STATE
# ═══════════════════════════════════════════════════════════════════

@dataclass
class BotState:
    running: bool = True
    started_at: float = field(default_factory=time.time)
    offset: int = 0
    stats_msgs: int = 0
    stats_jobs_queued: int = 0
    stats_urls_notified: int = 0
    stats_reports_sent: int = 0

    last_report: float = 0.0
    report_lock: threading.Lock = field(default_factory=threading.Lock)

    # Live job subscriptions
    live_jobs: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    live_lock: threading.Lock = field(default_factory=threading.Lock)

    # Per-user command locks
    user_locks: Dict[str, threading.Lock] = field(default_factory=dict)
    user_locks_lock: threading.Lock = field(default_factory=threading.Lock)

    # Callback dedup
    seen_callbacks: "OrderedDict[str, float]" = field(default_factory=OrderedDict)
    callback_lock: threading.Lock = field(default_factory=threading.Lock)

    # Rate limit
    rate: Dict[str, Deque[float]] = field(default_factory=dict)
    rate_lock: threading.Lock = field(default_factory=threading.Lock)

    # URL notifier
    url_seen: Dict[str, float] = field(default_factory=dict)
    url_queue: List[Dict[str, Any]] = field(default_factory=list)
    url_history: List[Dict[str, Any]] = field(default_factory=list)
    url_lock: threading.Lock = field(default_factory=threading.Lock)
    url_flush_evt: threading.Event = field(default_factory=threading.Event)

    # ── RANDOM MODE ──
    rnd_enabled: bool = False
    rnd_chat_id: Optional[str] = None
    rnd_started_at: float = 0.0
    rnd_batches: int = 0
    rnd_found: int = 0
    rnd_last: Optional[str] = None
    rnd_lock: threading.Lock = field(default_factory=threading.Lock)
    rnd_wake: threading.Event = field(default_factory=threading.Event)
    rnd_stats_checks: int = 0

    # ── MUTATION MODE ──
    mut_enabled: bool = False
    mut_chat_id: Optional[str] = None
    mut_seeds: List[Dict[str, Any]] = field(default_factory=list)
    mut_index: int = 0
    mut_started_at: float = 0.0
    mut_batches: int = 0
    mut_found: int = 0
    mut_last: Optional[str] = None
    mut_lock: threading.Lock = field(default_factory=threading.Lock)
    mut_wake: threading.Event = field(default_factory=threading.Event)
    mut_stats_checks: int = 0

    # Awaiting input state (chat_id -> expiry)
    await_random: Dict[str, float] = field(default_factory=dict)
    await_mut: Dict[str, float] = field(default_factory=dict)

    # Custom commands
    custom: Dict[str, Callable[[str, List[str]], None]] = field(default_factory=dict)
    custom_lock: threading.Lock = field(default_factory=threading.Lock)

STATE = BotState()

# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def enabled() -> bool:
    return bool(BOT_TOKEN and ADMIN_CHAT_ID)

def is_allowed(chat_id: str) -> bool:
    return chat_id in ALLOWED_CHATS

def _now() -> float:
    return time.time()

def _safe_int(v: Any, default: int = 0) -> int:
    try: return int(v)
    except (TypeError, ValueError): return default

def _safe_float(v: Any, default: float = 0.0) -> float:
    try: return float(v)
    except (TypeError, ValueError): return default

def _esc(text: Any) -> str:
    return (str(text).replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;"))

def _human_dur(seconds: float) -> str:
    seconds = int(max(0, seconds))
    d, r = divmod(seconds, 86400)
    h, r = divmod(r, 3600)
    m, s = divmod(r, 60)
    parts = []
    if d: parts.append(f"{d}d")
    if h: parts.append(f"{h}h")
    if m: parts.append(f"{m}m")
    if s or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def _human_bytes(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024: return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}PB"

# ═══════════════════════════════════════════════════════════════════
# PERSISTENCE
# ═══════════════════════════════════════════════════════════════════

def _atomic_write(path: str, data: Any) -> None:
    parent = os.path.dirname(path)
    if parent:
        try: os.makedirs(parent, exist_ok=True)
        except Exception: pass
    tmp = path + ".tmp"
    try:
        with open(tmp, "w") as f: json.dump(data, f)
        os.replace(tmp, path)
    except Exception:
        try:
            if os.path.exists(tmp): os.remove(tmp)
        except Exception: pass
        raise

def _save_state() -> None:
    try:
        _atomic_write(STATE_FILE, {
            "offset": STATE.offset,
            "stats_msgs": STATE.stats_msgs,
            "stats_jobs_queued": STATE.stats_jobs_queued,
            "stats_urls_notified": STATE.stats_urls_notified,
            "stats_reports_sent": STATE.stats_reports_sent,
            "rnd_stats_checks": STATE.rnd_stats_checks,
            "mut_stats_checks": STATE.mut_stats_checks,
        })
    except Exception: log_exc("save_state")

def _load_state() -> None:
    try:
        with open(STATE_FILE) as f: d = json.load(f)
        STATE.offset = _safe_int(d.get("offset"))
        STATE.stats_msgs = _safe_int(d.get("stats_msgs"))
        STATE.stats_jobs_queued = _safe_int(d.get("stats_jobs_queued"))
        STATE.stats_urls_notified = _safe_int(d.get("stats_urls_notified"))
        STATE.stats_reports_sent = _safe_int(d.get("stats_reports_sent"))
        STATE.rnd_stats_checks = _safe_int(d.get("rnd_stats_checks"))
        STATE.mut_stats_checks = _safe_int(d.get("mut_stats_checks"))
        log(f"state loaded (offset={STATE.offset})")
    except FileNotFoundError: pass
    except Exception as exc: log(f"load_state: {type(exc).__name__}", "WARN")

def _save_dedup() -> None:
    try:
        with STATE.url_lock: data = dict(STATE.url_seen)
        _atomic_write(DEDUP_FILE, data)
    except Exception: log_exc("save_dedup")

def _load_dedup() -> None:
    try:
        with open(DEDUP_FILE) as f: data = json.load(f)
        now = _now()
        with STATE.url_lock:
            STATE.url_seen = {k: _safe_float(v) for k, v in data.items()
                              if now - _safe_float(v) < NOTIFY_DEDUP_TTL}
        log(f"dedup loaded ({len(STATE.url_seen)} entries)")
    except FileNotFoundError: pass
    except Exception as exc: log(f"load_dedup: {type(exc).__name__}", "WARN")

def _save_history() -> None:
    try:
        with STATE.url_lock: data = list(STATE.url_history[-URL_REPORT_MAX:])
        _atomic_write(HISTORY_FILE, data)
    except Exception: log_exc("save_history")

def _load_history() -> None:
    try:
        with open(HISTORY_FILE) as f: data = json.load(f)
        now = _now()
        with STATE.url_lock:
            STATE.url_history = [it for it in data
                if now - _safe_float(it.get("ts", 0)) < URL_REPORT_WINDOW * 2]
        log(f"history loaded ({len(STATE.url_history)} entries)")
    except FileNotFoundError: pass
    except Exception as exc: log(f"load_history: {type(exc).__name__}", "WARN")

def _save_random() -> None:
    try:
        with STATE.rnd_lock:
            _atomic_write(AUTO_FILE, {
                "enabled": STATE.rnd_enabled,
                "chat_id": STATE.rnd_chat_id,
                "started_at": STATE.rnd_started_at,
                "batches": STATE.rnd_batches,
                "found": STATE.rnd_found,
                "last": STATE.rnd_last,
            })
    except Exception: log_exc("save_random")

def _load_random() -> None:
    try:
        with open(AUTO_FILE) as f: d = json.load(f)
        with STATE.rnd_lock:
            STATE.rnd_enabled = bool(d.get("enabled"))
            STATE.rnd_chat_id = d.get("chat_id")
            STATE.rnd_started_at = _safe_float(d.get("started_at"))
            STATE.rnd_batches = _safe_int(d.get("batches"))
            STATE.rnd_found = _safe_int(d.get("found"))
            STATE.rnd_last = d.get("last")
        if STATE.rnd_enabled:
            log(f"random session restored (batches={STATE.rnd_batches})")
    except FileNotFoundError: pass
    except Exception as exc: log(f"load_random: {type(exc).__name__}", "WARN")

def _save_mutation() -> None:
    try:
        with STATE.mut_lock:
            _atomic_write(MUT_FILE, {
                "enabled": STATE.mut_enabled,
                "chat_id": STATE.mut_chat_id,
                "seeds": STATE.mut_seeds,
                "index": STATE.mut_index,
                "started_at": STATE.mut_started_at,
                "batches": STATE.mut_batches,
                "found": STATE.mut_found,
                "last": STATE.mut_last,
            })
    except Exception: log_exc("save_mutation")

def _load_mutation() -> None:
    try:
        with open(MUT_FILE) as f: d = json.load(f)
        with STATE.mut_lock:
            STATE.mut_enabled = bool(d.get("enabled"))
            STATE.mut_chat_id = d.get("chat_id")
            STATE.mut_seeds = d.get("seeds") or []
            STATE.mut_index = _safe_int(d.get("index"))
            STATE.mut_started_at = _safe_float(d.get("started_at"))
            STATE.mut_batches = _safe_int(d.get("batches"))
            STATE.mut_found = _safe_int(d.get("found"))
            STATE.mut_last = d.get("last")
        if STATE.mut_enabled:
            log(f"mutation session restored ({len(STATE.mut_seeds)} seeds)")
    except FileNotFoundError: pass
    except Exception as exc: log(f"load_mutation: {type(exc).__name__}", "WARN")

def _autosave_loop() -> None:
    while STATE.running and enabled():
        time.sleep(AUTOSAVE_SEC)
        try:
            _save_state(); _save_dedup(); _save_history()
            _save_random(); _save_mutation()
        except Exception: log_exc("autosave_loop")
# ═══════════════════════════════════════════════════════════════════
# RATE LIMIT
# ═══════════════════════════════════════════════════════════════════

def rate_ok(chat_id: str, max_events: int = 30, window: float = 5.0) -> bool:
    now = _now()
    with STATE.rate_lock:
        dq = STATE.rate.setdefault(chat_id, deque())
        while dq and now - dq[0] > window:
            dq.popleft()
        if len(dq) >= max_events:
            return False
        dq.append(now)
        return True

# ═══════════════════════════════════════════════════════════════════
# PER-USER LOCK (multi-user safe)
# ═══════════════════════════════════════════════════════════════════

def user_lock(chat_id: str) -> threading.Lock:
    with STATE.user_locks_lock:
        lock = STATE.user_locks.get(chat_id)
        if lock is None:
            lock = threading.Lock()
            STATE.user_locks[chat_id] = lock
        return lock

# ═══════════════════════════════════════════════════════════════════
# CALLBACK DEDUP (button-spam guard)
# ═══════════════════════════════════════════════════════════════════

CALLBACK_DEDUP_TTL = 2.0

def callback_is_dup(cb_id: str) -> bool:
    now = _now()
    with STATE.callback_lock:
        while STATE.seen_callbacks:
            k, t = next(iter(STATE.seen_callbacks.items()))
            if now - t > CALLBACK_DEDUP_TTL:
                STATE.seen_callbacks.popitem(last=False)
            else:
                break
        if cb_id in STATE.seen_callbacks:
            return True
        STATE.seen_callbacks[cb_id] = now
        while len(STATE.seen_callbacks) > 500:
            STATE.seen_callbacks.popitem(last=False)
    return False

# ═══════════════════════════════════════════════════════════════════
# TELEGRAM API (retry + backoff + multipart)
# ═══════════════════════════════════════════════════════════════════

def _api_raw(method: str, params: Optional[dict], files: Optional[dict],
             timeout: int, retries: int) -> Optional[dict]:
    if not BOT_TOKEN:
        return None
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    last_exc = None
    for attempt in range(retries):
        try:
            if files:
                boundary = "----berlinx" + uuid.uuid4().hex
                body = io.BytesIO()
                for k, v in (params or {}).items():
                    body.write(f"--{boundary}\r\n".encode())
                    body.write(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
                    body.write(str(v).encode())
                    body.write(b"\r\n")
                for k, (fname, fdata) in files.items():
                    body.write(f"--{boundary}\r\n".encode())
                    body.write(
                        f'Content-Disposition: form-data; name="{k}"; '
                        f'filename="{fname}"\r\n'.encode()
                    )
                    body.write(b"Content-Type: application/octet-stream\r\n\r\n")
                    body.write(fdata)
                    body.write(b"\r\n")
                body.write(f"--{boundary}--\r\n".encode())
                req = urllib.request.Request(url, data=body.getvalue(), method="POST")
                req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
            else:
                data = urllib.parse.urlencode(params or {}).encode()
                req = urllib.request.Request(url, data=data, method="POST")
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_exc = exc
            if exc.code == 400:
                return None
            if exc.code in (429, 500, 502, 503, 504):
                time.sleep(min(2 ** attempt, 8))
                continue
            log(f"{method} HTTP {exc.code}", "WARN")
            return None
        except Exception as exc:
            last_exc = exc
            time.sleep(min(2 ** attempt, 8))
    log(f"{method} failed: {type(last_exc).__name__}", "ERROR")
    return None

def api(method: str, params: Optional[dict] = None,
        timeout: int = 35, retries: int = 3) -> Optional[dict]:
    return _api_raw(method, params, None, timeout, retries)

def send_message(text: str, chat_id: Optional[str] = None,
                 reply_markup: Optional[dict] = None,
                 parse_mode: Optional[str] = "HTML",
                 disable_notification: bool = False) -> Optional[int]:
    if not enabled(): return None
    target = chat_id or ADMIN_CHAT_ID
    payload: Dict[str, Any] = {
        "chat_id": target, "text": text,
        "disable_web_page_preview": "true",
        "disable_notification": "true" if disable_notification else "false",
    }
    if parse_mode: payload["parse_mode"] = parse_mode
    if reply_markup: payload["reply_markup"] = json.dumps(reply_markup)
    res = api("sendMessage", payload)
    if res and res.get("ok"):
        STATE.stats_msgs += 1
        return _safe_int((res.get("result") or {}).get("message_id"))
    return None

def send_document(filename: str, content: bytes, caption: str = "",
                  chat_id: Optional[str] = None,
                  parse_mode: Optional[str] = "HTML",
                  reply_markup: Optional[dict] = None) -> Optional[int]:
    if not enabled(): return None
    target = chat_id or ADMIN_CHAT_ID
    params: Dict[str, Any] = {"chat_id": target, "disable_notification": "true"}
    if caption: params["caption"] = caption[:1000]
    if parse_mode: params["parse_mode"] = parse_mode
    if reply_markup: params["reply_markup"] = json.dumps(reply_markup)
    files = {"document": (filename, content)}
    res = _api_raw("sendDocument", params, files, timeout=90, retries=2)
    if res and res.get("ok"):
        STATE.stats_msgs += 1
        return _safe_int((res.get("result") or {}).get("message_id"))
    return None

def edit_message(chat_id: str, message_id: int, text: str,
                 reply_markup: Optional[dict] = None,
                 parse_mode: Optional[str] = "HTML") -> bool:
    if not enabled() or not message_id: return False
    payload: Dict[str, Any] = {
        "chat_id": chat_id, "message_id": message_id, "text": text,
        "disable_web_page_preview": "true",
    }
    if parse_mode: payload["parse_mode"] = parse_mode
    if reply_markup: payload["reply_markup"] = json.dumps(reply_markup)
    res = api("editMessageText", payload)
    return bool(res and res.get("ok"))

def answer_callback(callback_id: str, text: str = "", alert: bool = False) -> None:
    if not callback_id: return
    api("answerCallbackQuery", {
        "callback_query_id": callback_id,
        "text": text[:200],
        "show_alert": "true" if alert else "false",
    })
# ═══════════════════════════════════════════════════════════════════
# PANEL API
# ═══════════════════════════════════════════════════════════════════

def _panel_request(path: str, payload: Optional[dict], method: str,
                   timeout: int = 20) -> Optional[dict]:
    try:
        if payload is None:
            req = urllib.request.Request(PANEL_BASE + path,
                                         headers={"Accept": "application/json"},
                                         method=method)
        else:
            raw = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                PANEL_BASE + path, data=raw, method=method,
                headers={"Content-Type": "application/json",
                         "Accept": "application/json"},
            )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        log(f"panel {method} {path}: {type(exc).__name__}", "WARN")
        return None

def panel_json(path: str, timeout: int = 20) -> Optional[dict]:
    return _panel_request(path, None, "GET", timeout)

def panel_post(path: str, payload: dict, timeout: int = 30) -> Optional[dict]:
    return _panel_request(path, payload, "POST", timeout)

def panel_get_job(token: str) -> Optional[dict]:
    return panel_json("/api/public-bulk/jobs/" + urllib.parse.quote(token, safe=""))

def panel_health() -> bool:
    for path in ("/health", "/api/health", "/"):
        if panel_json(path, timeout=5) is not None:
            return True
    return False

def queue_bulk_job(filename: str, urls: List[str], secret: Optional[str] = None) -> Optional[dict]:
    """Submit a bulk job to the panel."""
    if secret:
        content = "\n".join(f"{u},{secret}" for u in urls)
    else:
        content = "\n".join(urls)
    return panel_post("/api/public-bulk/jobs",
                      {"filename": filename, "content": content})

# ═══════════════════════════════════════════════════════════════════
# PROJECT NAME EXTRACTION
# ═══════════════════════════════════════════════════════════════════

_KNOWN_REGIONS = {
    "us-central1", "us-east1", "us-west1",
    "europe-west1", "europe-west2", "europe-west3",
    "asia-southeast1", "asia-southeast2", "asia-east1", "asia-south1",
    "southamerica-east1", "australia-southeast1",
}

def extract_project_name(url_or_host: str) -> Optional[str]:
    """
    Extract Firebase project id from any pattern.
      https://<proj>-default-rtdb.firebaseio.com                -> <proj>
      https://<proj>-default-rtdb.firebasedatabase.app          -> <proj>
      https://<proj>-default-rtdb.<region>.firebasedatabase.app -> <proj>
      https://<proj>.firebaseio.com                             -> <proj>
      <proj>                                                     -> <proj>
    """
    s = (url_or_host or "").strip()
    if not s: return None
    if s.startswith("http://") or s.startswith("https://"):
        try:
            host = (urllib.parse.urlsplit(s).hostname or "").lower().rstrip(".")
        except Exception:
            return None
    else:
        host = s.lower().rstrip(".")
    host = host.split("/")[0].split(":")[0]
    if not host: return None

    # legacy root: <project>.firebaseio.com
    if host.endswith(".firebaseio.com"):
        prefix = host[:-len(".firebaseio.com")]
        if prefix.endswith("-default-rtdb"):
            return prefix[:-len("-default-rtdb")]
        return prefix

    # <project>-default-rtdb[.<region>].firebasedatabase.app
    if host.endswith(".firebasedatabase.app"):
        prefix = host[:-len(".firebasedatabase.app")]
        parts = prefix.split(".")
        if len(parts) >= 2 and parts[-1] in _KNOWN_REGIONS:
            prefix = ".".join(parts[:-1])
        if prefix.endswith("-default-rtdb"):
            return prefix[:-len("-default-rtdb")]
        return prefix

    # bare project name
    if re.match(r"^[a-z0-9][a-z0-9-]{1,60}$", host):
        return host
    return None

# ═══════════════════════════════════════════════════════════════════
# VARIANT ENGINE (only -default-rtdb family — user requested)
# ═══════════════════════════════════════════════════════════════════

def expand_url_variants(project: str) -> List[str]:
    """
    Only return <project>-default-rtdb.firebaseio.com (as user requested).
    No regional/new-domain variants.
    """
    if not project:
        return []
    return [f"https://{project}-default-rtdb.firebaseio.com"]
# ═══════════════════════════════════════════════════════════════════
# 🎯 CATEGORY POOLS (from real-world Firebase project patterns)
# ═══════════════════════════════════════════════════════════════════

_CHARS = string.ascii_lowercase + string.digits

_NAME_POOL = [
    # Indian names (huge frequency in Firebase projects)
    "rahul", "ajay", "amit", "hamza", "rohit", "vikash", "sanjay",
    "deepak", "pooja", "neha", "priya", "anjali", "kiran", "arjun",
    "aditi", "riya", "sonu", "monu", "lucky", "raja", "rani", "king",
    "queen", "sima", "krishna", "ram", "shyam", "gopal", "sunil",
    "manoj", "suresh", "mahesh", "dinesh", "mukesh", "rakesh",
    "abhi", "sumit", "ankit", "vishal", "sagar", "sahil", "nisha",
    "kavita", "sangeeta", "rekha", "asha", "meena", "shanti", "lata",
    "neeraj", "vijay", "ajit", "arvind", "jayesh", "naresh",
]

_ADMIN_POOL = [
    "admin", "panel", "pannel", "master", "owner", "super", "boss",
    "star", "hero", "legend", "royal", "gold", "silver", "chief",
]

_APP_WORD_POOL = [
    "app", "myapp", "test", "demo", "clone", "download", "pro",
    "mod", "hd", "vip", "premium", "play", "game", "store", "shop",
    "free", "live", "smart", "quick", "fast",
]

_EVENT_POOL = [
    "turnament", "tournament", "match", "league", "cup", "series",
    "event", "arena", "clash", "war", "battle", "championship",
]

_NUMBERED_PREFIX_POOL = [
    "panel", "admin", "app", "test", "project", "user", "main",
    "master", "pannel", "dashboard",
]

# ── helper randomizers ──

def _random_hash_len5() -> str:
    return "".join(random.choice(_CHARS) for _ in range(5))

def _random_hash_len6() -> str:
    return "".join(random.choice(_CHARS) for _ in range(6))

def _random_number_1_999() -> str:
    return str(random.randint(1, 999))

def _random_custom_name(min_len: int = 4, max_len: int = 12) -> str:
    length = random.randint(min_len, max_len)
    return "".join(random.choice(string.ascii_lowercase) for _ in range(length))

# ═══════════════════════════════════════════════════════════════════
# 🎲 RANDOM PROJECT GENERATOR (category-aware)
# ═══════════════════════════════════════════════════════════════════

def generate_random_projects(count: int = 20) -> List[str]:
    """
    Generate `count` projects using real-world Firebase naming patterns.
    Categories weighted by observed frequency.
    """
    out, seen = [], set()
    attempts = 0
    max_attempts = count * 10

    while len(out) < count and attempts < max_attempts:
        attempts += 1
        category = random.choices(
            ["personal_hash", "admin_panel", "app_word",
             "event", "custom", "gibberish", "numbered"],
            weights=[30, 25, 15, 10, 10, 5, 5],
            k=1
        )[0]

        try:
            if category == "personal_hash":
                # rahul-5f16d, ajay-ae60b
                name = random.choice(_NAME_POOL)
                proj = f"{name}-{_random_hash_len5()}"

            elif category == "admin_panel":
                # admin-cliwny, panel-wala-v16, admin-panel-bfcdc
                sub = random.choice([
                    lambda: f"admin-{_random_custom_name()}",
                    lambda: f"panel-{_random_custom_name()}",
                    lambda: f"pannel-{_random_custom_name()}",
                    lambda: f"admin-{random.choice(_NAME_POOL)}-{_random_hash_len5()}",
                    lambda: f"panel-wala-v{_random_number_1_999()}",
                    lambda: f"admin-panel-{_random_hash_len5()}",
                    lambda: f"{random.choice(_NAME_POOL)}-master-panel",
                    lambda: f"admin-{random.choice(_NAME_POOL)}",
                ])
                proj = sub()

            elif category == "app_word":
                # clone-79a6f, myapp-8228a, app-2-7ac78
                word = random.choice(_APP_WORD_POOL)
                style = random.choice(["word_hash", "word_num_hash", "word_num"])
                if style == "word_hash":
                    proj = f"{word}-{_random_hash_len5()}"
                elif style == "word_num_hash":
                    proj = f"{word}-{_random_number_1_999()}-{_random_hash_len5()}"
                else:
                    proj = f"{word}-{_random_number_1_999()}"

            elif category == "event":
                # e9turnament1, e14turnament2, hospital-14
                evt = random.choice(_EVENT_POOL)
                style = random.choice(["e_n_type_n", "type_n", "type_hash"])
                if style == "e_n_type_n":
                    proj = f"e{random.randint(1, 20)}{evt}{random.randint(1, 20)}"
                elif style == "type_n":
                    proj = f"{evt}-{random.randint(1, 99)}"
                else:
                    proj = f"{evt}-{_random_hash_len5()}"

            elif category == "custom":
                # jeet-op, comkingdir, ueuwuw, singhaana
                proj = _random_custom_name(4, 15)

            elif category == "gibberish":
                # jkhsadfhjk, krijhjuiiiccyy, gsjjshdbs
                length = random.randint(8, 15)
                proj = "".join(random.choice(string.ascii_lowercase)
                               for _ in range(length))

            elif category == "numbered":
                # panel123, admin456
                prefix = random.choice(_NUMBERED_PREFIX_POOL)
                proj = f"{prefix}{random.randint(1, 9999)}"
            else:
                continue

        except Exception:
            continue

        if not re.match(r"^[a-z0-9][a-z0-9-]{1,60}$", proj):
            continue
        if proj in seen:
            continue
        seen.add(proj)
        out.append(proj)

    return out

# ═══════════════════════════════════════════════════════════════════
# 🧬 MUTATION ENGINE (category-aware)
# ═══════════════════════════════════════════════════════════════════

def _split_project(project: str) -> Tuple[str, str]:
    """Split 'name-hash' or return (project, '')."""
    if "-" in project:
        name, _, h = project.rpartition("-")
        if 1 <= len(h) <= 8:
            return name, h
    return project, ""

def _mutate_hash(h: str) -> str:
    if not h: return h
    h = list(h)
    idx = random.randint(0, len(h) - 1)
    h[idx] = random.choice(_CHARS)
    return "".join(h)

def _mutate_name(name: str) -> str:
    if not name: return name
    name = list(name)
    op = random.choice(["swap", "replace", "add", "remove"])
    try:
        if op == "swap" and len(name) >= 2:
            i = random.randint(0, len(name) - 2)
            name[i], name[i + 1] = name[i + 1], name[i]
        elif op == "replace":
            i = random.randint(0, len(name) - 1)
            name[i] = random.choice(string.ascii_lowercase)
        elif op == "add":
            name.insert(random.randint(0, len(name)), random.choice(string.ascii_lowercase))
        elif op == "remove" and len(name) > 3:
            name.pop(random.randint(0, len(name) - 1))
    except Exception:
        pass
    return "".join(name)

def generate_mutations(seed: str, count: int = 20) -> List[str]:
    """
    Category-aware mutations. Detects seed type and mutates accordingly.
    """
    name, hash_ = _split_project(seed)
    if not name:
        return []

    out, seen = [], {seed}
    is_personal = name in _NAME_POOL
    is_admin = any(k in name for k in ["admin", "panel", "pannel", "master"])
    is_app_word = any(k in name for k in _APP_WORD_POOL)
    has_hash = bool(hash_)

    for _ in range(count * 8):
        mode = random.choices(
            ["hash", "name_char", "name_suffix", "number", "combined"],
            weights=[40, 25, 15, 10, 10],
            k=1
        )[0]

        try:
            if mode == "hash":
                # rahul-5f16d -> rahul-a3b8c
                new_hash = _mutate_hash(hash_) if has_hash else _random_hash_len5()
                new_p = f"{name}-{new_hash}"

            elif mode == "name_char":
                # rahul -> rahu1 / aahul
                mutated = _mutate_name(name)
                suffix = hash_ if has_hash else _random_hash_len5()
                new_p = f"{mutated}-{suffix}"

            elif mode == "name_suffix":
                # category-specific suffix patterns
                if is_admin:
                    new_p = f"{name}-v{random.randint(1, 99)}"
                elif is_personal:
                    new_p = f"{name}{random.randint(1, 999)}"
                elif is_app_word:
                    new_p = f"{name}-{random.randint(1, 99)}"
                else:
                    new_p = f"{name}-{_random_hash_len5()}"

            elif mode == "number":
                # panel-wala-v16 -> panel-wala-v17
                m = re.match(r"^(.*?)(\d+)$", name)
                if m:
                    prefix, num = m.group(1), int(m.group(2))
                    new_num = num + random.randint(1, 20) - 10
                    if new_num < 1: new_num = 1
                    new_p = f"{prefix}{new_num}"
                    if has_hash:
                        new_p = f"{new_p}-{hash_}"
                else:
                    new_p = f"{name}-{random.randint(1, 999)}"

            else:  # combined
                mutated_name = _mutate_name(name)
                new_hash = _mutate_hash(hash_) if has_hash else _random_hash_len5()
                new_p = f"{mutated_name}-{new_hash}"

        except Exception:
            continue

        if not re.match(r"^[a-z0-9][a-z0-9-]{1,60}$", new_p):
            continue
        if new_p in seen:
            continue
        seen.add(new_p)
        out.append(new_p)
        if len(out) >= count:
            break

    return out

# ═══════════════════════════════════════════════════════════════════
# BULK CONTENT EXPANSION (for .txt uploads)
# ═══════════════════════════════════════════════════════════════════

def expand_bulk_content(content: str) -> Tuple[List[Tuple[str, Optional[str]]], int]:
    """Parse content lines -> expand to (url, secret) pairs."""
    parsed: List[Tuple[str, Optional[str]]] = []
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"): continue
        if re.match(r"^url\s*,\s*secret_key\s*$", line, re.I): continue
        secret = None
        if "," in line:
            parts = line.split(",", 1)
            line = parts[0].strip()
            secret = parts[1].strip() or None
        if not line: continue
        project = extract_project_name(line)
        if not project: continue
        parsed.append((project, secret))

    pairs, seen = [], set()
    if not AUTO_VARIANTS:
        for project, secret in parsed:
            url = f"https://{project}-default-rtdb.firebaseio.com"
            if url in seen: continue
            seen.add(url)
            pairs.append((url, secret))
    else:
        for project, secret in parsed:
            for v in expand_url_variants(project):
                if v in seen: continue
                seen.add(v)
                pairs.append((v, secret))
    return pairs, len(parsed)
# ═══════════════════════════════════════════════════════════════════
# FORMATTERS
# ═══════════════════════════════════════════════════════════════════

def _progress_bar(done: int, total: int, width: int = 16) -> str:
    if total <= 0: return "░" * width
    filled = max(0, min(width, int(width * done / total)))
    return "█" * filled + "░" * (width - filled)

def _status_emoji(status: str) -> str:
    return {
        "pending": "🕓", "processing": "⚙️", "running": "⚙️",
        "done": "✅", "completed": "✅",
        "failed": "❌", "error": "❌",
        "cancelled": "🛑", "stopped": "🛑",
    }.get((status or "").lower(), "❔")

def fmt_job(job: dict, header: str = "🤖 BERLIN X PANEL") -> str:
    total       = _safe_int(job.get("total"))
    processed   = _safe_int(job.get("processed"))
    active      = _safe_int(job.get("active"))
    no_data     = _safe_int(job.get("no_data"))
    inactive    = _safe_int(job.get("inactive"))
    unreachable = _safe_int(job.get("unreachable"))
    status      = str(job.get("status") or "unknown").lower()
    jid         = job.get("id", "?")
    pct         = int(100 * processed / total) if total else 0
    bar         = _progress_bar(processed, total)
    return (
        f"<b>{_esc(header)}</b>\n\n"
        f"{_status_emoji(status)} Job <b>#{jid}</b> — <b>{_esc(status.upper())}</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"<code>{bar}</code> {pct}%\n"
        f"Processed  : <b>{processed}</b>/{total}\n"
        f"Active     : <b>{active}</b>\n"
        f"No Data    : <b>{no_data}</b>\n"
        f"Inactive   : <b>{inactive}</b>\n"
        f"Unreachable: <b>{unreachable}</b>"
    )

def fmt_jobs_list(jobs: List[dict]) -> str:
    if not jobs:
        return "📋 <b>RECENT JOBS</b>\n\n<i>No jobs found.</i>"
    lines = ["📋 <b>RECENT JOBS</b>", ""]
    for j in jobs[:10]:
        st = str(j.get("status", "")).lower()
        lines.append(
            f"{_status_emoji(st)} <b>#{j.get('id')}</b>  "
            f"{_esc(st.upper())}  "
            f"{_safe_int(j.get('processed'))}/{_safe_int(j.get('total'))}  "
            f"act:<b>{_safe_int(j.get('active'))}</b>"
        )
    return "\n".join(lines)

def fmt_report(jobs: List[dict]) -> str:
    recent = jobs[:10]
    total_checked = sum(_safe_int(j.get("processed")) for j in recent)
    active        = sum(_safe_int(j.get("active")) for j in recent)
    no_data       = sum(_safe_int(j.get("no_data")) for j in recent)
    inactive      = sum(_safe_int(j.get("inactive")) for j in recent)
    unreachable   = sum(_safe_int(j.get("unreachable")) for j in recent)
    running       = sum(1 for j in jobs
                        if j.get("status") in {"pending", "processing", "running"})
    return (
        "📊 <b>BERLIN X PANEL — REPORT</b>\n\n"
        f"Recent jobs : <b>{len(recent)}</b>\n"
        f"Processed   : <b>{total_checked}</b>\n"
        f"Active      : <b>{active}</b>\n"
        f"No Data     : <b>{no_data}</b>\n"
        f"Inactive    : <b>{inactive}</b>\n"
        f"Unreachable : <b>{unreachable}</b>\n"
        f"Running     : <b>{running}</b>"
    )

def fmt_random_status() -> str:
    with STATE.rnd_lock:
        if not STATE.rnd_enabled:
            return "🎲 <b>RANDOM MODE</b>\n\n<i>Not running.</i>\n\nTap 🚀 Random to start."
        return (
            "🎲 <b>RANDOM MODE — RUNNING</b>\n\n"
            f"Batches : <b>{STATE.rnd_batches}</b>\n"
            f"Found   : <b>{STATE.rnd_found}</b>\n"
            f"Last    : <code>{_esc((STATE.rnd_last or '-')[:60])}</code>\n"
            f"Uptime  : <b>{_human_dur(_now() - STATE.rnd_started_at)}</b>\n\n"
            "<i>Generates category-based random project names.</i>\n"
            "Runs until server restart."
        )

def fmt_mutation_status() -> str:
    with STATE.mut_lock:
        if not STATE.mut_enabled:
            return "🧬 <b>MUTATION MODE</b>\n\n<i>Not running.</i>"
        total = len(STATE.mut_seeds)
        idx = STATE.mut_index % total if total else 0
        current = STATE.mut_seeds[idx]["project"] if total else "-"
        preview = "\n".join(
            f"  {i+1}. <code>{_esc(s['project'])}</code>"
            for i, s in enumerate(STATE.mut_seeds[:8])
        )
        more = f"\n  <i>… +{total-8} more</i>" if total > 8 else ""
        return (
            "🧬 <b>MUTATION MODE — RUNNING</b>\n\n"
            f"Seeds   : <b>{total}</b>\n"
            f"Current : <code>{_esc(current)}</code>\n"
            f"Batches : <b>{STATE.mut_batches}</b>\n"
            f"Found   : <b>{STATE.mut_found}</b>\n"
            f"Uptime  : <b>{_human_dur(_now() - STATE.mut_started_at)}</b>\n\n"
            f"<b>Seeds:</b>\n{preview}{more}\n\n"
            "<i>Category-aware mutations of project names.</i>\n"
            "Runs until server restart."
        )

# ═══════════════════════════════════════════════════════════════════
# SYSTEM STATS
# ═══════════════════════════════════════════════════════════════════

def _read_proc_stat() -> Optional[Tuple[int, int]]:
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()[1:]
        vals = [int(x) for x in parts]
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
        return sum(vals), idle
    except Exception:
        return None

def _read_meminfo() -> Optional[Tuple[int, int]]:
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                k, v = line.split(":", 1)
                info[k.strip()] = _safe_int(v.strip().split()[0])
        total = info.get("MemTotal", 0) * 1024
        avail = info.get("MemAvailable", 0) * 1024
        return total, total - avail
    except Exception:
        return None

_cpu_prev = None

def _cpu_percent() -> float:
    global _cpu_prev
    cur = _read_proc_stat()
    if not cur: return 0.0
    total, idle = cur
    if _cpu_prev:
        pt, (ptot, pidle) = _cpu_prev
        dt, di = total - ptot, idle - pidle
        if dt > 0:
            pct = 100.0 * (dt - di) / dt
            _cpu_prev = (time.time(), cur)
            return round(pct, 1)
    _cpu_prev = (time.time(), cur)
    return 0.0

def fmt_system() -> str:
    cpu = _cpu_percent()
    mem = _read_meminfo()
    try:
        du = shutil.disk_usage("/")
        disk_line = (f"Disk    : <b>{_human_bytes(du.used)}</b>/"
                     f"{_human_bytes(du.total)} "
                     f"({int(100*du.used/du.total)}%)")
    except Exception:
        disk_line = "Disk    : <i>n/a</i>"
    mem_line = "Memory  : <i>n/a</i>"
    if mem:
        total, used = mem
        mem_line = (f"Memory  : <b>{_human_bytes(used)}</b>/"
                    f"{_human_bytes(total)} ({int(100*used/total)}%)")
    return (
        "🖥 <b>SYSTEM STATS</b>\n\n"
        f"CPU     : <b>{cpu}%</b>\n"
        f"{mem_line}\n"
        f"{disk_line}\n"
        f"Threads : <b>{threading.active_count()}</b>\n"
        f"Uptime  : <b>{_human_dur(_now() - STATE.started_at)}</b>"
    )
# ═══════════════════════════════════════════════════════════════════
# KEYBOARDS
# ═══════════════════════════════════════════════════════════════════

def main_keyboard() -> dict:
    rnd_on = STATE.rnd_enabled
    mut_on = STATE.mut_enabled
    r_label = "🛑 Stop Random"   if rnd_on else "🚀 Random"
    m_label = "🛑 Stop Mutation" if mut_on else "🧬 Mutation"
    r_cb = "rnd:stop" if rnd_on else "rnd:start"
    m_cb = "mut:stop" if mut_on else "mut:start"
    return {"inline_keyboard": [
        [{"text": r_label,          "callback_data": r_cb},
         {"text": m_label,          "callback_data": m_cb}],
        [{"text": "📊 Status",      "callback_data": "cmd:status"},
         {"text": "📋 Jobs",        "callback_data": "cmd:jobs"}],
        [{"text": "🎲 Random Stats", "callback_data": "cmd:rndstatus"},
         {"text": "🧬 Mut Stats",    "callback_data": "cmd:mutstatus"}],
        [{"text": "📈 Report",      "callback_data": "cmd:report"},
         {"text": "🖥 System",      "callback_data": "cmd:system"}],
        [{"text": "🎯 URLs",        "callback_data": "cmd:urls"},
         {"text": "📄 Get .txt",    "callback_data": "cmd:geturls"}],
        [{"text": "📜 Logs",        "callback_data": "cmd:logs"},
         {"text": "🩺 Health",      "callback_data": "cmd:health"}],
        [{"text": "❓ Help",        "callback_data": "cmd:help"}],
    ]}

def job_keyboard(job_id: int, live: bool = False) -> dict:
    toggle = "⏹ Stop Live" if live else "▶️ Live"
    return {"inline_keyboard": [
        [{"text": toggle,        "callback_data": f"live:{job_id}"},
         {"text": "🔄 Refresh",  "callback_data": f"refresh:{job_id}"}],
        [{"text": "⬅️ Menu",     "callback_data": "cmd:menu"}],
    ]}

def jobs_keyboard(jobs: List[dict]) -> dict:
    rows = []
    for j in jobs[:8]:
        jid = _safe_int(j.get("id"))
        st = str(j.get("status", "")).lower()
        rows.append([{
            "text": f"{_status_emoji(st)} #{jid}  "
                    f"{_safe_int(j.get('processed'))}/{_safe_int(j.get('total'))}",
            "callback_data": f"refresh:{jid}",
        }])
    rows.append([{"text": "⬅️ Menu", "callback_data": "cmd:menu"}])
    return {"inline_keyboard": rows}

def back_keyboard() -> dict:
    return {"inline_keyboard": [[
        {"text": "⬅️ Menu", "callback_data": "cmd:menu"}
    ]]}

def loop_running_keyboard() -> dict:
    """Shown while Random or Mutation is running."""
    return {"inline_keyboard": [
        [{"text": "🛑 Stop Random",   "callback_data": "rnd:stop"},
         {"text": "🛑 Stop Mutation", "callback_data": "mut:stop"}],
        [{"text": "🎲 Random Stats",  "callback_data": "cmd:rndstatus"},
         {"text": "🧬 Mut Stats",     "callback_data": "cmd:mutstatus"}],
        [{"text": "📄 Get URLs .txt", "callback_data": "cmd:geturls"},
         {"text": "⬅️ Menu",          "callback_data": "cmd:menu"}],
    ]}

def ask_seed_keyboard() -> dict:
    return {"inline_keyboard": [
        [{"text": "❌ Cancel", "callback_data": "mut:cancel"}],
    ]}

def url_alert_keyboard() -> dict:
    return {"inline_keyboard": [
        [{"text": "📊 Status",  "callback_data": "cmd:status"},
         {"text": "📄 Get .txt", "callback_data": "cmd:geturls"}],
        [{"text": "🎲 Random Stats", "callback_data": "cmd:rndstatus"},
         {"text": "🧬 Mut Stats",    "callback_data": "cmd:mutstatus"}],
    ]}

# ═══════════════════════════════════════════════════════════════════
# HELP
# ═══════════════════════════════════════════════════════════════════

def help_text() -> str:
    lines = [
        "🤖 <b>BERLIN X PANEL — PRO BOT</b>",
        "",
        "<b>🎲 RANDOM MODE</b>",
        "/random — start (clicks → runs instantly)",
        "/stoprandom — stop random mode",
        "/rndstatus — random mode status",
        "",
        "<b>🧬 MUTATION MODE</b>",
        "/mutation — start (bot asks for seed URLs)",
        "/stopmutation — stop mutation mode",
        "/mutstatus — mutation mode status",
        "",
        "<b>📊 Monitoring</b>",
        "/status — current running job",
        "/jobs — recent jobs",
        "/report — summary now",
        "/system — CPU / RAM / disk / uptime",
        "/logs — last 20 log lines",
        "/health — panel reachability",
        "/stats — bot statistics",
        "",
        "<b>🎯 Live</b>",
        "/live JOB_ID — follow a job live",
        "/unlive JOB_ID — stop following",
        "/urls — URL notifier stats",
        "/geturls — download all valid URLs .txt",
        "/clearurls — clear URL history",
        "",
        "<b>🧬 Variants</b>",
        "/variants URL — show all Firebase host families",
        "",
        "<b>🚀 Upload</b>",
        "Send a <code>.txt</code> document → queued as bulk job.",
        "Caption <code>/raw</code> → skip variants",
        "",
        "<b>⚙️ Ops</b>",
        "/id — show your chat id",
        "/help — this message",
    ]
    with STATE.custom_lock:
        if STATE.custom:
            lines += ["", "<b>🧩 Custom</b>"]
            for name in STATE.custom.keys():
                lines.append(f"/{name}")
    return "\n".join(lines)
# ═══════════════════════════════════════════════════════════════════
# BASIC COMMANDS
# ═══════════════════════════════════════════════════════════════════

def cmd_start(chat_id: str) -> None:
    notes = []
    if STATE.rnd_enabled: notes.append("🎲 Random")
    if STATE.mut_enabled: notes.append("🧬 Mutation")
    suffix = f" — <b>{' · '.join(notes)}</b>" if notes else ""
    send_message(
        f"🟢 <b>BERLIN X PANEL</b>{suffix}\n\n"
        "Pro control ready. Buttons 👇 ya /help.",
        chat_id=chat_id, reply_markup=main_keyboard(),
    )

def cmd_menu(chat_id: str) -> None:
    cmd_start(chat_id)

def cmd_status(chat_id: str) -> None:
    data = panel_json("/api/public-bulk/jobs")
    if not data:
        send_message("❌ Could not read panel status.", chat_id=chat_id); return
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    running = [j for j in jobs
               if j.get("status") in {"pending", "processing", "running"}]
    if not running:
        send_message("🟢 No bulk job is currently running.",
                     chat_id=chat_id, reply_markup=main_keyboard()); return
    job = running[0]
    send_message(fmt_job(job), chat_id=chat_id,
                 reply_markup=job_keyboard(_safe_int(job.get("id"))))

def cmd_jobs(chat_id: str) -> None:
    data = panel_json("/api/public-bulk/jobs")
    if not data:
        send_message("❌ Could not read jobs.", chat_id=chat_id); return
    jobs = data.get("jobs", [])[:10] if isinstance(data, dict) else []
    send_message(fmt_jobs_list(jobs), chat_id=chat_id,
                 reply_markup=jobs_keyboard(jobs))

def cmd_report(chat_id: str) -> None:
    data = panel_json("/api/public-bulk/jobs")
    if not data:
        send_message("❌ Could not build report.", chat_id=chat_id); return
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    send_message(fmt_report(jobs), chat_id=chat_id, reply_markup=back_keyboard())

def cmd_system(chat_id: str) -> None:
    send_message(fmt_system(), chat_id=chat_id, reply_markup=back_keyboard())

def cmd_logs(chat_id: str) -> None:
    lines = list(_log_buffer)[-20:]
    if not lines:
        send_message("📜 <i>No logs yet.</i>", chat_id=chat_id,
                     reply_markup=back_keyboard()); return
    text = "📜 <b>LAST 20 LOGS</b>\n\n<pre>" + _esc("\n".join(lines)) + "</pre>"
    send_message(text[:4000], chat_id=chat_id, reply_markup=back_keyboard())

def cmd_health(chat_id: str) -> None:
    ok = panel_health()
    send_message(
        f"{'🟢' if ok else '🔴'} Panel "
        f"{'is reachable' if ok else 'is NOT reachable'}\n"
        f"<code>{_esc(PANEL_BASE)}</code>",
        chat_id=chat_id, reply_markup=back_keyboard(),
    )

def cmd_url_stats(chat_id: str) -> None:
    with STATE.url_lock:
        s = {
            "total": STATE.stats_urls_notified,
            "queued": len(STATE.url_queue),
            "history": len(STATE.url_history),
            "dedup": len(STATE.url_seen),
        }
    send_message(
        "🎯 <b>ACTIVE URL NOTIFIER</b>\n\n"
        f"Enabled  : <b>{'yes' if NOTIFY_ACTIVE_URLS else 'no'}</b>\n"
        f"Instant  : <b>{'yes' if NOTIFY_INSTANT else 'no'}</b>\n"
        f"Random   : <b>{'yes' if STATE.rnd_enabled else 'no'}</b>\n"
        f"Mutation : <b>{'yes' if STATE.mut_enabled else 'no'}</b>\n"
        f"Notified : <b>{s['total']}</b>\n"
        f"Queued   : <b>{s['queued']}</b>\n"
        f"History  : <b>{s['history']}</b>\n"
        f"Dedup    : <b>{s['dedup']}</b>\n"
        f"Report   : every <b>{_human_dur(URL_REPORT_WINDOW)}</b>",
        chat_id=chat_id, reply_markup=back_keyboard(),
    )

def cmd_get_urls(chat_id: str) -> None:
    filename, content, count = _build_url_report_file(since=0)
    if count == 0:
        send_message("📄 <i>No valid URLs collected yet.</i>",
                     chat_id=chat_id, reply_markup=back_keyboard()); return
    send_document(
        filename=filename, content=content,
        caption=(f"📄 <b>Valid URLs</b>\n"
                 f"Total : <b>{count}</b>\n"
                 f"Generated : <code>{time.strftime('%Y-%m-%d %H:%M:%S')}</code>"),
        chat_id=chat_id, reply_markup=back_keyboard(),
    )

def cmd_clear_urls(chat_id: str) -> None:
    with STATE.url_lock:
        n = len(STATE.url_history)
        STATE.url_history.clear()
    _save_history()
    send_message(f"🧹 Cleared <b>{n}</b> URL history entries.",
                 chat_id=chat_id, reply_markup=back_keyboard())

def cmd_stats(chat_id: str) -> None:
    with STATE.url_lock:
        urls = STATE.stats_urls_notified
    send_message(
        "📈 <b>BOT STATS</b>\n\n"
        f"Messages sent  : <b>{STATE.stats_msgs}</b>\n"
        f"Jobs queued    : <b>{STATE.stats_jobs_queued}</b>\n"
        f"URLs notified  : <b>{urls}</b>\n"
        f"Random checks  : <b>{STATE.rnd_stats_checks}</b>\n"
        f"Mutation checks: <b>{STATE.mut_stats_checks}</b>\n"
        f"Reports sent   : <b>{STATE.stats_reports_sent}</b>\n"
        f"Live subs      : <b>{len(STATE.live_jobs)}</b>\n"
        f"Uptime         : <b>{_human_dur(_now() - STATE.started_at)}</b>",
        chat_id=chat_id, reply_markup=back_keyboard(),
    )

def cmd_live(chat_id: str, job_id: int) -> None:
    if job_id <= 0:
        send_message("Usage: /live JOB_ID", chat_id=chat_id); return
    job = panel_get_job(str(job_id))
    if not job:
        send_message(f"❌ Job #{job_id} not found.", chat_id=chat_id); return
    text = fmt_job(job, header=f"▶️ LIVE — Job #{job_id}")
    msg_id = send_message(text, chat_id=chat_id,
                          reply_markup=job_keyboard(job_id, live=True))
    if msg_id:
        with STATE.live_lock:
            STATE.live_jobs[job_id] = {
                "chat_id": chat_id, "message_id": msg_id,
                "last_text": text, "last_edit": 0.0,
            }

def cmd_unlive(chat_id: str, job_id: int) -> None:
    with STATE.live_lock:
        removed = STATE.live_jobs.pop(job_id, None)
    if removed:
        send_message(f"⏹ Stopped following job #{job_id}.", chat_id=chat_id)
    else:
        send_message(f"ℹ️ Job #{job_id} was not being followed.", chat_id=chat_id)

def cmd_stop_job(chat_id: str, job_id: int) -> None:
    res = panel_post(f"/api/public-bulk/jobs/{job_id}/cancel", {}, timeout=15)
    if res and res.get("ok"):
        send_message(f"🛑 Cancel requested for job #{job_id}.", chat_id=chat_id); return
    send_message("ℹ️ Panel does not expose a public cancel route.", chat_id=chat_id)

def cmd_variants(chat_id: str, url: str) -> None:
    if not url:
        send_message("Usage: /variants https://xxx.firebaseio.com", chat_id=chat_id); return
    project = extract_project_name(url)
    if not project:
        send_message(f"⚠️ Could not extract project name from:\n"
                     f"<code>{_esc(url)}</code>", chat_id=chat_id); return
    variants = expand_url_variants(project)
    if not variants:
        send_message("⚠️ No variants generated.", chat_id=chat_id); return
    lines = [f"🧬 <b>{len(variants)} VARIANTS</b>", "━━━━━━━━━━━━━━━━━━━━",
             f"Project: <code>{_esc(project)}</code>", ""]
    for i, v in enumerate(variants, 1):
        lines.append(f"{i}. <code>{_esc(v)}</code>")
    send_message("\n".join(lines), chat_id=chat_id, reply_markup=back_keyboard())

# ═══════════════════════════════════════════════════════════════════
# 🎲 RANDOM MODE
# ═══════════════════════════════════════════════════════════════════

def random_start(chat_id: str) -> None:
    with STATE.rnd_lock:
        STATE.rnd_enabled = True
        STATE.rnd_chat_id = chat_id
        STATE.rnd_started_at = _now()
        STATE.rnd_batches = 0
        STATE.rnd_found = 0
        STATE.rnd_last = None
    STATE.rnd_wake.set()
    _save_random()
    send_message(
        "🎲 <b>RANDOM MODE STARTED</b>\n\n"
        f"Batch size : <b>{LOOP_BATCH_SIZE} projects</b>\n"
        f"Interval   : <b>{LOOP_DELAY}s</b>\n\n"
        "<i>Category-based random project names.</i>\n"
        "Runs until server restart.",
        chat_id=chat_id, reply_markup=loop_running_keyboard(),
    )

def random_stop(chat_id: str, reason: str = "user") -> None:
    with STATE.rnd_lock:
        was = STATE.rnd_enabled
        batches = STATE.rnd_batches
        found = STATE.rnd_found
        STATE.rnd_enabled = False
    STATE.rnd_wake.set()
    _save_random()
    if was:
        send_message(
            f"🛑 <b>RANDOM MODE STOPPED</b> ({reason})\n\n"
            f"Batches : <b>{batches}</b>\n"
            f"Found   : <b>{found}</b>",
            chat_id=chat_id, reply_markup=main_keyboard(),
        )

def random_loop() -> None:
    log("random loop started")
    while STATE.running and enabled():
        if not STATE.rnd_enabled:
            STATE.rnd_wake.wait(timeout=3.0)
            STATE.rnd_wake.clear()
            continue
        try:
            with STATE.rnd_lock:
                chat_id = STATE.rnd_chat_id
            if not chat_id:
                time.sleep(1.0); continue

            # Generate category-based random projects
            projects = generate_random_projects(LOOP_BATCH_SIZE)
            urls: List[str] = []
            for p in projects:
                for v in expand_url_variants(p):
                    urls.append(v)

            result = queue_bulk_job(f"random-{int(_now())}.txt", urls)
            if not result or not result.get("ok"):
                log("random loop: panel rejected", "WARN")
                STATE.rnd_wake.wait(timeout=LOOP_DELAY)
                STATE.rnd_wake.clear()
                continue

            STATE.rnd_stats_checks += 1
            with STATE.rnd_lock:
                STATE.rnd_batches += 1
                STATE.rnd_last = f"batch #{STATE.rnd_batches} ({len(urls)} urls)"

            log(f"[RANDOM] batch #{STATE.rnd_batches} · {len(urls)} urls")

            STATE.rnd_wake.wait(timeout=LOOP_DELAY)
            STATE.rnd_wake.clear()

            if STATE.rnd_batches % 5 == 0:
                _save_random()
        except Exception:
            log_exc("random_loop")
            time.sleep(2.0)

def cmd_random(chat_id: str) -> None:
    if STATE.rnd_enabled:
        send_message(fmt_random_status(), chat_id=chat_id,
                     reply_markup=loop_running_keyboard()); return
    random_start(chat_id)

def cmd_stoprandom(chat_id: str) -> None:
    if not STATE.rnd_enabled:
        send_message("ℹ️ Random mode is not running.", chat_id=chat_id,
                     reply_markup=main_keyboard()); return
    random_stop(chat_id, reason="user")

def cmd_rndstatus(chat_id: str) -> None:
    kb = loop_running_keyboard() if STATE.rnd_enabled else back_keyboard()
    send_message(fmt_random_status(), chat_id=chat_id, reply_markup=kb)

# ═══════════════════════════════════════════════════════════════════
# 🧬 MUTATION MODE
# ═══════════════════════════════════════════════════════════════════

def mutation_start(chat_id: str, seeds: List[str], secret: Optional[str] = None) -> None:
    cleaned, seen = [], set()
    for s in seeds:
        p = extract_project_name(s)
        if p and p not in seen:
            seen.add(p)
            cleaned.append({"project": p, "secret": secret})
    if not cleaned:
        send_message("❌ No valid project seeds.", chat_id=chat_id); return

    with STATE.mut_lock:
        STATE.mut_enabled = True
        STATE.mut_chat_id = chat_id
        STATE.mut_seeds = cleaned
        STATE.mut_index = 0
        STATE.mut_started_at = _now()
        STATE.mut_batches = 0
        STATE.mut_found = 0
        STATE.mut_last = None
    STATE.mut_wake.set()
    _save_mutation()

    preview = "\n".join(f"  {i+1}. <code>{_esc(p['project'])}</code>"
                        for i, p in enumerate(cleaned[:10]))
    more = f"\n  <i>… +{len(cleaned)-10} more</i>" if len(cleaned) > 10 else ""
    send_message(
        f"🧬 <b>MUTATION MODE STARTED</b>\n\n"
        f"Seeds    : <b>{len(cleaned)}</b>\n"
        f"{preview}{more}\n\n"
        f"Batch size : <b>{LOOP_BATCH_SIZE} mutations</b>\n"
        f"Interval   : <b>{LOOP_DELAY}s</b>\n\n"
        "<i>Category-aware mutations.</i>\n"
        "Runs until server restart.",
        chat_id=chat_id, reply_markup=loop_running_keyboard(),
    )

def mutation_stop(chat_id: str, reason: str = "user") -> None:
    with STATE.mut_lock:
        was = STATE.mut_enabled
        total = len(STATE.mut_seeds)
        batches = STATE.mut_batches
        found = STATE.mut_found
        STATE.mut_enabled = False
    STATE.mut_wake.set()
    _save_mutation()
    if was:
        send_message(
            f"🛑 <b>MUTATION MODE STOPPED</b> ({reason})\n\n"
            f"Seeds   : <b>{total}</b>\n"
            f"Batches : <b>{batches}</b>\n"
            f"Found   : <b>{found}</b>",
            chat_id=chat_id, reply_markup=main_keyboard(),
        )

def mutation_loop() -> None:
    log("mutation loop started")
    while STATE.running and enabled():
        if not STATE.mut_enabled:
            STATE.mut_wake.wait(timeout=3.0)
            STATE.mut_wake.clear()
            continue
        try:
            with STATE.mut_lock:
                if not STATE.mut_seeds:
                    STATE.mut_enabled = False
                    continue
                total = len(STATE.mut_seeds)
                idx = STATE.mut_index % total
                seed = STATE.mut_seeds[idx]["project"]
                secret = STATE.mut_seeds[idx].get("secret")
                chat_id = STATE.mut_chat_id
                STATE.mut_index = (idx + 1) % total

            if not seed or not chat_id:
                time.sleep(1.0); continue

            # Category-aware mutations
            mutations = generate_mutations(seed, count=LOOP_BATCH_SIZE)
            urls: List[str] = []
            for m in mutations:
                for v in expand_url_variants(m):
                    urls.append(v)

            result = queue_bulk_job(f"mut-{seed}.txt", urls, secret=secret)
            if not result or not result.get("ok"):
                log("mutation loop: panel rejected", "WARN")
                STATE.mut_wake.wait(timeout=LOOP_DELAY)
                STATE.mut_wake.clear()
                continue

            STATE.mut_stats_checks += 1
            with STATE.mut_lock:
                STATE.mut_batches += 1
                STATE.mut_last = f"{seed} ({idx+1}/{total}) · {len(urls)} urls"

            log(f"[MUTATION] seed={seed} ({idx+1}/{total}) · {len(urls)} urls")

            STATE.mut_wake.wait(timeout=LOOP_DELAY)
            STATE.mut_wake.clear()

            if STATE.mut_batches % 5 == 0:
                _save_mutation()
        except Exception:
            log_exc("mutation_loop")
            time.sleep(2.0)

def cmd_mutation(chat_id: str) -> None:
    if STATE.mut_enabled:
        send_message(fmt_mutation_status(), chat_id=chat_id,
                     reply_markup=loop_running_keyboard()); return
    STATE.await_mut[chat_id] = _now() + 180
    send_message(
        "🧬 <b>MUTATION MODE — SETUP</b>\n\n"
        "Send me <b>one or more seed</b> Firebase URLs\n"
        "(one per line). Bot will mutate them.\n\n"
        "<b>Example:</b>\n"
        "<code>https://mrrrrrrrr-8a5c1-default-rtdb.firebaseio.com</code>\n\n"
        "Bot will generate names like:\n"
        "<code>mrrrrrrrr-8a5a2</code>\n"
        "<code>mrrrrrrrr-9b5c1</code>\n"
        "<code>mrjrrrrrrr-8a5c1</code>\n"
        "... continuously until restart.\n\n"
        "<i>Send seed URLs now… (timeout 3 min)</i>",
        chat_id=chat_id, reply_markup=ask_seed_keyboard(),
    )

def cmd_stopmutation(chat_id: str) -> None:
    if not STATE.mut_enabled:
        send_message("ℹ️ Mutation mode is not running.", chat_id=chat_id,
                     reply_markup=main_keyboard()); return
    mutation_stop(chat_id, reason="user")

def cmd_mutstatus(chat_id: str) -> None:
    kb = loop_running_keyboard() if STATE.mut_enabled else back_keyboard()
    send_message(fmt_mutation_status(), chat_id=chat_id, reply_markup=kb)
# ═══════════════════════════════════════════════════════════════════
# DOCUMENT UPLOAD (Telegram → Panel)
# ═══════════════════════════════════════════════════════════════════

def handle_document(message: dict) -> None:
    doc = message.get("document") or {}
    file_id = doc.get("file_id")
    filename = doc.get("file_name") or "telegram-upload.txt"
    size = _safe_int(doc.get("file_size"))
    caption = str(message.get("caption") or "").strip()
    chat_id = str((message.get("chat") or {}).get("id", ""))

    if not file_id: return
    if not filename.lower().endswith(".txt"):
        send_message("❌ Only <code>.txt</code> files are accepted.", chat_id=chat_id)
        return
    if size and size > MAX_UPLOAD_BYTES:
        send_message(f"❌ File too large ({size} > {MAX_UPLOAD_BYTES}).", chat_id=chat_id)
        return

    force_raw = "/raw" in caption.lower()

    try:
        info = api("getFile", {"file_id": file_id})
        path = ((info or {}).get("result") or {}).get("file_path")
        if not path: raise RuntimeError("file_path missing")
        url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{path}"
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = resp.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            send_message("❌ TXT exceeds panel limit.", chat_id=chat_id); return
        content = raw.decode("utf-8-sig", errors="replace")
        entries_preview = sum(1 for line in content.splitlines() if line.strip())

        global AUTO_VARIANTS
        saved = AUTO_VARIANTS
        if force_raw: AUTO_VARIANTS = False
        try:
            pairs, in_count = expand_bulk_content(content)
        finally:
            AUTO_VARIANTS = saved

        if not pairs:
            send_message("❌ No valid URLs found in file.", chat_id=chat_id); return

        new_content = "\n".join(f"{u},{s}" if s else u for u, s in pairs)

        result = panel_post("/api/public-bulk/jobs",
                            {"filename": filename, "content": new_content})
        if not result:
            send_message("❌ Panel rejected the upload.", chat_id=chat_id); return
        job_id = _safe_int(result.get("job_id"))
        total  = _safe_int(result.get("total"), len(pairs))
        STATE.stats_jobs_queued += 1

        mode_line = (f"Variants : <b>{in_count} → {total}</b>\n"
                     if saved and not force_raw else "Mode     : <b>raw</b>\n")

        send_message(
            f"🚀 <b>Job #{job_id} queued</b>\n\n"
            f"File    : <code>{_esc(filename)}</code>\n"
            f"Entries : <b>{entries_preview}</b>\n"
            f"{mode_line}\n"
            "Track it with /status or the button below.",
            chat_id=chat_id, reply_markup=job_keyboard(job_id),
        )
    except Exception:
        log_exc("document handling failed")
        send_message("❌ Could not queue the TXT file.", chat_id=chat_id)

# ═══════════════════════════════════════════════════════════════════
# AWAITING INPUT (Mutation mode needs seeds)
# ═══════════════════════════════════════════════════════════════════

def _consume_awaiting_input(chat_id: str, text: str) -> bool:
    """
    Check if user is in awaiting state and route accordingly.
    Returns True if consumed.
    """
    now = _now()

    # ── Mutation awaiting seeds ──
    mut_expiry = STATE.await_mut.get(chat_id)
    if mut_expiry and now <= mut_expiry:
        lines = [l.strip() for l in re.split(r"[\n,]", text) if l.strip()]
        projects = [extract_project_name(l) for l in lines]
        projects = [p for p in projects if p]
        if not projects:
            send_message(
                "⚠️ No Firebase project found. Send like:\n"
                "<code>https://mrrrrrrrr-8a5c1-default-rtdb.firebaseio.com</code>\n\n"
                "Or multiple lines:\n"
                "<code>https://proj1-default-rtdb.firebaseio.com\n"
                "https://proj2-default-rtdb.firebaseio.com</code>",
                chat_id=chat_id, reply_markup=ask_seed_keyboard(),
            )
            return True
        STATE.await_mut.pop(chat_id, None)
        mutation_start(chat_id, projects)
        return True

    # ── Cleanup stale awaiting entries ──
    if mut_expiry:
        STATE.await_mut.pop(chat_id, None)
    if chat_id in STATE.await_random:
        STATE.await_random.pop(chat_id, None)

    return False

# ═══════════════════════════════════════════════════════════════════
# MESSAGE ROUTER
# ═══════════════════════════════════════════════════════════════════

def _parse_int_arg(text: str) -> Optional[int]:
    parts = text.split()
    if len(parts) < 2: return None
    m = re.search(r"\d+", parts[1])
    return int(m.group()) if m else None

def handle_command(chat_id: str, text: str) -> None:
    parts = text.split()
    cmd = parts[0].lower()

    # Custom commands first
    with STATE.custom_lock:
        handler = STATE.custom.get(cmd.lstrip("/"))
    if handler:
        try: handler(chat_id, parts[1:])
        except Exception:
            log_exc(f"custom {cmd}")
            send_message("❌ Custom command failed.", chat_id=chat_id)
        return

    # Navigation
    if cmd in ("/start", "/help", "/menu"): cmd_start(chat_id); return

    # Monitoring
    if cmd == "/status":     cmd_status(chat_id); return
    if cmd == "/jobs":       cmd_jobs(chat_id); return
    if cmd == "/report":
        STATE.last_report = 0
        cmd_report(chat_id); return
    if cmd == "/system":     cmd_system(chat_id); return
    if cmd == "/logs":       cmd_logs(chat_id); return
    if cmd == "/urls":       cmd_url_stats(chat_id); return
    if cmd == "/geturls":    cmd_get_urls(chat_id); return
    if cmd == "/clearurls":  cmd_clear_urls(chat_id); return
    if cmd == "/health":     cmd_health(chat_id); return
    if cmd == "/stats":      cmd_stats(chat_id); return
    if cmd == "/id":
        send_message(f"🆔 Your chat id: <code>{_esc(chat_id)}</code>", chat_id=chat_id)
        return

    # Live tracking
    if cmd == "/live":
        jid = _parse_int_arg(text)
        if jid is None:
            send_message("Usage: /live JOB_ID", chat_id=chat_id); return
        cmd_live(chat_id, jid); return
    if cmd == "/unlive":
        jid = _parse_int_arg(text)
        if jid is None:
            send_message("Usage: /unlive JOB_ID", chat_id=chat_id); return
        cmd_unlive(chat_id, jid); return
    if cmd == "/stop":
        jid = _parse_int_arg(text)
        if jid is None:
            send_message("Usage: /stop JOB_ID", chat_id=chat_id); return
        cmd_stop_job(chat_id, jid); return

    # Variants
    if cmd == "/variants":
        arg = text.split(maxsplit=1)[1].strip() if len(text.split()) > 1 else ""
        cmd_variants(chat_id, arg); return

    # Random mode
    if cmd == "/random":      cmd_random(chat_id); return
    if cmd == "/stoprandom":  cmd_stoprandom(chat_id); return
    if cmd == "/rndstatus":   cmd_rndstatus(chat_id); return

    # Mutation mode
    if cmd == "/mutation":     cmd_mutation(chat_id); return
    if cmd == "/stopmutation": cmd_stopmutation(chat_id); return
    if cmd == "/mutstatus":    cmd_mutstatus(chat_id); return

    send_message("Unknown command. Use /help.", chat_id=chat_id,
                 reply_markup=main_keyboard())

def handle_message(message: dict) -> None:
    chat_id = str((message.get("chat") or {}).get("id", ""))
    if not is_allowed(chat_id):
        if chat_id:
            send_message("⛔ Unauthorized chat.", chat_id=chat_id)
        return

    if not rate_ok(chat_id, max_events=40, window=5.0):
        log(f"rate-limited chat {chat_id}", "WARN")
        return

    # ── Documents ──
    if message.get("document"):
        lock = user_lock(chat_id)
        if not lock.acquire(blocking=False):
            send_message("⏳ A command is already running. Please wait.", chat_id=chat_id)
            return
        try: handle_document(message)
        finally: lock.release()
        return

    text = str(message.get("text") or "").strip()
    if not text: return

    # ── Commands ──
    if text.startswith("/"):
        lock = user_lock(chat_id)
        if not lock.acquire(blocking=False):
            send_message("⏳ Please wait — previous command still running.", chat_id=chat_id)
            return
        try:
            handle_command(chat_id, text)
        finally:
            lock.release()
        return

    # ── Awaiting input (e.g. mutation seed) ──
    if _consume_awaiting_input(chat_id, text):
        return

    # ── Plain text → menu ──
    cmd_start(chat_id)

# ═══════════════════════════════════════════════════════════════════
# CALLBACK ROUTER (with dedup)
# ═══════════════════════════════════════════════════════════════════

def handle_callback(cb: dict) -> None:
    cb_id  = cb.get("id")
    data   = str(cb.get("data") or "")
    msg    = cb.get("message") or {}
    chat_id = str((msg.get("chat") or {}).get("id", ""))
    msg_id  = _safe_int(msg.get("message_id"))

    if not is_allowed(chat_id):
        answer_callback(cb_id, "⛔ Unauthorized", alert=True); return

    # Dedup — blocks button spam
    if callback_is_dup(cb_id):
        return
    answer_callback(cb_id)

    if not rate_ok(chat_id, max_events=40, window=5.0):
        return

    # ── Random mode ──
    if data == "rnd:start":  cmd_random(chat_id); return
    if data == "rnd:stop":   cmd_stoprandom(chat_id); return

    # ── Mutation mode ──
    if data == "mut:start":  cmd_mutation(chat_id); return
    if data == "mut:stop":   cmd_stopmutation(chat_id); return
    if data == "mut:cancel":
        STATE.await_mut.pop(chat_id, None)
        send_message("❌ Mutation setup cancelled.", chat_id=chat_id,
                     reply_markup=main_keyboard())
        return

    # ── Navigation ──
    if data == "cmd:menu":       cmd_menu(chat_id); return
    if data == "cmd:status":     cmd_status(chat_id); return
    if data == "cmd:jobs":       cmd_jobs(chat_id); return
    if data == "cmd:report":     cmd_report(chat_id); return
    if data == "cmd:system":     cmd_system(chat_id); return
    if data == "cmd:logs":       cmd_logs(chat_id); return
    if data == "cmd:urls":       cmd_url_stats(chat_id); return
    if data == "cmd:geturls":    cmd_get_urls(chat_id); return
    if data == "cmd:health":     cmd_health(chat_id); return
    if data == "cmd:rndstatus":  cmd_rndstatus(chat_id); return
    if data == "cmd:mutstatus":  cmd_mutstatus(chat_id); return
    if data == "cmd:help":
        send_message(help_text(), chat_id=chat_id, reply_markup=main_keyboard()); return

    # ── Job refresh ──
    if data.startswith("refresh:"):
        jid = _safe_int(data.split(":", 1)[1])
        job = panel_get_job(str(jid))
        if job and msg_id:
            text = fmt_job(job, header=f"📄 Job #{jid}")
            with STATE.live_lock:
                live = jid in STATE.live_jobs
            edit_message(chat_id, msg_id, text,
                         reply_markup=job_keyboard(jid, live=live))
        return

    # ── Live toggle ──
    if data.startswith("live:"):
        jid = _safe_int(data.split(":", 1)[1])
        with STATE.live_lock:
            already = jid in STATE.live_jobs
        if already:
            cmd_unlive(chat_id, jid)
        else:
            job = panel_get_job(str(jid))
            if not job:
                send_message(f"❌ Job #{jid} not found.", chat_id=chat_id); return
            text = fmt_job(job, header=f"▶️ LIVE — Job #{jid}")
            new_id = send_message(text, chat_id=chat_id,
                                  reply_markup=job_keyboard(jid, live=True))
            if new_id:
                with STATE.live_lock:
                    STATE.live_jobs[jid] = {
                        "chat_id": chat_id, "message_id": new_id,
                        "last_text": text, "last_edit": 0.0,
                    }
        return
# ═══════════════════════════════════════════════════════════════════
# ACTIVE URL NOTIFIER (called from server.py)
# ═══════════════════════════════════════════════════════════════════

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)

def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url: return ""
    try:
        p = urllib.parse.urlsplit(url)
        if not p.scheme or not p.netloc: return url
        return urllib.parse.urlunsplit(
            (p.scheme.lower(), p.netloc.lower(), p.path, p.query, ""))
    except Exception:
        return url

def _is_fresh(url_key: str) -> bool:
    now = _now()
    with STATE.url_lock:
        seen = STATE.url_seen.get(url_key)
        if seen and now - seen < NOTIFY_DEDUP_TTL:
            return False
        STATE.url_seen[url_key] = now
        if len(STATE.url_seen) > 20000:
            cutoff = now - NOTIFY_DEDUP_TTL
            for k in [k for k, t in STATE.url_seen.items() if t < cutoff]:
                STATE.url_seen.pop(k, None)
        return True

def _active_target_chat() -> str:
    """Where to send URL alerts: mutation chat > random chat > admin."""
    if STATE.mut_enabled and STATE.mut_chat_id: return STATE.mut_chat_id
    if STATE.rnd_enabled and STATE.rnd_chat_id: return STATE.rnd_chat_id
    return ADMIN_CHAT_ID

def notify_active_url(url: str, *, job_id: Optional[int] = None,
                      source: Optional[str] = None,
                      meta: Optional[Dict[str, Any]] = None) -> bool:
    """PUBLIC HOOK — call from server.py when a valid URL is found."""
    log(f"notify_active_url: url={str(url)[:80]} job={job_id}", "DEBUG")
    if not enabled() or not NOTIFY_ACTIVE_URLS:
        return False
    url = (url or "").strip()
    if not url or not _URL_RE.match(url):
        return False

    url_key = _normalize_url(url)
    if not _is_fresh(url_key):
        log(f"notify skipped: dedup {url_key}", "DEBUG")
        return False

    item = {
        "url": url, "url_key": url_key,
        "job_id": job_id, "source": source,
        "meta": meta or {}, "ts": _now(),
    }

    with STATE.url_lock:
        STATE.url_queue.append(item)
        STATE.url_history.append(item)
        if len(STATE.url_history) > URL_REPORT_MAX:
            STATE.url_history = STATE.url_history[-URL_REPORT_MAX:]
        STATE.stats_urls_notified += 1

    # Update mode counters
    with STATE.rnd_lock:
        if STATE.rnd_enabled:
            STATE.rnd_found += 1
            STATE.rnd_last = url
    with STATE.mut_lock:
        if STATE.mut_enabled:
            STATE.mut_found += 1
            STATE.mut_last = url

    if NOTIFY_INSTANT:
        try: _send_instant_url_alert(item)
        except Exception: log_exc("instant alert")
    else:
        STATE.url_flush_evt.set()
    return True

def _send_instant_url_alert(item: Dict[str, Any]) -> None:
    url = item["url"]
    jid = item.get("job_id")
    src = item.get("source")
    meta = item.get("meta") or {}

    tag = []
    if jid is not None: tag.append(f"job #{jid}")
    if src: tag.append(str(src))
    tag_line = f"\n<i>{_esc(' · '.join(tag))}</i>" if tag else ""

    meta_line = ""
    if NOTIFY_INC_META and meta:
        kv = " · ".join(f"{_esc(k)}={_esc(str(v))}"
                        for k, v in list(meta.items())[:4])
        if kv: meta_line = f"\n<i>{kv}</i>"

    mode_note = ""
    with STATE.rnd_lock:
        if STATE.rnd_enabled:
            mode_note = f"\n<i>🎲 random · found {STATE.rnd_found}</i>"
    with STATE.mut_lock:
        if STATE.mut_enabled:
            mode_note = f"\n<i>🧬 mutation · found {STATE.mut_found}</i>"

    text = (
        "✅ <b>VALID FIREBASE URL FOUND</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"<code>{_esc(url)}</code>"
        f"{tag_line}{meta_line}{mode_note}\n\n"
        f"<i>{time.strftime('%H:%M:%S')}</i>"
    )
    send_message(text, chat_id=_active_target_chat(),
                 reply_markup=url_alert_keyboard())

def _format_url_alert(items: List[Dict[str, Any]]) -> str:
    n = len(items)
    lines = [f"🎯 <b>{n} VALID FIREBASE URL{'S' if n > 1 else ''} FOUND</b>",
             "━━━━━━━━━━━━━━━━━━━━"]
    for i, it in enumerate(items, 1):
        url = it["url"]
        jid = it.get("job_id"); src = it.get("source")
        bits = []
        if jid is not None: bits.append(f"job #{jid}")
        if src: bits.append(_esc(str(src)))
        tag = f"  <i>({', '.join(bits)})</i>" if bits else ""
        lines.append(f"{i}. <code>{_esc(url)}</code>{tag}")
        if NOTIFY_INC_META and it.get("meta"):
            kv = " · ".join(f"{_esc(k)}={_esc(str(v))}"
                            for k, v in list(it["meta"].items())[:4])
            if kv: lines.append(f"    ↳ <i>{kv}</i>")
    if n >= NOTIFY_MAX_BATCH:
        lines.append("\n<i>…more URLs arriving.</i>")
    return "\n".join(lines)

def _flush_url_batch() -> None:
    with STATE.url_lock:
        if not STATE.url_queue: return
        batch = STATE.url_queue[:NOTIFY_MAX_BATCH]
        STATE.url_queue = STATE.url_queue[NOTIFY_MAX_BATCH:]
    send_message(_format_url_alert(batch), chat_id=_active_target_chat(),
                 reply_markup=url_alert_keyboard())
    with STATE.url_lock:
        more = bool(STATE.url_queue)
    if more: STATE.url_flush_evt.set()

def url_flush_loop() -> None:
    log("url flush loop started")
    while STATE.running and enabled():
        if not STATE.url_flush_evt.wait(timeout=1.0):
            continue
        STATE.url_flush_evt.clear()
        if NOTIFY_BATCH_WIN > 0:
            time.sleep(NOTIFY_BATCH_WIN)
        try: _flush_url_batch()
        except Exception: log_exc("url_flush_loop")

# ═══════════════════════════════════════════════════════════════════
# 30-MIN .TXT REPORT
# ═══════════════════════════════════════════════════════════════════

def _build_url_report_file(since: Optional[float] = None) -> Tuple[str, bytes, int]:
    if since is None:
        since = _now() - URL_REPORT_WINDOW
    with STATE.url_lock:
        snapshot = list(STATE.url_history)
    seen_keys = set()
    rows = []
    for it in snapshot:
        if _safe_float(it.get("ts", 0)) < since: continue
        key = it.get("url_key") or _normalize_url(it.get("url", ""))
        if key in seen_keys: continue
        seen_keys.add(key)
        rows.append(it)
        if len(rows) >= URL_REPORT_MAX: break

    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# BERLIN X PANEL — VALID FIREBASE URLs",
        f"# Generated : {ts}",
        f"# Window    : last {int(URL_REPORT_WINDOW)}s",
        f"# Total     : {len(rows)}",
        "#",
        "# Format: <url>  [#job_id] [source]",
        "",
    ]
    for it in rows:
        url = it.get("url", "")
        jid = it.get("job_id"); src = it.get("source")
        tags = []
        if jid is not None: tags.append(f"#job{jid}")
        if src: tags.append(f"[{src}]")
        suffix = ("  " + " ".join(tags)) if tags else ""
        lines.append(f"{url}{suffix}")

    content = ("\n".join(lines) + "\n").encode("utf-8")
    filename = f"valid-urls-{time.strftime('%Y%m%d-%H%M%S')}.txt"
    return filename, content, len(rows)

def _send_30min_report(force: bool = False) -> None:
    if not enabled() or not URL_REPORT_ENABLED: return
    if not force and _now() - STATE.last_report < URL_REPORT_WINDOW:
        return
    with STATE.report_lock:
        if not force and _now() - STATE.last_report < URL_REPORT_WINDOW:
            return
        try:
            filename, content, count = _build_url_report_file(
                since=_now() - URL_REPORT_WINDOW)
            try:
                with open(os.path.join(REPORT_DIR, filename), "wb") as f:
                    f.write(content)
            except Exception: log_exc("write report file")

            if count == 0:
                if force:
                    send_message("📄 <i>No valid URLs in last window.</i>",
                                 reply_markup=main_keyboard())
                STATE.last_report = _now(); return

            summary = (
                "📄 <b>30-MIN URL REPORT</b>\n\n"
                f"Valid URLs : <b>{count}</b>\n"
                f"Window     : last <b>{_human_dur(URL_REPORT_WINDOW)}</b>\n"
                f"Generated  : <code>{time.strftime('%Y-%m-%d %H:%M:%S')}</code>\n\n"
                "<i>Full list attached as .txt below.</i>"
            )
            target = _active_target_chat()
            send_message(summary, chat_id=target, reply_markup=url_alert_keyboard())
            send_document(filename=filename, content=content,
                          caption=f"📎 <b>{count}</b> valid Firebase URL"
                                  f"{'s' if count != 1 else ''}",
                          chat_id=target)
            STATE.stats_reports_sent += 1
            STATE.last_report = _now()
            _save_history()
        except Exception: log_exc("30min report")

def report_loop() -> None:
    log(f"report loop started (every {int(URL_REPORT_WINDOW)}s)")
    while STATE.running and enabled():
        time.sleep(30)
        try: _send_30min_report(force=False)
        except Exception: log_exc("report_loop")

# ═══════════════════════════════════════════════════════════════════
# LIVE JOB REFRESH
# ═══════════════════════════════════════════════════════════════════

def live_refresh_loop() -> None:
    while STATE.running and enabled():
        time.sleep(LIVE_REFRESH_SEC)
        try:
            with STATE.live_lock:
                jobs = list(STATE.live_jobs.items())
            for jid, meta in jobs:
                job = panel_get_job(str(jid))
                if not job: continue
                text = fmt_job(job, header=f"▶️ LIVE — Job #{jid}")
                if text == meta.get("last_text"): continue
                if time.time() - meta.get("last_edit", 0) < 1.0: continue
                ok = edit_message(meta["chat_id"], meta["message_id"], text,
                                  reply_markup=job_keyboard(jid, live=True))
                if ok:
                    meta["last_text"] = text
                    meta["last_edit"] = time.time()
                if str(job.get("status", "")).lower() in {
                    "done", "completed", "failed", "error",
                    "cancelled", "stopped",
                }:
                    with STATE.live_lock:
                        STATE.live_jobs.pop(jid, None)
                    send_message(f"✅ Job #{jid} finished ({job.get('status')}).",
                                 chat_id=meta["chat_id"])
        except Exception: log_exc("live_refresh_loop")

# ═══════════════════════════════════════════════════════════════════
# POLL LOOP
# ═══════════════════════════════════════════════════════════════════

def poll_loop() -> None:
    log("poll loop started")
    while STATE.running and enabled():
        try:
            res = api("getUpdates",
                      {"offset": STATE.offset,
                       "timeout": POLL_TIMEOUT,
                       "allowed_updates": json.dumps(["message", "callback_query"])},
                      timeout=POLL_TIMEOUT + 10)
            if not res or not res.get("ok"):
                time.sleep(3); continue
            for upd in res.get("result", []):
                STATE.offset = max(STATE.offset, _safe_int(upd.get("update_id")) + 1)
                try:
                    if "message" in upd: handle_message(upd["message"])
                    elif "callback_query" in upd: handle_callback(upd["callback_query"])
                except Exception: log_exc("update handler")
        except urllib.error.HTTPError as exc:
            log(f"getUpdates HTTP {exc.code}", "WARN")
            time.sleep(5)
        except Exception:
            log_exc("poll_loop")
            time.sleep(5)
    log("poll loop exited")

# ═══════════════════════════════════════════════════════════════════
# LIFECYCLE
# ═══════════════════════════════════════════════════════════════════

def register_command(name: str, handler: Callable[[str, List[str]], None]) -> None:
    with STATE.custom_lock:
        STATE.custom[name.lower().lstrip("/")] = handler
    log(f"custom command registered: /{name}")

def send_startup() -> None:
    if not enabled():
        log("Telegram disabled: set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID", "WARN")
        return
    with STATE.url_lock:
        hist = len(STATE.url_history)
    with STATE.rnd_lock:
        rnd_line = (f"🎲 Random   : <b>RUNNING</b> ({STATE.rnd_batches} batches)\n"
                    if STATE.rnd_enabled else "🎲 Random   : <b>idle</b>\n")
    with STATE.mut_lock:
        mut_line = (f"🧬 Mutation : <b>RUNNING</b> ({len(STATE.mut_seeds)} seeds)\n"
                    if STATE.mut_enabled else "🧬 Mutation : <b>idle</b>\n")
    send_message(
        "🟢 <b>BERLIN X PANEL is online</b>\n\n"
        "Pro Telegram control ready.\n"
        f"URL history   : <b>{hist}</b>\n"
        f"30-min report : <b>{'ON' if URL_REPORT_ENABLED else 'OFF'}</b>\n"
        f"Active alerts : <b>{'ON' if NOTIFY_ACTIVE_URLS else 'OFF'}</b> "
        f"(<b>{'instant' if NOTIFY_INSTANT else 'batched'}</b>)\n"
        f"Variants      : <b>{'ON' if AUTO_VARIANTS else 'OFF'}</b>\n"
        f"{rnd_line}"
        f"{mut_line}\n"
        "Tap a button or type /help.",
        reply_markup=main_keyboard(),
    )

def send_shutdown() -> None:
    if not enabled(): return
    try: send_message("🔴 BERLIN X PANEL is shutting down.")
    except Exception: pass

def _install_signal_handlers() -> None:
    def _handler(signum, frame):
        log(f"signal {signum} received; stopping", "WARN")
        STATE.running = False
        STATE.rnd_wake.set()
        STATE.mut_wake.set()
        STATE.url_flush_evt.set()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try: signal.signal(sig, _handler)
        except Exception: pass

def start() -> None:
    if not enabled():
        log("Bot not started; Telegram env vars missing.", "WARN")
        return
    _load_state()
    _load_dedup()
    _load_history()
    _load_random()
    _load_mutation()
    _install_signal_handlers()

    # ── 8 background workers ──
    threading.Thread(target=send_startup,      name="tg-startup",  daemon=True).start()
    threading.Thread(target=poll_loop,         name="tg-poll",     daemon=True).start()
    threading.Thread(target=live_refresh_loop, name="tg-live",     daemon=True).start()
    threading.Thread(target=report_loop,       name="tg-report",   daemon=True).start()
    threading.Thread(target=url_flush_loop,    name="tg-urls",     daemon=True).start()
    threading.Thread(target=random_loop,       name="tg-random",   daemon=True).start()
    threading.Thread(target=mutation_loop,     name="tg-mutation", daemon=True).start()
    threading.Thread(target=_autosave_loop,    name="tg-save",     daemon=True).start()
    log("Telegram PRO bot started (8 workers)")

def stop() -> None:
    STATE.running = False
    STATE.rnd_wake.set()
    STATE.mut_wake.set()
    STATE.url_flush_evt.set()
    _save_state()
    _save_dedup()
    _save_history()
    _save_random()
    _save_mutation()
    send_shutdown()

# ═══════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    start()
    try:
        while STATE.running:
            time.sleep(1)
    except KeyboardInterrupt:
        stop()