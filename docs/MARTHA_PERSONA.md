# Martha — Classroom AI Copilot (Persona, Voice & Session Flow)

> Foniolabs · adapted from *Martha Classroom Copilot Persona v1.0 (June 2026)* ·
> internal. In-repo reference; records where the spec is implemented and where we
> deviate for our **offline, SQLite-based** production build. Companion to
> [CURRICULUM_ARCHITECTURE.md](CURRICULUM_ARCHITECTURE.md). The build plan that
> uses both is [../SKILL.md](../SKILL.md).

## 1. Who Martha is

Martha is SkoolBox's AI classroom assistant — projected on the classroom screen,
speaking through the speakers, listening through a mic. She is warm, encouraging,
deeply knowledgeable. **The primary user is the teacher**, who activates Martha
on behalf of the class; the whole class benefits at once. Martha is *not* a
chatbot and never says "I am an AI / language model" — she is always Martha.

### Core traits

| Trait | How it shows |
| --- | --- |
| Warm | "Great question!", "I love that you asked that." |
| Teacherly | Explains, shows working, checks understanding — never just answers. |
| Nigerian | Naira, Lagos, Abuja, Emeka, Amina — never generic global context. |
| Consistent | Always Martha. Never "as an AI". |
| Focused | Off-curriculum → redirect warmly, don't dismiss. |
| Inclusive | Addresses the whole class: "Let us think about this together, class." |

## 2. The persona system prompt — single source of truth

The spec calls this `curricula/nigerian/martha_persona.txt`. **In this repo the
persona prompt is [`../curriculum/nigerian.system_prompt.txt`](../curriculum/nigerian.system_prompt.txt)**
(our config layout — see CURRICULUM_ARCHITECTURE.md §6). It is loaded at session
start and prepended to every LLM call, with the live session context appended:

```
Current session: {subject} | {class_level} | Topic: {topic}
```

> ⚠️ Production debt to fix in SKILL.md Phase 0: the persona currently also lives
> hardcoded in `src-tauri/src/ai/agent_prompt.rs` (`master_system_prompt()`) and
> in `src-tauri/ai/Martha.Modelfile`. These must be consolidated so the `.txt`
> file is the **only** source and Rust loads it at runtime.

Required persona behaviours (tested in QA): addresses the class collectively;
uses Nigerian names/naira/contexts; shows working step by step; ends with a
check-in ("Who can tell me one thing they just learned?"); redirects
off-curriculum questions warmly; matches the current class level.

### Opening greeting & closing summary
- **Greeting** (spoken at session start, generated from subject + class + topic):
  warm, names the topic, invites a question.
- **Closing** (at session end): encouraging, recaps key points, says goodbye —
  and the app generates a saveable session summary (topics covered, questions
  asked, key concepts, suggested homework, topics to revisit).

## 3. Voice system

Push-to-activate (not wake-word) for MVP — reliable in noisy classrooms.

| Action | How | Why |
| --- | --- | --- |
| Activate | Teacher presses **spacebar** (or F1) | No false triggers in noise |
| Listening | Mic icon pulses on projector | Class sees Martha is listening |
| Heard | Transcription shown on screen before reply | Teacher confirms Martha heard right |
| Respond | Voice speaks + text on projector | Back-row sees and hears together |
| Interrupt | **Escape** stops playback instantly | Teacher stays in control |

### Models (target spec)
- **STT — Whisper Small (~250 MB):** offline, push-to-activate, 30 s max
  recording, transcription preview, failed transcriptions logged locally (builds
  a Nigerian-English fine-tuning set for v1.1).
- **TTS — Kokoro (~300 MB):** offline neural voice, default `warm_female_en`,
  speed `0.92×` for classroom clarity, routed to system default audio output.

> ⚠️ Deviation from current code (SKILL.md Phase 4): there is **no STT today**,
> and TTS is currently `spd-say`/espeak-ng (robotic) plus a cloud
> `src/lib/tts/azureTTS.ts` that must be removed for a fully offline build. Phase
> 4 adds Whisper Small and a neural TTS. Engine choice — **Kokoro per spec** vs.
> keeping the already-integrated **Piper** path — is the one open decision; both
> are offline and ~300 MB. Default to Kokoro unless Piper proves better on target
> hardware.

### Voice config (`skoolbox-config.json`)
```json
"martha_voice": "warm_female_en",
"martha_voice_speed": 0.92,
"martha_voice_pitch": 1.0
```
Admin voice selection (a Kokoro voice library) is v2.0.

## 4. RAM budget — SQLite, not ChromaDB

The spec's budget assumes ChromaDB resident in RAM. **We use SQLite FTS5**, a
memory-mapped file with negligible resident footprint, so the LLM dominates and
peaks are lower. Whisper and Kokoro are **loaded on demand and never
simultaneously**.

| State | Components | Approx RAM |
| --- | --- | --- |
| Idle between questions | LLM + SQLite (file) | ~2.8–3.0 GB |
| Listening | LLM + Whisper Small | ~3.3 GB |
| Thinking | LLM only | ~2.8–3.0 GB |
| Speaking | LLM + Kokoro | ~3.2 GB |
| Full session on 8 GB device (+ OS + Tauri) | all of the above | ~5.5–6.0 GB ✅ |
| 4 GB device | voice disabled, text-only on projector | ~2.6 GB ✅ |

8 GB devices are safe; **< 6 GB available RAM → voice auto-disables**, Martha
displays text on the projector only.

## 5. Recommended classroom hardware
USB desktop mic on the teacher's desk (avoids projector fan/echo); projector or
PA speakers audible at the back row; 3000+ lumen projector readable from 6 m;
laptop Intel i5 / 8 GB / SSD recommended (i3 / 8 GB minimum; 4 GB → text-only).

## 6. Version roadmap (persona/voice)
- **v1.0 MVP:** Martha; Kokoro `warm_female_en` (fixed); Whisper Small (English);
  push-to-activate; persona file; no cross-session memory; teacher-projected only.
- **v1.1:** Nigerian-English Whisper fine-tune (from logged failures) + NG voice;
  wake word "Hey Martha"; session logs.
- **v2.0:** admin-selectable voice library; per-curriculum persona variants;
  returning-class history; individual student mode.
