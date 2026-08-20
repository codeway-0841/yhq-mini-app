/**
 * ShopPage Merch bo'limi (#40 Faza 3) — real fizik tovarlar coin'ga:
 * katalog (SSR: shared/merch-items) + server zaxira holati (GET /coins/merch)
 * + buyurtma modali + buyurtma muvaffaqiyati.
 */
import { useEffect, useState } from 'react'
import { Coins, Check, Package, ShoppingBag } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { api, type MerchCatalogItem } from '../../shared/api'
import { MERCH_ITEMS, getMerchItem, type MerchItem } from '../../../shared/merch-items'
import { playSound } from '../../shared/lib/sounds'
import { useT } from '../../shared/i18n'
import MerchOrderModal from './MerchOrderModal'

export default function MerchSection({ onCelebration }: { onCelebration?: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const coins = useAppStore((s) => s.coins)
  const setCoins = useAppStore((s) => s.setCoins)

  const [catalog, setCatalog] = useState<MerchCatalogItem[] | null>(null)
  const [orderItem, setOrderItem] = useState<MerchItem | null>(null)
  const [ordered, setOrdered] = useState<{ orderId: number | null } | null>(null)

  useEffect(() => {
    api.getMerchCatalog().then((r) => setCatalog(r.items)).catch(() => setCatalog([]))
  }, [])

  const handleOrdered = (orderId: number | null, balance: number) => {
    setCoins(balance)
    setOrderItem(null)
    setOrdered({ orderId })
    playSound('win')
    onCelebration?.()
    // Zaxira holatini yangilaymiz
    api.getMerchCatalog().then((r) => setCatalog(r.items)).catch(() => {})
  }

  return (
    <>
      <p className="px-5 mt-6 mb-2.5 text-[10px] font-semibold text-psubtle uppercase tracking-[0.14em] flex items-center gap-1.5">
        <ShoppingBag size={11} /> {tt('merchTitle')}
      </p>
      <div className="grid grid-cols-1 gap-3 px-5">
        {MERCH_ITEMS.map((item) => {
          const state = catalog?.find((c) => c.id === item.id)
          const remaining = state?.remaining ?? item.stock
          const soldOut = remaining <= 0
          const owned = state?.alreadyOwned ?? false
          const affordable = coins >= item.price
          return (
            <div key={item.id} className="card-premium p-4 flex items-center gap-3.5 relative overflow-hidden">
              {/* Emoji tile */}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-none"
                style={{
                  background: 'rgb(var(--p-gold-rgb) / 0.08)',
                  border: '1px solid rgb(var(--p-gold-rgb) / 0.25)',
                }}>
                {item.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold truncate">{item.label[lang]}</p>
                <p className="text-[10.5px] text-pmuted mt-0.5 leading-snug line-clamp-2">{item.desc[lang]}</p>
                <p className="text-[10.5px] font-bold mt-1"
                  style={{ color: soldOut ? 'var(--p-danger)' : 'var(--p-subtle)' }}>
                  {soldOut ? tt('merchSoldOut') : `${remaining} ${tt('merchStockLeft')}`}
                </p>
              </div>
              <div className="flex-none">
                {owned ? (
                  <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black"
                    style={{
                      background: 'rgb(var(--p-success-rgb) / 0.12)',
                      border: '1px solid rgb(var(--p-success-rgb) / 0.35)',
                      color: 'var(--p-success)',
                    }}>
                    <Check size={12} /> {tt('merchOwned')}
                  </span>
                ) : soldOut ? (
                  <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black text-psubtle bg-psurface border border-pline">
                    {tt('merchSoldOut')}
                  </span>
                ) : (
                  <button
                    onClick={() => { playSound('click'); setOrderItem(item) }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-black active:scale-[0.96] transition-transform"
                    style={{
                      background: affordable ? 'rgb(var(--p-gold-rgb) / 0.16)' : 'var(--p-surface)',
                      border: `1px solid ${affordable ? 'rgb(var(--p-gold-rgb) / 0.5)' : 'var(--p-line)'}`,
                      color: affordable ? 'var(--p-gold)' : 'var(--p-subtle)',
                    }}>
                    <Coins size={12} fill="currentColor" />
                    {item.price.toLocaleString('ru-RU')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <p className="text-center text-[10.5px] text-psubtle flex items-center justify-center gap-1">
          <Package size={11} /> {tt('merchLimitOne')}
        </p>
      </div>

      {/* Buyurtma modali */}
      {orderItem && getMerchItem(orderItem.id) && (
        <MerchOrderModal item={orderItem} onClose={() => setOrderItem(null)} onOrdered={handleOrdered} />
      )}

      {/* Muvaffaqiyat holati */}
      {ordered && (
        <div className="mx-5 mt-4 rounded-2xl px-4 py-3.5 text-center animate-fadeIn"
          style={{
            background: 'rgb(var(--p-success-rgb) / 0.10)',
            border: '1px solid rgb(var(--p-success-rgb) / 0.4)',
          }}>
          <p className="text-[13.5px] font-black text-psuccess">🎉 {tt('merchOrdered')}</p>
          <p className="text-[11.5px] text-pmuted mt-0.5">{tt('merchOrderedDesc')}</p>
        </div>
      )}
    </>
  )
}
