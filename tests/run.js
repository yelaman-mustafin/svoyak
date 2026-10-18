// Запускает все сценарии и проверяет, что в их выводе есть ожидаемые строки.
// Использование: npm test (сначала собирает сайт в dist/, сценарии проверяют собранную версию)
// Каждый сценарий — отдельный файл *.test.js: он поднимает несколько «устройств»
// (ведущий и игроки) в jsdom с общей имитацией Firebase и печатает, что видно на экранах.
const { execFileSync } = require("child_process");
const path = require("path");

const CHECKS = {
  "host-classic.test.js": [
    /code \d{4}/,                                   // комната создана
    /lobby: .*Айгерим.*Данияр/,                     // оба игрока в лобби
    /after wrong host: open/,                      // после ошибки кнопки снова открылись
    /final phase: final-bet/,                      // дошли до финала
    /kicked phone: Ведущий удалил вас из комнаты/,  // удаление игрока
    /closed: Ведущий закрыл комнату/               // закрытие комнаты
  ],
  "no-host-and-quiz.test.js": [
    /org mode: player/,                            // организатор играет со своего телефона
    /judged: Айгерим «астанa»: верно/,             // автопроверка ответа
    /typo ok: Орг «меркури»: верно/,               // опечатка прощается
    /final end: end/,                              // финал без ведущего завершился
    /quiz reveal host: Верно ответили 1 из 2/,      // викторина считает ответы
    /quiz end host: end/
  ],
  "host-controls.test.js": [
    /"choices":\["Суши","Рамен","Темпура","Пицца"\]/, // варианты из пака SIGame
    /strip: Г\) Пицца/,                             // буква ответа превращена в текст
    /no limit: 0/,                                 // время без лимита
    /after \+10: 10 true/,                         // ведущий добавил 10 секунд
    /responder: Бек answer/,                       // «Дать ответить»
    /undo -> phase: board/,                        // «Вернуть на табло»
    /skip ->  reveal Вопрос пропущен/              // «Пропустить вопрос»
  ],
  "presence-and-start.test.js": [
    /start btn: Начать без игроков false/,          // можно начать без игроков
    /host away phone: Ведущий ещё не вошёл/,        // экран ожидания игрока
    /after reconnect online: true/,                // индикатор «в сети» восстанавливается
    /buzz heals online: true responder: Аня/,      // нажатие кнопки лечит серый индикатор
    /phone header: Раунд 1Казахстан100/            // шапка вопроса на телефоне
  ],
  "images.test.js": [
    /TV url img: true \| phone url img: https:\/\/ex\.com\/a\.jpg/,
    /media removed: true/,
    /pimg: false/,                                 // «только на экране» — телефоны не грузят
    /"_imgRef":"кот\.jpg"/                         // картинки из .siq находятся
  ],
  "screen-and-timer.test.js": [
    /resume after wrong: open left ok: true bar total = window: true/, // таймер продолжается после ошибки
    /intro: intro \| tv: Раунд 1Казахстан100 \| phone: Раунд 1Казахстан100 \| text hidden: true/, // заставка
    /after intro: reading \| text shown: true/,     // после заставки — вопрос
    /screen mode: screen \| host sees screens: 1 \| lobby: Код комнаты\d{4} \| not a player: 1/, // экран по ссылке
    /screen board cells: 25/,                       // табло на экране
    /answer hidden: true \| no host buttons: true/, // ответа и кнопок ведущего нет
    /screen reveal shows answer: true/,             // ответ появляется после показа
    /screen-only image: true media: true \| screen img: true \| phone img: false/, // картинка только на экран
    /screen end: true true/,                        // пьедестал и места
    /screen from home: screen \| screens: 2/,       // вход через главную
    /screen left: true host screens: 0/             // экран отключился
  ]
};

let failed = 0;
for (const [file, checks] of Object.entries(CHECKS)) {
  let out = "";
  try {
    out = execFileSync("node", [path.join(__dirname, file)], { encoding: "utf8", timeout: 120000 });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
  }
  const miss = checks.filter(re => !re.test(out));
  if (miss.length) {
    failed++;
    console.log(`✗ ${file}`);
    miss.forEach(re => console.log(`    не найдено: ${re}`));
    console.log(out.split("\n").map(l => "    | " + l).join("\n"));
  } else console.log(`✓ ${file} (${checks.length} проверок)`);
}
console.log(failed ? `\nПровалено сценариев: ${failed}` : "\nВсе сценарии прошли");
process.exit(failed ? 1 : 0);
