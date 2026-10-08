import unittest
from canonical_stream import command_layout
from canonical_projector import CompactProjector

class RecordingOutcomeEvidenceTests(unittest.TestCase):
    def test_real_de_resign_retains_disconnect_flag_and_rejects_unknown_layout(self):
        raw=bytes.fromhex('01000000050000000b010100001d0a2200')
        self.assertEqual(command_layout(raw,'RESIGN'),{'layout':'de_legacy_resign_v1','playerIdRaw':1,'disconnectedRaw':0})
        disconnected=bytearray(raw);disconnected[11]=1
        self.assertEqual(command_layout(bytes(disconnected),'RESIGN')['disconnectedRaw'],1)
        unknown=bytearray(raw);unknown[10]=2
        self.assertNotEqual(command_layout(bytes(unknown),'RESIGN')['layout'],'de_legacy_resign_v1')

    def test_projected_resignation_keeps_chronology_and_unknown_is_not_false(self):
        projector=CompactProjector({1})
        event={'sourceOperation':'ACTION','sourceActionName':'RESIGN','payload':{'_rawLayout':{'layout':'de_legacy_resign_v1','disconnectedRaw':0}},'decode':{'status':'decoded'},'actorPlayerId':1,'timestampMs':2230813,'eventId':'e','operationOrdinal':348010,'eventType':'command.resign'}
        projector.consume(event)
        self.assertEqual(projector.finish()['resignations'][0]['disconnected'],False)
        projector.consume({**event,'eventId':'unknown','payload':{}})
        self.assertIsNone(projector.finish()['resignations'][1]['disconnected'])
        self.assertEqual(projector.finish()['resignations'][0]['operationOrdinal'],348010)
