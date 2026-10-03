// Retained audited real-recording preview; complete diplomacy orders and declaration display projection.
export const example = {
  "source": {
    "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
    "canonicalManifestSha256": "6521bc2ad4b9c096d5f92870cf8c9078676fa54b316cef40bbc5b32442aa49ed",
    "extractionRunId": "28c041b9-dcbe-4025-a738-b1542de74847",
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
        "contextId": "context-1dba06dd8a11bb6aa8996d707dd81ca763bc5c9de05498c38903964db828d1d0",
        "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
        "supportIncidentId": "incident-1090f932d53e3969821c3bf46d240cae29956df064acdda62fb9feafe0cac290",
        "supportDeedId": "deed-d02d8092d4d9d06978c5e40746018a171510e9515b54690dbefd99e99a37dfd5",
        "pressureIncidentId": "incident-11a909218655688f2ba42e3f1f46027d67e04f1efe9d38480f0a5483f07bdd87",
        "pressureDeedId": "deed-18f2a4c5f689029fdce09c47412986ad43d00b3d6251f5b12fc2ba52d01a2c33",
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
          "incident-afb2eb0e322bbc19dbf0f2d14d17ba788b389d7736c4aef5d341794c33e46baa"
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
        "contextId": "context-25ad2bf1345b229b0a4d88eed03d5c10025d3232d3affe58dfca04f7cb1d7d0b",
        "family": "DEFENSIVE_SUPPORT_WITH_PRESSURE",
        "supportIncidentId": "incident-eca285fd8529ecd3ab18e55d628855fa6941676af78b6daff79e4c8dafe00e3e",
        "supportDeedId": "deed-861b0eb09b523f91d465eace9d07e10bf09abeeb1b11fd1c998347c761dd0893",
        "pressureIncidentId": "incident-2cb0817f5a962b6706b33a38ab13a099673cfdad03f430b6ad2dd7cca674ab26",
        "pressureDeedId": "deed-6e02913c2a66d3f4860039e9cc097f0663c49902aa45bf01eb07f00ed276158e",
        "pairPlayerIds": [
          3,
          5
        ],
        "supportDirection": {
          "fromPlayerId": 5,
          "toPlayerId": 3
        },
        "pressureDirection": {
          "fromPlayerId": 2,
          "toPlayerId": 3
        },
        "sourceEventIds": [
          "op-000136945",
          "op-000137542",
          "op-000137997",
          "op-000138088",
          "op-000140839",
          "op-000141135"
        ],
        "parentSourceEventIds": [
          "op-000142110",
          "op-000142122",
          "op-000142147",
          "op-000142158",
          "op-000142170",
          "op-000142181"
        ],
        "contestIncidentIds": [
          "incident-bb104de401adb27d05cdeee5a8b0b6b73b8483802c858fffb647caa4d10a0ebc"
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
        "sourceEventCount": 61,
        "parentSourceEventCount": 87
      }
    ],
    "PRESSURE_RESPONSE": [
      {
        "contextId": "context-03072b6ba6f38fcb1f8a30e757ae1f389836c4962996b9c850239902f8b62684",
        "family": "PRESSURE_RESPONSE",
        "pressureIncidentId": "incident-18e62547329a33863ebd031a9ab89adc2ee64c911b3448c721a343fc227fa25f",
        "pressureDeedId": "deed-9e5a4dbfb1d63570dc641aab319078faa1f53af12b1537ad0f4e694388f2fc45",
        "pairPlayerIds": [
          1,
          4
        ],
        "pressureDirection": {
          "fromPlayerId": 1,
          "toPlayerId": 4
        },
        "responseActorPlayerId": 4,
        "responseSourceEventId": "op-000176301",
        "responseMoment": {
          "atMs": 3085476,
          "operationOrdinal": 176301
        },
        "responseCommandType": "MOVE",
        "sourceLatencyMs": 6510,
        "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
        "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
        "relationContext": "FIXED_OPPONENTS",
        "sourceEventIds": [
          "op-000173956",
          "op-000173959",
          "op-000174061",
          "op-000174064",
          "op-000175285",
          "op-000175306"
        ],
        "associationBasis": "unique_existing_execution_response_to_attributed_raid",
        "claimLayer": "INFERRED_EPISODE_CONTEXT",
        "newDeed": false,
        "outcomes": "UNAVAILABLE",
        "causalResponseEstablished": false,
        "reciprocalAttacksEstablished": false,
        "sourceEventCount": 54,
        "recordedCommandPosition": {
          "tileX": null,
          "tileY": null,
          "x": 126.43228912353516,
          "y": 80.859375,
          "z": null
        },
        "commandDistanceToPressureCenterTiles": 13.183,
        "pressureStartedAt": {
          "atMs": 3039486,
          "operationOrdinal": 173956
        }
      },
      {
        "contextId": "context-0704fe63abf3b152896feb58a8b45a09b44ef318082567d7e1c6163360d1500d",
        "family": "PRESSURE_RESPONSE",
        "pressureIncidentId": "incident-2cb0817f5a962b6706b33a38ab13a099673cfdad03f430b6ad2dd7cca674ab26",
        "pressureDeedId": "deed-6e02913c2a66d3f4860039e9cc097f0663c49902aa45bf01eb07f00ed276158e",
        "pairPlayerIds": [
          2,
          3
        ],
        "pressureDirection": {
          "fromPlayerId": 2,
          "toPlayerId": 3
        },
        "responseActorPlayerId": 3,
        "responseSourceEventId": "op-000141169",
        "responseMoment": {
          "atMs": 2394636,
          "operationOrdinal": 141169
        },
        "responseCommandType": "ORDER",
        "sourceLatencyMs": 630,
        "sourceLatencyMeaning": "existing_execution_timestamp_difference_not_causal_reaction_time",
        "sourceModelVersion": "AOF_EXECUTION_STATISTICS_V2",
        "relationContext": "FIXED_OPPONENTS",
        "sourceEventIds": [
          "op-000136945",
          "op-000137542",
          "op-000137997",
          "op-000138088",
          "op-000140839",
          "op-000141135"
        ],
        "associationBasis": "unique_existing_execution_response_to_attributed_raid",
        "claimLayer": "INFERRED_EPISODE_CONTEXT",
        "newDeed": false,
        "outcomes": "UNAVAILABLE",
        "causalResponseEstablished": false,
        "reciprocalAttacksEstablished": false,
        "sourceEventCount": 50,
        "recordedCommandPosition": {
          "tileX": null,
          "tileY": null,
          "x": 69,
          "y": 171,
          "z": null
        },
        "commandDistanceToPressureCenterTiles": 13.754,
        "pressureStartedAt": {
          "atMs": 2310212,
          "operationOrdinal": 136945
        }
      }
    ],
    "RETURN_PRESSURE": [
      {
        "contextId": "context-3aa5a803072e1d89733b3124f45a1d8000033ab1d954571dd8f82dd2fa64b0e0",
        "family": "RETURN_PRESSURE",
        "pairPlayerIds": [
          4,
          5
        ],
        "previousPressureIncidentId": "incident-0fb8567a24f938db32b691c55781be55054e265de194ccb0cfb67145541a56d5",
        "previousPressureDeedId": "deed-d9980ca5dddb96c9e00f8ec14938e144c642064e31a8f17492a1b39362b451fb",
        "returnPressureIncidentId": "incident-5f270583090822b75537151e76ddd05cf888266414097de42db9a727aefd94dc",
        "returnPressureDeedId": "deed-69af5e7977530e1439a7d669cdc55a274c5dc1f8397180bfe9bd17bd62a10ea6",
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
      },
      {
        "contextId": "context-8c4f785ae47c6994df91b46ea9fb085940addd81cb8a401d5de7319643b86301",
        "family": "RETURN_PRESSURE",
        "pairPlayerIds": [
          5,
          8
        ],
        "previousPressureIncidentId": "incident-09e16fc5b94f5771cc8415d5d4d6f58d13caf1f634fba6761026e09e7d71c3cc",
        "previousPressureDeedId": "deed-f6fb9755971ebb7a0bb0231500d24f9d7db80e0eb862464ce6b15a56a5ce8e04",
        "returnPressureIncidentId": "incident-22b8ef0565bdd5c6f6402a77cfff12de06fc572296bac6a9cb833865776496fa",
        "returnPressureDeedId": "deed-f94b83c0d7375df90b81767c9b99e9694f60a78db60bb49019273a84cb2a10cf",
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
      }
    ]
  },
  "ledgerSamples": {
    "ALLIED_SUPPORT": [
      {
        "incidentId": "incident-11e43063d4b3ca2b3a091503cd622156d6c2acf50ad0537bc51091d65d42b99f",
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
        "incidentId": "incident-41c6d1b1dee5d46af8f6ecdbbc753f097f5c5a11c1c39530e27b4020c449add5",
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
        "incidentId": "incident-7c651459107b31c0b0c1d75356b7344eb868df31206f7bbe09163dc01937448f",
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
        "incidentId": "incident-a7169ae80d7af191451cdfa8a489d2de3d2853c3689ebaf127c83ac0a9d72080",
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
  "sourceCommit": "810828e8c98a4ee5a49828ccbc4a4789a1904286",
  "diplomacyReview": {
    "modelVersion": "AOF_RECORDING_DIPLOMACY_REVIEW_V2",
    "interpretationEnabled": false,
    "effectiveCommandPromotionEnabled": false,
    "absenceQualified": false,
    "initialRawMappingQualified": false,
    "status": "REVIEW_AVAILABLE",
    "source": {
      "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
      "canonicalManifestSha256": "6521bc2ad4b9c096d5f92870cf8c9078676fa54b316cef40bbc5b32442aa49ed",
      "extractionRunId": "28c041b9-dcbe-4025-a738-b1542de74847",
      "canonicalSchemaVersion": "1.1.0",
      "parserVersion": "mgz-fast/1.0.0",
      "canonicalRunState": "sealed_local_fast",
      "canonicalNormalizerVersion": "AOF_CANONICAL_NORMALIZER_V1_2"
    },
    "observedDurationMeaning": "recording_interval_not_full_game",
    "declaredHistory": {
      "modelVersion": "AOF_DECLARED_DIPLOMACY_HISTORY_V1",
      "source": {
        "replaySha256": "e415855f5223562820f5a34daf1298455ba5cbd940a4b502f03d2d8a2436a123",
        "canonicalManifestSha256": "6521bc2ad4b9c096d5f92870cf8c9078676fa54b316cef40bbc5b32442aa49ed",
        "extractionRunId": "28c041b9-dcbe-4025-a738-b1542de74847",
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
  },
  "declarationSnapshotScope": {
    "turningPoints": "COMPLETE_DISPLAY_FIELDS_WITH_SOURCE_COMMAND_IDS",
    "directedEpisodes": "OMITTED_FROM_PREVIEW",
    "pairIntervals": "OMITTED_FROM_PREVIEW",
    "completeAuditUrl": "https://github.com/Mathias-ao/League-of-Friends/actions/runs/37156855689"
  }
};
