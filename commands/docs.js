const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, Component, EmbedBuilder } = require("discord.js")

const row = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("select")
            .setPlaceholder("Nenhuma linguagem selecionada")
            .addOptions({
                label: "Angular",
                description: "Veja a documentação do Angular",
                value: "angular"
            },
            {
                label: "C#",
                description: "Veja a documentação de C#",
                value: "csharp"
            },
            {
                label: "C++",
                description: "Veja a documentação de C++",
                value: "cpp"
            },
            {
                label: "CSS",
                description: "Veja a documentação de CSS",
                value: "css"
            },
            {
                label: "Dart",
                description: "Veja a documentação do Dart",
                value: "dart"
            },
            {
                label: "Discord.js",
                description: "Veja a documentação de Discord.js",
                value: "discordjs"
            },
            {
                label: "Git",
                description: "Veja a documentação do Git",
                value: "git"
            },
            {
                label: "Go",
                description: "Veja a documentação do Go",
                value: "go"
            },
            {
                label: "Godot",
                description: "Veja a documentação do Godot",
                value: "godot"
            },
            {
                label: "HTML",
                description: "Veja a documentação de HTML",
                value: "html"
            },
            {
                label: "Ionic",
                description: "Veja a documentação do Ionic",
                value: "ionic"
            },
            {
                label: "Java",
                description: "Veja a documentação de Java",
                value: "java"
            },
            {
                label: "Javascript",
                description: "Veja a documentação de Javascript",
                value: "javascript"
            },
            {
                label: "Kotlin",
                description: "Veja a documentação do Kotlin",
                value: "kotlin"
            },
            {
                label: "Python",
                description: "Veja a documentação de Python",
                value: "python"
            },
            {
                label: "React",
                description: "Veja a documentação do React",
                value: "react"
            },
            {
                label: "Ruby",
                description: "Veja a documentação do Ruby",
                value: "ruby"
            },
            {
                label: "Swift",
                description: "Veja a documentação do Swift",
                value: "swift"
            },
            {
                label: "TypeScript",
                description: "Veja a documentação de TypeScript",
                value: "typescript"
            },
            {
                label: "Unreal Engine",
                description: "Veja a documentação da Unreal Engine",
                value: "unreal"
            },
            {
                label: "Unity",
                description: "Veja a documentação do Unity",
                value: "unity"
            }                    
            
            )
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName("docs")
        .setDescription("Acesse a documentação da tecnologia que quiser"),

    async execute(interaction) {
        const exampleEmbed = new EmbedBuilder()
            .setColor('#ff9c00')
            .setTitle("Documentação")
            .setDescription("Escolha a tecnologia para acessar sua documentação. :arrow_down:")
            .setFooter({ text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png' })
            .setTimestamp();

            await interaction.reply({embeds: [exampleEmbed], components: [row] });
    }
}