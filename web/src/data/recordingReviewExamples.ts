// Audited real recordings; abbreviated episodes, complete directed diplomacy review.
// These records are never assigned to an illustrative league Battle.
export const recordingReviewExamples = [
  {
    "source": {
      "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
      "canonicalManifestSha256": "c548495952ef1fb5aa3e16220e5baa81f7e207799a72ced7989b3734b9b36cee",
      "extractionRunId": "29cf0b5d-c74f-4c73-a84e-e8ee6fba3eb1",
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
          "contextId": "context-06201555a993ab45ac54bcf2400ae8721124615d2e60e4aa547f826519ad0e6a",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-efc658ac5f7f0becd00aacaf675402733c95092bdf62c78789f867661fe31d36",
          "pressureDeedId": "deed-acc9a77c1dd617c3bcd2ccd4f9f148b8faf40344cad0c65d56762c47bb58494c",
          "pairPlayerIds": [
            1,
            2
          ],
          "pressureDirection": {
            "fromPlayerId": 2,
            "toPlayerId": 1
          },
          "responseActorPlayerId": 1,
          "responseSourceEventId": "op-000230391",
          "responseMoment": {
            "atMs": 1477424,
            "operationOrdinal": 230391
          },
          "responseCommandType": "MOVE",
          "sourceLatencyMs": 208,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000230358",
            "op-000230391",
            "op-000230706",
            "op-000239548",
            "op-000240052",
            "op-000240115"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 25,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 87.75,
            "y": 46.58333206176758,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 9.842,
          "pressureStartedAt": {
            "atMs": 1477216,
            "operationOrdinal": 230358
          }
        },
        {
          "contextId": "context-31685bca73c0de6b667e4edf085435ec7bb5ee06192f2cdf4dcc2be5e574e02c",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-8717507fc4a27bbbef8ccec23cfeacac48299a6d3dffd785e31bb199641898be",
          "pressureDeedId": "deed-038725e48c227f691c172b3213b675dbaf0a3bd8830303bdbe36eb135ca08b64",
          "pairPlayerIds": [
            1,
            2
          ],
          "pressureDirection": {
            "fromPlayerId": 1,
            "toPlayerId": 2
          },
          "responseActorPlayerId": 2,
          "responseSourceEventId": "op-000098571",
          "responseMoment": {
            "atMs": 633243,
            "operationOrdinal": 98571
          },
          "responseCommandType": "ORDER",
          "sourceLatencyMs": 1833,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000085974",
            "op-000086007",
            "op-000086071",
            "op-000086136",
            "op-000087665",
            "op-000088711"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 38,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 35.70634460449219,
            "y": 68.23224639892578,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 2.164,
          "pressureStartedAt": {
            "atMs": 552591,
            "operationOrdinal": 85974
          }
        }
      ],
      "RETURN_PRESSURE": [
        {
          "contextId": "context-7f3c459a1513119e502e3fd5e2efe7b934e2636902ebbdc20d9eac1f053aba73",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            1,
            2
          ],
          "previousPressureIncidentId": "incident-129c7b96a153143948257f7ee93c788c6aefa3f38156fb893f38fe178b09144a",
          "previousPressureDeedId": "deed-c8f068a3c0a7ff1d20f889bb1014f8fdb47d317ff2b18ea8f62147d02bda88fc",
          "returnPressureIncidentId": "incident-efc658ac5f7f0becd00aacaf675402733c95092bdf62c78789f867661fe31d36",
          "returnPressureDeedId": "deed-acc9a77c1dd617c3bcd2ccd4f9f148b8faf40344cad0c65d56762c47bb58494c",
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
          "incidentId": "incident-6fe97a08e8b1a882667adf9d7ba73ae6f7ef9a21582d485e62623fa583ba30bd",
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
          "incidentId": "incident-04eeab7ccfb64a7f1234168fb3ab08248c0a6cafe648b5e03f3ac594d37337eb",
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
    "sourceCommit": "60bf829b1cd6488527d69eaf2cebf699f9265785",
    "diplomacyReview": {
      "modelVersion": "AOF_RECORDING_DIPLOMACY_REVIEW_V1",
      "interpretationEnabled": false,
      "effectiveCommandPromotionEnabled": false,
      "absenceQualified": false,
      "initialRawMappingQualified": false,
      "status": "REVIEW_AVAILABLE",
      "source": {
        "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
        "canonicalManifestSha256": "c548495952ef1fb5aa3e16220e5baa81f7e207799a72ced7989b3734b9b36cee",
        "extractionRunId": "29cf0b5d-c74f-4c73-a84e-e8ee6fba3eb1",
        "canonicalSchemaVersion": "1.1.0",
        "parserVersion": "mgz-fast/1.0.0",
        "canonicalRunState": "sealed_local_fast",
        "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
      },
      "observedDurationMeaning": "recording_interval_not_full_game",
      "timeline": {
        "schemaVersion": "AOF_DIPLOMACY_TIMELINE_V2",
        "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1",
        "durationMs": 2230813,
        "playerIds": [
          1,
          2
        ],
        "initialEdges": [],
        "changes": [],
        "pairSegments": [
          {
            "playerOneId": 1,
            "playerTwoId": 2,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 2230813,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 2230813,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          }
        ],
        "diagnostics": {
          "missingInitialEdges": 2,
          "unknownInitialEdges": 0,
          "unknownModeCommands": 0,
          "commandOnlyChanges": 0,
          "qualifiedEffectiveChanges": 0,
          "qualifiedNoOpChanges": 0,
          "effectiveStateInvalidations": 0,
          "qualifiedStateEstablishments": 0
        }
      },
      "commandCount": 0,
      "normalizedInitialEdgeCount": 0,
      "rawInitialVectorCount": 2,
      "unknownPairSegmentCount": 1,
      "knownPairSegmentCount": 0,
      "headerVectorMeaning": "retained_raw_values_not_qualified_effective_stances",
      "fixedTeamEvidenceMeaning": "locked_lobby_team_context_remains_a_separate_statistics_source",
      "qualificationRequirement": "controlled_build_save_data_mod_fixture_with_engine_observations"
    }
  },
  {
    "source": {
      "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
      "canonicalManifestSha256": "08167c2bab6ca50d6b7776c9c87a27dd25795dc30d6448288c850caef16f9cc7",
      "extractionRunId": "952c00bf-d810-4983-8822-4e18e2c4afe0",
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
          "contextId": "context-2dcc75b97fd759f7aaf439baf5419a7482788e12d45c70eeafb860213b2004c1",
          "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
          "supportIncidentId": "incident-df61505f3426b9ad51bdede963c8ba4f71d7dd9ed0db220024cc63221d92fe57",
          "supportDeedId": "deed-a646da8dfae2c5717a4f454c7f0c81bcd1f09870e9d56f0939b2709a5ebf07a2",
          "pressureIncidentId": "incident-99965c3e385f7681421c16fc179fc7a7f13a48c678ca6ea8c8984e178c464c4c",
          "pressureDeedId": "deed-f539a5a45d85d00b0ca207499a8aa2f25955531f7c3c2928d0130add94bf6e28",
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
            "incident-1a96c3f79a3b31b06be027670e722fa42632024fe5f6a3d9093b397946f4e4fd"
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
          "contextId": "context-3e40675e031450eb38cdb35ac5deebd93a5b40500da45fe1ad09eb9ad58ec887",
          "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
          "supportIncidentId": "incident-4b387868c4faacf295456e8f4492c6f76aa0d02d3f30cc95131d9f8fc83948ae",
          "supportDeedId": "deed-8202a547dd9de89ef2e61e6e03db1f064017fc503eb19e4f5ed2d4292d23ab01",
          "pressureIncidentId": "incident-208f1a8dfbdf4639368b9cf5c7767a3610ef6db0613a10ea45e1df16d2b16b73",
          "pressureDeedId": "deed-f06a704195214cf935962830684eb1c829d3b70faee3a4afea654b0520d60e90",
          "pairPlayerIds": [
            2,
            4
          ],
          "supportDirection": {
            "fromPlayerId": 4,
            "toPlayerId": 2
          },
          "pressureDirection": {
            "fromPlayerId": 1,
            "toPlayerId": 2
          },
          "sourceEventIds": [
            "op-000055314",
            "op-000056471",
            "op-000056484",
            "op-000056497",
            "op-000056526",
            "op-000056847"
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
            "incident-8ba18500a933dfad8555b2e2251c42425f83f6b338d5bb515798cd45e1ee4761"
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
          "sourceEventCount": 118,
          "parentSourceEventCount": 141
        }
      ],
      "PRESSURE_RESPONSE": [
        {
          "contextId": "context-079291c6e93b8438e49229ab4d5f82e02da072dd4e8487bfa7f2e2c9addf4880",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-a0ce34a5893d418a5bc8a79c559a8be9dd245f5798ef6bd2e29d14fbc78ca0f5",
          "pressureDeedId": "deed-b6831e3257019a8ce133f216f56eab43c6e5d730890b2576425007eee0dd1ef6",
          "pairPlayerIds": [
            5,
            8
          ],
          "pressureDirection": {
            "fromPlayerId": 5,
            "toPlayerId": 8
          },
          "responseActorPlayerId": 8,
          "responseSourceEventId": "op-000095158",
          "responseMoment": {
            "atMs": 1514001,
            "operationOrdinal": 95158
          },
          "responseCommandType": "MOVE",
          "sourceLatencyMs": 18237,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000093577",
            "op-000094057",
            "op-000094232",
            "op-000094277",
            "op-000094331",
            "op-000094608"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 175,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 49.60416793823242,
            "y": 89.02083587646484,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 19.655,
          "pressureStartedAt": {
            "atMs": 1488339,
            "operationOrdinal": 93577
          }
        },
        {
          "contextId": "context-1100da9f51abc1e9686aec52c52278e69938e55c3d915cf1cc3c2e265e0ddd5b",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-5ea187a2036db658b99dd0a4223591ba41b957cbaf23b7ec70aaca48f74256d0",
          "pressureDeedId": "deed-41c0732e8416c88ac9fd2e9091c5bffacbbe43d166eb3825470fe54101bc31d4",
          "pairPlayerIds": [
            3,
            6
          ],
          "pressureDirection": {
            "fromPlayerId": 3,
            "toPlayerId": 6
          },
          "responseActorPlayerId": 6,
          "responseSourceEventId": "op-000143596",
          "responseMoment": {
            "atMs": 2441256,
            "operationOrdinal": 143596
          },
          "responseCommandType": "MOVE",
          "sourceLatencyMs": 13020,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000141169",
            "op-000142913",
            "op-000143132",
            "op-000143174",
            "op-000143195",
            "op-000143247"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 57,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 67.94010162353516,
            "y": 157.1640625,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 7.049,
          "pressureStartedAt": {
            "atMs": 2394636,
            "operationOrdinal": 141169
          }
        }
      ],
      "RETURN_PRESSURE": [
        {
          "contextId": "context-0bbd4b154612f3ef58d037050814bca351035d6080d46dc792c1724f1291fef6",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            5,
            8
          ],
          "previousPressureIncidentId": "incident-6f85d99bfdee3ac49f00df583dde3cbe8b677be61622d938964aa1444b43f165",
          "previousPressureDeedId": "deed-ead22b846245e4b8d675c51b9550762341ef8074d14abe2034ac455bed51f571",
          "returnPressureIncidentId": "incident-206ddc690edebdc3efc17a2cc5f66d5baa6b4eef6aee166507797020b80ea298",
          "returnPressureDeedId": "deed-c17aad2d195c9548cf5c3067f7f9a183c01483d85dc4b43960e1601f69457154",
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
          "contextId": "context-441cc0e4b4370b3c37f8369bcffc8de6a8d2dd590c4a371b693a9a269f57a1bf",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            3,
            6
          ],
          "previousPressureIncidentId": "incident-05b245966a628720704a6ebaad976e467a5fe6d2fb75ac5f80d88c401ae9fea4",
          "previousPressureDeedId": "deed-db9ecc20788c56d4cddf09de06f9c766e5dfe3909e7979d615b0b44b3769a968",
          "returnPressureIncidentId": "incident-aa17b98b33f09c2187776be4124285780f02c82430d183f36442b89cdfb7de4f",
          "returnPressureDeedId": "deed-b6c3fa79602d3ad02a526d5d106359f27267ff85c044218176c20d60fb41a6c3",
          "previousDirection": {
            "fromPlayerId": 3,
            "toPlayerId": 6
          },
          "returnDirection": {
            "fromPlayerId": 6,
            "toPlayerId": 3
          },
          "previousEndedAt": {
            "atMs": 2257940,
            "operationOrdinal": 134322
          },
          "returnStartedAt": {
            "atMs": 2316302,
            "operationOrdinal": 137246
          },
          "sourceEventIds": [
            "op-000127194",
            "op-000127218",
            "op-000129417",
            "op-000129513",
            "op-000129535",
            "op-000129556"
          ],
          "relationContext": "FIXED_OPPONENTS",
          "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
          "sourceModelVersion": "AOF_RAID_DETECTION_V3",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 105
        }
      ]
    },
    "ledgerSamples": {
      "ALLIED_SUPPORT": [
        {
          "incidentId": "incident-62a73532eb274e3bb51d80f88553c9e1897df7c049d716d0e3a211d58de5a216",
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
          "incidentId": "incident-99965c3e385f7681421c16fc179fc7a7f13a48c678ca6ea8c8984e178c464c4c",
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
          "incidentId": "incident-441fe1385030ea6dc94d80aaca63740731d4404955c29f1ef3aed71843af4b3e",
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
          "incidentId": "incident-0bcdafe84bb4a976365472d86c8fe0343a67e586a7b192f885e5cbf26faf1f5d",
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
    "sourceCommit": "60bf829b1cd6488527d69eaf2cebf699f9265785",
    "diplomacyReview": {
      "modelVersion": "AOF_RECORDING_DIPLOMACY_REVIEW_V1",
      "interpretationEnabled": false,
      "effectiveCommandPromotionEnabled": false,
      "absenceQualified": false,
      "initialRawMappingQualified": false,
      "status": "REVIEW_AVAILABLE",
      "source": {
        "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
        "canonicalManifestSha256": "08167c2bab6ca50d6b7776c9c87a27dd25795dc30d6448288c850caef16f9cc7",
        "extractionRunId": "952c00bf-d810-4983-8822-4e18e2c4afe0",
        "canonicalSchemaVersion": "1.1.0",
        "parserVersion": "mgz-fast/1.0.0",
        "canonicalRunState": "sealed_local_fast",
        "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
      },
      "observedDurationMeaning": "recording_interval_not_full_game",
      "timeline": {
        "schemaVersion": "AOF_DIPLOMACY_TIMELINE_V2",
        "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1",
        "durationMs": 3295040,
        "playerIds": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ],
        "initialEdges": [],
        "changes": [],
        "pairSegments": [
          {
            "playerOneId": 1,
            "playerTwoId": 2,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 3,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 3,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 6,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 6,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 7,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 3295040,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 3295040,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          }
        ],
        "diagnostics": {
          "missingInitialEdges": 56,
          "unknownInitialEdges": 0,
          "unknownModeCommands": 0,
          "commandOnlyChanges": 0,
          "qualifiedEffectiveChanges": 0,
          "qualifiedNoOpChanges": 0,
          "effectiveStateInvalidations": 0,
          "qualifiedStateEstablishments": 0
        }
      },
      "commandCount": 0,
      "normalizedInitialEdgeCount": 0,
      "rawInitialVectorCount": 8,
      "unknownPairSegmentCount": 28,
      "knownPairSegmentCount": 0,
      "headerVectorMeaning": "retained_raw_values_not_qualified_effective_stances",
      "fixedTeamEvidenceMeaning": "locked_lobby_team_context_remains_a_separate_statistics_source",
      "qualificationRequirement": "controlled_build_save_data_mod_fixture_with_engine_observations"
    }
  },
  {
    "source": {
      "replaySha256": "dc9ae15cf923f1ce08021e329214d664e2e5ffa8b9ff9d9ad86eb01e34666e37",
      "canonicalManifestSha256": "53a21ef83eb1326348cf668aa350f288a83279d83131ae09774155fe916d1028",
      "extractionRunId": "064216c2-6fc9-4cfd-ba46-f64acb5945c6",
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
    "sourceCommit": "60bf829b1cd6488527d69eaf2cebf699f9265785",
    "diplomacyReview": {
      "modelVersion": "AOF_RECORDING_DIPLOMACY_REVIEW_V1",
      "interpretationEnabled": false,
      "effectiveCommandPromotionEnabled": false,
      "absenceQualified": false,
      "initialRawMappingQualified": false,
      "status": "REVIEW_AVAILABLE",
      "source": {
        "replaySha256": "dc9ae15cf923f1ce08021e329214d664e2e5ffa8b9ff9d9ad86eb01e34666e37",
        "canonicalManifestSha256": "53a21ef83eb1326348cf668aa350f288a83279d83131ae09774155fe916d1028",
        "extractionRunId": "064216c2-6fc9-4cfd-ba46-f64acb5945c6",
        "canonicalSchemaVersion": "1.1.0",
        "parserVersion": "mgz-fast/1.0.0",
        "canonicalRunState": "sealed_local_fast",
        "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
      },
      "observedDurationMeaning": "recording_interval_not_full_game",
      "timeline": {
        "schemaVersion": "AOF_DIPLOMACY_TIMELINE_V2",
        "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1",
        "durationMs": 9316483,
        "playerIds": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ],
        "initialEdges": [],
        "changes": [
          {
            "eventId": "op-000004380",
            "atMs": 33864,
            "operationOrdinal": 4380,
            "fromPlayerId": 5,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000004382",
            "atMs": 33864,
            "operationOrdinal": 4382,
            "fromPlayerId": 5,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000004384",
            "atMs": 33864,
            "operationOrdinal": 4384,
            "fromPlayerId": 5,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000004386",
            "atMs": 33864,
            "operationOrdinal": 4386,
            "fromPlayerId": 5,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000004388",
            "atMs": 33864,
            "operationOrdinal": 4388,
            "fromPlayerId": 5,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000004390",
            "atMs": 33864,
            "operationOrdinal": 4390,
            "fromPlayerId": 5,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000004392",
            "atMs": 33864,
            "operationOrdinal": 4392,
            "fromPlayerId": 5,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005532",
            "atMs": 43128,
            "operationOrdinal": 5532,
            "fromPlayerId": 2,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005534",
            "atMs": 43128,
            "operationOrdinal": 5534,
            "fromPlayerId": 2,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005536",
            "atMs": 43128,
            "operationOrdinal": 5536,
            "fromPlayerId": 2,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005538",
            "atMs": 43128,
            "operationOrdinal": 5538,
            "fromPlayerId": 2,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005540",
            "atMs": 43128,
            "operationOrdinal": 5540,
            "fromPlayerId": 2,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005542",
            "atMs": 43128,
            "operationOrdinal": 5542,
            "fromPlayerId": 2,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005544",
            "atMs": 43128,
            "operationOrdinal": 5544,
            "fromPlayerId": 2,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006105",
            "atMs": 47658,
            "operationOrdinal": 6105,
            "fromPlayerId": 1,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006107",
            "atMs": 47658,
            "operationOrdinal": 6107,
            "fromPlayerId": 1,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006109",
            "atMs": 47658,
            "operationOrdinal": 6109,
            "fromPlayerId": 1,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006111",
            "atMs": 47658,
            "operationOrdinal": 6111,
            "fromPlayerId": 1,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006113",
            "atMs": 47658,
            "operationOrdinal": 6113,
            "fromPlayerId": 1,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006115",
            "atMs": 47658,
            "operationOrdinal": 6115,
            "fromPlayerId": 1,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006117",
            "atMs": 47658,
            "operationOrdinal": 6117,
            "fromPlayerId": 1,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006180",
            "atMs": 48078,
            "operationOrdinal": 6180,
            "fromPlayerId": 6,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006182",
            "atMs": 48078,
            "operationOrdinal": 6182,
            "fromPlayerId": 6,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006184",
            "atMs": 48078,
            "operationOrdinal": 6184,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006186",
            "atMs": 48078,
            "operationOrdinal": 6186,
            "fromPlayerId": 6,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006188",
            "atMs": 48078,
            "operationOrdinal": 6188,
            "fromPlayerId": 6,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006190",
            "atMs": 48078,
            "operationOrdinal": 6190,
            "fromPlayerId": 6,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006192",
            "atMs": 48078,
            "operationOrdinal": 6192,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006359",
            "atMs": 49320,
            "operationOrdinal": 6359,
            "fromPlayerId": 3,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006361",
            "atMs": 49320,
            "operationOrdinal": 6361,
            "fromPlayerId": 3,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006363",
            "atMs": 49320,
            "operationOrdinal": 6363,
            "fromPlayerId": 3,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006365",
            "atMs": 49320,
            "operationOrdinal": 6365,
            "fromPlayerId": 3,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007351",
            "atMs": 57330,
            "operationOrdinal": 7351,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007353",
            "atMs": 57330,
            "operationOrdinal": 7353,
            "fromPlayerId": 7,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007384",
            "atMs": 57540,
            "operationOrdinal": 7384,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007386",
            "atMs": 57540,
            "operationOrdinal": 7386,
            "fromPlayerId": 7,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007388",
            "atMs": 57540,
            "operationOrdinal": 7388,
            "fromPlayerId": 7,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007390",
            "atMs": 57540,
            "operationOrdinal": 7390,
            "fromPlayerId": 7,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008895",
            "atMs": 70239,
            "operationOrdinal": 8895,
            "fromPlayerId": 8,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008897",
            "atMs": 70239,
            "operationOrdinal": 8897,
            "fromPlayerId": 8,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008899",
            "atMs": 70239,
            "operationOrdinal": 8899,
            "fromPlayerId": 8,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008901",
            "atMs": 70239,
            "operationOrdinal": 8901,
            "fromPlayerId": 8,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008903",
            "atMs": 70239,
            "operationOrdinal": 8903,
            "fromPlayerId": 8,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008905",
            "atMs": 70239,
            "operationOrdinal": 8905,
            "fromPlayerId": 8,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000008907",
            "atMs": 70239,
            "operationOrdinal": 8907,
            "fromPlayerId": 8,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000013680",
            "atMs": 110553,
            "operationOrdinal": 13680,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000013682",
            "atMs": 110553,
            "operationOrdinal": 13682,
            "fromPlayerId": 3,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000013684",
            "atMs": 110553,
            "operationOrdinal": 13684,
            "fromPlayerId": 3,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000029469",
            "atMs": 243970,
            "operationOrdinal": 29469,
            "fromPlayerId": 4,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000029472",
            "atMs": 243970,
            "operationOrdinal": 29472,
            "fromPlayerId": 4,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000029474",
            "atMs": 243970,
            "operationOrdinal": 29474,
            "fromPlayerId": 4,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000029476",
            "atMs": 243970,
            "operationOrdinal": 29476,
            "fromPlayerId": 4,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000032778",
            "atMs": 272024,
            "operationOrdinal": 32778,
            "fromPlayerId": 4,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000032783",
            "atMs": 272024,
            "operationOrdinal": 32783,
            "fromPlayerId": 4,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000032785",
            "atMs": 272024,
            "operationOrdinal": 32785,
            "fromPlayerId": 4,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000075347",
            "atMs": 666748,
            "operationOrdinal": 75347,
            "fromPlayerId": 7,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000153095",
            "atMs": 1648404,
            "operationOrdinal": 153095,
            "fromPlayerId": 3,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000166941",
            "atMs": 1917414,
            "operationOrdinal": 166941,
            "fromPlayerId": 3,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000206346",
            "atMs": 2660650,
            "operationOrdinal": 206346,
            "fromPlayerId": 8,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000206351",
            "atMs": 2660650,
            "operationOrdinal": 206351,
            "fromPlayerId": 8,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000206844",
            "atMs": 2668303,
            "operationOrdinal": 206844,
            "fromPlayerId": 7,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000207328",
            "atMs": 2676166,
            "operationOrdinal": 207328,
            "fromPlayerId": 3,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000208345",
            "atMs": 2692360,
            "operationOrdinal": 208345,
            "fromPlayerId": 4,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000214138",
            "atMs": 2781460,
            "operationOrdinal": 214138,
            "fromPlayerId": 2,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000220245",
            "atMs": 2877646,
            "operationOrdinal": 220245,
            "fromPlayerId": 8,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000250285",
            "atMs": 3365092,
            "operationOrdinal": 250285,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000250698",
            "atMs": 3372193,
            "operationOrdinal": 250698,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000257089",
            "atMs": 3476641,
            "operationOrdinal": 257089,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000257867",
            "atMs": 3490459,
            "operationOrdinal": 257867,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000278258",
            "atMs": 3807826,
            "operationOrdinal": 278258,
            "fromPlayerId": 2,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000278262",
            "atMs": 3807826,
            "operationOrdinal": 278262,
            "fromPlayerId": 2,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000279082",
            "atMs": 3820201,
            "operationOrdinal": 279082,
            "fromPlayerId": 7,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000280090",
            "atMs": 3836551,
            "operationOrdinal": 280090,
            "fromPlayerId": 4,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000281650",
            "atMs": 3861472,
            "operationOrdinal": 281650,
            "fromPlayerId": 3,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000285353",
            "atMs": 3925918,
            "operationOrdinal": 285353,
            "fromPlayerId": 2,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000297606",
            "atMs": 4140847,
            "operationOrdinal": 297606,
            "fromPlayerId": 1,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000300097",
            "atMs": 4183600,
            "operationOrdinal": 300097,
            "fromPlayerId": 4,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000307794",
            "atMs": 4309678,
            "operationOrdinal": 307794,
            "fromPlayerId": 1,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000319795",
            "atMs": 4511245,
            "operationOrdinal": 319795,
            "fromPlayerId": 4,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000353671",
            "atMs": 5070145,
            "operationOrdinal": 353671,
            "fromPlayerId": 1,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000354508",
            "atMs": 5085475,
            "operationOrdinal": 354508,
            "fromPlayerId": 2,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000371749",
            "atMs": 5378050,
            "operationOrdinal": 371749,
            "fromPlayerId": 2,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000371797",
            "atMs": 5378677,
            "operationOrdinal": 371797,
            "fromPlayerId": 6,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000391581",
            "atMs": 5715545,
            "operationOrdinal": 391581,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000397391",
            "atMs": 5808701,
            "operationOrdinal": 397391,
            "fromPlayerId": 1,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000398304",
            "atMs": 5823611,
            "operationOrdinal": 398304,
            "fromPlayerId": 1,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000398308",
            "atMs": 5823611,
            "operationOrdinal": 398308,
            "fromPlayerId": 1,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000400108",
            "atMs": 5851265,
            "operationOrdinal": 400108,
            "fromPlayerId": 3,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000400180",
            "atMs": 5852288,
            "operationOrdinal": 400180,
            "fromPlayerId": 4,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000413923",
            "atMs": 6066893,
            "operationOrdinal": 413923,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000414810",
            "atMs": 6080522,
            "operationOrdinal": 414810,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000433605",
            "atMs": 6381152,
            "operationOrdinal": 433605,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000434066",
            "atMs": 6388148,
            "operationOrdinal": 434066,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000434213",
            "atMs": 6390227,
            "operationOrdinal": 434213,
            "fromPlayerId": 1,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000434746",
            "atMs": 6399620,
            "operationOrdinal": 434746,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000450559",
            "atMs": 6664817,
            "operationOrdinal": 450559,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000457249",
            "atMs": 6769907,
            "operationOrdinal": 457249,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000461706",
            "atMs": 6840230,
            "operationOrdinal": 461706,
            "fromPlayerId": 6,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000466613",
            "atMs": 6920783,
            "operationOrdinal": 466613,
            "fromPlayerId": 6,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000466899",
            "atMs": 6925562,
            "operationOrdinal": 466899,
            "fromPlayerId": 4,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000470911",
            "atMs": 7001642,
            "operationOrdinal": 470911,
            "fromPlayerId": 6,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000478322",
            "atMs": 7123892,
            "operationOrdinal": 478322,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000478324",
            "atMs": 7123892,
            "operationOrdinal": 478324,
            "fromPlayerId": 3,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000478625",
            "atMs": 7128611,
            "operationOrdinal": 478625,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000479500",
            "atMs": 7142240,
            "operationOrdinal": 479500,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000491684",
            "atMs": 7359128,
            "operationOrdinal": 491684,
            "fromPlayerId": 3,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000491686",
            "atMs": 7359128,
            "operationOrdinal": 491686,
            "fromPlayerId": 3,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000505347",
            "atMs": 7581305,
            "operationOrdinal": 505347,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000505730",
            "atMs": 7587476,
            "operationOrdinal": 505730,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000505734",
            "atMs": 7587476,
            "operationOrdinal": 505734,
            "fromPlayerId": 7,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000505736",
            "atMs": 7587476,
            "operationOrdinal": 505736,
            "fromPlayerId": 7,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000505738",
            "atMs": 7587476,
            "operationOrdinal": 505738,
            "fromPlayerId": 7,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000506619",
            "atMs": 7601732,
            "operationOrdinal": 506619,
            "fromPlayerId": 6,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000506814",
            "atMs": 7604801,
            "operationOrdinal": 506814,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000517911",
            "atMs": 7782833,
            "operationOrdinal": 517911,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000518084",
            "atMs": 7785506,
            "operationOrdinal": 518084,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000518086",
            "atMs": 7785506,
            "operationOrdinal": 518086,
            "fromPlayerId": 3,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000519077",
            "atMs": 7801412,
            "operationOrdinal": 519077,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000521012",
            "atMs": 7838195,
            "operationOrdinal": 521012,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000521016",
            "atMs": 7838195,
            "operationOrdinal": 521016,
            "fromPlayerId": 7,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000521018",
            "atMs": 7838195,
            "operationOrdinal": 521018,
            "fromPlayerId": 7,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000536853",
            "atMs": 8108056,
            "operationOrdinal": 536853,
            "fromPlayerId": 6,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000538010",
            "atMs": 8128921,
            "operationOrdinal": 538010,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000538993",
            "atMs": 8144806,
            "operationOrdinal": 538993,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000539728",
            "atMs": 8159266,
            "operationOrdinal": 539728,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000540718",
            "atMs": 8177857,
            "operationOrdinal": 540718,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000542730",
            "atMs": 8210077,
            "operationOrdinal": 542730,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000543093",
            "atMs": 8216077,
            "operationOrdinal": 543093,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000557828",
            "atMs": 8464894,
            "operationOrdinal": 557828,
            "fromPlayerId": 3,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000559309",
            "atMs": 8488819,
            "operationOrdinal": 559309,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000565300",
            "atMs": 8585542,
            "operationOrdinal": 565300,
            "fromPlayerId": 6,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000567011",
            "atMs": 8612569,
            "operationOrdinal": 567011,
            "fromPlayerId": 3,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000567814",
            "atMs": 8625142,
            "operationOrdinal": 567814,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000567817",
            "atMs": 8625142,
            "operationOrdinal": 567817,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000567819",
            "atMs": 8625142,
            "operationOrdinal": 567819,
            "fromPlayerId": 7,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000567821",
            "atMs": 8625142,
            "operationOrdinal": 567821,
            "fromPlayerId": 7,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000568342",
            "atMs": 8633392,
            "operationOrdinal": 568342,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000568346",
            "atMs": 8633392,
            "operationOrdinal": 568346,
            "fromPlayerId": 7,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000568348",
            "atMs": 8633392,
            "operationOrdinal": 568348,
            "fromPlayerId": 7,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000568687",
            "atMs": 8638771,
            "operationOrdinal": 568687,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000598067",
            "atMs": 9186745,
            "operationOrdinal": 598067,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000598993",
            "atMs": 9202084,
            "operationOrdinal": 598993,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000603074",
            "atMs": 9272809,
            "operationOrdinal": 603074,
            "fromPlayerId": 3,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          }
        ],
        "pairSegments": [
          {
            "playerOneId": 1,
            "playerTwoId": 2,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 3,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 3,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 6,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 6,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 7,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 9316483,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 9316483,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          }
        ],
        "diagnostics": {
          "missingInitialEdges": 56,
          "unknownInitialEdges": 0,
          "unknownModeCommands": 0,
          "commandOnlyChanges": 143,
          "qualifiedEffectiveChanges": 0,
          "qualifiedNoOpChanges": 0,
          "effectiveStateInvalidations": 0,
          "qualifiedStateEstablishments": 0
        }
      },
      "commandCount": 143,
      "normalizedInitialEdgeCount": 0,
      "rawInitialVectorCount": 8,
      "unknownPairSegmentCount": 28,
      "knownPairSegmentCount": 0,
      "headerVectorMeaning": "retained_raw_values_not_qualified_effective_stances",
      "fixedTeamEvidenceMeaning": "locked_lobby_team_context_remains_a_separate_statistics_source",
      "qualificationRequirement": "controlled_build_save_data_mod_fixture_with_engine_observations"
    }
  },
  {
    "source": {
      "replaySha256": "2dd7a9a63f1b1b74f7e43dc1de1e70417089bb7f3ff667424591dea7db1e9ec9",
      "canonicalManifestSha256": "5fa5214fc16ac709d746807551744a839853a8ffce814abd0521ed2a1dfb88af",
      "extractionRunId": "06d6ab31-d3cf-4df8-a040-d1745597c17b",
      "canonicalSchemaVersion": "1.1.0",
      "parserVersion": "mgz-fast/1.0.0"
    },
    "recordingMatchFacts": {
      "modelVersion": "AOF_RECORDING_MATCH_FACTS_V1",
      "game": {
        "guid": "550c5243-6292-2c4a-b367-8309206838a5",
        "observedDurationMs": 5639022,
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
        "rmsFileName": "Pilgrims Nothing.rms",
        "rmsModId": "2950",
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
        "rmsFilename": "Pilgrims Nothing.rms",
        "rmsModId": "2950",
        "seed": 0,
        "speed": 1.690000057220459,
        "startingAgeId": 0,
        "startingResourcesId": 2,
        "teamTogether": true,
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
        "byteLength": 127872,
        "encoding": "gzip",
        "sha256": "b8d3f4008aadee34f30d7b4a3a68f0062501346bc85efcc7ab21c2c7075895a8",
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
      "rmsFilename": "Pilgrims Nothing.rms",
      "rmsModId": "2950",
      "seed": 0,
      "speed": 1.690000057220459,
      "startingAgeId": 0,
      "startingResourcesId": 2,
      "teamTogether": true,
      "treatyLength": 0,
      "victoryTypeId": 9
    },
    "gameGuid": "550c5243-6292-2c4a-b367-8309206838a5",
    "observedUntilMs": 5639022,
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
    "relicTargetingObservationCount": 0,
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
    "id": "townbell-ffa",
    "replayPath": "replay-fixtures/townbell-ffa-save68.aoe2record",
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
    "sourceCommit": "60bf829b1cd6488527d69eaf2cebf699f9265785",
    "diplomacyReview": {
      "modelVersion": "AOF_RECORDING_DIPLOMACY_REVIEW_V1",
      "interpretationEnabled": false,
      "effectiveCommandPromotionEnabled": false,
      "absenceQualified": false,
      "initialRawMappingQualified": false,
      "status": "REVIEW_AVAILABLE",
      "source": {
        "replaySha256": "2dd7a9a63f1b1b74f7e43dc1de1e70417089bb7f3ff667424591dea7db1e9ec9",
        "canonicalManifestSha256": "5fa5214fc16ac709d746807551744a839853a8ffce814abd0521ed2a1dfb88af",
        "extractionRunId": "06d6ab31-d3cf-4df8-a040-d1745597c17b",
        "canonicalSchemaVersion": "1.1.0",
        "parserVersion": "mgz-fast/1.0.0",
        "canonicalRunState": "sealed_local_fast",
        "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
      },
      "observedDurationMeaning": "recording_interval_not_full_game",
      "timeline": {
        "schemaVersion": "AOF_DIPLOMACY_TIMELINE_V2",
        "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1",
        "durationMs": 5639022,
        "playerIds": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ],
        "initialEdges": [],
        "changes": [
          {
            "eventId": "op-000005042",
            "atMs": 34008,
            "operationOrdinal": 5042,
            "fromPlayerId": 7,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005044",
            "atMs": 34008,
            "operationOrdinal": 5044,
            "fromPlayerId": 7,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005046",
            "atMs": 34008,
            "operationOrdinal": 5046,
            "fromPlayerId": 7,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005048",
            "atMs": 34008,
            "operationOrdinal": 5048,
            "fromPlayerId": 7,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005050",
            "atMs": 34008,
            "operationOrdinal": 5050,
            "fromPlayerId": 7,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005052",
            "atMs": 34008,
            "operationOrdinal": 5052,
            "fromPlayerId": 7,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000005054",
            "atMs": 34008,
            "operationOrdinal": 5054,
            "fromPlayerId": 7,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006723",
            "atMs": 44772,
            "operationOrdinal": 6723,
            "fromPlayerId": 4,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006725",
            "atMs": 44772,
            "operationOrdinal": 6725,
            "fromPlayerId": 4,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006727",
            "atMs": 44772,
            "operationOrdinal": 6727,
            "fromPlayerId": 4,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006729",
            "atMs": 44772,
            "operationOrdinal": 6729,
            "fromPlayerId": 4,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006731",
            "atMs": 44772,
            "operationOrdinal": 6731,
            "fromPlayerId": 4,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006733",
            "atMs": 44772,
            "operationOrdinal": 6733,
            "fromPlayerId": 4,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000006735",
            "atMs": 44772,
            "operationOrdinal": 6735,
            "fromPlayerId": 4,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007019",
            "atMs": 46605,
            "operationOrdinal": 7019,
            "fromPlayerId": 6,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007021",
            "atMs": 46605,
            "operationOrdinal": 7021,
            "fromPlayerId": 6,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007023",
            "atMs": 46605,
            "operationOrdinal": 7023,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007025",
            "atMs": 46605,
            "operationOrdinal": 7025,
            "fromPlayerId": 6,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007027",
            "atMs": 46605,
            "operationOrdinal": 7027,
            "fromPlayerId": 6,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007029",
            "atMs": 46605,
            "operationOrdinal": 7029,
            "fromPlayerId": 6,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007031",
            "atMs": 46605,
            "operationOrdinal": 7031,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007065",
            "atMs": 46813,
            "operationOrdinal": 7065,
            "fromPlayerId": 5,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007067",
            "atMs": 46813,
            "operationOrdinal": 7067,
            "fromPlayerId": 5,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007069",
            "atMs": 46813,
            "operationOrdinal": 7069,
            "fromPlayerId": 5,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007071",
            "atMs": 46813,
            "operationOrdinal": 7071,
            "fromPlayerId": 5,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007073",
            "atMs": 46813,
            "operationOrdinal": 7073,
            "fromPlayerId": 5,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007075",
            "atMs": 46813,
            "operationOrdinal": 7075,
            "fromPlayerId": 5,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007077",
            "atMs": 46813,
            "operationOrdinal": 7077,
            "fromPlayerId": 5,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007582",
            "atMs": 50063,
            "operationOrdinal": 7582,
            "fromPlayerId": 8,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007584",
            "atMs": 50063,
            "operationOrdinal": 7584,
            "fromPlayerId": 8,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007586",
            "atMs": 50063,
            "operationOrdinal": 7586,
            "fromPlayerId": 8,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007588",
            "atMs": 50063,
            "operationOrdinal": 7588,
            "fromPlayerId": 8,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007590",
            "atMs": 50063,
            "operationOrdinal": 7590,
            "fromPlayerId": 8,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007592",
            "atMs": 50063,
            "operationOrdinal": 7592,
            "fromPlayerId": 8,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000007594",
            "atMs": 50063,
            "operationOrdinal": 7594,
            "fromPlayerId": 8,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000009080",
            "atMs": 59605,
            "operationOrdinal": 9080,
            "fromPlayerId": 2,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000009082",
            "atMs": 59605,
            "operationOrdinal": 9082,
            "fromPlayerId": 2,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000009084",
            "atMs": 59605,
            "operationOrdinal": 9084,
            "fromPlayerId": 2,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000009086",
            "atMs": 59605,
            "operationOrdinal": 9086,
            "fromPlayerId": 2,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000009088",
            "atMs": 59605,
            "operationOrdinal": 9088,
            "fromPlayerId": 2,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011788",
            "atMs": 76869,
            "operationOrdinal": 11788,
            "fromPlayerId": 3,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011790",
            "atMs": 76869,
            "operationOrdinal": 11790,
            "fromPlayerId": 3,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011792",
            "atMs": 76869,
            "operationOrdinal": 11792,
            "fromPlayerId": 3,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011794",
            "atMs": 76869,
            "operationOrdinal": 11794,
            "fromPlayerId": 3,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011796",
            "atMs": 76869,
            "operationOrdinal": 11796,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011798",
            "atMs": 76869,
            "operationOrdinal": 11798,
            "fromPlayerId": 3,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000011800",
            "atMs": 76869,
            "operationOrdinal": 11800,
            "fromPlayerId": 3,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014488",
            "atMs": 93938,
            "operationOrdinal": 14488,
            "fromPlayerId": 1,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014490",
            "atMs": 93938,
            "operationOrdinal": 14490,
            "fromPlayerId": 1,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014492",
            "atMs": 93938,
            "operationOrdinal": 14492,
            "fromPlayerId": 1,
            "toPlayerId": 4,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014494",
            "atMs": 93938,
            "operationOrdinal": 14494,
            "fromPlayerId": 1,
            "toPlayerId": 5,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014496",
            "atMs": 93938,
            "operationOrdinal": 14496,
            "fromPlayerId": 1,
            "toPlayerId": 6,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014498",
            "atMs": 93938,
            "operationOrdinal": 14498,
            "fromPlayerId": 1,
            "toPlayerId": 7,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000014500",
            "atMs": 93938,
            "operationOrdinal": 14500,
            "fromPlayerId": 1,
            "toPlayerId": 8,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000019713",
            "atMs": 127244,
            "operationOrdinal": 19713,
            "fromPlayerId": 2,
            "toPlayerId": 1,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000019715",
            "atMs": 127244,
            "operationOrdinal": 19715,
            "fromPlayerId": 2,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000084512",
            "atMs": 635314,
            "operationOrdinal": 84512,
            "fromPlayerId": 5,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000089639",
            "atMs": 698093,
            "operationOrdinal": 89639,
            "fromPlayerId": 3,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000178553",
            "atMs": 1836782,
            "operationOrdinal": 178553,
            "fromPlayerId": 6,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000181287",
            "atMs": 1874894,
            "operationOrdinal": 181287,
            "fromPlayerId": 7,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000238117",
            "atMs": 2660384,
            "operationOrdinal": 238117,
            "fromPlayerId": 8,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000238918",
            "atMs": 2670960,
            "operationOrdinal": 238918,
            "fromPlayerId": 6,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000242956",
            "atMs": 2723799,
            "operationOrdinal": 242956,
            "fromPlayerId": 6,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000242958",
            "atMs": 2723799,
            "operationOrdinal": 242958,
            "fromPlayerId": 6,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000242960",
            "atMs": 2723799,
            "operationOrdinal": 242960,
            "fromPlayerId": 6,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000242962",
            "atMs": 2723799,
            "operationOrdinal": 242962,
            "fromPlayerId": 6,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000242964",
            "atMs": 2723799,
            "operationOrdinal": 242964,
            "fromPlayerId": 6,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000243853",
            "atMs": 2736804,
            "operationOrdinal": 243853,
            "fromPlayerId": 2,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000244667",
            "atMs": 2747927,
            "operationOrdinal": 244667,
            "fromPlayerId": 4,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000246987",
            "atMs": 2779453,
            "operationOrdinal": 246987,
            "fromPlayerId": 3,
            "toPlayerId": 6,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000249718",
            "atMs": 2817587,
            "operationOrdinal": 249718,
            "fromPlayerId": 2,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000262922",
            "atMs": 2997491,
            "operationOrdinal": 262922,
            "fromPlayerId": 2,
            "toPlayerId": 3,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000272460",
            "atMs": 3130776,
            "operationOrdinal": 272460,
            "fromPlayerId": 3,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000275481",
            "atMs": 3170799,
            "operationOrdinal": 275481,
            "fromPlayerId": 2,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000276949",
            "atMs": 3191605,
            "operationOrdinal": 276949,
            "fromPlayerId": 3,
            "toPlayerId": 2,
            "rawMode": 0,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ALLY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000305645",
            "atMs": 3584054,
            "operationOrdinal": 305645,
            "fromPlayerId": 3,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000422811",
            "atMs": 5215505,
            "operationOrdinal": 422811,
            "fromPlayerId": 8,
            "toPlayerId": 1,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000422813",
            "atMs": 5215505,
            "operationOrdinal": 422813,
            "fromPlayerId": 8,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000422815",
            "atMs": 5215505,
            "operationOrdinal": 422815,
            "fromPlayerId": 8,
            "toPlayerId": 3,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000422817",
            "atMs": 5215505,
            "operationOrdinal": 422817,
            "fromPlayerId": 8,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000422819",
            "atMs": 5215505,
            "operationOrdinal": 422819,
            "fromPlayerId": 8,
            "toPlayerId": 5,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000422822",
            "atMs": 5215505,
            "operationOrdinal": 422822,
            "fromPlayerId": 8,
            "toPlayerId": 7,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000423586",
            "atMs": 5226398,
            "operationOrdinal": 423586,
            "fromPlayerId": 4,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000423791",
            "atMs": 5229086,
            "operationOrdinal": 423791,
            "fromPlayerId": 2,
            "toPlayerId": 8,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000447484",
            "atMs": 5552639,
            "operationOrdinal": 447484,
            "fromPlayerId": 2,
            "toPlayerId": 4,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          },
          {
            "eventId": "op-000448240",
            "atMs": 5562943,
            "operationOrdinal": 448240,
            "fromPlayerId": 4,
            "toPlayerId": 2,
            "rawMode": 3,
            "rawCommandId": 0,
            "sourceVersion": "1.1.0",
            "effectQualification": "COMMAND_ONLY",
            "commandedStance": "ENEMY",
            "previousEffectiveStance": "UNKNOWN",
            "effectiveStanceAfter": "UNKNOWN",
            "effectiveStateChanged": false,
            "effectiveStateInvalidated": false,
            "effectiveStateEstablished": false,
            "knowledgeStateChanged": false,
            "mappingVersion": "AOF_DIPLOMACY_ACTION_MODE_MAP_V1"
          }
        ],
        "pairSegments": [
          {
            "playerOneId": 1,
            "playerTwoId": 2,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 3,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 1,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 3,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 2,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 4,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 3,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 5,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 4,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 6,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 5,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 6,
            "playerTwoId": 7,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 6,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          },
          {
            "playerOneId": 7,
            "playerTwoId": 8,
            "start": {
              "atMs": 0,
              "operationOrdinal": -1
            },
            "end": {
              "atMs": 5639022,
              "operationOrdinal": 9007199254740991
            },
            "elapsedMs": 5639022,
            "playerOneToPlayerTwo": "UNKNOWN",
            "playerTwoToPlayerOne": "UNKNOWN",
            "state": "UNKNOWN",
            "coverage": "UNAVAILABLE"
          }
        ],
        "diagnostics": {
          "missingInitialEdges": 56,
          "unknownInitialEdges": 0,
          "unknownModeCommands": 0,
          "commandOnlyChanges": 86,
          "qualifiedEffectiveChanges": 0,
          "qualifiedNoOpChanges": 0,
          "effectiveStateInvalidations": 0,
          "qualifiedStateEstablishments": 0
        }
      },
      "commandCount": 86,
      "normalizedInitialEdgeCount": 0,
      "rawInitialVectorCount": 8,
      "unknownPairSegmentCount": 28,
      "knownPairSegmentCount": 0,
      "headerVectorMeaning": "retained_raw_values_not_qualified_effective_stances",
      "fixedTeamEvidenceMeaning": "locked_lobby_team_context_remains_a_separate_statistics_source",
      "qualificationRequirement": "controlled_build_save_data_mod_fixture_with_engine_observations"
    }
  }
];
