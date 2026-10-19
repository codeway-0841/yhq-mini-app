import type { DarslikCheck } from '../../../shared/darslik-mastery'

export const firstTopicCheck: DarslikCheck = { questions: [
  { id: 'sound', kind: 'mcq', prompt: 'Что мы произносим и слышим?', options: ['Буквы', 'Звуки', 'Знаки препинания', 'Написание слов'], correctIndex: 1, explanation: 'Звуки мы произносим и слышим, а буквы видим и пишем.' },
  { id: 'horse', kind: 'mcq', prompt: 'Почему в слове «конь» звуков меньше, чем букв?', options: ['Буква о не обозначает звука', 'Буква к обозначает два звука', 'Мягкий знак не обозначает отдельного звука', 'Буква н не произносится'], correctIndex: 2, explanation: 'В слове «конь» четыре буквы и три звука. Ь обозначает мягкость согласного и не имеет собственного звука.' },
  { id: 'count', kind: 'input', prompt: 'Сколько звуков в слове «дом»? Запиши число цифрой.', answers: ['3'], explanation: 'В слове «дом» три звука: [д], [о], [м].' },
] }
