import { useState } from 'react'
import { X, Coins, Check, ShoppingBag } from 'lucide-react'
import Confetti from '../../../shared/components/Confetti'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import { playSound } from '../../../shared/lib/sounds'

interface Props {
  name: string
  image: string
  price: number
  balance: number
  lang: 'uz' | 'ru'
  type: 'avatar' | 'merch' | 'badge'
  onClose: () => void
  onPurchase: () => void
}

export function PurchaseModal({ name, image, price, balance, lang, type, onClose, onPurchase }: Props) {
  const [purchased, setPurchased] = useState(false)
  const canAfford = balance >= price

  const handleBuy = () => {
    if (!canAfford) return
    setPurchased(true)
    playSound('win')
    onPurchase()
  }

  const typeLabel = {
    avatar: lang === 'ru' ? 'Аватар' : 'Avatar',
    merch: lang === 'ru' ? 'Мерч' : 'Merch',
    badge: lang === 'ru' ? 'Мерж' : 'Merj',
  }[type]

  return (
    <DialogOverlay onClose={onClose} labelId="purchase-title" position="center">
      {purchased && <Confetti count={28} />}
      <div className="relative w-full max-w-[320px] rounded-3xl bg-pcard border border-pline p-6 animate-premiumIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-psubtle hover:text-pfg transition-colors">
          <X size={20} />
        </button>

        {!purchased ? (
          <>
            {/* Preview */}
            <div className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-[48px] mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))',
                border: '1px solid rgba(139,92,246,0.25)',
              }}>
              {image}
            </div>

            <h3 className="text-[16px] font-bold text-pfg text-center">{name}</h3>
            <p className="text-[11px] text-psubtle text-center mt-1">{typeLabel}</p>

            {/* Price */}
            <div className="flex items-center justify-center gap-2 mt-4 py-3 rounded-xl bg-pcanvas">
              <Coins size={16} className="text-pgold" />
              <span className="text-[18px] font-black text-pfg">{price.toLocaleString()}</span>
              <span className="text-[12px] text-psubtle">token</span>
            </div>

            {/* Balance */}
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[11px] text-pmuted">
                {lang === 'ru' ? 'Ваш баланс:' : 'Balansingiz:'}
              </span>
              <span className={`text-[12px] font-bold ${canAfford ? 'text-psuccess' : 'text-pdanger'}`}>
                {balance.toLocaleString()} token
              </span>
            </div>

            {canAfford ? (
              <button onClick={handleBuy}
                className="btn-neon w-full mt-5 py-3.5 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2">
                <ShoppingBag size={16} />
                {lang === 'ru' ? 'Купить' : 'Sotib olish'}
              </button>
            ) : (
              <div className="mt-5">
                <button disabled
                  className="w-full py-3.5 rounded-2xl text-[14px] font-bold bg-pcanvas text-pdisabled border border-pline cursor-not-allowed">
                  {lang === 'ru' ? 'Недостаточно токенов' : 'Token yetarli emas'}
                </button>
                <p className="text-center text-[10.5px] text-psubtle mt-2">
                  {lang === 'ru'
                    ? `Нужно ещё ${(price - balance).toLocaleString()} токенов`
                    : `Yana ${(price - balance).toLocaleString()} token kerak`}
                </p>
              </div>
            )}
          </>
        ) : (
          /* Success state */
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-psuccess/15 border border-psuccess/40 flex items-center justify-center mb-4">
              <Check size={28} className="text-psuccess" />
            </div>
            <h3 className="text-[16px] font-bold text-pfg">
              {lang === 'ru' ? 'Поздравляем!' : 'Tabriklaymiz!'}
            </h3>
            <p className="text-[12px] text-pmuted mt-2">
              {lang === 'ru'
                ? `${name} успешно приобретён!`
                : `${name} muvaffaqiyatli sotib olindi!`}
            </p>
            <button onClick={onClose}
              className="btn-neon mt-5 px-8 py-3 rounded-2xl text-[13px] font-bold">
              {lang === 'ru' ? 'Отлично' : "Ajoyib"}
            </button>
          </div>
        )}
      </div>
    </DialogOverlay>
  )
}
