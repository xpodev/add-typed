#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import { exec, execSync } from 'child_process';

import * as colors from './colors';

import type { IncomingMessage } from 'http';

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

let saveDev = args.findIndex(arg => ['--save-dev', '-D'].includes(arg));
if (saveDev > -1) {
    args.splice(saveDev, 1);
    saveDev = 1;
} else {
    saveDev = 0;
}

const terminalArgs = [];
const dependencies = [];

for (const arg of args) {
    if (arg.startsWith('-')) {
        terminalArgs.push(arg);
    } else {
        dependencies.push(arg);
    }
}

const packageSyntax = `${packageManager} ${packageManager === 'npm' ? 'install' : 'add'} {package} ${terminalArgs.join(' ')}`;
const typesSyntax = `${packageManager} ${packageManager === 'npm' ? 'install' : 'add'} @types/{package} --save-dev`;

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


function installPackage(packageName: string) {
    return new Promise<boolean>((resolve, reject) => {
        const currentCmd = packageSyntax.replace('{package}', packageName);
        process.stdout.write(`> ${currentCmd} `);
        const spinner = terminalSpinner();

        const currentProcess = exec(currentCmd);

        let stdout = '';
        let stderr = '';

        currentProcess.stdout.on('data', (data) => {
            stdout += data;
        });

        currentProcess.stderr.on('data', (data) => {
            stderr += data;
        });

        currentProcess.on('exit', async (code, signal) => {
            spinner.stop();

            if(signal == 'SIGINT') {
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
    if (packageName.startsWith("@")) {
        return;
    }

    if ((await httpsGet(`https://registry.npmjs.org/@types/${packageName}`)).statusCode === 200) {
        return installPackage(`@types/${packageName}`);
    } else {
        console.log(`There is no types package for ${packageName}, skipping`);
    }
}

async function install() {
    if (args.length == 0) {
        const packageJson = readPackageJson();
        if (!packageJson) {
            console.error('package.json not found'.style(colors.FgRed, colors.Bright));
            return;
        }

        dependencies.push(...Object.keys(packageJson.dependencies ?? {}));
        if (saveDev) {
            dependencies.push(...Object.keys(packageJson.devDependencies ?? {}));
        }
    }

    for (const arg of args) {
        await installPackage(arg) && await installTypes(arg);
    }
}

install();