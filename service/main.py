import asyncio
import copy
import argparse
import json
import logging
import math
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from protocol import SERVICE, CHARACTERISTIC, packets

# Explicit read-only Mode 01 allowlist; no ECU writes or code clearing.
METRICS = {
    "RPM": ("Обороты двигателя", "rpm"),
    "SPEED": ("Скорость", "km/h"),
    "COOLANT_TEMP": ("Температура ОЖ", "degC"),
    "ENGINE_LOAD": ("Нагрузка двигателя", "percent"),
    "THROTTLE_POS": ("Дроссель", "percent"),
    "INTAKE_TEMP": ("Температура впуска", "degC"),
    "INTAKE_PRESSURE": ("Давление впуска", "kPa"),
    "MAF": ("Расход воздуха", "g/s"),
    "FUEL_LEVEL": ("Уровень топлива", "percent"),
    "CONTROL_MODULE_VOLTAGE": ("Напряжение ЭБУ", "volt"),
    "TIMING_ADVANCE": ("Угол зажигания", "degree"),
    "SHORT_FUEL_TRIM_1": ("Краткая коррекция", "percent"),
    "LONG_FUEL_TRIM_1": ("Длинная коррекция", "percent"),
    "FUEL_PRESSURE": ("Давление топлива", "kPa"),
    "OIL_TEMP": ("Температура масла", "degC"),
    "RUN_TIME": ("Время работы двигателя", "second"),
    "DISTANCE_W_MIL": ("Пробег с MIL", "km"),
}
lock = threading.Lock()
state = {"v": 1, "status": "connecting", "demo": False, "ts": 0, "metrics": {}}

def publish(status, metrics, demo=False):
    with lock:
        state.update(status=status, metrics=copy.deepcopy(metrics), demo=demo, ts=time.time())

def snapshot():
    with lock:
        return json.loads(json.dumps(state))

def read_obd(stop, demo):
    if demo:
        while not stop.is_set():
            t = time.monotonic()
            values = [1800+500*math.sin(t/3), 54+12*math.sin(t/5), 88, 32, 21, 28, 42, 12, 63, 14.1, 12, 1.2, -2, 310, 91, int(t)%3600, 0]
            publish("connected", {k: [round(v, 1), u, time.time()] for (k, (_, u)), v in zip(METRICS.items(), values)}, True)
            stop.wait(1)
        return
    import obd
    while not stop.is_set():
        connection = None
        try:
            publish("connecting", {})
            connection = obd.OBD(portstr=os.getenv("OBD_PORT") or None, baudrate=int(os.environ["OBD_BAUD"]) if os.getenv("OBD_BAUD") else None, timeout=2, fast=False)
            if not connection.is_connected():
                raise ConnectionError("ECU unavailable")
            supported = {k: getattr(obd.commands, k) for k in METRICS if connection.supports(getattr(obd.commands, k))}
            metrics = {k: [None, u, 0] for k, (_, u) in METRICS.items()}
            failures = 0
            while not stop.is_set():
                good = False
                for key, command in supported.items():
                    if stop.is_set():
                        break
                    result = connection.query(command)
                    unit = METRICS[key][1]
                    value = None
                    if not result.is_null():
                        value = float(result.value.to(unit).magnitude)
                        if not math.isfinite(value):
                            value = None
                    metrics[key] = [round(value, 2) if value is not None else None, unit, time.time() if value is not None else 0]
                    good |= value is not None
                    publish("connected", metrics)
                failures = 0 if good else failures + 1
                if failures >= 3:
                    raise ConnectionError("No ECU responses")
                stop.wait(0.3)
        except Exception:
            logging.exception("OBD connection lost; retry in 5 seconds")
            publish("disconnected", {})
            stop.wait(5)
        finally:
            if connection:
                connection.close()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/state":
            body, mime = json.dumps(snapshot()).encode(), "application/json"
        elif self.path == "/":
            body, mime = Path(__file__).with_name("dashboard.html").read_bytes(), "text/html; charset=utf-8"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args):
        pass

async def bluetooth(stop):
    from bless import BlessServer, GATTCharacteristicProperties as P, GATTAttributePermissions as A
    while not stop.is_set():
        server = BlessServer(name="Repka Auto", loop=asyncio.get_running_loop())
        try:
            await server.add_new_service(SERVICE)
            await server.add_new_characteristic(SERVICE, CHARACTERISTIC, P.notify, bytearray(), A.readable)
            await server.start()
            seq = 0
            while not stop.is_set():
                for packet in packets(snapshot(), seq):
                    server.get_characteristic(CHARACTERISTIC).value = bytearray(packet)
                    server.update_value(SERVICE, CHARACTERISTIC)
                    await asyncio.sleep(0.035)
                seq = (seq+1) % 256
                await asyncio.sleep(0.5)
        except Exception:
            logging.exception("BLE unavailable; retry in 5 seconds")
            await asyncio.sleep(5)
        finally:
            try:
                await server.stop()
            except Exception:
                logging.exception("BLE shutdown")

async def run(args):
    stop = threading.Event()
    http = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    worker = threading.Thread(target=read_obd, args=(stop, args.demo), daemon=True)
    worker.start()
    threading.Thread(target=http.serve_forever, daemon=True).start()
    try:
        if args.no_ble:
            await asyncio.Event().wait()
        else:
            await bluetooth(stop)
    finally:
        stop.set()
        http.shutdown()
        http.server_close()
        worker.join(timeout=5)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--no-ble", action="store_true")
    parser.add_argument("--port", type=int, default=8765)
    try:
        asyncio.run(run(parser.parse_args()))
    except KeyboardInterrupt:
        pass
