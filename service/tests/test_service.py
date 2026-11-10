import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from protocol import packets
import main

class ProtocolTests(unittest.TestCase):
    def test_roundtrip_minimum_mtu(self):
        source={"v":1,"metrics":{"RPM":[1200,"rpm",123]},"label":"Тест"}
        chunks=packets(source,257)
        self.assertTrue(all(len(c)<=20 for c in chunks))
        self.assertEqual([c[2] for c in chunks],list(range(len(chunks))))
        self.assertTrue(all(c[:2]==bytes([1,1]) and c[3]==len(chunks) for c in chunks))
        self.assertEqual(json.loads(b"".join(c[4:] for c in chunks)),source)
    def test_oversize_rejected(self):
        with self.assertRaises(ValueError):packets({"x":"a"*5000},0)
    def test_snapshot_is_detached(self):
        main.publish("connected",{"RPM":[1200,"rpm",123]})
        copy=main.snapshot();copy["metrics"]["RPM"][0]=0
        self.assertEqual(main.snapshot()["metrics"]["RPM"][0],1200)
    def test_full_snapshot_fits(self):
        main.publish("connected",{k:[123.45,u,1800000000.123] for k,(_,u) in main.METRICS.items()})
        self.assertLess(len(packets(main.snapshot(),0)),255)
if __name__=='__main__':unittest.main()
