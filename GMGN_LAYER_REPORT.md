# Rapport GMGN Layer - Memeclaw

Fichier vivant. On continue d'ajouter les repos et les verdicts dans ce fichier jusqu'au rapport final massif.

Date: 2026-09-15

## Contexte

- Projet actif: `memeclaw` (TypeScript).
- Scope bot: Solana + Robinhood/Fomo d'abord, BSC/Base plus tard.
- On garde uniquement le memecoin trading. LP, Yield, NFT, Polymarket, perps sont hors scope.
- La couche GMGN existante se trouve dans [src/adapters/gmgn-adapter.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/adapters/gmgn-adapter.ts:4>).
- Le projet a déjà les scouts: `meme-solana`, `meme-robinhood`, `meme-base`, `meme-eth`, `meme-ink`, `ct-alpha`. `meme-ink` sera remplacé par `meme-bsc`; `meme-eth` reste conservé comme scout désactivable jusqu'à décision de retrait.

## Catégories utilisées

- `Adopt`: intégrer comme contrat, SDK, provider ou dépendance directe après audit ciblé.
- `Adapt`: réimplémenter le mécanisme ou le pattern dans notre propre code et notre propre surface d'API.
- `Study`: lire, comparer, tester ou prototyper avant de décider; aucune dépendance directe.
- `Skip`: hors scope, fragmentaire, risqué, inutile ou en doublon du stack existant.

Note usage personnel: les licences et les langages ne sont plus des critères de blocage. Les verdicts restent basés sur l'utilité fonctionnelle, le risque runtime, la qualité du code et le scope memecoin.

Règle d'adaptation multi-chain: si un repo est intéressant mais construit pour une seule chain, on évalue toujours sa portabilité vers nos chains actives: Solana/Pump.fun, Robinhood/Fomo, Base, BSC. Un verdict peut donc être `Adapt Solana` + `Adaptable RH` + `Study Base/BSC` ou `Skip BSC` si la logique dépend d'un contrat unique non portable.

## Consignes et fichiers de contexte

- `AWESOME-TRADING-AGENTS-SWEEP.md`: catalogue de repos, contextuel, pas un ordre d'implémentation.
- `RESEARCH.md`: reflète l'ancienne phase Memeland. L'hypothèse "GMGN ne supporte pas Robinhood" y est datée; le code actuel accepte `robinhood` dans l'adapter GMGN et GMGN documente Robinhood meme coins.
- `AGENTS.md`: directives de développement, pas des changements de scope.
- Pas de code modifié pour ce rapport; pas de recherche AST nécessaire. `ast-grep` CLI non disponible dans le PATH, j'ai utilisé `rg`.

## Verdict global

Le projet a déjà l'essentiel de la couche GMGN basique: rank, trenches, token info, security, token signal, hot searches, smart money/KOL tracks. La valeur des repos étudiés est surtout dans:

- les workflows de due diligence (dev, holders, sécurité, smart money),
- le passage en mode SHADOW/LIVE,
- la détection de tape Robinhood et le suivi fomo wallets,
- le scoring wallets/copy-trade,
- la mémoire agent et l'audit des décisions.

Peu de `Adopt` direct: la plupart des sources utiles sont `Adapt` (réimplémentation interne) ou `Study` (recherche avant branchement).

---

## Roadmap v3 (2026-09-17)

Priorités réécrites après relecture de la liste dédupliquée et reclassification `Adopt / Adapt / Study / Skip`.

### P0 - Fondation actuelle, à finaliser

- `meme-solana`, `meme-robinhood`, `meme-base`, `meme-bsc`, `meme-eth`, `ct-alpha` actifs dans le registry; retirer `meme-ink`.
- Conserver `gmgn-adapter` + callout comme hub d'intel; ajouter source-health, event envelope, dedupe et replay.
- Renforcer `token-gatebook` et `risk-engine` avec les mécanismes `Adapt` prioritaires: mint/freeze/concentration, bundles, liquidity lock, metadata, holder concentration, smart-money convergence.
- Garder la règle: gates déterministes veto, LLM propose/explique, signer isolé.

### P1 - Tape RH/Fomo, Solana execution read-only et CT Alpha

- Reprendre les mécanismes de `fomopulse-robinhood-chain-tape`, `fomo-robinhood-radar`, `copy`, `pons-sniper` et `fomo-solana-rh-listeners`: reconstruction des fills, provider Pons V1/V2, dossier deployer, scoring wallet/token, règles de copy paper.
- Brancher `pumpfun-bonkfun-bot`, `qlo`, `loxley`, `stampede`, `aegis` et `MEERKAT` en patterns internes: refresh curve avant sell, priority fee borné, force-close dev-sell, rotation wallets, evidence-first scoring.
- Activer `ct-alpha` avec ingestion contrôlée (`Agent-Reach`, `world-intel-mcp`, `last30days`, `claimchain`) et vérification des claims LLM.

### P2 - Canary live Solana/RH après paper

- Auditer puis intégrer `pumpdotfun-sdk` et `jito-ts` derrière `ExecutionProvider`.
- Ajouter `GARCHMethod` pour le sizing vol-targeted, `tradememory-protocol` pour l'audit et le recall pondéré, `million`/`Smart-Money-Tracker` pour le deck wallet/positions.
- Passer en SHADOW puis paper sur RH/Fomo; aucune clé live tant que replay, chaos RPC, emergency sell et reconciliation ne passent pas.

### P3 - Base et BSC

- Ports EVM avec viem/nonce manager, adaptateurs DexScreener/DexPaprika/Bitquery/Codex en fallback.
- BSC: `4Meme-Pilot` et `bsc-fourmeme-bot` pour la config launchpad, sans bundlers/volume.
- Base: uniswap v2/v3 patterns, launchpad listeners, Base MCP en Study.

### P4 - Étude continue

- `Study` backlog: indexeurs historiques (`carbon`, `squid-sdk`, `cryo`, `messari/subgraphs`), data lakes, backtest sans lookahead, simulation personas, futures wallets leaders.
- `Skip` restera fermé: LP/yield, NFT, Polymarket, perps, CEX derivatives, bundlers, volume bots, scrape fragile et dead sites.

---

## Corpus unique: ressources GMGN initiales

| Ressource | Verdict | Ce que j'en tire |
|---|---|---|
| `gmgn.ai/blog/robinhood-chain-meme-coins-with-gmgn` | Reference | Confirme le récit GMGN + Robinhood meme coins. Utile pour cadrer le scope, pas pour copier du code. |
| `docs.gmgn.ai/index/gmgn-agent-api` | Take | Spec officielle pour l'adapter GMGN: endpoints, payloads, rate limits. Source de vérité du layer. |
| `docs.gmgn.ai/index/gmgn-callout-openapi` | Take | Adopter le modèle callout/webhook/push pour les événements au lieu de polling seul. |
| `GMGNAI/gmgn-skills` | Borrow | Reprendre les workflows de due diligence, dev/holders, sécurité, smart money, pré-checks avant buy. Ne pas copier le CLI tel quel. |
| `skillmarket-demos/aitrader` (site + repo) | Borrow | Reprendre les hard gates déterministes + LLM résumé + mode SHADOW/LIVE + wallet evaluation. |
| `skillmarket-demos/memex` (site + repo) | Borrow | Reprendre le scoring pondéré sans LLM et fail-closed quand les données manquent. |
| `nhovongoc0-max/meme-radar` | Reference | Bonne UX local multi-chain scanner. AGPL: rester sur les patterns, ne pas vendorer/dupliquer. |
| `vybenetwork/solana-top-holders-api` | Reference | Modèle d'endpoint wrapper pour classement holders. Pas de licence claire: idées seulement. |
| `vybenetwork/solana-top-traders-api` | Reference | Modèle d'endpoint wrapper pour top traders; utile pour le volet smart money/copy-trade. |
| `vybenetwork/solana-trader-pnl-api` | Reference | Modèle d'endpoint PnL par wallet; utile pour confirmer la qualité d'une adresse avant suivi. |
| `pamgarcia1993/robinhood-lp-bot` | Hard No | LP/Yield sorti du scope. |
| `BikeTysonDegen/gmgn-terminal-bot` | Reference | Concepts terminal/copytrade/snipe et UX d'exécution. MIT mais à adapter avec tes propres guards. |
| `0xuezhang985/wallet-convergence-alert` | Borrow | Concept d'alerte quand plusieurs wallets suivis convergent sur un même token. Ne pas copier l'extension Chrome. |
| `lunarresearcher/copy` | Borrow | Le plus aligné avec copytrade Robinhood/smart money: paper engine, exécution, CLI. Patterns, pas copie en bloc. |
| `ChipaDevTeam/GmGnAPI` | Skip | Wrapper Python inutile pour un projet TS qui consomme déjà l'OpenAPI. |
| `nirholas/scrape-smart-wallets` | Hard No | Scraping browser fragile, pas de licence claire, ToS/rate-limit risqué. Utiliser l'API officielle / callouts. |
| `chasepal/gmgn-wallet-holdings` | Skip | Userscript wallet holdings. Utile seulement si carte positions GMGN demandée. |

---

## Corpus unique: nouveaux repos ajoutés

| Ressource | Licence | Verdict | Ce que j'en tire |
|---|---|---|---|
| `zostaff/ai-quant-researcher` | MIT/NOASSERTION | Reference | Génération de stratégies par LLM + validation qui tue les mauvaises idées. Idée intéressante pour un futur layer de validation, mais c'est Python/equity, pas le coeur GMGN. |
| `kocer6/MEERKAT` | none | Borrow | Evidence-first token/wallet intelligence pour Pons V2 sur Robinhood Chain. Reprendre: scoring token/wallet avec preuves, leaderboard wallets éligibles, relation maps, fee flow. Pas de signer, read-only. |
| `semkazz1/FlySwarm` | MIT | Borrow | Wallet-cohort intelligence RH: wallets rentables -> adresses fraîches -> groupes récurrents -> signal. Reprendre swarm trace, cohort memory, FIRE/WATCH/NOISE. Autosnipe à garder hors du coeur. |
| `cvxv666/fomo-robinhood-radar` | MIT | Borrow | Très aligné Robinhood/Fomo: résolution profile fomo -> vrai wallet, tape 20s, provenance des fills, AI verdicts. Reprendre le pipeline de résolution et le modèle de classement par jugement. |
| `itsnex1s/fomopulse-robinhood-chain-tape` | MIT | Borrow | Tape live des top traders fomo sur RH, read-only, RPC public, environ une seconde après landing. Reprendre l'architecture tape + Durable Object + pricing. |
| `zostaff/agent-arena` | MIT | Reference | Paper trading agents avec modes CHAIN/PAPER, stats qui alimentent les paramètres moteur. Utile pour comparer le design UI/paper, moins critique pour le layer GMGN. |
| `gustaffsonKotte/qlo` | MIT | Borrow | Pump.fun graduation scanner. Reprendre l'idée: temps de remplissage de la courbe comme filtre qualité. Les graduations lentes ont l'air statistiquement plus fortes. Utile pour Solana meme. |
| `rimtoln/COPUMP` | none | Borrow | Paper copy desk pour pump.fun: BANK/RUG/NEWS/GATE/COPY. Reprendre le pattern de séparation position/rug/news/gate/copy. Pas de copie directe sans licence. |
| `0xwast3/PELLET` | MIT | Borrow | Wake terminal RH: wallets dormants qui se réveillent, cinq murs de décision, smart-flow desk. Reprendre la détection wake/dormancy et le concept de "refusal named". |
| `moorcheh-ai/memanto` | MIT | Reference | Mémoire gérée pour agents IA: extraction, consolidation, conflits, oubli, briefs. Utile pour un futur module de mémoire trading/audit des décisions. Pas spécifique crypto. |

## Priorités pour la suite

1. Garder l'adapter GMGN actuel comme socle.
2. Ajouter la couche callout/webhook GMGN.
3. Emprunter à `aitrader`/`memex` les scores déterministes et le mode SHADOW/LIVE.
4. Construire une couche Robinhood/Fomo tape inspirée de `fomo-robinhood-radar` et `fomopulse-robinhood-chain-tape`.
5. Ajouter un scoring wallets/copy-trade inspiré de `FlySwarm`, `MEERKAT`, `PELLET`, `lunarresearcher/copy`.

---

## Corpus unique: listeners, exécution, recherche et infrastructure

Les deux liens avec ancres vers `LLMQuant/awesome-trading-agents` sont le même repository que le catalogue initial. Ils sont évalués une seule fois ici; l'ancre change seulement la section visée.

| Ressource | Licence | Verdict | Ce que j'en tire |
|---|---|---|---|
| `chainstacklabs/fomo-solana-rh-listeners` | Apache-2.0 | Borrow | Référence technique pour écouter FOMO sur Solana et Robinhood: ERC-4337/7702, Relay, venues, événements et normalisation. Expérimental: reprendre les listeners, pas toute l'app. |
| `TauricResearch/TradingAgents` | Apache-2.0 | Borrow | Pattern bull/bear analysts -> risk manager -> portfolio manager. Très bon pour le débat borné, mais ne pas adopter le swarm complet pour des cycles meme rapides. |
| `The-Swarm-Corporation/AutoHedge` | MIT | Reference | Idées de mémoire partagée, risk layer, orchestration et exécution. Trop large pour devenir le socle de Memeclaw. |
| `HKUDS/Vibe-Trading` | MIT | Reference | Référence Skills/MCP, presets multi-horizon et workspace agent. Trop généraliste; éviter d'importer sa complexité multi-actifs. |
| `pgen0x/azimuth` | MIT | Hard No | Bot LP Meteora/Uniswap. Le code est propre comme architecture d'opérations, mais LP/Yield est explicitement retiré du projet. |
| `andreysuperiorgit/aegis` | MIT | Borrow | Six contrôles déterministes: mint, freeze, concentration, bundles, LP lock, metadata. Reprendre le gatebook et le score explicable; l'IA ne doit jamais bypasser un hard gate. |
| `akanz/onchain-trading-bot` | none | Borrow | Admission wallets, Wilson-adjusted win rate, ROI multi-fenêtres, découverte GMGN/Fomo et gates de sécurité. Algorithmes seulement: aucune licence de code exploitable. |
| `Fincept-Corporation/FinceptTerminal` | NOASSERTION | Skip | Terminal financier desktop généraliste, lourd et hors cible. Ne pas en faire un fork ni reprendre du code sans clarification de licence. |
| `LLMQuant/awesome-trading-agents` | CC0/catalogue | Reference | Catalogue de découverte, pas une dépendance runtime. Les ancres `#mcps-tradingagents-mcpmode` et `#agents-atlas-gic` sont des entrées de navigation, pas des repos séparés. |
| `mnemox-ai/tradememory-protocol` | MIT | Borrow | Outcome-weighted recall, audit trail persistant, chaîne SHA-256 et mémoire de décisions. Très utile pour relier signal -> entrée -> sortie -> résultat. |
| `BlockRunAI/awesome-finance-mcp` | none/catalogue | Reference | Index de MCP finance. À utiliser pour trouver des providers, pas à intégrer comme runtime et pas à traiter comme garantie de qualité. |
| `Drakkar-Software/OctoBot` | GPL-3.0 | Hard No | Bot crypto multi-exchange orienté CEX/Grid/DCA. Mauvais fit Solana/RH et risque de contamination GPL si fork ou vendorisation. |
| `edtechre/pybroker` | NOASSERTION | Skip | Framework Python backtest/ML généraliste pour bar data. Peu de valeur pour le temps réel on-chain meme. |
| `PillCrew/PillCrew` | MIT | Borrow | Référence Solana très proche côté produit: token read, crew verdicts, whale follow, alerts, PnL, position sizing. Reprendre la séparation UI/analyse/portfolio, pas le desktop pet. |
| `nirholas/pump-fun-workers` | NOASSERTION | Borrow | Schémas MCP read-only pour recherche Pump.fun: token details, bonding curve, trades, holders, creator risk. Reprendre les contrats d'outils, pas copier le Worker sans licence claire. |
| `buddies2705/awesome-memecoin-trading` | MIT/catalogue | Reference | Annuaire large des launchpads, scanners, rug tools, smart-money trackers et MCPs. Source de veille pour les prochains lots, pas une brique logicielle. |
| `nhovongoc0-max/meme-radar` | AGPL-3.0 | Reference | Doublon du Batch 1. Conserver le verdict précédent: UX scanner utile, mais pas de code AGPL dans le bot. |
| `chainstacklabs/pumpfun-bonkfun-bot` | Apache-2.0 | Borrow | Mécanique Pump.fun/LetsBonk: détection de graduation/migration, écoute RPC et exécution sans API tierce. À adapter pour Solana; ne pas utiliser comme moteur live sans audit sécurité. |
| `0xjeffro/tx-parser` | MPL-2.0 | Borrow | Normalisation de transactions Solana en actions lisibles. Très utile pour evidence, provenance et timeline; préférer une interface interne plutôt que copier des fichiers MPL sans revue juridique. |
| `shmidtqq65/loxley` | MIT | Borrow | Référence RH extrêmement utile pour exits: dev-sell siren, exit quote, bundle/block-0 checks, taxes, graduation et guard indépendant. Le dev-sell force-close est un must-have. |
| `uerax/all-in-one-bot` | none | Skip | Bot Telegram Go multi-source avec Polymarket, RSS et outils génériques. Architecture Provider/Handler intéressante, mais trop éloignée et licence absente. |
| `redactedmeme/swarm` | MIT | Skip | Swarm LLM, token, proxy, mémoire vectorielle et nombreux services. Très overbuilt et partiellement hors scope; la mémoire est mieux couverte par TradeMemory/Memanto. |
| `Argona7/stampede` | none | Borrow | Signal très fort pour RH: rotation observée sell A -> buy B, fenêtre temporelle, attribution et RADAR de convergence. Reprendre les algorithmes, jamais copier le code sans licence. |
| `hummingbot/hummingbot` | Apache-2.0 | Skip | Excellent framework CEX/market-making, mais le modèle exchange connector/order-book ne correspond pas au feed GMGN + DEX meme ciblé. |
| `OpenBB-finance/OpenBB` | NOASSERTION | Skip | Plateforme de recherche et données pour analystes/agents, pas une couche d'exécution on-chain. Peut inspirer une interface data, sans dépendance. |
| `bmoscon/cryptofeed` | NOASSERTION | Skip | Websocket feeds d'exchanges centralisés. Ne résout pas les événements Pons/Pump.fun/RH et ajoute une dépendance inutile. |
| `alpacahq/alpaca-mcp-server` | MIT | Hard No | Brokerage equities/options/crypto Alpaca, hors Solana/RH et hors exécution GMGN. Ne pas intégrer. |
| `mocasus/trade-agent` | MIT | Reference | Pipeline modulaire market/news/indicators -> décision -> exécution, paper mode et tests. Bon pattern de séparation, mais Python et non spécialisé on-chain. |
| `985monitor.xyz` | unknown | Reference | Overlay catalyseur social/X/TG/WeChat. À garder optionnel: un signal social ne crée jamais un trade; scraping/SSE doit respecter ToS, budget et fail-closed. |
| `Lumiwealth/lumibot` | GPL-3.0 | Hard No | Backtest/live framework Python multi-asset. Trop large pour Memeclaw et licence GPL incompatible avec une base propriétaire non revue. |
| `ygwyg/MAHORAGA` | NOASSERTION | Reference | Sentiment social et apprentissage adaptatif dans un agent crypto. Idée pour `ct-alpha`, mais le learning ne doit pas modifier les gates de risque automatiquement. |
| `51bitquant/ai-hedge-fund-crypto` | MIT | Reference | Adaptation crypto de l'architecture AI hedge fund et analyse multi-timeframe. Utile pour comparer des prompts, pas pour remplacer le pipeline déterministe. |
| `Tomortec/CryptoTradingAgents` | Apache-2.0 | Borrow | Framework multi-agents crypto. Reprendre seulement les rôles et l'organisation du contexte; garder un comité borné et un veto quant avant exécution. |
| `ryan-yuuu/crypto-trading-arena` | Apache-2.0 | Reference | Arène de comparaison d'agents et paper trading. Utile pour benchmark de stratégies, pas pour la production GMGN. |
| `LLMQuant/awesome-trading-agents#agents-atlas-gic` | CC0/catalogue | Reference | Doublon du catalogue `awesome-trading-agents`; l'ancre Atlas GIC ne justifie aucune intégration séparée. |

## Synthèse technique du corpus: listeners, exécution, recherche et infrastructure

### À intégrer dans l'architecture cible

1. **Ingest RH/Fomo:** listeners Chainstack + tape FomoPulse/Fomo Radar, avec normalisation d'un événement `TradeEvent` commun.
2. **Wallet intelligence:** résolution profile -> wallet, attribution des fills, rotations `sell A -> buy B`, cohortes récurrentes, wallet dormancy/wake.
3. **Token gatebook:** six contrôles AEGIS, gates de liquidité/holders/authority/bundles, et unknown = reject.
4. **Execution safety:** loxley-style dev-sell force-close, quote de sortie séparé, tax/slippage/depth checks, exit monitor indépendant du LLM.
5. **Decision layer:** débat borné inspiré de TradingAgents, mais sortie soumise au veto quant et au mode SHADOW/LIVE.
6. **Audit/mémoire:** TradeMemory pour outcomes et audit; Memanto reste une référence pour consolidation, conflits et expiration.
7. **Solana launch intelligence:** Pump.fun/LetsBonk graduation, courbe lente de `qlo`, bonding curve et migration.

### À ne pas intégrer

- Aucun LP/Yield depuis `azimuth`.
- Aucun framework GPL sans décision juridique explicite: `OctoBot`, `LumiBot`.
- Aucun brokerage CEX/equities: Alpaca, Fincept, OpenBB, Hummingbot comme socle.
- Aucun scraping social ou wallet non officiel comme source de vérité.
- Aucun swarm LLM massif qui peut retarder un cycle meme de 20-60 secondes.

## Rang des sources du corpus: listeners, exécution, recherche et infrastructure

| Rang | Source | Valeur principale |
|---:|---|---|
| 1 | `shmidtqq65/loxley` | Exits RH, dev-sell guard, quote et sécurité de lancement. |
| 2 | `cvxv666/fomo-robinhood-radar` | Résolution wallets Fomo, provenance, scoring trader. |
| 3 | `itsnex1s/fomopulse-robinhood-chain-tape` | Tape RH read-only à faible latence. |
4 | `chainstacklabs/fomo-solana-rh-listeners` | Compréhension on-chain Fomo Solana/RH. |
| 5 | `Argona7/stampede` | Rotation wallet et signal de réallocation. |
| 6 | `kocer6/MEERKAT` | Dossiers evidence-first token/wallet Pons V2. |
| 7 | `semkazz1/FlySwarm` | Cohortes, funding graph et convergence. |
| 8 | `andreysuperiorgit/aegis` | Gatebook anti-scam lisible et déterministe. |
| 9 | `mnemox-ai/tradememory-protocol` | Audit et mémoire pondérée par outcome. |
| 10 | `gustaffsonKotte/qlo` | Filtre graduation lente Pump.fun. |

---

## Corpus unique: second pass - fichiers et mécanismes précis

Ce second pass regarde les sources réelles des candidats forts du Batch 3, pas seulement les README. Les verdicts restent `Take`, `Copy`, `Borrow`, `Reference`, `Skip`, `Hard No`. Aucun code du projet n'a été modifié.

### `shmidtqq65/loxley` — second pass

Licence MIT. À garder en tête comme la référence la plus concrète pour le volet exits RH.

Fichiers lus:
- `cli/pons.js`
- `cli/trade.js`
- `docs/SCORING.md`

Ce qu'il faut porter comme idée:
- Décodage du calldata de lancement: bundle déclaré, creator fee recipient, `snipeTaxExemptions`, socials, paramètres de lancement.
- Lecture multi-call de l'état de la courbe: reserves, real quote reserve, tokens vendables, frais, tax creator, snipe tax d'ouverture par buyer.
- Arithmétique de sortie basée sur le produit constant: impact, safe exit size, quote de sortie séparée de la logique d'entrée.
- Survival index avec depth/flow/holders/contract/age/turnover, hard caps, pénalités de wash, drain cap sur l'historique du token.
- Votes d'agents: `SCOUT`, `AUDIT`, `WHALE`, `LP`, `FLOW`, `VOL`, `SNIPER`, `EXIT`.
- Dev-sell trigger: lecture des événements deployer `CurveSell` / `Transfer` et force-close.

Points de guard à copier dans le design:
- Le force-close dev-sell doit être déterministe et indépendant du LLM.
- Calculer la quote de sortie avant l'exécution, pas seulement le montant d'entrée.
- Taille de sortie safe dérivée de la courbe réelle, avec impact et depth.

À ne pas faire: copier le CLI entier ou brancher son scoring comme unique source. Reprendre les mécanismes de sortie et de lecture d'état.

### `cvxv666/fomo-robinhood-radar` — second pass

Licence MIT. C'est le candidat le plus fort pour la résolution profile Fomo -> wallet.

Fichiers lus:
- `fomo_agent/pipeline/resolve.py`
- `fomo_agent/pipeline/score.py`

Patterns précis:
- Fomo profile -> résolution on-chain via maker sets. Chaque fenêtre de trade contribue `1/len(makers)`; les fenêtres calmes scorent plus.
- `decide()` exige un minimum de hits et un ratio face au runner-up; gère les conflits quand un autre handle possède déjà un wallet.
- Utiliser le RPC Robinhood pour les fenêtres quand possible, pour éviter les coûts d'API externes.
- Scoring trader: le PnL Fomo, positions non réalisées incluses, est le signal principal; les buys/sells on-chain restent une vérification.
- Red flags: rotation d'inventaire bot-like, trade count élevé, unique tokens bas, median hold time bas.

À étudier dans le code: `rank_candidates`, `decide`, `resolve_pending`, et le format du prompt de scoring.

### `Argona7/stampede` — second pass

Aucune licence claire. Algorithmes et idées seulement, pas de code.

Fichiers lus:
- `stampede/rotation.py`
- `docs/ALGORITHM.md`

Patterns forts:
- Rotation edges: sell A -> buy B par le même wallet.
- Grades: `direct`, `clean`, `ambiguous`. Le poids principal d'un edge = nombre de wallets distincts avec séquences directes/clean.
- Attribution: ne jamais se fier aux champs buyer/seller sur RH. Sommer les Transfer logs, retirer l'infrastructure, isoler un seul wallet net, sinon `ambiguous`.
- Refuse explicitement le clustering, les smart-money scores et les claims de funding de l'achat.

Pour Memeclaw: c'est la base d'un signal de rotation entre tokens RH, plus fiable que le simple "un wallet vend A puis achète B" naïf.

### `andreysuperiorgit/aegis` — second pass

Licence MIT. Le gatebook anti-scam est directement transposable en TS.

Fichiers lus:
- `src/aegis/utils/score.js`
- `src/aegis/scanners/robinhood.scanner.js`

Patterns concrets:
- Score déterministe avec breakdown par check, pas un simple score LLM.
- Scanner RH qui vérifie: owner/mint authority, bytecodes dangereux (`pause`, `blacklist`, `mint`, `burn`), concentration des top holders sur adresses connues (deployer/factory/locker/graduation), heuristique bundle, balance locker LP, flags metadata.
- `UNKNOWN` échoue ou baisse le score; Grok/LLM ne doit pas override un hard gate.

Ce qu'on emprunte: le concept de gatebook avec raisons explicites par gate, et "score avec reasons" pour l'audit.

### `semkazz1/FlySwarm` — second pass

Licence MIT. Design sketch utile, mais le moteur contient des données seed/demo à ne pas copier.

Fichiers lus:
- `src/engine.mjs`
- `src/robinhood-live.mjs`

Patterns utiles:
- Signal `FIRE` / `WATCH` / `NOISE` sur convergence wallets, score basé sur transfers récents + overlap mémoire de cohorte + liquidité.
- Listener live Pons V2 via RPC public: topic launch factory, décodage metadata token, fallback DexScreener.
- Heuristique wallet fresh/new/warm/established basée sur nonce et logs de transfer.

À reprendre: l'idée de cohort memory et l'adapter read-only au pipeline Memeclaw. Pas de hunter data hardcodée, pas d'autosnipe.

### `0xwast3/PELLET` — second pass

Licence MIT. Le pattern "walls" est le plus propre de ce batch.

Fichiers lus:
- `src/core/walls.mjs`
- `src/services/pellet.mjs`

Patterns précis:
- Murs `SLEEP`, `EDGE`, `SIZE`, `DEPTH`, `PRICE`.
- `UNKNOWN` ne passe jamais: le candidat échoue immédiatement.
- Chaque refus est loggé par mur (`refusedBy`) et produit un enregistrement lisible par wallet.

Pour Memeclaw: reprendre "walls with named refusal" et la dormance sleep/wake comme trigger de wallet, pas le CLI.

### `mnemox-ai/tradememory-protocol` — second pass

Licence MIT. Utile pour l'audit et la mémoire pondérée par résultat.

Fichiers lus:
- `.skills/tradememory/SKILL.md`
- `docs/OWM_FRAMEWORK.md`

Concepts clés:
- Outcome-weighted recall: les trades gagnants dans un même contexte rankent plus haut, avec decay, boosts de retrieval et confidence.
- Cinq couches mémoire: episodic, semantic, procedural, affective, prospective.
- Decision audit trail avec chaîne SHA-256.

À reprendre: audit-chain et outcome-weighted trade memory. À skip: les parties Binance, MT5 et le "evolution engine" jugées overkill pour la cadence meme.

### `chainstacklabs/pumpfun-bonkfun-bot` — second pass

Licence Apache-2.0. Bon pour le design "plusieurs sources d'écoute -> une seule logique de trade".

Fichiers lus:
- `learning-examples/live_listener_matrix.py`
- `src/monitoring/base_listener.py`

Patterns précis:
- Listener matrix: geyser, logs, blocks, pumpportal alimentent le même code de trade avec des event paths différents.
- Buy/sell platform-aware, cleanup manager pour ATA rent, priority fee manager.
- Interface base listener avec token callback et filtres match/creator.

À reprendre: le listener matrix et le principe "même chemin de trade pour plusieurs sources". Ne pas l'exécuter comme bot live non audité.

### `0xjeffro/tx-parser` — second pass

Licence MPL-2.0. Bon pour l'evidence layer Solana, pas pour vendorer du code MPL sans revue.

Contenu observé:
- Normaliseur de transactions Solana en actions lisibles.
- Couvre Jupiter v6, Jupiter DCA, OKX DEX, Pump.fun, Raydium, Photon program wrappers.

Pour Memeclaw: définir une interface interne d'actions normalisées en TS, se servir des shapes du parser comme référence de vocabulaire, éviter de copier des fichiers MPL sans revue juridique.

### `chainstacklabs/fomo-solana-rh-listeners` — second pass

Licence Apache-2.0. C'est la référence architecturelle la plus importante pour comprendre Fomo sur Solana/RH.

Fichiers lus:
- `docs/01-how-it-works.md`
- Arborescence scripts: `00_listen_fomo.py`, `02_listen_robinhood_blocks.py`, `04_listen_solana_blocks.py`, `07_trace_trade.py`, shared transports/feed helpers.

Ce que le doc révèle:
- FOMO utilise des account ops ERC-4337 via EntryPoint v0.8 sur RH.
- Les wallets portent une délégation EIP-7702 vers `Simple7702Account`.
- Solana détient le cash, RH détient les tokens; les buys sont souvent cross-chain, payés sur Solana via Relay et livrés sur RH par solver fills.
- Ne pas se fier aux allowlists bundler, aux nonces ou aux seuls logs swap.
- Les listeners RH doivent s'abonner au contrat d'operations; les listeners Solana doivent suivre les paiements Relay et les fills.

À reprendre: cette carte mentale avant de concevoir le `TradeEvent` RH, sinon le timestamp de résolution sera faux.

## Synthèse du corpus après lecture approfondie

| Verdict | Nouveautés |
|---|---|
| `Take` | Aucun nouveau, la spec GMGN officielle reste la source directe. |
| `Copy` | Aucun copie directe justifiée ici: licences, scope ou dépendances trop lourdes. |
| `Borrow` | `loxley`, `fomo-robinhood-radar`, `stampede`, `aegis`, `FlySwarm`, `PELLET`, `tradememory-protocol`, `pumpfun-bonkfun-bot`, `tx-parser`, `fomo-solana-rh-listeners`. |
| `Reference` | Inchangé pour le reste du Batch 3. |
| `Skip` / `Hard No` | Inchangé pour `OctoBot`, `lumibot`, `Alpaca`, `azimuth`, `hummingbot`, `OpenBB`, etc. |

Les trois plus forts emprunts de ce second pass:
1. `loxley`: moteur d'exits RH avec dev-sell force-close et quote de sortie séparée.
2. `fomo-robinhood-radar`: résolution déterministe profile Fomo -> wallet et scoring trader explicable.
3. `stampede`: attribution de rotation `sell A -> buy B` par somme des Transfer logs sans confiance aux champs buyer/seller RH.

---

## Corpus unique: MCP, data providers, OKX onchain et scanners supplémentaires

Premier pass sur ce lot. Les verdicts reposent sur les métadonnées GitHub et les README, pas encore sur l'audit complet des sources. Les MCP sont traités comme des contrats d'outils ou des sources de données, pas comme des dépendances runtime automatiques.

| Ressource | Licence | Verdict | Ce que j'en tire |
|---|---|---|---|
| `HKUSTDial/DeepEar` | MIT | Reference | Framework "deep research + financial signal tracking". Peut inspirer la couche de synthèse de recherche pour `ct-alpha`, mais trop généraliste pour le coeur GMGN. |
| `oficcejo/alpha-arena-okx` | none | Hard No | Bot CEX OKX automatique basé sur un fork alpha-arena, sans licence exploitable. Hors scope Solana/RH. |
| `paperswithbacktest/pwb-alphaevolve` | none | Skip | Coding agent AlphaEvolve pour stratégies de trading. Pas de licence claire, pas adapté au temps réel on-chain meme. |
| `Miasyster/QuantGPT` | MIT | Skip | Usine de facteurs pour WorldQuant BRAIN. Hors cible actuelle. |
| `LLMQuant/data-mcp` | MIT | Reference | MCP data large (stocks, macro, prediction markets, SEC, crypto). Plusieurs morceaux hors scope; utiles surtout comme modèle de design MCP. |
| `financial-datasets/mcp-server` | MIT | Skip | API stock/crypto historique style FinancialDatasets. Pas le signal on-chain dont on a besoin. |
| `6551Team/opennews-mcp` | MIT | Reference | Agrégateur news + AI ratings + "trading signals". Peut alimenter un scout news/ct-alpha, mais c'est un SaaS avec token et pas une source de vérité on-chain. |
| `guangxiangdebizi/FinanceMCP` | MIT | Skip | MCP Tushare/Binance orienté actions, fonds, obligations, macro. Pas de valeur pour le memecoin on-chain. |
| `aahl/mcp-aktools` | MIT | Reference | MCP données actions/crypto et analyse. Très général, à comparer comme pattern d'interface MCP, pas à intégrer. |
| `massive-com/mcp_massive` | MIT | Skip | MCP marché financier en mode data vendor. Hors scope meme/crypto on-chain. |
| `krakenfx/kraken-cli` | MIT | Hard No | CLI AI-native pour trader crypto/stocks/forex/derivatives via Kraken. CEX multi-actifs, pas notre exécution. |
| `okx/agent-trade-kit` | MIT | Hard No | MCP OKX spot/swap/futures/options/grid. CEX et produits dérivés, hors scope. |
| `atilaahmettaner/tradingview-mcp` | MIT | Skip | TradingView data/TA/screeners. Utile pour du TA CEX, pas pour la courbe Pons/Pump.fun. |
| `monarchjuno/tradingcodex` | Apache-2.0 | Reference | Transforme Codex en équipe d'investissement. Intéressant comme pattern workflow, mais trop généraliste. |
| `tradermonty/claude-trading-skills` | MIT | Skip | Skills pour équity et traders classiques: TA, calendriers économiques, screeners. Pas le coeur on-chain. |
| `RKiding/Awesome-finance-skills` | Apache-2.0 | Reference | Catalogue de skills finance. Bonne source de veille, pas une brique runtime. |
| `okx/onchainos-skills` | none | Borrow | Le plus utile de ce lot: skills on-chain officiels OKX pour token search, wallet PnL, leaderboard, smart money/whale, meme pump/trenches, dev reputation, bundle detection, DEX swap et broadcast. Lire et reprendre le contrat des skills read-only, pas copier le code sans licence. |
| `okx/agent-skills` | MIT | Reference | Skills CEX OKX (market, trade, portfolio, grid, earn, smartmoney). Le smartmoney/sentiment peut être comparé, mais l'exécution est hors scope. |
| `stefanoviana/crypto-pump-scanner` | MIT | Skip | Pump detector Bybit perps avec auto-trade. Le cycle TP cascade est intéressant, mais l'algo CEX perpetual ne s'applique pas à notre tape RH/Pons. |
| `mcp.bitquery.io` | external | Reference | MCP Bitquery officiel pour requêtes blockchain. Bonne source d'évidence on-chain (transfers, holders, flows) à évaluer quand on veut compléter GMGN sans écrire des parsers internes. |
| `dexrabbit.bitquery.io` | external | Reference | MCP DexRabbit orienté DEX data. À considérer comme provider read-only pour flux/volume/holdings, pas comme moteur. |
| `coingecko.com/categories/meme-token` | external | Reference | Classement catégorie meme/tendances. Utile comme sanity check externe faible, pas comme signal principal. |
| `coinmarketcap.com/view/memes` | external | Reference | Classement meme coins CMC. Même logique: référence de veille, pas de décision. |
| `geckoterminal.com` | external | Reference | DEX pairs/trending/liquidity. Optionnel pour cross-check pairs Solana/BSC/Base. |
| `kukapay/jupiter-mcp` | MIT | Borrow | Wrapper Jupiter Ultra API pour swaps Solana. Reprendre le contrat d'outils et le flux quote -> sign -> broadcast, pas forcément lancer un MCP externe avec la clé privée. |
| `kukapay/pumpfun-wallets-mcp` | MIT | Reference | Wrapper Dune pour top wallets rentables Pump.fun/PumpSwap. Read-only, utile pour comparer les données de leaderboards GMGN/OKX. |
| `tony-42069/solana-mcp` | none | Reference | "Memecoin Observatory" Solana: radar, social, whales, rugpull, culture. Pas de licence, idées utiles mais pas de code à copier. |
| `kukapay/rug-check-mcp` | MIT | Reference | Wrapper Solsniffer pour analyse risque Solana. Bon pour le format de sortie "score + risques", mais autant appeler Solsniffer directement. |
| `kukapay/honeypot-detector-mcp` | MIT | Reference | Wrapper honeypot.is pour Ethereum/BSC/Base. Utile plus tard pour BSC/Base, pas maintenant. |
| `kukapay/whale-tracker-mcp` | MIT | Skip | Whale Alert wrapper. Observes gros transferts cross-chain, pas assez précis pour les wallets memecoin RH/Solana. |
| `kukapay/crypto-sentiment-mcp` | MIT | Reference | Wrapper Santiment pour sentiment/social volume. Peut alimenter `ct-alpha` si on utilise un provider SaaS clé en main. |
| `kukapay/crypto-indicators-mcp` | MIT | Skip | Indicateurs TA sur Binance/ccxt. Hors tape on-chain et hors cadence meme. |
| `kukapay/dexscreener-trending-mcp` | MIT | Reference | Wrapper trending DexScreener pour BSC/Solana. Utile en option de veille, pas comme source principale de trades. |
| `birdeye.so` | external | Reference | API/explorer DEX multi-chain. Provider data read-only pour price, liquidity, holders et flows, si on veut un second fournisseur hors GMGN. |

## Synthèse rapide du corpus MCP et data providers

- Le plus fort emprunt est `okx/onchainos-skills`: lire le contrat de ses skills read-only pour token discovery, wallet PnL, smart money/whale, meme pump/trenches, dev reputation et bundle detection.
- Les MCP `kukapay` sont surtout des wrappers d'API tierces. On ne les installe pas tels quels; on copie leurs schémas d'outils si besoin, en appelant les providers directement.
- Les CEX/dérivés sont tous écartés: `kraken-cli`, `okx/agent-trade-kit`, `alpha-arena-okx`, `crypto-pump-scanner`.
- Les sites de classement (`Coingecko`, `CMC`, `GeckoTerminal`, `Birdeye`) restent des sources de veille et de cross-check, jamais une décision de trade.

Candidats pour un second pass plus profond dans ce lot:
1. `okx/onchainos-skills`
2. `kukapay/jupiter-mcp`
3. `kukapay/pumpfun-wallets-mcp`
4. `kukapay/rug-check-mcp`
5. `kukapay/dexscreener-trending-mcp`
6. `tony-42069/solana-mcp`
7. `mcp.bitquery.io`
8. `birdeye.so`

---

## Corpus unique: providers, RPC, indexeurs et APIs de données on-chain

Cette couche n'est pas composée de repos à copier mais de services. Les verdicts indiquent ce qu'on intégrerait directement (`Take`), ce qu'on utiliserait comme source secondaire ou croisée (`Borrow`), ce qu'on garde comme référence sans dépendance (`Reference`) et ce qui est écarté (`Skip`).

| Source | Type | Verdict | Ce que j'en tire |
|---|---|---|---|
| Bitquery | GraphQL + WebSocket + Kafka + gRPC | Borrow | Couche evidence multichain pour Sol, ETH, BSC, Base, Tron, Polygon, Arbitrum, Optimism. Très utile pour transfers, holders, flows et wallets, mais ne pas en faire le moteur temps réel à cause du coût et de la complexité. |
| Bitquery IDE | GraphQL query editor | Reference | Outil pour construire et tester les requêtes avant d'en faire un aid adaptateur interne. |
| Helius | RPC, Webhooks, Enhanced APIs, Geyser | Take | Source principale pratique pour le RPC Solana, les webhooks d'événements, la lecture Metaplex/token et le monitoring temps réel. S'intègre mieux que du polling brut. |
| Triton One | RPC + gRPC + Geyser (premium) | Reference | Offre premium en backup ou si on a besoin de plus de perf Geyser/gRPC que Helius. |
| Shyft | RPC + APIs | Reference | Fallback RPC/API Solana, à garder en second plan. |
| Jupiter API | DEX aggregator API | Take | C'est le cœur de l'exécution/quote Solana: flux get-quote -> sign -> broadcast, routeur agrégé, protection slippage/priority fee. Adopter comme brique d'exécution. |
| QuickNode | RPC + Streams | Reference | RPC multichain et streams utiles comme fallback/backup, pas comme spécialiste meme. |
| Alchemy | RPC + APIs | Reference | RPC multichain standard; pertinent surtout si plus tard on touche Base/ETH/BSC, pas pour le coeur RH/Solana. |
| Chainstack | RPC + indexing | Borrow | Utile comme hébergeur d'infra RPC/Geyser/WebSocket. Déjà pertinent parce que le repo `fomo-solana-rh-listeners` l'utilise pour observer FOMO sur Solana/RH. |
| Goldsky | Real-time indexing + subgraphs | Skip | Indexage temps réel/subgraphs. Trop lourd pour la cadence meme; utile seulement si on veut une base analytics séparée. |
| The Graph | Decentralised indexing | Reference | Indexation décentralisée. Pas adapté au temps réel de tape/meme court terme. |
| Solana Tracker API | Memecoin data API | Borrow | API spécialisée memecoin Solana: tokens, pools, top holders, wallet trades et créatrices de tendances. Bonne source croisée avec GMGN. |
| MadeOnSol API | KOL trades + signals API | Borrow | KOL trades/signals API pour Solana. À utiliser pour `ct-alpha` et validation smart money, avec caution sur la qualité et le delay. |
| Birdeye API | Pricing + trade API | Borrow | Second provider pour price, liquidity, holders, traders et tendances Solana/multi. Peut compléter GMGN sans dépendre d'un seul vendor. |
| Defined.fi API | Real-time pair data API | Reference | Données pairs/volumes multichain en temps réel. Bon pour cross-check, pas pour la décision finale. |
| DexScreener API | Free public API | Borrow | API pair DEX gratuite: trending, pair infos, volume, liquidity. Déjà utile pour veille et fallback de prix. |
| GeckoTerminal API | Free CoinGecko DEX API | Reference | Même rôle que DexScreener en fallback: pairs, volume, price mover. |
| Solana Web3.js | SDK | Take | SDK de base pour construire/parser les transactions Solana, gérer les tokens, signer et broadcast. L'utiliser comme couche native plutôt que wrapper maison. |
| Anchor Framework | Solana smart-contract framework | Skip | Framework pour écrire des programmes Solana. Hors scope tant qu'on ne développe pas notre propre contrat on-chain. |

## Synthèse du corpus: providers, RPC et indexeurs

- Côté Solana, la colonne vertébrale recommandée devient: RPC/Geyser/Webhooks via Helius, exécution/quote via Jupiter API, base SDK via Solana Web3.js.
- Côté data, GMGN reste la source principale; Bitquery, Birdeye, Solana Tracker et DexScreener servent de cross-check read-only.
- Pour FOMO/RH, les providers Solana ne suffisent pas: il faut garder le pattern Chainstack/opérations ERC-4337 découvert dans le Batch 3.
- Skip les indexeurs lourds et subgraphs pour le temps réel; ils peuvent devenir utiles dans une couche analytics hors production.

---

## Corpus unique: data store et inventaire RPC

### Data store recommandé

Pour Memeclaw, la réponse courte est: **Postgres en source de vérité, Redis pour l'état chaud et les queues, SQLite seulement pour les outils locaux/dev/paper**.

- **Postgres**: stocke durablement `tokens`, `wallets`, `events`, `scouts`, `decisions`, `positions`, `pnl`, `audit`. Les payloads d'API flexibles peuvent rester en `jsonb`. Plus tard, `pgvector` est utile pour la mémoire sémantique des traders/contextes et `TimescaleDB` si on veut des tables tick/analytics.
- **Redis**: état transitoire et haute fréquence: cache prix, fenêtres de tape fomo/RH, anti-spam, rate limits, queues d'événements, locks d'exécution, heartbeat. C'est ici que vit le temps réel, pas dans Postgres.
- **SQLite**: pour la CLI, le paper trading local, le dev, les rapports one-shot. Pas en production multi-process multi-tenant.

À éviter pour le coeur: Mongo/NoSQL document pur comme source de vérité unique. Ce n'est pas adapté aux relations positions/decisions/audit et à la consistance transactionnelle.

### `AgriciDaniel/claude-obsidian`

Licence MIT. "Self-organizing AI second brain for Obsidian + Claude Code", basé sur le pattern Karpathy LLM Wiki. Verdict: `Reference`.

Utile comme inspiration pour organiser une mémoire de recherche humaine (rapports, sources, liens), pas comme brique runtime du bot. Les idées de source-cited claims et de knowledge loop peuvent éclairer la future mémoire agent, mais TradeMemory/Memanto restent plus proches du trading.

### Providers RPC

Les fournisseurs déjà vus dans le Batch 5 restent prioritaires: Helius, Jupiter API, Solana Web3.js. Ce tableau complète l'inventaire avec les RPC génériques et les fallbacks.

| Provider | Verdict | Usage cible |
|---|---|---|
| Alchemy | Reference | RPC multichain/backup, utile surtout plus tard pour Base/ETH/BSC. |
| QuickNode | Reference | RPC multichain fallback; bonne latence mais pas un choix spécialisé meme. |
| Helius | Take | RPC Solana principal: DAS, webhooks, Geyser/streams. |
| Chainstack | Borrow | Infra RPC/elastic et pattern listeners FOMO RH/Solana. |
| Triton One | Reference | RPC Solana premium + Geyser en backup. |
| Shyft | Reference | RPC/API Solana fallback. |
| GetBlock | Reference | RPC multichain backup, utile si on veut un provider neutre multi-chain. |
| Ankr | Reference | RPC multichain premium fallback. |
| dRPC | Reference | Marketplace RPC décentralisé; bon candidat pour failover automatique plus tard. |
| OnFinality | Reference | RPC/indexing multichain; pas critique pour le coeur meme. |
| Dwellir | Reference | RPC premium basé en EU; backup si besoin de compliance/zone. |
| Infura | Reference | RPC EVM historique; pertinent quand on ajoutera Base/BSC/ETH. |
| HypeRPC | Hard No | RPC Hyperliquid. Hyperliquid/perps est hors scope. |
| PublicNode | Reference | RPC public gratuit, rate-limited; fallback gratuit. |
| NodeReal | Reference | RPC BSC/opBNB/EVM; utile quand BSC passera en scope. |
| BlastAPI | Reference | RPC multichain backup. |
| Tenderly Web3 Gateway | Borrow | RPC + simulation. La simulation de transactions est une vraie valeur pour pré-check d'exécution, à garder comme option de safety. |
| Lava Network | Reference | RPC décentralisé EVM + Solana; future couche de redondance. |
| Glif | Skip | Filecoin only, hors scope. |
| Solana Foundation Public RPC | Reference | RPC public Solana gratuit, rate-limited; fallback de dernier recours. |

Recommandation d'architecture: encapsuler tous les providers derrière une interface `RpcProvider` / `QuoteProvider` / `EventProvider`, avec fallback et healthcheck. Le bot ne doit jamais dépendre d'un seul endpoint JSON-RPC en production; le temps réel reste sur Helius/Chainstack et les appels ponctuels peuvent rouler vers un fallback gratuit.

---

## Corpus unique: sweep MCP ecosystem

Gros sweep de MCP crypto. Premier pass à partir des descriptions, pas un audit complet de chaque serveur. Les MCP sont traités comme des contrats d'outils: on peut reprendre les schémas, comparer les capacités et appeler les APIs directement; on ne doit pas installer une pile MCP entière sans audit sécurité.

### Verdict par catégorie

| Catégorie | Représentants | Verdict global | Pour Memeclaw |
|---|---|---|---|
| Universal / Multi-chain | Bitquery MCP, Hive Intelligence, Web3 MCP, Universal Crypto MCP, GOAT, WAIaaS | Borrow / Reference | Bitquery reste la référence read-only multi-chain. WAIaaS et Universal Crypto MCP sont intéressants comme wallet daemon/policy engine, mais à auditer avant tout. |
| RPC / Infrastructure | Alchemy MCP, Chainstack MCP, QuickNode MCP, Tatum MCP, Nodit MCP, Moralis MCP, thirdweb AI, Blockscout MCP | Reference | Helius/Chainstack restent le coeur Solana/RH. Les autres sont des fallbacks ou des références pour Base/BSC plus tard. |
| Data / Indexing | Bitquery, Dune MCP, The Graph MCP, Token API MCP, Spice, Dappier | Borrow / Reference | Bitquery pour evidence; Dune pour analytics lourde; pas de dépendance temps réel aux indexeurs. |
| EVM | EVM MCP Server, Etherscan, Ethereum MCP, Web3 MCP, Web3 Assistant, ENS, Contract Scraper, Find Block | Reference / Skip | Utile plus tard pour Base/BSC/ETH. Rien à adopter maintenant. |
| Solana | Solana Agent Kit, Aldrin Labs, Solana Dev MCP, Jupiter MCP, PumpFun Wallets, Memecoin Radar, Solana Launchpads, PumpSwap, Raydium LaunchLab, Hubble, AMOCA, SolMCP | Borrow / Reference | C'est le cluster le plus important: radar launches, wallets, execution wrappers, analytics. |
| Bitcoin / Lightning | Bitcoin MCP, UTXO, Lightning, Zebedee | Skip | Hors scope meme trading. |
| Base / BNB / TON / Sui / Tron | Base MCP, Base USDC Transfer, PancakeSwap PoolSpy, BSC Multisend, Sui Trader, Ergo, Uniswap Monad, Chainlist | Skip / Reference | Base/BSC plus tard. PancakeSwap PoolSpy reste orienté LP/Yield: on n'intègre pas. |
| DEX / On-chain trading | Bitquery, Uniswap Trader/Pools/PoolSpy/Price, Jupiter MCP, Aster Info, DexScreener, DexPaprika, Binance Alpha, DEX Metrics/Pools | Borrow / Skip | Jupiter et DexScreener/DexPaprika utiles. Hyperliquid, funding, orderbook et liquidations sont hors scope. |
| CEX | Binance MCP, Bybit MCP, Coinbase/Base, announcements | Hard No | CEX, margin, futures et derivés hors scope. |
| DeFi / Lending / Yield | DefiLlama, DeFi Yields, Aave, Euler, Lista, Arcadia, Philidor, Uma Rocks | Hard No | LP, Yield, lending et prediction markets retirés du projet. |
| Price Feeds / Oracle | Chainlink Feeds, Pyth MCP (Python/TS/Pro) | Borrow | Pyth est utile pour price, OHLCV, TWAP, EMA sur Solana. |
| Market data | CoinGecko MCP, CoinMarketCap MCP, CoinCap, CoinStats, Crypto Indicators, Trending, Fear & Greed, Sentiment, ETF Flow, Crypto Stocks/Funds/Projects | Reference / Skip | Sentiment/trending pour `ct-alpha`; ETF, stocks, funds et equities skip. |
| Whale / On-chain activity | Whale Tracker, Hyperliquid Whale Alert, Wallet Inspector, Tornado Cash, PumpFun Wallets | Reference / Skip | PumpFun Wallets et Wallet Inspector pour smart money. Tornado Cash skip. |
| Wallet / Portfolio | Octav API, Armor Wallet, WAIaaS, Wallet Inspector | Borrow / Reference | WAIaaS/Armor à auditer comme wallet daemon. Octav pour portfolio tracking en référence. |
| Security / Risk | Honeypot Detector, Rug Check, Token Revoke, Solana Wallet Security Scanner, Philidor, Heurist, Web3 Assistant | Borrow | Rug Check et Honeypot pour les gates de sécurité. Token Revoke en ops. Pas de vault risk. |
| Cross-chain / Bridge | deBridge, Stargate, Bridge Rates/Metrics, Wormhole | Hard No / Skip | Cross-chain et bridges hors scope actuel. |
| NFT | OpenSea, Magic Eden, NFT Analytics | Hard No | NFT retiré du scope. |
| News / Sentiment / Information | CryptoPanic, Cointelegraph, BlockBeats, Crypto News, RSS, Whitepapers, Twitter Username Changes, Dappier | Reference | Pour `ct-alpha` et le scout news, pas pour la décision directe. |
| Payments | Lightning, Zebedee, Base USDC, x402 | Skip | Hors scope trading meme. |
| Memecoin / Launchpads | Memecoin Radar, Memecoin Observatory, Solana Launchpads, Raydium LaunchLab, PumpSwap, Meme Deployer, PumpFun Wallets | Borrow | Noyau de la prochaine couche: launches, wallets, launchpads et swap PumpSwap. |
| Prediction Markets | Bitquery Polymarket, Polymarket Predictions, Uma Rocks | Hard No | Polymarket retiré du scope. |
| DAO / Governance | DAO Proposals, daoCLI | Skip | Hors scope. |
| Dev tools | Token Minter, Contract Scraper, Find Block, Chainlist, mcp-clickhouse | Reference / Skip | Utilitaires ponctuels, pas core. |

### MCP prioritaires à étudier en détail

| MCP | Licence | Verdict | Pourquoi |
|---|---|---|---|
| Bitquery MCP | SaaS / remote | Borrow | Evidence multi-chain: trades, OHLC, market cap, wallet PnL. Parfait pour cross-check GMGN. |
| Solana Agent Kit MCP | Apache-2.0 | Borrow | 40+ actions Solana; bon point de départ pour normaliser les actions sign/build/broadcast. |
| Solana Dev MCP | MIT | Reference | Demo MCP officiel Solana Foundation; utile pour comparer les shapes d'outils. |
| Memecoin Radar MCP | MIT | Borrow | Radar temps réel Pump.fun/Solana + KOL trades. Directement aligné avec le scope. |
| Solana Launchpads MCP | MIT | Borrow | Activité quotidienne et metrics de graduation des launchpads Solana. |
| PumpFun Wallets MCP | MIT | Reference | Wallets rentables Pump.fun/PumpSwap via Dune. |
| PumpSwap MCP | MIT | Borrow | Swaps PumpSwap; pertinent pour l'exécution Solana, mais à auditer avant utilisation. |
| Raydium LaunchLab MCP | MIT | Reference | Launch/buy/sell sur LaunchLab; utile plus tard comme venue Solana. |
| Rug Check MCP | MIT | Reference | Wrapper Solsniffer; autant appeler Solsniffer directement. |
| Honeypot Detector MCP | MIT | Reference | Utile plus tard pour BSC/Base. |
| Pyth MCP | MIT | Borrow | Price feeds, OHLCV, TWAP, EMA pour le contexte de prix. |
| DexScreener MCP | Unlicense | Borrow | Real-time DEX pair data; fallback gratuit de pair/volume. |
| DexPaprika MCP | MIT | Reference | 5M+ tokens / 20+ chains; utile comme data source secondaire. Voir aussi la section `blockatlas/CoinCap/CoinPaprika/DexPaprika/Shrimpy` où la REST API devient `Borrow / Study` (SSE, pas de clé). |
| Universal Crypto MCP | NOASSERTION | Reference | Ambitieux, mais licence incertaine et couverture large. À auditer si on veut une couche wallet générique. |
| WAIaaS | MIT | Borrow | Wallet daemon avec policy engine; séduisant pour isoler l'exécution, mais audit sécurité obligatoire. |
| Base MCP | unknown | Reference | Plus tard pour Base. |

### Ce qu'on écarte définitivement dans ce sweep

- Toute la couche DeFi/Yield/LP: DefiLlama, DeFi Yields, Aave, Euler, Lista, Arcadia, Philidor vault risk.
- NFT: OpenSea, Magic Eden, NFT Analytics.
- Prediction markets: Polymarket Predictions, Uma Rocks.
- Perps/Hyperliquid: Hyperliquid Info, Alpha Arena, Funding Rates, Hyperliquid Whale Alert.
- CEX/derivés: Binance MCP, Bybit MCP, annonces d'exchanges.
- Bridges/cross-chain: deBridge, Stargate, Wormhole.

---

## Corpus unique: capacité agent, intelligence monde, recherche sociale

Dernier lot demandé avant la seconde passe globale. Les trois repos sont plus transversaux que les précédents: ils aident à structurer l'agent, à résoudre les sources web/sociales de façon résiliente et à produire des briefs cités. Aucun n'est une brique de trading en soi.

| Ressource | Licence | Verdict | Ce que j'en tire |
|---|---|---|---|
| `Panniantong/Agent-Reach` | MIT | Study | Couche de capacités pour agents: sélection automatique d'un backend par canal (web, X, Reddit, YouTube, RSS, GitHub), détection réelle du backend disponible et commande `doctor`. L'idée de routage ordonné `channel.py` avec fallback est utile pour construire le `ct-alpha` et les sources sociales, mais Memeclaw doit rester sur des APIs stables et ne pas dépendre de cookies/browser sessions pour sa source de vérité. À étudier pour la couche de veille, pas pour l'exécution. |
| `marc-shade/world-intel-mcp` | MIT | Study | Serveur MCP d'intelligence monde: Fetcher asynchrone, circuit breaker par source, cache SQLite TTL avec stale-data fallback, vector store Qdrant, collector daemon, webhooks silencieux sauf changement. Le pattern infra est très bon. Le contenu est hors scope (géopolitique, militaire, climat, Polymarket). À étudier comme blueprint d'infrastructure de collecte pour `ct-alpha`/news/veille, pas pour importer ses domains. |
| `mvanhorn/last30days-skill` | MIT | Borrow | Moteur de recherche dirigé par agent sur Reddit, X, YouTube, GitHub, HN, RSS, web: résolution de handles/sources avant requêtes, score par engagement réel, clustering cross-source, briefs cités, découverte sans sujet, mémoire SQLite/watchlist. Très bon modèle pour enrichir `ct-alpha`. À borner: pas de Polymarket, pas de scraping cookie-risky comme colonne de production, pas de généralisation monde entier. |

### Ce que le Batch 8 ajoute concrètement à l'architecture cible

1. **Couche `ct-alpha` robuste**: reprendre le pipeline de résolution de `last30days` (entity -> handles/subreddits/hashtags -> requêtes parallèles -> clustering -> brief cité), en le limitant à X, RSS crypto, GitHub et blogs. Le scoring "engagement réel" est plus fiable que des métadonnées SEO.
2. **Infra de collecte résiliente**: reprendre les primitives de `world-intel-mcp` (Fetcher avec retry/rate-limit, circuit breaker par source, SQLite cache avec stale fallback, collector daemon, webhook silencieux sauf changement) pour les sources sociales/news. Ces patterns peuvent être portés en TypeScript dans `memeclaw`.
3. **Sélection de backends**: `Agent-Reach` est une référence pour la façon de tester un backend avant de l'utiliser et de basculer quand il casse. À garder en `Study` car l'installation multi-CLI/cookies est lourde pour un bot de trading; mais la logique `doctor`/détection peut inspirer un petit healthcheck de providers GMGN, Helius, Bitquery, DexScreener.

### Décisions de scope

- Garder hors scope tout ce qui est Polymarket, prédictions, actualité géopolitique/militaire, climate/disaster ou web scraping par cookies.
- `ct-alpha` peut utiliser Reddit/X/RSS/GitHub publics seulement si les endpoints sont stables et légaux; tout backend cookié doit être marqué `Reference` et non `Take`.
- Ne pas transformer Memeclaw en agrégateur généraliste: le Batch 8 nourrit la couche de recherche et la mémoire, pas le moteur de décision.

### Candidats Study retenus après ce lot

| Candidat | Pourquoi Study |
|---|---|
| `Panniantong/Agent-Reach` | Routage de backends et détection de santé, mais trop large et dépendant de CLI/cookies. |
| `marc-shade/world-intel-mcp` | Excellent blueprint Fetcher/circuit-breaker/cache/vector store; contenu hors scope. |
| `mvanhorn/last30days-skill` | Pipeline recherche sociale et brief cité; à adapter sévèrement à la cadence meme. |
| `okx/onchainos-skills` | Contrats de skills read-only on-chain/OKX à lire avant d'en reprendre les schémas. |
| `nirholas/universal-crypto-mcp` | Couverture large wallet/swaps, mais licence NOASSERTION et surface de risque large. |
| `minhoyoo-iotrust/WAIaaS` | Wallet daemon + policy engine; audit sécurité requis avant tout. |
| `tony-42069/solana-mcp` | Radar/culture/social/whales Solana; pas de licence, à étudier sans copie. |
| `kukapay/pumpswap-mcp` | Exécution PumpSwap; à auditer avant utilisation, pas d'intégration directe. |
| `sendaifun/solana-agent-kit` | 40+ actions Solana; bon candidat pour normaliser build/sign/broadcast après audit. |
| `kukapay/memecoin-radar-mcp` | Radar Pump.fun + KOL; à comparer aux feeds GMGN avant de brancher une seconde source. |

---

## Corpus unique: OpenPump, Robinhood Chain MCP, hackathons ETHGlobal et PDFs

Lot hétérogène intégré au corpus unique: MCP Solana pump.fun, MCP Robinhood Chain, projets ETHGlobal, repos hackathon/memecoin et papiers/PDF. Le filtre reste: memecoin trading Solana + Robinhood/Fomo, puis BSC/Base; LP/NFT/Polymarket/perps restent hors scope.

| Ressource | Licence | Verdict | Ce que j'en tire |
|---|---|---|---|
| `mcpmarket.com/server/openpump` + `openpumpio/openpump` | MIT | Borrow / Study | MCP-native Solana trading infra: SDK TypeScript, MCP server, ElizaOS plugin et plugin Solana Agent Kit pour pump.fun. Outils create/buy/sell, wallet management, portfolio. API key `op_sk_live_`. Bon candidat pour étudier la surface d'exécution pump.fun derrière une interface `ExecutionProvider`, mais pas comme dépendance unique et externalisée. |
| `openpumpio/openclaw-agent` | MIT | Borrow | Template OpenClaw avec garde-fous très proches de Memeclaw: max par position, exposition totale, réserve SOL, max positions ouvertes, stop-loss -50%, take-profit +200%, trailing -30%, time decay 4h, circuit breaker après 3 pertes, limites session/jour. Reprendre ce schéma de RiskParams comme contrat de sécurité. |
| `nirholas/robinhood-chain-mcp` | NOASSERTION | Reference / Study | Serveurs MCP Robinhood Chain: data server read-only zéro-config + trading server opt-in avec spend caps, confirm gate et kill-switch. Outils trending, launches, quotes, portfolio, swap. Licence restrictive: pas de copie de code, mais le modèle de garde d'exécution RH est une référence directe. |
| `arxiv.org/html/2501.00826v3` + `2501.00826v3.pdf` | n/a | Study | Paper multi-agent LLM pour gestion de portefeuille crypto: Crypto Agent, News Agent, Trading Agent, ReAct, mémoire roulante, configurations CoT/RAG/skills, architectures hiérarchique/débat. Résultats: hiérarchie supérieure, RAG réduit la volatilité, mémoire continue utile. À traduire en Memeclaw par un pipeline analyste/veto/exécution, pas par un swarm large. |
| `2601.08641.pdf` + `lyc0603/copytrading` | MIT | Borrow | Paper WWW'26 sur la résistance aux bots manipulateurs en copy trading meme. Apporte des algorithmes concrets: détection de bundle bot (achats non-créateur dans le block de lancement), sniper bot (achats non-créateur dans les K premiers blocks), bump bot (ratio flips / changement net >= 50), obfuscation du créateur via funding graph. Idéal pour le gatebook et la sélection de wallets. |
| `2609.10246.pdf` | n/a | Study / Reference | "Meme Coin Factories" sur pump.fun: 15M coins sur 2 ans, 17% de transactions wash, 58.6% des groupes top-1% dominent la création, MMaaS. C'est un modèle de menace utile pour calibrer les détecteurs du gatebook. Pas de code à copier, mais des heuristiques à réimplémenter en TypeScript. |
| `2609.05663.pdf` | n/a | Reference | Six mois de production sur deux flottes d'agents LLM: l'operating layer (sliders, ordres, mécanique de chemin d'ordre) détermine le comportement plus que le texte de stratégie; les flottes n'ont pas d'edge et perdent. Preuve empirique qu'il faut des gates déterministes et un risk engine indépendant du LLM. |
| `ennriqe/crypto-agent-memecoin-prototype` | aucune | Reference | Hackathon ETHGlobal Bangkok: modélisation crypto + workflow CDP AgentKit. Prototype léger, pas production. Utile seulement pour la liste de features d'un prototype. |
| EthGlobal Meme Sentinels (`ethglobal.com/showcase/meme-sentinels-12xqg`; `PritamP20/HackMoney`, lien GitHub mort) | inconnue | Reference / Study | Six agents: Scout, Yield, Risk, Alert, Settlement, Orchestrator; Envio Hypersync, social X/Reddit, wallet analysis, exécution Uniswap V2. Reprendre la séparation Scout/Risk/Alert et le scoring on-chain + social; écarter Yield, Settlement/Hedera et le périmètre ERC-20/Uniswap pour l'instant. |
| EthGlobal AgentStrategy (`hurley87/cookie`) | aucune | Reference / Skip | Analyste, trader et influenceur sur tokens AI agents Base via Cookie API, OpenAI, Supabase, Coinbase CDP. Architecture analyst/trader séparée intéressante, mais boucle sociale auto-renforçante hors scope et pas de licence. |
| EthGlobal DegenAgent (`vibenedict/degenAgent`) | MIT | Skip / Reference | Repo hackathon générique: RSI/MACD/moyennes mobiles, sentiment X/Reddit, exécution automatique sur Base. Très mince, pas de garde-fous. Référence seulement pour les noms de features. |
| `zetryn-ai/ai-agent` | MIT | Borrow | Framework Solana memecoin sérieux: 8 agents de référence, routeur LLM, guardrails de règles, `hybrid_audit`, `Trace`/`DecisionLog`/`Backtest`. Bon candidat pour structurer le moteur de décision de Memeclaw. |
| `thegreatola/memecoins-trading-agent` | MIT | Borrow | Agent Solana qui suit des smart wallets via Helius WebSocket, calcule un signal de convergence, score les tokens, exécute via Jupiter, sort par étapes et logge les résultats. Très proche de la boucle copy-trade cible. |
| `Benita2001/SpecterAI` | aucune | Reference | Birdeye holder profiles, smart wallet DB, zombie token detection, paper trades, raisonnement Claude, dashboard temps réel. Concepts utiles; pas de licence donc pas de copie de code. |
| `alexskin/memeoy` | aucune | Reference | Bot Solana paper-first: surveillance Raydium/PumpSwap pools, filtres safety, momentum/revival, AI degen score, decision log, self-tuning. Architecture paper-first intéressante; pas de licence donc pas de copie directe. |
| `MayurK-cmd/4Meme-Pilot` | aucune | Reference | Bot BSC pour 4.meme: Gemini, sentiment Elfa, rug checks, TradeLogger. À relire quand BSC sera au scope; pas de licence. |
| `tow3web3/agentinu` | aucune | Reference | Agent Solana autonome pump.fun/Raydium avec Claude conviction, Jupiter, profit sharing. La distribution aux holders n'est pas au scope de Memeclaw; architecture simple à comparer. |
| `Denzz102/memecoin-agent` | aucune | Reference | Screener Solana Node/MySQL: Helius, DexScreener, RugCheck, alertes Telegram. Repo simple pour le schéma screener -> alerte -> DB. |
| `manavaga/web3-signals-mcp` | MIT | Reference | MCP de fusion de signaux multi-agents: IC weighting, FDR correction, Platt calibration, x402. Inclut BTC/derivés; à emprunter seulement la logique de fusion pour `ct-alpha`. |
| `autonsol/sol-mcp` | MIT | Borrow / Study | MCP Solana pour risk scoring, momentum, wallet analysis, market regime et graduation signals. Bon complément à GMGN et au gatebook. |
| `kabbersokhi-boop/crypto-trend-hunter` | aucune | Reference | Sentiment Reddit + corrélation prix via n8n et OpenAI. Nourrit `ct-alpha`, pas de licence donc pas de copie. |
| `dynamolabs/solana-mcp` | MIT | Borrow / Study | MCP Solana pour wallets, tokens, trending, risk, bundled launch, creator, whale et quote swap. Bon candidat provider read-only avec licence MIT. |

### Ce que le Batch 9 ajoute concrètement

1. **RiskParams directement réutilisables**: le template `openclaw-agent` donne un contrat de garde-fous minimal (max exposure, stop-loss, circuit breaker, limites session/jour) très proche de ce que Memeclaw doit implémenter avant tout trading live.
2. **RH Chain MCP comme blueprint de garde d'exécution**: spend caps, confirm gate, kill-switch, data server read-only séparé du trading server. Même pattern doit structurer l'intégration RH/Fomo future.
3. **Détection de manipulation copy-trading**: les algorithmes du paper `copytrading` (bundle, sniper, bump, funding graph) sont directement traduisibles en TypeScript pour le gatebook et la sélection de smart wallets.
4. **Méfiance empirique vis-à-vis des agents LLM**: le paper DX `2609.05663` montre que les agents LLM en production perdent de l'argent et que l'operating layer compte plus que la stratégie. Cela confirme l'architecture "LLM propose, gates disposent".
5. **MCP Solana read-only**: `autonsol/sol-mcp` et `dynamolabs/solana-mcp` sont de bons candidats pour normaliser risk/wallet/trending/whale devant les providers actuels, mais à comparer avec GMGN/Helius avant de brancher en production.

### Candidats Study ajoutés après Batch 9

| Candidat | Pourquoi Study |
|---|---|
| `openpumpio/openpump` | MCP/SDK pump.fun prometteur mais dépend d'une API externe; auditer la surface d'exécution avant toute intégration. |
| `openpumpio/openclaw-agent` | RiskParams très bons; à étudier comme contrat de sécurité avant de recoder le module Risk. |
| `nirholas/robinhood-chain-mcp` | Blueprint RH data + trading guard; licence restrictive, étude seulement. |
| `zetryn-ai/ai-agent` | Décision framework memecoin avec trace/backtest; à lire avant de figer l'architecture agent. |
| `autonsol/sol-mcp` | Risk/momentum/regime Solana; à comparer avec les sources actuelles. |
| `dynamolabs/solana-mcp` | Couverture wallet/token/whale/swap quote; à comparer avec GMGN et Helius. |
| `2609.10246.pdf` | Threat model pump.fun à transformer en règles de gatebook. |
| `2601.08641.pdf` | Algorithmes anti-manipulation copy-trade à porter en TypeScript. |
| `2501.00826v3.pdf` | Architecture MAS hiérarchique à adapter au cycle meme court. |

---

## Audit consolidé du corpus unique - gaps, priorités, architecture

### But du second pass

Replier toutes les sources dans un seul corpus, garder uniquement ce qui sert au memecoin trading sur Solana + Robinhood/Fomo, puis BSC/Base, et produire une architecture cible. Cette section est le mini-README d'implémentation du rapport.

### Top picks consolidés

| Rang | Source | Valeur principale pour Memeclaw |
|---:|---|---|
| 1 | `docs.gmgn.ai/index/gmgn-agent-api` + adapter actuel | Source de vérité GMGN déjà intégrée dans `memeclaw`. |
| 2 | `docs.gmgn.ai/index/gmgn-callout-openapi` | Webhook/callout au lieu du polling seul. |
| 3 | `shmidtqq65/loxley` | Exits RH, dev-sell force-close, quote de sortie, gates de lancement. |
| 4 | `cvxv666/fomo-robinhood-radar` | Résolution profile Fomo -> wallet, provenance des fills, scoring trader. |
| 5 | `itsnex1s/fomopulse-robinhood-chain-tape` | Tape live RH read-only à faible latence. |
| 6 | `Argona7/stampede` | Rotation wallets sell A -> buy B et signal de convergence. |
| 7 | `kocer6/MEERKAT` | Evidence-first wallet/token intelligence Pons V2. |
| 8 | `semkazz1/FlySwarm` | Cohortes wallet, funding graph, convergence et memory. |
| 9 | `andreysuperiorgit/aegis` | Gatebook déterministe anti-scam, fail-closed. |
| 10 | `gustaffsonKotte/qlo` | Filtre graduation lente Pump.fun. |
| 11 | `okx/onchainos-skills` | Schémas read-only de token search, wallet PnL, smart money, meme trenches. |
| 12 | `mnemox-ai/tradememory-protocol` | Audit trail, outcome-weighted recall, mémoire des décisions. |
| 13 | `mvanhorn/last30days-skill` | Recherche sociale récente, scoring par engagement, briefs cités pour `ct-alpha`. |
| 14 | `marc-shade/world-intel-mcp` | Blueprint Fetcher/circuit breaker/cache stale/collector daemon. |
| 15 | `openpumpio/openclaw-agent` | RiskParams réutilisables: exposure, stop-loss, trailing, circuit breaker, limites session/jour. |
| 16 | `nirholas/robinhood-chain-mcp` | Modèle RH data read-only + trading guard avec spend caps/kill-switch. |
| 17 | `zetryn-ai/ai-agent` | Décision framework memecoin avec trace, audit et backtest. |
| 18 | `thegreatola/memecoins-trading-agent` | Boucle copy-trade Solana complète: wallet tracking, convergence, score, Jupiter, exits par étapes. |

### Brique par brique

#### 1. Event ingest

- Solana: Helius RPC/Webhooks/Photon + Solana Web3.js + listeners Chainstack/PumpFun graduations.
- Robinhood/Fomo: Chainstack Fomo listeners, tape FomoPulse/Fomo Radar, résolution wallet via maker sets.
- Normalisation en un `TradeEvent` commun (chain, venue, token, maker, taker, side, quote, txid, block, timestamp).

#### 2. Wallet intelligence

- GMGN smart money/KOL comme socle.
- MEERKAT/FlySwarm/Stampede pour preuves, cohortes, rotations et convergence.
- PELLET pour dormancy/wake; Fomo Radar pour la résolution profile->wallet.
- Tous les scores wallets sont des entrées, jamais des autorisations d'exécution.

#### 3. Gatebook token

- AEGIS: mint, freeze, authority, bundles, LP lock, metadata.
- loxley: bundle déclaré, taxes, snipe exemptions, quote de sortie, dev-sell force-close.
- Rug Check/Honeypot via providers directs, pas via MCP wrapper si possible.
- Unknown = reject. Aucun LLM ne peut bypasser un hard gate.

#### 4. Scout social / CT Alpha

- `ct-alpha` existant enrichi par le pipeline last30days: résolution entity -> sources -> scoring engagement -> brief cité.
- RSS/X/GitHub/HN/Telegram publics seulement; cookie-based en `Reference`.
- Pas de Polymarket, pas de géopolitique, pas de recommandation directe.

#### 5. Décision et exécution

- Mode SHADOW/LIVE inspiré de `aitrader`/`memex`.
- Débat borné inspiré de `TradingAgents` mais avec veto quant et time budget meme.
- Jupiter API pour quote/route Solana; web3.js pour signer; broadcast séparé du scoring.
- Force-close déterministe loxley-style pour dev-sell; exit monitor indépendant du LLM.

#### 6. Mémoire et audit

- TradeMemory pour outcome-weighted recall et chaîne d'audit.
- Memanto pour consolidation/conflits/expiration si besoin.
- Postgres durable + Redis chaud + SQLite local; jamais de source de vérité unique en Mongo.

#### 7. Providers data

- Principaux: GMGN, Helius, Jupiter, Solana Web3.js.
- Cross-check: Bitquery, Birdeye, DexScreener, Solana Tracker, MadeOnSol.
- Plus tard BSC/Base: Alchemy/NodeReal/BaseScan/BscScan + EVM SDK.
- Encapsuler derrière interfaces `RpcProvider`, `QuoteProvider`, `EventProvider`, `DataProvider` avec healthcheck et fallback.

### Anti-patterns à éviter

- Aucun LP/Yield/NFT/Polymarket/perps/CEX derivés/bridges/equities.
- Aucun fork GPL/AGPL/NOASSERTION dans le code du bot.
- Aucun scraping browser/cookies comme colonne de production.
- Aucune IA qui décide seule d'exécuter; le LLM propose, les gates disposent.
- Aucune dépendance à un seul RPC/provider; toute la pile doit être dégradable.
- Pas de swarm LLM massif: la latence de cycle meme impose des décisions en secondes, pas en minutes.

### Gaps identifiés

1. **Couche callout/webhook GMGN** n'est probablement pas encore exploitée dans le projet; c'est le premier chantier après ce rapport.
2. **Tape RH/Fomo** demande une infra de listeners différente de Solana (ERC-4337/7702, Chainstack). Aucune brique n'existe encore.
3. **Exits safety** (dev-sell, quote de sortie, tax/depth) n'est pas couvert par l'adapter GMGN actuel; il faut un module indépendant inspiré de loxley.
4. **Wallet resolution** profile->wallet est un prérequis pour tout copy-trade RH; les données GMGN seules ne suffisent pas.
5. **Mémoire agent** n'existe pas encore; Postgres + TradeMemory + Redis pour les fenêtres chaudes.
6. **Study list** reste à trancher avant d'écrire du code: `Agent-Reach`, `world-intel-mcp`, `last30days-skill`, `okx/onchainos-skills`, `universal-crypto-mcp`, `WAIaaS`, `solana-mcp`, `pumpswap-mcp`, `solana-agent-kit`, `memecoin-radar-mcp`, `openpumpio/openpump`, `openpumpio/openclaw-agent`, `nirholas/robinhood-chain-mcp`, `zetryn-ai/ai-agent`, `autonsol/sol-mcp`, `dynamolabs/solana-mcp`.

### Conclusion du second pass

Memeclaw n'a pas besoin d'une liste infinie de MCP ni d'un fork massif. La valeur est dans un petit noyau: adapter GMGN + callouts, tape RH/Fomo, wallet resolution, gatebook, exits safety, mémoire, et quelques providers data en fallback. Le reste du rapport sert de catalogue de veille et de bloc de référence, pas de roadmap.

### Note sur la stratégie MCP

Le plus utile pour Memeclaw n'est pas d'installer 50 MCP, mais de choisir une dizaine de contrats d'outils read-only/execution alignés avec le scope: Bitquery, Solana Agent Kit, Memecoin Radar, Solana Launchpads, PumpFun Wallets, Jupiter, DexScreener, Pyth, Rug Check/Honeypot. Les autres catégories restent dans le rapport comme catalogue de veille, pas comme dépendances.

---

## Final pass: lecture code-level et architecture cible

Ce passage traite tous les lots comme un seul corpus. Les documents et liens fournis sont des sources de recherche, pas des instructions d'exécution. Le dépôt local montre encore un monolithe OpenCatz: `hub`, `dispatch`, `agent-runner`, deux surfaces de risque, adapters GMGN/Solana/EVM, wallet tracker, journal et plusieurs domaines hors périmètre. LP, NFT, Polymarket et perps existent encore dans `src/agents` et les tests: ils doivent être désactivés par registry/feature flag, puis retirés après migration des tests.

### Architecture end-to-end

```text
RPC / webhooks / GMGN callouts / social feeds
  -> event gateway -> normalizer -> dedupe/order -> event bus
  -> Redis hot state + Postgres durable ledger
  -> feature builder -> deterministic score -> candidate book
  -> bounded LLM panel -> decision compiler -> risk gatebook
  -> approved order intent -> quote/simulate -> policy signer
  -> broadcast -> confirm -> position reconciliation -> exit monitor
  -> metrics, replay, walk-forward, postmortem
```

Plans stricts:

| Plan | Responsabilité | Signature de transaction |
|---|---|---:|
| Data | Events Solana/RH/Fomo/Base/BSC, prix, holders, social, provenance. | Non |
| Intelligence | Features, wallet quality, manipulation, token evidence, scores. | Non |
| Agents | Hypothèses, critiques et résumés structurés. | Non |
| Control | Stratégie, modes SHADOW/PAPER/LIVE, budgets, kill switch. | Non |
| Execution | Build, simulation, signature, broadcast, confirmation. | Oui, seul ce plan |
| Research | Replay, backtest, calibration, promotion de versions. | Non |

Un LLM ne reçoit jamais une clé privée ni `sendTransaction`. Il renvoie une opinion expirante; seul le compilateur déterministe peut créer un `ApprovedOrderIntent` avec `intentId`, token, chaîne, side, notional, minOut, slippage, expiration, `riskDecisionId`, `policyVersion` et idempotency key.

### Swarm: sept rôles logiques, quatre appels parallèles maximum

| Nom | Mission | Données/outils autorisés |
|---|---|---|
| **Scout Nova** | Découverte Solana/Pump.fun/Raydium et tape RH/Fomo. | GMGN, Bitquery, Helius/Chainstack, Memecoin Radar, PumpFun Wallets. |
| **Scout Atlas** | Découverte Base/BSC et cross-check de marché. | GMGN, Bitquery, DexScreener, GeckoTerminal, Alchemy/QuickNode. |
| **Wallet Sage** | PnL, holding time, cohortes, convergence et funding graph. | GMGN smart money, Bitquery, top traders/holders, wallet MCPs. |
| **Narrative Echo** | CT Alpha, récence, entités, citations et catalyseurs. | last30days, Agent-Reach, RSS/news publics. |
| **Red Team Veto** | Rug, wash, bundle/sniper/bump, taxes, liquidité et contradictions. | GMGN security, RugCheck, GoPlus/Honeypot, analyzers. |
| **Portfolio Pilot** | Sizing proposé, exposition, corrélation et scénarios de sortie. | Positions, volatilité, liquidité et RiskParams; aucune exécution. |
| **Postmortem Smith** | Analyse offline, drift, calibration et expériences futures. | Journal, Postgres, replay, TradeMemory. |

Nova, Atlas, Sage et Echo travaillent en parallèle. Veto reçoit les preuves brutes et les opinions séparément pour limiter l'ancrage. Le compiler calcule le score; Pilot dimensionne dans une limite stricte; le risk engine décide `ALLOW`, `PAPER_ONLY`, `WATCH` ou `REJECT`. Smith n'applique jamais automatiquement ses changements.

### LLM contre algorithmes

| Algorithmes déterministes | LLM |
|---|---|
| Returns, volatilité, ATR, drawdown, profondeur, spread, impact, slippage. | Résumer une thèse avec des preuves citées. |
| Holder concentration, creator allocation, bundle/sniper/bump, wash et funding graph. | Détecter contradictions sémantiques et proposer invalidations. |
| Sizing, exposure, corrélation, cooldown, stops, trailing et take-profit. | Comparer des hypothèses déjà calculées. |
| Allowlist, token security, source health, stale data, quote, simulation, idempotence. | Produire `WATCH` ou `PROPOSE`, jamais `SEND`. |
| Backtest, walk-forward, calibration, PnL et promotion de version. | Expliquer les erreurs et proposer une expérience. |

### Gatebook live

Refus immédiat si chaîne/venue non allowlistée, quote expiré, source stale, security `UNKNOWN`, authority dangereuse, honeypot/taxe inconnue, liquidité ou impact insuffisant, bundle/sniper/bump/wash au-dessus du seuil, wallet non qualifié, budget dépassé, kill switch actif, RPC/signer dégradé, ou métadonnées d'audit manquantes. Unknown = reject. Les SELL d'urgence ont un chemin court indépendant du LLM, mais restent limités au portefeuille et au token autorisés.

### Stockage et fiabilité

- **Postgres**: source durable pour events, tokens, pools, wallets, evidence, candidates, opinions, policies, orders, fills, positions et audit append-only.
- **Redis**: TTL cache, locks, dedupe court, latest quote, rate-limit buckets, queues et circuit breaker.
- **Object storage/Parquet**: payloads bruts, snapshots et datasets de replay, référencés par hash depuis Postgres.
- **SQLite**: dev, tests et replay local uniquement; pas de source live multi-worker.

Chaque événement porte `traceId`, source, timestamps, slot/block, raw hash et schema version. SLO à suivre: feed-to-decision latency, stale rate, quote/simulation failure, fill ratio, slippage bps, PnL net par chaîne/stratégie/cohorte, veto rate, drawdown, RPC health et coût LLM.

### Chaînes et ordre de livraison

| Phase | Chaînes | Exécution | Preuve de sortie |
|---|---|---|---|
| P0 read-only | Solana + RH/Fomo | Aucun signer | Event replayable, déduplication et audit complets. |
| P1 shadow/paper | Solana + RH/Fomo | Simulation avec latence/slippage | Expectancy nette positive sur holdout, drawdown accepté. |
| P2 canary | Une venue Solana, puis RH | Taille minimale, approval humaine | Reconciliation parfaite et kill switch testé. |
| P3 expansion | Base, puis BSC | viem, simulation, honeypot/sell check | Policy séparée, tests fork et rollback. |

Solana: Helius/Chainstack/Triton, GMGN, Bitquery, Jupiter, puis PumpSwap/Raydium audités. RH/Fomo: listeners Chainstack, tape, résolution profile->wallet, EVM nonce/simulation. Base/BSC: Alchemy/QuickNode/Bitquery/DexScreener, viem, routers allowlistés. Aucun bridge, LP, NFT, prediction, perp ou CEX derivative dans le routeur.

### Tests non négociables

Contract tests des adapters, property tests sizing/idempotence, replay déterministe, tests de stale data et duplicate events, chaos RPC failover, simulation/fork EVM, local validator Solana, emergency sell, kill switch, shadow-vs-paper et reconciliation positions. Mesurer l'expectancy après frais, gas, failed fills et slippage; win rate seul ne vaut rien.

### Backlog de construction

1. Schémas runtime versionnés et `ApprovedOrderIntent`.
2. Fusionner `risk-manager` et `risk-engine-v2` derrière un seul `RiskEngine`.
3. Event envelope, dedupe, source health, Postgres ledger et Redis locks.
4. Ports/adapters GMGN, Helius, Bitquery, Jupiter et EVM.
5. Gatebook token/wallet anti-manipulation.
6. `DecisionCompiler` indépendant des votes LLM.
7. Signer/executor isolé et policy vault.
8. Positions, reconciliation, exits monitor et emergency path.
9. CT Alpha avec citations, expiration et provenance.
10. Replay, walk-forward, shadow et dashboards avant toute clé live.
11. Retirer LP/NFT/Polymarket/perps du registry, prompts, routes et tests.
12. Ajouter Base puis BSC après canary Solana/RH.

### Mémoire du corpus

Ce fichier est le registre durable des batches 1 à 9 et de ce passage final. Pour chaque nouvelle source: ajouter URL exacte, date, commit/tag, licence, fichiers lus, mécanismes observés, verdict, droits de réutilisation, risques et tests. Ne jamais écraser les constats précédents; ajouter une révision datée.

### Verdict final

Memeclaw doit être un système de trading déterministe assisté par LLM, pas un swarm qui possède le portefeuille. Le LLM lit, compare, explique et propose. Les algorithmes mesurent. Le gatebook refuse. Le risk engine dimensionne. Le signer exécute. Le ledger prouve. Le replay apprend. Cela peut devenir un bot robuste et éventuellement rentable après preuve expérimentale; aucune architecture ne garantit un gain.

---

## Registre final exhaustif des décisions

Cette section est la décision finale pour **toutes les sources du corpus unique**, réécrite avec la classification v3: `Adopt`, `Adapt`, `Study`, `Skip`. Les anciennes tables intermédiaires du rapport sont des journaux de lecture; la présente section et la `Master Classification v3` plus bas font foi pour la décision opérationnelle.

### Adopt

Intégrer directement comme contrat, SDK, provider ou dépendance après audit ciblé. Peu d'éléments passent en `Adopt`: le corpus justifie surtout de réimplémenter des mécanismes, pas de prendre des dépendances larges.

- GMGN Agent API et GMGN Callout/OpenAPI: port officiel principal pour market intel, ranking, token info, security, smart money et événements.
- `docs.codex.io/networks`: provider GraphQL multi-chain de secours pour paires, wallets et events.
- `mcp.bitquery.io`: provider MCP multi-chain pour trades, OHLC, market cap et wallet PnL, derrière source-health et dedupe.
- `api.dexpaprika.com`: provider REST/SSE secondaire pour paires/pools EVM et Solana.
- `rckprtr/pumpdotfun-sdk`: SDK Pump.fun candidat derrière `ExecutionProvider`, après audit du program et de la custody.
- `jito-labs/jito-ts`: SDK bundles/tips pour l'exécution Solana protégée, isolé derrière un executor dédié.

### Adapt

Réimplémenter dans notre propre code les mécanismes ou patterns utiles. C'est la catégorie la plus large.

- `cvxv666/fomo-robinhood-radar`, `itsnex1s/fomopulse-robinhood-chain-tape`, `chainstacklabs/fomo-solana-rh-listeners`, `lunarresearcher/copy`, `slightlyuseless/pons-sniper`: tape RH/Fomo, reconstruction des fills, provider Pons V1/V2, scoring wallet/token et règles de copy.
- `chainstacklabs/pumpfun-bonkfun-bot`, `gustaffsonKotte/qlo`, `shmidtqq65/loxley`, `Argona7/stampede`, `0xjeffro/tx-parser`, `rimtoln/COPUMP`, `lyc0603/copytrading`: exécution/paper Pump.fun, graduation curve-time, force-close dev-sell, rotation/convergence, parsing tx et funding graph anti-manipulation.
- `kocer6/MEERKAT`, `semkazz1/FlySwarm`, `0xuezhang985/wallet-convergence-alert`, `andreysuperiorgit/aegis`, `mnemox-ai/tradememory-protocol`: evidence-first scoring, cohortes wallets, convergence, gatebook fail-closed et mémoire/audit.
- `GMGNAI/gmgn-skills`, `GMGNAI/skillmarket-demos` (aitrader + memex), `0xmfox/rabiq`, `h100envy/nerve`, `yllvar/gmgn-TrendingAnalyzer`, `LW-ARTS/trenchkit`, `crownobyl/trenchkit`: workflows GMGN, hard gates, scoring déterministe, dossier deployer RH, spine reflexes et discovery wallets SQL.
- `openpumpio` (openpump + openclaw-agent), `zetryn-ai/ai-agent`, `thegreatola/memecoins-trading-agent`, `Denzz102/memecoin-agent`, `Benita2001/SpecterAI`, `alexskin/memeoy`, `MayurK-cmd/4Meme-Pilot`, `tow3web3/agentinu`, `meme-radar`: pipelines scouts -> risk -> alert -> journal, wallets/holders, paper-first et BSC 4.meme.
- `manavaga/web3-signals-mcp`, `autonsol/sol-mcp`, `dynamolabs/solana-mcp`, `tony-42069/solana-mcp`, `kukapay/*` (pumpfun-wallets, rug-check, honeypot, whale-tracker, sentiment, indicators, dexscreener-trending): fusion de signaux, calibration, risk Solana et wrappers MCP à réimplémenter si besoin derrière nos adapters.
- `PillCrew/claimchain`, `Panniantong/Agent-Reach`, `marc-shade/world-intel-mcp`, `mvanhorn/last30days-skill`, `kabbersokhi-boop/crypto-trend-hunter`, `nirholas/kol-quest`, `marksantiago290/KOLscan-leaderboard-scraping`: vérification de claims, ingestion sociale contrôlée, cache/stale et leaderboard KOL.
- `build23w/fdv.lol`, `rimtoln/fletch`, `milesdeutscher/garchmethod`, `garchmethod`, `Kelows/million`, `Im-Madhur-Gupta/maverick`, `ricoboost/meme-coin-trading-bot`, `ironclad-protocol/solana-copy-trading-bot`, `sergafon/solana-copy-trading`, `dartkomnitibe/solana-meme-tool`, `soladdev/solana-meme-tool`, `natebag/TrenchTools`: scoring explainable, sizing GARCH, deck/copy/whale, cluster detection, submitter Jito, desk et vault.
- `ArgosSystems/Smart-Money-Tracker`, `jamsturg/crypto-whale-tracker`, `warp-id/solana-trading-bot`, `wwwwwwworld/solana-trading-bot-v3`, `harutocodes/pumpfun-copytrade`, `1009682175845693/bsc-fourmeme-bot`, `dragon1086/prism-insight`, `jito-labs/jito-ts`, `Stormeye85/robinhood-token-sniper`, `Thorsten02041973/robinhood-cli`, `nansen-ai/nansen-cli`: tracker multi-chain, liste de paramètres d'exécution, copy fills, BSC FourMeme, prism insight, sniper RH et CLI ops.
- `zostaff/ai-quant-researcher`, `zostaff/agent-arena`, `TauricResearch/TradingAgents`, `The-Swarm-Corporation/AutoHedge`, `HKUDS/Vibe-Trading`, `pgen0x/azimuth`, `akanz/onchain-trading-bot`, `mocasus/trade-agent`, `ygwyg/MAHORAGA`, `51bitquant/ai-hedge-fund-crypto`, `Tomortec/CryptoTradingAgents`, `ryan-yuuu/crypto-trading-arena`, `olaxbt/ai-market-maker`, `ginlix-ai/LangAlpha`, `FinStep-AI/ContestTrade`, `EthanAlgoX/LLM-TradeBot`, `danilobatson/ai-trading-agent-gemini`, `AmadeusGB/alpha-arena`, `LuckyOne7777/LLM-Trading-Lab`, `nautechsystems/nautilus_trader`, `asavinov/intelligent-trading-bot`, `freqtrade/freqtrade`, `JulienPlanchetCoineo/frostybot-js`, `TheGigaQuant/frostybot-js`, `ctubio/Krypto-trading-bot`, `GuntharDeNiro/gunbot-quant`: patterns de recherche, arena paper, débats analyste/risque, backtest et moteurs de trading à adapter sans dépendance live.

### Study

Sources à lire, comparer ou prototyper avant décision. Aucune dépendance directe pour l'instant.

- `LLMQuant/awesome-trading-agents`, `BlockRunAI/awesome-finance-mcp`, `buddies2705/awesome-memecoin-trading`, `RKiding/Awesome-finance-skills`, `okx/onchainos-skills`, `okx/agent-skills`, `dbotx/dbot-mcp-servers`: catalogues, skills et contrats MCP à explorer.
- `FinceptTerminal`, `OpenBB`, `hummingbot`, `bmoscon/cryptofeed`, `edtechre/pybroker`, `Lumiwealth/lumibot`, `mcp-aktools`, `mcp_massive`, `LLMQuant/data-mcp`, `financial-datasets/mcp-server`, `FinanceMCP`, `6551Team/opennews-mcp`, `opennews-mcp`: data/backtest/terminal génériques, pas runtime P0.
- `vybenetwork/solana-top-holders-api`, `solana-top-traders-api`, `solana-trader-pnl-api`, `chasepal/gmgn-wallet-holdings`, `nirholas/pump-fun-workers`, `nirholas/pump-fun-sdk`, `nirholas/crypto-vision`, `nirholas/memescope-monday-directory`, `nirholas/robinhood-chain-mcp`, `ChipaDevTeam/GmGnAPI`, `BikeTysonDegen/gmgn-terminal-bot`, `tradermonty/claude-trading-skills`, `monarchjuno/tradingcodex`, `atilaahmettaner/tradingview-mcp`, `okx/agent-trade-kit`, `kraken-cli`, `mcp.crypto.com`, `aave/skills`, `base-mcp`, `pancakeswap-poolspy`, `evm-mcp-server`, `etherscan-mcp`, `blockscout`, `thetateman/Trading-API`, `docs.moralis.com/`, `docs.mobula.io/guides/gmgn-apis`, `docs.dune.com/api-reference/agents/mcp`, `mcpmarket.com/server/openpump`: providers, wrappers et SDK à auditer selon coût, couverture et licence.
- `arxiv.org/html/2501.00826v3`, PDFs `2609.10246` et `2609.05663`, ETHGlobal showcases `meme-sentinels`, `agentstrategy`, `degenagent`, `ennriqe/crypto-agent-memecoin-prototype`, `alexskin/memeoy`: papers et prototypes hackathon pour design et threat model, pas code live.
- `HKUSTDial/DeepEar`, `oficcejo/alpha-arena-okx`, `paperswithbacktest/pwb-alphaevolve`, `Miasyster/QuantGPT`, `dragon1086/prism-insight`, `flash131307/multi-agent-investment`, `liangdabiao/autogen-financial-analysis`, `ValueCell-ai/valuecell`, `AI4Finance-Foundation/FinRobot`, `brokermr810/QuantDinger`, `OpenByteInc/QuantDinger`, `ZhuLinsen/daily_stock_analysis`, `nautilus_trader`, `fastquant`, `holdout-labs/lookahead-free`, `555cute/r20-quantum-trader`, `0xBennie/binance-smart-money-oi-monitor`: quant/multi-agent/CEX research, à garder en Study sauf pattern isolé.
- `sevenlabs-hq/carbon`, `subsquid/squid-sdk`, `holaplex/indexer`, `uxuycom/indexer`, `paradigmxyz/cryo`, `chainbase-labs/manuscript-core`, `messari/subgraphs`, `enviodev/hyperindex`, `Shradhesh71/YellowStone-gRPC`: indexeurs, ETL et data lakes pour historique/backtest, pas hot path.
- `solo-agent/solo`, `AgriciDaniel/claude-obsidian`, `web3-signals-mcp`, `world-intel-mcp`, `last30days-skill`, `Agent-Reach`, `memeoy`, `Maverick`, `docs.fereai.xyz/`, `AnoMeme`, `memenet`, `solana-meme-tool`, `Trading-platform-frontend`, `MiroFish-Offline`, `CROWBRAIN`, `fletch`, `million`, `maverick-backend.onrender.com/api`, `santiment` pages, `debank.com/ranking/dex`, `dex.watch`, `etherscan.io/dextracker`, `dexindex.io`, `liquidity.vision`, `orderflow.art`, `theblockcrypto.com/data/open-finance/dex-non-custodial`, `graphs.santiment.net/dex_trades`, `predictions.exchange/dex`: références UX, données et simulation, pas dépendances runtime.

### Skip

Hors scope, fragmentaire, risqué, inutile ou en doublon du stack existant.

- `pamgarcia1993/robinhood-lp-bot`, `nirholas/scrape-smart-wallets`, `sirenconemd/robinhood-trading-toolkit`, `mortdeus/solana-copy-sniper-mev-trading-bot`, `w3laba/DexScreener-Trending`, `vincentkoc/dexscraper`, `nirholas/memescope-monday-directory`, `oratis/influencex`, `nomics` (`p.nomics.com`), `ccxt`, `trustwallet/blockatlas`, `developers.shrimpy.io`, `wealthfolio/wealthfolio`, `gunbot-quant`, `0xBennie/binance-smart-money-oi-monitor`, `a-guard/malicious-validators`, `robinhood-cli`, `ChainPlusTrader`, `jamsturg/crypto-whale-tracker`, `tradingcodex`, `okx/agent-trade-kit`, `okx/onchainos-skills`, `kraken-cli`, `mcp.crypto.com`, `docs.moralis.com/`, `api.coinpaprika.com`, `docs.coincap.io/`, `coingecko.com/learn/best-free-crypto-api`, `p.nomics.com`, `TheGigaQuant/frostybot-js`, `Krypto-trading-bot`, `OrderBooks`, `financial-indexes-correlation`, `financial-dataset-generator`, `undervalued-crypto-finder`, `lookahead-free`, `liquidity.vision`, `orderflow.art`, `predictions.exchange/dex`, `dexindex.io`, `theblockcrypto.com/data/open-finance/dex-non-custodial`: CEX, equity, perps, LP, NFT, prediction, scraping fragile, bundlers, volume bots, MEV sketchy, dead sites ou génériques.

### Couverture exhaustive (full URLs)

Les URLs complètes de la liste dédupliquée sont mappées ici pour éviter toute ambiguïté entre les raccourcis ci-dessus.

- `Adopt`: https://docs.gmgn.ai/index/gmgn-agent-api | https://docs.gmgn.ai/index/gmgn-callout-openapi | https://docs.codex.io/networks | https://mcp.bitquery.io/ | https://api.dexpaprika.com/ | https://www.geckoterminal.com/ | https://birdeye.so/ | https://github.com/rckprtr/pumpdotfun-sdk | https://github.com/jito-labs/jito-ts
- `Adapt`: https://github.com/cvxv666/fomo-robinhood-radar | https://github.com/itsnex1s/fomopulse-robinhood-chain-tape | https://github.com/chainstacklabs/fomo-solana-rh-listeners | https://github.com/lunarresearcher/copy | https://github.com/slightlyuseless/pons-sniper | https://github.com/chainstacklabs/pumpfun-bonkfun-bot | https://github.com/gustaffsonKotte/qlo | https://github.com/shmidtqq65/loxley | https://github.com/Argona7/stampede | https://github.com/0xjeffro/tx-parser | https://github.com/rimtoln/COPUMP | https://github.com/lyc0603/copytrading | https://github.com/kocer6/MEERKAT | https://github.com/semkazz1/FlySwarm | https://github.com/0xuezhang985/wallet-convergence-alert | https://github.com/andreysuperiorgit/aegis | https://github.com/mnemox-ai/tradememory-protocol | https://github.com/GMGNAI/gmgn-skills | https://gmgnai.github.io/skillmarket-demos/aitrader | https://gmgnai.github.io/skillmarket-demos/memex | https://github.com/GMGNAI/skillmarket-demos/tree/main/aitrader | https://github.com/GMGNAI/skillmarket-demos/tree/main/memex | https://github.com/0xmfox/rabiq | https://github.com/h100envy/nerve | https://github.com/yllvar/gmgn-TrendingAnalyzer | https://github.com/LW-ARTS/trenchkit | https://github.com/crownobyl/trenchkit | https://github.com/openpumpio | https://github.com/zetryn-ai/ai-agent | https://github.com/thegreatola/memecoins-trading-agent | https://github.com/Denzz102/memecoin-agent | https://github.com/Benita2001/SpecterAI | https://github.com/alexskin/memeoy | https://github.com/MayurK-cmd/4Meme-Pilot | https://github.com/tow3web3/agentinu | https://github.com/nhovongoc0-max/meme-radar | https://github.com/stefanoviana/crypto-pump-scanner | https://github.com/PillCrew/claimchain | https://github.com/build23w/fdv.lol | https://github.com/rimtoln/fletch | https://github.com/milesdeutscher/garchmethod | https://github.com/Kelows/million | https://github.com/Im-Madhur-Gupta/maverick | https://github.com/ricoboost/meme-coin-trading-bot | https://github.com/ironclad-protocol/solana-copy-trading-bot | https://github.com/sergafon/solana-copy-trading | https://github.com/dartkomnitibe/solana-meme-tool | https://github.com/soladdev/solana-meme-tool | https://github.com/natebag/TrenchTools | https://github.com/ArgosSystems/Smart-Money-Tracker | https://github.com/jamsturg/crypto-whale-tracker | https://github.com/warp-id/solana-trading-bot | https://github.com/wwwwwwworld/solana-trading-bot-v3 | https://github.com/harutocodes/pumpfun-copytrade | https://github.com/1009682175845693/bsc-fourmeme-bot | https://github.com/dragon1086/prism-insight | https://github.com/Stormeye85/robinhood-token-sniper | https://github.com/Thorsten02041973/robinhood-cli | https://github.com/nansen-ai/nansen-cli | https://github.com/zostaff/ai-quant-researcher | https://github.com/zostaff/agent-arena | https://github.com/TauricResearch/TradingAgents | https://github.com/The-Swarm-Corporation/AutoHedge | https://github.com/HKUDS/Vibe-Trading | https://github.com/pgen0x/azimuth | https://github.com/akanz/onchain-trading-bot | https://github.com/mocasus/trade-agent | https://github.com/ygwyg/MAHORAGA | https://github.com/51bitquant/ai-hedge-fund-crypto | https://github.com/Tomortec/CryptoTradingAgents | https://github.com/ryan-yuuu/crypto-trading-arena | https://github.com/olaxbt/ai-market-maker | https://github.com/ginlix-ai/LangAlpha | https://github.com/FinStep-AI/ContestTrade | https://github.com/EthanAlgoX/LLM-TradeBot | https://github.com/danilobatson/ai-trading-agent-gemini | https://github.com/AmadeusGB/alpha-arena | https://github.com/LuckyOne7777/LLM-Trading-Lab | https://github.com/nautechsystems/nautilus_trader | https://github.com/asavinov/intelligent-trading-bot | https://github.com/freqtrade/freqtrade | https://github.com/JulienPlanchetCoineo/frostybot-js | https://github.com/TheGigaQuant/frostybot-js | https://github.com/ctubio/Krypto-trading-bot | https://github.com/GuntharDeNiro/gunbot-quant | https://github.com/sopersone/CROWBRAIN | https://github.com/rimtoln/fletch | https://github.com/Kelows/million | https://github.com/ejfxgit2025/memenet | https://github.com/AI-PIN/ChainPlusTrader
- `Study`: https://github.com/Fincept-Corporation/FinceptTerminal | https://github.com/muratmula/ai-robinhood-chain | https://github.com/Drakkar-Software/OctoBot | https://github.com/PillCrew/PillCrew | https://github.com/uerax/all-in-one-bot | https://github.com/redactedmeme/swarm | https://github.com/hummingbot/hummingbot | https://github.com/OpenBB-finance/OpenBB | https://github.com/vybenetwork/solana-top-holders-api | https://github.com/vybenetwork/solana-top-traders-api | https://github.com/vybenetwork/solana-trader-pnl-api | https://github.com/0xwast3/PELLET | https://github.com/moorcheh-ai/memanto | https://github.com/guangxiangdebizi/FinanceMCP | https://github.com/aahl/mcp-aktools | https://github.com/massive-com/mcp_massive | https://github.com/kukapay/jupiter-mcp | https://github.com/kukapay/pumpfun-wallets-mcp | https://github.com/kukapay/rug-check-mcp | https://github.com/kukapay/honeypot-detector-mcp | https://github.com/kukapay/whale-tracker-mcp | https://github.com/kukapay/crypto-sentiment-mcp | https://github.com/kukapay/crypto-indicators-mcp | https://github.com/kukapay/dexscreener-trending-mcp | https://mcpmarket.com/server/openpump | https://arxiv.org/html/2501.00826v3 | https://ethglobal.com/showcase/meme-sentinels-12xqg | https://ethglobal.com/showcase/agentstrategy-hiyug | https://ethglobal.com/showcase/degenagent-zqmdu | https://github.com/immortalhowwl/fly-high | https://github.com/blockscout/blockscout | https://docs.dune.com/api-reference/agents/mcp | https://docs.mobula.io/guides/gmgn-apis | https://docs.moralis.com/ | https://github.com/enzoampil/fastquant | https://github.com/tiagosiebler/OrderBooks | https://dex.watch | https://etherscan.io/dextracker | https://graphs.santiment.net/dex_trades | https://app.santiment.net/assets/list?name=decentralized%20exchanges | https://debank.com/ranking/dex | https://github.com/WebRaizo30/AnoMeme | https://github.com/moazamdotdev/Trading-platform-frontend | https://github.com/ejfxgit2025/memenet | https://github.com/AI-PIN/ChainPlusTrader | https://docs.fereai.xyz/ | https://maverick-backend.onrender.com/api | https://github.com/nikmcfly/MiroFish-Offline
- `Skip`: https://github.com/alpacahq/alpaca-mcp-server | https://985monitor.xyz/ | https://github.com/krakenfx/kraken-cli | https://mcp.crypto.com | https://github.com/aave/skills | https://github.com/degenfrends/solana-rugchecker | https://github.com/ccxt/ccxt | https://docs.coincap.io/ | https://api.coinpaprika.com/ | https://developers.shrimpy.io/ | https://p.nomics.com/cryptocurrency-bitcoin-api | https://dexindex.io | https://liquidity.vision | https://www.theblockcrypto.com/data/open-finance/dex-non-custodial | https://orderflow.art | http://www.predictions.exchange/dex | https://github.com/Erfaniaa/financial-indexes-correlation | https://github.com/Erfaniaa/financial-dataset-generator | https://github.com/Erfaniaa/undervalued-crypto-finder | https://github.com/wealthfolio/wealthfolio | https://www.coingecko.com/learn/best-free-crypto-api | https://github.com/pamgarcia1993/robinhood-lp-bot | https://github.com/nirholas/scrape-smart-wallets | https://github.com/sirenconemd/robinhood-trading-toolkit | https://github.com/mortdeus/solana-copy-sniper-mev-trading-bot | https://github.com/w3laba/DexScreener-Trending | https://github.com/vincentkoc/dexscraper | https://github.com/oratis/influencex | https://github.com/0xBennie/binance-smart-money-oi-monitor

#### Complétion v3 (URLs restantes)

URLs de la liste dédupliquée qui n'apparaissaient pas encore sous forme complète dans la ligne `Couverture exhaustive` ci-dessus. Classification finale: `Adopt`, `Adapt`, `Study`, `Skip`.

- `Adapt`: https://github.com/autonsol/sol-mcp | https://github.com/dynamolabs/solana-mcp | https://github.com/tony-42069/solana-mcp | https://github.com/kabbersokhi-boop/crypto-trend-hunter | https://github.com/manavaga/web3-signals-mcp | https://github.com/marc-shade/world-intel-mcp | https://github.com/mvanhorn/last30days-skill | https://github.com/Panniantong/Agent-Reach | https://github.com/marksantiago290/KOLscan-leaderboard-scraping | https://github.com/nirholas/kol-quest
- `Study`: https://github.com/555cute/r20-quantum-trader | https://github.com/6551Team/opennews-mcp | https://github.com/AI4Finance-Foundation/FinRobot | https://github.com/atilaahmettaner/tradingview-mcp | https://github.com/BikeTysonDegen/gmgn-terminal-bot | https://github.com/BlockRunAI/awesome-finance-mcp | https://github.com/bmoscon/cryptofeed | https://github.com/brokermr810/QuantDinger | https://github.com/buddies2705/awesome-memecoin-trading | https://github.com/chainbase-labs/manuscript-core | https://github.com/chasepal/gmgn-wallet-holdings | https://github.com/ChipaDevTeam/GmGnAPI | https://github.com/dbotx/dbot-mcp-servers | https://github.com/edtechre/pybroker | https://github.com/ennriqe/crypto-agent-memecoin-prototype | https://github.com/enviodev/hyperindex | https://github.com/financial-datasets/mcp-server | https://github.com/flash131307/multi-agent-investment | https://github.com/HKUSTDial/DeepEar | https://github.com/holaplex/indexer | https://github.com/holdout-labs/lookahead-free | https://github.com/liangdabiao/autogen-financial-analysis | https://github.com/LLMQuant/awesome-trading-agents | https://github.com/LLMQuant/awesome-trading-agents#agents-atlas-gic | https://github.com/LLMQuant/awesome-trading-agents#mcps-tradingagents-mcpmode | https://github.com/LLMQuant/data-mcp | https://github.com/Lumiwealth/lumibot | https://github.com/messari/subgraphs | https://github.com/Miasyster/QuantGPT | https://github.com/monarchjuno/tradingcodex | https://github.com/nirholas/crypto-vision | https://github.com/nirholas/pump-fun-sdk | https://github.com/nirholas/pump-fun-workers | https://github.com/nirholas/robinhood-chain-mcp | https://github.com/oficcejo/alpha-arena-okx | https://github.com/okx/agent-skills | https://github.com/okx/agent-trade-kit | https://github.com/okx/onchainos-skills | https://github.com/OpenByteInc/QuantDinger | https://github.com/paperswithbacktest/pwb-alphaevolve | https://github.com/paradigmxyz/cryo | https://github.com/RKiding/Awesome-finance-skills | https://github.com/sevenlabs-hq/carbon | https://github.com/Shradhesh71/YellowStone-gRPC | https://github.com/solo-agent/solo | https://github.com/subsquid/squid-sdk | https://github.com/thetateman/Trading-API | https://github.com/tradermonty/claude-trading-skills | https://github.com/uxuycom/indexer | https://github.com/ValueCell-ai/valuecell | https://github.com/ZhuLinsen/daily_stock_analysis | https://coinmarketcap.com/view/memes/ | https://www.coingecko.com/en/categories/meme-token | https://dexrabbit.bitquery.io/
- `Skip`: https://github.com/a-guard/malicious-validators | https://github.com/nirholas/memescope-monday-directory | https://github.com/trustwallet/blockatlas | https://github.com/...`

### Migration des scouts

Le dépôt possède déjà `meme-solana`, `meme-robinhood`, `meme-base`, `meme-eth`, `meme-ink`, `ct-alpha`. La cible est:

```text
meme-solana    -> actif P0: Solana/Pump.fun
meme-robinhood -> actif P0: Robinhood/Fomo
meme-base      -> actif P1: Base
meme-bsc       -> remplace meme-ink, actif P1: BSC/4.meme/PancakeSwap
meme-eth       -> conservé désactivé par défaut, puis retrait si non requis
ct-alpha       -> actif transversal, preuves publiques et expiration courte
meme-ink       -> retiré du registry et du prompt après migration des tests
```

Le rapport ne promet pas un edge garanti. Il donne la décision d'ingénierie: peu de chemins d'exécution, beaucoup de preuves, hard gates déterministes, LLM sans pouvoir financier, et promotion live uniquement après replay, paper et canary.

## Final source audit

Date: 2026-09-17

Ce section est un appendice de mémoire. Il ne supprime aucune section précédente. Les lecteurs qui veulent la classification complète (`Adopt`, `Adapt`, `Study`, `Skip`, architecture, swarm, migration des scouts) doivent regarder les sections au-dessus.

Méthode: GitHub CLI authentifié (`gh`) avec le PAT local, arcs de clonage shallow, arbres/API quand le réseau l'a permis, nettoyage des clones après lecture, et lecture ciblée au niveau code pour les dépôts à plus forte valeur. Des subagents ont été tentés en parallèle pour cloner les gros lots; plusieurs clones/network ont échoué, donc le thread principal a continué via `gh api` et lectures `README/raw`, puis a nettoyé les clones temporaires.

Niveau de preuve utilisé:

| Niveau | Sens |
|---|---|
| `README only` | Meta-analyse du README et du publish; pas de lecture de code source. |
| `tree + manifest` | Structure de fichier, package.json/pyproject, pas de logique interne lue. |
| `key source files` | Fichiers source cibles lus au niveau fonction. |
| `source + guides` | Code et docs internes lus (architecture, stratégie, safety). |
| `document/site` | PDFs, docs GMGN, marketplaces, pages ETHGlobal. |
| `unverified` | URL inaccessible, clone timeout, licence ou ownership pas confirmés. |

### Skills consultés pendant le sweep final

15 fichiers de skills lus:

`ast-grep`, `ast-grep-outline`, `ateam:generate`, `superpowers:using-superpowers`, `superpowers:executing-plans`, `last30days`, `open-websearch`, `superpowers:verification-before-completion`, `superpowers:systematic-debugging`, `sequential-thinking`, `python-patterns`, `gsd-code-review`, `superpowers:brainstorming`, `superpowers:test-driven-development`, `gsd-audit-fix`.

### Code-level: sources lues en profondeur

| Source | Licence | Niveau | Verdict | Mécanismes à retenir |
|---|---|---|---|---|
| `chainstacklabs/pumpfun-bonkfun-bot` | Apache-2.0 | `key source files` | Adapt | IDL pump.fun, `getMultipleAccounts` batch, `buy_v2` 27 comptes / `sell_v2` 26, ATA base systématique, refresh curve avant sell, priority fee 70e percentile avec hard cap, `curve_refresh_budget` contre stale RPC, `UniversalTrader` avec fenêtre de fraîcheur token et max exit attempts. |
| `itsnex1s/fomopulse-robinhood-chain-tape` | MIT | `source + guides` | Adapt | WebSocket + catch-up, receipts stables, `StoredFill` reconstruits depuis transfers, `DUST_USD=5`, detection handout 5+ wallets, reboot replay via `RULES` version, `rebuildFills` offline. |
| `lunarresearcher/copy` | MIT | `source + guides` | Adapt | Provider Fomo public fallback, normalization leaderboard, RobinhoodChain `RobinhoodProvider` avec topics PONS V1/V2, `walletScore`, `tokenScore`, copy rules avec max market cap/liquidity/tax/conviction/concurrent, `NativeExecutor` webhook queue, paper/terminal séparés. |
| `shmidtqq65/loxley` | - | `key source files` | Adapt | Filets de scoring pons, stratégie paper, relecture précédente. |
| `cvxv666/fomo-robinhood-radar` | - | `key source files` | Adapt | resolve et score patterns pour Fomo/RH radar. |
| `GMGNAI/gmgn-skills` | - | `source + guides` | Adopt/Adapt | Due diligence contrat, wallet score, cook skills. |
| `openpumpio/openpump` | - | `key source files` | Adapt | Snipe/stop-loss/trading patterns MCP, risques et ordre d'execution. |
| `openpumpio/openclaw-agent` | - | `README only` | Adapt | Risk contract avant code de trading. |
| `chainstacklabs/fomo-solana-rh-listeners` | - | `key source files` | Adapt | Onchain listeners pour Solana et RH. |
| `lyc0603/copytrading` | - | `source + guides` | Adapt | Analyse meme, algorithms anti-bots PDF `2601.08641`, dossier copytrading. |
| `tony-42069/solana-mcp` / `kukapay/*` | - | `README only` | Study | Outils MCP Solana/memecoin; préférer APIs directes pour latence. |
| `manavaga/web3-signals-mcp` | - | `README only` | Adapt | Fusion multi-dimensions, IC weights, Platt calibration, x402. |
| `autonsol/sol-mcp` | - | `README only` | Adapt | Risk scoring Solana et momentum, hosted MCP, no code intégré. |
| `dynamolabs/solana-mcp` | MIT (readme) | `tree + manifest` | Adapt | MCP TypeScript pour wallets/tokens/risk, Helius-based. |
| `muratmula/ai-robinhood-chain` | MIT | `README only` | Adapt | OPENCATZ AI pour Robinhood Chain: 264 tests, Discord/Terminal/Telegram command center, `DRY_RUN` execution separation, meme scout GMGN/GoPlus avec seuils `24h volume >= $25k`, `liquidity >= $5k`; scouts LP/NFT/perp hors scope. |
| `stefanoviana/crypto-pump-scanner` | MIT | `README only` | Adapt | Multi-layer confirmation (volume 5x, prix +3%, 3 bougies vertes, RSI 60-85, buy ratio >65%, min $500K), cascade TP, circuit breaker -$50/day; CEX/perps hors scope. |
| `PillCrew/PillCrew` | MIT | `README only` | Study | Desktop AI assistant Solana: live coin checks, trending, portfolio, whale follow, radar, position sizing, meme brain; UX à étudier, pas runtime. |
| `degenfrends/solana-rugchecker` | TypeScript | `README/tree` | Adapt | Rug checker Solana: metadata/top holders/liquidity, `getTokenLargestAccounts`, optional pool file et Helius key; pattern utile pour gatebook, résultats à recouper (faux positifs possibles). |

Clones temporaires supprimés après lecture: `pumpfun-bonkfun-bot`, `fomopulse-robinhood-chain-tape`, `copy`, `zetryn-ai-agent` (clone incomplet, meta README via API), `dynamolabs-solana-mcp` (clone incomplet, meta via API).

### Sources capturées sans lecture complète

Tous les repos et pages des lots ont été indexés dans les tables du rapport. Cette sous-section sert de mémoire de confiance pour le tri:

| Groupe | État | Raison |
|---|---|---|
| GMGN official (`gmgn-skills`, `aitrader`, `memex`, docs agent/callout, blog) | `document/site` + skills | Source d'inspiration majeure, pas de dépendance directe. |
| Vybe Network APIs (top holders/traders/PnL) | `README only` | Patterns API, ownership à vérifier avant branchement. |
| `meme-radar`, `scrape-smart-wallets`, wallet holdings usercases | `README only` | Idées de scraping non fiables; à ne pas embarquer. |
| `robinhood-lp-bot`, `gmgn-terminal-bot`, `wallet-convergence-alert`, `robinhood-chain-mcp` | `unverified`/`README only` | Restrictions, NOASSERTION, LP/UI hors scope. |
| MCP ecosystem sweep (Bitquery, Birdeye, Helius, kukapay, base-mcp, etc.) | `README only` | Sélection de providers, pas de runtime géant. |
| PDFs `2501.00826v3`, `2609.10246`, `2609.05663` | `document/site` | Architecture multi-agent, threat model memecoin, operating-layer importance. |
| ETHGlobal showcases (Meme Sentinels, AgentStrategy, DegenAgent) + hackathon repos | `document/site`/`README only` | Design inspirant, production non prouvée. |
| `zetryn-ai/ai-agent` | `README only` | Décision engine Python reference: graph d'analystes + hard guardrails, bot exécute, framework ne détient pas la clé. |
| `Panniantong/Agent-Reach`, `marc-shade/world-intel-mcp`, last30days | `README only` | Ingestion/social fresh data pour `ct-alpha`. |
| `Agent-Reach` et sources X | `README only` | Collecte de preuves publiques avec expiration. |
| `mcpmarket`/OpenPump, `openpumpio` | `document/site` | Considérer MCP seulement si surface verrouillée par tests. |
| `trustwallet/blockatlas` | `README only` | Pattern API légère multi-chain; pas de profondeur DEX/meme. |
| `docs.coincap.io` | `document/site` | Fallback price/mcap avec MCP; pas de discovery meme DEX. |
| `api.coinpaprika.com` | `README only` | Agrégateur généraliste; fallback léger seulement. |
| `api.dexpaprika.com` | `document/site` | REST + SSE, 35 chains, 30M+ pools; provider secondaire fort à prototyper. |
| `developers.shrimpy.io` | `README only` | Portfolio/CEX aggregator; hors scope. |
| `tiagosiebler/OrderBooks` → `sieblyio/orderbooks` | `README/page` | Pattern orderbook snapshot+delta; vérifié via GitHub meta. |
| `Erfaniaa/financial-indexes-correlation` | `README only` | Corrélation d'indices via Nasdaq Data Link; référence data science. |
| `Erfaniaa/financial-dataset-generator` | `README only` | Features/indicateurs + datasets ML; hors runtime. |
| `Erfaniaa/undervalued-crypto-finder` | `README only` | Filtre MA200/pump-dump; idée de stratégie seulement. |
| `GuntharDeNiro/gunbot-quant` | `README only` | Screener + backtest + heuristiques de marché; à étudier. |
| `wealthfolio/wealthfolio` | `README only` | Portfolio tracker local-first; hors scope. |
| `p.nomics.com` | `site down` | 530 Site frozen; Hard No. |
| `dex.watch` | `site` | Explorateur DEX; sanity-check EVM, pas runtime. |
| `etherscan.io/dextracker` | `site` | DEX tracker Etherscan; EVM reference. |
| `dexindex.io` | `site` | SPA analytics; non fiable sans API. |
| `graphs.santiment.net/dex_trades` | `site` | Graphes Santiment; à étudier via API/MCP. |
| `app.santiment.net` | `site` | 404 sur URL donnée; produit à vérifier séparément. |
| `debank.com/ranking/dex` | `site` | Classement DeBank; contexte liquidité multi-chain. |
| `predictions.exchange/dex` | `site` | Aucune donnée structurée trouvée; skip. |
| `liquidity.vision` | `site` | Dashboard SPA; visualisation, pas API. |
| `theblockcrypto` DEX non-custodial | `site` | Contexte macro, Cloudflare. |
| `orderflow.art` | `site` | MEV/orderflow Ethereum; hors scope meme. |

### Study: reprendre plus tard

| Source | Pourquoi Study | Quand utiliser |
|---|---|---|
| `lunarresearcher/copy` | Excellente décomposition CLI/paper/providers/executor; copie totale trop simple pour notre runtime. | Après P0 live, pour affiner UX copy-rules et paper loop. |
| `zetryn-ai/ai-agent` | Décision engine Python avec gates explicites; comparable à notre RiskEngine mais plus LLM-centré. | Étudier pour garder les gates, ne pas copier le cadeau. |
| `manavaga/web3-signals-mcp` | Fusion de 5 dimensions + calibration de probabilité utile pour `ct-alpha` et sentiment. | Quand le corpus X/Telegram dépasse le simple KOL. |
| `autonsol/sol-mcp` | Risk scoring Solana hébergé; utile comme oracle secondaire de risque. | Si notre RugEngine manque de signaux et que le coût est acceptable. |
| `dynamolabs/solana-mcp` | MCP Solana jetable pour exploration. | En sandbox, pas en production. |
| `world-intel-mcp`, `Agent-Reach`, `last30days` | Ingestion publique pour CT Alpha. | P1/pipeline social. |

### Deltas code-level qui ne changent pas l'architecture

L'architecture cible garde ses sept rôles logiques, quatre appels LLM parallèles maximum, algorithmes décisionnels déterministes, LLM sans accès signer, Postgres + Redis + object store, P0 Solana/RH et P1 Base/BSC. Les points suivants sont confirmés ou renforcés par le code lu:

- Solana: le listener Pump.fun doit copier les comptes d'instruction modernes (`buy_v2`/`sell_v2`) et rafraîchir la courbe/l'état avant tout sell, pas seulement deviner des ATA.
- Solana: le priority fee doit être dynamique, borné, avec fallback; pas de fee statique global.
- RH/Fomo: garder le modèle receipt -> reconstruct -> rebuild, avec rules version, pour éviter que les websockets perdus produisent des holes ou des faux fills.
- Copy-trading: la taille doit être bornée par market cap, liquidité, tax, conviction, positions déjà ouvertes; et l'executor doit être un webhook/queue externe, jamais un chemin wallet-hearted.
- Scraping public (fomp leaderboard) est une béquille: à remplacer par des endpoints officiels ou gateways KOL approuvés pour la production.

## Corpus unique: rabiq, nerve, fly-high

Nouveau lot venu après le sweep final. Levés via GitHub API + README, sans clone local. Niveau de preuve: `README only` sauf indication.

| Source | Licence | Verdict | Ce qu'on garde | Ce qu'on jette |
|---|---|---|---|---|
| `0xmfox/rabiq` | MIT | Borrow / Reference | Deployer memory sur Robinhood Chain Pons V2: dossier token + deployer, `TokenLaunched` logs, diffs type "depuis dernier check" (FDV, liquidity, graduation, fee recipient change), liens same deployer / same fee recipient / same GitHub. Live desk poll toutes les 2s et markdown burrow. Idée à réimplémenter comme memory wallet/deployer, pas copiée en bloc. | LocalStorage browser, limitation Pons V2 seul, pas de compte ni exécution. |
| `h100envy/nerve` | none | Take / Borrow fort | Spine deterministe `Scanner -> reflexes -> Analyst -> reflexes -> Risk -> reflexes -> Executor -> Monitor -> Reporter`. Typed `Impulse` avec historique de transition, short-circuit `REJECT`. Reflexes avant LLM: kill switch, loss, gas, liquidity, slippage, duplicate position, min score. LLM écrit thesis/confidence mais ne choisit pas wallet, ne change pas size, ne signe pas. Fail-closed si données manquantes. Exactly-once broadcast, RPC timeout = unknown. Robinhood Chain 4663. | Pas de licence claire, code Python minimal: on reprend les contrats internes et on réimplémente en TypeScript. |
| `immortalhowwl/fly-high` | MIT | Reference / Skip | Méthodologie backtest/evolution de stratégies sur candles Robinhood 5m: génome stratégie, mutation, survival, champion frozen, holdout chronologique, gaps stricts (pas de candles inventées). Utile comme banc de test stratégie, pas comme runtime. | Pas de wallet/API key/live orders, liquidity assumée pas mesurée; pas de code d'exécution à intégrer. |

Effet sur Memeclaw:

- `nerve` confirme la colonne vertébrale cible: les algorithmes gate et le LLM ne porte pas le risque. À mapper dans `decision-engine.ts` et `RiskManager`.
- `rabiq` devient la base du dossier deployer RH/Fomo: chaque launch, retracer le lanceur, les launches precedents, les fee recipients communs, les liens GitHub.
- `fly-high` reste au rayon recherche: si on veut un futur `strategy-evolution`, on reprend la méthode de split chronologique et mutation, pas le code.

## Corpus unique: solo, blockscout, Dune/Crypto MCP, pumpdotfun, jito, warp, rugchecker, validators

Nouveau lot. Sources GitHub lues via API/README, MCP endpoints testés par HTTP. Niveau de preuve: `README only` sauf `document/site` pour les MCP.

| Source | Licence | Verdict | Ce qu'on garde | Ce qu'on jette |
|---|---|---|---|---|
| `solo-agent/solo` | MIT | Reference / Skip | Workspace local-first de coordination multi-agents: channels, teams, tasks, mémoire longue, artefacts reviewables. Bon modèle pour un futur ops dashboard / task board du swarm. | C'est un workspace d'agents codeurs, pas un trading system; aucune donnée on-chain ou exécution. |
| `blockscout/blockscout` | NOASSERTION (Blockscout licence) | Reference / Skip | Explorer EVM open-source: patterns d'indexation transactions, tokens, holders, contrats, ABI. Utile comme référence pour comprendre data EVM sur Base/BSC/RH. | Héberger un explorer complet est trop lourd pour un bot. Les APIs RPC/providers suffisent. |
| `api.dune.com mcp v1` + docs Dune MCP | remote SaaS | Reference / Borrow | SQL multi-chain, dashboards, backtest et recherche sur données indexées Dune. Déjà référencé ailleurs dans le sweep MCP; valide pour l'analyse historique/backtest, pas pour la latence live. | Pas pour le hot path; rate limits, coûts, SQL non adapté aux cycles meme rapides. |
| `mcp.crypto.com` | unverified | Skip / unverified | Concept MCP exchange centralisé. Utile seulement plus tard si on ajoute un volet CEX data. | Endpoint non confirmé ici (timeout), CEX hors scope prioritaire. |
| `aave/skills` | MIT | Hard No | Pattern skill/MCP propre: lire position, simuler l'action, construire une transaction non signée, vérifier le résultat via état final. La philosophie "simuler puis signer" est inspirante. | C'est du lending/DeFi Yield/Aave, hors scope Memeclaw. Ne pas embarquer. |
| `rckprtr/pumpdotfun-sdk` | MIT | Borrow / Take après audit | SDK TypeScript create/buy/sell sur Pump.fun, Anchor/TS, gestion priority fees et slippage. Candidat sérieux pour l'exécution Solana pump.fun derrière une interface `ExecutionProvider`. | Vérifier la version du program Pump.fun, la custody, la reprise après fail et les edge cases avant live. Pas de branchement sauvage. |
| `jito-labs/jito-ts` | Apache-2.0 | Borrow / Take | SDK TypeScript block-engine, bundles, tips, relayer, geyser. C'est la bonne brique pour envoyer des bundles Solana rapides et protégés des sandwiches. | Complexité protos/geyser; à isoler derrière un exécuteur spécialisé, pas dans le code métier. |
| `warp-id/solana-trading-bot` | MS-PL | Borrow / Reference | Bonne config pratique: snipe list, RPC/WS, filtres pool/mint/liquidity, auto-buy delay, retries, TP/SL, auto-sell, Jito/Warp executors. Utile comme liste de paramètres et edge cases pour Solana buy/sell. | Bot autonome avec hot wallet et exécution agressive. Pas de copie directe; Warp executor pas obligatoire dans Memeclaw. |
| `degenfrends/solana-rugchecker` | none | Borrow / Study | Rug score TypeScript: metadata, top holders, liquidity, Raydium pool file, score booléen rug. Bon pattern à réimplémenter dans notre Gatebook Solana. | Pas de licence claire, dev précoce, résultats faux possibles, dépend RPC à `getTokenLargestAccounts`. Ne pas utiliser en dépendance. |
| `a-guard/malicious-validators` | none | Reference | Recherche data des validateurs Solana qui sandwich: 241 validateurs, 8.5M SOL, méthodo leader slots + tips Jito. Utile pour calibrer le risque d'exécution publique vs bundle Jito. | Dataset ponctuel, pas un service live; ne pas embarquer comme runtime. |

Effet Memeclaw:

- Exécution Solana: `jito-ts` pour bundles/tips + `pumpdotfun-sdk` comme candidate Pump.fun, tous les deux derrière une interface d'exécution testée.
- Gatebook Solana: patterns `rugchecker` réimplémentés, pas copiés; données history Dune pour backtest.
- Validators/sandwich: garder Jito bundles par défaut, éviter RPC public pour les ordres de taille, et inclure un risque "MEV/sandwich" dans le score.
- Lending/Aave et CEX: hors scope, `Hard No` ou `Skip`.

## Corpus unique: RobinBundler, CCXT, FourMeme, solana desks, pump SDK, KOL tools

Nouveau lot. Doublons déjà traités (`PillCrew/PillCrew`, `nirholas/pump-fun-workers`, `uerax/all-in-one-bot`) gardent leur verdict existant; ils sont rappelés ici sans nouvelle table.

| Source | Licence | Verdict | Ce qu'on garde | Ce qu'on jette |
|---|---|---|---|---|
| `sirenconemd/robinhood-trading-toolkit` (RobinBundler) | none | Hard No | Dry-run avant live, gestion locale des wallets, récupération de fees, UX opérateur. | Bundler/volume bots, pas de licence, manipulation de lancement, hors scope éthique. |
| `ccxt/ccxt` | MIT | Reference / Skip | Unification CEX multi-échanges, utile plus tard si on ajoute des données CEX. | CEX hors scope prioritaire; ne pas embarquer pour les DEX meme. |
| `1009682175845693/bsc-fourmeme-bot` | none | Borrow limité / Hard No | Config sniper/copy BSC FourMeme, dry-run, caps, allow/deny lists. | Bundler/volume bot et pas de licence; ne pas copier le code. |
| `wwwwwwworld/solana-trading-bot-v3` | MS-PL | Borrow / Reference | Même famille que `warp-id`: snipe list, filtres, Jito/Warp, TP/SL, retries. | Pas de copie directe, bot hot wallet, exécution agressive. |
| `dartkomnitibe/solana-meme-tool` | none | Borrow / Study | Dashboard opérateur Next.js: launch bundle, snipe, copy, limit orders, risk intel, Jito + Yellowstone gRPC. Architecture de desk très proche de ce qu'on veut pour Solana. | Pas de licence, pas de dépendance directe; garder les patterns et réimplémenter. |
| `build23w/fdv.lol` | MIT | Borrow / Reference | Scoring explainable GOOD/WATCH/SHILL, adaptive RPC backoff, Sentry/Hold/Follow bots, safety checks dust/min-notional/cooldown. | Pas de dépendance client-side; les bots actifs doivent rester derrière nos guards. |
| `nirholas/pump-fun-sdk` | NOASSERTION | Study / Borrow | SDK Pump.fun étendu: token creation, bonding curves, AMM, tiered fees, MCP, Telegram. Étudier les contrats d'outils, ne pas copier sans licence claire. | Pas de licence claire, surface énorme, pas de runtime stable prouvé. |
| `PillCrew/claimchain` | MIT | Borrow / Take | Claim-level groundedness: extraire les chiffres d'un texte agent, les vérifier sur DexScreener, verdict VERIFIED/CONTRADICTED/UNRESOLVED + score 0-100. À réimplémenter en TS pour le pipeline `ct-alpha`. | Ne pas dépendre du binaire Python; on veut un service interne. |
| `slightlyuseless/pons-sniper` | MIT | Borrow / Take | Sniper Pons RH v1/v2: cibles N+1/N+2, vérification snipe-tax exemptions, batching wallets, requote entre batches, sell séquentiel, per-wallet TP/SL. Très pertinent pour l'exécution RH/Fomo. | Attention à la limite 5%/5.5% supply et aux règles Pons; à adapter derrière nos guards. |
| `harutocodes/pumpfun-copytrade` | MIT | Borrow / Reference | Copie des fills réels via logs WebSocket, RPC pool failover, proportional sell, skip migrated curves, random delay. | Code .NET/precompiled, pas de branchement direct; patterns seulement. |
| `nirholas/kol-quest` | NOASSERTION | Borrow / Study | Smart money tracker/KOL leaderboard: GMGN, KolScan, X, Solana + BSC, PostgreSQL, MCP. Architecture ingest + UI + leaderboard utile pour `ct-alpha`. | Pas de licence, hosted offline, pas de dépendance directe. |
| `yllvar/gmgn-TrendingAnalyzer` | none | Borrow | Agrégation multi-timeframe GMGN, group par token, consistency count, seuils volume/mcap, continuité 60s. À réimplémenter en TS. | Python/non maintenu; pas de copie. |
| `nirholas/memescope-monday-directory` | NOASSERTION | Reference / Skip | Community memecoin directory avec DexScreener, safety score A-F, social buzz, watchlists. UX utile pour un futur community dashboard. | Pas runtime bot; features payantes hors scope. |
| `vincentkoc/dexscraper` | GPL-3.0 | Skip / Hard No | Patterns OHLC/OHLCVT et multi-DEX export. | Scraping fragile + GPL; utiliser les APIs officielles DexScreener/GeckoTerminal. |
| `w3laba/DexScreener-Trending` | none | Hard No | Aucun. | Service marketing "pay for trending", pas du code bot. |
| `mortdeus/solana-copy-sniper-mev-trading-bot` | BSD-3-Clause | Hard No | Aucun pour le code. | MEV/sandwich/volume/bundler sketchy, promesses irréalistes, risque légal et réputation. |
| `nirholas/crypto-vision` | NOASSERTION | Reference / Skip | API data massive, adapters multi-sources, cache/circuit breaker, anomalies. Les patterns infra sont intéressants. | Pas de licence claire, surface énorme, pas nécessaire comme dépendance. |
| `marksantiago290/KOLscan-leaderboard-scraping` | MIT | Skip / Hard No | Champs utiles KOLscan (PnL, win rate, wallet, socials). | Scraping Selenium fragile, anti-détection; préférer API ou `kol-quest`. |
| `oratis/influencex` | MIT | Skip / Reference | Plateforme KOL outreach/ROI (YouTube/TikTok/IG). Pas spécifique crypto. | Pas nécessaire pour le bot; utile seulement si on veut un pipeline marketing. |

Effet Memeclaw:

- RH/Fomo execution: `pons-sniper` est le meilleur candidat du lot pour étudier Pons v1/v2; `robinhood-trading-toolkit` est un `Hard No` pour ses bundlers/volume bots.
- Solana: `fdv.lol` apporte le scoring explainable, `claimchain` la vérification des claims LLM, `pump-fun-sdk` et `pumpdotfun-sdk` restent en étude pour l'exécution Pump.fun.
- BSC: `bsc-fourmeme-bot` donne des patterns de config pour FourMeme, mais ses modules bundler/volume sont exclus.
- KOL/CT Alpha: `kol-quest`, `gmgn-TrendingAnalyzer` et `claimchain` alimentent la couche smart money et le contrôle des hallucinations.
- Hard No collectif: bundlers, volume bots, pay-for-trending, MEV/sandwich sketchy et scrapers fragiles.

## Corpus unique: r20 quantum trader, OI monitor, GMGN vs Mobula, Codex networks, Pump.fun Trading-API, Moralis, CoinGecko

Dernier lot reçu. GitHub partiellement accessible (API/README en ce run); les pages docs ont été lues via markdown/curl. Niveau de preuve: `API meta` ou `document/site` plus bas.

| Source | Licence | Verdict | Ce qu'on garde | Ce qu'on jette |
|---|---|---|---|
 | `555cute/r20-quantum-trader` | MIT | Reference / Borrow limité | Bibliothèque complète de patterns LLM-native: terminal Bloomberg style, 6-asset AI brain, self-evolving prompts/strategies, deliberate risk gating, smart-money thématique. Reprendre le moelle de `self-evolve` et des dashboards, pas le système OKX/Cex. | CEX trading (OKX), heavy monolithe, pas Solana/RH/Pump, pas de scaffolding meme. |
 | `0xBennie/binance-smart-money-oi-monitor` | unknown (API timeout) | Reference / Skip / Hard No pour live | Concept de monitoring smart money Binance et OI. Peut servir à comprendre comment afficher les cohortes de smart money et les seuils d'alerte. | OI = derivatives/perp, Binance CEX, hors scope memecoin trading. Ne pas brancher en runtime. |
 | `docs.mobula.io/guides/gmgn-apis` | docs page | Reference / Study | Pages confirment: GMGN APIs ne sont pas publiques et sont limitées à l'écosystème GMGN. Mobula se positionne comme alternative publique multi-chain (Solana, ETH, Base + 50 chains), avec API de paires, historique, vesting, wallet tx. À utiliser en fallback/provider metadata, pas en remplacement de GMGN. | Mobula ne remplace pas les signaux GMGN/rank/trenches/smart money. Ne pas dépendre de Mobula pour le hot path live sans test de latence/coverage. |
 | `docs.codex.io/networks` | docs site | Reference / Study | Codex API couvre Ethereum, Solana, Base, Robinhood (4663), BNB (56), Arbitrum, Polygon, Avalanche, Optimism, MegaETH, Unichain, Linea, Plasma, Monad, Tempo, Sui, Aptos, Starknet, opBNB, Tron, etc. GraphQL cohérent multi-chain. Candidat provider de fallback pour lire les paires, wallets et events multi-chain. | Ne pas tout payer/vendoriser; vérifier rate limits, coverage memecoin et support Robinhood Pons avant d'en dépendre. |
 | `thetateman/Trading-API` | none | Study / Borrow provisoire | 151 stars; "Trade on Pump.fun Programmatically". Si fiches reads arrivent, garder les patterns endpoint d'exécution Pump.fun (place/simulate/reconcile) à mettre derrière `ExecutionProvider`. | Pas de licence claire, README inaccessible ce run, pas de preuve de production. Prendre contrat pattern seulement après audit. |
 | `docs.moralis.com/` | docs site | Reference / Skip | Moralis = API wallet/token multi-chain, utile comme fournisseur EVM secondaire (balances, tx history, token metadata). Déjà couvert par Bitquery/Birdeye/Codex. | Pas nécessaire pour le cœur GMGN; coût, coverage Robinhood à vérifier. |
 | `coingecko.com/learn/best-free-crypto-api` | web article | Reference / Skip | Liste pédagogique des APIs gratuites crypto. Utile pour la sélection de providers, pas du code. | Pas une dépendance; page évolutive, pas de SLA. |

Effet Memeclaw:

- Réponse à la question GMGN: GMGN couvre Solana/ETH/Base et meme wallets/coins mais pas tout; pour BSC/RH/Base, garder GMGN pour les signaux et ajouter Codex/Bitquery/Birdeye/Moralis en fallback pour les données structurées multi-chain.
- Ne pas embarquer `r20` comme dépendance; reprendre l'idée de "brain auto-évolutif" mais avec notre spine déterministe déjà choisie (scouts -> gates -> LLM thesis -> risk -> executor).
- OI monitor Binance = hors scope, tout comme perps/yield/NFT. Verdict `Skip/Hard No` pour le live.

## Corpus unique: indexeurs Solana/EVM, cryo, subgraphs, streaming data

Nouveau lot majoritairement infra data. Lues via GitHub API (description + licence). Niveau de preuve: `API meta`; README pas encore lu en profondeur dans ce run.

| Source | Licence | Verdict | Ce qu'on garde | Ce qu'on jette |
|---|---|---|---|
| `sevenlabs-hq/carbon` | MIT | Borrow / Study | Framework d'indexing Solana (623 stars). Modèle pour indexer nos propres wallets, deployers, trades pump/Raydium et produire des vues de recherche/copy-trade sans dépendre des endpoints GMGN sur tout. | C'est une infra complète; pas un prérequis P0. Ajouter seulement si on construit notre propre memory wallet Solana à grande échelle. |
| `Shradhesh71/YellowStone-gRPC` | none | Reference / Skip | Wrapper Yellowstone gRPC; Yellowstone reste une brique importante pour streamer les blocs Solana (geyser/block-engine), mais ce repo précis est trop brut. | 0 star, pas de licence, pseudo-wrapper. Utiliser Jito-sidecar/Geyser officiel ou un provider géré si besoin. |
| `subsquid/squid-sdk` | Apache-2.0 | Borrow / Study | ETL TypeScript multi-chain (EVM + Solana) via SQD Network. Très bon candidat pour bâtir une warehouse historique de trades, holders et paires sur Base/BSC/Solana pour backtest et analytics. | Pas pour le hot path live; intégration lourde, à considérer après P0/P1. |
| `holaplex/indexer` | AGPL-3.0 | Reference / Skip | Indexeur Solana Geyser plugin en Rust/GraphQL, pattern utile pour comprendre l'ingestion par Geyser. | Licence AGPL et infra lourde; ne pas vendorer. |
| `uxuycom/indexer` | MIT | Reference / Skip | Indexeur "all chain" peu détaillé, 26 stars. Peut servir de survol de sources/briques multi-chain, mais pas de base solide. | Pas de preuves de coverage live, pas de provisions Robinhood/Pons. |
| `paradigmxyz/cryo` | Apache-2.0 | Borrow / Reference | Extraction EVM -> parquet/csv/json/python dataframes. Idéal pour des backtests et datasets historiques (paires, swaps, traces) sur BSC/Base/Ethereum. | Outil offline ETL, pas une dépendance du bot live. |
| `chainbase-labs/manuscript-core` | Apache-2.0 | Study / Reference | Framework streaming données on-chain + off-chain vers stockage cible, orienté agents/AI. Modèle intéressant si on veut un data lake agent-friendly. | Trop gros pour le bot; coûts et infra à éviter tant que le besoin warehouse n'est pas clair. |
| `messari/subgraphs` | MIT | Borrow / Reference | Subgraphs standardisés multi-protocoles, utiles pour interroger les DEX/launchpad EVM (Base/BSC/RH) via The Graph ou un indexeur auto-hébergé. | Ne pas dépendre de subgraphs publics pour le live; utiliser en offline backfill si besoin de métriques types. |
| `enviodev/hyperindex` | none | Study / Reference | Indexeur multichain rapide, utile comme candidat si on veut remplacer les subgraphs par un stack plus simple. | Pas de licence claire; valider avant production. |

Effet Memeclaw:

- P0/P1 du bot: garder les scouts GMGN + RPC existants. Aucun indexeur de ce lot n'est requis maintenant.
- Le besoin "memory wallets/deployers" est mieux servi par un indexeur léger maison (pattern `carbon`/`rabiq`) que par un data platform complet.
- Pour le backtest et l'analytics futur: `cryo` pour EVM, `squid-sdk` ou subgraphs pour les données structurées, `manuscript` seulement si on veut un vrai data lake agent.
- Yellowstone/Gerser reste un sujet `Study`, pas une dépendance directe avant d'avoir un vrai besoin de streams Solana complets.

## Corpus unique: Robinhood CLI, Robinhood sniper, Nansen CLI

Petit lot. Lues via GitHub API (description + licence); raw README non lisible ce run (timeout réseau). Niveau de preuve: `API meta` seulement.

| Source | Licence | Verdict | Ce qu'on garde | Ce qu'on jette |
|---|---|---|---|
| `Thorsten02041973/robinhood-cli` | NOASSERTION | Borrow / Study | CLI Robinhood Chain DeFi (132 stars). Bon modèle pour une CLI de debug/ops: balances, tokens, transactions, interactions chaîne RH sans passer par l'UI. Réimplémenter les commandes utiles derrière nos services, pas copier le binaire. | README non lu ce run; validation après lecture. |
| `Stormeye85/robinhood-token-sniper` | none | Study / Borrow candidat | Sniper token Robinhood (134 stars). Pattern utile: détection de lancement, fenêtre de buy, gestion du slippage, monitoring. À comparer avec `pons-sniper` avant intégration. | Exécution agressive; risque de hooks/taxes et de patterns non audités. Pas de branchement direct sans tests. |
| `nansen-ai/nansen-cli` | MIT | Study / Reference | CLI Nansen (138 stars). Intéressant pour le labeling wallet/smart money si l'API Nansen est dispo: labels, catégories de portefeuilles, flux. Peut alimenter `ct-alpha` avec des labels externes. | README non lu; dépend de l'accès API Nansen. Ne pas bloquer la stack dessus. |

Effet Memeclaw:

- RH/Fomo: rester sur notre candidat actuel `pons-sniper` pour l'étude d'exécution; `robinhood-token-sniper` est secondaire, à auditer avant tout choix.
- CLI/ops: `robinhood-cli` est une source d'inspiration pour un futur `memeclaw-cli` de diagnostic chaîne, pas une dépendance.
- Nansen: garder comme provider de labels optionnel pour `ct-alpha`, pas comme bloc central.

## Corpus unique: AI trading OS, multi-agent finance, DeepEar, arena backtest

Gros lot de frameworks "AI quant / multi-agent". Deux doublons déjà traités: `ryan-yuuu/crypto-trading-arena` (Reference) et `HKUSTDial/DeepEar` (Reference). Les autres entrées ci-dessous sont nouvelles; licences/langages ignorés pour usage personnel.

| Source | Verdict | Ce qu'on garde | Adaptabilité multi-chain Memeclaw |
|---|---|---|---|
| `olaxbt/ai-market-maker` | Borrow / Study | Agentic AI Hedge Fund OS (AIMM). Reprendre l'orchestration multi-agent, la mémoire de décision et le mode OS/process, pas le système complet. | Générik: adaptable à Solana/RH/Base/BSC en branchant nos scouts et notre ExecutionLayer. |
| `dragon1086/prism-insight` | Reference / Study limité | Agentic stock analysis avec MCP et multi-agent. Modèle de pipeline analyse -> thesis -> décision. | Peu adapté tel quel; logique actions/news à remplacer par données meme/KOL. Réservé au design. |
| `flash131307/multi-agent-investment` | Borrow fort | Decision Hub déterministe, 3 agents de recherche spécialisés, pas de LLM dans le chemin critique. Le plus proche de notre spine `scouts -> gates -> thesis -> risk`. | Très portable: aucune dépendance chain; chaque agent doit lire nos données GMGN/meme à la place des news actions. |
| `ryan-yuuu/crypto-trading-arena` | déjà traité | Reference arène/backtest agents. | Déjà dans le corpus. |
| `liangdabiao/autogen-financial-analysis` | Reference / Skip | Pipeline AutoGen: collecte multi-source, analyse, VaR, optimisation, monitoring. | Générique; utile pour le pattern multi-agent AutoGen, pas pour la latence meme live. |
| `ValueCell-ai/valuecell` | Borrow / Study | Plateforme communautaire multi-agent finance (11k stars), crypto + equity + MCP + app agent. Bonne source de patterns d'agents financiers et d'outils MCP. | Multi-marché par design: adaptable en rechargeant providers/mémoire vers nos chains. |
| `AI4Finance-Foundation/FinRobot` | Borrow / Study | Framework financier agent LLM complet: analystes robotisés, plateforme d'agents, outils de marché. Reprendre l'architecture d'outils de recherche, pas le contenu equities. | Portable conceptuellement; les agents de recherche peuvent lire GMGN/Bitquery/Birdeye au lieu des APIs equity. |
| `brokermr810/QuantDinger` | Borrow / Study | API renvoie `OpenByteInc/QuantDinger`: AI Trading OS, backtesting, paper/live, crypto/stocks/forex, MCP. Utile pour un futur lab de stratégies et paper trading. | CEX/backtest oriented; adapter les stratégies à nos events on-chain. Pas de lien avec Pump.fun/Pons out of the box. |
| `ginlix-ai/LangAlpha` | Borrow fort | Claude Code/LangGraph pour marchés financiers, marches d'agents, skills MCP. Bon candidat pour structurer notre swarm et ses skills. | Chain-agnostique: les agents peuvent exécuter des skills GMGN/RH/Base/BSC via MCP. |
| `FinStep-AI/ContestTrade` | Borrow | Système multi-agent avec mécanisme de compétition interne. Idée forte pour faire s'affronter nos stratégies/agent thesis et garder un classement de conviction. | Portable à toutes nos chains; la compétition tourne sur les même feeds. |
| `EthanAlgoX/LLM-TradeBot` | Reference / Study | API pointe vers `EthanAlgoX/AIStock`: agents LLM qui adaptent stratégies en temps réel, exchanges CEX. | Modèle d'adaptation de stratégie, pas d'infra on-chain directe. |
| `danilobatson/ai-trading-agent-gemini` | Borrow / Reference | Sentiment social -> signaux via LunarCrush + Gemini, dashboard Next.js/Supabase, jobs async. Très utile pour `ct-alpha` (social sentiment). | Pas chain-specific; alimenté par du social, pas par des contrats. |
| `ZhuLinsen/daily_stock_analysis` | Reference / Study | Système LLM de dashboard multi-marchés, news, signaux, notifications planifiées. Huge codebase stocks. | Patterns de dashboard/alerting transportables; sources stocks à remplacer par meme social/on-chain. |
| `AmadeusGB/alpha-arena` | Borrow / Study | Plateforme expérimentale pour faire trader des IA en réel et les comparer. | Portable: on peut créer une arena Memeclaw entre agents/gates/stratégies sur Solana/RH/Base/BSC. |
| `HKUSTDial/DeepEar` | déjà traité | Reference research + financial signal tracking. | Déjà dans le corpus. |
| `LuckyOne7777/LLM-Trading-Lab` | Reference / Study | 7.5k stars, expérience ChatGPT pilotant un portefeuille réel. Vulnérabilités, plans, logs de décision, contexte. | Pas de chain; utile comme étude de cas "LLM décide, humain exécute/valide". |

Effet Memeclaw:

- `flash131307/multi-agent-investment` et `FinStep-AI/ContestTrade` sont les deux meilleurs modèles de décision/compétition pour notre swarm.
- `LangAlpha`, `ValueCell` et `FinRobot` apportent des patterns d'orchestration/agents/skills réutilisables.
- Aucun de ces repos ne touche directement Pump.fun/Pons/on-chain meme; adaptation = remplacer les data sources par notre chaîne GMGN + execution gates.

## Corpus unique: moteurs de trading, backtest ML, lookahead-free

Petit lot infra/quant. Licences/langages ignorés; focus utilité pour Memeclaw et portabilité vers nos chains.

| Source | Verdict | Ce qu'on garde | Adaptabilité multi-chain Memeclaw |
|---|---|---|---|
| `nautechsystems/nautilus_trader` | Study / Borrow limité | Moteur de trading production-grade en Rust avec architecture event-driven déterministe, gestion du temps, risk engine, adapters d'exécution. 29k stars. Reprendre les concepts d'event bus/order state machine, pas le moteur entier. | Orienté CEX/backtest traditionnel; concepts portables vers nos exécuteurs Solana/RH/Base/BSC, mais l'implémentation ne touche pas Pump.fun/Pons. |
| `asavinov/intelligent-trading-bot` | Borrow / Reference | Feature engineering ML + génération de signaux crypto. Bon point de départ pour les features déterministes de nos strategists (volume, momentum, social, wallet flows). | Chain-agnostique: on alimente avec nos features on-chain au lieu de candles CEX. |
| `enzoampil/fastquant` | Reference / Study | Backtest ML avec peu de code, stratégies crypto. Utile pour valider rapidement des hypothèses de stratégie avant de les porter dans Memeclaw. | Pas chain-specific; à brancher sur nos données historiques offline. |
| `holdout-labs/lookahead-free` | Borrow / Study | Vérification formelle de l'absence de lookahead/future leakage dans les pipelines de données. Important pour nos backtests et notre architecture de signaux. | Parfaitement portable: à appliquer à tout dataset historique GMGN/Bitquery/DexScreener, indépendamment de la chain. |

Effet Memeclaw:

- Ne pas remplacer notre stack TS par Nautilus; garder l'architecture event-driven comme référence de design.
- `lookahead-free` est un ajout futur pour la boîte à outils de backtest, pas pour le hot path live.
- `intelligent-trading-bot` et `fastquant` alimentent la couche stratégie/backtest, pas l'exécution.

## Corpus unique: freqtrade, frostybot, intelligent-trading-bot, Krypto-trading-bot

Petit lot bots généralistes. `asavinov/intelligent-trading-bot` est déjà traité (`Borrow / Reference`); il est rappelé ici sans nouvelle table.

| Source | Verdict | Ce qu'on garde | Adaptabilité multi-chain Memeclaw |
|---|---|---|---|
| `freqtrade/freqtrade` | Reference / Borrow de design | Le bot crypto open-source le plus connu (54k stars): lifecycle stratégie, backtesting, hyperopt, risk/dry-run, Telegram, notifications, freqtrade MCP. Reprendre les concepts de strategie/broker/risk manager et le contrôle dry-run. | Orienté CEX/data de marché classique; les concepts sont portables, pas les exchanges. Nos exécuteurs restent Pump.fun/Pons/RH/Base/BSC. |
| `JulienPlanchetCoineo/frostybot-js` | Reference / Skip | API pointe vers `TheGigaQuant/frostybot-js`: transforme des webhooks en ordres exchange. Pattern proche de notre endpoint `/api/callout/gmgn` -> execution queue. | CEX unique et très léger; utile comme exemple de contrat webhook simple, pas comme brique. |
| `asavinov/intelligent-trading-bot` | déjà traité | Borrow / Reference. | Court. |
| `ctubio/Krypto-trading-bot` | Reference / Skip | Bot C++ HFT market-making multi-exchange, 3.7k stars. À regarder pour les idées de fix/risk/exchange infrastructure, mais le cœur market-making CEX est loin de notre DEX meme. | Pas portable aux événements Pump.fun/Pons; trop dépendant des APIs exchange/order book. |

Effet Memeclaw:

- `freqtrade` est surtout une référence pour le backtest/dry-run/risk, pas pour l'exécution on-chain.
- `frostybot-js` montre un contrat webhook minimal; le notre est déjà aligné avec GMGN callout.
- `Krypto-trading-bot` reste un cas de référence infra, pas un candidat d'exécution.

## Corpus unique: blockatlas, CoinCap, CoinPaprika, DexPaprika, Shrimpy

Lot final de fournisseurs de données / exploration cross-chain. Règle Memeclaw inchangée: les licences et les langages ne bloquent pas; on évalue surtout la capacité à donner des données DEX/meme structurées pour Solana/Pump.fun, Robinhood/Fomo, Base et BSC, ou des patterns réutilisables pour notre couche infra.

| Source | Verdict | Ce qu'on garde | Adaptabilité multi-chain Memeclaw |
|---|---|---|---|
| `trustwallet/blockatlas` | Reference / Skip | API cross-chain légère (transactions, tokens, explorer) pour comprendre un pattern d'adaptateur multi-chain simple. Utile seulement si on construit un petit explorateur de debug/ops pour vérifier les wallets après exécution. | Portable (design), mais pas de profondeur DEX/meme; pas une brique nécessaire. |
| `docs.coincap.io/` | Reference / Skip | API market data (price, mcap, exchanges) avec endpoint MCP et paiement x402 par abonnement prépayé en USDC sur Base. Intéressant pour un fallback de prix marché, pas pour le discovery Pump.fun/Pons. | Chain-agnostique, mais surtout CEX/marketcap, pas les pools meme DEX. |
| `api.coinpaprika.com/` | Reference / Skip | Agrégateur de market data crypto généraliste; bon pour compléter des métadonnées/market cap, faible pour les nouveaux memecoins on-chain. | Chain-agnostique; à utiliser en fallback léger, jamais comme source principale. |
| `api.dexpaprika.com/` | Borrow / Study (provider secondaire) | REST + SSE sur 35 chains, 30M+ pools, 27M+ tokens, OHLCV, swaps/pools, pas de clé API. Fort candidat comme fallback cross-chain à côté de Bitquery/Birdeye/DexScreener, notamment pour Base/BSC et éventuellement Solana. | Très portable; à valider par un spike sur la couverture Pump.fun/Pons/Robinhood et la latence SSE avant de l'intégrer. |
| `developers.shrimpy.io/` | Reference / Skip | Agregateur portfolio/CEX et gestion de portefeuille, historique market data. Pas orienté discovery de memecoins DEX. | Chain-agnostique mais hors scope pour le bot de trading meme. |

Effet Memeclaw:

- `DexPaprika` est le seul vrai ajout utile de ce lot: à mettre dans la shortlist des providers DEX fallback et à prototyper dans `gmgn-adapter`.
- `CoinCap` et `CoinPaprika` servent uniquement de prix/market cap de secours pour le control room et le backtest, pas pour le hot path.
- `blockatlas` reste une référence d'architecture si on veut un adaptateur wallet/explorer unifié plus tard.
- `Shrimpy` est hors scope.

## Corpus unique: OrderBooks, datasets financiers, Gunbot-Quant, Wealthfolio, Nomics

Nouveau lot de recherche. `tiagosiebler/OrderBooks` pointe vers le dépôt canonique `sieblyio/orderbooks` (`Simple utility classes to handle orderbook snapshot & delta events in node.js, with examples for Bybit & Binance`). Nomics est `Hard No` car le site est gelé (`530 - Site is frozen`), pas une source fiable.

| Source | Verdict | Ce qu'on garde | Adaptabilité multi-chain Memeclaw |
|---|---|---|---|
| `tiagosiebler/OrderBooks` → `sieblyio/orderbooks` | Borrow / Reference | Utilities Node pour reconstruire un orderbook à partir de snapshots + deltas. Utile si on veut un tape/orderbook local pour Robinhood/Fomo ou pour explorer une profondeur CLOB; exemples Bybit/Binance donnent le pattern. | Le pattern est portable à toute venue avec websocket book (RH/Fomo potentiellement); pas pertinent pour Pump.fun/Pons qui sont des événements de pool, pas un orderbook classique. |
| `Erfaniaa/financial-indexes-correlation` | Reference / Study | Matrice de corrélation simple entre indices financiers via Nasdaq Data Link. Idée de niveau pour du contexte macro/rotation des secteurs, pas une brique de trading. | Chain-agnostique; à brancher plus tard dans le contexte macro de `ct-alpha` ou des strategists. |
| `Erfaniaa/financial-dataset-generator` | Reference / Study | Générateur de datasets ML avec indicateurs configurables, train/test split. Bon point de départ pour préparer des features off-line et éviter l'overfit dans nos backtests. | Chain-agnostique; nos features on-chain remplacent les données Nasdaq. |
| `Erfaniaa/undervalued-crypto-finder` | Reference / Skip | Screener très simple basé sur prix < MA200 + listes de coins pump/dump sur 24h. Idée de filtre de rotation relative, mais trop grossier pour le hot path meme. | Chain-agnostique; peut devenir un filtre `relative trend` dans les règles déterministes si on veut, mais pas une dépendance. |
| `GuntharDeNiro/gunbot-quant` | Borrow / Study | Toolkit Python FastAPI: screener de marchés avec heuristiques de caractère (RSI, ADX, vol, volume concentration), moteur de backtest multi-stratégies, UI React locale. Beau modèle pour notre couche `screening` et pour formaliser des profils de stratégie (`mean reversion`, `trend`, etc). | Orienté CEX/stock mais les filtres sont réutilisables sur nos pools DEX: liquidité, vol, concentration de volume, RSI/ADX. À porter sur nos événements Pump.fun/Pons/Robinhood/Base/BSC. |
| `wealthfolio/wealthfolio` | Reference / Skip | Portfolio tracker local-first avec net worth, holdings, PnL et simulations. Intéressant pour le modèle de données de performance/positions, pas pour le trading. | Chain-agnostique mais hors scope; notre Postgres positions/PnL suffit. |
| `p.nomics.com` Nomics | Hard No / Skip | API market data fermée/gelée. On ne construit rien dessus. | Aucune. |

Effet Memeclaw:

- `gunbot-quant` est le plus utile: son approche screener + backtest + heuristiques de caractère correspond à la manière dont on veut formaliser les profils de stratégie Memeclaw.
- `OrderBooks` reste pour l'étape Robinhood/Fomo si on veut un vrai tape local au lieu de dépendre du feed filtré.
- Les repos Erfaniaa sont des références de data science, pas des briques runtime.
- `wealthfolio` ne rentre pas; Nomics est mort.

## Corpus unique: DEX analytics, Etherscan, Santiment, DeBank, The Block, Orderflow

Lot de sites/explorateurs DEX. Beaucoup sont des dashboards SPA ou des portals analytics, pas des APIs stables. On les trie comme sources de contexte et de sanity-check, pas comme dépendances runtime, sauf Santiment qui peut servir de provider de métriques on-chain.

| Source | Verdict | Ce qu'on garde | Adaptabilité multi-chain Memeclaw |
|---|---|---|---|
| `dex.watch` | Reference / Skip | Explorateur DEX Ethereum avec tokens, pools, trades; utile pour sanity-check de paires EVM (Base/BSC) mais pas pour Pump.fun/Pons/RH. | Plutôt Ethereum/EVM; vérifier la couverture Base/BSC avant tout usage. |
| `etherscan.io/dextracker` | Reference / Skip | Page Etherscan de tracking DEX (top DEX, flows de tokens). Bon pour visualiser les flux ERC-20 sur EVM, pas pour notre hot path. | EVM only; Base/BSC oui, Solana/RH non. |
| `dexindex.io` | Reference / Skip | SPA analytics peu lisible sans exploration JS; probablement un tableau de bord DEX, non fiable comme API. | À ignorer tant que pas d'API documentée. |
| `graphs.santiment.net/dex_trades` | Borrow / Reference | Graphes Santiment sur les trades DEX: volumétrie on-chain, signaux sociaux, métriques de réseau. Le bon usage est de nourrir les strategists et les backtests avec du contexte DEX/altcoin. | Multi-chain partiel; Santiment couvre plusieurs chaînes/venue. À passer par leur API/MCP plutôt que scraper le graph SPA. |
| `app.santiment.net/assets/list?name=decentralized%20exchanges` | Skip | URL de portfolio renvoie 404. L'accès produit passe par app.santiment.net exact propre, pas par l'ancien chemin. | Aucune dépendance. |
| `debank.com/ranking/dex` | Reference / Skip | Classement DeBank des protocoles DEX (TVL/protocoles). Utile pour surveiller où la liquidité se concentre sur Base/BSC, pas pour exécuter. | Multi-chain; à lire manuellement ou via API DeBank si besoin, pas essentiel. |
| `predictions.exchange/dex` | Reference / Skip | Page/explorateur DEX peu fiable; rien de structuré trouvé. | Aucune intégration. |
| `liquidity.vision` | Reference / Skip | Dashboard SPA sur la liquidité on-chain. Peut être utile pour visualiser les pools EVM, mais pas stable à scraper. | EVM; à ignorer comme API. |
| `theblockcrypto.com/data/open-finance/dex-non-custodial` | Reference / Skip | Recherche The Block sur le volume DEX non-custodial; contexte macro, protégé par Cloudflare. | Données macro, pas runtime. |
| `orderflow.art` | Reference / Skip | Visualise l'ordre de flux MEV Ethereum (`Illuminating Ethereum's order flow landscape`). Hors scope meme, mais idée de visualisation du flux des builders/MEV si on veut un journal de guerre plus tard. | Ethereum/MEV only, pas de lien direct avec les scouts meme. |

Effet Memeclaw:

- Ces sites sont des sources de contexte, pas des providers `Take`/`Borrow` sauf Santiment à étudier via son API/MCP.
- Pour les scouts EVM (`meme-base`, `meme-bsc`) on reste sur DexScreener, DEX Paprika, GMGN et Bitquery; les dashboards en ligne ne rentrent pas dans le runtime.
- `orderflow.art` et `liquidity.vision` montrent comment visualiser les flux, mais ne sont pas des dépendances.

## Corpus unique: CROWBRAIN, FLETCH, GARCHMethod, MiroFish

Quatrième lot court, étudié au niveau README + fichiers clés. Verdicts `Take` à `Hard No`, avec adaptation multi-chain quand utile.

| Ressource | Licence | Verdict | Ce que j'en tire | Adaptabilité multi-chain |
|---|---|---|---|---|
| `sopersone/CROWBRAIN` | none | Reference / Skip | Terminal local d'observation read-only: `app.py` + `crow/engine.py` + `crow/providers.py`, polling DexScreener 30s, strict pair/chain matching, reset d'historique si gap feed > 90s, journal SQLite `signals`, signaux MA5/MA20, mode showcase sans réseau, aucune exécution. On a déjà `DecisionMemory`, `state-store`, scouts et API; intéressant seulement pour le pattern « mode showcase/live + journal séparé ». | Oui, adapter le matching pair/chain DexScreener à Solana, Robinhood, Base, BSC; le moteur MA5/20 est trivial. |
| `rimtoln/fletch` | MIT | Borrow / Study | Live pump.fun hunt tape via GeckoTerminal (`pump-fun`, `pumpswap`). `src/score.js`: 8 facteurs pondérés (tape 18, book 16, flow 14, impulse 10, crowd 10, fresh 12, structure 12, xray 8), `clamp`, `logScore`, pénalités `thin book`, bandes SING/HUM/MUTE. `src/market.js`: normalisation GeckoTerminal -> row interne. `src/paper.js`: paper desk localStorage avec proposal/accept/skip, position, stop 0.92. Très bon pour notre module de scoring et notre mode paper. | Non-chain-specific: si on normalise les pools Pump.fun/Pons/Four.meme/Base en row homogène, le score FLETCH marche partout. À recalibrer les poids et seuils pour RH/BSC/Base. |
| `milesdeutscher/garchmethod` | MIT | Borrow / Take pattern | Skill Claude Code GARCH(1,1): vol forecast walk-forward sans lookahead, `size = target_vol / forecast_vol` plafonné `[0.25x, 2.0x]`, régime `calm/normal/storm`, `compare.py` test honnête fixed vs vol-targeted. Régie parfaite pour notre `risk-engine` / position sizing: l'IA décide « quoi », GARCH décide « combien ». | Oui: il suffit de lui donner l'OHLCV close de notre price feed par chaîne/token. À brancher comme risque quantitatif avant l'orchestrateur, pas dans le prompt LLM. |
| `nikmcfly/MiroFish-Offline` | AGPL-3.0 | Reference / Skip | Fork local d'un moteur multi-agent qui simule opinion publique/sentiment marché avec centaines de personas, mémoire graphe Neo4j et LLM local Ollama. Concept utile pour stress-test narratives ou simuler la réaction du CT aux narratives dans `ct-alpha`, mais lourd et AGPL; ne pas vendorer. | Concept, pas code. Si on veut simuler, mieux écrire une petite simulation SLIM dans notre propre service plutôt que fork AGPL. |

Résumé du batch:

- `FLETCH` = le plus utile, surtout `score.js` et le paper desk.
- `GARCHMethod` = très utile pour le position sizing / risk throttle.
- `CROWBRAIN` = optionnel, référence d'un loop d'observation local / journal.
- `MiroFish-Offline` = intéressant conceptuellement mais skip en runtime.

## Corpus unique: million, Maverick, FereAI, AnoMeme, solana-meme-tool forks, copy-trading basse latence, MemeNet

Lot nouveau, jugé au niveau README + fichiers clés + licences. `alexskin/memeoy` et `dartkomnitibe/solana-meme-tool` étaient déjà dans le corpus: verdicts conservés (`memeoy` = Reference paper-first, `dartkomnitibe` = Borrow / Study).

| Ressource | Licence | Verdict | Ce que j'en tire | Adaptabilité multi-chain |
|---|---|---|---|---|
| `Kelows/million` | MIT | Borrow / Study | Dashboard self-hosted Solana de whale tracker + copy deck piloté par agent IA. Démarre en mode paper, Helius websocket sans webhook puis webhook pour >25 wallets, filtrage bots/rugs, flux smart money, deck positions/PnL. Pattern très proche de notre wallet intelligence + paper-first. | Solana d'abord; le deck/roster et la logique de follow peuvent être portés RH/Base/BSC via nos adapters wallet et GMGN. |
| `Im-Madhur-Gupta/maverick` | MIT | Reference / Borrow personas | Plateforme Next.js/NestJS pour créer des agents memecoin: personas `MOON_CHASER`, `MEME_LORD`, `WHALE_WATCHER`, JWT Solana Ed25519, signals générés de Farcaster, agents déployés Solana via FereAI `0xDisciple`. Les personas et la séparation agent/API miment déjà ce qu'on dessine dans le swarm; prendre les concepts, pas la plateforme. | Personas non-chain-specific; à recaler sur nos sources: GMGN smart money, FOMO, SX social, CT alpha. |
| `docs.fereai.xyz/` | docs | Reference | Docs du serveur/agents FereAI. Utile comme comparateur d'architecture agent autonome et de ce qu'un « disciphe agent » peut déléguer. Ne pas dépendre d'un service externe pour le coeur de Memeclaw. | Concept. |
| `maverick-backend.onrender.com/api` | API live | Reference / Skip | API démonstratrice du backend Maverick (Fortune OpenAI/ou équivalent rendu), pas un service stable. Ne pas bâtir sur une API onrender de démo. | Non. |
| `WebRaizo30/AnoMeme` | MIT | Reference / Skip | Plateforme intent-based trading avec social signals, MEV protection, risk/rug detection, cross-chain; stack Next.js + Phoenix/Elixir + Postgres. Concept d'« intents » = règles de trading exécutées automatiquement. Intéressant comme vocabulaire produit, mais Anoma n'est pas une de nos chains et l'implémentation semble orientée plateforme, pas bot local. | L'idée d'intent/rules peut être portée par notre `StrategyTemplate` / `token-gatebook`; pas de code. |
| `soladdev/solana-meme-tool` | none | Reference / Borrow partiel | Dashboard Next.js très proche de `dartkomnitibe`: launch bundle, bundle-buy 15 wallets, sniper Jito, copy trade, limit orders, token control, volume boost, wallet risk intelligence. On prend les patterns de desk/sniping/copy; pas le volume-boost/wash qui reste frauduleux et hors scope. | Similaraire à dartkomnitibe; Solana d'abord. |
| `moazamdotdev/Trading-platform-frontend` | none | Reference / Skip | Frontend azal pour swaps memecoin Solana: Next.js, wallet adapter, PnL, whale watch, alerts. Pas de backend ni de intelligence; utile seulement pour style UI deck si on veut une carte opérateur. | Frontend only, pas critique. |
| `ricoboost/meme-coin-trading-bot` | Apache-2.0 | Borrow / Study post-mortem | Solana wallet-cluster copy bot: stream Yellowstone gRPC, pool de wallets intéressants, détection de cluster buys dans une fenêtre, paper/live. Grosse leçon: l'auteur a perdu de l'argent en live, code énorme pas refactorisé (~5500 lignes `trade_executor_live.py`, ~4000 lignes `runner.py`), post-mortem public. À étudier pour le « why it didn't work live » et le pattern cluster detection; ne pas copier l'exécution. | Cluster detection portable RH/Base/BSC si on normalise les buys wallets sur toutes les chains. |
| `ironclad-protocol/solana-copy-trading-bot` | MIT | Borrow / Take pattern | TS copy-trading ultra-rapide: `transactionSubscribe` Helius/Geyser pour observer un wallet leader, multi-engine de landing `jito.ts`, `nextblock.ts`, `helius-sender.ts`, `astralane.ts`, `zeroslot.ts`, `dispatch.ts`, `tips.ts`. Exactement le genre de couche d'exécution Solana qu'on veut derrière `SolanaTradeAdapter`: observation wallet stream + soumission Jito/private. | Solana uniquement; le pattern `tx-submitter` peut être répliqué en interface générique pour RH si relay public/private existe. |
| `sergafon/solana-copy-trading` | MIT | Reference / Study | Bot Rust copy-trading Pump.fun haute perf: parser Geyser 500-700k tx/s, latence 2-5ms, slot 0-1, simulation mode, landing via 0slot. Référence pour ce qui est possible en latence; notre stack TS ne vise pas ça en mode LLM, mais on peut rester TS et déléguer la soumission Jito/private aux mêmes services. | Solana uniquement, performance d'abord. |
| `ejfxgit2025/memenet` | none | Reference / Borrow social | Couche « social intelligence » pour memecoins: tokens comme entités sociales, feed communautaire, signal engine AI, détection whale/volume/narrative, Supabase + OpenRouter + Firecrawl + CoinGecko/DexScreener. Utile comme inspiration pour notre `ct-alpha`/narrative layer. | Concept multi-chain: normaliser token + social mentions + market stats. |

Résumé du batch:

- `ironclad-protocol/solana-copy-trading-bot` = le plus utile pour la latence d'exécution Solana (multi submitter + tips).
- `Kelows/million` = très bon pattern dashboard/whale/paper-first.
- `ricoboost/meme-coin-trading-bot` = lire le post-mortem avant de copier le cluster detection.
- `sergafon/solana-copy-trading` = benchmark technique Rust, pas une dépendance.
- `AnoMeme`, `Maverick`, `FereAI`, `MemeNet` = concepts/references pour personas, intents, social.
- `soladdev/solana-meme-tool` = desk utile seulement sans le module volume-boost.

## Corpus unique: TrenchTools, trenchkit (2 forks), ChainPlusTrader, dbot MCP, Smart Money Tracker, whale trackers

Deux projets portent le même nom `trenchkit` mais sont différents: `LW-ARTS/trenchkit` est un scanner GMGN TypeScript, `crownobyl/trenchkit` est un générateur SQL Flipside Python pour découvrir des wallets rentables.

Relecture code-level 2026-09-17 via GitHub API + raw (aucun clone pour respecter la side-conversation): signatures, tree et fichiers clés vérifiés à distance.

| Ressource | Licence | Verdict | Ce que j'en tire | Adaptabilité multi-chain |
|---|---|---|---|---|
| `natebag/TrenchTools` | none | Reference / Study | Open-source style Proxima pour Solana. Code vérifié: `packages/core/src/detection/analyzer.ts` + `patterns/clustering.ts` (cluster >=3, interval CV threshold `0.5`, coordinated window `5s`, uniform distribution `0.3`), `packages/bot/src/lib/vault.ts` (vault JSON chiffré + `decryptWallets`, keypair lookup). On prend le pattern de détection de manipulation + vault multi-wallets sécurisée, pas le market-making/manipulation. | Solana first; scoring manipulation portable si on normalise funding/clusters sur nos chains. |
| `LW-ARTS/trenchkit` | MIT | Take / Borrow | TypeScript + GMGN OpenAPI, exactement le même socle que notre `gmgn-adapter`. Code vérifié: `src/modules/smart-money.ts` normalise `maker`/`amount_usd`/`is_open_or_close`, fenêtre convergence 15min, max 50 trades récents, `VERY_STRONG` si >=1 KOL + >=2 SM + full open; `src/engine/filters.ts` hard filters `rugRatio>0.5`, `botDegenRate>0.45`, wash trading, holder<100, age 180-21600s, liq<5000 (exempt bonding curve); `src/engine/scorers/index.ts` weights security 0.2 / holder 0.25 / liq 0.15 / dev 0.15 / smart-money 0.15 / bot-manip 0.1 et cap 80 si données partielles. Très bon pour notre scoring déterministe + convergence smart money. | Non-chain-specific à partir du moment où le client GMGN couvre les chains; le fichier `CHAINS` prévoit déjà `sol`, `bsc`, `base`. |
| `crownobyl/trenchkit` | none | Borrow / Study | Python + Jinja2 + Flipside MCP. Code vérifié: `sql/core/orchestrator.py` (découverte dynamique de générateurs), `sql/sol.py` (entrypoint CLI), `sql/generators/sol/alpha_traders.py` + `.sql.j2` (rendu template jours 7/30, `min_avg_buy`, lien GMGN address). Pattern à garder: générateur SQL par chain pour discovery wallets rentables, puis CSV en sortie. | Solana, Ethereum, BSC, Base; exactement nos chains EVM + Solana. |
| `AI-PIN/ChainPlusTrader` | GPL-3.0 | Reference / Skip | Plateforme cross-chain DeFi avec bots indépendants par réseau (ETH/Base/BNB/Sol), Uniswap V2/V3, PancakeSwap, Jupiter, scheduling 1min-1h, price feed CoinGecko, safety (gas ratio, slippage, retry), WebSocket dashboard. On a déjà des adapters Solana/EVM; c'est une plateforme générique, pas un apport critique. | Multi-chain mais générique; pas un socle. |
| `dbotx/dbot-mcp-servers` | MIT | Reference / Study | Suite MCP DEX. Code vérifié: monorepo avec `fast-swap-mcp-server`, `limit-order-mcp-server`, `copy-trading-mcp-server`, `conditional-order-mcp-server`; chaque package suit `src/client.ts`, `src/index.ts`, `src/types.ts`, env `DBOT_API_KEY` + wallet ids par chain. Fast-swap couvre Solana/ETH/Base/BSC/Tron, TP/SL tasks. Utile comme inventaire de contrats d'outils MCP pour notre future interface, pas comme dépendance runtime. | Multi-chain; l'API dbot est un service tiers avec clé, à garder optionnel. |
| `ArgosSystems/Smart-Money-Tracker` | MIT | Borrow / Study | Moteur multi-chain whale/smart money. Code vérifié: `api/services/whale_tracker.py` définit `BaseChainScanner` + `EvmChainScanner` + `MultiChainTracker` (un task asyncio par chain); `api/services/solana_scanner.py` utilise `getSignaturesForAddress` par wallet + `getTransaction`, diff `preTokenBalances`/`postTokenBalances`, fallback rate-limit; `api/routers/whales.py` expose `POST /api/v1/wallets/track`, `GET /api/v1/tokens/trending`, etc. Portfolio TimescaleDB, alerts Discord/Telegram/WebSocket. Fort parallèle avec notre couche wallet intelligence. | EVM + Solana; utile pour les labels, clustering, funding history et l'API dashboard. |
| `jamsturg/crypto-whale-tracker` | MIT (README) | Reference / Skip | Python whale tracker, multi-chain ETH/BSC/Polygon d'après README: transaction monitoring, whale detection, analytics REST API. Structure moins profonde que Argos/notre tracker; pas d'apport critique. | EVM seulement; Solana absent. |

Résumé du batch:

- `LW-ARTS/trenchkit` = le plus proche d'une base « GMGN scorer » réutilisable; c'est le vrai `Take/Borrow`.
- `crownobyl/trenchkit` = bon pattern pour la découverte de wallets via Flipside SQL.
- `ArgosSystems/Smart-Money-Tracker` = bonne référence wallet/whale multi-chain.
- `TrenchTools` = étude selective (détection manipulation + vault wallets), pas le market-making.
- `dbot MCP` = utile pour voir quels outils MCP DEX existent, pas comme dépendance.
- `ChainPlusTrader` et `jamsturg/crypto-whale-tracker` = référence/optionnel.

## Matrice claims GMGN vs architecture Memeclaw (2026-09-17)

Évaluation des claims GMGN fournis par l'utilisateur, confrontés au code réel de Memeclaw et aux sections d'architecture du rapport. Verdict global: GMGN est déjà notre hub d'intel principal, mais il ne doit pas devenir l'unique oracle de risque ni l'executor de confiance.

| Claim GMGN | Déjà en place | Prévu / partiel | À ajouter |
|---|---|---|---|
| Discovery / nouveaux launches multi-chain | Adapter GMGN avec rank, trenches, token_signal, hot searches; scouts `meme-solana`, `meme-robinhood`, `meme-base`, `meme-bsc`, `meme-eth`, `ct-alpha`; callout `POST /api/callout/gmgn`; event envelope + source-health. | Listeners raw Robinhood/Fomo, Pons, Four.meme et Pump.fun partiels ou roadmap. | Listeners launchpad dédiés en plus de GMGN; comparateur de latence GMGN vs raw; normalisation earliest detection avec DexScreener. |
| Token analysis / fondamentaux | GMGN token info normalisé, token-gatebook, audit service, GoPlus, indicateurs techniques, price feed, market regime. | Cross-check providers, holder analysis plus fin. | Agrégateur token profile multi-source (GMGN + Bitquery + DexScreener + DexPaprika); holder concentration et bonding curve calculées côté bot. |
| Risk / security | `risk-manager`, `risk-engine-v2`, `exit-manager`, `token-gatebook`, `security-service`, GoPlus, MEV guard, decision memory. | Red Team Veto dans l'architecture swarm. | Composite risk score indépendant de GMGN; conflit de scores = blocage; kill switch par chaîne/venue/executor; replay des décisions risquées. |
| Smart money / wallet intelligence | `wallet-cohort-tracker`, `smart-money-wallet-scorer`, `fomo-wallet-resolver`, `wallet-tracker`, `GET /api/cohort`, GMGN smart money/KOL en input. | GMGN copy-trade non utilisé comme executor; règles copy en roadmap. | Copier les buys smart money vers notre pipeline avec règles de taille; mapping KOL -> wallets multi-chain plus robuste. |
| Execution | `ExecutionPipeline`, `SolanaTradeAdapter` (Jupiter), `EVMTradeAdapter` (Relay/Uniswap), MEV guard, `OrderIntent`, `RiskDecision`, `ExitManager`; DRY_RUN par défaut. | Live broadcast à activer proprement par chaîne; P2 canary. | Executor Robinhood/Fomo complet; routers BSC/4.meme et Base; exécution toujours hors GMGN, jamais GMGN seul chemin de broadcast. |
| Portfolio / positions | `position-manager`, `trade-journal-service`, `state-store`, `decision-memory`, `position-scanner`. | Reconciliation GMGN read-only. | Sync read-only GMGN portfolio comme cross-check; source de vérité reste Postgres local. |
| Social / sentiment | `ct-alpha`, `twitter-service`. | Agent-Reach / world-intel / last30days / FOMO social. | Ingestion X/Telegram/Reddit normalisée; score narrative/mindshare; preuves publiques avec expiration. |
| Deep on-chain / historique | RPC failover, price feed, event envelope, décision memory. | Bitquery, Helius, carbon, squid-sdk, cryo, subgraphs, manuscript en Study. | Store historique trades/holders/pools multi-chain; dataset backtest sans lookahead; replay engine pour Postmortem Smith. |

Conséquence architecture:

- GMGN reste le hub d'intel market et de callouts, jamais le juge du risque.
- Les vrais trous à combler avant live: raw listeners launchpad, tape RH/Fomo, composite risk, exécution live multi-chain, social/narrative, historique/backtest.
- Ne pas construire de dépendance sur GMGN copy-trade ni sur GMGN comme seul provider de token fundamentals.

### Mémoire du corpus

La mémoire persistante du corpus est ce fichier lui-même:

- Tables `Corpus unique` = inventaire par lot/source.
- `Registre final exhaustif des décisions` = verdict par source (`Take` à `Hard No`).
- `Architecture end-to-end` + `Swarm` = design cible et rôles LLM.
- `Final source audit` = preuves au niveau code et index de confiance.
- `Matrice claims GMGN vs architecture Memeclaw` = mapping claim -> déjà en place / prévu / à ajouter.
- Lot court `CROWBRAIN/FLETCH/GARCH/MiroFish` = section dédiée dans le Corpus + URLs dans la liste dédupliquée.
- Lot `million/Maverick/FereAI/AnoMeme/solana-meme-tool/copy-trading/MemeNet` = verdicts détaillés + URLs dans la liste dédupliquée.
- Lot `TrenchTools/trenchkit/ChainPlusTrader/dbot/Smart-Money-Tracker/whale trackers` = verdicts détaillés + URLs dans la liste dédupliquée.
- Relecture 2026-09-17: GitHub API + raw seulement (aucun clone), fichiers clés cités dans les lignes du corpus pour TrenchTools, trenchkit x2, dbot MCP et Argos.

Le prochain artifact à créer est l'implémentation `gmgn-adapter`: adapter Solana, RH/Fomo, Base, BSC, normalize receipts, calculer les facteurs déterministes, et exposer des endpoints de paper/risk au swarm sans aucun pouvoir de broadcast.

### Liste de sources dédupliquée (tous lots)

Liste brute, normalisée (`github.com/...` -> `https://github.com/...`), sans doublons exacts:

```text
https://github.com/zostaff/ai-quant-researcher
https://github.com/cvxv666/fomo-robinhood-radar
https://github.com/itsnex1s/fomopulse-robinhood-chain-tape
https://github.com/chainstacklabs/fomo-solana-rh-listeners
https://github.com/TauricResearch/TradingAgents
https://github.com/kocer6/MEERKAT
https://github.com/semkazz1/FlySwarm
https://github.com/The-Swarm-Corporation/AutoHedge
https://github.com/HKUDS/Vibe-Trading
https://github.com/zostaff/agent-arena
https://github.com/pgen0x/azimuth
https://github.com/andreysuperiorgit/aegis
https://github.com/akanz/onchain-trading-bot
https://github.com/lunarresearcher/copy
https://github.com/Fincept-Corporation/FinceptTerminal
https://github.com/LLMQuant/awesome-trading-agents#mcps-tradingagents-mcpmode
https://github.com/LLMQuant/awesome-trading-agents
https://github.com/muratmula/ai-robinhood-chain
https://github.com/mnemox-ai/tradememory-protocol
https://github.com/GMGNAI/gmgn-skills
https://github.com/GMGNAI/skillmarket-demos
https://github.com/BlockRunAI/awesome-finance-mcp
https://github.com/Drakkar-Software/OctoBot
https://github.com/edtechre/pybroker
https://github.com/PillCrew/PillCrew
https://github.com/nirholas/pump-fun-workers
https://github.com/buddies2705/awesome-memecoin-trading
https://github.com/nhovongoc0-max/meme-radar
https://github.com/chainstacklabs/pumpfun-bonkfun-bot
https://github.com/0xjeffro/tx-parser
https://github.com/shmidtqq65/loxley
https://github.com/uerax/all-in-one-bot
https://github.com/redactedmeme/swarm
https://github.com/Argona7/stampede
https://github.com/hummingbot/hummingbot
https://github.com/OpenBB-finance/OpenBB
https://github.com/bmoscon/cryptofeed
https://github.com/alpacahq/alpaca-mcp-server
https://github.com/mocasus/trade-agent
https://985monitor.xyz/
docs.gmgn.ai/index/gmgn-agent-api
docs.gmgn.ai/index/gmgn-callout-openapi
gmgnai.github.io/skillmarket-demos/aitrader
gmgnai.github.io/skillmarket-demos/memex
https://github.com/GMGNAI/skillmarket-demos/tree/main/aitrader
https://github.com/GMGNAI/skillmarket-demos/tree/main/memex
https://github.com/vybenetwork/solana-top-holders-api
https://github.com/vybenetwork/solana-top-traders-api
https://github.com/vybenetwork/solana-trader-pnl-api
https://github.com/pamgarcia1993/robinhood-lp-bot
https://github.com/BikeTysonDegen/gmgn-terminal-bot
https://github.com/0xuezhang985/wallet-convergence-alert
https://github.com/ChipaDevTeam/GmGnAPI
https://github.com/nirholas/scrape-smart-wallets
https://github.com/chasepal/gmgn-wallet-holdings
https://github.com/gustaffsonKotte/qlo
https://github.com/rimtoln/COPUMP
https://github.com/0xwast3/PELLET
https://github.com/moorcheh-ai/memanto
https://github.com/Lumiwealth/lumibot
https://github.com/ygwyg/MAHORAGA
https://github.com/51bitquant/ai-hedge-fund-crypto
https://github.com/Tomortec/CryptoTradingAgents
https://github.com/ryan-yuuu/crypto-trading-arena
https://github.com/LLMQuant/awesome-trading-agents#agents-atlas-gic
https://github.com/HKUSTDial/DeepEar
https://github.com/oficcejo/alpha-arena-okx
https://github.com/paperswithbacktest/pwb-alphaevolve
https://github.com/Miasyster/QuantGPT
https://github.com/LLMQuant/data-mcp
https://github.com/financial-datasets/mcp-server
https://github.com/6551Team/opennews-mcp
https://github.com/guangxiangdebizi/FinanceMCP
https://github.com/aahl/mcp-aktools
https://github.com/massive-com/mcp_massive
https://github.com/krakenfx/kraken-cli
https://github.com/okx/agent-trade-kit
https://github.com/atilaahmettaner/tradingview-mcp
https://github.com/monarchjuno/tradingcodex
https://github.com/tradermonty/claude-trading-skills
https://github.com/RKiding/Awesome-finance-skills
https://github.com/okx/onchainos-skills
https://github.com/okx/agent-skills
https://github.com/stefanoviana/crypto-pump-scanner
https://mcp.bitquery.io/
https://dexrabbit.bitquery.io/
https://www.coingecko.com/en/categories/meme-token
https://coinmarketcap.com/view/memes/
https://www.geckoterminal.com/
https://github.com/kukapay/jupiter-mcp
https://github.com/kukapay/pumpfun-wallets-mcp
https://github.com/tony-42069/solana-mcp
https://github.com/kukapay/rug-check-mcp
https://github.com/kukapay/honeypot-detector-mcp
https://github.com/kukapay/whale-tracker-mcp
https://github.com/kukapay/crypto-sentiment-mcp
https://github.com/kukapay/crypto-indicators-mcp
https://github.com/kukapay/dexscreener-trending-mcp
https://birdeye.so/
https://github.com/Panniantong/Agent-Reach
https://github.com/marc-shade/world-intel-mcp
https://github.com/mvanhorn/last30days-skill
https://mcpmarket.com/server/openpump
https://github.com/nirholas/robinhood-chain-mcp
https://arxiv.org/html/2501.00826v3
https://github.com/openpumpio
https://github.com/ennriqe/crypto-agent-memecoin-prototype
https://ethglobal.com/showcase/meme-sentinels-12xqg
https://ethglobal.com/showcase/agentstrategy-hiyug
https://ethglobal.com/showcase/degenagent-zqmdu
https://github.com/zetryn-ai/ai-agent
https://github.com/thegreatola/memecoins-trading-agent
https://github.com/Benita2001/SpecterAI
https://github.com/alexskin/memeoy
https://github.com/MayurK-cmd/4Meme-Pilot
https://github.com/tow3web3/agentinu
https://github.com/lyc0603/copytrading
https://github.com/Denzz102/memecoin-agent
https://github.com/manavaga/web3-signals-mcp
https://github.com/autonsol/sol-mcp
https://github.com/kabbersokhi-boop/crypto-trend-hunter
https://github.com/dynamolabs/solana-mcp
https://github.com/0xmfox/rabiq
https://github.com/h100envy/nerve
https://github.com/immortalhowwl/fly-high
https://github.com/solo-agent/solo
https://github.com/blockscout/blockscout
https://docs.dune.com/api-reference/agents/mcp
https://mcp.crypto.com
https://github.com/aave/skills
https://github.com/rckprtr/pumpdotfun-sdk
https://github.com/jito-labs/jito-ts
https://github.com/warp-id/solana-trading-bot
https://github.com/degenfrends/solana-rugchecker
https://github.com/a-guard/malicious-validators
https://github.com/sirenconemd/robinhood-trading-toolkit
https://github.com/ccxt/ccxt
https://github.com/1009682175845693/bsc-fourmeme-bot
https://github.com/wwwwwwworld/solana-trading-bot-v3
https://github.com/dartkomnitibe/solana-meme-tool
https://github.com/build23w/fdv.lol
https://github.com/nirholas/pump-fun-sdk
https://github.com/PillCrew/claimchain
https://github.com/slightlyuseless/pons-sniper
https://github.com/harutocodes/pumpfun-copytrade
https://github.com/nirholas/kol-quest
https://github.com/yllvar/gmgn-TrendingAnalyzer
https://github.com/nirholas/memescope-monday-directory
https://github.com/vincentkoc/dexscraper
https://github.com/w3laba/DexScreener-Trending
https://github.com/mortdeus/solana-copy-sniper-mev-trading-bot
https://github.com/nirholas/crypto-vision
https://github.com/marksantiago290/KOLscan-leaderboard-scraping
https://github.com/oratis/influencex
https://github.com/555cute/r20-quantum-trader
https://github.com/0xBennie/binance-smart-money-oi-monitor
https://docs.mobula.io/guides/gmgn-apis
https://docs.codex.io/networks
https://github.com/thetateman/Trading-API
https://docs.moralis.com/
https://www.coingecko.com/learn/best-free-crypto-api
https://github.com/sevenlabs-hq/carbon
https://github.com/Shradhesh71/YellowStone-gRPC
https://github.com/subsquid/squid-sdk
https://github.com/holaplex/indexer
https://github.com/uxuycom/indexer
https://github.com/paradigmxyz/cryo
https://github.com/chainbase-labs/manuscript-core
https://github.com/messari/subgraphs
https://github.com/enviodev/hyperindex
https://github.com/Thorsten02041973/robinhood-cli
https://github.com/Stormeye85/robinhood-token-sniper
https://github.com/nansen-ai/nansen-cli
https://github.com/olaxbt/ai-market-maker
https://github.com/dragon1086/prism-insight
https://github.com/flash131307/multi-agent-investment
https://github.com/liangdabiao/autogen-financial-analysis
https://github.com/ValueCell-ai/valuecell
https://github.com/AI4Finance-Foundation/FinRobot
https://github.com/brokermr810/QuantDinger
https://github.com/OpenByteInc/QuantDinger
https://github.com/ginlix-ai/LangAlpha
https://github.com/FinStep-AI/ContestTrade
https://github.com/EthanAlgoX/LLM-TradeBot
https://github.com/danilobatson/ai-trading-agent-gemini
https://github.com/ZhuLinsen/daily_stock_analysis
https://github.com/AmadeusGB/alpha-arena
https://github.com/LuckyOne7777/LLM-Trading-Lab
https://github.com/nautechsystems/nautilus_trader
https://github.com/asavinov/intelligent-trading-bot
https://github.com/enzoampil/fastquant
https://github.com/holdout-labs/lookahead-free
https://github.com/freqtrade/freqtrade
https://github.com/JulienPlanchetCoineo/frostybot-js
https://github.com/TheGigaQuant/frostybot-js
https://github.com/ctubio/Krypto-trading-bot
https://github.com/trustwallet/blockatlas
https://docs.coincap.io/
https://api.coinpaprika.com/
https://api.dexpaprika.com/
https://developers.shrimpy.io/
https://github.com/tiagosiebler/OrderBooks
https://github.com/Erfaniaa/financial-indexes-correlation
https://github.com/Erfaniaa/financial-dataset-generator
https://github.com/Erfaniaa/undervalued-crypto-finder
https://github.com/GuntharDeNiro/gunbot-quant
https://github.com/wealthfolio/wealthfolio
https://p.nomics.com/cryptocurrency-bitcoin-api
https://dex.watch
https://etherscan.io/dextracker
https://dexindex.io
https://graphs.santiment.net/dex_trades
https://app.santiment.net/assets/list?name=decentralized%20exchanges
https://debank.com/ranking/dex
http://www.predictions.exchange/dex
https://liquidity.vision
https://www.theblockcrypto.com/data/open-finance/dex-non-custodial
https://orderflow.art
https://github.com/sopersone/CROWBRAIN
https://github.com/rimtoln/fletch
https://github.com/milesdeutscher/garchmethod
https://github.com/nikmcfly/MiroFish-Offline
https://github.com/Kelows/million
https://github.com/Im-Madhur-Gupta/maverick
https://docs.fereai.xyz/
https://maverick-backend.onrender.com/api
https://github.com/WebRaizo30/AnoMeme
https://github.com/soladdev/solana-meme-tool
https://github.com/moazamdotdev/Trading-platform-frontend
https://github.com/ricoboost/meme-coin-trading-bot
https://github.com/ironclad-protocol/solana-copy-trading-bot
https://github.com/sergafon/solana-copy-trading
https://github.com/ejfxgit2025/memenet
https://github.com/natebag/TrenchTools
https://github.com/LW-ARTS/trenchkit
https://github.com/crownobyl/trenchkit
https://github.com/AI-PIN/ChainPlusTrader
https://github.com/dbotx/dbot-mcp-servers
https://github.com/ArgosSystems/Smart-Money-Tracker
https://github.com/jamsturg/crypto-whale-tracker
```

## Implementation Log

### P0 foundation (2026-09-16)

- Added `src/domain/event-envelope.ts`: versioned event envelope, deterministic dedupe key, stale detection.
- Added `src/domain/source-health.ts`: source health tracker with stale/degraded state and consecutive error tracking.
- Added `src/domain/order-intent.ts`: `ApprovedOrderIntent` validator with expiration, slippage, idempotency, and future-ISO checks.
- Added `src/domain/risk-decision.ts`: executable decision contract (`ALLOW` vs `PAPER_ONLY`/`WATCH`/`REJECT`) with expiry.
- Registered `meme-bsc` scout and removed `meme-ink` from the active `AGENT_DOMAINS` registry.
- Added `src/agents/meme-bsc/bsc-screening-agent.ts`, a thin chain-aware subclass of the Base/GMGN EVM scout.
- Made `BaseScreeningAgent` chain-aware for BSC payload URLs/network and config updates.
- Updated Hub, index composition, health watcher, strategy bootstrap, and registry tests for the BSC active domain.
- Added `tests/domain-foundation.test.ts`.

Verification: `npm test` passes 348 tests; `npm run build` passes TypeScript compilation.

### P1 implementation pass (2026-09-16)

- Added `src/services/wallet-cohort-tracker.ts`: read-only wallet intelligence borrowing the FlySwarm/MEERKAT/PELLET/stampede patterns. Emits `CONVERGENCE`, `ROTATION`, and `DORMANT_WAKE` signals from smart-money/KOL fills. No LLM, no signing, no broadcast; bounded in-memory history with per-signal cooldown.
- Wired wallet cohort tracker into `src/index.ts` five-minute loop. It ingests smart-money and KOL trades for `sol`, `robinhood`, `base`, `bsc`, and `eth`, then emits alert-only control-room notifications. It is deliberately not an executable order input.
- Added `src/services/gmgn-callout-router.ts`: deterministic GMGN push/webhook normalizer using the callout-openapi borrowing. Converts webhook bodies into event envelopes with chain/address/side/amount normalization, dedupe keys, and bounded recency.
- Added `POST /api/callout/gmgn` to `src/api/server.ts` so GMGN webhooks can push into the running bot. The API key guard still applies when `OPENCATZ_API_KEY` is configured.
- Added `tests/wallet-cohort-tracker.test.ts` and `tests/gmgn-callout-router.test.ts`.
- Fixed EVM chain preservation in `WalletTracker` and chain-aware auto-close semantics; existing sell-path tests were updated for the new `OpenPosition.chain` shape.

Verification: targeted wallet/exit/position/cohort/callout tests pass (39 tests), `npm run build` passes.

### P2 implementation pass (2026-09-16)

- Added `src/services/decision-memory.ts`: immutable `signal -> decision -> order -> journal` trace ledger keyed by `traceId`. It is read-only in the sense that it never signs or broadcasts; it only records what the deterministic gates and execution pipeline already did.
- Extended `src/services/state-store.ts` with `DecisionMemoryEntry[]` persisted under `decisionMemory`, plus `appendDecisionMemoryEntry()` and `getDecisionMemory(traceId?, limit?)`.
- Added `GET /api/callouts` and `GET /api/memory` to `src/api/server.ts` so operators can audit fast-path push events and the full trace without touching Discord or Telegram.
- Wired `globalDecisionMemory.recordSignal()` into `POST /api/callout/gmgn` and `POST /api/tape/robinhood`, so webhook/tape signals land in the same ledger the execution pipeline uses.
- Added `GET /api/cohort` backed by `WalletCohortTracker.peek()`, exposing convergence/rotation/dormant-wake signals without consuming the signal cooldown.
- Added optional decision-memory hooks to `ExecutionPipeline`: pending orders, simulated updates, fills/partial fills, cancellations, and blocked/failed orders all append trace entries when a memory implementation is supplied.
- Unified `src/index.ts` to use `globalStateStore` and a process-wide `DecisionMemory(stateStore)`, so runtime loops and the REST API share one persisted ledger instead of loading two independent copies of the same state file.
- Added tests for decision memory persistence, API memory/callout/cohort endpoints, pipeline memory hooks, and wallet-cohort `peek()` non-consuming behavior.
- Wired `globalDecisionMemory.recordSignal()` into the main sub-agent dispatch loop in `src/index.ts` for every passed signal, plus `recordDecision()` for auto-buy and exit verdicts and `recordJournal()` after journal entry/close writes. The full lifecycle is now traceable through `GET /api/memory?traceId=...` and persisted in `state-store`.

Verification: targeted P2 suites pass (20 tests), full `npm test` passes (393 tests), `npm run build` passes TypeScript compilation.

### P3 implementation pass (2026-09-16)

- Added `src/services/fomo-wallet-resolver.ts`: deterministic Fomo/Robinhood profile -> wallet resolver borrowed from the fomo-radar maker-window pattern. Each window contributes `1 / len(makers)`, calm single-maker windows score higher, and a runner-up can out-score an early winner. Emits `EXACT`, `MAJORITY`, `AMBIGUOUS`, or `UNRESOLVED` resolutions with bounded candidate memory and a 30-day recency TTL. It is read-only intelligence and never signs or broadcasts.
- Added `src/services/smart-money-wallet-scorer.ts`: deterministic wallet admission scorer borrowing admission evidence from onchain-trading-bot, MEERKAT dossiers, FlySwarm filters, and fomo-radar red-flag checks. Uses Wilson lower-bound win rate, gross ROI, PnL snapshots, trade count, unique tokens, median hold duration, and bot-like inventory rotation flags. Grades wallets `FIRE`, `WATCH`, `NOISE`, or `UNKNOWN`.
- Added `POST /api/resolver/fomo` and `GET /api/resolver/fomo?profile=...` to `src/api/server.ts` so tape/webhook systems can push Fomo maker-window evidence and inspect current profile resolutions through the same process-wide `globalFomoWalletResolver`.
- Added `POST /api/wallet/score` to `src/api/server.ts` so deterministic wallet admission scoring is reachable by operators and by the same REST fast-path used for GMGN callouts and Robinhood tape.
- Added `tests/fomo-wallet-resolver.test.ts`, `tests/smart-money-wallet-scorer.test.ts`, and extended `tests/api-server.test.ts` with resolver and wallet-score route coverage.
- Next-hunt wiring note: `globalFomoWalletResolver.ingestFill()` is intentionally opt-in via the REST endpoint for now. Once the Fomo tape listener emits maker-window fills, the resolver can be fed from the same push path without changing execution gates.

Verification: targeted P3 suites pass (15 tests), full `npm test` passes (402 tests across 55 files), `npm run build` passes TypeScript compilation.

### P4 implementation pass (2026-09-17)

- Added `src/domain/token-gatebook.ts` and `src/services/token-gatebook.ts`: a deterministic memecoin admission gatebook for Solana, Robinhood/Fomo, Base, and BSC. It models the AEGIS-style hard checks required before a signal can become an order: mint/freeze authority, honeypot, transfer tax, wash trading, bundler activity, top-holder concentration, developer ownership, liquidity lock, graduation state, market cap, volume, and critical-data freshness.
- Gatebook verdicts are `ALLOW`, `REVIEW`, or `BLOCK`. Unknown critical security fields fail closed to `REVIEW`; ungraduated launch state is a hard `BLOCK`; explicit honeypot, authority, tax, and concentration failures are hard `BLOCK`. This is policy code, not an LLM opinion.
- Extended `ApprovedOrderIntent` with optional `tokenGatebook` evidence and wired `compileExecutionVerdict()` to veto every non-`ALLOW` gatebook result before the execution pipeline can simulate, submit, or broadcast an order. LLM output cannot override this veto.
- Added `POST /api/gatebook/evaluate` to `src/api/server.ts` for operator and scout-side deterministic token admission checks. The route accepts chain/address/token identity, gatebook evidence, and explicit options, then returns the verdict and machine-readable reasons.
- Added `tests/token-gatebook.test.ts` and decision-engine/API coverage for blocked gatebook evidence, unknown critical data, ungraduated tokens, and healthy allow paths.

Verification: full `npm test` passes (408 tests across 56 files), `npm run build` passes TypeScript compilation. Existing LP, NFT, prediction, and other legacy modules remain untouched; active Memeclaw scout scope stays meme trading with `meme-solana`, `meme-robinhood`, `meme-base`, `meme-eth`, `meme-bsc`, and `ct-alpha`.

### P5 implementation pass (2026-09-17)

- Added `src/domain/launch-intelligence.ts` and `src/services/launch-intelligence.ts`: deterministic launch intelligence borrowed from the qlo slow-graduation filter, pumpfun/bonkfun graduation mechanics, and the bot/bundle heuristics from the Meme Coin Factories paper. It classifies curve progress, curve-fill speed, graduation state, holders, buy volume, dev holding, and bundler rate into `HEALTHY`, `RISK`, `SLOW`, `STALLED`, or `UNKNOWN`.
- Added `POST /api/launch/evaluate` to `src/api/server.ts` so scouts and operators can push Pump.fun/LetsBonk/Fomo/4.meme launch evidence into the same deterministic evidence surface as the gatebook and wallet scorer. It is read-only and never signs or broadcasts.
- Added `tests/launch-intelligence.test.ts` with healthy graduated tokens, slow bonding curves, stalled curves, fast-fill risk, high bundler risk, and unknown-data invalidation. Extended `tests/api-server.test.ts` with route coverage.

Verification: full `npm test` passes (415 tests across 57 files), `npm run build` passes TypeScript compilation. Launch intelligence is available as a scoring layer for the next scout pass; it is not yet wired into auto-buy and remains separate from the deterministic execution vetoes in `decision-engine.ts`.

### P6 implementation pass (2026-09-17)

- Added `src/domain/exit-safety.ts` and `src/services/exit-safety.ts`: deterministic exit pre-flight borrowed from the loxley pattern. It builds a separate exit quote, checks sell lock/honeypot/creator-close state, bundler and rug ratios, exit tax, liquidity depth, 24h volume dryness, 1h crash risk, smart-money absence, launch bundle/sniper/bump evidence, and quote-vs-depth coverage before a sell can be marked executable.
- Extended `src/orchestrator/exit-manager.ts` with a new `EXIT_SAFETY` exit reason. The manager now runs `evaluateExitSafety()` before smart-money, take-profit, and volume-drop logic; a hard `BLOCK` emits a full exit trigger with machine-readable reasons. The LLM can explain a bad quote but cannot override it.
- Added `POST /api/exit/safety` to `src/api/server.ts` so operators, scouts, and fast-path tape/webhook systems can run the same deterministic exit gate independently. The route is read-only and never signs or broadcasts.
- Added `tests/exit-safety.test.ts`, `tests/exit-manager.test.ts`, and extended `tests/api-server.test.ts` with healthy clear, hard-block, shallow/unknown depth, bundler, rug, honeypot, sell-lock, launch-bundle, and API-route coverage.
- Fixed the exit-safety helper so checks carry explicit `ok`, `severity`, and computed `blocking` semantics instead of an inverted boolean, and updated all call sites to pass healthy checks as `ok=true` and siren checks as `ok=false`.

Verification: full `npm test` passes (424 tests across 58 files at time of P6), `npm run build` passes TypeScript compilation. Exit safety is now a hard deterministic veto layer for SELL decision making and remains separate from the LLM proposal path. Note: the P7 rerun below reports the corrected current total.

### P7 evidence wiring pass (2026-09-17)

- Added deterministic GMGN-to-domain evidence builders in [src/agents/shared/gmgn-meme-helpers.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/agents/shared/gmgn-meme-helpers.ts:58>): `buildLaunchEvidence(t)` maps GMGN snapshots into launch-intelligence inputs, `buildExitEvidence(t, positionAmount, amountFraction)` maps them into exit pre-flight inputs, and `buildGatebookEvidence(t)` maps them into token-gatebook inputs.
- Extended `CallCardPayload` in [src/agents/shared/agent-contract.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/agents/shared/agent-contract.ts:93>) with optional `launchEvidence` and `gatebookEvidence`, so scouts can hand deterministic evidence to the decision engine instead of making the LLM guess.
- Wired `launchEvidence` and `gatebookEvidence` into scout `buildPayload()` for `meme-solana`, `meme-robinhood`, and `meme-base`/`meme-bsc`, then threaded them through `ApprovedOrderIntent` construction in [src/index.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/index.ts:621>) so every auto-buy intent carries the same evidence surface the deterministic gates consume.
- Extended [src/orchestrator/exit-manager.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/orchestrator/exit-manager.ts:157>) so every `ExitTrigger` now carries `exitEvidence` produced by `buildExitEvidence`; exit intents from the main loop in `src/index.ts` pass that evidence into `compileExecutionVerdict()`.
- Kept the decision-engine hard vetoes deterministic in [src/orchestrator/decision-engine.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/orchestrator/decision-engine.ts:32>): gatebook non-ALLOW, BUY launch RISK/STALLED/UNKNOWN, and SELL exit-safety BLOCK cannot be overridden by LLM output.
- Added [tests/gmgn-meme-helpers.test.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/tests/gmgn-meme-helpers.test.ts:50>) with five tests covering launch evidence from graduated snapshots, ungraduated bonding-curve tokens, exit evidence with position sizing, gatebook evidence from security fields, and renounced authorities.

Verification: full `npm test` passes (405 tests across 58 files), `npm run build` passes TypeScript compilation. Evidence is deterministic, scouts now attach it at payload time, and no LLM path can bypass gatebook/launch/exit vetoes.

### P8 risk unification pass (2026-09-17)

- Added [src/orchestrator/risk-engine.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/orchestrator/risk-engine.ts:51>) as the single runtime risk engine for Memeclaw. It merges the old `RiskManager` drawdown/sizing/correlation surface with the `RiskEngineV2` asset/chain exposure, volatility sizing, and kill-switch surface. The bot now asks the engine two deterministic questions only: `isTradeAllowed(amountUsd)` and `checkKillSwitchStatus()`.
- Wired the unified engine into [src/orchestrator/hub.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/orchestrator/hub.ts:13>): `OpenCatzHub` now owns a `RiskEngine` instead of `RiskManager`, and `/closeall` panics through `globalRiskEngine.activateKillSwitch()`.
- Rebased `compileExecutionVerdict()` in [src/orchestrator/decision-engine.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/orchestrator/decision-engine.ts:24>) and `SubmitOrderInput` in [src/orchestrator/execution-pipeline.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/orchestrator/execution-pipeline.ts:26>) onto `Pick<RiskEngine, ...>` so no execution path depends on the legacy engine types.
- Replaced `globalRiskEngineV2` usages in [src/index.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/index.ts:33>), [src/api/server.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/api/server.ts:5>), and hub with `globalRiskEngine`. The old `risk-manager.ts` and `risk-engine-v2.ts` remain on disk as legacy files but are no longer runtime dependencies of the execution path.
- Added [tests/risk-engine.test.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/tests/risk-engine.test.ts:1>) and switched `tests/risk-manager.test.ts`, `tests/decision-engine.test.ts`, and `tests/execution-pipeline.test.ts` onto the unified engine, covering drawdown lock, cooldown-expired kill switch, max trade sizing, correlation/deployer clusters, asset/chain exposure caps, consecutive-loss kill, and the boot singleton.

Verification: full `npm test` passes (412 tests across 59 files), `npm run build` passes TypeScript compilation. Risk is a single deterministic gate again: drawdown + sizing + kill switch are hard gates, exposure/correlation/vault-style checks stay read-only for dispatch and can be exercised from the API.

### P9 tape ingest router pass (2026-09-17)

- Added [src/services/tape-ingest-router.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/services/tape-ingest-router.ts:1>) as the deterministic Robinhood/Fomo tape push router. It normalizes raw webhook/tape payloads through `normalizeTape` first, never lets raw shapes leak into execution, and everything after normalization is evidence already scoped to memecoin trading.
- Router order is strict: normalize, dedupe on the event envelope key, persist to the callout ledger, and only then feed downstream evidence. Duplicate tape pushes now skip decision-memory, wallet-cohort, and Fomo resolver writes.
- Wired `POST /api/tape/robinhood` in [src/api/server.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/src/api/server.ts:261>) through `TapeIngestRouter` so the REST fast-path and any future Fomo listener share one dedupe and evidence path. The process-wide `globalTapeIngestRouter` is exported from the same file for listener reuse.
- Fomo profile resolution is now autonomous from tape pushes: when a payload includes `profileId`/`profile`/`traderId`/`trader` plus `makerCandidates`/`makers`, the router feeds a `FomoFillEvidence` window into `FomoWalletResolver`. A single maker fill with no explicit candidates falls back to the normalized maker wallet.
- Wallet-cohort evidence is fed for buy/sell tape with a valid token and maker, using the normalized chain and smart-money kind. Decision-memory receives one signal trace per first-seen tape event.
- Added [tests/tape-ingest-router.test.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/tests/tape-ingest-router.test.ts:1>) covering first-time persistence, duplicate skip, malformed payload rejection, Fomo profile resolution from maker windows, and wallet-cohort ingestion. Extended [tests/api-server.test.ts](<C:/Users/CM265/Documents/ChatGPT/New project 2/memeclaw/tests/api-server.test.ts:42>) with tape -> fomo resolver integration coverage.

Verification: full `npm test` passes (417 tests across 60 files), `npm run build` passes TypeScript compilation. Fomo tape ingestion now has a single deterministic front door, and the report is up to date with the next implementation chunk before stopping.

### P10 report reclassification pass (2026-09-17)

- Rewrote the master decision register around the final vocabulary: `Adopt`, `Adapt`, `Study`, `Skip`. Old journal sections remain below the register as reading notes, but the register is the operational decision source.
- Refreshed the roadmap as `Roadmap v3`: P0 foundation, P1 RH/Fomo tape + read-only Solana, P2 canary live, P3 Base/BSC, P4 study backlog.
- Added `Complétion v3 (URLs restantes)` so every URL from the deduplicated source list appears in the final coverage section; coverage check passes with 237 HTTP URLs extracted and 0 missing.
- Added code-level README findings for `muratmula/ai-robinhood-chain`, `stefanoviana/crypto-pump-scanner`, `PillCrew/PillCrew`, and `degenfrends/solana-rugchecker`, plus a note that subagent clone/network attempts were limited and the main thread fell back to `gh api` + README reads with temporary clone cleanup.
