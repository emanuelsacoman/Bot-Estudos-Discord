const { DISCORD_LIMITS, validText, isHttpUrl } = require("./content-limits");

const DOCUMENTATION_SELECT_ID = "codebucket:docs:select";
// https://docs.discord.com/developers/components/reference#string-select
const MAX_DOCUMENTATION_OPTIONS = 25;
const MAX_OPTION_LENGTH = 100;

function validateDocumentationCatalog(entries) {
  if (
    !Array.isArray(entries) ||
    entries.length < 1 ||
    entries.length > MAX_DOCUMENTATION_OPTIONS
  ) {
    throw new RangeError("O catálogo deve conter de 1 a 25 tecnologias.");
  }
  const ids = new Set();
  // Array position is the presentation order; snapshot data is immutable.
  return Object.freeze(
    Array.from(entries, (entry) => {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !/^[a-z][a-z0-9-]{0,99}$/.test(entry.id) ||
        ids.has(entry.id) ||
        !validText(entry.label, MAX_OPTION_LENGTH) ||
        !validText(entry.description, MAX_OPTION_LENGTH) ||
        !isHttpUrl(entry.url) ||
        !entry.url.startsWith("https://") ||
        /[\s\u0000-\u001f\u007f<>`\\]/.test(entry.url) ||
        new URL(entry.url).protocol !== "https:" ||
        (entry.article !== undefined &&
          !["do", "da"].includes(entry.article)) ||
        (
          "Documentação " +
          (entry.article ?? "do") +
          " " +
          entry.label +
          ": " +
          entry.url
        ).length > DISCORD_LIMITS.content
      ) {
        throw new TypeError(
          "Tecnologia inválida ou duplicada no catálogo de documentação.",
        );
      }
      ids.add(entry.id);
      return Object.freeze({
        id: entry.id,
        label: entry.label,
        description: entry.description,
        url: entry.url,
        ...(entry.article === undefined ? {} : { article: entry.article }),
      });
    }),
  );
}

// Laravel was only in the old link map, never offered in the 25-option menu.
const documentationCatalog = validateDocumentationCatalog([
  {
    id: "angular",
    label: "Angular",
    description: "Veja a documentação do Angular",
    url: "https://angular.io/docs",
  },
  {
    id: "csharp",
    label: "C#",
    description: "Veja a documentação de C#",
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/",
  },
  {
    id: "cpp",
    label: "C++",
    description: "Veja a documentação de C++",
    url: "https://isocpp.org/faq",
  },
  {
    id: "css",
    label: "CSS",
    description: "Veja a documentação de CSS",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
  },
  {
    id: "dart",
    label: "Dart",
    description: "Veja a documentação do Dart",
    url: "https://dart.dev/guides",
  },
  {
    id: "discordjs",
    label: "Discord.js",
    description: "Veja a documentação de Discord.js",
    url: "https://discordjs.guide/#before-you-begin",
  },
  {
    id: "git",
    label: "Git",
    description: "Veja a documentação do Git",
    url: "https://git-scm.com/docs/git/pt_BR",
  },
  {
    id: "go",
    label: "Go",
    description: "Veja a documentação do Go",
    url: "https://golang.org/doc/",
  },
  {
    id: "godot",
    label: "Godot",
    description: "Veja a documentação do Godot",
    url: "https://docs.godotengine.org/en/stable/",
  },
  {
    id: "html",
    label: "HTML",
    description: "Veja a documentação de HTML",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
  },
  {
    id: "ionic",
    label: "Ionic",
    description: "Veja a documentação do Ionic",
    url: "https://ionicframework.com/docs",
  },
  {
    id: "java",
    label: "Java",
    description: "Veja a documentação de Java",
    url: "https://docs.oracle.com/en/java/",
  },
  {
    id: "javascript",
    label: "Javascript",
    description: "Veja a documentação de Javascript",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  },
  {
    id: "kotlin",
    label: "Kotlin",
    description: "Veja a documentação do Kotlin",
    url: "https://kotlinlang.org/docs/home.html",
  },
  {
    id: "python",
    label: "Python",
    description: "Veja a documentação de Python",
    url: "https://www.python.org",
  },
  {
    id: "react",
    label: "React",
    description: "Veja a documentação do React",
    url: "https://reactjs.org/docs/getting-started.html",
  },
  {
    id: "ruby",
    label: "Ruby",
    description: "Veja a documentação do Ruby",
    url: "https://www.ruby-lang.org/pt/documentation/",
  },
  {
    id: "swift",
    label: "Swift",
    description: "Veja a documentação do Swift",
    url: "https://swift.org/documentation/",
  },
  {
    id: "typescript",
    label: "TypeScript",
    description: "Veja a documentação de TypeScript",
    url: "https://www.typescriptlang.org/docs/",
  },
  {
    id: "unreal",
    label: "Unreal Engine",
    description: "Veja a documentação da Unreal Engine",
    url: "https://docs.unrealengine.com/",
    article: "da",
  },
  {
    id: "unity",
    label: "Unity",
    description: "Veja a documentação do Unity",
    url: "https://learn.unity.com/",
  },
  {
    id: "rust",
    label: "Rust",
    description: "Veja a documentação do Rust",
    url: "https://doc.rust-lang.org/book/",
  },
  {
    id: "php",
    label: "PHP",
    description: "Veja a documentação do PHP",
    url: "https://www.php.net/manual/en/",
  },
  {
    id: "vuejs",
    label: "Vue.js",
    description: "Veja a documentação do Vue.js",
    url: "https://vuejs.org/v2/guide/",
  },
  {
    id: "jquery",
    label: "jQuery",
    description: "Veja a documentação do jQuery",
    url: "https://api.jquery.com/",
  },
]);
const documentationById = new Map(
  documentationCatalog.map((entry) => [entry.id, entry]),
);

function findDocumentation(id) {
  return typeof id === "string" ? documentationById.get(id) : undefined;
}

function getDocumentationOptions() {
  return documentationCatalog.map(({ id, label, description }) => ({
    label,
    description,
    value: id,
  }));
}

module.exports = {
  DOCUMENTATION_SELECT_ID,
  documentationCatalog,
  validateDocumentationCatalog,
  findDocumentation,
  getDocumentationOptions,
};
