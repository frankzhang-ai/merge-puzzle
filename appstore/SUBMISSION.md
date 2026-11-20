# MERGE BLOOM – App Store submission pack (iOS 1.0.0, build 1)

Bundle ID `com.frankzhang.mergebloom` · Team `B82V7J8MC5` (GE ZHANG) · iPhone only · portrait · iOS 15+ · Free, no in-app purchases.
Everything below is ready to paste into App Store Connect. **Nothing has been submitted to Apple.** "Add for Review / Submit" is Frank's call.

---

## 1. App name (≤30 characters)

iTunes Search API check (`https://itunes.apple.com/search?term=MERGE+BLOOM&entity=software&country=us`, run 2026-11-20):

- **"Merge Bloom - Garden games"** by Manyfun Technology Co., Ltd. is already live (id6451136034, released 2023-08-24, ~713 US ratings).
- Apple only blocks an *identical* name, so plain **`MERGE BLOOM`** may still be accepted when you create the app record. But it is close to an existing merge/garden game, so there is a real chance of a "name already in use" error or a 4.1 (copycat) / trademark complaint later.
- Other similar names already taken: *Bloom Drop: Flower Merge*, *Flower Merge – Blossom Match*, *Blossom Merge*, *Bloom Merge: Undead Clash*, *Everloom – Bloom & Merge*, *Bloomfall: Garden Puzzle*.

| # | Name | Characters | Search result |
|---|---|---:|---|
| 1 (first try) | `MERGE BLOOM` | 11 | No exact match, but a near-duplicate exists (see above) |
| 2 (backup, recommended if #1 is refused) | `Posy Drop: Flower Merge` | 23 | No app named "Posy Drop" found |
| 3 (backup) | `Petal Stack: Merge Garden` | 25 | No app named "Petal Stack" found |
| 4 (backup, keeps brand) | `MERGE BLOOM: Petal Drop` | 23 | No exact match; still close to "Merge Bloom – Garden games" |

The home-screen name stays `MERGE BLOOM` (CFBundleDisplayName) whichever store name you pick. If you choose #2 or #3, I can change the display name to match.

## 2. Subtitle (≤30) – 27 characters
```
Drop, merge & grow a garden
```

## 3. Promotional Text (≤170) – 148 characters
```
30 handcrafted levels, a new daily challenge every day, a flower album to fill and garden skins to unlock. Plays fully offline. No ads, no tracking.
```

## 4. Description
```
Drop flowers, merge three of a kind, and watch your garden bloom!

MERGE BLOOM is a calm, cheerful merge puzzle made for quick sessions on iPhone. Tap a column to drop the next flower. Connect three or more matching flowers to merge them into the next bloom, and set up chain reactions for big combos: NICE, GREAT, AMAZING… BLOOM!

FEATURES
• 30 handcrafted campaign levels on a winding garden map, with a boss level every five stages and gift chests to open.
• Varied goals: grow rare flowers, reach a target score, crack stones and free flowers wrapped in vines.
• Earn up to 3 stars per level by finishing with moves to spare.
• Daily Challenge: a fresh puzzle every day. Keep your streak going to unlock special skins.
• Flower Album: discover all 8 flowers, from the tiny bud to the golden crown bloom.
• Garden skins: unlock Dawn Petal and Night Bloom with stars and streaks.
• Helpful tools: Undo, Hammer and Shuffle when you get stuck.
• A short interactive tutorial teaches the rules in a minute.
• Satisfying haptic feedback on every drop, merge, combo, clear and fail.
• Gentle sound effects that follow your Silent switch and never interrupt your music.
• Pauses and saves automatically when you leave the app.

PLAY ANYWHERE
Works completely offline (airplane mode too). No account, no ads, no in-app purchases, no tracking. Your progress stays on your iPhone.
```

## 5. Keywords (≤100) – 98 characters
```
flower,puzzle,garden,match,drop,combo,chain,relaxing,offline,cute,blossom,casual,brain,daily,stars
```
("merge" and "bloom" are already in the name, so they are not repeated.)

## 6. Category
- **Primary:** Games → **Puzzle**
- **Secondary:** Games → **Casual**
- Info.plist `LSApplicationCategoryType` = `public.app-category.puzzle-games` (matches).

## 7. Age rating questionnaire → expected **4+**
| Section | Answer |
|---|---|
| In-App Controls: Parental Controls / Age Assurance | Not checked |
| Capabilities: Unrestricted Web Access | **No** (only a bundled privacy page; no browser) |
| User-Generated Content / Social / Messaging & Chat / Shared Location / Advertising | All **No** |
| Mature themes (profanity, horror, alcohol/tobacco/drugs, dating) | All **None / No** |
| Medical or Wellness | **None** |
| Sexuality or Nudity | **None** |
| Violence (cartoon / realistic / weapons) | **None** (the hammer tool cracks stones, no characters are harmed) |
| Gambling / Simulated Gambling / Loot Boxes | **None / No** (gift chests are fixed rewards on the map, not random paid boxes) |
| Contests | **None** |
| Age Categories and Override | **Not Applicable** |

## 8. App Privacy → **Data Not Collected**
- Choose **"No, we do not collect data from this app"** → Save → Publish.
- Basis: the iOS build strips GoatCounter completely (no script tag, analytics calls compiled out, CI fails if `gc.zgo.at`/`goatcounter.com/count` appears in the app). No service worker, no remote scripts, no account, no ads, no third-party SDKs. Progress, album, skins and sound setting stay in on-device storage.
- `PrivacyInfo.xcprivacy`: `NSPrivacyTracking = NO`, no tracking domains, no collected data types; required-reason API: UserDefaults `CA92.1` (Capacitor's own app-local settings).
- **Tracking:** No. No ATT prompt needed.

## 9. URLs, contact, copyright
- **Privacy Policy URL:** https://frankzhang-ai.github.io/merge-puzzle/privacy.html (checked: HTTP 200 on 2026-11-20).
  ⚠️ That live page currently says "We use GoatCounter… to count page views and anonymous game events". That is true for the website only. Before submitting, it should say the iOS app has no analytics (see section 15). Updating the live site needs Frank's OK.
- **Support URL:** https://frankzhang-ai.github.io/merge-puzzle/privacy.html (the page includes the contact email). A dedicated support page can come later.
- **Marketing URL (optional):** https://frankzhang-ai.github.io/merge-puzzle/
- **Contact email:** playonesecond@proton.me
- **Copyright:** `2026 Frank Zhang`

## 10. Pricing and availability
- Price: **Free**. No in-app purchases.
- Availability: all countries/regions (default).

## 11. App Review Information
- **Sign-in required:** No.
- Contact: Frank Zhang / playonesecond@proton.me / phone (Frank fills in).
- **Notes (English):**
```
MERGE BLOOM is a complete, self-contained merge puzzle game. All game code and art are bundled inside the app. It does not load a remote website and is fully playable offline (airplane mode).

How to play: on first launch a short interactive tutorial starts. Tap a column to drop the next flower; three or more connected matching flowers merge into the next flower, and merges can chain into combos. Each level has a goal (grow a flower, reach a score, or clear stones and vines) and a move limit.

Content: a 30-level campaign on a scrollable garden map (boss level every 5 stages, gift chests), 3-star ratings, a Daily Challenge with streaks, a Flower Album with 8 flowers, unlockable garden skins (Dawn Petal, Night Bloom), and Undo/Hammer/Shuffle tools that refill daily.

Native features: haptic feedback via the iOS haptic engine on flower drop, merge, combo, level clear and level fail; AVAudioSession set to Ambient so sounds respect the Ring/Silent switch and mix with the user's music; the game pauses and saves automatically when the app goes to the background; full-screen, safe-area-aware portrait layout on all iPhone sizes.

No account, no ads, no in-app purchases, no analytics, no tracking, no data collection.
```

## 12. Screenshots (6.9", 1320×2868, RGB, no alpha)
Path: `/workspace/merge-puzzle/appstore/screenshots/6.9-sim/`. Real captures from the app running in the iPhone 17 Pro Max simulator on GitHub Actions (status bar fixed at 9:41, full Wi-Fi/cellular/battery). A CI-only script (not in the shipped app) drives the real game through the same drop function a tap uses, with a simple greedy bot, so scores, stars and combos are really played, not mocked.

| File (1320×2868, RGB, no alpha – verified) | Content |
|---|---|
| `01-menu.png` | Main menu with the MERGE BLOOM hero art |
| `02-gameplay-merge.png` | Level 10 in play: stone obstacle, goal bar, a merge popping into a bigger flower (frame frozen mid-merge) |
| `03-map.png` | Garden map: levels 1–7 cleared with stars, boss nodes, gift chests, "Level 7 — let's go!" |
| `04-level-clear.png` | Level 7 cleared with 3 stars, score 500 |
| `05-daily-challenge.png` | Daily Challenge card |

Source run: https://github.com/frankzhang-ai/merge-puzzle/actions/runs/44681175008 (all checks passed). Verification captures (iPhone 16e, relaunch, background/pause) are in `appstore/screenshots/ci-verification/`.

Upload the 6.9" set only; App Store Connect scales it for smaller iPhones.

## 13. Version
- Version 1.0.0, Build 1. No "What's New" text for the first version.
- Version Release: recommend **Manually release this version**.

## 14. Guideline 4.2 (minimum functionality / web wrapper) risk: **low to medium**
Why it should pass:
- ✅ Not a website wrapper: everything is bundled, no remote URL, no service worker, works in airplane mode (verified in CI with GitHub/npm/analytics hosts blocked).
- ✅ Substantial content: 30 designed levels with different goal types and obstacles, boss levels, map, 3-star system, daily challenge with streaks, album, skins, tools, tutorial.
- ✅ Native integration: 5 distinct haptics (drop, merge, combo, clear, fail), Ambient audio session, status bar styling, background auto-pause and save, full-screen safe-area layout (no letterbox side bars), proper launch screen and app icon.
Remaining risks:
- ⚠️ It is a Capacitor/WKWebView + Phaser game; a reviewer may notice. Content depth is the main defence, and it is much deeper than ONE SECOND.
- ⚠️ Near-identical name to an existing app (section 1). This is a 4.1/5.2 risk, not 4.2. Use a backup name if in doubt.
If rejected under 4.2, the cheapest additions, in order: (1) Game Center leaderboard for total stars plus achievements (Frank sets them up in App Store Connect first, as in the MAC-UPLOAD-GUIDE appendix; I add the native plugin); (2) reply to the reviewer pointing at the offline 30-level campaign and native haptics; (3) local notifications for the daily challenge (opt-in).
Not added now: Game Center needs the App Store Connect setup first; adding it early risks a sign-in banner and a "where is the leaderboard" question.

## 15. Live privacy page (`main` / gh-pages root): needs Frank's approval
The in-app privacy page (bundled in the iOS app) already states: no analytics, no ads, no third-party SDKs, no network requests, no data collected. The **live** page at the Privacy Policy URL still describes GoatCounter analytics without mentioning that the app has none. Proposed change, same pattern as ONE SECOND's `f103ee8`, **not applied**:
- Retitle the "Analytics" section to "Analytics (website only)" and add: *"The MERGE BLOOM iPhone app contains no analytics, no advertising and no third-party SDKs, and does not collect any data. GoatCounter is used only on the website version at frankzhang-ai.github.io."*
- Update the effective date.
This means editing `public/privacy.html` on `main` and redeploying the gh-pages root, so it needs Frank's go-ahead.
