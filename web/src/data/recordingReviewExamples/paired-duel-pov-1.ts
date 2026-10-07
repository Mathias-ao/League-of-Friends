// Retained audited real-recording preview; complete diplomacy orders and declaration display projection.
export const example = {
  "source": {
    "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
    "canonicalManifestSha256": "2a1c6fed3b70344d33482fb038f8b24e6258dea887e02980348b9e1ceb48541d",
    "extractionRunId": "4242819f-15a9-45f0-be02-3845e8954688",
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
        "contextId": "context-047f3cec286a2dc30504e848214bb8a5bd6de43f96df5f9037b11581f6a66daf",
        "family": "PRESSURE_RESPONSE",
        "pressureIncidentId": "incident-ac16f2d12f4303047f28022103c6fc2afb5b01e42614f01631c6e103e0dc3dec",
        "pressureDeedId": "deed-bbb4dfcb178c056918886d639bde2259ab430f6724fd38dd65763961a3079f01",
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
        "contextId": "context-1de390467a15f39dd24f96693e381d473cca8452dd25110f2fb191eb9f0b3d10",
        "family": "PRESSURE_RESPONSE",
        "pressureIncidentId": "incident-8445b203fd1864bc4e3976e90c1b89b81f15ce3148b75a4b47dc80a2b310079f",
        "pressureDeedId": "deed-cd9284627c31decf53999196015d31b36129d6d1b09975c7cee220c190d69ef1",
        "pairPlayerIds": [
          1,
          2
        ],
        "pressureDirection": {
          "fromPlayerId": 1,
          "toPlayerId": 2
        },
        "responseActorPlayerId": 2,
        "responseSourceEventId": "op-000323197",
        "responseMoment": {
          "atMs": 2071966,
          "operationOrdinal": 323197
        },
        "responseCommandType": "MOVE",
        "sourceLatencyMs": 8125,
        "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
        "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
        "relationContext": "FIXED_OPPONENTS",
        "sourceEventIds": [
          "op-000321333",
          "op-000321397",
          "op-000321460",
          "op-000321901",
          "op-000321932",
          "op-000321998"
        ],
        "associationBasis": "unique_existing_execution_response_to_attributed_raid",
        "claimLayer": "INFERRED_EPISODE_CONTEXT",
        "newDeed": false,
        "outcomes": "UNAVAILABLE",
        "causalResponseEstablished": false,
        "reciprocalAttacksEstablished": false,
        "sourceEventCount": 12,
        "recordedCommandPosition": {
          "tileX": null,
          "tileY": null,
          "x": 79.65625,
          "y": 41.82291793823242,
          "z": null
        },
        "commandDistanceToPressureCenterTiles": 4.925,
        "pressureStartedAt": {
          "atMs": 2059993,
          "operationOrdinal": 321333
        }
      }
    ],
    "RETURN_PRESSURE": [
      {
        "contextId": "context-d992ceabc325a229d10f0eee5b8559d914aa52d77cb9fe22880b06b1a3f9b221",
        "family": "RETURN_PRESSURE",
        "pairPlayerIds": [
          1,
          2
        ],
        "previousPressureIncidentId": "incident-3f24ff6ed48697a18c04ad971f35299bf0b94adf868a0003fcf8737a6eecd257",
        "previousPressureDeedId": "deed-d6a0ff6f02e78f75b461ea544e2b0d28fcf1ac0802f40942f5969101f9a16dee",
        "returnPressureIncidentId": "incident-ac16f2d12f4303047f28022103c6fc2afb5b01e42614f01631c6e103e0dc3dec",
        "returnPressureDeedId": "deed-bbb4dfcb178c056918886d639bde2259ab430f6724fd38dd65763961a3079f01",
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
        "incidentId": "incident-f63630f1b8cc2e7deeb8516c582b2527ed6875c0f5e6fcb4fe82b85b9476af0f",
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
        "incidentId": "incident-f54baad4c3567419304e6197fd8a09da6b45248b8abe6399a592bbbe4f696c8b",
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
  "sourceCommit": "810828e8c98a4ee5a49828ccbc4a4789a1904286",
  "diplomacyReview": {
    "modelVersion": "AOF_RECORDING_DIPLOMACY_REVIEW_V2",
    "interpretationEnabled": false,
    "effectiveCommandPromotionEnabled": false,
    "absenceQualified": false,
    "initialRawMappingQualified": false,
    "status": "REVIEW_AVAILABLE",
    "source": {
      "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
      "canonicalManifestSha256": "2a1c6fed3b70344d33482fb038f8b24e6258dea887e02980348b9e1ceb48541d",
      "extractionRunId": "4242819f-15a9-45f0-be02-3845e8954688",
      "canonicalSchemaVersion": "1.1.0",
      "parserVersion": "mgz-fast/1.0.0",
      "canonicalRunState": "sealed_local_fast",
      "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
    },
    "observedDurationMeaning": "recording_interval_not_full_game",
    "declaredHistory": {
      "modelVersion": "AOF_DECLARED_DIPLOMACY_HISTORY_V1",
      "source": {
        "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
        "canonicalManifestSha256": "2a1c6fed3b70344d33482fb038f8b24e6258dea887e02980348b9e1ceb48541d",
        "extractionRunId": "4242819f-15a9-45f0-be02-3845e8954688",
        "canonicalSchemaVersion": "1.1.0",
        "parserVersion": "mgz-fast/1.0.0",
        "canonicalRunState": "sealed_local_fast",
        "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
      },
      "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID",
      "claimLayer": "RECONSTRUCTED_COMMAND_HISTORY",
      "durationMeaning": "observed_recording_interval_not_proven_full_game",
      "counters": {
        "orders": 0,
        "allyOrders": 0,
        "enemyOrders": 0,
        "neutralOrders": 0,
        "unknownOrders": 0,
        "directedEdgesObserved": 0,
        "recordedStanceReversals": 0,
        "repeatedRequests": 0,
        "reciprocalAllyDeclarationEstablishments": 0,
        "allyDeclarationWithdrawals": 0
      },
      "turningPoints": [],
      "policy": {
        "engineStateEstablished": false,
        "relationshipScoringEnabled": false,
        "reputationScoringEnabled": false,
        "treacheryEstablished": false,
        "absenceQualified": false,
        "commandsAreNotAdditionalDeeds": true
      }
    },
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
  },
  "declarationSnapshotScope": {
    "turningPoints": "COMPLETE_DISPLAY_FIELDS_WITH_SOURCE_COMMAND_IDS",
    "directedEpisodes": "OMITTED_FROM_PREVIEW",
    "pairIntervals": "OMITTED_FROM_PREVIEW",
    "completeAuditUrl": "https://github.com/Mathias-ao/League-of-Friends/actions/runs/37156855689"
  }
};
