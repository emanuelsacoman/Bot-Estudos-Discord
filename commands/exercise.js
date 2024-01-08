const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function gerarExercicio(linguagem) {
    const linguagens = {
        js: ['javascript', 'js'],
        ts: ['typescript', 'ts'],
        python: ['python', 'py'],
        java: ['java'],
        csharp: ['csharp', 'c#'],
        c: ['c'],
        cpp: ['cpp', 'c++', 'c plus plus'],
        html: ['html', 'hypertext markup language'],
        css: ['css', 'cascading style sheets']
    };

    const exercicios = {
        js: [
            "Escreva um programa que imprima 'Olá, mundo!' no console.",
            "Crie uma função que some dois números e retorne o resultado.",
            "Implemente uma função que verifique se um número é primo ou não.",
            "Crie um programa que calcule a sequência de Fibonacci até um determinado número.",
            "Escreva um algoritmo para encontrar o maior elemento em um array.",
            "Implemente uma função que verifique se uma string é um palíndromo.",
            "Crie um programa para contar o número de vogais em uma string.",
            "Escreva um algoritmo para inverter uma string.",
            "Implemente um programa que verifique se um número é par ou ímpar.",
            "Crie uma função que calcule o fatorial de um número.",
            "Escreva um programa que valide se um ano é bissexto ou não.",
            "Implemente um método para calcular a área de um círculo.",
            "Crie um algoritmo para encontrar o segundo maior número em um array.",
            "Escreva uma função que ordene um array de números em ordem crescente.",
            "Implemente um programa que encontre os números primos em um intervalo específico.",
            "Crie uma função que calcule a média de uma lista de números.",
            "Escreva um algoritmo para verificar se dois arrays são iguais.",
            "Implemente um programa que converta um número decimal para binário.",
            "Crie uma função que retorne o maior divisor comum de dois números.",
            "Escreva um algoritmo para contar o número de palavras em uma string.",
            "Implemente um programa que verifique se um número é positivo, negativo ou zero.",
            "Crie uma função que valide se um número é triangular ou não.",
            "Escreva um algoritmo para encontrar a soma dos dígitos de um número inteiro.",
            "Implemente um programa que calcule a área de um triângulo dadas as medidas dos lados.",
            "Crie uma função que calcule a raiz quadrada de um número.",
            "Escreva um algoritmo para encontrar o segundo menor número em um array.",
            "Implemente um programa que valide se uma string contém apenas dígitos.",
            "Crie uma função que ordene um array de números em ordem decrescente.",
            "Escreva um algoritmo para verificar se um número é perfeito ou não.",
            "Implemente um programa que valide se uma string é um número válido.",
            "Crie uma função que verifique se dois objetos têm as mesmas propriedades e valores.",
            "Escreva um algoritmo para verificar se uma matriz é simétrica ou não.",
            "Escreva uma função que recebe uma string e retorna a string reversa.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Crie uma função para calcular a soma dos dígitos de um número.",
            "Escreva um programa para ordenar um array de strings em ordem alfabética.",
            "Implemente um algoritmo para inverter uma string.",
            "Crie uma função para calcular a sequência de Fibonacci até um determinado número.",
            "Escreva um programa para encontrar os números perfeitos em um intervalo específico.",
            "Implemente um método para verificar se uma matriz é simétrica ou não.",
            "Crie uma função para verificar se dois strings são anagramas.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Crie uma função para converter um número decimal em binário.",
            "Escreva um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Crie uma função para verificar se uma string contém apenas dígitos.",
            "Escreva um programa para validar se um ano é bissexto ou não.",
            "Implemente um algoritmo para calcular a soma dos elementos de um array.",
            "Crie uma função para converter temperatura de Celsius para Fahrenheit.",
            "Escreva um programa para calcular a área de um triângulo.",
            "Implemente um método para encontrar o máximo divisor comum (MDC) de dois números."
        ],        
        ts: [
            "Crie uma interface que represente um usuário com email e telefone.",
            "Implemente uma função que verifique se um número é primo ou não.",
            "Escreva um programa que calcule a sequência de Fibonacci até um determinado número.",
            "Crie uma função que ordene um array de strings em ordem alfabética.",
            "Implemente um programa que valide se uma string é um palíndromo.",
            "Escreva um algoritmo para encontrar o maior elemento em um array.",
            "Implemente uma função que calcule a média de uma lista de números.",
            "Crie uma interface que represente um carro com modelo e ano.",
            "Escreva um algoritmo para verificar se um número é par ou ímpar.",
            "Implemente uma função que calcule o fatorial de um número.",
            "Crie um programa que valide se um ano é bissexto ou não.",
            "Escreva um algoritmo para contar o número de vogais em uma string.",
            "Implemente um método para ordenar um array de números.",
            "Crie uma função que retorne a quantidade de elementos em um array.",
            "Escreva um programa que converta um número decimal em binário.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Crie uma função que valide se um número é positivo, negativo ou zero.",
            "Escreva um programa que calcule a área de um círculo.",
            "Implemente um algoritmo para inverter uma string.",
            "Crie uma função que valide se um número é triangular ou não.",
            "Escreva um programa que valide se uma string contém apenas dígitos.",
            "Implemente uma função que ordene um array de números em ordem decrescente.",
            "Crie um algoritmo para encontrar a soma dos dígitos de um número inteiro.",
            "Escreva um programa que valide se uma string é um número válido.",
            "Implemente um método para calcular a área de um triângulo dadas as medidas dos lados.",
            "Crie uma função que calcule a raiz quadrada de um número.",
            "Escreva um algoritmo para encontrar o segundo menor número em um array.",
            "Implemente um programa que verifique se um número é perfeito ou não.",
            "Crie uma função que verifique se dois arrays são iguais.",
            "Escreva um algoritmo para contar o número de palavras em uma string.",
            "Escreva um programa para calcular o fatorial de um número usando recursão.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Crie uma função para calcular a soma dos dígitos de um número.",
            "Escreva um programa para ordenar um array de strings em ordem alfabética.",
            "Implemente um algoritmo para inverter uma string.",
            "Crie um programa para calcular a sequência de Fibonacci até um determinado número.",
            "Escreva um programa para encontrar os números perfeitos em um intervalo específico.",
            "Implemente um método para verificar se uma matriz é simétrica ou não.",
            "Crie uma função para verificar se dois strings são anagramas.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Crie uma função para converter um número decimal em binário.",
            "Escreva um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Crie uma função para verificar se uma string contém apenas dígitos.",
            "Escreva um programa para validar se um ano é bissexto ou não.",
            "Implemente um algoritmo para calcular a soma dos elementos de um array.",
            "Crie uma função para converter temperatura de Celsius para Fahrenheit.",
            "Escreva um programa para calcular a área de um triângulo.",
            "Implemente um método para encontrar o máximo divisor comum (MDC) de dois números."
        ],        
        python: [
            "Escreva um programa para verificar se um número é primo.",
            "Crie uma função para contar o número de vogais em uma string.",
            "Implemente um algoritmo para calcular a sequência de Fibonacci até um determinado número.",
            "Escreva um programa para encontrar o maior elemento em um array.",
            "Crie uma função para verificar se uma string é um palíndromo.",
            "Implemente um programa para contar o número de palavras em uma string.",
            "Escreva um algoritmo para inverter uma string.",
            "Crie uma função que calcule o fatorial de um número.",
            "Implemente um método para ordenar um array de números.",
            "Escreva um programa para validar se um ano é bissexto ou não.",
            "Crie uma função que valide se um número é positivo, negativo ou zero.",
            "Implemente um programa para converter um número decimal em binário.",
            "Escreva um algoritmo para calcular a área de um círculo.",
            "Crie um programa para encontrar os números primos em um intervalo específico.",
            "Implemente uma função que calcule a média de uma lista de números.",
            "Escreva um programa para validar se uma string contém apenas dígitos.",
            "Crie uma função que ordene um array de números em ordem crescente.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Escreva um algoritmo para verificar se dois arrays são iguais.",
            "Crie um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Implemente uma função para calcular a raiz quadrada de um número.",
            "Escreva um algoritmo para verificar se um número é par ou ímpar.",
            "Crie uma função que retorne o maior divisor comum de dois números.",
            "Implemente um programa que valide se uma string é um número válido.",
            "Escreva um algoritmo para encontrar a soma dos dígitos de um número inteiro.",
            "Crie uma função que verifique se dois objetos têm as mesmas propriedades e valores.",
            "Implemente um programa para validar se uma matriz é simétrica ou não.",
            "Escreva um programa para calcular a área de um triângulo.",
            "Implemente um algoritmo para encontrar todos os números primos em um intervalo específico.",
            "Crie uma função para calcular a média de uma lista de números.",
            "Escreva um programa para verificar se uma string é um palíndromo.",
            "Implemente um algoritmo para ordenar uma lista de strings em ordem alfabética.",
            "Crie uma função para converter um número binário para decimal.",
            "Escreva um programa para encontrar o segundo maior número em uma lista.",
            "Implemente uma função para calcular o máximo divisor comum (MDC) de dois números.",
            "Crie um programa para contar as palavras em um arquivo de texto.",
            "Escreva uma função para calcular o volume de uma esfera.",
            "Implemente um algoritmo para verificar se um número é triangular ou não.",
            "Crie uma função para calcular o fatorial de um número usando recursão.",
            "Escreva um programa para encontrar os números perfeitos em um intervalo específico.",
            "Implemente uma função para encontrar a mediana de uma lista de números.",
            "Crie um programa para gerar números de Fibonacci até um determinado valor.",
            "Escreva uma função para verificar se uma matriz é simétrica ou não.",
            "Implemente um algoritmo para calcular a soma dos dígitos de um número inteiro.",
            "Crie uma função para verificar se dois strings são anagramas.",
            "Escreva um programa para gerar números aleatórios dentro de um intervalo específico.",
            "Implemente um algoritmo para calcular a área de um polígono regular."
        ],        
        java: [
            "Escreva um programa para calcular o fatorial de um número.",
            "Crie uma classe que represente um carro com métodos para ligar e desligar.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Escreva um programa para encontrar o maior elemento em um array.",
            "Crie uma classe que represente um livro com métodos para empréstimo e devolução.",
            "Implemente um método para ordenar um array de números.",
            "Escreva um algoritmo para inverter uma string.",
            "Crie uma classe que represente um retângulo com métodos para calcular área e perímetro.",
            "Implemente um programa para validar se um ano é bissexto ou não.",
            "Escreva um algoritmo para contar o número de vogais em uma string.",
            "Crie uma classe que represente uma calculadora com métodos para adição, subtração, multiplicação e divisão.",
            "Implemente um programa que valide se uma string contém apenas dígitos.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Crie uma classe que represente um círculo com métodos para calcular área e perímetro.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Escreva um programa para ordenar uma lista encadeada.",
            "Crie uma classe que represente um triângulo com métodos para calcular área e perímetro.",
            "Implemente um programa para verificar se dois arrays são iguais.",
            "Escreva um algoritmo para verificar se um número é par ou ímpar.",
            "Crie uma classe que represente uma agenda com métodos para adicionar, remover e listar contatos.",
            "Implemente um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Escreva um programa para verificar se um número é primo ou não.",
            "Crie uma função para calcular a soma dos dígitos de um número.",
            "Implemente um algoritmo para inverter uma string.",
            "Escreva um programa para encontrar os números perfeitos em um intervalo específico.",
            "Crie uma classe para representar um círculo com métodos para calcular área e perímetro.",
            "Implemente um método para ordenar um array de strings em ordem alfabética.",
            "Escreva um programa para calcular o fatorial de um número.",
            "Crie uma classe para representar um retângulo com métodos para calcular área e perímetro.",
            "Implemente um algoritmo para verificar se uma matriz é simétrica ou não.",
            "Escreva um programa para calcular a sequência de Fibonacci até um determinado número.",
            "Crie uma classe para representar um triângulo com métodos para calcular área e perímetro.",
            "Implemente um método para verificar se um ano é bissexto ou não.",
            "Escreva um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Crie uma classe para representar um livro com métodos para empréstimo e devolução.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Crie uma classe para representar uma calculadora com métodos para adição, subtração, multiplicação e divisão.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Escreva um programa para validar se uma string contém apenas dígitos.",
            "Crie uma classe para representar um carro com métodos para ligar e desligar."
        ],        
        csharp: [
            "Escreva um programa para criar uma lista encadeada simples.",
            "Crie um método para ordenar um array de números.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Escreva um programa para encontrar o maior elemento em um array.",
            "Crie uma classe para representar um livro com métodos para empréstimo e devolução.",
            "Implemente um programa para verificar se uma string é um palíndromo.",
            "Escreva um algoritmo para calcular a sequência de Fibonacci até um determinado número.",
            "Crie um método para calcular a área de um círculo.",
            "Implemente um programa para validar se um ano é bissexto ou não.",
            "Escreva um algoritmo para contar o número de vogais em uma string.",
            "Crie uma classe para representar um carro com métodos para ligar e desligar.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Escreva um programa para contar o número de palavras em uma string.",
            "Crie uma classe para representar um retângulo com métodos para calcular área e perímetro.",
            "Implemente um programa para converter um número decimal em binário.",
            "Escreva um algoritmo para inverter uma string.",
            "Crie uma classe para representar um triângulo com métodos para calcular área e perímetro.",
            "Implemente um método para verificar se uma string contém apenas dígitos.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Crie uma classe para representar um círculo com métodos para calcular área e perímetro.",
            "Escreva um programa para encontrar todos os números primos até um determinado número.",
            "Crie uma função para calcular o máximo divisor comum (MDC) de dois números.",
            "Implemente um algoritmo para verificar se uma string é um palíndromo.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Crie uma classe para representar um círculo com métodos para calcular área e perímetro.",
            "Implemente um método para ordenar uma lista de strings em ordem alfabética.",
            "Escreva um programa para calcular o fatorial de um número.",
            "Crie uma classe para representar um retângulo com métodos para calcular área e perímetro.",
            "Implemente um algoritmo para verificar se uma matriz é simétrica ou não.",
            "Escreva um programa para calcular a sequência de Fibonacci até um determinado número.",
            "Crie uma classe para representar um triângulo com métodos para calcular área e perímetro.",
            "Implemente um método para verificar se um ano é bissexto ou não.",
            "Escreva um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Crie uma classe para representar um livro com métodos para empréstimo e devolução.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Crie uma classe para representar uma calculadora com métodos para adição, subtração, multiplicação e divisão.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Escreva um programa para validar se uma string contém apenas dígitos.",
            "Crie uma classe para representar um carro com métodos para ligar e desligar."
        ],        
        c: [
            "Escreva um programa para calcular a soma dos elementos de um array.",
            "Crie uma função para converter temperatura de Celsius para Fahrenheit.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Escreva um programa para encontrar o maior elemento em um array.",
            "Crie uma função para contar o número de vogais em uma string.",
            "Implemente um programa para verificar se uma string é um palíndromo.",
            "Escreva um algoritmo para calcular a sequência de Fibonacci até um determinado número.",
            "Crie um programa para validar se um ano é bissexto ou não.",
            "Implemente um algoritmo para inverter uma string.",
            "Escreva um método para calcular a área de um círculo.",
            "Crie um programa para contar o número de palavras em uma string.",
            "Implemente um programa para converter um número decimal em binário.",
            "Escreva um algoritmo para contar o número de caracteres em uma string.",
            "Crie um método para verificar se uma string contém apenas dígitos.",
            "Implemente um programa para calcular a média de uma lista de números.",
            "Escreva um algoritmo para encontrar o segundo maior número em um array.",
            "Crie um programa para validar se uma string é um número válido.",
            "Implemente um método para ordenar um array de números.",
            "Escreva um programa para calcular o fatorial de um número.",
            "Crie um algoritmo para verificar se um número é par ou ímpar.",
            "Escreva um programa para calcular o fatorial de um número usando recursão.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Crie uma função para calcular a soma dos dígitos de um número.",
            "Escreva um programa para ordenar um array de strings em ordem alfabética.",
            "Implemente um algoritmo para inverter uma string.",
            "Crie um programa para calcular a sequência de Fibonacci até um determinado número.",
            "Escreva um programa para encontrar os números perfeitos em um intervalo específico.",
            "Implemente um método para verificar se uma matriz é simétrica ou não.",
            "Crie uma função para verificar se dois strings são anagramas.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Crie uma função para converter um número decimal em binário.",
            "Escreva um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Crie uma função para verificar se uma string contém apenas dígitos.",
            "Escreva um programa para validar se um ano é bissexto ou não.",
            "Implemente um algoritmo para calcular a soma dos elementos de um array.",
            "Crie uma função para converter temperatura de Celsius para Fahrenheit.",
            "Escreva um programa para calcular a área de um triângulo.",
            "Implemente um método para encontrar o máximo divisor comum (MDC) de dois números."
        ],        
        cpp: [
            "Escreva um programa para encontrar o maior elemento em um array.",
            "Crie uma classe para representar um livro com métodos para empréstimo e devolução.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Escreva um programa para calcular a soma dos elementos de um array.",
            "Crie uma função para converter temperatura de Celsius para Fahrenheit.",
            "Implemente um programa para verificar se uma string é um palíndromo.",
            "Escreva um algoritmo para calcular a sequência de Fibonacci até um determinado número.",
            "Crie um método para calcular a área de um círculo.",
            "Implemente um programa para validar se um ano é bissexto ou não.",
            "Escreva um algoritmo para contar o número de vogais em uma string.",
            "Crie uma classe para representar um carro com métodos para ligar e desligar.",
            "Implemente um método para ordenar um array de números.",
            "Escreva um programa para contar o número de palavras em uma string.",
            "Crie uma classe para representar um retângulo com métodos para calcular área e perímetro.",
            "Implemente um programa para converter um número decimal em binário.",
            "Escreva um algoritmo para inverter uma string.",
            "Crie uma classe para representar um triângulo com métodos para calcular área e perímetro.",
            "Implemente um método para verificar se uma string contém apenas dígitos.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Crie uma classe para representar um círculo com métodos para calcular área e perímetro.",
            "Escreva um programa para calcular o fatorial de um número usando recursão.",
            "Implemente um algoritmo para verificar se um número é primo ou não.",
            "Crie uma função para calcular a soma dos dígitos de um número.",
            "Escreva um programa para ordenar um array de strings em ordem alfabética.",
            "Implemente um algoritmo para inverter uma string.",
            "Crie um programa para calcular a sequência de Fibonacci até um determinado número.",
            "Escreva um programa para encontrar os números perfeitos em um intervalo específico.",
            "Implemente um método para verificar se uma matriz é simétrica ou não.",
            "Crie uma função para verificar se dois strings são anagramas.",
            "Escreva um programa para calcular a média de uma lista de números.",
            "Implemente um algoritmo para encontrar o segundo maior número em um array.",
            "Crie uma função para converter um número decimal em binário.",
            "Escreva um programa para contar as ocorrências de uma determinada letra em uma string.",
            "Implemente um método para ordenar uma lista encadeada.",
            "Crie uma função para verificar se uma string contém apenas dígitos.",
            "Escreva um programa para validar se um ano é bissexto ou não.",
            "Implemente um algoritmo para calcular a soma dos elementos de um array.",
            "Crie uma função para converter temperatura de Celsius para Fahrenheit.",
            "Escreva um programa para calcular a área de um triângulo.",
            "Implemente um método para encontrar o máximo divisor comum (MDC) de dois números."
        ],        
        html: [
            "Crie uma página HTML simples com um título e um parágrafo.",
            "Escreva o código HTML básico para criar um formulário de login.",
            "Implemente um código HTML para criar uma lista não ordenada.",
            "Crie um documento HTML com uma tabela simples de dados.",
            "Escreva um código HTML para adicionar uma imagem em uma página web.",
            "Implemente um formulário HTML com campos de entrada de texto, caixa de seleção e botão de envio.",
            "Crie um documento HTML com links internos âncorados.",
            "Escreva um código HTML para incorporar um vídeo em uma página web.",
            "Implemente um formulário HTML com campos obrigatórios e de validação.",
            "Crie um documento HTML com uma barra de navegação horizontal.",
            "Escreva um código HTML para adicionar uma tabela de conteúdo em uma página web.",
            "Implemente um formulário HTML com campos de entrada de arquivo e seleção de data.",
            "Crie um documento HTML com uma estrutura de cabeçalho, conteúdo e rodapé.",
            "Escreva um código HTML para criar um menu dropdown.",
            "Implemente um formulário HTML com campos de entrada de número e e-mail.",
            "Crie um documento HTML com um layout em grade usando divs e CSS.",
            "Escreva um código HTML para criar um botão redirecionando para outra página.",
            "Implemente um formulário HTML com campos de entrada de senha e confirmação de senha.",
            "Crie um documento HTML com um elemento de lista ordenada.",
            "Crie uma página HTML com um cabeçalho, um rodapé e uma seção de conteúdo principal.",
            "Escreva um código HTML para criar uma lista ordenada com diferentes itens.",
            "Implemente um formulário HTML com campos de entrada de texto e uma caixa de seleção de opções.",
            "Crie um documento HTML com um elemento de tabela contendo dados fictícios.",
            "Escreva um código HTML para incorporar um áudio em uma página web.",
            "Implemente um formulário HTML com campos de entrada de data e hora.",
            "Crie um documento HTML com uma estrutura de layout usando elementos semânticos como header, main, section, aside e footer.",
            "Escreva um código HTML para criar um elemento de lista de descrição.",
            "Implemente um formulário HTML com campos de entrada de texto e um botão de envio.",
            "Crie um documento HTML com links externos e internos para diferentes páginas e seções.",
            "Escreva um código HTML para adicionar uma barra de navegação vertical.",
            "Implemente um formulário HTML com campos de entrada de URL e cor.",
            "Crie um documento HTML com uma tabela responsiva utilizando elementos semânticos.",
            "Escreva um código HTML para criar um elemento de lista de definição.",
            "Implemente um formulário HTML com campos de entrada de telefone e busca.",
            "Crie um documento HTML com um vídeo incorporado utilizando diferentes atributos.",
            "Escreva um código HTML para criar um elemento de lista de menus.",
            "Implemente um formulário HTML com campos de entrada de hora e intervalo.",
            "Crie um documento HTML com um formulário de contato contendo campos de entrada e área de texto."
        ],        
        css: [
            "Adicione estilos para tornar um texto em itálico.",
            "Estilize um botão para ter uma borda arredondada e uma sombra.",
            "Crie estilos para fazer um texto ter uma cor diferente.",
            "Estilize uma lista não ordenada para ter marcadores personalizados.",
            "Adicione estilos para fazer um texto ter sublinhado.",
            "Estilize um elemento de formulário para ter uma borda personalizada.",
            "Crie estilos para fazer um texto ter efeito de sombra de texto.",
            "Estilize um elemento de imagem para ter uma borda e tamanho específicos.",
            "Adicione estilos para fazer um texto ter espaçamento entre letras (tracking).",
            "Estilize um elemento de tabela para ter bordas e cores alternadas nas linhas.",
            "Crie estilos para fazer um texto ter efeito de gradiente de cor.",
            "Estilize um elemento de lista ordenada para ter um estilo de contagem personalizado.",
            "Adicione estilos para criar uma animação de rotação em um elemento.",
            "Estilize um formulário para ter um layout em colunas.",
            "Crie estilos para fazer um texto ter efeito de sobreposição de cor.",
            "Estilize um elemento de caixa para ter margens e preenchimentos específicos.",
            "Adicione estilos para fazer um texto ter efeito de texto decorado.",
            "Estilize um menu de navegação para ter um layout horizontal responsivo.",
            "Crie estilos para fazer um texto ter efeito de sombra externa.",
            "Estilize um elemento de div para ter uma cor de fundo e altura específicas.",
            "Estilize um elemento de parágrafo para ter uma fonte diferente.",
            "Adicione estilos para criar uma animação de fade-in em um elemento.",
            "Estilize um elemento de botão para ter um efeito de hover.",
            "Crie estilos para fazer um texto ter efeito de caixa alta.",
            "Estilize um elemento de tabela para ter bordas arredondadas.",
            "Adicione estilos para fazer um texto ter espaçamento entre linhas (leading).",
            "Estilize um formulário para ter um layout em grade.",
            "Crie estilos para fazer um texto ter efeito de sombra interna.",
            "Estilize um elemento de lista para ter um estilo de listagem personalizado.",
            "Adicione estilos para criar uma animação de movimento lateral em um elemento.",
            "Estilize um elemento de imagem para ter um efeito de escala suave.",
            "Crie estilos para fazer um texto ter efeito de contorno.",
            "Estilize um menu de navegação para ter um efeito de slide-down.",
            "Adicione estilos para fazer um texto ter efeito de estouro de texto (text-overflow).",
            "Estilize um elemento de div para ter um efeito de sombra múltipla.",
            "Crie estilos para fazer um texto ter efeito de espaçamento uniforme entre palavras (word-spacing).",
            "Estilize um elemento de lista para ter um efeito de animação de piscar.",
            "Adicione estilos para criar uma transição suave de cor em um elemento.",
            "Estilize um elemento de tabela para ter linhas e colunas alternadas com cores diferentes.",
            "Crie estilos para fazer um texto ter efeito de transparência (opacity)."
        ]        
    };

    const linguagemInput = linguagem.toLowerCase();

    for (const [linguagemBase, variacoes] of Object.entries(linguagens)) {
        if (variacoes.includes(linguagemInput)) {
            const exerciciosDaLinguagem = exercicios[linguagemBase];
            if (exerciciosDaLinguagem) {
                const exercicioAleatorio = exerciciosDaLinguagem[Math.floor(Math.random() * exerciciosDaLinguagem.length)];
                return exercicioAleatorio;
            } else {
                return "Não há exercícios cadastrados para esta linguagem.";
            }
        }
    }

    return "Linguagem não suportada ou sem exercícios cadastrados para essa linguagem.";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("exercise")
        .setDescription("Gera um exercício para você fazer")
        .addStringOption(option =>
            option.setName('linguagem')
                .setDescription('Especifique a linguagem do exercício')
                .setRequired(true)),

    async execute(interaction) {
        const linguagem = interaction.options.getString('linguagem');
        const exercicio = gerarExercicio(linguagem); // Supondo que essa função gere o exercício com base na linguagem
        
        const linguagemMaiuscula = linguagem.toUpperCase(); // Convertendo para maiúsculas
        
        const exampleEmbed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle(`Exercício de ${linguagemMaiuscula}`)
            .setDescription(`${exercicio}`)
            .setFooter({text: 'CodeBucket', iconURL: 'https://cdn-icons-png.flaticon.com/512/190/190544.png'})
            .setTimestamp();

        await interaction.reply({ embeds: [exampleEmbed] });
    }
};