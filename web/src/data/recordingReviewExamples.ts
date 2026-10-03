// Real, abbreviated audit records. Never assigned to an illustrative league Battle.
export const recordingReviewExamples = [
  {
    "source": {
      "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
      "canonicalManifestSha256": "d9097d3e5048583fd76852d68b470cd7ed2a06d3425f2b2a621b891bc5c3d5cd",
      "extractionRunId": "c266b040-6b82-4e46-87e7-f3ce80fc31ea",
      "canonicalSchemaVersion": "1.1.0",
      "parserVersion": "mgz-fast/1.0.0"
    },
    "recordingMatchFacts": {
      "modelVersion": "AOF_RECORDING_MATCH_FACTS_V1",
      "game": {
        "guid": "848628a5-934d-e64b-8d79-59c60040918a",
        "observedDurationMs": 2230813,
        "completionStatus": "unknown",
        "durationMeaning": "observed_recording_interval_not_proven_full_game",
        "recordingVersion": {
          "version": "DE",
          "game_version": "VER 9.4",
          "save_version": 68,
          "log_version": 5
        }
      },
      "map": {
        "mapId": 9,
        "mapName": null,
        "rmsFileName": null,
        "rmsModId": null,
        "seed": 0,
        "width": 120,
        "height": 120,
        "coordinateSystem": "aoe2_world_xy_origin_top_left",
        "identityMeaning": "decoded_ids_and_rms_metadata_not_qualified_map_label"
      },
      "ruleValues": {
        "allTechnologies": false,
        "difficultyId": 0,
        "endingAgeId": 3,
        "gameTypeId": 0,
        "lockTeams": true,
        "mapId": 9,
        "mapSize": 0,
        "multiplayer": true,
        "population": 200,
        "rated": true,
        "revealMapId": 0,
        "rmsFilename": null,
        "rmsModId": null,
        "seed": 0,
        "speed": 1.690000057220459,
        "startingAgeId": 0,
        "startingResourcesId": 0,
        "teamTogether": true,
        "treatyLength": 0,
        "victoryTypeId": 1
      },
      "lobbyGroups": [
        {
          "lobbyTeamIdRaw": 2,
          "memberPlayerIds": [
            1
          ],
          "effectiveAllianceEstablished": false
        },
        {
          "lobbyTeamIdRaw": 3,
          "memberPlayerIds": [
            2
          ],
          "effectiveAllianceEstablished": false
        }
      ],
      "resultQualification": "UNRESOLVED",
      "postgameEventCount": 1,
      "resignationEventCount": 1,
      "headerSource": {
        "byteLength": 28064,
        "encoding": "gzip",
        "sha256": "d278671bf9649d4dee076f6e70a19645f6379f6e48a2bd8d2e136cd171332e71",
        "uri": "decoded-header.json.gz"
      }
    },
    "playerCount": 2,
    "participants": [
      {
        "playerId": 1,
        "lobbyTeamId": 2
      },
      {
        "playerId": 2,
        "lobbyTeamId": 3
      }
    ],
    "settings": {
      "allTechnologies": false,
      "difficultyId": 0,
      "endingAgeId": 3,
      "gameTypeId": 0,
      "initialDiplomacyRaw": {
        "1": [
          0,
          1,
          4
        ],
        "2": [
          0,
          4,
          1
        ]
      },
      "lockTeams": true,
      "mapId": 9,
      "mapSize": 0,
      "multiplayer": true,
      "population": 200,
      "rated": true,
      "revealMapId": 0,
      "rmsFilename": null,
      "rmsModId": null,
      "seed": 0,
      "speed": 1.690000057220459,
      "startingAgeId": 0,
      "startingResourcesId": 0,
      "teamTogether": true,
      "treatyLength": 0,
      "victoryTypeId": 1
    },
    "gameGuid": "848628a5-934d-e64b-8d79-59c60040918a",
    "observedUntilMs": 2230813,
    "incidentCounts": {
      "DIRECTED_PRESSURE": 7,
      "LOCAL_CONTEST": 14
    },
    "deedCount": 15,
    "pressureDirections": {
      "1->2": 4,
      "2->1": 3
    },
    "contextCounts": {
      "PRESSURE_RESPONSE": 7,
      "RETURN_PRESSURE": 1
    },
    "contextDiagnosticCounts": {
      "RETURN_PRESSURE_INDEPENDENCE_UNAVAILABLE": 2
    },
    "ledgerDiagnosticCounts": {
      "MULTIPLE_PRESSURE_ROOTS_NOT_MERGED": 2
    },
    "responseCommandTypes": {
      "MOVE": 5,
      "ORDER": 2
    },
    "coverageCounts": {
      "DEFENSIVE_SUPPORT_WITH_PRESSURE:NOT_APPLICABLE": 2,
      "PRESSURE_RESPONSE:QUALIFIED": 2,
      "RETURN_PRESSURE:QUALIFIED": 2
    },
    "samples": {
      "PRESSURE_RESPONSE": [
        {
          "contextId": "context-1d8e262054e12b62e5c0368b3f2f76680a73eff7734fa1db6f1ad6c2d68f9642",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-f1f72772f804e3f1ec7c3ada628422bba6ce86ad0b1de4ac6dbac0bd22d425c0",
          "pressureDeedId": "deed-89cf583ccd4e975e132bd56076feff935785ac8c72a3f17d514b6a6759f02812",
          "pairPlayerIds": [
            1,
            2
          ],
          "pressureDirection": {
            "fromPlayerId": 2,
            "toPlayerId": 1
          },
          "responseActorPlayerId": 1,
          "responseSourceEventId": "op-000062630",
          "responseMoment": {
            "atMs": 403299,
            "operationOrdinal": 62630
          },
          "responseCommandType": "ORDER",
          "sourceLatencyMs": 208,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000061833",
            "op-000061899",
            "op-000062183",
            "op-000062248",
            "op-000062280",
            "op-000062343"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 183,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 79.23395538330078,
            "y": 28.287137985229492,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 13.792,
          "pressureStartedAt": {
            "atMs": 398216,
            "operationOrdinal": 61833
          }
        },
        {
          "contextId": "context-31d429800a21580c788a1d8d3f872789dc60214a171407e62af940838f3604db",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-ee29a9f9a93e3029ff023402e164cd069d8b961ec462fef7b2587a4c18f72c0f",
          "pressureDeedId": "deed-fcd51e4bc1f3d71477aa3db040305b57cac66de4f45aa93d032733ec8fc4b42a",
          "pairPlayerIds": [
            1,
            2
          ],
          "pressureDirection": {
            "fromPlayerId": 2,
            "toPlayerId": 1
          },
          "responseActorPlayerId": 1,
          "responseSourceEventId": "op-000275090",
          "responseMoment": {
            "atMs": 1763632,
            "operationOrdinal": 275090
          },
          "responseCommandType": "MOVE",
          "sourceLatencyMs": 8333,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000273510",
            "op-000273794",
            "op-000274899",
            "op-000275090",
            "op-000275596",
            "op-000277020"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 176,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 81.91666412353516,
            "y": 38.5,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 2.903,
          "pressureStartedAt": {
            "atMs": 1753466,
            "operationOrdinal": 273510
          }
        }
      ],
      "RETURN_PRESSURE": [
        {
          "contextId": "context-b4b6afd215e6e639319c2c62e163296da930a105bfe761094b96c6fd8bb3fda9",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            1,
            2
          ],
          "previousPressureIncidentId": "incident-5d0e109f9a781eccabe8e98cd7240c6c83ce1f5b8aedd3655e19b307a9019a1d",
          "previousPressureDeedId": "deed-7cd0b3f62482fc7d5f75c15a5556cbad9ccb9a41c5e74f61f69d6fbe4daa13b6",
          "returnPressureIncidentId": "incident-08304f43ea3eb4e8faae8e163b551f1c6fe58d91c1f5db269aa676914c5c0ee7",
          "returnPressureDeedId": "deed-93a4447fe336e83d56347aba3951bbd776830724c4d0699e58ea611c9bab000b",
          "previousDirection": {
            "fromPlayerId": 1,
            "toPlayerId": 2
          },
          "returnDirection": {
            "fromPlayerId": 2,
            "toPlayerId": 1
          },
          "previousEndedAt": {
            "atMs": 1153438,
            "operationOrdinal": 179811
          },
          "returnStartedAt": {
            "atMs": 1477216,
            "operationOrdinal": 230358
          },
          "sourceEventIds": [
            "op-000142929",
            "op-000144883",
            "op-000146652",
            "op-000146687",
            "op-000146751",
            "op-000146848"
          ],
          "relationContext": "FIXED_OPPONENTS",
          "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
          "sourceModelVersion": "AOF_RAID_DETECTION_V3",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 142
        }
      ]
    },
    "ledgerSamples": {
      "DIRECTED_PRESSURE": [
        {
          "incidentId": "incident-f1f72772f804e3f1ec7c3ada628422bba6ce86ad0b1de4ac6dbac0bd22d425c0",
          "pairPlayerIds": [
            1,
            2
          ],
          "startedAt": {
            "atMs": 398216,
            "operationOrdinal": 61833
          },
          "relationContext": "FIXED_OPPONENTS",
          "facets": [
            {
              "kind": "ECONOMY_PRESSURE",
              "fromPlayerId": 2,
              "toPlayerId": 1,
              "attributionMethods": [
                "economic_zone_proximity",
                "target_instance_controller"
              ],
              "sourceEventIds": [
                "op-000061833",
                "op-000061899",
                "op-000062183",
                "op-000062248",
                "op-000062280",
                "op-000062343"
              ],
              "outcomes": "UNAVAILABLE",
              "sourceEventCount": 182
            }
          ],
          "context": {
            "center": {
              "x": 92.79,
              "y": 30.83
            },
            "victimResolutionMethods": [
              "economic_zone_proximity",
              "target_instance_controller"
            ]
          }
        }
      ],
      "LOCAL_CONTEST": [
        {
          "incidentId": "incident-c2e9a9dd6bc987dd56284c3a48ff08ffc9e3ee5dfc91468727b5e1b762994c59",
          "pairPlayerIds": [
            1,
            2
          ],
          "startedAt": {
            "atMs": 399438,
            "operationOrdinal": 62024
          },
          "relationContext": "FIXED_OPPONENTS",
          "facets": [
            {
              "kind": "LOCAL_COMMAND_OVERLAP",
              "contributorPlayerId": 1,
              "otherPlayerId": 2,
              "sourceEventIds": [
                "op-000062024",
                "op-000062151",
                "op-000062182",
                "op-000062183",
                "op-000062248",
                "op-000062279"
              ],
              "targetedActionEstablished": false,
              "sourceEventCount": 23
            },
            {
              "kind": "LOCAL_COMMAND_OVERLAP",
              "contributorPlayerId": 2,
              "otherPlayerId": 1,
              "sourceEventIds": [
                "op-000062024",
                "op-000062151",
                "op-000062182",
                "op-000062183",
                "op-000062248",
                "op-000062279"
              ],
              "targetedActionEstablished": false,
              "sourceEventCount": 23
            },
            {
              "kind": "TARGETED_COMMAND",
              "fromPlayerId": 1,
              "toPlayerId": 2,
              "sourceEventIds": [
                "op-000062630"
              ],
              "outcomes": "UNAVAILABLE",
              "targetEvidence": [
                {
                  "sourceEventId": "op-000062630",
                  "targetInstanceId": 3086,
                  "controllerEvidence": {
                    "sourceEventId": "op-000045924",
                    "controllerPlayerId": 2,
                    "moment": {
                      "atMs": 296049,
                      "operationOrdinal": 45924
                    },
                    "basis": "selected_by_actor"
                  }
                }
              ],
              "sourceEventCount": 1
            },
            {
              "kind": "TARGETED_COMMAND",
              "fromPlayerId": 2,
              "toPlayerId": 1,
              "sourceEventIds": [
                "op-000062597"
              ],
              "outcomes": "UNAVAILABLE",
              "targetEvidence": [
                {
                  "sourceEventId": "op-000062597",
                  "targetInstanceId": 3084,
                  "controllerEvidence": {
                    "sourceEventId": "op-000054743",
                    "controllerPlayerId": 1,
                    "moment": {
                      "atMs": 352716,
                      "operationOrdinal": 54743
                    },
                    "basis": "selected_by_actor"
                  }
                }
              ],
              "sourceEventCount": 1
            }
          ],
          "context": {
            "center": {
              "x": 82.82,
              "y": 27.9
            },
            "battlePromotion": true
          }
        }
      ]
    },
    "relicTargetingObservationCount": 2,
    "reviewBoundary": "source-backed command episodes; no confirmed damage, motives or engine outcomes",
    "teamLockRebuildComparison": {
      "comparisonKind": "isolated_legacy_lobby_lock_counterfactual",
      "notDeployedHistoricalStatistics": true,
      "requiresFreshCanonicalExtractionForSourceCorrection": true,
      "legacyLobbyLockTeams": false,
      "decodedDeLockTeams": true,
      "metricScope": [
        "cooperativeAttacks",
        "defensiveAssistsGiven",
        "defensiveAssistsReceived",
        "raidResponseSeconds",
        "raidsInitiated",
        "raidsReceived",
        "rawApm",
        "resourceCommitment",
        "skirmishes"
      ],
      "changes": [],
      "activeStatisticsReplaced": false
    },
    "id": "paired-duel-pov-1",
    "replayPath": "replay-fixtures/1v1_1.aoe2record",
    "logicalGameGroup": "paired-duel",
    "canonicalSealMode": "fast",
    "canonicalSealState": "sealed_local_fast",
    "checks": {
      "statisticsAndNeutralLedgerUnchanged": true,
      "analysisUnchanged": true,
      "rebuildIdentical": true,
      "duplicateReorderedIdentical": true,
      "allContextReferencesValidated": true
    },
    "sourceCommit": "952b68d3b4858bf10fb9000a78aac92e7ba4e29d"
  },
  {
    "source": {
      "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
      "canonicalManifestSha256": "8df08d68a4ef8ec8a6b79cd6dd663734de16005c97512da2698fffe6c36ade25",
      "extractionRunId": "222dff3c-efa8-4279-8fd6-261dd1e3e1f4",
      "canonicalSchemaVersion": "1.1.0",
      "parserVersion": "mgz-fast/1.0.0"
    },
    "recordingMatchFacts": {
      "modelVersion": "AOF_RECORDING_MATCH_FACTS_V1",
      "game": {
        "guid": "d87db6f6-e2ea-744a-91a6-ec52a553c0de",
        "observedDurationMs": 3295040,
        "completionStatus": "unknown",
        "durationMeaning": "observed_recording_interval_not_proven_full_game",
        "recordingVersion": {
          "version": "DE",
          "game_version": "VER 9.4",
          "save_version": 68,
          "log_version": 5
        }
      },
      "map": {
        "mapId": 17,
        "mapName": null,
        "rmsFileName": null,
        "rmsModId": null,
        "seed": 0,
        "width": 220,
        "height": 220,
        "coordinateSystem": "aoe2_world_xy_origin_top_left",
        "identityMeaning": "decoded_ids_and_rms_metadata_not_qualified_map_label"
      },
      "ruleValues": {
        "allTechnologies": false,
        "difficultyId": 0,
        "endingAgeId": 3,
        "gameTypeId": 0,
        "lockTeams": true,
        "mapId": 17,
        "mapSize": 0,
        "multiplayer": true,
        "population": 200,
        "rated": true,
        "revealMapId": 0,
        "rmsFilename": null,
        "rmsModId": null,
        "seed": 0,
        "speed": 1.690000057220459,
        "startingAgeId": 0,
        "startingResourcesId": 0,
        "teamTogether": true,
        "treatyLength": 0,
        "victoryTypeId": 1
      },
      "lobbyGroups": [
        {
          "lobbyTeamIdRaw": 2,
          "memberPlayerIds": [
            1,
            3,
            5,
            7
          ],
          "effectiveAllianceEstablished": false
        },
        {
          "lobbyTeamIdRaw": 3,
          "memberPlayerIds": [
            2,
            4,
            6,
            8
          ],
          "effectiveAllianceEstablished": false
        }
      ],
      "resultQualification": "UNRESOLVED",
      "postgameEventCount": 1,
      "resignationEventCount": 4,
      "headerSource": {
        "byteLength": 116332,
        "encoding": "gzip",
        "sha256": "d6d4ac22115c91539c0589923db6a93ef5ce13fcfd7ac99029f6c2eba99d506b",
        "uri": "decoded-header.json.gz"
      }
    },
    "playerCount": 8,
    "participants": [
      {
        "playerId": 1,
        "lobbyTeamId": 2
      },
      {
        "playerId": 2,
        "lobbyTeamId": 3
      },
      {
        "playerId": 3,
        "lobbyTeamId": 2
      },
      {
        "playerId": 4,
        "lobbyTeamId": 3
      },
      {
        "playerId": 5,
        "lobbyTeamId": 2
      },
      {
        "playerId": 6,
        "lobbyTeamId": 3
      },
      {
        "playerId": 7,
        "lobbyTeamId": 2
      },
      {
        "playerId": 8,
        "lobbyTeamId": 3
      }
    ],
    "settings": {
      "allTechnologies": false,
      "difficultyId": 0,
      "endingAgeId": 3,
      "gameTypeId": 0,
      "initialDiplomacyRaw": {
        "1": [
          0,
          1,
          4,
          2,
          4,
          2,
          4,
          2,
          4
        ],
        "2": [
          0,
          4,
          1,
          4,
          2,
          4,
          2,
          4,
          2
        ],
        "3": [
          0,
          2,
          4,
          1,
          4,
          2,
          4,
          2,
          4
        ],
        "4": [
          0,
          4,
          2,
          4,
          1,
          4,
          2,
          4,
          2
        ],
        "5": [
          0,
          2,
          4,
          2,
          4,
          1,
          4,
          2,
          4
        ],
        "6": [
          0,
          4,
          2,
          4,
          2,
          4,
          1,
          4,
          2
        ],
        "7": [
          0,
          2,
          4,
          2,
          4,
          2,
          4,
          1,
          4
        ],
        "8": [
          0,
          4,
          2,
          4,
          2,
          4,
          2,
          4,
          1
        ]
      },
      "lockTeams": true,
      "mapId": 17,
      "mapSize": 0,
      "multiplayer": true,
      "population": 200,
      "rated": true,
      "revealMapId": 0,
      "rmsFilename": null,
      "rmsModId": null,
      "seed": 0,
      "speed": 1.690000057220459,
      "startingAgeId": 0,
      "startingResourcesId": 0,
      "teamTogether": true,
      "treatyLength": 0,
      "victoryTypeId": 1
    },
    "gameGuid": "d87db6f6-e2ea-744a-91a6-ec52a553c0de",
    "observedUntilMs": 3295040,
    "incidentCounts": {
      "ALLIED_SUPPORT": 13,
      "DIRECTED_PRESSURE": 36,
      "LOCAL_CONTEST": 58,
      "SHARED_OFFENSIVE_PARTICIPATION": 25
    },
    "deedCount": 115,
    "pressureDirections": {
      "1->2": 3,
      "1->4": 4,
      "2->3": 1,
      "2->7": 1,
      "3->6": 5,
      "3->8": 2,
      "4->1": 2,
      "4->3": 2,
      "4->5": 1,
      "4->7": 4,
      "5->4": 2,
      "5->6": 2,
      "5->8": 2,
      "6->3": 2,
      "7->2": 2,
      "8->5": 1
    },
    "contextCounts": {
      "DEFENSIVE_SUPPORT_WITH_PRESSURE": 7,
      "PRESSURE_RESPONSE": 25,
      "RETURN_PRESSURE": 6
    },
    "contextDiagnosticCounts": {
      "AMBIGUOUS_RESPONSE_PRESSURE": 2,
      "RETURN_PRESSURE_INDEPENDENCE_UNAVAILABLE": 2
    },
    "ledgerDiagnosticCounts": {
      "MULTIPLE_PRESSURE_ROOTS_NOT_MERGED": 2
    },
    "responseCommandTypes": {
      "DE_ATTACK_MOVE": 1,
      "MOVE": 11,
      "ORDER": 8,
      "TOWN_BELL": 5
    },
    "coverageCounts": {
      "DEFENSIVE_SUPPORT_WITH_PRESSURE:NOT_APPLICABLE": 32,
      "DEFENSIVE_SUPPORT_WITH_PRESSURE:QUALIFIED": 24,
      "PRESSURE_RESPONSE:NOT_APPLICABLE": 24,
      "PRESSURE_RESPONSE:QUALIFIED": 32,
      "RETURN_PRESSURE:NOT_APPLICABLE": 24,
      "RETURN_PRESSURE:QUALIFIED": 32
    },
    "samples": {
      "DEFENSIVE_SUPPORT_WITH_PRESSURE": [
        {
          "contextId": "context-126acbf4fca199f972c07393a9c86efd0d5d881c4dff5669ed461366fde4e5b3",
          "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
          "supportIncidentId": "incident-8d8bd75b9ac56615f8dac165faa3789db16368f61be3bc9ebf8736132d7b8ad3",
          "supportDeedId": "deed-3bd9b519fd39139b934bf5af498848dadfd59d4af92a5005bfb122b33ff9896d",
          "pressureIncidentId": "incident-c23da5f0b2ac640b6cc9ce7cd27a9ecdad5d1c18f8f2f205557fe5f859f9e400",
          "pressureDeedId": "deed-181730721d861e63b9dc83e6b256f5e05949375dc439e848d4cb9f27deca0ae5",
          "pairPlayerIds": [
            1,
            7
          ],
          "supportDirection": {
            "fromPlayerId": 1,
            "toPlayerId": 7
          },
          "pressureDirection": {
            "fromPlayerId": 4,
            "toPlayerId": 7
          },
          "sourceEventIds": [
            "op-000045334",
            "op-000045386",
            "op-000048319",
            "op-000048347",
            "op-000048360",
            "op-000048411"
          ],
          "parentSourceEventIds": [
            "op-000048319",
            "op-000048347",
            "op-000048360",
            "op-000048411",
            "op-000048424",
            "op-000048451"
          ],
          "contestIncidentIds": [
            "incident-ddc7c4199865acaf8a35762d2874f9c1f97ddad19221c9ca41bcad08aaf7680c"
          ],
          "sourceModelVersion": "AOF_ENGAGEMENT_STATISTICS_V4",
          "associationBasis": "same_inferred_defensive_clash_with_exact_opponent_pair",
          "directHelperAttackOnPressureActorEstablished": false,
          "relationContext": "FIXED_ALLIES",
          "continuousPressureEstablished": false,
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 54,
          "parentSourceEventCount": 55
        },
        {
          "contextId": "context-60cceb7520f5b69cd0a176e793656e1d3bc23e52499a341cc667f471af11d6eb",
          "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
          "supportIncidentId": "incident-56311851fdb5fd6857e55b9486cbfe21c57bd62f707dde6f58e7f48be32c37f1",
          "supportDeedId": "deed-0308e25b09c19810ed46619e0ccc1b4b876148b39a0b7dc6a8db33388750d631",
          "pressureIncidentId": "incident-daa63b046c5817492ca39eaa83ed15e2417b5ffda16f361797e975497a14e68e",
          "pressureDeedId": "deed-2af607ca5a3aceb3a9c6047cd1577f2bf5f1aab62647eeddc7ec72b2eb32d65f",
          "pairPlayerIds": [
            2,
            4
          ],
          "supportDirection": {
            "fromPlayerId": 4,
            "toPlayerId": 2
          },
          "pressureDirection": {
            "fromPlayerId": 7,
            "toPlayerId": 2
          },
          "sourceEventIds": [
            "op-000064924",
            "op-000064938",
            "op-000064973",
            "op-000065034",
            "op-000065125",
            "op-000065139"
          ],
          "parentSourceEventIds": [
            "op-000064924",
            "op-000064938",
            "op-000064973",
            "op-000065006",
            "op-000065034",
            "op-000065099"
          ],
          "contestIncidentIds": [
            "incident-621c65f1e63f204ac4d6713e2e7e94266f3765621745584b1c96f16dbf2ad98f"
          ],
          "sourceModelVersion": "AOF_ENGAGEMENT_STATISTICS_V4",
          "associationBasis": "same_inferred_defensive_clash_with_exact_opponent_pair",
          "directHelperAttackOnPressureActorEstablished": false,
          "relationContext": "FIXED_ALLIES",
          "continuousPressureEstablished": false,
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 68,
          "parentSourceEventCount": 141
        }
      ],
      "PRESSURE_RESPONSE": [
        {
          "contextId": "context-057d29fd06b100d3c5be555f5fabec4f351aa971450c3f21a32cb32127729e0f",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-89fd2b2eb8f539a38baaefa328c89a3b0cb771e976847eb7f20f2b2cb34c37ce",
          "pressureDeedId": "deed-7557c84dc9ff5de3fad76bc63d22af7adc678852e0f9373e5c29bd1f32597c7a",
          "pairPlayerIds": [
            5,
            6
          ],
          "pressureDirection": {
            "fromPlayerId": 5,
            "toPlayerId": 6
          },
          "responseActorPlayerId": 6,
          "responseSourceEventId": "op-000089191",
          "responseMoment": {
            "atMs": 1419360,
            "operationOrdinal": 89191
          },
          "responseCommandType": "ORDER",
          "sourceLatencyMs": 10725,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000085103",
            "op-000087482",
            "op-000087522",
            "op-000088211",
            "op-000088494",
            "op-000089191"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 21,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 48,
            "y": 136,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 10.836,
          "pressureStartedAt": {
            "atMs": 1350781,
            "operationOrdinal": 85103
          }
        },
        {
          "contextId": "context-186f8d9c801a9226d29a6b2745bcaa6fa9db8ec1200ed1a5ba58a913762d0455",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-0a79e52ff72ab3d53039af04632ae92c58987e3a06f26bbe0580e847bb82acfc",
          "pressureDeedId": "deed-ae1287cddaaa39daf785065dd5953d4cf22073e2c4aa6fb169bdcd9496bfe2f4",
          "pairPlayerIds": [
            5,
            6
          ],
          "pressureDirection": {
            "fromPlayerId": 5,
            "toPlayerId": 6
          },
          "responseActorPlayerId": 6,
          "responseSourceEventId": "op-000122968",
          "responseMoment": {
            "atMs": 2036390,
            "operationOrdinal": 122968
          },
          "responseCommandType": "MOVE",
          "sourceLatencyMs": 1680,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000119888",
            "op-000119899",
            "op-000121323",
            "op-000121344",
            "op-000121355",
            "op-000121367"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 68,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 70.17708587646484,
            "y": 158.4270782470703,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 20.534,
          "pressureStartedAt": {
            "atMs": 1975276,
            "operationOrdinal": 119888
          }
        }
      ],
      "RETURN_PRESSURE": [
        {
          "contextId": "context-22a1ed45900c8f097bf23cade14359acc35e259de0586dac2d0328f498bd35c7",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            5,
            8
          ],
          "previousPressureIncidentId": "incident-a903ca6d74be81491c42d91a29e559352879a176bbc8567a72a05f98253d90cc",
          "previousPressureDeedId": "deed-3f1a5079a3e464f86a745cc31caa02b35308dc1216ac7e25bf3227cbbfcb2364",
          "returnPressureIncidentId": "incident-8b03c16f1d99c8292f2dced376a1c8fd5f9933d47c4bc77f1ab0cc79d843e113",
          "returnPressureDeedId": "deed-a307ee3535c9d201965598ddd0131b80dfe40cc0241967475ac4125354960c3e",
          "previousDirection": {
            "fromPlayerId": 5,
            "toPlayerId": 8
          },
          "returnDirection": {
            "fromPlayerId": 8,
            "toPlayerId": 5
          },
          "previousEndedAt": {
            "atMs": 3004206,
            "operationOrdinal": 172167
          },
          "returnStartedAt": {
            "atMs": 3277826,
            "operationOrdinal": 185980
          },
          "sourceEventIds": [
            "op-000167722",
            "op-000170022",
            "op-000170086",
            "op-000172167",
            "op-000185980",
            "op-000186032"
          ],
          "relationContext": "FIXED_OPPONENTS",
          "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
          "sourceModelVersion": "AOF_RAID_DETECTION_V3",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 8
        },
        {
          "contextId": "context-524702cb7d36230d3ff38418e0b38251f26c864ed47caee5bc80913bf90be37c",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            4,
            5
          ],
          "previousPressureIncidentId": "incident-3b1c9e09610d05dd091d7c8b5737972e3221d5369cdae5496b924a64e569ba2c",
          "previousPressureDeedId": "deed-7fe0433883d70121ebbf9c3faf990272283b5ea9df85ed080ffe0f749b9e679e",
          "returnPressureIncidentId": "incident-b052b01f67e8f8917571c829123250e6ecbf69ae778b548c272bad9b1f49a330",
          "returnPressureDeedId": "deed-ce8b03c0aeffb6239e4bf4c1508c724db80438946bda188eb6736b9b07387733",
          "previousDirection": {
            "fromPlayerId": 4,
            "toPlayerId": 5
          },
          "returnDirection": {
            "fromPlayerId": 5,
            "toPlayerId": 4
          },
          "previousEndedAt": {
            "atMs": 2164684,
            "operationOrdinal": 129524
          },
          "returnStartedAt": {
            "atMs": 2808342,
            "operationOrdinal": 162454
          },
          "sourceEventIds": [
            "op-000119100",
            "op-000121936",
            "op-000121948",
            "op-000124072",
            "op-000124544",
            "op-000124652"
          ],
          "relationContext": "FIXED_OPPONENTS",
          "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
          "sourceModelVersion": "AOF_RAID_DETECTION_V3",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 34
        }
      ]
    },
    "ledgerSamples": {
      "ALLIED_SUPPORT": [
        {
          "incidentId": "incident-f58265ba72ebf1307c0acb181630afa41aa34ce15893b411e3f1358f598b8756",
          "pairPlayerIds": [
            1,
            7
          ],
          "startedAt": {
            "atMs": 557578,
            "operationOrdinal": 36218
          },
          "relationContext": "FIXED_ALLIES",
          "facets": [
            {
              "kind": "DEFENSIVE_PARTICIPATION",
              "fromPlayerId": 1,
              "toPlayerId": 7,
              "sourceEventIds": [
                "op-000036218",
                "op-000036231",
                "op-000036272",
                "op-000036288",
                "op-000036304",
                "op-000036319"
              ],
              "unitClassEvidence": {
                "classificationVersion": "AOF_UNIT_CLASS_FAMILIES_V1",
                "distinctObservedSelectedInstances": 1,
                "typedClassInstances": 0,
                "militaryClassInstances": 0,
                "knownNonMilitaryClassInstances": 0,
                "ambiguousClassInstances": 0,
                "unknownClassInstances": 1,
                "typedCoveragePercent": 0,
                "familyCounts": {
                  "infantry": 0,
                  "cavalry": 0,
                  "archers": 0,
                  "cavalry_archers": 0,
                  "monks": 0,
                  "siege": 0,
                  "ships": 0,
                  "civilian_trade_king": 0,
                  "buildings": 0
                },
                "typedInstanceIds": [],
                "militaryInstanceIds": [],
                "knownNonMilitaryInstanceIds": [],
                "scope": "distinct selected object instances observed in qualifying engagement commands; class IDs come from replay initial-object evidence when available. Unknown later-spawned objects remain unknown. Counts are command-selection footprint, not live army size.",
                "clearNonMilitaryOnly": false
              },
              "outcomes": "UNAVAILABLE",
              "sourceEventCount": 13
            }
          ],
          "context": {
            "baseSeed": {
              "x": 178,
              "y": 97,
              "radiusTiles": 22,
              "activeFromMs": 0,
              "source": "initial_town_center",
              "sourceEventId": "initial-object-00010668"
            }
          }
        }
      ],
      "DIRECTED_PRESSURE": [
        {
          "incidentId": "incident-c23da5f0b2ac640b6cc9ce7cd27a9ecdad5d1c18f8f2f205557fe5f859f9e400",
          "pairPlayerIds": [
            4,
            7
          ],
          "startedAt": {
            "atMs": 700732,
            "operationOrdinal": 45334
          },
          "relationContext": "FIXED_OPPONENTS",
          "facets": [
            {
              "kind": "ECONOMY_PRESSURE",
              "fromPlayerId": 4,
              "toPlayerId": 7,
              "attributionMethods": [
                "economic_zone_proximity",
                "target_instance_controller"
              ],
              "sourceEventIds": [
                "op-000045334",
                "op-000045386",
                "op-000048411",
                "op-000048929",
                "op-000048944",
                "op-000049037"
              ],
              "outcomes": "UNAVAILABLE",
              "sourceEventCount": 34
            }
          ],
          "context": {
            "center": {
              "x": 177.1,
              "y": 86.23
            },
            "victimResolutionMethods": [
              "economic_zone_proximity",
              "target_instance_controller"
            ]
          }
        }
      ],
      "LOCAL_CONTEST": [
        {
          "incidentId": "incident-6465376c04bfe957aae4263a596f207be2839aee56a1f91f9ad79c4435b8e868",
          "pairPlayerIds": [
            1,
            4
          ],
          "startedAt": {
            "atMs": 547876,
            "operationOrdinal": 35602
          },
          "relationContext": "FIXED_OPPONENTS",
          "facets": [
            {
              "kind": "LOCAL_COMMAND_OVERLAP",
              "contributorPlayerId": 1,
              "otherPlayerId": 4,
              "sourceEventIds": [
                "op-000035602",
                "op-000035730",
                "op-000035840",
                "op-000036218",
                "op-000036231",
                "op-000036272"
              ],
              "targetedActionEstablished": false,
              "sourceEventCount": 45
            },
            {
              "kind": "LOCAL_COMMAND_OVERLAP",
              "contributorPlayerId": 4,
              "otherPlayerId": 1,
              "sourceEventIds": [
                "op-000035602",
                "op-000035730",
                "op-000035840",
                "op-000036218",
                "op-000036231",
                "op-000036272"
              ],
              "targetedActionEstablished": false,
              "sourceEventCount": 45
            },
            {
              "kind": "TARGETED_COMMAND",
              "fromPlayerId": 1,
              "toPlayerId": 4,
              "sourceEventIds": [
                "op-000036414",
                "op-000036441",
                "op-000036481"
              ],
              "outcomes": "UNAVAILABLE",
              "targetEvidence": [
                {
                  "sourceEventId": "op-000036414",
                  "targetInstanceId": 10068,
                  "controllerEvidence": {
                    "sourceEventId": "op-000032030",
                    "controllerPlayerId": 4,
                    "moment": {
                      "atMs": 491987,
                      "operationOrdinal": 32030
                    },
                    "basis": "selected_by_actor"
                  }
                },
                {
                  "sourceEventId": "op-000036441",
                  "targetInstanceId": 10068,
                  "controllerEvidence": {
                    "sourceEventId": "op-000032030",
                    "controllerPlayerId": 4,
                    "moment": {
                      "atMs": 491987,
                      "operationOrdinal": 32030
                    },
                    "basis": "selected_by_actor"
                  }
                },
                {
                  "sourceEventId": "op-000036481",
                  "targetInstanceId": 10068,
                  "controllerEvidence": {
                    "sourceEventId": "op-000032030",
                    "controllerPlayerId": 4,
                    "moment": {
                      "atMs": 491987,
                      "operationOrdinal": 32030
                    },
                    "basis": "selected_by_actor"
                  }
                }
              ],
              "sourceEventCount": 3
            },
            {
              "kind": "TARGETED_COMMAND",
              "fromPlayerId": 4,
              "toPlayerId": 1,
              "sourceEventIds": [
                "op-000035840",
                "op-000036544",
                "op-000037535"
              ],
              "outcomes": "UNAVAILABLE",
              "targetEvidence": [
                {
                  "sourceEventId": "op-000035840",
                  "targetInstanceId": 10065,
                  "controllerEvidence": {
                    "sourceEventId": "initial-object-00010592",
                    "controllerPlayerId": 1,
                    "moment": {
                      "atMs": 0,
                      "operationOrdinal": -1
                    },
                    "basis": "initial_object_owner"
                  }
                },
                {
                  "sourceEventId": "op-000036544",
                  "targetInstanceId": 10065,
                  "controllerEvidence": {
                    "sourceEventId": "initial-object-00010592",
                    "controllerPlayerId": 1,
                    "moment": {
                      "atMs": 0,
                      "operationOrdinal": -1
                    },
                    "basis": "initial_object_owner"
                  }
                },
                {
                  "sourceEventId": "op-000037535",
                  "targetInstanceId": 10065,
                  "controllerEvidence": {
                    "sourceEventId": "initial-object-00010592",
                    "controllerPlayerId": 1,
                    "moment": {
                      "atMs": 0,
                      "operationOrdinal": -1
                    },
                    "basis": "initial_object_owner"
                  }
                }
              ],
              "sourceEventCount": 3
            }
          ],
          "context": {
            "center": {
              "x": 162.04,
              "y": 102.56
            },
            "battlePromotion": true
          }
        }
      ],
      "SHARED_OFFENSIVE_PARTICIPATION": [
        {
          "incidentId": "incident-44586ed480010e74148b5ab0aa21ff4adfaed1922bc511eb97e03944a29319cb",
          "pairPlayerIds": [
            2,
            4
          ],
          "startedAt": {
            "atMs": 748780,
            "operationOrdinal": 48411
          },
          "relationContext": "FIXED_ALLIES",
          "facets": [
            {
              "kind": "SHARED_OPPONENT_PARTICIPATION",
              "targetPlayerId": 7,
              "contributions": [
                {
                  "contributorPlayerId": 2,
                  "sourceEventIds": [
                    "op-000048544",
                    "op-000049471",
                    "op-000049560",
                    "op-000049576"
                  ],
                  "sourceEventCount": 4
                },
                {
                  "contributorPlayerId": 4,
                  "sourceEventIds": [
                    "op-000048411",
                    "op-000048929",
                    "op-000048944",
                    "op-000049037",
                    "op-000049077",
                    "op-000049105"
                  ],
                  "sourceEventCount": 16
                }
              ],
              "coordinationIntent": "UNAVAILABLE"
            }
          ],
          "context": {
            "targetPlayerId": 7
          }
        }
      ]
    },
    "relicTargetingObservationCount": 2,
    "reviewBoundary": "source-backed command episodes; no confirmed damage, motives or engine outcomes",
    "teamLockRebuildComparison": {
      "comparisonKind": "isolated_legacy_lobby_lock_counterfactual",
      "notDeployedHistoricalStatistics": true,
      "requiresFreshCanonicalExtractionForSourceCorrection": true,
      "legacyLobbyLockTeams": false,
      "decodedDeLockTeams": true,
      "metricScope": [
        "cooperativeAttacks",
        "defensiveAssistsGiven",
        "defensiveAssistsReceived",
        "raidResponseSeconds",
        "raidsInitiated",
        "raidsReceived",
        "rawApm",
        "resourceCommitment",
        "skirmishes"
      ],
      "changes": [
        {
          "playerId": 1,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 8
        },
        {
          "playerId": 1,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 5
        },
        {
          "playerId": 1,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 0
        },
        {
          "playerId": 2,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 11
        },
        {
          "playerId": 2,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 2
        },
        {
          "playerId": 2,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 3
        },
        {
          "playerId": 3,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 2
        },
        {
          "playerId": 3,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 0
        },
        {
          "playerId": 3,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 3
        },
        {
          "playerId": 4,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 6
        },
        {
          "playerId": 4,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 3
        },
        {
          "playerId": 4,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 2
        },
        {
          "playerId": 5,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 3
        },
        {
          "playerId": 5,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 2
        },
        {
          "playerId": 5,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 0
        },
        {
          "playerId": 6,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 5
        },
        {
          "playerId": 6,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 0
        },
        {
          "playerId": 6,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 0
        },
        {
          "playerId": 7,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 7
        },
        {
          "playerId": 7,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 0
        },
        {
          "playerId": 7,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 4
        },
        {
          "playerId": 8,
          "metric": "cooperativeAttacks",
          "before": null,
          "after": 2
        },
        {
          "playerId": 8,
          "metric": "defensiveAssistsGiven",
          "before": null,
          "after": 0
        },
        {
          "playerId": 8,
          "metric": "defensiveAssistsReceived",
          "before": null,
          "after": 0
        }
      ],
      "activeStatisticsReplaced": false
    },
    "id": "4v4",
    "replayPath": "replay-fixtures/4v4.aoe2record",
    "logicalGameGroup": null,
    "canonicalSealMode": "fast",
    "canonicalSealState": "sealed_local_fast",
    "checks": {
      "statisticsAndNeutralLedgerUnchanged": true,
      "analysisUnchanged": true,
      "rebuildIdentical": true,
      "duplicateReorderedIdentical": true,
      "allContextReferencesValidated": true
    },
    "sourceCommit": "952b68d3b4858bf10fb9000a78aac92e7ba4e29d"
  },
  {
    "source": {
      "replaySha256": "dc9ae15cf923f1ce08021e329214d664e2e5ffa8b9ff9d9ad86eb01e34666e37",
      "canonicalManifestSha256": "63cd1727b59bc08624816c318362a3f2f76d4a031e76fd86da3a4385f22e4256",
      "extractionRunId": "e6c84110-e893-449f-a5c2-acd49d6b97ea",
      "canonicalSchemaVersion": "1.1.0",
      "parserVersion": "mgz-fast/1.0.0"
    },
    "recordingMatchFacts": {
      "modelVersion": "AOF_RECORDING_MATCH_FACTS_V1",
      "game": {
        "guid": "3485d419-80ff-7f49-850f-714197515615",
        "observedDurationMs": 9316483,
        "completionStatus": "unknown",
        "durationMeaning": "observed_recording_interval_not_proven_full_game",
        "recordingVersion": {
          "version": "DE",
          "game_version": "VER 9.4",
          "save_version": 68,
          "log_version": 5
        }
      },
      "map": {
        "mapId": 59,
        "mapName": null,
        "rmsFileName": "RR7 Valley of Kings.rms",
        "rmsModId": "517094",
        "seed": 0,
        "width": 220,
        "height": 220,
        "coordinateSystem": "aoe2_world_xy_origin_top_left",
        "identityMeaning": "decoded_ids_and_rms_metadata_not_qualified_map_label"
      },
      "ruleValues": {
        "allTechnologies": false,
        "difficultyId": 0,
        "endingAgeId": 0,
        "gameTypeId": 0,
        "lockTeams": false,
        "mapId": 59,
        "mapSize": 0,
        "multiplayer": true,
        "population": 200,
        "rated": false,
        "revealMapId": 0,
        "rmsFilename": "RR7 Valley of Kings.rms",
        "rmsModId": "517094",
        "seed": 0,
        "speed": 1.690000057220459,
        "startingAgeId": 0,
        "startingResourcesId": 0,
        "teamTogether": false,
        "treatyLength": 0,
        "victoryTypeId": 9
      },
      "lobbyGroups": [
        {
          "lobbyTeamIdRaw": 1,
          "memberPlayerIds": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8
          ],
          "effectiveAllianceEstablished": false
        }
      ],
      "resultQualification": "UNRESOLVED",
      "postgameEventCount": 1,
      "resignationEventCount": 0,
      "headerSource": {
        "byteLength": 166035,
        "encoding": "gzip",
        "sha256": "f8c50d3d0d8274f6417d4464d54c53a3ba4b4c15bd9d5955543b0c3ad06b70e5",
        "uri": "decoded-header.json.gz"
      }
    },
    "playerCount": 8,
    "participants": [
      {
        "playerId": 1,
        "lobbyTeamId": 1
      },
      {
        "playerId": 2,
        "lobbyTeamId": 1
      },
      {
        "playerId": 3,
        "lobbyTeamId": 1
      },
      {
        "playerId": 4,
        "lobbyTeamId": 1
      },
      {
        "playerId": 5,
        "lobbyTeamId": 1
      },
      {
        "playerId": 6,
        "lobbyTeamId": 1
      },
      {
        "playerId": 7,
        "lobbyTeamId": 1
      },
      {
        "playerId": 8,
        "lobbyTeamId": 1
      }
    ],
    "settings": {
      "allTechnologies": false,
      "difficultyId": 0,
      "endingAgeId": 0,
      "gameTypeId": 0,
      "initialDiplomacyRaw": {
        "1": [
          0,
          1,
          4,
          4,
          4,
          4,
          4,
          4,
          4
        ],
        "2": [
          0,
          4,
          1,
          4,
          4,
          4,
          4,
          4,
          4
        ],
        "3": [
          0,
          4,
          4,
          1,
          4,
          4,
          4,
          4,
          4
        ],
        "4": [
          0,
          4,
          4,
          4,
          1,
          4,
          4,
          4,
          4
        ],
        "5": [
          0,
          4,
          4,
          4,
          4,
          1,
          4,
          4,
          4
        ],
        "6": [
          0,
          4,
          4,
          4,
          4,
          4,
          1,
          4,
          4
        ],
        "7": [
          0,
          4,
          4,
          4,
          4,
          4,
          4,
          1,
          4
        ],
        "8": [
          0,
          4,
          4,
          4,
          4,
          4,
          4,
          4,
          1
        ]
      },
      "lockTeams": false,
      "mapId": 59,
      "mapSize": 0,
      "multiplayer": true,
      "population": 200,
      "rated": false,
      "revealMapId": 0,
      "rmsFilename": "RR7 Valley of Kings.rms",
      "rmsModId": "517094",
      "seed": 0,
      "speed": 1.690000057220459,
      "startingAgeId": 0,
      "startingResourcesId": 0,
      "teamTogether": false,
      "treatyLength": 0,
      "victoryTypeId": 9
    },
    "gameGuid": "3485d419-80ff-7f49-850f-714197515615",
    "observedUntilMs": 9316483,
    "incidentCounts": {},
    "deedCount": 0,
    "pressureDirections": {},
    "contextCounts": {},
    "contextDiagnosticCounts": {},
    "ledgerDiagnosticCounts": {},
    "responseCommandTypes": {},
    "coverageCounts": {
      "DEFENSIVE_SUPPORT_WITH_PRESSURE:UNAVAILABLE": 56,
      "PRESSURE_RESPONSE:UNAVAILABLE": 56,
      "RETURN_PRESSURE:UNAVAILABLE": 56
    },
    "samples": {},
    "ledgerSamples": {},
    "relicTargetingObservationCount": 4,
    "reviewBoundary": "source-backed command episodes; no confirmed damage, motives or engine outcomes",
    "teamLockRebuildComparison": {
      "comparisonKind": "isolated_legacy_lobby_lock_counterfactual",
      "notDeployedHistoricalStatistics": true,
      "requiresFreshCanonicalExtractionForSourceCorrection": false,
      "legacyLobbyLockTeams": false,
      "decodedDeLockTeams": false,
      "metricScope": [
        "cooperativeAttacks",
        "defensiveAssistsGiven",
        "defensiveAssistsReceived",
        "raidResponseSeconds",
        "raidsInitiated",
        "raidsReceived",
        "rawApm",
        "resourceCommitment",
        "skirmishes"
      ],
      "changes": [],
      "activeStatisticsReplaced": false
    },
    "id": "ffa",
    "replayPath": "replay-fixtures/FFA.aoe2record",
    "logicalGameGroup": null,
    "canonicalSealMode": "fast",
    "canonicalSealState": "sealed_local_fast",
    "checks": {
      "statisticsAndNeutralLedgerUnchanged": true,
      "analysisUnchanged": true,
      "rebuildIdentical": true,
      "duplicateReorderedIdentical": true,
      "allContextReferencesValidated": true
    },
    "sourceCommit": "952b68d3b4858bf10fb9000a78aac92e7ba4e29d"
  }
];
