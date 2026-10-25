"""Adapter conformance fixture: synthetic requests, never social positives."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from int_c2a_preview import preview_candidates_from_analysis
from int_c1_preview import preview_from_analysis
from test_int_c1_preview import bundle


def fixture():
    b,stats,analysis=bundle()
    stats['scope']={'observedUntilMs':20000}
    stats['pairSocialEvidence']['observations']=b['pair_observations']
    stats['statisticsProjectionVersion']='AOF_RECORDED_EVENTS_STATISTICS_V1'
    stats['matchFacts']={'players':[{'playerId':p['playerId'],'lobbyTeamIdRaw':p['playerId']} for p in stats['participants']],
                        'rules':{'lockTeams':{'value':True,'status':'DECODED'}}}
    # One source-connected episode with two chronologically distinct deeds.
    # Prior context for the later deed includes activity after the first action.
    d=deepcopy(stats['pairSocialEvidence']['deeds'][0]);d.update(deedId='deed-late',sourceEventIds=['late-cmd'],
        startedAt={'atMs':15000,'operationOrdinal':30},endedAt={'atMs':19000,'operationOrdinal':40},
        facets=[{'kind':'TARGETED_COMMAND','fromPlayerId':1,'toPlayerId':2,'sourceEventIds':['late-cmd']}])
    stats['pairSocialEvidence']['deeds'].append(d)
    stats['pairSocialEvidence']['observations'].append({'sourceEventId':'late-cmd','actorPlayerId':1,'moment':{'atMs':16000,'operationOrdinal':31}})
    analysis['actionEvents'] += [{'eventId':'late-cmd','actorPlayerId':1,'timestampMs':16000,'operationOrdinal':31,'sourceActionName':'ORDER'},
        {'eventId':'prior-late','actorPlayerId':1,'timestampMs':14500,'operationOrdinal':29,'sourceActionName':'QUEUE'}]
    return dict(snapshot=b['snapshot'],statistics=stats,analysis=analysis,
                historical_order={'leagueOrderKey':None,'gameNumber':1,'order':'UNKNOWN'})

class AdapterTests(unittest.TestCase):
    def test_old_wire_unchanged_new_producer_unauthenticated_and_pending(self):
        f=fixture();r=preview_candidates_from_analysis(**f)
        self.assertEqual(r['legacy'],preview_from_analysis(**f))
        p=r['producer'];self.assertFalse(p['gameScopeAuthenticated'])
        self.assertTrue(p['candidateEpisodeGroups']);self.assertEqual(p['claims'],[])
        self.assertTrue(all(g['grade']['decision']=='PENDING' and g['grade']['bandId'] is None and g['coverage']['tier']=='LIMITED'
                            for g in p['candidateEpisodeGroups']))
        self.assertEqual(p['gameScope']['authorityRevision'],f['snapshot']['authorityRevision'])
        self.assertFalse(p['actorWitnesses']);self.assertFalse(p['receipts'])
        self.assertEqual(r,preview_candidates_from_analysis(**deepcopy(f)))
        group=p['candidateEpisodeGroups'][0]
        self.assertIn('prior-late',group['opportunity']['sourceEventIds'])
        self.assertGreater(next(w['atMs'] for w in r['sourceWitnesses'] if w['sourceEventId']=='prior-late'),group['window']['startMs'])

    def test_checked_in_cross_language_fixture(self):
        saved=json.loads((Path(__file__).resolve().parents[2]/'functions/tests/fixtures/int-c2a-synthetic.json').read_text())
        actual=preview_candidates_from_analysis(**saved['input'])
        # Executable/decoder hash is pinned from the actual candidate at runtime,
        # not a golden fixture's environment-dependent processor installation.
        actual['legacy']['processorRevision']=saved['output']['legacy']['processorRevision']
        self.assertEqual(actual,saved['output'])

    def test_upload_order_swapped_original_actor_and_unknown_clock_cannot_admit(self):
        f=fixture();f['historical_order']['leagueOrderKey']='upload-timestamp'
        with self.assertRaisesRegex(ValueError,'ORDER_NOT_ADMITTED'):preview_candidates_from_analysis(**f)
        f=fixture();f['analysis']['source']['replaySha256']='f'*64
        with self.assertRaisesRegex(ValueError,'SOURCE_MISMATCH'):preview_candidates_from_analysis(**f)
        f=fixture();f['analysis']['actionEvents'][0]['operationOrdinal']=None
        r=preview_candidates_from_analysis(**f)
        self.assertEqual(r['producer']['candidateEpisodeGroups'][0]['firstSourceMoment']['order'],'PARTIAL')

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--fixture':
        f=fixture();json.dump({'input':f,'output':preview_candidates_from_analysis(**f)},sys.stdout,separators=(',',':'))
    else:unittest.main()
