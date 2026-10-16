export interface InteractiveChapter {
  number: number
  key: string
  titleUz: string
  titleRu: string
  minutes: number
  path: string
}

export interface InteractiveBook {
  subjectId: string
  nameUz: string
  nameRu: string
  catalogPath: string
  color: string
  icon: string
  badgeUz: string
  badgeRu: string
  chapters: InteractiveChapter[]
}

export const INTERACTIVE_BOOKS: Record<string, InteractiveBook> = {
  fizika: {
    subjectId: 'fizika',
    nameUz: 'Interaktiv Fizika',
    nameRu: 'Интерактивная Физика',
    catalogPath: '/lessons/fizika/index.html',
    color: '#4fa3e3',
    icon: '⚡',
    badgeUz: "3Blue1Brown uslubidagi jonli animatsiyalar",
    badgeRu: "Живые анимации в стиле 3Blue1Brown",
    chapters: [
      {
        number: 1,
        key: 'fizika-ch01',
        titleUz: "To'g'ri chiziqli tekis harakat",
        titleRu: "Прямолинейное равномерное движение",
        minutes: 4,
        path: '/lessons/fizika/ch01/index.html'
      },
      {
        number: 2,
        key: 'fizika-ch02',
        titleUz: "Termodinamik sikllar va Karno dvigateli",
        titleRu: "Термодинамические циклы и двигатель Карно",
        minutes: 6,
        path: '/lessons/fizika/ch02/index.html'
      }
    ]
  }
}

export function getInteractiveBook(subjectId: string): InteractiveBook | undefined {
  return INTERACTIVE_BOOKS[subjectId]
}
