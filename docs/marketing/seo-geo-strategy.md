# Search and AI-answer strategy for leaderpact.com (SEO and GEO), 13 October 2026

The owner's request (13 October 2026): optimise LeaderPact for search, with a large set of articles, a free
download behind an e-mail address, pages that describe the platform, and the articles and SEO in Sentral by
API. The standard is Orgpuls's (its `docs/marketing/seo-geo-strategy.md`, D-235, D-241, D-281): articles inform
and sell nothing, every claim has a source, and product claims live on product pages.

This is the working strategy. The keyword → page map in section 4 is the ledger, and it is data:
`lib/site/inventory.ts` builds it from the registries, the tests hold it to one page per search, and Sentral
receives it (D-36). Change the map and the pages together.

## 1. Where we are

- **The site is new and indexed since 14 October 2026** (D-40, the owner's word). Only `www.leaderpact.com` is
  indexed; the private pages and every other host say `noindex`. Google finds the pages through the sitemap
  submitted in Search Console (section 9).
- **The positioning** is the owner's market angle (artifact "Optimal Solution and Market Angle", section "SEO
  plan to lead worldwide"): the research-based way to make a leadership team perform, opened by a free
  assessment any leader can run without a consultant. The head terms to own are "leadership team assessment"
  and "leadership team effectiveness". Avoid "leadership team development", "executive team" and "senior
  leadership team" as head terms.
- **What is in place after this change** (D-34 to D-38):
  - ten articles under `/articles`, each with at least eight checked sources (section 5);
  - two free Word templates behind an e-mail address under `/templates`;
  - four product pages: `/platform`, `/research`, `/anonymity` and `/leadership-team-assessment-tools`;
  - five feature pages under `/platform/`, one per feature built, with screenshots of the real app (D-47);
  - a canonical address, Open Graph and Twitter cards on every public page, and a share card per page;
  - JSON-LD: Organization, WebSite and SoftwareApplication on the landing page; Article with `citation` on every
    article; FAQPage on the product pages; BreadcrumbList and CollectionPage where they apply;
  - `/sitemap.xml`, `/robots.txt` and `/llms.txt`, all built from the registries;
  - the content inventory in Sentral's Growth › SEO, and template requests as Sales tickets and leads there.

## 2. How AI answers pick their sources (GEO)

An AI answer is a search followed by a summary. Google's AI Overviews and AI Mode search Google's index;
ChatGPT search and Copilot search Bing's; Claude searches Brave's; Perplexity its own and others. So GEO rests
on SEO: a page no index ranks is never retrieved. Beyond ranking, a passage is quoted when:

- it answers the question in its first sentences, in the question's own words (every article's lead does);
- it carries checkable facts, with sources, rather than adjectives (every article lists its sources, and the
  Article data names them as `citation`);
- the entity is unambiguous: who publishes it, what the product is (TODO(owner): the company's legal name and
  registration, `PUBLISHER` in `lib/site/config.ts`, and the LinkedIn page for `sameAs`);
- other sites name it. For "which tool" questions an engine recommends what several independent sources list.
  That is earned off-site (section 7).

What we do not do: no AI-only text, no hidden text, no instructions to crawlers inside pages, no invented
reviews, lists or figures, and no bought placements in "best tools" lists.

## 3. Six moves

1. **One page per search.** Every search cluster has exactly one target page (section 4). The tests refuse a
   search that is the first of two pages.
2. **Tools first, then evidence, then data** (the owner's plan). The landing page and the Leader Profile answer
   the tool searches; the articles and `/research` earn authority; original data comes later (section 8).
3. **Answer first.** Every title opens with the words of its search; every lead answers it in one sentence.
4. **Be the source answers quote.** Articles cite research by DOI; product pages state only what the product
   enforces, so an engine that quotes them quotes something true.
5. **Resources that earn links.** The free templates are the reason for a coach, an HR network or a newsletter
   to link to the site. More follow (section 6).
6. **Measure weekly, decide monthly** (section 8), in Sentral.

## 4. Keyword → page map

The first search in each row is the one the page is the answer to. Every search in the table is a tracked
keyword in Sentral.

| Searches | Page | Kind |
|---|---|---|
| leadership team assessment; executive team effectiveness assessment; leadership team effectiveness survey | `/leadership-team-assessment` | Free tool |
| leadership assessment test free; big five personality test for leaders | `/leader-profile` | Free tool |
| leadership team assessment tools; best leadership team assessment; team effectiveness assessment tool | `/leadership-team-assessment-tools` | Product page, FAQ |
| leadership team platform; leadership team software | `/platform` | Product page, FAQ |
| team effectiveness model; leadership team effectiveness research | `/research` | Product page, FAQ |
| anonymous leadership team survey; anonymous team survey | `/anonymity` | Product page, FAQ |
| leadership team scan; free leadership team assessment | `/platform/leadership-team-scan` | Feature page, screenshots, FAQ |
| leadership team survey results; team survey agreement | `/platform/team-view` | Feature page, screenshots, FAQ |
| leader personality profile; big five test for leaders | `/platform/leader-profile` | Feature page, screenshots, FAQ |
| leadership team charter software; team decision rights | `/platform/team-charter` | Feature page, screenshots, FAQ |
| leadership team diagnostic; team effectiveness diagnostic | `/platform/full-diagnostic` | Feature page, screenshots, FAQ |
| leadership team action plan; team development plan; action plan after a team survey | `/platform/focus-areas` | Feature page, screenshots, FAQ |
| leadership team meeting software; run leadership team meetings | `/platform/meetings` | Feature page, screenshots, FAQ |
| leadership team pulse survey; team pulse check | `/platform/pulses` | Feature page, screenshots, FAQ |
| leadership team effectiveness; high performing leadership team; how to build a high performing leadership team; leadership team effectiveness models; signs of an ineffective leadership team | `/articles/what-makes-a-leadership-team-effective` | Article (pillar) |
| how to assess a leadership team; leadership team effectiveness survey questions; how to measure leadership team effectiveness | `/articles/how-to-assess-a-leadership-team` | Article |
| five dysfunctions of a team; five dysfunctions of a team assessment; lencioni model research | `/articles/five-dysfunctions-of-a-team-and-the-research` | Article (comparison) |
| purpose of a leadership team; role of a leadership team; what is a leadership team for | `/articles/leadership-team-purpose` | Article |
| leadership team charter; team charter template; how to write a team charter | `/articles/leadership-team-charter` | Article |
| leadership team size; how big should a leadership team be; optimal team size | `/articles/how-big-should-a-leadership-team-be` | Article |
| leadership team meeting agenda; leadership team meeting agenda template; leadership team meeting topics | `/articles/leadership-team-meeting-agenda` | Article |
| psychological safety in leadership teams; psychological safety; psychological safety at the top | `/articles/psychological-safety-in-leadership-teams` | Article |
| how to build trust in a leadership team; trust in leadership teams; building trust in a senior team | `/articles/how-to-build-trust-in-a-leadership-team` | Article |
| task conflict and relationship conflict; task conflict; conflict in leadership teams | `/articles/task-conflict-and-relationship-conflict` | Article |
| leadership team charter template; team charter template | `/templates/leadership-team-charter-template` | Free template |
| leadership team meeting agenda template; executive meeting agenda template | `/templates/leadership-team-meeting-agenda-template` | Free template |
| leadership team effectiveness checklist; team effectiveness checklist | `/templates/leadership-team-effectiveness-checklist` | Free template |

Two searches deliberately appear on two pages, never as the first of both: "team charter template" (article
and template) and "leadership team meeting agenda template" (article and template). The template page is the
answer to the template search; the article links to it at its foot. Watch them in Search Console and merge the
cluster if Google alternates.

## 5. The article plan: twenty, ten published

Every article follows `docs/marketing/editorial-brief.md`: one question answered first, sells nothing, every
claim sourced and checked, British English, sentences under 25 words. Five writers wrote the first ten; three
independent fact-checkers then checked every source and claim against the source itself. Each article's
sources are listed on the page, and the Article data carries them as `citation`.

| # | Article | First search | Section | Status | Template at its foot |
|---|---|---|---|---|---|
| 1 | What makes a leadership team effective? | leadership team effectiveness | Where to start | Published 13 Oct 2026, rewritten 18 Oct (D-67) | Checklist |
| 2 | How to assess a leadership team | how to assess a leadership team | Where to start | Published 13 Oct 2026 | |
| 3 | The five dysfunctions of a team: what does the research say? | five dysfunctions of a team | Where to start | Published 13 Oct 2026 | |
| 4 | What is the purpose of a leadership team? | purpose of a leadership team | Purpose, tasks and membership | Published 13 Oct 2026 | Charter |
| 5 | How do you write a leadership team charter? | leadership team charter | Purpose, tasks and membership | Published 13 Oct 2026 | Charter |
| 6 | How big should a leadership team be? | leadership team size | Purpose, tasks and membership | Published 13 Oct 2026 | Charter |
| 7 | Leadership team meeting agenda: how to build one that works | leadership team meeting agenda | Meetings and decisions | Published 13 Oct 2026 | Agenda |
| 8 | Psychological safety in leadership teams | psychological safety in leadership teams | How the team works together | Published 13 Oct 2026 | |
| 9 | How do you build trust in a leadership team? | how to build trust in a leadership team | How the team works together | Published 13 Oct 2026 | |
| 10 | Task conflict and relationship conflict | task conflict and relationship conflict | How the team works together | Published 13 Oct 2026 | Agenda |
| 11 | Direction, alignment and commitment | direction alignment commitment | Where to start | Planned | |
| 12 | Anonymous surveys in small teams | anonymous survey small team | Where to start | Planned | |
| 13 | How often should you measure a leadership team? | team pulse survey frequency | Where to start | Planned | |
| 14 | The team leader's role: design before coaching | role of the leader of a leadership team | Purpose, tasks and membership | Planned | |
| 15 | Leadership team composition | leadership team composition | Purpose, tasks and membership | Planned | Charter |
| 16 | Why leadership team meetings fail | ineffective leadership team meetings | Meetings and decisions | Planned | Agenda |
| 17 | Decision making in leadership teams | leadership team decision making | Meetings and decisions | Planned | Agenda |
| 18 | Behavioural integration: working as one team | leadership team alignment | How the team works together | Planned | |
| 19 | Political behaviour in leadership teams | politics in the leadership team | How the team works together | Planned | |
| 20 | Team learning and reflection | team reflexivity | How the team works together | Planned | |

Notes for the planned ten, so the next writer starts from the right sources (each to be checked before use):

- **11. Direction, alignment and commitment:** Drath, McCauley, Palus, Van Velsor, O'Connor and McGuire (2008),
  Leadership Quarterly 19(6); CCL's DAC material. The outcome every leadership team is judged by.
- **12. Anonymous surveys in small teams:** minimum-response thresholds, why a lowest score or a subgroup points
  to one person, padding of open links. No product figures; reasoning and the survey-methods literature.
- **13. How often to measure:** baselines and pulses; change that exceeds noise; survey fatigue research.
- **14. The team leader's role:** Hackman and Wageman (2005), Academy of Management Review 30(2), on when team
  coaching works; Wageman et al. (2008) on design before coaching.
- **15. Composition:** the upper-echelons literature (Hambrick and Mason, 1984) and the mixed evidence on
  diversity in top teams; descriptive, never a target.
- **16. Why meetings fail:** Bang et al. (2010); Kauffeld and Lehmann-Willenbrock (2012); Rogelberg (2019).
- **17. Decision making:** decision rights, Eisenhardt's work on fast strategic decisions in top teams, and the
  dialectical methods of Schweiger, Sandberg and Ragan (1986).
- **18. Behavioural integration:** Hambrick (1994) and Simsek, Veiga, Lubatkin and Dino (2005), Academy of
  Management Journal 48(1).
- **19. Political behaviour:** Eisenhardt and Bourgeois (1988), Academy of Management Journal 31(4), on politics
  in top management teams.
- **20. Team learning:** Edmondson (1999); team reflexivity (West); after-action reviews.

Publish the second ten one or two a week, not in a burst. Each gets its share card, a place in the sitemap,
`llms.txt` and the inventory (all automatic from `lib/site/articles.ts`), and links from the text of the
articles next to it.

## 6. The free downloads

| Template | Page | File | Goes with |
|---|---|---|---|
| Leadership team charter | `/templates/leadership-team-charter-template` | Word, two pages, seven sections | Articles 1, 4, 5, 6 |
| Leadership team meeting agenda | `/templates/leadership-team-meeting-agenda-template` | Word, landscape, item types and a close | Articles 7, 10 |
| Leadership team effectiveness checklist | `/templates/leadership-team-effectiveness-checklist` | Word, two pages, 20 statements in four layers, no score | Article 1 |

The gate is soft, as Orgpuls's is (D-241): a name and an address, organisation and role if the person wants,
and an unticked box for e-mail about new templates and articles. The request goes to Sentral as a
`template.requested` event and becomes a Sales ticket and a CRM lead there. LeaderPact keeps only the browser's
cookie. Next candidates, each built from what the articles already say: a working-agreements starter list, a
"does this need the whole team?" card, and a one-page guide to reading a team result with level and agreement.

## 7. The owner's list: off-site authority and the entity

The site cannot do these itself. In rough order of value per hour:

1. **The entity.** Give the company's legal name, registration and LinkedIn page; they go into the
   Organization data (`PUBLISHER`).
2. **Team coaches and facilitators** (the owner's first channel): a linkable resource page or a co-written
   article is a real link from a relevant site. The templates are the reason to link.
3. **Founder-led content:** one finding and one practice per post, on LinkedIn and in a newsletter, each linking
   the article it comes from.
4. **Vendor profiles** that answer engines read for "best tool" questions (G2, Capterra), with the same name,
   description and address everywhere, once the product is ready to be listed.
5. **Google Search Console** is registered (14 October 2026). Give Sentral's service account,
   `orgpuls-search-console@orgpuls-seo.iam.gserviceaccount.com`, read access to the property so its nightly
   import runs. Bing Webmaster Tools can import the Google property in one step.
6. **Reviews** from customers, once there are customers. Never written by us.

## 8. Measurement

**Weekly, in Sentral (Growth › SEO):** impressions, clicks and position for each section 4 search, and which
page ranks for it (does it match the map?); the number of target searches in the top 10; visits by channel,
including AI referrals, once the site's own counting is switched on (section 9).

**Monthly AI prompt panel.** Ask ChatGPT (search on), Perplexity, Google (AI Mode or AI Overview) and Copilot
these questions in a logged-out session. Record per answer: the product named (y/n), leaderpact.com cited (y/n,
which address), and which others are named. Keep the answers in `docs/marketing/ai-panel/<YYYY-MM>.md`.

1. What is the best tool for assessing a leadership team?
2. How do you assess how well a leadership team works?
3. What makes a leadership team effective?
4. How big should a leadership team be?
5. How do you build psychological safety in a senior team?
6. What should a leadership team meeting agenda include?
7. Is there a free leadership team assessment?
8. What does research say about the five dysfunctions of a team?
9. How do you build trust in a leadership team?
10. How do you keep a team survey anonymous in a small team?

**Original data, later.** A benchmark of leadership teams is the asset nobody else has (owner's plan). It waits
for real data, must keep the threshold across groups, and is the owner's decision. Never a made-up benchmark.

## 9. Open decisions for the owner

1. **Search Console** (indexing is on since D-40). Verify the domain `leaderpact.com`, submit
   `https://www.leaderpact.com/sitemap.xml`, and add Sentral's service account
   `orgpuls-search-console@orgpuls-seo.iam.gserviceaccount.com` as a restricted user so Sentral imports the
   figures (D-39). Bing Webmaster Tools can import the property from Search Console.
2. **The privacy page** must describe template requests (what is kept, where, for how long, the legal basis and
   the e-mail consent) before the form collects addresses at scale. Orgpuls's privacy statement has such a
   section to adapt. The legal text is the owner's (`TODO(owner)` in the page).
3. **The site's own visit counting** in Sentral is on since 14 October 2026 (D-39), on the owner's word. It never
   runs on the scan, the invite link, the Leader Profile's tests or the app. The privacy page should say so.
4. **The entity** (section 7, item 1).

## 10. The head term: "leadership team effectiveness" (18 October 2026, D-67)

**Where it stands.** Position 58.5 with 2 impressions, four days after indexing, on the pillar. The results are
guides, mostly by consultancies (Bain, McKinsey, CCL, Russell Reynolds, HBS Working Knowledge, HBR); about seven
in ten are guides and the rest service pages. They cite little. Nobody compares the models with their evidence.
"Leadership and team effectiveness" is a different intent (coursework) and is not a target.

**Phase 1, on the site: done (D-67).** The pillar rewritten to answer the term, five links to it from the other
articles and one from every footer, the Article data's `about` and `mentions`, the effectiveness checklist, and
the keyword map above.

**Phase 2, weeks 2 to 8: the cluster.**
- A new article, "Team effectiveness models: which fit a leadership team?", for "team effectiveness models",
  "hackman model of team effectiveness" and similar searches, whose results are weak lists. It links to the
  pillar; `/research` then drops "team effectiveness model".
- The planned articles that feed the pillar most: 11 (direction, alignment and commitment), 18 (alignment),
  14 (the team leader's role), 16 (why meetings fail) and 17 (decision making), one or two a week.

**Phase 3, from now: authority.** Most of it is the owner's.
- An annotated bibliography of about fifty studies, each with a plain paragraph and its DOI, built from the
  articles' checked sources. Library guides, coach trainings and AI answers cite such lists.
- Outreach, about six hours a week: the scan and the templates to team coaches and their resource pages,
  expert-quote requests (Qwoted, Featured), podcasts on team coaching and organisational development.
- The owner's LinkedIn: a finding, a practice and a question for the team each week; a newsletter every two
  weeks; a webinar each month with a team coach.
- Never: bought links or placements, link swaps, footer links between our products, invented figures.

**Targets, not forecasts** (the marketer's): 15 to 20 editorial referring domains and the term between 20 and
35 by month 3; 30 to 40 domains and 11 to 20 by month 6; 45 to 60 domains and 6 to 12 by month 9. Fewer than 10
referring domains at month 3 means moving effort to coaches and podcasts. Run the AI prompt panel (section 8)
now, as month 0, and add Claude to its engines.

**Decisions for the owner.**
1. The name. "The Leadership Pact" is a leadership workshop with a close name, and the trademark check is open.
   LinkedIn, Crunchbase, G2 and the Organization's `sameAs` wait for it, and so does a permanent root redirect.
2. A named author or reviewer for the articles. Every guide on page one names one; ours names the company.
3. A Norwegian article for "effektivitet i lederteam", which already shows impressions against thin results.
   The site is English only, so this is a decision about scope.
4. Bing Webmaster Tools (import the Search Console property; ChatGPT search and Copilot read Bing's index),
   Ahrefs Webmaster Tools (free, for links), and Search Console's Links report for links to the old site's
   addresses (D-50).
5. Who gives outreach its hours each week.

**Sentral's advice.** Sentral's rule for a keyword below position 20, "create a dedicated landing page", reads
no intent and no age. It should wait for eight to twelve weeks below 20 with steady impressions, or for Google
ranking a different page than the map names, before it says so.
