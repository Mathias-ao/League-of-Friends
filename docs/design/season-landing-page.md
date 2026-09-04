# Season Landing Page Design

Status: **Design baseline / V1 direction**  
Scope: **Desktop landing page, with Season as the default active tab**

This document anchors the agreed design direction for the League of Friends landing page. It is deliberately a design baseline rather than a frozen visual specification: layout, spacing, art direction, typography, and details can evolve, but future iterations should start from the hierarchy and interaction principles recorded here.

## 1. Purpose

The landing page should answer the questions players most often have when they open the League of Friends site:

1. **Where do I stand?**
2. **When is the next event?**
3. **Who am I playing?**
4. **What is coming later in the season?**
5. From there, players can move deeper into past battles, statistics, player profiles, and other league systems.

The front page follows a **less-is-more** philosophy. It should not attempt to expose every system, statistic, achievement, rivalry, or rule at once. Secondary information belongs inside the relevant tab or detail page.

A useful design test is:

> If an element does not help answer the primary question of the current screen, it must justify why it is visible.

The normal landing page should feel easy to scan in seconds while retaining enough atmosphere to make the league feel special.

---

## 2. Overall hierarchy

The page uses a simple vertical rhythm:

```text
HEADER
  Action banner        LEAGUE OF FRIENDS        User

HERO NEWS
  Large rotating league story / artwork

TAB BAR
  Season | Events | Battles | Players | W-Room | Statistics

SEASON CONTENT
  Next Event

  Season Standing
  Your Progression

  Season Schedule
```

The active tab expands naturally below the tab bar. Content is allowed to grow vertically and the page scrolls normally; the active area is not constrained to a fixed half-page container or internal scrollbar.

The **Season** tab is the default landing state.

---

## 3. Header

### League identity

**League of Friends** is centered and is the dominant header element.

The right side contains a login control when signed out and a compact user/profile control when signed in. Detailed account information such as Gold, Power Rating, settings, and sign-out should live inside that user control rather than being permanently displayed in the header.

### Action banners

The left side of the header can display a hanging medieval-style banner, but it must be **functional rather than decorative**.

The banner appears only when the player has a meaningful action to take, for example:

- RSVP for the next event
- Sign up for the season
- Respond to a challenge
- Check in on event day
- Complete another important league action

Clicking the banner should take the player directly to the relevant action.

When there is no pending action, the banner should disappear rather than showing filler content.

The action banner should remain visually subordinate to the centered League of Friends title. It should feel like a notification ribbon, not a competing hero element.

---

## 4. Hero news area

The large hero remains a defining visual element of the site.

It is used for major league stories such as:

- Season launch
- Major event reveal
- War Room opening
- Emperor / champion announcement
- Major rivalry or special league moment
- Trophy change or exceptional record when worthy of front-page treatment

### Hero behavior

- Large cinematic artwork remains appropriate.
- The hero can rotate between several news slides automatically.
- Auto-rotation should be slow and non-intrusive.
- Manual arrows and slide indicators should exist.
- Interaction should pause or otherwise avoid fighting the automatic rotation.
- The preferred transition is elegant and restrained, such as a crossfade or subtle movement, rather than a retail-style card carousel.

### Hero copy

Copy should be minimal so the art and headline have impact.

Example:

```text
SEASON I

THE THRONE AWAITS

League of Friends begins September 20.

READ THE STORY →
```

The full article/story is opened separately. Quotes, permanent slogans, and extra explanatory copy should generally be avoided in the normal hero.

---

## 5. Main tab bar

Primary navigation:

```text
SEASON | EVENTS | BATTLES | PLAYERS | W-ROOM | STATISTICS
```

A future **Global Standing** tab should be supported by the application but completely hidden until explicitly activated. It should not appear as a disabled or “coming soon” item.

### Visual direction

The tab bar should look like a **single continuous embossed grey-stone slab**, not a row of large modern dashboard buttons.

Inactive tabs:

- Grey / stone appearance
- Subtle embossed or carved treatment
- Restrained contrast

Active tab:

- Embossing catches more ivory, white, or pale-gold light
- Optional thin gold inlay / underline
- Clearly active without becoming a glowing button

The navigation should carry medieval/AoE character while remaining clean, fast, and readable.

---

# 6. Season content

The Season view should contain only three major content groups:

1. **Next Event**
2. **Season Standing + Your Progression**
3. **Season Schedule**

No duplicate recent-news section, motivational quote cards, top-performer widget, permanent War Room status panel, or large rules panel should compete with these elements.

Rules remain accessible through a secondary control or drawer.

---

## 7. Next Event

The Next Event is a full-width primary component.

It should communicate:

- Event name
- Event date and time
- Adaptive countdown
- Attendance / RSVP state
- The player’s warm-up matchup
- The main-event format
- A compact RSVP action
- A route to full Event details

The event itself may have its own heraldic banner or event art. The internal Act cards should **not** contain additional illustrations.

### Event structure: two acts

League events are designed around two parts.

#### Act I — Warm-up

- 1v1
- Approximately 30-minute time limit
- Pairings should help ensure that, across a season, players face as many different league opponents as possible, ideally everyone at least once
- The player’s own matchup is the most important information to display

Example:

```text
ACT I · YOUR WARM-UP

D'KARIUS       VS       RAGNAR

1v1 · 30 min
```

#### Act II — Main Event

The larger spectacle of the event, such as:

- 4v4
- 3v3
- 2v2
- FFA
- FFA Diplomacy
- Other special formats

Example:

```text
ACT II · MAIN EVENT

4v4 · EIGHT BANNERS
Teams revealed on event day
```

### RSVP controls

RSVP / decline controls should be compact.

- `I'M IN` can be the primary action.
- `Decline` should be visually secondary and take less space.
- The controls should not dominate the Event component.

### Adaptive countdown

The countdown becomes more precise as the event approaches.

- **More than 72 hours remaining:** show days only, e.g. `4 DAYS`
- **72 to 24 hours remaining:** show days and hours, e.g. `2 DAYS · 7 HOURS`
- **Less than 24 hours remaining:** show hours and minutes, e.g. `18 HOURS · 32 MINUTES`
- Seconds are unnecessary.

This creates increasing urgency without permanent visual noise.

---

## 8. Match-format sigil system

Game and event formats should use a reusable heraldic sigil system instead of illustrations inside utility components.

Core base sigils should include:

- **1v1**
- **Team Battle**
- **FFA**
- **FFA Diplomacy**

Special rules or victory modes should be represented as modifiers layered onto the base sigil where possible, for example:

- Wonder Race
- King of the Hill
- Other future special modes

The preferred visual grammar is:

> **Base sigil = match structure**  
> **Modifier = special victory condition / ruleset**

For example, a Wonder Race 1v1 should still visually read as `1v1 + Wonder`, while an FFA Wonder Race reads as `FFA + Wonder`.

This sigil language should later be reused in Events, Battles, Statistics, and other match-related interfaces.

---

## 9. Season Standing

The leaderboard receives a full-width row and should be one of the most important components on the page.

It should have enough horizontal space to remain readable and eventually support rare titles or awards without cramming the player name.

Baseline structure:

```text
SEASON STANDING

#   PLAYER                                W–L        POINTS
1   Ragnar — The Unbroken               14–3          41
2   Steve                                10–6          35
3   Lord Baguette                         9–7          31
4   Sir Lancelot                          8–8          29
5   Emperor D'Karius                      6–4          27
6   MBL                                   6–9          19
```

The viewer’s own row should have a restrained but unmistakable highlight.

### No permanent Trend column

A permanent Trend column should not exist.

Ranking movement can still be shown temporarily after standings change. For example, on the first visit following a completed event, a player might briefly see `▲ 2` or `▼ 1` beside affected rows. Once the update has been seen, the board returns to its clean baseline state.

This keeps movement impactful rather than turning it into permanent table clutter.

---

## 10. Your Progression

`Your Progression` is a **full-width footer attached to the leaderboard**, not a separate side card.

Its purpose is to provide a nearby competitive target.

Example:

```text
YOUR SEASON

5TH PLACE · 27 POINTS

NEXT TARGET
SIR LANCELOT · 29 POINTS

YOU
27 ●━━━━━━━━━━━━━━━━━━━━━━━━○ 29
                         LANCELOT

2 POINTS TO 4TH PLACE
```

If the viewer is first, the presentation changes from pursuit to defense, for example:

```text
YOU LEAD THE SEASON

1ST · 41 POINTS
Ragnar trails by 3 points
```

The goal is playful motivation, not aggressive gamification.

---

## 11. Titles, achievements, awards, and trophies

These concepts should remain visually and semantically distinct.

### Achievements

Achievements are collectible accomplishments.

- Mostly surfaced in the Profile and possibly on Player cards
- Not every achievement earns a public title or shiny emblem
- Generally more common than public distinctions

### Titles

Titles are more prestigious and appear immediately before or after the player name so they function grammatically as a title.

Example:

```text
Ragnar — The Unbroken
```

Titles can be persistent or transient.

Example: **The Unbroken** could require at least four completed matches with zero losses. If the player later loses, the title disappears.

Cool titles should remain rare enough to feel meaningful.

### Awards

Awards are rarer than normal achievements and represent exceptional or currently maintained performance.

Awards may be:

- Persistent
- Transient
- Conditional on continuing the behavior/performance that earned them

An award may expire if the holder no longer satisfies its condition.

### Trophies

Trophies are the strongest and rarest category and may be unique or transferable.

Example: **Wonder Trophy**

- Held by the player with the relevant Wonder distinction
- Once the War Room is open, another player may be able to challenge the holder to a Wonder Race
- The winner can take ownership of the trophy

This establishes the conceptual hierarchy:

> **Achievements are collected.**  
> **Titles are worn.**  
> **Awards are held.**  
> **Trophies can be taken.**

The leaderboard should remain visually sparse enough that a rare title, award, or trophy actually stands out.

Historical title/award ownership can later remain visible in player history even after it is no longer active.

---

## 12. Season Schedule

The horizontal Season Schedule remains further down the page and gives quick temporal orientation without duplicating the detailed Events tab.

It should behave as a connected timeline rather than a generic card carousel.

Example:

```text
SEP 20           OCT 04           OCT 18           NOV 01
   ●───────────────○────────────────○────────────────○
Eight Banners   Team Warfare     King's Gambit     Blood & Sand
NEXT
```

Visual behavior:

- Completed events become more subdued
- The current / next event receives the strongest treatment
- Future events remain restrained
- Event heraldic banners/sigils can give each event a recognizable identity
- Longer seasons can scroll horizontally

The detailed schedule, RSVP states, game lists, and event operations belong in the Events tab.

---

## 13. Visual direction

The target mix is a **modern competitive interface with restrained imperial/AoE character**.

Use:

- Dark charcoal / navy foundations
- Warm gold as a limited accent
- Strong serif display typography for important headings
- Highly readable modern text for normal UI copy
- Cinematic artwork primarily in the hero and major event/news surfaces
- Stone, heraldry, and sigils where they communicate structure or status
- Generous spacing and visual hierarchy

Avoid:

- Gold borders around everything
- Decorative medieval elements without purpose
- Repeating large illustrations inside every card
- Excessive glow
- Multiple equal focal points per section
- Permanent motivational copy and flavor quotes in utility areas
- Dashboard density for its own sake

The UI should remain fast and snappy. Atmosphere must not come at the expense of responsiveness.

---

## 14. Future post-event standings ceremony

Not part of the first frontend implementation, but the design should leave room for a later post-event ceremony.

When a player first logs in after an event they have not yet seen resolved, the application could show a full-screen standings animation before returning to the normal page.

Possible sequence:

1. Previous leaderboard appears as rows styled like heavy stone slabs.
2. Points animate from previous values to new values.
3. Ranking changes occur physically: slabs move vertically and can appear to push/break through neighboring rows.
4. Important changes such as taking first place can receive stronger treatment.
5. Once viewed, the ceremony is marked as seen for that player.

The normal leaderboard should still remain clean after the ceremony.

A future implementation will likely require concepts equivalent to:

- previous rank / new rank
- previous points / new points
- standing revision or event result revision
- per-player `lastSeenStandingRevision`

This is intentionally deferred until the core frontend exists.

---

## 15. Explicit non-goals for the landing page

The Season landing page should **not** attempt to be:

- A full statistics dashboard
- A complete battle archive
- A player-achievement gallery
- A War Room control center
- A news archive
- A rules encyclopedia
- An admin dashboard

Those functions belong behind the relevant tabs or secondary interactions.

The landing page wins when a player can open it and quickly understand:

> **My position. My next opponent. My next event. What comes after that.**

Everything else is one interaction deeper.
