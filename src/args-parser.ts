const parseArgument = (arg: any) => {
  // Try to parse the argument as a number
  const num = Number(arg);
  if (!isNaN(num)) {
      return num;
  }

  // Try to parse the argument as a boolean
  if (arg === "true") {
      return true;
  }
  if (arg === "false") {
      return false;
  }

  // Try to parse the argument as a string
  return arg;
}

const camelize = (s: string) => s.replace(/-./g, x => x[1].toUpperCase());

export const appArgs: Record<string, any> = {};
export const appCommands = [] as string[];

export function config() {
  for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith("--")) {
          const [key, value] = arg.split("=");
          if (key && value) {
              appArgs[camelize(key.slice(2))] = parseArgument(value);
          } else {
              const nextArg = process.argv[i + 1];
              if (nextArg) {
                  if (nextArg.startsWith("-")) {
                      appArgs[camelize(key.slice(2))] = true;
                  } else {
                      appArgs[camelize(key.slice(2))] = parseArgument(nextArg);
                      i++;
                  }
              } else {
                  appArgs[camelize(key.slice(2))] = true;
              }
          }
          continue;
      }

      if (arg.startsWith("-")) {
          const flags = arg.slice(1).split("");
          if (flags.length === 0) {
              continue;
          } else {
              if (flags.length === 1) {
                  const nextArg = process.argv[i + 1];
                  if (nextArg) {
                      if (nextArg.startsWith("-")) {
                          appArgs[flags[0]] = true;
                      } else {
                          appArgs[flags[0]] = parseArgument(nextArg);
                          i++;
                      }
                  } else {
                      appArgs[flags[0]] = true;
                  }
              } else {
                  for (const flag of flags) {
                      appArgs[flag] = true;
                  }
              }
          }
          continue;
      }

      appCommands.push(arg);
  }
}