#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import * as lockfile from '@yarnpkg/lockfile';

import * as colors from './colors';

import type { IncomingMessage } from 'http';
import type { AnyObject, Package } from './types';

const [, , ...args] = process.argv;

function npmOrYarn() {
    try {
        execSync('yarn --version', { stdio: 'ignore' });
        return 'yarn';
    } catch (e) {
        try {
            execSync('npm --version', { stdio: 'ignore' });
            return 'npm';
        } catch (e) {
            throw new Error('npm or yarn not found');
        }
    }
}

const packageManager = npmOrYarn();

// Change to production
let isProduction = args.findIndex(arg => ['--prod', '--production'].includes(arg));
if (isProduction > -1) {
    args.splice(isProduction, 1);
    isProduction = 1;
} else {
    isProduction = 0;
}

const terminalArgs = [];
const dependencies: Package[] = [];

for (const arg of args) {
    if (arg.startsWith('-')) {
        terminalArgs.push(arg);
    } else {
        const version = arg.match(/@[^@]+$/)?.[0].replace('@', '') ?? '';
        const packageName = arg.replace(`@${version}`, '');
        dependencies.push({ [packageName]: version });
    }
}

const packageSyntax = `${packageManager} ${packageManager === 'npm' ? 'install' : 'add'} {package} ${terminalArgs.join(' ')}`;

function httpsGet(options: string | https.RequestOptions | URL) {
    return new Promise<IncomingMessage>((resolve, reject) => {
        https.get(options, (res) => {
            resolve(res);
        }).on('error', (err) => {
            reject(err);
        }).end();
    });
}

function readPackageJson() {
    return JSON.parse(fs.readFileSync('package.json', 'utf8'));
}

function terminalSpinner() {
    let i = 1;
    const spinnerChars = ['|', '/', '-', '\\'];
    process.stdout.write('\b' + spinnerChars[0]);
    const interval = setInterval(() => {
        process.stdout.write(`\b${spinnerChars[i]}`);
        i = (i + 1) % spinnerChars.length;
    }, 100);
    return {
        stop: () => {
            clearInterval(interval);
            process.stdout.write('\b');
        }
    };
}

function splitObject(obj: AnyObject) {
    const result: AnyObject[] = [];
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            result.push({ [key]: obj[key] });
        }
    }
    return result;
}

function installPackage(packageName: string, version?: string) {
    return new Promise<boolean>((resolve, reject) => {
        const currentCmd = packageSyntax.replace('{package}', packageName + (version ? `@${version}` : ''));
        process.stdout.write(`> ${currentCmd} `);
        const spinner = terminalSpinner();

        const currentProcess = exec(currentCmd);

        let stderr = '';

        currentProcess.stderr.on('data', (data) => {
            stderr += data;
        });

        currentProcess.on('exit', async (code, signal) => {
            spinner.stop();

            if (signal == 'SIGINT') {
                console.log('\n');
                console.log('Aborted'.style(colors.FgRed, colors.Bright));
                process.exit(code);
            }

            if (code === 0) {
                process.stdout.write('\u2713\n'.style(colors.FgGreen, colors.Bright));
                resolve(true);
            } else {
                process.stdout.write('\u2717\n'.style(colors.FgRed, colors.Bright));
                console.error(stderr.style(colors.FgRed));
                process.exit(code);
            }
        });
    });
}

async function installTypes(packageName: string) {
    if(packageName.startsWith('@types/')) {
        return;
    }

    if (packageName.startsWith("@")) {
        packageName = packageName.substring(1).split("/").join("__");
    }

    if ((await httpsGet(`https://registry.npmjs.org/@types/${packageName}`)).statusCode === 200) {
        return installPackage(`@types/${packageName}`);
    } else {
        console.log(`Types package for ${packageName} does not exist, skipping`.style(colors.FgYellow));
    }
}

async function install() {

    if (args.length == 0) {
        const packageJson = readPackageJson();
        if (!packageJson) {
            console.error('package.json not found'.style(colors.FgRed, colors.Bright));
            return;
        }

        dependencies.push(...splitObject(packageJson.dependencies ?? {}));
        if (!isProduction) {
            dependencies.push(...splitObject(packageJson.devDependencies ?? {}));
        }

    }

    for (const dependency of dependencies) {
        const [packageName, version] = Object.entries(dependency)[0];
        await installPackage(packageName, version) && await installTypes(packageName);
    }
}

install();