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

Cette section est la décision finale pour **toutes les sources du corpus unique**, réécrite avec la classification v3: `Adopt`, `Adapt`, `Study`, `Skip`. La présente section fait foi pour la décision opérationnelle.

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
- `Adapt`: https://github.com/cvxv666/fomo-robinhood-radar | https://github.com/itsnex1s/fomopulse-robinhood-chain-tape | https://github.com/chainstacklabs/fomo-solana-rh-listeners | https://github.com/lunarresearcher/copy | https://github.com/slightlyuseless/pons-sniper | https://github.com/chainstacklabs/pumpfun-bonkfun-bot | https://github.com/gustaffsonKotte/qlo | https://github.com/shmidtqq65/loxley | https://github.com/Argona7/stampede | https://github.com/0xjeffro/tx-parser | https://github.com/rimtoln/COPUMP | https://github.com/lyc0603/copytrading | https://github.com/kocer6/MEERKAT | https://github.com/semkazz1/FlySwarm | https://github.com/0xuezhang985/wallet-convergence-alert | https://github.com/andreysuperiorgit/aegis | https://github.com/mnemox-ai/tradememory-protocol | https://github.com/GMGNAI/gmgn-skills | https://gmgnai.github.io/skillmarket-demos/aitrader | https://gmgnai.github.io/skillmarket-demos/memex | https://github.com/GMGNAI/skillmarket-demos/tree/main/aitrader | https://github.com/GMGNAI/skillmarket-demos/tree/main/memex | https://github.com/0xmfox/rabiq | https://github.com/h100envy/nerve | https://github.com/yllvar/gmgn-TrendingAnalyzer | https://github.com/LW-ARTS/trenchkit | https://github.com/crownobyl/trenchkit | https://github.com/openpumpio | https://github.com/zetryn-ai/ai-agent | https://github.com/thegreatola/memecoins-trading-agent | https://github.com/Denzz102/memecoin-agent | https://github.com/Benita2001/SpecterAI | https://github.com/alexskin/memeoy | https://github.com/MayurK-cmd/4Meme-Pilot | https://github.com/tow3web3/agentinu | https://github.com/nhovongoc0-max/meme-radar | https://github.com/stefanoviana/crypto-pump-scanner | https://github.com/PillCrew/claimchain | https://github.com/build23w/fdv.lol | https://github.com/rimtoln/fletch | https://github.com/milesdeutscher/garchmethod | https://github.com/Kelows/million | https://github.com/Im-Madhur-Gupta/maverick | https://github.com/ricoboost/meme-coin-trading-bot | https://github.com/ironclad-protocol/solana-copy-trading-bot | https://github.com/sergafon/solana-copy-trading | https://github.com/dartkomnitibe/solana-meme-tool | https://github.com/soladdev/solana-meme-tool | https://github.com/natebag/TrenchTools | https://github.com/ArgosSystems/Smart-Money-Tracker | https://github.com/jamsturg/crypto-whale-tracker | https://github.com/warp-id/solana-trading-bot | https://github.com/wwwwwwworld/solana-trading-bot-v3 | https://github.com/harutocodes/pumpfun-copytrade | https://github.com/1009682175845693/bsc-fourmeme-bot | https://github.com/dragon1086/prism-insight | https://github.com/Stormeye85/robinhood-token-sniper | https://github.com/Thorsten02041973/robinhood-cli | https://github.com/nansen-ai/nansen-cli | https://github.com/zostaff/ai-quant-researcher | https://github.com/zostaff/agent-arena | https://github.com/TauricResearch/TradingAgents | https://github.com/The-Swarm-Corporation/AutoHedge | https://github.com/HKUDS/Vibe-Trading | https://github.com/pgen0x/azimuth | https://github.com/akanz/onchain-trading-bot | https://github.com/mocasus/trade-agent | https://github.com/ygwyg/MAHORAGA | https://github.com/51bitquant/ai-hedge-fund-crypto | https://github.com/Tomortec/CryptoTradingAgents | https://github.com/ryan-yuuu/crypto-trading-arena | https://github.com/olaxbt/ai-market-maker | https://github.com/ginlix-ai/LangAlpha | https://github.com/FinStep-AI/ContestTrade | https://github.com/EthanAlgoX/LLM-TradeBot | https://github.com/danilobatson/ai-trading-agent-gemini | https://github.com/AmadeusGB/alpha-arena | https://github.com/LuckyOne7777/LLM-Trading-Lab | https://github.com/nautechsystems/nautilus_trader | https://github.com/asavinov/intelligent-trading-bot | https://github.com/freqtrade/freqtrade | https://github.com/JulienPlanchetCoineo/frostybot-js | https://github.com/TheGigaQuant/frostybot-js | https://github.com/ctubio/Krypto-trading-bot | https://github.com/GuntharDeNiro/gunbot-quant | https://github.com/sopersone/CROWBRAIN | https://github.com/rimtoln/fletch | https://github.com/Kelows/million | https://github.com/ejfxgit2025/memenet
- `Study`: https://github.com/Fincept-Corporation/FinceptTerminal | https://github.com/muratmula/ai-robinhood-chain | https://github.com/Drakkar-Software/OctoBot | https://github.com/PillCrew/PillCrew | https://github.com/uerax/all-in-one-bot | https://github.com/redactedmeme/swarm | https://github.com/hummingbot/hummingbot | https://github.com/OpenBB-finance/OpenBB | https://github.com/vybenetwork/solana-top-holders-api | https://github.com/vybenetwork/solana-top-traders-api | https://github.com/vybenetwork/solana-trader-pnl-api | https://github.com/0xwast3/PELLET | https://github.com/moorcheh-ai/memanto | https://github.com/guangxiangdebizi/FinanceMCP | https://github.com/aahl/mcp-aktools | https://github.com/massive-com/mcp_massive | https://github.com/kukapay/jupiter-mcp | https://github.com/kukapay/pumpfun-wallets-mcp | https://github.com/kukapay/rug-check-mcp | https://github.com/kukapay/honeypot-detector-mcp | https://github.com/kukapay/whale-tracker-mcp | https://github.com/kukapay/crypto-sentiment-mcp | https://github.com/kukapay/crypto-indicators-mcp | https://github.com/kukapay/dexscreener-trending-mcp | https://mcpmarket.com/server/openpump | https://arxiv.org/html/2501.00826v3 | https://ethglobal.com/showcase/meme-sentinels-12xqg | https://ethglobal.com/showcase/agentstrategy-hiyug | https://ethglobal.com/showcase/degenagent-zqmdu | https://github.com/immortalhowwl/fly-high | https://github.com/blockscout/blockscout | https://docs.dune.com/api-reference/agents/mcp | https://docs.mobula.io/guides/gmgn-apis | https://docs.moralis.com/ | https://github.com/enzoampil/fastquant | https://github.com/tiagosiebler/OrderBooks | https://dex.watch | https://etherscan.io/dextracker | https://graphs.santiment.net/dex_trades | https://app.santiment.net/assets/list?name=decentralized%20exchanges | https://debank.com/ranking/dex | https://github.com/WebRaizo30/AnoMeme | https://github.com/moazamdotdev/Trading-platform-frontend | https://docs.fereai.xyz/ | https://maverick-backend.onrender.com/api | https://github.com/nikmcfly/MiroFish-Offline
- `Skip`: https://github.com/alpacahq/alpaca-mcp-server | https://985monitor.xyz/ | https://github.com/krakenfx/kraken-cli | https://mcp.crypto.com | https://github.com/aave/skills | https://github.com/degenfrends/solana-rugchecker | https://github.com/ccxt/ccxt | https://docs.coincap.io/ | https://api.coinpaprika.com/ | https://developers.shrimpy.io/ | https://p.nomics.com/cryptocurrency-bitcoin-api | https://dexindex.io | https://liquidity.vision | https://www.theblockcrypto.com/data/open-finance/dex-non-custodial | https://orderflow.art | http://www.predictions.exchange/dex | https://github.com/Erfaniaa/financial-indexes-correlation | https://github.com/Erfaniaa/financial-dataset-generator | https://github.com/Erfaniaa/undervalued-crypto-finder | https://github.com/wealthfolio/wealthfolio | https://www.coingecko.com/learn/best-free-crypto-api | https://github.com/pamgarcia1993/robinhood-lp-bot | https://github.com/nirholas/scrape-smart-wallets | https://github.com/sirenconemd/robinhood-trading-toolkit | https://github.com/mortdeus/solana-copy-sniper-mev-trading-bot | https://github.com/w3laba/DexScreener-Trending | https://github.com/vincentkoc/dexscraper | https://github.com/oratis/influencex | https://github.com/0xBennie/binance-smart-money-oi-monitor | https://github.com/AI-PIN/ChainPlusTrader

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
| `p.nomics.com` | `site down` | 530 Site frozen; Skip. |
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

- Les catalogues intermédiaires par lot sont retirés; le registre final et la liste dédupliquée couvrent toutes les sources.
- `Registre final exhaustif des décisions` = verdict par source (`Adopt`, `Adapt`, `Study`, `Skip`).
- `Architecture end-to-end` + `Swarm` = design cible et rôles LLM.
- `Final source audit` = preuves au niveau code et index de confiance.
- `Matrice claims GMGN vs architecture Memeclaw` = mapping claim -> déjà en place / prévu / à ajouter.
- Lots courts `CROWBRAIN/FLETCH/GARCH/MiroFish`, `million/Maverick/...` et `TrenchTools/...`: couverts par le registre final et la liste dédupliquée.
- Relecture 2026-09-17: GitHub API + raw seulement (aucun clone), fichiers clés cités dans le registre final pour TrenchTools, trenchkit x2, dbot MCP et Argos.

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

- Rewrote the master decision register around the final vocabulary: `Adopt`, `Adapt`, `Study`, `Skip`. Old batch journal sections were removed; the register and the deduplicated source list are the operational sources.
- Refreshed the roadmap as `Roadmap v3`: P0 foundation, P1 RH/Fomo tape + read-only Solana, P2 canary live, P3 Base/BSC, P4 study backlog.
- Added `Complétion v3 (URLs restantes)` so every URL from the deduplicated source list appears in the final coverage section; coverage check passes with 237 HTTP URLs extracted and 0 missing.
- Added code-level README findings for `muratmula/ai-robinhood-chain`, `stefanoviana/crypto-pump-scanner`, `PillCrew/PillCrew`, and `degenfrends/solana-rugchecker`, plus a note that subagent clone/network attempts were limited and the main thread fell back to `gh api` + README reads with temporary clone cleanup.
