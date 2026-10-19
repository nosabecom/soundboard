"""Render the shipped Earshot forge bank. No models, recordings, or network at render time.
Usage: PYTHONPATH=/path/to/earshot python scripts/render-earshot.py
Requires: numpy scipy soundfile. See docs/sounds.md for pinned upstream revision.
"""
import json
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from earshot.forge import bank

SOUNDS = [
    ('Deep impact', 'impact/deep'), ('Glass ping', 'pro_notify/ding_1822'),
    ('Fast whoosh', 'whoosh_fast/crisp'), ('Sub drop', 'sub_drop/808'),
    ('Bubble pop', 'pro_pop/bloop'), ('Soft click', 'click/soft'),
    ('Glitch', 'glitch/stutter'), ('Shimmer', 'shimmer/m0'),
    ('Space zip', 'pro_zip/up'), ('Low knock', 'pro_pop_in/knock'),
    ('Riser', 'riser/air'), ('Swipe', 'swipe/cloth'),
    ('Kalimba', 'pluck/kalimba'), ('Key thock', 'typing_key/thock'),
    ('Logo sting', 'logo_sting/spark'), ('Air fall', 'downlifter/air_fall'),
]
ROOT = Path(__file__).resolve().parent.parent
rows = []
for i, (name, sound_id) in enumerate(SOUNDS, 1):
    y, meta = bank.render(sound_id, checks=False, peak_db=-4)
    # Keep the effect itself and its original timing; bound silent tails for pocket-sized downloads.
    assert np.all(np.isfinite(y)) and np.max(np.abs(y)) > .001
    path = ROOT / 'public' / 'audio' / f'{i:02}.wav'
    sf.write(path, y, 48000, subtype='PCM_16')
    rows.append({'name': name, 'bank_id': sound_id, 'file': path.name,
                 'duration': round(len(y) / 48000, 4), 'peak': round(float(np.max(np.abs(y))), 4)})
    print(f'{name}: {len(y) / 48000:.2f}s')
(ROOT / 'public' / 'audio' / 'provenance.json').write_text(json.dumps({'earshot_bank': bank.VERSION, 'sounds': rows}, indent=2) + '\n')
