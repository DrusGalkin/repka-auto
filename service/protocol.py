import json
SERVICE = "73310001-8d21-4f2a-9f10-22c26f0c0001"
CHARACTERISTIC = "73310002-8d21-4f2a-9f10-22c26f0c0001"

def packets(snapshot, sequence):
    data = json.dumps(snapshot, ensure_ascii=True, separators=(",", ":"), allow_nan=False).encode()
    count = (len(data) + 15) // 16
    if count > 255:
        raise ValueError("Snapshot exceeds BLE frame limit")
    return [bytes([1, sequence % 256, i, count]) + data[i*16:(i+1)*16] for i in range(count)]
