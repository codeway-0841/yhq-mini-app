# Test reja: <funksiya nomi>

- **Ticket/PR:** #
- **QA:** 
- **Sana:** 
- **Xavf darajasi:** Past / O'rta / Yuqori (pul, auth, scoring = Yuqori)

## 1. Acceptance criteria
- [ ] 
- [ ] 

## 2. Qamrov
| # | Senariy | Tur | Kutilgan natija | Avto? | Natija |
| --- | --- | --- | --- | --- | --- |
| 1 | Ijobiy yo'l | Happy | | Ha/Yo'q | 🟢/🔴/🟡 |
| 2 | Noto'g'ri input | Negative | | | |
| 3 | Chegaraviy qiymat | Edge | | | |
| 4 | Ruxsatsiz foydalanuvchi | Security | 401/403 | | |
| 5 | Takroriy so'rov (replay) | Idempotency | Ikki marta ta'sir qilmaydi | | |
| 6 | Tarmoq xatosi / sekin | Resilience | | | |

## 3. Muhit
- [ ] Mobil (Pixel 7 / Telegram WebView)
- [ ] Desktop
- [ ] Light / Dark
- [ ] UZ / RU
- [ ] Test DB (production emas!)

## 4. Avtomatik tekshiruv
| Buyruq | Exit | Izoh |
| --- | --- | --- |
| `node scripts/agent-check.mjs client` | | |
| `node scripts/agent-check.mjs server` | | |
| `node scripts/agent-check.mjs unit <path>` | | |

## 5. Topilgan bug'lar
| ID | Sarlavha | Severity |
| --- | --- | --- |

## 6. Tekshirilmagan (sababi bilan)
- 

## 7. Qaror
**GO / NO-GO:** 
**Izoh:** 
