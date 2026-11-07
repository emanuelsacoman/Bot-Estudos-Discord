async function main(options) {
  try {
    return await require("./lib/registration").runRegistration(options);
  } catch {
    console.error("Não foi possível preparar o registro global de comandos.");
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = { main };
