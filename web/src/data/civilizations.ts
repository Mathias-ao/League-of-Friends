/**
 * Age of Friends civilization presentation catalogue.
 *
 * Source snapshot: SiegeEngineers/aoe2techtree b9d494df6921d4080df69b22f9dbb7a4d1dcd9f0
 * The upstream project generates these help strings from an installed AoE2:DE
 * civilization/tech-tree/language data set. Values below are presentation facts,
 * not AoF strategic weights or performance judgments.
 */
export const CIVILIZATION_CATALOGUE_VERSION='AOF_CIVILIZATION_CATALOGUE_V1' as const;
export const CIVILIZATION_CATALOGUE_SOURCE={
  kind:'AOE2_DE_GAME_DERIVED_REFERENCE',
  upstreamRepository:'SiegeEngineers/aoe2techtree',
  upstreamCommit:'b9d494df6921d4080df69b22f9dbb7a4d1dcd9f0',
  upstreamSnapshotDate:'2026-06-21',
  importedAt:'2026-09-20'
} as const;

export interface CivilizationUniqueUnit {
  name:string;
  role:string|null;
  iconAsset:string|null;
}
export interface CivilizationCatalogueEntry {
  id:string;
  name:string;
  typeLabel:string;
  identity:string;
  bonuses:string[];
  teamBonus:string;
  uniqueUnits:CivilizationUniqueUnit[];
  uniqueTechnologies:string[];
  descriptiveTags:string[];
  iconAsset:string|null;
  sourceHelpStringId:number;
}

export const civilizationCatalogue=[
  {
    "id": "ARMENIANS",
    "name": "Armenians",
    "typeLabel": "Infantry and Naval civilization",
    "identity": "Infantry & Naval focus",
    "bonuses": [
      "Mule Carts cost -25%",
      "Mule Cart technology effects +40%",
      "Spearman- and Militia-line upgrades (except Man-at-Arms) available one age earlier",
      "First Fortified Church receives a free Relic",
      "Galley-line and Dromons fire an additional projectile"
    ],
    "teamBonus": "Infantry +2 line of sight",
    "uniqueUnits": [
      {
        "name": "Composite Bowman",
        "role": "Foot Archer",
        "iconAsset": null
      },
      {
        "name": "Warrior Priest",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Cilician Fleet (Demolition Ships +20% blast radius; Galley-line and Dromons +1 range)",
      "Fereters (Infantry (except Spearman-line) +30 HP; Warrior Priests heal +100% faster)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120193
  },
  {
    "id": "AZTECS",
    "name": "Aztecs",
    "typeLabel": "Infantry and Monk civilization",
    "identity": "Infantry & Monk focus",
    "bonuses": [
      "Start with +50 gold",
      "Villagers carry +3",
      "Military Units train +15% faster",
      "Monks gain +5 HP for each researched Monastery technology"
    ],
    "teamBonus": "Relics generate +33% gold",
    "uniqueUnits": [
      {
        "name": "Jaguar Warrior",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Atlatl (Skirmishers +1 attack, +1 range)",
      "Garland Wars (Infantry +4 attack)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Monk"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120164
  },
  {
    "id": "BENGALIS",
    "name": "Bengalis",
    "typeLabel": "Elephant and Naval civilization",
    "identity": "Elephant & Naval focus",
    "bonuses": [
      "Town Centers spawn 2 Villagers when the next Age is reached",
      "Cavalry +2 attack vs. Skirmishers",
      "Elephant Units receive -25% bonus damage and are more resistant to conversion",
      "Monks +3 melee/+3 pierce armor",
      "Ships regenerate 15 HP per minute"
    ],
    "teamBonus": "Trade Units generate +10% food in addition to gold",
    "uniqueUnits": [
      {
        "name": "Ratha",
        "role": "Mounted Archer",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Paiks (Rathas and Elephant Units attack +20% faster)",
      "Mahayana (Villagers and Monks take -10% population space)"
    ],
    "descriptiveTags": [
      "Elephant",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120190
  },
  {
    "id": "BERBERS",
    "name": "Berbers",
    "typeLabel": "Cavalry and Naval civilization",
    "identity": "Cavalry & Naval focus",
    "bonuses": [
      "Villagers move +5% faster in Dark Age, +10% faster starting in Feudal Age",
      "Stable Units cost -15/20% in Castle/Imperial Age",
      "Ships move +10% faster"
    ],
    "teamBonus": "Genitour available at the Archery Range starting in Castle Age",
    "uniqueUnits": [
      {
        "name": "Camel Archer",
        "role": "Mounted Archer",
        "iconAsset": null
      },
      {
        "name": "Genitour",
        "role": "Mounted Skirmisher",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Kasbah (Team Castles work +25% faster)",
      "Maghrebi Camels (Camel Units regenerate 15 HP per minute)"
    ],
    "descriptiveTags": [
      "Cavalry",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120176
  },
  {
    "id": "BOHEMIANS",
    "name": "Bohemians",
    "typeLabel": "Gunpowder and Monk civilization",
    "identity": "Gunpowder & Monk focus",
    "bonuses": [
      "Mining Camp technologies free",
      "Blacksmiths and Universities cost -100 wood",
      "Spearman-line deals +25% bonus damage",
      "Fervor and Sanctity affect Villagers",
      "Chemistry and Hand Cannoneer available in Castle Age"
    ],
    "teamBonus": "Markets work +80% faster",
    "uniqueUnits": [
      {
        "name": "Hussite Wagon",
        "role": "Siege Gunpowder Unit",
        "iconAsset": null
      },
      {
        "name": "Houfnice",
        "role": "Siege Gunpowder Unit",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Wagenburg Tactics (Gunpowder Units move +15% faster)",
      "Hussite Reforms (Monks and Monastery technologies gold cost is replaced by food cost)"
    ],
    "descriptiveTags": [
      "Gunpowder",
      "Monk"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120188
  },
  {
    "id": "BRITONS",
    "name": "Britons",
    "typeLabel": "Foot Archer civilization",
    "identity": "Foot Archer focus",
    "bonuses": [
      "Shepherds work +25% faster",
      "Town Centers cost -50% wood starting in Castle Age",
      "Foot Archers +1/+2 range in Castle/Imperial Age"
    ],
    "teamBonus": "Archery Ranges work +10% faster",
    "uniqueUnits": [
      {
        "name": "Longbowman",
        "role": "Foot Archer",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Yeomen (Foot Archers and Skirmisher-line +1 range; Watch Tower-line +2 attack)",
      "Warwolf (Trebuchets deal blast damage and are more accurate)"
    ],
    "descriptiveTags": [
      "Foot Archer"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120150
  },
  {
    "id": "BULGARIANS",
    "name": "Bulgarians",
    "typeLabel": "Infantry and Cavalry civilization",
    "identity": "Infantry & Cavalry focus",
    "bonuses": [
      "Militia-line upgrades free",
      "Blacksmith and Siege Workshop technologies cost -50% food",
      "Town Centers cost -50% stone",
      "Can build Krepost in Castle Age"
    ],
    "teamBonus": "Blacksmiths work +80% faster",
    "uniqueUnits": [
      {
        "name": "Konnik",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Stirrups (Cavalry attacks +33% faster)",
      "Bagains (Militia-line +5 melee armor)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120181
  },
  {
    "id": "BURGUNDIANS",
    "name": "Burgundians",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Economic upgrades available one age earlier and cost -40% food",
      "Stable technologies cost -50%",
      "Cavalier upgrade available in Castle Age",
      "Gunpowder Units +25% attack"
    ],
    "teamBonus": "Relics generate food in addition to gold",
    "uniqueUnits": [
      {
        "name": "Coustillier",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Flemish Militia",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Burgundian Vineyards (Farmers slowly generate gold in addition to food)",
      "Flemish Revolution (All existing Villagers are transformed to Flemish Militia)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120185
  },
  {
    "id": "BURMESE",
    "name": "Burmese",
    "typeLabel": "Infantry and Cavalry civilization",
    "identity": "Infantry & Cavalry focus",
    "bonuses": [
      "Lumber Camp technologies free",
      "Infantry +1/+2/+3 attack in Feudal/Castle/Imperial Age",
      "Battle Elephants +1 melee/+1 pierce armor",
      "Monastery technologies cost -50%"
    ],
    "teamBonus": "Relics visible on the map at the start of the game",
    "uniqueUnits": [
      {
        "name": "Arambai",
        "role": "Ranged Mounted Unit",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Manipur Cavalry (Cavalry +4 attack vs. Ranged Soldiers)",
      "Howdah (Battle Elephants +1 melee/+1 pierce armor)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120179
  },
  {
    "id": "BYZANTINES",
    "name": "Byzantines",
    "typeLabel": "Defensive civilization",
    "identity": "Defensive focus",
    "bonuses": [
      "Buildings +10/20/30/40% HP in Dark/Feudal/Castle/Imperial Age",
      "Camel Riders, Skirmishers and Spearman-line cost -25%",
      "Town Watch, Town Patrol free",
      "Advancing to Imperial Age costs -33%",
      "Fire Ships and Dromons attack +25% faster"
    ],
    "teamBonus": "Monks heal +100% faster",
    "uniqueUnits": [
      {
        "name": "Cataphract",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Greek Fire (Fire Ships +1 range; Dromons and Bombard Towers increased blast radius)",
      "Logistica (Cataphracts deal trample damage, +6 attack vs. Infantry)"
    ],
    "descriptiveTags": [
      "Defensive"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120156
  },
  {
    "id": "CELTS",
    "name": "Celts",
    "typeLabel": "Infantry and Siege civilization",
    "identity": "Infantry & Siege focus",
    "bonuses": [
      "Lumberjacks work +15% faster",
      "Livestock animals within Celt unit line of sight cannot be stolen",
      "Infantry moves +5/10/15/20% faster in Dark/Feudal/",
      "Castle/Imperial Age",
      "Siege Weapons attack +25% faster"
    ],
    "teamBonus": "Siege Workshops work +20% faster",
    "uniqueUnits": [
      {
        "name": "Woad Raider",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Stronghold (Castles and Watch Tower-line attack +33% faster; Castles heal allied Infantry in a 7 tile radius)",
      "Furor Celtica (Siege Weapons +40% HP)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Siege"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120162
  },
  {
    "id": "CHINESE",
    "name": "Chinese",
    "typeLabel": "Archer and Gunpowder civilization",
    "identity": "Archer & Gunpowder focus",
    "bonuses": [
      "Start with +3 Villagers, but -50 wood and -200 food",
      "Technologies cost -5/10/15% in Feudal/Castle/Imperial Age",
      "Town Centers +7 line of sight and provide +15 population space",
      "Fire Lancers and Fire Ships move +5/10% faster in Castle/Imperial Age"
    ],
    "teamBonus": "Farms +10% food",
    "uniqueUnits": [
      {
        "name": "Chu Ko Nu",
        "role": "Foot Archer",
        "iconAsset": null
      },
      {
        "name": "Dragon Ship",
        "role": "Warship",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Great Wall (Walls, Watch Tower-line and Bombard Towers +30% HP)",
      "Rocketry (Scorpions, Rocket Carts and Lou Chuans +25% attack; Lou Chuans fire rockets)"
    ],
    "descriptiveTags": [
      "Archer",
      "Gunpowder"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120155
  },
  {
    "id": "CUMANS",
    "name": "Cumans",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "One additional Town Center can be built in Feudal Age",
      "Mounted Units move +5/10/15% faster in Feudal/",
      "Castle/Imperial Age",
      "Archery Ranges and Stables cost -75 wood",
      "Siege Workshop and Battering Ram available in Feudal Age; Capped Ram available in Castle Age"
    ],
    "teamBonus": "Palisade Walls +33% HP",
    "uniqueUnits": [
      {
        "name": "Kipchak",
        "role": "Mounted Archer",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Steppe Husbandry (Scout Cavalry-line, Steppe Lancers and Cavalry Archers train +100% faster)",
      "Cuman Mercenaries (All team members can train 5 free Elite Kipchaks per Castle)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120183
  },
  {
    "id": "DRAVIDIANS",
    "name": "Dravidians",
    "typeLabel": "Infantry and Naval civilization",
    "identity": "Infantry & Naval focus",
    "bonuses": [
      "Fishermen and Fishing Ships carry +15",
      "Receive +200 wood when advancing to the next Age",
      "Skirmishers and Elephant Archers attack +25% faster",
      "Barracks technologies cost -50%",
      "Siege Weapons cost -33% wood"
    ],
    "teamBonus": "Docks provide +5 population space",
    "uniqueUnits": [
      {
        "name": "Urumi Swordsman",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Thirisadai",
        "role": "Warship",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Medical Corps (Elephant Units regenerate 30 HP per minute)",
      "Wootz Steel (Infantry and Cavalry attacks ignore armor)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120189
  },
  {
    "id": "ETHIOPIANS",
    "name": "Ethiopians",
    "typeLabel": "Archer civilization",
    "identity": "Archer focus",
    "bonuses": [
      "Receive +100 gold and +100 food when advancing to the next Age",
      "Foot Archers attack +18% faster",
      "Pikeman upgrade free"
    ],
    "teamBonus": "Outposts +3 line of sight and cost no stone",
    "uniqueUnits": [
      {
        "name": "Shotel Warrior",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Royal Heirs (Shotel Warriors and Camel Riders receive -3 damage from Mounted Units)",
      "Torsion Engines (Siege Workshop Units' blast radius increased)"
    ],
    "descriptiveTags": [
      "Archer"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120174
  },
  {
    "id": "FRANKS",
    "name": "Franks",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Foragers work +15% faster",
      "Mill technologies free",
      "Mounted Units +20% HP starting in Feudal Age",
      "Castles cost -15/25% in Castle/Imperial Age"
    ],
    "teamBonus": "Knight-line +2 line of sight",
    "uniqueUnits": [
      {
        "name": "Throwing Axeman",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Bearded Axe (Throwing Axemen +2 range)",
      "Chivalry (Stables work +40% faster)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120151
  },
  {
    "id": "GEORGIANS",
    "name": "Georgians",
    "typeLabel": "Defensive and Cavalry civilization",
    "identity": "Defensive & Cavalry focus",
    "bonuses": [
      "Start with a Mule Cart",
      "Units and buildings receive -15% damage when located on higher elevation",
      "Mounted Units regenerate 2/8/14 HP per minute in Feudal/Castle/Imperial Age",
      "Fortified Churches provide Villagers in a 9 tiles radius with +10% work rate"
    ],
    "teamBonus": "Building repairs cost -25%",
    "uniqueUnits": [
      {
        "name": "Monaspa",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Svan Towers (Fortifications +2 attack; Watch Tower-line deals pass through damage)",
      "Aznauri Cavalry (Mounted Units take -20% population space)"
    ],
    "descriptiveTags": [
      "Defensive",
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120194
  },
  {
    "id": "GOTHS",
    "name": "Goths",
    "typeLabel": "Infantry civilization",
    "identity": "Infantry focus",
    "bonuses": [
      "Loom is researched instantly",
      "Hunters carry +15; hunted animals last +20% longer",
      "Infantry costs -15/20/25/30% in Dark/Feudal/Castle/",
      "Imperial Age",
      "Infantry +1/+2/+3 attack vs. buildings in Feudal/",
      "Castle/Imperial Age",
      "+10 population space in Imperial Age"
    ],
    "teamBonus": "Barracks work +20% faster",
    "uniqueUnits": [
      {
        "name": "Huskarl",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Anarchy (Huskarls can be trained at Barracks)",
      "Perfusion (Barracks work +100% faster)"
    ],
    "descriptiveTags": [
      "Infantry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120152
  },
  {
    "id": "GURJARAS",
    "name": "Gurjaras",
    "typeLabel": "Cavalry and Camel civilization",
    "identity": "Cavalry & Camel focus",
    "bonuses": [
      "Start with 2 Forage Bushes",
      "Can garrison livestock in Mills to passively produce food",
      "Mounted Units deal +20/30/40% bonus damage in Feudal/Castle/Imperial Age",
      "Docks +5 garrison capacity"
    ],
    "teamBonus": "Camel and Elephant Units train +25% faster",
    "uniqueUnits": [
      {
        "name": "Chakram Thrower",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Shrivamsha Rider",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Camel Scout",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Kshatriyas (Military Units cost -25% food)",
      "Frontier Guards (Camel Riders and Elephant Archers +4 melee armor)"
    ],
    "descriptiveTags": [
      "Cavalry",
      "Camel"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120191
  },
  {
    "id": "HINDUSTANIS",
    "name": "Hindustanis",
    "typeLabel": "Camel and Gunpowder civilization",
    "identity": "Camel & Gunpowder focus",
    "bonuses": [
      "Villagers cost -8/13/18/23% in Dark/Feudal/Castle/",
      "Imperial Age",
      "Camel Riders attack +20% faster",
      "Gunpowder Units +1 melee/+1 pierce armor",
      "Can build Caravanserai in Imperial Age"
    ],
    "teamBonus": "Scout Cavalry-line and Camel Units +2 attack vs. buildings",
    "uniqueUnits": [
      {
        "name": "Ghulam",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Imperial Camel Rider",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Grand Trunk Road (All gold income +10% faster; Market trading fee reduced to 10%)",
      "Shatagni (Hand Cannoneers +2 range)"
    ],
    "descriptiveTags": [
      "Camel",
      "Gunpowder"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120169
  },
  {
    "id": "HUNS",
    "name": "Huns",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Do not need houses, but start with -100 wood",
      "Cavalry Archers cost -10/20% in Castle/Imperial Age",
      "Trebuchets fire more accurately at units and small targets",
      "On Nomadic maps, the first Town Center spawns a scouting Horse"
    ],
    "teamBonus": "Stables work +20% faster",
    "uniqueUnits": [
      {
        "name": "Tarkan",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Marauders (Tarkans can be trained at Stables)",
      "Atheism (Enemy Relics generate -50% resources; Wonder and Relic victory takes +100 years)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120166
  },
  {
    "id": "INCAS",
    "name": "Incas",
    "typeLabel": "Infantry civilization",
    "identity": "Infantry focus",
    "bonuses": [
      "Houses and Settlements provide +5 population space",
      "Buildings cost -15% stone",
      "Military Units cost -15/20/25/30% food in Dark/Feudal/Castle/Imperial Age",
      "Villagers affected by Infantry Blacksmith upgrades starting in Castle Age"
    ],
    "teamBonus": "Start with a free Llama",
    "uniqueUnits": [
      {
        "name": "Kamayuk",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Andean Sling (Skirmishers and Slingers no minimum range; Slingers +1 attack)",
      "Fabric Shields (Kamayuks, Slingers and Champi Warriors +1 melee/+1 pierce armor)"
    ],
    "descriptiveTags": [
      "Infantry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120170
  },
  {
    "id": "ITALIANS",
    "name": "Italians",
    "typeLabel": "Archer and Naval civilization",
    "identity": "Archer & Naval focus",
    "bonuses": [
      "Advancing to the next Age costs -15%",
      "Foot Archers and Condottieri +1 melee/+1 pierce armor",
      "Dock and University technologies cost -25%",
      "Gunpowder Units cost -20%",
      "Fishing Ships cost -15%"
    ],
    "teamBonus": "Condottiero available at the Barracks in Imperial Age",
    "uniqueUnits": [
      {
        "name": "Genoese Crossbowman",
        "role": "Foot Archer",
        "iconAsset": null
      },
      {
        "name": "Condottiero",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Silk Road (Trade Units cost -50%)",
      "Pirotechnia (Hand Cannoneers deal +15% pass through damage and are more accurate)"
    ],
    "descriptiveTags": [
      "Archer",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120168
  },
  {
    "id": "JAPANESE",
    "name": "Japanese",
    "typeLabel": "Infantry civilization",
    "identity": "Infantry focus",
    "bonuses": [
      "Mills, Lumber- and Mining Camps cost -50%",
      "Infantry attacks +33% faster starting in Feudal Age",
      "Cavalry Archers +2 attack vs. Ranged Soldiers (except Skirmishers)",
      "Fishing Ships work +5/10/15/20% faster in Dark/Feudal/Castle/Imperial Age; +100% HP"
    ],
    "teamBonus": "Galley-line +4 line of sight",
    "uniqueUnits": [
      {
        "name": "Samurai",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Yasama (Watch Tower-line fires additional arrows)",
      "Kataparuto (Trebuchets attack and pack/unpack faster)"
    ],
    "descriptiveTags": [
      "Infantry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120154
  },
  {
    "id": "JURCHENS",
    "name": "Jurchens",
    "typeLabel": "Cavalry and Gunpowder civilization",
    "identity": "Cavalry & Gunpowder focus",
    "bonuses": [
      "Meat of hunted and livestock animals doesn't decay",
      "Mounted Units and Fire Lancers attack +25% faster starting in Feudal Age",
      "Siege Engineers available in Castle Age",
      "Siege and Fortification upgrades cost -75% wood and research +100% faster",
      "Units receive -50% friendly fire damage"
    ],
    "teamBonus": "Gunpowder Units +2 line of sight",
    "uniqueUnits": [
      {
        "name": "Iron Pagoda",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Grenadier",
        "role": "Gunpowder Unit",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Fortified Bastions (Fortifications regenerate 500 HP per minute)",
      "Thunderclap Bombs (Rocket Carts, Grenadiers and Lou Chuans detonate when defeated; projectiles produce additional explosions)"
    ],
    "descriptiveTags": [
      "Cavalry",
      "Gunpowder"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120201
  },
  {
    "id": "KHITANS",
    "name": "Khitans",
    "typeLabel": "Infantry and Cavalry civilization",
    "identity": "Infantry & Cavalry focus",
    "bonuses": [
      "Pastures replace Farms",
      "Melee attack upgrade effects are doubled",
      "Skirmishers, Spearman-, and Scout Cavalry-line train and upgrade +15% faster",
      "Heavy Cavalry Archer upgrade available in Castle Age and costs -50%"
    ],
    "teamBonus": "Infantry +2 attack vs. Ranged Soldiers",
    "uniqueUnits": [
      {
        "name": "Liao Dao",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Mounted Trebuchet",
        "role": "Siege Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Lamellar Armor (Infantry and Skirmishers reflect 25% melee damage back to the attacker)",
      "Ordo Cavalry (Cavalry regenerates HP in combat)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120202
  },
  {
    "id": "KHMER",
    "name": "Khmer",
    "typeLabel": "Siege and Elephant civilization",
    "identity": "Siege & Elephant focus",
    "bonuses": [
      "No buildings required to advance to the next Age or to unlock other buildings",
      "Farmers don't require Mills or Town Centers to drop off food",
      "Villagers can garrison in Houses",
      "Battle Elephants move +10% faster"
    ],
    "teamBonus": "Scorpions +1 range",
    "uniqueUnits": [
      {
        "name": "Ballista Elephant",
        "role": "Siege Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Tusk Swords (Battle Elephants +3 attack)",
      "Double Crossbow (Ballista Elephants and Scorpions fire an additional projectile)"
    ],
    "descriptiveTags": [
      "Siege",
      "Elephant"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120177
  },
  {
    "id": "KOREANS",
    "name": "Koreans",
    "typeLabel": "Defensive and Naval civilization",
    "identity": "Defensive & Naval focus",
    "bonuses": [
      "Stone miners work +20% faster",
      "Ranged Soldiers and Infantry cost -50% wood",
      "Archer armor and tower upgrades free (Bombard Tower requires Chemistry)",
      "Warships cost -20% wood"
    ],
    "teamBonus": "Villagers +3 line of sight",
    "uniqueUnits": [
      {
        "name": "War Wagon",
        "role": "Mounted Archer",
        "iconAsset": null
      },
      {
        "name": "Turtle Ship",
        "role": "Warship",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Eupseong (Watch Tower-line +2 range)",
      "Shinkichon (Rocket Carts and Turtle Ships +1 range, fire additional projectiles)"
    ],
    "descriptiveTags": [
      "Defensive",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120167
  },
  {
    "id": "LITHUANIANS",
    "name": "Lithuanians",
    "typeLabel": "Cavalry and Monk civilization",
    "identity": "Cavalry & Monk focus",
    "bonuses": [
      "Each Town Center provides +100 food",
      "Spearman-line and Skirmisher-line move +10% faster",
      "Each garrisoned Relic provides +1 attack to Knight-line and Leitis (maximum +4)"
    ],
    "teamBonus": "Monasteries work +20% faster",
    "uniqueUnits": [
      {
        "name": "Leitis",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Winged Hussar",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Hill Forts (Town Centers +3 range)",
      "Tower Shields (Spearman-line and Skirmishers +2 pierce armor)"
    ],
    "descriptiveTags": [
      "Cavalry",
      "Monk"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120184
  },
  {
    "id": "MAGYARS",
    "name": "Magyars",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Villagers defeat wolves with one strike",
      "Scout Cavalry-line costs -15%",
      "Melee attack upgrades free"
    ],
    "teamBonus": "Mounted Archers train +25% faster",
    "uniqueUnits": [
      {
        "name": "Magyar Huszar",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Corvinian Army (Magyar Huszar gold cost is replaced by additional food cost)",
      "Recurve Bow (Mounted Archers +1 attack, +1 range)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120171
  },
  {
    "id": "MALAY",
    "name": "Malay",
    "typeLabel": "Naval civilization",
    "identity": "Naval focus",
    "bonuses": [
      "Advancing to the next Age is +66% faster",
      "Infantry armor upgrades free",
      "Battle Elephants cost -25/35% in Castle/Imperial Age",
      "Fish Traps cost -33% and provide +200% food"
    ],
    "teamBonus": "Docks +6 line of sight",
    "uniqueUnits": [
      {
        "name": "Karambit Warrior",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Thalassocracy (Docks are upgraded to Harbors)",
      "Forced Levy (Militia-line gold cost is replaced by additional food cost)"
    ],
    "descriptiveTags": [
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120178
  },
  {
    "id": "MALIANS",
    "name": "Malians",
    "typeLabel": "Infantry civilization",
    "identity": "Infantry focus",
    "bonuses": [
      "Buildings cost -15% wood",
      "Villagers drop off +10% more gold",
      "Barracks Units +1/+2/+3 pierce armor in Feudal/",
      "Castle/Imperial Age"
    ],
    "teamBonus": "Universities work +80% faster",
    "uniqueUnits": [
      {
        "name": "Gbeto",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Tigui (Town Centers fire arrows without garrison)",
      "Farimba (Cavalry +5 attack)"
    ],
    "descriptiveTags": [
      "Infantry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120175
  },
  {
    "id": "MAPUCHE",
    "name": "Mapuche",
    "typeLabel": "Cavalry and Counter-Units civilization",
    "identity": "Cavalry & Counter-Units focus",
    "bonuses": [
      "Foragers drop off +25% food",
      "Settlements can train Spearman-line and Skirmishers",
      "Infantry, Slingers and Skirmishers +5/10/15 HP in Feudal/Castle/Imperial Age",
      "Mounted Units generate +3 gold when defeating military units",
      "Enemy Castles are revealed on the map"
    ],
    "teamBonus": "Spearman-line and Skirmishers +2 line of sight",
    "uniqueUnits": [
      {
        "name": "Kona",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Bolas Rider",
        "role": "Mounted Archer",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Malon (Bolas Riders, Slingers and Skirmishers deal pass through damage)",
      "Butalmapu (Team Castle Unique Units and Bolas Riders cost -15%)"
    ],
    "descriptiveTags": [
      "Cavalry",
      "Counter-Units"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120207
  },
  {
    "id": "MAYANS",
    "name": "Mayans",
    "typeLabel": "Archer civilization",
    "identity": "Archer focus",
    "bonuses": [
      "Start with +1 Villager, but -50 food",
      "Resources last +15% longer",
      "Foot Archers cost -10/20/30% in Feudal/Castle/Imperial Age"
    ],
    "teamBonus": "Walls cost -50%",
    "uniqueUnits": [
      {
        "name": "Plumed Archer",
        "role": "Foot Archer",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Hul'che Javelineers (Skirmishers fire an additional projectile)",
      "Holcans (Eagle Warriors +40 HP)"
    ],
    "descriptiveTags": [
      "Archer"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120165
  },
  {
    "id": "MONGOLS",
    "name": "Mongols",
    "typeLabel": "Cavalry Archer civilization",
    "identity": "Cavalry Archer focus",
    "bonuses": [
      "Hunters work +40% faster",
      "Cavalry Archers attack +25% faster",
      "Scout Cavalry-line and Steppe Lancers +20/30% HP in Castle/Imperial Age"
    ],
    "teamBonus": "Scout Cavalry-line +2 line of sight",
    "uniqueUnits": [
      {
        "name": "Mangudai",
        "role": "Mounted Archer",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Nomads (Lost Houses do not decrease population space)",
      "Drill (Siege Workshop Units move +50% faster)"
    ],
    "descriptiveTags": [
      "Cavalry Archer"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120161
  },
  {
    "id": "MUISCA",
    "name": "Muisca",
    "typeLabel": "Archer and Monk civilization",
    "identity": "Archer & Monk focus",
    "bonuses": [
      "Advancing to the next Age costs -50% gold",
      "Settlements cost -33% and heal nearby units",
      "Champi Warriors and Archery Range Units +1/2/3 melee armor in Feudal/Castle/Imperial Age",
      "Monks regain faith +50% faster",
      "Caravan, Guilds free"
    ],
    "teamBonus": "Natural gold sources last +15% longer",
    "uniqueUnits": [
      {
        "name": "Guecha Warrior",
        "role": "Skirmisher",
        "iconAsset": null
      },
      {
        "name": "Temple Guard",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Herbalism (Archer-line and Champi Warriors move +15% faster)",
      "Huaracas (Slingers +1 range; train +50% faster)"
    ],
    "descriptiveTags": [
      "Archer",
      "Monk"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120206
  },
  {
    "id": "PERSIANS",
    "name": "Persians",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Start with +50 wood and +50 food",
      "Town Centers and Docks +100% HP and work +5/10/15/20% faster in Dark/Feudal/Castle/Imperial Age",
      "Parthian Tactics available in Castle Age",
      "Can build Caravanserai in Imperial Age"
    ],
    "teamBonus": "Knight-line +2 attack vs. Ranged Soldiers",
    "uniqueUnits": [
      {
        "name": "War Elephant",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Savar",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Kamandaran (Archer-line gold cost replaced by additional wood cost)",
      "Citadels (Castles +4 attack, +3 vs. Rams, +3 vs. Infantry and receive -25% bonus damage)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120157
  },
  {
    "id": "POLES",
    "name": "Poles",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Folwark replaces Mill",
      "Villagers regenerate 10/15/20 HP in Feudal/Castle/Imperial Age",
      "Stone Miners generate gold in addition to stone",
      "Bloodlines and Scout Cavalry-line upgrades cost -50% food"
    ],
    "teamBonus": "Scout Cavalry-line +1 attack vs. Ranged Soldiers",
    "uniqueUnits": [
      {
        "name": "Obuch",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Winged Hussar",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Szlachta Privileges (Knight-line costs -60% gold)",
      "Lechitic Legacy (Scout Cavalry-line deals trample damage)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120187
  },
  {
    "id": "PORTUGUESE",
    "name": "Portuguese",
    "typeLabel": "Naval and Gunpowder civilization",
    "identity": "Naval & Gunpowder focus",
    "bonuses": [
      "Foragers generate wood in addition to food",
      "All units cost -20% gold",
      "Can build Feitoria in Imperial Age",
      "Ships +10/15/20% HP in Feudal/Castle/Imperial Age"
    ],
    "teamBonus": "Technologies research +25% faster",
    "uniqueUnits": [
      {
        "name": "Organ Gun",
        "role": "Siege Gunpowder Unit",
        "iconAsset": null
      },
      {
        "name": "Caravel",
        "role": "Warship",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Circumnavigation (Sets the entire map to explored; Ships train +33% faster)",
      "Arquebus (Gunpowder Units fire more accurately at moving targets)"
    ],
    "descriptiveTags": [
      "Naval",
      "Gunpowder"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120173
  },
  {
    "id": "ROMANS",
    "name": "Romans",
    "typeLabel": "Infantry and Cavalry civilization",
    "identity": "Infantry & Cavalry focus",
    "bonuses": [
      "Villagers gather, build, and repair +5% faster",
      "Infantry armor upgrade effects are doubled",
      "Scorpions cost -50% gold",
      "Galley-line and Dromons +1 melee/+1 pierce armor"
    ],
    "teamBonus": "Scorpions minimum range reduced",
    "uniqueUnits": [
      {
        "name": "Centurion",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Legionary",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Ballistas (Scorpions attack +33% faster; Galley-line +2 attack)",
      "Comitatenses (Militia-line, Knight-line, and Centurions train +50% faster and receive a charge attack)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120192
  },
  {
    "id": "SARACENS",
    "name": "Saracens",
    "typeLabel": "Camel and Naval civilization",
    "identity": "Camel & Naval focus",
    "bonuses": [
      "Market trading fee only 5%; Markets cost -100 wood",
      "Camel Units +25% HP",
      "Galley-line attacks +25% faster",
      "Transport Ships +100% HP, +20 carry capacity"
    ],
    "teamBonus": "Foot Archers and Skirmishers +2 attack vs. buildings",
    "uniqueUnits": [
      {
        "name": "Mameluke",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Bimaristan (Monks passively heal multiple nearby units)",
      "Counterweights (Trebuchets and Mangonel-line +15% attack)"
    ],
    "descriptiveTags": [
      "Camel",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120158
  },
  {
    "id": "SHU",
    "name": "Shu",
    "typeLabel": "Archer and Siege civilization",
    "identity": "Archer & Siege focus",
    "bonuses": [
      "Lumberjacks generate food in addition to wood",
      "Archery Unit technologies at the Archery Range and Blacksmith cost -25%",
      "Siege Weapons and Siege Warships move +10/15% faster in Castle/Imperial Age"
    ],
    "teamBonus": "Foot Archers +2 line of sight",
    "uniqueUnits": [
      {
        "name": "White Feather Guard",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "War Chariot",
        "role": "Siege Weapon",
        "iconAsset": null
      },
      {
        "name": "Liu Bei",
        "role": "Hero",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Coiled Serpent Array (Spearman-line and White Feather Guards gain additional HP when near each other)",
      "Bolt Magazine (Archer-line, War Chariots and Lou Chuans fire additional projectiles)"
    ],
    "descriptiveTags": [
      "Archer",
      "Siege"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120198
  },
  {
    "id": "SICILIANS",
    "name": "Sicilians",
    "typeLabel": "Infantry and Cavalry civilization",
    "identity": "Infantry & Cavalry focus",
    "bonuses": [
      "Start with +100 stone",
      "Farm upgrades provide +125% additional food",
      "Soldiers receive -40% bonus damage",
      "Can build Donjon in Dark Age, replaces Watch Tower-line",
      "Fortifications built +50% faster; Town Centers built +100% faster"
    ],
    "teamBonus": "Transport Ships +5 line of sight and cost -50%",
    "uniqueUnits": [
      {
        "name": "Serjeant",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "First Crusade (Up to 5 Town Centers spawn 5 Serjeants each; units more resistant to conversion)",
      "Hauberk (Knight-line +1 melee/+2 pierce armor)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120186
  },
  {
    "id": "SLAVS",
    "name": "Slavs",
    "typeLabel": "Infantry and Siege civilization",
    "identity": "Infantry & Siege focus",
    "bonuses": [
      "Farmers work +15% faster",
      "Arson, Gambesons free",
      "Siege Workshop Units cost -15%",
      "Monks move +20% faster"
    ],
    "teamBonus": "Military buildings (except Castles) provide +5 population space",
    "uniqueUnits": [
      {
        "name": "Boyar",
        "role": "Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Detinets (Replaces 40% of Castle and Watch Tower-line stone cost with additional wood cost)",
      "Druzhina (Infantry deals trample damage)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Siege"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120172
  },
  {
    "id": "SPANISH",
    "name": "Spanish",
    "typeLabel": "Gunpowder and Monk civilization",
    "identity": "Gunpowder & Monk focus",
    "bonuses": [
      "Builders work +30% faster",
      "Receive +20 gold for each technology researched",
      "Blacksmith upgrades cost no gold",
      "Gunpowder Units attack +18% faster",
      "Cannon Galleons fire more accurately at moving targets"
    ],
    "teamBonus": "Trade Units generate +25% gold",
    "uniqueUnits": [
      {
        "name": "Conquistador",
        "role": "Mounted Gunner",
        "iconAsset": null
      },
      {
        "name": "Missionary",
        "role": "Mounted Monk",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Inquisition (Monks and Missionaries convert faster; Missionaries +1 range)",
      "Supremacy (Villagers +40 HP, +6 attack, +2 melee/+2 pierce armor)"
    ],
    "descriptiveTags": [
      "Gunpowder",
      "Monk"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120163
  },
  {
    "id": "TATARS",
    "name": "Tatars",
    "typeLabel": "Cavalry Archer civilization",
    "identity": "Cavalry Archer focus",
    "bonuses": [
      "Livestock animals last +50% longer",
      "Units deal +25% damage when fighting from higher elevation",
      "New Town Centers spawn 2 Sheep starting in Castle Age",
      "Thumb Ring, Parthian Tactics free"
    ],
    "teamBonus": "Mounted Archers +2 line of sight",
    "uniqueUnits": [
      {
        "name": "Keshik",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Flaming Camel",
        "role": "Siege Cavalry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Silk Armor (Scout Cavalry-line, Steppe Lancers and Cavalry Archers +1 melee/+1 pierce armor)",
      "Timurid Siegecraft (Trebuchets +2 range)"
    ],
    "descriptiveTags": [
      "Cavalry Archer"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120182
  },
  {
    "id": "TEUTONS",
    "name": "Teutons",
    "typeLabel": "Infantry and Defensive civilization",
    "identity": "Infantry & Defensive focus",
    "bonuses": [
      "Farms cost -40%",
      "Town Centers +10 garrison capacity; Towers +5 garrison capacity",
      "Barracks and Stable Units +1/+2 melee armor in Castle/Imperial Age",
      "Monks +100% healing range",
      "Murder Holes, Herbal Medicine free"
    ],
    "teamBonus": "Units more resistant to conversion",
    "uniqueUnits": [
      {
        "name": "Teutonic Knight",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Ironclad (Siege Weapons +4 melee armor)",
      "Crenellations (Castles +3 range, garrisoned Infantry fires arrows)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Defensive"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120153
  },
  {
    "id": "TUPI",
    "name": "Tupi",
    "typeLabel": "Archer and Infantry civilization",
    "identity": "Archer & Infantry focus",
    "bonuses": [
      "Start with +25 of each resource",
      "Villagers can garrison in Settlements",
      "Fallen units return 15% of their cost",
      "Archery Range and Barracks upgrades cost -50% food"
    ],
    "teamBonus": "Towers and Castles provide +10 population space",
    "uniqueUnits": [
      {
        "name": "Blackwood Archer",
        "role": "Foot Archer",
        "iconAsset": null
      },
      {
        "name": "Ibirapema Warrior",
        "role": "Infantry",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Caciques (Champi Warriors and Slingers attack +25% faster)",
      "Curare (Foot Archers and Fortifications deal poison damage)"
    ],
    "descriptiveTags": [
      "Archer",
      "Infantry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120208
  },
  {
    "id": "TURKS",
    "name": "Turks",
    "typeLabel": "Gunpowder civilization",
    "identity": "Gunpowder focus",
    "bonuses": [
      "Gold miners work +25% faster",
      "Scout Cavalry-line +1 pierce armor and upgrades free",
      "Chemistry free; Gunpowder technologies costs -50%",
      "Gunpowder Units +25% HP"
    ],
    "teamBonus": "Gunpowder Units train +25% faster",
    "uniqueUnits": [
      {
        "name": "Janissary",
        "role": "Foot Gunner",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Sipahi (Mounted Archers +20 HP)",
      "Artillery (Bombard Towers, Bombard Cannons, Cannon Galleons +2 range)"
    ],
    "descriptiveTags": [
      "Gunpowder"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120159
  },
  {
    "id": "VIETNAMESE",
    "name": "Vietnamese",
    "typeLabel": "Archer civilization",
    "identity": "Archer focus",
    "bonuses": [
      "Enemy Town Centers are revealed at the start of the game",
      "Economic upgrades cost no wood and research +100% faster",
      "Archery Range units and Fire Lancers +20% HP",
      "Conscription free"
    ],
    "teamBonus": "Imperial Skirmisher upgrade available in Imperial Age",
    "uniqueUnits": [
      {
        "name": "Rattan Archer",
        "role": "Foot Archer",
        "iconAsset": null
      },
      {
        "name": "Imperial Skirmisher",
        "role": "Skirmisher",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Chatras (Battle Elephants +100 HP)",
      "Paper Money (Lumberjacks slowly generate gold in addition to wood)"
    ],
    "descriptiveTags": [
      "Archer"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120180
  },
  {
    "id": "VIKINGS",
    "name": "Vikings",
    "typeLabel": "Infantry and Naval civilization",
    "identity": "Infantry & Naval focus",
    "bonuses": [
      "Wheelbarrow, Hand Cart free",
      "Infantry +20% HP starting in Feudal Age",
      "Warships cost -10/15/20% in Feudal/Castle/Imperial Age"
    ],
    "teamBonus": "Docks cost -15%",
    "uniqueUnits": [
      {
        "name": "Berserk",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Longboat",
        "role": "Warship",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Chieftains (Infantry +5 attack vs. Cavalry, +4 vs. Camel Units; generate +5 gold when defeating Villagers, Trade Units and Monks)",
      "Bogsveigar (Archer-line and Longboats +1 attack)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120160
  },
  {
    "id": "WEI",
    "name": "Wei",
    "typeLabel": "Cavalry civilization",
    "identity": "Cavalry focus",
    "bonuses": [
      "Receive one free Villager for each economic upgrade researched",
      "Hei Guang Cavalry and Xianbei Raider +20/30% HP in Castle/Imperial Age",
      "Traction Trebuchets and Lou Chuans cost -25%"
    ],
    "teamBonus": "Cavalry +2 attack vs. Siege Weapons",
    "uniqueUnits": [
      {
        "name": "Tiger Cavalry",
        "role": "Cavalry",
        "iconAsset": null
      },
      {
        "name": "Xianbei Raider",
        "role": "Mounted Archer",
        "iconAsset": null
      },
      {
        "name": "Cao Cao",
        "role": "Hero",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Tuntian (Soldiers passively produce food)",
      "Ming Guang Armor (Mounted Units +4 melee armor)"
    ],
    "descriptiveTags": [
      "Cavalry"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120200
  },
  {
    "id": "WU",
    "name": "Wu",
    "typeLabel": "Infantry and Naval civilization",
    "identity": "Infantry & Naval focus",
    "bonuses": [
      "Military production buildings and Docks provide +55 food",
      "Infantry regenerates 10/15/30 HP per minute in Feudal/Castle/Imperial Age",
      "Jian Swordsmen and Hei Guang Cavalry +2 attack in Imperial Age",
      "Careening, Dry Dock free"
    ],
    "teamBonus": "Houses built +100% faster",
    "uniqueUnits": [
      {
        "name": "Fire Archer",
        "role": "Foot Archer",
        "iconAsset": null
      },
      {
        "name": "Jian Swordsman",
        "role": "Infantry",
        "iconAsset": null
      },
      {
        "name": "Sun Jian",
        "role": "Hero",
        "iconAsset": null
      }
    ],
    "uniqueTechnologies": [
      "Red Cliffs Tactics (Demolition Ships and Fire Archers deal fire damage to ships and buildings)",
      "Sitting Tiger (Traction Trebuchets and Lou Chuan trebuchet weapons fire additional projectiles)"
    ],
    "descriptiveTags": [
      "Infantry",
      "Naval"
    ],
    "iconAsset": null,
    "sourceHelpStringId": 120199
  }
] as CivilizationCatalogueEntry[];
const byId=new Map(civilizationCatalogue.map(entry=>[entry.id,entry]));
export function civilizationById(id:string|null|undefined){
  if(!id)return null;
  return byId.get(id.toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,''))??null;
}
export function civilizationName(id:string|null|undefined){
  return civilizationById(id)?.name??(id?String(id).replaceAll('_',' '):'Unknown civilization');
}
