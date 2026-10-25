"""C1 wiring negatives, not an approved calibration or authentic earned conduct."""
from copy import deepcopy
import unittest
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from int_c1_preview import contribution_groups,preview_from_analysis
from test_social_v1_source_measurements import synthetic_bundle

def bundle():
    b,stats,actions=synthetic_bundle(kind='contest',contest=True)
    source=stats['source']
    source.pop('canonicalManifestSha256',None);source.pop('canonicalSchemaVersion',None)
    source.update(recordedEventsSha256='b'*64,recordedEventsVersion='AOF_RECORDED_EVENTS_V1',extractionRunId='synthetic')
    stats['pairSocialEvidence']['gameScope']=deepcopy(source)
    b['context']['sourceRevision']=deepcopy(source)
    s=b['snapshot'];s['artifactRefs']=[{'kind':k,'digest':'b'*64,'generation':'1'} for k in ['STATISTICS','RECORDED_EVENTS','ORIGINAL']]
    return b,stats,{'source':deepcopy(source),'actionEvents':actions}

class PreviewTests(unittest.TestCase):
    def test_original_overlap_is_one_contribution_group_and_independent_originals_are_distinct(self):
        s={'gameGuid':'g','sourceHash':'a'*64}
        deeds=[{'deedId':'raid','sourceEventIds':['a'],'incidentIds':['raid-1']},
               {'deedId':'pressure','sourceEventIds':['a','b'],'incidentIds':[]},
               {'deedId':'contact','sourceEventIds':['c'],'incidentIds':['raid-1']},
               {'deedId':'other','sourceEventIds':['d'],'incidentIds':[]}]
        groups=contribution_groups(deeds,s)
        self.assertEqual(groups['raid'],groups['pressure']);self.assertEqual(groups['raid'],groups['contact'])
        self.assertNotEqual(groups['raid'],groups['other'])
        self.assertEqual(groups,contribution_groups(list(reversed(deeds)),s))
        self.assertNotEqual(groups,contribution_groups(deeds,{**s,'sourceHash':'f'*64}))

    def test_existing_source_descriptors_and_qualifier_down_gate_every_candidate(self):
        b,stats,analysis=bundle()
        # Synthetic isolated Context seam; actual full Context+decoder are exercised
        # with original recordings in the authenticated four-format emulator job.
        with patch('int_c1_preview.project_social_v1_context',return_value=b['context']):
            r=preview_from_analysis(snapshot=b['snapshot'],statistics=stats,analysis=analysis,historical_order=b['historical_order'])
        self.assertTrue(r['grades']);self.assertTrue(r['effects'])
        self.assertTrue(all(g['actorPlayerId']=='p1' and g['counterpartPlayerId']=='p2' for g in r['grades']))
        self.assertTrue(all(g['raw']['opportunity'] is None and g['grade']['bandId'] is None for g in r['grades']))
        self.assertTrue(all(i['decision']=='PENDING' and i['significanceBandId'] is None for i in r['inferences']))
        self.assertTrue(all(e['claim']['decision']=='PENDING' and not e['claim']['reciprocity']['independentActorRefs'] for e in r['effects']))
        self.assertEqual(r['actorWitnesses'],[]);self.assertFalse(r['officialWrites']);self.assertFalse(r['publicationAllowed'])
        self.assertEqual(len({g['contributionGroupId'] for g in r['grades']}),1)

    def test_wrong_original_and_forged_actor_do_not_produce_conduct(self):
        b,stats,analysis=bundle();analysis['source']['replaySha256']='f'*64
        with self.assertRaisesRegex(ValueError,'SOURCE_MISMATCH'):
            preview_from_analysis(snapshot=b['snapshot'],statistics=stats,analysis=analysis,historical_order=b['historical_order'])
        b,stats,analysis=bundle();analysis['actionEvents'][0]['actorPlayerId']=2
        with patch('int_c1_preview.project_social_v1_context',return_value=b['context']):
            r=preview_from_analysis(snapshot=b['snapshot'],statistics=stats,analysis=analysis,historical_order=b['historical_order'])
        self.assertFalse(r['grades']);self.assertFalse(r['effects'])

if __name__=='__main__':unittest.main()
