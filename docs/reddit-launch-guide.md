# Reddit Launch Guide for prettify-ai.com

## The Pseudonym Question

**Short answer: No, use your real name (or an established account).**

Why:
- Reddit detects and bans new accounts that post promotional content
- Account age and karma matter for credibility
- If this takes off, you want credit linked to your professional identity
- Authenticity > anonymity for developer tools

If you don't have an existing Reddit account with karma, consider:
- Using your real account and being transparent ("I built this")
- Building karma first by commenting helpfully in relevant subs (takes time)
- Having a friend with an established account share it (with disclosure)

---

## Where to Post

### Tier 1: Best Fit (post first)
| Subreddit | Members | Why | Tone |
|-----------|---------|-----|------|
| r/ChatGPT | 5M+ | They copy-paste AI output constantly | Casual, helpful |
| r/ClaudeAI | 100K+ | Same pain point, your people | Technical, peer-to-peer |
| r/SideProject | 200K+ | Appreciate indie makers | Show the journey |

### Tier 2: Good Fit (post after initial feedback)
| Subreddit | Members | Why | Tone |
|-----------|---------|-----|------|
| r/webdev | 1M+ | Devs who make resumes/docs | Technical |
| r/artificial | 500K+ | AI tool enthusiasts | Balanced |
| r/resumes | 500K+ | Direct use case | Helpful, not salesy |

### Tier 3: Maybe Later
- r/InternetIsBeautiful (very picky mods)
- r/productivity (broad audience)
- r/jobs (resume-focused)

---

## Post Templates

### For r/ChatGPT or r/ClaudeAI (conversational)

**Title options:**
- "I built a free tool to turn ChatGPT markdown into professional PDFs"
- "Made a thing: paste AI output → get styled PDF/DOCX (no signup)"
- "Free tool to prettify LLM markdown output for resumes/docs"

**Body:**
```
Hey everyone,

I kept running into the same problem: ChatGPT/Claude gives me nicely formatted markdown, but when I need to send it as a real document, I'm stuck copy-pasting into Word and fixing formatting for 20 minutes.

So I built [prettify-ai.com](https://prettify-ai.com) - paste markdown, pick a theme, export as PDF or DOCX. That's it.

**What it does:**
- Converts markdown to styled documents
- Multiple themes (Professional, Modern, etc.)
- Exports to PDF or DOCX
- Works entirely in browser, no data sent anywhere

**What it doesn't do:**
- No AI generation (you bring your own markdown)
- No signup/account required
- No tracking beyond basic Cloudflare analytics

Built with Astro + React, hosted on Cloudflare Pages. Totally free.

Would love feedback - what themes or features would be useful?
```

### For r/SideProject (maker-focused)

**Title:** "prettify-ai.com - LLM markdown → professional docs (free, no signup)"

**Body:**
```
**What I built:** A simple converter that takes markdown (like ChatGPT/Claude output) and turns it into styled PDF/DOCX documents.

**Why:** I got tired of reformatting AI-generated resumes and documents. The markdown is already structured - it just needs styling.

**Tech stack:** Astro, React, TipTap editor, docx library, Cloudflare Pages

**Link:** https://prettify-ai.com

**Looking for:** Feedback on UX and what themes people actually want.

No monetization yet - just scratching my own itch.
```

---

## Timing

**Best times to post (US-centric Reddit):**
- Tuesday-Thursday, 9-11 AM EST
- Sunday evening, 7-9 PM EST

Avoid: Friday night, Saturday (lower engagement)

---

## Do's and Don'ts

### Do:
- Be honest: "I built this" not "found this cool tool"
- Engage with every comment (even critical ones)
- Answer questions quickly in first 2 hours
- Thank people for feedback genuinely
- Cross-post with 24hr gaps between subs
- Upvote helpful comments (not your own post from alts!)

### Don't:
- Post to multiple subs simultaneously (looks spammy)
- Get defensive about criticism
- Over-explain or over-sell
- Use marketing language ("revolutionary", "game-changing")
- Ignore negative feedback
- Delete and repost if it doesn't take off

---

## Handling Common Responses

**"Why not just use [Pandoc/existing tool]?"**
> "Good point - Pandoc is great if you're comfortable with CLI. This is for people who want to paste and click. Different use cases!"

**"This is just a markdown editor"**
> "Fair - the value is specifically in the PDF/DOCX export with professional styling. If you already have a workflow that works, you probably don't need this."

**"What about privacy?"**
> "Everything runs in your browser. No data is sent to any server. You can verify in dev tools - the only network requests are to load the page itself."

**"Will you add [feature]?"**
> "Interesting idea! What's your use case?" (gather info before committing)

---

## Success Metrics

Don't obsess over upvotes. Track:
- Unique visitors (Cloudflare analytics)
- Time on site
- Conversion to PDF/DOCX export
- Actual feedback themes (what do people want?)

A post with 50 upvotes and 10 useful comments > 500 upvotes and no engagement

---

---

## Templates for Resume/Job-Seeking Subreddits

### For r/resumes

**Title:** "Free tool to convert AI-generated resume markdown to PDF/DOCX"

**Body:**
```
I made a simple tool that might help some of you: [prettify-ai.com](https://prettify-ai.com)

**The problem it solves:**
A lot of people here use ChatGPT or Claude to help write their resumes. The AI gives you nicely structured markdown, but then you spend 20+ minutes reformatting it in Word or Google Docs.

**What it does:**
- Paste your markdown resume
- Pick a clean, professional theme
- Export as PDF or DOCX
- Edit text directly if needed

**What it doesn't do:**
- No AI writing - you bring your own content
- No account or signup
- No data stored anywhere (runs in your browser)

It's free. I built it because I was tired of the copy-paste-reformat dance myself.

Happy to hear feedback on what themes or features would be useful for resumes specifically.
```

---

### For r/jobs

**Title:** "Made a free tool for formatting AI-written resumes into clean PDFs"

**Body:**
```
Quick share for job seekers using AI to help with resumes:

If you're using ChatGPT/Claude to write or improve your resume, you've probably noticed the output is markdown - great structure, but annoying to format into a real document.

I built [prettify-ai.com](https://prettify-ai.com) to fix that:

1. Paste your AI-generated markdown
2. Choose a professional theme
3. Download as PDF or DOCX

That's it. No signup, no fees, no AI generation (you bring your own content).

Works for cover letters too - anything that's already in markdown format.

Let me know if this is useful or what would make it better.
```

---

### For r/GetEmployed

**Title:** "Free tool: AI resume markdown → professional PDF in 30 seconds"

**Body:**
```
For those of you using AI assistants to help with job applications:

I kept running into the same problem - ChatGPT gives me a well-structured resume in markdown, but I'd spend forever reformatting it to look professional.

So I made [prettify-ai.com](https://prettify-ai.com):
- Paste markdown
- Pick a theme
- Export PDF or DOCX

No AI generation, no account needed, runs entirely in your browser.

Figured it might save some of you time during the application grind.
```

---

### For r/careerguidance

**Title:** "Built a tool for converting AI-written career docs to professional format"

**Body:**
```
If you're using AI to draft resumes, cover letters, or other career documents, you might find this useful:

[prettify-ai.com](https://prettify-ai.com) takes markdown (what ChatGPT/Claude outputs) and converts it to styled PDF or DOCX with one click.

**Why I made it:** I was helping friends with their job searches and kept seeing them struggle to get AI output into a presentable format. The content was good, but they'd lose 30 minutes fighting with Word formatting.

**It's free** - no signup, no tracking, no AI generation (you bring your own markdown).

Would love feedback from people actively job searching on what themes or features would help.
```

---

### Tips for Resume Subreddits Specifically:

1. **Don't oversell** - these communities are skeptical of self-promotion
2. **Emphasize "no AI writing"** - they value human-written content
3. **Focus on the formatting pain point** - they all know it
4. **Offer to help** - respond to questions about resume formatting generally
5. **Don't spam** - pick ONE resume sub to start, wait for feedback

**Best bets in order:**
1. r/resumes (most relevant, active community)
2. r/jobs (broader but receptive to tools)
3. r/GetEmployed (smaller but engaged)

---

## After Posting

1. **First hour:** Respond to every comment immediately
2. **First day:** Check every few hours
3. **First week:** Note feature requests and complaints
4. **Iterate:** Ship improvements, post update if significant

---

## Your Checklist Before Posting

- [ ] Site is live and working (test PDF + DOCX export)
- [ ] Mobile works reasonably well
- [ ] No embarrassing console errors
- [ ] Sample content loads correctly
- [ ] You've used the tool yourself recently
- [ ] You have 2 hours free to engage with comments
