/**
 * Kutubxona fanlari → lucide ikonkalar.
 *
 * Ikonkalar FAQAT shu yerda (content/ kod import qilmaydi — AGENTS 1a).
 * Noma'lum id — neytral BookOpenText fallback (yangi fan qo'shilsa UI buzilmaydi).
 */
import {
  Atom,
  BookOpenText,
  Calculator,
  Coins,
  Compass,
  Dna,
  Dumbbell,
  Feather,
  Flag,
  FlaskConical,
  Globe2,
  Heart,
  HeartHandshake,
  Landmark,
  Languages,
  Leaf,
  MonitorSmartphone,
  Music,
  Palette,
  Scale,
  Shield,
  Sparkles,
  Sprout,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  'ona-tili': BookOpenText,
  adabiyot: Feather,
  matematika: Calculator,
  english: Languages,
  'rus-tili': Languages,
  'nemis-tili': Languages,
  'fransuz-tili': Languages,
  tarix: Landmark,
  biologiya: Dna,
  fizika: Atom,
  kimyo: FlaskConical,
  geografiya: Globe2,
  informatika: MonitorSmartphone,
  texnologiya: Wrench,
  'jismoniy-tarbiya': Dumbbell,
  musiqa: Music,
  'tasviriy-sanat': Palette,
  tabiatshunoslik: Leaf,
  odobnoma: HeartHandshake,
  huquq: Scale,
  tarbiya: Sprout,
  'milliy-goya': Flag,
  iqtisodiyot: Coins,
  'vatan-tuygusi': Heart,
  chizmachilik: Compass,
  'chaqiruv-tayyorgarlik': Shield,
  manaviyat: Sparkles,
}

export function librarySubjectIcon(id: string): LucideIcon {
  return ICONS[id] ?? BookOpenText
}
