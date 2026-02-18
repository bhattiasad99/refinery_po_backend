module.exports = {
  prompt: async ({ inquirer, args }) => {
    const questions = [];

    if (!args.name) {
      questions.push({
        type: "input",
        name: "name",
        message: "Service name (folder + package name):",
        validate: (value) =>
          /^[a-z0-9-]+$/.test(value)
            ? true
            : "Use kebab-case: lowercase letters, numbers, and dashes only.",
      });
    }

    if (!args.port) {
      questions.push({
        type: "input",
        name: "port",
        message: "Service port:",
        default: "8001",
        validate: (value) =>
          /^\d+$/.test(value) ? true : "Port must be a number.",
      });
    }

    const answers = questions.length ? await inquirer.prompt(questions) : {};
    return { ...args, ...answers };
  },
};
