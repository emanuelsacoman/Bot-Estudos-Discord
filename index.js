const { Client, Events, GatewayIntentBits, Collection } = require('discord.js')

const cooldowns = new Collection();

// dotenv
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

// Login do bot
client.once('ready', () => {
    console.log(`Pronto! Login realizado como ${client.user.tag}\n`);
    console.log(`${client.user.tag} foi iniciado em:`);

    client.guilds.cache.forEach(guild => {
        console.log(`Nome do servidor: ${guild.name} | ID do servidor: ${guild.id} | Membros: ${guild.memberCount}`);
    });

    console.log('\n');
    console.log(`O bot está conectado em um total de ${client.guilds.cache.size} servidores.`);
});

//avisa se alguém adicionar o bot
client.on('guildCreate', guild => {
    console.log(`O bot foi adicionado ao servidor: ${guild.name} (ID: ${guild.id}).`);

    console.log('\n');
    console.log(`O bot está conectado em um total de ${client.guilds.cache.size} servidores.`);
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
};

const docsCommand = require('./commands/docs');
client.commands.set(docsCommand.data.name, docsCommand);

// Listener de interações com o bot
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isStringSelectMenu()) {
        const selected = interaction.values[0];
        const selectedOption = selectedOptions[selected];

        if (selectedOption) {
            try {
                await interaction.reply(selectedOption);
                //await interaction.deferUpdate();
            } catch (error) {
                console.error("Erro ao responder/atualizar a interação:", error);
            }
        } else {
            try {
                await interaction.reply("Opção não reconhecida.");
                await interaction.deferUpdate();
            } catch (error) {
                console.error("Erro ao responder/atualizar a interação:", error);
            }
        }
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
                await interaction.reply({
                    content: `:anger: Por favor, espere **${timeLeft.toFixed(1)}** segundos antes de usar o comando novamente.`,
                    ephemeral: true
                });
                return;
            }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply("Houve um erro ao executar esse comando!");
        }
    }
});
