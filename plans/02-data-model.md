# 02 Data model

Store unions, locals, legal rules and sources as structured records, not prose. Sector pages, union profiles, the union matcher, the changelog and the help directories are all generated from these records, so one update fixes every page that uses it.

Put records in `data/` as JSON (or YAML), each validated by a JSON Schema in `data/schema/`. The build fails on any invalid record.

## Records

### `union`
| Field | Type | Notes |
|---|---|---|
| `id` | slug | `uaw`, `npeu` |
| `name`, `abbreviation` | string | |
| `affiliation` | string | AFL-CIO, independent, SEIU affiliate… |
| `sectors` | sector id[] | |
| `who_they_organize` | string | Plain language |
| `organizing_intake` | url \| null | **Only if verified.** Unverified intake renders as "Contact via EWOC or the AFL-CIO." |
| `local_finder` | url \| null | |
| `recent_wins` | campaign id[] | Proof the union is actively organizing |
| `membership`, `finances` | object | From OLMS LM-2 |
| `olms_file_number` | string | Join key to OLMS |
| `status` | enum | `verified`, `partially_verified`, `to_verify` |
| `last_checked` | date | |
| `sources` | source id[] | |

### `local`
`id`, `number`, `parent_union`, `name`, `city`, `state`, `address`, `membership`, `sectors`, `organizing_active` (bool: true only if the union's site shows the local organizing), `olms_file_number`, `fiscal_year`, `last_checked`.

### `sector`
`id`, `name`, `plain_jobs` (e.g. "baristas, line cooks, servers"), `unions` (ranked by organizing activity), `union_density` (BLS), `notes`.

### `legal_rule`
`id`, `rule`, `plain_summary`, `status` (`in_force` | `targeted` | `split_by_circuit` | `overturned`), `where_it_applies` (all, or circuits/states excluded), `status_as_of`, `citation`, `what_to_tell_workers`, `history[]` ({date, change, source}). The `history` field generates `/rights/whats-changed`.

### `state_law`
`state`, `topic` (e.g. `captive_audience_ban`), `status`, `effective`, `citation`, `status_as_of`.

### `campaign`
`employer`, `union`, `sector`, `outcome`, `year`, `link`, `source`.

### `source`
`id` (matches `sources.md`), `title`, `publisher`, `tier` (1–4), `date`, `url`.

### `help_resource`
`type` (`lawyer` | `worker_center` | `nlrb_office` | `legal_clinic`), `name`, `area_served`, `languages`, `contact`, `source`, `last_checked`.

## Union directory v1

`data/unions.csv` has 26 rows. Its columns map to `union`: `sector, union, abbreviation, affiliation, who_they_organize, organizing_intake, local_finder, recent_example, status, last_checked`.

| Sector | Main unions | How to reach an organizer |
|---|---|---|
| Nurses | NNU, SEIU, NUHW | NNU intake form |
| Hotels, casinos, stadiums, airport and campus food | UNITE HERE | Local finder by state |
| Coffee and restaurants | Workers United (SEIU), UFCW, Teamsters, independent | Starbucks Workers United |
| Grocery, retail, cannabis | UFCW, RWDSU | UFCW organizer contact |
| Warehouse, delivery, Amazon | Teamsters | Find a local + organize form |
| Autos, manufacturing | UAW, USW, IAM, UE | UAW organizing contact |
| Private universities | UAW, SEIU, AFT, UE | UAW Higher Ed contact |
| Policy and advocacy nonprofits | NPEU (IFPTE), NEU (OPEIU), NewsGuild-CWA | NPEU contact |
| Social services, housing, refugee work | NEU (OPEIU), SEIU | NEU site |
| Tech, games, media | CWA (CODE-CWA, NewsGuild) | TO VERIFY |
| Southern service jobs | USSW (SEIU) | ussw.org |
| Any, unsure | EWOC; AFL-CIO referral | workerorganizing.org/support; aflcio.org/contact-union-organizer |

Most industries have 2–3 plausible unions, and their jurisdictions overlap. **List them neutrally. Don't rank by the agent's opinion.** Rank by verified organizing activity (recent petitions and wins), and show the evidence.

## Tasks

- [ ] **D1 Convert** `unions.csv` → `data/unions/*.json` and add `id`, `sectors[]`, `sources[]`.
- [ ] **D2 Verify intake links** for every `to verify` row. Rows marked TO VERIFY include SEIU, NUHW, UNITE HERE intake, RWDSU, USW, IAM, UE, CWA/CODE-CWA, NewsGuild, AFSCME CWU, IATSE/SAG-AFTRA/Equity/WGA, the airline unions, SEIU building services and the NABTU trades.
  - Method: open the union's official site and find the organizing or "start a union" page.
  - Record the URL, the date, and a one-line description of the form.
  - Don't use third-party listicles.
  - Accept: the row's status is `verified`, with `last_checked` set; otherwise it stays `to_verify` and its link doesn't render.
- [ ] **D3 OLMS locals pipeline.**
  - Download the OLMS Union Search yearly bulk file.
  - Parse it into `local` records: name, number, address, membership, parent union, file number.
  - Join to `union` on the affiliation code.
  - Overlay `organizing_active` from union sites (e.g. the Teamsters and UNITE HERE local finders).
  - Re-run yearly.
  - Accept: a script that is reproducible from the raw file; a row count per parent union; a spot check of 20 random locals against the OLMS site.
- [ ] **D4 Persuader data** for the employer research tool: OLMS LM-20/LM-21 reports (union-busting consultants hired by employers). Index them by employer name, with fuzzy matching.
- [ ] **D5 e-CBA index** for contract compare: the OLMS contract library, by industry and employer.
- [ ] **D6 Sector records** with plain-language job lists and BLS union density.
- [ ] **D7 Legal-rule records** seeded from `01-content.md` §Legal status, each with `history[]`.
- [ ] **D8 Help resources:** NLRB regional offices (Tier 1), worker centers, worker-side lawyer directories.
- [ ] **D9 Freshness job:** flag any record with `last_checked` older than 90 days (30 days for `legal_rule`) in a build report.

## Data hygiene

- No personal data about workers, ever, in `data/`.
- Union officer names only when they come from OLMS public filings, and only on profile pages.
- Corrections from the public go through an editor queue (no accounts; see `05-security.md`) and appear in the changelog.
