// Sections from the agreed concept that are not built yet. Shown in the nav so the whole system is visible.
export const PROTOTYPE_URL = "https://claude.ai/artifact/SXKSG2sNFmsmpmavW3XwVn";

export interface Upcoming {
  name: string;
  stage: string;
  about: string[];
}

export const UPCOMING: Record<string, Upcoming> = {
  goals: {
    name: "Цели", stage: "этап 4",
    about: ["Надиктовал цель, Claude разбил её на постепенные шаги, 1–2 в неделю", "Один график со всеми целями в процентах", "У каждой цели своя папка с шагами и привычками"],
  },
  content: {
    name: "Контент", stage: "этап 4",
    about: ["Одно поле для одной или многих идей, Claude предлагает площадку и формат", "Форматы: TG пост, аудио, видео; IG карусель, пост, Reels; YT Shorts и длинное", "Охваты и заявки по каждой публикации, переупаковка"],
  },
  week: {
    name: "Итоги недели", stage: "этап 4",
    about: ["Каждое воскресенье в 20:00: что сделано, что сдвинулось, деньги, здоровье, цели", "План на следующую неделю"],
  },
  vault: {
    name: "Пароли", stage: "этап 4",
    about: ["Отдельное хранилище с отдельной защитой", "Пароли живут только здесь и нигде больше в системе"],
  },
};
