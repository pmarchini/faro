# The explanation model

Read this before authoring a tour. It says how a reader builds a mental model of code, and turns each finding into a rule the tour follows. The bibliography at the end was checked against publisher or library records on 2026-10-22.

## The rules

### 1. State a hypothesis first, then confirm it

Readers understand code top-down: they form a hypothesis about what the program is for, then look for evidence in the code that confirms or refines it (Brooks, 1983).

- Every tour opens with a `goal` (the question it answers) and a one-sentence `hypothesis` (the claim the nodes confirm). For a diff: "Sessions now survive a restart because tokens are persisted before the login reply is sent." For existing code: "Faro turns an agent's reasoning into a short, validated reading path that a front end renders without understanding it."
- Every path node fills `confirms`: which part of the hypothesis this step supports.
- If no single hypothesis fits, the target is too broad. Narrow it, or say so to the person.

### 2. Point at beacons

Experts recognise familiar structures from a few telling lines or names, called beacons (Brooks, 1983). Experienced programmers recall beacon lines far better than other lines of the same program (Wiedenbeck, 1986).

- Each node lists 1 to 3 `beacons`: the identifier or line an expert's eye would land on, with its line number. Never more than 3.
- Give each beacon a `note`: one short sentence on why the eye should land there and what it tells the reader ("the token is saved here, before reply() runs"), not a restatement of the label. The pane shows it beside the beacon.
- A beacon must sit inside one of the node's `anchors`. The tool refuses it otherwise.

### 3. Name the plan, flag the surprise

Programmers hold stereotyped plans (a guard clause, an accumulator loop, retry with backoff) and conventions about how plans are written. Code that breaks those conventions is much harder to understand, even for experts (Soloway and Ehrlich, 1984).

- Each node names its `plan` in 1 to 3 plain words.
- When the code breaks the plan a reader would expect (a retry with no backoff, a cache written before the source of truth), say so in `surprise`. This is where readers misread, so it is worth the words.

### 4. Choose one lens: flow or domain

Programmers first build a program model (control flow: what runs when) and only later a situation model (what the code means in the problem domain) (Pennington, 1987).

- `lens: "flow"` orders nodes by execution and words them in control and data flow. It is the default and suits a reader who will change the code.
- `lens: "domain"` orders nodes by the domain concepts the code touches and words them in those terms. It suits a reader who needs to know what the change means.
- Write only the chosen lens. The other is written on demand, when the reader first presses `l` on a node, into that node's `otherLens`. This roughly halves authoring cost; the price is a short wait on the first switch.

### 5. Answer why, how and what, and the next question

Readers ask why, how and what questions as they read and form conjectures to answer them (Letovsky, 1987).

- Each node answers "what changed" (`whatChanged`, for diffs) or "what it does" (`whatItDoes`, for existing code), and `why`.
- `why.source` says where the reason comes from: `commit`, `pr` or `comment` when the code's history or text states it, `inferred` when you reasoned it. Never present an inference as stated intent. Existing code rarely states intent, so code and question tours lean on `inferred`, and that is fine as long as it is labelled.
- `suggestedQuestion` is the question the reader is most likely to ask next. The pane lets them send it with one key.

### 6. Support both top-down and bottom-up reading

Real programmers switch between top-down and bottom-up comprehension as their knowledge allows (von Mayrhauser and Vans, 1995).

- The path is the top-down route. Edges (`calls`, `data`, `requires`, `tests`, `configures`) let a reader go bottom-up from any node; the Graph view that draws them comes later, but author edges now.
- Supporting changes (config, tests, renames) are nodes with `role: "supporting"`, off the path and linked by edges, so they cost no attention until asked for.

### 7. Respect working memory

Working memory holds about four chunks at once (Cowan, 2001), and load spent on anything other than the schema being learned slows learning (Sweller, 1988).

- Path budget: 5 to 7 nodes by default; 8 or 9 only when a mental step would otherwise be lost. `--depth brief` aims for about 4, `deep` for about 9. The tool refuses more than 12.
- One idea per node. A node whose anchors cover more than about 40 lines should be split or narrowed.
- Detail goes in deeper levels, not on the first screen: L0 is `title`, `plan`, `summary`; L1 adds `confirms`, `whatChanged` or `whatItDoes`, `why`, `beacons`, `carryForward`; L2 adds `detail` and `suggestedQuestion`.

### 8. Give labels scent

People follow labels whose words predict what lies behind them (Pirolli and Card, 1999).

- Titles name the concept, not the symbol: "Tokens persisted before reply", not `saveToken()`. Six words at most.
- Edge `label`s say why the reader goes from one node to the next.

### 9. Keep the reader oriented

Navigation tools should tell the reader where they are, how they got there and where they can go (Storey, Fracchia and Müller, 1999).

- The pane shows position, visited nodes and the current lens; the tour's job is to make adjacent nodes connect.
- The check that ties the rules together: if two adjacent path nodes do not share a `carryForward` (the first node's carry-forward is not something the second needs), the order is probably wrong. `tour_upsert` reports a missing carry-forward as advice.

## Order of the path

For the `flow` lens prefer causal order: entry or boundary, normalisation or setup, the key decision, the state change, the side effect, the externally visible outcome. It is a heuristic, not a template. The first node orients; the last lands on an outcome.

For the `domain` lens order by concept: the concept the change is about, the rules that govern it, where those rules are enforced, what a user of the system sees.

For a `--reader new` tour, add one orientation node at the start (what the subsystem is for, the two or three terms the rest relies on) and define project terms in `summary` the first time they appear. `familiar` skips both.

## Bibliography

- Brooks, R. (1983). Towards a theory of the comprehension of computer programs. *International Journal of Man-Machine Studies*, 18(6), 543–554. https://doi.org/10.1016/S0020-7373(83)80031-5
- Wiedenbeck, S. (1986). Beacons in computer program comprehension. *International Journal of Man-Machine Studies*, 25(6), 697–709. https://doi.org/10.1016/S0020-7373(86)80083-9
- Soloway, E., & Ehrlich, K. (1984). Empirical studies of programming knowledge. *IEEE Transactions on Software Engineering*, SE-10(5), 595–609.
- Pennington, N. (1987). Stimulus structures and mental representations in expert comprehension of computer programs. *Cognitive Psychology*, 19(3), 295–341.
- Letovsky, S. (1987). Cognitive processes in program comprehension. *Journal of Systems and Software*, 7(4), 325–339. (First presented at the first Empirical Studies of Programmers workshop, 1986; the design notes cited that version.)
- von Mayrhauser, A., & Vans, A. M. (1995). Program comprehension during software maintenance and evolution. *Computer*, 28(8), 44–55. https://doi.org/10.1109/2.402076
- Cowan, N. (2001). The magical number 4 in short-term memory: A reconsideration of mental storage capacity. *Behavioral and Brain Sciences*, 24(1), 87–114. https://doi.org/10.1017/S0140525X01003922
- Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science*, 12(2), 257–285. https://doi.org/10.1207/s15516709cog1202_4
- Pirolli, P., & Card, S. (1999). Information foraging. *Psychological Review*, 106(4), 643–675.
- Storey, M.-A. D., Fracchia, F. D., & Müller, H. A. (1999). Cognitive design elements to support the construction of a mental model during software exploration. *Journal of Systems and Software*, 44(3), 171–185. https://doi.org/10.1016/S0164-1212(98)10055-9

DOIs are listed only where a publisher or library record showing them was checked; the others were checked for authors, title, venue, volume and pages.
