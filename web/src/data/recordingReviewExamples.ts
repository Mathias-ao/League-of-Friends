// Real, abbreviated audit records. Never assigned to an illustrative league Battle.
export const recordingReviewExamples = [
  {
    "source": {
      "replaySha256": "f00fdda9c14584c3b7f132fe48bf0543d2a0aa7108d9c781e4e4cf72ad70d181",
      "canonicalManifestSha256": "ae1ab1767c8e0a733147b433ebb752b1cffa09a7ad5ef20b45a75f6fa0738d71",
      "extractionRunId": "1b37dd72-0b71-4dd3-a783-9342f72298ca",
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
          "contextId": "context-042478527572139d43b85cdfb146f901208a836b51752f1006c4e9b7c9effbf9",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-e012209eccd580f086e5a49c875bf1b76b4d1767970f77264ca372814542c9df",
          "pressureDeedId": "deed-933aa28e3a6fe547937c0a21a3a8ab9a4ec683e8006f2f6708bdf8e21b518de6",
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
          "contextId": "context-0aa1c1ff339ce7f5f1146cfd7cbf24e8acc4e3872969809720891c70170bb745",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-419b6bb9ebbb9758842c7818c7583caec0f10da83a663a62b3f5e04cfde18b35",
          "pressureDeedId": "deed-8a598cad216b7e3d905dc1b2c1bb843ef2f4f004d992eb35e70988a867f6d3b9",
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
        }
      ],
      "RETURN_PRESSURE": [
        {
          "contextId": "context-97ed84b693acf1346a194fa4b31a64a6167440772cd4cb4ed40357bd2b4c9e39",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            1,
            2
          ],
          "previousPressureIncidentId": "incident-22c923e74637314278d79bee5b340968468f0e6737119294e28a0734e611967d",
          "previousPressureDeedId": "deed-4d39facdb77ca9fcb6a29ffc1651a18883dbda5f5398a9138d0bb91f3d681d23",
          "returnPressureIncidentId": "incident-e012209eccd580f086e5a49c875bf1b76b4d1767970f77264ca372814542c9df",
          "returnPressureDeedId": "deed-933aa28e3a6fe547937c0a21a3a8ab9a4ec683e8006f2f6708bdf8e21b518de6",
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
          "incidentId": "incident-419b6bb9ebbb9758842c7818c7583caec0f10da83a663a62b3f5e04cfde18b35",
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
          "incidentId": "incident-402e8f4c039fcd6f562d0c707522a908379ff3810c41367bbd6feddc5064ff71",
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
    "sourceCommit": "8013a7e9df28ce8bc4b64a093e8cf21b327a5541"
  },
  {
    "source": {
      "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
      "canonicalManifestSha256": "f9739652d97c048710b78068e47b344c4de5d7ecdc0b918c55b07441c7283b0e",
      "extractionRunId": "42090cb7-fd50-4b27-9eb3-5076e8c4e025",
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
          "contextId": "context-0a178774aabdb9c83d8142bed82bdf2c949e30901f4bf29fe5c8c7e0215b0f49",
          "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
          "supportIncidentId": "incident-e0e368b8a1f5cc25cc1bdf2c24cb970a87658931b0fdcd44d69da11f74236ca2",
          "supportDeedId": "deed-e86ec0e57d1c3e325032a76fef2557742a3959ed17d51cc968e1048b4531ea3c",
          "pressureIncidentId": "incident-183d9aa39046363d531cc333cdbe4cc5c4cb0597a999bd43e0cf253945946853",
          "pressureDeedId": "deed-73a322a7897b23e17e4ce7d379221e97f05331d228c43927f10f0d9a972f41d6",
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
            "incident-9102b1e0a85ca6ac4b25bc4e3134a670c317b315244f11c839d7a384bbc86448"
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
        },
        {
          "contextId": "context-8cd5a4a8e86eab4697273c01272028b184ed7dc1e5918e672df4c17348e75686",
          "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
          "supportIncidentId": "incident-9b64e17ed8e124f2455910a6e039fda6fee584774a9ab2cbab17dd391bfd01cf",
          "supportDeedId": "deed-605b21190509e311fb014181c620d0ff7bb4bad89a644ee21f7c5a4ec33a3da3",
          "pressureIncidentId": "incident-1974534d6018f74ee103559226486a5ba2e907cb34b6a8199312984d2c1d3014",
          "pressureDeedId": "deed-781d8341c7e889a9bff0a2795132df0b2a5aabb8d29098536c0eef782ecc80cf",
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
            "op-000057615",
            "op-000057642",
            "op-000057667",
            "op-000057694",
            "op-000057719",
            "op-000057783"
          ],
          "contestIncidentIds": [
            "incident-56802e87f3a10abf726b6b3a07276ba3ccae78bc35242211b8d554f96fb57296"
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
          "sourceEventCount": 87,
          "parentSourceEventCount": 21
        }
      ],
      "PRESSURE_RESPONSE": [
        {
          "contextId": "context-04bb17c00f0d9b15f70d30cbd5dbe44bb65424cd25cc0773008b562e2e2032c7",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-c5bcec699041c29092f621ca34490e65337c41e4606b9f1449ac3345a449324d",
          "pressureDeedId": "deed-f62516467a73b417158bdd90f6b063b4cb22ae9e88118f2d136d0817f8c53451",
          "pairPlayerIds": [
            4,
            5
          ],
          "pressureDirection": {
            "fromPlayerId": 5,
            "toPlayerId": 4
          },
          "responseActorPlayerId": 4,
          "responseSourceEventId": "op-000175585",
          "responseMoment": {
            "atMs": 3071826,
            "operationOrdinal": 175585
          },
          "responseCommandType": "MOVE",
          "sourceLatencyMs": 2310,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000174394",
            "op-000174397",
            "op-000174452",
            "op-000174455",
            "op-000174477",
            "op-000174480"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 51,
          "recordedCommandPosition": {
            "tileX": null,
            "tileY": null,
            "x": 118,
            "y": 88.1875,
            "z": null
          },
          "commandDistanceToPressureCenterTiles": 18.328,
          "pressureStartedAt": {
            "atMs": 3048306,
            "operationOrdinal": 174394
          }
        },
        {
          "contextId": "context-0bb309de6702f711b1769d96ad707087f3a17ad0b4d1c517df46a77353c65237",
          "family": "PRESSURE_RESPONSE",
          "pressureIncidentId": "incident-af0484f1fc3d9c20b143bd789fa0cdafcd197e3bb34679e5a6123d2168e4901f",
          "pressureDeedId": "deed-0c25cc4bd31a6b9a8274504ed994d91272f0c4dcf21188385c2cbd201aabf3f4",
          "pairPlayerIds": [
            3,
            6
          ],
          "pressureDirection": {
            "fromPlayerId": 3,
            "toPlayerId": 6
          },
          "responseActorPlayerId": 6,
          "responseSourceEventId": "op-000161361",
          "responseMoment": {
            "atMs": 2786712,
            "operationOrdinal": 161361
          },
          "responseCommandType": "TOWN_BELL",
          "sourceLatencyMs": 14700,
          "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
          "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
          "relationContext": "FIXED_OPPONENTS",
          "sourceEventIds": [
            "op-000159873",
            "op-000159894",
            "op-000160059",
            "op-000160081",
            "op-000160191",
            "op-000160622"
          ],
          "associationBasis": "unique_existing_execution_response_to_attributed_raid",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 10,
          "recordedCommandPosition": {},
          "pressureStartedAt": {
            "atMs": 2757732,
            "operationOrdinal": 159873
          }
        }
      ],
      "RETURN_PRESSURE": [
        {
          "contextId": "context-08d8e7fd1c241045842d85732855f805b58e7845c3304103231031c6e0bf9c75",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            1,
            4
          ],
          "previousPressureIncidentId": "incident-718b2d5c13dd57fc7ced0f60eb2b9c42b2f54b46f9f771bad0b1fbd714034f5c",
          "previousPressureDeedId": "deed-c9428d96028db373412416281a7f65ef05306138503fc34dabc46fa9c90b0e6c",
          "returnPressureIncidentId": "incident-2eef5e7bd78c0443a87f4649e672e788cf4451a55981f10822017ed110708e6d",
          "returnPressureDeedId": "deed-8f14ebf313668d59c61a3086e80731f736a5dead9f5aa24578b816ec343ede03",
          "previousDirection": {
            "fromPlayerId": 4,
            "toPlayerId": 1
          },
          "returnDirection": {
            "fromPlayerId": 1,
            "toPlayerId": 4
          },
          "previousEndedAt": {
            "atMs": 2488068,
            "operationOrdinal": 146028
          },
          "returnStartedAt": {
            "atMs": 2630658,
            "operationOrdinal": 153426
          },
          "sourceEventIds": [
            "op-000144656",
            "op-000144698",
            "op-000145170",
            "op-000146028",
            "op-000153426",
            "op-000154740"
          ],
          "relationContext": "FIXED_OPPONENTS",
          "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
          "sourceModelVersion": "AOF_RAID_DETECTION_V3",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 12
        },
        {
          "contextId": "context-2188e70ba708629380c9af99d11885771ceaa24e41ec9efd483bfb2ca3dde734",
          "family": "RETURN_PRESSURE",
          "pairPlayerIds": [
            2,
            7
          ],
          "previousPressureIncidentId": "incident-4a02f3cee9c68354f4ffed55b3ff6bf6856558b82eef04127a0f224cc15df607",
          "previousPressureDeedId": "deed-b3e65844b572fe5c529173d0db7ae0464b90e9c9dee72152d4fa56cab2acc479",
          "returnPressureIncidentId": "incident-4e749908dadcea94b4cebfa69e79ee47f68e3b89123a0c09e276c253fb3792a7",
          "returnPressureDeedId": "deed-77428e5e9a524b969dfc4527cc7082c4855bd677ee240dba53256324e5e76b2f",
          "previousDirection": {
            "fromPlayerId": 2,
            "toPlayerId": 7
          },
          "returnDirection": {
            "fromPlayerId": 7,
            "toPlayerId": 2
          },
          "previousEndedAt": {
            "atMs": 775807,
            "operationOrdinal": 50171
          },
          "returnStartedAt": {
            "atMs": 929772,
            "operationOrdinal": 59943
          },
          "sourceEventIds": [
            "op-000048544",
            "op-000048834",
            "op-000049064",
            "op-000049145",
            "op-000049174",
            "op-000049442"
          ],
          "relationContext": "FIXED_OPPONENTS",
          "associationBasis": "next_independent_reverse_pressure_episode_in_recorded_game",
          "sourceModelVersion": "AOF_RAID_DETECTION_V3",
          "claimLayer": "INFERRED_EPISODE_CONTEXT",
          "newDeed": false,
          "outcomes": "UNAVAILABLE",
          "causalResponseEstablished": false,
          "reciprocalAttacksEstablished": false,
          "sourceEventCount": 19
        }
      ]
    },
    "ledgerSamples": {
      "ALLIED_SUPPORT": [
        {
          "incidentId": "incident-2ec1e9819a7ab394f0b3604de438eaf83aa68029b206800fb87ee0c5063de97f",
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
          "incidentId": "incident-5c835f42f516227f12fe49d59ebb6ab5149a8c070f6882902f5a9c43853d6ba5",
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
          "incidentId": "incident-d667b3f62ea4ed5fa5f920c88dc3322349072d0b72668cf8353d0f2c28cdf3b0",
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
          "incidentId": "incident-2cf7f6595f03f0f5e04bed279bc24660732730910bec947dab1c652e57aa1220",
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
              "targetPlayerId": 1,
              "contributions": [
                {
                  "contributorPlayerId": 2,
                  "sourceEventIds": [
                    "op-000048544",
                    "op-000048675",
                    "op-000048834",
                    "op-000048970",
                    "op-000048997",
                    "op-000049010"
                  ],
                  "sourceEventCount": 16
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
            "targetPlayerId": 1
          }
        }
      ]
    },
    "relicTargetingObservationCount": 2,
    "reviewBoundary": "source-backed command episodes; no confirmed damage, motives or engine outcomes",
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
    "sourceCommit": "8013a7e9df28ce8bc4b64a093e8cf21b327a5541"
  },
  {
    "source": {
      "replaySha256": "dc9ae15cf923f1ce08021e329214d664e2e5ffa8b9ff9d9ad86eb01e34666e37",
      "canonicalManifestSha256": "681f1293c112879b3b83b38eda9fae7290e31d9bd63dc120a22487a6012b778e",
      "extractionRunId": "c67a155a-8fab-4074-903c-e43ba47fb39e",
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
    "sourceCommit": "8013a7e9df28ce8bc4b64a093e8cf21b327a5541"
  }
];
