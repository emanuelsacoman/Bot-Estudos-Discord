const { Client, Events, GatewayIntentBits, Collection, Activity, ActivityType } = require('discord.js')
const { respond, runWithErrorHandling } = require('./lib/interactions');

const cooldowns = new Collection();

const dotenv = require('dotenv')
dotenv.config()
const { TOKEN } = process.env

// importação dos comandos
const fs = require("node:fs")
const path = require("node:path")
const commandsPath = path.join(__dirname, "commands")
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"))

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
client.commands = new Collection()

for (const file of commandFiles){
    const filePath = path.join(commandsPath, file)
    const command = require(filePath)
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command)
    } else  {
        console.log(`Esse comando em ${filePath} está com "data" ou "execute ausentes"`)
    } 
}

let status = [
    {
        name: "🗳️ Vote no top.gg",
        type: ActivityType.Watching,
        link: "https://top.gg/bot/1193011045577523300"
    },
    {
        name: "👨‍💻 Explorando novas linguagens",
        type: ActivityType.Playing,
    },
    {
        name: "📘 Compartilhando dicas de código",
        type: ActivityType.Playing,
    },
    {
        name: "🔍 Resolvendo bugs",
        type: ActivityType.Playing,
    },
    {
        name: "💬 Respondendo dúvidas de programação",
        type: ActivityType.Playing,
    },
    {
        name: "🚀 Lançando atualizações",
        type: ActivityType.Watching,
        link: "https://github.com/emanuelsacoman/CodeBucket-website"
    },
    {
        name: "🎵 Encontrando inspiração em músicas",
        type: ActivityType.Listening,
        link: "https://open.spotify.com/playlist/3FbsZmt8BrFFmVpKD4ju4H?si=0948ff034a394fba"
    },
    {
        name: "📚 Aprendendo novos frameworks",
        type: ActivityType.Playing,
    },
    {
        name: "💻 Codificando novas funcionalidades",
        type: ActivityType.Watching,
        link: "https://github.com/emanuelsacoman/CodeBucket-website"
    },
    {
        name: "🔍 Descobrindo novos comandos",
        type: ActivityType.Watching,
        link: "https://codebucketweb.web.app/comandos"
    },
    {
        name: "🔧 Otimizando desempenho",
        type: ActivityType.Playing,
    },
    {
        name: "🌐 Desenvolvendo para a web",
        type: ActivityType.Playing,
    },
    {
        name: "📝 Escrevendo documentação",
        type: ActivityType.Playing,
    },
    {
        name: "🔍 Depurando código",
        type: ActivityType.Playing
    },
    {
        name: "🛢️ Enchendo o balde de códigos",
        type: ActivityType.Playing,
    },
    {
        name: "🚀 Explodindo com novas features",
        type: ActivityType.Playing,
    },
    {
        name: "👥 Interagindo com a comunidade",
        type: ActivityType.Watching,
    },
    {
        name: "📊 Monitorando métricas",
        type: ActivityType.Watching,
    },
    {
        name: "🖥️ Testando atualizações",
        type: ActivityType.Playing,
    },
    {
        name: "🔮 Explorando possibilidades de IA",
        type: ActivityType.Watching,
    },
    {
        name: "🏗️ Construindo integrações",
        type: ActivityType.Playing,
    },
    {
        name: "🎨 Criando designs inovadores",
        type: ActivityType.Playing,
    },
    {
        name: "🔐 Aprimorando a segurança",
        type: ActivityType.Watching,
    },
    {
        name: "📈 Analisando tendências de código",
        type: ActivityType.Watching,
    },
    {
        name: "🤖 Automatizando processos",
        type: ActivityType.Playing,
    },
    {
        name: "⚙️ Configurando novas ferramentas",
        type: ActivityType.Playing,
    },
    {
        name: "💡 Inspirando com novas ideias",
        type: ActivityType.Playing,
    },
];

// Login do bot
client.once('ready', () => {
    console.log(`Pronto! Login realizado como ${client.user.tag}\n`);
    console.log(`${client.user.tag} foi iniciado em:`);

    client.guilds.cache.forEach(guild => {
        console.log(`Nome do servidor: ${guild.name} | ID: ${guild.id} | Membros: ${guild.memberCount}`);
    });

    console.log(`O bot está conectado em um total de ${client.guilds.cache.size} servidores.`);
    console.log('\n');

    //status personalizado
    setInterval(() => {
        let random = Math.floor(Math.random() * status.length);
        client.user.setActivity(status[random]);
    }, 100000);
});

//avisa se alguém adicionar o bot
client.on('guildCreate', guild => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    console.log(`O bot foi adicionado ao servidor: ${guild.name} (ID: ${guild.id})`);
    console.log(`Data: ${formattedDate}`);
    console.log(`Hora: ${formattedTime}`);
    console.log(`O bot está conectado em um total de ${client.guilds.cache.size} servidores.`);
    console.log('\n');
});
client.login(TOKEN)

// Linguagens para 'docs.js'
const selectedOptions = {
    angular: "Documentação do Angular: https://angular.io/docs",
    csharp: "Documentação do C#: https://learn.microsoft.com/en-us/dotnet/csharp/",
    cpp: "Documentação do C++: https://devdocs.io/cpp/",
    css: "Documentação do CSS: https://developer.mozilla.org/en-US/docs/Web/CSS",
    discordjs: "Documentação do Discord.js: https://discordjs.guide/#before-you-begin",
    godot: "Documentação do Godot: https://docs.godotengine.org/en/stable/",
    html: "Documentação do HTML: https://developer.mozilla.org/en-US/docs/Web/HTML",
    ionic: "Documentação do Ionic: https://ionicframework.com/docs",
    java: "Documentação do Java: https://docs.oracle.com/en/java/",
    javascript: "Documentação do Javascript: https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    python: "Documentação do Python: https://www.python.org",
    react: "Documentação do React: https://reactjs.org/docs/getting-started.html",
    typescript: "Documentação do TypeScript: https://www.typescriptlang.org/docs/",
    unreal: "Documentação da Unreal Engine: https://docs.unrealengine.com/",
    unity: "Documentação do Unity: https://learn.unity.com/",
    dart: "Documentação do Dart: https://dart.dev/guides",
    go: "Documentação do Go: https://golang.org/doc/",
    kotlin: "Documentação do Kotlin: https://kotlinlang.org/docs/home.html",
    ruby: "Documentação do Ruby: https://www.ruby-lang.org/pt/documentation/",
    swift: "Documentação do Swift: https://swift.org/documentation/",
    git: "Documentação do Git: https://git-scm.com/docs/git/pt_BR",
    laravel: "Documentação do Laravel: https://laravel.com/docs/10.x/readme",
    rust: "Documentação do Rust: https://doc.rust-lang.org/book/",
    php: "Documentação do PHP: https://www.php.net/manual/en/",
    vuejs: "Documentação do Vue.js: https://vuejs.org/v2/guide/",
    jquery: "Documentação do jQuery: https://api.jquery.com/",
};

const docsCommand = require('./commands/docs');
client.commands.set(docsCommand.data.name, docsCommand);

// Listener de interações com o bot
client.on(Events.InteractionCreate, interaction =>
    runWithErrorHandling(interaction, async () => {
        if (interaction.isStringSelectMenu()) {
            const selected = interaction.values[0];
            const selectedOption = selectedOptions[selected];

            await respond(interaction, selectedOption || "Opção não reconhecida.");
        } else if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error("Comando não encontrado");
                return;
            }

            // Verificação de cooldown
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const cooldownAmount = (command.data.cooldown || 5) * 1000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    await respond(interaction, {
                        content: `:anger: Por favor, espere **${timeLeft.toFixed(1)}** segundos antes de usar o comando novamente.`,
                        ephemeral: true
                    });
                    return;
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            await command.execute(interaction);
        }
    })
);
