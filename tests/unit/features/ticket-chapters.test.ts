import { describe, it, expect } from 'vitest'
import {
  SUBJECT_CHAPTERS,
  getTopicChapterId,
  sortTopicsForTickets,
} from '../../../src/features/tickets/ticket-chapters'
import type { DbTopic } from '../../../src/shared/api'

describe('ticket-chapters', () => {
  it('hamma fanlar uchun SUBJECT_CHAPTERS konfiguratsiyasi mavjud va har birida "all" tabi bor', () => {
    const subjects = [
      'fizika',
      'ingliz',
      'biologiya',
      'kimyo',
      'geografiya',
      'tarix',
      'onatili',
      'adabiyot',
      'matematika',
      'rustili',
    ]

    for (const s of subjects) {
      const chapters = SUBJECT_CHAPTERS[s]
      expect(chapters).toBeDefined()
      expect(chapters.length).toBeGreaterThan(2)
      expect(chapters[0].id).toBe('all')
      expect(chapters[0].labelUz).toBe('Barchasi')
    }
  })

  describe('getTopicChapterId', () => {
    it('biologiya mavzularini sinflar bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('biologiya', 'biology_db-bio5_m1', 'Biologiya-5, 1-§')).toBe('bio-5')
      expect(getTopicChapterId('biologiya', 'biology_db-bio7_m1', 'Biologiya-7, 1-§')).toBe('bio-7')
      expect(getTopicChapterId('biologiya', 'biology_db-bio8_m1', 'Biologiya-8, 1-§')).toBe('bio-8')
      expect(getTopicChapterId('biologiya', 'biology_db-bio9_m1', 'Biologiya-9, 1-§')).toBe('bio-9')
      expect(getTopicChapterId('biologiya', 'biology_db-bio10_m1_1', 'Biologiya-10, 1.1')).toBe('bio-10')
      expect(getTopicChapterId('biologiya', 'biology_db-bio11_m1', 'Biologiya-11, 1-§')).toBe('bio-11')
    })

    it('kimyo mavzularini sinflar bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('kimyo', 'chemistry_db-kimyo_7_ozb_m01', '01-mavzu')).toBe('kimyo-7')
      expect(getTopicChapterId('kimyo', 'chemistry_db-kimyo_8_ozb_m01', '01-mavzu')).toBe('kimyo-8')
      expect(getTopicChapterId('kimyo', 'chemistry_db-kimyo_9_ozb_m01', '01-mavzu')).toBe('kimyo-9')
      expect(getTopicChapterId('kimyo', 'chemistry_db-kimyo_10_ozb_m01', '01-mavzu')).toBe('kimyo-10')
      expect(getTopicChapterId('kimyo', 'chemistry_db-kimyo_11_ozb_m01', '01-mavzu')).toBe('kimyo-11')
    })

    it('geografiya mavzularini sinflar bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('geografiya', 'geography_db-geo5_m1', 'Geografiya-5, 1-§')).toBe('geo-5')
      expect(getTopicChapterId('geografiya', 'geography_db-geo_6_p01', '1-§. Materiklar')).toBe('geo-6')
      expect(getTopicChapterId('geografiya', 'geography_db-geo7_m1', 'Geografiya-7, 1-§')).toBe('geo-7')
      expect(getTopicChapterId('geografiya', 'geography_db-geo_8_p01', '1-§. O\'zbekiston')).toBe('geo-8')
      expect(getTopicChapterId('geografiya', 'geography_db-geo_9_p01', '1-§. Jahon')).toBe('geo-9')
      expect(getTopicChapterId('geografiya', 'geography_db-geo10_m1', 'Geografiya-10, 1-§')).toBe('geo-10')
    })

    it('tarix mavzularini sinflar bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('tarix', 'history_db-tarix_6_b1-m1', '1-§. Qadimgi')).toBe('tarix-6')
      expect(getTopicChapterId('tarix', 'history_db-tarix_7_m1', '1-§. O\'rta asr')).toBe('tarix-7')
      expect(getTopicChapterId('tarix', 'history_db-tarix_8_m1', '1-§. Yangi davr')).toBe('tarix-8')
      expect(getTopicChapterId('tarix', 'history_db-tarix_9_m1', '1-§. Yangi tarix')).toBe('tarix-9')
      expect(getTopicChapterId('tarix', 'history_db-01-mavzu', '10-sinf O\'zbekiston tarixi')).toBe('tarix-10')
      expect(getTopicChapterId('tarix', 'history_db-11jahon_23', '11-sinf Jahon tarixi')).toBe('tarix-11')
    })

    it('ona tili mavzularini tilshunoslik bo\'limlari bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_fon_m01', 'Yozuvlar tarixi')).toBe('fon')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_orf_m01', 'Talaffuz')).toBe('orf')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_iml_m01', 'Imlo')).toBe('iml')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_lek_m01', 'Leksika')).toBe('lek')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_mor_m01', 'Ot so\'z turkumi')).toBe('mor')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_sin_m01', 'So\'z birikmasi')).toBe('sin')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_pun_m01', 'Nuqta')).toBe('pun')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_usl_m01', 'Nutq uslublari')).toBe('usl')
      expect(getTopicChapterId('onatili', 'onatili_db-onatili_mat_m01', 'Matn')).toBe('mat')
    })

    it('adabiyot mavzularini davrlar bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_xoi_m01', 'Folklor')).toBe('xoi')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_qad_m01', 'Qadimgi')).toBe('qad')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_mum_m01', 'Navoiy')).toBe('mum')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_xix_m01', 'Mashrab')).toBe('xix')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_jad_m01', 'Behbudiy')).toBe('jad')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_xx_m01', 'G\'afur G\'ulom')).toBe('xx')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_mus_m01', 'Tog\'ay Murod')).toBe('mus')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_jah_m01', 'Shekspir')).toBe('jah')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_naz_m01', 'Nazariya')).toBe('naz')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_san_m01', 'Tashbih')).toBe('san')
      expect(getTopicChapterId('adabiyot', 'adabiyot_db-adabiyot_msr_m01', 'Sertifikat asarlari')).toBe('msr')
    })

    it('matematika mavzularini bo\'limlar bo\'yicha to\'g\'ri tasniflaydi', () => {
      expect(getTopicChapterId('matematika', 'math_db-mtp-algebra-001', 'Algebra 1-variant')).toBe('algebra')
      expect(getTopicChapterId('matematika', 'math_db-mtp-geometriya-001', 'Geometriya 1-variant')).toBe('geometriya')
      expect(getTopicChapterId('matematika', 'math_db-mtp-kombinatorika-001', 'Kombinatorika')).toBe('kombinatorika')
    })
  })

  describe('sortTopicsForTickets', () => {
    it('biologiya mavzularini sinflar o\'sish tartibida saralaydi (5 -> 7 -> 8 -> 9 -> 10 -> 11)', () => {
      const mockTopics: DbTopic[] = [
        { id: 1, bankId: 'biology_db', nameUz: '10-sinf', nameRu: '10', slug: 'biology_db-bio10_m1' },
        { id: 2, bankId: 'biology_db', nameUz: '5-sinf', nameRu: '5', slug: 'biology_db-bio5_m1' },
        { id: 3, bankId: 'biology_db', nameUz: '7-sinf', nameRu: '7', slug: 'biology_db-bio7_m1' },
      ]
      const sorted = sortTopicsForTickets('biologiya', mockTopics)
      expect(sorted.map((t) => t.id)).toEqual([2, 3, 1])
    })

    it('ona tili mavzularini tilshunoslik boblari ketma-ketligida saralaydi (fonetika -> orfoepiya -> morfologiya -> sintaksis)', () => {
      const mockTopics: DbTopic[] = [
        { id: 1, bankId: 'onatili_db', nameUz: 'Morfologiya', nameRu: 'Морфология', slug: 'onatili_db-onatili_mor_m01' },
        { id: 2, bankId: 'onatili_db', nameUz: 'Fonetika', nameRu: 'Фонетика', slug: 'onatili_db-onatili_fon_m01' },
        { id: 3, bankId: 'onatili_db', nameUz: 'Sintaksis', nameRu: 'Синтаксис', slug: 'onatili_db-onatili_sin_m01' },
      ]
      const sorted = sortTopicsForTickets('onatili', mockTopics)
      expect(sorted.map((t) => t.id)).toEqual([2, 1, 3])
    })
  })
})
