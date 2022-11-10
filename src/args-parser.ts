const parseArgument = (arg: any) => {
  // Try to parse the argument as a number
  const num = Number(arg);
  if (!isNaN(num)) {
      return num;
  }

  // Try to parse the argument as a boolean
  if (arg === 'true') {
      return true;
  }
  if (arg === 'false') {
      return false;
  }

  // Try to parse the argument as a string
  return arg;
}

const camelize = (s: string) => s.replace(/-./g, x => x[1].toUpperCase());

export const args = {
    parsed: {} as Record<string, any>,
    raw: '',
};
export const commands = [] as string[];

export function config() {
  for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith('--')) {
          const [key, value] = arg.split('=');
          if (key && value) {
              args.parsed[camelize(key.slice(2))] = parseArgument(value);
          } else {
              const nextArg = process.argv[i + 1];
              if (nextArg) {
                  if (nextArg.startsWith('-')) {
                      args.parsed[camelize(key.slice(2))] = true;
                  } else {
                      args.parsed[camelize(key.slice(2))] = parseArgument(nextArg);
                      i++;
                  }
              } else {
                  args.parsed[camelize(key.slice(2))] = true;
              }
          }
          args.raw += arg + ' ';
          continue;
      }

      if (arg.startsWith('-')) {
          const flags = arg.slice(1).split('');
          if (flags.length === 0) {
              continue;
          } else {
              if (flags.length === 1) {
                  const nextArg = process.argv[i + 1];
                  if (nextArg) {
                      if (nextArg.startsWith('-')) {
                          args.parsed[flags[0]] = true;
                      } else {
                          args.parsed[flags[0]] = parseArgument(nextArg);
                          i++;
                      }
                  } else {
                      args.parsed[flags[0]] = true;
                  }
              } else {
                  for (const flag of flags) {
                      args.parsed[flag] = true;
                  }
              }
          }
          args.raw += arg + ' ';
          continue;
      }

      commands.push(arg);
  }
  args.raw = args.raw.trim();
}
