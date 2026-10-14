# Editorial brief for the articles

The standard every article on `/articles` is written to (D-34). It follows Orgpuls's D-235: an article answers
one question the way a good trade paper would, and sells nothing. The rules that can be code are code
(`lib/site/article-content.ts`); `node scripts/verify/article.mjs <slug>` runs them.

## Who reads it

The person who leads a leadership team: a chief executive, managing director, or division or department head.
HR and people leaders, and team coaches, read it too. They are busy and sceptical, and they know their trade.
Write for a reader who will check a claim.

## What an article is

- **One question, answered first.** The title carries the words people search. The lead's first sentence
  answers the question in plain words. The rest of the article earns that answer.
- **Sells nothing.** Never name the product, a plan, a price, a trial or a sign-up. Never write "our tool".
  Links in the text go only to other articles. The free template at the foot is a resource, and the page
  shows it; the text does not point to it.
- **Every claim has a source.** Name the study in the text as (Author, Year) or (Author and Author, Year),
  and list it under `sources`. At least five sources. A claim with no source is cut, not softened into
  vagueness.
- **Never invent.** No number, effect size, percentage or finding that is not in a source you read. No
  customer, no quote from a person, no case story presented as real. An illustrative example is labelled
  as one ("For example, a team might…").
- **Fair to the models it discusses.** Describe a popular model as its author does before saying what the
  research says. Respectful, never dismissive.
- **Useful.** Every article ends with what a leader can do this month: questions to ask the team, a
  practice to try, or a test to run in the next meeting.

## Sources

- Prefer peer-reviewed studies and meta-analyses, then books by the researchers themselves, then
  practitioner articles by researchers (Harvard Business Review, MIT Sloan Management Review).
- Check every source before listing it: authors, year, title, journal with volume, issue and pages, or the
  publisher for a book. Use the DOI address (`https://doi.org/...`) where one exists, else the publisher's
  page. Search for it; open it. A source you could not confirm is not listed.
- Write the record as the source writes itself: a journal's American spelling stays in `sources`.
- State a finding only as strongly as the source does. A correlation is not a cause. One study is "a study
  found", a meta-analysis is "across N studies". Where research is mixed, say so.
- Do not quote a source word for word. Say it in your own words and cite it.

## Words

The copy rules of handoff section 10 hold, and the check fails an article that breaks them:

- **British spelling:** organisation, behaviour, recognise, prioritise, analyse, centre, programme,
  judgement, defence, favour, labour. "Program" only for computer code, which an article does not need.
- **Sentences under 25 words.** A colon or a semicolon does not end a sentence; a full stop does. Count.
- **No emoji.** No "proven". No "validated" (write "tested", or say what the evidence is).
- Plain words. Short paragraphs of two to four sentences. Active voice. "You" is the reader who leads
  the team.
- "Leadership team" in the text; "top management team" or "senior leadership team" only where a study uses
  the term.
- Headings are the questions a reader asks, in their words: "How big should a leadership team be?"

## Shape

| Part | Rule |
|---|---|
| `title` | At most 65 characters. Opens with the search words. No product name |
| `description` | At most 155 characters. Says what the reader gets |
| `h1` | The question or the topic, in the reader's words. May match the title |
| `lead` | Two to four sentences. The first answers the question |
| `takeaways` | Three to five short points: the answer in a list |
| `blocks` | 1,100 to 2,600 words in all, with at least four `h2` headings |
| `sources` | At least five, checked |

Blocks: `h2`, `h3`, `p`, `ul`, `ol`, `box` (a rule of thumb or questions for the team), `cards` (two to six,
numbered when their order is the point), and `table` (two to four columns). Text may carry `**bold**` and
`[words](/articles/slug)`, nothing else.

## Figures (D-41)

Every article draws its argument at least twice. A figure's words keep the same rules as the text; the drawing is
the site's. Draw what the text already says: a figure never carries a claim the text does not make.

| Figure | Use it for |
|---|---|
| `steps` | A process the reader follows, three to eight steps |
| `flow` | Stages that lead into each other, three to five; with `axis`, ordered from least to most |
| `pyramid` | Levels resting on each other, the base first |
| `pillars` | What holds up a whole: the roof and two to four pillars |
| `matrix` | Two dimensions, low to high, and the four cells they make |
| `compare` | Two things side by side, two to five points each |
| `fork` | One starting point and the two ways it can go, each with its condition |
| `rings` | Circles inside each other, the innermost first |
| `cycle` | Four steps that lead back to the first |
| `stats` | Two to four figures from the sources, each citing its source |
| `bars` | A bar chart |
| `timebar` | A meeting's minutes, item by item: an example |
| `spread` | Answers on a five-point scale, team by team: an example |
| `specimen` | A filled-in agenda item or charter, marked as an example or a sample |

**Every number says where it comes from.** A chart's `basis` is a source (`{ "source": 3 }`, its number in the
list), arithmetic written out (`{ "arithmetic": "A team of n members has n × (n − 1) ÷ 2 pairs." }`), or an example
the text sets out (`{ "example": true }`), which the figure marks. A model or finding drawn from a source cites it
with `source`. A cited number must be in the list; the checker refuses one that is not.

Each published article also has a drawing beside its title and on its card: its `art` in `lib/site/articles.ts`.

Link to at least two other published articles in the text, with the words of the search the other article
answers as the link's words.

## A data file

```json
{
  "title": "Leadership team size: how big should it be?",
  "description": "What the research says about the size of a leadership team, and how to keep a large one working.",
  "h1": "How big should a leadership team be?",
  "lead": "Smaller than most are. …",
  "takeaways": ["…", "…", "…"],
  "blocks": [
    { "t": "h2", "text": "Why does size matter?" },
    { "t": "p", "text": "… (Hackman, 2002). See also [the purpose of a leadership team](/articles/leadership-team-purpose)." },
    { "t": "ul", "items": ["…", "…"] },
    { "t": "box", "title": "A question for your team", "text": "…" },
    { "t": "table", "head": ["…", "…"], "rows": [["…", "…"]] }
  ],
  "sources": [
    {
      "authors": "Hackman, J. R.",
      "year": 2002,
      "title": "Leading teams: Setting the stage for great performances",
      "venue": "Harvard Business School Press",
      "url": "https://..."
    }
  ]
}
```
