# Resume Coach - Product Context

## Conversion Points

### Free → Account (Sign Up)
- **Trigger**: "Want to access your resume from any device? Sign in to sync."
- **When**: User has invested time in building a resume in localStorage
- **Value exchange**: Cross-device access, data persistence beyond browser

### Free → Pro
- **Trigger**: User hits 1-document limit, wants multiple profiles/versions
- **When**: User realizes they need different resumes for different job types
- **Value exchange**: Multiple document slots (10+), multiple profiles per resume

## User Journey

1. **Entry**: Land on site (via Reddit, search, referral)
2. **Immediate value**: Start coaching conversation OR paste existing resume
3. **Investment**: Spend 10-30 min refining resume with coach
4. **Export**: Download PDF/DOCX, apply to job
5. **Return**: Come back for next application, data still there (localStorage)
6. **Friction**: Switch device, lose data → conversion opportunity

## Architecture Notes

### Storage Migration Path
```
LocalStorage (now, anonymous)
    ↓
D1 + device ID (users but no auth)
    ↓
D1 + Clerk auth (real accounts)
    ↓
D1 + Clerk + Stripe (Pro tier)
```

### Domain Strategy
- **resumecoach.co**: Strategic product, chat-driven coaching
- **prettify-ai.com**: Utility, paste-and-format, top-of-funnel

## User Segments

### Segment A: Traditional Roles
**Who**: Working class, non-AI-savvy users applying to well-defined jobs
- Warehouse supervisor → logistics coordinator
- Retail worker → office admin
- Healthcare aide → nursing program
- Construction foreman → project manager
- Restaurant manager → hospitality management

**Characteristics**:
- May not have ChatGPT accounts
- Don't know "prompt engineering"
- Real experience, no language for it
- Often mobile-only

**Product mode**: Guided flow
- Job category selection from library
- Known checklists and success signals
- Pre-built templates per role
- Less discovery, more fill-in-the-blanks
- Higher confidence in output (less ambiguity)

### Segment B: Specialized/Evolving Roles
**Who**: Tech, knowledge workers, professionals in changing fields
- Engineers, product managers, designers
- Data scientists, analysts
- Consultants, strategists

**Characteristics**:
- May already use AI tools
- Experience doesn't fit current hiring templates
- Need strategic interpretation, not just formatting
- Complex "what story to tell" decisions

**Product mode**: Strategic conversation
- Interpretation lenses (metrics vs. narrative vs. hybrid)
- Job description analysis
- Discovery conversation
- More ambiguity, requires coaching

### Segment C: Gap Navigators
**Who**: Anyone re-entering workforce after life interruption
- Caregivers returning to work (kids, aging parents, sick spouse)
- Career changers
- Layoff survivors
- Health recovery

**Characteristics**:
- Need reframing strategies for gaps
- Confidence often low
- May span both traditional and specialized roles

**Product mode**: Empathetic coaching + reframing
- Gap explanation strategies
- Transferable skills identification
- Emotional support built into tone

## Entry Point UX

> "What kind of job are you applying for?"
>
> `[Traditional role]` → Guided template flow
> `[Specialized/tech role]` → Strategic coach flow
>
> OR
>
> "I know exactly what job I want" → Template mode
> "I'm figuring out my options" → Coach mode

The underlying engine (schema, chat, proposals, export) is the same. The experience adapts based on entry point.

## Core Insight

The problem isn't formatting. It's **translation**.

Users have real experience but it doesn't speak the language employers are listening for. The coach helps them figure out *which story to tell* for *this specific target*.

## Differentiation

Most resume tools are:
- Formatters (make it pretty)
- Keyword stuffers (ATS optimization)
- Generic rewriters (make it sound better)

Resume Coach is a **strategic framing tool**:
- What story patterns resonate with hiring managers?
- Which interpretation lens fits your target role?
- How to translate older/different-paradigm experience into current hiring language?
