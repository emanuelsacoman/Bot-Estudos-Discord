const { REST, Routes } = require("discord.js");
const dotenv = require('dotenv');
dotenv.config();
const { TOKEN, CLIENT_ID } = process.env;

const fs = require("node:fs");
const path = require("node:path");
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

const commands = [];

for (const file of commandFiles){
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log(`Resetando ${commands.length} comandos...`);

        // Registrando comandos globalmente para o bot
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        
        console.log("Comandos registrados com sucesso de forma global!");
    }
    catch(error) {
        console.error(error);
    }
})();

