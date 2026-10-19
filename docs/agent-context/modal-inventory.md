# Modal / sheet inventar va migratsiya rejasi (2026-10)

**Maqsad:** ilovadagi HAR BIR modal va pastki sheet bir xil ko'rinishda bo'lishi — to'r fon, dumaloq oq X, markazdagi 17px sarlavha, `bg-psurface` sirt, oq `SpecCard` kartalar.

**Manba (SSOT):**
- Qobiq — `src/shared/components/ModalShell.tsx` (design.md, 14-qoida)
- Kontent — `src/shared/components/ui/spec.tsx` (`SpecCard`, `SpecRow`, `SpecList`, `SpecHero`, `SpecAmount`)
- Header — `ModalHeaderRow` + `ModalCloseButton`; fon — `ModalMathGrid`; overlay — `DialogOverlay`

**Audit holati (64 ta fayl, `node` skript bilan yig'ildi):**

| Qobiq | Soni | Ma'nosi |
|---|---|---|
| `ModalShell` | 11 | yangi standart — tayyor |
| `Sheet` | 15 | `ui/sheet` primitivi — grid + X + sarlavha bor, vizual mos |
| `Dialog` | 3 | `ui/dialog` (markaziy) — vizual mos |
| `own(...)` | 35 | qo'lda yozilgan qobiq — migratsiya kerak |

`own` yorlig'i: `hdr` = `ModalHeaderRow` bor, `grid` = `ModalMathGrid` bor, `grab` = drag-handle bor. `—` bo'lsa yo'q.

---

## 1. To'liq inventar

| # | Hudud | Fayl | Komponent | Tur | Qobiq | Qayerdan ochiladi |
|---|---|---|---|---|---|---|
| 1 | admin | `features/admin/components/AdminBroadcastTab.tsx` | AdminBroadcastTab | dialog | own(hdr,no-grid,no-grab) | features/admin/AdminPage.tsx |
| 2 | admin | `features/admin/components/AdminPromoTab.tsx` | AdminPromoTab | dialog | own(hdr,no-grid,grab) | features/admin/AdminPage.tsx |
| 3 | admin | `features/admin/components/AdminQuestionsTab.tsx` | AdminQuestionsTab | sheet | own(hdr,no-grid,grab) | features/admin/AdminPage.tsx |
| 4 | admin | `features/admin/components/AdminUsersTab.tsx` | AdminUsersTab | dialog | own(hdr,no-grid,grab) | features/admin/AdminPage.tsx |
| 5 | admin | `features/admin/components/BulkImportModal.tsx` | BulkImportModal | dialog | own(hdr,grid,grab) | features/admin/components/AdminQuestionsTab.tsx |
| 6 | ai-tutor | `features/ai-tutor/components/SocraticChatSheet.tsx` | SocraticChatSheet | fullscreen | own(no-hdr,grid,no-grab) | features/ai-tutor/SnapSolveHub.tsx<br>features/graph/GraphPage.tsx |
| 7 | auth | `features/auth/components/TelegramQrSheet.tsx` | TelegramQrSheet | dialog | own(hdr,grid,grab) | features/auth/components/TelegramLoginPanel.tsx<br>features/auth/LoginPage.tsx |
| 8 | camai | `features/camai/CamAiPage.tsx` | CamAiPage | panel | Dialog | App.tsx |
| 9 | dashboard | `features/dashboard/components/Celebrations.tsx` | MILESTONES, MilestoneScene, LevelUpScene | dialog | own(no-hdr,no-grid,no-grab) | features/dashboard/Dashboard.tsx |
| 10 | dashboard | `features/dashboard/components/DynamicIsland.tsx` | DynamicIsland, SHOW_DYNAMIC_ISLAND | dialog | own(hdr,no-grid,grab) | features/dashboard/Dashboard.tsx |
| 11 | dashboard | `features/dashboard/components/ModesSheet.tsx` | ModesSheet | dialog | own(no-hdr,grid,no-grab) | - |
| 12 | graph | `features/graph/components/GraphAiSheet.tsx` | GraphAiSheet | sheet | Sheet | features/graph/GraphPage.tsx |
| 13 | graph | `features/graph/components/LabSheet.tsx` | LabSheet | sheet | Sheet | features/graph/GraphPage.tsx |
| 14 | graph | `features/graph/components/PresetSheet.tsx` | PresetSheet | sheet | Sheet | features/graph/GraphPage.tsx |
| 15 | graph | `features/graph/components/SavedGraphsSheet.tsx` | SavedGraphsSheet | sheet | Sheet | features/graph/GraphPage.tsx |
| 16 | graph | `features/graph/components/TableSheet.tsx` | TableSheet | sheet | Sheet | features/graph/GraphPage.tsx |
| 17 | lessons | `features/lessons/LessonLaunch.tsx` | LessonLaunch, LESSON_LAUNCH_REVEAL_MS, LESSON_LAUNCH_MS | dialog | own(no-hdr,no-grid,no-grab) | features/lessons/Darslik.tsx |
| 18 | lessons | `features/lessons/ModuleComplete.tsx` | ModuleComplete, MODULE_TRANSITION_MS | panel | Dialog | features/lessons/Darslik.tsx |
| 19 | library | `features/library/components/BookDetailSheet.tsx` | BookDetailSheet | sheet | Sheet | features/library/LibraryPage.tsx |
| 20 | library | `features/library/LibraryPage.tsx` | LibraryPage | sheet | Sheet | App.tsx |
| 21 | math-board | `features/math-board/components/RecognitionReviewSheet.tsx` | RecognitionReviewSheet | sheet | Sheet | features/math-board/MathBoardPage.tsx |
| 22 | math-board | `features/math-board/components/SolutionSheet.tsx` | SolutionSheet | sheet | Sheet | features/math-board/MathBoardPage.tsx |
| 23 | octagon | `features/octagon/components/CustomRoomModal.tsx` | CustomRoomModal | dialog | own(hdr,grid,grab) | features/octagon/OctagonPage.tsx |
| 24 | premium | `features/premium/components/PaymentMethodModal.tsx` | PaymentMethodModal | sheet | own(hdr,grid,grab) | features/premium/PremiumPage.tsx |
| 25 | premium | `features/premium/components/SubscriptionModal.tsx` | SubscriptionModal | sheet | own(hdr,grid,grab) | features/adaptive/AdaptivePage.tsx<br>features/mistakes/XatolarPage.tsx<br>features/profile/Profil.tsx |
| 26 | profile | `features/profile/components/AchievementsScreen.tsx` | AchievementsScreen | sheet | own(no-hdr,grid,grab) | features/dashboard/components/DynamicIsland.tsx<br>features/profile/components/AchievementsSection.tsx<br>features/profile/Profil.tsx |
| 27 | profile | `features/profile/components/ClosedGroupSheet.tsx` | ClosedGroupSheet | sheet | Sheet | features/profile/Profil.tsx |
| 28 | profile | `features/profile/components/EditSheets.tsx` | PhotoEditSheet, PhoneEditSheet, NameEditSheet | sheet | ModalShell | features/profile/Profil.tsx |
| 29 | profile | `features/profile/components/PaymentHistorySheet.tsx` | PaymentHistorySheet | panel | ModalShell | features/profile/Profil.tsx |
| 30 | reviews | `features/reviews/components/FilterSortSheet.tsx` | FilterSortSheet | sheet | own(hdr,grid,grab) | features/reviews/ReviewsPage.tsx |
| 31 | reviews | `features/reviews/components/WriteReviewSheet.tsx` | WriteReviewSheet | sheet | own(hdr,grid,grab) | features/reviews/ReviewsPage.tsx |
| 32 | shared | `shared/components/AchievementCelebrationModal.tsx` | AchievementCelebrationModal | sheet | own(no-hdr,grid,grab) | App.tsx |
| 33 | shared | `shared/components/AchievementDetailSheet.tsx` | AchievementDetailSheet | panel | ModalShell | App.tsx |
| 34 | shared | `shared/components/AppearanceModal.tsx` | AppearanceModal | panel | ModalShell | features/profile/Profil.tsx<br>shared/components/SettingsModal.tsx |
| 35 | shared | `shared/components/DialogOverlay.tsx` | DialogOverlay | sheet | own(no-hdr,no-grid,grab) | features/admin/components/AdminBroadcastTab.tsx<br>features/admin/components/AdminPromoTab.tsx<br>features/admin/components/AdminQuestionsTab.tsx |
| 36 | shared | `shared/components/ImageZoomModal.tsx` | ImageZoomModal | dialog | own(no-hdr,no-grid,no-grab) | features/test/components/ExamReviewModal.tsx<br>features/test/ServerPracticePage.tsx |
| 37 | shared | `shared/components/ModalShell.tsx` | ModalShell | sheet | ModalShell | features/profile/components/EditSheets.tsx<br>features/profile/components/PaymentHistorySheet.tsx<br>shared/components/AchievementDetailSheet.tsx |
| 38 | shared | `shared/components/PickerSheet.tsx` | PickerSheet | panel | ModalShell | features/profile/Profil.tsx<br>shared/components/SettingsModal.tsx |
| 39 | shared | `shared/components/PromoCodeModal.tsx` | PromoCodeModal | panel | ModalShell | features/premium/PremiumPage.tsx<br>features/profile/Profil.tsx |
| 40 | shared | `shared/components/ReviewPromptSheet.tsx` | ReviewPromptSheet | panel | ModalShell | App.tsx |
| 41 | shared | `shared/components/SettingsModal.tsx` | SettingsModal | panel | ModalShell | features/dashboard/components/DynamicIsland.tsx<br>features/dashboard/Dashboard.tsx<br>features/test/components/TestModals.tsx |
| 42 | shared | `shared/components/StatInfoSheet.tsx` | StatInfoSheet | sheet | own(hdr,grid,grab) | features/dashboard/components/ProgressCard.tsx<br>features/profile/Profil.tsx |
| 43 | shared | `shared/components/SubjectSheet.tsx` | SubjectSheet | panel | ModalShell | features/dashboard/Dashboard.tsx |
| 44 | shared | `shared/components/ui/dialog.tsx` | (inline) | sheet | own(hdr,grid,grab) | - |
| 45 | shared | `shared/components/ui/sheet.tsx` | (inline) | sheet | own(hdr,grid,grab) | - |
| 46 | shared | `shared/components/UpdateSheet.tsx` | UpdateSheet | panel | ModalShell | features/dashboard/components/TopBar.tsx |
| 47 | shop | `features/shop/MerchOrderModal.tsx` | MerchOrderModal | sheet | own(hdr,grid,grab) | features/shop/MerchSection.tsx |
| 48 | shop | `features/shop/SpinModal.tsx` | SpinModal | sheet | own(hdr,grid,grab) | features/shop/ShopPage.tsx |
| 49 | signs | `features/signs/Belgilar.tsx` | Belgilar | sheet | own(hdr,grid,grab) | App.tsx |
| 50 | signs-game | `features/signs-game/SignsGamePage.tsx` | SignsGamePage | panel | Dialog | App.tsx |
| 51 | streak | `features/streak/StreakPage.tsx` | StreakPage | sheet | own(hdr,grid,grab) | App.tsx |
| 52 | test | `features/test/CertificateModal.tsx` | CertificateModal | sheet | own(hdr,grid,grab) | features/profile/Profil.tsx<br>features/test/ResultsModal.tsx |
| 53 | test | `features/test/components/AiTutorModal.tsx` | AiTutorModal | sheet | own(hdr,grid,grab) | features/test/components/TestModals.tsx<br>features/test/ServerPracticePage.tsx |
| 54 | test | `features/test/components/AntiCheatModal.tsx` | AntiCheatModal | sheet | own(no-hdr,grid,grab) | features/test/components/TestModals.tsx |
| 55 | test | `features/test/components/ExamReviewModal.tsx` | ExamReviewModal | sheet | own(hdr,grid,grab) | features/test/components/TestModals.tsx<br>features/test/ServerPracticePage.tsx |
| 56 | test | `features/test/components/MarkdownExplanation.tsx` | MarkdownExplanation | sheet | own(hdr,grid,grab) | features/test/components/TestExplanation.tsx |
| 57 | test | `features/test/components/TestCalculatorSheet.tsx` | TestCalculatorSheet | sheet | Sheet | features/test/ServerPracticePage.tsx<br>features/test/TestPage.tsx |
| 58 | test | `features/test/components/TestDrawingLayer.tsx` | TestDrawingLayer | sheet | Sheet | features/test/ServerPracticePage.tsx<br>features/test/TestPage.tsx |
| 59 | test | `features/test/components/TestExplanation.tsx` | TestExplanation | sheet | Sheet | features/test/ServerPracticePage.tsx<br>features/test/TestPage.tsx |
| 60 | test | `features/test/components/TestFormulasSheet.tsx` | TestFormulasSheet | sheet | Sheet | features/test/ServerPracticePage.tsx<br>features/test/TestPage.tsx |
| 61 | test | `features/test/components/TestImageAnnotatorModal.tsx` | TestImageAnnotatorModal | dialog | own(no-hdr,no-grid,no-grab) | features/test/components/TestModals.tsx |
| 62 | test | `features/test/ResultsModal.tsx` | ResultsModal | sheet | own(hdr,grid,grab) | features/speed/SpeedPage.tsx<br>features/test/components/TestModals.tsx<br>features/test/ServerPracticePage.tsx |
| 63 | test | `features/test/TestPage.tsx` | TestPage | sheet | Sheet | App.tsx<br>features/test/TestRoutePage.tsx |
| 64 | testlar | `features/testlar/components/MilliySertifikatCalculatorModal.tsx` | MilliySertifikatCalculatorModal | sheet | own(hdr,grid,grab) | features/testlar/TestlarPage.tsx |

## 2. Reja bo'yicha guruhlash

### A — `ModalShell` ga o'tkaziladi (vizual bir xillashtirish, 21 fayl)

| Modal | Fayl | Hozir | Nima qilinadi |
|---|---|---|---|
| SubscriptionModal | `features/premium/components/SubscriptionModal.tsx` | own(hdr,grid,grab) | 2 qadamli qobiq: step-1 `ModalShell`, step-2 `headerRight` (yordam) + back |
| ResultsModal | `features/test/ResultsModal.tsx` | own(hdr,grid,grab) | qobiq + donut ostidagi qatorlar `SpecCard` (tayyor) |
| ExamReviewModal | `features/test/components/ExamReviewModal.tsx` | own(hdr,grid,grab) | qobiq (max-w-xl saqlanadi) |
| CertificateModal | `features/test/CertificateModal.tsx` | own(hdr,grid,grab) | qobiq, footer = ulashish/yuklash |
| AiTutorModal | `features/test/components/AiTutorModal.tsx` | own(hdr,grid,grab) | qobiq |
| AntiCheatModal | `features/test/components/AntiCheatModal.tsx` | own(—hdr,grid,grab) | `dismissable=false` shell (faqat CTA yopadi) |
| MarkdownExplanation | `features/test/components/MarkdownExplanation.tsx` | own(hdr,grid,grab) | qobiq |
| MilliySertifikatCalculatorModal | `features/testlar/.../MilliySertifikatCalculatorModal.tsx` | own(hdr,grid,grab) | qobiq |
| MerchOrderModal | `features/shop/MerchOrderModal.tsx` | own(hdr,grid,grab) | qobiq + footer (CTA) |
| SpinModal | `features/shop/SpinModal.tsx` | own(hdr,grid,grab) | qobiq (g'ildirak saqlanadi) |
| CustomRoomModal | `features/octagon/components/CustomRoomModal.tsx` | own(hdr,grid,grab) | qobiq |
| TelegramQrSheet | `features/auth/components/TelegramQrSheet.tsx` | own(hdr,grid,grab) | qobiq (QR saqlanadi) |
| FilterSortSheet | `features/reviews/components/FilterSortSheet.tsx` | own(hdr,grid,grab) | qobiq + `headerRight` (tozalash) |
| WriteReviewSheet | `features/reviews/components/WriteReviewSheet.tsx` | own(hdr,grid,grab) | qobiq + footer (yuborish) |
| StatInfoSheet | `shared/components/StatInfoSheet.tsx` | own(hdr,grid,grab) | qobiq + `SpecCard` (tayyor) |
| AchievementsScreen | `features/profile/components/AchievementsScreen.tsx` | own(—hdr,grid,grab) | qobiq (ekranlashgan ro'yxat) |
| AchievementCelebrationModal | `shared/components/AchievementCelebrationModal.tsx` | own(—hdr,grid,grab) | qobiq: X + sarlavha, tantana animatsiyasi saqlanadi |
| ClosedGroupSheet | `features/profile/components/ClosedGroupSheet.tsx` | Sheet | `ModalShell` (title 17px) |
| SocraticChatSheet | `features/ai-tutor/components/SocraticChatSheet.tsx` | own(—hdr,grid,—grab) | qobiq + chat scroll/footer |
| BulkImportModal | `features/admin/components/BulkImportModal.tsx` | own(hdr,grid,grab) | qobiq |
| Admin dialoglari (4 tab) | `features/admin/components/Admin*Tab.tsx` | own(hdr,—grid) | grid + `ModalShell` (yoki markaziy `Dialog`) |

### B — Faqat moslashtirish (qobiq allaqachon `Sheet`/`Dialog`, 18 fayl)

`graph/*` (5), `math-board/*` (2), `library/BookDetailSheet`, `test/TestCalculatorSheet`, `TestFormulasSheet`, `TestExplanation`, `TestDrawingLayer`, `profile/ClosedGroupSheet`, `lessons/ModuleComplete`, `camai`, `signs-game`, `test/TestPage` — bular `ui/sheet` / `ui/dialog` primitivida, ya'ni grid + oq X + 17px sarlavha avtomatik. Faqat kontent kartalarini `SpecCard` ga keltirish (ma'lumot qatorlari bo'lsa).

### C — Ataylab o'zgarmaydi (3 fayl)

| Fayl | Sabab |
|---|---|
| `shared/components/DialogOverlay.tsx` | primitiv (qobiqlar shundan quriladi) |
| `shared/components/ModalShell.tsx`, `ui/sheet.tsx`, `ui/dialog.tsx` | primitivlar |
| `shared/components/ImageZoomModal.tsx` | rasm ko'rish — sarlavha/karta yo'q, faqat X + pinch-zoom |
| `features/test/components/TestImageAnnotatorModal.tsx`, `TestDrawingLayer` | canvas vositasi — to'liq ekran, o'z toolbar'i |
| `features/dashboard/components/Celebrations.tsx`, `lessons/LessonLaunch` | tantana/launch animatsiyasi — modal emas, kinematik qatlam |
| `features/dashboard/components/ModesSheet.tsx` | to'liq ekran sahifa (back tugmasi bilan) |

---

## 3. Bosqichlar

| Bosqich | Qamrov | Fayl | Tekshiruv |
|---|---|---|---|
| **F1** | Premium + natijalar | SubscriptionModal, PaymentMethodModal✓, ResultsModal, ExamReviewModal, CertificateModal | `tsc`, `tests/unit/{components,features}`, mobil skrinshot |
| **F2** | Test vositalari | AiTutorModal, AntiCheatModal, MarkdownExplanation, MilliySertifikatCalculatorModal | `tsc`, `tests/unit/components`, skrinshot |
| **F3** | Do'kon + o'yin | MerchOrderModal, SpinModal, CustomRoomModal | `tsc`, skrinshot |
| **F4** | Profil + sharhlar | AchievementDetailSheet✓, AchievementCelebrationModal, AchievementsScreen, ClosedGroupSheet, TelegramQrSheet, FilterSortSheet, WriteReviewSheet, StatInfoSheet | `tsc`, `tests/unit/features`, skrinshot |
| **F5** | AI + admin | SocraticChatSheet, BulkImportModal, Admin*Tab (4) | `tsc`, `tests/unit/config` |
| **F6** | B guruhi | graph (5), math-board (2), library, test panel (4) — faqat kontent `SpecCard` | `tsc`, skrinshot |
| **F7** | Yakuniy | `design.md` qoidasi, `modal-inventory.md` yangilash, to'liq `tests/unit` | 100% |

**Har bosqichda:** `npx tsc -p tsconfig.json --noEmit` → tegishli `vitest` → 390×844 skrinshot (light + dark) → rejadagi qatorni ✅ ga o'zgartirish.

## 4. Qabul mezoni

1. Har modal: `ModalShell` yoki `Sheet`/`Dialog` primitivi (qo'lda yozilgan qobiq qolmaydi).
2. Sarlavha: 17px bold, markazda; X: 48px dumaloq oq; fon: `bg-psurface` + to'r; tepa radius: 30px (global CSS).
3. Ma'lumot qatorlari: `SpecCard` + `SpecRow` (28px chip, label · qiymat), ramkasiz karta.
4. C guruhidagi istisnolar hujjatda asoslangan.

## 5. Bajarilish holati

| Bosqich | Fayllar | Holat |
|---|---|---|
| — | SettingsModal, AppearanceModal, PickerSheet, SubjectSheet, UpdateSheet, PromoCodeModal, ReviewPromptSheet, PaymentMethodModal, PaymentHistorySheet, EditSheets (3), AchievementDetailSheet | ✅ (oldingi bosqich) |
| F1 | ResultsModal, ExamReviewModal, CertificateModal | ✅ 2026-10 |
| F1 | SubscriptionModal (2 qadamli qobiq — ko'p bosqichli header ataylab saqlanadi) | ⏸ B guruhi |
| F2 | AiTutorModal (3 tarmoq), MarkdownExplanation, MilliySertifikatCalculatorModal | ✅ 2026-10 |
| F2 | AntiCheatModal | ⏸ C — yopilmaydigan ogohlantirish (faqat CTA) |
| F3 | MerchOrderModal, SpinModal, CustomRoomModal (markaziy dialog → pastki sheet) | ✅ 2026-10 |
| F4 | ClosedGroupSheet, TelegramQrSheet, FilterSortSheet, WriteReviewSheet, StatInfoSheet | ✅ 2026-10 |
| F4 | AchievementsScreen (to'liq ekran kolleksiya) | ✅ 2026-10 |
| F4 | AchievementCelebrationModal | ⏸ C — tantana qatlami (badge rangli glow) |
| F5 | SocraticChatSheet (chat: `bodyScroll={false}`), BulkImportModal (2 shell), AdminBroadcastTab, AdminPromoTab, AdminQuestionsTab (2 shell), AdminUsersTab | ✅ 2026-10 |
| + | PaymentMethodModal, Belgilar (belgi detali), StreakPage info-sheet | ✅ 2026-10 |
| Holat | `ModalShell`: 35 fayl · qo'lda qobiq: 12 (3 primitiv + 1 ko'p qadamli + 8 asoslangan istisno) | ✅ |
| F6 | B guruhi — kontent tili: PresetSheet, SavedGraphsSheet, RecognitionReviewSheet → `SpecCard` | ✅ 2026-10 |
| F6 | Vosita panellari (kontent qatorlari yo'q, `Sheet`/`Dialog` primitivida qoladi): TestCalculatorSheet (klaviatura), TestDrawingLayer (canvas), TestFormulasSheet (qidiruv + formula kartalari), TestExplanation (matn), LabSheet (slayderlar), GraphAiSheet (chat), TableSheet (qiymatlar jadvali), SolutionSheet (qadamlar), BookDetailSheet (muqova + badge) | ✅ asoslangan |
| F7 | Yakuniy tekshiruv (tsc + `tests/unit`) va hujjat yangilash | ✅ 2026-10 |

Har bosqichdan keyin: `npx tsc -p tsconfig.json --noEmit` + `npx vitest run tests/unit/{components,features,config}`.
