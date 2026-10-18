// Сборка сайта.
// index.html — только разметка-шаблон с двумя метками:
//   <!-- APP_STYLE -->  сюда подставляется src/styles.css
//   <!-- APP_SCRIPT --> сюда подставляются разделы из src/js/ по порядку номеров
// Разделы склеиваются в один обычный <script>, как было в однофайловой версии:
// у них общая область видимости, поэтому функции одного раздела видны в другом
// без import/export. Результат сборки — один файл dist/index.html.
import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "src");
const JS = path.join(SRC, "js");

function inlineApp() {
  return {
    name: "svoya-inline-app",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const css = fs.readFileSync(path.join(SRC, "styles.css"), "utf8");
        const js = fs.readdirSync(JS).filter(f => /^\d+-.*\.js$/.test(f)).sort()
          .map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("");
        // Функции вместо строк, чтобы «$» в коде не понимался как спецсимвол replace.
        return html
          .replace("<!-- APP_STYLE -->", () => `<style>\n${css}</style>`)
          .replace("<!-- APP_SCRIPT -->", () => `<script>\n${js}</script>`);
      }
    },
    // В режиме разработки (npm run dev) перезагружать страницу при правке разделов.
    configureServer(server) {
      server.watcher.add(SRC);
      server.watcher.on("change", file => {
        if (file.startsWith(SRC)) server.ws.send({ type: "full-reload" });
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [inlineApp()],
  // Стили не сжимаем: сжатие переставляет правила, а итог должен совпадать с исходником.
  build: { outDir: "dist", emptyOutDir: true, cssMinify: false }
});
