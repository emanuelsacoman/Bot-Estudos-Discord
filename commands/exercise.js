const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, Component } = require("discord.js")

const row = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("select")
            .setPlaceholder("Nenhuma linguagem selecionada")
            .addOptions(
            {
                label: "C#",
                description: "Receba exercício de C#",
                value: "csharp"
            },
            {
                label: "C++",
                description: "Receba exercício de C++",
                value: "cpp"
            },
            {
                label: "CSS",
                description: "Receba exercício de CSS",
                value: "css"
            },
            {
                label: "HTML",
                description: "Receba exercício de HTML",
                value: "html"
            },
            {
                label: "Java",
                description: "Receba exercício de Java",
                value: "java"
            },
            {
                label: "Javascript",
                description: "Receba exercício de Javascript",
                value: "javascript"
            },
            {
                label: "Python",
                description: "Receba exercício de Python",
                value: "python"
            },
            {
                label: "TypeScript",
                description: "Receba exercício de TypeScript",
                value: "typescript"
            }                  
            
            )
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName("exercise")
        .setDescription("Faça um exercício aleatório"),

    async execute(interaction){
        await interaction.reply({content: "Selecione uma linguagem para receber um exercício:", components: [row]})
    }
}