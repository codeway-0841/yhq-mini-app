import { useState, useEffect, useMemo } from 'react'
import { Swords, UserPlus, Trophy, Users, Check, Copy, Share2, KeyRound, ChevronLeft, ArrowRight } from 'lucide-react'
import { api, type LeaderboardEntry, avatarSrcFor } from '../../../shared/api'
import { getAvatarFrame } from '../../../shared/config/avatar-frames'
import { playSound } from '../../../shared/lib/sounds'
import { haptics } from '../../../platform/haptics'
import { shareUrl } from '../../../platform/telegram'
import { cn } from '../../../shared/lib/cn'
import { getDuelHistory, type DuelHistoryRecord } from '../duel-history'
import { DuelLeaderboardView } from './DuelLeaderboardView'

interface IdleScreenProps {
  tt: ReturnType<typeof import('../../../shared/i18n')['useT']>
  user: { id: string; firstName: string; photoUrl?: string } | null | undefined
  language: 'uz' | 'ru'
  connFailed: boolean
  onlinePlayers?: LeaderboardEntry[]
  onlineCount?: number
  onRefreshOnline?: () => void
  onFind: () => void
  onJoinWithPin: (pin: string) => void
}

function getDuelRank(wins: number, tt: ReturnType<typeof import('../../../shared/i18n')['useT']>): { title: string; color: string } {
  if (wins >= 30) return { title: tt('duelRankChampion'), color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' }
  if (wins >= 15) return { title: tt('duelRankGladiator'), color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' }
  if (wins >= 5)  return { title: tt('duelRankFighter'),   color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
  return { title: tt('duelRankNovice'), color: 'text-pmuted bg-psurface border-pline' }
}

function formatRelativeTime(ts: number, lang: 'uz' | 'ru'): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return lang === 'ru' ? 'Только что' : 'Hozirgina'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} ${lang === 'ru' ? 'мин. назад' : 'daqiqa oldin'}`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} ${lang === 'ru' ? 'ч. назад' : 'soat oldin'}`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ${lang === 'ru' ? 'дн. назад' : 'kun oldin'}`
}

function UserAvatar({ name, src, frame }: {
  name: string
  src?: string | null
  frame?: string | null
}) {
  const frameClass = getAvatarFrame(frame)?.cssClass ?? null
  const letter = name[0]?.toUpperCase() ?? '?'

  const inner = (
    <div className={cn(
      'size-8 text-[11px] rounded-full bg-psurface flex items-center justify-center text-pfg font-bold shrink-0 overflow-hidden',
      !frameClass && 'border border-pline/40'
    )}>
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        letter
      )}
    </div>
  )

  return frameClass ? <span className={cn('avatar-frame shrink-0', frameClass)}>{inner}</span> : inner
}

export function IdleScreen({
  tt,
  user,
  language,
  connFailed,
  onlinePlayers = [],
  onlineCount: propOnlineCount,
  onRefreshOnline,
  onFind,
  onJoinWithPin,
}: IdleScreenProps) {
  // Alohida navigatsiya (null = Hub, string = Subview)
  const [subview, setSubview] = useState<'battles' | 'leaderboard' | 'online' | 'invite' | null>(null)

  // Stats & History state
  const [serverWins, setServerWins] = useState<number>(0)
  const [history, setHistory] = useState<DuelHistoryRecord[]>([])

  // Quick invite tab state
  const [quickPin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString())
  const [copiedPin, setCopiedPin] = useState(false)
  const [inputPin, setInputPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  useEffect(() => {
    setHistory(getDuelHistory())
    if (user?.id) {
      api.getAchievements(user.id)
        .then((res) => setServerWins(res.stats.octagonWins))
        .catch(() => {})
    }
  }, [user?.id])

  // Subview online ochilganda WS yangilanish so'rash
  useEffect(() => {
    if (subview === 'online') {
      onRefreshOnline?.()
    }
  }, [subview, onRefreshOnline])

  // Haqiqiy JONLI online o'yinchilar (WebSocket serverdan real-time keladi)
  const effectiveOnlineUsers = onlinePlayers
  const effectiveOnlineCount = propOnlineCount !== undefined ? propOnlineCount : effectiveOnlineUsers.length

  // Calculated Stats (Faqat haqiqiy ko'rsatkichlar — hech qanday soxtalashtirishsiz)
  const historyWins = useMemo(() => history.filter((h) => h.result === 'win').length, [history])
  const totalWins = serverWins > 0 ? serverWins : historyWins
  const totalMatches = history.length > 0 ? history.length : totalWins
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0
  const rankInfo = getDuelRank(totalWins, tt)

  const handleCopyPin = () => {
    navigator.clipboard?.writeText(quickPin)
    setCopiedPin(true)
    haptics.impact('light')
    playSound('click')
    setTimeout(() => setCopiedPin(false), 2500)
  }

  const handleShareInvite = () => {
    haptics.impact('medium')
    playSound('click')
    const inviteLink = `https://t.me/kiwi_uz_bot?start=duel-${quickPin}`
    const shareText = `Kel, bilimlar jangida bellashamiz! 🤺\n\n📌 Xona PIN-kodi: ${quickPin}\n\nQuyidagi havola orqali kiring:`
    shareUrl(inviteLink, shareText)
    onJoinWithPin(quickPin)
  }

  const handleJoinPin = () => {
    const clean = inputPin.replace(/\s+/g, '').trim()
    if (!/^\d{4,8}$/.test(clean) && !/^[a-z0-9-]{4,16}$/i.test(clean)) {
      setPinError(tt('invalidPinError'))
      haptics.notify('error')
      playSound('error')
      return
    }
    setPinError(null)
    haptics.impact('medium')
    playSound('click')
    onJoinWithPin(clean.toLowerCase())
  }

  // ── SUBVIEW KO'RINISHI (Ichki sahifaga navigatsiya qilinganda) ──
  if (subview !== null) {
    const subviewTitle =
      subview === 'battles'     ? (language === 'ru' ? 'Мои бои' : 'Mening janglarim') :
      subview === 'leaderboard' ? (language === 'ru' ? 'Рейтинг Дуэлей' : 'Duel Reytingi') :
      subview === 'online'      ? (language === 'ru' ? 'Онлайн игроки' : "Online o'yinchilar") :
      (language === 'ru' ? 'Дуэль с другом' : "Do'st bilan bellashuv")

    return (
      <div className="w-full max-w-md mx-auto space-y-4 pt-1 animate-premiumIn">
        {/* Subview Nav Header */}
        <div className="flex items-center justify-between pb-1 border-b border-pline/60">
          <button
            type="button"
            onClick={() => { playSound('click'); haptics.impact('light'); setSubview(null) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-psurface hover:bg-pcard border border-pline text-xs font-bold text-pfg active:scale-95 transition-all"
          >
            <ChevronLeft size={16} />
            <span>{tt('backWord')}</span>
          </button>
          <h2 className="font-display text-sm font-black text-pfg truncate px-2">
            {subviewTitle}
          </h2>
          <div className="w-16" />
        </div>

        {/* 1. Mening Janglarim Subview -> GRID KO'RINISHIDA */}
        {subview === 'battles' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[20px] border border-pline bg-pcard p-3.5 text-center shadow-xs">
                <span className="text-[10.5px] font-bold text-psubtle block mb-0.5">{tt('duelWinsLabel')}</span>
                <span className="font-display text-2xl font-black text-pprimary">{totalWins}</span>
              </div>
              <div className="rounded-[20px] border border-pline bg-pcard p-3.5 text-center shadow-xs">
                <span className="text-[10.5px] font-bold text-psubtle block mb-0.5">{tt('duelTotalLabel')}</span>
                <span className="font-display text-2xl font-black text-pfg">{totalMatches}</span>
              </div>
              <div className="rounded-[20px] border border-pline bg-pcard p-3.5 text-center shadow-xs">
                <span className="text-[10.5px] font-bold text-psubtle block mb-0.5">{tt('duelWinRateLabel')}</span>
                <span className="font-display text-2xl font-black text-psuccess">{winRate}%</span>
              </div>
              <div className="rounded-[20px] border border-pline bg-pcard p-3.5 text-center shadow-xs flex flex-col justify-center items-center">
                <span className="text-[10.5px] font-bold text-psubtle block mb-0.5">{language === 'ru' ? 'Ранг' : 'Unvon'}</span>
                <span className={cn('px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold truncate max-w-full', rankInfo.color)}>
                  {rankInfo.title}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-bold text-pmuted px-1">{tt('duelRecentMatches')}</h3>
              {history.length === 0 ? (
                <div className="rounded-[22px] border border-pline bg-pcard p-8 text-center shadow-xs space-y-3">
                  <Trophy size={32} className="mx-auto text-psubtle" />
                  <div>
                    <h4 className="text-sm font-bold text-pfg">{tt('noBattlesYet')}</h4>
                    <p className="text-xs text-psubtle mt-1">{tt('noBattlesDesc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { playSound('click'); haptics.impact('heavy'); onFind() }}
                    className="h-10 px-5 rounded-control bg-pprimary text-ponprimary text-xs font-bold shadow-xs active:scale-95 transition-all"
                  >
                    {tt('findOpponent')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex flex-col justify-between rounded-[20px] border border-pline bg-pcard p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={h.opponentName} src={h.opponentAvatar} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-pfg truncate">{h.opponentName}</p>
                          <p className="text-[9.5px] text-psubtle">{formatRelativeTime(h.timestamp, language)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-pline/60">
                        <span className="font-display text-sm font-black text-pfg tracking-tight tabular-nums">
                          {h.yourScore} : {h.oppScore}
                        </span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold',
                          h.result === 'win'  ? 'bg-psuccess/15 text-psuccess' :
                          h.result === 'lose' ? 'bg-pdanger/15 text-pdanger' :
                          'bg-pwarning/15 text-pwarning'
                        )}>
                          {h.result === 'win' ? tt('duelWinBadge') : h.result === 'lose' ? tt('duelLoseBadge') : tt('duelDrawBadge')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Reyting Subview -> ALOHIDA DEDICATED DUEL LEADERBOARD KOMPONENTI */}
        {subview === 'leaderboard' && (
          <DuelLeaderboardView
            tt={tt}
            user={user}
            language={language}
            onFind={() => { playSound('click'); haptics.impact('heavy'); onFind() }}
          />
        )}

        {/* 3. Online O'yinchilar Subview -> FAQAT HAQIQIY O'YINCHILAR (TABLE) */}
        {subview === 'online' && (
          <div className="space-y-3">
            {effectiveOnlineUsers.length === 0 ? (
              <div className="rounded-[22px] border border-pline bg-pcard p-8 text-center shadow-xs">
                <Users size={32} className="mx-auto text-psubtle mb-2" />
                <h4 className="text-sm font-bold text-pfg">{tt('onlinePlayersTitle')}</h4>
                <p className="text-xs text-psubtle mt-1">
                  {language === 'ru' ? 'Сейчас нет активных игроков. Начните поиск!' : "Hozircha faol o'yinchilar yo'q. Raqib qidirishni boshlang!"}
                </p>
                <button
                  type="button"
                  onClick={() => { playSound('click'); haptics.impact('heavy'); onFind() }}
                  className="mt-4 h-10 px-5 rounded-control bg-pprimary text-ponprimary text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                  {tt('findOpponent')}
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-container border border-pline bg-pcard divide-y divide-pline shadow-xs">
                {effectiveOnlineUsers.map((player) => (
                  <div
                    key={player.userId}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-psurface/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar name={player.name} src={avatarSrcFor(player)} frame={player.avatarFrame} />
                        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-pcard bg-psuccess animate-pulse" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-pfg truncate">
                          {player.name}
                          {player.isYou && (
                            <span className="ml-1.5 rounded-full bg-pprimary/20 px-1.5 py-0.2 text-[9px] font-extrabold text-pprimary">
                              {tt('youLabel')}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] font-semibold text-psuccess">
                          {tt('readyStatus')}
                        </p>
                      </div>
                    </div>

                    {!player.isYou && (
                      <button
                        type="button"
                        onClick={() => { playSound('click'); haptics.impact('medium'); onFind() }}
                        className="h-8 px-3 rounded-control bg-pprimary text-ponprimary text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all shrink-0 hover:brightness-[1.06]"
                      >
                        <Swords size={13} />
                        <span>{tt('challengeBtn')}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Do'st bilan Duel Subview -> TABLE KO'RINISHIDA */}
        {subview === 'invite' && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-container border border-pline bg-pcard divide-y divide-pline shadow-xs">
              {/* Row 1: PIN kodi */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-psubtle">{tt('yourRoomPin')}</span>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="h-7 px-2.5 rounded-control bg-psurface border border-plineStrong text-pfg text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                  >
                    {copiedPin ? <Check size={13} className="text-pprimary" /> : <Copy size={13} />}
                    <span>{copiedPin ? tt('pinCopied') : tt('copyPinBtn')}</span>
                  </button>
                </div>
                <div className="text-2xl font-black font-mono tracking-widest text-pprimary select-all">
                  {quickPin.slice(0, 3)} {quickPin.slice(3)}
                </div>
              </div>

              {/* Row 2: Telegram orqali ulashish */}
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-pfg">{tt('shareInviteBtn')}</p>
                  <p className="text-[11px] text-psubtle">{tt('duelInviteHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleShareInvite}
                  className="h-9 px-3.5 rounded-control bg-[rgb(var(--p-blue-rgb)/0.15)] text-pblue border border-[rgb(var(--p-blue-rgb)/0.30)] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 hover:bg-[rgb(var(--p-blue-rgb)/0.25)]"
                >
                  <Share2 size={14} />
                  <span>{language === 'ru' ? 'Отправить' : 'Ulashish'}</span>
                </button>
              </div>

              {/* Row 3: Do'stning PIN kodini kiritish */}
              <div className="p-4 space-y-2.5">
                <label className="text-xs font-bold text-pfg block">{tt('enterPinPrompt')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={inputPin}
                    onChange={(e) => {
                      setInputPin(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''))
                      setPinError(null)
                    }}
                    placeholder={tt('pinInputPlaceholder')}
                    className="flex-1 h-10 px-3 rounded-control bg-psurface border border-pline focus:border-ppurple text-center font-mono text-sm font-black text-pfg placeholder:text-psubtle/40 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleJoinPin}
                    disabled={!inputPin.trim()}
                    className="h-10 px-4 rounded-control bg-pprimary text-ponprimary text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shrink-0"
                  >
                    <KeyRound size={14} />
                    <span>{tt('joinRoomBtn')}</span>
                  </button>
                </div>
                {pinError && <p className="text-[11px] font-bold text-pdanger text-center">{pinError}</p>}
              </div>

              {/* Row 4: Xona yaratib kutish */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-pfg">{tt('startWaitingBtn')}</p>
                  <p className="text-[11px] text-psubtle">{tt('roomWaitingHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onJoinWithPin(quickPin)}
                  className="h-9 px-3.5 rounded-control bg-pprimary text-ponprimary text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all shrink-0"
                >
                  <Swords size={14} />
                  <span>{language === 'ru' ? 'Войти' : 'Kirish'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── ASOSIY HUB KO'RINISHI (Hero Banner + 2x2 Grid Menyu) ──
  const onlineCount = effectiveOnlineCount

  return (
    <div className="w-full max-w-md mx-auto space-y-4 pt-1">
      {/* ── 1. Hero PvP Match Banner ── */}
      <div className="relative overflow-hidden rounded-[26px] border border-ppurple/30 bg-gradient-to-b from-ppurple/15 via-pcard to-pcard p-5 text-center shadow-md">
        <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-ppurple/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 size-32 rounded-full bg-pprimary/15 blur-2xl" />

        {/* Live Online Badge */}
        <div className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold mb-3 transition-colors",
          onlineCount > 0
            ? "border-psuccess/30 bg-psuccess/10 text-psuccess"
            : "border-pline bg-psurface text-psubtle"
        )}>
          <span className={cn(
            "size-2 rounded-full",
            onlineCount > 0 ? "bg-psuccess animate-pulse" : "bg-psubtle"
          )} />
          <span>
            {`${onlineCount} ${tt('onlinePlayersCount')}`}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <Swords size={24} className="text-ppurple" />
          <h2 className="font-display text-xl font-extrabold tracking-tight text-pfg">
            {tt('octagonTitle')}
          </h2>
        </div>
        <p className="text-xs text-psubtle max-w-xs mx-auto mb-4">
          {language === 'ru'
            ? 'Реальный бой 1 на 1: 10 вопросов, 15 секунд на каждый'
            : "Haqiqiy 1 ga 1 jonli bellashuv: 10 ta savol, har biriga 15 soniya"}
        </p>

        {/* Action Button: Tezkor Raqib Topish */}
        <button
          type="button"
          onClick={() => { playSound('click'); haptics.impact('heavy'); onFind() }}
          disabled={connFailed}
          className="w-full h-12 rounded-control bg-pprimary text-ponprimary font-display text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Swords size={18} />
          <span>{tt('findOpponent')}</span>
        </button>
      </div>

      {/* ── 2. Asosiy 4 ta Bo'lim (Alohida 2x2 Grid Kartalar — Navigatsiya) ── */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-pmuted">
            {language === 'ru' ? 'Разделы Арены' : "Arena bo'limlari"}
          </span>
          <span className="text-[11px] text-psubtle font-semibold">
            {language === 'ru' ? 'Нажмите для перехода' : "Ochish uchun bosing"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {(['battles', 'leaderboard', 'online', 'invite'] as const).map((tKey) => {
            const meta =
              tKey === 'battles' ? {
                title: language === 'ru' ? 'Мои бои' : 'Mening janglarim',
                desc: `${totalWins} ${tt('duelWinsLabel').toLowerCase()}`,
                icon: Swords,
                color: 'text-pprimary bg-pprimary/10',
              } :
              tKey === 'leaderboard' ? {
                title: tt('duelLeaderboardTab'),
                desc: language === 'ru' ? 'Топ игроков' : 'Top duelchilar',
                icon: Trophy,
                color: 'text-amber-500 bg-amber-500/10',
              } :
              tKey === 'online' ? {
                title: 'Online',
                desc: `${onlineCount} ${language === 'ru' ? 'онлайн' : 'faol'}`,
                icon: Users,
                color: 'text-psuccess bg-psuccess/10',
              } : {
                title: language === 'ru' ? 'С другом' : "Do'st bilan",
                desc: 'PIN / Link',
                icon: UserPlus,
                color: 'text-ppurple bg-ppurple/10',
              }
            const Icon = meta.icon

            return (
              <button
                key={tKey}
                type="button"
                onClick={() => { playSound('click'); haptics.impact('medium'); setSubview(tKey) }}
                className="relative flex items-center justify-between p-3.5 rounded-[22px] border border-pline bg-pcard hover:border-pprimary/50 hover:bg-psurface/70 text-left transition-all duration-[120ms] ease-out active:scale-[0.97] shadow-xs group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn('size-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', meta.color)}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-pfg truncate group-hover:text-pprimary transition-colors">
                      {meta.title}
                    </p>
                    <p className="text-[10.5px] text-psubtle truncate mt-0.5 font-medium">
                      {meta.desc}
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-psubtle group-hover:text-pprimary transition-colors shrink-0 ml-1" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
